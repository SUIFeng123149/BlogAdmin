import { randomBytes, timingSafeEqual } from "node:crypto";
import {
	mkdir,
	readdir,
	readFile,
	rename,
	unlink,
	writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { basename, extname, join, resolve } from "node:path";
import { serializePost } from "./lib/posts.mjs";
import { normalizeAlbumInfo, validateAlbumId } from "./lib/albums.mjs";
import { assertPathInside, decodeImageDataUrl } from "./lib/storage.mjs";

const root = process.cwd();
const adminEnv = await readFile(resolve(root, ".env.admin"), "utf8").catch(
	() => "",
);
for (const line of adminEnv.split(/\r?\n/)) {
	const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
	if (match && !match[2].startsWith("#") && !process.env[match[1]])
		process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
}
const postsDir = resolve(root, "src/content/posts");
const configPath = resolve(root, "src/config.ts");
const publicDir = resolve(root, "admin/public");
const tagLibraryPath = resolve(root, "admin/tag-library.json");
const categoryLibraryPath = resolve(root, "admin/category-library.json");
const artistLibraryPath = resolve(root, "admin/artist-library.json");
const albumsDir = resolve(root, "public/images/albums");
const port = Number(process.env.ADMIN_PORT || 8787);
const host = process.env.ADMIN_HOST || "127.0.0.1";
const password = process.env.ADMIN_PASSWORD;
const deployHookUrl = process.env.DEPLOY_HOOK_URL || "";
const sessions = new Map();
const maxBodySize = 80 * 1024 * 1024;

if (!password) {
	console.error("启动管理后台前必须设置 ADMIN_PASSWORD。");
	process.exit(1);
}

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

function parseCookies(request) {
	return Object.fromEntries(
		(request.headers.cookie || "")
			.split(";")
			.map((part) => {
				const index = part.indexOf("=");
				return index < 0
					? []
					: [
							part.slice(0, index).trim(),
							decodeURIComponent(part.slice(index + 1).trim()),
						];
			})
			.filter((entry) => entry.length),
	);
}

function isAuthenticated(request) {
	const token = parseCookies(request).mizuki_admin;
	const session = token && sessions.get(token);
	if (!session || session.expires < Date.now()) return false;
	session.expires = Date.now() + 8 * 60 * 60 * 1000;
	return true;
}

async function readBody(request) {
	let data = "";
	for await (const chunk of request) {
		data += chunk;
		if (Buffer.byteLength(data) > maxBodySize) throw new Error("请求体过大。");
	}
	try {
		return data ? JSON.parse(data) : {};
	} catch {
		throw new Error("无效的 JSON 请求体。");
	}
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
	const file = resolve(postsDir, `${cleanSlug(slug)}.md`);
	if (!file.startsWith(`${postsDir}\\`) && !file.startsWith(`${postsDir}/`))
		throw new Error("无效的文章路径。");
	return file;
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

function assetDirectoryForSlug(slug) {
	const safeSlug = cleanSlug(slug);
	const directory = resolve(postsDir, `${safeSlug}.assets`);
	if (
		!directory.startsWith(`${postsDir}\\`) &&
		!directory.startsWith(`${postsDir}/`)
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

async function saveCollectionMedia(collection, body) {
	const match = String(body.data || "").match(
		/^data:([^;]+);base64,([\s\S]+)$/,
	);
	if (!match) throw new Error("上传数据无效。");
	const { mime, bytes } = decodeImageDataUrl(body.data, [
		"image/webp",
		"image/jpeg",
		"image/png",
		"image/gif",
		"audio/mpeg",
	]);
	const field = body.field || "cover";
	let directory;
	let extension;
	let publicPath;
	if (collection === "projects") {
		if (mime !== "image/webp") throw new Error("项目图片必须为 WebP 文件。");
		directory = resolve(root, "public/assets/images");
		extension = "webp";
		publicPath = "assets/images";
	} else if (collection === "anime") {
		if (mime !== "image/webp") throw new Error("番剧封面必须为 WebP 文件。");
		directory = resolve(root, "public/assets/anime");
		extension = "webp";
		publicPath = "assets/anime";
	} else if (collection === "music" && field === "cover") {
		const imageExtensions = {
			"image/jpeg": "jpg",
			"image/png": "png",
			"image/webp": "webp",
			"image/gif": "gif",
		};
		extension = imageExtensions[mime];
		if (!extension) throw new Error("音乐封面必须为图片文件。");
		directory = resolve(root, "public/assets/music/cover");
		publicPath = "assets/music/cover";
	} else if (collection === "music" && field === "url") {
		if (mime !== "audio/mpeg") throw new Error("音乐文件必须为 MP3。");
		directory = resolve(root, "public/assets/music/url");
		extension = "mp3";
		publicPath = "assets/music/url";
	} else {
		throw new Error("此字段不支持上传。");
	}
	if (
		collection !== "music" &&
		(bytes.length < 12 ||
			bytes.toString("ascii", 0, 4) !== "RIFF" ||
			bytes.toString("ascii", 8, 12) !== "WEBP")
	)
		throw new Error("图片必须是有效的 WebP 文件。");
	await mkdir(directory, { recursive: true });
	const filename = safeAssetName(body.name, extension);
	const target = join(directory, filename);
	assertPathInside(directory, target);
	await writeFile(target, bytes);
	return { path: `${publicPath}/${filename}` };
}
async function getCategoryOptions() {
	const posts = await listPosts();
	const categories = await readCategoryLibrary();
	const postCategories = posts.map((post) => post.category).filter(Boolean);
	const projectCategories = [
		"web",
		"mobile",
		"desktop",
		"other",
		...categories.filter((category) =>
			["web", "mobile", "desktop", "other"].includes(category),
		),
	];
	return {
		posts: [...new Set(postCategories)].sort((a, b) =>
			String(a).localeCompare(String(b)),
		),
		projects: [...new Set(projectCategories)],
		all: categories,
	};
}
async function savePostAsset(slug, body) {
	const match = String(body.data || "").match(
		/^data:([^;]+);base64,([\s\S]+)$/,
	);
	if (!match) throw new Error("上传数据无效。");
	const { mime, bytes } = decodeImageDataUrl(body.data, [
		"image/webp",
		"video/mp4",
		"video/webm",
	]);
	const kind = body.kind === "video" ? "video" : "image";
	let extension;
	if (kind === "image") {
		if (
			mime !== "image/webp" ||
			bytes.length < 12 ||
			bytes.toString("ascii", 0, 4) !== "RIFF" ||
			bytes.toString("ascii", 8, 12) !== "WEBP"
		)
			throw new Error("图片必须是有效的 WebP 文件。");
		extension = "webp";
	} else {
		if (mime === "video/mp4") extension = "mp4";
		else if (mime === "video/webm") extension = "webm";
		else throw new Error("视频必须为 MP4 或 WebM 文件。");
	}
	const directory = assetDirectoryForSlug(slug);
	await mkdir(directory, { recursive: true });
	const filename =
		body.cover && kind === "image"
			? "cover.webp"
			: safeAssetName(body.name, extension);
	const target = join(directory, filename);
	assertPathInside(directory, target);
	await writeFile(target, bytes);
	const relative = `./${cleanSlug(slug)}.assets/${filename}`;
	return {
		path: relative,
		markdown:
			kind === "image"
				? `![${String(body.alt || "image").replace(/[[\]]/g, "")}](${relative})`
				: `<video controls src="${relative}"></video>`,
	};
}
async function listPosts() {
	const entries = await readdir(postsDir, { withFileTypes: true });
	const posts = await Promise.all(
		entries
			.filter(
				(entry) =>
					entry.isFile() && extname(entry.name).toLowerCase() === ".md",
			)
			.map(async (entry) => {
				const slug = basename(entry.name, ".md");
				const { frontmatter } = parseFrontmatter(
					await readFile(join(postsDir, entry.name), "utf8"),
				);
				return {
					slug,
					title: frontmatter.title || slug,
					published: frontmatter.published || "",
					draft: frontmatter.draft === true,
					category: frontmatter.category || "",
					tags: frontmatter.tags || [],
					featured: frontmatter.featured === true,
					contentSection: frontmatter.contentSection || "",
					status: frontmatter.status || "",
				};
			}),
	);
	return posts.sort((a, b) =>
		String(b.published).localeCompare(String(a.published)),
	);
}

function settingValue(source, expression, fallback) {
	return source.match(expression)?.[1] ?? fallback;
}

async function readSettings() {
	const source = await readFile(configPath, "utf8");
	return {
		title: settingValue(source, /title:\s*"([^"]*)"/, ""),
		subtitle: settingValue(source, /subtitle:\s*"([^"]*)"/, ""),
		profileName: settingValue(source, /export const profileConfig[\s\S]*?name:\s*"([^"]*)"/, ""),
		profileBio: settingValue(source, /export const profileConfig[\s\S]*?bio:\s*"([^"]*)"/, ""),
		themeHue: Number(settingValue(source, /hue:\s*(\d+)/, "35")),
		bannerEnabled:
			settingValue(
				source,
				/banner:\s*\{[\s\S]*?enable:\s*(true|false)/,
				"true",
			) === "true",
		commentsEnabled:
			settingValue(
				source,
				/export const commentConfig[\s\S]*?enable:\s*(true|false)/,
				"false",
			) === "true",
		musicEnabled:
			settingValue(
				source,
				/export const musicPlayerConfig[\s\S]*?enable:\s*(true|false)/,
				"false",
			) === "true",
		ogImagesEnabled:
			settingValue(source, /generateOgImages:\s*(true|false)/, "false") ===
			"true",
		announcementEnabled:
			settingValue(
				 source,
				/export const announcementConfig[\s\S]*?enable:\s*(true|false)/,
				"false",
			) === "true",
		announcementContent: settingValue(
			source,
			/export const announcementConfig[\s\S]*?content:\s*"([^"]*)"/,
			"",
		),
	};
}

