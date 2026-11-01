
import hashlib
import hmac
import json
import logging

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.fines.models import Fine, FinePayment
from apps.fines.permissions import IsFineUser
from apps.fines.serializers import (
    FinePaymentSerializer,
    FineSerializer,
)
from apps.fines.services.payments import (
    ChapaPaymentError,
    initialize_fine_payment,
    verify_fine_payment,
)


logger = logging.getLogger(__name__)


class FinePaymentInitializeView(APIView):
    permission_classes = [IsAuthenticated, IsFineUser]

    def post(self, request):
        fine_id = request.data.get("fine_id")
        requested_amount = request.data.get("amount")

        if not fine_id:
            return Response(
                {"detail": "fine_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payment = initialize_fine_payment(
                fine_id=fine_id,
                user=request.user,
                requested_amount=requested_amount,
            )

        except ChapaPaymentError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": "Payment checkout initialized.",
                "payment": FinePaymentSerializer(payment).data,
                "checkout_url": payment.checkout_url,
                "tx_ref": payment.tx_ref,
            },
            status=status.HTTP_201_CREATED,
        )


class FinePaymentVerifyView(APIView):
    permission_classes = [IsAuthenticated, IsFineUser]

    def post(self, request):
        tx_ref = request.data.get("tx_ref")

        if not tx_ref:
            return Response(
                {"detail": "tx_ref is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payment = verify_fine_payment(
                tx_ref=tx_ref,
                user=request.user,
            )

        except ChapaPaymentError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": "Payment verified.",
                "payment": FinePaymentSerializer(payment).data,
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(csrf_exempt, name="dispatch")
class ChapaFineWebhookView(APIView):
    """
    Chapa webhook endpoint.

    Authenticate the raw webhook payload before processing it.
    Always verify successful transactions directly with Chapa.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def _valid_signature(self, request, secret):
        raw_body = request.body

        received_chapa_signature = request.headers.get(
            "chapa-signature", ""
        ).strip().lower()

        received_x_signature = request.headers.get(
            "x-chapa-signature", ""
        ).strip().lower()

        # Chapa documents chapa-signature as an HMAC of
        # the configured secret hash using that same secret.
        expected_chapa_signature = hmac.new(
            secret.encode("utf-8"),
            secret.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        # x-chapa-signature authenticates the event payload.
        expected_x_signature = hmac.new(
            secret.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()

        valid_chapa_signature = (
            bool(received_chapa_signature)
            and hmac.compare_digest(
                received_chapa_signature,
                expected_chapa_signature,
            )
        )

        valid_x_signature = (
            bool(received_x_signature)
            and hmac.compare_digest(
                received_x_signature,
                expected_x_signature,
            )
        )

        # Chapa documentation permits either valid header.
        return valid_chapa_signature or valid_x_signature

    def post(self, request):
        secret = getattr(
            settings,
            "CHAPA_WEBHOOK_SECRET",
            "",
        )

        if not secret or "your-" in secret.lower():
            logger.error(
                "Chapa webhook secret is not configured."
            )
            return JsonResponse(
                {"detail": "Webhook configuration error."},
                status=503,
            )

        if not self._valid_signature(request, secret):
            logger.warning(
                "Rejected Chapa webhook with invalid signature."
            )
            return JsonResponse(
                {"detail": "Invalid webhook signature."},
                status=403,
            )

        try:
            event_data = json.loads(request.body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return JsonResponse(
                {"detail": "Invalid JSON payload."},
                status=400,
            )

        if not isinstance(event_data, dict):
            return JsonResponse(
                {"detail": "Invalid webhook payload."},
                status=400,
            )

        event = event_data.get("event")

        # Ignore unrelated events, such as refunds or payouts.
        if event != "charge.success":
            return JsonResponse(
                {
                    "message": "Event received and ignored.",
                    "event": event,
                },
                status=200,
            )

        if str(event_data.get("status", "")).lower() != "success":
            return JsonResponse(
                {"detail": "Invalid successful-payment event."},
                status=400,
            )

        tx_ref = event_data.get("tx_ref")

        if not isinstance(tx_ref, str) or not tx_ref.strip():
            return JsonResponse(
                {"detail": "Transaction reference is required."},
                status=400,
            )

        try:
            payment = verify_fine_payment(
                tx_ref=tx_ref.strip(),
                user=None,
            )

        except ChapaPaymentError:
            logger.exception(
                "Chapa webhook transaction verification failed."
            )
            # A temporary verification failure should be retried.
            return JsonResponse(
                {"detail": "Payment verification temporarily failed."},
                status=503,
            )

        return JsonResponse(
            {
                "message": "Webhook processed successfully.",
                "tx_ref": payment.tx_ref,
                "payment_status": payment.status,
            },
            status=200,
        )


class FinePaymentHistoryView(generics.ListAPIView):
    serializer_class = FinePaymentSerializer
    permission_classes = [IsAuthenticated, IsFineUser]

    def get_queryset(self):
        user = self.request.user

        queryset = FinePayment.objects.select_related(
            "fine",
            "user",
        )

        if getattr(user, "role", None) == "librarian":
            return queryset

        return queryset.filter(user=user)


class FineListView(generics.ListAPIView):
    serializer_class = FineSerializer
    permission_classes = [IsAuthenticated, IsFineUser]

    def get_queryset(self):
        user = self.request.user

        queryset = Fine.objects.select_related(
            "user",
            "borrow_record",
        )

        if getattr(user, "role", None) == "librarian":
            return queryset

        return queryset.filter(user=user)
