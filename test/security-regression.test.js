import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { WriteGuard } from "../src/core/atomic-write.js";
import { DatabaseAdapter } from "../src/core/database/adapter.js";
import { MssqlAdapter } from "../src/core/database/mssql-adapter.js";
import { SqliteAdapter } from "../src/core/database/sqlite-adapter.js";
import { MemoryStore } from "../src/core/memory/store.js";
import { SkillEngine } from "../src/core/skill-engine/engine.js";
import { handlers as dbHandlers } from "../src/tools/db.js";

async function withTempRoot(fn) {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "sentinel-x-test-"));
	try {
		return await fn(root);
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
}

test("MemoryStore serializes concurrent writes per scope", async () => {
	await withTempRoot(async (root) => {
		const store = new MemoryStore({ ROOT_DIR: root });

		await Promise.all(
			Array.from({ length: 20 }, (_, i) =>
				store.addFact({ content: `concurrent-fact-${i}`, domain: "test" })
			)
		);

		const facts = await store.list({ domain: "test" });
		assert.equal(facts.length, 20);
	});
});

test("MemoryStore dedupes exact repeated facts", async () => {
	await withTempRoot(async (root) => {
		const store = new MemoryStore({ ROOT_DIR: root });

		await Promise.all(
			Array.from({ length: 20 }, () =>
				store.addFact({ content: "same-fact", domain: "test", tags: ["a"] })
			)
		);

		const facts = await store.list({ domain: "test" });
		assert.equal(facts.filter(f => f.content === "same-fact").length, 1);
	});
});

test("DatabaseAdapter allows only single SELECT statements", () => {
	const adapter = new DatabaseAdapter({});

	assert.equal(adapter.isSafe("SELECT 1"), true);
	assert.equal(adapter.isSafe("SELECT 1;"), true);
	assert.equal(adapter.isSafe("INSERT INTO t VALUES (1)"), false);
	assert.equal(adapter.isSafe("SELECT 1; DELETE FROM t"), false);
	assert.equal(adapter.isSafe("PRAGMA table_info(t)"), false);
	assert.equal(adapter.isSafe("WITH x AS (SELECT 1) SELECT * FROM x"), false);
});

test("SqliteAdapter rejects unknown or injected table names in PRAGMA calls", async () => {
	await withTempRoot(async (root) => {
		const dbPath = path.join(root, "test.sqlite");
		const adapter = new SqliteAdapter({ filename: dbPath });
		await adapter.connect();
		try {
			await adapter.connection.exec("CREATE TABLE safe_table (id INTEGER PRIMARY KEY)");

			const columns = await adapter.describeTable("safe_table");
			assert.equal(columns[0].name, "id");
			await assert.rejects(() => adapter.describeTable("safe_table); DROP TABLE safe_table; --"), /Unknown table/);
		} finally {
			await adapter.close();
		}
	});
});

test("MssqlAdapter describes known tables with bound parameters", async () => {
	const adapter = new MssqlAdapter({});
	const tableName = "safe_table";
	let captured = null;

	adapter.listTables = async () => [tableName];
	adapter.query = async (sql, params) => {
		captured = { sql, params };
		return [{ name: "id", type: "int", is_nullable: "NO", is_pk: 1 }];
	};

	const columns = await adapter.describeTable(tableName);

	assert.equal(columns[0].name, "id");
	assert.equal(captured.params.table, tableName);
	assert.equal(captured.sql.includes(`'${tableName}'`), false);
	assert.equal(captured.sql.includes("@table"), true);
	await assert.rejects(() => adapter.describeTable("safe_table'; DROP TABLE x; --"), /Unknown table/);
});

test("MssqlAdapter close closes its instance pool", async () => {
	const adapter = new MssqlAdapter({});
	let closed = false;
	adapter.pool = {
		close: async () => {
			closed = true;
		}
	};
	adapter.connection = adapter.pool;

	await adapter.close();

	assert.equal(closed, true);
	assert.equal(adapter.pool, null);
	assert.equal(adapter.connection, null);
});

