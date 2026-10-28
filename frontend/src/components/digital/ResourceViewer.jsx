import React, { useEffect, useRef, useState, useMemo } from "react";
import digitalService, { toAbsoluteUrl } from "../../services/digitalService";
import "./ResourceViewer.css";

function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return "00:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0) {
    return `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function getResourceUrl(resource) {
  const raw =
    resource?.file_url ||
    resource?.file ||
    resource?.display_url ||
    resource?.external_url ||
    "";
  return toAbsoluteUrl(raw);
}

function getThumbnailUrl(resource) {
  const raw =
    resource?.thumbnail_url ||
    resource?.thumbnail ||
    resource?.image_url ||
    resource?.cover_image_url ||
    "";
  return toAbsoluteUrl(raw);
}

function getResourceType(resource) {
  const type = String(
    resource?.resource_type || resource?.file_type || ""
  ).toLowerCase();

  if (type === "electronic_device" || type === "device" || type === "hardware") {
    return "electronic_device";
  }

  const url = getResourceUrl(resource).toLowerCase();
  const rawFile = String(resource?.file || "").toLowerCase();

  if (
    type.includes("youtube") ||
    url.includes("youtube.com") ||
    url.includes("youtu.be")
  ) {
    return "youtube";
  }

  // Detect PDFs from resource_type, stream URL, or the raw file path
  if (
    type.includes("pdf") ||
    /\.pdf(\?|#|$)/i.test(url) ||
    /\.pdf/i.test(rawFile)
  ) {
    return "pdf";
  }

  if (type.includes("video") || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) {
    return "video";
  }

  if (type.includes("audio") || /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(url)) {
    return "audio";
  }

  if (type.includes("image") || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url)) {
    return "image";
  }

  if (
    type.includes("text") ||
    url.endsWith(".txt") ||
    url.endsWith(".md") ||
    url.endsWith(".py") ||
    url.endsWith(".json")
  ) {
    return "text";
  }

  if (/^https?:\/\//i.test(url)) {
    return "external";
  }

  return "other";
}

function getYouTubeEmbedUrl(url) {
  try {
    const parsed = new URL(url);
    let videoId = "";
    if (parsed.hostname.includes("youtu.be")) {
      videoId = parsed.pathname.slice(1);
    } else if (parsed.hostname.includes("youtube.com")) {
      videoId =
        parsed.searchParams.get("v") ||
        parsed.pathname.split("/embed/")[1]?.split("/")[0] ||
        parsed.pathname.split("/shorts/")[1]?.split("/")[0] ||
        "";
    }
    return videoId
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=0`
      : "";
  } catch {
    return "";
  }
}

/* =========================================================================
   ATTRACTIVE PDF VIEWER (blob-based, no iframe transforms)
   ========================================================================= */
