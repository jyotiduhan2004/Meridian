"use client";

import { useEffect, useState } from "react";

// Light/dark toggle. Dark is the default; light is opt-in via data-theme="light"
// on <html> (also set pre-paint by the inline script in layout.tsx, and persisted
// to localStorage). We additionally set the native color-scheme directly so the
// toggle has a guaranteed visible effect even before the themed CSS loads.
type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  const el = document.documentElement;
  if (theme === "light") el.setAttribute("data-theme", "light");
  else el.removeAttribute("data-theme");
  el.style.colorScheme = theme;
  try {
    localStorage.setItem("meridian-theme", theme);
  } catch {
    /* storage blocked — toggle still works for the session */
  }
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    let initial: Theme = "dark";
    try {
      if (localStorage.getItem("meridian-theme") === "light") initial = "light";
    } catch {
      /* ignore */
    }
    if (document.documentElement.getAttribute("data-theme") === "light") initial = "light";
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  const isLight = theme === "light";
  return (
    <button
      onClick={toggle}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Dark mode" : "Light mode"}
      className={`pill inline-flex h-9 w-9 shrink-0 items-center justify-center border border-border text-muted transition hover:text-foreground ${className}`}
    >
      {isLight ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}
    </button>
  );
}
