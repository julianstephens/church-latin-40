/**
 * Web Worker for generating quizzes off-thread
 * Receives vocabulary + static questions, generates fresh quizzes
 *
 * No external dependencies - all logic inlined for worker isolation
 * This ensures the worker can run independently without import issues
 */

/**
 * Vocabulary word structure (inlined for worker isolation)
 */
interface VocabWord {
  id: string;
  lessonId: string;
  word: string;
  meaning: string;
  partOfSpeech?: string;
  caseInfo?: string;
  conjugationInfo?: string;
  frequency: number;
  liturgicalContext?: string;
}

/**
 * Quiz question structure (inlined for worker isolation)
 */
interface QuizQuestion {
  id?: number | string;
  questionId: string;
  questionIndex?: number;
  type: "multiple-choice" | "matching" | "translation" | "recitation";
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  isVocabQuestion?: boolean;
  usedVocabWords?: VocabWord[];
}

interface GenerateQuizMessage {
  type: "GENERATE_QUIZ";
  lessonId: number;
  vocabWords: VocabWord[];
  staticQuestions: QuizQuestion[];
}

interface QuizReadyMessage {
  type: "QUIZ_READY";
  lessonId: number;
  quizId: string;
  quiz: QuizQuestion[];
}

/**
 * Standalone generator class - duplicated from main thread version
 * No external imports for worker isolation
 */
class WorkerQuizGenerator {
  private readonly VOCAB_TYPES = [
    "vocab-translation",
    "vocab-multiple-choice",
    "vocab-matching",
  ];
  private readonly COVERAGE_PERCENT = 50;

  /**
   * Main entry point: Generate one complete quiz
   *
   * @param vocabWords - All vocabulary words for the lesson
   * @param staticQuestions - Static content questions from PocketBase
   * @returns Complete quiz with mixed content + vocab questions
   */
  generateQuiz(
    vocabWords: VocabWord[],
    staticQuestions: QuizQuestion[],
  ): QuizQuestion[] {
    // 1. Calculate how many vocab words need testing (minimum 50%)
    const requiredCoverage = Math.ceil(
      vocabWords.length * (this.COVERAGE_PERCENT / 100),
    );

    // 2. Generate vocabulary questions with cycled types
    const vocabQuestions = this.generateVocabQuestions(
      vocabWords,
      requiredCoverage,
    );

    // 3. Merge static + vocab, then shuffle for variety
    const allQuestions = this.mergeAndRandomize(
      staticQuestions,
      vocabQuestions,
    );

    // 4. Assign sequential indices (0-based)
    return allQuestions.map((q, i) => ({ ...q, questionIndex: i }));
  }

  /**
   * Generate vocabulary questions by cycling through types
   *
   * Cycling ensures approximately equal distribution:
   *   Q1: Translation (1 word)
   *   Q2: Multiple-choice (1 word)
   *   Q3: Matching (5 words)
   *   Q4: Translation (1 word)
   *   ... repeat until coverage requirement met
   *
   * @param availableWords - Pool of vocabulary words
   * @param requiredWordCount - Minimum words to cover (50% of total)
   * @returns Array of generated vocab questions
   */
  private generateVocabQuestions(
    availableWords: VocabWord[],
    requiredWordCount: number,
  ): QuizQuestion[] {
    const questions: QuizQuestion[] = [];
    const usedWords = new Set<string>();
    let typeIndex = 0;
    let questionCounter = 1;

    // Keep generating until coverage requirement met
    while (
      usedWords.size < requiredWordCount &&
      availableWords.length > usedWords.size
    ) {
      // Get remaining unused words
      const remainingWords = availableWords.filter((w) => !usedWords.has(w.id));
      if (remainingWords.length === 0) break;

      // Cycle through types: translation → multiple-choice → matching → translation...
      const currentType = this.VOCAB_TYPES[typeIndex % this.VOCAB_TYPES.length];
      typeIndex++;

      // Determine how many words this question uses
      const wordsNeeded = currentType === "vocab-matching" ? 5 : 1;
      const selectedWords = this.selectRandomWords(remainingWords, wordsNeeded);

      // Generate question based on type
      let question: QuizQuestion;
      switch (currentType) {
        case "vocab-translation":
          question = this.generateTranslationQuestion(
            selectedWords[0],
            questionCounter,
          );
          break;
        case "vocab-multiple-choice":
          question = this.generateMultipleChoiceQuestion(
            selectedWords[0],
            availableWords,
            questionCounter,
          );
          break;
        case "vocab-matching":
          question = this.generateMatchingQuestion(
            selectedWords,
            questionCounter,
          );
          break;
        default:
          // This should never happen, but TypeScript needs exhaustiveness
          throw new Error(`Unknown question type: ${currentType}`);
      }

      // Mark words as used and add question to output
      selectedWords.forEach((w) => usedWords.add(w.id));
      questions.push(question);
      questionCounter++;
    }

    return questions;
  }

