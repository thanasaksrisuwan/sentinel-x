/**
 * Sentinel-X Stack Intelligence Tools
 */

export function definitions() {
	return [
		{
			name: "stack_get_routes",
			description: `Use this tool to get all registered web and API routes for the current framework.
It will automatically run the correct command for the detected stack (e.g., 'artisan route:list' for Laravel).
Input should be empty.
Common phrases: "ดู route ทั้งหมด", "list routes".
Returns an array of route definitions.`,
			inputSchema: { type: "object", properties: {} }
		},
		{
			name: "stack_run_lint",
			description: `Use this tool to run the framework's native linter or syntax checker over the project.
Input should be empty.
Common phrases: "เช็คโค้ด", "run linter".
Returns the success status and raw output.`,
			inputSchema: { type: "object", properties: {} }
		},
		{
			name: "stack_scaffold",
			description: `Use this tool to generate standard boilerplate files using the framework's CLI (e.g., artisan make).
Input should be the type (e.g., 'controller', 'model') and the name (e.g., 'UserController').
Common phrases: "สร้าง Controller ให้หน่อย", "make model".
Returns the success status and message.`,
			inputSchema: {
				type: "object",
				properties: {
					type: { type: "string", description: "Type of file (controller, model, migration, etc.)" },
					name: { type: "string", description: "Name of the file/class" }
				},
				required: ["type", "name"]
			}
		}
	];
}

export function handlers(deps) {
	// Require analyzer to be initialized in server.js
	if (!deps.analyzer) {
		throw new Error("Stack Analyzer is not initialized in server dependencies.");
	}

	return {
		stack_get_routes: async () => {
			return await deps.analyzer.getRoutes();
		},
		stack_run_lint: async () => {
			return await deps.analyzer.runLint();
		},
		stack_scaffold: async ({ type, name }) => {
			return await deps.analyzer.scaffold(type, name);
		}
	};
}
