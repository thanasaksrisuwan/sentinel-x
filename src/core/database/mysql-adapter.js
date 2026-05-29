import mysql from "mysql2/promise";
import { DatabaseAdapter } from "./adapter.js";

/**
 * Sentinel-X MySQL Adapter
 */
export class MysqlAdapter extends DatabaseAdapter {
	async connect() {
		// Use createPool for better connection management
		this.pool = mysql.createPool({
			host: this.config.server || this.config.host,
			port: this.config.port || 3306,
			user: this.config.user,
			password: this.config.password,
			database: this.config.database,
			waitForConnections: true,
			connectionLimit: 10,
			queueLimit: 0
		});
		
		// Test connection
		const conn = await this.pool.getConnection();
		conn.release();
	}

	async query(sqlStr, params = []) {
		if (!this.isSafe(sqlStr)) throw new Error("Unsafe SQL detected");
		
		// Map named parameters to ? if needed, but mysql2 natively uses ?
		// Since other adapters might pass objects, let's just pass params directly
		// For MySQL we usually expect an array for ?. 
		// If an object is passed, we might need to convert it if the query uses named params,
		// but standard is ? array.
		let execParams = params;
		if (params && !Array.isArray(params) && typeof params === "object") {
			// Extremely naive conversion for named params if they exist
			// A better approach is to let the user format standard MySQL ? queries.
			execParams = Object.values(params);
		}

		const [rows] = await this.pool.execute(sqlStr, execParams);
		return rows;
	}

	async listTables() {
		const [rows] = await this.pool.query("SHOW TABLES");
		// The key in rows is dynamic based on DB name, so we just take the first value
		return rows.map(r => Object.values(r)[0]);
	}

	async describeTable(table) {
		const safeTable = await this.assertKnownTable(table);
		
		// Get columns and PK info
		const [columns] = await this.pool.query(`
			SELECT COLUMN_NAME as name, DATA_TYPE as type, IS_NULLABLE as is_nullable, COLUMN_KEY as column_key
			FROM INFORMATION_SCHEMA.COLUMNS
			WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
		`, [safeTable]);

		return columns.map(c => ({
			name: c.name,
			type: c.type,
			nullable: c.is_nullable === 'YES',
			pk: c.column_key === 'PRI'
		}));
	}

	async getForeignKeys() {
		const [fks] = await this.pool.query(`
			SELECT 
				TABLE_NAME as from_table, 
				COLUMN_NAME as from_column, 
				REFERENCED_TABLE_NAME as to_table, 
				REFERENCED_COLUMN_NAME as to_column
			FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
			WHERE REFERENCED_TABLE_SCHEMA = DATABASE() 
			  AND TABLE_SCHEMA = DATABASE()
			  AND REFERENCED_TABLE_NAME IS NOT NULL
		`);
		return fks;
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
			await this.pool.end();
			this.pool = null;
		}
	}
}
