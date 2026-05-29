import path from "path";

/**
 * Sentinel-X Path Policy
 * Controls file access with adaptive discovery and hard-coded blocks.
 */

export class PathPolicy {
	constructor(rootDir) {
		this.rootDir = path.resolve(rootDir);
		
		// Known system/hidden roots to block by default
		this.blockedRoots = new Set([
			"node_modules", ".git", ".github", ".vscode", ".idea", ".gemini",
			"vendor", "system", "dist", "build", "out"
		]);

		this.blockedFiles = new Set([
			".env", ".DS_Store", "thumbs.db", "package-lock.json", "composer.lock"
		]);

		// Parse manual overrides from environment (for special cases like allowing a hidden folder)
		this.manualRead = new Set(this.parseEnvList(process.env.MCP_READ_ALLOWLIST));
		this.manualWrite = new Set(this.parseEnvList(process.env.MCP_WRITE_ALLOWLIST));
	}

	parseEnvList(val) {
		if (!val) return [];
		return val.split(/[;,]/).map(s => this.normalizePath(s.trim())).filter(Boolean);
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
			
			// 1. Boundary Check: Ensure resolved path is inside rootDir
			const isWindows = process.platform === 'win32';
			const r = isWindows ? resolved.toLowerCase() : resolved;
			const root = isWindows ? this.rootDir.toLowerCase() : this.rootDir;

			// Path must be exactly root or start with root + separator
			const sep = isWindows ? "\\" : "/";
			const isInBounds = (r === root) || r.startsWith(root.endsWith(sep) ? root : root + sep);
			
			if (!isInBounds) return false;

			// Get a clean relative path for segment checks
			const relative = path.relative(this.rootDir, resolved);
			if (relative === "" || relative === ".") return true; // Root itself is accessible

			const normalized = this.normalizePath(relative);
			const segments = normalized.split("/");
			const rootSegment = segments[0];

			// 2. Manual Overrides (Highest priority)
			const manual = operation === 'read' ? this.manualRead : this.manualWrite;
			if (manual.has(normalized) || [...manual].some(m => normalized.startsWith(`${m}/`))) {
				return true;
			}

			// 3. Hard Block Check
			// Block if ANY segment of the path is a known system root (node_modules, .git, etc.)
			if (segments.some(seg => this.blockedRoots.has(seg))) return false;
			
			// Block specific files based on full normalized path or the filename itself
			if (this.blockedFiles.has(normalized) || this.blockedFiles.has(segments[segments.length - 1])) {
				return false;
			}

			// 4. Adaptive Discovery Logic
			// Allow any file or directory that isn't hidden (doesn't start with .)
			if (!rootSegment.startsWith(".")) {
				return true;
			}

			// Special case: allow explicitly defined root manifest files even if they'd be filtered
			const manifestFiles = ["package.json", "composer.json", "requirements.txt", "pyproject.toml", "go.mod"];
			if (operation === 'read' && manifestFiles.includes(normalized)) {
				return true;
			}

			return false;
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
