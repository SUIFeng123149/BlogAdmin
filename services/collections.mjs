import { config } from "../config.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
	addToTagLibrary,
	addToCategoryLibrary,
	addToArtistLibrary,
} from "./library.mjs";

const dataCollections = {
	projects: {
		file: resolve(config.root, "src/data/projects.ts"),
		symbol: "projectsData",
		kind: "array",
	},
	skills: {
		file: resolve(config.root, "src/data/skills.ts"),
		symbol: "skillsData",
		kind: "array",
	},
	timeline: {
		file: resolve(config.root, "src/data/timeline.ts"),
		symbol: "timelineData",
		kind: "array",
	},
	anime: {
		file: resolve(config.root, "src/data/anime.ts"),
		symbol: "localAnimeList",
		kind: "array",
	},
	music: {
		file: resolve(config.root, "src/components/widget/MusicPlayer.svelte"),
		symbol: "localPlaylist",
		kind: "array",
	},
	now: {
		file: resolve(config.root, "src/data/now.ts"),
		symbol: "now",
		kind: "object",
	},
	diary: {
		file: resolve(config.root, "src/data/diary.ts"),
		symbol: "diaryEntries",
		kind: "array",
	},
	sections: {
		file: resolve(config.root, "src/data/sections.ts"),
		symbol: "contentSections",
		kind: "array",
	},
};

export { dataCollections };

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

export async function readCollection(name) {
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

export async function writeCollection(name, items) {
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
	const normalizedItems = name === "diary"
		? items.map((item) => ({
			...item,
			date: item.date || new Date().toISOString().slice(0, 16),
		}))
		: items;
	const serialized = JSON.stringify(normalizedItems, null, 2);
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
