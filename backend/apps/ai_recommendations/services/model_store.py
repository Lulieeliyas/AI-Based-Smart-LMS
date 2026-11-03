import os
import json
import logging
import threading
from pathlib import Path
from django.conf import settings
import joblib

logger = logging.getLogger(__name__)

# Default artifact directory
DEFAULT_MODEL_DIR = Path(getattr(settings, "AI_MODEL_PATH", settings.BASE_DIR / "models" / "recommendations"))
if isinstance(DEFAULT_MODEL_DIR, str):
    DEFAULT_MODEL_DIR = Path(DEFAULT_MODEL_DIR)

# Artifact filenames
CONTENT_MODEL_FILENAME = "content_model.joblib"
COLLAB_MODEL_FILENAME = "collaborative_model.joblib"
METADATA_FILENAME = "metadata.json"


class ModelStore:
    """
    Thread-safe repository for persisting, versioning, and loading
    content-based and collaborative recommendation model artifacts.
    Supports distinct instances per model_dir (e.g. for isolated test directories).
    """

    _instances = {}
    _lock = threading.Lock()

    def __new__(cls, model_dir=None, *args, **kwargs):
        dir_key = str(Path(model_dir).resolve()) if model_dir else "default"
        if dir_key not in cls._instances:
            with cls._lock:
                if dir_key not in cls._instances:
                    instance = super().__new__(cls)
                    instance._initialized = False
                    cls._instances[dir_key] = instance
        return cls._instances[dir_key]

    def __init__(self, model_dir=None):
        if getattr(self, "_initialized", False):
            return

        self.model_dir = Path(model_dir) if model_dir else DEFAULT_MODEL_DIR
        self.model_dir.mkdir(parents=True, exist_ok=True)

        self._content_artifact = None
        self._collab_artifact = None
        self._metadata = None
        self._cache_mtime = None
        self._access_lock = threading.RLock()
        self._initialized = True

    @property
    def content_path(self):
        return self.model_dir / CONTENT_MODEL_FILENAME

    @property
    def collab_path(self):
        return self.model_dir / COLLAB_MODEL_FILENAME

    @property
    def metadata_path(self):
        return self.model_dir / METADATA_FILENAME

    def save_artifacts(self, content_artifact=None, collab_artifact=None, metadata=None):
        """
        Atomically save trained model artifacts to disk and update in-memory cache.
        """
        with self._access_lock:
            self.model_dir.mkdir(parents=True, exist_ok=True)

            if content_artifact is not None:
                joblib.dump(content_artifact, self.content_path)
                self._content_artifact = content_artifact

            if collab_artifact is not None:
                joblib.dump(collab_artifact, self.collab_path)
                self._collab_artifact = collab_artifact

            if metadata is not None:
                with open(self.metadata_path, "w", encoding="utf-8") as f:
                    json.dump(metadata, f, indent=2, default=str)
                self._metadata = metadata

            self._cache_mtime = self._get_latest_mtime()
            logger.info("Recommendation model artifacts saved successfully to %s", self.model_dir)

    def load_artifacts(self, force_reload=False):
        """
        Load model artifacts into memory with timestamp-based caching.
        Returns a dict with 'content', 'collaborative', and 'metadata'.
        """
        with self._access_lock:
            latest_mtime = self._get_latest_mtime()

            if (
                not force_reload
                and self._content_artifact is not None
                and self._cache_mtime is not None
                and latest_mtime <= self._cache_mtime
            ):
                return {
                    "content": self._content_artifact,
                    "collaborative": self._collab_artifact,
                    "metadata": self._metadata,
                }

            # Load content model if present
            if self.content_path.exists():
                try:
                    self._content_artifact = joblib.load(self.content_path)
                except Exception as e:
                    logger.warning("Failed to load content model artifact: %s", e)
                    self._content_artifact = None
            else:
                self._content_artifact = None

            # Load collaborative model if present
            if self.collab_path.exists():
                try:
                    self._collab_artifact = joblib.load(self.collab_path)
                except Exception as e:
                    logger.warning("Failed to load collaborative model artifact: %s", e)
                    self._collab_artifact = None
            else:
                self._collab_artifact = None

            # Load metadata
            if self.metadata_path.exists():
                try:
                    with open(self.metadata_path, "r", encoding="utf-8") as f:
                        self._metadata = json.load(f)
                except Exception as e:
                    logger.warning("Failed to load metadata artifact: %s", e)
                    self._metadata = None
            else:
                self._metadata = None

            self._cache_mtime = latest_mtime
            return {
                "content": self._content_artifact,
                "collaborative": self._collab_artifact,
                "metadata": self._metadata,
            }

    def _get_latest_mtime(self):
        mtimes = []
        for path in [self.content_path, self.collab_path, self.metadata_path]:
            if path.exists():
                try:
                    mtimes.append(path.stat().st_mtime)
                except OSError:
                    pass
        return max(mtimes) if mtimes else 0.0

    def has_artifacts(self):
        return self.content_path.exists()

    def invalidate(self):
        with self._access_lock:
            self._content_artifact = None
            self._collab_artifact = None
            self._metadata = None
            self._cache_mtime = None


# Module-level singleton
model_store = ModelStore()
