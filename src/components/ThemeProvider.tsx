import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { pocketbaseService } from '../services/pocketbase';
import { loadProgress, saveProgress } from '../utils/storage';
import { applyTheme, getSystemTheme } from '../utils/theme-utils';

interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  isSystemTheme: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);
  const [isSystemTheme, setIsSystemTheme] = useState(true);

  // Apply theme class to HTML element
  const setThemeAndApply = useCallback((newTheme: 'light' | 'dark') => {
    if (newTheme === 'light' || newTheme === 'dark') {
      applyTheme(newTheme === 'dark');
      setTheme(newTheme);
    }
  }, []);

  // Toggle between light/dark theme
  const toggleTheme = useCallback(async () => {
    if (theme === null) return;

    const newTheme = theme === 'light' ? 'dark' : 'light';
    try {
      const progress = await loadProgress();
      progress.theme = newTheme;
      await saveProgress(progress);
      setIsSystemTheme(false);
      setThemeAndApply(newTheme);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  }, [theme, setThemeAndApply]);

  // Initialize theme on mount - ONLY RUN ONCE
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isMounted = true;

    const initializeTheme = async () => {
      try {
        await pocketbaseService.waitForUserId(5000);
        if (!isMounted) return;

        const progress = await loadProgress();
        const savedTheme = progress.theme;
        console.log(`[Theme Init] Loaded theme from progress: ${savedTheme}`);

        if (isMounted) {
          if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
            console.log(`[Theme Init] Applying saved theme: ${savedTheme}`);
            setThemeAndApply(savedTheme);
            setIsSystemTheme(false);
          } else {
            const systemTheme = getSystemTheme();
            console.log(`[Theme Init] Using system theme: ${systemTheme}`);
            setThemeAndApply(systemTheme);
            setIsSystemTheme(true);
          }
        }
      } catch (error) {
        console.error('[Theme Init] Failed to initialize theme:', error);
        if (isMounted) {
          const systemTheme = getSystemTheme();
          console.log(`[Theme Init] Fallback to system theme on error: ${systemTheme}`);
          setThemeAndApply(systemTheme);
          setIsSystemTheme(true);
        }
      }
    };

    initializeTheme();

    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array - only run once on mount

  // Listen for system theme changes - only when using system theme
  useEffect(() => {
    if (typeof window === 'undefined' || !isSystemTheme) return;

    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      const newSystemTheme = e.matches ? 'dark' : 'light';
      console.log(`[Theme Update] System theme changed to: ${newSystemTheme}`);
      setThemeAndApply(newSystemTheme);
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [isSystemTheme, setThemeAndApply]);

  // Don't render until theme is initialized to prevent flash of default theme
  if (theme === null) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isSystemTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}