test("database tools cache separate named SQLite connections", async () => {
	await withTempRoot(async (root) => {
		const previousEnv = {
			DB_CONNECTION: process.env.DB_CONNECTION,
			DB_DATABASE: process.env.DB_DATABASE,
			DB_CONNECTION_LOGS: process.env.DB_CONNECTION_LOGS,
			DB_DATABASE_LOGS: process.env.DB_DATABASE_LOGS
		};
		const mainDb = path.join(root, "main.sqlite");
		const logsDb = path.join(root, "logs.sqlite");
		const main = new SqliteAdapter({ filename: mainDb });
		const logs = new SqliteAdapter({ filename: logsDb });

		try {
			await main.connect();
			await logs.connect();
			await main.connection.exec("CREATE TABLE marker (name TEXT); INSERT INTO marker VALUES ('main')");
			await logs.connection.exec("CREATE TABLE marker (name TEXT); INSERT INTO marker VALUES ('logs')");
			await main.close();
			await logs.close();

			process.env.DB_CONNECTION = "sqlite";
			process.env.DB_DATABASE = mainDb;
			process.env.DB_CONNECTION_LOGS = "sqlite";
			process.env.DB_DATABASE_LOGS = logsDb;

			const deps = { ROOT_DIR: root };
			const tools = dbHandlers(deps);
			const defaultRows = await tools.db_query({ sql: "SELECT name FROM marker" });
			const logsRows = await tools.db_query({ connection_name: "LOGS", sql: "SELECT name FROM marker" });
			const repeatedLogsRows = await tools.db_query({ connection_name: "logs", sql: "SELECT name FROM marker" });

			assert.equal(defaultRows.rows[0].name, "main");
			assert.equal(logsRows.rows[0].name, "logs");
			assert.equal(repeatedLogsRows.rows[0].name, "logs");
			assert.equal(deps.dbAdapters.size, 2);
			assert.equal(deps.dbAdapters.has("conn"), true);
			assert.equal(deps.dbAdapters.has("conn_LOGS"), true);
			await assert.rejects(
				() => tools.db_query({ connection_name: "../LOGS", sql: "SELECT 1" }),
				/Invalid connection_name/
			);

			await Promise.all([...deps.dbAdapters.values()].map(adapter => adapter.close()));
		} finally {
			for (const [key, value] of Object.entries(previousEnv)) {
				if (value === undefined) delete process.env[key];
				else process.env[key] = value;
			}
			await main.close().catch(() => {});
			await logs.close().catch(() => {});
		}
	});
});

test("SkillEngine blocks traversal and dangerous template keys", async () => {
	await withTempRoot(async (root) => {
		const engine = new SkillEngine({ ROOT_DIR: root });

		assert.throws(() => engine.skillPath("../outside"), /Invalid skill name/);
		assert.throws(() => engine.skillPath("bad/name"), /Invalid skill name/);
		assert.throws(
			() => engine.resolveTemplates({ value: "{{input.constructor}}" }, { input: {} }),
			/Unsafe template path/
		);

		const resolved = engine.resolveTemplates(
			{ number: "{{input.count}}", label: "step={{steps.first.id}}" },
			{ input: { count: 3 }, steps: { first: { id: "abc" } } }
		);
		assert.deepEqual(resolved, { number: 3, label: "step=abc" });
	});
});

test("WriteGuard writes via same-directory temp file and rejects invalid JS", async () => {
	await withTempRoot(async (root) => {
		const guard = new WriteGuard({});
		const target = path.join(root, "safe.js");

		await guard.atomicWrite(target, "const value = 1;\n");
		assert.equal(await fs.readFile(target, "utf8"), "const value = 1;\n");
		await assert.rejects(() => guard.atomicWrite(target, "const = ;\n"), /Validation Failed/);
	});
});
