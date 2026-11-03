
from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "user",
            "type",
            "title",
            "message",
            "is_read",
            "data",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "type",
            "title",
            "message",
            "data",
            "created_at",
        ]
