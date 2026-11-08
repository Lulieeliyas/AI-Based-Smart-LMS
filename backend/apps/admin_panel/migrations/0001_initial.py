
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [

        migrations.CreateModel(
            name="BackupRecord",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "filename",
                    models.CharField(
                        max_length=255,
                        unique=True,
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "size_bytes",
                    models.BigIntegerField(
                        blank=True,
                        null=True,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("completed", "Completed"),
                            ("failed", "Failed"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="backups_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "admin_backup_records",
                "ordering": ["-created_at"],
            },
        ),

        migrations.CreateModel(
            name="SystemSetting",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "key",
                    models.CharField(
                        max_length=100,
                        unique=True,
                    ),
                ),
                (
                    "value",
                    models.CharField(max_length=500),
                ),
                (
                    "description",
                    models.TextField(blank=True),
                ),
            ],
            options={
                "db_table": "admin_system_settings",
                "ordering": ["key"],
            },
        ),

        migrations.CreateModel(
            name="RestoreLog",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "started_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "finished_at",
                    models.DateTimeField(
                        blank=True,
                        null=True,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("completed", "Completed"),
                            ("failed", "Failed"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                (
                    "notes",
                    models.TextField(blank=True),
                ),
                (
                    "backup",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="restore_logs",
                        to="admin_panel.backuprecord",
                    ),
                ),
                (
                    "initiated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="restores_initiated",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "admin_restore_logs",
                "ordering": ["-started_at"],
            },
        ),

        migrations.CreateModel(
            name="AuditLog",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "action",
                    models.CharField(max_length=50),
                ),
                (
                    "object_repr",
                    models.CharField(max_length=255),
                ),
                (
                    "timestamp",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "details",
                    models.JSONField(
                        blank=True,
                        default=dict,
                    ),
                ),
                (
                    "success",
                    models.BooleanField(default=True),
                ),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="audit_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "admin_audit_log",
                "ordering": ["-timestamp"],
                "indexes": [
                    models.Index(
                        fields=["actor", "action"],
                        name="audit_actor_action_idx",
                    ),
                    models.Index(
                        fields=["timestamp"],
                        name="audit_timestamp_idx",
                    ),
                ],
            },
        ),
    ]
