// === src/tools/git.js ===
import { runGit, smartCommit, branch, stash, evolution, blameDeep } from "../core/git-engine/index.js";

export function definitions() {
	return [
		{
			name: "git",
			description: `Use this tool when you need to check the current state of the repository: what files changed, what the diff looks like, or recent commit history.
Do not use this tool for committing, branching, or stashing — use git_autopilot instead.
Input should be an action (status, diff, or log) plus optional filters.
Common phrases: "เช็คสถานะ git", "มีไฟล์อะไรเปลี่ยน", "ดู diff", "ดู commit ล่าสุด", "git status", "show changes".
Returns raw git output (status porcelain, unified diff, or oneline log).`,
			inputSchema: {
				type: "object",
				properties: {
					action: { type: "string", enum: ["status", "diff", "log"], description: "Action to perform." },
					path: { type: "string", description: "Optional path filter (for diff/log)." },
					cached: { type: "boolean", description: "Use --cached for staged changes (for diff)." },
					ref: { type: "string", description: "Git ref to diff against (for diff)." },
					limit: { type: "integer", description: "Number of commits (for log, default 20)." },
				},
				required: ["action"],
			},
		},
		{
			name: "git_autopilot",
			description: `Use this tool when you need to perform a write operation on git: committing staged files, creating/switching branches, or saving/restoring stashes.
Do not use this tool for read-only operations like checking status or viewing diffs — use git instead.
Input should be an action (smart_commit, branch, stash) and the relevant parameters.
Common phrases: "commit ให้หน่อย", "สร้าง branch ใหม่", "stash งานไว้ก่อน", "switch branch", "เก็บงาน".
Returns the result of the git operation (commit hash, branch info, or stash reference).`,
			inputSchema: {
				type: "object",
				properties: {
					action: { type: "string", enum: ["smart_commit", "branch", "stash"], description: "Git operation." },
					message: { type: "string", description: "Commit message (smart_commit) or stash message (stash)." },
					paths: { type: "array", items: { type: "string" }, description: "Specific files to stage (smart_commit)." },
					stage_all: { type: "boolean", description: "Stage all files including untracked (smart_commit)." },
					name: { type: "string", description: "Branch name (branch action)." },
					from: { type: "string", description: "Base ref for new branch." },
					sub_action: { type: "string", enum: ["create", "switch", "delete", "list", "save", "pop", "drop"], description: "Sub-action for branch or stash." },
					index: { type: "integer", description: "Stash index for pop/drop." },
				},
				required: ["action"],
			},
		},
		{
			name: "time_travel",
			description: `Use this tool when you need to understand the history of a file: how it evolved over time, or who wrote specific lines and why.
Do not use this tool for current file content (use read_file) or current git status (use git).
Input should be an action (evolution or blame_deep) and the target file path.
Common phrases: "ไฟล์นี้เปลี่ยนไปยังไง", "ใครแก้บรรทัดนี้", "ดูประวัติไฟล์", "file history", "blame", "who changed this".
Returns a list of commits that modified the file (evolution) or per-line author/commit details (blame_deep).`,
			inputSchema: {
				type: "object",
				properties: {
					action: { type: "string", enum: ["evolution", "blame_deep"], description: "Action to perform." },
					target: { type: "string", description: "File path (relative to project root)." },
					method: { type: "string", description: "Filter evolution to commits that changed this method name." },
					limit: { type: "integer", description: "Max commits to return. Default: 20." },
					start_line: { type: "integer", description: "Start line for blame_deep." },
					end_line: { type: "integer", description: "End line for blame_deep." },
				},
				required: ["action"],
			},
		},
	];
}

export function handlers() {
	return {
		async git(args, deps) {
			const { rootDir, buildSuccess } = deps;
			if (args.action === "status") {
				const output = await runGit(["status", "--porcelain=v1", "-b"], rootDir);
				return buildSuccess("git", { output }, { action: "status" });
			}
			if (args.action === "diff") {
				const diffArgs = ["diff"];
				if (args.cached) diffArgs.push("--cached");
				if (args.ref) diffArgs.push(String(args.ref));
				if (args.path) diffArgs.push("--", String(args.path));
				const output = await runGit(diffArgs, rootDir);
				return buildSuccess("git", { output }, { action: "diff" });
			}
			if (args.action === "log") {
				const limit = Number(args.limit) || 20;
				const logArgs = ["log", "--oneline", "-n", String(limit)];
				if (args.path) logArgs.push("--", String(args.path));
				const output = await runGit(logArgs, rootDir);
				return buildSuccess("git", { output }, { action: "log" });
			}
		},

		async git_autopilot(args, deps) {
			const { rootDir, buildSuccess } = deps;
			let result;
			if (args.action === "smart_commit") result = await smartCommit(rootDir, args);
			else if (args.action === "branch") result = await branch(rootDir, args);
			else if (args.action === "stash") result = await stash(rootDir, args);
			return buildSuccess("git_autopilot", result, { action: args.action });
		},

		async time_travel(args, deps) {
			const { rootDir, buildSuccess } = deps;
			let result;
			if (args.action === "evolution") result = await evolution(rootDir, args);
			else if (args.action === "blame_deep") result = await blameDeep(rootDir, args);
			return buildSuccess("time_travel", result, { action: args.action });
		},
	};
}
