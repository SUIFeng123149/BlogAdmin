import { resolve } from "node:path";
import { readFile } from "node:fs/promises";

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
const maxBodySize = 80 * 1024 * 1024;

if (!password) {
	console.error("启动管理后台前必须设置 ADMIN_PASSWORD。");
	process.exit(1);
}

export const config = {
	root,
	postsDir,
	configPath,
	publicDir,
	tagLibraryPath,
	categoryLibraryPath,
	artistLibraryPath,
	albumsDir,
	port,
	host,
	password,
	deployHookUrl,
	maxBodySize,
};