async function writeSettings(data) {
	let source = await readFile(configPath, "utf8");
	const replace = (pattern, value) => {
		source = source.replace(pattern, value);
	};
	replace(/title:\s*"[^"]*"/, `title: ${quoteYaml(data.title)}`);
	replace(/subtitle:\s*"[^"]*"/, `subtitle: ${quoteYaml(data.subtitle)}`);
	replace(/(export const profileConfig[\s\S]*?name:\s*)"[^"]*"/, `$1${quoteYaml(data.profileName)}`);
	replace(/(export const profileConfig[\s\S]*?bio:\s*)"[^"]*"/, `$1${quoteYaml(data.profileBio)}`);
	replace(
		/hue:\s*\d+/,
		`hue: ${Math.max(0, Math.min(360, Number(data.themeHue) || 0))}`,
	);
	replace(
		/(banner:\s*\{[\s\S]*?enable:\s*)(true|false)/,
		`$1${Boolean(data.bannerEnabled)}`,
	);
	replace(
		/(export const commentConfig[\s\S]*?enable:\s*)(true|false)/,
		`$1${Boolean(data.commentsEnabled)}`,
	);
	replace(
		/(export const musicPlayerConfig[\s\S]*?enable:\s*)(true|false)/,
		`$1${Boolean(data.musicEnabled)}`,
	);
	replace(
		/generateOgImages:\s*(true|false)/,
		`generateOgImages: ${Boolean(data.ogImagesEnabled)}`,
	);
	replace(
		/(export const announcementConfig[\s\S]*?enable:\s*)(true|false)/,
		`$1${Boolean(data.announcementEnabled)}`,
	);
	replace(
		/(export const announcementConfig[\s\S]*?content:\s*)"[^"]*"/,
		`$1${quoteYaml(data.announcementContent)}`,
	);
	await writeFile(`${configPath}.backup`, await readFile(configPath));
	await writeFile(configPath, source, "utf8");
}

