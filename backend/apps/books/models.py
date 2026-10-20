from django.db import models
from django.conf import settings


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name


class Book(models.Model):
    class AccessType(models.TextChoices):
        PUBLIC = "public", "Public — available to everyone"
        PRIVATE = "private", "Private — requires admin approval"

    title = models.CharField(max_length=255)
    author = models.CharField(max_length=255)
    isbn = models.CharField(max_length=20, unique=True, blank=True, null=True)
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, related_name="books"
    )
    description = models.TextField(blank=True)
    cover = models.ImageField(upload_to="book_covers/", blank=True, null=True)
    publisher = models.CharField(max_length=255, blank=True)
    published_year = models.PositiveIntegerField(blank=True, null=True)
    total_copies = models.PositiveIntegerField(default=1)
    available_copies = models.PositiveIntegerField(default=1)
    access_type = models.CharField(
        max_length=20,
        choices=AccessType.choices,
        default=AccessType.PUBLIC,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["title"]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if self._state.adding and self.available_copies == 1 and self.total_copies != 1:
            self.available_copies = self.total_copies
        super().save(*args, **kwargs)

    @property
    def is_available(self):
        return self.available_copies > 0

    @property
    def is_public(self):
        return self.access_type == self.AccessType.PUBLIC

    @property
    def is_private(self):
        return self.access_type == self.AccessType.PRIVATE


class Rating(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ratings",
    )
    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        related_name="ratings",
    )
    score = models.PositiveSmallIntegerField()
    review = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "book")

    def __str__(self):
        return f"{self.user} -> {self.book} ({self.score})"
