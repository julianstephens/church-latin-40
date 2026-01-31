// Run with: pnpx tsx scripts/seedCollections.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import PocketBase from "pocketbase";
import { lessons, modules } from "../src/data/courseData";

const POCKETBASE_URL =
  process.env.VITE_POCKETBASE_URL || "https://pocketbase.cyborgdev.cloud";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || "admin123456";

const pb = new PocketBase(POCKETBASE_URL);

async function seedPocketBase() {
  try {
    console.log("🔐 Authenticating with PocketBase...");
    await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log("✅ Admin authenticated");

    // First, get collection schemas to see exact field names
    console.log("\n📋 Fetching collection schemas...");
    const modulesCollection = await pb.collections.getOne(
      "church_latin_modules",
    );
    const lessonsCollection = await pb.collections.getOne(
      "church_latin_lessons",
    );
    const contentCollection = await pb.collections.getOne(
      "church_latin_lesson_content",
    );
    const quizzesCollection = await pb.collections.getOne(
      "church_latin_quizzes",
    );

    console.log(
      "Modules fields:",
      modulesCollection.schema?.map((f: any) => f.name),
    );
    console.log(
      "Lessons fields:",
      lessonsCollection.schema?.map((f: any) => f.name),
    );
    console.log(
      "Content fields:",
      contentCollection.schema?.map((f: any) => f.name),
    );
    console.log(
      "Quizzes fields:",
      quizzesCollection.schema?.map((f: any) => f.name),
    );

    // Step 1: Seed modules
    console.log("\n📚 Seeding modules...");
    const moduleMap = new Map<number, string>();

    for (let i = 0; i < modules.length; i++) {
      const module = modules[i];

      // Try different field name combinations
      const moduleData: Record<string, any> = {
        name: module.title, // Try 'name' instead of 'title'
        title: module.title,
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
        console.log(
          `  ✅ Module ${module.id}: "${module.title}" (PB ID: ${record.id})`,
        );
      } catch (error: any) {
        console.error(`  ❌ Failed to create module ${module.id}:`);
        if (error.response?.data?.data) {
          console.error(
            "    Validation errors:",
            JSON.stringify(error.response.data.data, null, 2),
          );
        } else {
          console.error("    Error:", error.message);
        }
      }
    }

    // Step 2: Seed lessons
    console.log("\n📖 Seeding lessons...");
    const lessonMap = new Map<number, string>();

    for (const lesson of lessons) {
      const modulePbId = moduleMap.get(lesson.module);

      if (!modulePbId) {
        console.error(
          `  ⏭️  Lesson ${lesson.id}: Module ${lesson.module} not seeded yet, skipping`,
        );
        continue;
      }

      const lessonData: Record<string, any> = {
        name: lesson.title,
        title: lesson.title,
        lessonNumber: lesson.id,
        moduleId: modulePbId,
        displayOrder: lesson.id,
      };

      try {
        const record = await pb
          .collection("church_latin_lessons")
          .create(lessonData);
        lessonMap.set(lesson.id, record.id);
        console.log(
          `  ✅ Lesson ${lesson.id}: "${lesson.title}" (PB ID: ${record.id})`,
        );
      } catch (error: any) {
        console.error(`  ❌ Failed to create lesson ${lesson.id}:`);
        if (error.response?.data?.data) {
          console.error(
            "    Validation errors:",
            JSON.stringify(error.response.data.data, null, 2),
          );
        } else {
          console.error("    Error:", error.message);
        }
      }
    }

    // Step 3: Seed lesson content
    console.log("\n📝 Seeding lesson content...");
    for (const lesson of lessons) {
      const lessonPbId = lessonMap.get(lesson.id);

      if (!lessonPbId) {
        console.error(
          `  ⏭️  Content ${lesson.id}: Lesson not seeded, skipping`,
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
        console.log(`  ✅ Content ${lesson.id} (PB ID: ${record.id})`);
      } catch (error: any) {
        console.error(`  ❌ Failed to create content ${lesson.id}:`);
        if (error.response?.data?.data) {
          console.error(
            "    Validation errors:",
            JSON.stringify(error.response.data.data, null, 2),
          );
        } else {
          console.error("    Error:", error.message);
        }
      }
    }

    // Step 4: Seed quizzes
    console.log("\n❓ Seeding quizzes...");
    for (const lesson of lessons) {
      const lessonPbId = lessonMap.get(lesson.id);

      if (!lessonPbId) {
        console.error(`  ⏭️  Quiz ${lesson.id}: Lesson not seeded, skipping`);
        continue;
      }

      if (!lesson.quiz || lesson.quiz.length === 0) {
        console.log(`  ⏭️  Lesson ${lesson.id}: No quiz`);
        continue;
      }

      const quizQuestions = lesson.quiz.map((q) => {
        const isMultipleChoice = "options" in q && q.options;

        return {
          questionText: q.question,
          questionType: isMultipleChoice ? "multipleChoice" : "freeResponse",
          ...(isMultipleChoice && {
            multipleChoiceOptions: q.options!.map((option: string) => ({
              text: option,
              isCorrect: Array.isArray(q.correctAnswer)
                ? q.correctAnswer.includes(option)
                : q.correctAnswer === option,
            })),
          }),
          correctAnswer: q.correctAnswer,
          explanationText: q.explanation || "",
        };
      });

      const quizData: Record<string, any> = {
        lessonId: lessonPbId,
        quizQuestions: quizQuestions,
      };

      try {
        const record = await pb
          .collection("church_latin_quizzes")
          .create(quizData);
        console.log(
          `  ✅ Quiz ${lesson.id} (${lesson.quiz.length} questions, PB ID: ${record.id})`,
        );
      } catch (error: any) {
        console.error(`  ❌ Failed to create quiz ${lesson.id}:`);
        if (error.response?.data?.data) {
          console.error(
            "    Validation errors:",
            JSON.stringify(error.response.data.data, null, 2),
          );
        } else {
          console.error("    Error:", error.message);
        }
      }
    }

    console.log("\n✨ Seeding complete!");
    console.log(`  📚 Modules: ${moduleMap.size}`);
    console.log(`  📖 Lessons: ${lessonMap.size}`);
    console.log(
      `  ❓ Quizzes: ${lessons.filter((l) => l.quiz.length > 0).length}`,
    );
  } catch (error: any) {
    console.error("❌ Seeding failed:", error.message);
    if (error.response?.data) {
      console.error("Response:", JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

seedPocketBase();
