import { config } from "../config.mjs";
import { readCollection, writeCollection } from "./collections.mjs";
import { triggerDeploy } from "./deploy.mjs";

const GITHUB_API = "https://api.github.com";
const GITEE_API = "https://gitee.com/api/v5";

const WEB_LANGUAGES = new Set([
	"javascript", "typescript", "html", "css", "vue", "react", "svelte",
	"astro", "next.js", "nuxt", "php", "python", "go", "java", "ruby",
	"elixir", "jsp", "asp.net", "node", "node.js",
]);
const MOBILE_LANGUAGES = new Set(["kotlin", "swift", "objective-c", "flutter", "android", "dart"]);
const DESKTOP_LANGUAGES = new Set(["c", "c++", "cpp", "c#", "csharp", "rust", "electron"]);

// [匹配关键词, 生成的技术栈名称]：扫描仓库名称/描述自动补全技术栈
const TECH_KEYWORDS = [
	["typescript", "TypeScript"],
	["javascript", "JavaScript"],
	["vue", "Vue"],
	["react", "React"],
	["angular", "Angular"],
	["svelte", "Svelte"],
	["astro", "Astro"],
	["next.js", "Next.js"],
	["nuxt", "Nuxt"],
	["tailwind", "Tailwind CSS"],
	["node", "Node.js"],
	["springboot", "Spring Boot"],
	["spring", "Spring"],
	["java", "Java"],
	["python", "Python"],
	["flask", "Flask"],
	["django", "Django"],
	["golang", "Go"],
	["rust", "Rust"],
	["c++", "C++"],
	["c#", "C#"],
	["csharp", "C#"],
	["kotlin", "Kotlin"],
	["swift", "Swift"],
	["flutter", "Flutter"],
	["dart", "Dart"],
	["php", "PHP"],
	["ruby", "Ruby"],
	["mysql", "MySQL"],
	["postgresql", "PostgreSQL"],
	["postgres", "PostgreSQL"],
	["sqlite", "SQLite"],
	["mongodb", "MongoDB"],
	["redis", "Redis"],
	["docker", "Docker"],
	["kubernetes", "Kubernetes"],
	["k8s", "Kubernetes"],
	["opencv", "OpenCV"],
	["tensorflow", "TensorFlow"],
	["pytorch", "PyTorch"],
	["hadoop", "Hadoop"],
	["spark", "Apache Spark"],
	["flink", "Apache Flink"],
	["kafka", "Kafka"],
	["android", "Android"],
	["ios", "iOS"],
	["html", "HTML"],
	["css", "CSS"],
	["electron", "Electron"],
];

// [匹配关键词, 生成的标签]：扫描仓库名称/描述自动生成标签
const TAG_KEYWORDS = [
	["ai", "AI"],
	["agent", "Agent"],
	["智能体", "智能体"],
	["大模型", "大模型"],
	["llm", "LLM"],
	["chatbot", "Chatbot"],
	["机器人", "机器人"],
	["robot", "Robot"],
	["无人机", "无人机"],
	["drone", "Drone"],
	["避障", "避障"],
	["music", "Music"],
	["音乐", "音乐"],
	["播放器", "播放器"],
	["data", "Data"],
	["数据", "数据"],
	["数据分析", "数据分析"],
	["analysis", "Analysis"],
	["分析", "分析"],
	["可视化", "可视化"],
	["visual", "Visual"],
	["platform", "Platform"],
	["平台", "平台"],
	["web", "Web"],
	["网站", "网站"],
	["blog", "Blog"],
	["博客", "博客"],
	["backend", "Backend"],
	["后端", "后端"],
	["frontend", "Frontend"],
	["前端", "前端"],
	["mobile", "Mobile"],
	["移动端", "移动端"],
	["app", "App"],
	["游戏", "游戏"],
	["game", "Game"],
	["安全", "安全"],
	["security", "Security"],
	["cloud", "Cloud"],
	["云", "云"],
	["database", "Database"],
	["数据库", "数据库"],
	["api", "API"],
	["管理系统", "管理系统"],
	["admin", "Admin"],
	["自动化", "自动化"],
	["监控", "监控"],
	["monitor", "Monitor"],
	["导航", "导航"],
	["navigation", "Navigation"],
	["社交", "社交"],
	["电商", "电商"],
	["工具", "工具"],
	["tool", "Tool"],
	["开源", "开源"],
	["open source", "Open Source"],
	["私有", "私有"],
];

