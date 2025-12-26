import React from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import UploadPage from "./components/UploadPage";
import About from "./pages/About";
import DisclaimerModal from "./components/Disclaimer_Popup";
export default function App() {
  return (
    <Layout>
      <DisclaimerModal />
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </Layout>
  );
}
