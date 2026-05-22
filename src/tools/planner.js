import { Planner } from "../core/planner.js";

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
		}
	];
}

export function handlers(deps) {
	const planner = new Planner(deps);

	return {
		plan_task: async ({ task }) => {
			const plan = planner.buildPlan(task);
			return plan;
		}
	};
}
