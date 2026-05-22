/**
 * Sentinel-X DB Intelligence Engine
 * Handles ERD generation and Semantic Inference.
 */
export class DbIntelligence {
	constructor(adapter) {
		this.adapter = adapter;
	}

	/**
	 * Generate Graph Data (Nodes and Edges)
	 */
	async generateGraph() {
		const tables = await this.adapter.listTables();
		const fkEdges = await this.adapter.getForeignKeys();
		
		const nodes = [];
		for (const table of tables) {
			const schema = await this.adapter.describeTable(table);
			nodes.push({ name: table, columns: schema });
		}

		return {
			nodes,
			edges: fkEdges.map(e => ({ ...e, type: "foreign_key", confidence: 1.0 }))
		};
	}

	/**
	 * Infer relationships based on naming patterns
	 */
	inferRelations(graph) {
		const tableNames = new Set(graph.nodes.map(n => n.name.toLowerCase()));
		const inferred = [];

		for (const node of graph.nodes) {
			for (const col of node.columns) {
				const colName = col.name.toLowerCase();
				if (colName.endsWith("_id")) {
					const base = colName.slice(0, -3);
					const candidates = [base, `tb_${base}`, `${base}s`];
					
					for (const cand of candidates) {
						if (tableNames.has(cand) && cand !== node.name.toLowerCase()) {
							inferred.push({
								from_table: node.name,
								from_column: col.name,
								to_table: cand,
								to_column: "id", // Assumption
								type: "inferred",
								confidence: 0.8
							});
							break;
						}
					}
				}
			}
		}
		return inferred;
	}
}
