#!/usr/bin/env node

/**
 * Church Latin Seeder CLI
 * Centralized seeding system for all PocketBase collections
 *
 * Usage:
 *   pnpx tsx scripts/seeder/index.ts [OPTIONS]
 *
 * Options:
 *   --dry-run        Validate and show what would happen without committing
 *   --reset          Clear collections and reseed from scratch
 *   --verbose        Show detailed logging
 *   --collection     Run specific seeder only (e.g., --collection vocabulary)
 *
 * Examples:
 *   pnpx tsx scripts/seeder/index.ts                    # Normal seed
 *   pnpx tsx scripts/seeder/index.ts --dry-run          # Validate without changes
 *   pnpx tsx scripts/seeder/index.ts --reset --verbose  # Full reset with logging
 */

import { CourseDataGenerator } from "./generators/courseDataGenerator";
import { LessonContentSeeder } from "./seeders/lessonContentSeeder";
import { LessonsSeeder } from "./seeders/lessonsSeeder";
import { ModulesSeeder } from "./seeders/modulesSeeder";
import { QuestionTemplatesSeeder } from "./seeders/questionTemplatesSeeder";
import { QuizQuestionsSeeder } from "./seeders/quizQuestionsSeeder";
import { QuizzesSeeder } from "./seeders/quizzesSeeder";
import { VocabularySeeder } from "./seeders/vocabularySeeder";
import type { ISeeder, SeedOptions, SeedResult, SeedSummary } from "./types";
import {
    logError,
    logInfo,
    logSuccess,
    logVerbose
} from "./utils";

/**
 * Parse command-line arguments
 */
function parseArgs(): SeedOptions {
    const args = process.argv.slice(2);
    return {
        dryRun: args.includes("--dry-run"),
        reset: args.includes("--reset"),
        verbose: args.includes("--verbose"),
        collection: args
            .find((arg) => arg.startsWith("--collection"))
            ?.split("=")[1],
    };
}

/**
 * Create list of seeders to run
 */
function getSeeders(options: SeedOptions): ISeeder[] {
    const allSeeders: ISeeder[] = [
        new ModulesSeeder(),
        new LessonsSeeder(),
        new LessonContentSeeder(),
        new QuizzesSeeder(),
        new QuizQuestionsSeeder(),
        new VocabularySeeder(),
        new QuestionTemplatesSeeder(),
    ];

    if (options.collection) {
        return allSeeders.filter((s) =>
            s.collectionName
                .toLowerCase()
                .includes(options.collection!.toLowerCase()),
        );
    }

    return allSeeders;
}

/**
 * Print header
 */
function printHeader(options: SeedOptions): void {
    console.log("\n");
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║        🌱 Church Latin Seeder 🌱                      ║");
    console.log("║       Centralized Data Population System              ║");
    console.log("╚════════════════════════════════════════════════════════╝");
    console.log("");

    if (options.dryRun) {
        console.log("🔍 DRY RUN MODE - No changes will be committed");
    }
    if (options.reset) {
        console.log("⚠️  RESET MODE - Collections will be cleared");
    }
    if (options.collection) {
        console.log(`📁 Single Collection Mode - Only ${options.collection}`);
    }
    console.log("📂 Data Source: scripts/seeder/data/");
    console.log("");
}

/**
 * Print summary report
 */
function printSummary(
    results: SeedResult[],
    options: SeedOptions,
): void {
    console.log("");
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║                   📊 Final Report                      ║");
    console.log("╚════════════════════════════════════════════════════════╝");
    console.log("");

    const summary: SeedSummary = {
        totalAdded: results.reduce((sum, r) => sum + r.added, 0),
        totalUpdated: results.reduce((sum, r) => sum + r.updated, 0),
        totalSkipped: results.reduce((sum, r) => sum + r.skipped, 0),
        totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
        totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
        results,
    };

    console.log("Summary:");
    console.log(`  ✅ Total Added:   ${summary.totalAdded}`);
    console.log(`  🔄 Total Updated: ${summary.totalUpdated}`);
    console.log(`  ⏭️  Total Skipped: ${summary.totalSkipped}`);
    if (summary.totalErrors > 0) {
        console.log(`  ❌ Total Errors:  ${summary.totalErrors}`);
    }
    console.log(`  ⏱️  Total Time:    ${(summary.totalDuration / 1000).toFixed(2)}s`);

    console.log("");
    console.log("Per-Collection Details:");
    for (const result of results) {
        const status =
            result.errors.length === 0
                ? "✅"
                : result.errors.length === result.skipped
                    ? "⚠️ "
                    : "❌";
        console.log(
            `  ${status} ${result.collection}: +${result.added} ~${result.updated} ⏭️ ${result.skipped}`,
        );

        // Show first error if any
        if (result.errors.length > 0) {
            const firstError = result.errors[0];
            const errorMsg = typeof firstError === 'string' ? firstError : firstError.message || 'Unknown error';
            console.log(`     First error: ${errorMsg}`);
        }
    }

    if (options.dryRun) {
        console.log("");
        console.log(
            "💡 This was a DRY RUN. No changes were made. Run without --dry-run to apply.",
        );
    }

    if (options.reset) {
        console.log("");
        console.log("⚠️  Collections were reset before seeding.");
    }

    console.log("");
}

/**
 * Main seeding function
 */
async function main(): Promise<void> {
    try {
        const options = parseArgs();
        printHeader(options);

        const seeders = getSeeders(options);
        const results: SeedResult[] = [];

        // Run each seeder
        for (const seeder of seeders) {
            logInfo(`Starting ${seeder.name}...`);
            const result = await seeder.seed(options);
            results.push(result);
            console.log("");
        }

        // Generate courseData.ts if not dry run
        if (!options.dryRun) {
            logInfo("Generating TypeScript artifacts...");
            const generator = new CourseDataGenerator();
            await generator.generate(options);
            logSuccess("Generated src/data/courseData.ts");
            console.log("");
        } else {
            logVerbose("[DRY RUN] Would generate src/data/courseData.ts", options);
        }

        // Print summary
        printSummary(results, options);

        // Exit with success
        process.exit(0);
    } catch (error) {
        logError(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
        console.error(error);
        process.exit(1);
    }
}

// Run
main();
