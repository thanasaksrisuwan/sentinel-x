/**
 * Cortex Tools for Sentinel-X
 */

export function definitions() {
	return [
		{
			name: "cortex_push",
			description: `Use this tool to jot down a quick note, current task, or active files into your short-term session memory.
Do not use this for permanent project rules (use memory_remember instead).
Input should be a brief note, optional task name, and optional files array.
Common phrases: "โน้ตไว้ว่า", "กำลังทำอะไร", "จด context".
Returns current attention summary.`,
			inputSchema: {
				type: "object",
				properties: {
					note: { type: "string", description: "What you are focusing on right now" },
					task: { type: "string", description: "Optional current task" },
					files: { type: "array", items: { type: "string" }, description: "Optional list of files you are touching" }
				},
				required: ["note"]
			}
		},
		{
			name: "cortex_summary",
			description: `Use this tool to recall what you have been doing in this session, files you touched, and recent notes.
Do not use this tool if you just started the session.
Input should be empty.
Common phrases: "สรุปสิ่งที่ทำไป", "context ตอนนี้", "session summary".
Returns the session summary.`,
			inputSchema: { type: "object", properties: {} }
		},
		{
			name: "cortex_reset",
			description: `Use this tool to clear the short-term context when starting a completely new task to avoid confusion.
Input should be empty.
Common phrases: "ล้าง context", "reset session".
Returns success status.`,
			inputSchema: { type: "object", properties: {} }
		}
	];
}

export function handlers(deps) {
	// Require cortex to be initialized in server.js and injected into deps
	if (!deps.cortex) {
		throw new Error("Cortex Engine is not initialized in server dependencies.");
	}

	return {
		cortex_push: async ({ note, task, files }) => {
			return deps.cortex.pushContext(note, task, files || []);
		},
		cortex_summary: async () => {
			return deps.cortex.getSummary();
		},
		cortex_reset: async () => {
			deps.cortex.reset();
			return { success: true, message: "Cortex session reset." };
		}
	};
}
