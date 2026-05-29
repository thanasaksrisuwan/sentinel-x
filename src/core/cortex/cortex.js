import fs from "fs/promises";
import path from "path";

/**
 * Sentinel-X Cortex System
 * Persistent short-term memory & attention tracking
 */
export class CortexEngine {
	constructor(deps) {
		this.deps = deps;
		this.memoryFile = path.join(this.deps.ROOT_DIR || process.cwd(), ".sentinel-cortex.json");
		this.reset();
	}

	async initialize() {
		try {
			const data = await fs.readFile(this.memoryFile, "utf-8");
			const parsed = JSON.parse(data);
			this.session = {
				startTime: parsed.session?.startTime || new Date().toISOString(),
				tasks: parsed.session?.tasks || [],
				filesTouched: new Set(parsed.session?.filesTouched || []),
				toolsUsed: parsed.session?.toolsUsed || {},
				notes: parsed.session?.notes || []
			};
			this.attentionStack = parsed.attentionStack || [];
		} catch (e) {
			this.reset();
		}
	}

	reset() {
		this.session = {
			startTime: new Date().toISOString(),
			tasks: [],
			filesTouched: new Set(),
			toolsUsed: {},
			notes: []
		};
		this.attentionStack = [];
		this.save();
	}

	async save() {
		try {
			const state = {
				session: {
					...this.session,
					filesTouched: [...this.session.filesTouched]
				},
				attentionStack: this.attentionStack
			};
			await fs.writeFile(this.memoryFile, JSON.stringify(state, null, 2), "utf-8");
		} catch (e) {
			console.error("Cortex: Failed to save memory state", e);
		}
	}

	async pushContext(note, task = null, files = []) {
		this.session.notes.push({ time: new Date().toISOString(), note });
		if (task) this.session.tasks.push(task);
		files.forEach(f => this.session.filesTouched.add(f));
		
		this.attentionStack.push({ note, files, time: new Date().toISOString() });
		if (this.attentionStack.length > 10) this.attentionStack.shift();
		
		await this.save();
		return this.getSummary();
	}

	async recordToolUsage(toolName) {
		this.session.toolsUsed[toolName] = (this.session.toolsUsed[toolName] || 0) + 1;
		await this.save();
	}

	getSummary() {
		const start = new Date(this.session.startTime);
		return {
			session_duration_minutes: Math.round((new Date() - start) / 60000),
			active_tasks: this.session.tasks,
			files_touched: [...this.session.filesTouched],
			tools_usage: this.session.toolsUsed,
			current_attention: this.attentionStack.slice(-1)[0] || null,
			recent_notes: this.session.notes.slice(-5)
		};
	}
}
