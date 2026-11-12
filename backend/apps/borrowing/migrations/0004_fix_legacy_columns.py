from django.db import migrations


def fix_legacy_columns(apps, schema_editor):
    connection = schema_editor.connection
    vendor = connection.vendor
    table = "borrowing_borrowrecord"

    with connection.cursor() as cursor:
        columns = {
            c.name
            for c in connection.introspection.get_table_description(cursor, table)
        }

    # 1. Add missing columns
    if "damage_description" not in columns:
        if vendor == "mysql":
            schema_editor.execute(
                "ALTER TABLE borrowing_borrowrecord "
                "ADD COLUMN damage_description LONGTEXT NULL"
            )
        else:
            schema_editor.execute(
                "ALTER TABLE borrowing_borrowrecord "
                "ADD COLUMN damage_description TEXT NULL"
            )

    if "overdue_fine" not in columns:
        if vendor == "mysql":
            schema_editor.execute(
                "ALTER TABLE borrowing_borrowrecord "
                "ADD COLUMN overdue_fine DECIMAL(10,2) NULL DEFAULT 0.00"
            )
        else:
            schema_editor.execute(
                "ALTER TABLE borrowing_borrowrecord "
                "ADD COLUMN overdue_fine NUMERIC(10,2) NULL DEFAULT 0"
            )

    if "return_status" not in columns:
        if vendor == "mysql":
            schema_editor.execute(
                "ALTER TABLE borrowing_borrowrecord "
                "ADD COLUMN return_status VARCHAR(24) NULL "
                "DEFAULT 'not_returned'"
            )
        else:
            schema_editor.execute(
                "ALTER TABLE borrowing_borrowrecord "
                "ADD COLUMN return_status VARCHAR(24) NULL"
            )

    # 2. Loosen column types (MySQL/PG only; SQLite can't)
    if vendor == "mysql":
        schema_editor.execute(
            "ALTER TABLE borrowing_borrowrecord "
            "MODIFY damage_description LONGTEXT NULL"
        )
        schema_editor.execute(
            "ALTER TABLE borrowing_borrowrecord "
            "MODIFY overdue_fine DECIMAL(10,2) NULL"
        )
        schema_editor.execute(
            "ALTER TABLE borrowing_borrowrecord "
            "MODIFY return_status VARCHAR(24) NULL"
        )
    elif vendor == "postgresql":
        schema_editor.execute(
            "ALTER TABLE borrowing_borrowrecord "
            "ALTER COLUMN damage_description TYPE TEXT"
        )
        schema_editor.execute(
            "ALTER TABLE borrowing_borrowrecord "
            "ALTER COLUMN damage_description DROP NOT NULL"
        )
        schema_editor.execute(
            "ALTER TABLE borrowing_borrowrecord "
            "ALTER COLUMN overdue_fine TYPE NUMERIC(10,2)"
        )
        schema_editor.execute(
            "ALTER TABLE borrowing_borrowrecord "
            "ALTER COLUMN overdue_fine DROP NOT NULL"
        )
        schema_editor.execute(
            "ALTER TABLE borrowing_borrowrecord "
            "ALTER COLUMN return_status TYPE VARCHAR(24)"
        )
        schema_editor.execute(
            "ALTER TABLE borrowing_borrowrecord "
            "ALTER COLUMN return_status DROP NOT NULL"
        )


class Migration(migrations.Migration):

    atomic = False  # ← THE FIX: MySQL can't roll back DDL inside a transaction

    dependencies = [
        ("borrowing", "0003_return_inspection_workflow"),
    ]

    operations = [
        migrations.RunPython(
            fix_legacy_columns,
            reverse_code=migrations.RunPython.noop,
        ),
    ]