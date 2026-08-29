// admin/services/classification.mjs
// 文章自动归类：依据标题 / 标签 / 正文关键词，先匹配「一级分区」，再匹配该分区下
// 已有的「二级分类」（分区管理配置的可选项）；若没有匹配且关键词证据充分，
// 则复用分区管理的集合写入管线（writeCollection("sections")）在对应分区下新建二级分类。
//
// 权重设计（标题 > 标签 > 正文）：
//   - 标题命中关键词         +4（每个关键词最多计 2 次；标题总分上限 16）
//   - 分类名完整出现在标题   +6 附加（最直接的信号）
//   - 标签命中关键词         +3（每个关键词最多计 2 次；标签总分上限 16）
//   - 标签与分类完全同名     +5 附加
//   - 正文命中关键词         +1（每个关键词最多计 4 次；正文总分上限 12）
//   - 一级分区别名：标题 +3 / 标签 +2 / 正文 +0.5（正文别名总分上限 4）
// 决策阈值：
//   - 分类得分 >= 4           视为「归入已有二级分类」
//   - 候选新分类证据 >= 3     且可提取合理名称 → 在匹配的一级分区下「新建二级分类」
//   - 分区总分 < 2            视为主题不明确 → 归入「其他内容」，不新建

import { readCollection, writeCollection } from "./collections.mjs";

export const WEIGHTS = {
	title: 4,
	tag: 3,
	tagExact: 5,
	body: 1,
	titleNameBonus: 6,
	sectionAliasTitle: 3,
	sectionAliasTag: 2,
	sectionAliasBody: 0.5,
};

export const CAPS = {
	title: 16,
	tag: 16,
	body: 12,
	perKeywordTitle: 2,
	perKeywordTag: 2,
	perKeywordBody: 4,
	sectionAliasBodyTotal: 4,
};

export const EXISTING_THRESHOLD = 4;
export const NEW_CATEGORY_THRESHOLD = 3;
export const MIN_SECTION_SCORE = 2;

/** 一级分区别名：用于分区层面的粗匹配 */
export const SECTION_ALIASES = {
	technical: [
		"技术", "开发", "编程", "代码", "教程", "资料", "学习", "后端", "前端",
		"数据库", "服务器", "部署", "框架", "算法", "数据结构", "计算机", "软件",
		"api", "git", "linux", "docker", "云", "ai", "人工智能", "大模型", "智能体",
		"模型", "协议", "性能", "架构", "源码", "实战", "面试", "八股", "网络",
	],
	notes: [
		"随笔", "生活", "日记", "日常", "思考", "感悟", "心情", "杂谈", "复盘",
		"读书", "成长", "手记", "随想", "感想",
	],
	games: [
		"游戏", "攻略", "评测", "通关", "开荒", "抽卡", "深渊", "角色", "副本",
		"装备", "配队", "活动", "手游", "端游", "单机", "steam", "epic", "主机",
		"switch", "ps5", "xbox", "米哈游", "玩家", "上分", "排位", "公测", "内测", "版本",
	],
	other: [],
};

