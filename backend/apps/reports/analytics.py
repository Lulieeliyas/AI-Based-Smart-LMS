from django.db.models import Count, Sum, Avg, Q
from django.utils import timezone
from datetime import timedelta
from apps.books.models import Book
from apps.borrowing.models import Borrow
from apps.users.models import User

class LibraryAnalytics:
    
    @staticmethod
    def get_borrowing_statistics():
        """Get overall borrowing statistics."""
        total_borrowings = Borrow.objects.count()
        active_borrowings = Borrow.objects.filter(status__in=['borrowed', 'overdue']).count()
        returned_borrowings = Borrow.objects.filter(status='returned').count()
        overdue_borrowings = Borrow.objects.filter(status='overdue').count()
        
        return {
            'total_borrowings': total_borrowings,
            'active_borrowings': active_borrowings,
            'returned_borrowings': returned_borrowings,
            'overdue_borrowings': overdue_borrowings,
        }

    @staticmethod
    def get_popular_books(limit=10):
        """Get most popular books."""
        popular_books = Book.objects.annotate(
            borrow_count=Count('borrowings')
        ).order_by('-borrow_count')[:limit]
        
        return [
            {
                'id': book.id,
                'title': book.title,
                'author': book.author,
                'borrow_count': book.borrow_count,
                'available_quantity': book.available_quantity,
            }
            for book in popular_books if book.borrow_count > 0
        ]

    @staticmethod
    def get_user_activity():
        """Get user activity statistics."""
        total_users = User.objects.count()
        active_users = User.objects.filter(
            borrowings__borrow_date__gte=timezone.now() - timedelta(days=30)
        ).distinct().count()
        
        users_by_role = User.objects.values('role').annotate(count=Count('id'))
        
        return {
            'total_users': total_users,
            'active_users': active_users,
            'users_by_role': list(users_by_role),
        }

    @staticmethod
    def get_category_distribution():
        """Get book distribution by category."""
        categories = Book.objects.values('category__name').annotate(
            count=Count('id')
        ).order_by('-count')
        
        total_books = Book.objects.count()
        
        return [
            {
                'category': cat['category__name'] or 'Uncategorized',
                'count': cat['count'],
                'percentage': round((cat['count'] / total_books) * 100, 1) if total_books > 0 else 0
            }
            for cat in categories
        ]

    @staticmethod
    def get_monthly_borrowings(months=6):
        """Get monthly borrowing data for the last N months."""
        monthly_data = []
        today = timezone.now().date()
        
        for i in range(months - 1, -1, -1):
            month_start = today.replace(day=1) - timedelta(days=30*i)
            month_end = (month_start + timedelta(days=32)).replace(day=1)
            
            count = Borrow.objects.filter(
                borrow_date__date__gte=month_start,
                borrow_date__date__lt=month_end
            ).count()
            
            monthly_data.append({
                'month': month_start.strftime('%b'),
                'year': month_start.strftime('%Y'),
                'count': count
            })
        
        return monthly_data

    @staticmethod
    def get_digital_resource_stats():
        """Get digital resource statistics."""
        from apps.digital_resources.models import DigitalResource
        
        return {
            'total_resources': DigitalResource.objects.count(),
            'total_downloads': DigitalResource.objects.aggregate(Sum('downloads_count'))['downloads_count__sum'] or 0,
            'resources_by_type': DigitalResource.objects.values('resource_type').annotate(count=Count('id')),
        }