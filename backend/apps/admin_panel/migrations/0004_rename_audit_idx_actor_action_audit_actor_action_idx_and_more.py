from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        (
            'admin_panel',
            '0003_rename_audit_idx_actor_action_audit_actor_action_idx_and_more',
        ),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.RenameIndex(
                    model_name='auditlog',
                    old_name='audit_idx_actor_action',
                    new_name='audit_actor_action_idx',
                ),
                migrations.RenameIndex(
                    model_name='auditlog',
                    old_name='audit_idx_timestamp',
                    new_name='audit_timestamp_idx',
                ),
            ],
        ),
    ]
