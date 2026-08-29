      (function() {
        var enhanced = new WeakMap();
        /* 包装单个 select */
        function enhanceSelect(sel) {
          if (!sel || sel.dataset.selEnhanced === "1" || sel.closest(".sel-wrap")) return;
          sel.dataset.selEnhanced = "1";
          var wrap = document.createElement("span");
          wrap.className = "sel-wrap";
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "sel-btn";
          var label = document.createElement("span");
          label.className = "sel-btn-label";
          var arrow = document.createElement("span");
          arrow.className = "sel-arrow";
          btn.append(label, arrow);
          sel.before(wrap);
          wrap.append(sel, btn);
          var menu = null;
          var syncLabel = function() {
            var opt = sel.selectedOptions && sel.selectedOptions[0];
            label.textContent = opt ? opt.textContent : (sel.options[0] ? sel.options[0].textContent : "");
          };
          syncLabel();
          var closeMenu = function() {
            if (menu) { menu.remove(); menu = null; btn.classList.remove("open"); }
            document.removeEventListener("mousedown", onDocDown, true);
          };
          var onDocDown = function(e) {
            if (!wrap.contains(e.target)) closeMenu();
          };
          var escapeText = function(value) {
            return String(value).replace(/[&<>"]/g, function(c) {
              return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
            });
          };
          var optionItemHtml = function(opt) {
            return '<div class="sel-opt' + (opt.selected ? " selected" : "") + '" data-value="' + escapeText(opt.value) + '">' + escapeText(opt.textContent) + "</div>";
          };
          var openMenu = function() {
            closeMenu();
            menu = document.createElement("div");
            menu.className = "sel-menu";
            /* 支持 <optgroup>：分组标题渲染为 .sel-group（首页分区按一级分区分组） */
            var html = "";
            Array.prototype.forEach.call(sel.children, function(child) {
              if (child.tagName === "OPTGROUP") {
                html += '<div class="sel-group">' + escapeText(child.label) + "</div>";
                Array.prototype.forEach.call(child.children, function(opt) { html += optionItemHtml(opt); });
              } else if (child.tagName === "OPTION") {
                html += optionItemHtml(child);
              }
            });
            if (!html) html = '<div class="sel-opt" data-value="">—</div>';
            menu.innerHTML = html;
            menu.addEventListener("click", function(e) {
              var item = e.target && e.target.closest ? e.target.closest(".sel-opt") : null;
              if (!item) return;
              e.stopPropagation();
              sel.value = item.dataset.value;
              syncLabel();
              sel.dispatchEvent(new Event("change", { bubbles: true }));
              closeMenu();
            });
            wrap.appendChild(menu);
            btn.classList.add("open");
            document.addEventListener("mousedown", onDocDown, true);
          };
          btn.addEventListener("click", function(e) {
            e.stopPropagation();
            if (menu) closeMenu(); else openMenu();
          });
          /* 外部程序化修改 value 时同步按钮（fill 回填等） */
          sel.addEventListener("change", syncLabel);
        }
        /* 扫描并增强容器内所有原生 select */
        function scan(root) {
          (root || document).querySelectorAll("select").forEach(enhanceSelect);
        }
        /* 初始扫描 */
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", function() { scan(document); });
        } else {
          scan(document);
        }
        /* 数据字段每次重渲染后重新扫描（分类法会把 input 换成 select） */
        var baseRenderFields = window.renderDataFields;
        if (typeof baseRenderFields === "function") {
          window.renderDataFields = function(item) {
            var result = baseRenderFields.apply(this, arguments);
            scan(document.getElementById("data-fields"));
            return result;
          };
        }
        /* 节流轮询：程序化 fill 不触发 change，定时比对 value 同步按钮文字 */
        var cache = new Map();
        setInterval(function() {
          document.querySelectorAll(".sel-wrap select").forEach(function(sel) {
            var btn = sel.nextElementSibling;
            var last = cache.get(sel);
            var cur = sel.value;
            if (last !== cur) {
              cache.set(sel, cur);
              if (btn) {
                var opt = sel.selectedOptions && sel.selectedOptions[0];
                var lbl = btn.querySelector(".sel-btn-label");
                if (lbl) lbl.textContent = opt ? opt.textContent : "";
              }
            }
          });
        }, 400);
      })();
      
