// Run with: pnpx tsx scripts/migrateProgressSchema.ts
// Purpose: Backfill new fields in existing progress records
/* eslint-disable @typescript-eslint/no-explicit-any */

import PocketBase from "pocketbase";

const POCKETBASE_URL =
  process.env.VITE_POCKETBASE_URL || "https://pocketbase.cyborgdev.cloud";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || "admin123456";

const pb = new PocketBase(POCKETBASE_URL);

async function migrateProgressSchema() {
  try {
    console.log("🔐 Authenticating with PocketBase...");
    await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log("✅ Admin authenticated\n");

    console.log(
      "📊 Starting schema migration for church_latin_user_progress...\n",
    );

    // Fetch all progress records
    const records = await pb
      .collection("church_latin_user_progress")
      .getFullList({
        batch: 500,
      });

    console.log(`📈 Found ${records.length} progress records to migrate\n`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const record of records) {
      try {
        // Check if record already has new fields populated
        const hasNewFields =
          record.lastAccessedAt &&
          record.lastLessonAccessedId !== undefined &&
          record.totalProgress !== undefined;

        if (hasNewFields) {
          console.log(`⏭️  User ${record.userId}: Already migrated`);
          skippedCount++;
          continue;
        }

        // Calculate and populate new fields
        const completedCount = Array.isArray(record.completedLessons)
          ? record.completedLessons.length
          : 0;
        const totalProgress = Math.round((completedCount / 40) * 100);

        // Get the first completed lesson ID if available, or current lesson
        const lastLessonId =
          Array.isArray(record.completedLessons) &&
          record.completedLessons.length > 0
            ? record.completedLessons[record.completedLessons.length - 1]
            : record.currentLesson || 1;

        const updateData = {
          lastAccessedAt: record.updated || new Date().toISOString(),
          lastLessonAccessedId: lastLessonId,
          totalProgress: totalProgress,
        };

        await pb
          .collection("church_latin_user_progress")
          .update(record.id, updateData);

        console.log(
          `✅ User ${record.userId}: Migrated (${completedCount}/40 lessons, ${totalProgress}% progress)`,
        );
        migratedCount++;
      } catch (error: any) {
        console.error(
          `❌ Failed to migrate user ${record.userId}:`,
          error.message,
        );
        if (error.response?.data) {
          console.error(
            "  Details:",
            JSON.stringify(error.response.data, null, 2),
          );
        }
      }
    }

    console.log("\n✨ Migration complete!");
    console.log(`📊 Summary:`);
    console.log(`  ✅ Migrated: ${migratedCount}`);
    console.log(`  ⏭️  Skipped (already migrated): ${skippedCount}`);
    console.log(`  📈 Total processed: ${migratedCount + skippedCount}\n`);

    // Verify the migration
    console.log("🔍 Verifying migration...");
    const verifyRecords = await pb
      .collection("church_latin_user_progress")
      .getFullList({ batch: 500 });

    const allMigrated = verifyRecords.every(
      (r) => r.lastAccessedAt && r.totalProgress !== undefined,
    );

    if (allMigrated) {
      console.log("✅ All records successfully migrated!\n");
    } else {
      const unmigrated = verifyRecords.filter(
        (r) => !r.lastAccessedAt || r.totalProgress === undefined,
      );
      console.warn(`⚠️  ${unmigrated.length} records still need migration\n`);
    }
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    if (error.response?.data) {
      console.error("Response:", JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

migrateProgressSchema();