/** 已知二级分类的关键词别名（分类名本身及其驼峰切分自动纳入） */
export const CATEGORY_ALIASES = {
	JavaSE: ["java", "javase", "jdk", "jvm", "面向对象", "泛型", "多线程", "集合框架", "io流", "反射", "注解", "java基础"],
	MySQL: ["mysql", "sql", "数据库", "索引", "事务", "查询优化", "慢查询", "存储引擎", "主从", "锁"],
	Spring: ["spring", "spring框架", "ioc", "aop", "依赖注入", "bean", "容器"],
	SpringBoot: ["springboot", "spring boot", "自动配置", "starter", "内嵌服务器"],
	SpringMVC: ["springmvc", "mvc", "控制器", "请求映射", "拦截器"],
	SpringSecurity: ["springsecurity", "spring security", "security", "认证授权", "jwt", "oauth", "权限"],
	MyBatisPlus: ["mybatis", "mybatisplus", "mybatis-plus", "orm", "持久层", "mapper"],
	Web: ["web", "html", "css", "javascript", "前端", "浏览器", "dom", "http"],
	Interview: ["面试", "面经", "八股", "面试题", "面试题解", "offer"],
	BigData: ["bigdata", "大数据", "hadoop", "spark", "flink", "数据仓库", "数仓", "hive"],
	"AI Agent": ["ai agent", "aiagent", "agent", "智能体", "智能代理"],
	AutoGen: ["autogen", "多智能体框架"],
	Coze: ["coze", "扣子", "智能体平台"],
	DeepSeek: ["deepseek", "深度求索", "ds"],
	Dify: ["dify", "工作流平台"],
	"Fine-tuning": ["fine tuning", "finetune", "fine-tuning", "微调", "微调训练"],
	LangChain: ["langchain", "链式调用"],
	LangGraph: ["langgraph", "图编排"],
	"LLM Introduction": ["llm", "大模型", "大语言模型", "llm入门", "语言模型"],
	MCP: ["mcp", "模型上下文协议", "工具调用协议"],
	"Multi-Agent": ["multi agent", "multiagent", "多智能体", "多代理"],
	OpenAI: ["openai", "chatgpt", "gpt", "o1", "o3", "api调用"],
	"Prompt Engineering": ["prompt", "提示词", "提示工程", "prompt engineering", "prompting"],
	RAG: ["rag", "检索增强", "向量检索", "知识库", "embedding", "向量库"],
	随笔: ["随笔", "随想", "感想", "杂谈", "散文", "随记"],
	生活: ["生活", "日常", "美食", "旅行", "健身", "运动", "家庭", "周末", "下厨"],
	思考: ["思考", "反思", "复盘", "感悟", "认知", "阅读", "读书", "顿悟"],
	"明日方舟终末地": ["终末地", "明日方舟终末地"],
	"崩坏：星穹铁道": ["星穹铁道", "星铁", "崩坏", "开拓者"],
	创世战车: ["创世战车", "战车", "crossout"],
	碧蓝航线: ["碧蓝航线", "舰娘", "指挥官"],
	"极限竞速：地平线": ["极限竞速", "地平线", "forza", "赛车"],
	明日方舟: ["明日方舟", "方舟", "罗德岛", "干员", "源石"],
	原神: ["原神", "提瓦特", "抽卡", "深渊", "角色解析"],
};

/** 不宜作为「新分类名」的通用词（仅用于命名过滤，不影响关键词匹配） */
const NAME_STOPWORDS = new Set([
	"的", "了", "在", "是", "我", "你", "他", "她", "它", "和", "与", "及", "或",
	"一", "个", "我们", "你们", "他们", "这些", "那些", "这个", "那个", "什么",
	"如何", "怎样", "为什么", "怎么", "可以", "需要", "应该", "使用", "学习",
	"分享", "记录", "总结", "笔记", "教程", "文章", "介绍", "实现", "深入",
	"浅析", "分析", "实践", "实战", "体验", "评测", "攻略", "心得", "感想",
	"随笔", "日记", "生活", "日常", "之后", "之前", "今天", "明天", "现在",
	"从", "到", "之", "其", "且", "但", "而", "也", "都", "很", "更", "最",
	"不", "没", "有", "会", "能", "要", "让", "给", "把", "被", "将", "着",
	"过", "呀", "吗", "呢", "吧", "啊", "哈哈", "还有", "以及", "不过", "一下",
	"小", "大", "新", "旧", "好", "坏", "多", "少", "上", "下", "中", "内",
	"外", "前", "后", "做", "写", "说", "讲", "看", "想", "觉", "得", "感",
	"with", "from", "about", "this", "that", "these", "those", "the", "and",
	"for", "how", "what", "why", "use", "using", "note", "notes", "noted",
	"blog", "post", "article", "intro", "introduction", "guide", "tutorial",
	"learn", "study", "day", "week", "month", "year", "new", "best", "top",
	"first", "part", "chapter", "section", "series", "index", "tips", "tip",
	"review", "update", "release", "version", "中文", "本章", "小结", "摘要",
	"前言", "结语", "附录", "参考", "资源",
]);

