/**
 * CourseDataGenerator
 * Generates src/data/courseData.ts from seed data files in scripts/seeder/data/
 * Ensures TypeScript artifacts stay in sync with PocketBase data
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { SeedOptions } from "../types";
import {
    logSuccess,
    logVerbose,
    logWarn,
    readCsvData,
    readJsonData,
} from "../utils";

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class CourseDataGenerator {
    /**
     * Generate src/data/courseData.ts from seed data files
     */
    async generate(options: SeedOptions): Promise<void> {
        try {
            logVerbose("Starting courseData.ts generation", options);

            // Load seed data
            const modules = readJsonData("modules.json");
            const lessons = readJsonData("lessons.json");
            const templates = readJsonData("vocab-question-templates.json");

            // For now, parse vocabulary CSV (empty in initial setup)
            const vocabCsv = readCsvData("vocabulary.csv");

            // Generate TypeScript code
            const code = this.generateTypescript(modules, lessons, templates, vocabCsv);

            // Write to file (skip if dry-run)
            const outputPath = path.join(__dirname, "../../..", "src/data/courseData.ts");

            if (!options.dryRun) {
                fs.writeFileSync(outputPath, code);
                logSuccess(`Generated courseData.ts (${code.length} bytes)`);
                logVerbose(`Output: ${outputPath}`, options);
            } else {
                logVerbose(`[DRY RUN] Would generate courseData.ts (${code.length} bytes)`, options);
                logVerbose(`[DRY RUN] Output path: ${outputPath}`, options);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logWarn(`Failed to generate courseData.ts: ${message}`);
            throw error;
        }
    }

    /**
     * Generate TypeScript source code from seed data
     */
    private generateTypescript(
        modules: any[],
        lessons: any[],
        templates: any[],
        vocabulary: Record<string, string>[],
    ): string {
        const lines: string[] = [];

        // Header and imports
        lines.push("// Auto-generated from seed data files in scripts/seeder/data/");
        lines.push("// DO NOT EDIT MANUALLY - run: pnpx tsx scripts/seeder/index.ts");
        lines.push("");
        lines.push("// Type definitions");
        lines.push("");

        // Type definitions
        lines.push(`export interface Lesson {`);
        lines.push(`  id: number;`);
        lines.push(`  title: string;`);
        lines.push(`  module: number;`);
        lines.push(`  materials: string[];`);
        lines.push(`  content: string[];`);
        lines.push(`  vocabulary: string[];`);
        lines.push(`  practice: string[];`);
        lines.push(`  answer?: string[];`);
        lines.push(`  quiz: QuizQuestion[];`);
        lines.push(`}`);
        lines.push("");

        lines.push(`type BaseQuizQuestion = {`);
        lines.push(`  id: number;`);
        lines.push(`  questionId: string;`);
        lines.push(`  question: string;`);
        lines.push(`  correctAnswer: string | string[];`);
        lines.push(`  explanation?: string;`);
        lines.push(`};`);
        lines.push("");

        lines.push(`type MultipleChoiceQuestion = BaseQuizQuestion & {`);
        lines.push(`  type: "multiple-choice" | "matching";`);
        lines.push(`  options: string[];`);
        lines.push(`};`);
        lines.push("");

        lines.push(`type OtherQuestion = BaseQuizQuestion & {`);
        lines.push(`  type: "translation" | "recitation";`);
        lines.push(`  options?: string[];`);
        lines.push(`};`);
        lines.push("");

        lines.push(`export type QuizQuestion = MultipleChoiceQuestion | OtherQuestion;`);
        lines.push("");

        lines.push(`export interface VocabQuestionTemplate {`);
        lines.push(`  id: string;`);
        lines.push(`  lessonId: number;`);
        lines.push(
            `  type: "vocab-matching" | "vocab-multiple-choice" | "vocab-translation";`,
        );
        lines.push(`  format: "auto-generated";`);
        lines.push(`  wordCount: number;`);
        lines.push(`  instruction: string;`);
        lines.push(`}`);
        lines.push("");

        lines.push(`export interface Module {`);
        lines.push(`  id: number;`);
        lines.push(`  title: string;`);
        lines.push(`  description: string;`);
        lines.push(`  days: number[];`);
        lines.push(`}`);
        lines.push("");

        // Modules export
        lines.push(`// Modules from seed data`);
        lines.push(`export const modules: Module[] = [`);
        for (const mod of modules) {
            const numId = this.extractNumber(mod.id);
            lines.push(`  {`);
            lines.push(`    id: ${numId},`);
            lines.push(`    title: ${JSON.stringify(mod.name)},`);
            lines.push(`    description: ${JSON.stringify(mod.description)},`);
            // Extract days from lessons
            const moduleLessons = lessons.filter((l) => l.moduleId === mod.id);
            const days = moduleLessons.map((l) => l.day).sort((a, b) => a - b);
            lines.push(`    days: [${days.join(", ")}],`);
            lines.push(`  },`);
        }
        lines.push(`];`);
        lines.push("");

        // VocabQuestionTemplates export
        lines.push(`// Vocabulary question templates from seed data`);
        lines.push(`export const vocabQuestionTemplates: VocabQuestionTemplate[] = [`);
        for (const template of templates) {
            const lessonNum = this.extractNumber(template.lessonId);
            lines.push(`  {`);
            lines.push(`    id: ${JSON.stringify(template.id)},`);
            lines.push(`    lessonId: ${lessonNum},`);
            lines.push(`    type: ${JSON.stringify(template.type)},`);
            lines.push(`    format: "auto-generated",`);
            lines.push(`    wordCount: ${template.wordCount},`);
            lines.push(`    instruction: ${JSON.stringify(template.instruction)},`);
            lines.push(`  },`);
        }
        lines.push(`];`);
        lines.push("");

        // Placeholder lessons (full implementation would extract from lesson-content.json)
        lines.push(`// NOTE: Full lesson content should be extracted from seed data`);
        lines.push(`// For now, this is a placeholder. Full implementation in progress.`);
        lines.push(`export const lessons: Lesson[] = [];`);
        lines.push("");

        // Placeholder vocabulary
        lines.push(
            `// NOTE: Vocabulary data should be extracted from scripts/seeder/data/vocabulary.csv`,
        );
        lines.push(`// For now, this is a placeholder. Full implementation in progress.`);
        lines.push(`export const vocabulary: Record<string, string[]> = {};`);
        lines.push("");

        lines.push(`// Generated: ${new Date().toISOString()}`);

        return lines.join("\n");
    }

    /**
     * Extract number from ID like "L001" -> 1, "M02" -> 2
     */
    private extractNumber(id: string): number {
        const match = id.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
    }
}
