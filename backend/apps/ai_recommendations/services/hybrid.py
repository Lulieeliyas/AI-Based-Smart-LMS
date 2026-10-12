from .content_based import get_similar
from .collaborative import user_based, popular_books
from apps.borrowing.models import BorrowRecord


def recommend_for_user(user_id, top_n=10):
    """Priority: collaborative → content (based on last borrow) → popular."""
    cf = user_based(user_id, top_n)
    if len(cf) >= top_n:
        return cf[:top_n]

    seen = set(cf)
    # Fallback: similar to last borrowed book
    last = (BorrowRecord.objects
            .filter(user_id=user_id)
            .order_by("-issue_date")
            .values_list("book_id", flat=True)
            .first())
    if last:
        for bid in get_similar(last, top_n * 2):
            if bid not in seen:
                seen.add(bid)
                cf.append(bid)
            if len(cf) >= top_n:
                return cf

    # Final fallback: popular
    for bid in popular_books(top_n * 2):
        if bid not in seen:
            cf.append(bid)
        if len(cf) >= top_n:
            break
    return cf[:top_n]