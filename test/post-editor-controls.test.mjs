import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");

test("article editor derives upload storage keys from the title", () => {
	assert.match(page, /function articleStorageKey\(\)/);
	assert.match(page, /const slug=articleStorageKey\(\)/);
});

test("article editor links notes to its allowed categories", () => {
	assert.match(page, /notes:\s*\["日记", "随笔", "生活", "思考"\]/);
	assert.match(page, /function refreshPostCategoryOptions\(preferred=""\)/);
});

test("article editor hides legacy metadata and styles native selects", () => {
	assert.match(page, /const hiddenPostMetadata=\["series", "seriesOrder", "testedOn"\]/);
	assert.match(page, /select\s*\{[^}]*appearance:\s*none/s);
});

test("article list combines metadata filters with capped featured management", () => {
	assert.match(page, /id="post-category-filter"/);
	assert.match(page, /id="post-tag-filter"/);
	assert.match(page, /id="post-date-filter"/);
	assert.match(page, /id="post-featured-filter"/);
	assert.match(page, /function filteredPosts\(\)/);
	assert.match(page, /data-post-featured/);
	assert.match(page, /\.post-row > button \{/);
	assert.match(page, /const featuredLimit=6/);
	assert.doesNotMatch(page, /id="featured-posts"/);
	assert.doesNotMatch(page, /const featuredNav=/);
});

test("admin manages diary entries as a dedicated data collection", () => {
	assert.match(page, /data-collection="diary"/);
	assert.match(page, /templates\.diary=\{id:"",content:"",date:/);
	assert.match(page, /activeCollection!=="diary"/);
	assert.doesNotMatch(page, /const diaryButton=/);
});

test("diary editor uploads WebP images and previews the public layout", () => {
	assert.match(page, /function uploadDiaryImages\(/);
	assert.match(page, /image\/webp/);
	assert.match(page, /#diary-preview/);
	assert.match(server, /collection === "diary"/);
	assert.match(server, /public\/assets\/diary/);
});

test("image upload controls let editors remove the selected asset", () => {
	assert.match(page, /function deleteArticleCover\(/);
	assert.match(page, /function attachCollectionImageRemoval\(/);
	assert.match(server, /assetMatch && request\.method === "DELETE"/);
	assert.match(server, /function deleteCollectionMedia\(/);
});

test("uploaded public images use root-relative paths and constrained previews", () => {
	assert.match(server, /path: `\/\$\{publicPath\}\/\$\{filename\}`/);
	assert.match(page, /#diary-preview \[data-diary-images\] img \{[^}]*object-fit:cover/s);
});
