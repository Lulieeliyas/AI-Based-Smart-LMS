from rest_framework import generics, status, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.http import FileResponse,Http404
from django.utils import timezone
from django.db.models import Count, Sum, Q
from django_filters.rest_framework import DjangoFilterBackend
import mimetypes
import os


from .models import DigitalResource, Category
from .serializers import DigitalResourceSerializer, DigitalCategorySerializer
from apps.users.permissions import IsLibrarianUser, IsDigitalOfficer


class DigitalResourceListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/digital/digital-resources/ — list (public read, filtered by access_level)
    POST /api/digital/digital-resources/ — upload (librarian/admin/digital_officer)
    """
    serializer_class = DigitalResourceSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['resource_type', 'category', 'quality_status', 'access_level', 'source_type']
    search_fields = ['title', 'description', 'keywords']
    ordering_fields = ['created_at', 'title', 'downloads_count', 'views_count']

    def get_queryset(self):
        user = self.request.user
        qs = DigitalResource.objects.all()

        # Non-admin/library staff see only what they're allowed to see
        if not user.is_authenticated:
            return qs.filter(access_level='public')

        if user.role in ['admin', 'librarian', 'digital_officer']:
            return qs

        if user.role == 'student':
            return qs.filter(access_level__in=['public', 'registered', 'students'])

        if user.role == 'academic_staff':
            return qs.filter(access_level__in=['public', 'registered', 'students', 'staff'])

        return qs.filter(access_level='public')

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), IsDigitalOfficer()]
        return [AllowAny()]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class DigitalResourceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/digital/digital-resources/{id}/
    PUT    /api/digital/digital-resources/{id}/
    PATCH  /api/digital/digital-resources/{id}/
    DELETE /api/digital/digital-resources/{id}/
    """
    queryset = DigitalResource.objects.all()
    serializer_class = DigitalResourceSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsAuthenticated(), IsDigitalOfficer()]
        return [AllowAny()]

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.increment_views()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class DigitalResourceDownloadView(generics.GenericAPIView):
    """GET /api/digital/digital-resources/{id}/download/"""
    queryset = DigitalResource.objects.all()
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        resource = self.get_object()

        # External resources → redirect
        if resource.source_type in ['youtube', 'external']:
            return Response({
                'external_url': resource.external_url,
                'message': 'Redirect to external URL',
            })

        # File download
        if not resource.file:
            return Response(
                {'error': 'No file attached to this resource'},
                status=status.HTTP_404_NOT_FOUND,
            )

        resource.increment_downloads()
        return FileResponse(
            resource.file.open('rb'),
            as_attachment=True,
            filename=resource.file.name.split('/')[-1],
        )


class VerifyResourceView(generics.GenericAPIView):
    """POST /api/digital/digital-resources/{id}/verify/ — mark as verified"""
    permission_classes = [IsAuthenticated, IsDigitalOfficer]

    def post(self, request, pk):
        try:
            resource = DigitalResource.objects.get(pk=pk)
        except DigitalResource.DoesNotExist:
            return Response({'error': 'Resource not found'}, status=404)

        action = request.data.get('action', 'verify')
        notes = request.data.get('notes', '')

        if action == 'verify':
            resource.quality_status = 'verified'
        elif action == 'reject':
            resource.quality_status = 'rejected'
        elif action == 'archive':
            resource.quality_status = 'archived'
        else:
            return Response({'error': 'Invalid action'}, status=400)

        resource.quality_notes = notes
        resource.verified_by = request.user
        resource.verified_at = timezone.now()
        resource.save()

        return Response(DigitalResourceSerializer(resource).data)


class DigitalCategoryListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/digital/categories/ — list
    POST /api/digital/categories/ — create (digital officer/admin)
    """
    queryset = Category.objects.all().order_by('name')
    serializer_class = DigitalCategorySerializer
    pagination_class = None

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), IsDigitalOfficer()]
        return [AllowAny()]


class DigitalStatsView(generics.GenericAPIView):
    """GET /api/digital/stats/ — analytics for digital officer"""
    permission_classes = [IsAuthenticated, IsDigitalOfficer]

    def get(self, request):
        total = DigitalResource.objects.count()
        by_type = list(
            DigitalResource.objects.values('resource_type')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        by_quality = list(
            DigitalResource.objects.values('quality_status')
            .annotate(count=Count('id'))
        )
        total_downloads = (
            DigitalResource.objects.aggregate(total=Sum('downloads_count'))['total'] or 0
        )
        total_views = (
            DigitalResource.objects.aggregate(total=Sum('views_count'))['total'] or 0
        )
        pending_review = DigitalResource.objects.filter(quality_status='pending').count()

        return Response({
            'total_resources': total,
            'total_downloads': total_downloads,
            'total_views': total_views,
            'pending_review': pending_review,
            'by_type': by_type,
            'by_quality': by_quality,
        })
        
        
        
        

class DigitalResourceServeView(generics.GenericAPIView):
    """
    GET /api/digital/digital-resources/{id}/view/
    Serves the file INLINE (not as attachment) so browser can display/play it.
    Requires authentication for non-public resources.
    """
    queryset = DigitalResource.objects.all()

    def get_permissions(self):
        return [AllowAny()]

    def get(self, request, *args, **kwargs):
        try:
            resource = self.get_object()
        except Http404:
            return Response({'error': 'Resource not found'}, status=404)

        # Access control
        user = request.user
        access = resource.access_level

        if access == 'public':
            pass  # OK for everyone
        elif access == 'registered':
            if not user or not user.is_authenticated:
                return Response({'error': 'Login required'}, status=401)
        elif access == 'students':
            if not user or not user.is_authenticated or user.role not in [
                'student', 'academic_staff', 'librarian', 'admin', 'digital_officer'
            ]:
                return Response({'error': 'Access denied'}, status=403)
        elif access == 'staff':
            if not user or not user.is_authenticated or user.role not in [
                'academic_staff', 'librarian', 'admin', 'digital_officer'
            ]:
                return Response({'error': 'Access denied'}, status=403)
        elif access == 'restricted':
            if not user or not user.is_authenticated or user.role not in [
                'librarian', 'admin', 'digital_officer'
            ]:
                return Response({'error': 'Access denied'}, status=403)

        # External resources → return URL, not file
        if resource.source_type in ['youtube', 'external']:
            return Response({
                'external_url': resource.external_url,
                'source_type': resource.source_type,
            })

        if not resource.file:
            return Response({'error': 'No file attached'}, status=404)

        # Increment view counter
        resource.increment_views()

        # Detect content type
        filename = resource.file.name
        content_type, _ = mimetypes.guess_type(filename)

        # Force inline-displayable types
        if filename.endswith('.pdf'):
            content_type = 'application/pdf'
        elif filename.endswith(('.mp4', '.webm', '.ogg')):
            content_type = 'video/mp4'
        elif filename.endswith(('.mp3', '.wav', '.ogg')):
            content_type = 'audio/mpeg'
        elif filename.endswith(('.jpg', '.jpeg')):
            content_type = 'image/jpeg'
        elif filename.endswith('.png'):
            content_type = 'image/png'
        elif filename.endswith('.epub'):
            content_type = 'application/epub+zip'
        elif filename.endswith('.txt'):
            content_type = 'text/plain; charset=utf-8'

        if not content_type:
            content_type = 'application/octet-stream'

        response = FileResponse(
            resource.file.open('rb'),
            content_type=content_type,
        )
        # ✅ Inline (opens in browser) — DO NOT set as_attachment
        response['Content-Disposition'] = f'inline; filename="{os.path.basename(filename)}"'
        return response