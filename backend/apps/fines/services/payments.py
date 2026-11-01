
import logging
import uuid
from decimal import Decimal, InvalidOperation

import requests

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.fines.models import Fine, FinePayment
from apps.notifications.services import NotificationService


logger = logging.getLogger(__name__)

CHAPA_INITIALIZE_URL = (
    "https://api.chapa.co/v1/transaction/initialize"
)
CHAPA_VERIFY_URL = (
    "https://api.chapa.co/v1/transaction/verify/"
)

REQUEST_TIMEOUT = 30

def _send_payment_notifications(payment_id):
    """
    Send payment notifications after the payment transaction commits.
    """
    payment = (
        FinePayment.objects
        .select_related("fine", "user")
        .get(pk=payment_id)
    )

    NotificationService.notify_user_fine_payment_successful(
        payment
    )

    NotificationService.notify_librarians_fine_payment_received(
        payment
    )
CURRENCY = "ETB"


class ChapaPaymentError(Exception):
    """Raised when Chapa initialization or verification fails."""


def _get_secret_key():
    secret_key = getattr(settings, "CHAPA_SECRET_KEY", "")

    if not secret_key or "your-" in secret_key.lower():
        raise ChapaPaymentError(
            "Chapa Secret Key is not configured correctly."
        )

    return secret_key


def _get_headers():
    return {
        "Authorization": f"Bearer {_get_secret_key()}",
        "Content-Type": "application/json",
    }


def _money(value):
    try:
        amount = Decimal(str(value)).quantize(
            Decimal("0.01")
        )
    except (InvalidOperation, TypeError, ValueError):
        raise ChapaPaymentError("Invalid payment amount.")

    if not amount.is_finite() or amount <= Decimal("0.00"):
        raise ChapaPaymentError(
            "Payment amount must be greater than zero."
        )

    return amount


def _customer_name(user):
    first_name = (user.first_name or "").strip()
    last_name = (user.last_name or "").strip()

    if not first_name:
        first_name = (user.username or "Library").strip()

    if not last_name:
        last_name = "User"

    return first_name, last_name


