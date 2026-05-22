import path from "path";
import { ToolRegistry } from "./src/core/tool-registry.js";
import { StackDetector } from "./src/core/stack-detector.js";
import { PathPolicy } from "./src/core/path-policy.js";
import fs from "fs/promises";

// Setup Dependencies
const ROOT_DIR = process.cwd();
const registry = new ToolRegistry();
const deps = { 
	ROOT_DIR, 
	stack: null, 
	policy: new PathPolicy(ROOT_DIR), 
	registry 
};

// Inject Test DB Credentials (ASSET_IT_LOCAL)
process.env.DB_CONNECTION = 'sqlsrv';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '1433';
process.env.DB_DATABASE = 'ASSET_IT_LOCAL';
process.env.DB_USERNAME = 'sa';
process.env.DB_PASSWORD = 'password';
process.env.DB_ENCRYPT = 'false';
process.env.DB_TRUST_SERVER_CERTIFICATE = 'true';

async function runShowcase() {
	console.log("=================================================");
	console.log(" 🚀  SENTINEL-X THE GRAND SHOWCASE  🚀");
	console.log("=================================================\n");

	try {
		// --- 0. Initialization ---
		console.log("⏳ Initializing System...");
		const detector = new StackDetector(ROOT_DIR);
		deps.stack = await detector.detect();
		await registry.discover(path.join(ROOT_DIR, "src/tools"));
		console.log(`   ✅ Stack Detected: ${deps.stack.primary.toUpperCase()}`);
		console.log(`   ✅ Tools Loaded: ${registry.size} tools available.\n`);

		// --- 1. Memory & Indexing ---
		console.log("🧠 1. COGNITIVE MEMORY (Auto-Indexer)");
		const indexRes = await registry.handle("memory_index_project", {}, deps);
		console.log(`   ✅ Indexed Project Structure: Added ${indexRes.factsAdded} facts.`);
		
		const recallRes = await registry.handle("memory_recall", { query: "architecture", limit: 1 }, deps);
		console.log(`   ✅ Smart Recall: "${recallRes.results[0].content}"\n`);

		// --- 2. Database Intelligence ---
		console.log("📊 2. DATABASE INTELLIGENCE (MSSQL Analysis)");
		const graphRes = await registry.handle("db_schema_graph", {}, deps);
		console.log(`   ✅ Analyzed ASSET_IT_LOCAL: Found ${graphRes.summary.tables} Tables.`);
		console.log(`   ✅ Semantic Inference: Detected ${graphRes.summary.inferred_count} Hidden Relationships (without FKs)!\n`);

		// --- 3. Surgical I/O & Verification ---
		console.log("🔍 3. SURGICAL I/O & IMPACT ANALYSIS");
		const searchRes = await registry.handle("search_text", { path: "server.js", pattern: "registry\\.handle", context: 1 }, deps);
		console.log(`   ✅ Contextual Search: Found ${searchRes.totalMatches} usage(s) of 'registry.handle' in server.js.`);
		
		const verifyRes = await registry.handle("verify_impact", { path: "server.js", symbol: "registry" }, deps);
		console.log(`   ✅ Blast Radius Analyzed: Risk Level is [${verifyRes.riskLevel.toUpperCase()}] -> ${verifyRes.recommendation}\n`);

		// --- 4. Senior Planner ---
		console.log("📋 4. SENIOR PLANNER (Thought Chaining)");
		const planRes = await registry.handle("plan_task", { task: "Fix the race condition in auth module" }, deps);
		console.log(`   ✅ Classified Task as: [${planRes.type.toUpperCase()}]`);
		console.log(`   ✅ Pre-execution Context required: ${planRes.steps.context.map(s => s.tool).join(', ')}\n`);

		// --- 5. Autonomous Evolution (Skill Engine) ---
		console.log("🤖 5. AUTONOMOUS EVOLUTION (Skill Engine)");
		await registry.handle("skill_save", {
			name: "Demo Audit Skill",
			description: "Automatically read a file and check its blast radius.",
			steps: [
				{ id: "read_file", tool: "read_file", params: { path: "{{input.file}}", end_line: 3 } },
				{ id: "check_impact", tool: "verify_impact", params: { path: "{{input.file}}", symbol: "import" } }
			]
		}, deps);
		console.log(`   ✅ Created New Skill: 'Demo Audit Skill' (Saved to YAML)`);
		
		const execRes = await registry.handle("skill_execute", { name: "Demo Audit Skill", input: { file: "server.js" } }, deps);
		console.log(`   ✅ Skill Executed: Ran ${execRes.execution.length} steps flawlessly without human intervention.\n`);

		console.log("=================================================");
		console.log(" ✨  SHOWCASE COMPLETE - SYSTEM IS FULLY ARMED ✨");
		console.log("=================================================");

	} catch (e) {
		console.error("\n❌ Showcase Failed:", e.message);
	}
}

runShowcase();
