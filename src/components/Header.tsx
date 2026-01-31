import { useAuth0 } from '@auth0/auth0-react';
import { Book, Cross, Github, LogIn, LogOut, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from 'react-tooltip';
import { disableAnonymousMode, isAnonymousMode } from '../services/anonymousSession';
import { useTheme } from './ThemeProvider';

interface HeaderProps {
  onHomeClick: () => void;
}

export function Header({ onHomeClick }: HeaderProps) {
  const { logout } = useAuth0();
  const { theme, toggleTheme } = useTheme();
  const anonMode = isAnonymousMode();
  const goto = useNavigate();
  const [shouldThrowError, setShouldThrowError] = useState(false);

  // Trigger error during render when state is set to true
  if (shouldThrowError) {
    throw new Error('Test error boundary triggered from Header');
  }

  const handleExitAnonymousMode = () => {
    disableAnonymousMode();
    window.location.href = "/";
  };

  return (
    <header className="bg-white dark:bg-gray-900 shadow-lg border-b-2 border-red-900 dark:border-red-800">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={onHomeClick}
          >
            <Cross className="h-8 w-8 text-red-900 dark:text-red-800" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Ecclesiastical Latin
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                40 Days to Sacred Language
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
              <Book className="h-4 w-4" />
              <span>Ad Majorem Dei Gloriam</span>
            </div>

            <a
              href="https://github.com/masaharumori7/church-latin-40"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="View on GitHub"
            >
              <Github className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </a>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              ) : (
                <Sun className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              )}
            </button>

            {
              anonMode ? (
                <button
                  onClick={handleExitAnonymousMode}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <LogIn data-tooltip-id="loginButton" data-tooltip-content="Login" className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  <Tooltip id="loginButton" />
                </button >
              ) :
                (
                  <button
                    onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <LogOut data-tooltip-id="logoutButton" data-tooltip-content="Logout" className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    <Tooltip id="logoutButton" />
                  </button >
                )
            }
          </div>
        </div>
      </div>
    </header>
  );
}