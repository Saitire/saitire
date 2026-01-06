import React from 'react';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 bg-slate-950 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <p className="text-sm">© {year} SAItire.nl — Alle onzin voorbehouden</p>
      </div>
    </footer>
  );
}
