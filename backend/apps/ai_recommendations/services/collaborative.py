import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from apps.borrowing.models import BorrowRecord
from apps.books.models import Rating   # assume you add Rating model


def user_based(user_id, top_n=8):
    qs = list(Rating.objects.values("user_id", "book_id", "score"))
    if len(qs) < 10:
        return []
    df = pd.DataFrame(qs)
    pivot = df.pivot_table(index="user_id", columns="book_id", values="score", fill_value=0)
    if user_id not in pivot.index:
        return []
    sim = cosine_similarity(pivot)
    sim_df = pd.DataFrame(sim, index=pivot.index, columns=pivot.index)
    similar = sim_df[user_id].sort_values(ascending=False).iloc[1:11].index
    scores = pivot.loc[similar].mean(axis=0).sort_values(ascending=False)
    already = set(df[df["user_id"] == user_id]["book_id"])
    return [int(b) for b in scores.index if b not in already][:top_n]


def popular_books(top_n=8):
    """Fallback for cold-start users."""
    from django.db.models import Count
    rows = (BorrowRecord.objects
            .values("book_id")
            .annotate(c=Count("id"))
            .order_by("-c")[:top_n])
    return [r["book_id"] for r in rows]