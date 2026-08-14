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
      