  /**
   * Shuffle all questions using Fisher-Yates algorithm
   *
   * Prevents predictable ordering (e.g., "vocab questions always at end")
   * Results in content and vocab questions randomly interspersed
   */
  private mergeAndRandomize(
    contentQuestions: QuizQuestion[],
    vocabQuestions: QuizQuestion[],
  ): QuizQuestion[] {
    const allQuestions = [...contentQuestions, ...vocabQuestions];

    // Fisher-Yates shuffle for uniform randomization
    for (let i = allQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }

    return allQuestions;
  }

  /**
   * Generate a translation question
   * User translates Latin word to English
   */
  private generateTranslationQuestion(
    word: VocabWord,
    index: number,
  ): QuizQuestion {
    return {
      id: `${word.lessonId}-VOCAB-TRANS-${index}`,
      questionId: `VOCAB-TRANS-${word.id}`,
      type: "translation",
      question: `Translate to English: "${word.word}"`,
      correctAnswer: word.meaning,
      explanation: `${word.word} means "${word.meaning}".`,
      isVocabQuestion: true,
      usedVocabWords: [word],
    };
  }

  /**
   * Generate a multiple-choice question
   * User selects correct English meaning from 4 options
   */
  private generateMultipleChoiceQuestion(
    word: VocabWord,
    allWords: VocabWord[],
    index: number,
  ): QuizQuestion {
    // Select 3 distractor words (different from correct word)
    const distractors = allWords
      .filter((w) => w.id !== word.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((w) => w.meaning);

    // Mix correct answer with distractors and shuffle
    const options = [word.meaning, ...distractors].sort(
      () => Math.random() - 0.5,
    );

    return {
      id: `${word.lessonId}-VOCAB-MC-${index}`,
      questionId: `VOCAB-MC-${word.id}`,
      type: "multiple-choice",
      question: `What does "${word.word}" mean?`,
      options,
      correctAnswer: word.meaning,
      explanation: `${word.word} means "${word.meaning}".`,
      isVocabQuestion: true,
      usedVocabWords: [word],
    };
  }

  /**
   * Generate a matching question
   * User matches N Latin words to N English meanings
   */
  private generateMatchingQuestion(
    words: VocabWord[],
    index: number,
  ): QuizQuestion {
    // Get meanings and shuffle them for options
    const meanings = words.map((w) => w.meaning);
    const shuffledMeanings = [...meanings].sort(() => Math.random() - 0.5);

    return {
      id: `${words[0].lessonId}-VOCAB-MATCH-${index}`,
      questionId: `VOCAB-MATCH-${index}`,
      type: "matching",
      question: `Match each Latin word to its meaning:\n${words
        .map((w) => w.word)
        .join(", ")}`,
      options: shuffledMeanings,
      correctAnswer: words.map((w) => `${w.word} - ${w.meaning}`),
      explanation: `Correct pairings: ${words
        .map((w) => `${w.word} = ${w.meaning}`)
        .join("; ")}`,
      isVocabQuestion: true,
      usedVocabWords: words,
    };
  }

  /**
   * Randomly select N words from available pool
   * Used to select words for each generated question
   */
  private selectRandomWords(words: VocabWord[], count: number): VocabWord[] {
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, words.length));
  }
}

// Create generator instance
const generator = new WorkerQuizGenerator();

/**
 * Listen for generation requests from main thread
 */
self.onmessage = (event: MessageEvent<GenerateQuizMessage>) => {
  const { type, lessonId, vocabWords, staticQuestions } = event.data;

  if (type === "GENERATE_QUIZ") {
    // Generate one quiz
    const quiz = generator.generateQuiz(vocabWords, staticQuestions);

    // Send back to main thread with metadata
    self.postMessage({
      type: "QUIZ_READY",
      lessonId,
      quizId: `quiz_${lessonId}_${Date.now()}`,
      quiz,
    } as QuizReadyMessage);
  }
};