async function readCategoryLibrary() {
	const saved = await readFile(categoryLibraryPath, "utf8")
		.then(JSON.parse)
		.catch(() => []);
	const posts = await listPosts();
	const projects = (await readCollection("projects")).items;
	const builtIn = ["web", "mobile", "desktop", "other"];
	return [
		...new Set(
			[
				...saved,
				...builtIn,
				...posts.map((post) => post.category),
				...projects.map((project) => project.category),
			]
				.map((category) => String(category || "").trim())
				.filter(Boolean),
		),
	];
}

async function addToCategoryLibrary(categories) {
	const existing = await readCategoryLibrary();
	const next = [
		...new Set(
			[...existing, ...(Array.isArray(categories) ? categories : [categories])]
				.map((category) => String(category || "").trim())
				.filter(Boolean),
		),
	].sort((a, b) => a.localeCompare(b));
	await writeFile(
		categoryLibraryPath,
		`${JSON.stringify(next, null, 2)}\n`,
		"utf8",
	);
	return next;
}
async function readTagLibrary() {
	const saved = await readFile(tagLibraryPath, "utf8")
		.then(JSON.parse)
		.catch(() => []);
	const postTags = (await listPosts()).flatMap((post) =>
		Array.isArray(post.tags) ? post.tags : [],
	);
	const projectTags = (await readCollection("projects")).items.flatMap(
		(project) => (Array.isArray(project.tags) ? project.tags : []),
	);
	return [
		...new Set(
			[...saved, ...postTags, ...projectTags]
				.map((tag) => String(tag).trim())
				.filter(Boolean),
		),
	].sort((a, b) => a.localeCompare(b));
}

