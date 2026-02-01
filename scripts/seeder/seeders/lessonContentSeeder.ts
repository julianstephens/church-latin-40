/**
 * Seeder for church_latin_lesson_content collection
 * Reads from scripts/seeder/data/lesson-content.json
 */

import type {
  ISeeder,
  LessonContentData,
  SeedOptions,
  SeedResult,
} from "../types";
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

export class LessonContentSeeder implements ISeeder {
  name = "Lesson Content";
  collectionName = "church_latin_lesson_content";

  async seed(options: SeedOptions): Promise<SeedResult> {
    const startTime = Date.now();
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    try {
      logInfo(`Loading lesson content from data file...`);
      const contentItems = readJsonData<LessonContentData>(
        "lesson-content.json",
      );

      // Clear collection if reset mode
      if (options.reset) {
        await clearCollection(this.collectionName, options);
      }

      logInfo(`Seeding ${contentItems.length} lesson content items...`);

      for (const contentData of contentItems) {
        // Validate required fields
        const validationErrors = validateDataSchema(
          contentData as unknown as Record<string, unknown>,
          ["lessonId", "content", "materials", "practice"],
        );
        if (validationErrors.length > 0) {
          errors.push(...validationErrors);
          skipped++;
          continue;
        }

        try {
          // Extract lesson number from lessonId (e.g., "L001" -> 1)
          const lessonNumberMatch = contentData.lessonId.match(/\d+/);
          if (!lessonNumberMatch) {
            errors.push({
              record: contentData as unknown as Record<string, unknown>,
              message: `Invalid lesson ID format: ${contentData.lessonId}`,
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
          } catch {
            errors.push({
              record: contentData as unknown as Record<string, unknown>,
              message: `Failed to find lesson with number ${lessonNumber}`,
            });
            continue;
          }

          // Map to PocketBase format
          const resourceId = `content_${contentData.lessonId || lessonNumber}`;
          const record: LessonContentData & { resourceId: string } = {
            resourceId: resourceId,
            lessonId: lessonRecordId,
            content: contentData.content,
            materials: contentData.materials,
            practice: contentData.practice,
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
              await (await getPocketBase())
                .collection(this.collectionName)
                .update(existingId!, record);
            }
            updated++;
            if (options.dryRun) {
              logVerbose(
                `[DRY RUN] Would update content for lesson ${contentData.lessonId}`,
                options,
              );
            } else {
              logVerbose(
                `Updated content for lesson ${contentData.lessonId}`,
                options,
              );
            }
          } else {
            if (!options.dryRun) {
              await (await getPocketBase())
                .collection(this.collectionName)
                .create(record);
            }
            added++;
            if (options.dryRun) {
              logVerbose(
                `[DRY RUN] Would create content for lesson ${contentData.lessonId}`,
                options,
              );
            } else {
              logVerbose(
                `Created content for lesson ${contentData.lessonId}`,
                options,
              );
            }
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          errors.push({
            record: contentData as unknown as Record<string, unknown>,
            message: `Failed to seed content for lesson ${contentData.lessonId}: ${message}`,
          });
        }
      }

      logSuccess(
        `Lesson content seeded: ${added} added, ${updated} updated, ${skipped} skipped`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logWarn(`Error seeding lesson content: ${message}`);
      errors.push({
        message: `Failed to load lesson content data: ${message}`,
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
