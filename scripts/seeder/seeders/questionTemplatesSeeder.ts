/**
 * Seeder for vocabulary question templates in church_latin_quiz_questions collection
 * Reads from scripts/seeder/data/vocab-question-templates.json
 */

import type { ISeeder, SeedOptions, SeedResult, VocabQuestionTemplateData } from "../types";
import {
    createSeedResult,
    getPocketBase,
    logInfo,
    logSuccess,
    logVerbose,
    logWarn,
    readJsonData,
    validateDataSchema,
} from "../utils";

export class QuestionTemplatesSeeder implements ISeeder {
    name = "Question Templates";
    collectionName = "church_latin_quiz_questions";

    async seed(options: SeedOptions): Promise<SeedResult> {
        const startTime = Date.now();
        let added = 0;
        let updated = 0;
        let skipped = 0;
        const errors = [];

        try {
            logInfo(`Loading question templates from data file...`);
            const templates = readJsonData<VocabQuestionTemplateData>(
                "vocab-question-templates.json",
            );

            logInfo(`Seeding ${templates.length} question templates...`);

            for (const templateData of templates) {
                // Validate required fields
                const validationErrors = validateDataSchema(templateData, [
                    "id",
                    "lessonId",
                    "type",
                    "wordCount",
                    "instruction",
                ]);
                if (validationErrors.length > 0) {
                    errors.push(...validationErrors);
                    continue;
                }

                try {
                    // Extract lesson number from lessonId (format: L001, L002, etc.)
                    const lessonNumberMatch = templateData.lessonId.match(/\d+/);
                    if (!lessonNumberMatch) {
                        errors.push({
                            record: templateData,
                            message: `Invalid lesson ID format: ${templateData.lessonId}`,
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
                            record: templateData,
                            message: `Failed to find lesson with number ${lessonNumber}`,
                        });
                        continue;
                    }

                    // Create longer ID by prefixing with 'template_'
                    // Format: "template_VT01" (15+ characters)
                    const id = `template_${templateData.id}`;

                    // Map template types to valid quiz question types
                    let quizType = "multiple-choice";
                    if (templateData.type) {
                        if (templateData.type.includes("matching")) {
                            quizType = "matching";
                        } else if (templateData.type.includes("translation")) {
                            quizType = "translation";
                        } else if (templateData.type.includes("recitation")) {
                            quizType = "recitation";
                        }
                    }

                    // Map to PocketBase format - templates are stored as special quiz questions
                    const resourceId = `template_${templateData.id}`;
                    const record = {
                        resourceId: resourceId,
                        questionId: templateData.id,
                        type: quizType,
                        lessonId: lessonRecordId,
                        question: templateData.instruction,
                        isTemplateQuestion: true,
                        templateId: templateData.id,
                        // Store template metadata in JSON fields
                        templateType: templateData.type,
                        templateWordCount: templateData.wordCount,
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
                            logVerbose(`[DRY RUN] Would update template ${resourceId}`, options);
                        } else {
                            logVerbose(`Updated template ${resourceId}`, options);
                        }
                    } else {
                        if (!options.dryRun) {
                            (await getPocketBase())
                                .collection(this.collectionName)
                                .create(record);
                        }
                        added++;
                        if (options.dryRun) {
                            logVerbose(`[DRY RUN] Would create template ${resourceId}`, options);
                        } else {
                            logVerbose(`Created template ${resourceId}`, options);
                        }
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    errors.push({
                        record: templateData,
                        message: `Failed to seed template ${templateData.id}: ${message}`,
                    });
                }
            }

            logSuccess(
                `Question templates seeded: ${added} added, ${updated} updated, ${skipped} skipped`,
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logWarn(`Error seeding question templates: ${message}`);
            errors.push({
                message: `Failed to load question templates data: ${message}`,
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
