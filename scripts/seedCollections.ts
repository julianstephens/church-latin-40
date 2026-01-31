// Run with: pnpx tsx scripts/seedCollections.ts [--reset]
// --reset: Delete all existing records and reseed everything
// default: Only add missing records, preserve existing data
/* eslint-disable @typescript-eslint/no-explicit-any */

import PocketBase from "pocketbase";
import { lessons, modules } from "../src/data/courseData";
import { COLLECTIONS } from "../src/data/schema";

const POCKETBASE_URL =
  process.env.VITE_POCKETBASE_URL || "https://pocketbase.cyborgdev.cloud";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || "admin123456";
const RESET_MODE = process.argv.includes("--reset");

const pb = new PocketBase(POCKETBASE_URL);

/**
 * Format validation errors for user-friendly display
 */
function formatValidationError(error: any): string {
  if (error.response?.data?.data) {
    const data = error.response.data.data;
    return Object.entries(data)
      .map(([field, details]: [string, any]) => {
        const msg = details.message || details;
        return `      • ${field}: ${msg}`;
      })
      .join("\n");
  }
  if (error.response?.data) {
    return JSON.stringify(error.response.data);
  }
  return error.message || "Unknown error";
}

/**
 * Check if error is due to missing collection
 */
function isMissingCollectionError(error: any): boolean {
  const message = error.message?.toLowerCase() || "";
  const statusCode = error.status;
  return message.includes("not found") || statusCode === 404;
}

/**
 * Get diagnostic info for troubleshooting
 */
function getDiagnosticInfo(): string {
  return `
📋 Diagnostic Information:
  • PocketBase URL: ${POCKETBASE_URL}
  • Admin Email: ${ADMIN_EMAIL}
  
To troubleshoot:
  1. Verify the PocketBase instance is running and accessible
  2. Check credentials are correct (set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD env vars)
  3. Ensure all required collections exist (run setupCollections first)
  4. Check PocketBase logs for detailed error messages
`;
}

