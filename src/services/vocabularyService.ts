/**
 * Service for managing dynamic vocabulary question generation and word selection
 */

import {
  GenerateQuestionOptions,
  GeneratedVocabQuestion,
  VocabWord,
  VocabWordResult,
} from "../types/vocabulary";
import { logger } from "../utils/logger";
import { pocketbaseService } from "./pocketbase";

const pb = pocketbaseService.getPocketBase();

class VocabularyService {
  // Cache vocabulary by lesson to avoid repeated fetches
  private lessonVocabCache = new Map<string, VocabWord[]>();

  /**
   * Get all vocabulary words for a lesson
   */
  async getVocabByLesson(lessonId: number | string): Promise<VocabWord[]> {
    try {
      // Convert lesson ID to number
      let lessonNumber: number;
      if (typeof lessonId === "number") {
        lessonNumber = lessonId;
      } else {
        // Extract number from string like "D01", "D02", etc.
        const match = lessonId.match(/\d+/);
        lessonNumber = match ? parseInt(match[0]) : parseInt(lessonId);
      }

      // Create cache key
      const cacheKey = `lesson_${lessonNumber}`;

      // Check cache first
      if (this.lessonVocabCache.has(cacheKey)) {
        return this.lessonVocabCache.get(cacheKey)!;
      }

      // First, fetch the lesson record by lessonNumber to get its PocketBase ID
      const lessonRecord = await pb
        .collection("church_latin_lessons")
        .getFirstListItem(`lessonNumber=${lessonNumber}`);

      if (!lessonRecord) {
        logger.warn(
          `[VocabService] No lesson found with lessonNumber=${lessonNumber}`,
        );
        return [];
      }

      // Now query vocabulary using the lesson record's ID
      const records = await pb
        .collection("church_latin_vocabulary")
        .getFullList({
          filter: `lessonId = "${lessonRecord.id}"`,
          sort: "word",
        });

      const vocabWords = records as unknown as VocabWord[];

      // Cache the result
      this.lessonVocabCache.set(cacheKey, vocabWords);

      logger.debug(
        `[VocabService] Fetched ${vocabWords.length} vocabulary words for lesson ${lessonNumber}`,
      );

      return vocabWords;
    } catch (error) {
      logger.error(`Failed to fetch vocabulary for lesson ${lessonId}:`, error);
      return [];
    }
  }

  /**
   * Get a specific vocabulary word by ID
   */
  async getVocabWord(wordId: string): Promise<VocabWord | null> {
    try {
      const record = await pb
        .collection("church_latin_vocabulary")
        .getOne(wordId);
      return record as unknown as VocabWord;
    } catch (error) {
      logger.error(`Failed to fetch vocabulary word ${wordId}:`, error);
      return null;
    }
  }

