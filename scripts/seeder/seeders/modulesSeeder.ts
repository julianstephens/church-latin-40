/**
 * Seeder for church_latin_modules collection
 * Reads from scripts/seeder/data/modules.json
 */

import type { ISeeder, ModuleData, SeedOptions, SeedResult } from "../types";
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

export class ModulesSeeder implements ISeeder {
  name = "Modules";
  collectionName = "church_latin_modules";

  async seed(options: SeedOptions): Promise<SeedResult> {
    const startTime = Date.now();
    let added = 0;
    let updated = 0;
    const skipped = 0;
    const errors = [];

    try {
      logInfo(`Loading modules from data file...`);
      const modules = readJsonData<ModuleData>("modules.json");

      // Clear collection if reset mode
      if (options.reset) {
        await clearCollection(this.collectionName, options);
      }

      logInfo(`Seeding ${modules.length} modules...`);

      for (const moduleData of modules) {
        // Validate required fields
        const validationErrors = validateDataSchema(
          moduleData as unknown as Record<string, unknown>,
          ["id", "name", "description"],
        );
        if (validationErrors.length > 0) {
          errors.push(...validationErrors);
          continue;
        }

        try {
          // Extract module number from id (e.g., "M01" -> 1)
          const moduleNumberMatch = moduleData.id.match(/\d+/);
          if (!moduleNumberMatch) {
            errors.push({
              record: moduleData as unknown as Record<string, unknown>,
              message: `Invalid module ID format: ${moduleData.id}`,
            });
            continue;
          }
          const moduleNumber = parseInt(moduleNumberMatch[0], 10);

          // Map to PocketBase format
          const resourceId = `module_${moduleData.id}`;
          const record: Record<string, unknown> = {
            resourceId: resourceId,
            name: moduleData.name,
            description: moduleData.description,
            moduleNumber: moduleNumber,
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
                `[DRY RUN] Would update module ${moduleData.id}`,
                options,
              );
            } else {
              logVerbose(`Updated module ${moduleData.id}`, options);
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
                `[DRY RUN] Would create module ${moduleData.id}`,
                options,
              );
            } else {
              logVerbose(`Created module ${moduleData.id}`, options);
            }
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          errors.push({
            record: moduleData as unknown as Record<string, unknown>,
            message: `Failed to seed module ${moduleData.id}: ${message}`,
          });
        }
      }

      logSuccess(
        `Modules seeded: ${added} added, ${updated} updated, ${skipped} skipped`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logWarn(`Error seeding modules: ${message}`);
      errors.push({
        message: `Failed to load modules data: ${message}`,
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
