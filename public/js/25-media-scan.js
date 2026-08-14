/* ===== 媒体断链扫描工具 ===== */
const mediaScanBtn = $("#media-scan-btn");

function mediaScanRender(data) {
	// 摘要
	const summary = $("#media-scan-summary");
	summary.innerHTML =
		`引用 <strong>${data.references}</strong>` +
		`&nbsp;·&nbsp; OSS 对象 <strong>${data.objects}</strong>` +
		`&nbsp;·&nbsp; 断链 <strong style="color:${data.missing.length ? "var(--danger)" : "#188454"}">${data.missing.length}</strong>` +
		`&nbsp;·&nbsp; 孤儿 <strong>${data.orphans.length}</strong>`;

	// 结果
	const box = $("#media-scan-results");
	box.innerHTML = "";
	const missing = data.missing || [];
	const orphans = data.orphans || [];

	if (!missing.length) {
		box.append(
			Object.assign(document.createElement("div"), {
				className: "convert-result-item",
				innerHTML: "<strong style='color:#188454'>✅ 未发现断链，主站媒体引用完整。</strong>",
			}),
		);
	} else {
		const head = document.createElement("div");
		head.className = "convert-result-item";
		head.innerHTML = `<strong style="color:var(--danger)">⚠️ 断链 ${missing.length} 个（主站引用但 OSS 不存在）</strong>`;
		box.append(head);
		for (const item of missing.slice(0, 50)) {
			const row = document.createElement("div");
			row.className = "convert-result-item";
			row.innerHTML =
				`<span class="failed">✗ ${escapeHtml(item.key)}</span><br>` +
				`<span class="muted" style="font-size:12px">${escapeHtml((item.sources || []).join("；"))}</span>`;
			box.append(row);
		}
		if (missing.length > 50)
			box.append(Object.assign(document.createElement("p"), {
				className: "muted",
				textContent: `… 共 ${missing.length} 个`,
			}));
	}

	if (orphans.length) {
		const head = document.createElement("div");
		head.className = "convert-result-item";
		head.innerHTML = `<strong>🗂 孤儿 ${orphans.length} 个（OSS 存在但主站未引用，可考虑清理）</strong>`;
		box.append(head);
		for (const key of orphans.slice(0, 30)) {
			const row = document.createElement("div");
			row.className = "convert-result-item";
			row.innerHTML = `<span class="muted">○ ${escapeHtml(key)}</span>`;
			box.append(row);
		}
		if (orphans.length > 30)
			box.append(Object.assign(document.createElement("p"), {
				className: "muted",
				textContent: `… 共 ${orphans.length} 个`,
			}));
	}
}

mediaScanBtn.onclick = async () => {
	const button = mediaScanBtn;
	button.disabled = true;
	button.classList.add("is-pending");
	button.textContent = "扫描中...";
	try {
		const data = await api("/api/media-scan", { method: "POST" });
		mediaScanRender(data);
		showToast("扫描完成", `断链 ${data.missing.length} 个，孤儿 ${data.orphans.length} 个。`);
	} catch (error) {
		showToast("扫描失败", error.message || "请稍后重试。", "error");
	} finally {
		button.disabled = false;
		button.classList.remove("is-pending");
		button.textContent = "开始扫描";
	}
};
