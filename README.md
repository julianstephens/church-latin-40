# Ecclesiastical Latin: 40 Days to Sacred Language

All site design, development, and course content by [masaharumori7](https://github.com/masaharumori7/church-latin-40).

This fork adds authentication via Auth0 and data storage using PocketBase.

## Environment Configuration

### Required Environment Variables

This application requires the following environment variables to run:

1. **VITE_AUTH0_DOMAIN** - Your Auth0 application domain
   - Format: `your-domain.auth0.com` or `your-domain.region.auth0.com`
   - Get from: [Auth0 Dashboard](https://manage.auth0.com/dashboard)

2. **VITE_AUTH0_CLIENT_ID** - Your Auth0 application client ID
   - Get from: [Auth0 Dashboard](https://manage.auth0.com/dashboard)

3. **VITE_POCKETBASE_URL** - URL where your PocketBase instance is running
   - Local development: `http://localhost:8080`
   - Production: `https://your-pb-instance.com`

### Optional Environment Variables

- **VITE_GITHUB_ISSUES_URL** - URL to your GitHub issues page (used in error boundary)

### Setup Instructions

1. Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

2. Update `.env.local` with your actual configuration values:

   ```bash
   VITE_AUTH0_DOMAIN=your-domain.auth0.com
   VITE_AUTH0_CLIENT_ID=your-client-id
   VITE_POCKETBASE_URL=http://localhost:8090
   ```

3. The application will automatically validate your environment configuration on startup and provide detailed error messages if any required variables are missing or incorrectly formatted.

### Environment Validation

The application includes built-in environment validation that checks:

- ✓ All required variables are present
- ✓ Auth0 domain format is valid
- ✓ Auth0 client ID has reasonable length
- ✓ PocketBase URL is a valid URL with proper protocol
- ✓ PocketBase collection name follows naming conventions

If validation fails, the application will display detailed error messages indicating which variables need to be fixed and what the correct format should be.

## PocketBase Collections

The application uses the following PocketBase collections. All collections are automatically created and configured by running `scripts/setupCollections.ts`.

**Note:** User authentication is handled by Auth0 then stored in PocketBase's built-in `users` collection.

### 1. church_latin_modules

Stores module (course section) metadata. Modules organize the 40 lessons into 5 sequential learning sections.

| Field        | Type   | Description                                |
| ------------ | ------ | ------------------------------------------ |
| resourceId   | Text   | Custom module identifier (unique)          |
| moduleNumber | Number | Module identifier (1-5, unique)            |
| name         | Text   | Module title                               |
| description  | Text   | Module description and learning objectives |
| lessonCount  | Number | Number of lessons in this module           |
| displayOrder | Number | Order to display modules in UI             |

**Indexes:** `resourceId`, `moduleNumber`

### 2. church_latin_lessons

Stores lesson metadata. Each lesson belongs to one module and contains 3 quiz questions.

| Field        | Type     | Description                                         |
| ------------ | -------- | --------------------------------------------------- |
| resourceId   | Text     | Custom lesson identifier (unique)                   |
| moduleId     | Relation | Reference to parent module (`church_latin_modules`) |
| lessonNumber | Number   | Lesson identifier (1-40, unique)                    |
| name         | Text     | Lesson title                                        |
| displayOrder | Number   | Order within the module                             |

**Indexes:** `resourceId`, `lessonNumber`

### 3. church_latin_lesson_content

Stores detailed lesson content. Lazy-loaded on lesson view. Contains lesson text paragraphs (joined with paragraph breaks) and practice exercises. All 40 lessons are seeded with complete content from `scripts/seeder/data/lesson-content.json`.

| Field      | Type     | Description                                         |
| ---------- | -------- | --------------------------------------------------- |
| resourceId | Text     | Custom content identifier (unique)                  |
| lessonId   | Relation | Reference to lesson (`church_latin_lessons`)        |
| content    | Text     | Full lesson content with paragraphs (required)      |
| practice   | JSON     | Array of practice exercises/instructions            |
| materials  | JSON     | Array of lesson materials/overview items (optional) |

**Indexes:** `resourceId`, `lessonId`

**Lesson Content Data Format**

The lesson content is seeded from `scripts/seeder/data/lesson-content.json`, which contains all 40 lessons with the following structure:

```json
{
  "lessonId": "L001",
  "content": [
    "First paragraph of lesson content",
    "Second paragraph",
    "Third paragraph",
    "Fourth paragraph"
  ],
  "materials": [
    "Overview item 1",
    "Overview item 2",
    "Overview item 3",
    "Overview item 4"
  ],
  "practice": [
    "Practice instruction 1",
    "Practice instruction 2",
    "Full practice text..."
  ]
}
```

- **content**: Array of strings (paragraphs) - joined with `\n\n` when stored in PocketBase
- **materials**: Array of lesson overview/introduction items (4 per lesson)
- **practice**: Array of practice instructions and exercise details (6-20 items per lesson)

### 4. church_latin_quiz_questions

Individual quiz questions with stable, unique IDs. Each question belongs to one lesson and one quiz.

| Field              | Type     | Description                                                               |
| ------------------ | -------- | ------------------------------------------------------------------------- |
| resourceId         | Text     | Custom question identifier (unique)                                       |
| quizId             | Relation | Reference to parent quiz (`church_latin_quizzes`, optional)               |
| lessonId           | Relation | Reference to lesson (`church_latin_lessons`, required)                    |
| questionId         | Text     | Stable question ID (unique)                                               |
| questionIndex      | Number   | Position within lesson                                                    |
| type               | Select   | Question type: `multiple-choice`, `matching`, `translation`, `recitation` |
| question           | Text     | Question text (required)                                                  |
| options            | JSON     | Array of answer options (for multiple-choice/matching)                    |
| correctAnswer      | Text     | Correct answer(s)                                                         |
| explanation        | Text     | Explanation shown after answering                                         |
| isTemplateQuestion | Checkbox | Whether this is a template question                                       |
| templateId         | Text     | Template identifier if this is a template question                        |

**Indexes:** `resourceId`, `questionId`

### 5. church_latin_vocabulary

Stores Latin vocabulary words with context and learning metadata. Used for vocabulary review and reference.

| Field             | Type     | Description                                                                                            |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| resourceId        | Text     | Custom vocabulary identifier (unique)                                                                  |
| lessonId          | Relation | Reference to lesson (`church_latin_lessons`, required)                                                 |
| word              | Text     | Latin word (required)                                                                                  |
| meaning           | Text     | English meaning/definition (required)                                                                  |
| partOfSpeech      | Select   | Word category: `noun`, `verb`, `adjective`, `adverb`, `preposition`, `pronoun`, `conjunction`, `other` |
| caseInfo          | Text     | Grammatical case information                                                                           |
| conjugationInfo   | Text     | Verb conjugation information                                                                           |
| frequency         | Select   | Usage frequency: `high`, `medium`, `low`, `unknown`                                                    |
| liturgicalContext | Text     | Where this word appears in liturgical texts                                                            |

**Indexes:** `resourceId`, `lessonId`, `(lessonId, word)`

### 6. church_latin_quizzes

Quiz metadata for each lesson. Links lesson to its questions via relation.

| Field       | Type     | Description                                                    |
| ----------- | -------- | -------------------------------------------------------------- |
| resourceId  | Text     | Custom quiz identifier (unique)                                |
| lessonId    | Relation | Reference to lesson (`church_latin_lessons`, unique, required) |
| questionIds | Relation | Array of question references (`church_latin_quiz_questions`)   |

**Indexes:** `resourceId`, `lessonId`

### 7. church_latin_user_progress

Stores user progress and learning state for the course, including completed lessons, quiz scores, and theme preferences.

| Field                | Type   | Description                                        |
| -------------------- | ------ | -------------------------------------------------- |
| resourceId           | Text   | Custom progress identifier (unique)                |
| userId               | Text   | Reference to PocketBase user ID (required, unique) |
| completedLessons     | Number | Count of completed lessons (0-40)                  |
| quizScores           | JSON   | Object mapping lesson IDs to quiz scores           |
| currentLesson        | Number | Current lesson being studied (1-40)                |
| theme                | Select | User's theme preference: `light` or `dark`         |
| lastAccessedAt       | Date   | ISO timestamp of most recent access                |
| lastLessonAccessedId | Number | Last lesson ID viewed by user                      |
| totalProgress        | Number | Cached completion percentage (0-100)               |

**Indexes:** `resourceId`, `userId`

### 8. church_latin_review_items

Spaced repetition scheduling data for quiz questions. Tracks learning state, due dates, and performance metrics for review.

| Field              | Type     | Description                                                                   |
| ------------------ | -------- | ----------------------------------------------------------------------------- |
| resourceId         | Text     | Custom review item identifier (unique)                                        |
| userId             | Text     | Reference to user being reviewed (required)                                   |
| lessonId           | Relation | Reference to lesson (`church_latin_lessons`, required)                        |
| questionId         | Text     | Stable question ID (required)                                                 |
| questionType       | Select   | Question category: `multiple-choice`, `matching`, `translation`, `recitation` |
| state              | Select   | Learning state: `learning`, `review`, `suspended`, `retired`                  |
| dueAt              | Date     | Next review due date (UTC, required)                                          |
| lastReviewedAt     | Date     | Last time this item was reviewed                                              |
| intervalDays       | Number   | Days between reviews                                                          |
| streak             | Number   | Consecutive correct answers                                                   |
| lapses             | Number   | Total number of incorrect answers                                             |
| lastResult         | Select   | Result of last review: `correct`, `incorrect`, `skipped`                      |
| vocabWordId        | Relation | Reference to vocabulary word (optional, no cascade delete)                    |
| originalQuestionId | Text     | Original question ID reference                                                |

**Indexes:** `resourceId`, `userId`, `lessonId`

### 9. church_latin_review_events

Audit trail for all review activities. Useful for analytics and debugging.

| Field        | Type     | Description                                            |
| ------------ | -------- | ------------------------------------------------------ |
| resourceId   | Text     | Custom event identifier (unique)                       |
| userId       | Text     | User who submitted the review (required)               |
| lessonId     | Relation | Reference to lesson (`church_latin_lessons`)           |
| questionId   | Text     | Stable question ID                                     |
| reviewItemId | Relation | Reference to review item (`church_latin_review_items`) |
| result       | Select   | Review result: `correct`, `incorrect`, `skipped`       |
| occurredAt   | Date     | When the review was submitted (UTC, required)          |
| answer       | JSON     | User's answer data (optional, for analysis)            |

**Indexes:** `resourceId`, `userId`, `lessonId`

## Setup Recommendations

1. **Enable API Rules**: Configure API rules to restrict access based on user authentication
2. **Enable Real-time Sync**: Consider enabling real-time updates if using multiple devices
3. **Set up Backups**: Configure regular backups for your PocketBase instance
4. **Seed Initial Data**: Use the migration scripts in `scripts/` to populate initial course data:

   First, create all collections with their schemas:

   ```bash
   VITE_POCKETBASE_URL=http://localhost:8090 \
   PB_ADMIN_EMAIL=admin@example.com \
   PB_ADMIN_PASSWORD=your_password \
   pnpx tsx scripts/setupCollections.ts
   ```

   Then seed the course data (modules, lessons, lesson content, vocabulary, and quizzes):

   ```bash
   VITE_POCKETBASE_URL=http://localhost:8090 \
   PB_ADMIN_EMAIL=admin@example.com \
   PB_ADMIN_PASSWORD=your_password \
   pnpx tsx scripts/seeder/index.ts
   ```

   This seeds all 40 lessons with complete content from `lesson-content.json`, materials, and practice exercises.

   To clear all data and reseed from scratch:

   ```bash
   VITE_POCKETBASE_URL=http://localhost:8090 \
   PB_ADMIN_EMAIL=admin@example.com \
   PB_ADMIN_PASSWORD=your_password \
   pnpx tsx scripts/seeder/index.ts --reset
   ```

   **Optional:** Dry-run mode to preview collection setup without making changes:

   ```bash
   VITE_POCKETBASE_URL=http://localhost:8090 \
   PB_ADMIN_EMAIL=admin@example.com \
   PB_ADMIN_PASSWORD=your_password \
   pnpx tsx scripts/setupCollections.ts --dry-run
   ```
