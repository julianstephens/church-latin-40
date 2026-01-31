import { ArrowLeft, CheckCircle, SkipForward, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { reviewService } from "../services/reviewService";
import { vocabularyService } from "../services/vocabularyService";
import { logger } from "../utils/logger";
import {
  normalizeAnswerForComparison,
  sanitizeOption,
} from "../utils/sanitization";

interface ReviewSessionProps {
  sessionSize?: number;
  onComplete?: (stats: SessionStats) => void;
  onBack?: () => void;
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
  onComplete,
  onBack,
}: ReviewSessionProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    total: 0,
    correct: 0,
    incorrect: 0,
    skipped: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);

  // Load due review items on mount
  useEffect(() => {
    const loadReviewItems = async () => {
      try {
        setIsLoading(true);
        const dueItems = await reviewService.getDueReviewItems(sessionSize);

        if (dueItems.length === 0) {
          setSessionComplete(true);
          setSessionStats({ total: 0, correct: 0, incorrect: 0, skipped: 0 });
          return;
        }

        // Fetch full question content for each item
        const reviewQuestions: ReviewQuestion[] = [];

        for (const item of dueItems) {
          try {
            // Check if this is a vocabulary question
            if (item.vocabWordId) {
              // This is a vocabulary word review - generate a simple translation question
              try {
                const vocabWord = await vocabularyService.getVocabWord(
                  item.vocabWordId,
                );
                if (vocabWord) {
                  reviewQuestions.push({
                    reviewItemId: item.id,
                    questionId: item.questionId,
                    question: `Translate: <strong>${sanitizeOption(vocabWord.word)}</strong>`,
                    correctAnswer: vocabWord.meaning,
                    type: "vocab-translation",
                    explanation: `${vocabWord.word} means "${vocabWord.meaning}"`,
                    vocabWordId: item.vocabWordId,
                    isVocabQuestion: true,
                  });
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

            console.debug(
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

        setQuestions(reviewQuestions);
        setSessionStats({
          total: reviewQuestions.length,
          correct: 0,
          incorrect: 0,
          skipped: 0,
        });
      } catch (error) {
        logger.error("[ReviewSession] Failed to load review session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadReviewItems();
  }, [sessionSize]);

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

      await reviewService.submitReviewResult(
        currentQuestion.questionId,
        currentQuestion.reviewItemId,
        isCorrect ? "correct" : "incorrect",
      );

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
      await reviewService.submitReviewResult(
        currentQuestion.questionId,
        currentQuestion.reviewItemId,
        "skipped",
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
    } else {
      setSessionComplete(true);
      onComplete?.(sessionStats);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          Loading review session...
        </p>
      </div>
    );
  }

  if (questions.length === 0 || sessionComplete) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
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

          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Course
          </button>
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
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {currentQuestion.question}
          </h2>

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
            <textarea
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Enter your answer here..."
              disabled={showAnswer}
              className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none dark:bg-gray-700 dark:text-white"
              rows={3}
            />
          ) : null}
        </div>

        {/* Answer Reveal */}
        {showAnswer && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Correct answer:
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
