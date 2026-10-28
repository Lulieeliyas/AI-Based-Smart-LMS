import { useCallback, useEffect, useMemo, useState } from "react";
import digitalService, { toAbsoluteUrl } from "../../services/digitalService";
import ResourceViewer from "../../components/digital/ResourceViewer";
import {
  resolveResourceType,
  getResourceIcon,
  getResourceTypeLabel,
  getResourceActionVerb,
  getResourceTone,
} from "../../utils/mediaUtils";
import "./DigitalOfficerDashboard.css";

const initialForm = {
  title: "",
  description: "",
  resource_type: "electronic_device",
  source_type: "file",
  category: "",
  keywords: "",
  file: null,
  thumbnail: null,
  external_url: "",
  access_level: "public",
  duration: "",
};

const statusText = {
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
  archived: "Archived",
};

const types = [
  ["electronic_device", "🔌 Electronic Device / Hardware"],
  ["ebook", "📚 E-book"],
  ["pdf", "📄 PDF document"],
  ["journal", "📓 Journal"],
  ["research_paper", "📝 Research paper"],
  ["presentation", "📊 Presentation"],
  ["video", "🎥 Video"],
  ["audio", "🎵 Audio"],
  ["youtube", "▶️ YouTube video"],
  ["external_link", "🔗 External link"],
  ["other", "📁 Other"],
];

const access = [
  ["public", "Public — Anyone"],
  ["registered", "Registered users"],
  ["students", "Students and staff"],
  ["staff", "Academic staff only"],
  ["restricted", "Librarian & Officer only"],
];

const listOf = (value) => {
  if (Array.isArray(value)) return value;
  if (value?.results && Array.isArray(value.results)) return value.results;
  if (value?.data && Array.isArray(value.data)) return value.data;
  return [];
};

const errorText = (error) => {
  const d = error?.response?.data;
  if (typeof d === "string") return d;
  if (d?.detail || d?.error) return d.detail || d.error;
  if (d && typeof d === "object") {
    return Object.entries(d)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
      .join(" · ");
  }
  return error?.message || "Something went wrong. Please try again.";
};

