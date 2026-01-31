/**
 * Sanitization utilities for quiz answers and user input
 * Prevents XSS attacks and ensures data integrity
 */

/**
 * Escape HTML special characters to prevent XSS attacks
 * Converts dangerous characters to HTML entities
 */
export function escapeHtml(text: string): string {
    const map: { [key: string]: string; } = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Sanitize quiz answer input
 * - Trims whitespace
 * - Removes potentially dangerous characters
 * - Limits length to prevent abuse
 */
export function sanitizeQuizAnswer(answer: string): string {
    if (typeof answer !== "string") {
        return "";
    }

    // Trim whitespace
    let sanitized = answer.trim();

    // Limit length (Latin translations/recitations typically don't exceed 500 chars)
    if (sanitized.length > 500) {
        sanitized = sanitized.substring(0, 500);
    }

    // Remove null bytes and other control characters
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, "");

    // Escape HTML to prevent XSS
    sanitized = escapeHtml(sanitized);

    return sanitized;
}

/**
 * Sanitize multiple choice answer option
 * Ensures option is a safe string
 */
export function sanitizeOption(option: string): string {
    if (typeof option !== "string") {
        return "";
    }

    // For options, we mainly need to escape HTML
    // These come from our database so they should already be clean,
    // but defense in depth is important
    return escapeHtml(option.trim());
}

/**
 * Validate quiz question data from PocketBase
 * Ensures the question structure is safe and valid
 */
export function validateQuizQuestion(
    question: unknown,
): question is Record<string, unknown> {
    if (typeof question !== "object" || question === null) {
        return false;
    }

    const q = question as Record<string, unknown>;

    // Check required fields exist and are correct type
    if (typeof q.id !== "string" && typeof q.id !== "number") {
        return false;
    }

    if (typeof q.question !== "string") {
        return false;
    }

    if (typeof q.type !== "string") {
        return false;
    }

    // Validate question type is one of expected types
    const validTypes = ["multiple-choice", "matching", "translation", "recitation"];
    if (!validTypes.includes(q.type)) {
        return false;
    }

    // Validate correctAnswer exists and is string or array of strings
    if (
        typeof q.correctAnswer !== "string" &&
        !Array.isArray(q.correctAnswer)
    ) {
        return false;
    }

    if (Array.isArray(q.correctAnswer)) {
        if (!q.correctAnswer.every((ans) => typeof ans === "string")) {
            return false;
        }
    }

    // If options exist, validate they're strings
    if (q.options !== undefined) {
        if (!Array.isArray(q.options)) {
            return false;
        }
        if (!q.options.every((opt) => typeof opt === "string")) {
            return false;
        }
    }

    // explanation is optional but must be string if present
    if (q.explanation !== undefined && typeof q.explanation !== "string") {
        return false;
    }

    return true;
}

/**
 * Sanitize course data loaded from PocketBase
 * Validates and escapes HTML in question text and options
 */
export function sanitizeQuizData(
    questions: unknown[],
): Record<string, unknown>[] {
    if (!Array.isArray(questions)) {
        return [];
    }

    return questions
        .filter((q) => {
            // Filter out invalid questions
            return validateQuizQuestion(q);
        })
        .map((q) => {
            const question = q as Record<string, unknown>;
            return {
                id: question.id,
                question: escapeHtml(String(question.question)),
                type: question.type,
                correctAnswer: question.correctAnswer,
                options: Array.isArray(question.options)
                    ? question.options.map((opt) => escapeHtml(String(opt)))
                    : question.options,
                explanation: question.explanation
                    ? escapeHtml(String(question.explanation))
                    : question.explanation,
            };
        });
}

/**
 * Validate answer for comparison with correct answer
 * Used during scoring to ensure fair comparison
 */
export function normalizeAnswerForComparison(answer: string): string {
    if (typeof answer !== "string") {
        return "";
    }

    return answer
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " "); // Normalize multiple spaces to single space
}
