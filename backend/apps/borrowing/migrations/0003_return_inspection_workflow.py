
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("borrowing", "0002_remove_borrowhistory_borrowing_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name="borrowrecord",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending approval"),
                    ("issued", "Issued"),
                    ("overdue", "Overdue"),
                    ("return_requested", "Return requested"),
                    ("awaiting_payment", "Awaiting fine payment"),
                    ("ready_to_return", "Ready to finalize return"),
                    ("returned", "Returned"),
                    ("rejected", "Rejected"),
                ],
                default="issued",
                max_length=24,
            ),
        ),

        # These columns already exist in MySQL.
        # Update Django's migration state without creating them again.
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AddField(
                    model_name="borrowrecord",
                    name="return_requested_at",
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="borrowrecord",
                    name="inspected_at",
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="borrowrecord",
                    name="damage_fine",
                    field=models.DecimalField(
                        decimal_places=2,
                        default=0,
                        max_digits=8,
                    ),
                ),
            ],
        ),

        # These columns do not yet exist in MySQL.
        migrations.AddField(
            model_name="borrowrecord",
            name="damage_status",
            field=models.CharField(
                choices=[
                    ("none", "No damage"),
                    ("minor", "Minor"),
                    ("moderate", "Moderate"),
                    ("severe", "Severe"),
                    ("lost", "Lost"),
                ],
                default="none",
                max_length=16,
            ),
        ),

        migrations.AddField(
            model_name="borrowrecord",
            name="damage_notes",
            field=models.TextField(blank=True),
        ),

        migrations.AddField(
            model_name="borrowrecord",
            name="return_confirmed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="confirmed_book_returns",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
