/* ===== 内联脚本块 #23 ===== */

(function () {
  const SECTION_ICONS = { technical: "💻", notes: "✍️", games: "🎮", other: "📁" };
  let sectionsData = [];
  let activeSection = 0;
  let dirty = false;

  const tabsEl = $("#sections-tabs");
  const listEl = $("#sections-cat-list");
  const saveBtn = $("#section-save");
  const titleEl = $("#sections-title");
  const addBtn = $("#section-add-category");

  function setDirty(v) { dirty = v; saveBtn.disabled = !v; }

  async function loadSections() {
    try {
      const r = await api("/api/data/sections");
      sectionsData = Array.isArray(r.items) ? r.items : [];
      if (activeSection >= sectionsData.length) activeSection = 0;
      renderTabs();
      renderList();
      setDirty(false);
    } catch (err) {
      showToast("加载分区失败", err.message, "error");
    }
  }

  function renderTabs() {
    tabsEl.innerHTML = sectionsData.map((sec, idx) =>
      `<button data-idx="${idx}" class="${idx === activeSection ? "active" : ""}"><span class="sections-tab-icon">${SECTION_ICONS[sec.slug] || "📁"}</span><span>${escapeHtml(sec.title || sec.slug)}</span><span class="sections-tab-count">${(sec.categories || []).length}</span></button>`
    ).join("");
  }

  function renderList() {
    const sec = sectionsData[activeSection];
    if (!sec) return;
    titleEl.textContent = sec.title || sec.slug;
    const cats = sec.categories || [];
    listEl.innerHTML = cats.length === 0
      ? `<div class="empty-state">该分区还没有分类，点击「新增分类」添加。新增分类即使暂无文章也会显示在站点卡片上。</div>`
      : cats.map((cat, idx) =>
          `<div class="section-cat-row" data-idx="${idx}">
             <span class="section-cat-grip" draggable="true" title="拖拽排序">⠿</span>
             <input class="section-cat-name" value="${escapeHtml(cat)}" data-idx="${idx}" title="分类名称">
             <button class="icon-button section-cat-up" data-idx="${idx}" type="button" title="上移" ${idx === 0 ? "disabled" : ""}>↑</button>
             <button class="icon-button section-cat-down" data-idx="${idx}" type="button" title="下移" ${idx === cats.length - 1 ? "disabled" : ""}>↓</button>
             <button class="icon-button section-cat-del" data-idx="${idx}" type="button" title="删除">×</button>
           </div>`
        ).join("");
  }

  tabsEl.onclick = (e) => {
    const btn = e.target.closest("[data-idx]");
    if (!btn) return;
    if (dirty && !confirm("当前分区有未保存的修改，切换将丢失。确定继续？")) return;
    activeSection = Number(btn.dataset.idx);
    renderTabs();
    renderList();
  };

  listEl.onclick = (e) => {
    const btn = e.target.closest(".section-cat-up, .section-cat-down, .section-cat-del");
    if (!btn) return;
    const row = btn.closest(".section-cat-row");
    if (!row) return;
    const idx = Number(row.dataset.idx);
    const cats = sectionsData[activeSection].categories || (sectionsData[activeSection].categories = []);
    if (btn.classList.contains("section-cat-up") && idx > 0) {
      [cats[idx - 1], cats[idx]] = [cats[idx], cats[idx - 1]];
      renderList(); setDirty(true);
    } else if (btn.classList.contains("section-cat-down") && idx < cats.length - 1) {
      [cats[idx + 1], cats[idx]] = [cats[idx], cats[idx + 1]];
      renderList(); setDirty(true);
    } else if (btn.classList.contains("section-cat-del")) {
      const name = cats[idx];
      if (confirm(`删除分类「${name}」？文章仍保留该分类字段，只是不再显示在分区卡片上。`)) {
        cats.splice(idx, 1);
        renderList(); setDirty(true);
      }
    }
  };

  // 拖拽排序（从 ⠿ 手柄拖动）
  let dragFrom = null;
  listEl.addEventListener("dragstart", (e) => {
    if (!e.target.closest(".section-cat-grip")) return;
    const row = e.target.closest(".section-cat-row");
    if (!row) return;
    dragFrom = Number(row.dataset.idx);
    row.classList.add("dragging");
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  });
  listEl.addEventListener("dragover", (e) => {
    if (dragFrom === null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    const row = e.target.closest(".section-cat-row");
    listEl.querySelectorAll(".section-cat-row.drag-over").forEach((n) => n.classList.remove("drag-over"));
    if (row) row.classList.add("drag-over");
  });
  listEl.addEventListener("drop", (e) => {
    e.preventDefault();
    listEl.querySelectorAll(".section-cat-row.drag-over").forEach((n) => n.classList.remove("drag-over"));
    if (dragFrom === null) return;
    const row = e.target.closest(".section-cat-row");
    if (!row) return;
    const to = Number(row.dataset.idx);
    const cats = sectionsData[activeSection].categories || [];
    if (dragFrom !== to) {
      const [moved] = cats.splice(dragFrom, 1);
      cats.splice(to, 0, moved);
      setDirty(true);
    }
    dragFrom = null;
    renderList();
  });
  listEl.addEventListener("dragend", () => {
    dragFrom = null;
    listEl.querySelectorAll(".section-cat-row.dragging, .section-cat-row.drag-over").forEach((n) => n.classList.remove("dragging", "drag-over"));
  });
  listEl.oninput = (e) => {
    if (!e.target.classList.contains("section-cat-name")) return;
    const idx = Number(e.target.dataset.idx);
    const val = e.target.value.trim();
    if (!val) return;
    sectionsData[activeSection].categories[idx] = val;
    setDirty(true);
  };

  addBtn.onclick = () => {
    const sec = sectionsData[activeSection];
    if (!sec) return;
    if (!sec.categories) sec.categories = [];
    sec.categories.push("新分类");
    renderList();
    const inputs = listEl.querySelectorAll(".section-cat-name");
    const last = inputs[inputs.length - 1];
    if (last) { last.focus(); last.select(); }
    setDirty(true);
  };

  saveBtn.onclick = async () => {
    // 清理空分类与重名
    sectionsData.forEach((sec) => {
      if (!Array.isArray(sec.categories)) sec.categories = [];
      sec.categories = [...new Set(sec.categories.map((c) => String(c).trim()).filter(Boolean))];
    });
    saveBtn.disabled = true;
    const label = saveBtn.textContent;
    saveBtn.textContent = "保存中...";
    try {
      await api("/api/data/sections", { method: "PUT", body: JSON.stringify({ items: sectionsData }) });
      showToast("分区已保存", "已触发站点重新部署。", "success");
      setDirty(false);
      renderList();
    } catch (err) {
      showToast("保存失败", err.message, "error");
      setDirty(true);
    } finally {
      saveBtn.textContent = label;
    }
  };

  document.querySelector('nav button[data-view="sections"]')?.addEventListener("click", () => {
    loadSections();
  });
})();

