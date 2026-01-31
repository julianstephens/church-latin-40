/**
 * Shared utilities for the seeding system: PocketBase client, file I/O, logging
 */

import * as fs from "fs";
import * as path from "path";
import PocketBase from "pocketbase";
import { fileURLToPath } from "url";
import type { SeedError, SeedOptions, SeedResult } from "./types";

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global PocketBase client instance
let pbInstance: PocketBase | null = null;

/**
 * Initialize and return PocketBase client
 */
export async function getPocketBase(): Promise<PocketBase> {
    if (pbInstance) {
        return pbInstance;
    }

    const pbUrl = process.env.VITE_POCKETBASE_URL || "http://localhost:8090";
    pbInstance = new PocketBase(pbUrl);

    const adminEmail = process.env.PB_ADMIN_EMAIL;
    const adminPassword = process.env.PB_ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
        logWarn("⚠️  WARNING: Admin credentials not provided. Set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD environment variables.");
        logWarn("⚠️  Without admin auth, writes to PocketBase will fail silently!");
        return pbInstance;
    }

    try {
        await pbInstance.admins.authWithPassword(adminEmail, adminPassword);
        logVerbose(`✅ Authenticated with PocketBase admin account`, { verbose: true } as any);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(`❌ Failed to authenticate with PocketBase admin account: ${message}`);
        throw new Error(`PocketBase admin authentication failed: ${message}`);
    }

    return pbInstance;
}

/**
 * Read JSON data file from seeder/data/ directory
 */
export function readJsonData<T>(filename: string): T[] {
    const filepath = path.join(__dirname, "data", filename);

    if (!fs.existsSync(filepath)) {
        throw new Error(`Data file not found: ${filepath}`);
    }

    const content = fs.readFileSync(filepath, "utf-8");
    return JSON.parse(content) as T[];
}

/**
 * Read CSV data file from seeder/data/ directory
 */
export function readCsvData(filename: string): Record<string, string>[] {
    const filepath = path.join(__dirname, "data", filename);

    if (!fs.existsSync(filepath)) {
        throw new Error(`Data file not found: ${filepath}`);
    }

    const content = fs.readFileSync(filepath, "utf-8");
    const lines = content.trim().split("\n");

    if (lines.length === 0) {
        return [];
    }

    // Parse CSV header
    const headers = lines[0].split(",").map((h) => h.trim());

    // Parse data rows
    const records: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim());
        const record: Record<string, string> = {};

        for (let j = 0; j < headers.length; j++) {
            record[headers[j]] = values[j] || "";
        }

        records.push(record);
    }

    return records;
}

/**
 * Write JSON data to file
 */
export function writeJsonData<T>(filename: string, data: T[]): void {
    const filepath = path.join(__dirname, "data", filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

/**
 * Format log output with timestamp and level
 */
function formatLog(level: string, message: string): string {
    const timestamp = new Date().toISOString().slice(11, 19);
    return `[${timestamp}] ${level} ${message}`;
}

/**
 * Log info message
 */
export function logInfo(message: string): void {
    console.log(formatLog("ℹ️ ", message));
}

/**
 * Log success message
 */
export function logSuccess(message: string): void {
    console.log(formatLog("✅", message));
}

/**
 * Log warning message
 */
export function logWarn(message: string): void {
    console.log(formatLog("⚠️ ", message));
}

/**
 * Log error message
 */
export function logError(message: string): void {
    console.error(formatLog("❌", message));
}

/**
 * Log verbose message (only if verbose option enabled)
 */
export function logVerbose(message: string, options: SeedOptions): void {
    if (options.verbose) {
        console.log(formatLog("📝", message));
    }
}

/**
 * Create seed result with summary
 */
export function createSeedResult(
    collection: string,
    added: number,
    updated: number,
    skipped: number,
    errors: SeedError[],
    startTime: number,
): SeedResult {
    return {
        collection,
        added,
        updated,
        skipped,
        errors,
        duration: Date.now() - startTime,
    };
}

/**
 * Check if record already exists in collection
 */
export async function recordExists(
    collection: string,
    id: string,
): Promise<boolean> {
    try {
        (await getPocketBase()).collection(collection).getOne(id);
        return true;
    } catch {
        return false;
    }
}

/**
 * Safe upsert with error handling
 */
export async function upsertRecord(
    collection: string,
    id: string,
    data: any,
    options: SeedOptions,
): Promise<{ created: boolean; error?: Error; }> {
    try {
        const exists = await recordExists(collection, id);

        if (exists) {
            if (!options.dryRun) {
                (await getPocketBase()).collection(collection).update(id, data);
            }
            logVerbose(`Updated ${collection}/${id}`, options);
            return { created: false };
        } else {
            if (!options.dryRun) {
                (await getPocketBase()).collection(collection).create({ id, ...data });
            }
            logVerbose(`Created ${collection}/${id}`, options);
            return { created: true };
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { created: false, error: new Error(message) };
    }
}

/**
 * Clear all records from collection (reset mode)
 */
export async function clearCollection(
    collection: string,
    options: SeedOptions,
): Promise<void> {
    if (!options.reset) return;

    try {
        const records = await (await getPocketBase()).collection(collection).getFullList();

        if (!options.dryRun) {
            for (const record of records) {
                (await getPocketBase()).collection(collection).delete(record.id);
            }
        }

        logSuccess(`Cleared ${collection} (${records.length} records)`);
    } catch (error) {
        logError(
            `Failed to clear ${collection}: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

/**
 * Validate seeder data against schema
 */
export function validateDataSchema(
    data: any,
    requiredFields: string[],
): SeedError[] {
    const errors: SeedError[] = [];

    for (const field of requiredFields) {
        if (!data[field]) {
            errors.push({
                record: data,
                message: `Missing required field: ${field}`,
            });
        }
    }

    return errors;
}
