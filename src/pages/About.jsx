import React from "react";
export default function About(){
  return (<div className="page"><section className="panel">
    <h1>About</h1>
    <p>Backend loads your TF SavedModel from <code>backend/model/</code> and runs inference on images/videos.</p>
    <p>If predicted <strong>fake</strong>, an occlusion-sensitivity heatmap is overlaid. For videos, sampled frames are processed and saved to MP4.</p>
  </section></div>);
}
