/**
 * Sentinel-X Base Stack Adapter
 * The contract that all specific framework adapters must implement.
 */
export class BaseAdapter {
	constructor(rootDir) {
		this.rootDir = rootDir;
	}

	/**
	 * Get all API/Web routes for the project
	 * @returns {Promise<Array<{method: string, uri: string, action: string}>>}
	 */
	async getRoutes() {
		throw new Error("getRoutes() is not implemented for this stack.");
	}

	/**
	 * Run a linter or syntax check over the project
	 * @returns {Promise<{success: boolean, output: string}>}
	 */
	async runLint() {
		throw new Error("runLint() is not implemented for this stack.");
	}

	/**
	 * Scaffold a new boilerplate file (e.g., Controller, Model)
	 * @param {string} type 
	 * @param {string} name 
	 * @returns {Promise<{success: boolean, message: string, file?: string}>}
	 */
	async scaffold(type, name) {
		throw new Error("scaffold() is not implemented for this stack.");
	}
}
