// src/components/digital/DigitalResources.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import digitalService, { toAbsoluteUrl } from '../../services/digitalService';
import ResourceViewer from './ResourceViewer';
import {
  detectFileType,
  extractMediaDuration,
  mapToResourceType,
  getTypeIcon,
} from '../../utils/mediaUtils';
import './DigitalResources.css';

const EMPTY_FORM = {
  title: '',
  resource_type: 'electronic_device',
  source_type: 'file',
  description: '',
  keywords: '',
  category: '',
  book: '',
  file: null,
  thumbnail: null,
  external_url: '',
  duration: '',
  access_level: 'public',
  quality_status: 'pending',
};

const TYPE_META = {
  electronic_device: { icon: '🔌', label: 'Electronic Device', tone: 'cyan' },
  ebook:             { icon: '📚', label: 'E-Book',           tone: 'violet' },
  pdf:               { icon: '📄', label: 'PDF Document',     tone: 'rose' },
  journal:           { icon: '📓', label: 'Journal',          tone: 'amber' },
  research_paper:    { icon: '📝', label: 'Research Paper',   tone: 'blue' },
  presentation:      { icon: '📊', label: 'Presentation',     tone: 'orange' },
  video:             { icon: '🎥', label: 'Video',            tone: 'pink' },
  audio:             { icon: '🎵', label: 'Audio',            tone: 'emerald' },
  youtube:           { icon: '▶️', label: 'YouTube',          tone: 'red' },
  external_link:     { icon: '🔗', label: 'External Link',    tone: 'slate' },
  other:             { icon: '📁', label: 'Other',            tone: 'slate' },
};

const QUALITY_META = {
  verified: { label: 'Verified', tone: 'emerald' },
  pending:  { label: 'Pending review', tone: 'amber' },
  rejected: { label: 'Rejected', tone: 'rose' },
  archived: { label: 'Archived', tone: 'slate' },
};

const getAcceptTypes = (resourceType) => {
  const map = {
    electronic_device: '*/*',
    ebook: '.pdf,.epub,.mobi',
    pdf: '.pdf',
    journal: '.pdf,.doc,.docx',
    research_paper: '.pdf,.doc,.docx',
    presentation: '.ppt,.pptx,.pdf',
    video: '.mp4,.webm,.ogg,.mov,.m4v',
    audio: '.mp3,.wav,.ogg,.m4a,.aac',
    youtube: '', external_link: '', other: '*/*',
  };
  return map[resourceType] || '*/*';
};

const getAcceptHint = (resourceType) => {
  const accept = getAcceptTypes(resourceType);
  return accept === '*/*' ? 'any file type' : accept.replace(/\./g, '').replace(/,/g, ', ');
};

const getAvailableResourceTypes = (sourceType) => {
  if (sourceType === 'youtube') return [{ value: 'youtube', label: '▶️ YouTube Video' }];
  if (sourceType === 'external') return [
    { value: 'external_link', label: '🔗 External Link' },
    { value: 'research_paper', label: '📝 Research Paper' },
    { value: 'journal', label: '📓 Journal Article' },
  ];
  return [
    { value: 'electronic_device', label: '🔌 Electronic Device / Hardware' },
    { value: 'ebook', label: '📚 E-Book' },
    { value: 'pdf', label: '📄 PDF Document' },
    { value: 'journal', label: '📓 Journal Article' },
    { value: 'research_paper', label: '📝 Research Paper' },
    { value: 'presentation', label: '📊 Presentation' },
    { value: 'video', label: '🎥 Video' },
    { value: 'audio', label: '🎵 Audio' },
    { value: 'other', label: '📁 Other' },
  ];
};

const getActionLabel = (resource) => {
  switch (resource.resource_type) {
    case 'electronic_device': return '🔌 View Device';
    case 'video': case 'youtube': return '▶ Watch';
    case 'audio': return '▶ Listen';
    case 'pdf': case 'ebook': case 'journal': case 'research_paper': return '📖 Read';
    case 'presentation': return '📊 View';
    case 'external_link': return '🔗 Open';
    default: return '👁 View';
  }
};

