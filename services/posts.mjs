import { config } from "../config.mjs";
import {
	cleanSlug,
	fileForSlug,
	assetDirectoryForSlug,
	safeAssetName,
	parseFrontmatter,
} from "../utils.mjs";
import { assertPathInside, decodeImageDataUrl } from "../lib/storage.mjs";
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
			body.status === "verified" && previous.status !== "verified"
				? currentDate()
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

export async function deletePost(slug) {
	await unlink(fileForSlug(slug));
	return { deployment: await triggerDeploy() };
}
