const sections = new Set(["technical", "notes", "games", "other"]);
const statuses = new Set(["verified", "maintenance", "outdated"]);
export const verificationStaleAfterDays = 180;

/** 首页精选文章数量上限（与主站 getFeaturedPosts 默认 limit 一致） */
export const FEATURED_LIMIT = 6;

/**
 * 校验精选数量上限。featured 为 true 且（排除当前文章后）已满额时抛错。
 * 后端权威校验：前端无论怎么改，保存时都会被这里拦住。
 * @param {number} featuredCountExcludingSelf 当前精选数（已排除正在编辑的这篇文章）
 * @param {unknown} featured 本次保存的 featured 值
 */
export function assertFeaturedLimit(featuredCountExcludingSelf, featured) {
	if (featured !== true) return;
	if (Number(featuredCountExcludingSelf) >= FEATURED_LIMIT)
		throw new Error(
			`首页精选最多 ${FEATURED_LIMIT} 篇，请先取消一篇已精选文章。`,
		);
}

export function currentDate() {
	return new Date().toISOString().slice(0, 10);
}

export function isVerificationStale(lastVerified, today = currentDate()) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(lastVerified || "")) return false;
	const verifiedAt = Date.parse(`${lastVerified}T00:00:00Z`);
	const todayAt = Date.parse(`${today}T00:00:00Z`);
	return Number.isFinite(verifiedAt) && Number.isFinite(todayAt) &&
		todayAt - verifiedAt >= verificationStaleAfterDays * 24 * 60 * 60 * 1000;
}

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

function generatedDescription(body) {
	return String(body || "")
		.replace(/```[\s\S]*?```/g, "")
		.replace(/!?(?:\[[^\]]*\])?\([^)]*\)/g, "")
		.replace(/[#>*_`~-]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 200);
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
		`description: ${quoteYaml(generatedDescription(data.body))}`,
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
