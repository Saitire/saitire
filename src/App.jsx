import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import ArticlePage from "./pages/ArticlePage";
import CategoryPage from "./pages/CategoryPage";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import RedactiePage from "./pages/RedactiePage";
import FeedbackPage from "./pages/FeedbackPage";
import ExplainerPage from "./pages/ExplainerPage";


export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/artikel/:slug" element={<ArticlePage />} />
      <Route path="/categorie/:category" element={<CategoryPage />} />
      <Route path="*" element={<NotFound />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/redactie" element={<RedactiePage />} />
      <Route path="/feedback" element={<FeedbackPage />} />
      <Route path="/explainer" element={<ExplainerPage />} />
    </Routes>
  );
}