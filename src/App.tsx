import { Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";
import { CourseOverview } from "./components/CourseOverview";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Header } from "./components/Header";
import { Lesson } from "./components/Lesson";
import { ThemeProvider } from "./components/ThemeProvider";
import { NotFoundPage } from "./pages/NotFoundPage";
import { pocketbaseService } from "./services/pocketbase";
import { loadProgress } from "./utils/storage";

// Lesson route component that reads from URL params
function LessonRoute() {
  const navigate = useNavigate();
  const { lessonId: lessonIdParam } = useParams<{ lessonId: string }>();
  const lessonId = parseInt(lessonIdParam || "1", 10);

  // Validate lesson ID is in valid range (1-40)
  if (isNaN(lessonId) || lessonId < 1 || lessonId > 40) {
    return <NotFoundPage />;
  }

  const handleBackToOverview = () => {
    navigate("/");
  };

  const handleNextLesson = async () => {
    const progress = await loadProgress();
    const nextLesson = Math.min(40, lessonId + 1);

    if (nextLesson <= progress.currentLesson) {
      navigate(`/lesson/${nextLesson}`);
    } else {
      navigate("/");
    }
  };

  const handlePreviousLesson = () => {
    if (lessonId > 1) {
      navigate(`/lesson/${lessonId - 1}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Header onHomeClick={handleBackToOverview} />
      <main>
        <Lesson
          lessonId={lessonId}
          onBack={handleBackToOverview}
          onNext={handleNextLesson}
          onPrevious={handlePreviousLesson}
        />
      </main>
    </div>
  );
}

function App() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  // Load initial progress, waiting for user ID to be set by ProtectedRoute
  useEffect(() => {
    const initProgress = async () => {
      try {
        // Wait for user ID to be set (with 5 second timeout)
        await pocketbaseService.waitForUserId(5000);

        // Now load progress
        await loadProgress();
      } catch (error) {
        console.error("Failed to load initial progress:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initProgress();
  }, []);

  const handleLessonSelect = (lessonId: number) => {
    navigate(`/lesson/${lessonId}`);
  };

  const handleBackToOverview = () => {
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader className="h-12 w-12 text-red-900 dark:text-red-600 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Loading your course...
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Routes>
          <Route
            path="/"
            element={
              <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
                <Header onHomeClick={handleBackToOverview} />
                <main>
                  <CourseOverview onLessonSelect={handleLessonSelect} />
                </main>
                <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-16">
                  <div className="max-w-6xl mx-auto px-4 py-8">
                    <div className="text-center">
                      <p className="text-gray-600 dark:text-gray-400 mb-2">
                        "Oremus pro invicem" - Let us pray for one another
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        Created with devotion for the greater glory of God and
                        the enrichment of Catholic faithful.
                      </p>
                    </div>
                  </div>
                </footer>
              </div>
            }
          />
          <Route path="/lesson/:lessonId" element={<LessonRoute />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
