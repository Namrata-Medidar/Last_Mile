// @ts-nocheck
export const THEME_STORAGE_KEY = "lmc-theme";
export const DEFAULT_THEME = "system";

const modes = {
  light: {
    foreground: "#18212f",
    mutedForeground: "#4b5563",
    primaryForeground: "#ffffff",
    success: "#106536",
    warning: "#795000",
    destructive: "#a51f2e",
    brand: "#a51f2e",
    statusForeground: "#ffffff",
    border: "#c5cbd3",
    input: "#737d8b",
    overlay: "#10141c",
  },
  dark: {
    foreground: "#f2f4f8",
    mutedForeground: "#b6bfcc",
    primaryForeground: "#10141c",
    success: "#76d69b",
    warning: "#f0c46b",
    destructive: "#ff929b",
    brand: "#ff929b",
    statusForeground: "#10141c",
    border: "#465163",
    input: "#8290a3",
    overlay: "#05080f",
  },
};

function createTheme(id, name, mode, palette) {
  const base = modes[mode];
  const colors = {
    background: palette.background,
    foreground: base.foreground,
    card: palette.card,
    "card-foreground": base.foreground,
    surface: palette.surface,
    "surface-foreground": base.foreground,
    popover: palette.card,
    "popover-foreground": base.foreground,
    primary: palette.primary,
    "primary-foreground": base.primaryForeground,
    secondary: palette.surface,
    "secondary-foreground": base.foreground,
    muted: palette.surface,
    "muted-foreground": base.mutedForeground,
    accent: palette.hover,
    "accent-foreground": base.foreground,
    hover: palette.hover,
    link: palette.primary,
    brand: base.brand,
    "brand-foreground": base.statusForeground,
    destructive: base.destructive,
    "destructive-foreground": base.statusForeground,
    success: base.success,
    "success-foreground": base.statusForeground,
    warning: base.warning,
    "warning-foreground": base.statusForeground,
    nav: palette.nav,
    "nav-foreground": base.foreground,
    border: base.border,
    input: base.input,
    ring: palette.primary,
    sidebar: palette.sidebar,
    "sidebar-foreground": base.foreground,
    "sidebar-primary": palette.primary,
    "sidebar-primary-foreground": base.primaryForeground,
    "sidebar-accent": palette.hover,
    "sidebar-accent-foreground": base.foreground,
    "sidebar-border": base.border,
    "sidebar-ring": palette.primary,
    overlay: base.overlay,
    "chart-1": palette.primary,
    "chart-2": base.success,
    "chart-3": base.warning,
    "chart-4": base.destructive,
    "chart-5": base.mutedForeground,
  };
  return { id, name, mode, colors };
}

export const THEMES = [
  createTheme("light", "Light", "light", {
    background: "#f8fafc",
    card: "#ffffff",
    surface: "#eef2f6",
    nav: "#ffffff",
    sidebar: "#f1f5f9",
    hover: "#e2e8f0",
    primary: "#006b63",
  }),
  createTheme("dark", "Dark", "dark", {
    background: "#181a1e",
    card: "#22252b",
    surface: "#2c3037",
    nav: "#1d2025",
    sidebar: "#1d2025",
    hover: "#363c45",
    primary: "#7bd8c6",
  }),
  createTheme("corporate-blue", "Corporate Blue", "light", {
    background: "#f2f6fc",
    card: "#ffffff",
    surface: "#e8eef8",
    nav: "#e2ebfa",
    sidebar: "#e8eef8",
    hover: "#d8e3f5",
    primary: "#2453a6",
  }),
  createTheme("modern-gray", "Modern Gray", "light", {
    background: "#f3f4f5",
    card: "#ffffff",
    surface: "#e9ebee",
    nav: "#e4e7eb",
    sidebar: "#eceef0",
    hover: "#d9dde2",
    primary: "#475569",
  }),
  createTheme("midnight", "Midnight", "dark", {
    background: "#0c1220",
    card: "#151e30",
    surface: "#202d43",
    nav: "#101827",
    sidebar: "#101827",
    hover: "#2c3a52",
    primary: "#8bbcff",
  }),
  createTheme("azure", "Azure", "light", {
    background: "#f0f9fc",
    card: "#ffffff",
    surface: "#e3f2f8",
    nav: "#dceef7",
    sidebar: "#e3f2f8",
    hover: "#cee7f2",
    primary: "#006796",
  }),
];

export const THEME_OPTIONS = [...THEMES, { id: "system", name: "System Default" }];

export function normalizeTheme(value) {
  const legacy = { ocean: "azure", amber: "modern-gray" };
  const id = legacy[value] ?? value;
  return THEME_OPTIONS.some((theme) => theme.id === id) ? id : DEFAULT_THEME;
}

export function applyTheme(preference, themes, root, prefersDark) {
  const resolved = preference === "system" ? (prefersDark ? "dark" : "light") : preference;
  const theme = themes.find((entry) => entry.id === resolved) ?? themes[0];
  for (const name of Array.from(root.classList)) {
    if (name.startsWith("theme-")) root.classList.remove(name);
  }
  root.classList.add(`theme-${theme.id}`);
  root.classList.toggle("dark", theme.mode === "dark");
  root.dataset.theme = theme.id;
  root.dataset.themePreference = preference;
  root.style.colorScheme = theme.mode;
  for (const [token, color] of Object.entries(theme.colors)) {
    root.style.setProperty(`--${token}`, color);
  }
}

export function getThemeSnapshot() {
  return document.documentElement.dataset.themePreference ?? DEFAULT_THEME;
}

export function setTheme(value, persist = true) {
  const preference = normalizeTheme(value);
  applyTheme(
    preference,
    THEMES,
    document.documentElement,
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  if (persist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {}
  }
  window.dispatchEvent(new Event("lmc-theme-change"));
}

export function subscribeTheme(listener) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (getThemeSnapshot() === "system") setTheme("system", false);
  };
  const onStorage = (event) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) setTheme(event.newValue, false);
  };
  window.addEventListener("lmc-theme-change", listener);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", onSystemChange);
  return () => {
    window.removeEventListener("lmc-theme-change", listener);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", onSystemChange);
  };
}

export function initializeTheme() {
  let saved;
  try {
    saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {}
  setTheme(saved, false);
}

export const THEME_INIT_SCRIPT = `(() => {
  const themes = ${JSON.stringify(THEMES)};
  let saved;
  try { saved = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}); } catch {}
  const legacy = { ocean: "azure", amber: "modern-gray" };
  const id = legacy[saved] || saved;
  const preference = id === "system" || themes.some(theme => theme.id === id) ? id : "system";
  const resolved = preference === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : preference;
  const theme = themes.find(entry => entry.id === resolved);
  const root = document.documentElement;
  for (const name of Array.from(root.classList)) {
    if (name.startsWith("theme-")) root.classList.remove(name);
  }
  root.classList.add("theme-" + theme.id);
  root.classList.toggle("dark", theme.mode === "dark");
  root.dataset.theme = theme.id;
  root.dataset.themePreference = preference;
  root.style.colorScheme = theme.mode;
  for (const [token, color] of Object.entries(theme.colors)) root.style.setProperty("--" + token, color);
})();`;
