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

  // Initialize theme on mount
  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') return;

    const initializeTheme = async () => {
      try {
        // Wait for PocketBase user ID to be set (ensures authentication is complete)
        await pocketbaseService.waitForUserId(5000);

        // Get saved preference
        const progress = await loadProgress();
        const savedTheme = progress.theme;

        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
          // Use saved theme if it exists and is valid
          setThemeAndApply(savedTheme);
          setIsSystemTheme(false);
        } else {
          // Otherwise use system preference
          const systemTheme = getSystemTheme();
          setThemeAndApply(systemTheme);
          setIsSystemTheme(true);
        }
      } catch (error) {
        console.error('Failed to initialize theme:', error);
        // Fallback to system theme on error
        const systemTheme = getSystemTheme();
        setThemeAndApply(systemTheme);
        setIsSystemTheme(true);
      }
    };

    initializeTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (isSystemTheme) {
        setThemeAndApply(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [setThemeAndApply, isSystemTheme]);

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