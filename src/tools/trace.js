/**
 * Tracing Tools for Sentinel-X
 * Helps map out business logic flow across files.
 */

export function definitions() {
	return [
		{
			name: "trace_flow",
			description: `Use this tool to trace how a specific function, class, or method is called across the codebase.
It helps build a call graph to understand the business logic flow (e.g., from Controller to Model).
Input should be the exact function or method name (e.g., 'price_calculate_main' or 'insert_booking').
Common phrases: "ฟังก์ชันนี้ถูกเรียกที่ไหนบ้าง", "trace flow", "call graph".
Returns a list of files and lines where the function is invoked, along with the surrounding code context.`,
			inputSchema: {
				type: "object",
				properties: {
					symbol: { type: "string", description: "Name of the function or method to trace" },
					path: { type: "string", description: "Optional subdirectory to limit search (e.g. 'application')" }
				},
				required: ["symbol"]
			}
		},
		{
			name: "extract_rules",
			description: `Use this tool to extract validation rules, if-conditions, and business constraints from a large file without reading the whole thing.
It helps quickly understand what a fat controller or model is checking before proceeding.
Input should be the exact file path.
Common phrases: "ดึงเงื่อนไข", "มี validation อะไรบ้าง", "extract business rules".
Returns a summary of conditionals and validations found in the file.`,
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "Project-relative path to the file" }
				},
				required: ["path"]
			}
		}
	];
}

export function handlers(deps) {
	return {
		trace_flow: async ({ symbol, path: subDir }) => {
			try {
				const searchPath = subDir || ".";
				deps.policy.assertAllowed(searchPath, "read");

				const { projectSearch } = await import("../core/surgical-io/file-ops.js");
				
				// Standardize pattern: look for function call pattern like symbol( or ->symbol( or ::symbol(
				// We escape symbol just in case, but usually it's alphanumeric
				const safeSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				const pattern = `\\b${safeSymbol}\\s*\\(`;
				
				return await projectSearch(deps.ROOT_DIR, searchPath, pattern, deps.policy);
			} catch (error) {
				return { error: error.message };
			}
		},
		extract_rules: async ({ path: inputPath }) => {
			try {
				const resolvedPath = deps.policy.assertAllowed(inputPath, "read");
				
				// Dynamically import fs
				const fs = await import("fs/promises");
				const content = await fs.readFile(resolvedPath, "utf-8");
				const lines = content.split(/\\r?\\n/);
				
				const rules = [];
				const keywords = ["if ", "if(", "switch ", "switch(", "require", "assert", "validate", "throw new", "return false"];
				
				lines.forEach((line, index) => {
					const trimmed = line.trim();
					if (trimmed.startsWith("//") || trimmed.startsWith("*")) return; // skip simple comments
					
					for (const kw of keywords) {
						if (trimmed.includes(kw)) {
							// Check if it's a structural if and capture some context
							rules.push({
								line: index + 1,
								code: trimmed
							});
							break;
						}
					}
				});
				
				return {
					file: inputPath,
					total_rules_found: rules.length,
					// Return top 100 to avoid token overflow
					rules: rules.slice(0, 100)
				};
			} catch (error) {
				return { error: error.message };
			}
		}
	};
}
