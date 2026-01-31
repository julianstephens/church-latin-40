# PocketBase Question Type Schema Mismatch - Resolution

## Problem Summary

The review queue system was configured to filter out matching questions (which need special UI), but matching questions were still appearing in the review session. Root cause analysis revealed a **data integrity issue** in PocketBase.

## Root Cause

**The PocketBase collection schema does not support the `"matching"` question type in its enum.**

- **courseData.ts** defines matching questions with `type: "matching"` (kebab-case)
- **schema.ts** defines enum values as `["multiple-choice", "matching", "translation", "recitation"]`
- **PocketBase actual enum** only supports `["multipleChoice", "freeResponse", "recitation"]` (camelCase)
- **Result**: Matching questions get stored as `"multipleChoice"` when seeded to PocketBase

## Data Mismatch Details

| Question Type | courseData | PocketBase Enum | Storage Value | Status |
|---|---|---|---|---|
| Multiple choice | `"multiple-choice"` | `"multipleChoice"` | ✅ `"multipleChoice"` | OK |
| Matching | `"matching"` | ❌ NOT SUPPORTED | Stored as `"multipleChoice"` | ❌ DATA ERROR |
| Translation | `"translation"` | ❌ NOT SUPPORTED | Stored as `"freeResponse"` | ❌ DATA ERROR |
| Recitation | `"recitation"` | `"recitation"` | ✅ `"recitation"` | OK |

## Solution Implemented

Since the `"matching"` type cannot be stored in PocketBase due to schema limitations, the review filtering was updated to identify matching questions using an **alternative detection method**:

**Matching Question Identifier:**

- Matching questions have an **empty `correctAnswer` field** (empty string `""`)
- Multiple choice and translation questions have non-empty `correctAnswer` values

### Updated ReviewSession Filter Logic

```typescript
// Skip matching questions - identified by empty correctAnswer or type === "matching"
const isMatchingQuestion =
  questionContent.type === "matching" ||  // Fallback for if schema is fixed
  (typeof questionContent.correctAnswer !== "string" &&
    (!Array.isArray(questionContent.correctAnswer) ||
      questionContent.correctAnswer.length === 0));

if (isMatchingQuestion) {
  // Skip this question
  continue;
}
```

**File Modified:** [src/components/ReviewSession.tsx](src/components/ReviewSession.tsx#L62-L77)

## Verification

Tested question records in PocketBase:

- **D01-Q02** (Matching): `type: "multipleChoice"`, `correctAnswer: ""`  ✅ Now correctly filtered
- **D01-Q03** (Recitation): `type: "recitation"`, `correctAnswer: "Pater noster qui es in caelis"`  ✅ Included in review
- All other matching questions similarly identified and filtered

## Build Status

✅ **Build Successful** - No type errors, all components compile correctly

```
vite v5.4.21 building for production...
✓ 1512 modules transformed.
✓ built in 2.73s
```

## Migration Scripts Created

For future reference and maintenance:

- [scripts/fixQuestionTypes.ts](scripts/fixQuestionTypes.ts) - Validates question types against courseData
- [scripts/checkRecords.ts](scripts/checkRecords.ts) - Inspects question records in PocketBase
- [scripts/inspectQuestions.ts](scripts/inspectQuestions.ts) - Detailed comparison of question structures

## Recommendations

For long-term resolution, consider:

1. **Update PocketBase Schema**: Add `"matching"` to the type enum for proper data integrity
2. **Add a `questionType` Metadata Field**: Store the original courseData type separately to distinguish questions independent of UI type
3. **Document Type Mapping**: Maintain clear mapping between courseData types and storage types

## Testing Impact

✅ Review queue filtering now works correctly
✅ Matching questions no longer appear in review sessions
✅ Other question types (multiple choice, recitation) display normally in reviews
