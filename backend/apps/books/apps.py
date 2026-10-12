from django.apps import AppConfig


class BooksConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.books'
    label = 'books'


class BooksConfig(AppConfig):
    def ready(self):
        from . import signals  # noqa