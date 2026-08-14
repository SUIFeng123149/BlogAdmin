const featuredLimit = 6;

/** 文章精选状态切换（列表开关 / 精选管理页共用），input 可为空 */
async function setPostFeatured(slug, featured, input) {
	const featuredCountValue = posts.filter((post) => post.featured).length;
	if (featured && featuredCountValue >= featuredLimit) {
		if (input) input.checked = false;
		showToast("最多 6 篇精选文章", "请先取消一篇已精选文章。", "error");
		return;
	}
	try {
		const post = await api(`/api/posts/${encodeURIComponent(slug)}`);
		await api(`/api/posts/${encodeURIComponent(slug)}`, {
			method: "PUT",
			body: JSON.stringify({ ...post, featured }),
		});
		showToast(featured ? "已加入首页精选" : "已取消首页精选", post.title);
		await loadPosts();
		refreshFeaturedUI();
	} catch (error) {
		if (input) input.checked = !featured;
		showToast("精选状态未更新", error.message || "请稍后重试。", "error");
	}
}

/* ===== 精选管理页（仅收录精选文章，可快捷调整） ===== */
function featuredPosts() {
	return posts.filter((post) => post.featured);
}
function featuredCandidates(keyword) {
	return posts.filter(
		(post) =>
			!post.featured &&
			(!keyword ||
				`${post.title}${post.category}${post.published}`
					.toLowerCase()
					.includes(keyword)),
	);
}

function renderFeaturedPage() {
	const list = $("#featured-list");
	const count = $("#featured-count");
	const items = featuredPosts();
	count.textContent = `${items.length} / ${featuredLimit}`;
	if (!items.length) {
		list.innerHTML =
			'<div class="empty-state">暂无精选文章。点击「＋ 添加精选」从候选中选择，或在文章列表勾选「精选」。</div>';
	} else {
		list.innerHTML = items
			.map(
				(post) =>
					`<div class="post-row"><span><strong>${escapeHtml(post.title)}</strong><br><span class="muted">${escapeHtml(post.category || "未分类")} · ${escapeHtml(post.published || "")}</span></span><span class="post-meta">${post.draft ? "草稿 · " : ""}精选</span><button class="secondary" type="button" data-unfeature="${encodeURIComponent(post.slug)}">取消精选</button></div>`,
			)
			.join("");
		list.querySelectorAll("[data-unfeature]").forEach(
			(button) =>
				(button.onclick = () =>
					setPostFeatured(decodeURIComponent(button.dataset.unfeature), false, null)),
		);
	}
	const addToggle = $("#featured-add-toggle");
	const canAdd = items.length < featuredLimit;
	addToggle.disabled = !canAdd;
	renderFeaturedCandidates();
	// 无精选时默认展开候选区，方便快速添加
	if (
		items.length === 0 &&
		$("#featured-candidates-panel").classList.contains("hidden")
	)
		$("#featured-candidates-panel").classList.remove("hidden");
}

function renderFeaturedCandidates() {
	const box = $("#featured-candidates");
	const keyword = String($("#featured-search")?.value || "").trim().toLowerCase();
	const candidates = featuredCandidates(keyword).slice(0, 20);
	if (!candidates.length) {
		box.innerHTML = '<p class="muted">没有可添加的候选文章。</p>';
		return;
	}
	box.innerHTML = candidates
		.map(
			(post) =>
				`<button type="button" class="secondary" data-feature="${encodeURIComponent(post.slug)}">+ ${escapeHtml(post.title)}</button>`,
		)
		.join("");
	box.querySelectorAll("[data-feature]").forEach(
		(button) =>
			(button.onclick = () =>
				setPostFeatured(decodeURIComponent(button.dataset.feature), true, null)),
	);
}

$("#featured-add-toggle").onclick = () => {
	const panel = $("#featured-candidates-panel");
	panel.classList.toggle("hidden");
	if (!panel.classList.contains("hidden")) renderFeaturedCandidates();
};
$("#featured-search").oninput = renderFeaturedCandidates;

/* ===== 编辑页：勾选「首页精选」时的快捷入口 ===== */
function refreshFeaturedEditorHint() {
	const box = document.querySelector('#post-form .check input[name="featured"]');
	const hint = $("#featured-editor-hint");
	if (!box || !hint) return;
	if (!box.checked) {
		hint.style.display = "none";
		return;
	}
	const items = featuredPosts();
	const mine = currentSlug && items.some((post) => post.slug === currentSlug);
	const others = items.filter((post) => post.slug !== currentSlug);
	hint.style.display = "block";
	hint.innerHTML =
		`首页精选 ${items.length}/${featuredLimit}${mine ? "（含本篇）" : ""}` +
		(others.length
			? `：${others.map((post) => escapeHtml(post.title)).join("、")}`
			: "（暂无其他精选）") +
		' <button type="button" class="secondary" id="featured-manage-btn">管理精选文章</button>';
	hint.querySelector("#featured-manage-btn").onclick = () => show("featured");
}

// 编辑页精选复选框下注入提示区
const featuredCheckbox = document.querySelector(
	'#post-form .check input[name="featured"]',
);
const featuredEditorHint = document.createElement("div");
featuredEditorHint.id = "featured-editor-hint";
featuredEditorHint.className = "field-hint";
featuredEditorHint.style.display = "none";
featuredCheckbox?.closest("label")?.after(featuredEditorHint);
featuredCheckbox?.addEventListener("change", refreshFeaturedEditorHint);

/** 刷新精选相关 UI（精选管理页 + 编辑页提示） */
function refreshFeaturedUI() {
	renderFeaturedPage();
	refreshFeaturedEditorHint();
}
