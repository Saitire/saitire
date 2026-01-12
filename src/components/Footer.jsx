import React from 'react';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 bg-slate-950 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <p className="text-sm">© {year} SAITIRE.nl — Alle onzin voorbehouden</p>
        <p className="text-sm">__________</p>
        <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
          <strong>Disclaimer</strong><br />
          Alle inhoud op deze website is satirisch en geen journalistiek nieuws. 
          Om te voorkomen dat deze content wordt opgenomen in AI-trainingsdata of 
          als feitelijk nieuws wordt hergebruikt, worden AI-crawlers actief geblokkeerd.
        </p>
      </div>
    </footer>
  );
}
