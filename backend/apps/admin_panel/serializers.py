
from rest_framework import serializers

from .models import (
    BackupRecord,
    SystemSetting,
    RestoreLog,
    AuditLog,
)


class BackupRecordSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = BackupRecord
        fields = [
            "id",
            "filename",
            "created_at",
            "size_bytes",
            "status",
            "created_by",
        ]
        read_only_fields = [
            "id",
            "filename",
            "created_at",
            "size_bytes",
            "status",
            "created_by",
        ]


class SystemSettingSerializer(serializers.ModelSerializer):

    class Meta:
        model = SystemSetting
        fields = [
            "id",
            "key",
            "value",
            "description",
        ]
        read_only_fields = ["id", "key"]

    def validate(self, attrs):
        key = (
            self.instance.key
            if self.instance
            else attrs.get("key")
        )

        if key == "borrowing_duration":
            value = attrs.get(
                "value",
                self.instance.value if self.instance else None,
            )

            try:
                duration = int(value)
            except (ValueError, TypeError):
                raise serializers.ValidationError({
                    "value": "Duration must be an integer number of days."
                })

            if duration <= 0:
                raise serializers.ValidationError({
                    "value": "Duration must be greater than zero."
                })

        return attrs


class RestoreLogSerializer(serializers.ModelSerializer):
    backup = serializers.StringRelatedField(read_only=True)
    initiated_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = RestoreLog
        fields = [
            "id",
            "backup",
            "started_at",
            "finished_at",
            "status",
            "initiated_by",
            "notes",
        ]
        read_only_fields = [
            "id",
            "backup",
            "started_at",
            "finished_at",
            "status",
            "initiated_by",
        ]


class AuditLogSerializer(serializers.ModelSerializer):
    actor = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor",
            "action",
            "object_repr",
            "timestamp",
            "details",
            "success",
        ]
        read_only_fields = fields
