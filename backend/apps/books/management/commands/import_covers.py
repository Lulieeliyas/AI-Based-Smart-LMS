import csv
import re

import requests
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from apps.books.models import Book


class Command(BaseCommand):
    help = "Download and attach book cover images from CSV URLs"

    def add_arguments(self, parser):
        parser.add_argument("csv_file", type=str)

    def clean_filename(self, title, isbn):
        name = f"{title}_{isbn}"
        name = re.sub(r"[^a-zA-Z0-9_-]", "_", name)
        return name[:150]

    def download_image(self, url):
        try:
            response = requests.get(
                url,
                timeout=30,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 "
                        "(X11; Linux x86_64) "
                        "AppleWebKit/537.36 "
                        "Chrome/147.0 Safari/537.36"
                    ),
                    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                },
                allow_redirects=True,
            )

            if response.status_code != 200:
                return None, f"HTTP {response.status_code}"

            data = response.content

            # Check common image file signatures.
            if (
                data.startswith(b"\xff\xd8\xff")       # JPEG
                or data.startswith(b"\x89PNG")          # PNG
                or data.startswith(b"GIF8")             # GIF
                or data.startswith(b"RIFF")             # WEBP
            ):
                return data, None

            return None, "Downloaded file is not a recognized image"

        except requests.RequestException as e:
            return None, str(e)

    def handle(self, *args, **options):
        csv_file = options["csv_file"]

        added = 0
        skipped = 0
        failed = 0

        with open(csv_file, "r", encoding="utf-8-sig") as file:
            reader = csv.DictReader(file)

            for row in reader:
                title = row.get("title", "").strip()
                isbn = row.get("isbn_13", "").strip()
                cover_url = row.get("cover_url", "").strip()

                if not isbn or not cover_url:
                    self.stdout.write(
                        self.style.WARNING(
                            f"Skipping: {title} - missing ISBN or cover URL"
                        )
                    )
                    skipped += 1
                    continue

                try:
                    book = Book.objects.get(isbn=isbn)
                except Book.DoesNotExist:
                    self.stdout.write(
                        self.style.WARNING(
                            f"Book not found: {title} ({isbn})"
                        )
                    )
                    skipped += 1
                    continue

                if book.cover_image:
                    self.stdout.write(
                        f"Already has cover: {title}"
                    )
                    skipped += 1
                    continue

                self.stdout.write(
                    f"Downloading: {title}"
                )

                image_data, error = self.download_image(cover_url)

                if not image_data:
                    self.stdout.write(
                        self.style.ERROR(
                            f"Failed: {title} - {error}"
                        )
                    )
                    failed += 1
                    continue

                filename = (
                    self.clean_filename(title, isbn)
                    + ".jpg"
                )

                book.cover_image.save(
                    filename,
                    ContentFile(image_data),
                    save=True,
                )

                self.stdout.write(
                    self.style.SUCCESS(
                        f"Cover added: {title}"
                    )
                )

                added += 1

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Finished: {added} covers added, "
                f"{skipped} skipped, "
                f"{failed} failed."
            )
        )
