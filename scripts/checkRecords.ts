import PocketBase from 'pocketbase';

const pb = new PocketBase(
    process.env.VITE_POCKETBASE_URL || 'https://pocketbase.cyborgdev.cloud'
);

async function checkRecords() {
    try {
        await pb.admins.authWithPassword(
            process.env.PB_ADMIN_EMAIL || 'admin@example.com',
            process.env.PB_ADMIN_PASSWORD || 'admin123456'
        );

        // Get a few records to see what type values are actually stored
        const records = await pb.collection('church_latin_quiz_questions').getList(1, 5);

        console.log('📋 Sample records:\n');

        for (const record of records.items) {
            console.log(`${record.questionId}: type = "${record.type}"`);
        }
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

checkRecords();
