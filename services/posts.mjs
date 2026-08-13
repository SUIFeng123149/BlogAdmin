import { config } from "../config.mjs";
import {
	cleanSlug,
	fileForSlug,
	assetDirectoryForSlug,
	safeAssetName,
	parseFrontmatter,
} from "../utils.mjs";
import { assertPathInside, decodeImageDataUrl } from "../lib/storage.mjs";
import sharp from "sharp";
import { currentDate, isVerificationStale, serializePost } from "../lib/posts.mjs";
import { addToTagLibrary, addToCategoryLibrary } from "./library.mjs";
import { triggerDeploy } from "./deploy.mjs";
import {
	mkdir,
	readdir,
	readFile,
	rename,
	unlink,
	writeFile,
} from "node:fs/promises";
import { basename, extname, join } from "node:path";

export async function listPosts() {
	const entries = await readdir(config.postsDir, { withFileTypes: true });
	const posts = await Promise.all(
		entries
			.filter(
				(entry) =>
					entry.isFile() && extname(entry.name).toLowerCase() === ".md",
			)
			.map(async (entry) => {
				const slug = basename(entry.name, ".md");
				const { frontmatter } = parseFrontmatter(
					await readFile(join(config.postsDir, entry.name), "utf8"),
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

export async function savePostAsset(slug, body) {
	const match = String(body.data || "").match(
		/^data:([^;]+);base64,([\s\S]+)$/,
	);
	if (!match) throw new Error("上传数据无效。");
		const { mime, bytes } = decodeImageDataUrl(body.data, [
		"image/webp",
		"image/png",
		"image/jpeg",
		"image/gif",
		"image/tiff",
		"image/avif",
		"video/mp4",
		"video/webm",
	]);
	if (bytes.length > 30 * 1024 * 1024)
		throw new Error("图片过大，请上传小于 30 MB 的文件。");
	const kind = body.kind === "video" ? "video" : "image";
	let extension;
	let output = bytes;
	if (kind === "image") {
		const imageFormats = new Set([
			"image/webp",
			"image/png",
			"image/jpeg",
			"image/gif",
			"image/tiff",
			"image/avif",
		]);
		if (!imageFormats.has(mime))
			throw new Error("图片格式不支持，请上传 PNG、JPEG、GIF、WebP、TIFF 或 AVIF。");
		if (mime !== "image/webp") {
			try {
				output = await sharp(bytes).webp({ quality: 80 }).toBuffer();
			} catch {
				throw new Error("图片文件无效或已损坏。");
			}
		}
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
	await writeFile(target, output);
	const relative = `./${cleanSlug(slug)}.assets/${filename}`;
	return {
		path: relative,
		markdown:
			kind === "image"
				? `![${String(body.alt || "image").replace(/[[\]]/g, "")}](${relative})`
				: `<video controls src="${relative}"></video>`,
	};
}

export async function readPost(slug) {
	const { frontmatter, body } = parseFrontmatter(
		await readFile(fileForSlug(slug), "utf8"),
	);
	return { slug, ...frontmatter, body };
}

export async function createPost(body) {
	const slug = cleanSlug(body.slug || body.title);
	const file = fileForSlug(slug);
	try {
		await readFile(file);
		throw new Error("此文件名已存在。");
	} catch (error) {
		if (error.message === "此文件名已存在。") throw error;
	}
	const post = {
		...body,
		published: currentDate(),
		lastVerified: body.status === "verified" ? currentDate() : "",
	};
	await writeFile(file, serializePost(post), "utf8");
	await addToTagLibrary(body.tags);
	await addToCategoryLibrary(body.category);
	await addToCategoryLibrary(body.category);
	return { slug, deployment: await triggerDeploy() };
}

export async function updatePost(currentSlug, body) {
	const nextSlug = cleanSlug(body.slug || currentSlug);
	const currentFile = fileForSlug(currentSlug);
	const nextFile = fileForSlug(nextSlug);
	const { frontmatter: previous } = parseFrontmatter(
		await readFile(currentFile, "utf8"),
	);
	const post = {
		...body,
		published: previous.published || currentDate(),
		lastVerified:
			body.status === "verified"
				? body.lastVerified || currentDate()
				: previous.lastVerified || "",
	};
	if (currentFile !== nextFile) await rename(currentFile, nextFile);
	await writeFile(nextFile, serializePost(post), "utf8");
	await addToTagLibrary(body.tags);
	await addToCategoryLibrary(body.category);
	await addToCategoryLibrary(body.category);
	return { slug: nextSlug, deployment: await triggerDeploy() };
}

export async function markStalePosts() {
	const entries = await readdir(config.postsDir, { withFileTypes: true });
	let changed = 0;
	for (const entry of entries) {
		if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".md") continue;
		const file = join(config.postsDir, entry.name);
		const source = await readFile(file, "utf8");
		const { frontmatter, body } = parseFrontmatter(source);
		if (frontmatter.status !== "verified" || !isVerificationStale(frontmatter.lastVerified))
			continue;
		await writeFile(file, serializePost({ ...frontmatter, status: "outdated", body }), "utf8");
		changed += 1;
	}
	return { changed, deployment: changed ? await triggerDeploy() : null };
}

// 列出“待验证”（可能已过时）的文章：outdated 状态，或 verified 但超过复核期限
export async function listStalePosts() {
	const entries = await readdir(config.postsDir, { withFileTypes: true });
	const posts = await Promise.all(
		entries
			.filter(
				(entry) =>
					entry.isFile() && extname(entry.name).toLowerCase() === ".md",
			)
			.map(async (entry) => {
				const slug = basename(entry.name, ".md");
				const { frontmatter } = parseFrontmatter(
					await readFile(join(config.postsDir, entry.name), "utf8"),
				);
				const rawStatus = frontmatter.status || "";
				const effectiveStatus =
					rawStatus === "verified" &&
					(!frontmatter.lastVerified ||
						isVerificationStale(frontmatter.lastVerified))
						? "outdated"
						: rawStatus;
				return {
					slug,
					title: frontmatter.title || slug,
					category: frontmatter.category || "",
					published: frontmatter.published || "",
					status: rawStatus,
					effectiveStatus,
					lastVerified: frontmatter.lastVerified || "",
					stale: effectiveStatus === "outdated",
				};
			}),
	);
	return posts
		.filter((post) => post.stale || post.status === "outdated")
		.sort((a, b) => String(b.lastVerified).localeCompare(String(a.lastVerified)));
}

// 批量重新验证：设为 verified 并将复核时间刷新为今天
export async function reverifyPosts(slugs) {
	let changed = 0;
	for (const slug of Array.isArray(slugs) ? slugs : []) {
		const file = fileForSlug(slug);
		let source;
		try {
			source = await readFile(file, "utf8");
		} catch {
			continue;
		}
		const { frontmatter, body } = parseFrontmatter(source);
		await writeFile(
			file,
			serializePost({
				...frontmatter,
				status: "verified",
				lastVerified: currentDate(),
				body,
			}),
			"utf8",
		);
		changed += 1;
	}
	return { changed, deployment: changed ? await triggerDeploy() : null };
}

export async function deletePost(slug) {
	await unlink(fileForSlug(slug));
	return { deployment: await triggerDeploy() };
}
