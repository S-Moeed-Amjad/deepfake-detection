import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const MAX_SIZE_MB = 250;

const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/bmp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/x-matroska",
  "video/webm",
  "video/x-msvideo",
];

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Local blob URL for downloaded output
  const [resultUrl, setResultUrl] = useState(null);
  const [resultMediaType, setResultMediaType] = useState(null);

  const [prediction, setPrediction] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Track blob urls so we can revoke them
  const previewUrlRef = useRef(null);
  const resultUrlRef = useRef(null);

  // Track latest job_id so we can request deletion on refresh/unmount too
  const lastJobIdRef = useRef(null);

  // Normalize base URL so it NEVER ends with a slash
  const apiBaseUrl = useMemo(() => {
    const raw = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
    return String(raw).replace(/\/+$/, "");
  }, []);

  const revokeIfSet = (url) => {
    if (url && typeof url === "string" && url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
  };

  const resetResult = () => {
    revokeIfSet(resultUrlRef.current);
    resultUrlRef.current = null;

    setResultUrl(null);
    setResultMediaType(null);
    setPrediction(null);
  };

  const validateFile = (f) => {
    if (!f) return "No file selected.";
    if (!ACCEPTED_TYPES.includes(f.type)) return "Unsupported file type.";
    const sizeMb = f.size / 1024 / 1024;
    if (sizeMb > MAX_SIZE_MB) return `File too large. Max ${MAX_SIZE_MB} MB.`;
    return null;
  };

  const handleFiles = useCallback((files) => {
    const selected = files[0];
    const v = validateFile(selected);

    if (v) {
      setError(v);
      setFile(null);

      revokeIfSet(previewUrlRef.current);
      previewUrlRef.current = null;
      setPreviewUrl(null);

      resetResult();
      return;
    }

    setError(null);
    setFile(selected);
    resetResult();
  }, []);

  // Create / cleanup preview URL (avoid memory leak)
  useEffect(() => {
    revokeIfSet(previewUrlRef.current);
    previewUrlRef.current = null;

    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);

    return () => {
      revokeIfSet(previewUrlRef.current);
      previewUrlRef.current = null;
    };
  }, [file]);

  // Call backend to delete files (requires DELETE /delete/{job_id})
  const deleteJobOnServer = async (jobId) => {
    if (!jobId) return;

    try {
      await fetch(`${apiBaseUrl}/delete/${jobId}`, {
        method: "DELETE",
        credentials: "omit",
      });
    } catch {
      // ignore cleanup failures
    }
  };

  // Cleanup on refresh/unmount: revoke blobs + delete last server job (best effort)
  useEffect(() => {
    const cleanup = () => {
      revokeIfSet(previewUrlRef.current);
      previewUrlRef.current = null;

      revokeIfSet(resultUrlRef.current);
      resultUrlRef.current = null;

      // best-effort server cleanup on refresh/close
      if (lastJobIdRef.current) {
        // can't await in beforeunload reliably; fire-and-forget
        navigator.sendBeacon?.(`${apiBaseUrl}/delete/${lastJobIdRef.current}`);
      }
    };

    window.addEventListener("beforeunload", cleanup);

    return () => {
      window.removeEventListener("beforeunload", cleanup);
      cleanup();
    };
  }, [apiBaseUrl]);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { files } = e.dataTransfer;
    if (files && files.length > 0) handleFiles(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileInputChange = (e) => {
    const { files } = e.target;
    if (files && files.length > 0) handleFiles(files);
  };

  // Download output as Blob and preview via local blob URL
  const downloadAndPreviewOutput = async (absoluteDownloadUrl, outputType) => {
    const r = await fetch(absoluteDownloadUrl, {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
    });

    if (!r.ok) {
      throw new Error(`Failed to download output (HTTP ${r.status}).`);
    }

    const blob = await r.blob();
    const localBlobUrl = URL.createObjectURL(blob);

    // revoke any previous output blob url
    revokeIfSet(resultUrlRef.current);
    resultUrlRef.current = localBlobUrl;

    setResultMediaType(outputType || blob.type || null);
    setResultUrl(localBlobUrl);

    // OPTIONAL: if you want to force "Save As" download prompt, keep this.
    // Note: Browser chooses location (usually Downloads). You can't silently pick a folder.
    const isVideo =
      (outputType && outputType.startsWith("video/")) ||
      blob.type.startsWith("video/");
    const ext = isVideo ? "mp4" : "png";

    const a = document.createElement("a");
    a.href = localBlobUrl;
    a.download = `deepfake_output.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("Please select a file.");
      return;
    }

    setIsLoading(true);
    setError(null);
    resetResult();

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${apiBaseUrl}/predict?sample_every=15`, {
        method: "POST",
        body: form,
        credentials: "omit",
      });

      if (!res.ok) {
        let msg = `Analysis failed (HTTP ${res.status}).`;
        try {
          const j = await res.json();
          if (j?.detail) msg = j.detail;
        } catch {}
        throw new Error(msg);
      }

      const data = await res.json();

      // Store job_id for cleanup later too
      lastJobIdRef.current = data.job_id || null;

      setPrediction(data.label ?? null);

      const outputType = data.output_type || null; // "video/mp4" or "image/png"
      const dl = data.download_url || null; // "/download/<job_id>"
      if (!dl) throw new Error("Missing download_url from API response.");

      // Download output into browser memory and preview locally
      const absoluteDownloadUrl = `${apiBaseUrl}${dl}`;
      await downloadAndPreviewOutput(absoluteDownloadUrl, outputType);

      // Delete server copy immediately after successful download (best effort)
      if (data.job_id) {
        await deleteJobOnServer(data.job_id);
      }
    } catch (err) {
      setError(err?.message || "Unexpected error.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderPreview = () => {
    if (!previewUrl) return <p className="muted">No file selected.</p>;
    const isVideo = file && file.type.startsWith("video/");
    return isVideo ? (
      <video className="media-preview" src={previewUrl} controls />
    ) : (
      <img className="media-preview" src={previewUrl} alt="Original" />
    );
  };

  const renderResult = () => {
    if (!resultUrl) return <p className="muted">Run analysis to see output.</p>;

    const isVideo =
      typeof resultMediaType === "string" &&
      resultMediaType.startsWith("video/");
    return isVideo ? (
      <video className="media-preview" controls playsInline>
        <source src={resultUrl} type={resultMediaType || "video/mp4"} />
      </video>
    ) : (
      <img className="media-preview" src={resultUrl} alt="Heatmap" />
    );
  };

  return (
    <div className="page">
      <section className="panel">
        <h1>Deepfake Detector</h1>
        <p className="subtitle">
          Upload an image or video. The backend runs the deepfake model and
          returns a heatmap.
        </p>

        <div
          className="dropzone"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <p className="dropzone-title">Drag & drop a file here</p>
          <p className="dropzone-subtitle">or click to browse</p>
          <input
            type="file"
            className="file-input"
            onChange={handleFileInputChange}
            accept={ACCEPTED_TYPES.join(",")}
          />
        </div>

        {file && (
          <p className="file-info">
            Selected: <strong>{file.name}</strong> (
            {(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}

        <p className="muted" style={{ marginTop: 8 }}>
          API: {apiBaseUrl}
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <button
          className="primary-btn"
          onClick={handleSubmit}
          disabled={isLoading || !file}
        >
          {isLoading ? (
            <span className="spinner">
              <span className="spinner-dot" />
              Analyzing...
            </span>
          ) : (
            "Analyze"
          )}
        </button>

        {prediction && (
          <div className="result-banner">
            <span
              className={`pill ${
                String(prediction).toUpperCase() === "FAKE"
                  ? "pill-danger"
                  : "pill-success"
              }`}
            >
              {String(prediction).toUpperCase()}
            </span>
          </div>
        )}
      </section>

      <section className="panel panel-grid">
        <div>
          <h2>Original</h2>
          {renderPreview()}
        </div>
        <div>
          <h2>Model Output</h2>
          {renderResult()}
        </div>
      </section>
    </div>
  );
}
