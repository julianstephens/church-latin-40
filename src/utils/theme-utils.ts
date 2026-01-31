// Utility functions for theme management

/**
 * Applies the specified theme to the document
 * @param isDark - Whether to apply dark theme
 */
export function applyTheme(isDark: boolean): void {
  if (typeof document === "undefined") return;

  const html = document.documentElement;

  if (isDark) {
    html.classList.add("dark");
    html.style.colorScheme = "dark";
  } else {
    html.classList.remove("dark");
    html.style.colorScheme = "light";
  }
}

/**
 * Gets the system color scheme preference
 * @returns 'light' or 'dark' based on system preference
 */
export function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Gets appropriate text color classes based on theme
 * @param isDark - Whether dark theme is active
 * @returns Tailwind classes for text color
 */
export function getThemeContrastTextColor(isDark: boolean): string {
  return isDark ? "text-gray-100" : "text-gray-900";
}

/**
 * Gets appropriate background color classes based on theme
 * @param isDark - Whether dark theme is active
 * @returns Tailwind classes for background color
 */
export function getThemeBackgroundColor(isDark: boolean): string {
  return isDark ? "bg-gray-900" : "bg-white";
}

/**
 * Gets appropriate border color classes based on theme
 * @param isDark - Whether dark theme is active
 * @returns Tailwind classes for border color
 */
export function getThemeBorderColor(isDark: boolean): string {
  return isDark ? "border-gray-700" : "border-gray-200";
}

type ButtonVariant = "primary" | "secondary" | "ghost";

/**
 * Gets appropriate button classes based on theme and variant
 * @param isDark - Whether dark theme is active
 * @param variant - The button variant
 * @returns Tailwind classes for the button
 */
export function getThemeButtonClasses(
  isDark: boolean,
  variant: ButtonVariant = "primary",
): string {
  const baseClasses =
    "px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";

  const variants = {
    dark: {
      primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
      secondary:
        "bg-gray-800 text-gray-100 hover:bg-gray-700 focus:ring-gray-500",
      ghost:
        "text-gray-300 hover:bg-gray-800 hover:text-white focus:ring-gray-500",
    },
    light: {
      primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
      secondary:
        "bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-gray-300",
      ghost: "text-gray-600 hover:bg-gray-100 focus:ring-gray-300",
    },
  };

  return `${baseClasses} ${isDark ? variants.dark[variant] : variants.light[variant]}`;
}

/**
 * Gets appropriate card classes based on theme
 * @param isDark - Whether dark theme is active
 * @returns Tailwind classes for cards
 */
export function getThemeCardClasses(isDark: boolean): string {
  return isDark
    ? "bg-gray-800 border-gray-700 text-gray-100 shadow-lg"
    : "bg-white border-gray-200 text-gray-800 shadow-sm";
}

/**
 * Gets appropriate input classes based on theme
 * @param isDark - Whether dark theme is active
 * @returns Tailwind classes for form inputs
 */
export function getThemeInputClasses(isDark: boolean): string {
  return isDark
    ? "bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
    : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500";
}
