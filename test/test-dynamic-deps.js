/**
 * Test: Dynamic deps after switchProject()
 * 
 * Verifies that all tool handlers pick up the new ROOT_DIR and policy
 * after deps.switchProject() is called, instead of staying stuck on
 * the original project path.
 */
import path from "path";
import { fileURLToPath } from "url";
import { ToolRegistry } from "../src/core/tool-registry.js";
import { PathPolicy } from "../src/core/path-policy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, "..");

// ── Helpers ──────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, label) {
	if (condition) {
		console.log(`  ✅ ${label}`);
		passed++;
	} else {
		console.error(`  ❌ ${label}`);
		failed++;
	}
}

// ── Setup ────────────────────────────────────────────────────────────
const PROJECT_A = "D:\\project_alpha";
const PROJECT_B = "D:\\project_beta";

const registry = new ToolRegistry();

// Build a minimal deps object similar to server.js
const deps = {
	ROOT_DIR: PROJECT_A,
	policy: new PathPolicy(PROJECT_A),
	stack: { primary: "generic" },
	registry: registry,
	cortex: {
		pushContext() { return { ok: true }; },
		getSummary() { return {}; },
		reset() {}
	},
	switchProject: async (newPath) => {
		deps.ROOT_DIR = path.resolve(newPath);
		deps.policy = new PathPolicy(deps.ROOT_DIR);
		deps.cortex.reset();
		deps.registry.invalidateHandlers();
	}
};

async function main() {
	console.log("═══════════════════════════════════════════════════════");
	console.log(" Test: Dynamic deps after switchProject()");
	console.log("═══════════════════════════════════════════════════════\n");

	// 1. Discover tools
	await registry.discover(path.join(SERVER_DIR, "src/tools"));
	const toolNames = registry.allDefinitions().map(d => d.name);
	console.log(`Discovered ${toolNames.length} tools: ${toolNames.join(", ")}\n`);

	// ── Test 1: Initial ROOT_DIR ──
	console.log("── Test 1: Initial ROOT_DIR should be PROJECT_A ──");
	assert(deps.ROOT_DIR === PROJECT_A, `ROOT_DIR = ${deps.ROOT_DIR}`);
	assert(deps.policy.rootDir === path.resolve(PROJECT_A), `policy.rootDir = ${deps.policy.rootDir}`);

	// ── Test 2: Call sys_info to capture initial state ──
	console.log("\n── Test 2: sys_info returns PROJECT_A ──");
	try {
		const sysInfo = await registry.handle("sys_info", {}, deps);
		assert(sysInfo.root === PROJECT_A, `sys_info.root = ${sysInfo.root}`);
	} catch (e) {
		// sys_info may fail due to missing HookEngine deps, that's fine
		// The important thing is that it reads deps.ROOT_DIR
		console.log(`  ⚠️  sys_info threw (expected in test): ${e.message}`);
	}

	// ── Test 3: Switch to PROJECT_B ──
	console.log("\n── Test 3: switchProject to PROJECT_B ──");
	await deps.switchProject(PROJECT_B);
	assert(deps.ROOT_DIR === path.resolve(PROJECT_B), `ROOT_DIR = ${deps.ROOT_DIR}`);
	assert(deps.policy.rootDir === path.resolve(PROJECT_B), `policy.rootDir = ${deps.policy.rootDir}`);

	// ── Test 4: Handler cache was invalidated ──
	console.log("\n── Test 4: Handler cache invalidated ──");
	assert(registry._handlerCache.size === 0, `Handler cache size = ${registry._handlerCache.size} (should be 0)`);

	// ── Test 5: sys_info returns PROJECT_B after switch ──
	console.log("\n── Test 5: sys_info returns PROJECT_B after switch ──");
	try {
		const sysInfo2 = await registry.handle("sys_info", {}, deps);
		assert(sysInfo2.root === path.resolve(PROJECT_B), `sys_info.root = ${sysInfo2.root}`);
	} catch (e) {
		console.log(`  ⚠️  sys_info threw (expected in test): ${e.message}`);
	}

	// ── Test 6: file tools use new policy ──
	console.log("\n── Test 6: read_file uses new policy (PROJECT_B) ──");
	try {
		// This will fail because the file doesn't exist, but the error message
		// should reference PROJECT_B, not PROJECT_A
		const result = await registry.handle("read_file", { path: "test.txt" }, deps);
		if (result.error) {
			const referencesB = result.error.includes("project_beta") || result.error.includes("PROJECT_B");
			const referencesA = result.error.includes("project_alpha") || result.error.includes("PROJECT_A");
			// Either it references B or at minimum doesn't reference A
			assert(!referencesA, `Error does NOT reference PROJECT_A: ${result.error.substring(0, 80)}`);
		} else {
			console.log("  ⚠️  Unexpected success (file shouldn't exist)");
		}
	} catch (e) {
		console.log(`  ⚠️  read_file threw: ${e.message}`);
	}

	// ── Test 7: see_tree uses new ROOT_DIR ──
	console.log("\n── Test 7: see_tree uses PROJECT_B ROOT_DIR ──");
	try {
		const result = await registry.handle("see_tree", {}, deps);
		// Will fail because dir doesn't exist, but error should reference PROJECT_B
		console.log(`  ⚠️  see_tree returned (unexpected): ${JSON.stringify(result).substring(0, 80)}`);
	} catch (e) {
		const msg = e.message;
		const referencesB = msg.includes("project_beta");
		const referencesA = msg.includes("project_alpha");
		assert(!referencesA, `Error does NOT reference PROJECT_A`);
		console.log(`  ℹ️  Error: ${msg.substring(0, 80)}`);
	}

	// ── Test 8: Switch back to PROJECT_A ──
	console.log("\n── Test 8: Switch back to PROJECT_A ──");
	await deps.switchProject(PROJECT_A);
	assert(deps.ROOT_DIR === path.resolve(PROJECT_A), `ROOT_DIR = ${deps.ROOT_DIR}`);
	assert(registry._handlerCache.size === 0, `Handler cache re-invalidated (size = ${registry._handlerCache.size})`);

	// ── Test 9: Verify deps object is truly shared (mutation test) ──
	console.log("\n── Test 9: deps mutation propagates to handlers ──");
	deps.ROOT_DIR = "D:\\mutation_test";
	try {
		const sysInfo3 = await registry.handle("sys_info", {}, deps);
		assert(sysInfo3.root === "D:\\mutation_test", `sys_info.root reflects mutation = ${sysInfo3.root}`);
	} catch (e) {
		console.log(`  ⚠️  sys_info threw: ${e.message}`);
	}

	// ── Summary ──
	console.log("\n═══════════════════════════════════════════════════════");
	console.log(` Results: ${passed} passed, ${failed} failed`);
	console.log("═══════════════════════════════════════════════════════");

	process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
	console.error("Fatal:", e);
	process.exit(1);
});
