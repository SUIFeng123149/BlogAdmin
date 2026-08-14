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
      
