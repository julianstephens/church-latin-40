export interface SchemaField {
  name: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  options?: Record<string, unknown>;
  values?: string[]; // for select fields
  maxSelect?: number; // for relation/select fields
  collectionId?: string; // for relation fields
  cascadeDelete?: boolean; // for relation fields
}

export interface CollectionSchema {
  name: string;
  displayName: string;
  type: string;
  fields: SchemaField[];
  indexes?: string[][];
}

export const COLLECTIONS: CollectionSchema[] = [
  {
    name: "church_latin_modules",
    displayName: "Church Latin Modules",
    type: "base",
    fields: [
      { name: "resourceId", type: "text", required: true, unique: true },
      { name: "moduleNumber", type: "number", required: true, unique: true },
      { name: "name", type: "text", required: true },
      { name: "description", type: "text" },
      { name: "lessonCount", type: "number" },
      { name: "displayOrder", type: "number" },
    ],
    indexes: [["resourceId"], ["moduleNumber"]],
  },
  {
    name: "church_latin_lessons",
    displayName: "Church Latin Lessons",
    type: "base",
    fields: [
      { name: "resourceId", type: "text", required: true, unique: true },
      {
        name: "moduleId",
        type: "relation",
        required: true,
        collectionId: "church_latin_modules",
        maxSelect: 1,
        cascadeDelete: true,
      },
      { name: "lessonNumber", type: "number", required: true, unique: true },
      { name: "name", type: "text", required: true },
      { name: "displayOrder", type: "number" },
    ],
    indexes: [["resourceId"], ["lessonNumber"]],
  },
  {
    name: "church_latin_lesson_content",
    displayName: "Church Latin Lesson Content",
    type: "base",
    fields: [
      { name: "resourceId", type: "text", required: true, unique: true },
      {
        name: "lessonId",
        type: "relation",
        required: true,
        collectionId: "church_latin_lessons",
        maxSelect: 1,
        cascadeDelete: true,
      },
      { name: "latinContent", type: "text" },
      { name: "englishTranslation", type: "text" },
      { name: "vocabularyList", type: "json" },
      { name: "grammarExplanation", type: "text" },
      { name: "pronunciationGuide", type: "text" },
      { name: "culturalNotes", type: "text" },
    ],
    indexes: [["resourceId"], ["lessonId"]],
  },
  {
    name: "church_latin_quiz_questions",
    displayName: "Church Latin Quiz Questions",
    type: "base",
    fields: [
      { name: "resourceId", type: "text", required: true, unique: true },
      {
        name: "quizId",
        type: "relation",
        collectionId: "church_latin_quizzes",
        maxSelect: 1,
        cascadeDelete: true,
      },
      {
        name: "lessonId",
        type: "relation",
        required: true,
        collectionId: "church_latin_lessons",
        maxSelect: 1,
        cascadeDelete: true,
      },
      { name: "questionId", type: "text", required: true, unique: true },
      { name: "questionIndex", type: "number" },
      {
        name: "type",
        type: "select",
        values: ["multiple-choice", "matching", "translation", "recitation"],
      },
      { name: "question", type: "text", required: true },
      { name: "options", type: "json" },
      { name: "correctAnswer", type: "text" },
      { name: "explanation", type: "text" },
      {
        name: "vocabWordId",
        type: "relation",
        collectionId: "church_latin_vocabulary",
        maxSelect: 1,
        cascadeDelete: false,
      },
      { name: "isTemplateQuestion", type: "checkbox" },
      { name: "templateId", type: "text" },
    ],
    indexes: [["resourceId"], ["questionId"]],
  },
  {
    name: "church_latin_vocabulary",
    displayName: "Church Latin Vocabulary",
    type: "base",
    fields: [
      { name: "resourceId", type: "text", required: true, unique: true },
      {
        name: "lessonId",
        type: "relation",
        required: true,
        collectionId: "church_latin_lessons",
        maxSelect: 1,
        cascadeDelete: true,
      },
      { name: "word", type: "text", required: true },
      { name: "meaning", type: "text", required: true },
      {
        name: "partOfSpeech",
        type: "select",
        values: ["noun", "verb", "adjective", "adverb", "preposition", "pronoun", "conjunction", "other"],
      },
      { name: "caseInfo", type: "text" },
      { name: "conjugationInfo", type: "text" },
      {
        name: "frequency",
        type: "select",
        values: ["high", "medium", "low", "unknown"],
      },
      { name: "liturgicalContext", type: "text" },
    ],
    indexes: [["resourceId"], ["lessonId"], ["lessonId", "word"]],
  },
  {
    name: "church_latin_quizzes",
    displayName: "Church Latin Quizzes",
    type: "base",
    fields: [
      { name: "resourceId", type: "text", required: true, unique: true },
      {
        name: "lessonId",
        type: "relation",
        required: true,
        unique: true,
        collectionId: "church_latin_lessons",
        maxSelect: 1,
        cascadeDelete: true,
      },
      {
        name: "questionIds",
        type: "relation",
        collectionId: "church_latin_quiz_questions",
        maxSelect: -1,
        cascadeDelete: true,
      },
    ],
    indexes: [["resourceId"], ["lessonId"]],
  },
  {
    name: "church_latin_user_progress",
    displayName: "Church Latin User Progress",
    type: "base",
    fields: [
      { name: "resourceId", type: "text", required: true, unique: true },
      { name: "userId", type: "text", required: true, unique: true },
      { name: "completedLessons", type: "number", options: { min: 0 } },
      { name: "quizScores", type: "json" },
      { name: "currentLesson", type: "number" },
      {
        name: "theme",
        type: "select",
        values: ["light", "dark"],
      },
      { name: "lastAccessedAt", type: "date" },
      { name: "lastLessonAccessedId", type: "number" },
      { name: "totalProgress", type: "number", options: { min: 0, max: 100 } },
    ],
    indexes: [["resourceId"], ["userId"]],
  },
  {
    name: "church_latin_review_items",
    displayName: "Church Latin Review Items",
    type: "base",
    fields: [
      { name: "resourceId", type: "text", required: true, unique: true },
      { name: "userId", type: "text", required: true },
      {
        name: "lessonId",
        type: "relation",
        required: true,
        collectionId: "church_latin_lessons",
        maxSelect: 1,
        cascadeDelete: true,
      },
      { name: "questionId", type: "text", required: true },
      {
        name: "questionType",
        type: "select",
        values: ["multiple-choice", "matching", "translation", "recitation"],
      },
      {
        name: "state",
        type: "select",
        values: ["learning", "review", "suspended", "retired"],
      },
      { name: "dueAt", type: "date", required: true },
      { name: "lastReviewedAt", type: "date" },
      { name: "intervalDays", type: "number" },
      { name: "streak", type: "number" },
      { name: "lapses", type: "number" },
      {
        name: "lastResult",
        type: "select",
        values: ["correct", "incorrect", "skipped"],
      },
      {
        name: "vocabWordId",
        type: "relation",
        collectionId: "church_latin_vocabulary",
        maxSelect: 1,
        cascadeDelete: false,
      },
      { name: "originalQuestionId", type: "text" },
    ],
    indexes: [["resourceId"], ["userId"], ["lessonId"]],
  },
  {
    name: "church_latin_review_events",
    displayName: "Church Latin Review Events",
    type: "base",
    fields: [
      { name: "resourceId", type: "text", required: true, unique: true },
      { name: "userId", type: "text", required: true },
      {
        name: "lessonId",
        type: "relation",
        collectionId: "church_latin_lessons",
        maxSelect: 1,
        cascadeDelete: true,
      },
      { name: "questionId", type: "text" },
      {
        name: "reviewItemId",
        type: "relation",
        collectionId: "church_latin_review_items",
        maxSelect: 1,
        cascadeDelete: true,
      },
      {
        name: "result",
        type: "select",
        values: ["correct", "incorrect", "skipped"],
      },
      { name: "occurredAt", type: "date", required: true },
      { name: "answer", type: "json" },
    ],
    indexes: [["resourceId"], ["userId"], ["lessonId"]],
  },
];
