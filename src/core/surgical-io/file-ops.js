import fs from "fs/promises";

/**
 * Surgical File Operations
 * High-precision reading to minimize token usage.
 */

/**
 * Read a file with specific line range
 * @param {string} filePath 
 * @param {number} startLine 
 * @param {number} endLine 
 */
export async function surgicalRead(filePath, startLine = 1, endLine = null) {
	const content = await fs.readFile(filePath, "utf-8");
	const lines = content.split(/\r?\n/);
	
	const start = Math.max(1, startLine) - 1;
	const end = endLine ? Math.min(lines.length, endLine) : lines.length;
	
	const selectedLines = lines.slice(start, end);
	
	return {
		content: selectedLines.join("\n"),
		startLine: start + 1,
		endLine: end,
		totalLines: lines.length,
		isTruncated: end < lines.length || start > 0
	};
}

/**
 * Search for a pattern in a file and return matches with context
 * @param {string} filePath 
 * @param {string} pattern - Regex pattern
 * @param {number} contextLines - Number of lines around the match
 */
export async function contextualSearch(filePath, pattern, contextLines = 2) {
	const content = await fs.readFile(filePath, "utf-8");
	const lines = content.split(/\r?\n/);
	const regex = new RegExp(pattern, "gi");
	const matches = [];

	lines.forEach((line, index) => {
		if (regex.test(line)) {
			const start = Math.max(0, index - contextLines);
			const end = Math.min(lines.length - 1, index + contextLines);
			
			matches.push({
				line: index + 1,
				match: line.trim(),
				context: lines.slice(start, end + 1).join("\n"),
				contextStart: start + 1
			});
		}
	});

	return {
		filePath,
		totalMatches: matches.length,
		matches: matches.slice(0, 50) // Limit to 50 matches for safety
	};
}
