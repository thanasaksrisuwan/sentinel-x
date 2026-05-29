import { BaseAdapter } from "./base-adapter.js";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

export class LaravelAdapter extends BaseAdapter {
	async getRoutes() {
		try {
			// Require artisan to exist
			const { stdout } = await execAsync("php artisan route:list --json", { cwd: this.rootDir });
			const routes = JSON.parse(stdout);
			return routes.map(r => ({
				method: r.method,
				uri: r.uri,
				action: r.action,
				name: r.name
			}));
		} catch (error) {
			throw new Error(`Failed to get Laravel routes: ${error.message}`);
		}
	}

	async runLint() {
		try {
			// Using native php -l or standard laravel pint if available
			// We'll fall back to pint, or just report success if nothing fails
			const { stdout, stderr } = await execAsync("vendor/bin/pint --test", { cwd: this.rootDir });
			return { success: true, output: stdout };
		} catch (error) {
			// Pint returns non-zero if issues found
			if (error.stdout || error.stderr) {
				return { success: false, output: error.stdout || error.stderr };
			}
			throw new Error(`Failed to run linter: ${error.message}`);
		}
	}

	async scaffold(type, name) {
		const validTypes = ["controller", "model", "migration", "seeder", "factory", "request", "resource"];
		if (!validTypes.includes(type.toLowerCase())) {
			throw new Error(`Invalid scaffold type '${type}' for Laravel.`);
		}

		try {
			const command = `php artisan make:${type.toLowerCase()} ${name}`;
			const { stdout } = await execAsync(command, { cwd: this.rootDir });
			return { success: true, message: stdout.trim() };
		} catch (error) {
			throw new Error(`Scaffold failed: ${error.message}`);
		}
	}
}
