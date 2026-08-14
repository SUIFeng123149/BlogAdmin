// 精选管理页回归测试：独立视图存在、模块提供核心渲染/校验逻辑
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("admin provides a lightweight featured-management view", async () => {
	const page = await readFile(
		new URL("../public/index.html", import.meta.url),
		"utf8",
	);
	assert.match(page, /data-view="featured"/); // 导航入口
	assert.match(page, /id="featured"/); // 独立视图
	assert.match(page, /id="featured-count"/);
	assert.match(page, /id="featured-list"/);
	assert.match(page, /id="featured-candidates"/); // 候选添加区
});

test("featured module renders the management page and editor hint", async () => {
	const module = await readFile(
		new URL("../public/js/07-featured.js", import.meta.url),
		"utf8",
	);
	assert.match(module, /function renderFeaturedPage\(\)/);
	assert.match(module, /function renderFeaturedCandidates\(\)/);
	assert.match(module, /function refreshFeaturedEditorHint\(\)/);
	assert.match(module, /管理精选文章/);
});

test("show wrapper refreshes featured UI on view switch", async () => {
	const wrapper = await readFile(
		new URL("../public/js/11-show-wrapper.js", import.meta.url),
		"utf8",
	);
	assert.match(wrapper, /view==="featured"\) renderFeaturedPage\(\)/);
	assert.match(wrapper, /view==="editor"\) refreshFeaturedEditorHint\(\)/);
});
