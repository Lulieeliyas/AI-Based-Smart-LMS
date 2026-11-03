import logging
from .model_store import model_store
from .content_based import invalidate_cache as invalidate_content_cache

logger = logging.getLogger(__name__)


def refresh_all_recommendation_caches():
    """
    Clears in-memory caches and prompts reload from saved artifacts.
    """
    model_store.invalidate()
    invalidate_content_cache()
    logger.info("Recommendation caches refreshed.")
