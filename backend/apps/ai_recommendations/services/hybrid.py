
from .content_based import get_similar
from .collaborative import user_based, popular_books
from apps.borrowing.models import Borrow


def recommend_for_user(user_id, top_n=10):
    """
    Generate book recommendations using three strategies:
    1. Collaborative filtering
    2. Content-based recommendations from the user's last borrowed book
    3. Popular books as a final fallback

    Args:
        user_id: ID of the user receiving recommendations.
        top_n: Maximum number of books to recommend.

    Returns:
        A list of unique book IDs.
    """
    if top_n <= 0:
        return []

    recommendations = []
    seen = set()

    # Step 1: Collaborative filtering
    collaborative_recommendations = user_based(user_id, top_n)

    for book_id in collaborative_recommendations:
        book_id = int(book_id)

        if book_id not in seen:
            recommendations.append(book_id)
            seen.add(book_id)

        if len(recommendations) >= top_n:
            return recommendations

    # Step 2: Find the user's most recently borrowed book.
    last_borrowed_book_id = (
        Borrow.objects
        .filter(user_id=user_id)
        .order_by("-borrow_date", "-id")
        .values_list("book_id", flat=True)
        .first()
    )

    # Recommend books similar to the last borrowed book.
    if last_borrowed_book_id is not None:
        similar_book_ids = get_similar(
            last_borrowed_book_id,
            top_n * 2,
        ) or []

        for book_id in similar_book_ids:
            book_id = int(book_id)

            if book_id not in seen and book_id != last_borrowed_book_id:
                recommendations.append(book_id)
                seen.add(book_id)

            if len(recommendations) >= top_n:
                return recommendations

    # Step 3: Fill remaining places with popular books.
    popular_book_ids = popular_books(top_n * 2) or []

    for book_id in popular_book_ids:
        book_id = int(book_id)

        if book_id not in seen:
            recommendations.append(book_id)
            seen.add(book_id)

        if len(recommendations) >= top_n:
            break

    return recommendations[:top_n]
