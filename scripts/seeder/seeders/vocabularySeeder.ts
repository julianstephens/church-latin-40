/**
 * Seeder for church_latin_vocabulary collection
 * Reads from scripts/seeder/data/vocabulary.csv
 */

import type {
  ISeeder,
  SeedOptions,
  SeedResult,
  VocabularyData,
} from "../types";
import {
  clearCollection,
  createSeedResult,
  getPocketBase,
  logInfo,
  logSuccess,
  logVerbose,
  logWarn,
  readCsvData,
  validateDataSchema,
} from "../utils";

export class VocabularySeeder implements ISeeder {
  name = "Vocabulary";
  collectionName = "church_latin_vocabulary";

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async seed(options: SeedOptions): Promise<SeedResult> {
    const startTime = Date.now();
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    try {
      logInfo(`Loading vocabulary from data file...`);
      const vocabRows = readCsvData("vocabulary.csv");

      // Convert CSV rows to VocabularyData
      const vocabulary: VocabularyData[] = vocabRows.map((row) => ({
        word: row.word,
        meaning: row.meaning,
        lessonId: row.lessonId,
        partOfSpeech: row.partOfSpeech,
        frequency: row.frequency,
        caseInfo: row.caseInfo,
        conjugationInfo: row.conjugationInfo,
        liturgicalContext: row.liturgicalContext,
      }));

      // Clear collection if reset mode
      if (options.reset) {
        await clearCollection(this.collectionName, options);
      }

      logInfo(`Seeding ${vocabulary.length} vocabulary words...`);

      for (const vocabData of vocabulary) {
        // Validate required fields
        const validationErrors = validateDataSchema(vocabData, [
          "word",
          "meaning",
          "lessonId",
        ]);
        if (validationErrors.length > 0) {
          errors.push(...validationErrors);
          continue;
        }

        try {
          // Create unique ID from word + lessonId for lookups
          const lookupId = `${vocabData.word.toLowerCase()}-${vocabData.lessonId}`;

          // Extract lesson number from logical ID (e.g., "L001" -> 1)
          const lessonNumberMatch = vocabData.lessonId.match(/\d+/);
          if (!lessonNumberMatch) {
            errors.push({
              record: vocabData,
              message: `Invalid lesson ID format: ${vocabData.lessonId}`,
            });
            continue;
          }
          const lessonNumber = parseInt(lessonNumberMatch[0], 10);

          // Look up the lesson by lessonNumber
          let lessonRecordId: string | null = null;
          try {
            const lessonRecord = await (await getPocketBase())
              .collection("church_latin_lessons")
              .getFirstListItem(`lessonNumber=${lessonNumber}`);
            lessonRecordId = lessonRecord.id;
          } catch (lookupError) {
            logVerbose(
              `Could not find lesson with number: ${lessonNumber}`,
              options,
            );
          }

          if (!lessonRecordId) {
            errors.push({
              record: vocabData,
              message: `Failed to find lesson ${vocabData.lessonId} (number ${lessonNumber}) for vocabulary word ${vocabData.word}`,
            });
            continue;
          }

          // Map to PocketBase format
          const validPoS = [
            "noun",
            "verb",
            "adjective",
            "adverb",
            "preposition",
            "conjunction",
            "pronoun",
            "article",
          ];
          const validFrequency = ["high", "medium", "low", "unknown"];

          // Use "unknown" as default if frequency is missing or invalid
          const frequency =
            vocabData.frequency &&
            validFrequency.includes(vocabData.frequency.toLowerCase())
              ? vocabData.frequency.toLowerCase()
              : "unknown";

          const record: any = {
            resourceId: `vocab_${vocabData.word.toLowerCase()}_${vocabData.lessonId}`,
            word: vocabData.word,
            meaning: vocabData.meaning,
            lessonId: lessonRecordId,
            frequency: frequency,
            caseInfo: vocabData.caseInfo || null,
            conjugationInfo: vocabData.conjugationInfo || null,
            liturgicalContext: vocabData.liturgicalContext || null,
          };

          // Only include partOfSpeech if it's a valid value
          if (
            vocabData.partOfSpeech &&
            validPoS.includes(vocabData.partOfSpeech.toLowerCase())
          ) {
            record.partOfSpeech = vocabData.partOfSpeech.toLowerCase();
          }

          // Check if exists (always, even in dry-run)
          // Query for existing record by resourceId
          let exists = false;
          let existingId: string | null = null;
          try {
            const existing = await (await getPocketBase())
              .collection(this.collectionName)
              .getFirstListItem(`resourceId="${record.resourceId}"`);
            exists = true;
            existingId = existing.id;
            logVerbose(
              `Record ${lookupId} exists with ID ${existingId}`,
              options,
            );
          } catch (checkError) {
            exists = false;
            logVerbose(`Record ${lookupId} does not exist`, options);
          }

          if (exists) {
            if (!options.dryRun) {
              try {
                (await getPocketBase())
                  .collection(this.collectionName)
                  .update(existingId!, record);
                // Add small delay to throttle requests
                await this.sleep(10);
              } catch (updateError) {
                const errMsg =
                  updateError instanceof Error
                    ? updateError.message
                    : String(updateError);
                throw new Error(`PocketBase update failed: ${errMsg}`);
              }
            }
            updated++;
            if (options.dryRun) {
              logVerbose(
                `[DRY RUN] Would update word ${vocabData.word}`,
                options,
              );
            } else {
              logVerbose(`Updated word ${vocabData.word}`, options);
            }
          } else {
            if (!options.dryRun) {
              try {
                (await getPocketBase())
                  .collection(this.collectionName)
                  .create(record);
                // Add small delay to throttle requests
                await this.sleep(10);
              } catch (createError) {
                const errMsg =
                  createError instanceof Error
                    ? createError.message
                    : String(createError);
                throw new Error(`PocketBase create failed: ${errMsg}`);
              }
            }
            added++;
            if (options.dryRun) {
              logVerbose(
                `[DRY RUN] Would create word ${vocabData.word}`,
                options,
              );
            } else {
              logVerbose(`Created word ${vocabData.word}`, options);
            }
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          errors.push({
            record: vocabData,
            message: `Failed to seed word ${vocabData.word}: ${message}`,
          });
        }
      }

      logSuccess(
        `Vocabulary seeded: ${added} added, ${updated} updated, ${skipped} skipped`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logWarn(`Error seeding vocabulary: ${message}`);
      errors.push({
        message: `Failed to load vocabulary data: ${message}`,
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
