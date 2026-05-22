import { surgicalRead } from "../core/surgical-io/file-ops.js";
import { WriteGuard } from "../core/atomic-write.js";

/**
 * File Tools for Sentinel-X
 */

export function definitions() {
	return [
		{
			name: "read_file",
			description: `Use this tool when you need to read the exact contents of a file, especially to understand its logic before making changes.
Do not use this to read an entire large file if you only need a specific section; use start_line and end_line to save tokens.
Input should be a project-relative file path plus optional 1-indexed line bounds.
Common phrases: "อ่านไฟล์นี้", "ดู logic ในไฟล์", "show lines", "open this file".
Returns the selected file content, source line bounds, total line count, and truncation status.`,
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "Path to the file" },
					start_line: { type: "number", description: "Start line (1-indexed)", default: 1 },
					end_line: { type: "number", description: "End line (inclusive)" }
				},
				required: ["path"]
			}
		},
		{
			name: "search_text",
			description: `Use this tool when you need to find specific functions, variables, or text patterns across a file and want to see the surrounding code context.
Do not use this tool when you already know the exact line range to inspect; use read_file instead.
Input should be a project-relative file path, a regex pattern, and optional context line count.
Common phrases: "หาไฟล์ที่มีคำว่า", "ค้นหาโค้ด", "where is this used".
Returns the matched lines along with a few lines of context around them.`,
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "Path to the file" },
					pattern: { type: "string", description: "Regex pattern to search for" },
					context: { type: "number", description: "Number of context lines around match", default: 2 }
				},
				required: ["path", "pattern"]
			}
		},
		{
			name: "write_file",
			description: `Use this tool when you need to create a new file or completely overwrite an existing file with new code.
Do not use this before gathering context (e.g., using search_text or read_file) and planning the change.
Input should be a project-relative target path and the complete replacement content.
Common phrases: "แก้ไฟล์นี้", "เขียนไฟล์", "apply this full file content".
Returns the write result and validation details. This tool performs a guarded write and checks syntax for PHP and Node.js files.`,
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "Path to write to" },
					content: { type: "string", description: "Complete file content" }
				},
				required: ["path", "content"]
			}
		}
	];
}

export function handlers(deps) {
	const { policy, ROOT_DIR } = deps;
	const guard = new WriteGuard(deps);

	return {
		read_file: async ({ path: inputPath, start_line, end_line }) => {
			try {
				const resolvedPath = policy.assertAllowed(inputPath, "read");
				const result = await surgicalRead(resolvedPath, start_line, end_line);
				return result;
			} catch (error) {
				return { error: error.message };
			}
		},
		search_text: async ({ path: inputPath, pattern, context }) => {
			try {
				const resolvedPath = policy.assertAllowed(inputPath, "read");
				const { contextualSearch } = await import("../core/surgical-io/file-ops.js");
				return await contextualSearch(resolvedPath, pattern, context);
			} catch (error) {
				return { error: error.message };
			}
		},
		write_file: async ({ path: inputPath, content }) => {
			try {
				const resolvedPath = policy.assertAllowed(inputPath, "write");
				const result = await guard.atomicWrite(resolvedPath, content);
				return result;
			} catch (error) {
				return { error: error.message };
			}
		}
	};
}
