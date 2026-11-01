from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.borrowing.models import BorrowRecord
from .models import (
    Fine,
    FineReport,
    FinePayment,
    FineExtensionRequest,
    FineAdminReport,
)


class FineSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(
        source="user.username",
        read_only=True,
    )

    user_role = serializers.CharField(
        source="user.role",
        read_only=True,
    )

    outstanding_balance = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )

    borrow_record_id = serializers.IntegerField(
        source="borrow_record_id",
        read_only=True,
    )

    class Meta:
        model = Fine
        fields = (
            "id",
            "user",
            "user_username",
            "user_role",
            "borrow_record",
            "borrow_record_id",
            "reason",
            "description",
            "amount",
            "paid_amount",
            "outstanding_balance",
            "status",
            "payment_due_date",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class FineReportSerializer(serializers.ModelSerializer):
    reported_by_username = serializers.CharField(
        source="reported_by.username",
        read_only=True,
    )

    subject_user_username = serializers.CharField(
        source="subject_user.username",
        read_only=True,
    )

    borrow_record = serializers.PrimaryKeyRelatedField(
        queryset=BorrowRecord.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = FineReport
        fields = (
            "id",
            "reported_by",
            "reported_by_username",
            "subject_user",
            "subject_user_username",
            "borrow_record",
            "reason",
            "description",
            "evidence",
            "status",
            "proposed_amount",
            "approved_amount",
            "librarian_response",
            "reviewed_by",
            "reviewed_at",
            "generated_fine",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "reported_by",
            "reported_by_username",
            "subject_user_username",
            "status",
            "approved_amount",
            "librarian_response",
            "reviewed_by",
            "reviewed_at",
            "generated_fine",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        request = self.context.get("request")

        if request is None or not request.user.is_authenticated:
            raise serializers.ValidationError(
                "Authentication is required."
            )

        if self.instance is not None:
            raise serializers.ValidationError(
                "Fine reports cannot be edited after submission."
            )

        user = request.user
        role = getattr(user, "role", None)

        is_librarian = role == "librarian"

        borrow_record = attrs.get("borrow_record")
        subject_user = attrs.get("subject_user")

        if is_librarian:
            # Librarians may report with or without a borrowing record.
            if borrow_record:
                if (
                    subject_user
                    and subject_user.pk != borrow_record.user_id
                ):
                    raise serializers.ValidationError({
                        "subject_user": (
                            "The affected user must match the borrower."
                        )
                    })

                attrs["subject_user"] = borrow_record.user

            elif subject_user is None:
                raise serializers.ValidationError({
                    "subject_user": (
                        "Select the affected user when no borrowing "
                        "record is provided."
                    )
                })

        else:
            # Students, academic staff, digital officers, and admins
            # must report against their own borrowing record.
            if borrow_record is None:
                raise serializers.ValidationError({
                    "borrow_record": (
                        "You must select your own borrowing record "
                        "to submit a problem report."
                    )
                })

            if borrow_record.user_id != user.pk:
                raise serializers.ValidationError({
                    "borrow_record": (
                        "You can only report a problem related to "
                        "your own borrowing record."
                    )
                })

            if subject_user and subject_user.pk != user.pk:
                raise serializers.ValidationError({
                    "subject_user": (
                        "You can only submit a report about yourself."
                    )
                })

            attrs["subject_user"] = user

        return attrs

    def create(self, validated_data):
        validated_data["reported_by"] = self.context["request"].user
        return super().create(validated_data)


class FinePaymentSerializer(serializers.ModelSerializer):
    fine_reason = serializers.CharField(
        source="fine.reason", read_only=True
    )
    fine_description = serializers.CharField(
        source="fine.description", read_only=True
    )

    class Meta:
        model = FinePayment
        fields = (
            "id", "fine", "fine_reason", "fine_description", "user",
            "amount", "currency", "provider", "tx_ref",
            "provider_reference", "status", "checkout_url",
            "verified_at", "created_at", "updated_at",
        )
        read_only_fields = fields


class FineExtensionRequestSerializer(serializers.ModelSerializer):
    fine_balance = serializers.DecimalField(
        source="fine.outstanding_balance",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = FineExtensionRequest
        fields = (
            "id", "fine", "fine_balance", "requested_by", "reason",
            "requested_until", "status", "reviewed_by", "approved_until",
            "decision_note", "reviewed_at", "created_at",
        )
        read_only_fields = (
            "id", "requested_by", "status", "reviewed_by",
            "approved_until", "decision_note", "reviewed_at",
            "created_at",
        )

    def validate(self, attrs):
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            raise serializers.ValidationError(
                "Authentication is required."
            )

        fine = attrs["fine"]

        if fine.user_id != request.user.pk:
            raise serializers.ValidationError({
                "fine": "You can request an extension only for your own fine."
            })

        if fine.status in (Fine.Status.PAID, Fine.Status.WAIVED):
            raise serializers.ValidationError({
                "fine": "An extension cannot be requested for a paid "
                        "or waived fine."
            })

        if fine.outstanding_balance <= Decimal("0.00"):
            raise serializers.ValidationError({
                "fine": "This fine has no outstanding balance."
            })

        if FineExtensionRequest.objects.filter(
            fine=fine,
            status=FineExtensionRequest.Status.PENDING,
        ).exists():
            raise serializers.ValidationError({
                "fine": (
                    "There is already a pending extension request "
                    "for this fine."
                )
            })

        if attrs["requested_until"] <= timezone.localdate():
            raise serializers.ValidationError({
                "requested_until": "Choose a date later than today."
            })

        return attrs

    def create(self, validated_data):
        validated_data["requested_by"] = self.context["request"].user
        return super().create(validated_data)


class FineAdminReportSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True
    )
    recipient_usernames = serializers.SlugRelatedField(
        source="recipients",
        many=True,
        read_only=True,
        slug_field="username",
    )

    class Meta:
        model = FineAdminReport
        fields = (
            "id", "title", "description", "created_by",
            "created_by_username", "recipients", "recipient_usernames",
            "export_format", "filters", "snapshot", "file",
            "created_at", "sent_at",
        )
        read_only_fields = fields
