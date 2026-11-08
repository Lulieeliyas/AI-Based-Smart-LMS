
import os
import shutil
import subprocess
import uuid

from pathlib import Path

from django.conf import settings
from django.db.models import Q, Sum
from decimal import Decimal
from django.http import FileResponse
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.books.models import Book, Category
from apps.borrowing.models import BorrowRecord
from apps.digital_resources.models import DigitalResource
from apps.users.models import AuthorizedUser
from apps.users.models import User
from apps.fines.models import Fine
from apps.users.permissions import IsAdminUser as IsLMSAdmin

from .models import (
    BackupRecord,
    SystemSetting,
    RestoreLog,
    AuditLog,
)

from .serializers import (
    BackupRecordSerializer,
    SystemSettingSerializer,
    RestoreLogSerializer,
    AuditLogSerializer,
)


# --------------------------------------------------
# BACKUP CONFIGURATION
# --------------------------------------------------

BACKUP_DIR = Path(settings.BASE_DIR) / "backups"


def write_audit_log(request, action, object_repr, details=None, success=True):
    """Record an administrative action."""

    try:
        AuditLog.objects.create(
            actor=request.user if request.user.is_authenticated else None,
            action=action,
            object_repr=str(object_repr)[:255],
            details=details or {},
            success=success,
        )
    except Exception:
        # An audit failure must not destroy an otherwise valid backup.
        pass


# --------------------------------------------------
# ADMIN DASHBOARD STATISTICS
# --------------------------------------------------


class SystemStatsView(APIView):
    permission_classes = [IsLMSAdmin]

    def get(self, request, *args, **kwargs):
        today = timezone.localdate()

        # ------------------------------------------------
        # BOOK STATISTICS
        # ------------------------------------------------

        total_book_titles = Book.objects.count()

        total_books = (
            Book.objects.aggregate(
                total=Sum("total_copies")
            )["total"] or 0
        )

        available_books = (
            Book.objects.aggregate(
                total=Sum("available_copies")
            )["total"] or 0
        )

        # ------------------------------------------------
        # BORROWING STATISTICS
        # ------------------------------------------------

        active_queryset = BorrowRecord.objects.filter(
            status__in=[
                BorrowRecord.Status.ISSUED,
                BorrowRecord.Status.OVERDUE,
            ]
        )

        overdue_queryset = BorrowRecord.objects.filter(
            Q(status=BorrowRecord.Status.OVERDUE)
            | Q(
                status=BorrowRecord.Status.ISSUED,
                due_date__lt=today,
            )
        )

        active_borrowings = active_queryset.count()
        overdue_borrowings = overdue_queryset.count()

        returned_borrowings = BorrowRecord.objects.filter(
            status=BorrowRecord.Status.RETURNED
        ).count()

        total_borrowings = BorrowRecord.objects.count()

        # ------------------------------------------------
        # USER STATISTICS
        # ------------------------------------------------

        active_users = User.objects.filter(
            is_active=True
        ).count()

        total_users = User.objects.count()

        # ------------------------------------------------
        # CATEGORY AND DIGITAL RESOURCE STATISTICS
        # ------------------------------------------------

        total_categories = Category.objects.count()

        total_digital_resources = DigitalResource.objects.count()

        # ------------------------------------------------
        # FINE STATISTICS
        # ------------------------------------------------

        outstanding_fines = Fine.objects.filter(
            status__in=[
                Fine.Status.UNPAID,
                Fine.Status.PARTIALLY_PAID,
            ]
        ).aggregate(
            total=Sum("amount") - Sum("paid_amount")
        )["total"] or Decimal("0.00")

        total_fine_records = Fine.objects.count()

        return Response({
            # Book statistics
            "total_books": total_books,
            "total_book_titles": total_book_titles,
            "available_books": available_books,

            # Borrowing statistics
            "borrowed_books": active_borrowings,
            "total_borrowings": total_borrowings,
            "active_borrowings": active_borrowings,
            "overdue_books": overdue_borrowings,
            "overdue_borrowings": overdue_borrowings,
            "returned_borrowings": returned_borrowings,

            # User statistics
            "active_users": active_users,
            "total_users": total_users,

            # Other statistics
            "total_categories": total_categories,
            "total_digital_resources": total_digital_resources,

            # Fine statistics
            "total_fines": str(outstanding_fines),
            "total_fine_records": total_fine_records,
        })


# --------------------------------------------------
# DATABASE BACKUP VIEWSET
# --------------------------------------------------

