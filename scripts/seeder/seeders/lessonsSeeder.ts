/**
 * Seeder for church_latin_lessons collection
 * Reads from scripts/seeder/data/lessons.json
 */

import type { ISeeder, LessonData, SeedOptions, SeedResult } from "../types";
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

export class LessonsSeeder implements ISeeder {
  name = "Lessons";
  collectionName = "church_latin_lessons";

  async seed(options: SeedOptions): Promise<SeedResult> {
    const startTime = Date.now();
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    try {
      logInfo(`Loading lessons from data file...`);
      const lessons = readJsonData<LessonData>("lessons.json");

      // Clear collection if reset mode
      if (options.reset) {
        await clearCollection(this.collectionName, options);
      }

      logInfo(`Seeding ${lessons.length} lessons...`);

      for (const lessonData of lessons) {
        // Validate required fields
        const validationErrors = validateDataSchema(lessonData, [
          "id",
          "title",
          "moduleId",
          "day",
        ]);
        if (validationErrors.length > 0) {
          errors.push(...validationErrors);
          continue;
        }

        try {
          // Use lesson ID as-is (PocketBase will auto-generate if needed)
          const id = lessonData.id;

          // Extract module number from moduleId (e.g., "M01" -> 1)
          const moduleNumberMatch = lessonData.moduleId.match(/\d+/);
          if (!moduleNumberMatch) {
            errors.push({
              record: lessonData,
              message: `Invalid module ID format: ${lessonData.moduleId}`,
            });
            continue;
          }
          const moduleNumber = parseInt(moduleNumberMatch[0], 10);

          // Look up the module record by moduleNumber
          let moduleRecordId: string | null = null;
          try {
            const moduleRecord = await (await getPocketBase())
              .collection("church_latin_modules")
              .getFirstListItem(`moduleNumber=${moduleNumber}`);
            moduleRecordId = moduleRecord.id;
          } catch (lookupError) {
            errors.push({
              record: lessonData,
              message: `Failed to find module with number ${moduleNumber} for lesson ${lessonData.id}`,
            });
            continue;
          }

          // Map to PocketBase format
          const resourceId = `lesson_${lessonData.id}`;
          const lessonNumberMatch = lessonData.id.match(/\d+/);
          const lessonNumber = lessonNumberMatch
            ? parseInt(lessonNumberMatch[0], 10)
            : lessonData.day;

          const record = {
            resourceId: resourceId,
            name: lessonData.title,
            lessonNumber: lessonNumber,
            moduleId: moduleRecordId,
            displayOrder: lessonData.day,
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
              logVerbose(
                `[DRY RUN] Would update lesson ${lessonData.id}`,
                options,
              );
            } else {
              logVerbose(`Updated lesson ${lessonData.id}`, options);
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
                `[DRY RUN] Would create lesson ${lessonData.id}`,
                options,
              );
            } else {
              logVerbose(`Created lesson ${lessonData.id}`, options);
            }
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          errors.push({
            record: lessonData,
            message: `Failed to seed lesson ${lessonData.id}: ${message}`,
          });
        }
      }

      logSuccess(
        `Lessons seeded: ${added} added, ${updated} updated, ${skipped} skipped`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logWarn(`Error seeding lessons: ${message}`);
      errors.push({
        message: `Failed to load lessons data: ${message}`,
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
