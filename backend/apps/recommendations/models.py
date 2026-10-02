from django.db import models
from django.conf import settings
from apps.books.models import Book

class Recommendation(models.Model):
    ALGORITHM_CHOICES = (
        ('content_based', 'Content-Based Filtering'),
        ('collaborative', 'Collaborative Filtering'),
        ('hybrid', 'Hybrid'),
        ('popularity', 'Popularity'),
        ('category', 'Category-Based'),
    )
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='recommendations'
    )
    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        related_name='recommendations'
    )
    score = models.FloatField(default=0.0)
    algorithm_used = models.CharField(
        max_length=50,
        choices=ALGORITHM_CHOICES,
        default='hybrid'
    )
    reason = models.CharField(max_length=255, blank=True)
    is_viewed = models.BooleanField(default=False)
    is_clicked = models.BooleanField(default=False)
    generated_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'book')
        ordering = ['-score']
        indexes = [
            models.Index(fields=['user', '-score']),
            models.Index(fields=['algorithm_used']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.book.title} (Score: {self.score:.2f})"


class RecommendationActivity(models.Model):
    ACTIVITY_TYPES = (
        ('view', 'View'),
        ('click', 'Click'),
        ('borrow', 'Borrow'),
        ('return', 'Return'),
        ('search', 'Search'),
        ('recommendation_click', 'Recommendation Click'),
        ('bookmark', 'Bookmark'),
        ('rating', 'Rating'),
        ('review', 'Review'),
    )
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='recommendation_activities'
    )
    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        related_name='recommendation_activities'
    )
    activity_type = models.CharField(max_length=30, choices=ACTIVITY_TYPES)
    data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'recommendation_activities'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'activity_type']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.book.title} - {self.activity_type}"