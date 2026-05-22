/**
 * Sentinel-X Memory Search Engine
 * Implements multi-signal scoring for fact recall.
 */

export class MemorySearch {
	constructor(facts) {
		this.facts = facts;
	}

	/**
	 * Search for facts using a query string
	 */
	search(queryStr, limit = 10) {
		if (!queryStr) return [];

		const query = this.tokenize(queryStr.toLowerCase());
		const scoredFacts = this.facts.map(fact => ({
			fact,
			score: this.calculateScore(fact, query, queryStr.toLowerCase())
		}));

		return scoredFacts
			.filter(item => item.score > 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, limit)
			.map(item => ({
				...item.fact,
				_score: item.score
			}));
	}

	tokenize(text) {
		return text.split(/[\s,._/-]+/).filter(t => t.length > 1);
	}

	calculateScore(fact, queryTokens, rawQuery) {
		let score = 0;
		const content = fact.content.toLowerCase();
		const factTokens = this.tokenize(content);

		// Signal 1: Exact phrase match (High weight)
		if (content.includes(rawQuery)) {
			score += 10;
		}

		// Signal 2: Token overlap
		let tokenMatches = 0;
		queryTokens.forEach(t => {
			if (factTokens.includes(t)) {
				tokenMatches++;
				score += 2;
			}
		});

		// Signal 3: Tag match
		if (fact.tags) {
			fact.tags.forEach(tag => {
				if (queryTokens.includes(tag.toLowerCase())) {
					score += 3;
				}
			});
		}

		// Signal 4: Domain match
		if (fact.domain && rawQuery.includes(fact.domain.toLowerCase())) {
			score += 1;
		}

		// Signal 5: Recency boost (simple)
		const daysOld = (new Date() - new Date(fact.updated_at)) / (1000 * 60 * 60 * 24);
		if (daysOld < 7) score += 1;

		return score;
	}
}