async function addToTagLibrary(tags) {
	const existing = await readTagLibrary();
	const next = [
		...new Set(
			[...existing, ...(Array.isArray(tags) ? tags : [])]
				.map((tag) => String(tag).trim())
				.filter(Boolean),
		),
	].sort((a, b) => a.localeCompare(b));
	await writeFile(tagLibraryPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
	return next;
}
async function readArtistLibrary() {
	const saved = await readFile(artistLibraryPath, "utf8")
		.then(JSON.parse)
		.catch(() => []);
	const music = (await readCollection("music")).items;
	return [
		...new Set(
			[...saved, ...music.map((track) => track.artist)]
				.map((artist) => String(artist || "").trim())
				.filter(Boolean),
		),
	].sort((a, b) => a.localeCompare(b));
}

async function addToArtistLibrary(artists) {
	const existing = await readArtistLibrary();
	const next = [
		...new Set(
			[...existing, ...(Array.isArray(artists) ? artists : [artists])]
				.map((artist) => String(artist || "").trim())
				.filter(Boolean),
		),
	].sort((a, b) => a.localeCompare(b));
	await writeFile(
		artistLibraryPath,
		`${JSON.stringify(next, null, 2)}\n`,
		"utf8",
	);
	return next;
}

async function triggerDeploy() {
	if (!deployHookUrl) return { status: "not-configured" };
	try {
		const response = await fetch(deployHookUrl, { method: "POST" });
		return {
			status: response.ok ? "triggered" : "failed",
			code: response.status,
		};
	} catch (error) {
		return {
			status: "failed",
			message:
				error instanceof Error ? error.message : "Unknown deployment error",
		};
	}
}

const dataCollections = {
	projects: {
		file: resolve(root, "src/data/projects.ts"),
		symbol: "projectsData",
		kind: "array",
	},
	skills: {
		file: resolve(root, "src/data/skills.ts"),
		symbol: "skillsData",
		kind: "array",
	},
	timeline: {
		file: resolve(root, "src/data/timeline.ts"),
		symbol: "timelineData",
		kind: "array",
	},
	anime: {
		file: resolve(root, "src/data/anime.ts"),
		symbol: "localAnimeList",
		kind: "array",
	},
	music: {
		file: resolve(root, "src/components/widget/MusicPlayer.svelte"),
		symbol: "localPlaylist",
		kind: "array",
	},
	now: {
		file: resolve(root, "src/data/now.ts"),
		symbol: "now",
		kind: "object",
	},
};

function findLiteralRange(source, symbol, opening) {
	const close = opening === "[" ? "]" : "}";
	const declaration = new RegExp(
		`(?:export\\s+)?const\\s+${symbol}(?:\\s*:[^=]+)?\\s*=\\s*\\${opening}`,
	);
	const match = declaration.exec(source);
	if (!match) throw new Error(`未找到数据声明 ${symbol}。`);
	const start = match.index + match[0].lastIndexOf(opening);
	let depth = 0;
	let quote = "";
	let escaped = false;
	for (let index = start; index < source.length; index++) {
		const char = source[index];
		if (quote) {
			if (escaped) escaped = false;
			else if (char === "\\") escaped = true;
			else if (char === quote) quote = "";
			continue;
		}
		if (char === "'" || char === '"' || char === "`") {
			quote = char;
			continue;
		}
		if (char === opening) depth++;
		if (char === close && --depth === 0) return { start, end: index + 1 };
	}
	throw new Error(`数据声明 ${symbol} 的括号未闭合。`);
}

function parseDataLiteral(literal) {
	return Function(`"use strict"; return (${literal});`)();
}

async function readCollection(name) {
	const collection = dataCollections[name];
	if (!collection) throw new Error("未知的数据集合。");
	const source = await readFile(collection.file, "utf8");
	const range = findLiteralRange(
		source,
		collection.symbol,
		collection.kind === "array" ? "[" : "{",
	);
	return {
		name,
		kind: collection.kind,
		items: parseDataLiteral(source.slice(range.start, range.end)),
	};
}

async function writeCollection(name, items) {
	const collection = dataCollections[name];
	if (!collection) throw new Error("未知的数据集合。");
	if (collection.kind === "array" && !Array.isArray(items))
		throw new Error("集合数据必须为数组。");
	if (
		collection.kind === "object" &&
		(!items || Array.isArray(items) || typeof items !== "object")
	)
		throw new Error("集合数据必须为对象。");
	const source = await readFile(collection.file, "utf8");
	const range = findLiteralRange(
		source,
		collection.symbol,
		collection.kind === "array" ? "[" : "{",
	);
	const serialized = JSON.stringify(items, null, 2);
	await writeFile(`${collection.file}.backup`, source, "utf8");
	await writeFile(
		collection.file,
		`${source.slice(0, range.start)}${serialized}${source.slice(range.end)}`,
		"utf8",
	);
	if (name === "projects") {
		await addToTagLibrary(
			items.flatMap((project) =>
				Array.isArray(project.tags) ? project.tags : [],
			),
		);
		await addToCategoryLibrary(items.map((project) => project.category));
	}
	if (name === "music")
		await addToArtistLibrary(items.map((track) => track.artist));
}
function albumDirectory(id) {
	const directory = resolve(albumsDir, validateAlbumId(id));
	assertPathInside(albumsDir, directory);
	return directory;
}

async function readAlbum(id) {
	const safeId = validateAlbumId(id);
	const directory = albumDirectory(safeId);
	const info = JSON.parse(await readFile(join(directory, "info.json"), "utf8"));
	const files = await readdir(directory, { withFileTypes: true });
	const images = files
		.filter((entry) => entry.isFile() && /\.(avif|gif|jpe?g|png|webp)$/i.test(entry.name))
		.map((entry) => entry.name)
		.sort();
	return { id: safeId, ...normalizeAlbumInfo(info), images };
}

async function listAlbums() {
	const entries = await readdir(albumsDir, { withFileTypes: true }).catch(() => []);
	const albums = await Promise.all(
		entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
			try {
				return await readAlbum(entry.name);
			} catch {
				return null;
			}
		}),
	);
	return albums.filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
}

