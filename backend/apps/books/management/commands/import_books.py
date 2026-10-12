import csv
from django.core.management.base import BaseCommand
from apps.books.models import Book, Category


class Command(BaseCommand):
    help = "Import books from a CSV file"

    def add_arguments(self, parser):
        parser.add_argument("csv_file", type=str)

    def handle(self, *args, **options):
        csv_file = options["csv_file"]

        created = 0
        updated = 0
        skipped = 0

        with open(csv_file, "r", encoding="utf-8-sig") as file:
            reader = csv.DictReader(file)

            for row in reader:
                title = row.get("title", "").strip()
                author = row.get("author", "").strip()
                isbn = row.get("isbn_13", "").strip()

                if not title or not author:
                    skipped += 1
                    continue

                # Use ISBN as the unique identifier when available
                book = None

                if isbn:
                    book = Book.objects.filter(isbn=isbn).first()

                # Create/find category
                category_name = row.get("category", "").strip()

                category = None

                if category_name:
                    category, _ = Category.objects.get_or_create(
                        name=category_name
                    )

                # Convert publication year
                publication_year = None
                publication_date = row.get("publication_date", "").strip()

                if publication_date:
                    try:
                        publication_year = int(publication_date[:4])
                    except ValueError:
                        publication_year = None

                # Convert pages
                pages = None
                pages_value = row.get("number_of_pages", "").strip()

                if pages_value:
                    try:
                        pages = int(pages_value)
                    except ValueError:
                        pages = None

                # Quantity
                quantity = 1
                quantity_value = row.get("quantity", "").strip()

                if quantity_value:
                    try:
                        quantity = int(quantity_value)
                    except ValueError:
                        quantity = 1

                # Available quantity
                available_quantity = quantity
                available_value = row.get("available_quantity", "").strip()

                if available_value:
                    try:
                        available_quantity = int(available_value)
                    except ValueError:
                        available_quantity = quantity

                data = {
                    "title": title,
                    "author": author,
                    "isbn": isbn or None,
                    "category": category,
                    "publisher": row.get("publisher", "").strip(),
                    "publication_year": publication_year,
                    "edition": row.get("edition", "").strip(),
                    "pages": pages,
                    "description": row.get("description", "").strip(),
                    "status": row.get("status", "available").strip() or "available",
                    "quantity": quantity,
                    "available_quantity": available_quantity,
                    "location": row.get("shelf_location", "").strip(),
                }

                if book:
                    for field, value in data.items():
                        setattr(book, field, value)

                    book.save()
                    updated += 1
                else:
                    Book.objects.create(**data)
                    created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Import completed: {created} created, "
                f"{updated} updated, {skipped} skipped."
            )
        )
