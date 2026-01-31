import PocketBase from 'pocketbase';
import { lessons } from '../src/data/courseData';

const pb = new PocketBase(
    process.env.VITE_POCKETBASE_URL || 'https://pocketbase.cyborgdev.cloud'
);

async function fixQuestionTypes() {
    try {
        // Authenticate as admin
        await pb.admins.authWithPassword(
            process.env.PB_ADMIN_EMAIL || 'admin@example.com',
            process.env.PB_ADMIN_PASSWORD || 'admin123456'
        );

        console.log('✅ Admin authenticated\n');

        // Mapping from courseData types to PocketBase enum values
        // Note: Translation questions are stored as freeResponse in PocketBase
        const typeMapping: { [key: string]: string; } = {
            'multiple-choice': 'multipleChoice',
            'matching': 'matching',
            'translation': 'freeResponse',  // Translation questions stored as freeResponse
            'recitation': 'recitation',
        };

        // Build type mappings from courseData
        const expectedTypes: { [questionId: string]: string; } = {};
        for (const lesson of lessons) {
            if (lesson.quiz && Array.isArray(lesson.quiz)) {
                for (const question of lesson.quiz) {
                    const pbType = typeMapping[question.type];
                    if (pbType) {
                        expectedTypes[question.questionId] = pbType;
                    } else {
                        console.warn(`⚠️  Unknown type "${question.type}" for ${question.questionId}`);
                    }
                }
            }
        }

        console.log(`🔧 Fixing question types (expected ${Object.keys(expectedTypes).length} questions)...\n`);

        // Fetch all questions
        const allQuestions = await pb.collection('church_latin_quiz_questions').getFullList();

        let fixed = 0;
        for (const record of allQuestions) {
            const expectedType = expectedTypes[record.questionId];

            if (!expectedType) {
                console.log(`⏭️  ${record.questionId}: Not in courseData`);
                continue;
            }

            if (record.type === expectedType) {
                console.log(`✅ ${record.questionId}: Already correct (${expectedType})`);
                continue;
            }

            // Update the type
            try {
                await pb.collection('church_latin_quiz_questions').update(record.id, {
                    type: expectedType,
                });

                console.log(`✅ ${record.questionId}: Fixed (${record.type} → ${expectedType})`);
                fixed++;
            } catch (updateError: any) {
                let errorMsg = updateError instanceof Error ? updateError.message : String(updateError);

                // Extract PocketBase validation error details
                if (updateError.response?.data?.data) {
                    const validationErrors = Object.entries(updateError.response.data.data)
                        .map(([field, details]: [string, any]) => `${field}: ${details.message || details}`)
                        .join('; ');
                    errorMsg = validationErrors;
                } else if (updateError.response?.data) {
                    errorMsg = JSON.stringify(updateError.response.data);
                }

                console.error(
                    `❌ ${record.questionId}: ${errorMsg}`
                );
            }
        }

        console.log(`\n✨ Fixed ${fixed} question(s)`);
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

fixQuestionTypes();
