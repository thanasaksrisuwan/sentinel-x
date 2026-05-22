import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { DatabaseAdapter } from "./adapter.js";

/**
 * Sentinel-X SQLite Adapter
 */
export class SqliteAdapter extends DatabaseAdapter {
	async connect() {
		this.connection = await open({
			filename: this.config.filename,
			driver: sqlite3.Database
		});
	}

	async query(sql, params = []) {
		if (!this.isSafe(sql)) throw new Error("Unsafe SQL detected");
		return await this.connection.all(sql, params);
	}

	async listTables() {
		const rows = await this.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
		return rows.map(r => r.name);
	}

	async describeTable(table) {
		const safeTable = await this.assertKnownTable(table);
		const columns = await this.connection.all(`PRAGMA table_info(${this.quoteIdentifier(safeTable)})`);
		return columns.map(c => ({
			name: c.name,
			type: c.type,
			nullable: c.notnull === 0,
			pk: c.pk === 1
		}));
	}

	async getForeignKeys() {
		const tables = await this.listTables();
		const allFks = [];
		
		for (const table of tables) {
			const fks = await this.connection.all(`PRAGMA foreign_key_list(${this.quoteIdentifier(table)})`);
			fks.forEach(fk => {
				allFks.push({
					from_table: table,
					from_column: fk.from,
					to_table: fk.table,
					to_column: fk.to
				});
			});
		}
		return allFks;
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

	quoteIdentifier(identifier) {
		return `"${identifier.replace(/"/g, '""')}"`;
	}

	async close() {
		if (this.connection) {
			await this.connection.close();
			this.connection = null;
		}
	}
}
