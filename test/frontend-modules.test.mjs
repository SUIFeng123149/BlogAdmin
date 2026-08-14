// 前端模块化拆分回归测试
// 验证 public/index.html 已将内联样式/脚本拆分为独立文件：
// 1. 无内联 <style> / <script> 残留
// 2. 引用的 /js/*.js 与 /css/*.css 均存在且非空
// 3. 每个 JS 文件可通过 Node 语法解析（等价于浏览器能加载）
import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const adminDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const publicDir = join(adminDir, "public");

test("index.html has no inline style or script blocks", async () => {
	const html = await readFile(join(publicDir, "index.html"), "utf8");
	const inlineStyles = html.match(/<style(?![^>]*\bsrc=)[^>]*>/g) || [];
	const inlineScripts = html.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || [];
	assert.equal(inlineStyles.length, 0, "存在内联 <style> 块");
	assert.equal(inlineScripts.length, 0, "存在内联 <script> 块");
});

test("references a single stylesheet that exists", async () => {
	const html = await readFile(join(publicDir, "index.html"), "utf8");
	const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)];
	assert.ok(links.length >= 1, "缺少样式表引用");
	for (const [, href] of links) {
		const file = join(publicDir, href.replace(/^\//, ""));
		const info = await stat(file);
		assert.ok(info.size > 0, `样式文件为空: ${href}`);
	}
});

test("all referenced js modules exist and are non-empty", async () => {
	const html = await readFile(join(publicDir, "index.html"), "utf8");
	const srcs = [...html.matchAll(/<script src="(\/js\/[^"]+)"/g)].map((m) => m[1]);
	assert.ok(srcs.length >= 10, `JS 引用过少: ${srcs.length}`);
	for (const src of srcs) {
		const file = join(publicDir, src.replace(/^\//, ""));
		const info = await stat(file);
		assert.ok(info.size > 0, `JS 文件为空: ${src}`);
	}
});

test("every js module passes Node syntax check", async () => {
	const files = (await readdir(join(publicDir, "js"))).filter((f) =>
		f.endsWith(".js"),
	);
	assert.ok(files.length >= 10, `JS 文件数过少: ${files.length}`);
	for (const file of files) {
		const result = spawnSync(process.execPath, ["--check", join(publicDir, "js", file)], {
			encoding: "utf8",
		});
		assert.equal(
			result.status,
			0,
			`语法错误 in ${file}: ${result.stderr || "unknown"}`,
		);
	}
});
