import fs from "fs/promises";
import path from "path";
import { handlers } from "./src/tools/db.js";

async function loadEnv(dir, force = false) {
	try {
		const envContent = await fs.readFile(path.join(dir, ".env"), "utf-8");
		envContent.split(/\r?\n/).forEach(line => {
			const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
			if (match) {
				const key = match[1];
				let val = match[2] || "";
				if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
				if (force || !process.env[key]) process.env[key] = val;
			}
		});
	} catch (e) { }
}

async function test() {
	await loadEnv(process.cwd(), true);
	const deps = { ROOT_DIR: process.cwd(), registry: { allDefinitions: () => [] } };
	try {
		const result = await handlers(deps).db_list_tables({ connection_name: 'BMNTOGO' });
		console.log(JSON.stringify(result, null, 2));
	} catch (e) {
		console.error(e.message);
	}
}

test();