async function seedPocketBase() {
  try {
    console.log("🔐 Authenticating with PocketBase...");
    console.log(`   URL: ${POCKETBASE_URL}`);

    try {
      await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
      console.log("✅ Admin authenticated");
    } catch (authError: any) {
      console.error("❌ Authentication failed");
      if (authError.status === 401) {
        console.error(
          "   Invalid credentials. Check PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD env vars.",
        );
      } else if (isMissingCollectionError(authError)) {
        console.error("   Cannot reach PocketBase. Check VITE_POCKETBASE_URL.");
      } else {
        console.error("   Error:", authError.message);
      }
      console.error(getDiagnosticInfo());
      process.exit(1);
    }

    if (RESET_MODE) {
      console.log("\n🧹 RESET MODE: Clearing all records...");
    } else {
      console.log("\n📚 SEED MODE: Adding missing records only...");
    }

    // Verify all required collections exist
    console.log("\n📋 Verifying collections...");
    const missingCollections: string[] = [];
    for (const collSchema of COLLECTIONS) {
      try {
        await pb.collections.getOne(collSchema.name);
      } catch (e: any) {
        if (isMissingCollectionError(e)) {
          missingCollections.push(collSchema.name);
        } else {
          throw e;
        }
      }
    }

    if (missingCollections.length > 0) {
      console.error("❌ Missing collections:");
      missingCollections.forEach((c) => {
        console.error(`   • ${c}`);
      });
      console.error(`
Please run setupCollections.ts first to create all required collections.`);
      process.exit(1);
    }

    console.log("✅ All required collections found\n");

    // Step 1: Clear records if in RESET mode
    if (RESET_MODE) {
      console.log("🧹 Truncating tables...");
      // Process in reverse order to handle foreign keys (delete children before parents)
      const reversedCollections = [...COLLECTIONS].reverse();
      for (const collSchema of reversedCollections) {
        try {
          // Get all records and delete them
          const records = await pb
            .collection(collSchema.name)
            .getFullList({ batch: 500 });
          let deletedCount = 0;
          for (const record of records) {
            try {
              await pb.collection(collSchema.name).delete(record.id);
              deletedCount++;
            } catch {
              // Ignore delete errors
            }
          }
          if (deletedCount > 0) {
            console.log(
              `  ✅ Deleted ${deletedCount} records from ${collSchema.displayName}`,
            );
          }
        } catch {
          // Ignore errors - collection might be empty
        }
      }
      console.log();
    }

    // Step 2: Seed modules
    console.log("📚 Seeding modules...");
    const moduleMap = new Map<number, string>();
    let moduleSuccessCount = 0;
    let moduleFailureCount = 0;

    for (let i = 0; i < modules.length; i++) {
      const module = modules[i];

      const moduleData: Record<string, any> = {
        name: module.title,
        description: module.description,
        moduleNumber: module.id,
        lessonCount: module.days.length,
        displayOrder: i + 1,
      };

      try {
        const record = await pb
          .collection("church_latin_modules")
          .create(moduleData);
        moduleMap.set(module.id, record.id);
        moduleSuccessCount++;
        console.log(
          `  ✅ Module ${module.id}: "${module.title}" (PB ID: ${record.id})`,
        );
      } catch (error: any) {
        moduleFailureCount++;
        console.error(`  ❌ Failed to create module ${module.id}:`);
        console.error(`    ${formatValidationError(error)}`);
        if (error.status === 403) {
          console.error(
            "    (Permission denied - check user has admin access)",
          );
        }
      }
    }

    if (moduleFailureCount > 0) {
      console.warn(
        `\n⚠️  ${moduleFailureCount} modules failed. Continuing with ${moduleSuccessCount} created...`,
      );
    }

    // Step 3: Seed lessons
    console.log("\n📖 Seeding lessons...");
    const lessonMap = new Map<number, string>();
    let lessonSuccessCount = 0;
    let lessonFailureCount = 0;

    for (const lesson of lessons) {
      const modulePbId = moduleMap.get(lesson.module);

      if (!modulePbId) {
        console.warn(
          `  ⏭️  Lesson ${lesson.id}: Module ${lesson.module} not created (skipping)`,
        );
        continue;
      }

      const lessonData: Record<string, any> = {
        name: lesson.title,
        lessonNumber: lesson.id,
        moduleId: modulePbId,
        displayOrder: lesson.id,
      };

      try {
        const record = await pb
          .collection("church_latin_lessons")
          .create(lessonData);
        lessonMap.set(lesson.id, record.id);
        lessonSuccessCount++;
        console.log(
          `  ✅ Lesson ${lesson.id}: "${lesson.title}" (PB ID: ${record.id})`,
        );
      } catch (error: any) {
        lessonFailureCount++;
        console.error(`  ❌ Failed to create lesson ${lesson.id}:`);
        console.error(`    ${formatValidationError(error)}`);
      }
    }

    if (lessonFailureCount > 0) {
      console.warn(
        `\n⚠️  ${lessonFailureCount} lessons failed. Continuing with ${lessonSuccessCount} created...`,
      );
    }

    // Step 4: Seed lesson content
    console.log("\n📝 Seeding lesson content...");
    let contentSuccessCount = 0;
    let contentFailureCount = 0;

    for (const lesson of lessons) {
      const lessonPbId = lessonMap.get(lesson.id);

      if (!lessonPbId) {
        console.warn(
          `  ⏭️  Content ${lesson.id}: Lesson not created (skipping)`,
        );
        continue;
      }

      const contentData: Record<string, any> = {
        lessonId: lessonPbId,
        latinContent: lesson.content.join("\n\n"),
        englishTranslation: lesson.materials.join("\n\n"),
        grammarExplanation:
          lesson.materials
            .filter(
              (m) =>
                m.toLowerCase().includes("grammar") ||
                m.toLowerCase().includes("conjugation"),
            )
            .join("\n\n") || "See materials",
        vocabularyList: lesson.vocabulary,
        pronunciationGuide:
          lesson.materials
            .filter((m) => m.toLowerCase().includes("pronunciation"))
            .join("\n\n") || "See materials",
        culturalNotes:
          lesson.materials
            .filter(
              (m) =>
                m.toLowerCase().includes("cultural") ||
                m.toLowerCase().includes("history"),
            )
            .join("\n\n") || "",
      };

      try {
        const record = await pb
          .collection("church_latin_lesson_content")
          .create(contentData);
        contentSuccessCount++;
        console.log(`  ✅ Content ${lesson.id} (PB ID: ${record.id})`);
      } catch (error: any) {
        contentFailureCount++;
        console.error(`  ❌ Failed to create content ${lesson.id}:`);
        console.error(`    ${formatValidationError(error)}`);
      }
    }

    if (contentFailureCount > 0) {
      console.warn(
        `\n⚠️  ${contentFailureCount} content records failed. Continuing with ${contentSuccessCount} created...`,
      );
    }

    // Step 5: Seed quiz questions and quizzes
    console.log("\n❓ Seeding quiz questions...");
    let questionSuccessCount = 0;
    let questionFailureCount = 0;
    let quizSuccessCount = 0;

    for (const lesson of lessons) {
      const lessonPbId = lessonMap.get(lesson.id);

      if (!lessonPbId) {
        console.warn(
          `  ⏭️  Questions for lesson ${lesson.id}: Lesson not created (skipping)`,
        );
        continue;
      }

      if (!lesson.quiz || lesson.quiz.length === 0) {
        console.log(`  ⏭️  Lesson ${lesson.id}: No quiz`);
        continue;
      }

      // Step 1: Create quiz record first (without questionIds)
      let quizRecord: any;
      try {
        const quizData: Record<string, any> = {
          lessonId: lessonPbId,
          questionIds: [], // Start with empty array
        };

        quizRecord = await pb
          .collection("church_latin_quizzes")
          .create(quizData);
        quizSuccessCount++;
      } catch (error: any) {
        console.error(`  ❌ Failed to create quiz ${lesson.id}:`);
        console.error(`    ${formatValidationError(error)}`);
        continue; // Skip to next lesson if quiz creation fails
      }

      // Step 2: Create individual question records with quizId relationship
      const createdQuestionIds: string[] = [];

      for (let qIndex = 0; qIndex < lesson.quiz.length; qIndex++) {
        const q = lesson.quiz[qIndex];
        const isMultipleChoice = "options" in q && q.options;

        const questionData: Record<string, any> = {
          lessonId: lessonPbId,
          quizId: quizRecord.id, // Link to the quiz
          questionId: q.questionId || "",
          questionIndex: qIndex,
          type: isMultipleChoice ? "multipleChoice" : "freeResponse",
          question: q.question,
          ...(isMultipleChoice && { options: q.options }),
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || "",
        };

        try {
          const record = await pb
            .collection("church_latin_quiz_questions")
            .create(questionData);
          createdQuestionIds.push(record.id);
          questionSuccessCount++;
          console.log(`    ✅ Q${qIndex + 1}: ${q.questionId}`);
        } catch (error: any) {
          questionFailureCount++;
          console.error(`    ❌ Failed to create question ${q.questionId}:`);
          console.error(`      ${formatValidationError(error)}`);
        }
      }

      // Step 3: Update quiz with the questionIds
      if (createdQuestionIds.length > 0) {
        try {
          await pb.collection("church_latin_quizzes").update(quizRecord.id, {
            questionIds: createdQuestionIds,
          } as never);
          console.log(
            `  ✅ Quiz ${lesson.id} (${createdQuestionIds.length} questions, PB ID: ${quizRecord.id})`,
          );
        } catch (error: any) {
          console.error(
            `  ❌ Failed to update quiz ${lesson.id} with questions:`,
          );
          console.error(`    ${formatValidationError(error)}`);
        }
      }
    }

    if (questionFailureCount > 0) {
      console.warn(
        `\n⚠️  ${questionFailureCount} questions failed. ${questionSuccessCount} questions created successfully.`,
      );
    }

    // Summary
    console.log("\n✨ Seeding complete!");
    console.log(`  📚 Modules: ${moduleSuccessCount}/${modules.length}`);
    console.log(`  📖 Lessons: ${lessonSuccessCount}/${lessons.length}`);
    console.log(`  📝 Content: ${contentSuccessCount}/${lessons.length}`);
    console.log(
      `  ❓ Questions: ${questionSuccessCount}/${lessons.reduce((sum, l) => sum + (l.quiz?.length || 0), 0)}`,
    );
    console.log(
      `  ❓ Quizzes: ${quizSuccessCount}/${lessons.filter((l) => l.quiz.length > 0).length}`,
    );

    if (
      moduleFailureCount > 0 ||
      lessonFailureCount > 0 ||
      contentFailureCount > 0 ||
      questionFailureCount > 0
    ) {
      console.warn("\n⚠️  Some records failed to create. Review errors above.");
      console.warn("\nCommon issues:");
      console.warn(
        "  • Missing or incorrectly named fields in PocketBase collections",
      );
      console.warn(
        "  • Field type mismatches (e.g., trying to set Text into Number field)",
      );
      console.warn(
        "  • Missing required fields or validation rules rejecting data",
      );
      console.warn("\nSolution: Check field names match schema.ts");
      process.exit(1);
    }
  } catch (error: any) {
    console.error("❌ Fatal error during seeding:");
    console.error(`   ${formatValidationError(error)}`);

    // Provide context-specific advice
    if (isMissingCollectionError(error)) {
      console.error(`
The script could not access one of the collections. This typically means:
  1. One or more collections don't exist yet
  2. The PocketBase instance is not reachable
  3. There's a network connectivity issue

${getDiagnosticInfo()}`);
    } else if (error.status === 401 || error.status === 403) {
      console.error(`
Permission error. Make sure:
  1. Admin credentials are correct (PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD)
  2. The user has admin role in PocketBase
  3. You're not using a read-only token
`);
    }

    process.exit(1);
  }
}

seedPocketBase();
