import React from "react";
import { NavLink } from "react-router-dom";
export default function Layout({ children }) {
  return (
    <div className="app-root">
      <header className="app-header">
        <div className="logo">Deepfake<span>Guard</span></div>
        <nav className="nav-links"><NavLink to="/" end>Detector</NavLink><NavLink to="/about">About</NavLink></nav>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer"><span>DeepfakeGuard · SavedModel Edition</span></footer>
    </div>
  );
}
