const sections = new Set(["technical", "notes", "games", "other"]);
const statuses = new Set(["verified", "maintenance", "outdated"]);

function quoteYaml(value) {
	return JSON.stringify(String(value || ""));
}

function yamlArray(value) {
	const items = Array.isArray(value) ? value : String(value || "").split(",");
	return `[${items
		.map((item) => quoteYaml(String(item).trim()))
		.filter((item) => item !== '""')
		.join(", ")}]`;
}

export function serializePost(data) {
	const title = String(data.title || "").trim();
	if (!title) throw new Error("Article title is required");
	if (data.contentSection && !sections.has(data.contentSection))
		throw new Error("Unknown content section");
	if (data.status && !statuses.has(data.status))
		throw new Error("Unknown article status");

	const published = /^\d{4}-\d{2}-\d{2}$/.test(data.published || "")
		? data.published
		: new Date().toISOString().slice(0, 10);
	const lines = [
		"---",
		`title: ${quoteYaml(title)}`,
		`published: ${published}`,
		`description: ${quoteYaml(data.description)}`,
		`image: ${quoteYaml(data.image)}`,
		`tags: ${yamlArray(data.tags)}`,
		`category: ${quoteYaml(data.category)}`,
		`draft: ${Boolean(data.draft)}`,
		`featured: ${Boolean(data.featured)}`,
		data.contentSection ? `contentSection: ${data.contentSection}` : "",
		`lang: ${quoteYaml(data.lang || "")}`,
		`series: ${quoteYaml(data.series)}`,
		data.seriesOrder ? `seriesOrder: ${Number(data.seriesOrder)}` : "",
		data.status ? `status: ${data.status}` : "",
		`testedOn: ${quoteYaml(data.testedOn)}`,
		data.lastVerified ? `lastVerified: ${data.lastVerified}` : "",
		"---",
		"",
		String(data.body || ""),
	].filter((line) => line !== "");
	return `${lines.join("\n")}\n`;
}
