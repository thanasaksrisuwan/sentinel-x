import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";

export class ToolRegistry {
	constructor() {
		this._tools = new Map();
		this._handlerCache = new Map();
	}

	async discover(toolsDir) {
		// Clear cache to ensure fresh load if rediscovered
		this._handlerCache.clear();
		this._tools.clear();

		let entries;
		try {
			entries = await fs.readdir(toolsDir);
		} catch (e) {
			console.error(`[registry] Could not read tools dir: ${toolsDir}`);
			return;
		}

		const jsFiles = entries.filter(f => f.endsWith(".js") && !f.endsWith(".test.js"));

		for (const file of jsFiles) {
			const filePath = path.join(toolsDir, file);
			const modulePath = pathToFileURL(filePath).href;
			try {
				const mod = await import(modulePath);
				const defs = typeof mod.definitions === "function" ? mod.definitions() : (mod.definitions || []);
				
				for (const def of defs) {
					this._tools.set(def.name, {
						definition: def,
						modulePath,
						moduleName: file.replace(".js", "")
					});
				}
			} catch (err) {
				console.error(`[registry] Failed to load ${file}: ${err.message}`);
			}
		}
	}

	allDefinitions() {
		return [...this._tools.values()].map(t => t.definition);
	}

	/**
	 * Invalidate all cached handlers so they get re-created with fresh deps
	 * on the next call. Must be called after switchProject().
	 */
	invalidateHandlers() {
		this._handlerCache.clear();
		console.error("[registry] Handler cache invalidated.");
	}

	async handle(name, args, deps) {
		const entry = this._tools.get(name);
		if (!entry) throw new Error(`Tool not found: ${name}`);

		if (!this._handlerCache.has(entry.modulePath)) {
			const mod = await import(entry.modulePath);
			const handlers = typeof mod.handlers === "function" ? mod.handlers(deps) : (mod.handlers || {});
			this._handlerCache.set(entry.modulePath, new Map(Object.entries(handlers)));
		}

		const handler = this._handlerCache.get(entry.modulePath).get(name);
		if (!handler) throw new Error(`Handler not found for: ${name}`);

		return handler(args, deps);
	}

	async hotReload(filePath) {
		const modulePath = pathToFileURL(filePath).href + "?t=" + Date.now(); // Cache bust
		const fileName = path.basename(filePath);
		
		try {
			const mod = await import(modulePath);
			const defs = typeof mod.definitions === "function" ? mod.definitions() : (mod.definitions || []);
			
			// Remove old definitions from the same file (if any)
			for (const [key, value] of this._tools.entries()) {
				if (value.moduleName === fileName.replace(".js", "")) {
					this._tools.delete(key);
				}
			}

			// Add new definitions
			for (const def of defs) {
				this._tools.set(def.name, {
					definition: def,
					modulePath,
					moduleName: fileName.replace(".js", "")
				});
			}

			// Clear handler cache for this module so it gets reloaded on next call
			this._handlerCache.delete(modulePath);
			
			// Also clear any previous cached versions that match the base file path
			for (const cachedPath of this._handlerCache.keys()) {
				if (cachedPath.startsWith(pathToFileURL(filePath).href)) {
					this._handlerCache.delete(cachedPath);
				}
			}

			return true;
		} catch (err) {
			console.error(`[registry] Hot reload failed for ${filePath}: ${err.message}`);
			throw err;
		}
	}
}
