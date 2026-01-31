import PocketBase from 'pocketbase';

const pb = new PocketBase(
    process.env.VITE_POCKETBASE_URL || 'https://pocketbase.cyborgdev.cloud'
);

async function checkSchema() {
    try {
        await pb.admins.authWithPassword(
            process.env.PB_ADMIN_EMAIL || 'admin@example.com',
            process.env.PB_ADMIN_PASSWORD || 'admin123456'
        );

        const collection = await pb.collections.getOne('church_latin_quiz_questions');

        console.log('📋 church_latin_quiz_questions schema:\n');
        console.log(JSON.stringify(collection.schema, null, 2));
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

checkSchema();
