/* ===== 内联脚本块 #16 ===== */

      (function() {
        /* ---- 文章编辑器右面板：整理字段并插入分组标题 ---- */
        var panel = document.querySelector("#post-form > .panel:nth-of-type(2)");
        if (panel) {
          var fieldsList = panel.querySelectorAll(":scope > .fields");
          var firstFields = fieldsList[0];
          var placement = fieldsList[2];
          if (firstFields && placement) {
            while (placement.firstChild) firstFields.appendChild(placement.firstChild);
            placement.remove();
          }
          var groupTitle = function(text) {
            var h = document.createElement("div");
            h.className = "side-group-title";
            h.textContent = text;
            return h;
          };
          var renumbered = panel.querySelectorAll(":scope > .fields");
          if (renumbered[0]) panel.insertBefore(groupTitle("发布信息"), renumbered[0]);
          var coverField = panel.querySelector(":scope > .cover-field");
          if (coverField) panel.insertBefore(groupTitle("封面"), coverField);
          var statusFields = panel.querySelectorAll(":scope > .fields")[1];
          if (statusFields) panel.insertBefore(groupTitle("状态"), statusFields);
        }
        /* ---- 站点设置：标记功能开关面板为双列网格 ---- */
        var settingsForm = document.getElementById("settings-form");
        if (settingsForm) {
          settingsForm.querySelectorAll(":scope > .panel").forEach(function(p) {
            if (p.querySelector('input[name="bannerEnabled"]')) p.classList.add("settings-toggles");
          });
        }
      })();
      

/* ===== 内联脚本块 #17 ===== */

      (function() {
        var dataEl = document.getElementById("data");
        if (!dataEl) return;
        var detail = dataEl.querySelector(".data-detail");
        var dataList = document.getElementById("data-list");
        if (!detail || !dataList) return;
        var cmdbar = dataEl.querySelector(".data-commandbar");
        /* 返回列表按钮 */
        var backBtn = document.createElement("button");
        backBtn.type = "button";
        backBtn.className = "secondary data-back-btn";
        backBtn.textContent = "← 返回列表";
        backBtn.addEventListener("click", function() {
          detail.classList.remove("detail-open");
        });
        if (cmdbar) cmdbar.insertBefore(backBtn, cmdbar.firstChild);
        /* 详情底部保存按钮：委托给原 #save-data（其 handler 含保存+部署+回列表） */
        var actions = document.querySelector("#data-form .actions");
        if (actions) {
          var saveBtn = document.createElement("button");
          saveBtn.type = "button";
          saveBtn.className = "primary data-save-btn";
          saveBtn.textContent = "保存集合";
          saveBtn.addEventListener("click", function() {
            var original = document.getElementById("save-data");
            if (original) original.click();
          });
          actions.insertBefore(saveBtn, actions.firstChild);
        }
        /* 视图切换钩子：渲染列表 → 回列表视图；渲染字段 → 进详情视图 */
        var baseRenderDataList = window.renderDataList;
        if (typeof baseRenderDataList === "function") {
          window.renderDataList = function() {
            var result = baseRenderDataList.apply(this, arguments);
            /* 此刻是单条记录：列表渲染时直接渲染字段，需保持详情视图 */
            var isNow = typeof activeCollection !== "undefined" && activeCollection === "now";
            if (isNow) detail.classList.add("detail-open");
            else detail.classList.remove("detail-open");
            return result;
          };
        }
        var baseRenderDataFields = window.renderDataFields;
        if (typeof baseRenderDataFields === "function") {
          window.renderDataFields = function(item) {
            var result = baseRenderDataFields.apply(this, arguments);
            detail.classList.add("detail-open");
            return result;
          };
        }
      })();
      

/* ===== 内联脚本块 #18 ===== */

      (function() {
        var baseRenderFields = window.renderDataFields;
        if (typeof baseRenderFields === "function") {
          window.renderDataFields = function(item) {
            var result = baseRenderFields.apply(this, arguments);
            if (typeof activeCollection !== "undefined" && activeCollection === "now") {
              var updated = document.querySelector('#data-fields [name="updated"]');
              if (updated) {
                updated.readOnly = true;
                updated.value = new Date().toISOString().slice(0, 10);
                var label = updated.closest("label");
                if (label && !label.querySelector(".field-hint")) {
                  var hint = document.createElement("span");
                  hint.className = "field-hint";
                  hint.textContent = "保存时自动更新为当天日期";
                  label.appendChild(hint);
                }
              }
            }
            return result;
          };
        }
        var baseCollectForm = window.collectDataForm;
        if (typeof baseCollectForm === "function") {
          window.collectDataForm = function() {
            var result = baseCollectForm.apply(this, arguments);
            if (result && typeof activeCollection !== "undefined" && activeCollection === "now" && result.updated !== undefined) {
              result.updated = new Date().toISOString().slice(0, 10);
            }
            return result;
          };
        }
      })();
      

/* ===== 内联脚本块 #19 ===== */

      (function() {
        /* 给某个开关 label 重建为 input + span.ck-track 结构（保留 input 的 name/checked，点击轨道触发 change） */
        function buildSwitch(label) {
          if (!label || label.querySelector(".ck-track")) return;
          var input = label.querySelector('input[type="checkbox"]');
          if (!input) return;
          label.classList.add("switch-field");
          /* 把文本节点包进 span.ck-label，保证 flex 顺序确定：文字在左、开关在右 */
          Array.from(label.childNodes).forEach(function(n) {
            if (n.nodeType === 3 && n.textContent.trim()) {
              var span = document.createElement("span");
              span.className = "ck-label";
              span.textContent = n.textContent;
              label.insertBefore(span, n);
              label.removeChild(n);
            }
          });
          label.appendChild(input);
          var track = document.createElement("span");
          track.className = "ck-track";
          label.appendChild(track);
          /* 轨道可点，toggle checkbox 并同步状态 */
          track.addEventListener("click", function(e) {
            e.preventDefault();
            input.checked = !input.checked;
            input.dispatchEvent(new Event("change", { bubbles: true }));
          });
        }
        function initSwitches() {
          document.querySelectorAll('#data-fields label.check:has(input[name="featured"]), #post-form label.check:has(input[name="draft"]), #post-form label.check:has(input[name="featured"]), #settings-form label.check').forEach(buildSwitch);
        }
        /* 数据中心每次重渲染字段后重建开关 */
        var baseRender = window.renderDataFields;
        if (typeof baseRender === "function") {
          window.renderDataFields = function(item) {
            var result = baseRender.apply(this, arguments);
            initSwitches();
            return result;
          };
        }
        /* 文章编辑器与设置页 */
        document.addEventListener("DOMContentLoaded", initSwitches);
        /* 音乐时长：只读 + 提示（基础渲染已是 readOnly，双保险） */
        var baseCollect = window.collectDataForm;
        if (typeof baseCollect === "function") {
          window.collectDataForm = function() {
            var result = baseCollect.apply(this, arguments);
            if (result && typeof activeCollection !== "undefined" && activeCollection === "music") {
              var dur = document.querySelector('#data-fields [name="duration"]');
              if (dur) dur.readOnly = true;
            }
            return result;
          };
        }
        initSwitches();
      })();
      