async function writeAlbum(id, value) {
	const safeId = validateAlbumId(id);
	const directory = albumDirectory(safeId);
	await mkdir(directory, { recursive: true });
	const infoPath = join(directory, "info.json");
	const source = `${JSON.stringify(normalizeAlbumInfo(value), null, 2)}\n`;
	await writeFile(`${infoPath}.backup`, await readFile(infoPath, "utf8").catch(() => ""), "utf8");
	await writeFile(infoPath, source, "utf8");
	return readAlbum(safeId);
}

async function handleApi(request, response, pathname) {
	if (pathname === "/api/login" && request.method === "POST") {
		const body = await readBody(request);
		const supplied = Buffer.from(String(body.password || ""));
		const expected = Buffer.from(password);
		if (
			supplied.length !== expected.length ||
			!timingSafeEqual(supplied, expected)
		)
			return json(response, 401, { error: "密码错误。" });
		const token = randomBytes(32).toString("hex");
		sessions.set(token, { expires: Date.now() + 8 * 60 * 60 * 1000 });
		response.writeHead(204, {
			"Set-Cookie": `mizuki_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`,
			"Cache-Control": "no-store",
		});
		return response.end();
	}
	if (pathname === "/api/logout" && request.method === "POST") {
		response.writeHead(204, {
			"Set-Cookie":
				"mizuki_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
		});
		return response.end();
	}
	if (!isAuthenticated(request))
		return json(response, 401, { error: "需要身份验证。" });
	if (pathname === "/api/session")
		return json(response, 200, { authenticated: true });
	if (pathname === "/api/albums" && request.method === "GET")
		return json(response, 200, { items: await listAlbums() });
	if (pathname === "/api/albums" && request.method === "POST") {
		const body = await readBody(request);
		const id = validateAlbumId(body.id || body.title);
		return json(response, 201, { item: await writeAlbum(id, body) });
	}
	if (pathname.startsWith("/api/albums/") && request.method === "GET") {
		const id = decodeURIComponent(pathname.slice("/api/albums/".length));
		return json(response, 200, { item: await readAlbum(id) });
	}
	if (pathname.startsWith("/api/albums/") && request.method === "PUT") {
		const id = decodeURIComponent(pathname.slice("/api/albums/".length));
		return json(response, 200, { item: await writeAlbum(id, await readBody(request)) });
	}
	if (pathname === "/api/posts" && request.method === "GET")
		return json(response, 200, await listPosts());
	const assetMatch = pathname.match(/^\/api\/posts\/([^/]+)\/assets\/([^/]+)$/);
	if (assetMatch && request.method === "GET") {
		const slug = decodeURIComponent(assetMatch[1]);
		const filename = basename(decodeURIComponent(assetMatch[2]));
		const extension = extname(filename).toLowerCase();
		const contentType =
			extension === ".webp"
				? "image/webp"
				: extension === ".mp4"
					? "video/mp4"
					: extension === ".webm"
						? "video/webm"
						: "application/octet-stream";
		const asset = await readFile(join(assetDirectoryForSlug(slug), filename));
		response.writeHead(200, {
			"Content-Type": contentType,
			"Cache-Control": "no-store",
		});
		return response.end(asset);
	}
	if (pathname.startsWith("/api/posts/") && request.method === "GET") {
		const slug = decodeURIComponent(pathname.slice("/api/posts/".length));
		const { frontmatter, body } = parseFrontmatter(
			await readFile(fileForSlug(slug), "utf8"),
		);
		return json(response, 200, { slug, ...frontmatter, body });
	}
	if (pathname === "/api/posts" && request.method === "POST") {
		const body = await readBody(request);
		const slug = cleanSlug(body.slug || body.title);
		const file = fileForSlug(slug);
		try {
			await readFile(file);
			return json(response, 409, {
				error: "此文件名已存在。",
			});
		} catch {}
		await writeFile(file, serializePost(body), "utf8");
		await addToTagLibrary(body.tags);
		await addToCategoryLibrary(body.category);
		await addToCategoryLibrary(body.category);
		return json(response, 201, { slug, deployment: await triggerDeploy() });
	}
	if (
		pathname.startsWith("/api/posts/") &&
		pathname.endsWith("/assets") &&
		request.method === "POST"
	) {
		const slug = decodeURIComponent(
			pathname.slice("/api/posts/".length, -"/assets".length),
		);
		return json(
			response,
			201,
			await savePostAsset(slug, await readBody(request)),
		);
	}
	if (pathname.startsWith("/api/posts/") && request.method === "PUT") {
		const currentSlug = decodeURIComponent(
			pathname.slice("/api/posts/".length),
		);
		const body = await readBody(request);
		const nextSlug = cleanSlug(body.slug || currentSlug);
		const currentFile = fileForSlug(currentSlug);
		const nextFile = fileForSlug(nextSlug);
		if (currentFile !== nextFile) await rename(currentFile, nextFile);
		await writeFile(nextFile, serializePost(body), "utf8");
		await addToTagLibrary(body.tags);
		await addToCategoryLibrary(body.category);
		await addToCategoryLibrary(body.category);
		return json(response, 200, {
			slug: nextSlug,
			deployment: await triggerDeploy(),
		});
	}
	if (pathname.startsWith("/api/posts/") && request.method === "DELETE") {
		const slug = decodeURIComponent(pathname.slice("/api/posts/".length));
		await unlink(fileForSlug(slug));
		return json(response, 200, { deployment: await triggerDeploy() });
	}
	if (pathname === "/api/options/categories" && request.method === "GET")
		return json(response, 200, await getCategoryOptions());
	if (pathname === "/api/options/artists" && request.method === "GET")
		return json(response, 200, await readArtistLibrary());
	if (pathname === "/api/options/tech-stack" && request.method === "GET") {
		const projects = (await readCollection("projects")).items;
		const skills = (await readCollection("skills")).items;
		const values = [
			...projects.flatMap((project) =>
				Array.isArray(project.techStack) ? project.techStack : [],
			),
			...skills.map((skill) => skill.name),
		];
		return json(
			response,
			200,
			[
				...new Set(values.map((value) => String(value).trim()).filter(Boolean)),
			].sort((a, b) => a.localeCompare(b)),
		);
	}
	if (pathname === "/api/tags" && request.method === "GET")
		return json(response, 200, await readTagLibrary());
	if (pathname === "/api/tags" && request.method === "POST") {
		const body = await readBody(request);
		return json(response, 201, await addToTagLibrary([body.tag]));
	}
	const collectionAssetMatch = pathname.match(/^\/api\/data\/([^/]+)\/assets$/);
	if (collectionAssetMatch && request.method === "POST") {
		const collection = decodeURIComponent(collectionAssetMatch[1]);
		return json(
			response,
			201,
			await saveCollectionMedia(collection, await readBody(request)),
		);
	}
	if (pathname === "/api/data" && request.method === "GET")
		return json(response, 200, Object.keys(dataCollections));
	if (pathname.startsWith("/api/data/") && request.method === "GET") {
		return json(
			response,
			200,
			await readCollection(
				decodeURIComponent(pathname.slice("/api/data/".length)),
			),
		);
	}
	if (pathname.startsWith("/api/data/") && request.method === "PUT") {
		const name = decodeURIComponent(pathname.slice("/api/data/".length));
		const body = await readBody(request);
		await writeCollection(name, body.items);
		return json(response, 200, { deployment: await triggerDeploy() });
	}
	if (pathname === "/api/settings" && request.method === "GET")
		return json(response, 200, await readSettings());
	if (pathname === "/api/settings" && request.method === "PUT") {
		await writeSettings(await readBody(request));
		return json(response, 200, { deployment: await triggerDeploy() });
	}
	return json(response, 404, { error: "未找到。" });
}

