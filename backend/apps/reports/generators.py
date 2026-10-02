from django.utils import timezone
from django.db.models import Count, Sum, Q
from datetime import datetime, timedelta
from .models import Report
from .analytics import LibraryAnalytics
from apps.books.models import Book
from apps.borrowing.models import Borrow
from apps.users.models import User
from apps.digital_resources.models import DigitalResource

class ReportGenerator:
    
    @staticmethod
    def generate_book_circulation_report(user):
        """Generate book circulation report with real data."""
        # Get real statistics
        total_books = Book.objects.count()
        available_books = Book.objects.filter(available_quantity__gt=0).count()
        borrowed_books = Borrow.objects.filter(status__in=['borrowed', 'overdue']).count()
        overdue_books = Borrow.objects.filter(status='overdue').count()
        total_borrowings = Borrow.objects.count()
        
        # Get monthly borrowings for the last 6 months
        monthly_data = []
        today = timezone.now().date()
        for i in range(5, -1, -1):
            month_start = (today.replace(day=1) - timedelta(days=30*i))
            month_end = (month_start + timedelta(days=32)).replace(day=1)
            count = Borrow.objects.filter(
                borrow_date__date__gte=month_start,
                borrow_date__date__lt=month_end
            ).count()
            monthly_data.append({
                'month': month_start.strftime('%b'),
                'count': count
            })
        
        # Get popular books
        popular_books = Book.objects.annotate(
            borrow_count=Count('borrowings')
        ).order_by('-borrow_count')[:10]
        
        popular_books_data = [
            {
                'title': book.title,
                'author': book.author,
                'borrow_count': book.borrow_count,
                'category': book.category.name if book.category else 'Uncategorized',
            }
            for book in popular_books if book.borrow_count > 0
        ]
        
        data = {
            'report_type': 'book_circulation',
            'generated_at': timezone.now().isoformat(),
            'total_books': total_books,
            'available_books': available_books,
            'borrowed_books': borrowed_books,
            'overdue_books': overdue_books,
            'total_borrowings': total_borrowings,
            'monthly_data': monthly_data,
            'popular_books': popular_books_data,
        }
        
        report = Report.objects.create(
            title='Book Circulation Report',
            report_type='book_circulation',
            generated_by=user,
            data=data
        )
        return report

    @staticmethod
    def generate_user_activity_report(user):
        """Generate user activity report with real data."""
        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()
        
        # Get users by role
        users_by_role = User.objects.values('role').annotate(count=Count('id'))
        
        data = {
            'report_type': 'user_activity',
            'generated_at': timezone.now().isoformat(),
            'total_users': total_users,
            'active_users': active_users,
            'inactive_users': total_users - active_users,
            'users_by_role': list(users_by_role),
        }
        
        report = Report.objects.create(
            title='User Activity Report',
            report_type='user_activity',
            generated_by=user,
            data=data
        )
        return report

    @staticmethod
    def generate_overdue_report(user):
        """Generate overdue books report with real data."""
        overdue_borrowings = Borrow.objects.filter(
            status='overdue'
        ).select_related('user', 'book')
        
        overdue_data = [
            {
                'book_title': b.book.title,
                'book_author': b.book.author,
                'user_name': b.user.username,
                'borrow_date': b.borrow_date.date().isoformat(),
                'due_date': b.due_date.isoformat(),
                'days_overdue': (timezone.now().date() - b.due_date).days,
                'fine_amount': float(b.fine_amount) if b.fine_amount else 0,
            }
            for b in overdue_borrowings
        ]
        
        data = {
            'report_type': 'overdue_books',
            'generated_at': timezone.now().isoformat(),
            'total_overdue': overdue_borrowings.count(),
            'overdue_items': overdue_data,
        }
        
        report = Report.objects.create(
            title='Overdue Books Report',
            report_type='overdue_books',
            generated_by=user,
            data=data
        )
        return report

    @staticmethod
    def generate_popular_books_report(user):
        """Generate popular books report."""
        popular_books = Book.objects.annotate(
            borrow_count=Count('borrowings')
        ).order_by('-borrow_count')[:20]
        
        books_data = [
            {
                'title': book.title,
                'author': book.author,
                'category': book.category.name if book.category else 'Uncategorized',
                'borrow_count': book.borrow_count,
                'available_quantity': book.available_quantity,
                'total_quantity': book.quantity,
            }
            for book in popular_books if book.borrow_count > 0
        ]
        
        data = {
            'report_type': 'popular_books',
            'generated_at': timezone.now().isoformat(),
            'total_popular_books': len(books_data),
            'books': books_data,
        }
        
        report = Report.objects.create(
            title='Popular Books Report',
            report_type='popular_books',
            generated_by=user,
            data=data
        )
        return report

    @staticmethod
    def generate_inventory_report(user):
        """Generate inventory report."""
        total_books = Book.objects.count()
        available_books = Book.objects.filter(available_quantity__gt=0).count()
        borrowed_books = Borrow.objects.filter(status__in=['borrowed', 'overdue']).count()
        
        # Books by category
        category_data = Book.objects.values(
            'category__name'
        ).annotate(
            count=Count('id')
        ).order_by('-count')
        
        # Recently added books
        recent_books = Book.objects.order_by('-created_at')[:10]
        recent_books_data = [
            {
                'title': book.title,
                'author': book.author,
                'category': book.category.name if book.category else 'Uncategorized',
                'created_at': book.created_at.isoformat(),
            }
            for book in recent_books
        ]
        
        data = {
            'report_type': 'inventory',
            'generated_at': timezone.now().isoformat(),
            'total_books': total_books,
            'available_books': available_books,
            'borrowed_books': borrowed_books,
            'unavailable_books': total_books - available_books - borrowed_books,
            'categories': list(category_data),
            'recent_books': recent_books_data,
        }
        
        report = Report.objects.create(
            title='Inventory Report',
            report_type='inventory',
            generated_by=user,
            data=data
        )
        return report