import { createContext, useContext, useEffect, useState } from "react";
import { getBrowserStorage } from "@/lib/browser-storage";

export type Theme = "dark" | "light" | "system";

export const DEFAULT_THEME = "system" satisfies Theme;
export const THEME_STORAGE_KEY = "oop-theme";

const isTheme = (value: unknown): value is Theme =>
  value === "dark" || value === "light" || value === "system";

const getSystemTheme = () =>
  globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const getResolvedTheme = (theme: Theme) => (theme === "system" ? getSystemTheme() : theme);

export const applyTheme = (theme: Theme, root = document.documentElement) => {
  const resolvedTheme = getResolvedTheme(theme);

  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);
  root.style.colorScheme = resolvedTheme;
};

const getStoredTheme = (storageKey: string, defaultTheme: Theme) => {
  const storedTheme = getBrowserStorage()?.getItem(storageKey);

  return isTheme(storedTheme) ? storedTheme : defaultTheme;
};

export const getThemeInitScript = (
  storageKey = THEME_STORAGE_KEY,
  defaultTheme: Theme = DEFAULT_THEME,
) =>
  `(() => {
    const isTheme = (value) => value === "dark" || value === "light" || value === "system";
    const getSystemTheme = () =>
      window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

    try {
      const storedTheme = window.localStorage.getItem(${JSON.stringify(storageKey)});
      const theme = isTheme(storedTheme) ? storedTheme : ${JSON.stringify(defaultTheme)};
      const resolvedTheme = theme === "system" ? getSystemTheme() : theme;
      const root = document.documentElement;

      root.classList.remove("light", "dark");
      root.classList.add(resolvedTheme);
      root.style.colorScheme = resolvedTheme;
    } catch {
      const resolvedTheme = ${JSON.stringify(defaultTheme)} === "system"
        ? getSystemTheme()
        : ${JSON.stringify(defaultTheme)};
      const root = document.documentElement;

      root.classList.remove("light", "dark");
      root.classList.add(resolvedTheme);
      root.style.colorScheme = resolvedTheme;
    }
  })();`;

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
  storageKey = THEME_STORAGE_KEY,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme(storageKey, defaultTheme));

  useEffect(() => {
    applyTheme(theme);

    if (theme !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => applyTheme(theme);

    mediaQuery.addEventListener?.("change", syncTheme);
    mediaQuery.addListener?.(syncTheme);

    return () => {
      mediaQuery.removeEventListener?.("change", syncTheme);
      mediaQuery.removeListener?.(syncTheme);
    };
  }, [theme]);

  const value: ThemeProviderState = {
    theme,
    setTheme: (newTheme) => {
      getBrowserStorage()?.setItem(storageKey, newTheme);
      setTheme(newTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
