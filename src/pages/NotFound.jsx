import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center max-w-lg w-full">
        <h1 className="text-3xl font-black text-slate-900">404</h1>
        <p className="mt-3 text-slate-600">Deze pagina is nooit verzonnen.</p>
        <Link to="/" className="inline-block mt-6 px-4 py-2 rounded-xl bg-slate-900 text-white font-bold">
          Terug naar home
        </Link>
      </div>
    </div>
  );
}
