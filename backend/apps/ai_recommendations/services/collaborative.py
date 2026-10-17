
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from django.db.models import Count

from apps.borrowing.models import Borrow
from apps.books.models import BookReview


def user_based(user_id, top_n=8):
    """
    Recommend books using ratings from users with similar interests.

    Returns a list of recommended book IDs.
    """
    reviews = list(
        BookReview.objects.values(
            "user_id",
            "book_id",
            "rating",
        )
    )

    # Require enough reviews for meaningful recommendations.
    if len(reviews) < 10:
        return []

    df = pd.DataFrame(reviews)

    # Create a user-book rating matrix.
    pivot = df.pivot_table(
        index="user_id",
        columns="book_id",
        values="rating",
        aggfunc="mean",
        fill_value=0,
    )

    # The current user must have rated at least one book.
    if user_id not in pivot.index:
        return []

    if len(pivot.index) < 2:
        return []

    # Calculate similarity between users.
    similarity = cosine_similarity(pivot)

    similarity_df = pd.DataFrame(
        similarity,
        index=pivot.index,
        columns=pivot.index,
    )

    # Select the most similar users, excluding the current user.
    similar_users = (
        similarity_df[user_id]
        .drop(index=user_id)
        .sort_values(ascending=False)
        .head(10)
        .index
    )

    if len(similar_users) == 0:
        return []

    # Rank books using ratings from similar users.
    scores = (
        pivot.loc[similar_users]
        .mean(axis=0)
        .sort_values(ascending=False)
    )

    # Exclude books already reviewed by the current user.
    already_reviewed = set(
        df.loc[df["user_id"] == user_id, "book_id"]
    )

    recommendations = [
        int(book_id)
        for book_id in scores.index
        if book_id not in already_reviewed
    ]

    return recommendations[:top_n]


def popular_books(top_n=8):
    """
    Return the most frequently borrowed books.
    Useful as a fallback for users without enough ratings.
    """
    borrow_counts = (
        Borrow.objects
        .values("book_id")
        .annotate(total_borrows=Count("id"))
        .order_by("-total_borrows", "book_id")
    )

    return list(
        borrow_counts.values_list("book_id", flat=True)[:top_n]
    )
