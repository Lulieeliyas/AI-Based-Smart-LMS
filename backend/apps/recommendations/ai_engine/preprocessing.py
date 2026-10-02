import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from django.db.models import Count, Avg

def prepare_user_features(user):
    """Prepare user features for recommendation."""
    from apps.borrowing.models import Borrow
    from apps.books.models import Book
    
    # Get user's borrowing history
    borrowings = Borrow.objects.filter(user=user, status='returned')
    
    if not borrowings:
        return None
    
    # Calculate user preferences
    categories = Book.objects.filter(
        borrowings__in=borrowings
    ).values('category').annotate(
        count=Count('category')
    ).order_by('-count')
    
    # Get user's top categories
    top_categories = [cat['category'] for cat in categories[:3]]
    
    # Calculate average borrowing patterns
    avg_borrow_duration = borrowings.aggregate(
        avg_duration=Avg('return_date', field='borrow_date')
    )
    
    return {
        'user_id': user.id,
        'top_categories': top_categories,
        'total_borrowings': borrowings.count(),
        'avg_borrow_duration': avg_borrow_duration['avg_duration'] or 0,
    }

def prepare_book_features(book):
    """Prepare book features for recommendation."""
    from apps.borrowing.models import Borrow
    
    # Get book popularity
    borrow_count = Borrow.objects.filter(book=book).count()
    
    return {
        'book_id': book.id,
        'category': book.category,
        'author': book.author,
        'borrow_count': borrow_count,
        'available_copies': book.available_copies,
    }