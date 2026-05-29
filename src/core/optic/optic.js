import fs from "fs/promises";
import path from "path";
import * as cheerio from "cheerio";

/**
 * Sentinel-X Optic Nerve
 * Visual Sensory & Web Perception (Robust via Cheerio)
 */
export class OpticEngine {
	constructor(deps) {
		this.deps = deps;
	}

	async fetchUrlText(url) {
		try {
			const res = await fetch(url, {
				headers: {
					'User-Agent': 'Sentinel-X Optic Engine/2.0 (Cheerio-powered)',
					'Accept': 'text/html,application/xhtml+xml,application/xml'
				}
			});

			if (!res.ok) {
				return { error: `HTTP ${res.status}: ${res.statusText}` };
			}

			const contentType = res.headers.get("content-type") || "";
			if (!contentType.includes("text/html")) {
				return { error: `Unsupported content type: ${contentType}` };
			}

			const html = await res.text();
			
			// Use proper AST parser (Cheerio) instead of regex
			const $ = cheerio.load(html);
			
			// Remove scripts, styles, and invisible elements
			$('script, style, noscript, iframe, svg, canvas').remove();
			
			const title = $('title').text().trim() || "No Title";
			
			const headings = [];
			$('h1, h2, h3').each((_, el) => {
				const tag = el.tagName.toUpperCase();
				const text = $(el).text().trim();
				if (text) headings.push(`${tag}: ${text}`);
			});

			// Clean up text content properly
			let textContent = $('body').text()
				.replace(/\s+/g, " ")
				.trim();
				
			if (textContent.length > 5000) {
				textContent = textContent.slice(0, 5000) + "... [Truncated]";
			}

			return {
				title,
				headings: headings.slice(0, 20),
				content_preview: textContent,
				source_url: url
			};

		} catch (error) {
			return { error: `Failed to fetch URL: ${error.message}` };
		}
	}

	async generateTreeMap(dir, currentDepth = 0, maxDepth = 3) {
		if (currentDepth > maxDepth) return "...";
		let result = "";
		
		try {
			const entries = await fs.readdir(dir, { withFileTypes: true });
			entries.sort((a, b) => {
				if (a.isDirectory() && !b.isDirectory()) return -1;
				if (!a.isDirectory() && b.isDirectory()) return 1;
				return a.name.localeCompare(b.name);
			});

			for (const entry of entries) {
				if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "vendor") {
					continue;
				}

				const prefix = "  ".repeat(currentDepth);
				if (entry.isDirectory()) {
					result += `${prefix}📁 ${entry.name}/\n`;
					const subMap = await this.generateTreeMap(path.join(dir, entry.name), currentDepth + 1, maxDepth);
					if (subMap) result += subMap;
				} else {
					result += `${prefix}📄 ${entry.name}\n`;
				}
			}
		} catch (e) {
			result += `${"  ".repeat(currentDepth)}[Access Denied]\n`;
		}
		
		return result;
	}
}
