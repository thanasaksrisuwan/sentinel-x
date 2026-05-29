import { DatabaseAdapter } from "./adapter.js";

/**
 * Sentinel-X MSSQL Adapter
 */
export class MssqlAdapter extends DatabaseAdapter {
	async connect() {
		const sql = (await import("mssql")).default;
		this.pool = new sql.ConnectionPool(this.config);
		this.connection = await this.pool.connect();
	}

	async query(sqlStr, params = []) {
		if (!this.isSafe(sqlStr)) throw new Error("Unsafe SQL detected");
		const request = this.connection.request();
		// Bind params if provided as object
		if (params && !Array.isArray(params) && typeof params === "object") {
			for (const [key, value] of Object.entries(params)) {
				request.input(key, value);
			}
		}
		const result = await request.query(sqlStr);
		return result.recordset || [];
	}

	async listTables() {
		const result = await this.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
		return result.map(r => r.TABLE_NAME);
	}

	async describeTable(table) {
		const safeTable = await this.assertKnownTable(table);
		const columns = await this.query(`
			SELECT c.COLUMN_NAME as name, c.DATA_TYPE as type, c.IS_NULLABLE as is_nullable,
			       ISNULL(k.is_pk, 0) as is_pk
			FROM INFORMATION_SCHEMA.COLUMNS c
			LEFT JOIN (
				SELECT ku.COLUMN_NAME, 1 as is_pk
				FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
				JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
				  ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
				WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY' AND tc.TABLE_NAME = @table
			) k ON c.COLUMN_NAME = k.COLUMN_NAME
			WHERE c.TABLE_NAME = @table
		`, { table: safeTable });
		return columns.map(c => ({
			name: c.name,
			type: c.type,
			nullable: c.is_nullable === 'YES',
			pk: c.is_pk === 1
		}));
	}

	async getForeignKeys() {
		const query = `
			SELECT 
				OBJECT_NAME(f.parent_object_id) AS from_table,
				COL_NAME(fc.parent_object_id, fc.parent_column_id) AS from_column,
				OBJECT_NAME(f.referenced_object_id) AS to_table,
				COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS to_column
			FROM sys.foreign_keys AS f
			INNER JOIN sys.foreign_key_columns AS fc
			ON f.object_id = fc.constraint_object_id
		`;
		return await this.query(query);
	}

	async assertKnownTable(table) {
		if (typeof table !== "string" || table.length === 0) {
			throw new Error("Invalid table name");
		}
		const tables = await this.listTables();
		if (!tables.includes(table)) {
			throw new Error(`Unknown table: ${table}`);
		}
		return table;
	}

	async close() {
		if (this.pool) {
			await this.pool.close();
			this.pool = null;
			this.connection = null;
		}
	}
}
