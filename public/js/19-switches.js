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
      
