import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/* ---------------- Theme ---------------- */
type Theme = "light" | "dark";
interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}
const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("mp:theme") as Theme | null;
      const initial: Theme = stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      setTheme(initial);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem("mp:theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const value = useMemo(
    () => ({ theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }),
    [theme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

/* ---------------- Partner Filter ---------------- */
interface PartnerFilterCtx {
  selected: string[]; // empty = all
  setSelected: (ids: string[]) => void;
  toggle: (id: string) => void;
  clear: () => void;
  isAll: boolean;
}
const PartnerFilterContext = createContext<PartnerFilterCtx | null>(null);

export function PartnerFilterProvider({ children }: { children: ReactNode }) {
  const [selected, setSelectedState] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mp:partners");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSelectedState(parsed.filter((x) => typeof x === "string"));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setSelected = useCallback((ids: string[]) => {
    setSelectedState(ids);
    try {
      localStorage.setItem("mp:partners", JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(
    (id: string) => {
      setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    },
    [selected, setSelected],
  );

  const clear = useCallback(() => setSelected([]), [setSelected]);

  const value = useMemo(
    () => ({ selected, setSelected, toggle, clear, isAll: selected.length === 0 }),
    [selected, setSelected, toggle, clear],
  );
  return <PartnerFilterContext.Provider value={value}>{children}</PartnerFilterContext.Provider>;
}

export function usePartnerFilter() {
  const ctx = useContext(PartnerFilterContext);
  if (!ctx) throw new Error("usePartnerFilter must be used inside PartnerFilterProvider");
  return ctx;
}
