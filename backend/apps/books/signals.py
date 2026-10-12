from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Book
from apps.ai_recommendations.services.content_based import invalidate_cache

@receiver([post_save, post_delete], sender=Book)
def clear_rec_cache(sender, instance, **kwargs):
    invalidate_cache()