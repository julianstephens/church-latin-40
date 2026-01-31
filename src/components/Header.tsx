import { useAuth0 } from "@auth0/auth0-react";
import {
  Book,
  Clock,
  Cross,
  Github,
  LogIn,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Tooltip } from "react-tooltip";
import {
  disableAnonymousMode,
  getSessionTimeRemaining,
  isAnonymousMode,
} from "../services/anonymousSession";
import { useTheme } from "./ThemeProvider";

interface HeaderProps {
  onHomeClick: () => void;
}

export function Header({ onHomeClick }: HeaderProps) {
  const { logout } = useAuth0();
  const { theme, toggleTheme } = useTheme();
  const anonMode = isAnonymousMode();
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<string>("");

  useEffect(() => {
    if (!anonMode) {
      setSessionTimeRemaining("");
      return;
    }

    const updateTimer = () => {
      const remaining = getSessionTimeRemaining();
      if (remaining <= 0) {
        setSessionTimeRemaining("Expired");
        return;
      }

      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
      setSessionTimeRemaining(`${hours}h ${minutes}m`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [anonMode]);

  const handleExitAnonymousMode = () => {
    disableAnonymousMode();
    window.location.href = "/";
  };

  return (
    <header className="bg-white dark:bg-gray-900 shadow-lg border-b-2 border-red-900 dark:border-red-800">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div
            className="flex items-center space-x-2 sm:space-x-3 cursor-pointer hover:opacity-80 transition-opacity flex-shrink min-w-0"
            onClick={onHomeClick}
          >
            <Cross className="h-6 w-6 sm:h-8 sm:w-8 text-red-900 dark:text-red-800 flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white truncate">
                Ecclesiastical Latin
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate">
                40 Days to Sacred Language
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-shrink-0">
            <div className="hidden lg:flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
              <Book className="h-4 w-4" />
              <span>Ad Majorem Dei Gloriam</span>
            </div>

            <a
              href="https://github.com/masaharumori7/church-latin-40"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-touch-target min-w-touch-target sm:min-h-0 sm:min-w-0 p-2 sm:p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center touch-manipulation"
              aria-label="View on GitHub"
            >
              <Github className="h-4 w-4 sm:h-5 sm:w-5 text-gray-700 dark:text-gray-300" />
            </a>

            <button
              onClick={toggleTheme}
              className="min-h-touch-target min-w-touch-target sm:min-h-0 sm:min-w-0 p-2 sm:p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center touch-manipulation"
              aria-label="Toggle theme"
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-700 dark:text-gray-300" />
              ) : (
                <Sun className="h-4 w-4 sm:h-5 sm:w-5 text-gray-700 dark:text-gray-300" />
              )}
            </button>

            {anonMode ? (
              <>
                <div
                  className="hidden sm:flex items-center space-x-2 text-xs sm:text-sm text-orange-600 dark:text-orange-400 px-2 sm:px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/30"
                  data-tooltip-id="anonSessionTimer"
                  data-tooltip-content="Anonymous session expires after 24 hours"
                >
                  <Clock className="h-4 w-4" />
                  <span className="whitespace-nowrap">{sessionTimeRemaining || "Loading..."}</span>
                </div>
                <Tooltip id="anonSessionTimer" />
                <button
                  onClick={handleExitAnonymousMode}
                  className="min-h-touch-target min-w-touch-target sm:min-h-0 sm:min-w-0 p-2 sm:p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center touch-manipulation"
                  data-tooltip-id="anonLoginButton"
                  data-tooltip-content="Sign in with Auth0"
                >
                  <LogIn className="h-4 w-4 sm:h-5 sm:w-5 text-gray-700 dark:text-gray-300" />
                </button>
                <Tooltip id="anonLoginButton" />
              </>
            ) : (
              <button
                onClick={() =>
                  logout({ logoutParams: { returnTo: window.location.origin } })
                }
                className="min-h-touch-target min-w-touch-target sm:min-h-0 sm:min-w-0 p-2 sm:p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center touch-manipulation"
                data-tooltip-id="logoutButton"
                data-tooltip-content="Logout"
              >
                <LogOut className="h-4 w-4 sm:h-5 sm:w-5 text-gray-700 dark:text-gray-300" />
                <Tooltip id="logoutButton" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
