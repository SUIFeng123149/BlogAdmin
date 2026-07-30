import { basename, resolve } from "node:path";
import { config } from "./config.mjs";

function json(response, status, value) {
	response.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Cache-Control": "no-store",
	});
	response.end(JSON.stringify(value));
}

function text(response, status, value, type = "text/plain; charset=utf-8") {
	response.writeHead(status, {
		"Content-Type": type,
		"Cache-Control": "no-store",
	});
	response.end(value);
}

function cleanSlug(value) {
	const slug = String(value || "").trim();
	if (
		!slug ||
		slug.length > 100 ||
		/[\\/:*?"<>|]/.test(slug) ||
		slug.includes("..")
	) {
		throw new Error("请输入有效的文章文件名（不含扩展名）。");
	}
	return slug;
}

function fileForSlug(slug) {
	const file = resolve(config.postsDir, `${cleanSlug(slug)}.md`);
	if (
		!file.startsWith(`${config.postsDir}\\`) &&
		!file.startsWith(`${config.postsDir}/`)
	)
		throw new Error("无效的文章路径。");
	return file;
}

function assetDirectoryForSlug(slug) {
	const safeSlug = cleanSlug(slug);
	const directory = resolve(config.postsDir, `${safeSlug}.assets`);
	if (
		!directory.startsWith(`${config.postsDir}\\`) &&
		!directory.startsWith(`${config.postsDir}/`)
	)
		throw new Error("无效的资源路径。");
	return directory;
}

function safeAssetName(name, extension) {
	const base =
		basename(String(name || "upload"))
			.replace(/\.[^.]+$/, "")
			.replace(/[^a-zA-Z0-9_-]+/g, "-")
			.replace(/^-+|-+$/g, "") || "upload";
	return `${base}-${Date.now()}.${extension}`;
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

function parseFrontmatter(source) {
	const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) return { frontmatter: {}, body: source };
	const frontmatter = {};
	for (const line of match[1].split(/\r?\n/)) {
		const separator = line.indexOf(":");
		if (separator < 1) continue;
		const key = line.slice(0, separator).trim();
		let value = line.slice(separator + 1).trim();
		if (value.startsWith("[") && value.endsWith("]")) {
			value = value
				.slice(1, -1)
				.split(",")
				.map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
				.filter(Boolean);
		} else {
			value = value.replace(/^['"]|['"]$/g, "");
			if (value === "true") value = true;
			if (value === "false") value = false;
		}
		frontmatter[key] = value;
	}
	return { frontmatter, body: match[2] };
}

function renderPost(data) {
	const title = String(data.title || "").trim();
	if (!title) throw new Error("文章标题不能为空。");
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

export {
	json,
	text,
	cleanSlug,
	fileForSlug,
	assetDirectoryForSlug,
	safeAssetName,
	quoteYaml,
	yamlArray,
	parseFrontmatter,
	renderPost,
};
