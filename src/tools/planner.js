import { Planner } from "../core/planner.js";
import { HookEngine } from "../core/hooks/engine.js";

/**
 * Planning Tools for Sentinel-X
 */

export function definitions() {
	return [
		{
			name: "plan_task",
			description: `Use this tool as the first step for non-trivial coding, debugging, refactoring, database, or review tasks to classify the work and produce a disciplined execution plan.
Do not use this tool for simple one-shot answers, pure translation, or tasks that require no project context.
Input should be the verbatim user request.
Common phrases: "แก้", "ตรวจ", "review", "เพิ่ม feature", "ทำไมพัง", "วางแผน".
Returns task type, context-gathering steps, execution steps, validation steps, risks, and assumptions.`,
			inputSchema: {
				type: "object",
				properties: {
					task: { type: "string", description: "Verbatim user request" }
				},
				required: ["task"]
			}
		},
		{
			name: "sys_info",
			description: `Use this tool at the start of a session or when you need to understand the runtime environment: project root, detected stack, active database profiles, and loaded tool count.
Do not use this tool repeatedly during normal work — call it once at the beginning.
Input should be empty.
Common phrases: "ดูข้อมูลระบบ", "system info", "stack อะไร", "project root อยู่ไหน".
Returns project root, stack detection result, active DB profiles, tool count, and system metrics.`,
			inputSchema: {
				type: "object",
				properties: {}
			}
		},
		{
			name: "sys_set_project",
			description: `Use this tool when you realize the user is working on a file in a different project/workspace, and you need to switch Sentinel-X's context to that project.
Input should be the absolute path to the project root directory.
Common phrases: "เปลี่ยนโปรเจกต์", "switch project", "analyze bmntogo", "set root".
Returns the new sys_info of the loaded project, confirming the switch.`,
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "Absolute path to the new project root directory." }
				},
				required: ["path"]
			}
		}
	];
}

export function handlers(deps) {
	return {
		plan_task: async ({ task }) => {
			const planner = new Planner(deps);
			const plan = planner.buildPlan(task);
			return plan;
		},
		sys_info: async () => {
			const hookEngine = new HookEngine(deps);
			const proactiveContext = await hookEngine.executeAll();

			const dbSummary = {};
			// Identify DB keys in process.env
			Object.keys(process.env).forEach(key => {
				if (key.startsWith("DB_CONNECTION")) {
					const suffix = key.replace("DB_CONNECTION", "");
					const name = suffix.replace(/^_/, "") || "default";
					dbSummary[name] = {
						driver: process.env[key],
						database: process.env[`DB_DATABASE${suffix}`],
						host: process.env[`DB_HOST${suffix}`] || "localhost"
					};
				}
			});

			return {
				root: deps.ROOT_DIR,
				stack: deps.stack,
				proactive_telemetry: proactiveContext,
				env_priority: "Project Overrides (.env in root) > System Defaults (sentinel-x/.env)",
				active_db_profiles: dbSummary,
				tools_loaded: deps.registry.allDefinitions().length,
				system: {
					platform: process.platform,
					node_version: process.version,
					memory_usage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`
				}
			};
		},
		sys_set_project: async ({ path }) => {
			if (typeof deps.switchProject !== "function") {
				throw new Error("switchProject is not supported by this Sentinel-X version.");
			}
			await deps.switchProject(path);
			
			const infoHandler = handlers(deps).sys_info;
			return await infoHandler();
		}
	};
}
