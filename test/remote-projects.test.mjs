import assert from "node:assert/strict";
import test from "node:test";
import {
	mapGithubRepo,
	mapGiteeRepo,
	toDate,
	inferCategory,
	detectTechStack,
	detectTags,
	mergeRemoteProjects,
	mergeItem,
} from "../services/remote-projects.mjs";

test("maps a GitHub repo to a project item", () => {
	const project = mapGithubRepo({
		name: "MyRepo",
		full_name: "octocat/MyRepo",
		description: "A demo repo",
		language: "JavaScript",
		homepage: "https://example.com",
		topics: ["demo", "web"],
		html_url: "https://github.com/octocat/MyRepo",
		created_at: "2024-01-15T10:00:00Z",
		archived: false,
	});
	assert.equal(project.id, "MyRepo");
	assert.equal(project.title, "MyRepo");
	assert.equal(project.description, "A demo repo");
	assert.equal(project.category, "web");
	assert.deepEqual(project.techStack, ["JavaScript", "demo", "web"]);
	assert.equal(project.liveDemo, "https://example.com");
	assert.equal(project.sourceCode, "https://github.com/octocat/MyRepo");
	assert.equal(project.visitUrl, "https://github.com/octocat/MyRepo");
	assert.equal(project.startDate, "2024-01-15");
	assert.equal(project.status, "in-progress");
	assert.deepEqual(project.tags, ["demo", "web"]);
});

test("marks archived GitHub repos as completed", () => {
	assert.equal(
		mapGithubRepo({ name: "Old", archived: true }).status,
		"completed",
	);
});

test("maps a Gitee repo to a project item and strips .git suffix", () => {
	const project = mapGiteeRepo({
		name: "多平台数据管线",
		path: "bilibili_data_pipeline",
		full_name: "with-the-wind1/bilibili_data_pipeline",
		description: "bilibili数据处理分析",
		html_url: "https://gitee.com/with-the-wind1/bilibili_data_pipeline.git",
		created_at: "2024-02-01T00:00:00+08:00",
		language: "Python",
		tags: ["data"],
	});
	assert.equal(project.id, "bilibili_data_pipeline");
	assert.equal(project.title, "多平台数据管线");
	assert.equal(project.sourceCode, "https://gitee.com/with-the-wind1/bilibili_data_pipeline");
	assert.equal(project.startDate, "2024-02-01");
	assert.equal(project.category, "web");
	assert.deepEqual(project.tags, ["data", "数据", "分析", "平台"]);
});

test("infers category from homepage and language", () => {
	assert.equal(inferCategory({ homepage: "https://x.dev" }), "web");
	assert.equal(inferCategory({ language: "Kotlin" }), "mobile");
	assert.equal(inferCategory({ language: "C++" }), "desktop");
	assert.equal(inferCategory({ language: "Rust" }), "desktop");
	assert.equal(inferCategory({ language: "Java" }), "web");
	assert.equal(inferCategory({}), "other");
});

test("detectTechStack combines language, topics and description keywords", () => {
	const stack = detectTechStack({
		name: "Flask-API",
		description: "A Flask + Redis backend service",
		language: "Python",
		topics: ["api"],
	});
	assert.deepEqual(stack, ["Python", "api", "Flask", "Redis"]);
});

test("detectTags combines provided tags and description keywords", () => {
	const tags = detectTags({
		name: "MusicPlayer",
		description: "一个开源音乐播放器管理系统",
		topics: ["music", "web"],
	});
	assert.deepEqual(tags, ["music", "web", "音乐", "播放器", "管理系统", "开源"]);
});

test("detectTags reads the Gitee tags field and caps the result", () => {
	const tags = detectTags({
		name: "数据可视化平台",
		description: "",
		tags: ["data", "visual"],
	});
	assert.deepEqual(tags, ["data", "visual", "数据", "可视化", "平台"]);
});

