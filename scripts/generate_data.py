import json
import random
from datetime import datetime, timedelta

from faker import Faker


fake = Faker()


def generate_books(count=100):
    categories = [
        "Fiction",
        "Non-Fiction",
        "Science",
        "Technology",
        "History",
        "Mathematics",
        "Literature",
        "Philosophy",
    ]

    books = []

    for i in range(count):
        book = {
            "book_id": i + 1,
            "title": fake.sentence(nb_words=3).rstrip("."),
            "author": fake.name(),
            "isbn": fake.isbn13(),
            "category": random.choice(categories),
            "status": random.choice(["Available", "Borrowed"]),
            "published_year": random.randint(1950, 2024),
            "description": fake.text(max_nb_chars=200),
        }

        books.append(book)

    return books


def generate_users(count=50):
    roles = [
        "student",
        "academic_staff",
        "librarian",
        "admin",
    ]

    users = []

    for i in range(count):
        user = {
            "user_id": i + 1,
            "username": fake.user_name(),
            "email": fake.email(),
            "role": random.choice(roles),
            "full_name": fake.name(),
            "department": fake.word() + " Department",
        }

        users.append(user)

    return users


def generate_borrowing_history(users, books, count=100):
    history = []

    for i in range(count):
        borrow_date = fake.date_between(
            start_date="-1y",
            end_date="today",
        )

        due_date = borrow_date + timedelta(days=random.randint(7, 30))

        history.append(
            {
                "borrow_id": i + 1,
                "user_id": random.randint(1, len(users)),
                "book_id": random.randint(1, len(books)),
                "borrow_date": borrow_date.isoformat(),
                "due_date": due_date.isoformat(),
                "status": random.choice(
                    [
                        "Borrowed",
                        "Returned",
                        "Overdue",
                    ]
                ),
            }
        )

    return history


if __name__ == "__main__":
    books = generate_books(100)
    users = generate_users(50)
    history = generate_borrowing_history(
        users,
        books,
        200,
    )

    output_directory = "../data/sample_data"

    with open(
        f"{output_directory}/books.json",
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(
            books,
            f,
            indent=2,
            ensure_ascii=False,
        )

    with open(
        f"{output_directory}/users.json",
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(
            users,
            f,
            indent=2,
            ensure_ascii=False,
        )

    with open(
        f"{output_directory}/borrowing_history.json",
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(
            history,
            f,
            indent=2,
            ensure_ascii=False,
        )

    print("Sample data generated successfully!")