export default function DigitalOfficerDashboard() {
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({});
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [localFileUrl, setLocalFileUrl] = useState("");
  const [localThumbnailUrl, setLocalThumbnailUrl] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [viewingResource, setViewingResource] = useState(null);
  const [openSetAsId, setOpenSetAsId] = useState(null);

  useEffect(() => {
    const handleGlobalClick = () => setOpenSetAsId(null);
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (status) params.quality_status = status;
      const [r, c, s] = await Promise.all([
        digitalService.getResources(params),
        digitalService.getCategories(),
        digitalService.getStats(),
      ]);
      setResources(listOf(r));
      setCategories(listOf(c));
      setStats(s || {});
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!form.file) {
      setLocalFileUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(form.file);
    setLocalFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [form.file]);

  useEffect(() => {
    if (!form.thumbnail) {
      setLocalThumbnailUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(form.thumbnail);
    setLocalThumbnailUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [form.thumbnail]);

  const updateForm = (e) => {
    const { name, value, files } = e.target;
    setForm((old) => ({ ...old, [name]: files ? files[0] || null : value }));
  };

  const handleDropFile = (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setForm((old) => ({ ...old, file }));
  };

  const reset = () => {
    setForm(initialForm);
    setEditingId(null);
    setFormOpen(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    const isDevice = form.resource_type === "electronic_device";
    if (
      form.source_type === "file" &&
      !editingId &&
      !form.file &&
      !(isDevice && form.thumbnail)
    ) {
      setError(
        isDevice
          ? "Please provide either a hardware photo or an attached document/manual for this electronic device."
          : "Choose a file or drop one into the upload area."
      );
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.file || payload.source_type !== "file") delete payload.file;
      if (!payload.thumbnail) delete payload.thumbnail;

      if (editingId) {
        await digitalService.updateResource(editingId, payload);
        setNotice("Resource updated successfully.");
      } else {
        await digitalService.createResource(payload);
        setNotice(
          isDevice
            ? "Electronic device successfully added to the digital collection."
            : "Resource uploaded and added to the collection."
        );
      }
      reset();
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const edit = (r) => {
    setEditingId(r.id);
    setFormOpen(true);
    setForm({
      title: r.title || "",
      description: r.description || "",
      resource_type: r.resource_type || "electronic_device",
      source_type: r.source_type || "file",
      category: r.category ? String(r.category) : "",
      keywords: r.keywords || "",
      file: null,
      thumbnail: null,
      external_url: r.external_url || "",
      access_level: r.access_level || "public",
      duration: r.duration || "",
    });
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const verify = async (r, next) => {
    if (
      !window.confirm(
        `${next === "verified" ? "Approve" : "Reject"} “${r.title}”?`
      )
    )
      return;
    try {
      await digitalService.verifyResource(r.id, next);
      setNotice(`Resource ${next === "verified" ? "approved" : "rejected"}.`);
      await load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const publish = async (r) => {
    try {
      const currentlyPublished = r.quality_status === "verified";
      await digitalService.publishResource(r.id, !currentlyPublished);
      setNotice(
        currentlyPublished
          ? "Resource unpublished."
          : "Resource published and verified."
      );
      await load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Delete “${r.title}” permanently?`)) return;
    try {
      await digitalService.deleteResource(r.id);
      setNotice("Resource deleted.");
      await load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const openResource = (r) => setViewingResource(r);

  const addCategory = async () => {
    const name = window.prompt(
      "New Category Name (e.g. 'Electronics Lab', 'Hardware Devices'):"
    );
    if (!name?.trim()) return;
    try {
      await digitalService.createCategory({
        name: name.trim(),
        description: "",
      });
      setNotice("Category created.");
      await load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const typeCounts = useMemo(
    () =>
      resources.reduce((acc, r) => {
        const key = r.resource_type || "other";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    [resources]
  );

  const visibleResources = useMemo(
    () =>
      resources.filter((r) => {
        const matchesType =
          typeFilter === "all" || r.resource_type === typeFilter;
        const resourceCategoryId =
          r.category?.id ?? r.category_id ?? r.category;
        const matchesCategory =
          categoryFilter === "all" ||
          String(resourceCategoryId ?? "") === String(categoryFilter);
        return matchesType && matchesCategory;
      }),
    [resources, typeFilter, categoryFilter]
  );

  const electronicDeviceCount = useMemo(
    () =>
      stats.electronic_devices_count ??
      resources.filter(
        (r) =>
          resolveResourceType(r) === "electronic_device" ||
          String(r.category_name).toLowerCase().includes("electronic")
      ).length,
    [stats, resources]
  );

  const cards = useMemo(
    () => [
      [
        "Total resources",
        stats.total_resources ?? resources.length,
        "▤",
        "blue",
      ],
      ["Electronic Devices", electronicDeviceCount, "🔌", "cyan"],
      [
        "Awaiting review",
        stats.pending_resources ??
          resources.filter((r) => r.quality_status === "pending").length,
        "◷",
        "amber",
      ],
      [
        "Verified & Active",
        stats.verified_resources ??
          resources.filter((r) => r.quality_status === "verified").length,
        "✓",
        "green",
      ],
      ["Total downloads", stats.total_downloads ?? 0, "↓", "violet"],
    ],
    [stats, resources, electronicDeviceCount]
  );

  return (
    <main className="dr-shell">
      {/* Sidebar */}
      <aside className="dr-sidebar">
        <div className="dr-brand">
          <span className="dr-brand-icon">D</span>
          <span>
            Digital<span className="dr-brand-light">Library</span>
          </span>
        </div>
        <div className="dr-nav-label">WORKSPACE</div>
        <a className="dr-nav active" href="#overview">
          <span>◫</span> Overview
        </a>
        <a className="dr-nav" href="#resources">
          <span>▤</span> Resources & Devices
        </a>
        <button
          className="dr-nav dr-nav-button"
          type="button"
          onClick={() => {
            setFormOpen(true);
            setTimeout(
              () =>
                document
                  .getElementById("editor")
                  ?.scrollIntoView({ behavior: "smooth" }),
              50
            );
          }}
        >
          <span>＋</span> Add resource / device
        </button>
        <div className="dr-side-bottom">
          <div className="dr-avatar">DO</div>
          <div>
            <strong>Library Officer</strong>
            <small>Content administrator</small>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <section className="dr-main" id="overview">
        <header className="dr-topbar">
          <div className="dr-crumb">
            Workspace <span>/</span> Digital library & Electronic devices
          </div>
          <button
            className="dr-button dr-button-primary"
            onClick={() => {
              setEditingId(null);
              setForm(initialForm);
              setFormOpen(true);
              setTimeout(
                () =>
                  document
                    .getElementById("editor")
                    ?.scrollIntoView({ behavior: "smooth" }),
                50
              );
            }}
          >
            ＋ Add resource / device
          </button>
        </header>

        <div className="dr-content">
          <div className="dr-heading">
            <div>
              <div className="dr-eyebrow">LIBRARY MANAGEMENT</div>
              <h1>Digital Resources & Electronic Devices</h1>
              <p>
                Curate, inspect, review, and publish electronic devices and
                digital materials.
              </p>
            </div>
            <button
              className="dr-button dr-button-plain"
              onClick={addCategory}
            >
              ＋ New category
            </button>
          </div>

          {error && (
            <div className="dr-alert error" role="alert">
              <span>!</span>
              <div>
                <strong>Something needs your attention</strong>
                <p>{error}</p>
              </div>
              <button onClick={() => setError("")} aria-label="Dismiss">
                ×
              </button>
            </div>
          )}

          {notice && (
            <div className="dr-alert success" role="status">
              <span>✓</span>
              <p>{notice}</p>
              <button onClick={() => setNotice("")} aria-label="Dismiss">
                ×
              </button>
            </div>
          )}

          {/* Stats Bar */}
          <section className="dr-stat-grid" aria-label="Library statistics">
            {cards.map(([label, value, icon, tone]) => (
              <article className="dr-stat" key={label}>
                <div className={`dr-stat-icon ${tone}`}>{icon}</div>
                <div className="dr-stat-label">{label}</div>
                <strong>{Number(value).toLocaleString()}</strong>
              </article>
            ))}
          </section>

          {/* Upload / Edit Panel */}
          {formOpen && (
            <section className="dr-panel" id="editor">
              <div className="dr-panel-heading">
                <div>
                  <h2>
                    {editingId
                      ? "Edit Resource or Device"
                      : "Add Resource or Electronic Device"}
                  </h2>
                  <p>
                    {editingId
                      ? "Update the details and specifications below."
                      : "Add a new digital resource or electronic hardware device to the collection."}
                  </p>
                </div>
                {editingId && <span className="dr-edit-tag">EDITING</span>}
              </div>

              <form onSubmit={submit}>
                <div className="dr-form-grid">
                  <label>
                    {form.resource_type === "electronic_device"
                      ? "Device Name *"
                      : "Title *"}
                    <input
                      name="title"
                      value={form.title}
                      onChange={updateForm}
                      required
                      placeholder={
                        form.resource_type === "electronic_device"
                          ? "e.g. Raspberry Pi 4 Kit, Kindle Paperwhite, Arduino Starter"
                          : "e.g. Introduction to Machine Learning"
                      }
                    />
                  </label>

                  <label>
                    Resource Type <b>*</b>
                    <select
                      name="resource_type"
                      value={form.resource_type}
                      onChange={updateForm}
                    >
                      {types.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Source <b>*</b>
                    <select
                      name="source_type"
                      value={form.source_type}
                      onChange={updateForm}
                    >
                      <option value="file">Uploaded file / local media</option>
                      <option value="youtube">YouTube video link</option>
                      <option value="external">External link / URL</option>
                    </select>
                  </label>

                  <label>
                    Category
                    <select
                      name="category"
                      value={form.category}
                      onChange={updateForm}
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Access Level
                    <select
                      name="access_level"
                      value={form.access_level}
                      onChange={updateForm}
                    >
                      {access.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    {form.resource_type === "electronic_device"
                      ? "Hardware Model / Specs"
                      : "Duration / Specs"}
                    <span className="dr-muted"> (optional)</span>
                    <input
                      name="duration"
                      value={form.duration}
                      onChange={updateForm}
                      placeholder={
                        form.resource_type === "electronic_device"
                          ? "e.g. 8GB RAM / Quad Core / Rev 1.2"
                          : "e.g. 15:30"
                      }
                    />
                  </label>

                  <label className="wide">
                    {form.resource_type === "electronic_device"
                      ? "Device Description & Technical Specifications"
                      : "Description"}
                    <textarea
                      name="description"
                      value={form.description}
                      onChange={updateForm}
                      rows="3"
                      placeholder={
                        form.resource_type === "electronic_device"
                          ? "Enter detailed description, device specifications, components included in the package, and usage guidelines…"
                          : "A short summary to help users discover and use this resource…"
                      }
                    />
                  </label>

                  <label className="wide">
                    Keywords{" "}
                    <span className="dr-muted">(comma-separated)</span>
                    <input
                      name="keywords"
                      value={form.keywords}
                      onChange={updateForm}
                      placeholder={
                        form.resource_type === "electronic_device"
                          ? "electronics, hardware, embedded, raspberry pi, iot, lab equipment"
                          : "computer science, algorithms, textbook"
                      }
                    />
                  </label>

                  <label className="wide">
                    <strong>
                      {form.resource_type === "electronic_device"
                        ? "🔌 Electronic Device Photo / Hardware Image"
                        : "Thumbnail / Cover Image"}
                    </strong>
                    <span className="dr-muted">
                      {form.resource_type === "electronic_device"
                        ? " (Recommended: Photo of the physical device or kit)"
                        : " (optional; shown in resource cards)"}
                    </span>
                    <input
                      className="dr-file"
                      type="file"
                      name="thumbnail"
                      accept="image/*"
                      onChange={updateForm}
                    />
                    {form.thumbnail && (
                      <div className="dr-thumb-preview">
                        <img
                          src={localThumbnailUrl}
                          alt="Selected thumbnail preview"
                        />
                        <span>{form.thumbnail.name}</span>
                      </div>
                    )}
                  </label>

                  {form.source_type === "file" ? (
                    <label className="wide">
                      <strong>
                        {form.resource_type === "electronic_device"
                          ? "📖 Device Contents / User Manual / Schematics / Software"
                          : "Upload Resource File"}
                      </strong>
                      <span className="dr-muted">
                        {form.resource_type === "electronic_device"
                          ? " (Optional if hardware photo is provided: PDF manual, schematics, code, or driver)"
                          : editingId
                          ? " (optional when editing)"
                          : " (required)"}
                      </span>
                      <div
                        className={`dr-drop-zone ${
                          isDraggingFile ? "dragging" : ""
                        }`}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          setIsDraggingFile(true);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingFile(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          setIsDraggingFile(false);
                        }}
                        onDrop={handleDropFile}
                      >
                        <span className="dr-drop-icon">⇧</span>
                        <strong>
                          Drag and drop documentation or media file here
                        </strong>
                        <span className="dr-drop-or">
                          or choose from your computer
                        </span>
                        <input
                          className="dr-file"
                          type="file"
                          name="file"
                          onChange={updateForm}
                          accept=".pdf,.epub,.doc,.docx,.ppt,.pptx,.mp4,.mp3,.png,.jpg,.jpeg,.txt,.zip,.tar,.gz"
                        />
                        <small>
                          PDF manuals, schematics, images, videos, audio, text,
                          or office docs
                        </small>
                      </div>

                      {form.file && (
                        <div className="dr-local-preview">
                          <div className="dr-local-meta">
                            <strong>{form.file.name}</strong>
                            <span>
                              {(form.file.size / (1024 * 1024)).toFixed(2)} MB
                              · {form.file.type || "File type detected"}
                            </span>
                          </div>
                          {form.file.type.startsWith("image/") && (
                            <img
                              src={localFileUrl}
                              alt={`Preview of ${form.file.name}`}
                            />
                          )}
                          {form.file.type === "application/pdf" && (
                            <iframe
                              title={`Preview of ${form.file.name}`}
                              src={localFileUrl}
                            />
                          )}
                          {form.file.type.startsWith("audio/") && (
                            <audio controls src={localFileUrl}>
                              Your browser does not support audio preview.
                            </audio>
                          )}
                          {form.file.type.startsWith("video/") && (
                            <video controls src={localFileUrl}>
                              Your browser does not support video preview.
                            </video>
                          )}
                        </div>
                      )}
                    </label>
                  ) : (
                    <label className="wide">
                      Resource URL <b>*</b>
                      <input
                        type="url"
                        name="external_url"
                        value={form.external_url}
                        onChange={updateForm}
                        required
                        placeholder="https://…"
                      />
                    </label>
                  )}
                </div>

                <div className="dr-form-actions">
                  <button
                    disabled={saving}
                    className="dr-button dr-button-primary"
                    type="submit"
                  >
                    {saving
                      ? "Saving…"
                      : editingId
                      ? "Save changes"
                      : "Add to Library"}
                  </button>
                  <button
                    className="dr-button dr-button-plain"
                    type="button"
                    onClick={reset}
                  >
                    {editingId ? "Cancel editing" : "Close"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Collection Table */}
          <section id="resources" className="dr-resources">
            <div className="dr-list-heading">
              <div>
                <h2>Resource & Electronic Device Collection</h2>
                <p>
                  Manage review status, preview device hardware & contents, and
                  publish items.
                </p>
              </div>
              <span className="dr-count">
                {visibleResources.length} shown
              </span>
            </div>

            {/* Category Filter Pills */}
            <div className="dr-filter-group">
              <strong>Categories</strong>
              <div
                className="dr-type-categories"
                aria-label="Filter by category"
              >
                <button
                  className={categoryFilter === "all" ? "selected" : ""}
                  onClick={() => setCategoryFilter("all")}
                >
                  All categories <span>{resources.length}</span>
                </button>
                {categories.map((cat) => {
                  const count = resources.filter(
                    (r) =>
                      String(
                        r.category?.id ?? r.category_id ?? r.category ?? ""
                      ) === String(cat.id)
                  ).length;
                  return (
                    <button
                      key={cat.id}
                      className={
                        String(categoryFilter) === String(cat.id)
                          ? "selected"
                          : ""
                      }
                      onClick={() => setCategoryFilter(String(cat.id))}
                    >
                      {cat.name}
                      <span>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Resource Type Filter Pills */}
            <div className="dr-filter-group">
              <strong>Resource Type</strong>
              <div className="dr-type-categories" aria-label="Filter by type">
                <button
                  className={typeFilter === "all" ? "selected" : ""}
                  onClick={() => setTypeFilter("all")}
                >
                  All types <span>{resources.length}</span>
                </button>
                {types.map(([value, label]) => (
                  <button
                    key={value}
                    className={typeFilter === value ? "selected" : ""}
                    onClick={() => setTypeFilter(value)}
                  >
                    {label}
                    <span>{typeCounts[value] || 0}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Search & Status Toolbar */}
            <div className="dr-toolbar">
              <div className="dr-search">
                <span>⌕</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title, device model, keywords, or category…"
                  aria-label="Search resources"
                />
              </div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                {Object.entries(statusText).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            {/* Table */}
            <div className="dr-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>DEVICE / RESOURCE</th>
                    <th>CATEGORY</th>
                    <th>STATUS</th>
                    <th>ACTIVITY</th>
                    <th className="actions-head">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="dr-empty">
                        Loading resources & devices…
                      </td>
                    </tr>
                  ) : visibleResources.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="dr-empty">
                        No resources found. Try another search or add an
                        electronic device or resource above.
                      </td>
                    </tr>
                  ) : (
                    visibleResources.map((r) => {
                      const effectiveType = resolveResourceType(r);
                      const isDevice = effectiveType === "electronic_device";
                      const icon = getResourceIcon(effectiveType);
                      const typeLabel = getResourceTypeLabel(effectiveType);
                      const actionVerb = getResourceActionVerb(effectiveType);
                      const tone = getResourceTone(effectiveType);
                      const thumb = toAbsoluteUrl(
                        r.thumbnail_url ||
                          r.thumbnail ||
                          r.image_url ||
                          r.cover_image_url
                      );

                      return (
                        <tr key={r.id}>
                          <td>
                            <div className="dr-resource">
                              {thumb ? (
                                <div className="dr-resource-thumbwrap">
                                  <img
                                    className="dr-resource-image"
                                    src={thumb}
                                    alt={r.title || "Thumbnail"}
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                  <span
                                    className="dr-resource-thumb-icon"
                                    aria-hidden
                                  >
                                    {icon}
                                  </span>
                                </div>
                              ) : (
                                <span
                                  className={`dr-file-icon tone-${tone}`}
                                  aria-hidden
                                >
                                  {icon}
                                </span>
                              )}
                              <div className="dr-resource-meta">
                                <strong>{r.title}</strong>
                                <small className="dr-resource-type">
                                  <span
                                    className={`dr-type-chip tone-${tone}`}
                                  >
                                    {icon} {typeLabel}
                                  </span>
                                  {isDevice && (
                                    <span className="dr-device-tag">
                                      Hardware
                                    </span>
                                  )}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>{r.category_name || "—"}</td>
                          <td>
                            <span
                              className={`dr-badge ${
                                r.quality_status || "pending"
                              }`}
                            >
                              <i />
                              {statusText[r.quality_status] ||
                                r.quality_status ||
                                "Unknown"}
                            </span>
                          </td>
                          <td>
                            <span className="dr-activity">
                              ↓ {r.downloads_count ?? 0} &nbsp; ◉{" "}
                              {r.views_count ?? 0}
                            </span>
                          </td>
                          <td>
                            <div className="dr-actions">
                              {/* View button */}
                              <button
                                type="button"
                                className="dr-act-btn dr-act-view"
                                title={`${actionVerb} this ${typeLabel.toLowerCase()}`}
                                onClick={() => openResource(r)}
                              >
                                <span className="dr-act-ic">👁</span>
                                <span className="dr-act-tx">{actionVerb}</span>
                              </button>

                              {/* Set as button + dropdown */}
                              <div
                                className="dr-set-as-wrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className={`dr-act-btn dr-act-set ${
                                    openSetAsId === r.id ? "is-open" : ""
                                  }`}
                                  onClick={() =>
                                    setOpenSetAsId(
                                      openSetAsId === r.id ? null : r.id
                                    )
                                  }
                                  title="Change status, visibility, or publish state"
                                >
                                  <span className="dr-act-ic">🏷</span>
                                  <span className="dr-act-tx">Set as</span>
                                  <span className="dr-act-arrow">▾</span>
                                </button>

                                {openSetAsId === r.id && (
                                  <div className="dr-set-as-menu">
                                    <div className="dr-set-as-header">
                                      Change Status
                                    </div>
                                    <button
                                      type="button"
                                      className={`dr-set-as-item ${
                                        r.quality_status === "verified"
                                          ? "active"
                                          : ""
                                      }`}
                                      onClick={() => {
                                        verify(r, "verified");
                                        setOpenSetAsId(null);
                                      }}
                                    >
                                      <span className="dr-item-icon green">
                                        ✓
                                      </span>
                                      <span>Set as Verified</span>
                                    </button>
                                    <button
                                      type="button"
                                      className={`dr-set-as-item ${
                                        r.quality_status === "pending"
                                          ? "active"
                                          : ""
                                      }`}
                                      onClick={() => {
                                        verify(r, "pending");
                                        setOpenSetAsId(null);
                                      }}
                                    >
                                      <span className="dr-item-icon amber">
                                        ⏳
                                      </span>
                                      <span>Set as Pending</span>
                                    </button>
                                    <button
                                      type="button"
                                      className={`dr-set-as-item ${
                                        r.quality_status === "rejected"
                                          ? "active"
                                          : ""
                                      }`}
                                      onClick={() => {
                                        verify(r, "rejected");
                                        setOpenSetAsId(null);
                                      }}
                                    >
                                      <span className="dr-item-icon red">
                                        ✕
                                      </span>
                                      <span>Set as Rejected</span>
                                    </button>
                                    <button
                                      type="button"
                                      className={`dr-set-as-item ${
                                        r.quality_status === "archived"
                                          ? "active"
                                          : ""
                                      }`}
                                      onClick={() => {
                                        verify(r, "archived");
                                        setOpenSetAsId(null);
                                      }}
                                    >
                                      <span className="dr-item-icon grey">
                                        📦
                                      </span>
                                      <span>Set as Archived</span>
                                    </button>

                                    <div className="dr-set-as-divider" />
                                    <div className="dr-set-as-header">
                                      Visibility
                                    </div>
                                    <button
                                      type="button"
                                      className="dr-set-as-item"
                                      onClick={() => {
                                        publish(r);
                                        setOpenSetAsId(null);
                                      }}
                                    >
                                      <span className="dr-item-icon blue">
                                        {r.quality_status === "verified"
                                          ? "○"
                                          : "◉"}
                                      </span>
                                      <span>
                                        {r.quality_status === "verified"
                                          ? "Set as Unpublished"
                                          : "Set as Published"}
                                      </span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              {r.quality_status === "pending" && (
                                <>
                                  <button
                                    type="button"
                                    className="dr-act-btn dr-act-approve"
                                    title="Quick Approve"
                                    onClick={() => verify(r, "verified")}
                                  >
                                    <span className="dr-act-ic">✓</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="dr-act-btn dr-act-reject"
                                    title="Quick Reject"
                                    onClick={() => verify(r, "rejected")}
                                  >
                                    <span className="dr-act-ic">✕</span>
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                className="dr-act-btn dr-act-edit"
                                title="Edit details"
                                onClick={() => edit(r)}
                              >
                                <span className="dr-act-ic">✎</span>
                                <span className="dr-act-tx">Edit</span>
                              </button>

                              <button
                                type="button"
                                className="dr-act-btn dr-act-delete"
                                title="Delete resource"
                                onClick={() => remove(r)}
                              >
                                <span className="dr-act-ic">🗑</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="dr-footer">
            Digital Library & Electronic Equipment Management <span>·</span>{" "}
            Mekdela Amba AI-Based Smart LMS
          </footer>
        </div>
      </section>

      {viewingResource && (
        <ResourceViewer
          resource={viewingResource}
          resources={visibleResources}
          onSelectResource={(r) => setViewingResource(r)}
          open={Boolean(viewingResource)}
          onClose={() => setViewingResource(null)}
        />
      )}
    </main>
  );
}