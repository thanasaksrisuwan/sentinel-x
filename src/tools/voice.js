import { VoiceEngine } from "../core/voice/voice.js";
import { runGit } from "../core/git-engine/index.js";

/**
 * Voice Tools for Sentinel-X
 */

export function definitions() {
	return [
		{
			name: "narrate_diff",
			description: `Use this tool when you want to summarize git changes in a human-readable story instead of raw diff output.
Input should be empty to narrate current staged changes, or a specific commit hash.
Common phrases: "เล่า diff หน่อย", "สรุปสิ่งทื่แก้ไป", "narrate changes".
Returns a structured markdown narrative of the changes.`,
			inputSchema: {
				type: "object",
				properties: {
					ref: { type: "string", description: "Optional git ref or commit hash" }
				}
			}
		},
		{
			name: "generate_report",
			description: `Use this tool to compile a polished markdown report from raw data (e.g. after gathering project context or db schema).
Input should be a title and an array of sections (heading + content).
Common phrases: "สร้าง report", "สรุปเป็นเอกสาร", "compile summary".
Returns the formatted markdown string.`,
			inputSchema: {
				type: "object",
				properties: {
					title: { type: "string", description: "Report title" },
					sections: {
						type: "array",
						items: {
							type: "object",
							properties: {
								heading: { type: "string" },
								content: { type: "string", description: "Can be string or array of strings" }
							}
						}
					}
				},
				required: ["title", "sections"]
			}
		}
	];
}

export function handlers(deps) {
	return {
		narrate_diff: async ({ ref }) => {
			const voice = new VoiceEngine(deps);
			const diffArgs = ["diff"];
			if (ref) diffArgs.push(ref);
			else diffArgs.push("--cached"); // default to staged

			const rawDiff = await runGit(diffArgs, deps.ROOT_DIR);
			if (!rawDiff) return { narrative: "No changes to narrate." };
			
			const narrative = voice.buildNarrative(rawDiff);
			return { narrative, raw_diff_size: rawDiff.length };
		},
		generate_report: async ({ title, sections }) => {
			const voice = new VoiceEngine(deps);
			const report = await voice.buildReport(title, sections);
			return { report };
		}
	};
}
