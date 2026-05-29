import { PulseEngine } from "../core/pulse/pulse.js";

/**
 * Pulse Tools for Sentinel-X
 */

export function definitions() {
	return [
		{
			name: "pulse_check",
			description: `Use this tool to feel the "heartbeat" of the project and check for any files modified by the user or system since your last check.
Do not use this tool repeatedly without allowing time for changes to occur.
Input should be empty.
Common phrases: "มีอะไรเปลี่ยนบ้าง", "check status", "pulse".
Returns recently modified files and overall project health alerts.`,
			inputSchema: { type: "object", properties: {} }
		},
		{
			name: "pulse_watch",
			description: `Use this tool to focus the agent's attention on specific files or patterns for future pulse checks.
Do not use this tool for one-off reads (use read_file instead).
Input should be a string pattern (e.g., 'src/components').
Common phrases: "เฝ้าดูไฟล์นี้", "watch".
Returns the updated watch list.`,
			inputSchema: {
				type: "object",
				properties: {
					pattern: { type: "string", description: "Path or pattern to watch" }
				},
				required: ["pattern"]
			}
		}
	];
}

export function handlers(deps) {
	return {
		pulse_check: async () => {
			const pulse = new PulseEngine(deps);
			return await pulse.checkPulse();
		},
		pulse_watch: async ({ pattern }) => {
			const pulse = new PulseEngine(deps);
			const watchList = pulse.addWatch(pattern);
			return { watching: watchList };
		}
	};
}
