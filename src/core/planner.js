/**
 * Sentinel-X Task Planner
 * Enforces "Think before you touch" discipline.
 */

const TASK_PATTERNS = [
	{ type: "bug_fix", keywords: ["fix", "bug", "error", "broken", "issue", "แก้", "พัง"], description: "Bug fix" },
	{ type: "refactor", keywords: ["refactor", "rename", "move", "cleanup", "รีแฟคเตอร์", "เปลี่ยนชื่อ"], description: "Refactoring" },
	{ type: "feature", keywords: ["add", "new", "create", "implement", "build", "เพิ่ม", "สร้าง"], description: "New feature or update" },
	{ type: "exploration", keywords: ["explain", "what", "how", "find", "show", "list", "อธิบาย", "หา", "ดู"], description: "Exploration" }
];

export class Planner {
	constructor(deps) {
		this.deps = deps;
	}

	classifyTask(description) {
		const lower = description.toLowerCase();
		let bestMatch = { type: "feature", hits: 0 };
		
		for (const pattern of TASK_PATTERNS) {
			let hits = 0;
			for (const kw of pattern.keywords) {
				if (lower.includes(kw)) hits++;
			}
			if (hits > bestMatch.hits) {
				bestMatch = { type: pattern.type, hits };
			}
		}
		return bestMatch.type;
	}

	buildPlan(description) {
		const type = this.classifyTask(description);
		const plan = {
			task: description,
			type: type,
			steps: {
				context: [],
				execution: [],
				validation: []
			},
			risks: [],
			assumptions: []
		};

		// 1. Context Gathering Phase
		plan.steps.context.push({ tool: "memory_recall", reason: "Check for existing project rules or similar logic" });
		if (type !== "exploration") {
			plan.steps.context.push({ tool: "search_text", reason: "Locate relevant code patterns" });
			plan.steps.context.push({ tool: "verify_impact", reason: "Thought Chaining: Analyze ripple effects of the change" });
		}

		// 2. Execution Phase (Dynamic based on type)
		if (type === "bug_fix") {
			plan.steps.execution.push({ action: "Reproduce the bug with a test case" });
			plan.steps.execution.push({ action: "Apply fix using write_file" });
		} else if (type === "refactor") {
			plan.steps.execution.push({ action: "Identify all references using search_text" });
			plan.steps.execution.push({ action: "Apply changes atomically" });
		} else {
			plan.steps.execution.push({ action: "Implement requested changes using write_file" });
		}

		// 3. Validation Phase
		plan.steps.validation.push({ action: "Run syntax check (included in write_file)" });
		if (type !== "exploration") {
			plan.steps.validation.push({ action: "Verify changes with relevant tests or manual check" });
		}

		// Risks
		if (type === "refactor") plan.risks.push("Breaking string-based references");
		if (type === "bug_fix") plan.risks.push("Introducing regressions in related logic");

		return plan;
	}
}
