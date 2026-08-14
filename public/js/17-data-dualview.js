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
      
