/**
 * Seeder for church_latin_quiz_questions collection
 * Reads from scripts/seeder/data/quiz-questions.json
 */

import type { ISeeder, QuizQuestionData, SeedOptions, SeedResult } from "../types";
import {
    clearCollection,
    createSeedResult,
    getPocketBase,
    logInfo,
    logSuccess,
    logVerbose,
    logWarn,
    readJsonData,
    validateDataSchema,
} from "../utils";

export class QuizQuestionsSeeder implements ISeeder {
    name = "Quiz Questions";
    collectionName = "church_latin_quiz_questions";

    async seed(options: SeedOptions): Promise<SeedResult> {
        const startTime = Date.now();
        let added = 0;
        let updated = 0;
        let skipped = 0;
        const errors = [];

        try {
            logInfo(`Loading quiz questions from data file...`);
            const questions = readJsonData<QuizQuestionData>("quiz-questions.json");

            // Clear collection if reset mode
            if (options.reset) {
                await clearCollection(this.collectionName, options);
            }

            logInfo(`Seeding ${questions.length} quiz questions...`);

            for (const questionData of questions) {
                // Validate required fields
                const validationErrors = validateDataSchema(questionData, [
                    "questionId",
                    "type",
                    "lessonId",
                    "question",
                ]);
                if (validationErrors.length > 0) {
                    errors.push(...validationErrors);
                    skipped++;
                    continue;
                }

                try {
                    // Extract lesson number from lessonId (format: L001, L002, etc.)
                    const lessonNumberMatch = questionData.lessonId.match(/\d+/);
                    if (!lessonNumberMatch) {
                        errors.push({
                            record: questionData,
                            message: `Invalid lesson ID format: ${questionData.lessonId}`,
                        });
                        continue;
                    }
                    const lessonNumber = parseInt(lessonNumberMatch[0], 10);

                    // Look up the lesson record by lessonNumber
                    let lessonRecordId: string | null = null;
                    try {
                        const lessonRecord = await (await getPocketBase())
                            .collection("church_latin_lessons")
                            .getFirstListItem(`lessonNumber=${lessonNumber}`);
                        lessonRecordId = lessonRecord.id;
                    } catch (lookupError) {
                        errors.push({
                            record: questionData,
                            message: `Failed to find lesson with number ${lessonNumber}`,
                        });
                        continue;
                    }

                    // Create longer ID by prefixing with 'question_'
                    // Format: "question_Q01" (18+ characters)
                    const id = `question_${questionData.questionId}`;

                    // Map to PocketBase format
                    const resourceId = `question_${questionData.questionId}`;
                    const record = {
                        resourceId: resourceId,
                        questionId: questionData.questionId,
                        type: questionData.type,
                        lessonId: lessonRecordId,
                        question: questionData.question,
                        options: questionData.options ? JSON.stringify(questionData.options) : null,
                        correctAnswer: Array.isArray(questionData.correctAnswer)
                            ? JSON.stringify(questionData.correctAnswer)
                            : questionData.correctAnswer || null,
                        explanation: questionData.explanation || null,
                        vocabulary: questionData.vocabulary ? JSON.stringify(questionData.vocabulary) : null,
                    };

                    // Check if exists (always, even in dry-run)
                    let exists = false;
                    let existingId: string | null = null;
                    try {
                        const existing = await (await getPocketBase())
                            .collection(this.collectionName)
                            .getFirstListItem(`resourceId="${resourceId}"`);
                        exists = true;
                        existingId = existing.id;
                    } catch {
                        exists = false;
                    }

                    if (exists) {
                        if (!options.dryRun) {
                            (await getPocketBase())
                                .collection(this.collectionName)
                                .update(existingId!, record);
                        }
                        updated++;
                        if (options.dryRun) {
                            logVerbose(`[DRY RUN] Would update question ${id}`, options);
                        } else {
                            logVerbose(`Updated question ${id}`, options);
                        }
                    } else {
                        if (!options.dryRun) {
                            (await getPocketBase())
                                .collection(this.collectionName)
                                .create(record);
                        }
                        added++;
                        if (options.dryRun) {
                            logVerbose(`[DRY RUN] Would create question ${id}`, options);
                        } else {
                            logVerbose(`Created question ${id}`, options);
                        }
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    errors.push({
                        record: questionData,
                        message: `Failed to seed question ${questionData.questionId}: ${message}`,
                    });

                }
            }

            logSuccess(
                `Quiz questions seeded: ${added} added, ${updated} updated, ${skipped} skipped`,
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logWarn(`Error seeding quiz questions: ${message}`);
            errors.push({
                message: `Failed to load quiz questions data: ${message}`,
            });
        }

        return createSeedResult(
            this.collectionName,
            added,
            updated,
            skipped,
            errors,
            startTime,
        );
    }
}
