import fs from "fs/promises";
import path from "path";
import { runGit } from "../git-engine/index.js";

/**
 * Sentinel-X Hook Engine
 * Orchestrates proactive checks to enrich agent context.
 */
export class HookEngine {
	constructor(deps) {
		this.deps = deps;
		this.hooks = [
			this.gitStatusHook.bind(this),
			this.logWatcherHook.bind(this),
			this.workspaceHealthHook.bind(this)
		];
	}

	/**
	 * Run all registered hooks and return aggregated context
	 */
	async executeAll() {
		const results = await Promise.allSettled(this.hooks.map(h => h()));
		const context = {};

		results.forEach(res => {
			if (res.status === 'fulfilled' && res.value) {
				context[res.value.name] = res.value.data;
			}
		});

		return context;
	}

	// --- Built-in Hooks ---

	/**
	 * Hook: Git Status
	 * Alerts the agent of uncommitted changes or branch state.
	 */
	async gitStatusHook() {
		try {
			const status = await runGit(["status", "--porcelain", "-b"], this.deps.ROOT_DIR);
			if (!status) return null;

			const lines = status.split("\n");
			const branch = lines[0].replace("## ", "");
			const changes = lines.slice(1).length;

			return {
				name: "git_telemetry",
				data: {
					branch,
					has_uncommitted_changes: changes > 0,
					change_count: changes,
					summary: changes > 0 ? `${changes} files modified/untracked` : "Clean working directory"
				}
			};
		} catch (e) { return null; }
	}

	/**
	 * Hook: Log Watcher
	 * Tails the latest logs to detect recent errors.
	 */
	async logWatcherHook() {
		const stack = this.deps.stack?.primary || "generic";
		let logPath = null;

		if (stack === "laravel") {
			logPath = path.join(this.deps.ROOT_DIR, "storage/logs/laravel.log");
		} else if (stack === "codeigniter") {
			logPath = path.join(this.deps.ROOT_DIR, "application/logs"); // Usually a dir
		}

		if (!logPath) return null;

		try {
			const stats = await fs.stat(logPath);
			if (stats.isDirectory()) {
				// For CI3, find latest log file
				const files = await fs.readdir(logPath);
				const latest = files.filter(f => f.endsWith(".php") || f.endsWith(".log")).sort().reverse()[0];
				if (!latest) return null;
				logPath = path.join(logPath, latest);
			}

			const content = await fs.readFile(logPath, "utf-8");
			const lines = content.split("\n").filter(l => l.trim());
			const last5 = lines.slice(-5);
			
			const hasRecentError = last5.some(l => /error|exception|critical|fatal/i.test(l));

			return {
				name: "runtime_logs",
				data: {
					last_log_file: path.basename(logPath),
					recent_entries: last5,
					alert_potential_issue: hasRecentError
				}
			};
		} catch (e) { return null; }
	}

	/**
	 * Hook: Workspace Health
	 * Basic sanity checks (disk space, large file warnings).
	 */
	async workspaceHealthHook() {
		// Example: Warn if node_modules is missing in a Node project
		if (this.deps.stack?.tags?.includes("nodejs")) {
			try {
				await fs.access(path.join(this.deps.ROOT_DIR, "node_modules"));
			} catch (e) {
				return {
					name: "workspace_alert",
					data: "node_modules is missing. System might be unstable. Recommend 'npm install'."
				};
			}
		}
		return null;
	}
}
