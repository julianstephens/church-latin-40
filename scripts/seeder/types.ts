/**
 * Shared types and interfaces for the centralized seeding system
 */

export interface SeedOptions {
  dryRun?: boolean;
  reset?: boolean;
  verbose?: boolean;
  collection?: string; // Run specific seeder only
}

export interface SeedError {
  record?: any;
  message: string;
  code?: string;
}

export interface SeedResult {
  collection: string;
  added: number;
  updated: number;
  skipped: number;
  errors: SeedError[];
  duration: number; // milliseconds
}

export interface ISeeder {
  name: string;
  collectionName: string;
  seed(options: SeedOptions): Promise<SeedResult>;
}

export interface SeedSummary {
  totalAdded: number;
  totalUpdated: number;
  totalSkipped: number;
  totalErrors: number;
  totalDuration: number;
  results: SeedResult[];
}

// Data file type definitions
export interface ModuleData {
  id: string;
  name: string;
  description: string;
}

export interface LessonData {
  id: string;
  title: string;
  moduleId: string;
  day: number;
}

export interface LessonContentData {
  lessonId: string;
  content: string[];
  materials: string[];
  practice: string[];
}

export interface QuizQuestionData {
  questionId: string;
  type: "multipleChoice" | "freeResponse" | "recitation" | "matching";
  lessonId: string;
  question: string;
  options?: string[];
  correctAnswerIndex?: number;
  correctAnswer?: string;
  explanation: string;
  vocabulary?: string[];
}

export interface QuizData {
  id: string;
  lessonId: string;
  title: string;
  description?: string;
}

export interface VocabularyData {
  word: string;
  meaning: string;
  lessonId: string;
  partOfSpeech?: string;
  frequency?: string;
  caseInfo?: string;
  conjugationInfo?: string;
  liturgicalContext?: string;
}

export interface VocabQuestionTemplateData {
  id: string;
  lessonId: string;
  type: "vocab-translation" | "vocab-matching" | "vocab-multiple-choice";
  wordCount: number;
  instruction: string;
  format?: string;
}