def initialize_fine_payment(
    *,
    fine_id,
    user,
    requested_amount=None,
):
    """
    Initialize a Chapa hosted checkout payment.

    The fine must belong to the authenticated user.

    Only one pending checkout is allowed per fine.
    An existing pending checkout is reused, even if the user
    requests a different amount.

    The Chapa HTTP request is made outside the database
    transaction to avoid holding database locks during
    network communication.
    """

    # Validate Chapa configuration before creating a payment.
    headers = _get_headers()

    # Step 1: Validate the fine and create a pending payment.
    with transaction.atomic():
        fine = (
            Fine.objects
            .select_for_update()
            .select_related("user")
            .filter(pk=fine_id, user=user)
            .first()
        )

        if fine is None:
            raise ChapaPaymentError(
                "Fine not found or access denied."
            )

        if fine.status in {
            Fine.Status.PAID,
            Fine.Status.WAIVED,
            Fine.Status.DISPUTED,
        }:
            raise ChapaPaymentError(
                "This fine is not currently payable."
            )

        outstanding = fine.outstanding_balance

        if outstanding <= Decimal("0.00"):
            raise ChapaPaymentError(
                "This fine has no outstanding balance."
            )

        pending_payment = (
            FinePayment.objects
            .filter(
                fine=fine,
                user=user,
                status=FinePayment.Status.PENDING,
            )
            .order_by("-created_at")
            .first()
        )

        # Reuse an existing checkout instead of creating
        # another transaction for the same fine.
        if pending_payment:
            if pending_payment.checkout_url:
                return pending_payment

            raise ChapaPaymentError(
                "A payment checkout is already being prepared. "
                "Please try again shortly."
            )

        amount = (
            _money(requested_amount)
            if requested_amount is not None
            else _money(outstanding)
        )

        if amount > outstanding:
            raise ChapaPaymentError(
                "Payment amount exceeds the outstanding balance."
            )

        first_name, last_name = _customer_name(user)

        tx_ref = f"LMS-FINE-{uuid.uuid4().hex}"

        payment = FinePayment.objects.create(
            fine=fine,
            user=user,
            amount=amount,
            currency=CURRENCY,
            provider=FinePayment.Provider.CHAPA,
            tx_ref=tx_ref,
            status=FinePayment.Status.PENDING,
        )

        frontend_url = getattr(
            settings,
            "FRONTEND_URL",
            "http://localhost:5173",
        ).rstrip("/")

        return_url = (
            f"{frontend_url}/payment-result"
            f"?tx_ref={tx_ref}"
        )

        payload = {
            "amount": str(amount),
            "currency": CURRENCY,
            "email": user.email,
            "first_name": first_name,
            "last_name": last_name,
            "tx_ref": tx_ref,
            "return_url": return_url,
            "customization": {
                "title": "Library Fine Payment",
                "description": f"Payment for Fine #{fine.pk}",
            },
        }

        phone = (user.phone or "").strip()

        if phone:
            normalized_phone = phone

            if normalized_phone.startswith("+251"):
                normalized_phone = "0" + normalized_phone[4:]

            elif normalized_phone.startswith("251"):
                normalized_phone = "0" + normalized_phone[3:]

            if (
                len(normalized_phone) == 10
                and normalized_phone.isdigit()
            ):
                payload["phone_number"] = normalized_phone

    # Step 2: Contact Chapa outside the database transaction.
    try:
        response = requests.post(
            CHAPA_INITIALIZE_URL,
            json=payload,
            headers=headers,
            timeout=REQUEST_TIMEOUT,
        )

        response.raise_for_status()
        result = response.json()

    except requests.RequestException as exc:
        logger.exception(
            "Chapa initialization request failed."
        )

        with transaction.atomic():
            failed_payment = (
                FinePayment.objects
                .select_for_update()
                .get(pk=payment.pk)
            )

            if failed_payment.status == FinePayment.Status.PENDING:
                failed_payment.status = FinePayment.Status.FAILED
                failed_payment.provider_response = {
                    "error": "Chapa initialization request failed."
                }

                failed_payment.save(
                    update_fields=[
                        "status",
                        "provider_response",
                        "updated_at",
                    ]
                )

        raise ChapaPaymentError(
            "Unable to connect to Chapa. Please try again."
        ) from exc

    except ValueError as exc:
        with transaction.atomic():
            failed_payment = (
                FinePayment.objects
                .select_for_update()
                .get(pk=payment.pk)
            )

            if failed_payment.status == FinePayment.Status.PENDING:
                failed_payment.status = FinePayment.Status.FAILED
                failed_payment.provider_response = {
                    "error": "Invalid response from Chapa."
                }

                failed_payment.save(
                    update_fields=[
                        "status",
                        "provider_response",
                        "updated_at",
                    ]
                )

        raise ChapaPaymentError(
            "Chapa returned an invalid response."
        ) from exc

    # Step 3: Validate Chapa's initialization response.
    if not isinstance(result, dict):
        result = {}

    data = result.get("data") or {}

    if not isinstance(data, dict):
        data = {}

    checkout_url = data.get("checkout_url")

    if (
        result.get("status") != "success"
        or not isinstance(checkout_url, str)
        or not checkout_url.startswith("https://")
    ):
        with transaction.atomic():
            failed_payment = (
                FinePayment.objects
                .select_for_update()
                .get(pk=payment.pk)
            )

            if failed_payment.status == FinePayment.Status.PENDING:
                failed_payment.status = FinePayment.Status.FAILED
                failed_payment.provider_response = {
                    "message": result.get(
                        "message",
                        "Chapa did not return a valid checkout URL.",
                    )
                }

                failed_payment.save(
                    update_fields=[
                        "status",
                        "provider_response",
                        "updated_at",
                    ]
                )

        raise ChapaPaymentError(
            "Chapa could not initialize the payment."
        )

    # Step 4: Save the checkout URL.
    with transaction.atomic():
        saved_payment = (
            FinePayment.objects
            .select_for_update()
            .get(pk=payment.pk)
        )

        saved_payment.checkout_url = checkout_url
        saved_payment.provider_response = {
            "message": result.get("message", ""),
            "status": result.get("status"),
        }

        saved_payment.save(
            update_fields=[
                "checkout_url",
                "provider_response",
                "updated_at",
            ]
        )

    return saved_payment


