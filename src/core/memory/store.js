import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Sentinel-X Memory Store
 * Manages persistent facts in JSON format with hybrid scoping.
 */
export class MemoryStore {
	constructor(deps) {
		this.deps = deps;
		this.storageDir = path.resolve(deps.ROOT_DIR, "sentinel-x/storage");
		this.cache = new Map();
		this.scopeLocks = new Map();
	}

	/**
	 * Get file path for a specific scope
	 */
	getFilePath(scope = "project") {
		return path.join(this.storageDir, `memory-${scope}.json`);
	}

	/**
	 * Load facts from a scope
	 */
	async load(scope = "project") {
		const filePath = this.getFilePath(scope);
		try {
			const data = await fs.readFile(filePath, "utf-8");
			return JSON.parse(data);
		} catch (e) {
			return { facts: [], metadata: { version: "1.0", last_updated: null } };
		}
	}

	/**
	 * Save facts to a scope atomically
	 */
	async save(scope, data) {
		const filePath = this.getFilePath(scope);
		const tmpFile = `${filePath}.${randomUUID()}.tmp`;
		
		data.metadata.last_updated = new Date().toISOString();
		const content = JSON.stringify(data, null, 2);

		try {
			await fs.mkdir(this.storageDir, { recursive: true });
			await fs.writeFile(tmpFile, content, "utf-8");
			await fs.rename(tmpFile, filePath);
			return true;
		} catch (e) {
			try { await fs.unlink(tmpFile); } catch {}
			console.error(`[memory] Save failed for scope ${scope}:`, e);
			return false;
		}
	}

	async withScopeLock(scope, task) {
		const previous = this.scopeLocks.get(scope) || Promise.resolve();
		const current = previous.then(task, task);
		const next = current.catch(() => {});
		this.scopeLocks.set(scope, next);
		try {
			return await current;
		} finally {
			if (this.scopeLocks.get(scope) === next) {
				this.scopeLocks.delete(scope);
			}
		}
	}

	/**
	 * Add a new fact to the store
	 */
	async addFact({ content, domain = "general", tags = [], scope = "project" }) {
		return await this.withScopeLock(scope, async () => {
			const data = await this.load(scope);
			const now = new Date().toISOString();
			const existing = data.facts.find(f => f.content === content && f.domain === domain);

			if (existing) {
				existing.tags = [...new Set([...(existing.tags || []), ...tags])];
				existing.updated_at = now;
				await this.save(scope, data);
				return { ...existing, deduped: true };
			}

			const newFact = {
				id: randomUUID(),
				content,
				domain,
				tags,
				created_at: now,
				updated_at: now,
				use_count: 0
			};

			data.facts.push(newFact);
			await this.save(scope, data);
			return newFact;
		});
	}

	/**
	 * List all facts across scopes (filtered)
	 */
	async list(filter = {}) {
		const projectData = await this.load("project");
		const userData = await this.load("user");

		let allFacts = [
			...projectData.facts.map(f => ({ ...f, scope: "project" })),
			...userData.facts.map(f => ({ ...f, scope: "user" }))
		];

		if (filter.domain) {
			allFacts = allFacts.filter(f => f.domain === filter.domain);
		}
		
		return allFacts;
	}
}
