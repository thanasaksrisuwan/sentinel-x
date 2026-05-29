import fs from "fs/promises";
import path from "path";

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

/**
 * Search across multiple files in a project
 */
export async function projectSearch(rootDir, searchPath, pattern, policy) {
	const results = [];
	const absSearchPath = path.resolve(rootDir, searchPath);
	const regex = new RegExp(pattern, "gi");

	// Helper to process a single file
	const processFile = async (filePath) => {
		const relative = path.relative(rootDir, filePath);
		if (!policy.isAllowed(relative, "read")) return;

		const ext = path.extname(filePath).toLowerCase();
		const textExtensions = [".php", ".js", ".ts", ".py", ".go", ".sql", ".md", ".txt", ".json", ".html", ".css"];
		
		if (!textExtensions.includes(ext)) return;

		const content = await fs.readFile(filePath, "utf-8");
		// Use a local non-global regex or reset lastIndex for performance
		const searchRegex = new RegExp(pattern, "gi");
		
		if (searchRegex.test(content)) {
			const lines = content.split(/\r?\n/);
			lines.forEach((line, idx) => {
				// Resetting lastIndex is faster than new RegExp()
				searchRegex.lastIndex = 0;
				if (searchRegex.test(line)) {
					results.push({
						file: relative,
						line: idx + 1,
						content: line.trim()
					});
				}
			});
		}
	};

	// Helper for recursive walk (efficient using Dirent)
	async function walk(dir) {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				await walk(fullPath);
			} else if (entry.isFile()) {
				await processFile(fullPath);
			}
		}
	}

	try {
		const stat = await fs.stat(absSearchPath);
		if (stat.isFile()) {
			await processFile(absSearchPath);
		} else if (stat.isDirectory()) {
			await walk(absSearchPath);
		}
	} catch (error) {
		if (error.code === 'ENOENT') {
			throw new Error(`Path not found: ${searchPath}`);
		}
		throw error;
	}

	return {
		query: pattern,
		totalMatches: results.length,
		results: results.slice(0, 100)
	};
}

/**
 * Patch a file by replacing a specific block of text with new text.
 * Safely handles whitespace variations and prevents full file rewrites.
 * @param {string} filePath 
 * @param {string} searchString - Exact text to replace
 * @param {string} replaceString - New text
 */
export async function patchFile(filePath, searchString, replaceString) {
	const content = await fs.readFile(filePath, "utf-8");
	
	// Fast exact match
	if (content.includes(searchString)) {
		const newContent = content.replace(searchString, replaceString);
		if (newContent === content) {
			return { success: false, message: "Replace resulted in identical content." };
		}
		return { success: true, newContent };
	}
	
	// Normalize line endings and try again
	const normalizedContent = content.replace(/\r\n/g, "\n");
	const normalizedSearch = searchString.replace(/\r\n/g, "\n");
	
	if (normalizedContent.includes(normalizedSearch)) {
		const newContent = normalizedContent.replace(normalizedSearch, replaceString);
		return { success: true, newContent };
	}
	
	return { 
		success: false, 
		message: "Could not find the exact search string in the file. Ensure you copied the original code exactly, including leading spaces/tabs." 
	};
}
