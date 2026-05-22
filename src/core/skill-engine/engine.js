import fs from "fs/promises";
import path from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const SKILL_SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const DANGEROUS_TEMPLATE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

/**
 * Sentinel-X Skill Engine
 * Allows AI to execute complex multi-step workflows.
 */
export class SkillEngine {
	constructor(deps) {
		this.deps = deps;
		this.skillsDir = path.resolve(deps.ROOT_DIR, "sentinel-x/skills");
	}

	/**
	 * Discover all available skills
	 */
	async listSkills() {
		try {
			await fs.mkdir(this.skillsDir, { recursive: true });
			const files = await fs.readdir(this.skillsDir);
			return files.filter(f => f.endsWith(".yaml")).map(f => f.replace(".yaml", ""));
		} catch (e) {
			return [];
		}
	}

	/**
	 * Load and execute a skill
	 */
	async execute(skillName, input, toolRunner) {
		const yamlPath = this.skillPath(skillName);
		const content = await fs.readFile(yamlPath, "utf-8");
		const skill = parseYaml(content);

		const context = { input, steps: {}, results: [] };
		
		for (const step of skill.steps) {
			const resolvedParams = this.resolveTemplates(step.params || {}, context);
			
			// Simple tool runner (calls registry.handle)
			const result = await toolRunner(step.tool, resolvedParams);
			
			context.steps[step.id] = result;
			context.results.push({ step: step.id, tool: step.tool, result });

			if (step.halt_on_error && result.error) break;
		}

		return {
			skill: skill.name,
			summary: skill.description,
			execution: context.results
		};
	}

	/**
	 * Save a new skill (Autonomous Evolution)
	 */
	async saveSkill(name, description, steps) {
		const slug = this.toSkillSlug(name);
		const skill = {
			name,
			description,
			version: "1.0.0",
			steps
		};
		const yamlContent = stringifyYaml(skill);
		const filePath = this.skillPath(slug);
		
		await fs.mkdir(this.skillsDir, { recursive: true });
		await fs.writeFile(filePath, yamlContent, "utf-8");
		return { success: true, path: filePath };
	}

	resolveTemplates(params, context) {
		if (Array.isArray(params)) {
			return params.map(item => this.resolveTemplates(item, context));
		}

		if (params && typeof params === "object") {
			return Object.fromEntries(
				Object.entries(params).map(([key, value]) => [key, this.resolveTemplates(value, context)])
			);
		}

		if (typeof params !== "string") return params;

		const exact = params.match(/^\{\{(.+?)\}\}$/);
		if (exact) {
			const value = this.resolveTemplatePath(exact[1], context);
			return value === undefined ? "" : value;
		}

		return params.replace(/\{\{(.+?)\}\}/g, (_, templatePath) => {
			const value = this.resolveTemplatePath(templatePath, context);
			return value === undefined ? "" : String(value);
		});
	}

	resolveTemplatePath(templatePath, context) {
		const parts = templatePath.trim().split(".");
		let value = context;

		for (const part of parts) {
			if (!part || DANGEROUS_TEMPLATE_KEYS.has(part)) {
				throw new Error(`Unsafe template path: ${templatePath}`);
			}
			if (!Object.prototype.hasOwnProperty.call(Object(value), part)) {
				return undefined;
			}
			value = value[part];
		}

		return value;
	}

	toSkillSlug(name) {
		const slug = String(name || "").toLowerCase().trim().replace(/\s+/g, "-");
		this.assertValidSkillSlug(slug);
		return slug;
	}

	skillPath(name) {
		const slug = this.toSkillSlug(name);
		const filePath = path.resolve(this.skillsDir, `${slug}.yaml`);
		const relative = path.relative(this.skillsDir, filePath);

		if (relative.startsWith("..") || path.isAbsolute(relative)) {
			throw new Error(`Invalid skill path: ${name}`);
		}

		return filePath;
	}

	assertValidSkillSlug(slug) {
		if (!SKILL_SLUG_RE.test(slug)) {
			throw new Error(`Invalid skill name: ${slug}`);
		}
	}
}
