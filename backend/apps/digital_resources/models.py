# apps/digital_resources/models.py
from django.db import models
from django.conf import settings
from apps.books.models import Book


class Category(models.Model):
    """Digital resource categories"""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class DigitalResource(models.Model):
    RESOURCE_TYPES = (
        ('ebook', 'E-Book'),
        ('pdf', 'PDF Document'),
        ('journal', 'Journal'),
        ('research_paper', 'Research Paper'),
        ('presentation', 'Presentation'),
        ('video', 'Video'),
        ('audio', 'Audio'),
        ('youtube', 'YouTube Video'),
        ('external_link', 'External Link'),
        ('other', 'Other'),
    )

    SOURCE_TYPES = (
        ('file', 'Uploaded File'),
        ('youtube', 'YouTube Link'),
        ('external', 'External Link'),
    )

    QUALITY_STATUS = (
        ('pending', 'Pending Review'),
        ('verified', 'Verified'),
        ('rejected', 'Rejected'),
        ('archived', 'Archived'),
    )

    ACCESS_LEVEL = (
        ('public', 'Public — Anyone'),
        ('registered', 'Registered Users'),
        ('students', 'Students & Staff Only'),
        ('staff', 'Academic Staff Only'),
        ('restricted', 'Restricted (Librarian Only)'),
    )

    # ===== Basic info =====
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    resource_type = models.CharField(max_length=20, choices=RESOURCE_TYPES)
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPES, default='file')

    # ===== Category + Linking =====
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='resources'
    )
    book = models.ForeignKey(
        Book, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='digital_resources'
    )
    keywords = models.CharField(max_length=500, blank=True, help_text='Comma-separated')

    # ===== File OR URL =====
    file = models.FileField(upload_to='digital_resources/', null=True, blank=True)
    external_url = models.URLField(max_length=500, blank=True, help_text='YouTube or external URL')

    # ===== File metadata =====
    file_size = models.IntegerField(default=0, help_text='File size in bytes')
    thumbnail = models.ImageField(upload_to='resource_thumbnails/', null=True, blank=True)
    duration = models.CharField(max_length=20, blank=True, help_text='For video/audio (e.g., 5:30)')

    # ===== Access + Quality =====
    access_level = models.CharField(max_length=20, choices=ACCESS_LEVEL, default='public')
    quality_status = models.CharField(max_length=20, choices=QUALITY_STATUS, default='pending')
    quality_notes = models.TextField(blank=True)

    # ===== Analytics =====
    downloads_count = models.IntegerField(default=0)
    views_count = models.IntegerField(default=0)

    # ===== Audit =====
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='uploaded_resources'
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='verified_resources'
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['resource_type']),
            models.Index(fields=['quality_status']),
            models.Index(fields=['access_level']),
        ]

    def __str__(self):
        return f"{self.title} ({self.get_resource_type_display()})"

    def increment_downloads(self):
        self.downloads_count += 1
        self.save(update_fields=['downloads_count'])

    def increment_views(self):
        self.views_count += 1
        self.save(update_fields=['views_count'])

    @property
    def display_url(self):
        """What URL to use for access."""
        if self.source_type == 'file' and self.file:
            return self.file.url
        return self.external_url