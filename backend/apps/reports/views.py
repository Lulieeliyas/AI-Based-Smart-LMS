from rest_framework import generics, status, permissions, viewsets
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated  # ✅ Add this import
from django.db.models import Count, Sum, Avg, Q
from django.utils import timezone
from datetime import timedelta
from .models import Report, ReportSchedule
from .serializers import ReportSerializer, ReportScheduleSerializer, ReportStatisticsSerializer
from .services import ReportService
from apps.users.permissions import IsAdminUser, IsLibrarianUser  # ✅ Use custom permissions
import logging

logger = logging.getLogger(__name__)


class ReportListView(generics.ListCreateAPIView):
    """List and create reports"""
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated, IsLibrarianUser]  # ✅ Now works
    
    def get_queryset(self):
        queryset = Report.objects.filter(generated_by=self.request.user)
        
        # Filter by report type
        report_type = self.request.query_params.get('type')
        if report_type:
            queryset = queryset.filter(report_type=report_type)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        if start_date:
            queryset = queryset.filter(generated_at__date__gte=start_date)
        
        end_date = self.request.query_params.get('end_date')
        if end_date:
            queryset = queryset.filter(generated_at__date__lte=end_date)
        
        return queryset.order_by('-generated_at')
    
    def create(self, request, *args, **kwargs):
        report_type = request.data.get('report_type')
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        parameters = request.data.get('parameters', {})
        format_type = request.data.get('format', 'pdf')
        
        if not report_type:
            return Response({
                'error': 'report_type is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate report data
        report_data = ReportService.generate_report(
            report_type, start_date, end_date, parameters
        )
        
        if not report_data:
            return Response({
                'error': 'Failed to generate report'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create report record
        report = Report.objects.create(
            title=request.data.get('title', f"{report_type.replace('_', ' ').title()} Report"),
            report_type=report_type,
            description=request.data.get('description', ''),
            parameters=parameters,
            generated_by=request.user,
            start_date=start_date,
            end_date=end_date,
            data=report_data,
            file_format=format_type
        )
        
        # Export to requested format
        if format_type == 'pdf':
            response = ReportService.export_to_pdf(report_data, report.title)
        elif format_type == 'excel':
            response = ReportService.export_to_excel(report_data, report.title)
        elif format_type == 'csv':
            response = ReportService.export_to_csv(report_data, report.title)
        else:
            return Response({
                'id': report.id,
                'data': report_data,
                'message': 'Report generated successfully'
            })
        
        if response:
            return response
        
        return Response({
            'id': report.id,
            'data': report_data,
            'message': 'Report generated successfully'
        })


class ReportDetailView(generics.RetrieveDestroyAPIView):
    """View and delete a specific report"""
    queryset = Report.objects.all()
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated, IsLibrarianUser]
    lookup_field = 'id'


class ReportStatisticsView(generics.GenericAPIView):
    """Get dashboard statistics for reports"""
    permission_classes = [IsAuthenticated, IsLibrarianUser]
    
    def get(self, request):
        from apps.books.models import Book, Category, BookReview
        from apps.borrowing.models import Borrow
        from apps.users.models import User
        
        # Basic statistics
        total_borrowings = Borrow.objects.count()
        active_borrowings = Borrow.objects.filter(status__in=['borrowed', 'renewed']).count()
        overdue_borrowings = Borrow.objects.filter(status='overdue').count()
        
        # Books by category
        books_by_category = {}
        categories = Category.objects.annotate(count=Count('books'))
        for cat in categories:
            books_by_category[cat.name] = cat.count
        
        # Borrowings by month (last 12 months)
        borrowings_by_month = {}
        now = timezone.now()
        for i in range(12):
            month = now - timedelta(days=30*i)
            month_key = month.strftime('%b %Y')
            count = Borrow.objects.filter(
                borrow_date__year=month.year,
                borrow_date__month=month.month
            ).count()
            borrowings_by_month[month_key] = count
        
        # Popular books
        popular_books = Book.objects.annotate(
            borrow_count=Count('borrowings')
        ).filter(borrow_count__gt=0).order_by('-borrow_count')[:10]
        
        popular_books_data = [
            {
                'title': b.title,
                'author': b.author,
                'borrow_count': b.borrow_count
            }
            for b in popular_books
        ]
        
        # Users by role
        users_by_role = {}
        for role, _ in User.ROLE_CHOICES:
            count = User.objects.filter(role=role).count()
            if count > 0:
                users_by_role[role] = count
        
        # Fine collected
        fine_collected = Borrow.objects.filter(
            fine_paid=True
        ).aggregate(total=Sum('fine_amount'))['total'] or 0
        
        data = {
            'total_borrowings': total_borrowings,
            'active_borrowings': active_borrowings,
            'overdue_borrowings': overdue_borrowings,
            'books_by_category': books_by_category,
            'borrowings_by_month': borrowings_by_month,
            'popular_books': popular_books_data,
            'users_by_role': users_by_role,
            'fine_collected': float(fine_collected),
        }
        
        return Response(data)


class ReportScheduleViewSet(viewsets.ModelViewSet):
    """ViewSet for managing report schedules"""
    queryset = ReportSchedule.objects.all()
    serializer_class = ReportScheduleSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        return ReportSchedule.objects.filter(created_by=self.request.user)
    
    def perform_create(self, serializer):
        # Calculate next run
        frequency = self.request.data.get('frequency')
        next_run = timezone.now()
        if frequency == 'daily':
            next_run += timedelta(days=1)
        elif frequency == 'weekly':
            next_run += timedelta(days=7)
        elif frequency == 'monthly':
            next_run += timedelta(days=30)
        elif frequency == 'quarterly':
            next_run += timedelta(days=90)
        
        serializer.save(created_by=self.request.user, next_run=next_run)
    
    @action(detail=True, methods=['post'])
    def generate_now(self, request, pk=None):
        """Generate a report immediately from a schedule"""
        schedule = self.get_object()
        
        # Generate report
        report_data = ReportService.generate_report(
            schedule.report_type,
            parameters=schedule.parameters
        )
        
        if not report_data:
            return Response({
                'error': 'Failed to generate report'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create report
        report = Report.objects.create(
            title=f"{schedule.title} - {timezone.now().strftime('%Y-%m-%d')}",
            report_type=schedule.report_type,
            description=schedule.description,
            parameters=schedule.parameters,
            generated_by=request.user,
            data=report_data,
            file_format=schedule.format,
            is_scheduled=True,
            schedule_frequency=schedule.frequency,
            next_schedule=schedule.next_run
        )
        
        # Update schedule
        schedule.last_run = timezone.now()
        if schedule.frequency == 'daily':
            schedule.next_run = timezone.now() + timedelta(days=1)
        elif schedule.frequency == 'weekly':
            schedule.next_run = timezone.now() + timedelta(days=7)
        elif schedule.frequency == 'monthly':
            schedule.next_run = timezone.now() + timedelta(days=30)
        schedule.save()
        
        return Response(ReportSerializer(report).data)