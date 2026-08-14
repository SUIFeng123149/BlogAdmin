import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

// 前端已模块化：内联脚本拆分为 public/js/*.js，样式拆分为 public/css/admin.css。
// 测试读取「全部 JS 模块合并 + CSS」以模拟页面完整加载后的可用代码。

const jsDir = new URL("../public/js/", import.meta.url);
const jsFiles = (await readdir(jsDir)).filter((f) => f.endsWith(".js"));
const scripts = (
	await Promise.all(
		jsFiles.map((f) => readFile(new URL(f, jsDir), "utf8")),
	)
).join("\n");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/css/admin.css", import.meta.url), "utf8");
const mediaSvc = await readFile(new URL("../services/media.mjs", import.meta.url), "utf8");
const routes = await readFile(new URL("../routes/index.mjs", import.meta.url), "utf8");

test("article editor derives upload storage keys from the title", () => {
	assert.match(scripts, /function articleStorageKey\(\)/);
	assert.match(scripts, /const slug=articleStorageKey\(\)/);
});

test("article editor links notes to its allowed categories", () => {
	assert.match(scripts, /notes:\s*\["日记", "随笔", "生活", "思考"\]/);
	assert.match(scripts, /function refreshPostCategoryOptions\(preferred=""\)/);
});

test("article editor hides legacy metadata and styles native selects", () => {
	assert.match(scripts, /const hiddenPostMetadata=\["series", "seriesOrder", "testedOn"\]/);
	assert.match(styles, /select\s*\{[^}]*appearance:\s*none/s);
});

test("article list combines metadata filters with capped featured management", () => {
	assert.match(page, /id="post-category-filter"/);
	assert.match(page, /id="post-tag-filter"/);
	assert.match(page, /id="post-date-filter"/);
	assert.match(page, /id="post-featured-filter"/);
	assert.match(scripts, /function filteredPosts\(\)/);
	assert.match(scripts, /data-post-featured/);
	assert.match(styles, /\.post-row > button \{/);
	assert.match(scripts, /const\s+featuredLimit\s*=\s*6/);
	assert.doesNotMatch(page, /id="featured-posts"/);
	assert.doesNotMatch(scripts, /const featuredNav=/);
});

test("article editor clears stale field and card selection state", () => {
	assert.match(scripts, /function fill\(form, data\) \{ form\.reset\(\);/);
	assert.match(scripts, /function clearPostSelection\(\)/);
	assert.match(scripts, /if\(view!=="editor"\) clearPostSelection\(\);/);
});

test("article list filters by status and timestamps verification", () => {
	assert.match(scripts, /id="post-status-filter"/);
	assert.match(scripts, /verificationStatus\.value==="verified"/);
	assert.match(scripts, /lastVerified/);
});

test("admin manages diary entries as a dedicated data collection", () => {
	assert.match(scripts, /data-collection="diary"/);
	assert.match(scripts, /templates\.diary=\{id:"",content:"",date:/);
	assert.match(scripts, /activeCollection!=="diary"/);
	assert.doesNotMatch(scripts, /const diaryButton=/);
});

test("diary editor uploads WebP images and previews the public layout", () => {
	assert.match(scripts, /function uploadDiaryImages\(/);
	assert.match(scripts, /image\/webp/);
	assert.match(styles, /#diary-preview/);
	assert.match(mediaSvc, /collection === "diary"/);
	assert.match(mediaSvc, /"assets\/diary"/);
});

test("image upload controls let editors remove the selected asset", () => {
	assert.match(scripts, /function deleteArticleCover\(/);
	assert.match(scripts, /function attachCollectionImageRemoval\(/);
	assert.match(routes, /assetMatch && request\.method === "DELETE"/);
	assert.match(mediaSvc, /function deleteCollectionMedia\(/);
});

test("uploaded public images use root-relative paths and constrained previews", () => {
	assert.match(mediaSvc, /path: `\/\$\{publicPath\}\/\$\{filename\}`/);
	assert.match(styles, /#diary-preview \[data-diary-images\] img \{[^}]*object-fit:cover/s);
});
