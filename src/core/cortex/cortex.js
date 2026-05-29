/**
 * Sentinel-X Cortex System
 * Fluid short-term memory & attention tracking
 */
export class CortexEngine {
	constructor(deps) {
		this.deps = deps;
		this.reset();
	}

	reset() {
		this.session = {
			startTime: new Date(),
			tasks: [],
			filesTouched: new Set(),
			toolsUsed: {},
			notes: []
		};
		this.attentionStack = [];
	}

	pushContext(note, task = null, files = []) {
		this.session.notes.push({ time: new Date().toISOString(), note });
		if (task) this.session.tasks.push(task);
		files.forEach(f => this.session.filesTouched.add(f));
		
		this.attentionStack.push({ note, files, time: new Date() });
		// Keep stack small (recent 5)
		if (this.attentionStack.length > 5) this.attentionStack.shift();
		
		return this.getSummary();
	}

	recordToolUsage(toolName) {
		this.session.toolsUsed[toolName] = (this.session.toolsUsed[toolName] || 0) + 1;
	}

	getSummary() {
		return {
			session_duration_minutes: Math.round((new Date() - this.session.startTime) / 60000),
			active_tasks: this.session.tasks,
			files_touched: [...this.session.filesTouched],
			tools_usage: this.session.toolsUsed,
			current_attention: this.attentionStack.slice(-1)[0] || null,
			recent_notes: this.session.notes.slice(-3)
		};
	}
}
