/**
 * Sentinel-X MCP Server
 * The Unified Multi-Stack Engineering Platform
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import path from "path";
import { fileURLToPath } from "url";
import { ToolRegistry } from "./src/core/tool-registry.js";
import { StackDetector } from "./src/core/stack-detector.js";
import { PathPolicy } from "./src/core/path-policy.js";

// --- Configuration ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(process.env.MCP_ROOT || process.cwd());

// Load local .env if exists (for DB credentials)
import fs from "fs/promises";
try {
	const envContent = await fs.readFile(path.join(ROOT_DIR, ".env"), "utf-8");
	envContent.split(/\r?\n/).forEach(line => {
		const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
		if (match) {
			const key = match[1];
			let val = match[2] || "";
			if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
			if (!process.env[key]) process.env[key] = val;
		}
	});
} catch (e) {
	// ignore if .env doesn't exist
}

const registry = new ToolRegistry();

const deps = {
	ROOT_DIR,
	stack: null,
	policy: new PathPolicy(ROOT_DIR),
	registry: registry,
};

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

async function main() {
	console.error("[sentinel-x] Initializing...");
	try {
		// 1. Detect Stack
		const detector = new StackDetector(ROOT_DIR);
		deps.stack = await detector.detect();
		console.error(`[sentinel-x] Detected Stack: ${deps.stack.primary} (${deps.stack.tags.join(", ")})`);

		// 2. Discover core and adapter tools
		await registry.discover(path.join(__dirname, "src/tools"));
		
		const transport = new StdioServerTransport();
		await server.connect(transport);
		console.error(`[sentinel-x] Server started at ${ROOT_DIR}`);
	} catch (error) {
		console.error("[sentinel-x] Startup failed:", error);
		process.exit(1);
	}
}

main();
