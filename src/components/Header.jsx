import React from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES } from '../utils/slug';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/85 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-baseline justify-between py-4">
          <Link to="/" className="flex items-baseline gap-2 leading-none">
            <div className="flex items-baseline leading-none">
              <span className="text-3xl font-black tracking-tight text-slate-900">S</span>
              <span className="text-3xl font-black tracking-tight text-[#f26522]">AI</span>
              <span className="text-3xl font-black tracking-tight text-slate-900">TIRE</span>
            </div>
            <span className="hidden sm:block text-xs text-slate-500 ml-2 border-l border-slate-300 pl-2">
              .nl
            </span>
          </Link>

          <div className="hidden md:block text-xs text-slate-500 text-right max-w-md leading-snug">
            Gemaakt door AI, niet gehinderd door gezond verstand.
          </div>
        </div>
      </div>

      <nav className="bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 py-2 overflow-x-auto">
            <Link
              to="/"
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Home
            </Link>
            {CATEGORIES.map((c) => (
              <Link
                key={c.key}
                to={`/categorie/${c.key}`}
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}
