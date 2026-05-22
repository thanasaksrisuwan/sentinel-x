import path from "path";

/**
 * Sentinel-X Path Policy
 * Controls file access with dynamic allowlists and hard-coded blocks.
 */

const DISALLOWED_ROOTS = ["node_modules", ".git", "vendor", "system"];
const DISALLOWED_FILES = [".env"];

export class PathPolicy {
	constructor(rootDir) {
		this.rootDir = path.resolve(rootDir);
		this.readAllowlist = new Set(["README.md", "package.json", "composer.json", "SENTINEL_X_ROADMAP.md"]);
		this.writeAllowlist = new Set(["SENTINEL_X_ROADMAP.md", "storage"]);
	}

	/**
	 * Add paths to allowlist
	 * @param {string[]} paths 
	 * @param {'read' | 'write'} type 
	 */
	addAllowlist(paths, type = 'read') {
		const target = type === 'read' ? this.readAllowlist : this.writeAllowlist;
		paths.forEach(p => target.add(this.normalizePath(p)));
	}

	normalizePath(p) {
		if (!p) return "";
		let normalized = p.replace(/\\/g, "/");
		if (normalized.startsWith("./")) normalized = normalized.slice(2);
		if (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
		return normalized;
	}

	/**
	 * Check if a path is allowed for a specific operation
	 */
	isAllowed(inputPath, operation = 'read') {
		try {
			const resolved = path.resolve(this.rootDir, inputPath);
			const relative = path.relative(this.rootDir, resolved);

			// 1. Out of bounds check
			if (relative.startsWith("..") || path.isAbsolute(relative)) return false;

			const normalized = this.normalizePath(relative);
			const segments = normalized.split("/");

			// 2. Hard block check
			if (DISALLOWED_ROOTS.includes(segments[0])) return false;
			if (DISALLOWED_FILES.some(f => normalized.endsWith(f))) return false;

			// 3. Allowlist check
			const allowlist = operation === 'read' ? this.readAllowlist : this.writeAllowlist;
			
			// Allow if exactly in list or starts with an allowed directory
			return [...allowlist].some(entry => 
				normalized === entry || normalized.startsWith(`${entry}/`)
			);
		} catch (e) {
			return false;
		}
	}

	/**
	 * Assert that a path is allowed or throw error
	 */
	assertAllowed(inputPath, operation = 'read') {
		if (!this.isAllowed(inputPath, operation)) {
			throw new Error(`Access Denied (${operation}): ${inputPath}`);
		}
		return path.resolve(this.rootDir, inputPath);
	}
}
