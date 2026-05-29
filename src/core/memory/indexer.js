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
			// 1. Index Project Structure Recursively (up to depth 3)
			await this.walkDir(this.deps.ROOT_DIR, 0, results);

			// 2. Identify and index manifests
			const rootFiles = await fs.readdir(this.deps.ROOT_DIR);
			const manifests = ["package.json", "composer.json", "go.mod", "requirements.txt", "pyproject.toml", "index.php"];
			for (const m of manifests) {
				if (rootFiles.includes(m)) {
					const fact = await this.indexManifest(m);
					if (!fact.deduped) results.factsAdded++;
				}
			}

			// 3. Capture Stack Info
			const stackFact = await this.store.addFact({
				content: `Stack identified as ${this.deps.stack.primary}. Primary tags: ${this.deps.stack.tags.join(", ")}`,
				domain: "architecture",
				tags: ["stack"],
				scope: "project"
			});
			if (!stackFact.deduped) results.factsAdded++;

			return results;
		} catch (e) {
			results.errors.push(e.message);
			return results;
		}
	}

	async walkDir(dir, depth, results) {
		if (depth > 5) return; // Increased depth for real projects

		let entries;
		try {
			entries = await fs.readdir(dir, { withFileTypes: true });
		} catch (e) {
			return; // Skip if directory cannot be read
		}

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			const relative = path.relative(this.deps.ROOT_DIR, fullPath);
			
			// Always allow root itself, but check sub-paths
			if (relative !== "" && !this.policy.isAllowed(relative, "read")) continue;

			if (entry.isDirectory()) {
				// Don't index deep internal directories like 'storage' or 'logs' if they're huge
				if (["storage", "logs", "temp", "tmp"].includes(entry.name.toLowerCase())) continue;

				const fact = await this.store.addFact({
					content: `Directory found at depth ${depth}: ${relative}/`,
					domain: "structure",
					tags: ["folder", `depth-${depth}`],
					scope: "project"
				});
				if (!fact.deduped) results.factsAdded++;
				await this.walkDir(fullPath, depth + 1, results);
			} else if (entry.isFile()) {
				results.filesIndexed++;
				const ext = path.extname(entry.name).toLowerCase();
				// Index all relevant source/config files
				if ([".php", ".js", ".py", ".go", ".ts", ".sql", ".md", ".json", ".env.example", ".htaccess"].includes(ext)) {
					const fact = await this.store.addFact({
						content: `Source/Config file: ${relative}`,
						domain: "inventory",
						tags: ["file", ext.slice(1)],
						scope: "project"
					});
					if (!fact.deduped) results.factsAdded++;
				}
			}
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
