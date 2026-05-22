import fs from "fs/promises";
import path from "path";

/**
 * Sentinel-X Auto-Indexer (Core)
 * Scans project structure and manifests to populate MemoryStore.
 */
export class AutoIndexer {
	constructor(deps, store) {
		this.deps = deps;
		this.store = store;
		this.policy = deps.policy;
	}

	/**
	 * Run a full project index
	 */
	async indexProject() {
		const results = {
			filesIndexed: 0,
			factsAdded: 0,
			errors: []
		};

		try {
			// 1. Index Project Root Structure
			const rootFiles = await fs.readdir(this.deps.ROOT_DIR);
			
			// 2. Identify and index manifests
			const manifests = ["package.json", "composer.json", "go.mod", "requirements.txt", "pyproject.toml"];
			for (const m of manifests) {
				if (rootFiles.includes(m)) {
					const fact = await this.indexManifest(m);
					if (!fact.deduped) results.factsAdded++;
				}
			}

			// 3. Identify project type based on stack (already detected)
			const stackFact = await this.store.addFact({
				content: `This is a ${this.deps.stack.primary} project. Manifests found: ${this.deps.stack.manifests.join(", ")}`,
				domain: "architecture",
				tags: ["stack", "info"],
				scope: "project"
			});
			if (!stackFact.deduped) results.factsAdded++;

			// 4. Quick Scan of main directories (Depth 1)
			for (const file of rootFiles) {
				const fullPath = path.join(this.deps.ROOT_DIR, file);
				const stat = await fs.stat(fullPath);
				
				if (stat.isDirectory() && this.policy.isAllowed(file, "read")) {
					const fact = await this.store.addFact({
						content: `Project contains directory: ${file}/`,
						domain: "structure",
						tags: ["folder"],
						scope: "project"
					});
					if (!fact.deduped) results.factsAdded++;
				}
			}

			return results;
		} catch (e) {
			results.errors.push(e.message);
			return results;
		}
	}

	async indexManifest(filename) {
		const content = await fs.readFile(path.join(this.deps.ROOT_DIR, filename), "utf-8");
		let factContent = `Found manifest ${filename}`;
		
		try {
			if (filename.endsWith(".json")) {
				const json = JSON.parse(content);
				const deps = Object.keys(json.dependencies || {}).concat(Object.keys(json.devDependencies || {}));
				const require = Object.keys(json.require || {}).concat(Object.keys(json["require-dev"] || {}));
				const allDeps = [...deps, ...require];
				
				if (allDeps.length > 0) {
					factContent += ` with dependencies: ${allDeps.slice(0, 15).join(", ")}${allDeps.length > 15 ? '...' : ''}`;
				}
			}
		} catch (e) { /* fallback to basic fact */ }

		return await this.store.addFact({
			content: factContent,
			domain: "architecture",
			tags: ["manifest", "dependencies"],
			scope: "project"
		});
	}
}