// 分类关键词，按优先级依次匹配：mobile > desktop > web
const CATEGORY_KEYWORDS = [
	["mobile", ["android", "ios", "mobile", "flutter", "小程序", "手机", "移动端", "移动"]],
	["desktop", ["desktop", "windows", "macos", "linux", "桌面", "pc", "electron", "客户端"]],
	["web", ["web", "website", "网页", "网站", "前端", "后端", "api", "dashboard", "platform", "平台", "portal", "admin", "后台", "管理系统", "blog", "博客", "saas"]],
];

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textContains(text, keyword) {
	const lower = String(text).toLowerCase();
	// 含非 ASCII（如中文）的关键词直接用子串匹配
	if (/[^\x00-\x7f]/.test(keyword)) return lower.includes(keyword.toLowerCase());
	return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i").test(lower);
}

function repoText(repo) {
	return `${repo.name || ""} ${repo.title || ""} ${repo.description || ""}`;
}

export function getConfiguredPlatforms() {
	return {
		github: Boolean(config.githubUsername),
		gitee: Boolean(config.giteeUsername),
	};
}

export function toDate(value) {
	if (!value) return "";
	const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
	return match ? match[0] : "";
}

export function inferCategory(repo) {
	const language = String(repo.language || "").toLowerCase().trim();
	const text = repoText(repo).toLowerCase();
	if (repo.homepage) return "web";
	if (WEB_LANGUAGES.has(language)) return "web";
	if (MOBILE_LANGUAGES.has(language)) return "mobile";
	if (DESKTOP_LANGUAGES.has(language)) return "desktop";
	for (const [category, keywords] of CATEGORY_KEYWORDS) {
		if (keywords.some((keyword) => text.includes(keyword.toLowerCase()))) return category;
	}
	return "other";
}

export function detectTechStack(repo) {
	const language = String(repo.language || "").trim();
	const topics = Array.isArray(repo.topics)
		? repo.topics.filter((item) => typeof item === "string" && item.trim())
		: [];
	const text = repoText(repo);
	const found = [];
	for (const [keyword, label] of TECH_KEYWORDS) {
		if (textContains(text, keyword)) found.push(label);
	}
	return [...new Set([language, ...topics, ...found].map((item) => String(item).trim()).filter(Boolean))];
}

export function detectTags(repo) {
	const provided = [
		...(Array.isArray(repo.topics) ? repo.topics : []),
		...(Array.isArray(repo.tags) ? repo.tags : []),
	].filter((item) => typeof item === "string" && item.trim());
	const text = repoText(repo);
	const found = [];
	for (const [keyword, label] of TAG_KEYWORDS) {
		if (textContains(text, keyword)) found.push(label);
	}
	return [...new Set([...provided, ...found].map((item) => String(item).trim()).filter(Boolean))].slice(0, 8);
}

export function mapGithubRepo(repo) {
	const url = repo.html_url || `https://github.com/${repo.full_name || repo.name}`;
	return {
		id: String(repo.name || repo.id),
		title: repo.name || String(repo.id),
		description: repo.description || "",
		image: "",
		category: inferCategory(repo),
		techStack: detectTechStack(repo),
		status: repo.archived ? "completed" : "in-progress",
		liveDemo: repo.homepage || "",
		sourceCode: url,
		visitUrl: url,
		startDate: toDate(repo.created_at),
		endDate: "",
		featured: false,
		tags: detectTags(repo),
	};
}

export function mapGiteeRepo(repo) {
	const url = (repo.html_url || `https://gitee.com/${repo.full_name || repo.path || repo.name}`).replace(/\.git$/, "");
	return {
		id: String(repo.path || repo.name || repo.id),
		title: repo.name || repo.path || String(repo.id),
		description: repo.description || "",
		image: "",
		category: inferCategory(repo),
		techStack: detectTechStack(repo),
		status: "in-progress",
		liveDemo: repo.homepage || "",
		sourceCode: url,
		visitUrl: url,
		startDate: toDate(repo.created_at),
		endDate: "",
		featured: false,
		tags: detectTags(repo),
	};
}

