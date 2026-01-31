/// <reference types="node" />

import * as fs from "fs";
import * as path from "path";
import { lessons, modules } from "../src/data/courseData";

/**
 * Create a mapping of lesson ID to day number
 */
function createLessonToDayMap(): Map<number, number> {
  const map = new Map<number, number>();

  for (const module of modules) {
    const moduleLessons = lessons.filter((l) => l.module === module.id);
    moduleLessons.sort((a, b) => a.id - b.id);

    moduleLessons.forEach((lesson, lessonIndexInModule) => {
      const dayIndex = module.days[lessonIndexInModule];
      if (dayIndex !== undefined) {
        map.set(lesson.id, dayIndex);
      }
    });
  }

  return map;
}

/**
 * Generate a question ID
 */
function generateQuestionId(dayNumber: number, questionIndex: number): string {
  return `D${String(dayNumber).padStart(2, "0")}-Q${String(
    questionIndex + 1,
  ).padStart(2, "0")}`;
}

/**
 * Update courseData.ts to include questionIds
 */
function updateCourseDataFile(): void {
  const courseDataPath = path.join(process.cwd(), "src/data/courseData.ts");
  let content = fs.readFileSync(courseDataPath, "utf-8");
  const lessonToDayMap = createLessonToDayMap();

  let questionsAdded = 0;

  // Process each lesson
  for (const lesson of lessons) {
    if (lesson.quiz.length === 0) continue;

    const dayNumber = lessonToDayMap.get(lesson.id);
    if (!dayNumber) continue;

    // Process each question in the lesson
    for (let qIndex = 0; qIndex < lesson.quiz.length; qIndex++) {
      const question = lesson.quiz[qIndex];
      const questionId = generateQuestionId(dayNumber, qIndex);

      // Find the specific question block by its id and replace with version including questionId
      // Pattern: "id: N," where N is the question id, followed by next property
      const oldPattern = `        id: ${question.id},
        question:`;
      const newPattern = `        id: ${question.id},
        questionId: "${questionId}",
        question:`;

      if (content.includes(oldPattern)) {
        content = content.replace(oldPattern, newPattern);
        questionsAdded++;
        console.log(`  ✅ Lesson ${lesson.id} Q${qIndex + 1} → ${questionId}`);
      }
    }
  }

  // Write back
  fs.writeFileSync(courseDataPath, content, "utf-8");
  console.log(`\n📝 Updated ${questionsAdded} question IDs in courseData.ts`);
}

/**
 * Main
 */
async function main(): Promise<void> {
  console.log("🚀 Adding question IDs to courseData.ts...\n");

  try {
    updateCourseDataFile();
    console.log("\n✅ All question IDs added successfully!");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
