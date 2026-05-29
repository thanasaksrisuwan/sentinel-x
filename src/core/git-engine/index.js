// === src/core/git-engine/index.js ===
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const GIT_MAX_BUFFER = 10 * 1024 * 1024;

/**
 * Core Git execution utility
 */
export async function runGit(args, rootDir) {
	const { stdout } = await execFileAsync("git", args, {
		cwd: rootDir,
		maxBuffer: GIT_MAX_BUFFER,
	});
	return stdout.trim();
}

/**
 * Smart Commit: stage and commit
 */
export async function smartCommit(rootDir, { message, paths, stage_all = false }) {
	if (!message) throw new Error("commit message is required");

	// Stage files
	if (stage_all) {
		await runGit(["add", "-A"], rootDir);
	} else if (paths && paths.length > 0) {
		await runGit(["add", ...paths], rootDir);
	} else {
		// Auto-detect: stage only modified tracked files
		await runGit(["add", "-u"], rootDir);
	}

	// Check if there's anything to commit
	const status = await runGit(["status", "--porcelain"], rootDir);
	const staged = status.split("\n").filter((l) => /^[MADRC]/.test(l));
	if (staged.length === 0) {
		return { committed: false, message: "Nothing to commit (no staged changes)" };
	}

	// Commit
	await runGit(["commit", "-m", message], rootDir);

	// Get commit info
	const commitInfo = await runGit(["log", "--oneline", "-1"], rootDir);

	return {
		committed: true,
		commit: commitInfo,
		files_staged: staged.length,
		staged_files: staged.map((l) => l.trim()),
	};
}

/**
 * Branch management
 */
export async function branch(rootDir, { sub_action, name, from }) {
	const branchAction = sub_action || (name ? "create" : "list");
	switch (branchAction) {
		case "create": {
			if (!name) throw new Error("branch name is required");
			const args = ["checkout", "-b", name];
			if (from) args.push(from);
			await runGit(args, rootDir);
			return { action: "create", branch: name, from: from || "HEAD" };
		}
		case "switch": {
			if (!name) throw new Error("branch name is required");
			await runGit(["checkout", name], rootDir);
			return { action: "switch", branch: name };
		}
		case "delete": {
			if (!name) throw new Error("branch name is required");
			const output = await runGit(["branch", "-d", name], rootDir);
			return { action: "delete", branch: name, output };
		}
		case "list":
		default: {
			const output = await runGit(["branch", "-a", "--no-color"], rootDir);
			const branches = output.split("\n").map((b) => {
				const trimmed = b.trim();
				const current = b.startsWith("*");
				return { name: trimmed.replace(/^\*\s*/, ""), current };
			});
			return { action: "list", branches };
		}
	}
}

/**
 * Stash management
 */
export async function stash(rootDir, { sub_action, message, index }) {
	const stashAction = sub_action || (message ? "save" : "list");
	switch (stashAction) {
		case "save": {
			const args = ["stash", "push"];
			if (message) args.push("-m", message);
			const output = await runGit(args, rootDir);
			return { action: "save", output };
		}
		case "pop": {
			const args = ["stash", "pop"];
			if (index !== undefined) args.push(`stash@{${index}}`);
			const output = await runGit(args, rootDir);
			return { action: "pop", output };
		}
		case "drop": {
			const args = ["stash", "drop"];
			if (index !== undefined) args.push(`stash@{${index}}`);
			const output = await runGit(args, rootDir);
			return { action: "drop", output };
		}
		case "list":
		default: {
			const output = await runGit(["stash", "list"], rootDir);
			const stashes = output ? output.split("\n").map((s) => s.trim()) : [];
			return { action: "list", stashes, count: stashes.length };
		}
	}
}

/**
 * Time Travel: Evolution
 */
export async function evolution(rootDir, { target, method, limit = 20 }) {
	if (!target) throw new Error("target (file path) is required");

	const logArgs = [
		"log",
		"--pretty=format:%H|%ai|%an|%s",
		"-n", String(limit),
		"--follow",
		"--", target,
	];

	const raw = await runGit(logArgs, rootDir);
	if (!raw) return { target, commits: [], message: "No history found" };

	const commits = raw.split("\n").map((line) => {
		const [hash, date, author, subject] = line.split("|");
		return { hash: hash?.substring(0, 8), date, author, subject };
	});

	if (method) {
		const grepArgs = [
			"log", "--pretty=format:%H", "-n", String(limit * 2), `-S`, method, "--", target,
		];
		try {
			const methodRaw = await runGit(grepArgs, rootDir);
			if (methodRaw) {
				const methodHashes = new Set(methodRaw.split("\n").map((h) => h.substring(0, 8)));
				const filtered = commits.filter((c) => methodHashes.has(c.hash));
				return { target, method, commits: filtered, total_file_commits: commits.length, method_commits: filtered.length };
			}
		} catch { /* ignore */ }
	}

	return { target, commits };
}

/**
 * Time Travel: Blame Deep
 */
export async function blameDeep(rootDir, { target, start_line, end_line }) {
	if (!target) throw new Error("target (file path) is required");

	const blameArgs = ["blame", "--porcelain"];
	if (start_line && end_line) {
		blameArgs.push(`-L`, `${start_line},${end_line}`);
	} else if (start_line) {
		const end = start_line + 20;
		blameArgs.push(`-L`, `${start_line},${end}`);
	}
	blameArgs.push("--", target);

	const raw = await runGit(blameArgs, rootDir);
	if (!raw) return { target, lines: [] };

	const entries = [];
	const lines = raw.split("\n");
	let current = {};

	for (const line of lines) {
		if (/^[0-9a-f]{40}\s/.test(line)) {
			if (current.hash) entries.push(current);
			const parts = line.split(/\s+/);
			current = { hash: parts[0].substring(0, 8), original_line: parseInt(parts[1]), final_line: parseInt(parts[2]) };
		} else if (line.startsWith("author ")) {
			current.author = line.substring(7);
		} else if (line.startsWith("author-time ")) {
			const ts = parseInt(line.substring(12));
			current.date = new Date(ts * 1000).toISOString().split("T")[0];
		} else if (line.startsWith("summary ")) {
			current.summary = line.substring(8);
		} else if (line.startsWith("\t")) {
			current.content = line.substring(1);
		}
	}
	if (current.hash) entries.push(current);

	const authorMap = new Map();
	for (const e of entries) {
		if (!authorMap.has(e.hash)) authorMap.set(e.hash, { hash: e.hash, author: e.author, date: e.date, summary: e.summary, lines: 0 });
		authorMap.get(e.hash).lines++;
	}

	return {
		target,
		line_range: start_line ? `${start_line}-${end_line || start_line + 20}` : "all",
		blame_entries: entries.slice(0, 100),
		commit_summary: [...authorMap.values()].sort((a, b) => b.lines - a.lines),
	};
}