class BackupRecordViewSet(viewsets.ModelViewSet):

    serializer_class = BackupRecordSerializer
    permission_classes = [IsLMSAdmin]

    queryset = BackupRecord.objects.all()

    def create(self, request, *args, **kwargs):

        database = settings.DATABASES["default"]

        if database["ENGINE"] != "django.db.backends.mysql":
            return Response(
                {"error": "Automatic backups currently require MySQL."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        mysqldump = shutil.which("mysqldump")

        if not mysqldump:
            return Response(
                {"error": "mysqldump is not installed."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        BACKUP_DIR.mkdir(parents=True, exist_ok=True)

        timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")

        filename = f"library_backup_{timestamp}_{uuid.uuid4().hex[:8]}.sql"

        backup_path = BACKUP_DIR / filename

        record = BackupRecord.objects.create(
            filename=filename,
            created_by=request.user,
            status="pending",
        )

        env = os.environ.copy()

        password = database.get("PASSWORD")

        if password:
            env["MYSQL_PWD"] = str(password)

        command = [
            mysqldump,
            "--single-transaction",
            "--quick",
            "--routines",
            "--triggers",
            "--no-tablespaces",
            "--host=" + str(database.get("HOST") or "127.0.0.1"),
            "--port=" + str(database.get("PORT") or "3306"),
            "--user=" + str(database.get("USER") or ""),
            str(database["NAME"]),
        ]

        try:
            with open(backup_path, "wb") as backup_file:

                result = subprocess.run(
                    command,
                    stdout=backup_file,
                    stderr=subprocess.PIPE,
                    env=env,
                    timeout=3600,
                    check=False,
                )

            if result.returncode != 0:
                error = result.stderr.decode(
                    "utf-8", errors="replace"
                )

                raise RuntimeError(error[-2000:])

            size = backup_path.stat().st_size

            if size == 0:
                raise RuntimeError("The generated backup file is empty.")

            record.size_bytes = size
            record.status = "completed"

            record.save(
                update_fields=["size_bytes", "status"]
            )

            write_audit_log(
                request,
                "BACKUP_CREATED",
                filename,
                {
                    "backup_id": record.pk,
                    "size_bytes": size,
                },
            )

            return Response(
                BackupRecordSerializer(record).data,
                status=status.HTTP_201_CREATED,
            )

        except Exception as exc:

            if backup_path.exists():
                backup_path.unlink()

            record.status = "failed"

            record.save(update_fields=["status"])

            write_audit_log(
                request,
                "BACKUP_FAILED",
                filename,
                {"error": str(exc)[:1000]},
                success=False,
            )

            return Response(
                {
                    "error": "Database backup failed.",
                    "details": str(exc)[-1000:],
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):

        record = self.get_object()

        if record.status != "completed":
            return Response(
                {"error": "This backup is not completed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        filename = Path(record.filename).name

        if filename != record.filename:
            return Response(
                {"error": "Invalid backup filename."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        backup_path = BACKUP_DIR / filename

        if not backup_path.is_file():
            return Response(
                {"error": "Backup file not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        write_audit_log(
            request,
            "BACKUP_DOWNLOADED",
            filename,
            {"backup_id": record.pk},
        )

        response = FileResponse(
            open(backup_path, "rb"),
            as_attachment=True,
            filename=filename,
            content_type="application/sql",
        )

        return response

    def destroy(self, request, *args, **kwargs):

        record = self.get_object()

        filename = Path(record.filename).name

        if filename != record.filename:
            return Response(
                {"error": "Invalid backup filename."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        backup_path = BACKUP_DIR / filename

        # Never delete a backup referenced by restore history.
        if record.restore_logs.exists():
            return Response(
                {
                    "error": (
                        "This backup has restore history "
                        "and cannot be deleted."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        if backup_path.exists():
            backup_path.unlink()

        write_audit_log(
            request,
            "BACKUP_DELETED",
            filename,
            {"backup_id": record.pk},
        )

        record.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------
# SYSTEM SETTINGS VIEWSET
# --------------------------------------------------

class SystemSettingViewSet(viewsets.ModelViewSet):

    queryset = SystemSetting.objects.all()
    serializer_class = SystemSettingSerializer
    permission_classes = [IsLMSAdmin]

    def perform_update(self, serializer):

        instance = serializer.save()

        write_audit_log(
            self.request,
            "SYSTEM_SETTING_UPDATED",
            instance.key,
            {"value": instance.value},
        )

    def perform_destroy(self, instance):

        write_audit_log(
            self.request,
            "SYSTEM_SETTING_DELETED",
            instance.key,
        )

        instance.delete()


# --------------------------------------------------
# RESTORE HISTORY VIEWSET
# --------------------------------------------------

class RestoreLogViewSet(viewsets.ReadOnlyModelViewSet):

    queryset = RestoreLog.objects.select_related(
        "backup", "initiated_by"
    ).all()

    serializer_class = RestoreLogSerializer
    permission_classes = [IsLMSAdmin]


# --------------------------------------------------
# AUDIT LOG VIEWSET
# --------------------------------------------------

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):

    queryset = AuditLog.objects.select_related(
        "actor"
    ).all()

    serializer_class = AuditLogSerializer
    permission_classes = [IsLMSAdmin]
