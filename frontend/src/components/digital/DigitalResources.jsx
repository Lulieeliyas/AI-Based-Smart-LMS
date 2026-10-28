// src/components/digital/DigitalResources.jsx
import React, { useState, useEffect } from 'react';
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

  // Auto-detection state
  const [detectedFileType, setDetectedFileType] = useState(null);
  const [detectingDuration, setDetectingDuration] = useState(false);
  const [autoDetectedDuration, setAutoDetectedDuration] = useState('');

  // Viewer state
  const [viewingResource, setViewingResource] = useState(null);

  // Category modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [creatingCategory, setCreatingCategory] = useState(false);

  const isOfficer =
    user?.role === 'digital_officer' || user?.role === 'admin';

  // ============ HELPERS ============

  // Return allowed file extensions for a given resource_type
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
      youtube: '',
      external_link: '',
      other: '*/*',
    };
    return map[resourceType] || '*/*';
  };

  // Human-readable hint
  const getAcceptHint = (resourceType) => {
    const accept = getAcceptTypes(resourceType);
    if (accept === '*/*') return 'any file type';
    return accept.replace(/\./g, '').replace(/,/g, ', ');
  };

  // Resource type options depend on source type
  const getAvailableResourceTypes = (sourceType) => {
    if (sourceType === 'youtube') {
      return [{ value: 'youtube', label: '▶️ YouTube Video' }];
    }
    if (sourceType === 'external') {
      return [
        { value: 'external_link', label: '🔗 External Link' },
        { value: 'research_paper', label: '📝 Research Paper' },
        { value: 'journal', label: '📓 Journal Article' },
      ];
    }
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

  // ============ LOAD ============

  useEffect(() => {
    fetchResources();
    fetchCategories();
    if (isOfficer) fetchStats();
    // eslint-disable-next-line
  }, []);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const response = await digitalService.getResources();
      const data = response.data?.results || response.data || [];
      setResources(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch resources error:', err);
      toast.error('Failed to load resources');
      setResources([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await digitalService.getCategories();
      setCategories(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.warn('Categories unavailable:', err);
      setCategories([]);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await digitalService.getStats();
      setStats(response.data);
    } catch (err) {
      console.warn('Stats unavailable:', err);
    }
  };

  // ============ FORM HANDLING ============

  const handleChange = async (e) => {
    const { name, value, type, files, checked } = e.target;

    // ---- File input ----
    if (type === 'file') {
      const file = files[0];
      setFormData((prev) => ({ ...prev, [name]: file }));

      if (name === 'thumbnail') {
        return;
      }

      if (file) {
        const detected = detectFileType(file);
        setDetectedFileType(detected);

        // Auto-correct resource_type based on detected file
        const autoType = mapToResourceType(detected);
        setFormData((prev) => ({
          ...prev,
          resource_type: autoType,
          source_type: 'file',
        }));

        // Auto-extract duration for video/audio
        if (detected === 'video' || detected === 'audio') {
          setDetectingDuration(true);
          setAutoDetectedDuration('');
          try {
            const { duration } = await extractMediaDuration(file);
            setAutoDetectedDuration(duration);
            setFormData((prev) => ({ ...prev, duration }));
          } catch (err) {
            console.warn('Duration extraction failed:', err);
          } finally {
            setDetectingDuration(false);
          }
        } else {
          setAutoDetectedDuration('');
          setFormData((prev) => ({ ...prev, duration: '' }));
        }
      } else {
        setDetectedFileType(null);
        setAutoDetectedDuration('');
      }
      return;
    }

    // ---- Checkbox ----
    if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [name]: checked }));
      return;
    }

    // ---- Source type change ----
    if (name === 'source_type') {
      setDetectedFileType(null);
      setAutoDetectedDuration('');
      setFormData((prev) => ({
        ...prev,
        source_type: value,
        file: null,
        external_url: '',
        duration: '',
        resource_type:
          value === 'youtube'
            ? 'youtube'
            : value === 'external'
            ? 'external_link'
            : 'other',
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingResource(null);
    setDetectedFileType(null);
    setAutoDetectedDuration('');
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      // ---- Client-side validation ----
      if (
        formData.source_type === 'file' &&
        !formData.file &&
        !(formData.resource_type === 'electronic_device' && formData.thumbnail) &&
        !editingResource
      ) {
        throw new Error('Please select a file or device photo to upload.');
      }
      if (
        (formData.source_type === 'youtube' ||
          formData.source_type === 'external') &&
        !formData.external_url
      ) {
        throw new Error('Please provide a URL.');
      }

      const payload = new FormData();

      Object.entries(formData).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        if ((key === 'file' || key === 'thumbnail') && !(value instanceof File)) return;
        payload.append(key, value);
      });

      if (!payload.has('source_type')) {
        payload.append('source_type', formData.source_type);
      }

      if (editingResource) {
        await digitalService.updateResource(editingResource.id, payload);
        toast.success('Resource updated');
        setSuccess('Resource updated successfully!');
      } else {
        await digitalService.uploadResource(payload);
        toast.success('Resource uploaded');
        setSuccess('Resource uploaded successfully!');
      }

      setShowForm(false);
      resetForm();
      fetchResources();
      if (isOfficer) fetchStats();
    } catch (err) {
      console.error('Save error:', err);
      let msg = 'Operation failed';
      const data = err.response?.data;
      if (data) {
        if (typeof data === 'string') msg = data;
        else if (data.detail) msg = data.detail;
        else if (data.error) msg = data.error;
        else {
          msg = Object.entries(data)
            .map(([field, errors]) => {
              const t = Array.isArray(errors) ? errors.join(', ') : errors;
              return `${field}: ${t}`;
            })
            .join(' | ');
        }
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (resource) => {
    setEditingResource(resource);
    setFormData({
      title: resource.title || '',
      resource_type: resource.resource_type || 'other',
      source_type: resource.source_type || 'file',
      description: resource.description || '',
      keywords: resource.keywords || '',
      category: resource.category || '',
      book: resource.book || '',
      file: null,
      thumbnail: null,
      external_url: resource.external_url || '',
      duration: resource.duration || '',
      access_level: resource.access_level || 'public',
      quality_status: resource.quality_status || 'pending',
    });
    setDetectedFileType(null);
    setAutoDetectedDuration('');
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
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete resource');
    }
  };

  // ✅ VIEW (in-browser) instead of forced download
  const handleView = (resource) => {
    setViewingResource(resource);
    digitalService.getResource(resource.id).catch(() => {});
  };

  // Download still available via the viewer modal
  const handleDownload = async (resource) => {
    if (
      resource.source_type === 'youtube' ||
      resource.source_type === 'external'
    ) {
      if (resource.external_url) window.open(resource.external_url, '_blank');
      return;
    }
    try {
      const response = await digitalService.downloadResource(resource.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', resource.title || 'resource');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Download failed');
    }
  };

  const handleVerify = async (resource, action) => {
    const notes = window.prompt(
      action === 'verify'
        ? 'Verification notes (optional):'
        : action === 'reject'
        ? 'Reason for rejection:'
        : 'Archive notes (optional):',
      ''
    );
    if (notes === null) return;
    try {
      await digitalService.verifyResource(resource.id, action, notes);
      toast.success(`Resource ${action}ed`);
      fetchResources();
      if (isOfficer) fetchStats();
    } catch (err) {
      toast.error(`Failed to ${action} resource`);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    setCreatingCategory(true);
    try {
      const response = await digitalService.createCategory({
        name: newCategory.name.trim(),
        description: newCategory.description.trim(),
      });
      toast.success(`Category "${response.data.name}" created`);
      await fetchCategories();
      setFormData((prev) => ({ ...prev, category: response.data.id }));
      setShowCategoryModal(false);
      setNewCategory({ name: '', description: '' });
    } catch (err) {
      const msg =
        err.response?.data?.name?.[0] ||
        err.response?.data?.detail ||
        'Failed to create category';
      toast.error(msg);
    } finally {
      setCreatingCategory(false);
    }
  };

  // ============ RENDER HELPERS ============

  const getResourceIcon = (type) => {
    const icons = {
      electronic_device: '🔌',
      ebook: '📚',
      pdf: '📄',
      journal: '📓',
      research_paper: '📝',
      presentation: '📊',
      video: '🎥',
      audio: '🎵',
      youtube: '▶️',
      external_link: '🔗',
      other: '📁',
    };
    return icons[type] || '📁';
  };

  const getActionLabel = (resource) => {
    switch (resource.resource_type) {
      case 'electronic_device':
        return '🔌 View Device & Contents';
      case 'video':
      case 'youtube':
        return '▶ Watch';
      case 'audio':
        return '▶ Listen';
      case 'pdf':
      case 'ebook':
      case 'journal':
      case 'research_paper':
        return '📖 Read';
      case 'presentation':
        return '📊 View';
      case 'external_link':
        return '🔗 Open';
      default:
        return '👁 View';
    }
  };

  const getQualityBadge = (status) => {
    const colors = {
      verified: 'success',
      pending: 'warning',
      rejected: 'danger',
      archived: 'secondary',
    };
    return colors[status] || 'secondary';
  };

  const filteredResources = resources.filter((r) => {
    if (filterType !== 'all' && r.resource_type !== filterType) return false;
    if (filterQuality !== 'all' && r.quality_status !== filterQuality)
      return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.title?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.keywords?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="mt-2">Loading digital resources...</p>
      </div>
    );
  }

  return (
    <div>
      {/* ============ HEADER ============ */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 className="mb-1">💻 Digital Library</h2>
          <p className="text-muted mb-0">
            {resources.length} resources • read, listen, watch in-browser
          </p>
        </div>
        {isOfficer && (
          <button
            className="btn btn-primary"
            onClick={() => {
              if (showForm) {
                resetForm();
                setShowForm(false);
              } else {
                resetForm();
                setShowForm(true);
              }
            }}
          >
            {showForm ? (
              <>
                <i className="bi bi-x-circle me-1"></i> Cancel
              </>
            ) : (
              <>
                <i className="bi bi-cloud-upload me-1"></i> Upload Resource
              </>
            )}
          </button>
        )}
      </div>

      {/* ============ STATS ============ */}
      {stats && isOfficer && (
        <div className="row g-2 mb-4">
          <div className="col-md-3 col-6">
            <div className="card bg-primary text-white text-center py-2">
              <h4 className="mb-0">{stats.total_resources}</h4>
              <small>Total</small>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="card bg-success text-white text-center py-2">
              <h4 className="mb-0">{stats.total_downloads}</h4>
              <small>Downloads</small>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="card bg-info text-white text-center py-2">
              <h4 className="mb-0">{stats.total_views}</h4>
              <small>Views</small>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="card bg-warning text-white text-center py-2">
              <h4 className="mb-0">{stats.pending_review}</h4>
              <small>Pending</small>
            </div>
          </div>
        </div>
      )}

      {/* ============ ALERTS ============ */}
      {error && (
        <div className="alert alert-danger alert-dismissible">
          {error}
          <button className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}
      {success && (
        <div className="alert alert-success alert-dismissible">
          {success}
          <button className="btn-close" onClick={() => setSuccess('')}></button>
        </div>
      )}

      {/* ============ FORM ============ */}
      {showForm && (
        <div className="card mb-4 shadow-sm border-primary">
          <div className="card-body">
            <h5 className="mb-3">
              {editingResource ? '✏️ Edit Resource' : '➕ Upload New Resource'}
            </h5>
            <form onSubmit={handleSubmit}>
              {/* Title + Resource Type */}
              <div className="row">
                <div className="col-md-8 mb-3">
                  <label className="form-label">
                    Title <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Introduction to Machine Learning"
                  />
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Resource Type</label>
                  <select
                    className="form-select"
                    name="resource_type"
                    value={formData.resource_type}
                    onChange={handleChange}
                    disabled={formData.source_type === 'youtube'}
                  >
                    {getAvailableResourceTypes(formData.source_type).map(
                      (opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {/* Source Type + Category */}
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Source Type</label>
                  <select
                    className="form-select"
                    name="source_type"
                    value={formData.source_type}
                    onChange={handleChange}
                  >
                    <option value="file">📁 Upload File</option>
                    <option value="youtube">▶️ YouTube Link</option>
                    <option value="external">🔗 External URL</option>
                  </select>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Category
                    {isOfficer && (
                      <button
                        type="button"
                        className="btn btn-sm btn-link p-0 ms-2"
                        onClick={() => setShowCategoryModal(true)}
                      >
                        <i className="bi bi-plus-circle"></i> Add category
                      </button>
                    )}
                  </label>
                  <select
                    className="form-select"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ============ FILE SOURCE ============ */}
              {formData.source_type === 'file' && (
                <>
                  <div className="mb-3">
                    <label className="form-label">
                      {formData.resource_type === 'electronic_device'
                        ? '🔌 Device Photo / Hardware Image'
                        : 'Cover / Thumbnail Image'}
                    </label>
                    <input
                      type="file"
                      className="form-control"
                      name="thumbnail"
                      accept="image/*"
                      onChange={handleChange}
                    />
                    <small className="text-muted">
                      {formData.resource_type === 'electronic_device'
                        ? 'Upload a photo of the electronic hardware or device'
                        : 'Optional image thumbnail'}
                    </small>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">
                      {formData.resource_type === 'electronic_device'
                        ? 'Device Documentation / Manual / Firmware File'
                        : 'File'} <span className="text-danger">*</span>
                    </label>
                    <input
                      type="file"
                      className="form-control"
                      name="file"
                      onChange={handleChange}
                      accept={getAcceptTypes(formData.resource_type)}
                      required={!editingResource}
                    />
                    <small className="text-muted">
                      Max 50MB. Allowed for{' '}
                      <strong>{formData.resource_type}</strong>:{' '}
                      {getAcceptHint(formData.resource_type)}
                    </small>
                  </div>

                  {/* Detection banner */}
                  {detectedFileType && (
                    <div className="alert alert-info d-flex align-items-center mb-3">
                      <span
                        style={{ fontSize: '1.5rem' }}
                        className="me-2"
                      >
                        {getTypeIcon(detectedFileType)}
                      </span>
                      <div>
                        <strong>Detected:</strong>{' '}
                        {detectedFileType.toUpperCase()}
                        {detectingDuration && (
                          <span className="ms-2">
                            <span className="spinner-border spinner-border-sm me-1"></span>
                            Extracting duration...
                          </span>
                        )}
                        {autoDetectedDuration && (
                          <span className="ms-2 badge bg-success">
                            ⏱ {autoDetectedDuration}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mismatch warning */}
                  {detectedFileType && formData.resource_type && (
                    <MismatchWarning
                      detected={detectedFileType}
                      selected={formData.resource_type}
                      onFix={() => {
                        const corrected = mapToResourceType(
                          detectedFileType
                        );
                        setFormData((prev) => ({
                          ...prev,
                          resource_type: corrected,
                        }));
                      }}
                    />
                  )}

                  {/* Auto duration */}
                  {(detectedFileType === 'video' ||
                    detectedFileType === 'audio') && (
                    <div className="row">
                      <div className="col-md-3 mb-3">
                        <label className="form-label">
                          Duration{' '}
                          <small className="text-muted">(auto)</small>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          name="duration"
                          value={formData.duration}
                          onChange={handleChange}
                          placeholder={
                            detectingDuration ? 'Detecting...' : 'M:SS'
                          }
                          readOnly={detectingDuration}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ============ YOUTUBE ============ */}
              {formData.source_type === 'youtube' && (
                <div className="mb-3">
                  <label className="form-label">
                    YouTube URL <span className="text-danger">*</span>
                  </label>
                  <input
                    type="url"
                    className="form-control"
                    name="external_url"
                    value={formData.external_url}
                    onChange={handleChange}
                    placeholder="https://www.youtube.com/watch?v=..."
                    required
                  />
                </div>
              )}

              {/* ============ EXTERNAL ============ */}
              {formData.source_type === 'external' && (
                <div className="mb-3">
                  <label className="form-label">
                    External URL <span className="text-danger">*</span>
                  </label>
                  <input
                    type="url"
                    className="form-control"
                    name="external_url"
                    value={formData.external_url}
                    onChange={handleChange}
                    placeholder="https://example.com/resource"
                    required
                  />
                </div>
              )}

              {/* Description */}
              <div className="mb-3">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Short summary of the resource"
                ></textarea>
              </div>

              {/* Keywords */}
              <div className="mb-3">
                <label className="form-label">Keywords</label>
                <input
                  type="text"
                  className="form-control"
                  name="keywords"
                  value={formData.keywords}
                  onChange={handleChange}
                  placeholder="comma, separated"
                />
              </div>

              {/* Access + Quality + Book */}
              <div className="row">
                <div className="col-md-4 mb-3">
                  <label className="form-label">Access Level</label>
                  <select
                    className="form-select"
                    name="access_level"
                    value={formData.access_level}
                    onChange={handleChange}
                  >
                    <option value="public">Public — Anyone</option>
                    <option value="registered">Registered Users</option>
                    <option value="students">Students & Staff</option>
                    <option value="staff">Academic Staff Only</option>
                    <option value="restricted">Restricted</option>
                  </select>
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Quality Status</label>
                  <select
                    className="form-select"
                    name="quality_status"
                    value={formData.quality_status}
                    onChange={handleChange}
                  >
                    <option value="pending">⏳ Pending Review</option>
                    <option value="verified">✅ Verified</option>
                    <option value="rejected">❌ Rejected</option>
                    <option value="archived">📦 Archived</option>
                  </select>
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Linked Book (optional)</label>
                  <input
                    type="number"
                    className="form-control"
                    name="book"
                    value={formData.book}
                    onChange={handleChange}
                    placeholder="Book ID"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="d-flex gap-2">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Saving...
                    </>
                  ) : editingResource ? (
                    <>
                      <i className="bi bi-check-circle me-1"></i> Update
                    </>
                  ) : (
                    <>
                      <i className="bi bi-cloud-upload me-1"></i> Upload
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ CATEGORY MODAL ============ */}
      {showCategoryModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCategoryModal(false);
          }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">➕ Add Category</h5>
                <button
                  className="btn-close"
                  onClick={() => setShowCategoryModal(false)}
                ></button>
              </div>
              <form onSubmit={handleCreateCategory}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newCategory.name}
                      onChange={(e) =>
                        setNewCategory({
                          ...newCategory,
                          name: e.target.value,
                        })
                      }
                      required
                      autoFocus
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      value={newCategory.description}
                      onChange={(e) =>
                        setNewCategory({
                          ...newCategory,
                          description: e.target.value,
                        })
                      }
                      rows="2"
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCategoryModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-success"
                    disabled={creatingCategory}
                  >
                    {creatingCategory ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============ SEARCH + FILTERS ============ */}
      <div className="row g-2 mb-3">
        <div className="col-md-6">
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Search title, description, keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="col-md-3">
          <select
            className="form-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="electronic_device">🔌 Electronic Devices</option>
            <option value="ebook">E-Book</option>
            <option value="pdf">PDF</option>
            <option value="journal">Journal</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
            <option value="youtube">YouTube</option>
          </select>
        </div>
        <div className="col-md-3">
          <select
            className="form-select"
            value={filterQuality}
            onChange={(e) => setFilterQuality(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* ============ RESOURCES GRID ============ */}
      {filteredResources.length === 0 ? (
        <div className="text-center py-5 bg-light rounded">
          <div style={{ fontSize: '4rem' }}>📁</div>
          <h4>No digital resources found</h4>
        </div>
      ) : (
        <div className="row">
          {filteredResources.map((resource) => (
            <div key={resource.id} className="col-md-4 mb-3">
              <div className="card h-100 shadow-sm">
                <div className="card-body">
                  {/* Device Photo / Thumbnail */}
                  {(resource.thumbnail_url || resource.thumbnail) ? (
                    <div
                      style={{
                        height: "170px",
                        overflow: "hidden",
                        borderRadius: "8px",
                        background: "#f8fafc",
                        marginBottom: "12px",
                        border: "1px solid #e2e8f0",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <img
                        src={toAbsoluteUrl(resource.thumbnail_url || resource.thumbnail)}
                        alt={resource.title}
                        style={{ maxWidth: "100%", maxHeight: "170px", objectFit: "contain" }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  ) : resource.resource_type === 'electronic_device' ? (
                    <div
                      style={{
                        height: "100px",
                        borderRadius: "8px",
                        background: "#e0f2fe",
                        marginBottom: "12px",
                        display: "grid",
                        placeItems: "center",
                        color: "#0369a1",
                        fontSize: "40px",
                      }}
                    >
                      🔌
                    </div>
                  ) : null}

                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <h5 className="card-title mb-0">
                      {getResourceIcon(resource.resource_type)}{' '}
                      {resource.title}
                    </h5>
                    <span
                      className={`badge bg-${getQualityBadge(
                        resource.quality_status
                      )}`}
                    >
                      {resource.quality_status}
                    </span>
                  </div>

                  <p className="text-muted small mb-2">
                    {resource.resource_type_display || resource.resource_type}
                    {resource.category_name &&
                      ` • ${resource.category_name}`}
                    {resource.duration && ` • ⏱ ${resource.duration}`}
                  </p>

                  {resource.description && (
                    <p className="card-text small">
                      {resource.description}
                    </p>
                  )}

                  {resource.keywords && (
                    <p className="small text-muted mb-2">
                      <i className="bi bi-tags me-1"></i>
                      {resource.keywords}
                    </p>
                  )}

                  <div className="d-flex gap-3 small text-muted mb-3">
                    <span>
                      <i className="bi bi-download me-1"></i>
                      {resource.downloads_count || 0}
                    </span>
                    <span>
                      <i className="bi bi-eye me-1"></i>
                      {resource.views_count || 0}
                    </span>
                  </div>

                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    {/* Attractive View Button */}
                    <button
                      className="btn btn-primary btn-sm rounded-pill px-3 shadow-sm d-inline-flex align-items-center gap-1 fw-bold"
                      onClick={() => handleView(resource)}
                    >
                      {getActionLabel(resource)}
                    </button>

                    {/* Quick Favorite Star Button */}
                    <button
                      type="button"
                      className="btn btn-outline-warning btn-sm rounded-pill px-2"
                      title="Set as Favorite"
                      onClick={() => {
                        try {
                          const favs = JSON.parse(localStorage.getItem("library_favorites") || "[]");
                          const exists = favs.includes(resource.id);
                          const updated = exists ? favs.filter(id => id !== resource.id) : [...favs, resource.id];
                          localStorage.setItem("library_favorites", JSON.stringify(updated));
                          toast.info(exists ? "Removed from favorites" : "Saved as Favorite! ⭐");
                          setResources(r => [...r]);
                        } catch {}
                      }}
                    >
                      {JSON.parse(localStorage.getItem("library_favorites") || "[]").includes(resource.id) ? "⭐" : "🤍"}
                    </button>

                    {isOfficer && (
                      <>
                        <button
                          className="btn btn-outline-secondary btn-sm rounded-pill px-2 fw-semibold"
                          onClick={() => handleEdit(resource)}
                          title="Edit Details"
                        >
                          <i className="bi bi-pencil me-1"></i>Edit
                        </button>

                        {resource.quality_status !== 'verified' && (
                          <button
                            className="btn btn-outline-success btn-sm"
                            onClick={() =>
                              handleVerify(resource, 'verify')
                            }
                            title="Verify"
                          >
                            <i className="bi bi-check-circle"></i>
                          </button>
                        )}

                        {resource.quality_status !== 'rejected' && (
                          <button
                            className="btn btn-outline-warning btn-sm"
                            onClick={() =>
                              handleVerify(resource, 'reject')
                            }
                            title="Reject"
                          >
                            <i className="bi bi-x-circle"></i>
                          </button>
                        )}

                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() =>
                            handleDelete(resource.id, resource.title)
                          }
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============ VIEWER MODAL ============ */}
      {viewingResource && (
        <ResourceViewer
          resource={viewingResource}
          resources={filteredResources}
          onSelectResource={(r) => setViewingResource(r)}
          onClose={() => setViewingResource(null)}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
};

// ============ SUB-COMPONENT ============

function MismatchWarning({ detected, selected, onFix }) {
  const expectedFor = {
    video: ['video'],
    audio: ['audio'],
    pdf: ['pdf', 'ebook', 'journal', 'research_paper', 'presentation'],
    image: ['other'],
    epub: ['ebook'],
    office: ['presentation', 'other'],
    text: ['other'],
  };

  const valid = expectedFor[detected] || [];
  const isMismatch = valid.length > 0 && !valid.includes(selected);

  if (!isMismatch) return null;

  return (
    <div className="alert alert-warning d-flex align-items-center mb-3">
      <i className="bi bi-exclamation-triangle-fill me-2 fs-4"></i>
      <div className="flex-grow-1">
        <strong>Type mismatch!</strong> You uploaded a{' '}
        <b>{detected}</b> file but selected <b>{selected}</b>. This may cause
        display issues.
      </div>
      <button
        type="button"
        className="btn btn-sm btn-warning"
        onClick={onFix}
      >
        Fix
      </button>
    </div>
  );
}

export default DigitalResources;