import PocketBase from 'pocketbase';

const pb = new PocketBase(
    process.env.VITE_POCKETBASE_URL || 'https://pocketbase.cyborgdev.cloud'
);

async function testMatchingType() {
    try {
        await pb.admins.authWithPassword(
            process.env.PB_ADMIN_EMAIL || 'admin@example.com',
            process.env.PB_ADMIN_PASSWORD || 'admin123456'
        );

        console.log('Testing if "matching" is a valid enum value...\n');

        // Get D01-Q02
        const records = await pb.collection('church_latin_quiz_questions').getFullList({
            filter: 'questionId = "D01-Q02"',
        });

        if (records.length === 0) {
            console.log('D01-Q02 not found');
            return;
        }

        const record = records[0];
        console.log(`Current: D01-Q02 = ${record.type}`);
        console.log(`Attempting to set type to "matching"...\n`);

        try {
            await pb.collection('church_latin_quiz_questions').update(record.id, {
                type: 'matching',
            });
            console.log('✅ Successfully updated to "matching"');
        } catch (error: any) {
            console.log('❌ Failed to update to "matching"');
            if (error.response?.data?.data) {
                console.log(`   Error: ${JSON.stringify(error.response.data.data)}`);
            } else {
                console.log(`   Error: ${error.message}`);
            }
        }
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

testMatchingType();
