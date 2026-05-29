import { MemoryStore } from "../core/memory/store.js";

/**
 * Memory Tools for Sentinel-X
 */

export function definitions() {
	return [
		{
			name: "memory_remember",
			description: `Use this tool when the user states a durable project rule, business rule, convention, or decision that future tasks should reuse.
Do not use this tool for temporary observations, command output, secrets, credentials, or facts that are not expected to remain true.
Input should be concise factual content with a domain, tags, and scope.
Common phrases: "จำไว้", "ต่อไปให้", "rule ของโปรเจกต์", "ใช้แบบนี้เสมอ".
Returns the stored fact with id, metadata, and scope.`,
			inputSchema: {
				type: "object",
				properties: {
					content: { type: "string", description: "The fact to remember" },
					domain: { type: "string", description: "Category (e.g., auth, database, ui)", default: "general" },
					tags: { type: "array", items: { type: "string" }, description: "Searchable tags" },
					scope: { type: "string", enum: ["project", "user"], default: "project", description: "project (shared/committed) or user (private)" }
				},
				required: ["content"]
			}
		},
		{
			name: "memory_list",
			description: `Use this tool when you need to inspect stored project or user memory before relying on it.
Do not use this tool for relevance search; use memory_recall when you have a specific query.
Input should be empty or a domain filter such as auth, database, ui, architecture, or workflow.
Common phrases: "มี memory อะไร", "list rules", "ดูความจำ".
Returns matching facts and total count.`,
			inputSchema: {
				type: "object",
				properties: {
					domain: { type: "string", description: "Filter by domain" }
				}
			}
		},
		{
			name: "memory_recall",
			description: `Use this tool at the start of non-trivial tasks to retrieve relevant project rules, prior decisions, and domain context.
Do not use this tool when the request is fully self-contained or when live source code is the only reliable evidence.
Input should be a short natural-language query with the feature, module, or concept you are about to work on.
Common phrases: "เคยทำไว้ไหม", "กฎเดิม", "project context", "จำอะไรเกี่ยวกับ".
Returns ranked memory facts with relevance scores.`,
			inputSchema: {
				type: "object",
				properties: {
					query: { type: "string", description: "Search query (e.g., 'auth login rule')" },
					limit: { type: "number", description: "Max results", default: 5 }
				},
				required: ["query"]
			}
		},
		{
			name: "memory_index_project",
			description: `Use this tool once when onboarding a project or after major manifest/framework changes to seed architectural memory.
Do not use this tool repeatedly during normal code edits; it may duplicate broad structural facts.
Input should be empty.
Common phrases: "index project", "สร้าง memory จากโปรเจกต์", "scan structure".
Returns counts of indexed files, facts added, and any indexing errors.`,
			inputSchema: {
				type: "object",
				properties: {}
			}
		}
	];
}

export function handlers(deps) {
	return {
		memory_remember: async (args) => {
			const store = new MemoryStore(deps);
			const fact = await store.addFact(args);
			return { success: true, fact };
		},
		memory_list: async (args) => {
			const store = new MemoryStore(deps);
			const facts = await store.list(args);
			return { facts, count: facts.length };
		},
		memory_recall: async ({ query, limit }) => {
			const store = new MemoryStore(deps);
			const allFacts = await store.list();
			const { MemorySearch } = await import("../core/memory/search.js");
			const searcher = new MemorySearch(allFacts);
			const results = searcher.search(query, limit);
			return { results, count: results.length };
		},
		memory_index_project: async () => {
			const store = new MemoryStore(deps);
			const { AutoIndexer } = await import("../core/memory/indexer.js");
			const indexer = new AutoIndexer(deps, store);
			const results = await indexer.indexProject();
			return results;
		}
	};
}
