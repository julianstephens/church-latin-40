import {
  ArrowLeft,
  CheckCircle,
  List,
  SkipForward,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ReviewItem, reviewService } from "../services/reviewService";
import { vocabularyService } from "../services/vocabularyService";
import { VocabWord } from "../types/vocabulary";
import { logger } from "../utils/logger";
import {
  normalizeAnswerForComparison,
  sanitizeOption,
} from "../utils/sanitization";

interface ReviewSessionProps {
  sessionSize?: number;
  maxLessonId?: number; // Maximum lesson ID user has completed or is currently on
  onComplete?: (stats: SessionStats) => void;
  onBack?: () => void;
  onViewQueue?: () => void;
}

interface SessionStats {
  total: number;
  correct: number;
  incorrect: number;
  skipped: number;
}

interface ReviewQuestion {
  reviewItemId: string;
  questionId: string;
  lessonId: string;
  question: string;
  correctAnswer: string;
  options?: string[];
  type: string;
  explanation?: string;
  // Vocabulary question fields
  vocabWordId?: string;
  isVocabQuestion?: boolean;
}

export function ReviewSession({
  sessionSize = 10,
  maxLessonId = 1,
  onComplete,
  onBack,
  onViewQueue,
}: ReviewSessionProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    total: 0,
    correct: 0,
    incorrect: 0,
    skipped: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [shouldRestoreSession, setShouldRestoreSession] = useState<
    boolean | null
  >(null);
  const [sessionId] = useState(() => {
    // Check if there's a cached session we're restoring
    const cachedSession = localStorage.getItem("reviewSessionCache");
    if (cachedSession) {
      try {
        const cache = JSON.parse(cachedSession);
        if (cache.sessionId) {
          return cache.sessionId;
        }
      } catch {
        // Ignore parse errors
      }
    }
    // Otherwise create a new session ID
    return Date.now().toString();
  });

  // Save session state to localStorage
  useEffect(() => {
    if (questions.length > 0 && !sessionComplete) {
      const sessionCache = {
        sessionId,
        currentIndex,
        userAnswer,
        showAnswer,
        questionCount: questions.length,
        sessionStats,
        timestamp: Date.now(),
      };
      localStorage.setItem("reviewSessionCache", JSON.stringify(sessionCache));
    }
  }, [
    currentIndex,
    userAnswer,
    showAnswer,
    questions.length,
    sessionId,
    sessionStats,
    sessionComplete,
  ]);

  // Check for incomplete cached sessions on mount
  useEffect(() => {
    const cachedSession = localStorage.getItem("reviewSessionCache");
    if (cachedSession) {
      try {
        const cache = JSON.parse(cachedSession);
        const cacheAge = Date.now() - (cache.timestamp || 0);
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

        if (cacheAge >= TWENTY_FOUR_HOURS) {
          // Clear old sessions
          localStorage.removeItem("reviewSessionCache");
          logger.debug(
            "[ReviewSession] Cleared cached session older than 24 hours",
          );
          setShouldRestoreSession(false);
        } else if (cache.currentIndex < cache.questionCount) {
          // Check if the session has actually been started
          const hasStarted =
            cache.currentIndex > 0 ||
            (cache.sessionStats?.correct ?? 0) > 0 ||
            (cache.sessionStats?.incorrect ?? 0) > 0 ||
            (cache.sessionStats?.skipped ?? 0) > 0;

          if (hasStarted) {
            // Show resume dialog for incomplete sessions that have been started
            setShowResumeDialog(true);
            logger.debug(
              "[ReviewSession] Found incomplete session, showing resume dialog",
            );
          } else {
            // Session hasn't been started yet, start fresh without prompting
            localStorage.removeItem("reviewSessionCache");
            setShouldRestoreSession(false);
            logger.debug(
              "[ReviewSession] Found unstarted session, starting fresh",
            );
          }
        } else {
          // Session is complete, start fresh
          localStorage.removeItem("reviewSessionCache");
          setShouldRestoreSession(false);
        }
      } catch (error) {
        logger.warn("[ReviewSession] Failed to check cached session:", error);
        localStorage.removeItem("reviewSessionCache");
        setShouldRestoreSession(false);
      }
    } else {
      // No cached session exists, start fresh
      setShouldRestoreSession(false);
    }
  }, []);

  // Load due review items on mount
  useEffect(() => {
    const loadReviewItems = async () => {
      try {
        setIsLoading(true);
        // Load significantly more items than needed to account for filtering and deduplication
        const dueItems = await reviewService.getDueReviewItems(sessionSize * 5);

        if (dueItems.length === 0) {
          setSessionComplete(true);
          setSessionStats({ total: 0, correct: 0, incorrect: 0, skipped: 0 });
          return;
        }

        // Fetch full question content for each item
        const reviewQuestions: ReviewQuestion[] = [];
        const seenReviewItemIds = new Set<string>();
        const vocabWordCache = new Map<
          string,
          { word: string; meaning: string; partOfSpeech?: string }
        >();
        const usedTemplates = new Map<string, Set<string>>(); // Track which templates have been used per vocab word
        const availableTemplates = ["translation", "definition"];

        // Function to create a vocab question with a specific template
        const createVocabQuestion = async (
          item: ReviewItem,
          vocabWord: VocabWord,
          template: string,
        ): Promise<ReviewQuestion> => {
          let question = `Translate: <strong>${sanitizeOption(vocabWord.word)}</strong>`;
          let type = "vocab-translation";
          let options = undefined;

          if (template === "definition") {
            // Ask for definition matching
            question = `Which definition matches <strong>${sanitizeOption(vocabWord.word)}</strong>?`;
            type = "vocab-definition";

            try {
              // Generate word bank for distractors (3 additional words)
              // Cap lesson ID to maxLessonId to avoid requesting vocabulary from lessons not yet completed
              const maxLessonForBank = Math.min(
                parseInt(item.lessonId.match(/\d+/)?.[0] || "1"),
                maxLessonId,
              );
              const cappedLessonId = `D${maxLessonForBank.toString().padStart(2, "0")}`;

              const distractorWords = await vocabularyService.generateWordBank(
                "anonymous", // Anonymous user for guest sessions
                cappedLessonId, // Capped lesson ID
                3, // Request 3 distractor words
                vocabWord.word, // Exclude the correct word by its text
              );

              // Combine correct answer with distractors and shuffle
              const allOptions = [
                vocabWord.meaning,
                ...distractorWords.map((w: VocabWord) => w.meaning),
              ];
              options = allOptions.sort(() => Math.random() - 0.5);
            } catch (error) {
              logger.warn(
                `[ReviewSession] Could not generate distractors for ${vocabWord.word}:`,
                error,
              );
              // Fallback to just the correct answer if generation fails
              options = [vocabWord.meaning];
            }
          }

          return {
            reviewItemId: item.id,
            questionId: item.questionId,
            lessonId: item.lessonId,
            question,
            correctAnswer: vocabWord.meaning,
            options,
            type,
            explanation: `${vocabWord.word} means "${vocabWord.meaning}"`,
            vocabWordId: item.vocabWordId,
            isVocabQuestion: true,
          };
        };

        // Function to get a random unused template for a vocab word
        const getRandomTemplate = (vocabWordId: string): string => {
          const usedForThisWord =
            usedTemplates.get(vocabWordId) || new Set<string>();
          let availableForThisWord = availableTemplates.filter(
            (t) => !usedForThisWord.has(t),
          );

          // If all templates are used, reset and use all again
          if (availableForThisWord.length === 0) {
            usedTemplates.delete(vocabWordId);
            availableForThisWord = availableTemplates;
          }

          // Pick a random unused template
          const template =
            availableForThisWord[
              Math.floor(Math.random() * availableForThisWord.length)
            ];
          usedForThisWord.add(template);
          usedTemplates.set(vocabWordId, usedForThisWord);

          return template;
        };

        // First pass: load unique items
        for (const item of dueItems) {
          // Skip duplicate review items
          if (seenReviewItemIds.has(item.id)) {
            continue;
          }
          seenReviewItemIds.add(item.id);

          try {
            // Check if this is a vocabulary question
            if (item.vocabWordId) {
              try {
                const vocabWord = await vocabularyService.getVocabWord(
                  item.vocabWordId,
                );
                if (vocabWord) {
                  vocabWordCache.set(item.vocabWordId, vocabWord);
                  const template = getRandomTemplate(item.vocabWordId);
                  const vocabQuestion = await createVocabQuestion(
                    item,
                    vocabWord,
                    template,
                  );
                  reviewQuestions.push(vocabQuestion);
                  continue;
                }
              } catch (vocabError) {
                logger.warn(
                  `[ReviewSession] Failed to load vocabulary word ${item.vocabWordId}:`,
                  vocabError,
                );
              }
            }

            const questionContent = await reviewService.getReviewQuestion(
              item.lessonId,
              item.questionId,
            );

            logger.debug(
              `[ReviewSession] Loaded question ${item.questionId}, type: ${questionContent.type}, correctAnswer: ${typeof questionContent.correctAnswer}`,
            );

            // Skip matching questions - identified by empty correctAnswer or type === "matching"
            const isMatchingQuestion =
              questionContent.type === "matching" ||
              (typeof questionContent.correctAnswer !== "string" &&
                (!Array.isArray(questionContent.correctAnswer) ||
                  questionContent.correctAnswer.length === 0));

            if (isMatchingQuestion) {
              logger.debug(
                `[ReviewSession] Skipping matching question ${item.questionId} (requires special UI)`,
              );
              continue;
            }

            reviewQuestions.push({
              reviewItemId: item.id,
              questionId: item.questionId,
              lessonId: item.lessonId,
              question: questionContent.question,
              correctAnswer:
                typeof questionContent.correctAnswer === "string"
                  ? questionContent.correctAnswer
                  : (questionContent.correctAnswer as string[]).join(", "),
              options: questionContent.options,
              type: questionContent.type,
              explanation: questionContent.explanation,
            });
          } catch (error) {
            logger.warn(
              `[ReviewSession] Failed to load question ${item.questionId}:`,
              error,
            );
          }
        }

        // If we have fewer than sessionSize questions, add repeats of vocabulary words with different templates
        if (reviewQuestions.length < sessionSize) {
          const repeatQuestions: ReviewQuestion[] = [];
          const vocabQuestions = reviewQuestions.filter(
            (q) => q.isVocabQuestion,
          );

          // Keep generating repeats until we reach sessionSize
          while (
            repeatQuestions.length < sessionSize - reviewQuestions.length &&
            vocabQuestions.length > 0
          ) {
            // Shuffle vocab questions for random selection
            const shuffledVocab = [...vocabQuestions].sort(
              () => Math.random() - 0.5,
            );

            for (const vocabQuestion of shuffledVocab) {
              if (
                repeatQuestions.length >=
                sessionSize - reviewQuestions.length
              )
                break;

              const vocabWordId = vocabQuestion.vocabWordId;
              if (!vocabWordId) continue;

              const vocabWord = vocabWordCache.get(vocabWordId);
              if (!vocabWord) continue;

              // Get a random unused template for this word
              const template = getRandomTemplate(vocabWordId);

              // Create a new vocab question with the selected template
              const repeatQuestion = await createVocabQuestion(
                {
                  id: vocabQuestion.reviewItemId,
                  questionId: vocabQuestion.questionId,
                  lessonId: vocabQuestion.lessonId,
                  vocabWordId,
                } as ReviewItem,
                vocabWord as VocabWord,
                template,
              );
              repeatQuestions.push(repeatQuestion);
            }
          }

          reviewQuestions.push(...repeatQuestions);
        }

        // If 7 or fewer items available, reduce session size to avoid duplicates
        let effectiveSessionSize = sessionSize;
        if (dueItems.length <= 7) {
          effectiveSessionSize = dueItems.length;
          logger.debug(
            `[ReviewSession] Only ${dueItems.length} due items available. Reducing session size from ${sessionSize} to ${effectiveSessionSize} to avoid duplicates.`,
          );
        }

        // Ensure exactly effectiveSessionSize questions
        const finalQuestions = reviewQuestions.slice(0, effectiveSessionSize);

        // Shuffle the questions for variety in question order
        const shuffledQuestions = finalQuestions.sort(
          () => Math.random() - 0.5,
        );

        logger.debug(
          `[ReviewSession] Loaded ${shuffledQuestions.length} questions for session (shuffled)`,
        );

        setQuestions(shuffledQuestions);
        setSessionStats({
          total: finalQuestions.length,
          correct: 0,
          incorrect: 0,
          skipped: 0,
        });

        // Try to restore session state from cache only if user chose to resume
        if (shouldRestoreSession === true) {
          const cachedSession = localStorage.getItem("reviewSessionCache");
          if (cachedSession) {
            try {
              const cache = JSON.parse(cachedSession);
              // Verify the cached session matches current session (same session ID and question count)
              if (
                cache.sessionId === sessionId &&
                cache.questionCount === finalQuestions.length &&
                cache.currentIndex < finalQuestions.length
              ) {
                setCurrentIndex(cache.currentIndex);
                setUserAnswer(cache.userAnswer);
                setShowAnswer(cache.showAnswer);
                if (cache.sessionStats) {
                  // Ensure the restored stats have the correct total and valid values
                  const restoredStats: SessionStats = {
                    total: finalQuestions.length,
                    correct: cache.sessionStats.correct ?? 0,
                    incorrect: cache.sessionStats.incorrect ?? 0,
                    skipped: cache.sessionStats.skipped ?? 0,
                  };
                  setSessionStats(restoredStats);
                  logger.debug(
                    `[ReviewSession] Restored stats: ${restoredStats.correct}/${restoredStats.total} correct, ${restoredStats.incorrect} incorrect, ${restoredStats.skipped} skipped`,
                  );
                }
                logger.debug("[ReviewSession] Restored session from cache");
              } else {
                // Clear cache if it's from a different session
                localStorage.removeItem("reviewSessionCache");
                logger.debug(
                  "[ReviewSession] Cache validation failed, cleared cache",
                );
              }
            } catch (error) {
              logger.warn(
                "[ReviewSession] Failed to restore session cache:",
                error,
              );
              localStorage.removeItem("reviewSessionCache");
            }
          }
        } else if (shouldRestoreSession === false) {
          // User chose to start a new session, clear the cache
          localStorage.removeItem("reviewSessionCache");
          logger.debug("[ReviewSession] Starting new session, cleared cache");
        }
      } catch (error) {
        logger.error("[ReviewSession] Failed to load review session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Only load if user has made a decision about resuming (or if no cached session exists)
    if (shouldRestoreSession !== null) {
      loadReviewItems();
    }
  }, [sessionSize, shouldRestoreSession, maxLessonId, sessionId]);

  const currentQuestion = questions[currentIndex];
  const progress = Math.round(((currentIndex + 1) / questions.length) * 100);

  const handleSubmitAnswer = async () => {
    if (!currentQuestion) return;

    setIsSubmitting(true);
    try {
      let isCorrect = false;

      if (
        currentQuestion.isVocabQuestion &&
        currentQuestion.type === "vocab-translation"
      ) {
        // For vocabulary questions, use fuzzy matching from vocabularyService
        isCorrect = vocabularyService.evaluateTranslationAnswer(
          currentQuestion.correctAnswer,
          userAnswer,
        );
      } else {
        // For regular questions, use exact matching
        const normalizedUserAnswer = normalizeAnswerForComparison(userAnswer);
        const normalizedCorrectAnswer = normalizeAnswerForComparison(
          currentQuestion.correctAnswer,
        );
        isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
      }

      logger.debug(
        `[ReviewSession] Submitting answer for question ${currentQuestion.questionId}: ${isCorrect ? "correct" : "incorrect"}`,
      );
      await reviewService.submitReviewResult(
        currentQuestion.lessonId,
        currentQuestion.questionId,
        isCorrect ? "correct" : "incorrect",
      );
      logger.debug(
        `[ReviewSession] Successfully submitted answer for question ${currentQuestion.questionId}`,
      );

      setIsAnswerCorrect(isCorrect);
      setSessionStats((prev) => ({
        ...prev,
        [isCorrect ? "correct" : "incorrect"]:
          prev[isCorrect ? "correct" : "incorrect"] + 1,
      }));

      setShowAnswer(true);
    } catch (error) {
      logger.error("[ReviewSession] Failed to submit review result:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!currentQuestion) return;

    try {
      logger.debug(
        `[ReviewSession] Skipping question ${currentQuestion.questionId}`,
      );
      await reviewService.submitReviewResult(
        currentQuestion.lessonId,
        currentQuestion.questionId,
        "skipped",
      );
      logger.debug(
        `[ReviewSession] Successfully marked question ${currentQuestion.questionId} as skipped`,
      );

      setSessionStats((prev) => ({
        ...prev,
        skipped: prev.skipped + 1,
      }));

      advanceQuestion();
    } catch (error) {
      logger.error("[ReviewSession] Failed to skip question:", error);
    }
  };

  const advanceQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer("");
      setShowAnswer(false);
      setIsAnswerCorrect(null);
    } else {
      setSessionComplete(true);
      onComplete?.(sessionStats);
      // Clear cache when session completes
      localStorage.removeItem("reviewSessionCache");
    }
  };

  // Show resume dialog if there's a cached session
  if (showResumeDialog) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Resume Practice Session?
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            You have an incomplete practice session in progress. Would you like
            to resume where you left off or start a fresh session?
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setShouldRestoreSession(true);
                setShowResumeDialog(false);
              }}
              className="flex-1 px-4 py-3 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Resume
            </button>
            <button
              onClick={() => {
                // Immediately clear the cache when starting fresh
                localStorage.removeItem("reviewSessionCache");
                setShouldRestoreSession(false);
                setShowResumeDialog(false);
                // Force reload by restarting the page
                window.location.reload();
              }}
              className="flex-1 px-4 py-3 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold rounded-lg transition-colors"
            >
              Start New
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full md:w-1/2 min-h-screen mx-auto px-4 py-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          Loading review session...
        </p>
      </div>
    );
  }

  if (questions.length === 0 || sessionComplete) {
    return (
      <div className="mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {questions.length === 0 ? "No Review Items" : "Session Complete!"}
          </h2>

          {questions.length > 0 && (
            <div className="space-y-3 mb-6 text-left max-w-md mx-auto">
              <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <span className="text-green-900 dark:text-green-300 font-semibold">
                  Correct:
                </span>
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {sessionStats.correct}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <span className="text-red-900 dark:text-red-300 font-semibold">
                  Incorrect:
                </span>
                <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {sessionStats.incorrect}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <span className="text-yellow-900 dark:text-yellow-300 font-semibold">
                  Skipped:
                </span>
                <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {sessionStats.skipped}
                </span>
              </div>
            </div>
          )}

          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {questions.length === 0
              ? "You're all caught up! No review items are due right now."
              : `Great job! You've completed ${sessionStats.total} review item${sessionStats.total === 1 ? "" : "s"}.`}
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onBack}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Course
            </button>
            <button
              onClick={onViewQueue}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-purple-700 hover:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors duration-200"
            >
              <List className="h-4 w-4" />
              View Queue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Question {currentIndex + 1} of {questions.length}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Progress
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-8">
        <div
          className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {/* Question Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
        <div className="mb-6">
          <h2
            className="text-xl sm:text-2xl font-normal text-gray-900 dark:text-white mb-4"
            dangerouslySetInnerHTML={{ __html: currentQuestion.question }}
          />

          {currentQuestion.options && currentQuestion.options.length > 0 && (
            <div className="space-y-2 mb-4">
              <label className="text-sm text-gray-600 dark:text-gray-400">
                Options:
              </label>
              <div className="space-y-2">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => setUserAnswer(option)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-colors duration-200 ${
                      userAnswer === option
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                    }`}
                  >
                    <span className="text-gray-900 dark:text-white">
                      {sanitizeOption(option)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!currentQuestion.options || currentQuestion.options.length === 0 ? (
            <input
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Enter your answer here..."
              disabled={showAnswer}
              onKeyDown={(e) => {
                if (e.key === "Enter" && userAnswer && !showAnswer) {
                  handleSubmitAnswer();
                }
              }}
              className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none dark:bg-gray-700 dark:text-white"
            />
          ) : null}
        </div>

        {/* Answer Reveal */}
        {showAnswer && (
          <div
            className={`mb-6 p-4 border-l-4 rounded ${
              isAnswerCorrect
                ? "bg-green-50 dark:bg-green-900/20 border-green-500"
                : "bg-red-50 dark:bg-red-900/20 border-red-500"
            }`}
          >
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {isAnswerCorrect ? "Correct!" : "Correct answer:"}
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              {sanitizeOption(currentQuestion.correctAnswer)}
            </p>

            {currentQuestion.explanation && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Explanation:
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {sanitizeOption(currentQuestion.explanation)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {!showAnswer ? (
            <>
              <button
                onClick={handleSubmitAnswer}
                disabled={!userAnswer || isSubmitting}
                className="flex-1 px-4 py-3 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-400 dark:bg-blue-600 dark:hover:bg-blue-700 dark:disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors duration-200"
              >
                {isSubmitting ? "Submitting..." : "Check Answer"}
              </button>
              <button
                onClick={handleSkip}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 dark:bg-yellow-700 dark:hover:bg-yellow-800 dark:disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <SkipForward className="h-4 w-4" />
                Skip
              </button>
            </>
          ) : (
            <button
              onClick={advanceQuestion}
              className="flex-1 px-4 py-3 bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700 text-white font-semibold rounded-lg transition-colors duration-200"
            >
              {currentIndex === questions.length - 1 ? "Finish" : "Next"}
            </button>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto mb-1" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Correct</p>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">
            {sessionStats.correct}
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mx-auto mb-1" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Incorrect</p>
          <p className="text-lg font-bold text-red-600 dark:text-red-400">
            {sessionStats.incorrect}
          </p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
          <SkipForward className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mx-auto mb-1" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Skipped</p>
          <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
            {sessionStats.skipped}
          </p>
        </div>
      </div>
    </div>
  );
}
