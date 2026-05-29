import path from "path";

/**
 * Database Tools for Sentinel-X
 */

const CONNECTION_NAME_RE = /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/;

function normalizeConnectionName(connName = "") {
	if (!connName) return "";
	const normalized = String(connName).trim().toUpperCase();
	if (!CONNECTION_NAME_RE.test(normalized)) {
		throw new Error(`Invalid connection_name '${connName}'. Use letters, numbers, and single underscores only.`);
	}
	return normalized;
}

export function definitions() {
	return [
		{
			name: "db_list_tables",
			description: `Use this tool when the user asks for a general overview of the database or wants to see all available tables.
Do not use this if you need column details (use db_describe_table instead).
Input should be empty for the default database or a connection_name suffix for a configured DB_CONNECTION_* profile.
Common phrases: "มีตารางอะไรบ้าง", "list tables", "ดู database overview".
Returns a flat array of table names.`,
			inputSchema: {
				type: "object",
				properties: {
					connection_name: { type: "string", description: "Optional: connection suffix (e.g. 'LOGS' for DB_CONNECTION_LOGS)" }
				}
			}
		},
		{
			name: "db_schema_graph",
			description: `Use this tool when you need to understand the database structure, table columns, primary keys, and relationships.
Do not use this tool to run business data queries; use db_query only after you know the schema.
Input should be empty for the default database or a connection_name suffix for a configured DB_CONNECTION_* profile.
Common phrases: "โครงสร้างข้อมูล", "ERD", "ตารางนี้เชื่อมกับอะไร".
Returns a graph object with 'nodes' (tables and columns) and 'edges' (foreign keys and inferred relationships).`,
			inputSchema: {
				type: "object",
				properties: {
					connection_name: { type: "string", description: "Optional: connection suffix (e.g. 'LOGS' for DB_CONNECTION_LOGS)" }
				}
			}
		},
		{
			name: "db_describe_table",
			description: `Use this tool when you need to understand the structure of a specific table, its columns, data types, and primary keys.
This is much more token-efficient than db_schema_graph when you only need info about a single table.
Input requires the table name, and an optional connection_name.
Common phrases: "ดูโครงสร้างตาราง users", "describe table".
Returns the table's column schema.`,
			inputSchema: {
				type: "object",
				properties: {
					table: { type: "string", description: "The name of the table to describe" },
					connection_name: { type: "string", description: "Optional: connection suffix" }
				},
				required: ["table"]
			}
		},
		{
			name: "db_find_usage",
			description: `Use this tool to find where a specific database table or column is used in the codebase.
This helps bridge the gap between Database Schema and Business Logic.
Input should be the exact table or column name (e.g. 'users' or 'gcs_fk_contact_id').
Common phrases: "คอลัมน์นี้ถูกใช้ที่ไหน", "find table usage", "who accesses this column".
Returns a list of files and lines where the table/column is referenced in the code.`,
			inputSchema: {
				type: "object",
				properties: {
					table_or_column: { type: "string", description: "Name of the table or column to search for" },
					path: { type: "string", description: "Optional subdirectory to limit search (e.g. 'application/models')" }
				},
				required: ["table_or_column"]
			}
		},
		{
			name: "db_query",
			description: `Use this tool when you need to answer a database question with a read-only SQL query after identifying the relevant tables.
Do not use this tool for schema discovery (use db_describe_table) or for any INSERT, UPDATE, DELETE, DDL, or migration work.
Input should be a complete SELECT statement and optional connection_name suffix.
Common phrases: "ขอ query", "เช็คข้อมูล", "ใครอนุมัติ", "อยู่ขั้นตอนไหน", "run SELECT".
Returns result rows and row count.`,
			inputSchema: {
				type: "object",
				properties: {
					sql: { type: "string", description: "SQL SELECT statement" },
					connection_name: { type: "string", description: "Optional: connection suffix (e.g. 'LOGS' for DB_CONNECTION_LOGS)" }
				},
				required: ["sql"]
			}
		}
	];
}

