/**
 * Vocabulary-related types for dynamic question generation
 */

export type PartOfSpeech =
    | "noun"
    | "verb"
    | "adjective"
    | "adverb"
    | "preposition"
    | "pronoun"
    | "conjunction"
    | "other";

export type VocabQuestionType = "vocab-matching" | "vocab-multiple-choice" | "vocab-translation";

export type FrequencyLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Individual vocabulary word record from PocketBase
 */
export interface VocabWord {
    id: string;
    lessonId: string;
    word: string;
    meaning: string;
    partOfSpeech?: PartOfSpeech;
    caseInfo?: string;
    conjugationInfo?: string;
    frequency: FrequencyLevel;
    liturgicalContext?: string;
    created?: string;
    updated?: string;
}

/**
 * Question template definition for vocabulary questions
 */
export interface VocabQuestionTemplate {
    id: string;
    lessonId: number;
    type: VocabQuestionType;
    format: "auto-generated";
    wordCount: number;
    instruction: string;
    templateId: string; // e.g., "D02-VOCAB-MATCHING"
}

/**
 * Dynamically generated vocabulary question
 */
export interface GeneratedVocabQuestion {
    type: VocabQuestionType;
    instruction: string;
    usedWords: VocabWord[]; // Words actually used in this question
    question: string;
    options?: string[]; // For matching/multiple-choice
    correctAnswer: string | string[]; // Depends on type
    explanations?: { [wordId: string]: string; };
}

/**
 * Result of a vocabulary word in a quiz/review session
 */
export interface VocabWordResult {
    word: VocabWord;
    isCorrect: boolean;
    userAnswer?: string;
}

/**
 * Options for generating vocabulary questions
 */
export interface GenerateQuestionOptions {
    lessonId: number;
    wordCount: number;
    type: VocabQuestionType;
    excludeWordIds?: string[];
    frequency?: FrequencyLevel | FrequencyLevel[];
}
