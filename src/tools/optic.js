import { OpticEngine } from "../core/optic/optic.js";
import path from "path";

/**
 * Optic Tools for Sentinel-X
 */

export function definitions() {
	return [
		{
			name: "see_url",
			description: `Use this tool when you need to read documentation, API reference, or check the content of an external web page.
Do not use this tool for heavy scraping or downloading binary files.
Input should be a valid URL starting with http:// or https://.
Common phrases: "ดูเว็บนี้ให้หน่อย", "อ่าน docs", "fetch URL".
Returns the page title, headings structure, and a text preview.`,
			inputSchema: {
				type: "object",
				properties: {
					url: { type: "string", description: "URL to fetch" }
				},
				required: ["url"]
			}
		},
		{
			name: "see_tree",
			description: `Use this tool when you need a bird's-eye view of the project's directory structure to understand where files are located.
Do not use this if you already know the exact file path (use read_file).
Input should be empty for root directory, or a specific relative path.
Common phrases: "ดูโครงสร้างโปรเจกต์", "list folders", "tree view".
Returns a visual tree map of the directory.`,
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "Optional relative path to map" },
					depth: { type: "number", description: "Max depth to scan (default 3)", default: 3 }
				}
			}
		}
	];
}

export function handlers(deps) {
	return {
		see_url: async ({ url }) => {
			const optic = new OpticEngine(deps);
			return await optic.fetchUrlText(url);
		},
		see_tree: async ({ path: targetPath, depth }) => {
			const optic = new OpticEngine(deps);
			const resolvedPath = targetPath ? path.resolve(deps.ROOT_DIR, targetPath) : deps.ROOT_DIR;
			
			// Basic security check to prevent climbing out of root
			if (!resolvedPath.startsWith(deps.ROOT_DIR)) {
				throw new Error("Access denied: path is outside project root");
			}

			const tree = await optic.generateTreeMap(resolvedPath, 0, depth || 3);
			return { 
				target: targetPath || "ROOT", 
				tree: "\n" + tree 
			};
		}
	};
}