const server = createServer(async (request, response) => {
	try {
		const url = new URL(
			request.url || "/",
			`http://${request.headers.host || "localhost"}`,
		);
		if (url.pathname === "/assets/js/marked.min.js")
			return text(
				response,
				200,
				await readFile(resolve(root, "public/assets/js/marked.min.js"), "utf8"),
				"application/javascript; charset=utf-8",
			);
		if (
			url.pathname.startsWith("/assets/images/") ||
			url.pathname.startsWith("/assets/anime/") ||
			url.pathname.startsWith("/assets/music/")
		) {
			const asset = resolve(root, `public${url.pathname}`);
			const allowed = [
				resolve(root, "public/assets/images"),
				resolve(root, "public/assets/anime"),
				resolve(root, "public/assets/music"),
			];
			if (
				!allowed.some(
					(directory) =>
						asset.startsWith(`${directory}\\`) ||
						asset.startsWith(`${directory}/`),
				)
			)
				return text(response, 403, "Forbidden.");
			const extension = extname(asset).toLowerCase();
			const type =
				extension === ".webp"
					? "image/webp"
					: extension === ".jpg" || extension === ".jpeg"
						? "image/jpeg"
						: extension === ".png"
							? "image/png"
							: extension === ".gif"
								? "image/gif"
								: extension === ".mp3"
									? "audio/mpeg"
									: "application/octet-stream";
			response.writeHead(200, {
				"Content-Type": type,
				"Cache-Control": "no-store",
			});
			return response.end(await readFile(asset));
		}
		if (url.pathname.startsWith("/api/"))
			return await handleApi(request, response, url.pathname);
		if (request.method !== "GET" && request.method !== "HEAD")
			return text(response, 405, "Method not allowed.");
		const file =
			url.pathname === "/"
				? join(publicDir, "index.html")
				: resolve(publicDir, `.${url.pathname}`);
		if (!file.startsWith(publicDir)) return text(response, 403, "Forbidden.");
		return text(
			response,
			200,
			await readFile(file, "utf8"),
			file.endsWith(".html")
				? "text/html; charset=utf-8"
				: "text/plain; charset=utf-8",
		);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unexpected server error.";
		json(response, message.includes("ENOENT") ? 404 : 400, { error: message });
	}
});

server.listen(port, host, () =>
	console.log(`Mizuki 管理后台运行于 http://${host}:${port}`),
);
