import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from django.db.models import Count, Avg, F
from django.db import models
from datetime import timedelta
from django.utils import timezone

def prepare_user_features(user):
    """Prepare user features for recommendation."""
    from apps.borrowing.models import Borrow
    from apps.books.models import Book
    from apps.books.models import Category
    
    # Get user's borrowing history
    borrowings = Borrow.objects.filter(user=user, status='returned')
    
    if not borrowings:
        return None
    
    # Calculate user preferences
    categories = Book.objects.filter(
        borrowings__in=borrowings
    ).values('category__name').annotate(
        count=Count('category')
    ).order_by('-count')
    
    # Get user's top categories
    top_categories = [cat['category__name'] for cat in categories[:3] if cat['category__name']]
    
    # Calculate average borrowing patterns
    avg_borrow_duration = None
    for borrow in borrowings:
        if borrow.return_date and borrow.borrow_date:
            duration = (borrow.return_date - borrow.borrow_date.date()).days
            if avg_borrow_duration is None:
                avg_borrow_duration = duration
            else:
                avg_borrow_duration = (avg_borrow_duration + duration) / 2
    
    return {
        'user_id': user.id,
        'top_categories': top_categories,
        'total_borrowings': borrowings.count(),
        'avg_borrow_duration': avg_borrow_duration or 0,
    }

def prepare_book_features(book):
    """Prepare book features for recommendation."""
    from apps.borrowing.models import Borrow
    
    # Get book popularity
    borrow_count = Borrow.objects.filter(book=book, status='returned').count()
    
    return {
        'book_id': book.id,
        'category': book.category.name if book.category else '',
        'author': book.author,
        'borrow_count': borrow_count,
        'available_quantity': book.available_quantity,
    }