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
    electronic_device: 'electronic_device',
    device: 'electronic_device',
    other: 'other',
  };
  return map[detectedType] || 'other';
};


export const getTypeIcon = (detectedType) => {
  const icons = {
    electronic_device: '🔌',
    device: '🔌',
    hardware: '🔌',
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


export const detectUrlType = (fileUrl, declaredType) => {
  if (!fileUrl) {
    if (declaredType === 'youtube') return 'youtube';
    if (declaredType === 'external_link' || declaredType === 'external') return 'external';
    if (declaredType === 'electronic_device') return 'electronic_device';
    return 'other';
  }
  const lower = fileUrl.toLowerCase();
  if (declaredType === 'electronic_device') return 'electronic_device';
  if (/\.(mp4|webm|ogg|mov|mkv|m4v)$/.test(lower)) return 'video';
  if (/\.(mp3|wav|m4a|aac|ogg|flac|opus)$/.test(lower)) return 'audio';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(lower)) return 'image';
  if (lower.endsWith('.epub')) return 'epub';
  if (/\.(doc|docx|ppt|pptx|xls|xlsx)$/.test(lower)) return 'office';
  if (lower.endsWith('.txt')) return 'text';
  return 'other';
};


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


export const resolveResourceType = (resource) => {
  if (!resource) return 'other';

  const declared = String(resource.resource_type || '').toLowerCase();

  // Trust explicit, meaningful declared types
  const trusted = [
    'electronic_device',
    'ebook',
    'pdf',
    'journal',
    'research_paper',
    'presentation',
    'video',
    'audio',
    'youtube',
    'external_link',
  ];
  if (trusted.includes(declared)) return declared;

  // Otherwise infer from the file / display URL
  const rawUrl =
    resource.file_url ||
    resource.file ||
    resource.display_url ||
    resource.external_url ||
    '';

  // detectUrlType returns 'epub' / 'office' etc.; map back to backend types
  const detected = detectUrlType(rawUrl, declared);
  const remap = {
    epub: 'ebook',
    office: 'presentation',
    image: 'other',
    text: 'other',
    archive: 'other',
    external: 'external_link',
    electronic_device: 'electronic_device',
    youtube: 'youtube',
    video: 'video',
    audio: 'audio',
    pdf: 'pdf',
    other: declared || 'other',
  };
  return remap[detected] || declared || 'other';
};

/** Big emoji icon for a resource (accepts resource object OR type string). */
export const getResourceIcon = (resourceOrType) => {
  const type =
    typeof resourceOrType === 'string'
      ? resourceOrType
      : resolveResourceType(resourceOrType);
  return getTypeIcon(type);
};

/** Friendly display label for a resource type. */
export const getResourceTypeLabel = (resourceOrType) => {
  const type =
    typeof resourceOrType === 'string'
      ? resourceOrType
      : resolveResourceType(resourceOrType);

  const labels = {
    electronic_device: 'Electronic Device',
    ebook: 'E-Book',
    pdf: 'PDF Document',
    journal: 'Journal Article',
    research_paper: 'Research Paper',
    presentation: 'Presentation',
    video: 'Video',
    audio: 'Audio Track',
    youtube: 'YouTube Video',
    external_link: 'External Link',
    image: 'Image',
    other: 'File',
  };
  return labels[type] || 'Resource';
};

/** Primary action verb ("Watch", "Listen", "Read", "Inspect", ...). */
export const getResourceActionVerb = (resourceOrType) => {
  const type =
    typeof resourceOrType === 'string'
      ? resourceOrType
      : resolveResourceType(resourceOrType);

  const verbs = {
    electronic_device: 'Inspect',
    ebook: 'Read',
    pdf: 'Read',
    journal: 'Read',
    research_paper: 'Read',
    presentation: 'View',
    video: 'Watch',
    audio: 'Listen',
    youtube: 'Watch',
    external_link: 'Open',
    image: 'View',
    other: 'View',
  };
  return verbs[type] || 'View';
};

/** Accent tone used by the UI chip / icon background. */
export const getResourceTone = (resourceOrType) => {
  const type =
    typeof resourceOrType === 'string'
      ? resourceOrType
      : resolveResourceType(resourceOrType);

  const tones = {
    electronic_device: 'cyan',
    ebook: 'violet',
    pdf: 'rose',
    journal: 'amber',
    research_paper: 'amber',
    presentation: 'orange',
    video: 'red',
    audio: 'pink',
    youtube: 'red',
    external_link: 'blue',
    image: 'emerald',
    other: 'slate',
  };
  return tones[type] || 'slate';
};