import { config } from "../config.mjs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { parseFrontmatter } from "../utils.mjs";

// Inlined listPosts to avoid circular dependency with posts.mjs
async function listPostsForLibrary() {
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

export async function readCategoryLibrary() {
	const saved = await readFile(config.categoryLibraryPath, "utf8")
		.then(JSON.parse)
		.catch(() => []);
	const posts = await listPostsForLibrary();
	const { readCollection } = await import("./collections.mjs");
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

export async function addToCategoryLibrary(categories) {
	const existing = await readCategoryLibrary();
	const next = [
		...new Set(
			[...existing, ...(Array.isArray(categories) ? categories : [categories])]
				.map((category) => String(category || "").trim())
				.filter(Boolean),
		),
	].sort((a, b) => a.localeCompare(b));
	await writeFile(
		config.categoryLibraryPath,
		`${JSON.stringify(next, null, 2)}\n`,
		"utf8",
	);
	return next;
}

export async function readTagLibrary() {
	const saved = await readFile(config.tagLibraryPath, "utf8")
		.then(JSON.parse)
		.catch(() => []);
	const posts = await listPostsForLibrary();
	const postTags = posts.flatMap((post) =>
		Array.isArray(post.tags) ? post.tags : [],
	);
	const { readCollection } = await import("./collections.mjs");
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

export async function addToTagLibrary(tags) {
	const existing = await readTagLibrary();
	const next = [
		...new Set(
			[...existing, ...(Array.isArray(tags) ? tags : [])]
				.map((tag) => String(tag).trim())
				.filter(Boolean),
		),
	].sort((a, b) => a.localeCompare(b));
	await writeFile(config.tagLibraryPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
	return next;
}

export async function readArtistLibrary() {
	const saved = await readFile(config.artistLibraryPath, "utf8")
		.then(JSON.parse)
		.catch(() => []);
	const { readCollection } = await import("./collections.mjs");
	const music = (await readCollection("music")).items;
	return [
		...new Set(
			[...saved, ...music.map((track) => track.artist)]
				.map((artist) => String(artist || "").trim())
				.filter(Boolean),
		),
	].sort((a, b) => a.localeCompare(b));
}

export async function addToArtistLibrary(artists) {
	const existing = await readArtistLibrary();
	const next = [
		...new Set(
			[...existing, ...(Array.isArray(artists) ? artists : [artists])]
				.map((artist) => String(artist || "").trim())
				.filter(Boolean),
		),
	].sort((a, b) => a.localeCompare(b));
	await writeFile(
		config.artistLibraryPath,
		`${JSON.stringify(next, null, 2)}\n`,
		"utf8",
	);
	return next;
}

export async function getCategoryOptions() {
	const posts = await listPostsForLibrary();
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

export async function getTechStack() {
	const { readCollection } = await import("./collections.mjs");
	const projects = (await readCollection("projects")).items;
	const skills = (await readCollection("skills")).items;
	const timeline = (await readCollection("timeline")).items;
	const values = [
		...projects.flatMap((project) =>
			Array.isArray(project.techStack) ? project.techStack : [],
		),
		...skills.map((skill) => skill.name),
		...timeline.flatMap((item) =>
			Array.isArray(item.skills) ? item.skills : [],
		),
	];
	return [
		...new Set(values.map((value) => String(value).trim()).filter(Boolean)),
	].sort((a, b) => a.localeCompare(b));
}

export async function getDataTaxonomies() {
	const { readCollection } = await import("./collections.mjs");
	const [projects, skills, timeline, artists, techStack] = await Promise.all([
		readCollection("projects"), readCollection("skills"), readCollection("timeline"),
		readArtistLibrary(), getTechStack(),
	]);
	const unique = (values) => [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))]
		.sort((a, b) => a.localeCompare(b));
	return {
		projectCategories: unique(["web", "mobile", "desktop", "other", ...projects.items.map((item) => item.category)]),
		projectStatuses: unique(["planned", "in-progress", "completed", ...projects.items.map((item) => item.status)]),
		projectTags: unique(projects.items.flatMap((item) => Array.isArray(item.tags) ? item.tags : [])),
		projectOptions: projects.items
			.map((item) => ({ id: String(item.id || "").trim(), title: String(item.title || item.id || "").trim() }))
			.filter((item) => item.id)
			.sort((a, b) => a.title.localeCompare(b.title)),
		skillCategories: unique(["frontend", "backend", "database", "tools", "other", ...skills.items.map((item) => item.category)]),
		timelineTypes: unique(["education", "work", "project", "achievement", ...timeline.items.map((item) => item.type)]),
		techStack,
		artists,
	};
}
