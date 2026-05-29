import { VerificationEngine } from "../core/verification/engine.js";

/**
 * Verification Tools for Sentinel-X
 */

export function definitions() {
	return [
		{
			name: "verify_impact",
			description: `Use this tool when the user asks to analyze the blast radius or impact of changing a specific symbol (class, function, variable).
Do not use this tool for general file reading or searching without a specific symbol in mind.
Input should be a project-relative file path and the exact symbol name to trace.
Common phrases: "ผลกระทบ", "ถ้าแก้ตรงนี้จะพังไหม", "impact analysis".
Returns a risk level (low/medium/high) and recommended testing strategy.`,
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "Target file path to analyze" },
					symbol: { type: "string", description: "Function, class or variable name to trace" }
				},
				required: ["path", "symbol"]
			}
		}
	];
}

export function handlers(deps) {
	return {
		verify_impact: async ({ path, symbol }) => {
			const verifier = new VerificationEngine(deps);
			return await verifier.analyzeImpact(path, symbol);
		}
	};
}
