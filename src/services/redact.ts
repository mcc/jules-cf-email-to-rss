// src/services/redact.ts

/**
 * Replaces all occurrences of email addresses in a given text with "[REDACTED]".
 *
 * This function uses a regular expression to identify email addresses.
 * The regex aims to cover common email formats but might not catch all edge cases.
 *
 * @param text The input string that may contain email addresses.
 * @returns The string with email addresses redacted.
 */
export function redactEmails(text: string | null | undefined): string {
	if (!text) {
		return '';
	}
	// Regular expression to match common email patterns.
	// It looks for:
	// - username part: characters (letters, numbers, dots, hyphens, underscores, plus signs)
	// - @ symbol
	// - domain part: characters (letters, numbers, dots, hyphens)
	// - top-level domain: dot followed by 2 or more letters
	const emailRegex = /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
	return text.replace(emailRegex, '[REDACTED]');
}
