import React from 'react';

const ResourceViewer = ({ resource, onClose }) => {
  if (!resource) return null;

  const fileUrl = resource.file || '';
  const externalUrl = resource.external_url || '';
  const type = resource.resource_type;
  const sourceType = resource.source_type;

  // Helper: determine what to render
  const renderContent = () => {
    // ===== YouTube =====
    if (type === 'youtube' || sourceType === 'youtube') {
      const ytId = extractYouTubeId(externalUrl);
      if (ytId) {
        return (
          <div className="ratio ratio-16x9">
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
              title={resource.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        );
      }
      return <ExternalLink url={externalUrl} title={resource.title} />;
    }

    // ===== External link =====
    if (sourceType === 'external' || type === 'external_link') {
      return <ExternalLink url={externalUrl} title={resource.title} />;
    }

    // ===== Video file =====
    if (type === 'video') {
      return (
        <video
          controls
          autoPlay
          className="w-100"
          style={{ maxHeight: '75vh', background: '#000' }}
          src={fileUrl}
        >
          Your browser does not support video.
        </video>
      );
    }

    // ===== Audio file =====
    if (type === 'audio') {
      return (
        <div className="text-center py-5">
          <div style={{ fontSize: '5rem' }}>🎵</div>
          <h5 className="mt-3">{resource.title}</h5>
          {resource.duration && (
            <p className="text-muted">Duration: {resource.duration}</p>
          )}
          <audio controls autoPlay className="w-100 mt-3" src={fileUrl}>
            Your browser does not support audio.
          </audio>
        </div>
      );
    }

    // ===== PDF =====
    if (type === 'pdf' || fileUrl.toLowerCase().endsWith('.pdf')) {
      return (
        <iframe
          src={fileUrl}
          title={resource.title}
          className="w-100"
          style={{ height: '80vh', border: 'none' }}
        ></iframe>
      );
    }

    // ===== Image =====
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl)) {
      return (
        <div className="text-center">
          <img
            src={fileUrl}
            alt={resource.title}
            className="img-fluid"
            style={{ maxHeight: '80vh' }}
          />
        </div>
      );
    }

    // ===== Plain text =====
    if (fileUrl.toLowerCase().endsWith('.txt')) {
      return (
        <iframe
          src={fileUrl}
          title={resource.title}
          className="w-100"
          style={{ height: '80vh', border: 'none', background: '#fff' }}
        ></iframe>
      );
    }

    // ===== EPUB =====
    if (fileUrl.toLowerCase().endsWith('.epub')) {
      // Browsers can't render EPUB natively. Offer reader link + download.
      return (
        <div className="text-center py-5">
          <div style={{ fontSize: '5rem' }}>📖</div>
          <h5 className="mt-3">{resource.title}</h5>
          <p className="text-muted">
            EPUB cannot be previewed directly in the browser.
          </p>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary me-2"
          >
            <i className="bi bi-book me-1"></i> Open in EPUB Reader
          </a>
          <a href={fileUrl} download className="btn btn-outline-secondary">
            <i className="bi bi-download me-1"></i> Download
          </a>
        </div>
      );
    }

    // ===== Office files (DOC, PPT, XLS) =====
    if (/\.(doc|docx|ppt|pptx|xls|xlsx)$/i.test(fileUrl)) {
      // Use Microsoft Office Online viewer
      const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
      return (
        <div>
          <iframe
            src={officeUrl}
            title={resource.title}
            className="w-100"
            style={{ height: '80vh', border: 'none' }}
          ></iframe>
          <div className="text-center mt-2 small text-muted">
            If the preview doesn't load,{' '}
            <a href={fileUrl} target="_blank" rel="noopener noreferrer">
              open in a new tab
            </a>{' '}
            or{' '}
            <a href={fileUrl} download>
              download
            </a>
            .
          </div>
        </div>
      );
    }

    // ===== Fallback =====
    return (
      <div className="text-center py-5">
        <div style={{ fontSize: '5rem' }}>📁</div>
        <h5 className="mt-3">{resource.title}</h5>
        <p className="text-muted">Preview not available for this file type.</p>
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
        >
          <i className="bi bi-box-arrow-up-right me-1"></i> Open File
        </a>
      </div>
    );
  };

  return (
    <div
      className="modal show d-block"
      style={{
        backgroundColor: 'rgba(0,0,0,0.85)',
        zIndex: 1060,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-xl modal-dialog-centered" style={{ maxWidth: '95%' }}>
        <div className="modal-content bg-dark text-white">
          <div className="modal-header border-secondary">
            <h5 className="modal-title text-truncate">
              {resource.title}
            </h5>
            <div className="d-flex gap-2">
              <a
                href={fileUrl || externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-outline-light"
                title="Open in new tab"
              >
                <i className="bi bi-box-arrow-up-right"></i>
              </a>
              {fileUrl && (
                <a
                  href={fileUrl}
                  download
                  className="btn btn-sm btn-outline-light"
                  title="Download"
                >
                  <i className="bi bi-download"></i>
                </a>
              )}
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
              ></button>
            </div>
          </div>
          <div className="modal-body p-0" style={{ background: '#111' }}>
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== Helpers =====

function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function ExternalLink({ url, title }) {
  return (
    <div className="text-center py-5">
      <div style={{ fontSize: '5rem' }}>🔗</div>
      <h5 className="mt-3 text-white">{title}</h5>
      <p className="text-muted">External resource</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary btn-lg"
      >
        <i className="bi bi-box-arrow-up-right me-2"></i>
        Open External Link
      </a>
      <p className="text-muted small mt-3 text-break">{url}</p>
    </div>
  );
}

export default ResourceViewer;