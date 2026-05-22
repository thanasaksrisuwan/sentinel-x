/**
 * Sentinel-X Database Adapter Interface
 * Base class for all database implementations.
 */
export class DatabaseAdapter {
	constructor(config) {
		this.config = config;
		this.connection = null;
	}

	/**
	 * Connect to the database
	 */
	async connect() {
		throw new Error("connect() must be implemented");
	}

	/**
	 * Execute a SQL query (Read-only by default in Sentinel-X)
	 * @param {string} sql 
	 * @param {any[]} params 
	 */
	async query(sql, params = []) {
		throw new Error("query() must be implemented");
	}

	/**
	 * List all tables in the database
	 */
	async listTables() {
		throw new Error("listTables() must be implemented");
	}

	/**
	 * Describe a table structure (columns, types, keys)
	 * @param {string} table 
	 */
	async describeTable(table) {
		throw new Error("describeTable() must be implemented");
	}

	/**
	 * Get all foreign keys / relationships
	 */
	async getForeignKeys() {
		throw new Error("getForeignKeys() must be implemented");
	}

	/**
	 * Close the connection
	 */
	async close() {
		if (this.connection) {
			// Implementation specific close
		}
	}

	/**
	 * Safety check for read-only SQL.
	 */
	isSafe(sql) {
		if (typeof sql !== "string") return false;

		const normalized = this.stripSqlComments(sql).trim();
		if (!normalized) return false;
		if (!/^SELECT\b/i.test(normalized)) return false;

		const withoutTrailingSemicolon = normalized.replace(/;\s*$/, "");
		return !this.hasStatementSeparator(withoutTrailingSemicolon);
	}

	stripSqlComments(sql) {
		return sql
			.replace(/--[^\r\n]*/g, "")
			.replace(/\/\*[\s\S]*?\*\//g, "");
	}

	hasStatementSeparator(sql) {
		let quote = null;
		let escaped = false;

		for (const char of sql) {
			if (quote) {
				if (escaped) {
					escaped = false;
				} else if (char === "\\") {
					escaped = true;
				} else if (char === quote) {
					quote = null;
				}
				continue;
			}

			if (char === "'" || char === '"' || char === "`") {
				quote = char;
				continue;
			}

			if (char === ";") return true;
		}

		return false;
	}
}
