from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        (
            'fines',
            '0003_fineextensionrequest_unique_pending_extension_per_fine',
        ),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.RemoveConstraint(
                    model_name='fineextensionrequest',
                    name='unique_pending_extension_per_fine',
                ),
            ],
        ),
    ]
