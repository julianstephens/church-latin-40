/**
 * Synchronous Quiz Generator - Fallback for queue misses
 *
 * This is the main-thread version of the worker generator.
 * If quiz queue is empty, this generates immediately (blocking but works).
 * Same logic as worker ensures consistency across generation methods.
 */

import type { QuizQuestion } from "../data/courseData";
import type { VocabWord } from "../types/vocabulary";

export class QuizGeneratorService {
  private readonly VOCAB_TYPES = [
    "vocab-translation",
    "vocab-multiple-choice",
    "vocab-matching",
  ];
  private readonly COVERAGE_PERCENT = 50;

  /**
   * Generate one complete quiz (main-thread fallback)
   *
   * Same logic as WorkerQuizGenerator for consistency
   */
  generateLessonQuiz(
    vocabWords: VocabWord[],
    staticQuestions: QuizQuestion[],
  ): QuizQuestion[] {
    const requiredCoverage = Math.ceil(
      vocabWords.length * (this.COVERAGE_PERCENT / 100),
    );
    const vocabQuestions = this.generateVocabQuestions(
      vocabWords,
      requiredCoverage,
    );
    const allQuestions = this.mergeAndRandomize(
      staticQuestions,
      vocabQuestions,
    );
    return allQuestions.map((q, i) => ({ ...q, questionIndex: i }));
  }

  private generateVocabQuestions(
    availableWords: VocabWord[],
    requiredWordCount: number,
  ): QuizQuestion[] {
    const questions: QuizQuestion[] = [];
    const usedWords = new Set<string>();
    let typeIndex = 0;
    let questionCounter = 1;

    while (
      usedWords.size < requiredWordCount &&
      availableWords.length > usedWords.size
    ) {
      const remainingWords = availableWords.filter((w) => !usedWords.has(w.id));
      if (remainingWords.length === 0) break;

      const currentType = this.VOCAB_TYPES[typeIndex % this.VOCAB_TYPES.length];
      typeIndex++;

      const wordsNeeded = currentType === "vocab-matching" ? 5 : 1;
      const selectedWords = this.selectRandomWords(remainingWords, wordsNeeded);

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
          throw new Error(`Unknown question type: ${currentType}`);
      }

      selectedWords.forEach((w) => usedWords.add(w.id));
      questions.push(question);
      questionCounter++;
    }

    return questions;
  }

  private mergeAndRandomize(
    contentQuestions: QuizQuestion[],
    vocabQuestions: QuizQuestion[],
  ): QuizQuestion[] {
    const allQuestions = [...contentQuestions, ...vocabQuestions];
    for (let i = allQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }
    return allQuestions;
  }

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
    } as unknown as QuizQuestion;
  }

  private generateMultipleChoiceQuestion(
    word: VocabWord,
    allWords: VocabWord[],
    index: number,
  ): QuizQuestion {
    const distractors = allWords
      .filter((w) => w.id !== word.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((w) => w.meaning);

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
    } as unknown as QuizQuestion;
  }

  private generateMatchingQuestion(
    words: VocabWord[],
    index: number,
  ): QuizQuestion {
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
    } as unknown as QuizQuestion;
  }

  private selectRandomWords(words: VocabWord[], count: number): VocabWord[] {
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, words.length));
  }
}

export const quizGeneratorService = new QuizGeneratorService();
