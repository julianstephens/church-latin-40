# Quiz Answer Sanitization Implementation

## Overview

This document outlines the comprehensive sanitization strategy implemented for quiz answers and quiz data to prevent XSS (Cross-Site Scripting) attacks and ensure data integrity.

## Security Concerns Addressed

### XSS Prevention

- **Problem**: User input from quiz textareas (translations, recitations) was not being sanitized before display in results
- **Solution**: All user input is sanitized at the point of entry using the `sanitizeQuizAnswer()` function
- **Impact**: Prevents attackers from injecting malicious HTML/JavaScript through quiz answers

### Data Validation

- **Problem**: Quiz questions loaded from PocketBase were not validated
- **Solution**: Quiz data from PocketBase is validated against expected structure and types using `validateQuizQuestion()` and `sanitizeQuizData()`
- **Impact**: Ensures database corruption or tampering cannot introduce XSS vulnerabilities

### Input Length Attacks

- **Problem**: Unlimited text input could be used for denial-of-service or injection attacks
- **Solution**: Textareas limited to 500 characters with validation in both UI and sanitization layer
- **Impact**: Prevents excessive input processing and resource exhaustion

## Implementation Details

### Core Sanitization Utilities (`src/utils/sanitization.ts`)

#### 1. `escapeHtml(text: string): string`

Escapes HTML special characters to safe entities:

- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&#039;`

**Usage**: Applied to all user-generated content before display

#### 2. `sanitizeQuizAnswer(answer: string): string`

Comprehensive sanitization of quiz answer input:

1. Trims leading/trailing whitespace
2. Limits to 500 characters maximum
3. Removes control characters (null bytes, ASCII 0-31, ASCII 127)
4. Escapes HTML to prevent XSS

**Usage**: Called immediately when user submits answer in Quiz component

#### 3. `sanitizeOption(option: string): string`

Sanitizes quiz option text (choices, explanations):

1. Trims whitespace
2. Escapes HTML

**Usage**: Applied to all text from quiz questions when rendering

#### 4. `validateQuizQuestion(question: unknown): boolean`

Type guard for quiz questions from database:

- Validates `id` is string or number
- Validates `question` is non-empty string
- Validates `type` is one of: `multiple-choice`, `matching`, `translation`, `recitation`
- Validates `correctAnswer` is string or array of strings
- Validates `options` (if present) is array of strings
- Validates `explanation` (if present) is string

**Usage**: Filters invalid questions before processing in `sanitizeQuizData()`

#### 5. `sanitizeQuizData(questions: unknown[]): Record<string, unknown>[]`

Batch sanitization of quiz data from PocketBase:

1. Validates array type
2. Filters questions through `validateQuizQuestion()`
3. Escapes HTML in:
   - Question text
   - All options
   - Explanations
4. Preserves structure for Quiz component

**Usage**: Applied when loading quizzes from PocketBase in `courseDataService.ts`

#### 6. `normalizeAnswerForComparison(answer: string): string`

Consistent answer comparison for scoring:

1. Converts to lowercase
2. Trims whitespace
3. Normalizes multiple spaces to single space

**Usage**: Used during answer validation and scoring to handle formatting variations

## Integration Points

### Quiz Component (`src/components/Quiz.tsx`)

#### User Input Sanitization

```typescript
const handleAnswer = (answer: string) => {
  const sanitized = sanitizeQuizAnswer(answer);
  const newAnswers = [...userAnswers, sanitized];
  // Process sanitized answer
};
```

#### Text Input Constraints

- Textarea `maxLength={500}`
- Character counter display (e.g., "250/500 characters")
- Answer truncation in onChange handler

#### Results Display

All displayed answers use HTML escaping:

```typescript
<strong dangerouslySetInnerHTML={{ __html: sanitizeOption(userAnswer) }} />
```

### Course Data Service (`src/services/courseDataService.ts`)

#### Quiz Data Sanitization

```typescript
// When fetching lesson content with quiz
const quizQuestions = sanitizeQuizData(quizRecords[0].quizQuestions || []);

// In getQuiz method
return sanitizeQuizData(quizRecords[0].quizQuestions || []);
```

#### Error Handling

- If quiz data is invalid, empty array is returned
- Fallback to local courseData if PocketBase data fails

## Security Best Practices Applied

### Defense in Depth

1. **Input Validation**: Validates type and structure
2. **Input Sanitization**: Escapes dangerous characters
3. **Output Encoding**: Uses HTML entities for safe display
4. **Content Security Policy**: Nginx headers (CSP) prevent inline script execution

### Safe DOM Manipulation

- Uses `dangerouslySetInnerHTML` only for sanitized content
- Never renders raw user input as HTML
- Clear comments explain why each use is safe

### Answer Comparison

- Normalization prevents bypass through formatting tricks
- Case-insensitive comparison (common for Latin answers)
- Handles whitespace variations

## Testing Recommendations

### Manual Testing

1. Try submitting answers with HTML tags: `<script>alert('xss')</script>`
2. Try JavaScript event handlers: `" onclick="alert('xss')"`
3. Try special characters: `< > & " '`
4. Try very long input (>500 chars)
5. Try control characters and null bytes

### Expected Results

- All HTML/JavaScript rendered as plain text
- Input truncated to 500 characters
- No script execution or DOM manipulation
- Answer correctly displayed in results

### Automated Testing (Future)

Could add unit tests for:

- `escapeHtml()` with various payloads
- `sanitizeQuizAnswer()` with edge cases
- `validateQuizQuestion()` with malformed data
- End-to-end quiz flow with malicious input

## Configuration & Maintenance

### Length Limits

- Quiz answer limit: **500 characters**
  - Location: `sanitizeQuizAnswer()`, Quiz component textarea
  - Reasoning: Latin translations/recitations rarely exceed 500 chars
  - Adjustable if needed in `sanitization.ts`

### Sanitization Functions

- All centralized in `src/utils/sanitization.ts`
- Easy to update regex patterns or rules
- Well-documented for future developers

## Related Security Measures

### Docker Security

- Running as non-root user prevents privilege escalation
- Alpine base image reduces attack surface

### Nginx Security

- `X-XSS-Protection` header for older browsers
- `Content-Security-Policy` header prevents inline scripts
- `X-Content-Type-Options: nosniff` prevents MIME-type sniffing

### Authentication

- Auth0 handles secure authentication
- Anonymous mode for offline learning (localStorage-based)

## Compliance & Standards

- **OWASP Top 10**: Addresses A03:2021 - Injection
- **CWE-79**: Cross-site Scripting (XSS)
- **SANS Top 25**: Rank 2 - Out-of-bounds Write

## Future Enhancements

### Potential Improvements

1. **Content Security Policy Violations**: Monitor and log via CSP reports
2. **Input Validation Rules**: Add domain-specific validation for Latin
3. **Rate Limiting**: Prevent answer spam/brute force
4. **Logging**: Log suspicious input patterns for security audits
5. **Unit Tests**: Automated tests for sanitization functions

### Considered but Not Implemented

- DOMPurify library: Overkill for simple text escaping
- Custom HTML parser: Unnecessary for our use case
- Answer encryption: Quiz results are not sensitive data
