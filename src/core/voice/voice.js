/**
 * Sentinel-X Voice Box
 * Narrative Builder & Report Generator
 */
export class VoiceEngine {
	constructor(deps) {
		this.deps = deps;
	}

	buildNarrative(diffText) {
		if (!diffText || diffText.trim() === "") {
			return "No changes detected to narrate.";
		}

		// Extremely lightweight diff parsing to generate a story
		const lines = diffText.split("\n");
		let added = 0;
		let removed = 0;
		let filesChanged = new Set();
		let currentFile = "";

		for (const line of lines) {
			if (line.startsWith("diff --git")) {
				const match = line.match(/ b\/(.+)$/);
				if (match) {
					currentFile = match[1];
					filesChanged.add(currentFile);
				}
			} else if (line.startsWith("+") && !line.startsWith("+++")) {
				added++;
			} else if (line.startsWith("-") && !line.startsWith("---")) {
				removed++;
			}
		}

		const numFiles = filesChanged.size;
		const filesList = Array.from(filesChanged).map(f => `- ${f}`).join("\n");

		let story = `### 📝 Change Narrative\n\n`;
		story += `**Overview**: This change touches ${numFiles} file${numFiles > 1 ? 's' : ''}, with ${added} insertions and ${removed} deletions.\n\n`;
		
		if (added > removed * 3) {
			story += `**Pattern**: Mostly adding new logic or features.\n`;
		} else if (removed > added * 3) {
			story += `**Pattern**: Mostly cleanup or refactoring (heavy deletions).\n`;
		} else {
			story += `**Pattern**: Modification of existing logic (balanced changes).\n`;
		}

		story += `\n**Files Modified**:\n${filesList}\n`;

		return story;
	}

	async buildReport(title, sections) {
		const date = new Date().toISOString().split('T')[0];
		let report = `# 📊 ${title}\n*Generated on: ${date} by Sentinel-X*\n\n`;
		
		for (const section of sections) {
			report += `## ${section.heading}\n\n`;
			if (Array.isArray(section.content)) {
				report += section.content.map(c => `- ${c}`).join("\n") + "\n\n";
			} else {
				report += `${section.content}\n\n`;
			}
		}
		
		return report;
	}
}
