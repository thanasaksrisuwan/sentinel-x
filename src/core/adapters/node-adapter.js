import { BaseAdapter } from "./base-adapter.js";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

export class NodeAdapter extends BaseAdapter {
	async getRoutes() {
		// Node.js doesn't have a universal `route:list` command like Laravel.
		// For Next.js, it's file-based. For Express, it's runtime.
		// We will provide a simple heuristic or warning for now.
		return [
			{ method: "ANY", uri: "Node routes are typically file-based (Next.js) or runtime (Express).", action: "Manual Inspection Required" }
		];
	}

	async runLint() {
		try {
			// Try to run standard npm run lint
			const { stdout, stderr } = await execAsync("npm run lint", { cwd: this.rootDir });
			return { success: true, output: stdout };
		} catch (error) {
			// If script missing or lint fails
			if (error.message.includes("Missing script")) {
				return { success: true, output: "No lint script defined in package.json." };
			}
			return { success: false, output: error.stdout || error.stderr || error.message };
		}
	}

	async scaffold(type, name) {
		// Node lacks a built-in artisan equivalent unless using a framework like NestJS.
		// We can support generic file creation here, but usually surgical I/O handles it better.
		throw new Error("Scaffolding is not natively supported by the generic Node adapter. Use surgical file creation (write_file).");
	}
}
