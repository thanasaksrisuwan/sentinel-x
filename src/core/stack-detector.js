import fs from "fs/promises";
import path from "path";

/**
 * Sentinel-X Stack Detector
 * Identifies the project's tech stack to load appropriate adapters.
 */
export class StackDetector {
	constructor(rootDir) {
		this.rootDir = rootDir;
	}

	async detect() {
		const results = {
			primary: "generic",
			tags: new Set(),
			manifests: []
		};

		const files = await fs.readdir(this.rootDir);

		// 1. PHP / Laravel detection
		if (files.includes("composer.json")) {
			results.tags.add("php");
			results.manifests.push("composer.json");
			try {
				const composer = JSON.parse(await fs.readFile(path.join(this.rootDir, "composer.json"), "utf-8"));
				const deps = { ...composer.require, ...composer["require-dev"] };
				if (deps["laravel/framework"]) {
					results.primary = "laravel";
					results.tags.add("laravel");
				}
			} catch (e) { /* ignore parse error */ }
		}

		// 2. Node.js / React / Express detection
		if (files.includes("package.json")) {
			results.tags.add("nodejs");
			results.manifests.push("package.json");
			try {
				const pkg = JSON.parse(await fs.readFile(path.join(this.rootDir, "package.json"), "utf-8"));
				const deps = { ...pkg.dependencies, ...pkg.devDependencies };
				if (deps["react"]) results.tags.add("react");
				if (deps["express"]) results.tags.add("express");
				if (deps["next"]) results.tags.add("nextjs");
				
				if (results.primary === "generic") {
					if (deps["react"]) results.primary = "react";
					else if (deps["express"]) results.primary = "express";
				}
			} catch (e) { /* ignore parse error */ }
		}

		// 3. Python detection
		if (files.includes("requirements.txt") || files.includes("pyproject.toml")) {
			results.tags.add("python");
			results.manifests.push(files.includes("requirements.txt") ? "requirements.txt" : "pyproject.toml");
			if (results.primary === "generic") results.primary = "python";
		}

		// 4. Go detection
		if (files.includes("go.mod")) {
			results.tags.add("go");
			results.manifests.push("go.mod");
			if (results.primary === "generic") results.primary = "go";
		}

		return {
			primary: results.primary,
			tags: Array.from(results.tags),
			manifests: results.manifests
		};
	}
}
