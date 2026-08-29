// 首页分区控件：可选项与「分区管理」的二级分类联动（按一级分区 optgroup 分组），
// 选中任意二级菜单即同时确定 contentSection（一级分区 slug）与 category（二级分类）。
// 默认「自动归类」：按标题/标签/正文关键词先匹配一级分区、再匹配已有二级分类，
// 无匹配且有足够证据时将在对应分区下新建二级分类（保存时由后端权威执行）。
(function () {
	const FALLBACK_SECTIONS = [
		{ slug: "technical", title: "技术资料", categories: [] },
		{ slug: "notes", title: "个人随笔", categories: [] },
		{ slug: "games", title: "游戏记录", categories: [] },
		{ slug: "other", title: "其他内容", categories: [] },
	];
	let postSectionItems = FALLBACK_SECTIONS;
	let postSectionLoaded = false;
	let postSectionPending = null; // 配置加载完成前暂存的 [contentSection, category]
	let postSectionHintTimer = null;
	let postSectionHintSeq = 0;

	const placementHost = document.querySelector("#post-form .actions");
	const placementControls = document.createElement("div");
	placementControls.className = "fields";
	placementControls.innerHTML =
		'<label>首页分区<select id="post-section-select"><option value="">自动归类（关键词匹配）</option></select></label>' +
		'<p class="post-section-hint" id="post-section-hint">按标题、标签与正文关键词自动匹配一级分区下的二级分类；没有匹配时将在对应分区下新建二级分类。</p>' +
		'<label class="check"><input name="featured" type="checkbox"> 首页精选</label>';
	// contentSection 以隐藏字段随表单提交（值为一级分区 slug；空 = 自动归类）
	const hiddenSectionField = document.createElement("input");
	hiddenSectionField.type = "hidden";
	hiddenSectionField.name = "contentSection";
	placementControls.append(hiddenSectionField);
	if (placementHost) placementHost.before(placementControls);

	const sectionSelect = document.getElementById("post-section-select");
	const sectionHint = document.getElementById("post-section-hint");
	const postSectionForm = document.querySelector("#post-form");

	function escAttr(value) {
		return String(value).replace(/[&<>"']/g, function (c) {
			return {
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;",
			}[c];
		});
	}
	function escHtml(value) {
		return escAttr(value);
	}
	function selectOptions() {
		return sectionSelect && sectionSelect.options
			? Array.prototype.slice.call(sectionSelect.options)
			: [];
	}
	function categoryField() {
		return document.querySelector('#post-form [name="category"]');
	}

	function renderSectionOptions() {
		const current = sectionSelect ? sectionSelect.value : "";
		const groups = (postSectionItems || []).map(function (section) {
			const cats = Array.isArray(section.categories) ? section.categories : [];
			const title = section.title || section.slug || "";
			const options = cats.length
				? cats
						.map(function (cat) {
							return (
								'<option value="' +
								escAttr(section.slug + "|" + cat) +
								'">' +
								escHtml(cat) +
								"</option>"
							);
						})
						.join("")
				: '<option value="' +
					escAttr(section.slug + "|") +
					'">' +
					escHtml(title) +
					"（未指定分类）</option>";
			return (
				'<optgroup label="' + escAttr(title) + '">' + options + "</optgroup>"
			);
		});
		if (!sectionSelect) return;
		sectionSelect.innerHTML =
			'<option value="">自动归类（关键词匹配）</option>' + groups.join("");
		// 回填 / 重渲染后保留当前选中项（含未配置分区的临时选项）
		if (current) {
			if (!selectOptions().some((option) => option.value === current)) {
				const sep = current.indexOf("|");
				const category = sep === -1 ? "" : current.slice(sep + 1);
				const option = document.createElement("option");
				option.value = current;
				option.textContent = category
					? category + "（未配置分区分类）"
					: "未指定分类";
				sectionSelect.append(option);
			}
			sectionSelect.value = current;
		}
	}

	async function loadSectionOptions() {
		try {
			const result = await api("/api/data/sections");
			const items =
				result && Array.isArray(result.items) ? result.items : [];
			postSectionItems = items.length ? items : FALLBACK_SECTIONS;
		} catch (error) {
			postSectionItems = FALLBACK_SECTIONS;
		}
		postSectionLoaded = true;
		renderSectionOptions();
		if (postSectionPending) {
			const pending = postSectionPending;
			postSectionPending = null;
			syncPostSectionSelect(pending[0], pending[1]);
		}
	}

	/** 把「一级分区|二级分类」的值同步到表单字段（contentSection 隐藏字段 + 分类下拉） */
	function applySectionSelection(value) {
		const sep = value.indexOf("|");
		const slug = sep === -1 ? "" : value.slice(0, sep);
		const category = sep === -1 ? "" : value.slice(sep + 1);
		if (hiddenSectionField) hiddenSectionField.value = slug;
		const catField = categoryField();
		if (catField) {
			const hasOption =
				catField.options &&
				Array.prototype.some.call(catField.options, (option) => option.value === category);
			if (category && !hasOption) {
				const option = document.createElement("option");
				option.value = category;
				option.textContent = category;
				catField.append(option);
			}
			catField.value = category;
		}
		if (typeof refreshPostCategoryOptions === "function")
			refreshPostCategoryOptions(category);
		schedulePostSectionHint();
	}

	function schedulePostSectionHint() {
		clearTimeout(postSectionHintTimer);
		postSectionHintTimer = setTimeout(refreshPostSectionHint, 350);
	}

	async function refreshPostSectionHint() {
		if (!sectionHint) return;
		if (sectionSelect && sectionSelect.value !== "") {
			sectionHint.textContent = "已手动指定一级分区与二级分类，保存时不再自动归类。";
			sectionHint.classList.remove("is-busy");
			return;
		}
		const title = String(
			postSectionForm && postSectionForm.elements.title
				? postSectionForm.elements.title.value
				: "",
		).trim();
		if (title.length < 2) {
			sectionHint.textContent =
				"填写标题后，将根据标题、标签与正文关键词自动匹配一级分区与二级分类。";
			sectionHint.classList.remove("is-busy");
			return;
		}
		const sequence = ++postSectionHintSeq;
		sectionHint.textContent = "正在分析关键词…";
		sectionHint.classList.add("is-busy");
		try {
			const body = {
				title: title,
				tags: String(
					postSectionForm && postSectionForm.elements.tags
						? postSectionForm.elements.tags.value
						: "",
				)
					.split(",")
					.map((item) => item.trim())
					.filter(Boolean),
				body:
					postSectionForm && postSectionForm.elements.body
						? postSectionForm.elements.body.value
						: "",
				category: (categoryField() && categoryField().value) || "",
			};
			const result = await api("/api/posts/classify", {
				method: "POST",
				body: JSON.stringify(body),
			});
			if (sequence !== postSectionHintSeq) return;
			if (sectionSelect && sectionSelect.value !== "") return;
			sectionHint.classList.remove("is-busy");
			const sectionTitle =
				result.sectionTitle || result.sectionSlug || "其他内容";
			if (result.match === "existing") {
				sectionHint.innerHTML =
					"将自动归入 <b>" +
					escHtml(sectionTitle) +
					" › " +
					escHtml(result.category) +
					"</b>（关键词命中已有二级分类）。";
			} else if (result.match === "new") {
				sectionHint.innerHTML =
					"将在 <b>" +
					escHtml(sectionTitle) +
					"</b> 下新建二级分区 <b>" +
					escHtml(result.category) +
					"</b>（保存时自动写入分区管理）。";
			} else {
				sectionHint.innerHTML =
					"未发现足够关键词，将归入 <b>" +
					escHtml(sectionTitle) +
					"</b>，不新建分区。";
			}
		} catch (error) {
			if (sequence !== postSectionHintSeq) return;
			sectionHint.textContent = "自动归类分析暂不可用，保存时仍会尝试归类。";
			sectionHint.classList.remove("is-busy");
		}
	}

	/** 供编辑器（02-editor）在新建/回填/导入后同步选中项 */
	window.syncPostSectionSelect = function (contentSection, category) {
		if (!postSectionLoaded) {
			postSectionPending = [contentSection || "", category || ""];
			return;
		}
		const value =
			!contentSection && !category
				? ""
				: (contentSection || "") + "|" + (category || "");
		if (!selectOptions().some((option) => option.value === value)) {
			const option = document.createElement("option");
			option.value = value;
			option.textContent = category
				? category + "（未配置分区分类）"
				: "未指定分类";
			if (sectionSelect) sectionSelect.append(option);
		}
		if (sectionSelect) sectionSelect.value = value;
		applySectionSelection(value);
	};

	if (sectionSelect) {
		sectionSelect.addEventListener("change", function () {
			applySectionSelection(sectionSelect.value);
		});
	}
	// 标题/正文输入与标签增减时刷新归类建议
	if (postSectionForm && postSectionForm.elements.title) {
		postSectionForm.elements.title.addEventListener("input", schedulePostSectionHint);
	}
	if (postSectionForm && postSectionForm.elements.body) {
		postSectionForm.elements.body.addEventListener("input", schedulePostSectionHint);
	}
	const tagPicker = document.querySelector("#post-tag-picker");
	if (tagPicker) tagPicker.addEventListener("click", schedulePostSectionHint);
	// 分区管理保存后同步刷新编辑器可选项
	if (typeof window.addEventListener === "function")
		window.addEventListener("post-sections-updated", loadSectionOptions);

	// 登录前 #app 处于 hidden，直接请求 /api/data/sections 会 401：
	// 等待登录完成后加载，并在每次进入编辑器视图时刷新（与分区管理最新配置保持一致）
	function loadSectionOptionsWhenReady(attempt) {
		const app = document.getElementById("app");
		if (!app || !app.classList.contains("hidden")) {
			loadSectionOptions();
			return;
		}
		if ((attempt || 0) >= 60) return;
		setTimeout(function () {
			loadSectionOptionsWhenReady((attempt || 0) + 1);
		}, 300);
	}
	const baseShow = window.show;
	if (typeof baseShow === "function") {
		window.show = function (view) {
			const result = baseShow.apply(this, arguments);
			if (view === "editor") loadSectionOptions();
			return result;
		};
	}
	loadSectionOptionsWhenReady();
})();