function camelTokens(value) {
	return String(value || "")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[^A-Za-z0-9\u4e00-\u9fff]+/g, " ")
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean);
}

function prepareSource(value) {
	const normalized = String(value || "").toLowerCase().replace(/\s+/g, " ");
	return {
		normalized,
		noSpace: normalized.replace(/\s+/g, ""),
		tokens: camelTokens(normalized),
	};
}

function cleanBody(body) {
	return String(body || "")
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/!?(?:\[[^\]]*\])?\([^)]*\)/g, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/[#>*_`~|-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/** 关键词在单个数据源中的命中次数（拉丁词按词元/去空白子串，中文按子串） */
function countKeywordHits(normalized, noSpace, tokens, keyword) {
	const keywordLower = String(keyword).toLowerCase();
	const isLatin = /^[a-z0-9 ._-]+$/.test(keywordLower);
	if (isLatin) {
		const bare = keywordLower.replace(/[^a-z0-9]/g, "");
		if (bare.length < 2) return 0;
		let count = 0;
		for (const token of tokens) {
			if (token === bare) count += 1;
		}
		if (count === 0 && bare.length >= 3 && noSpace.includes(bare)) count = 1;
		return count;
	}
	let count = 0;
	let index = 0;
	while ((index = normalized.indexOf(keywordLower, index)) !== -1) {
		count += 1;
		index += keywordLower.length;
	}
	return count;
}

/** 单个数据源（标题/标签/正文）下，一组关键词的加权得分 */
function sourceScore(keywords, source, perKeywordCap, totalCap) {
	let total = 0;
	for (const keyword of keywords) {
		const hits = countKeywordHits(
			source.normalized,
			source.noSpace,
			source.tokens,
			keyword,
		);
		if (!hits) continue;
		total += Math.min(hits, perKeywordCap) * source.weight;
	}
	return Math.min(total, totalCap);
}

export function categoryKeywords(name) {
	const raw = String(name || "").trim();
	const keywords = new Set();
	keywords.add(raw.toLowerCase());
	for (const token of camelTokens(raw)) {
		if (token.length > 1) keywords.add(token);
	}
	for (const alias of CATEGORY_ALIASES[raw] || []) {
		keywords.add(alias.toLowerCase());
		for (const token of camelTokens(alias)) {
			if (token.length > 1) keywords.add(token);
		}
	}
	return [...keywords];
}

function sectionAliasKeywords(section) {
	const keywords = new Set();
	for (const alias of SECTION_ALIASES[section.slug] || []) {
		keywords.add(alias.toLowerCase());
		for (const token of camelTokens(alias)) {
			if (token.length > 1) keywords.add(token);
		}
	}
	const title = String(section.title || "").trim().toLowerCase();
	if (title) keywords.add(title);
	return [...keywords];
}

function scoreCategory(name, sourceList, tags) {
	const keywords = categoryKeywords(name);
	let score = 0;
	for (const item of sourceList)
		score += sourceScore(
			keywords,
			item.source,
			item.perKeywordCap,
			item.cap,
		);
	const nameLower = String(name).trim().toLowerCase();
	const titleSource = sourceList.find((item) => item.key === "title");
	if (nameLower && titleSource && titleSource.source.normalized.includes(nameLower))
		score += WEIGHTS.titleNameBonus;
	if (
		nameLower &&
		tags.some((tag) => String(tag).trim().toLowerCase() === nameLower)
	)
		score += WEIGHTS.tagExact;
	return score;
}

function sectionAliasScore(section, sourceList) {
	const keywords = sectionAliasKeywords(section);
	const weightByKey = {
		title: WEIGHTS.sectionAliasTitle,
		explicit: WEIGHTS.sectionAliasTitle,
		tags: WEIGHTS.sectionAliasTag,
		body: WEIGHTS.sectionAliasBody,
	};
	let total = 0;
	for (const item of sourceList) {
		const isBody = item.key === "body";
		total += sourceScore(
			keywords,
			{ ...item.source, weight: weightByKey[item.key] || 0 },
			2,
			isBody ? CAPS.sectionAliasBodyTotal : 12,
		);
	}
	return total;
}

function sectionCategoryMap(sections) {
	const map = new Map();
	for (const section of sections) {
		for (const category of section.categories || []) {
			const key = String(category).trim().toLowerCase();
			if (key && !map.has(key)) map.set(key, section);
		}
	}
	return map;
}

function findCategorySection(sections, categoryName) {
	const key = String(categoryName || "").trim().toLowerCase();
	if (!key) return null;
	const map = sectionCategoryMap(sections);
	return map.get(key) || null;
}

/** 大小写保留的词元提取（用于命名新分类，如 "Docker"、"SpringBoot" 保持标题原样） */
function caseTokens(value) {
	return (
		String(value || "")
			.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
			.match(/[A-Za-z][A-Za-z0-9]*/g) || []
	);
}

/** 从标题 / 标签中提取「新二级分类」的候选名（书名号优先，其次拉丁 / 驼峰术语） */
function pickCandidateName(title, tags) {
	const quotedPattern = /[《「"“]([^》」"”]{1,16})[》」"”]/g;
	for (const match of title.matchAll(quotedPattern)) {
		const name = match[1].trim();
		if (isSensibleName(name)) return { name, evidence: WEIGHTS.title };
	}
	for (const token of caseTokens(title)) {
		if (token.length < 3) continue;
		if (/[0-9]$/.test(token)) continue;
		if (NAME_STOPWORDS.has(token.toLowerCase())) continue;
		return { name: token, evidence: WEIGHTS.title };
	}
	for (const tag of Array.isArray(tags) ? tags : []) {
		for (const token of caseTokens(tag)) {
			if (token.length < 3) continue;
			if (NAME_STOPWORDS.has(token.toLowerCase())) continue;
			return { name: token, evidence: WEIGHTS.tag };
		}
	}
	return null;
}

function isSensibleName(name) {
	const value = String(name || "").trim();
	if (!value || value.length > 24) return false;
	if (/^\d+$/.test(value)) return false;
	if (NAME_STOPWORDS.has(value.toLowerCase())) return false;
	return /[\u4e00-\u9fffA-Za-z]/.test(value);
}

/**
 * 纯函数：对一篇文章做两级归类。
 * @param {Array<{slug,title,categories}>} items 分区管理配置（src/data/sections.ts 的 contentSections）
 * @param {{title, tags, body, category}} fields 文章字段
 * @returns {{sectionSlug, sectionTitle, category, match: "existing"|"new"|"none", evidence}}
 */
export function classifyArticle(items, fields = {}) {
	const title = String(fields.title || "");
	const tags = Array.isArray(fields.tags)
		? fields.tags.map((tag) => String(tag).trim()).filter(Boolean)
		: String(fields.tags || "")
				.split(",")
				.map((tag) => tag.trim())
				.filter(Boolean);
	const explicit = String(fields.category || "").trim();
	// 显式分类名参与评分（旧文章 / 导入 Markdown 的场景），权重等同标题
	const sourceList = [
		{
			key: "title",
			source: prepareSource(title),
			weight: WEIGHTS.title,
			perKeywordCap: CAPS.perKeywordTitle,
			cap: CAPS.title,
		},
		{
			key: "tags",
			source: prepareSource(tags.join(" ")),
			weight: WEIGHTS.tag,
			perKeywordCap: CAPS.perKeywordTag,
			cap: CAPS.tag,
		},
		{
			key: "body",
			source: prepareSource(cleanBody(fields.body)),
			weight: WEIGHTS.body,
			perKeywordCap: CAPS.perKeywordBody,
			cap: CAPS.body,
		},
	];
	if (explicit)
		sourceList.push({
			key: "explicit",
			source: prepareSource(explicit),
			weight: WEIGHTS.title,
			perKeywordCap: CAPS.perKeywordTitle,
			cap: CAPS.title,
		});

	const sections = (Array.isArray(items) ? items : []).map((section) => {
		const scored = (Array.isArray(section.categories) ? section.categories : [])
			.map((name) => ({ name, score: scoreCategory(name, sourceList, tags) }))
			.sort((a, b) => b.score - a.score);
		const best = scored[0] || null;
		const allScore = scored.reduce((sum, item) => sum + item.score, 0);
		const aliasScore = sectionAliasScore(section, sourceList);
		return {
			slug: section.slug,
			title: section.title || section.slug || "",
			categories: scored,
			score:
				(best ? best.score : 0) +
				0.2 * (allScore - (best ? best.score : 0)) +
				aliasScore,
		};
	});

	const ranked = [...sections].sort((a, b) => b.score - a.score);
	const best = ranked[0] || null;

	// 显式指定的分类（旧文章 / 导入的 Markdown）：已配置则沿用其分区；
	// 未配置则先在匹配分区下新建；证据不足时保留该分类并落入「其他内容」，不新建
	if (explicit) {
		const holder = findCategorySection(sections, explicit);
		if (holder)
			return {
				sectionSlug: holder.slug,
				sectionTitle: holder.title,
				category: explicit,
				match: "existing",
				evidence: best ? best.score : 0,
			};
		const target =
			best && best.score >= MIN_SECTION_SCORE
				? best
				: sections.find((section) => section.slug === "other") || null;
		if (!target)
			return {
				sectionSlug: "other",
				sectionTitle: "其他内容",
				category: explicit,
				match: "new",
				evidence: best ? best.score : 0,
			};
		return {
			sectionSlug: target.slug,
			sectionTitle: target.title,
			category: explicit,
			match: best && best.score >= MIN_SECTION_SCORE ? "new" : "none",
			evidence: best ? best.score : 0,
		};
	}

	if (!best || best.score < MIN_SECTION_SCORE) {
		const other = sections.find((section) => section.slug === "other") || best;
		return {
			sectionSlug: other ? other.slug : "other",
			sectionTitle: other ? other.title : "其他内容",
			category: "",
			match: "none",
			evidence: best ? best.score : 0,
		};
	}

	const topCategory = best.categories[0] || null;
	if (topCategory && topCategory.score >= EXISTING_THRESHOLD)
		return {
			sectionSlug: best.slug,
			sectionTitle: best.title,
			category: topCategory.name,
			match: "existing",
			evidence: topCategory.score,
		};

	const candidate = pickCandidateName(title, tags);
	if (candidate && candidate.evidence >= NEW_CATEGORY_THRESHOLD) {
		const holder = findCategorySection(sections, candidate.name);
		if (holder)
			return {
				sectionSlug: holder.slug,
				sectionTitle: holder.title,
				category: candidate.name,
				match: "existing",
				evidence: candidate.evidence,
			};
		return {
			sectionSlug: best.slug,
			sectionTitle: best.title,
			category: candidate.name,
			match: "new",
			evidence: candidate.evidence,
		};
	}

	return {
		sectionSlug: best.slug,
		sectionTitle: best.title,
		category: "",
		match: "none",
		evidence: best.score,
	};
}

/** 与分区管理「新增分类」同一写入逻辑：向指定一级分区追加一个二级分类 */
export function addCategoryToSection(items, sectionSlug, categoryName) {
	const name = String(categoryName || "").trim();
	if (!name) return items;
	const next = (Array.isArray(items) ? items : []).map((section) => ({
		...section,
		categories: Array.isArray(section.categories)
			? [...section.categories]
			: [],
	}));
	const target = next.find((section) => section.slug === sectionSlug);
	if (target && !target.categories.includes(name)) target.categories.push(name);
	return next;
}

/** 保存文章时的权威归类（读取分区配置；新建分类时写入 src/data/sections.ts） */
export async function autoClassifyPost(body) {
	const { items } = await readCollection("sections");
	const classification = classifyArticle(items, body);
	if (classification.match === "new") {
		const sections = addCategoryToSection(
			items,
			classification.sectionSlug,
			classification.category,
		);
		await writeCollection("sections", sections);
	}
	return {
		post: {
			...body,
			contentSection: classification.sectionSlug,
			category: classification.category,
		},
		classification,
	};
}

/** 编辑器实时预览（只分析，不落盘） */
export async function classifyArticlePreview(body) {
	const { items } = await readCollection("sections");
	return classifyArticle(items, body || {});
}
