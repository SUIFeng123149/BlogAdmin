      (function() {
        var staleItems = [];
        /* 1. 侧边栏：在“站点设置”后插入“待验证”入口 */
        var settingsNav = document.querySelector('nav button[data-view="settings"]');
        if (settingsNav) {
          var navBtn = document.createElement("button");
          navBtn.type = "button";
          navBtn.dataset.view = "verify";
          navBtn.innerHTML = '<span class="nav-symbol">待</span><span class="nav-label">待验证</span>';
          navBtn.onclick = function() { show("verify"); };
          settingsNav.after(navBtn);
        }
        /* 2. 视图容器 */
        var main = document.querySelector("main");
        if (main && !document.getElementById("verify")) {
          var section = document.createElement("section");
          section.id = "verify";
          section.className = "view";
          section.innerHTML =
            '<div class="panel stack verify-panel">' +
              '<div class="verify-header">' +
                '<div><h2>待验证文章</h2><p class="muted">“已验证”超过 180 天未复核、或标记为“可能已过时”的文章会出现在这里，复核后可一键重新验证。</p></div>' +
                '<div class="verify-tools">' +
                  '<button class="secondary" id="reverify-all" type="button">全部重新验证</button>' +
                '</div>' +
              '</div>' +
              '<div id="verify-list" class="post-list"></div>' +
              '<div class="verify-foot">' +
                '<span id="verify-count" class="verify-count">0 项</span>' +
                '<button class="primary" id="reverify-selected" type="button" disabled>重新验证选中</button>' +
              '</div>' +
            '</div>';
          main.appendChild(section);
        }
        /* 3. 视图切换时刷新 */
        var showBase = window.show;
        var pendingReturnToVerify = false;
        window.show = function(view) {
          /* 从“待验证”进入编辑器：记录来源，保存后返回待验证 */
          if (view === "editor" && document.getElementById("verify").classList.contains("active")) {
            pendingReturnToVerify = true;
          }
          if (view === "posts" && pendingReturnToVerify) {
            pendingReturnToVerify = false;
            view = "verify";
          }
          var result = showBase.apply(this, [view]);
          if (view === "verify") {
            document.getElementById("page-title").textContent = "待验证";
            loadStalePosts();
          }
          return result;
        };
        /* 4. 加载待验证列表 */
        async function loadStalePosts() {
          try {
            var data = await api("/api/posts/stale");
            staleItems = data.items || [];
          } catch (err) {
            showToast("加载失败", err.message, "error");
            staleItems = [];
          }
          renderStaleList();
        }
        function renderStaleList() {
          var list = document.getElementById("verify-list");
          var count = document.getElementById("verify-count");
          if (count) count.textContent = staleItems.length + " 项";
          if (!staleItems.length) {
            list.innerHTML = '<div class="empty-state">没有待验证的文章，全部状态正常。</div>';
            document.getElementById("reverify-selected").disabled = true;
            return;
          }
          list.innerHTML = staleItems.map(function(item) {
            var days = item.lastVerified ? daysSince(item.lastVerified) : null;
            var meta = item.lastVerified
              ? ("最后验证 " + item.lastVerified + (days !== null ? " · " + days + " 天" : ""))
              : (item.status === "outdated" ? "标记为可能已过时" : "无验证时间");
            var badge = item.stale
              ? '<span class="verify-stale-badge">⚠ 可能已过时</span>'
              : '<span class="verify-ok-badge">可能已过时</span>';
            return '<div class="post-row"><div class="verify-row">' +
              '<label class="check verify-check"><input type="checkbox" data-slug="' + escapeHtml(item.slug) + '" aria-label="选择 ' + escapeHtml(item.title) + '"></label>' +
              '<button type="button" data-open-slug="' + encodeURIComponent(item.slug) + '">' +
                '<span><strong>' + escapeHtml(item.title) + '</strong><br><span class="muted">' + escapeHtml(item.category || "未分类") + '</span></span>' +
                '<span class="verify-meta">' + escapeHtml(meta) + '</span>' +
              '</button>' +
              badge +
            '</div></div>';
          }).join("");
          list.querySelectorAll("button[data-open-slug]").forEach(function(btn) {
            btn.onclick = function() { edit(decodeURIComponent(btn.dataset.openSlug)); };
          });
          updateSelectionState();
        }
        function daysSince(dateString) {
          var d = Date.parse(dateString + "T00:00:00Z");
          if (!Number.isFinite(d)) return null;
          var now = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
          return Math.max(0, Math.round((now - d) / 86400000));
        }
        /* 5. 勾选联动 */
        var listEl = document.getElementById("verify-list");
        if (listEl) {
          listEl.addEventListener("change", function(e) {
            if (e.target && e.target.matches('input[data-slug]')) updateSelectionState();
          });
        }
        function selectedSlugs() {
          return Array.from(document.querySelectorAll('#verify-list input[data-slug]:checked')).map(function(c) { return c.dataset.slug; });
        }
        function updateSelectionState() {
          var sel = selectedSlugs();
          document.getElementById("reverify-selected").disabled = sel.length === 0;
        }
        /* 6. 重新验证 */
        function runReverify(slugs) {
          if (!slugs.length) { showToast("未选择文章", "请先勾选要重新验证的文章。", "error"); return; }
          var btn = document.getElementById("reverify-selected");
          if (slugs.length === staleItems.length) btn = document.getElementById("reverify-all");
          runButtonAction(btn, "验证中...", "重新验证完成", function() {
            return api("/api/posts/reverify", { method: "POST", body: JSON.stringify({ slugs: slugs }) });
          }, "已重新验证").then(function(result) {
            showToast("重新验证完成", "已更新 " + result.changed + " 篇文章的复核时间。");
            loadStalePosts();
          }).catch(function(err) {
            showToast("重新验证失败", err.message, "error");
          });
        }
        document.getElementById("reverify-selected").addEventListener("click", function() { runReverify(selectedSlugs()); });
        var allBtn = document.getElementById("reverify-all");
            if (allBtn) allBtn.addEventListener("click", function() { runReverify(staleItems.map(function(i) { return i.slug; })); });
      })();
      
