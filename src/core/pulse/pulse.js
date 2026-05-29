import fs from "fs/promises";
import path from "path";

/**
 * Sentinel-X Pulse System
 * Heartbeat & Proactive Workspace Scanning
 */
export class PulseEngine {
	constructor(deps) {
		this.deps = deps;
		this.lastCheck = new Date();
		this.watchList = new Set();
	}

	async checkPulse() {
		const now = new Date();
		const changes = await this.scanRecentChanges(this.deps.ROOT_DIR, this.lastCheck);
		this.lastCheck = now;
		
		const health = await this.checkHealth();
		
		return {
			timestamp: now.toISOString(),
			changes,
			health
		};
	}

	addWatch(pattern) {
		this.watchList.add(pattern);
		return [...this.watchList];
	}

	async scanRecentChanges(dir, sinceTime, results = []) {
		if (results.length > 50) return results; // Cap to avoid massive scans

		try {
			const entries = await fs.readdir(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);
				
				// Ignore hidden/system dirs
				if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "vendor") {
					continue;
				}

				if (entry.isDirectory()) {
					await this.scanRecentChanges(fullPath, sinceTime, results);
				} else {
					const stats = await fs.stat(fullPath);
					if (stats.mtime > sinceTime) {
						results.push({
							file: path.relative(this.deps.ROOT_DIR, fullPath),
							modified: stats.mtime.toISOString(),
							size: stats.size
						});
					}
				}
			}
		} catch (e) { /* ignore access errors */ }
		
		return results;
	}

	async checkHealth() {
		const alerts = [];
		const { stack, ROOT_DIR } = this.deps;
		
		if (stack?.tags?.includes("nodejs")) {
			try {
				await fs.access(path.join(ROOT_DIR, "node_modules"));
			} catch (e) {
				alerts.push("Missing node_modules. Consider running npm install.");
			}
		}
		
		if (stack?.tags?.includes("php")) {
			try {
				await fs.access(path.join(ROOT_DIR, "vendor"));
			} catch (e) {
				alerts.push("Missing vendor. Consider running composer install.");
			}
		}
		
		return {
			status: alerts.length > 0 ? "warning" : "healthy",
			alerts
		};
	}
}
