
from django.db import models
from django.conf import settings


class BackupRecord(models.Model):
    """Record of a database backup performed by an administrator."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    filename = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    size_bytes = models.BigIntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="backups_created",
    )

    class Meta:
        db_table = "admin_backup_records"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Backup {self.filename} ({self.status})"


class SystemSetting(models.Model):
    """Stores configurable system settings as key-value pairs."""

    key = models.CharField(max_length=100, unique=True)
    value = models.CharField(max_length=500)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "admin_system_settings"
        ordering = ["key"]

    def __str__(self):
        return f"{self.key} = {self.value}"


class RestoreLog(models.Model):
    """Records database restoration operations."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    backup = models.ForeignKey(
        BackupRecord,
        on_delete=models.PROTECT,
        related_name="restore_logs",
    )
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="restores_initiated",
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "admin_restore_logs"
        ordering = ["-started_at"]

    def __str__(self):
        return f"Restore from {self.backup.filename} ({self.status})"


class AuditLog(models.Model):
    """Stores audit records for important administrative actions."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_events",
    )
    action = models.CharField(max_length=50)
    object_repr = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)
    details = models.JSONField(blank=True, default=dict)
    success = models.BooleanField(default=True)

    class Meta:
        db_table = "admin_audit_log"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(
                fields=["actor", "action"],
                name="audit_actor_action_idx",
            ),
            models.Index(
                fields=["timestamp"],
                name="audit_timestamp_idx",
            ),
        ]

    def __str__(self):
        return f"{self.actor} {self.action} at {self.timestamp}"
