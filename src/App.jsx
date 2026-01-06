import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import ArticlePage from "./pages/ArticlePage";
import CategoryPage from "./pages/CategoryPage";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/artikel/:slug" element={<ArticlePage />} />
      <Route path="/categorie/:category" element={<CategoryPage />} />
      <Route path="*" element={<NotFound />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}