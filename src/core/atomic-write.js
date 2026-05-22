import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const VALIDATION_TIMEOUT_MS = 5000;
const VALIDATION_MAX_BUFFER = 1024 * 1024;

/**
 * Sentinel-X Atomic Write Guard
 * Ensures file writes are safe, atomic, and validated.
 */

export class WriteGuard {
	constructor(deps) {
		this.deps = deps;
	}

	/**
	 * Write content safely with validation and atomic swap
	 */
	async atomicWrite(filePath, content) {
		const ext = path.extname(filePath).toLowerCase();
		const targetDir = path.dirname(filePath);
		const tmpFile = path.join(targetDir, `.sentinel_x_write_${randomUUID()}${ext}`);

		try {
			await fs.mkdir(targetDir, { recursive: true });

			// 1. Write to temp file
			await fs.writeFile(tmpFile, content, "utf8");

			// 2. Run Validation (Syntax Check)
			const validation = await this.validate(tmpFile, ext, content);
			if (!validation.passed) {
				throw new Error(`Validation Failed: ${validation.message}`);
			}

			// 3. Atomic swap. Temp is in the target directory, so cross-device copy fallback is forbidden.
			await fs.rename(tmpFile, filePath);

			return { success: true, filePath, validation };
		} catch (error) {
			// Cleanup temp file on failure
			try { await fs.unlink(tmpFile); } catch (e) {}
			throw error;
		}
	}

	/**
	 * Validate file content based on extension
	 */
	async validate(tmpPath, ext, content) {
		// --- 1. Syntax Check (Environment-based) ---
		if (ext === ".php") {
			try {
				await execFileAsync("php", ["-l", tmpPath], {
					timeout: VALIDATION_TIMEOUT_MS,
					maxBuffer: VALIDATION_MAX_BUFFER
				});
			} catch (e) {
				return { passed: false, message: `PHP Syntax Error: ${e.stdout || e.message}` };
			}
		} else if ([".js", ".cjs", ".mjs"].includes(ext)) {
			try {
				await execFileAsync("node", ["--check", tmpPath], {
					timeout: VALIDATION_TIMEOUT_MS,
					maxBuffer: VALIDATION_MAX_BUFFER
				});
			} catch (e) {
				return { passed: false, message: `Node.js Syntax Error: ${e.stderr || e.message}` };
			}
		}

		// --- 2. Audit Rules (Regex-based) ---
		const audit = this.audit(content);
		if (audit.critical.length > 0) {
			return { passed: false, message: `Security/Audit Blocked: ${audit.critical[0].message}` };
		}

		return { passed: true, message: "OK", warnings: audit.warnings };
	}

	/**
	 * Simple regex-based audit rules
	 */
	audit(content) {
		const critical = [];
		const warnings = [];

		// Hardcoded credentials check
		if (/(?:password|passwd|secret|api_key|token)\s*[=:]\s*['"][^'"]{5,}['"]/i.test(content)) {
			// Ignore if it looks like an environment variable access or config
			if (!/(?:getenv|env|config|process\.env)\(/i.test(content)) {
				critical.push({ message: "Possible hardcoded credential detected" });
			}
		}

		// Dangerous functions
		if (/\b(eval|shell_exec|passthru)\s*\(/i.test(content)) {
			warnings.push({ message: "Usage of dangerous function (eval/exec)" });
		}

		return { critical, warnings };
	}
}
