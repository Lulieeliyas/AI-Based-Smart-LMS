
import os
import django

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "library_backend.settings"
)

django.setup()

from django.db import connection

with connection.cursor() as cursor:
    cursor.execute(
        "SELECT COUNT(*) FROM django_migrations WHERE app = %s",
        ["auth"]
    )
    count = cursor.fetchone()[0]

    print("Existing auth migration records:", count)

    print("No records have been deleted.")
