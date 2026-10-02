
/**
 * Detect the actual type of a file from its extension and MIME.
 * Returns: 'video' | 'audio' | 'pdf' | 'image' | 'epub' | 'office' | 'text' | 'archive' | 'other'
 */
export const detectFileType = (file) => {
  if (!file) return 'other';

  const name = (file.name || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();

  if (mime.startsWith('video/') || /\.(mp4|webm|ogg|mov|avi|mkv|flv|m4v)$/.test(name)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/.test(name)) {
    return 'audio';
  }
  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    return 'pdf';
  }
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(name)) {
    return 'image';
  }
  if (name.endsWith('.epub')) {
    return 'epub';
  }
  if (/\.(doc|docx|ppt|pptx|xls|xlsx)$/.test(name)) {
    return 'office';
  }
  if (mime.startsWith('text/') || name.endsWith('.txt')) {
    return 'text';
  }
  if (/\.(zip|rar|7z|tar|gz)$/.test(name)) {
    return 'archive';
  }
  return 'other';
};

/**
 * Extract duration from a video/audio File in the browser.
 * Resolves to { duration: 'M:SS', seconds: number }.
 */
export const extractMediaDuration = (file) => {
  return new Promise((resolve) => {
    if (!file) {
      resolve({ duration: '', seconds: 0 });
      return;
    }

    const type = detectFileType(file);
    if (type !== 'video' && type !== 'audio') {
      resolve({ duration: '', seconds: 0 });
      return;
    }

    const url = URL.createObjectURL(file);
    const media = document.createElement(type === 'video' ? 'video' : 'audio');
    media.preload = 'metadata';

    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      try {
        URL.revokeObjectURL(url);
      } catch (e) {}
      resolve(result);
    };

    media.onloadedmetadata = () => {
      const seconds = Math.round(media.duration || 0);
      finish({ duration: formatDuration(seconds), seconds });
    };
    media.onerror = () => finish({ duration: '', seconds: 0 });

    setTimeout(() => finish({ duration: '', seconds: 0 }), 5000);

    media.src = url;
  });
};

/**
 * Format seconds → "M:SS" or "H:MM:SS".
 */
export const formatDuration = (seconds) => {
  if (!seconds || !isFinite(seconds)) return '';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
};

/**
 * Map a detected type → the resource_type value the backend expects.
 */
export const mapToResourceType = (detectedType) => {
  const map = {
    video: 'video',
    audio: 'audio',
    pdf: 'pdf',
    image: 'other',
    epub: 'ebook',
    office: 'presentation',
    text: 'other',
    archive: 'other',
    other: 'other',
  };
  return map[detectedType] || 'other';
};

/**
 * Emoji icon for a detected file type.
 */
export const getTypeIcon = (detectedType) => {
  const icons = {
    video: '🎥',
    audio: '🎵',
    pdf: '📄',
    image: '🖼️',
    epub: '📚',
    office: '📊',
    text: '📝',
    archive: '📦',
    other: '📁',
  };
  return icons[detectedType] || '📁';
};

/**
 * Detect actual type from a URL (file extension).
 */
export const detectUrlType = (fileUrl, declaredType) => {
  if (!fileUrl) {
    if (declaredType === 'youtube') return 'youtube';
    if (declaredType === 'external_link' || declaredType === 'external') return 'external';
    return 'other';
  }
  const lower = fileUrl.toLowerCase();
  if (/\.(mp4|webm|ogg|mov|mkv|m4v)$/.test(lower)) return 'video';
  if (/\.(mp3|wav|m4a|aac|ogg|flac|opus)$/.test(lower)) return 'audio';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(lower)) return 'image';
  if (lower.endsWith('.epub')) return 'epub';
  if (/\.(doc|docx|ppt|pptx|xls|xlsx)$/.test(lower)) return 'office';
  if (lower.endsWith('.txt')) return 'text';
  return 'other';
};

/**
 * Extract YouTube ID from any YouTube URL.
 */
export const extractYouTubeId = (url) => {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
};