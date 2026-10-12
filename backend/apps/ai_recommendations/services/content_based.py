from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from apps.books.models import Book


_cache = {"matrix": None, "ids": None, "sim": None}


def _build_matrix():
    books = list(Book.objects.values("id", "title", "description", "category__name", "author"))
    if not books:
        return None
    texts = [
        f"{b['title']} {b['author']} {b['description'] or ''} {b['category__name'] or ''}"
        for b in books
    ]
    tfidf = TfidfVectorizer(stop_words="english", max_features=5000)
    matrix = tfidf.fit_transform(texts)
    sim = cosine_similarity(matrix)
    ids = [b["id"] for b in books]
    return {"matrix": matrix, "ids": ids, "sim": sim}


def get_similar(book_id, top_n=8):
    global _cache
    if _cache["sim"] is None:
        _cache = _build_matrix() or {}
    if not _cache:
        return []
    try:
        idx = _cache["ids"].index(book_id)
    except ValueError:
        return []
    scores = list(enumerate(_cache["sim"][idx]))
    scores.sort(key=lambda x: x[1], reverse=True)
    top = [i for i, _ in scores[1:top_n + 1]]
    return [_cache["ids"][i] for i in top]


def invalidate_cache():
    """Call this after adding/updating books."""
    global _cache
    _cache = {"matrix": None, "ids": None, "sim": None}