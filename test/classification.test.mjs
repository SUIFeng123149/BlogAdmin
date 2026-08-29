import assert from "node:assert/strict";
import test from "node:test";
import {
	classifyArticle,
	addCategoryToSection,
	EXISTING_THRESHOLD,
	NEW_CATEGORY_THRESHOLD,
} from "../services/classification.mjs";

// 与 src/data/sections.ts 同构的测试用分区配置
const sections = [
	{
		slug: "technical",
		title: "技术资料",
		categories: ["JavaSE", "MySQL", "Spring", "SpringSecurity"],
	},
	{
		slug: "notes",
		title: "个人随笔",
		categories: ["随笔", "生活", "思考"],
	},
	{
		slug: "games",
		title: "游戏记录",
		categories: ["原神", "崩坏：星穹铁道", "明日方舟"],
	},
	{ slug: "other", title: "其他内容", categories: [] },
];

test("title matching an existing second-level category selects section and category", () => {
	const result = classifyArticle(sections, {
		title: "MySQL索引优化指南",
		tags: [],
		body: "",
	});
	assert.equal(result.sectionSlug, "technical");
	assert.equal(result.category, "MySQL");
	assert.equal(result.match, "existing");
	assert.ok(result.evidence >= EXISTING_THRESHOLD);
});

test("tag exact match drives classification without title evidence", () => {
	const result = classifyArticle(sections, {
		title: "随便一篇",
		tags: ["MySQL"],
		body: "",
	});
	assert.equal(result.sectionSlug, "technical");
	assert.equal(result.category, "MySQL");
	assert.equal(result.match, "existing");
});

test("unknown strong keyword in title creates a new second-level category", () => {
	const result = classifyArticle(sections, {
		title: "Docker Compose 部署实践",
		tags: [],
		body: "",
	});
	assert.equal(result.sectionSlug, "technical");
	assert.equal(result.category, "Docker");
	assert.equal(result.match, "new");
});

test("quoted game title creates a new games category", () => {
	const result = classifyArticle(sections, {
		title: "《鸣潮》开荒记录",
		tags: [],
		body: "",
	});
	assert.equal(result.sectionSlug, "games");
	assert.equal(result.category, "鸣潮");
	assert.equal(result.match, "new");
});

test("weak evidence returns other without creating categories", () => {
	const result = classifyArticle(sections, {
		title: "今天天气不错",
		tags: [],
		body: "出去走了走，买了杯奶茶。",
	});
	assert.equal(result.sectionSlug, "other");
	assert.equal(result.category, "");
	assert.equal(result.match, "none");
});

test("explicit unknown category is created under the matched section", () => {
	const result = classifyArticle(sections, {
		title: "SpringSecurity 笔记",
		tags: [],
		body: "",
		category: "JWT",
	});
	assert.equal(result.sectionSlug, "technical");
	assert.equal(result.category, "JWT");
	assert.equal(result.match, "new");
});

test("explicit configured category is honored even with weak evidence", () => {
	const result = classifyArticle(sections, {
		title: "随便一篇",
		tags: [],
		body: "",
		category: "MySQL",
	});
	assert.equal(result.sectionSlug, "technical");
	assert.equal(result.category, "MySQL");
	assert.equal(result.match, "existing");
});

test("explicit unknown category without evidence is preserved without creating", () => {
	const result = classifyArticle(sections, {
		title: "随便一篇",
		tags: [],
		body: "",
		category: "合成生物学",
	});
	assert.equal(result.sectionSlug, "other");
	assert.equal(result.category, "合成生物学");
	assert.equal(result.match, "none");
});

test("body evidence alone can match an existing category", () => {
	const result = classifyArticle(sections, {
		title: "实践记录",
		tags: [],
		body: "mysql mysql mysql mysql mysql 索引优化",
	});
	assert.equal(result.sectionSlug, "technical");
	assert.equal(result.category, "MySQL");
	assert.equal(result.match, "existing");
});

test("tag evidence alone can create a new category", () => {
	const result = classifyArticle(sections, {
		title: "一篇记录",
		tags: ["Docker"],
		body: "",
	});
	assert.equal(result.sectionSlug, "technical");
	assert.equal(result.category, "Docker");
	assert.equal(result.match, "new");
	assert.ok(result.evidence >= NEW_CATEGORY_THRESHOLD);
});

test("candidate that exists under another section is matched as existing", () => {
	const result = classifyArticle(sections, {
		title: "《原神》深境螺旋记录",
		tags: [],
		body: "",
	});
	assert.equal(result.sectionSlug, "games");
	assert.equal(result.category, "原神");
	assert.equal(result.match, "existing");
});

test("addCategoryToSection appends a new category and preserves other sections", () => {
	const next = addCategoryToSection(sections, "technical", "Docker");
	assert.equal(next[0].categories.includes("Docker"), true);
	assert.equal(next[0].categories.length, sections[0].categories.length + 1);
	assert.deepEqual(next[2], sections[2]); // 未修改的分区内容保持不变
	// 幂等：重复添加不产生重复项
	const again = addCategoryToSection(next, "technical", "Docker");
	assert.equal(again[0].categories.filter((c) => c === "Docker").length, 1);
});