function AttractivePdfViewer({
  url,
  downloadUrl,
  title,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}) {
  const [zoom, setZoom] = useState(100);

  const zoomIn = () => setZoom((z) => Math.min(z + 15, 200));
  const zoomOut = () => setZoom((z) => Math.max(z - 15, 60));
  const resetZoom = () => setZoom(100);

  const frameSrc = `${url}#toolbar=1&navpanes=1&zoom=${zoom}`;

  return (
    <div className="rv-pdf-container">
      {/* Top Toolbar */}
      <div className="rv-pdf-toolbar">
        {/* Navigation if available */}
        <div className="rv-pdf-tools-group">
          {onPrevious && (
            <button
              type="button"
              className="rv-btn"
              disabled={!hasPrevious}
              onClick={onPrevious}
              title="Previous document in library (or [)"
            >
              ⏮ Prev Doc
            </button>
          )}
          {onNext && (
            <button
              type="button"
              className="rv-btn"
              disabled={!hasNext}
              onClick={onNext}
              title="Next document in library (or ])"
            >
              Next Doc ⏭
            </button>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="rv-pdf-tools-group">
          <button
            type="button"
            className="rv-btn rv-btn-icon"
            onClick={zoomOut}
            title="Zoom Out"
          >
            −
          </button>
          <span className="rv-pdf-zoom-val">{zoom}%</span>
          <button
            type="button"
            className="rv-btn rv-btn-icon"
            onClick={zoomIn}
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            className="rv-btn"
            onClick={resetZoom}
            title="Reset zoom"
          >
            ⟲ Reset
          </button>
        </div>

        {/* Action Controls — use the backend URL for download/pop-out */}
        <div className="rv-pdf-tools-group">
          <a
            href={downloadUrl || url}
            download
            className="rv-btn rv-btn-primary"
            title="Download PDF to computer"
          >
            ⇩ Download
          </a>
          <a
            href={downloadUrl || url}
            target="_blank"
            rel="noopener noreferrer"
            className="rv-btn"
            title="Open in a dedicated browser tab"
          >
            ↗ Pop-out
          </a>
        </div>
      </div>

      {/* Frame Container — no CSS transform, it breaks Chromium PDF iframes */}
      <div className="rv-pdf-frame-wrap">
        <iframe
          title={title || "PDF Document"}
          src={frameSrc}
          className="rv-pdf-frame"
          style={{ width: "100%", height: "100%", border: 0 }}
        />
      </div>
    </div>
  );
}

/* =========================================================================
   ATTRACTIVE VIDEO PLAYER
   ========================================================================= */
function AttractiveVideoPlayer({
  url,
  title,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
    } else {
      v.pause();
    }
  };

  const stop = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const seek = (time) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(time, v.duration || 0));
    v.currentTime = clamped;
    setCurrentTime(clamped);
  };

  const skip = (delta) => {
    const v = videoRef.current;
    if (!v) return;
    seek(v.currentTime + delta);
  };

  const handlePreviousAction = () => {
    if (hasPrevious && onPrevious) {
      onPrevious();
    } else {
      seek(0);
    }
  };

  const handleNextAction = () => {
    if (hasNext && onNext) {
      onNext();
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  const handleVolumeChange = (e) => {
    const v = videoRef.current;
    if (!v) return;
    const val = parseFloat(e.target.value);
    v.volume = val;
    setVolume(val);
    v.muted = val === 0;
    setIsMuted(val === 0);
  };

  const handleSpeedChange = (e) => {
    const rate = parseFloat(e.target.value);
    const v = videoRef.current;
    if (v) v.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current?.requestPictureInPicture) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("PiP error:", err);
    }
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  };

  const handleScrubberClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width)
    );
    seek(ratio * duration);
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.buffered.length > 0) {
      setBuffered(v.buffered.end(v.buffered.length - 1));
    }
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPercent = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="rv-video-wrap"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={url}
        className="rv-video-element"
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (videoRef.current) setDuration(videoRef.current.duration || 0);
        }}
      />

      {!isPlaying && (
        <div className="rv-video-overlay-play" onClick={togglePlay}>
          <div className="rv-video-play-bubble" title="Play Video">
            ▶
          </div>
        </div>
      )}

      <div
        className={`rv-video-controls ${
          !showControls && isPlaying ? "rv-hidden" : ""
        }`}
      >
        <div className="rv-scrubber-wrap" onClick={handleScrubberClick}>
          <div className="rv-scrubber-track">
            <div
              className="rv-scrubber-buffer"
              style={{ width: `${bufferPercent}%` }}
            />
            <div
              className="rv-scrubber-progress"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="rv-scrubber-thumb"
              style={{ left: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="rv-deck-row">
          <div className="rv-deck-left">
            <button
              type="button"
              className="rv-deck-btn"
              onClick={handlePreviousAction}
              disabled={!hasPrevious && currentTime === 0}
              title={hasPrevious ? "Previous Video [ " : "Jump to Beginning"}
            >
              ⏮
            </button>
            <button
              type="button"
              className="rv-deck-btn"
              onClick={() => skip(-10)}
              title="Rewind 10s (←)"
            >
              ⏪
            </button>
            <button
              type="button"
              className="rv-deck-btn primary"
              onClick={togglePlay}
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button
              type="button"
              className="rv-deck-btn stop"
              onClick={stop}
              title="Stop Playback (resets to 0:00)"
            >
              ⏹
            </button>
            <button
              type="button"
              className="rv-deck-btn"
              onClick={() => skip(10)}
              title="Forward 10s (→)"
            >
              ⏩
            </button>
            <button
              type="button"
              className="rv-deck-btn"
              onClick={handleNextAction}
              disabled={!hasNext}
              title={hasNext ? "Next Video ]" : "End of Playlist"}
            >
              ⏭
            </button>
            <span className="rv-time-readout">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="rv-deck-right">
            <div className="rv-volume-group">
              <button
                type="button"
                className="rv-deck-btn"
                onClick={toggleMute}
                title={isMuted ? "Unmute (M)" : "Mute (M)"}
              >
                {isMuted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
              </button>
              <input
                type="range"
                className="rv-slider"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                style={{ width: "70px" }}
              />
            </div>

            <select
              className="rv-speed-select"
              value={playbackRate}
              onChange={handleSpeedChange}
              title="Playback Speed"
            >
              <option value="0.5">0.5×</option>
              <option value="0.75">0.75×</option>
              <option value="1">1.0×</option>
              <option value="1.25">1.25×</option>
              <option value="1.5">1.5×</option>
              <option value="2">2.0×</option>
            </select>

            <button
              type="button"
              className="rv-deck-btn"
              onClick={togglePiP}
              title="Picture-in-Picture"
            >
              🗗
            </button>
            <button
              type="button"
              className="rv-deck-btn"
              onClick={toggleFullscreen}
              title="Toggle Fullscreen (F)"
            >
              {isFullscreen ? "🗗" : "⛶"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   ATTRACTIVE AUDIO PLAYER
   ========================================================================= */
function AttractiveAudioPlayer({
  url,
  title,
  categoryName,
  durationHint,
  thumbnailUrl,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}) {
  const audioRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play();
    } else {
      a.pause();
    }
  };

  const stop = () => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const seek = (time) => {
    const a = audioRef.current;
    if (!a) return;
    const clamped = Math.max(0, Math.min(time, a.duration || 0));
    a.currentTime = clamped;
    setCurrentTime(clamped);
  };

  const skip = (delta) => {
    const a = audioRef.current;
    if (!a) return;
    seek(a.currentTime + delta);
  };

  const handlePreviousAction = () => {
    if (hasPrevious && onPrevious) {
      onPrevious();
    } else {
      seek(0);
    }
  };

  const handleNextAction = () => {
    if (hasNext && onNext) {
      onNext();
    }
  };

  const toggleMute = () => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = !a.muted;
    setIsMuted(a.muted);
  };

  const handleVolumeChange = (e) => {
    const a = audioRef.current;
    if (!a) return;
    const val = parseFloat(e.target.value);
    a.volume = val;
    setVolume(val);
    a.muted = val === 0;
    setIsMuted(val === 0);
  };

  const changeSpeed = (rate) => {
    const a = audioRef.current;
    if (a) a.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const toggleLoop = () => {
    const a = audioRef.current;
    if (!a) return;
    a.loop = !a.loop;
    setIsLooping(a.loop);
  };

  const handleScrubberClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width)
    );
    seek(ratio * duration);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="rv-audio-stage">
      <div className="rv-audio-ambient-glow" />

      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          if (!isLooping) {
            setIsPlaying(false);
            if (hasNext && onNext) onNext();
          }
        }}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration || 0);
        }}
      />

      <div className="rv-audio-card">
        <div className="rv-audio-header">
          <div className={`rv-audio-disc-wrap ${isPlaying ? "playing" : ""}`}>
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={title || "Album Art"}
                className="rv-audio-disc-img"
              />
            ) : (
              <span className="rv-audio-disc-icon">🎵</span>
            )}
          </div>

          <div className="rv-audio-meta">
            <h3 className="rv-audio-title">{title || "Audio Track"}</h3>
            <div className="rv-audio-sub">
              <span>{categoryName || "Digital Audio Library"}</span>
              {durationHint && <span>• ⏱ {durationHint}</span>}
            </div>
          </div>

          <div className={`rv-audio-eq ${isPlaying ? "playing" : ""}`}>
            <span className="rv-eq-bar" />
            <span className="rv-eq-bar" />
            <span className="rv-eq-bar" />
            <span className="rv-eq-bar" />
            <span className="rv-eq-bar" />
          </div>
        </div>

        <div>
          <div className="rv-scrubber-wrap" onClick={handleScrubberClick}>
            <div className="rv-scrubber-track">
              <div
                className="rv-scrubber-progress"
                style={{ width: `${progressPercent}%` }}
              />
              <div
                className="rv-scrubber-thumb"
                style={{ left: `${progressPercent}%` }}
              />
            </div>
          </div>
          <div className="rv-audio-time-row">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="rv-audio-controls-row">
          <button
            type="button"
            className="rv-audio-btn"
            onClick={handlePreviousAction}
            disabled={!hasPrevious && currentTime === 0}
            title={hasPrevious ? "Previous Audio [ " : "Jump to Start"}
          >
            ⏮
          </button>
          <button
            type="button"
            className="rv-audio-btn"
            onClick={() => skip(-10)}
            title="Rewind 10s (←)"
          >
            ⏪
          </button>
          <button
            type="button"
            className="rv-audio-btn play-pause"
            onClick={togglePlay}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            className="rv-audio-btn stop"
            onClick={stop}
            title="Stop Playback (resets to 0:00)"
          >
            ⏹
          </button>
          <button
            type="button"
            className="rv-audio-btn"
            onClick={() => skip(10)}
            title="Forward 10s (→)"
          >
            ⏩
          </button>
          <button
            type="button"
            className="rv-audio-btn"
            onClick={handleNextAction}
            disabled={!hasNext}
            title={hasNext ? "Next Audio ]" : "End of Playlist"}
          >
            ⏭
          </button>
        </div>

        <div className="rv-audio-subcontrols">
          <div className="rv-speed-pills">
            {[0.75, 1.0, 1.25, 1.5].map((rate) => (
              <button
                key={rate}
                type="button"
                className={`rv-speed-pill ${
                  playbackRate === rate ? "active" : ""
                }`}
                onClick={() => changeSpeed(rate)}
              >
                {rate}×
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`rv-btn ${isLooping ? "rv-btn-primary" : ""}`}
            style={{ padding: "4px 10px", fontSize: "11px" }}
            onClick={toggleLoop}
            title="Repeat track"
          >
            🔁 {isLooping ? "Repeat On" : "Repeat Off"}
          </button>

          <div className="rv-volume-group">
            <button
              type="button"
              className="rv-deck-btn"
              onClick={toggleMute}
              title={isMuted ? "Unmute" : "Mute"}
              style={{ width: "28px", height: "28px", fontSize: "13px" }}
            >
              {isMuted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
            </button>
            <input
              type="range"
              className="rv-slider"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              style={{ width: "65px" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   MAIN RESOURCE VIEWER MODAL
   ========================================================================= */
export default function ResourceViewer({
  resource,
  resources = [],
  onSelectResource,
  open = true,
  onClose,
  onDownload,
}) {
  const [textContent, setTextContent] = useState("");
  const [textError, setTextError] = useState("");
  const [loadingText, setLoadingText] = useState(false);
  const [activeTab, setActiveTab] = useState("content");
  const [isModalFullscreen, setIsModalFullscreen] = useState(false);
  const [showPlaylistDrawer, setShowPlaylistDrawer] = useState(false);
  const [showSetAsMenu, setShowSetAsMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [notice, setNotice] = useState("");

  // PDF blob state
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const [isFavorite, setIsFavorite] = useState(() => {
    try {
      const favs = JSON.parse(localStorage.getItem("library_favorites") || "[]");
      return favs.includes(resource?.id);
    } catch {
      return false;
    }
  });

  const handleSetStatus = async (statusVal) => {
    try {
      await digitalService.verifyResource(resource.id, statusVal);
      resource.quality_status = statusVal;
      setShowSetAsMenu(false);
      setNotice(`Resource successfully set as ${statusVal}! ✓`);
      setTimeout(() => setNotice(""), 3500);
    } catch (err) {
      console.error("Failed to set status:", err);
      setNotice("Failed to update status.");
      setTimeout(() => setNotice(""), 3500);
    }
  };

  const handleSetFeatured = async () => {
    try {
      const currentKeywords = resource.keywords || "";
      const isFeat = currentKeywords.toLowerCase().includes("featured");
      const newKeywords = isFeat
        ? currentKeywords.replace(/featured,?/i, "").trim()
        : `${currentKeywords ? currentKeywords + ", " : ""}featured`;
      await digitalService.updateResource(resource.id, { keywords: newKeywords });
      resource.keywords = newKeywords;
      setShowSetAsMenu(false);
      setNotice(
        isFeat
          ? "Removed from featured collection."
          : "Resource set as Featured! ⭐"
      );
      setTimeout(() => setNotice(""), 3500);
    } catch (err) {
      console.error("Failed to set featured:", err);
    }
  };

  const handleToggleFavorite = () => {
    try {
      const favs = JSON.parse(localStorage.getItem("library_favorites") || "[]");
      const exists = favs.includes(resource.id);
      const updated = exists
        ? favs.filter((id) => id !== resource.id)
        : [...favs, resource.id];
      localStorage.setItem("library_favorites", JSON.stringify(updated));
      setIsFavorite(!exists);
      setShowSetAsMenu(false);
      setNotice(!exists ? "Saved as Favorite! ❤️" : "Removed from favorites.");
      setTimeout(() => setNotice(""), 3500);
    } catch (err) {
      console.error("Favorite toggle failed:", err);
    }
  };

  const handleSetAccess = async (accessVal) => {
    try {
      await digitalService.updateResource(resource.id, { access_level: accessVal });
      resource.access_level = accessVal;
      setShowSetAsMenu(false);
      setNotice(`Access level set as ${accessVal}.`);
      setTimeout(() => setNotice(""), 3500);
    } catch (err) {
      console.error("Failed to update access:", err);
    }
  };

  const rawUrl = getResourceUrl(resource);
  const type = getResourceType(resource);
  const thumbUrl = getThumbnailUrl(resource);

  // Backend stream URL (used for pop-out / download)
  const streamUrl = resource?.id
    ? toAbsoluteUrl(`/api/digital/resources/${resource.id}/view/`)
    : rawUrl;

  // For non-PDF types we can stream directly; PDFs are fetched as blobs below
  const contentUrl =
    type === "video" || type === "audio" || type === "image"
      ? streamUrl || rawUrl
      : rawUrl;

  // ---- PDF blob loader ----
  useEffect(() => {
    let revoked = false;
    let objectUrl = "";

    async function loadPdfBlob() {
      if (type !== "pdf" || !resource?.id) {
        setPdfBlobUrl("");
        setPdfError("");
        setPdfLoading(false);
        return;
      }

      setPdfLoading(true);
      setPdfError("");
      setPdfBlobUrl("");

      try {
        const res = await digitalService.downloadResource(resource.id);
        const blob = new Blob([res.data], { type: "application/pdf" });
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(objectUrl);
      } catch (err) {
        console.error("PDF load failed:", err);
        if (!revoked) {
          setPdfError(
            "Could not load the PDF inline. Use the Download or Pop-out button."
          );
        }
      } finally {
        if (!revoked) setPdfLoading(false);
      }
    }

    loadPdfBlob();

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [type, resource?.id]);

  // Playlist index calculations
  const currentIndex = useMemo(() => {
    if (!resources || resources.length === 0 || !resource) return -1;
    return resources.findIndex((r) => r.id === resource.id);
  }, [resources, resource]);

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < resources.length - 1;

  const goToPrevious = () => {
    if (hasPrevious && onSelectResource) {
      onSelectResource(resources[currentIndex - 1]);
    }
  };

  const goToNext = () => {
    if (hasNext && onSelectResource) {
      onSelectResource(resources[currentIndex + 1]);
    }
  };

  // Text content loader
  useEffect(() => {
    let cancelled = false;

    async function loadText() {
      if (type !== "text" || !contentUrl) {
        setTextContent("");
        setTextError("");
        return;
      }

      setLoadingText(true);
      setTextError("");

      try {
        const response = await fetch(contentUrl);
        if (!response.ok) {
          throw new Error("Unable to load the text resource.");
        }
        const content = await response.text();
        if (!cancelled) {
          setTextContent(content);
        }
      } catch {
        if (!cancelled) {
          setTextError(
            "Could not load text file inline. You can download the file to inspect it."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingText(false);
        }
      }
    }

    loadText();
    return () => {
      cancelled = true;
    };
  }, [type, contentUrl]);

  // Global Keyboard Navigation
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event) {
      if (
        event.target.tagName === "INPUT" ||
        event.target.tagName === "TEXTAREA" ||
        event.target.tagName === "SELECT"
      ) {
        return;
      }

      if (event.key === "Escape") {
        onClose?.();
      } else if (event.key === "[") {
        goToPrevious();
      } else if (event.key === "]") {
        goToNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, hasPrevious, hasNext, currentIndex, resources]);

  if (!open || !resource) return null;

  const youtubeUrl = type === "youtube" ? getYouTubeEmbedUrl(rawUrl) : "";

  // Content Renderer for Media / Attached Files
  function renderContentByType(mediaUrl, mediaType) {
    if (!mediaUrl && mediaType !== "pdf") {
      return (
        <div
          style={{ padding: "60px 20px", textAlign: "center", color: "#64748b" }}
        >
          <div style={{ fontSize: "52px", marginBottom: "14px" }}>📁</div>
          <h4 style={{ color: "#e2e8f0" }}>No File Attached</h4>
          <p style={{ color: "#94a3b8" }}>
            This resource does not have an attached preview file or link.
          </p>
        </div>
      );
    }

    switch (mediaType) {
      case "pdf":
        if (pdfLoading) {
          return (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                color: "#94a3b8",
              }}
            >
              Loading PDF…
            </div>
          );
        }
        if (pdfError || !pdfBlobUrl) {
          return (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <div style={{ fontSize: "52px", marginBottom: "14px" }}>📄</div>
              <h4 style={{ color: "#e2e8f0" }}>PDF preview unavailable</h4>
              <p style={{ color: "#94a3b8" }}>{pdfError}</p>
              {streamUrl && (
                <a
                  href={streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rv-btn rv-btn-primary"
                  style={{ marginTop: "12px", display: "inline-block" }}
                >
                  Open PDF in new tab ↗
                </a>
              )}
            </div>
          );
        }
        return (
          <AttractivePdfViewer
            url={pdfBlobUrl}
            downloadUrl={streamUrl}
            title={resource.title}
            onPrevious={hasPrevious ? goToPrevious : null}
            onNext={hasNext ? goToNext : null}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
          />
        );

      case "video":
        return (
          <AttractiveVideoPlayer
            url={mediaUrl}
            title={resource.title}
            onPrevious={hasPrevious ? goToPrevious : null}
            onNext={hasNext ? goToNext : null}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
          />
        );

      case "audio":
        return (
          <AttractiveAudioPlayer
            url={mediaUrl}
            title={resource.title}
            categoryName={resource.category_name}
            durationHint={resource.duration}
            thumbnailUrl={thumbUrl}
            onPrevious={hasPrevious ? goToPrevious : null}
            onNext={hasNext ? goToNext : null}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
          />
        );

      case "youtube":
        return (
          <div
            style={{
              height: "100%",
              background: "#0b1120",
              display: "grid",
              placeItems: "center",
            }}
          >
            {youtubeUrl ? (
              <iframe
                title={resource.title || "YouTube video"}
                src={youtubeUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                style={{ width: "100%", height: "100%", border: 0 }}
              />
            ) : (
              <div style={{ padding: "40px", textAlign: "center", color: "#f87171" }}>
                <p>Invalid YouTube URL: {mediaUrl}</p>
              </div>
            )}
          </div>
        );

      case "image":
        return (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "auto",
              background: "#020617",
              padding: "20px",
            }}
          >
            <img
              src={mediaUrl}
              alt={resource.title || "Resource Image"}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                borderRadius: "8px",
                boxShadow: "0 10px 40px rgba(0, 0, 0, 0.7)",
              }}
            />
          </div>
        );

      case "text":
        if (loadingText) {
          return (
            <div style={{ padding: "50px", textAlign: "center", color: "#94a3b8" }}>
              Loading text content…
            </div>
          );
        }
        if (textError) {
          return (
            <div style={{ padding: "50px", color: "#f87171", textAlign: "center" }}>
              {textError}
            </div>
          );
        }
        return (
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflow: "auto",
              padding: "28px",
              margin: 0,
              fontFamily:
                "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: "13px",
              lineHeight: 1.6,
              background: "#090d16",
              color: "#e2e8f0",
              height: "100%",
            }}
          >
            {textContent}
          </pre>
        );

      case "external":
        return (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              maxWidth: "600px",
              margin: "0 auto",
            }}
          >
            <div style={{ fontSize: "56px", marginBottom: "16px" }}>🔗</div>
            <h3 style={{ color: "#ffffff", marginBottom: "10px" }}>
              External Learning Resource
            </h3>
            <p style={{ color: "#94a3b8", marginBottom: "24px" }}>
              This resource is hosted externally at:
              <br />
              <strong style={{ wordBreak: "break-all", color: "#60a5fa" }}>
                {mediaUrl}
              </strong>
            </p>
            <a
              href={mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rv-btn rv-btn-primary"
              style={{ padding: "12px 28px", fontSize: "14px" }}
            >
              Open External Resource ↗
            </a>
          </div>
        );

      default:
        return (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              maxWidth: "580px",
              margin: "0 auto",
            }}
          >
            <div style={{ fontSize: "56px", marginBottom: "16px" }}>📄</div>
            <h3 style={{ color: "#ffffff", marginBottom: "10px" }}>
              Downloadable File
            </h3>
            <p style={{ color: "#94a3b8", marginBottom: "24px" }}>
              This file ({mediaUrl.split("/").pop() || "resource"}) can be
              downloaded to your computer and viewed with its appropriate
              program.
            </p>
            <a
              href={mediaUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="rv-btn rv-btn-primary"
              style={{ padding: "12px 28px", fontSize: "14px" }}
            >
              Download File ⇩
            </a>
          </div>
        );
    }
  }

  // Electronic Device Mode
  function renderElectronicDevice() {
    const hasAttachedFile = Boolean(rawUrl);
    const attachedExt = rawUrl
      ? rawUrl.split(".").pop().toLowerCase().split("?")[0]
      : "";
    let attachedType = "other";
    if (attachedExt === "pdf") attachedType = "pdf";
    else if (["mp4", "webm", "ogg", "mov"].includes(attachedExt))
      attachedType = "video";
    else if (["mp3", "wav", "m4a", "aac"].includes(attachedExt))
      attachedType = "audio";
    else if (["png", "jpg", "jpeg", "webp", "svg"].includes(attachedExt))
      attachedType = "image";
    else if (["txt", "md", "json", "py"].includes(attachedExt))
      attachedType = "text";
    else if (
      rawUrl.startsWith("http") &&
      !rawUrl.includes(window.location.hostname)
    )
      attachedType = "external";

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: "#162238",
            padding: "10px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                background: "#0284c7",
                color: "#ffffff",
                padding: "3px 10px",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.5px",
              }}
            >
              🔌 ELECTRONIC DEVICE & EQUIPMENT
            </span>
            <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>
              {resource.category_name || "Hardware Lab"}
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className={`rv-btn ${activeTab === "content" ? "rv-btn-primary" : ""}`}
              onClick={() => setActiveTab("content")}
            >
              📖 Device Manual & Contents
            </button>
            <button
              type="button"
              className={`rv-btn ${activeTab === "details" ? "rv-btn-primary" : ""}`}
              onClick={() => setActiveTab("details")}
            >
              🔎 Hardware Specifications
            </button>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div
            style={{
              width: "320px",
              borderRight: "1px solid rgba(255, 255, 255, 0.08)",
              background: "#0b1222",
              padding: "20px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div
              style={{
                borderRadius: "10px",
                overflow: "hidden",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: "#020617",
                minHeight: "180px",
                display: "grid",
                placeItems: "center",
              }}
            >
              {thumbUrl ? (
                <img
                  src={thumbUrl}
                  alt={resource.title || "Electronic Device"}
                  style={{
                    width: "100%",
                    maxHeight: "220px",
                    objectFit: "contain",
                    display: "block",
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
                  <div style={{ fontSize: "52px" }}>🔌</div>
                  <div style={{ fontSize: "11px", marginTop: "6px" }}>
                    No photo uploaded
                  </div>
                </div>
              )}
            </div>

            <div>
              <h3
                style={{
                  margin: "0 0 6px",
                  fontSize: "16px",
                  color: "#ffffff",
                  fontWeight: 700,
                }}
              >
                {resource.title}
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8", lineHeight: 1.5 }}>
                {resource.description || "No description provided for this device."}
              </p>
            </div>

            <div
              style={{
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                paddingTop: "12px",
                display: "grid",
                gap: "8px",
                fontSize: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Status:</span>
                <span
                  style={{
                    fontWeight: 600,
                    color:
                      resource.quality_status === "verified"
                        ? "#4ade80"
                        : "#facc15",
                  }}
                >
                  {resource.quality_status === "verified"
                    ? "✓ Verified"
                    : "⏳ Pending review"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Access:</span>
                <span style={{ fontWeight: 600, color: "#cbd5e1" }}>
                  {resource.access_level || "Public"}
                </span>
              </div>
              {resource.duration && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Model/Specs:</span>
                  <span style={{ fontWeight: 600, color: "#cbd5e1" }}>
                    {resource.duration}
                  </span>
                </div>
              )}
              {resource.keywords && (
                <div>
                  <span style={{ color: "#64748b", display: "block", marginBottom: "4px" }}>
                    Tags:
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {resource.keywords.split(",").map((kw, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: "rgba(255, 255, 255, 0.08)",
                          color: "#cbd5e1",
                          padding: "2px 7px",
                          borderRadius: "4px",
                          fontSize: "10px",
                        }}
                      >
                        {kw.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {hasAttachedFile && (
              <div
                style={{
                  marginTop: "auto",
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  paddingTop: "14px",
                }}
              >
                <a
                  href={streamUrl || contentUrl}
                  download
                  className="rv-btn rv-btn-primary"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Download Attached Manual ⇩
                </a>
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflow: "hidden", background: "#0f172a" }}>
            {activeTab === "content" ? (
              hasAttachedFile ? (
                renderContentByType(contentUrl, attachedType)
              ) : (
                <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748b" }}>
                  <div style={{ fontSize: "56px", marginBottom: "16px" }}>🔌</div>
                  <h4 style={{ color: "#ffffff" }}>Electronic Device Profile</h4>
                  <p
                    style={{
                      maxWidth: "450px",
                      margin: "8px auto 20px",
                      fontSize: "14px",
                      color: "#94a3b8",
                    }}
                  >
                    This electronic device is registered in the digital library
                    collection. Its hardware photo and details are shown on the
                    left panel.
                  </p>
                </div>
              )
            ) : (
              <div
                style={{
                  padding: "30px",
                  maxWidth: "750px",
                  overflowY: "auto",
                  height: "100%",
                }}
              >
                <h3 style={{ margin: "0 0 16px", color: "#ffffff" }}>
                  Hardware Specifications & Metadata
                </h3>
                <table
                  style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}
                >
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <td style={{ padding: "12px 0", color: "#64748b", width: "160px" }}>
                        Device Name
                      </td>
                      <td style={{ padding: "12px 0", fontWeight: 600, color: "#ffffff" }}>
                        {resource.title}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <td style={{ padding: "12px 0", color: "#64748b" }}>Category</td>
                      <td style={{ padding: "12px 0", color: "#e2e8f0" }}>
                        {resource.category_name || "Electronics"}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <td style={{ padding: "12px 0", color: "#64748b" }}>Description</td>
                      <td
                        style={{
                          padding: "12px 0",
                          color: "#e2e8f0",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {resource.description || "No full description available."}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <td style={{ padding: "12px 0", color: "#64748b" }}>Hardware Photo</td>
                      <td style={{ padding: "12px 0" }}>
                        {thumbUrl ? (
                          <a
                            href={thumbUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#60a5fa" }}
                          >
                            Open high-res photo ↗
                          </a>
                        ) : (
                          "None"
                        )}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <td style={{ padding: "12px 0", color: "#64748b" }}>
                        Documentation File
                      </td>
                      <td style={{ padding: "12px 0" }}>
                        {rawUrl ? (
                          <a
                            href={rawUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#60a5fa" }}
                          >
                            {rawUrl.split("/").pop()} ↗
                          </a>
                        ) : (
                          "None"
                        )}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <td style={{ padding: "12px 0", color: "#64748b" }}>Usage Count</td>
                      <td style={{ padding: "12px 0", color: "#e2e8f0" }}>
                        Views: {resource.views_count || 0} · Downloads:{" "}
                        {resource.downloads_count || 0}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rv-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={resource.title || "Digital Resource Viewer"}
        className={`rv-modal ${isModalFullscreen ? "rv-fullscreen" : ""}`}
      >
        <header className="rv-header">
          <div className="rv-header-left">
            {thumbUrl && (
              <img
                src={thumbUrl}
                alt=""
                className="rv-header-thumb"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <div className="rv-header-info">
              <h2 className="rv-header-title">
                {resource.title || "Digital Resource"}
              </h2>
              <div className="rv-header-meta">
                <span className="rv-badge-type">
                  {type === "electronic_device"
                    ? "🔌 Electronic Device"
                    : type === "pdf"
                    ? "📄 PDF Document"
                    : type === "video"
                    ? "🎥 Video"
                    : type === "audio"
                    ? "🎵 Audio Track"
                    : type === "youtube"
                    ? "▶ YouTube"
                    : "📁 Digital Resource"}
                </span>
                <span>{resource.category_name || "General"}</span>
              </div>
            </div>
          </div>

          <div className="rv-header-actions">
            {resources && resources.length > 1 && (
              <div className="rv-nav-pills">
                <button
                  type="button"
                  className="rv-deck-btn"
                  onClick={goToPrevious}
                  disabled={!hasPrevious}
                  title="Previous Item in Library ([)"
                >
                  ⏮
                </button>
                <span className="rv-nav-pos">
                  {currentIndex + 1} / {resources.length}
                </span>
                <button
                  type="button"
                  className="rv-deck-btn"
                  onClick={goToNext}
                  disabled={!hasNext}
                  title="Next Item in Library (])"
                >
                  ⏭
                </button>
                <button
                  type="button"
                  className={`rv-btn ${showPlaylistDrawer ? "rv-btn-primary" : ""}`}
                  style={{ padding: "4px 8px", fontSize: "11px", marginLeft: "4px" }}
                  onClick={() => setShowPlaylistDrawer((v) => !v)}
                  title="Open Playlist Drawer"
                >
                  ☰ Collection ({resources.length})
                </button>
              </div>
            )}

            <div className="rv-dropdown-wrap">
              <button
                type="button"
                className={`rv-btn ${showSetAsMenu ? "rv-btn-primary" : ""}`}
                style={{
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  color: "#ffffff",
                  border: "1px solid rgba(255,255,255,0.2)",
                  boxShadow: "0 2px 8px rgba(99, 102, 241, 0.35)",
                }}
                onClick={() => {
                  setShowSetAsMenu((v) => !v);
                  setShowSettingsMenu(false);
                }}
                title="Set resource status, featured spotlight, access level, or favorite"
              >
                🏷 Set as ▾
              </button>

              {showSetAsMenu && (
                <div className="rv-dropdown-menu">
                  <div className="rv-dropdown-label">Change Quality Status</div>
                  <button
                    type="button"
                    className={`rv-dropdown-item ${
                      resource.quality_status === "verified" ? "active" : ""
                    }`}
                    onClick={() => handleSetStatus("verified")}
                  >
                    <span className="rv-dropdown-item-icon">✓</span>
                    <span>Set as Verified</span>
                  </button>
                  <button
                    type="button"
                    className={`rv-dropdown-item ${
                      resource.quality_status === "pending" ? "active" : ""
                    }`}
                    onClick={() => handleSetStatus("pending")}
                  >
                    <span className="rv-dropdown-item-icon">⏳</span>
                    <span>Set as Pending Review</span>
                  </button>
                  <button
                    type="button"
                    className={`rv-dropdown-item ${
                      resource.quality_status === "rejected" ? "active" : ""
                    }`}
                    onClick={() => handleSetStatus("rejected")}
                  >
                    <span className="rv-dropdown-item-icon">✕</span>
                    <span>Set as Rejected</span>
                  </button>
                  <button
                    type="button"
                    className={`rv-dropdown-item ${
                      resource.quality_status === "archived" ? "active" : ""
                    }`}
                    onClick={() => handleSetStatus("archived")}
                  >
                    <span className="rv-dropdown-item-icon">📦</span>
                    <span>Set as Archived</span>
                  </button>

                  <div className="rv-dropdown-divider" />
                  <div className="rv-dropdown-label">Spotlight & Personal</div>
                  <button
                    type="button"
                    className="rv-dropdown-item"
                    onClick={handleSetFeatured}
                  >
                    <span className="rv-dropdown-item-icon">⭐</span>
                    <span>
                      {resource.keywords?.toLowerCase().includes("featured")
                        ? "Unset Featured"
                        : "Set as Featured Item"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`rv-dropdown-item ${isFavorite ? "active" : ""}`}
                    onClick={handleToggleFavorite}
                  >
                    <span className="rv-dropdown-item-icon">❤️</span>
                    <span>
                      {isFavorite ? "Remove from Favorites" : "Set as Favorite"}
                    </span>
                  </button>

                  <div className="rv-dropdown-divider" />
                  <div className="rv-dropdown-label">Set Access Level</div>
                  <button
                    type="button"
                    className={`rv-dropdown-item ${
                      resource.access_level === "public" ? "active" : ""
                    }`}
                    onClick={() => handleSetAccess("public")}
                  >
                    <span className="rv-dropdown-item-icon">🌐</span>
                    <span>Set as Public</span>
                  </button>
                  <button
                    type="button"
                    className={`rv-dropdown-item ${
                      resource.access_level === "restricted" ? "active" : ""
                    }`}
                    onClick={() => handleSetAccess("restricted")}
                  >
                    <span className="rv-dropdown-item-icon">🔒</span>
                    <span>Set as Restricted</span>
                  </button>
                </div>
              )}
            </div>

            <div className="rv-dropdown-wrap">
              <button
                type="button"
                className={`rv-btn ${showSettingsMenu ? "rv-btn-primary" : ""}`}
                onClick={() => {
                  setShowSettingsMenu((v) => !v);
                  setShowSetAsMenu(false);
                }}
                title="Viewer Settings & Options"
              >
                ⚙ Settings ▾
              </button>

              {showSettingsMenu && (
                <div className="rv-settings-menu">
                  <div className="rv-dropdown-label" style={{ padding: 0 }}>
                    Viewer Options
                  </div>
                  <div className="rv-setting-row">
                    <span>Fullscreen mode</span>
                    <button
                      type="button"
                      className="rv-btn"
                      style={{ padding: "4px 8px", fontSize: "11px" }}
                      onClick={() => setIsModalFullscreen((f) => !f)}
                    >
                      {isModalFullscreen ? "Exit" : "Maximize"}
                    </button>
                  </div>
                  <div className="rv-setting-row">
                    <span>Favorite shortcut</span>
                    <button
                      type="button"
                      className={`rv-btn ${isFavorite ? "rv-btn-primary" : ""}`}
                      style={{ padding: "4px 8px", fontSize: "11px" }}
                      onClick={handleToggleFavorite}
                    >
                      {isFavorite ? "❤️ Favorited" : "🤍 Add Fav"}
                    </button>
                  </div>
                  <div className="rv-dropdown-divider" />
                  <div className="rv-dropdown-label" style={{ padding: 0 }}>
                    Keyboard Controls
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", lineHeight: 1.6 }}>
                    <div>
                      <b style={{ color: "#e2e8f0" }}>Space:</b> Play / Pause
                    </div>
                    <div>
                      <b style={{ color: "#e2e8f0" }}>S:</b> Stop to 0:00
                    </div>
                    <div>
                      <b style={{ color: "#e2e8f0" }}>[ / ]:</b> Previous / Next
                    </div>
                    <div>
                      <b style={{ color: "#e2e8f0" }}>Esc:</b> Close viewer
                    </div>
                  </div>
                </div>
              )}
            </div>

            {streamUrl && (
              <a
                href={streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rv-btn"
                title="Open in new window"
              >
                ↗ Tab
              </a>
            )}

            {streamUrl && (
              <a
                href={streamUrl}
                download
                className="rv-btn"
                title="Download this file"
              >
                ⇩
              </a>
            )}

            <button
              type="button"
              className="rv-btn rv-btn-icon"
              onClick={() => setIsModalFullscreen((f) => !f)}
              title={isModalFullscreen ? "Exit Fullscreen" : "Maximize Viewer"}
            >
              {isModalFullscreen ? "🗗" : "⛶"}
            </button>

            <button
              type="button"
              className="rv-btn rv-btn-danger"
              onClick={onClose}
              title="Close Viewer (Esc)"
            >
              ✕ Close
            </button>
          </div>
        </header>

        {notice && (
          <div
            style={{
              background: "#0284c7",
              color: "#ffffff",
              padding: "8px 20px",
              fontSize: "12px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              zIndex: 30,
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice("")}
              style={{
                background: "transparent",
                border: 0,
                color: "#fff",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              ×
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {type === "electronic_device"
            ? renderElectronicDevice()
            : renderContentByType(contentUrl, type)}

          {showPlaylistDrawer && resources && resources.length > 0 && (
            <aside className="rv-playlist-drawer">
              <div className="rv-playlist-header">
                <h4>📚 Collection Items ({resources.length})</h4>
                <button
                  type="button"
                  className="rv-btn rv-btn-icon"
                  style={{ width: "26px", height: "26px", fontSize: "12px" }}
                  onClick={() => setShowPlaylistDrawer(false)}
                >
                  ✕
                </button>
              </div>
              <div className="rv-playlist-list">
                {resources.map((item) => {
                  const isActive = item.id === resource.id;
                  const itemThumb = getThumbnailUrl(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`rv-playlist-item ${isActive ? "active" : ""}`}
                      onClick={() => {
                        onSelectResource?.(item);
                        setShowPlaylistDrawer(false);
                      }}
                    >
                      <span style={{ fontSize: "14px" }}>
                        {item.resource_type === "electronic_device"
                          ? "🔌"
                          : item.resource_type === "video"
                          ? "🎥"
                          : item.resource_type === "audio"
                          ? "🎵"
                          : item.resource_type === "pdf"
                          ? "📄"
                          : "📁"}
                      </span>
                      {itemThumb ? (
                        <img
                          src={itemThumb}
                          alt=""
                          style={{
                            width: "30px",
                            height: "30px",
                            objectFit: "cover",
                            borderRadius: "4px",
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : null}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="rv-playlist-item-title">{item.title}</div>
                        <div className="rv-playlist-item-meta">
                          {item.resource_type_display || item.resource_type || "item"}
                        </div>
                      </div>
                      {isActive && (
                        <span style={{ color: "#60a5fa", fontSize: "12px" }}>▶</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </aside>
          )}
        </div>
      </section>
    </div>
  );
}