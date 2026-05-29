import { SkillEngine } from "../core/skill-engine/engine.js";

/**
 * Skill Tools for Sentinel-X
 */

export function definitions() {
	return [
		{
			name: "skill_list",
			description: `Use this tool when you need to find an existing reusable workflow before composing multiple low-level tool calls manually.
Do not use this tool when the task is a simple single-tool operation.
Input should be empty.
Common phrases: "มี skill อะไร", "workflow ที่มี", "reusable process".
Returns the available skill names.`,
			inputSchema: { type: "object", properties: {} }
		},
		{
			name: "skill_execute",
			description: `Use this tool when an available skill matches the user's workflow-level intent and can safely orchestrate multiple lower-level tools.
Do not use this tool when no listed skill clearly matches the task, or when a custom one-off investigation is safer.
Input should be an existing skill name and a structured input object matching that skill's expected parameters.
Common phrases: "ใช้ skill", "run workflow", "ทำตาม process เดิม".
Returns the skill summary and per-step execution results.`,
			inputSchema: {
				type: "object",
				properties: {
					name: { type: "string", description: "Name of the skill" },
					input: { type: "object", description: "Input parameters for the skill" }
				},
				required: ["name"]
			}
		},
		{
			name: "skill_save",
			description: `Use this tool when a repeated, validated workflow should become a reusable skill for future agents.
Do not use this tool to save untested experiments, one-off fixes, secrets, or workflows with unclear safety boundaries.
Input should be a stable skill name, a description written for agent triggering, and ordered tool steps.
Common phrases: "บันทึกเป็น skill", "ทำเป็น workflow", "ใช้ซ้ำครั้งหน้า".
Returns the saved skill path and success status.`,
			inputSchema: {
				type: "object",
				properties: {
					name: { type: "string", description: "Display name" },
					description: { type: "string", description: "What this skill does" },
					steps: {
						type: "array",
						items: {
							type: "object",
							properties: {
								id: { type: "string" },
								tool: { type: "string" },
								params: { type: "object" },
								halt_on_error: { type: "boolean" }
							}
						}
					}
				},
				required: ["name", "description", "steps"]
			}
		}
	];
}

export function handlers(deps) {
	return {
		skill_list: async () => {
			const engine = new SkillEngine(deps);
			const skills = await engine.listSkills();
			return { skills };
		},
		skill_execute: async ({ name, input }) => {
			const engine = new SkillEngine(deps);
			// toolRunner wrapper to use registry
			const runner = (tool, args) => deps.registry.handle(tool, args, deps);
			return await engine.execute(name, input, runner);
		},
		skill_save: async ({ name, description, steps }) => {
			const engine = new SkillEngine(deps);
			return await engine.saveSkill(name, description, steps);
		}
	};
}
