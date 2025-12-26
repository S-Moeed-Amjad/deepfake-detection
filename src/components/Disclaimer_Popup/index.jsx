import React, { useEffect, useState } from "react";

const STORAGE_KEY = "deepfake_disclaimer_accepted";

/**
 * Props:
 * - open (boolean) : whether the modal is visible
 * - onAccept()     : called when user accepts the disclaimer
 * - onClose()      : optional, called when user explicitly closes the modal (if you allow)
 */
export default function DisclaimerModal({ open = true, onAccept = () => {} }) {
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    const accepted = localStorage.getItem(STORAGE_KEY);
    if (accepted === "true") {
      setVisible(false);
      // If already accepted, notify the parent immediately
      onAccept();
    } else {
      setVisible(open);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleAccept = () => {
    setVisible(false);
    onAccept();
  };

  if (!visible) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Disclaimer"
    >
      <div className="modal-card">
        <h2 className="modal-title">Important Disclaimer</h2>

        <div className="modal-body">
          <p>
            The results produced by this system are{" "}
            <strong>research outputs only</strong>. They are intended to assist
            in analysis and exploration —{" "}
            <strong>they are not definitive</strong>.
          </p>

          <ul>
            <li>
              The model's prediction should <strong>not</strong> be used as
              legal evidence or as the sole basis for decisions with legal,
              financial, or life-impacting consequences.
            </li>
            <li>
              The visualization (heatmap/annotated media) highlights areas the
              model found suspicious; it does not prove manipulation.
            </li>
            <li>
              False positives and false negatives are possible. You should
              confirm findings with independent technical or legal experts
              before taking action.
            </li>
            <li>
              By using this service you acknowledge that the creators and
              operators are not responsible for decisions made based on the
              model output.
            </li>
          </ul>

          <p className="muted small">
            If you are unsure about how to interpret results, consult a
            qualified human expert.
          </p>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={handleAccept}>
            I Understand & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
