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
Do not use this if you need column details (use db_schema_graph instead).
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
			name: "db_query",
			description: `Use this tool when you need to answer a database question with a read-only SQL query after identifying the relevant tables.
Do not use this tool for schema discovery (use db_schema_graph) or for any INSERT, UPDATE, DELETE, DDL, or migration work.
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
		const cacheKey = `conn${suffix}`;

		if (deps.dbAdapters.has(cacheKey)) return deps.dbAdapters.get(cacheKey);
		if (deps.dbAdapterPromises.has(cacheKey)) return await deps.dbAdapterPromises.get(cacheKey);
		
		const promise = (async () => {
			const driver = process.env[`DB_CONNECTION${suffix}`] || (normalizedConnName ? null : "sqlite");
			if (!driver) {
				throw new Error(`Database connection profile '${normalizedConnName}' is not defined in .env (Missing DB_CONNECTION${suffix})`);
			}
		
			if (driver === "sqlite") {
				const dbFile = process.env[`DB_DATABASE${suffix}`] || "database.sqlite";
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
			} else if (driver === "mssql" || driver === "sqlsrv") {
				const config = {
					server: process.env[`DB_HOST${suffix}`] || "127.0.0.1",
					port: parseInt(process.env[`DB_PORT${suffix}`] || "1433", 10),
					database: process.env[`DB_DATABASE${suffix}`],
					user: process.env[`DB_USERNAME${suffix}`],
					password: process.env[`DB_PASSWORD${suffix}`],
					options: {
						encrypt: process.env[`DB_ENCRYPT${suffix}`] === "true",
						trustServerCertificate: process.env[`DB_TRUST_SERVER_CERTIFICATE${suffix}`] !== "false"
					}
				};
				const { MssqlAdapter } = await import("../core/database/mssql-adapter.js");
				const adapter = new MssqlAdapter(config);
				try {
					await adapter.connect();
					deps.dbAdapters.set(cacheKey, adapter);
					return adapter;
				} catch (e) {
					throw new Error(`Failed to connect to MSSQL [${normalizedConnName || 'default'}]: ${e.message}`);
				}
			} else {
				throw new Error(`Database driver '${driver}' is not yet fully implemented in tools/db.js`);
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
		db_query: async ({ sql, connection_name }) => {
			const adapter = await getAdapter(connection_name);
			const rows = await adapter.query(sql);
			return { rows, count: rows.length };
		}
	};
}