const DigitalResources = () => {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterQuality, setFilterQuality] = useState('all');
  const [detectedFileType, setDetectedFileType] = useState(null);
  const [detectingDuration, setDetectingDuration] = useState(false);
  const [autoDetectedDuration, setAutoDetectedDuration] = useState('');
  const [viewingResource, setViewingResource] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('library_favorites') || '[]'); }
    catch { return []; }
  });

  const isOfficer = user?.role === 'digital_officer' || user?.role === 'admin' || user?.role === 'librarian';

  useEffect(() => {
    fetchResources();
    fetchCategories();
    if (isOfficer) fetchStats();
  }, []);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const response = await digitalService.getResources();
      // Fixed: Safely extract array regardless of backend wrapping
      const data = response.data?.results || response.data?.data || response.data || [];
      setResources(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch resources error:', err);
      setResources([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await digitalService.getCategories();
      // Fixed: Safely extract array regardless of backend wrapping
      const data = response.data?.results || response.data?.data || response.data || [];
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) { 
      console.error('Failed to load categories:', err);
      setCategories([]); 
    }
  };

  const fetchStats = async () => {
    try {
      const response = await digitalService.getStats();
      setStats(response.data);
    } catch {}
  };

  const toggleFavorite = (id) => {
    const exists = favorites.includes(id);
    const updated = exists ? favorites.filter(x => x !== id) : [...favorites, id];
    setFavorites(updated);
    localStorage.setItem('library_favorites', JSON.stringify(updated));
    toast.info(exists ? 'Removed from favorites' : 'Saved to favorites ⭐');
  };

  const handleChange = async (e) => {
    const { name, value, type, files } = e.target;
    if (type === 'file') {
      const file = files[0];
      setFormData(prev => ({ ...prev, [name]: file }));
      if (name === 'thumbnail') return;
      if (file) {
        const detected = detectFileType(file);
        setDetectedFileType(detected);
        const autoType = mapToResourceType(detected);
        setFormData(prev => ({ ...prev, resource_type: autoType, source_type: 'file' }));
        if (detected === 'video' || detected === 'audio') {
          setDetectingDuration(true);
          try {
            const { duration } = await extractMediaDuration(file);
            setAutoDetectedDuration(duration);
            setFormData(prev => ({ ...prev, duration }));
          } catch {}
          finally { setDetectingDuration(false); }
        }
      } else {
        setDetectedFileType(null);
        setAutoDetectedDuration('');
      }
      return;
    }
    if (name === 'source_type') {
      setDetectedFileType(null); setAutoDetectedDuration('');
      setFormData(prev => ({
        ...prev, source_type: value, file: null, external_url: '', duration: '',
        resource_type: value === 'youtube' ? 'youtube' : value === 'external' ? 'external_link' : 'other',
      }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const syntheticEvent = { target: { name: 'file', type: 'file', files: [file] } };
    handleChange(syntheticEvent);
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingResource(null);
    setDetectedFileType(null);
    setAutoDetectedDuration('');
    setError(''); setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setSaving(true);
    try {
      if (formData.source_type === 'file' && !formData.file &&
          !(formData.resource_type === 'electronic_device' && formData.thumbnail) &&
          !editingResource) {
        throw new Error('Please select a file or device photo to upload.');
      }
      if ((formData.source_type === 'youtube' || formData.source_type === 'external') &&
          !formData.external_url) {
        throw new Error('Please provide a URL.');
      }
      const payload = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        if ((key === 'file' || key === 'thumbnail') && !(value instanceof File)) return;
        payload.append(key, value);
      });
      if (!payload.has('source_type')) payload.append('source_type', formData.source_type);

      if (editingResource) {
        await digitalService.updateResource(editingResource.id, payload);
        toast.success('Resource updated');
        setSuccess('Resource updated successfully!');
      } else {
        await digitalService.uploadResource(payload);
        toast.success('Resource uploaded');
        setSuccess('Resource uploaded successfully!');
      }
      setShowForm(false); resetForm(); fetchResources();
      if (isOfficer) fetchStats();
    } catch (err) {
      const data = err.response?.data;
      let msg = err.message || 'Operation failed';
      if (data && typeof data === 'object') {
        msg = Object.entries(data).map(([f, e]) => `${f}: ${Array.isArray(e) ? e.join(', ') : e}`).join(' · ');
      }
      setError(msg); toast.error(msg);
    } finally { setSaving(false); }
  };

  const handleEdit = (resource) => {
    setEditingResource(resource);
    setFormData({
      title: resource.title || '',
      resource_type: resource.resource_type || 'other',
      source_type: resource.source_type || 'file',
      description: resource.description || '',
      keywords: resource.keywords || '',
      category: resource.category?.id || resource.category_id || resource.category || '',
      book: resource.book || '',
      file: null, thumbnail: null,
      external_url: resource.external_url || '',
      duration: resource.duration || '',
      access_level: resource.access_level || 'public',
      quality_status: resource.quality_status || 'pending',
    });
    setDetectedFileType(null); setAutoDetectedDuration('');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}" permanently?`)) return;
    try {
      await digitalService.deleteResource(id);
      toast.success('Resource deleted');
      fetchResources();
      if (isOfficer) fetchStats();
    } catch { toast.error('Failed to delete resource'); }
  };

  const handleVerify = async (resource, action) => {
    const notes = window.prompt(`${action === 'verify' ? 'Verification' : action === 'reject' ? 'Rejection' : 'Archive'} notes (optional):`, '');
    if (notes === null) return;
    try {
      await digitalService.verifyResource(resource.id, action, notes);
      toast.success(`Resource ${action}ed`);
      fetchResources(); if (isOfficer) fetchStats();
    } catch { toast.error(`Failed to ${action} resource`); }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.name.trim()) { toast.error('Category name is required'); return; }
    setCreatingCategory(true);
    try {
      const response = await digitalService.createCategory({
        name: newCategory.name.trim(),
        description: newCategory.description.trim(),
      });
      toast.success(`Category "${newCategory.name}" created`);
      await fetchCategories();
      // Auto-select the newly created category
      setFormData(prev => ({ ...prev, category: response.data.id || response.data.data?.id }));
      setShowCategoryModal(false);
      setNewCategory({ name: '', description: '' });
    } catch (err) {
      toast.error(err.response?.data?.name?.[0] || err.response?.data?.detail || 'Failed to create category');
    } finally { setCreatingCategory(false); }
  };

  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      if (filterType !== 'all' && r.resource_type !== filterType) return false;
      if (filterQuality !== 'all' && r.quality_status !== filterQuality) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return r.title?.toLowerCase().includes(q) ||
             r.description?.toLowerCase().includes(q) ||
             r.keywords?.toLowerCase().includes(q);
    });
  }, [resources, filterType, filterQuality, search]);

  const counts = useMemo(() => {
    const c = { all: resources.length };
    resources.forEach(r => {
      c[r.resource_type] = (c[r.resource_type] || 0) + 1;
    });
    return c;
  }, [resources]);

  if (loading) {
    return (
      <div className="dr-page dr-loading-state">
        <div className="dr-loading-spinner" />
        <p>Loading digital resources…</p>
      </div>
    );
  }

  return (
    <div className="dr-page">
      {/* HERO */}
      <header className="dr-hero">
        <div className="dr-hero-content">
          <div className="dr-hero-left">
            <div className="dr-hero-eyebrow">DIGITAL COLLECTION</div>
            <h1 className="dr-hero-title">
              Digital Library & <span className="dr-hero-amp">&</span> Devices
            </h1>
            <p className="dr-hero-subtitle">
              Explore e-books, journals, videos, and electronic hardware — all
              from a single unified library. Read, watch, listen, or borrow in one click.
            </p>
            <div className="dr-hero-chips">
              <span className="dr-hero-chip">📚 {counts.all} total resources</span>
              <span className="dr-hero-chip">🔌 {counts.electronic_device || 0} devices</span>
              <span className="dr-hero-chip">✅ {resources.filter(r => r.quality_status === 'verified').length} verified</span>
            </div>
          </div>
          <div className="dr-hero-right">
            {isOfficer && (
              <button
                className="dr-btn dr-btn-primary"
                onClick={() => { if (showForm) { resetForm(); setShowForm(false); } else { resetForm(); setShowForm(true); } }}
              >
                {showForm ? '✕ Close Form' : '＋ Upload Resource'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* STATS ROW */}
      {stats && isOfficer && (
        <section className="dr-stats-row">
          <div className="dr-stat-card tone-blue">
            <div className="dr-stat-icon">📦</div>
            <div className="dr-stat-value">{stats.total_resources ?? 0}</div>
            <div className="dr-stat-label">Total Resources</div>
          </div>
          <div className="dr-stat-card tone-emerald">
            <div className="dr-stat-icon">⇩</div>
            <div className="dr-stat-value">{stats.total_downloads ?? 0}</div>
            <div className="dr-stat-label">Downloads</div>
          </div>
          <div className="dr-stat-card tone-violet">
            <div className="dr-stat-icon">👁</div>
            <div className="dr-stat-value">{stats.total_views ?? 0}</div>
            <div className="dr-stat-label">Views</div>
          </div>
          <div className="dr-stat-card tone-amber">
            <div className="dr-stat-icon">⏳</div>
            <div className="dr-stat-value">{stats.pending_review ?? 0}</div>
            <div className="dr-stat-label">Pending Review</div>
          </div>
        </section>
      )}

      {/* ALERTS */}
      {error && (
        <div className="dr-alert error" role="alert">
          <span>!</span>
          <p>{error}</p>
          <button onClick={() => setError('')} aria-label="Dismiss">×</button>
        </div>
      )}
      {success && (
        <div className="dr-alert success" role="status">
          <span>✓</span>
          <p>{success}</p>
          <button onClick={() => setSuccess('')} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* FORM */}
      {showForm && (
        <section className="dr-form-panel">
          <div className="dr-form-panel-head">
            <div>
              <h2>{editingResource ? '✏️ Edit Resource' : '＋ Upload New Resource'}</h2>
              <p>{editingResource ? 'Update the details below.' : 'Add a new digital resource or electronic device to the library.'}</p>
            </div>
            <button className="dr-form-close" onClick={() => { resetForm(); setShowForm(false); }}>×</button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="dr-form-grid">
              <label className="dr-field wide">
                <span>Title <b>*</b></span>
                <input
                  type="text" className="dr-input" name="title"
                  value={formData.title} onChange={handleChange} required
                  placeholder="e.g., Introduction to Machine Learning"
                />
              </label>

              <label className="dr-field">
                <span>Resource Type</span>
                <select className="dr-input" name="resource_type" value={formData.resource_type} onChange={handleChange}
                        disabled={formData.source_type === 'youtube'}>
                  {getAvailableResourceTypes(formData.source_type).map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="dr-field">
                <span>Source Type</span>
                <select className="dr-input" name="source_type" value={formData.source_type} onChange={handleChange}>
                  <option value="file">📁 Upload File</option>
                  <option value="youtube">▶️ YouTube Link</option>
                  <option value="external">🔗 External URL</option>
                </select>
              </label>

              <label className="dr-field">
                <span>
                  Category
                  {isOfficer && (
                    <button type="button" className="dr-link-btn" onClick={() => setShowCategoryModal(true)}>＋ Add</button>
                  )}
                </span>
                <select className="dr-input" name="category" value={formData.category} onChange={handleChange}>
                  <option value="">— Select Category —</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </label>

              {formData.source_type === 'file' && (
                <>
                  <label className="dr-field wide">
                    <span>{formData.resource_type === 'electronic_device' ? '🔌 Device Photo' : '🖼 Cover / Thumbnail'}</span>
                    <input type="file" className="dr-input dr-file-input" name="thumbnail" accept="image/*" onChange={handleChange} />
                  </label>

                  <label className="dr-field wide">
                    <span>
                      {formData.resource_type === 'electronic_device' ? '📖 Device Manual / Documentation' : 'File'} <b>*</b>
                    </span>
                    <div
                      className={`dr-dropzone ${isDragging ? 'is-dragging' : ''}`}
                      onDragEnter={e => { e.preventDefault(); setIsDragging(true); }}
                      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
                      onDrop={handleDrop}
                    >
                      <div className="dr-dropzone-icon">⇧</div>
                      <strong>Drag & drop your file here</strong>
                      <span className="dr-dropzone-or">or click to browse</span>
                      <input type="file" className="dr-input dr-file-input" name="file"
                             onChange={handleChange} accept={getAcceptTypes(formData.resource_type)}
                             required={!editingResource} />
                      <small>{getAcceptHint(formData.resource_type)} · max 50 MB</small>
                    </div>
                  </label>

                  {detectedFileType && (
                    <div className="dr-detect-banner">
                      <span style={{ fontSize: '1.4rem' }}>{getTypeIcon(detectedFileType)}</span>
                      <div>
                        <strong>Detected: {detectedFileType.toUpperCase()}</strong>
                        {detectingDuration && <span className="dr-detecting"> · extracting duration…</span>}
                        {autoDetectedDuration && <span className="dr-detected-duration">⏱ {autoDetectedDuration}</span>}
                      </div>
                    </div>
                  )}

                  {(detectedFileType === 'video' || detectedFileType === 'audio') && (
                    <label className="dr-field">
                      <span>Duration <small>(auto-detected)</small></span>
                      <input type="text" className="dr-input" name="duration"
                             value={formData.duration} onChange={handleChange}
                             placeholder={detectingDuration ? 'Detecting…' : 'M:SS'}
                             readOnly={detectingDuration} />
                    </label>
                  )}
                </>
              )}

              {formData.source_type === 'youtube' && (
                <label className="dr-field wide">
                  <span>YouTube URL <b>*</b></span>
                  <input type="url" className="dr-input" name="external_url"
                         value={formData.external_url} onChange={handleChange}
                         placeholder="https://www.youtube.com/watch?v=…" required />
                </label>
              )}

              {formData.source_type === 'external' && (
                <label className="dr-field wide">
                  <span>External URL <b>*</b></span>
                  <input type="url" className="dr-input" name="external_url"
                         value={formData.external_url} onChange={handleChange}
                         placeholder="https://example.com/resource" required />
                </label>
              )}

              <label className="dr-field wide">
                <span>Description</span>
                <textarea className="dr-input" name="description" rows="3"
                          value={formData.description} onChange={handleChange}
                          placeholder="Short summary of this resource…" />
              </label>

              <label className="dr-field wide">
                <span>Keywords</span>
                <input type="text" className="dr-input" name="keywords"
                       value={formData.keywords} onChange={handleChange}
                       placeholder="comma, separated" />
              </label>

              <label className="dr-field">
                <span>Access Level</span>
                <select className="dr-input" name="access_level" value={formData.access_level} onChange={handleChange}>
                  <option value="public">🌐 Public — Anyone</option>
                  <option value="registered">👤 Registered Users</option>
                  <option value="students">🎓 Students & Staff</option>
                  <option value="staff">🧑‍🏫 Academic Staff</option>
                  <option value="restricted">🔒 Restricted</option>
                </select>
              </label>

              <label className="dr-field">
                <span>Quality Status</span>
                <select className="dr-input" name="quality_status" value={formData.quality_status} onChange={handleChange}>
                  <option value="pending">⏳ Pending Review</option>
                  <option value="verified">✅ Verified</option>
                  <option value="rejected">❌ Rejected</option>
                  <option value="archived">📦 Archived</option>
                </select>
              </label>

              <label className="dr-field">
                <span>Linked Book (optional)</span>
                <input type="number" className="dr-input" name="book"
                       value={formData.book} onChange={handleChange}
                       placeholder="Book ID" />
              </label>
            </div>

            <div className="dr-form-actions">
              <button type="submit" className="dr-btn dr-btn-primary" disabled={saving}>
                {saving ? '⏳ Saving…' : editingResource ? '✓ Update' : '＋ Add to Library'}
              </button>
              <button type="button" className="dr-btn dr-btn-ghost" onClick={() => { resetForm(); setShowForm(false); }}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* FILTER BAR */}
      <section className="dr-filter-bar">
        <div className="dr-search-box">
          <span className="dr-search-icon">⌕</span>
          <input
            type="text" className="dr-search-input"
            placeholder="Search title, description, keywords…"
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="dr-pills">
          <button className={filterQuality === 'all' ? 'selected' : ''} onClick={() => setFilterQuality('all')}>
            All Status
          </button>
          {Object.entries(QUALITY_META).map(([key, meta]) => (
            <button key={key} className={filterQuality === key ? 'selected' : ''}
                    onClick={() => setFilterQuality(key)}>
              {meta.label}
            </button>
          ))}
        </div>
      </section>

      {/* TYPE PILLS */}
      <section className="dr-type-pills">
        <button className={filterType === 'all' ? 'selected' : ''} onClick={() => setFilterType('all')}>
          All <span>{counts.all}</span>
        </button>
        {Object.entries(TYPE_META).map(([key, meta]) => {
          if (!counts[key]) return null;
          return (
            <button key={key} className={filterType === key ? 'selected' : ''}
                    onClick={() => setFilterType(key)}>
              {meta.icon} {meta.label} <span>{counts[key]}</span>
            </button>
          );
        })}
      </section>

      {/* RESOURCES GRID */}
      {filteredResources.length === 0 ? (
        <div className="dr-empty">
          <div className="dr-empty-icon">🗂️</div>
          <h3>No resources found</h3>
          <p>Try changing your filters or upload the first resource.</p>
          {isOfficer && (
            <button className="dr-btn dr-btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
              ＋ Upload Resource
            </button>
          )}
        </div>
      ) : (
        <section className="dr-grid">
          {filteredResources.map(resource => {
            const meta = TYPE_META[resource.resource_type] || TYPE_META.other;
            const quality = QUALITY_META[resource.quality_status] || QUALITY_META.pending;
            const isFav = favorites.includes(resource.id);
            const thumb = toAbsoluteUrl(resource.thumbnail_url || resource.thumbnail);

            return (
              <article key={resource.id} className={`dr-card tone-${meta.tone}`}>
                <div className="dr-card-cover">
                  {thumb ? (
                    <img src={thumb} alt={resource.title}
                         onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <div className="dr-card-cover-fallback">{meta.icon}</div>
                  )}
                  <span className={`dr-quality-badge tone-${quality.tone}`}>
                    {quality.label}
                  </span>
                  <button
                    className={`dr-fav-btn ${isFav ? 'is-fav' : ''}`}
                    onClick={() => toggleFavorite(resource.id)}
                    title={isFav ? 'Remove from favorites' : 'Save to favorites'}
                  >
                    {isFav ? '⭐' : '🤍'}
                  </button>
                </div>

                <div className="dr-card-body">
                  <div className="dr-card-chip-row">
                    <span className={`dr-chip tone-${meta.tone}`}>
                      {meta.icon} {meta.label}
                    </span>
                    {resource.category_name && (
                      <span className="dr-chip-sub">{resource.category_name}</span>
                    )}
                  </div>

                  <h3 className="dr-card-title" title={resource.title}>{resource.title}</h3>
                  {resource.description && (
                    <p className="dr-card-desc">{resource.description}</p>
                  )}

                  <div className="dr-card-meta">
                    <span>⇩ {resource.downloads_count || 0}</span>
                    <span>👁 {resource.views_count || 0}</span>
                    {resource.duration && <span>⏱ {resource.duration}</span>}
                  </div>

                  <div className="dr-card-actions">
                    <button
                      className="dr-act dr-act-primary"
                      onClick={() => setViewingResource(resource)}
                    >
                      {getActionLabel(resource)}
                    </button>
                    {isOfficer && (
                      <>
                        <button className="dr-act dr-act-icon" onClick={() => handleEdit(resource)} title="Edit">✎</button>
                        {resource.quality_status !== 'verified' && (
                          <button className="dr-act dr-act-icon dr-act-success"
                                  onClick={() => handleVerify(resource, 'verify')} title="Verify">✓</button>
                        )}
                        {resource.quality_status !== 'rejected' && (
                          <button className="dr-act dr-act-icon dr-act-warn"
                                  onClick={() => handleVerify(resource, 'reject')} title="Reject">✕</button>
                        )}
                        <button className="dr-act dr-act-icon dr-act-danger"
                                onClick={() => handleDelete(resource.id, resource.title)} title="Delete">🗑</button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* CATEGORY MODAL */}
      {showCategoryModal && (
        <div className="dr-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCategoryModal(false); }}>
          <div className="dr-modal">
            <div className="dr-modal-head">
              <h3>＋ Add Category</h3>
              <button className="dr-modal-close" onClick={() => setShowCategoryModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateCategory}>
              <label className="dr-field">
                <span>Name</span>
                <input type="text" className="dr-input" required autoFocus
                       value={newCategory.name}
                       onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })} />
              </label>
              <label className="dr-field">
                <span>Description</span>
                <textarea className="dr-input" rows="2" value={newCategory.description}
                          onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })} />
              </label>
              <div className="dr-modal-actions">
                <button type="button" className="dr-btn dr-btn-ghost" onClick={() => setShowCategoryModal(false)}>Cancel</button>
                <button type="submit" className="dr-btn dr-btn-primary" disabled={creatingCategory}>
                  {creatingCategory ? 'Creating…' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEWER */}
      {viewingResource && (
        <ResourceViewer
          resource={viewingResource}
          resources={filteredResources}
          onSelectResource={(r) => setViewingResource(r)}
          onClose={() => setViewingResource(null)}
        />
      )}
    </div>
  );
};

export default DigitalResources;