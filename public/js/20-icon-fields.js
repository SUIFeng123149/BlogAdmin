      (function() {
        var COMMON_ICONS = ["logos:javascript","logos:typescript-icon","logos:react","logos:vue","logos:angular-icon","logos:nextjs-icon","logos:nuxt-icon","logos:astro-icon","logos:tailwindcss-icon","logos:sass","logos:webpack","logos:vitejs","logos:nodejs-icon","logos:python","logos:java","devicon:csharp","logos:go","logos:rust","logos:c-plusplus","logos:c","logos:kotlin-icon","logos:swift","logos:ruby","logos:php","simple-icons:express","logos:spring-icon","logos:django-icon","logos:mysql-icon","logos:postgresql","logos:redis","logos:mongodb-icon","simple-icons:sqlite","simple-icons:firebase","logos:git-icon","logos:visual-studio-code","logos:webstorm","logos:intellij-idea","logos:pycharm","logos:rider","logos:goland","logos:docker-icon","logos:kubernetes","logos:nginx","logos:apache","simple-icons:nginx","logos:tomcat","logos:aws","logos:linux-tux","logos:postman-icon","logos:figma","logos:adobe-photoshop","logos:graphql","logos:elasticsearch","logos:jest","logos:cypress-icon"];
        var COMMON_COLORS = ["#F7DF1E","#3178C6","#61DAFB","#4FC08D","#DD0031","#616161","#00DC82","#FF5D01","#06B6D4","#CF649A","#8DD6F9","#646CFF","#339933","#3776AB","#ED8B00","#239120","#00ADD8","#CE422B","#00599C","#A8B9CC","#7F52FF","#FA7343","#CC342D","#777BB4","#6DB33F","#092E20","#4479A1","#336791","#DC382D","#47A248","#003B57","#FFCA28","#F05032","#007ACC","#00CDD7","#21D789","#3D7BF7","#2496ED","#326CE5","#009639","#D22128","#00A693","#F8DC75","#FF9900","#FCC624","#FF6C37","#F24E1E","#31A8FF","#E10098","#005571","#C21325","#17202C"];
        var PICKER_SCRIPT = "https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js";
        function ensureIconify() {
          if (document.querySelector('script[src*="iconify-icon"]') || window.customElements.get("iconify-icon")) return;
          var s = document.createElement("script");
          s.src = PICKER_SCRIPT;
          document.head.appendChild(s);
        }
        /* 收集技能集合中出现过的图标/颜色（兜底数据源） */
        function collectValues(key) {
          var set = new Set();
          if (typeof collectionItems !== "undefined" && Array.isArray(collectionItems)) {
            collectionItems.forEach(function(item) {
              if (item && item[key]) set.add(String(item[key]).trim());
            });
          }
          return set;
        }
        /* 打开选择弹窗 */
        function openPicker(opts) {
          var modal = document.createElement("div");
          modal.className = "vc-picker-modal";
          modal.style.display = "grid";
          var card = document.createElement("div");
          card.className = "vc-picker-card";
          var head = document.createElement("div");
          head.className = "vc-picker-head";
          var title = document.createElement("h3");
          title.textContent = opts.title;
          var close = document.createElement("button");
          close.type = "button";
          close.className = "icon-button";
          close.textContent = "×";
          close.title = "关闭";
          head.append(title, close);
          var search = document.createElement("div");
          search.className = "vc-picker-search";
          var sInput = document.createElement("input");
          sInput.type = "text";
          sInput.placeholder = opts.searchPlaceholder || "搜索…";
          search.append("🔍", sInput);
          var grid = document.createElement("div");
          grid.className = opts.gridClass;
          var foot = document.createElement("div");
          foot.className = "vc-picker-foot";
          var cancel = document.createElement("button");
          cancel.type = "button";
          cancel.className = "secondary";
          cancel.textContent = "取消";
          foot.append(cancel);
          card.append(head, search, grid, foot);
          modal.append(card);
          document.body.append(modal);
          var closeModal = function() { modal.remove(); };
          close.onclick = closeModal;
          cancel.onclick = closeModal;
          modal.addEventListener("click", function(e) { if (e.target === modal) closeModal(); });
          /* 渲染网格 */
          function render(filter) {
            grid.innerHTML = "";
            opts.items.forEach(function(item) {
              var el = opts.makeCell(item);
              el.addEventListener("click", function() { opts.onPick(item); closeModal(); });
              if (filter && !opts.matches(item, filter)) el.style.display = "none";
              grid.append(el);
            });
          }
          render("");
          sInput.addEventListener("input", function() { render(sInput.value.trim().toLowerCase()); });
        }
        /* 图标字段 UI */
        function buildIconField(label, field) {
          if (label.querySelector(".vc-field")) return;
          var value = field.value || "";
          var wrapper = document.createElement("div");
          wrapper.className = "vc-field";
          var preview = document.createElement("div");
          preview.className = "vc-preview";
          var iconEl = document.createElement("iconify-icon");
          iconEl.icon = value || "material-symbols:code";
          preview.append(iconEl);
          var info = document.createElement("div");
          info.className = "vc-info";
          var code = document.createElement("div");
          code.className = "vc-code";
          code.textContent = value || "未选择图标";
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "secondary";
          btn.textContent = "选择图标";
          info.append(code, btn);
          wrapper.append(preview, info);
          label.appendChild(wrapper);
          /* 隐藏存储 input */
          field.type = "hidden";
          field.name = "icon";
          btn.onclick = function() {
            var all = Array.from(collectValues("icon")).concat(COMMON_ICONS);
            var items = Array.from(new Set(all.filter(Boolean)));
            openPicker({
              title: "选择图标",
              searchPlaceholder: "搜索图标（如 java、react…）",
              gridClass: "vc-picker-grid",
              items: items,
              makeCell: function(item) {
                var c = document.createElement("div");
                c.className = "vc-icon-cell" + (item === value ? " sel" : "");
                var i = document.createElement("iconify-icon");
                i.icon = item;
                c.append(i);
                c.title = item;
                return c;
              },
              matches: function(item, q) { return item.toLowerCase().includes(q); },
              onPick: function(item) {
                value = item;
                field.value = item;
                iconEl.icon = item;
                code.textContent = item;
                preview.title = item;
              },
            });
          };
        }
        /* 颜色字段 UI */
        function buildColorField(label, field) {
          if (label.querySelector(".vc-field")) return;
          var value = field.value || "";
          var wrapper = document.createElement("div");
          wrapper.className = "vc-field";
          var preview = document.createElement("div");
          preview.className = "vc-color-preview";
          preview.style.background = value || "#cccccc";
          var info = document.createElement("div");
          info.className = "vc-info";
          var code = document.createElement("div");
          code.className = "vc-code";
          code.textContent = value || "未选择颜色";
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "secondary";
          btn.textContent = "选择颜色";
          info.append(code, btn);
          wrapper.append(preview, info);
          label.appendChild(wrapper);
          field.type = "hidden";
          field.name = "color";
          btn.onclick = function() {
            var all = Array.from(collectValues("color")).concat(COMMON_COLORS);
            var items = Array.from(new Set(all.filter(Boolean)));
            openPicker({
              title: "选择主题色",
              searchPlaceholder: "搜索颜色名或值（可选）",
              gridClass: "vc-color-grid",
              items: items,
              makeCell: function(item) {
                var c = document.createElement("div");
                c.className = "vc-color-cell" + (item.toLowerCase() === String(value).toLowerCase() ? " sel" : "");
                c.style.background = item;
                c.title = item;
                return c;
              },
              matches: function(item, q) { return item.toLowerCase().includes(q); },
              onPick: function(item) {
                value = item;
                field.value = item;
                preview.style.background = item;
                code.textContent = item;
              },
            });
          };
        }
        /* 钩住 renderDataFields：技能集合替换 icon/color 字段 */
        var baseRender = window.renderDataFields;
        if (typeof baseRender === "function") {
          window.renderDataFields = function(item) {
            var result = baseRender.apply(this, arguments);
            if (typeof activeCollection !== "undefined" && activeCollection === "skills") {
              ensureIconify();
              var iconField = document.querySelector('#data-fields label[data-key="icon"] input[name="icon"]');
              var colorField = document.querySelector('#data-fields label[data-key="color"] input[name="color"]');
              var iconLabel = document.querySelector('#data-fields label[data-key="icon"]');
              var colorLabel = document.querySelector('#data-fields label[data-key="color"]');
              if (iconLabel && iconField) buildIconField(iconLabel, iconField);
              if (colorLabel && colorField) buildColorField(colorLabel, colorField);
            }
            return result;
          };
        }
        ensureIconify();
      })();
      