async function fetchGitHub() {
	const params = new URLSearchParams({
		per_page: "100",
		sort: "updated",
		type: "owner",
	});
	const headers = {
		"User-Agent": "mizuki-admin",
		Accept: "application/vnd.github+json",
	};
	if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`;
	const response = await fetch(
		`${GITHUB_API}/users/${encodeURIComponent(config.githubUsername)}/repos?${params}`,
		{ headers },
	);
	if (!response.ok)
		throw new Error(`GitHub API 请求失败（HTTP ${response.status}）。`);
	const repos = await response.json();
	return repos.filter((repo) => !repo.fork).map(mapGithubRepo);
}

async function fetchGitee() {
	const params = new URLSearchParams({
		per_page: "100",
		sort: "updated",
		type: "owner",
	});
	if (config.giteeToken) params.set("access_token", config.giteeToken);
	const response = await fetch(
		`${GITEE_API}/users/${encodeURIComponent(config.giteeUsername)}/repos?${params}`,
	);
	if (!response.ok)
		throw new Error(`Gitee API 请求失败（HTTP ${response.status}）。`);
	const repos = await response.json();
	return repos.filter((repo) => !repo.fork).map(mapGiteeRepo);
}

export async function fetchRemoteProjects() {
	const platforms = getConfiguredPlatforms();
	if (!platforms.github && !platforms.gitee)
		throw new Error(
			"未配置远程仓库用户名：请在 .env.admin 中设置 GITHUB_USERNAME 或 GITEE_USERNAME。",
		);
	const jobs = [
		platforms.github ? fetchGitHub() : Promise.resolve([]),
		platforms.gitee ? fetchGitee() : Promise.resolve([]),
	];
	const labels = ["GitHub", "Gitee"];
	const results = await Promise.allSettled(jobs);
	const items = [];
	const errors = [];
	results.forEach((result, index) => {
		if (result.status === "fulfilled") items.push(...result.value);
		else
			errors.push(
				`${labels[index]}：${
					result.reason instanceof Error ? result.reason.message : String(result.reason)
				}`,
			);
	});
	return { items, errors, platforms };
}

export function mergeRemoteProjects(remoteItems, localItems, mode = "add-only", ids) {
	const selected = new Set(ids && ids.length ? ids : remoteItems.map((item) => item.id));
	const selectedRemote = remoteItems.filter((item) => selected.has(item.id));
	const localById = new Map(localItems.map((item) => [item.id, item]));
	const merged = [];
	const added = [];
	const updated = [];
	const unchanged = [];

	if (mode === "update") {
		const remoteById = new Map(selectedRemote.map((item) => [item.id, item]));
		for (const local of localItems) {
			const remote = remoteById.get(local.id);
			if (!remote) {
				merged.push(local);
				continue;
			}
			const next = mergeItem(remote, local);
			merged.push(next);
			if (JSON.stringify(next) === JSON.stringify(local)) unchanged.push(local.id);
			else updated.push(local.id);
		}
		for (const remote of selectedRemote) {
			if (!localById.has(remote.id)) {
				merged.push(remote);
				added.push(remote.id);
			}
		}
	} else {
		const remoteById = new Map(selectedRemote.map((item) => [item.id, item]));
		for (const local of localItems) {
			merged.push(local);
			if (remoteById.has(local.id)) unchanged.push(local.id);
		}
		for (const remote of selectedRemote) {
			if (!localById.has(remote.id)) {
				merged.push(remote);
				added.push(remote.id);
			}
		}
	}

	return { items: merged, added, updated, unchanged, mode };
}

export function mergeItem(remote, local) {
	const next = { ...remote };
	for (const key of Object.keys(remote)) {
		const value = local[key];
		const hasLocal =
			Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== "";
		if (hasLocal) next[key] = value;
	}
	return next;
}

export async function previewRemoteProjects() {
	const { items, errors, platforms } = await fetchRemoteProjects();
	const { items: localItems } = await readCollection("projects");
	return {
		platforms,
		items,
		errors,
		localIds: localItems.map((item) => item.id),
		localCount: localItems.length,
	};
}

export async function syncRemoteProjects({ mode = "add-only", ids } = {}) {
	const remote = await fetchRemoteProjects();
	const { items: localItems } = await readCollection("projects");
	const result = mergeRemoteProjects(remote.items, localItems, mode, ids);
	await writeCollection("projects", result.items);
	const deployment = await triggerDeploy();
	return { ...result, deployment, errors: remote.errors };
}