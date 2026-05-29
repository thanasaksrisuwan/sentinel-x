import fs from "fs/promises";
import path from "path";

/**
 * Sentinel-X Optic Nerve
 * Visual Sensory & Web Perception (Lightweight)
 */
export class OpticEngine {
	constructor(deps) {
		this.deps = deps;
	}

	async fetchUrlText(url) {
		try {
			// Using native fetch
			const res = await fetch(url, {
				headers: {
					'User-Agent': 'Sentinel-X Optic Engine/1.0',
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

			let html = await res.text();
			
			// Extremely lightweight HTML stripping (No Cheerio/Puppeteer required)
			// Remove scripts and styles
			html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
			html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
			
			// Extract title
			const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
			const title = titleMatch ? titleMatch[1].trim() : "No Title";

			// Extract headings (h1, h2, h3)
			const headings = [];
			const headingRegex = /<(h[1-3])[^>]*>(.*?)<\/\1>/gi;
			let match;
			while ((match = headingRegex.exec(html)) !== null) {
				const tag = match[1].toLowerCase();
				const text = match[2].replace(/<[^>]+>/g, "").trim();
				if (text) headings.push(`${tag.toUpperCase()}: ${text}`);
			}

			// Clean up text content
			let textContent = html
				.replace(/<[^>]+>/g, " ") // Remove all remaining tags
				.replace(/&nbsp;/g, " ") // Decode space
				.replace(/\s+/g, " ") // Condense whitespace
				.trim();
				
			// Truncate to avoid massive payloads
			if (textContent.length > 5000) {
				textContent = textContent.slice(0, 5000) + "... [Truncated]";
			}

			return {
				title,
				headings: headings.slice(0, 20), // Top 20 headings
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
			// Sort dirs first, then files
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