test("inferCategory uses description keywords when language is unknown", () => {
	assert.equal(inferCategory({ name: "无人机监管平台后端" }), "web");
	assert.equal(inferCategory({ name: "iOS 应用", description: "移动端工具" }), "mobile");
	assert.equal(inferCategory({ name: "桌面客户端", description: "Windows 工具" }), "desktop");
	assert.equal(inferCategory({ name: "unknown-tool", description: "" }), "other");
});

test("mapGithubRepo generates tags from topics", () => {
	const project = mapGithubRepo({
		name: "Blog",
		description: "personal blog",
		language: "Astro",
		topics: ["web", "blog"],
	});
	assert.deepEqual(project.tags, ["web", "blog", "Blog"]);
	assert.deepEqual(project.techStack, ["Astro", "web", "blog"]);
});
test("normalizes dates to YYYY-MM-DD", () => {
	assert.equal(toDate("2024-06-01T12:00:00Z"), "2024-06-01");
	assert.equal(toDate("2024-06-01 12:00:00"), "2024-06-01");
	assert.equal(toDate(""), "");
	assert.equal(toDate(undefined), "");
});

test("mergeItem keeps local non-empty fields as overrides", () => {
	const merged = mergeItem(
		{
			id: "repo",
			title: "repo",
			description: "remote desc",
			image: "",
			techStack: ["Go"],
			status: "in-progress",
			featured: false,
			tags: [],
		},
		{
			id: "repo",
			title: "repo",
			description: "local desc",
			image: "/assets/images/custom.webp",
			techStack: ["Go", "Vue"],
			status: "completed",
			featured: true,
			tags: ["hand"],
		},
	);
	assert.equal(merged.description, "local desc");
	assert.equal(merged.image, "/assets/images/custom.webp");
	assert.deepEqual(merged.techStack, ["Go", "Vue"]);
	assert.equal(merged.status, "completed");
	assert.equal(merged.featured, true);
	assert.deepEqual(merged.tags, ["hand"]);
});

test("add-only mode adds new repos and keeps local items untouched", () => {
	const local = [
		{ id: "existing", title: "Existing", status: "completed" },
	];
	const remote = [
		{ id: "existing", title: "Existing", status: "in-progress" },
		{ id: "new-repo", title: "New Repo", status: "in-progress" },
	];
	const result = mergeRemoteProjects(remote, local, "add-only");
	assert.deepEqual(result.added, ["new-repo"]);
	assert.deepEqual(result.unchanged, ["existing"]);
	assert.deepEqual(result.updated, []);
	assert.equal(result.items.length, 2);
	assert.equal(result.items[0].id, "existing");
	assert.equal(result.items[0].status, "completed");
	assert.equal(result.items[1].id, "new-repo");
});

test("update mode merges remote data while keeping local overrides", () => {
	const local = [
		{ id: "repo", title: "Repo", description: "local desc", image: "/x.webp", status: "completed" },
	];
	const remote = [
		{
			id: "repo",
			title: "Repo",
			description: "remote desc",
			image: "",
			status: "in-progress",
			endDate: "2024-05-01",
			tags: ["fresh"],
		},
		{ id: "fresh", title: "Fresh", description: "", image: "", status: "in-progress" },
	];
	const result = mergeRemoteProjects(remote, local, "update");
	assert.deepEqual(result.updated, ["repo"]);
	assert.deepEqual(result.added, ["fresh"]);
	const mergedLocal = result.items.find((item) => item.id === "repo");
	assert.equal(mergedLocal.description, "local desc");
	assert.equal(mergedLocal.image, "/x.webp");
	assert.equal(mergedLocal.status, "completed");
	assert.equal(mergedLocal.endDate, "2024-05-01");
	assert.deepEqual(mergedLocal.tags, ["fresh"]);
	const fresh = result.items.find((item) => item.id === "fresh");
	assert.equal(fresh.title, "Fresh");
});

test("filters selected ids before merging", () => {
	const local = [{ id: "a", title: "A" }];
	const remote = [
		{ id: "a", title: "A" },
		{ id: "b", title: "B" },
	];
	const result = mergeRemoteProjects(remote, local, "add-only", ["b"]);
	assert.deepEqual(result.added, ["b"]);
	assert.equal(result.items.length, 2);
});