/**
 * Seeder for vocabulary question templates in church_latin_quiz_questions collection
 * Reads from scripts/seeder/data/vocab-question-templates.json
 * Generates actual matching questions from templates using vocabulary from the lesson
 */

import type {
  ISeeder,
  SeedOptions,
  SeedResult,
  VocabQuestionTemplateData,
} from "../types";
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
        const validationErrors = validateDataSchema(
          templateData as unknown as Record<string, unknown>,
          ["id", "lessonId", "type", "wordCount", "instruction"],
        );
        if (validationErrors.length > 0) {
          errors.push(...validationErrors);
          continue;
        }

        try {
          // Extract lesson number from lessonId (format: L001, L002, etc.)
          const lessonNumberMatch = templateData.lessonId.match(/\d+/);
          if (!lessonNumberMatch) {
            errors.push({
              record: templateData as unknown as Record<string, unknown>,
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
          } catch (_lookupError) {
            // eslint-disable-line @typescript-eslint/no-unused-vars
            errors.push({
              record: templateData as unknown as Record<string, unknown>,
              message: `Failed to find lesson with number ${lessonNumber}`,
            });
            continue;
          }

          // Look up the quiz for this lesson
          let quizRecordId: string | null = null;
          try {
            const quizRecord = await (await getPocketBase())
              .collection("church_latin_quizzes")
              .getFirstListItem(`lessonId="${lessonRecordId}"`);
            quizRecordId = quizRecord.id;
          } catch (_lookupError) {
            // eslint-disable-line @typescript-eslint/no-unused-vars
            errors.push({
              record: templateData as unknown as Record<string, unknown>,
              message: `Failed to find quiz for lesson ${templateData.lessonId}`,
            });
            continue;
          }

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

          // For matching questions, generate from vocabulary
          if (templateData.type === "vocab-matching") {
            // Fetch vocabulary for this lesson
            const vocabRecords = await (await getPocketBase())
              .collection("church_latin_vocabulary")
              .getFullList({
                filter: `lessonId="${lessonRecordId}"`,
              });

            if (vocabRecords.length === 0) {
              logVerbose(
                `[SKIP] No vocabulary found for template ${templateData.id}`,
                options,
              );
              skipped++;
              continue;
            }

            // Select random vocabulary words up to wordCount
            const selectedVocab = vocabRecords
              .sort(() => Math.random() - 0.5)
              .slice(0, templateData.wordCount);

            // Build optionsList (meanings only) and correctAnswer (word - meaning pairs)
            const optionsList = selectedVocab.map((v) => v.meaning);
            const correctAnswer = selectedVocab.map(
              (v) => `${v.word} - ${v.meaning}`,
            );

            // Generate question text listing the Latin words
            const latinWords = selectedVocab.map((v) => v.word).join(", ");
            const generatedQuestion = `Match ${templateData.wordCount} vocabulary words to their meanings: ${latinWords}`;

            const resourceId = `template_${templateData.id}`;
            const record: Record<string, unknown> = {
              resourceId: resourceId,
              questionId: templateData.id,
              type: quizType,
              lessonId: lessonRecordId,
              quizId: quizRecordId,
              question: generatedQuestion,
              options: JSON.stringify(optionsList),
              correctAnswer: JSON.stringify(correctAnswer),
              isTemplateQuestion: true,
              templateId: templateData.id,
              questionIndex: 999, // Templates typically added at end
            };

            // Check if exists
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
                logVerbose(
                  `[DRY RUN] Would update template ${resourceId}`,
                  options,
                );
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
                logVerbose(
                  `[DRY RUN] Would create template ${resourceId}`,
                  options,
                );
              } else {
                logVerbose(`Created template ${resourceId}`, options);
              }
            }
          } else {
            // For non-matching templates, store as placeholder for future expansion
            const resourceId = `template_${templateData.id}`;
            const record: Record<string, unknown> = {
              resourceId: resourceId,
              questionId: templateData.id,
              type: quizType,
              lessonId: lessonRecordId,
              quizId: quizRecordId,
              question: templateData.instruction,
              isTemplateQuestion: true,
              templateId: templateData.id,
              questionIndex: 999,
            };

            // Check if exists
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
                logVerbose(
                  `[DRY RUN] Would update template ${resourceId}`,
                  options,
                );
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
                logVerbose(
                  `[DRY RUN] Would create template ${resourceId}`,
                  options,
                );
              } else {
                logVerbose(`Created template ${resourceId}`, options);
              }
            }
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          errors.push({
            record: templateData as unknown as Record<string, unknown>,
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
