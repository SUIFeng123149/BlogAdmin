// 精选管理子页面回归测试：从编辑页进入、携带当前编辑文章、无侧边栏入口与候选区
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("featured management is an editor sub-page, not a sidebar entry", async () => {
	const page = await readFile(
		new URL("../public/index.html", import.meta.url),
		"utf8",
	);
	// 独立视图存在
	assert.match(page, /id="featured"/);
	// 但侧边栏没有独立入口
	assert.doesNotMatch(page, /data-view="featured"/);
	// 无候选添加区（添加精选走编辑页勾选）
	assert.doesNotMatch(page, /featured-candidates|featured-add-toggle|featured-search/);
});

test("featured sub-page carries the current edited article", async () => {
	const page = await readFile(
		new URL("../public/index.html", import.meta.url),
		"utf8",
	);
	assert.match(page, /id="featured-current-title"/);
	assert.match(page, /id="featured-current-status"/);
	assert.match(page, /id="featured-current-actions"/);
	assert.match(page, /id="featured-back"/); // 返回编辑
});

test("featured module renders around the current article without candidates", async () => {
	const module = await readFile(
		new URL("../public/js/07-featured.js", import.meta.url),
		"utf8",
	);
	assert.match(module, /function renderFeaturedPage\(\)/);
	assert.match(module, /function currentEditedPost\(\)/);
	assert.match(module, /将本文设为精选/);
	assert.match(module, /（当前编辑）/);
	assert.match(module, /#featured-back.*show\("editor"\)/);
	// 已移除候选逻辑
	assert.doesNotMatch(module, /renderFeaturedCandidates|featuredCandidates|featured-search/);
});

test("show wrapper refreshes featured UI on view switch", async () => {
	const wrapper = await readFile(
		new URL("../public/js/11-show-wrapper.js", import.meta.url),
		"utf8",
	);
	assert.match(wrapper, /view==="featured"\) renderFeaturedPage\(\)/);
	assert.match(wrapper, /view==="editor"\) refreshFeaturedEditorHint\(\)/);
});
