import React, { useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "recruiterreply-theme";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key === KEY) {
        const stored = event.newValue;
        const next: Theme = stored === "dark" || stored === "light"
          ? stored
          : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        document.documentElement.dataset.theme = next;
        setTheme(next);
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    setTheme(next);
    try { window.localStorage.setItem(KEY, next); } catch { /* storage unavailable */ }
  };

  return (
    <button type="button" onClick={toggle} className="theme-toggle"
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
      {theme === "dark" ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.985 12.486A9 9 0 0 1 11.514 3.015 9 9 0 1 0 20.985 12.486Z" /></svg>
      )}
    </button>
  );
};
