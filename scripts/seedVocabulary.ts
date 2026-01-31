import PocketBase from "pocketbase";
import { lessons } from "../src/data/courseData";

/**
 * Seed vocabulary words from courseData into PocketBase
 * Run: npx ts-node scripts/seedVocabulary.ts
 * 
 * Requires VITE_POCKETBASE_URL environment variable
 */

// Get PocketBase URL from environment - default to localhost for development
const POCKETBASE_URL = process.env.VITE_POCKETBASE_URL || "http://localhost:8090";
const pb = new PocketBase(POCKETBASE_URL);

console.log(`Connecting to PocketBase at ${POCKETBASE_URL}...`);

interface VocabEntry {
    word: string;
    meaning: string;
}

/**
 * Parse vocabulary from courseData format: "word - meaning"
 */
function parseVocabulary(vocabArray: string[]): VocabEntry[] {
    return vocabArray.map((entry) => {
        const [word, meaning] = entry.split(" - ").map((s) => s.trim());
        return { word, meaning };
    });
}

/**
 * Seed vocabulary for a lesson
 */
async function seedLessonVocabulary(lessonId: number, lessonNumber: number) {
    try {
        const lesson = lessons.find((l) => l.id === lessonId);
        if (!lesson || !lesson.vocabulary || lesson.vocabulary.length === 0) {
            console.log(`⊘ Lesson ${lessonNumber} has no vocabulary, skipping`);
            return;
        }

        // Get the PocketBase lesson ID
        const lessonRecords = await pb
            .collection("church_latin_lessons")
            .getList(1, 1, {
                filter: `lessonNumber = ${lessonNumber}`,
            });

        if (lessonRecords.items.length === 0) {
            console.warn(`✗ Lesson ${lessonNumber} not found in PocketBase`);
            return;
        }

        const pbLessonId = lessonRecords.items[0].id;
        const vocabEntries = parseVocabulary(lesson.vocabulary);

        console.log(
            `Seeding ${vocabEntries.length} vocabulary words for lesson ${lessonNumber}...`,
        );

        // Seed each vocabulary entry
        for (const entry of vocabEntries) {
            try {
                // Check if already exists
                const existing = await pb
                    .collection("church_latin_vocabulary")
                    .getList(1, 1, {
                        filter: `lessonId = "${pbLessonId}" && word = "${entry.word.replace(/"/g, '\\"')}"`,
                    });

                if (existing.items.length === 0) {
                    // Create new vocabulary entry
                    const freq = Math.floor(Math.random() * 3) + 2; // Random frequency 2-4
                    await pb.collection("church_latin_vocabulary").create({
                        lessonId: pbLessonId,
                        word: entry.word,
                        meaning: entry.meaning,
                        frequency: freq,
                        partOfSpeech: "noun", // Default, can be improved later
                    });
                }
            } catch (error) {
                console.warn(`  ✗ Failed to seed "${entry.word}":`, error);
            }
        }

        console.log(`✓ Seeded vocabulary for lesson ${lessonNumber}`);
    } catch (error) {
        console.error(`✗ Failed to seed vocabulary for lesson ${lessonId}:`, error);
    }
}

/**
 * Main seeding function
 */
async function main() {
    try {
        console.log("Starting vocabulary seeding...\n");

        // Seed vocabulary for first 8 lessons (others can be added later)
        for (let lessonNumber = 1; lessonNumber <= 8; lessonNumber++) {
            await seedLessonVocabulary(lessonNumber, lessonNumber);
        }

        console.log("\n✓ Vocabulary seeding complete!");
    } catch (error) {
        console.error("✗ Seeding failed:", error);
        process.exit(1);
    }
}

main();
