import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";

export class ToolRegistry {
	constructor() {
		this._tools = new Map();
		this._handlerCache = new Map();
	}

	async discover(toolsDir) {
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
}
