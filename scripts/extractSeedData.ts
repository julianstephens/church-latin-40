#!/usr/bin/env node

/**
 * Extract seed data from courseData.ts
 * Populates scripts/seeder/data/ files from existing courseData.ts
 * Usage: pnpx tsx scripts/extractSeedData.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { lessons } from "../src/data/courseData";

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface LessonContentData {
    lessonId: string;
    content: string;
    examples?: string[];
    grammar?: string;
}

interface VocabularyRow {
    word: string;
    meaning: string;
    lessonId: string;
    partOfSpeech?: string;
    frequency?: number;
}

interface QuizData {
    id: string;
    lessonId: string;
    title: string;
}

interface QuizQuestionData {
    questionId: string;
    type: string;
    lessonId: string;
    question: string;
    options?: string[];
    correctAnswer?: string | string[];
    explanation?: string;
}

const dataDir = path.join(__dirname, "seeder", "data");

/**
 * Extract lesson content
 */
function extractLessonContent(): LessonContentData[] {
    console.log("📚 Extracting lesson content...");
    const contentData: LessonContentData[] = [];

    for (const lesson of lessons) {
        const lessonId = `L${String(lesson.id).padStart(3, "0")}`;
        const contentText = lesson.content.join("\n\n");
        const examples = lesson.materials || [];

        contentData.push({
            lessonId,
            content: contentText,
            examples,
            grammar: undefined, // Would be parsed from content if needed
        });
    }

    console.log(`  ✓ Extracted content for ${contentData.length} lessons`);
    return contentData;
}

/**
 * Extract vocabulary from lessons
 */
function extractVocabulary(): VocabularyRow[] {
    console.log("📖 Extracting vocabulary...");
    const vocabulary: VocabularyRow[] = [];
    const seen = new Set<string>();

    for (const lesson of lessons) {
        const lessonId = `L${String(lesson.id).padStart(3, "0")}`;

        for (const vocabLine of lesson.vocabulary) {
            // Parse "word - meaning" format
            const match = vocabLine.match(/^(.+?)\s*-\s*(.+)$/);
            if (!match) {
                console.warn(`  ⚠️  Could not parse vocabulary: "${vocabLine}"`);
                continue;
            }

            const [, word, meaning] = match;
            const key = `${word.toLowerCase()}-${lessonId}`;

            if (seen.has(key)) {
                continue; // Skip duplicates
            }
            seen.add(key);

            vocabulary.push({
                word: word.trim(),
                meaning: meaning.trim(),
                lessonId,
                partOfSpeech: undefined, // Would need to be added separately
                frequency: undefined,
            });
        }
    }

    console.log(`  ✓ Extracted ${vocabulary.length} vocabulary words`);
    return vocabulary;
}

/**
 * Extract quizzes (one per lesson)
 */
function extractQuizzes(): QuizData[] {
    console.log("❓ Extracting quizzes...");
    const quizzes: QuizData[] = [];

    for (const lesson of lessons) {
        const lessonId = `L${String(lesson.id).padStart(3, "0")}`;
        const quizId = `Q${String(lesson.id).padStart(3, "0")}`;

        quizzes.push({
            id: quizId,
            lessonId,
            title: `${lesson.title} Quiz`,
        });
    }

    console.log(`  ✓ Extracted ${quizzes.length} quizzes`);
    return quizzes;
}

/**
 * Extract quiz questions
 */
function extractQuizQuestions(): QuizQuestionData[] {
    console.log("❓ Extracting quiz questions...");
    const questions: QuizQuestionData[] = [];

    for (const lesson of lessons) {
        const lessonId = `L${String(lesson.id).padStart(3, "0")}`;

        for (const q of lesson.quiz) {
            questions.push({
                questionId: q.questionId,
                type: q.type,
                lessonId,
                question: q.question,
                options: q.options,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation,
            });
        }
    }

    console.log(`  ✓ Extracted ${questions.length} quiz questions`);
    return questions;
}

/**
 * Write JSON file
 */
function writeJson<T>(filename: string, data: T[]): void {
    const filepath = path.join(dataDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`  ✓ Wrote ${filepath} (${data.length} records)`);
}

/**
 * Write CSV file
 */
function writeCsv(filename: string, data: VocabularyRow[]): void {
    const filepath = path.join(dataDir, filename);

    // CSV header
    const headers = ["word", "meaning", "lessonId", "partOfSpeech", "frequency"];
    const lines = [headers.join(",")];

    // Data rows
    for (const row of data) {
        const values = [
            row.word,
            row.meaning,
            row.lessonId,
            row.partOfSpeech || "",
            row.frequency || "",
        ];
        lines.push(values.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }

    fs.writeFileSync(filepath, lines.join("\n"));
    console.log(`  ✓ Wrote ${filepath} (${data.length} records)`);
}

/**
 * Main extraction function
 */
async function main(): Promise<void> {
    try {
        console.log("\n╔════════════════════════════════════════════════════════╗");
        console.log("║     📤 Course Data Extraction Tool 📤                 ║");
        console.log("║     Extract from courseData.ts → seeder/data/        ║");
        console.log("╚════════════════════════════════════════════════════════╝\n");

        // Ensure data directory exists
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Extract all data
        const contentData = extractLessonContent();
        const vocabularyData = extractVocabulary();
        const quizzesData = extractQuizzes();
        const questionsData = extractQuizQuestions();

        console.log("\n📝 Writing seed data files...\n");

        // Write files
        writeJson("lesson-content.json", contentData);
        writeCsv("vocabulary.csv", vocabularyData);
        writeJson("quizzes.json", quizzesData);
        writeJson("quiz-questions.json", questionsData);

        console.log("\n✅ Extraction complete!\n");
        console.log("Summary:");
        console.log(`  📚 ${contentData.length} lesson content records`);
        console.log(`  📖 ${vocabularyData.length} vocabulary words`);
        console.log(`  ❓ ${quizzesData.length} quizzes`);
        console.log(`  ❓ ${questionsData.length} quiz questions`);
        console.log(
            `\n📁 Seed data ready in scripts/seeder/data/\n` +
            `Run: pnpx tsx scripts/seeder/index.ts --dry-run`,
        );
    } catch (error) {
        console.error("\n❌ Extraction failed:");
        console.error(error);
        process.exit(1);
    }
}

main();
