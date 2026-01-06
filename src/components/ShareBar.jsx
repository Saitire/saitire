import React, { useMemo, useState } from "react";
import { Share2, Link as LinkIcon } from "lucide-react";

function enc(s) {
  return encodeURIComponent(String(s || ""));
}

function IconButton({ href, label, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.99] transition"
    >
      {children}
    </a>
  );
}

function IconAction({ onClick, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.99] transition"
    >
      {children}
    </button>
  );
}

// simpele inline “logo” icoontjes (geen extra dependencies)
function XIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M18.9 2H22l-6.8 7.8L23.2 22H16.7l-5.1-6.7L5.8 22H2.7l7.3-8.4L1.1 2h6.7l4.6 6L18.9 2Zm-1.1 18h1.7L7.1 3.9H5.3L17.8 20Z" />
    </svg>
  );
}

function WhatsAppIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12.04 2C6.52 2 2.04 6.48 2.04 12c0 1.77.46 3.49 1.33 5.01L2 22l5.12-1.34A9.94 9.94 0 0 0 12.04 22c5.52 0 10-4.48 10-10s-4.48-10-10-10Zm0 18.2c-1.56 0-3.08-.4-4.43-1.15l-.32-.18-3.04.8.81-2.96-.2-.34A8.16 8.16 0 0 1 3.84 12c0-4.5 3.66-8.16 8.2-8.16 4.5 0 8.16 3.66 8.16 8.16s-3.66 8.2-8.16 8.2Zm4.74-6.12c-.26-.13-1.56-.77-1.8-.86-.24-.09-.41-.13-.58.13-.17.26-.67.86-.82 1.03-.15.17-.3.2-.56.07-.26-.13-1.08-.4-2.05-1.27-.76-.67-1.27-1.5-1.42-1.76-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.58-1.4-.8-1.92-.21-.5-.42-.43-.58-.44h-.49c-.17 0-.45.07-.69.32-.24.26-.9.88-.9 2.14s.92 2.48 1.05 2.66c.13.17 1.81 2.77 4.38 3.88.61.26 1.08.41 1.45.53.61.19 1.16.16 1.6.1.49-.07 1.56-.64 1.78-1.27.22-.63.22-1.17.15-1.27-.06-.1-.24-.16-.5-.29Z" />
    </svg>
  );
}

function LinkedInIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.95v5.66H9.37V9h3.41v1.56h.05c.47-.9 1.62-1.85 3.33-1.85 3.56 0 4.22 2.35 4.22 5.41v6.33ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
    </svg>
  );
}

function FacebookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M13.5 22v-8h2.7l.4-3H13.5V9.1c0-.87.24-1.46 1.5-1.46h1.6V5.02c-.28-.04-1.23-.12-2.35-.12-2.33 0-3.92 1.42-3.92 4.02V11H7.7v3h2.63v8h3.17Z" />
    </svg>
  );
}

function BlueskyIcon(props) {
  // simpele "vlinder" placeholder-icoon; werkt prima als merk-neutraal icoontje
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 12c1.7-2.3 4.1-4.6 6.6-5.8 1.2-.6 2.4.4 2.1 1.7-.7 3.2-3.1 6.3-6.2 7.9 3.1 1.6 5.5 4.7 6.2 7.9.3 1.3-.9 2.3-2.1 1.7-2.5-1.2-4.9-3.5-6.6-5.8-1.7 2.3-4.1 4.6-6.6 5.8-1.2.6-2.4-.4-2.1-1.7.7-3.2 3.1-6.3 6.2-7.9-3.1-1.6-5.5-4.7-6.2-7.9-.3-1.3.9-2.3 2.1-1.7 2.5 1.2 4.9 3.5 6.6 5.8Z" />
    </svg>
  );
}

export default function ShareBar({ title, subtitle, url }) {
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => {
    const t = String(title || "").trim();
    const sub = String(subtitle || "").trim();
    return sub ? `${t} — ${sub}` : t;
  }, [title, subtitle]);

  const shareUrl = String(url || "").trim();

  const links = useMemo(() => {
    const u = enc(shareUrl);
    const t = enc(text);

    return [
      { key: "whatsapp", label: "Deel via WhatsApp", href: `https://wa.me/?text=${t}%20${u}` },
      { key: "x", label: "Deel op X", href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
      { key: "linkedin", label: "Deel op LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
      { key: "facebook", label: "Deel op Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
      { key: "bluesky", label: "Deel op Bluesky", href: `https://bsky.app/intent/compose?text=${t}%20${u}` },
    ];
  }, [shareUrl, text]);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  }

  async function onNativeShare() {
    if (!navigator.share) return;
    try {
      await navigator.share({ title, text, url: shareUrl });
    } catch {
      // user cancelled
    }
  }

  return (
    <div className="mt-6 flex items-center gap-2">
      {navigator.share ? (
        <IconAction onClick={onNativeShare} label="Delen…">
          <Share2 size={18} className="text-slate-800" />
        </IconAction>
      ) : null}

      {links.map((l) => (
        <IconButton key={l.key} href={l.href} label={l.label}>
          {l.key === "whatsapp" ? <WhatsAppIcon className="text-slate-800" /> : null}
          {l.key === "x" ? <XIcon className="text-slate-800" /> : null}
          {l.key === "linkedin" ? <LinkedInIcon className="text-slate-800" /> : null}
          {l.key === "facebook" ? <FacebookIcon className="text-slate-800" /> : null}
          {l.key === "bluesky" ? <BlueskyIcon className="text-slate-800" /> : null}
        </IconButton>
      ))}

      <IconAction onClick={onCopy} label={copied ? "Link gekopieerd" : "Kopieer link"}>
        <LinkIcon size={18} className={copied ? "text-[#f26522]" : "text-slate-800"} />
      </IconAction>
    </div>
  );
}
