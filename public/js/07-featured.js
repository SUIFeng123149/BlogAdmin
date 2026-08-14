const featuredLimit = 6;

/** 文章精选状态切换（列表开关 / 精选管理子页面共用），input 可为空 */
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

/* ===== 精选管理子页面（编辑页进入，围绕当前编辑文章调整） ===== */
function featuredPosts() {
	return posts.filter((post) => post.featured);
}

function currentEditedPost() {
	return posts.find((post) => post.slug === currentSlug) || null;
}

function renderFeaturedPage() {
	const current = currentEditedPost();
	const items = featuredPosts();
	const count = $("#featured-count");
	count.textContent = `${items.length} / ${featuredLimit}`;

	// 当前编辑文章信息与快捷操作
	const title = $("#featured-current-title");
	const status = $("#featured-current-status");
	const actions = $("#featured-current-actions");
	if (title && status && actions) {
		if (current) {
			title.textContent = current.title;
			const isFeat = current.featured;
			status.textContent = isFeat ? "（已精选）" : "（未精选）";
			status.style.color = isFeat ? "var(--accent)" : "var(--muted)";
			actions.innerHTML = "";
			if (!isFeat) {
				const btn = document.createElement("button");
				btn.type = "button";
				btn.className = "primary";
				btn.textContent = "将本文设为精选";
				btn.disabled = items.length >= featuredLimit;
				btn.onclick = () => setPostFeatured(current.slug, true, null);
				actions.append(btn);
				if (items.length >= featuredLimit) {
					const hint = document.createElement("span");
					hint.className = "field-hint";
					hint.textContent = "已满 6 篇，请先取消一篇精选。";
					actions.append(hint);
				}
			} else {
				const note = document.createElement("span");
				note.className = "field-hint";
				note.textContent = "本文已在首页精选列表中，可在下方取消。";
				actions.append(note);
			}
		} else {
			title.textContent = "未在编辑状态";
			status.textContent = "";
			actions.innerHTML = "";
		}
	}

	// 精选列表（当前文章高亮）
	const list = $("#featured-list");
	if (!items.length) {
		list.innerHTML =
			'<div class="empty-state">暂无精选文章。在编辑页勾选「首页精选」保存后即可加入。</div>';
		return;
	}
	list.innerHTML = items
		.map((post) => {
			const isCurrent = post.slug === currentSlug;
			return `<div class="post-row ${isCurrent ? "is-selected" : ""}"><span style="flex:1;min-width:0"><strong>${escapeHtml(post.title)}${isCurrent ? ' <span class="muted">（当前编辑）</span>' : ""}</strong><br><span class="muted">${escapeHtml(post.category || "未分类")} · ${escapeHtml(post.published || "")}</span></span><span class="post-meta">${post.draft ? "草稿 · " : ""}精选</span><button class="primary" type="button" style="flex:0 0 auto;width:auto;min-width:0;padding:7px 12px;justify-content:center;background:var(--accent);color:#fff;border:1px solid transparent;border-radius:5px;font-weight:650" data-unfeature="${encodeURIComponent(post.slug)}">取消精选</button></div>`;
		})
		.join("");
	list.querySelectorAll("[data-unfeature]").forEach(
		(button) =>
			(button.onclick = () =>
				setPostFeatured(decodeURIComponent(button.dataset.unfeature), false, null)),
	);
}

$("#featured-back").onclick = () => show("editor");

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

/** 刷新精选相关 UI（精选管理子页面 + 编辑页提示） */
function refreshFeaturedUI() {
	renderFeaturedPage();
	refreshFeaturedEditorHint();
}