export function handlers(deps) {
	// Use Maps to support multiple connections
	if (!deps.dbAdapters) deps.dbAdapters = new Map();
	if (!deps.dbAdapterPromises) deps.dbAdapterPromises = new Map();

	const getAdapter = async (connName = "") => {
		const normalizedConnName = normalizeConnectionName(connName);
		const suffix = normalizedConnName ? `_${normalizedConnName}` : "";
		
		// Extract current config from process.env
		const config = {
			driver: process.env[`DB_CONNECTION${suffix}`] || (normalizedConnName ? null : "sqlite"),
			host: process.env[`DB_HOST${suffix}`],
			port: process.env[`DB_PORT${suffix}`],
			database: process.env[`DB_DATABASE${suffix}`],
			username: process.env[`DB_USERNAME${suffix}`],
			password: process.env[`DB_PASSWORD${suffix}`],
			encrypt: process.env[`DB_ENCRYPT${suffix}`],
			trustServer: process.env[`DB_TRUST_SERVER_CERTIFICATE${suffix}`]
		};

		if (!config.driver) {
			throw new Error(`Database connection profile '${normalizedConnName}' is not defined in .env (Missing DB_CONNECTION${suffix})`);
		}

		// Create a config signature for caching
		const signature = JSON.stringify(config);
		const cacheKey = `${normalizedConnName || 'default'}:${signature}`;

		if (deps.dbAdapters.has(cacheKey)) return deps.dbAdapters.get(cacheKey);
		
		// Clean up old connections for this profile name to prevent leaks
		for (const key of deps.dbAdapters.keys()) {
			if (key.startsWith(`${normalizedConnName || 'default'}:`)) {
				const oldAdapter = deps.dbAdapters.get(key);
				if (oldAdapter.close) await oldAdapter.close();
				deps.dbAdapters.delete(key);
			}
		}

		if (deps.dbAdapterPromises.has(cacheKey)) return await deps.dbAdapterPromises.get(cacheKey);
		
		const promise = (async () => {
			if (config.driver === "sqlite") {
				const dbFile = config.database || "database.sqlite";
				const sqlitePath = path.isAbsolute(dbFile) ? dbFile : path.join(deps.ROOT_DIR, dbFile);
			
				const { SqliteAdapter } = await import("../core/database/sqlite-adapter.js");
				const adapter = new SqliteAdapter({ filename: sqlitePath });
				try {
					await adapter.connect();
					deps.dbAdapters.set(cacheKey, adapter);
					return adapter;
				} catch (e) {
					throw new Error(`Failed to connect to SQLite at ${sqlitePath}: ${e.message}`);
				}
			} else if (config.driver === "mssql" || config.driver === "sqlsrv") {
				const mssqlConfig = {
					server: config.host || "127.0.0.1",
					port: parseInt(config.port || "1433", 10),
					database: config.database,
					user: config.username,
					password: config.password,
					options: {
						encrypt: config.encrypt === "true",
						trustServerCertificate: config.trustServer !== "false"
					}
				};
				const { MssqlAdapter } = await import("../core/database/mssql-adapter.js");
				const adapter = new MssqlAdapter(mssqlConfig);
				try {
					await adapter.connect();
					deps.dbAdapters.set(cacheKey, adapter);
					return adapter;
				} catch (e) {
					throw new Error(`Failed to connect to MSSQL [${normalizedConnName || 'default'}]: ${e.message}`);
				}
			} else if (config.driver === "mysql" || config.driver === "mysql2") {
				const mysqlConfig = {
					host: config.host || "127.0.0.1",
					port: parseInt(config.port || "3306", 10),
					database: config.database,
					user: config.username,
					password: config.password
				};
				const { MysqlAdapter } = await import("../core/database/mysql-adapter.js");
				const adapter = new MysqlAdapter(mysqlConfig);
				try {
					await adapter.connect();
					deps.dbAdapters.set(cacheKey, adapter);
					return adapter;
				} catch (e) {
					throw new Error(`Failed to connect to MySQL [${normalizedConnName || 'default'}]: ${e.message}`);
				}
			} else {
				throw new Error(`Database driver '${config.driver}' is not yet fully implemented in tools/db.js`);
			}
		})();

		deps.dbAdapterPromises.set(cacheKey, promise);
		try {
			return await promise;
		} finally {
			if (!deps.dbAdapters.has(cacheKey)) deps.dbAdapterPromises.delete(cacheKey);
		}
	};

	return {
		db_list_tables: async ({ connection_name }) => {
			const adapter = await getAdapter(connection_name);
			const tables = await adapter.listTables();
			return { tables };
		},
		db_schema_graph: async ({ connection_name }) => {
			const adapter = await getAdapter(connection_name);
			const { DbIntelligence } = await import("../core/database/intel.js");
			const intel = new DbIntelligence(adapter);
			const graph = await intel.generateGraph();
			const inferred = intel.inferRelations(graph);
			return { 
				nodes: graph.nodes, 
				edges: [...graph.edges, ...inferred],
				summary: {
					tables: graph.nodes.length,
					fk_count: graph.edges.length,
					inferred_count: inferred.length
				}
			};
		},
		db_describe_table: async ({ table, connection_name }) => {
			const adapter = await getAdapter(connection_name);
			try {
				const columns = await adapter.describeTable(table);
				return { table, columns };
			} catch (e) {
				return { error: e.message };
			}
		},
		db_find_usage: async ({ table_or_column, path: subDir }) => {
			try {
				const searchPath = subDir || ".";
				deps.policy.assertAllowed(searchPath, "read");

				const { projectSearch } = await import("../core/surgical-io/file-ops.js");
				
				// Standardize pattern: word boundary to avoid partial matches like "users_id" when searching for "user"
				const pattern = `\\b${table_or_column}\\b`;
				
				return await projectSearch(deps.ROOT_DIR, searchPath, pattern, deps.policy);
			} catch (error) {
				return { error: error.message };
			}
		},
		db_query: async ({ sql, connection_name }) => {
			const adapter = await getAdapter(connection_name);
			const rows = await adapter.query(sql);
			return { rows, count: rows.length };
		}
	};
}
