
from django.db import migrations


def fix_legacy_columns(apps, schema_editor):
    connection = schema_editor.connection
    vendor = connection.vendor

    table = "borrowing_borrowrecord"

    with connection.cursor() as cursor:
        columns = {
            column.name
            for column in connection.introspection.get_table_description(
                cursor, table
            )
        }

    if vendor == "mysql":
        statements = [
            "ALTER TABLE borrowing_borrowrecord MODIFY damage_description LONGTEXT NULL",
            "ALTER TABLE borrowing_borrowrecord MODIFY overdue_fine DECIMAL(10,2) NULL",
            "ALTER TABLE borrowing_borrowrecord MODIFY return_status VARCHAR(24) NULL",
        ]
    elif vendor == "postgresql":
        statements = [
            "ALTER TABLE borrowing_borrowrecord ALTER COLUMN damage_description TYPE TEXT",
            "ALTER TABLE borrowing_borrowrecord ALTER COLUMN damage_description DROP NOT NULL",
            "ALTER TABLE borrowing_borrowrecord ALTER COLUMN overdue_fine TYPE NUMERIC(10,2)",
            "ALTER TABLE borrowing_borrowrecord ALTER COLUMN overdue_fine DROP NOT NULL",
            "ALTER TABLE borrowing_borrowrecord ALTER COLUMN return_status TYPE VARCHAR(24)",
            "ALTER TABLE borrowing_borrowrecord ALTER COLUMN return_status DROP NOT NULL",
        ]
    else:
        return

    required_columns = {
        "damage_description",
        "overdue_fine",
        "return_status",
    }

    missing = required_columns - columns
    if missing:
        raise RuntimeError(
            f"Cannot update borrowing_borrowrecord. Missing columns: {missing}"
        )

    for statement in statements:
        schema_editor.execute(statement)


class Migration(migrations.Migration):

    dependencies = [
        ("borrowing", "0003_return_inspection_workflow"),
    ]

    operations = [
        migrations.RunPython(
            fix_legacy_columns,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