  /**
   * Select N random words from a lesson's vocabulary pool
   */
  async selectRandomWords(
    lessonId: number,
    count: number,
  ): Promise<VocabWord[]> {
    const allWords = await this.getVocabByLesson(lessonId);

    if (allWords.length === 0) {
      logger.warn(`No vocabulary words found for lesson ${lessonId}`);
      return [];
    }

    // If we have fewer words than requested, return all
    if (allWords.length <= count) {
      return allWords;
    }

    // Fisher-Yates shuffle to randomly select
    const shuffled = [...allWords];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, count);
  }

  /**
   * Generate a matching question from vocabulary words
   */
  generateMatchingQuestion(words: VocabWord[]): GeneratedVocabQuestion {
    if (words.length === 0) {
      throw new Error("Cannot generate matching question without words");
    }

    // Shuffle meanings for options
    const meanings = words.map((w) => w.meaning);
    const shuffledMeanings = [...meanings];
    for (let i = shuffledMeanings.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledMeanings[i], shuffledMeanings[j]] = [
        shuffledMeanings[j],
        shuffledMeanings[i],
      ];
    }

    return {
      type: "vocab-matching",
      instruction: "Match the Latin word to its English meaning",
      usedWords: words,
      question: `Match the Latin word to its English meaning: ${words.map((w) => w.word).join(", ")}`,
      options: shuffledMeanings,
      correctAnswer: words.map((w) => `${w.word} - ${w.meaning}`),
    };
  }

  /**
   * Generate a multiple-choice question from vocabulary words
   */
  generateMultipleChoiceQuestion(
    word: VocabWord,
    allWords: VocabWord[],
  ): GeneratedVocabQuestion {
    if (!word) {
      throw new Error(
        "Cannot generate multiple-choice question without a word",
      );
    }

    // Find 3 distractors from other words
    const otherWords = allWords.filter((w) => w.id !== word.id);
    const distractors: string[] = [];

    // Get 3 random distractors (or fewer if not enough words)
    const distactorCount = Math.min(3, otherWords.length);
    for (let i = 0; i < distactorCount; i++) {
      const idx = Math.floor(Math.random() * otherWords.length);
      distractors.push(otherWords[idx].meaning);
      // Remove to avoid duplicates
      otherWords.splice(idx, 1);
    }

    // Combine correct answer with distractors
    const options = [word.meaning, ...distractors];

    // Shuffle options
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    return {
      type: "vocab-multiple-choice",
      instruction: `Which English word means "${word.word}"?`,
      usedWords: [word],
      question: `Which English word means "${word.word}"?`,
      options,
      correctAnswer: word.meaning,
    };
  }

  /**
   * Generate a translation question from a vocabulary word
   */
  generateTranslationQuestion(word: VocabWord): GeneratedVocabQuestion {
    if (!word) {
      throw new Error("Cannot generate translation question without a word");
    }

    return {
      type: "vocab-translation",
      instruction: "Translate the Latin word to English",
      usedWords: [word],
      question: `Translate: ${word.word}`,
      correctAnswer: word.meaning,
    };
  }

  /**
   * Generate a vocabulary question based on options
   */
  async generateQuestion(
    options: GenerateQuestionOptions,
  ): Promise<GeneratedVocabQuestion> {
    const { lessonId, wordCount, type } = options;

    // Get all words for the lesson
    const allWords = await this.getVocabByLesson(lessonId);

    if (allWords.length === 0) {
      throw new Error(`No vocabulary words available for lesson ${lessonId}`);
    }

    // Select random words
    const selectedWords = await this.selectRandomWords(lessonId, wordCount);

    switch (type) {
      case "vocab-matching":
        return this.generateMatchingQuestion(selectedWords);

      case "vocab-multiple-choice":
        if (selectedWords.length === 0) {
          throw new Error("No words selected for multiple-choice question");
        }
        return this.generateMultipleChoiceQuestion(selectedWords[0], allWords);

      case "vocab-translation":
        if (selectedWords.length === 0) {
          throw new Error("No words selected for translation question");
        }
        return this.generateTranslationQuestion(selectedWords[0]);

      default:
        throw new Error(`Unknown vocabulary question type: ${type}`);
    }
  }

  /**
   * Determine which words were answered correctly in a matching question
   */
  evaluateMatchingAnswers(
    correctPairs: string[],
    userAnswers: { [latinWord: string]: string },
  ): VocabWordResult[] {
    const results: VocabWordResult[] = [];

    for (const pair of correctPairs) {
      const [latinWord, meaning] = pair.split(" - ");
      const userAnswer = userAnswers[latinWord];
      const isCorrect = userAnswer === meaning;

      results.push({
        word: { word: latinWord, meaning } as VocabWord,
        isCorrect,
        userAnswer,
      });
    }

    return results;
  }

  /**
   * Check if a translation answer is correct (with some flexibility)
   */
  evaluateTranslationAnswer(
    correctAnswer: string,
    userAnswer: string,
  ): boolean {
    const normalize = (str: string) => str.trim().toLowerCase();

    const correct = normalize(correctAnswer);
    const user = normalize(userAnswer);

    // Exact match
    if (correct === user) return true;

    // Allow some common variations (could be expanded)
    const variations: { [key: string]: string[] } = {
      prayer: ["pray"],
      pray: ["prayer"],
      church: ["churches"],
      churches: ["church"],
    };

    if (variations[correct]?.includes(user)) return true;
    if (variations[user]?.includes(correct)) return true;

    return false;
  }

  /**
   * Get used words from a review event
   */
  async getUsedWordsFromQuestionId(
    vocabWordIds: string[],
  ): Promise<Map<string, VocabWord>> {
    const wordMap = new Map<string, VocabWord>();

    for (const wordId of vocabWordIds) {
      const word = await this.getVocabWord(wordId);
      if (word) {
        wordMap.set(word.id, word);
      }
    }

    return wordMap;
  }

  /**
   * Generate a word bank of N vocab words for a given user and lesson.
   * The bank includes words from any lesson at or before the provided lesson.
   * Duplicates (same word text across different lessons) are deduplicated.
   *
   * @param userId - The user ID (for future expansion, e.g., tracking user progress)
   * @param lessonId - The lesson ID (e.g., "D01", "D02", ..., "D40"). Includes all lessons <= this lesson.
   * @param bankSize - The number of words to include in the bank
   * @param seederWord - Optional. If provided, this word will be excluded from the bank.
   *                      Comparison is done on the word text, not database ID.
   * @returns An array of unique VocabWord objects for the word bank
   * @throws Error if there are not enough words to fill the requested bank size
   */
  async generateWordBank(
    userId: string,
    lessonId: string,
    bankSize: number,
    seederWord?: string,
  ): Promise<VocabWord[]> {
    try {
      // Extract lesson number from lesson ID (e.g., "D01" -> 1, "D40" -> 40)
      const lessonMatch = lessonId.match(/\d+/);
      const targetLessonNumber = lessonMatch ? parseInt(lessonMatch[0]) : 40;

      // Fetch all vocabulary words from lessons 1 to targetLessonNumber
      // Add small delays between requests to avoid overwhelming the backend
      const allWords: VocabWord[] = [];
      const MAX_RETRIES = 2;

      for (let lesson = 1; lesson <= targetLessonNumber; lesson++) {
        let retries = 0;
        let lessonWords: VocabWord[] = [];

        while (retries < MAX_RETRIES) {
          try {
            lessonWords = await this.getVocabByLesson(lesson);
            break; // Success, exit retry loop
          } catch (error) {
            retries++;
            if (retries >= MAX_RETRIES) {
              // Log but continue with next lesson instead of failing completely
              logger.warn(
                `[WordBank] Failed to fetch lesson ${lesson} after ${MAX_RETRIES} attempts, skipping`,
                error,
              );
              break;
            }
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, 100 * retries));
          }
        }

        allWords.push(...lessonWords);

        // Small delay between lessons to avoid overwhelming backend
        if (lesson < targetLessonNumber) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      if (allWords.length === 0) {
        throw new Error(
          `No vocabulary words found for lessons 1-${targetLessonNumber}`,
        );
      }

      // Deduplicate by word text (keeping first occurrence)
      const wordTextMap = new Map<string, VocabWord>();
      for (const word of allWords) {
        if (!wordTextMap.has(word.word)) {
          wordTextMap.set(word.word, word);
        }
      }

      // Convert back to array
      let uniqueWords = Array.from(wordTextMap.values());

      // Filter out the seeder word if provided (compare by word text)
      if (seederWord) {
        uniqueWords = uniqueWords.filter(
          (w) => w.word.toLowerCase() !== seederWord.toLowerCase(),
        );
        logger.debug(
          `[WordBank] Filtered out seeder word "${seederWord}", remaining: ${uniqueWords.length}`,
        );
      }

      // Check if we have enough words
      if (uniqueWords.length < bankSize) {
        logger.warn(
          `[WordBank] Requested ${bankSize} words but only ${uniqueWords.length} available ` +
            `for lessons 1-${targetLessonNumber}${seederWord ? ` (excluding seeder word "${seederWord}")` : ""}, returning all available`,
        );
        // Shuffle and return all available words instead of throwing error
        const shuffled = [...uniqueWords].sort(() => Math.random() - 0.5);
        return shuffled;
      }

      // Randomly select bankSize words
      const shuffled = [...uniqueWords].sort(() => Math.random() - 0.5);
      const selectedWords = shuffled.slice(0, bankSize);

      logger.debug(
        `[WordBank] Generated word bank for user ${userId}, lesson ${lessonId}: ` +
          `${selectedWords.length} words selected from ${uniqueWords.length} unique words`,
      );

      return selectedWords;
    } catch (error) {
      logger.error(
        `[WordBank] Failed to generate word bank for user ${userId}:`,
        error,
      );
      throw error;
    }
  }
}

export const vocabularyService = new VocabularyService();
