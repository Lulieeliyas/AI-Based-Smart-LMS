# backend/apps/digital_resources/views.py

import os
import mimetypes

from django.db.models import F, Q
from django.http import FileResponse, Http404, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import Category, DigitalResource
from .serializers import (
    CategorySerializer,
    DigitalResourceSerializer,
    DigitalResourceListSerializer,
)


def is_digital_officer(user):
    if not user or not user.is_authenticated:
        return False

    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True

    role = str(getattr(user, "role", "")).lower().replace("-", "_").replace(" ", "_")

    allowed_roles = {
        "admin",
        "administrator",
        "digital_officer",
        "digital_library_officer",
        "librarian",
    }

    return role in allowed_roles


class IsDigitalOfficer(BasePermission):
    message = "You do not have permission to manage digital resources."

    def has_permission(self, request, view):
        return is_digital_officer(request.user)


def _check_resource_access(request, resource):
    """
    Returns None if access is allowed, otherwise a DRF Response to return.
    """
    if is_digital_officer(request.user):
        return None

    if resource.quality_status != "verified":
        return Response(
            {"error": "Resource is pending review."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if resource.access_level == "public":
        return None

    if not request.user or not request.user.is_authenticated:
        return Response(
            {"error": "Authentication required"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    role = str(getattr(request.user, "role", "")).lower()

    if resource.access_level == "registered":
        return None  # any authenticated user

    if resource.access_level == "students":
        if role not in [
            "student",
            "academic_staff",
            "librarian",
            "admin",
            "digital_officer",
            "digital_library_officer",
            "administrator",
        ]:
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )
        return None

    if resource.access_level == "staff":
        if role not in [
            "academic_staff",
            "librarian",
            "admin",
            "digital_officer",
            "digital_library_officer",
            "administrator",
        ]:
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )
        return None

    if resource.access_level == "restricted":
        # only officers reach here (handled above), so deny
        return Response(
            {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
        )

    return None


class DigitalResourceListCreateView(generics.ListCreateAPIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_serializer_class(self):
        if self.request.method == "GET":
            return DigitalResourceListSerializer
        return DigitalResourceSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = DigitalResource.objects.select_related(
            "category", "book", "uploaded_by", "verified_by"
        ).all()

        is_officer = is_digital_officer(user)

        if not is_officer:
            if not user or not user.is_authenticated:
                queryset = queryset.filter(
                    access_level="public", quality_status="verified"
                )
            else:
                user_role = str(getattr(user, "role", "")).lower()
                if user_role == "student":
                    queryset = queryset.filter(
                        access_level__in=["public", "registered", "students"],
                        quality_status="verified",
                    )
                elif user_role == "academic_staff":
                    queryset = queryset.filter(
                        access_level__in=[
                            "public",
                            "registered",
                            "students",
                            "staff",
                        ],
                        quality_status="verified",
                    )
                else:
                    queryset = queryset.filter(
                        access_level__in=["public", "registered"],
                        quality_status="verified",
                    )

        params = self.request.query_params
        search = params.get("search", "").strip()
        category = params.get("category")
        resource_type = params.get("resource_type")
        quality_status = params.get("quality_status") or params.get("status")
        source_type = params.get("source_type")

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(keywords__icontains=search)
                | Q(category__name__icontains=search)
            )

        if category and category != "all":
            if category.isdigit():
                queryset = queryset.filter(category_id=int(category))
            else:
                queryset = queryset.filter(category__name__iexact=category)

        if resource_type and resource_type != "all":
            queryset = queryset.filter(resource_type=resource_type)

        if quality_status and is_officer:
            queryset = queryset.filter(quality_status=quality_status)

        if source_type and source_type != "all":
            queryset = queryset.filter(source_type=source_type)

        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        is_officer = is_digital_officer(user)
        initial_status = "verified" if is_officer else "pending"
        serializer.save(
            uploaded_by=user,
            quality_status=initial_status,
            verified_by=user if is_officer else None,
            verified_at=timezone.now() if is_officer else None,
        )


class DigitalResourceDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = DigitalResource.objects.select_related(
        "category", "book", "uploaded_by", "verified_by"
    )
    serializer_class = DigitalResourceSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return [IsAuthenticated(), IsDigitalOfficer()]
        return [AllowAny()]

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if not is_digital_officer(request.user):
            if instance.quality_status != "verified":
                return Response(
                    {"detail": "This resource is pending review."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class DigitalResourceServeView(APIView):
    """
    Streams file inline (view in browser) with proper content-type.
    Adds CORS / frame headers so PDFs render in iframes and pop-outs.
    """
    permission_classes = [AllowAny]

    def get(self, request, pk):
        resource = get_object_or_404(DigitalResource, pk=pk)

        denied = _check_resource_access(request, resource)
        if denied is not None:
            return denied

        # External resource -> redirect
        if resource.source_type in ["youtube", "external"]:
            if resource.external_url:
                return HttpResponseRedirect(resource.external_url)
            return Response(
                {"error": "No external URL available."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not resource.file:
            if resource.thumbnail:
                return FileResponse(
                    resource.thumbnail.open("rb"), content_type="image/jpeg"
                )
            return Response(
                {"error": "No file attached to this resource."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Increment view count
        DigitalResource.objects.filter(pk=resource.pk).update(
            views_count=F("views_count") + 1
        )

        filename = resource.file.name
        content_type, _ = mimetypes.guess_type(filename)
        base_name = os.path.basename(filename)

        if filename.endswith(".pdf"):
            content_type = "application/pdf"
        elif filename.endswith((".mp4", ".webm", ".ogg")):
            content_type = "video/mp4"
        elif filename.endswith((".mp3", ".wav", ".ogg")):
            content_type = "audio/mpeg"
        elif filename.endswith((".jpg", ".jpeg")):
            content_type = "image/jpeg"
        elif filename.endswith(".png"):
            content_type = "image/png"
        elif filename.endswith(".txt"):
            content_type = "text/plain; charset=utf-8"

        if not content_type:
            content_type = "application/octet-stream"

        response = FileResponse(resource.file.open("rb"), content_type=content_type)
        response["Content-Disposition"] = f'inline; filename="{base_name}"'

        # Allow embedding / cross-origin rendering of the inline stream
        response["Access-Control-Allow-Origin"] = "*"
        response["X-Frame-Options"] = "SAMEORIGIN"
        response["Content-Security-Policy"] = (
            "frame-ancestors 'self' "
            "http://localhost:5173 http://localhost:3000 http://127.0.0.1:5173 http://127.0.0.1:3000"
        )
        return response


class DigitalResourceDownloadView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        resource = get_object_or_404(DigitalResource, pk=pk)

        denied = _check_resource_access(request, resource)
        if denied is not None:
            return denied

        if resource.source_type == "file" and resource.file:
            filename = os.path.basename(resource.file.name)

            DigitalResource.objects.filter(pk=resource.pk).update(
                downloads_count=F("downloads_count") + 1
            )

            response = FileResponse(
                resource.file.open("rb"),
                as_attachment=True,
                filename=filename or "digital-resource",
            )
            response["Access-Control-Allow-Origin"] = "*"
            return response

        if resource.external_url:
            return Response({
                "url": resource.external_url,
                "message": "This resource is hosted externally.",
            })

        return Response(
            {"error": "No file or external URL is available."},
            status=status.HTTP_404_NOT_FOUND,
        )


class DigitalResourceVerifyView(APIView):
    permission_classes = [IsAuthenticated, IsDigitalOfficer]

    def post(self, request, pk):
        resource = get_object_or_404(DigitalResource, pk=pk)

        action = request.data.get("action")
        quality_status = request.data.get("quality_status") or request.data.get(
            "status"
        )

        if action in ("verify", "approve"):
            quality_status = "verified"
        elif action == "reject":
            quality_status = "rejected"

        if quality_status not in ("pending", "verified", "rejected", "archived"):
            return Response(
                {
                    "error": (
                        "Invalid quality_status. Choose pending, verified, "
                        "rejected, or archived."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        resource.quality_status = quality_status

        if quality_status == "verified":
            resource.verified_by = request.user
            resource.verified_at = timezone.now()
        elif quality_status in ("pending", "rejected", "archived"):
            resource.verified_by = None
            resource.verified_at = None

        notes = request.data.get("quality_notes") or request.data.get("notes")
        if notes is not None:
            resource.quality_notes = notes

        resource.save()

        return Response({
            "message": f"Resource status updated to {quality_status}.",
            "resource": DigitalResourceSerializer(
                resource, context={"request": request}
            ).data,
        })


class DigitalResourcePublishView(APIView):
    permission_classes = [IsAuthenticated, IsDigitalOfficer]

    def post(self, request, pk):
        resource = get_object_or_404(DigitalResource, pk=pk)
        publish = request.data.get("is_published", True)

        if isinstance(publish, str):
            publish = publish.lower() in ("true", "1", "yes")

        if publish:
            resource.quality_status = "verified"
            resource.verified_by = request.user
            resource.verified_at = timezone.now()
            message = "Resource verified and made available."
        else:
            resource.quality_status = "pending"
            resource.verified_by = None
            resource.verified_at = None
            message = "Resource returned to pending review."

        resource.save()

        return Response({
            "message": message,
            "quality_status": resource.quality_status,
        })


class CategoryListCreateView(generics.ListCreateAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsDigitalOfficer()]
        return [AllowAny()]


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return [IsAuthenticated(), IsDigitalOfficer()]
        return [AllowAny()]


class DigitalResourceStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        resources = DigitalResource.objects.all()

        return Response({
            "total_resources": resources.count(),
            "pending_resources": resources.filter(quality_status="pending").count(),
            "verified_resources": resources.filter(quality_status="verified").count(),
            "rejected_resources": resources.filter(quality_status="rejected").count(),
            "archived_resources": resources.filter(quality_status="archived").count(),
            "total_categories": Category.objects.count(),
            "electronic_devices_count": resources.filter(
                Q(resource_type="electronic_device")
                | Q(category__name__icontains="electronic")
            ).count(),
            "total_downloads": sum(
                resources.values_list("downloads_count", flat=True)
            ),
            "total_views": sum(resources.values_list("views_count", flat=True)),
        })