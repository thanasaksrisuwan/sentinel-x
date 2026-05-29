import fs from "fs/promises";
import path from "path";
import chokidar from "chokidar";

/**
 * Sentinel-X Pulse System
 * Event-Driven Proactive Workspace Scanning
 */
export class PulseEngine {
	constructor(deps) {
		this.deps = deps;
		this.lastCheck = new Date();
		this.watchList = new Set();
		this.recentChanges = [];
		this.watcher = null;
		
		this.initWatcher();
	}

	initWatcher() {
		// Event-driven watcher using Chokidar
		this.watcher = chokidar.watch(this.deps.ROOT_DIR, {
			ignored: [
				/(^|[\/\\])\../, // ignore dotfiles
				'**/node_modules/**',
				'**/vendor/**'
			],
			persistent: true,
			ignoreInitial: true,
			depth: 5
		});

		this.watcher.on('all', (event, filePath) => {
			// Record recent changes passively
			const relPath = path.relative(this.deps.ROOT_DIR, filePath);
			
			// If watchList has patterns, only record if matches (or if empty, record all)
			let shouldRecord = this.watchList.size === 0;
			if (!shouldRecord) {
				for (const pattern of this.watchList) {
					if (relPath.includes(pattern)) {
						shouldRecord = true;
						break;
					}
				}
			}

			if (shouldRecord) {
				this.recentChanges.push({
					event,
					file: relPath,
					time: new Date().toISOString()
				});
				
				// Cap size
				if (this.recentChanges.length > 100) {
					this.recentChanges.shift();
				}
			}
		});
	}

	async checkPulse() {
		const now = new Date();
		// Fetch changes accumulated via events instead of brute force scanning
		const changes = [...this.recentChanges];
		this.recentChanges = []; // clear after reading
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
	
	async close() {
		if (this.watcher) {
			await this.watcher.close();
		}
	}
}
