import { Calendar, CheckCircle, Clock, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Module } from "../data/courseData";
import { courseDataService } from "../services/courseDataService";
import { pocketbaseService } from "../services/pocketbase";
import { logger } from "../utils/logger";
import { loadProgress, saveProgress, UserProgress } from "../utils/storage";
import { SkipToDayDialog } from "./SkipToDayDialog";

interface CourseOverviewProps {
  onLessonSelect: (lessonId: number) => void;
}

export function CourseOverview({ onLessonSelect }: CourseOverviewProps) {
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [selectedSkipDay, setSelectedSkipDay] = useState(1);
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [showEnglish, setShowEnglish] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Wait for PocketBase authentication to complete
        await pocketbaseService.waitForUserId(5000);

        // Fetch modules from PocketBase or fallback
        const fetchedModules = await courseDataService.getModules();
        setModules(fetchedModules);

        const initialProgress = await loadProgress();
        setProgress(initialProgress);
      } catch (error) {
        console.error("Failed to load data:", error);
        // Set default progress on error
        setProgress({
          completedLessons: [],
          quizScores: {},
          currentLesson: 1,
          theme: "light",
          lastAccessedAt: new Date().toISOString(),
          lastLessonAccessedId: 1,
          totalProgress: 0,
        } as UserProgress);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  if (isLoading || !progress) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          Loading course overview...
        </p>
      </div>
    );
  }

  const completedCount = Array.isArray(progress?.completedLessons)
    ? progress.completedLessons.length
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Learn the Sacred Language of the Church
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-6">
          A comprehensive 40-day course designed by Catholics for Catholics to
          master Ecclesiastical Latin for prayers, Mass participation, and
          deeper spiritual understanding. Perfect for Lent and Advent
          preparation.
        </p>

        <div
          className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-3xl mx-auto mb-8 border-l-4 border-red-900 dark:border-red-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          onClick={() => setShowEnglish((prev) => !prev)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) =>
            e.key === "Enter" && setShowEnglish((prev) => !prev)
          }
          aria-label={showEnglish ? "Show in Latin" : "Show in English"}
        >
          <div>
            {showEnglish ? (
              <blockquote className="text-gray-700 dark:text-gray-300 italic mb-2">
                "What is in question here is not only the retention within the
                choral office of the Latin language, though it is of course
                right that this should be eagerly guarded and should certainly
                not be lightly esteemed. For this language is, within the Latin
                Church, an abundant well-spring of Christian civilisation and a
                very rich treasure-trove of devotion...The traditions of the
                elders, your glory throughout long ages, must not be belittled."
              </blockquote>
            ) : (
              <blockquote className="text-gray-700 dark:text-gray-300 italic mb-2">
                "Non autem agitur hic tantummodo de retinendo in officio chorali
                eloquio latino, sane digno, quod, nedum parvi fiat, alacriter
                custodiatur, cum sit in Ecclesia Latina christiani cultus humani
                fons uberrimus et locupletissimus pietatis thesaurus...Non parvi
                pendenda sunt instituta maiorum, quae per diuturna saecula vos
                ornabant."
              </blockquote>
            )}
            <p className="text-right text-gray-600 dark:text-gray-400 font-medium">
              {showEnglish ? (
                <>
                  —{" "}
                  <span className="font-normal">
                    Pope Paul VI, Sacrificium Laudis, 1966
                  </span>
                </>
              ) : (
                <>
                  —{" "}
                  <span className="font-normal">
                    Paulus PP. VI, Sacrificium Laudis, MCMLXVI
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Progress Overview */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-center space-x-8 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-900 dark:text-red-600">
                {completedCount}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Lessons Completed
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-500">
                {progress.currentLesson}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Current Day
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-800 dark:text-blue-400">
                {Math.round((completedCount / 40) * 100)}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Progress
              </div>
            </div>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-red-900 to-yellow-700 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedCount / 40) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Course Features */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-center">
          <Calendar className="h-12 w-12 text-red-900 dark:text-red-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            40-Day Journey
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Structured daily lessons perfect for Lent or Advent spiritual
            preparation
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-center">
          <Users className="h-12 w-12 text-yellow-700 dark:text-yellow-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            By Catholics, For Catholics
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Designed with deep reverence for Catholic tradition and liturgical
            practice
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-center">
          <Clock className="h-12 w-12 text-blue-800 dark:text-blue-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Interactive Learning
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Daily quizzes, progress tracking, and hands-on practice with sacred
            texts
          </p>
        </div>
      </div>

      {/* Modules */}
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-8">
          Course Modules
        </h3>

        {modules.map((module) => {
          // Calculate progress for this specific module
          const completedLessons = Array.isArray(progress?.completedLessons)
            ? progress.completedLessons
            : [];
          const moduleLessonsCompleted = module.days.filter((day) =>
            completedLessons.includes(day),
          ).length;
          const moduleProgress = Math.round(
            (moduleLessonsCompleted / module.days.length) * 100,
          );

          logger.debug(
            `[Module ${module.id}] Days: ${module.days.join(",")} | Completed: ${moduleLessonsCompleted} | Progress: ${moduleProgress}%`,
          );

          return (
            <div
              key={module.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
            >
              <div className="p-6 border-l-4 border-red-900 dark:border-red-600">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      Module {module.id}: {module.title}
                    </h4>
                    <p className="text-gray-600 dark:text-gray-300">
                      {module.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-800 dark:text-blue-400">
                      {moduleProgress}%
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {moduleLessonsCompleted}/{module.days.length} lessons
                    </div>
                  </div>
                </div>

                {/* Progress bar for this module */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${moduleProgress}%` }}
                  ></div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {module.days.map((day) => {
                    const completedLessons = Array.isArray(
                      progress?.completedLessons,
                    )
                      ? progress.completedLessons
                      : [];
                    const currentLesson = progress?.currentLesson ?? 1;
                    const isCompleted = completedLessons.includes(day);
                    const isCurrent = day === currentLesson;
                    const isAvailable = day <= currentLesson;

                    return (
                      <button
                        key={day}
                        onClick={() => {
                          if (isAvailable) {
                            onLessonSelect(day);
                          } else {
                            setSelectedSkipDay(day);
                            setShowSkipDialog(true);
                          }
                        }}
                        className={`
                        relative p-3 rounded-lg text-sm font-medium transition-all duration-200
                        ${isCompleted
                            ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800"
                            : isCurrent
                              ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-800"
                              : isAvailable
                                ? "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                                : "bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300"
                          }
                      `}
                      >
                        Day {day}
                        {isCompleted && (
                          <CheckCircle className="absolute -top-1 -right-1 h-4 w-4 text-green-600 dark:text-green-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Call to Action */}
      <div className="text-center mt-12">
        <button
          onClick={() => onLessonSelect(progress?.currentLesson ?? 1)}
          className="bg-red-900 hover:bg-red-800 dark:bg-red-800 dark:hover:bg-red-700 text-white px-8 py-3 rounded-lg text-lg font-semibold transition-colors shadow-lg"
        >
          {completedCount === 0 ? "Begin Your Journey" : "Continue Learning"}
        </button>

        <p className="text-gray-600 dark:text-gray-400 mt-4 text-sm">
          In Nomine Patris, et Filii, et Spiritus Sancti
        </p>

        <SkipToDayDialog
          isOpen={showSkipDialog}
          onClose={() => setShowSkipDialog(false)}
          onConfirm={async (day) => {
            const currentProgress = progress ?? {
              completedLessons: [],
              currentLesson: 1,
            };
            const newProgress: UserProgress = {
              ...currentProgress,
              currentLesson: Math.min(day, 40),
              completedLessons: Array.from(
                new Set([
                  ...(Array.isArray(currentProgress.completedLessons)
                    ? currentProgress.completedLessons
                    : []),
                  ...Array.from({ length: day - 1 }, (_, i) => i + 1),
                ]),
              ).sort((a, b) => a - b),
            };
            try {
              await saveProgress(newProgress);
              setProgress(newProgress);
              onLessonSelect(day);
            } catch (error) {
              console.error("Failed to save progress:", error);
            }
            setShowSkipDialog(false);
          }}
          day={selectedSkipDay}
        />
      </div>
    </div>
  );
}
