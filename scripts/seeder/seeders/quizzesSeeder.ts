/**
 * Seeder for church_latin_quizzes collection
 * Reads from scripts/seeder/data/quizzes.json
 */

import type { ISeeder, QuizData, SeedOptions, SeedResult } from "../types";
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

export class QuizzesSeeder implements ISeeder {
  name = "Quizzes";
  collectionName = "church_latin_quizzes";

  async seed(options: SeedOptions): Promise<SeedResult> {
    const startTime = Date.now();
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    try {
      logInfo(`Loading quizzes from data file...`);
      const quizzes = readJsonData<QuizData>("quizzes.json");

      // Clear collection if reset mode
      if (options.reset) {
        await clearCollection(this.collectionName, options);
      }

      logInfo(`Seeding ${quizzes.length} quizzes...`);

      for (const quizData of quizzes) {
        // Validate required fields
        const validationErrors = validateDataSchema(
          quizData as unknown as Record<string, unknown>,
          ["id", "lessonId", "title"],
        );
        if (validationErrors.length > 0) {
          errors.push(...validationErrors);
          skipped++;
          continue;
        }

        try {
          // Extract lesson number from lessonId (e.g., "L001" -> 1)
          const lessonNumberMatch = quizData.lessonId.match(/\d+/);
          if (!lessonNumberMatch) {
            errors.push({
              record: quizData as unknown as Record<string, unknown>,
              message: `Invalid lesson ID format: ${quizData.lessonId}`,
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
              record: quizData as unknown as Record<string, unknown>,
              message: `Failed to find lesson with number ${lessonNumber}`,
            });
            continue;
          }

          // Map to PocketBase format
          const resourceId = `quiz_${quizData.id}`;
          const record: Record<string, unknown> = {
            resourceId: resourceId,
            lessonId: lessonRecordId,
          };

          // Check if exists by querying resourceId (always, even in dry-run)
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
              logVerbose(`[DRY RUN] Would update quiz ${quizData.id}`, options);
            } else {
              logVerbose(`Updated quiz ${quizData.id}`, options);
            }
          } else {
            if (!options.dryRun) {
              (await getPocketBase())
                .collection(this.collectionName)
                .create(record);
            }
            added++;
            if (options.dryRun) {
              logVerbose(`[DRY RUN] Would create quiz ${quizData.id}`, options);
            } else {
              logVerbose(`Created quiz ${quizData.id}`, options);
            }
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          errors.push({
            record: quizData as unknown as Record<string, unknown>,
            message: `Failed to seed quiz ${quizData.id}: ${message}`,
          });
        }
      }

      logSuccess(
        `Quizzes seeded: ${added} added, ${updated} updated, ${skipped} skipped`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logWarn(`Error seeding quizzes: ${message}`);
      errors.push({
        message: `Failed to load quizzes data: ${message}`,
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
