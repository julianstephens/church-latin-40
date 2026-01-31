import PocketBase from 'pocketbase';

const pb = new PocketBase(
    process.env.VITE_POCKETBASE_URL || 'https://pocketbase.cyborgdev.cloud'
);

async function inspectMatchingQuestion() {
    try {
        await pb.admins.authWithPassword(
            process.env.PB_ADMIN_EMAIL || 'admin@example.com',
            process.env.PB_ADMIN_PASSWORD || 'admin123456'
        );

        // Get D01-Q02 (the matching question) and D01-Q01 (a multiple choice) to compare
        const matching = await pb.collection('church_latin_quiz_questions').getFullList({
            filter: 'questionId = "D01-Q02"',
        });

        const multipleChoice = await pb.collection('church_latin_quiz_questions').getFullList({
            filter: 'questionId = "D01-Q01"',
        });

        console.log('📋 D01-Q02 (Matching question):');
        console.log(JSON.stringify(matching[0], null, 2));

        console.log('\n📋 D01-Q01 (Multiple choice question):');
        console.log(JSON.stringify(multipleChoice[0], null, 2));
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

inspectMatchingQuestion();
