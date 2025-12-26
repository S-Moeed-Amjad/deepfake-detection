import React, { useCallback, useState } from "react";
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
  const [resultUrl, setResultUrl] = useState(null);
  const [resultMediaType, setResultMediaType] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [framesProcessed, setFramesProcessed] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
  const resetResult = () => {
    setResultUrl(null);
    setResultMediaType(null);
    setPrediction(null);
    setConfidence(null);
    setFramesProcessed(null);
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
      setPreviewUrl(null);
      resetResult();
      return;
    }
    setError(null);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    resetResult();
  }, []);
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
      const res = await fetch(`${apiBaseUrl}/predict`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        let msg = "Analysis failed.";
        try {
          const j = await res.json();
          if (j?.detail) msg = j.detail;
        } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      setPrediction(data.label);
      setConfidence(data.confidence);
      setResultMediaType(data.result_media_type);
      setFramesProcessed(data.frames_processed || null);
      setResultUrl(`${apiBaseUrl}${data.result_url}`);
    } catch (err) {
      setError(err.message || "Unexpected error.");
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
    return resultMediaType === "video" ? (
      <video className="media-preview" src={resultUrl} controls />
    ) : (
      <img className="media-preview" src={resultUrl} alt="Heatmap" />
    );
  };
  return (
    <div className="page">
      <section className="panel">
        <h1>Deepfake Detector</h1>
        <p className="subtitle">
          Upload an image or video. The backend loads your TensorFlow
          SavedModel.
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
                prediction === "FAKE" ? "pill-danger" : "pill-success"
              }`}
            >
              {prediction.toUpperCase()}
            </span>
            {typeof confidence === "number" && (
              <span className="confidence">
                Confidence: {(confidence * 100).toFixed(1)}%
              </span>
            )}
            {framesProcessed && (
              <span className="confidence">
                Frames analyzed: {framesProcessed}
              </span>
            )}
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