def verify_fine_payment(*, tx_ref, user=None):
    """
    Verify a transaction directly with Chapa.

    The payment is applied to the fine only after Chapa confirms:
    - successful status
    - matching transaction reference
    - matching amount
    - ETB currency

    Repeated verification cannot apply the same payment twice.
    """

    if not tx_ref:
        raise ChapaPaymentError(
            "Transaction reference is required."
        )

    payment_query = FinePayment.objects.filter(
        tx_ref=tx_ref,
        provider=FinePayment.Provider.CHAPA,
    )

    if user is not None:
        payment_query = payment_query.filter(user=user)

    payment = payment_query.select_related("fine").first()

    if payment is None:
        raise ChapaPaymentError(
            "Payment transaction not found."
        )

    if payment.user_id != payment.fine.user_id:
        raise ChapaPaymentError(
            "Payment user does not match the fine owner."
        )

    # A previously applied successful payment is idempotent.
    if payment.status == FinePayment.Status.SUCCESSFUL:
        return payment

    verify_url = f"{CHAPA_VERIFY_URL}{tx_ref}"

    try:
        response = requests.get(
            verify_url,
            headers=_get_headers(),
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        result = response.json()

    except requests.RequestException as exc:
        logger.exception(
            "Chapa verification request failed."
        )
        raise ChapaPaymentError(
            "Unable to verify payment with Chapa. Try again."
        ) from exc

    except ValueError as exc:
        raise ChapaPaymentError(
            "Chapa returned an invalid verification response."
        ) from exc

    data = result.get("data") or {}

    provider_status = str(
        data.get("status", "")
    ).lower()

    if result.get("status") != "success":
        raise ChapaPaymentError(
            "Chapa has not confirmed this payment."
        )

    returned_tx_ref = data.get("tx_ref")

    if returned_tx_ref != payment.tx_ref:
        raise ChapaPaymentError(
            "Transaction reference does not match."
        )

    returned_currency = str(
        data.get("currency", "")
    ).upper()

    if returned_currency != payment.currency:
        raise ChapaPaymentError(
            "Payment currency does not match."
        )

    try:
        returned_amount = Decimal(
            str(data.get("amount"))
        ).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError, ValueError):
        raise ChapaPaymentError(
            "Chapa returned an invalid payment amount."
        )

    if returned_amount != payment.amount:
        raise ChapaPaymentError(
            "Payment amount does not match the expected amount."
        )

    if provider_status != "success":
        if provider_status == "failed":
            payment.status = FinePayment.Status.FAILED
            payment.provider_response = {
                "verification_status": provider_status,
            }
            payment.save(
                update_fields=[
                    "status",
                    "provider_response",
                    "updated_at",
                ]
            )

        raise ChapaPaymentError(
            "Chapa has not confirmed a successful payment."
        )

    provider_reference = str(
        data.get("reference", "")
    )

    with transaction.atomic():
        locked_payment = (
            FinePayment.objects
            .select_for_update()
            .get(pk=payment.pk)
        )

        if locked_payment.status == FinePayment.Status.SUCCESSFUL:
            return locked_payment

        locked_fine = (
            Fine.objects
            .select_for_update()
            .get(pk=locked_payment.fine_id)
        )

        if (
            locked_fine.paid_amount + locked_payment.amount
            > locked_fine.amount
        ):
            raise ChapaPaymentError(
                "Payment would exceed the fine amount. "
                "Manual review is required."
            )

        locked_payment.status = FinePayment.Status.SUCCESSFUL
        locked_payment.provider_reference = provider_reference
        locked_payment.provider_response = {
            "verification_status": provider_status,
            "reference": provider_reference,
            "currency": returned_currency,
            "amount": str(returned_amount),
        }
        locked_payment.verified_at = timezone.now()

        locked_payment.save(
            update_fields=[
                "status",
                "provider_reference",
                "provider_response",
                "verified_at",
                "updated_at",
            ]
        )

        locked_fine.paid_amount += locked_payment.amount

        if locked_fine.paid_amount >= locked_fine.amount:
            locked_fine.paid_amount = locked_fine.amount
            locked_fine.status = Fine.Status.PAID
        else:
            locked_fine.status = Fine.Status.PARTIALLY_PAID

        locked_fine.save(
            update_fields=[
                "paid_amount",
                "status",
                "updated_at",
            ]
        )

        # Keep the legacy BorrowRecord.fine field synchronized.
        if locked_fine.overdue_borrow_record_id:
            borrow_record = locked_fine.overdue_borrow_record
            borrow_record.fine = locked_fine.outstanding_balance
            borrow_record.save(update_fields=["fine"])

        elif locked_fine.borrow_record_id:
            borrow_record = locked_fine.borrow_record
            if locked_fine.reason == Fine.Reason.OVERDUE:
                borrow_record.fine = locked_fine.outstanding_balance
                borrow_record.save(update_fields=["fine"])

                # Send notifications only after the database transaction commits.
        transaction.on_commit(
            lambda payment_id=locked_payment.pk:
                _send_payment_notifications(payment_id)
        )

        return locked_payment
