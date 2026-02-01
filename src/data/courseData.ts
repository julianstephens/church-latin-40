// Auto-generated from seed data files in scripts/seeder/data/
// DO NOT EDIT MANUALLY - run: pnpx tsx scripts/seeder/index.ts

// Type definitions
import type { VocabWord } from "../types/vocabulary";

export interface Lesson {
  id: number;
  title: string;
  module: number;
  materials: string[];
  content: string[];
  vocabulary: string[];
  practice: string[];
  answer?: string[];
  quiz: QuizQuestion[];
}

type BaseQuizQuestion = {
  id: number;
  questionId: string;
  question: string;
  correctAnswer: string | string[];
  explanation?: string;
  usedVocabWords?: VocabWord[]; // Vocabulary words used in this question
};

type MultipleChoiceQuestion = BaseQuizQuestion & {
  type: "multiple-choice" | "matching";
  options: string[];
};

type OtherQuestion = BaseQuizQuestion & {
  type: "translation" | "recitation";
  options?: string[];
};

export type QuizQuestion = MultipleChoiceQuestion | OtherQuestion;

export interface VocabQuestionTemplate {
  id: string;
  lessonId: number;
  type: "vocab-matching" | "vocab-multiple-choice" | "vocab-translation";
  format: "auto-generated";
  wordCount: number;
  instruction: string;
}

export interface Module {
  id: number;
  title: string;
  description: string;
  days: number[];
}

// Modules from seed data
export const modules: Module[] = [
  {
    id: 1,
    title: "Foundations of Ecclesiastical Latin",
    description:
      "Learn pronunciation, basic grammar, nouns, verbs, and essential prayers",
    days: [1, 2, 3, 4, 5, 6, 7, 8],
  },
  {
    id: 2,
    title: "Building Vocabulary and Grammar",
    description:
      "Expand your knowledge with advanced declensions, verb tenses, and the Rosary",
    days: [9, 10, 11, 12, 13, 14, 15, 16],
  },
  {
    id: 3,
    title: "Intermediate Grammar and Texts",
    description:
      "Master complex grammar with the Creed, Magnificat, and participles",
    days: [17, 18, 19, 20, 21, 22, 23, 24],
  },
  {
    id: 4,
    title: "Advanced Grammar and Liturgical Texts",
    description:
      "Study passive voice, subjunctives, and great liturgical texts",
    days: [25, 26, 27, 28, 29, 30, 31, 32],
  },
  {
    id: 5,
    title: "Mastery and Application",
    description:
      "Apply your knowledge to the Vulgate Bible, Mass, and complete prayers",
    days: [33, 34, 35, 36, 37, 38, 39, 40],
  },
];

// Vocabulary question templates from seed data
export const vocabQuestionTemplates: VocabQuestionTemplate[] = [
  {
    id: "D01-VOCAB-TRANSLATION",
    lessonId: 1,
    type: "vocab-translation",
    format: "auto-generated",
    wordCount: 1,
    instruction: "Translate the Latin word to English",
  },
  {
    id: "D02-VOCAB-MATCHING",
    lessonId: 2,
    type: "vocab-matching",
    format: "auto-generated",
    wordCount: 5,
    instruction: "Match the Latin word to its English meaning",
  },
  {
    id: "D03-VOCAB-TRANSLATION",
    lessonId: 3,
    type: "vocab-translation",
    format: "auto-generated",
    wordCount: 1,
    instruction: "Translate the Latin verb to English",
  },
  {
    id: "D04-VOCAB-MULTIPLE-CHOICE",
    lessonId: 4,
    type: "vocab-multiple-choice",
    format: "auto-generated",
    wordCount: 1,
    instruction: "Choose the correct English meaning",
  },
  {
    id: "D05-VOCAB-TRANSLATION",
    lessonId: 5,
    type: "vocab-translation",
    format: "auto-generated",
    wordCount: 1,
    instruction: "Translate the Latin word to English",
  },
  {
    id: "D06-VOCAB-TRANSLATION",
    lessonId: 6,
    type: "vocab-translation",
    format: "auto-generated",
    wordCount: 1,
    instruction: "Translate the Latin adjective to English",
  },
  {
    id: "D07-VOCAB-TRANSLATION",
    lessonId: 7,
    type: "vocab-translation",
    format: "auto-generated",
    wordCount: 1,
    instruction: "Translate the Latin preposition to English",
  },
  {
    id: "D08-VOCAB-MATCHING",
    lessonId: 8,
    type: "vocab-matching",
    format: "auto-generated",
    wordCount: 5,
    instruction: "Match the Latin word to its English meaning",
  },
  {
    id: "D04-VOCAB-MATCHING",
    lessonId: 4,
    type: "vocab-matching",
    format: "auto-generated",
    wordCount: 10,
    instruction: "Match 10 adjectives to their meanings",
  },
  {
    id: "D05-VOCAB-MATCHING",
    lessonId: 5,
    type: "vocab-matching",
    format: "auto-generated",
    wordCount: 10,
    instruction:
      "Match 10 vocabulary words from Pater Noster to their meanings",
  },
  {
    id: "D07-VOCAB-MATCHING",
    lessonId: 7,
    type: "vocab-matching",
    format: "auto-generated",
    wordCount: 10,
    instruction: "Match 10 vocabulary words from Ave Maria to their meanings",
  },
  {
    id: "D09-VOCAB-MATCHING",
    lessonId: 9,
    type: "vocab-matching",
    format: "auto-generated",
    wordCount: 10,
    instruction: "Match 10 3rd declension nouns to their meanings",
  },
  {
    id: "D11-VOCAB-MATCHING",
    lessonId: 11,
    type: "vocab-matching",
    format: "auto-generated",
    wordCount: 10,
    instruction:
      "Match 10 vocabulary words from Gloria Patri to their meanings",
  },
  {
    id: "D14-VOCAB-MATCHING",
    lessonId: 14,
    type: "vocab-matching",
    format: "auto-generated",
    wordCount: 10,
    instruction:
      "Match 10 vocabulary words related to the Rosary to their meanings",
  },
];

// NOTE: Full lesson content should be extracted from seed data
// For now, this is a placeholder. Full implementation in progress.
export const lessons: Lesson[] = [];

// NOTE: Vocabulary data should be extracted from scripts/seeder/data/vocabulary.csv
// For now, this is a placeholder. Full implementation in progress.
export const vocabulary: Record<string, string[]> = {};

// Generated: 2026-02-01T00:42:20.379Z
