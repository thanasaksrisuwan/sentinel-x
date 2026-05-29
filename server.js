/**
 * Sentinel-X MCP Server
 * The Unified Multi-Stack Engineering Platform
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
	RootsListChangedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";
import path from "path";
import { fileURLToPath } from "url";
import { ToolRegistry } from "./src/core/tool-registry.js";
import { StackDetector } from "./src/core/stack-detector.js";
import { PathPolicy } from "./src/core/path-policy.js";
import { CortexEngine } from "./src/core/cortex/cortex.js";

// --- Configuration ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = __dirname;

// 1. Load local .env from SERVER_DIR first
import fs from "fs/promises";
async function loadEnv(dir, force = false) {
	try {
		const envContent = await fs.readFile(path.join(dir, ".env"), "utf-8");
		envContent.split(/\r?\n/).forEach(line => {
			const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
			if (match) {
				const key = match[1];
				let val = (match[2] || "").trim();
				if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
				
				// Force override if requested, otherwise only set if missing
				if (force || !process.env[key]) {
					process.env[key] = val;
				}
			}
		});
	} catch (e) { /* ignore */ }
}

// 1. Load global defaults from SERVER_DIR (Force load system vars like MCP_ROOT)
await loadEnv(SERVER_DIR, true);

// 2. Resolve ROOT_DIR (priority: process.env.MCP_ROOT > SERVER_DIR)
//    Use SERVER_DIR as fallback instead of process.cwd() (which may be the IDE install dir)
const INITIAL_ROOT = path.resolve(process.env.MCP_ROOT || SERVER_DIR);

// 3. Load project overrides from ROOT_DIR (Force load to ensure local config wins over global defaults)
if (INITIAL_ROOT !== SERVER_DIR) {
	await loadEnv(INITIAL_ROOT, true);
}

const registry = new ToolRegistry();

const deps = {
	ROOT_DIR: INITIAL_ROOT,
	stack: null,
	policy: new PathPolicy(INITIAL_ROOT),
	registry: registry,
};

deps.cortex = new CortexEngine(deps);

// Function to switch projects dynamically
deps.switchProject = async (newPath) => {
	const resolvedPath = path.resolve(newPath);
	await loadEnv(SERVER_DIR, true);
	if (resolvedPath !== SERVER_DIR) {
		await loadEnv(resolvedPath, true);
	}
	
	deps.ROOT_DIR = resolvedPath;
	deps.policy = new PathPolicy(resolvedPath);
	
	const detector = new StackDetector(resolvedPath);
	deps.stack = await detector.detect();
	
	if (deps.stack.primary === "laravel" || deps.stack.primary === "codeigniter") {
		const { LaravelAdapter } = await import("./src/core/adapters/laravel-adapter.js");
		deps.analyzer = new LaravelAdapter(resolvedPath);
	} else if (["react", "express", "nextjs", "nodejs", "generic"].includes(deps.stack.primary)) {
		const { NodeAdapter } = await import("./src/core/adapters/node-adapter.js");
		deps.analyzer = new NodeAdapter(resolvedPath);
	} else {
		const { BaseAdapter } = await import("./src/core/adapters/base-adapter.js");
		deps.analyzer = new BaseAdapter(resolvedPath);
	}
	
	deps.cortex.reset();
	deps.registry.invalidateHandlers();
	console.error(`[sentinel-x] Switched project root to: ${resolvedPath}`);
};

/**
 * Convert a MCP root URI (file:///path) to a local filesystem path.
 * If the input is already a plain path, return it as-is.
 */
function rootUriToPath(uri) {
	if (uri.startsWith("file://")) {
		return fileURLToPath(uri);
	}
	return uri;
}

/**
 * Try to detect the IDE's active workspace via MCP roots/list protocol.
 * Returns the resolved path or null.
 */
async function detectWorkspaceFromRoots(server) {
	try {
		const result = await server.listRoots();
		if (result && result.roots && result.roots.length > 0) {
			const firstRoot = result.roots[0];
			const rootPath = rootUriToPath(firstRoot.uri);
			console.error(`[sentinel-x] Detected workspace root from IDE: ${rootPath}`);
			return path.resolve(rootPath);
		}
	} catch (e) {
		// Client may not support roots — that's fine
		console.error(`[sentinel-x] roots/list not supported by client: ${e.message}`);
	}
	return null;
}

const server = new Server(
	{ name: "sentinel-x", version: "1.0.0" },
	{ capabilities: { tools: {} } }
);

// --- Handlers ---
server.setRequestHandler(ListToolsRequestSchema, async () => ({
	tools: registry.allDefinitions(),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const { name, arguments: args } = request.params;
	try {
		const result = await registry.handle(name, args || {}, deps);
		return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
	} catch (error) {
		return {
			content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
			isError: true,
		};
	}
});

// Listen for workspace changes from the IDE
server.setNotificationHandler(RootsListChangedNotificationSchema, async () => {
	console.error("[sentinel-x] Received roots/list_changed notification");
	const workspacePath = await detectWorkspaceFromRoots(server);
	if (workspacePath && workspacePath !== deps.ROOT_DIR) {
		await deps.switchProject(workspacePath);
	}
});

async function main() {
	console.error("[sentinel-x] Initializing...");
	try {
		// Initialize with preliminary root
		await deps.switchProject(INITIAL_ROOT);

		// Discover core and adapter tools
		await registry.discover(path.join(__dirname, "src/tools"));
		
		const transport = new StdioServerTransport();
		await server.connect(transport);
		console.error(`[sentinel-x] Server connected (preliminary root: ${deps.ROOT_DIR})`);

		// After connecting, try to detect the real workspace from the IDE client
		const workspacePath = await detectWorkspaceFromRoots(server);
		if (workspacePath && workspacePath !== deps.ROOT_DIR) {
			await deps.switchProject(workspacePath);
			console.error(`[sentinel-x] Auto-switched to IDE workspace: ${deps.ROOT_DIR}`);
		}
		
		console.error(`[sentinel-x] Ready at ${deps.ROOT_DIR}`);
	} catch (error) {
		console.error("[sentinel-x] Startup failed:", error);
		process.exit(1);
	}
}

main();

