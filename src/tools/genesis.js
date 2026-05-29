import { GenesisEngine } from "../core/genesis/genesis.js";
import path from "path";
import { pathToFileURL } from "url";

/**
 * Genesis Tools for Sentinel-X
 */

export function definitions() {
	return [
		{
			name: "evolve_create_tool",
			description: `Use this tool to create a brand new Sentinel-X tool (in src/tools) and hot-reload it into the registry.
Do not use this to modify core system files; it only scaffolds standard MCP tools.
Input should be tool name, description (Trigger Formula), JSON schema, and JS logic body.
Common phrases: "สร้างเครื่องมือใหม่", "เพิ่ม tool", "evolve".
Returns success status and automatically registers the tool.`,
			inputSchema: {
				type: "object",
				properties: {
					name: { type: "string", description: "Tool name (e.g., my_custom_tool)" },
					description: { type: "string", description: "Trigger Formula format description" },
					schema: { type: "object", description: "JSON schema for input properties" },
					logic: { type: "string", description: "JavaScript body of the async handler function" }
				},
				required: ["name", "description", "schema", "logic"]
			}
		},
		{
			name: "evolve_list_mutations",
			description: `Use this tool to see the history of tools created or modified by the Genesis Protocol.
Input should be empty.
Common phrases: "ดูประวัติวิวัฒนาการ", "tool อะไรเพิ่มมาบ้าง".
Returns the evolution log.`,
			inputSchema: { type: "object", properties: {} }
		}
	];
}

export function handlers(deps) {
	return {
		evolve_create_tool: async ({ name, description, schema, logic }) => {
			const genesis = new GenesisEngine(deps);
			// 1. Scaffold the file
			const filePath = await genesis.scaffoldTool(name, description, schema, logic);
			
			// 2. Hot-reload into registry
			if (typeof deps.registry.hotReload === "function") {
				await deps.registry.hotReload(filePath);
				return { 
					success: true, 
					message: `Tool ${name} created and hot-reloaded successfully.`,
					file: filePath
				};
			} else {
				return {
					success: true,
					message: `Tool ${name} created, but registry lacks hotReload support. Restart server to apply.`,
					file: filePath
				};
			}
		},
		evolve_list_mutations: async () => {
			const genesis = new GenesisEngine(deps);
			return await genesis.getEvolutionLog();
		}
	};
}
