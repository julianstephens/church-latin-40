import PocketBase from "pocketbase";
import { vocabQuestionTemplates } from "../src/data/courseData";

/**
 * Create vocabulary template questions in PocketBase
 * These questions will be dynamically populated with vocabulary words at quiz time
 * Run: npx ts-node scripts/createVocabTemplateQuestions.ts
 * 
 * Requires VITE_POCKETBASE_URL environment variable
 */

// Get PocketBase URL from environment - default to localhost for development
const POCKETBASE_URL = process.env.VITE_POCKETBASE_URL || "http://localhost:8090";
const pb = new PocketBase(POCKETBASE_URL);

console.log(`Connecting to PocketBase at ${POCKETBASE_URL}...`);

/**
 * Create template question for a lesson
 */
async function createTemplateQuestion(
    lessonNumber: number,
    template: (typeof vocabQuestionTemplates)[0],
) {
    try {
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

        // Get the quiz for this lesson
        const quizRecords = await pb
            .collection("church_latin_quizzes")
            .getList(1, 100, {
                filter: `lessonId = "${pbLessonId}"`,
            });

        if (quizRecords.items.length === 0) {
            console.warn(`✗ No quiz found for lesson ${lessonNumber}`);
            return;
        }

        const quiz = quizRecords.items[0];

        // Create template question
        const questionData = {
            lessonId: pbLessonId,
            quizId: quiz.id,
            questionIndex: 999, // High index for template questions
            type: template.type.replace("vocab-", ""), // Convert "vocab-matching" to "matching"
            isTemplateQuestion: true,
            templateId: template.id,
            question: template.instruction,
            // Template questions don't have fixed answers - they'll be generated dynamically
            correctAnswer: [], // Empty array for template
            explanation: `This is a template question. Actual words will be selected randomly from lesson ${lessonNumber} vocabulary.`,
        };

        // Check if template already exists
        const existing = await pb
            .collection("church_latin_quiz_questions")
            .getList(1, 1, {
                filter: `templateId = "${template.id}"`,
            });

        if (existing.items.length > 0) {
            console.log(`  ⊘ Template ${template.id} already exists, skipping`);
            return;
        }

        // Create the template question
        await pb.collection("church_latin_quiz_questions").create(questionData);
        console.log(
            `  ✓ Created template ${template.id} (${template.type})`,
        );
    } catch (error) {
        console.error(
            `  ✗ Failed to create template for lesson ${lessonNumber}:`,
            error,
        );
    }
}

/**
 * Main function
 */
async function main() {
    try {
        console.log("Creating vocabulary template questions...\n");

        // Create templates for lessons that have them in vocabQuestionTemplates
        for (const template of vocabQuestionTemplates) {
            const lessonNumber = parseInt(template.id.substring(1, 3), 10);
            console.log(
                `Processing template ${template.id} for lesson ${lessonNumber}...`,
            );
            await createTemplateQuestion(lessonNumber, template);
        }

        console.log("\n✓ Template question creation complete!");
    } catch (error) {
        console.error("✗ Template creation failed:", error);
        process.exit(1);
    }
}

main();
