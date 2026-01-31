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
| moduleNumber | Number | Module identifier (1-5)                    |
| name         | Text   | Module title                               |
| description  | Text   | Module description and learning objectives |
| lessonCount  | Number | Number of lessons in this module           |
| displayOrder | Number | Order to display modules in UI             |

**Indexes:** `moduleNumber`

### 2. church_latin_lessons

Stores lesson metadata. Each lesson belongs to one module and contains 3 quiz questions.

| Field        | Type     | Description                                         |
| ------------ | -------- | --------------------------------------------------- |
| moduleId     | Relation | Reference to parent module (`church_latin_modules`) |
| lessonNumber | Number   | Lesson identifier (1-40)                            |
| name         | Text     | Lesson title                                        |
| displayOrder | Number   | Order within the module                             |

**Indexes:** `lessonNumber`, `moduleId`

### 3. church_latin_lesson_content

Stores detailed lesson content including Latin text, translations, and supporting materials. Lazy-loaded on lesson view.

| Field              | Type     | Description                                  |
| ------------------ | -------- | -------------------------------------------- |
| lessonId           | Relation | Reference to lesson (`church_latin_lessons`) |
| latinContent       | Text     | Latin text content for the lesson            |
| englishTranslation | Text     | English translation and explanation          |
| vocabularyList     | JSON     | Array of vocabulary words with definitions   |
| grammarExplanation | Text     | Grammar rules and conjugation patterns       |
| pronunciationGuide | Text     | Pronunciation guidance and audio notes       |
| culturalNotes      | Text     | Cultural and historical context              |

**Indexes:** `lessonId`

### 4. church_latin_quiz_questions

Individual quiz questions with stable, unique IDs. Each question belongs to one lesson and one quiz.

| Field         | Type     | Description                                                   |
| ------------- | -------- | ------------------------------------------------------------- |
| quizId        | Relation | Reference to parent quiz (`church_latin_quizzes`)             |
| lessonId      | Relation | Reference to lesson (`church_latin_lessons`)                  |
| questionId    | Text     | Stable question ID (`D{day:02d}-Q{index:02d}`)                |
| questionIndex | Number   | Position within lesson (0-2)                                  |
| type          | Select   | Question type: `multipleChoice`, `freeResponse`, `recitation` |
| question      | Text     | Question text                                                 |
| options       | JSON     | Array of answer options (for multipleChoice)                  |
| correctAnswer | Text     | Correct answer(s)                                             |
| explanation   | Text     | Explanation shown after answering                             |

**Indexes:** `questionId` (unique), `lessonId`, `quizId`

### 5. church_latin_quizzes

Quiz metadata for each lesson. Links lesson to its 3 questions via relation.

| Field       | Type     | Description                                                  |
| ----------- | -------- | ------------------------------------------------------------ |
| lessonId    | Relation | Reference to lesson (`church_latin_lessons`, unique)         |
| questionIds | Relation | Array of question references (`church_latin_quiz_questions`) |

**Indexes:** `lessonId` (unique)

### 6. church_latin_user_progress

Stores user progress and learning state for the course, including completed lessons, quiz scores, and theme preferences.

| Field                | Type   | Description                                                         |
| -------------------- | ------ | ------------------------------------------------------------------- |
| userId               | Text   | Reference to PocketBase user ID                                     |
| completedLessons     | Number | Count of completed lessons (0-40)                                   |
| quizScores           | JSON   | Object mapping lesson IDs to quiz scores, e.g. `{"1": 85, "2": 92}` |
| currentLesson        | Number | Current lesson being studied (1-40)                                 |
| theme                | Select | User's theme preference (`light` or `dark`)                         |
| lastAccessedAt       | Date   | ISO timestamp of most recent access                                 |
| lastLessonAccessedId | Number | Last lesson ID viewed by user                                       |
| totalProgress        | Number | Cached completion percentage (0-100)                                |

**Indexes:** `userId` (unique)

### 7. church_latin_review_items

Spaced repetition scheduling data for quiz questions. Tracks learning state, due dates, and performance metrics for review.

| Field          | Type     | Description                                                         |
| -------------- | -------- | ------------------------------------------------------------------- |
| userId         | Text     | Reference to user being reviewed                                    |
| lessonId       | Relation | Reference to lesson (`church_latin_lessons`)                        |
| questionId     | Text     | Stable question ID (D{day:02d}-Q{index:02d})                        |
| questionType   | Select   | Question category (`multipleChoice` or `freeResponse`)              |
| state          | Select   | Learning state: `learning`, `review`, `suspended`, `retired`        |
| dueAt          | Date     | Next review due date (UTC)                                          |
| lastReviewedAt | Date     | Last time this item was reviewed (optional)                         |
| intervalDays   | Number   | Days between reviews (default: 0)                                   |
| streak         | Number   | Consecutive correct answers (default: 0)                            |
| lapses         | Number   | Total number of incorrect answers (default: 0)                      |
| lastResult     | Select   | Result of last review: `correct`, `incorrect`, `skipped` (optional) |

**Indexes:** `(userId, lessonId, questionId)` (composite unique index)

### 8. church_latin_review_events

Audit trail for all review activities. Useful for analytics and debugging.

| Field        | Type     | Description                                            |
| ------------ | -------- | ------------------------------------------------------ |
| userId       | Text     | User who submitted the review                          |
| lessonId     | Relation | Reference to lesson (`church_latin_lessons`)           |
| questionId   | Text     | Stable question ID                                     |
| reviewItemId | Relation | Reference to review item (`church_latin_review_items`) |
| result       | Select   | Review result: `correct`, `incorrect`, `skipped`       |
| occurredAt   | Date     | When the review was submitted (UTC)                    |
| answer       | JSON     | User's answer data (optional, for analysis)            |

**Indexes:** `userId`, `occurredAt`

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

   Then seed the course data:

   ```bash
   VITE_POCKETBASE_URL=http://localhost:8090 \
   PB_ADMIN_EMAIL=admin@example.com \
   PB_ADMIN_PASSWORD=your_password \
   pnpx tsx scripts/seedCollections.ts
   ```

   To clear all data and reseed from scratch:

   ```bash
   VITE_POCKETBASE_URL=http://localhost:8090 \
   PB_ADMIN_EMAIL=admin@example.com \
   PB_ADMIN_PASSWORD=your_password \
   pnpx tsx scripts/seedCollections.ts --reset
   ```

   **Optional:** Dry-run mode to preview collection setup without making changes:

   ```bash
   VITE_POCKETBASE_URL=http://localhost:8090 \
   PB_ADMIN_EMAIL=admin@example.com \
   PB_ADMIN_PASSWORD=your_password \
   pnpx tsx scripts/setupCollections.ts --dry-run
   ```
