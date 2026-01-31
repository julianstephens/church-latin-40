import { AlertTriangle, Home } from "lucide-react";
import React, { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by boundary:", error);
    console.error("Error info:", errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  private handleGoHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors flex items-center justify-center px-4">
          <div className="max-w-2xl w-full">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 border-t-4 border-red-900">
              <div className="flex items-center justify-center mb-6">
                <div className="bg-red-100 dark:bg-red-900/30 rounded-full p-4">
                  <AlertTriangle className="h-12 w-12 text-red-900 dark:text-red-400" />
                </div>
              </div>

              <h1 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-4">
                Oops! Something went wrong
              </h1>

              <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
                We encountered an unexpected error while processing your
                request. Our team has been notified of this issue.
              </p>

              {process.env.NODE_ENV === "development" && this.state.error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="font-mono text-sm text-red-800 dark:text-red-300 mb-2">
                    <span className="font-bold">Error:</span>{" "}
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <details className="mt-4">
                      <summary className="cursor-pointer font-semibold text-red-800 dark:text-red-300 mb-2">
                        Stack Trace (Development Only)
                      </summary>
                      <pre className="overflow-auto max-h-64 text-xs text-red-700 dark:text-red-400 whitespace-pre-wrap break-words">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex justify-center">
                <button
                  onClick={this.handleGoHome}
                  className="flex items-center justify-center gap-2 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                >
                  <Home className="h-5 w-5" />
                  Go Home
                </button>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-8">
                If this problem persists, please try clearing your browser cache
                or{" "}
                <a
                  target="_blank"
                  href={import.meta.env.VITE_GITHUB_ISSUES_URL}
                >
                  create an issue
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
