// 全站媒体断链扫描服务
// 比对主站代码（src/data、src/content/posts、src/config.ts、src/components）
// 中的媒体引用与 OSS 实际对象，返回断链与孤儿。
import { config } from "../config.mjs";
import { listObjects } from "../lib/oss.mjs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const OSS_BASE_PATTERN = /^https:\/\/[\w.-]+\.aliyuncs\.com/;

function normalize(raw) {
	let s = String(raw).trim();
	s = s.replace(OSS_BASE_PATTERN, "");
	s = s.replace(/^\/+/, "");
	try {
		s = decodeURIComponent(s);
	} catch {
		// 已是原始中文，保留
	}
	return s;
}

async function collectReferences() {
	const refs = new Map(); // key -> Set(sources)
	const add = (raw, source) => {
		const key = normalize(raw);
		if (!key.startsWith("assets/") && !key.startsWith("post-assets/")) return;
		if (!refs.has(key)) refs.set(key, new Set());
		refs.get(key).add(source);
	};

	// 数据文件
	for (const name of await readdir(join(config.root, "src/data"))) {
		if (!name.endsWith(".ts")) continue;
		const src = await readFile(join(config.root, "src/data", name), "utf8");
		const re =
			/["']((?:\/assets|\/post-assets|\.{1,2}\/[\w\u4e00-\u9fff-]+\.assets)\/[^"']+)["']/g;
		for (const m of src.matchAll(re)) add(m[1], `data/${name}`);
	}

	// 文章
	const postsDir = join(config.root, "src/content/posts");
	for (const name of await readdir(postsDir)) {
		if (!name.endsWith(".md")) continue;
		const slug = name.slice(0, -3);
		const src = await readFile(join(postsDir, name), "utf8");
		const im = src.match(/^image:\s*["']?([^"'\n]+)/m);
		if (im) add(im[1].trim(), `post ${slug} [frontmatter]`);
		const re = /((?:src|href)="|!\[[^\]]*\]\()([^"')]+)/g;
		for (const m of src.matchAll(re)) {
			const u = m[2].trim();
			// 相对引用 ./X.assets/ 或 ./X_assets/ → post-assets/X(.|_)assets/
			const rel = u.match(/^\.{1,2}\/([\w\u4e00-\u9fff-]+[._]assets)\/(.+)$/);
			if (rel) {
				add(`post-assets/${rel[1]}/${rel[2]}`, `post ${slug} [正文]`);
			} else if (u.startsWith("/assets/") || u.startsWith("/post-assets/") || OSS_BASE_PATTERN.test(u)) {
				add(u, `post ${slug} [正文]`);
			}
		}
	}

	// 站点配置
	try {
		const cfg = await readFile(join(config.root, "src/config.ts"), "utf8");
		for (const m of cfg.matchAll(/["']((?:\/assets|\/post-assets)\/[^"']+)["']/g))
			add(m[1], "src/config.ts");
	} catch {}

	// 组件（含 .svelte 无前导斜杠相对路径）
	const walk = async (dir) => {
		let entries = [];
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) await walk(full);
			else if (/\.(svelte|astro|ts|js)$/.test(entry.name)) {
				const rel = relative(config.root, full).replace(/\\/g, "/");
				const src = await readFile(full, "utf8");
				for (const m of src.matchAll(/["']((?:\/assets|\/post-assets|\.\.?\/[\w\u4e00-\u9fff-]+\.assets)\/[^"']+)["']/g))
					add(m[1], rel);
				// 无前导斜杠：assets/music/cover/xxx.jpg
				for (const m of src.matchAll(/["']((?<![\w/])assets\/(?:music|anime|diary|images)\/[^"']+)["']/g))
					add(m[1], rel);
			}
		}
	};
	await walk(join(config.root, "src/components"));

	return refs;
}

/** 全站媒体扫描：{ missing: [{key, sources}], orphans: [key] } */
export async function scanMediaReferences() {
	const [refs, assetsKeys, postAssetKeys] = await Promise.all([
		collectReferences(),
		listObjects("assets/"),
		listObjects("post-assets/"),
	]);
	const ossKeys = new Set([...assetsKeys, ...postAssetKeys]);
	const missing = [];
	for (const [key, sources] of refs) {
		if (!ossKeys.has(key)) missing.push({ key, sources: [...sources] });
	}
	const orphans = [...ossKeys].filter((key) => !refs.has(key)).sort();
	return {
		references: refs.size,
		objects: ossKeys.size,
		missing,
		orphans,
	};
}
