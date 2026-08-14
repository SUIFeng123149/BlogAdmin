      (function() {
        var SCHEMAS = {
          projects: [
            { title:"基本信息", fields:["id","title","description","category","status","startDate","endDate"] },
            { title:"封面与链接", fields:["image","liveDemo","sourceCode","visitUrl"] },
            { title:"技术栈与标签", fields:["techStack","tags"] },
            { title:"展示", fields:["featured"] }
          ],
          skills: [
            { title:"基本信息", fields:["id","name","category","level","experience","description"] },
            { title:"视觉标识", fields:["icon","color"] },
            { title:"关联", fields:["projects","certifications"] }
          ],
          timeline: [
            { title:"基本信息", fields:["id","title","type","startDate","endDate","description"] },
            { title:"组织与地点", fields:["organization","position","location"] },
            { title:"详细内容", fields:["skills","achievements","links"] },
            { title:"视觉与展示", fields:["icon","color","featured"] }
          ],
          music: [
            { title:"基本信息", fields:["id","title","artist"] },
            { title:"音频与封面", fields:["cover","url","duration"] }
          ],
          now: [
            { title:"状态", fields:["updated","availability"] },
            { title:"正在做什么", fields:["focus","learning","building"] }
          ],
          diary: [
            { title:"内容", fields:["content"] },
            { title:"信息与图片", fields:["date","hidden","images"] }
          ]
        };
        var LABELS = {
          projects: { id:"ID", title:"标题", description:"描述", image:"封面图片", category:"分类", techStack:"技术栈", status:"状态", liveDemo:"在线演示", sourceCode:"源码仓库", visitUrl:"访问链接", startDate:"开始日期", endDate:"结束日期", featured:"首页精选", tags:"标签" },
          skills: { id:"ID", name:"名称", description:"描述", icon:"图标", category:"分类", level:"熟练度", experience:"经验", projects:"关联项目", certifications:"证书", color:"主题色" },
          timeline: { id:"ID", title:"标题", description:"描述", type:"类型", startDate:"开始日期", endDate:"结束日期", location:"地点", organization:"组织", position:"职位", skills:"相关技能", achievements:"成就", links:"链接", icon:"图标", color:"主题色", featured:"首页精选" },
          music: { id:"ID", title:"标题", artist:"艺术家", cover:"封面", url:"音频文件", duration:"时长" },
          now: { updated:"更新时间", focus:"专注", learning:"学习中", building:"正在构建", availability:"可用状态" },
          diary: { content:"日记内容", date:"日期时间", hidden:"隐藏", images:"图片" }
        };
        var WIDE_KEYS = { description:1, content:1, achievements:1, links:1, experience:1, featured:1 };
        var baseRenderDataFields = window.renderDataFields;
        if (typeof baseRenderDataFields === "function") {
          window.renderDataFields = function(item) {
            var result = baseRenderDataFields(item);
            regroupDataFields();
            return result;
          };
        }
        function wrapControl(el, key, labels) {
          var label = document.createElement("label");
          label.dataset.key = key;
          var caption = document.createElement("span");
          caption.textContent = labels[key] || key;
          label.append(caption, el);
          return label;
        }
        function regroupDataFields() {
          var root = document.getElementById("data-fields");
          if (!root) return;
          var collection = typeof activeCollection !== "undefined" ? activeCollection : "";
          var schema = SCHEMAS[collection];
          var labels = LABELS[collection] || {};
          var children = Array.from(root.children);
          var byKey = new Map();
          children.forEach(function(el) {
            var key = el.dataset ? el.dataset.key : null;
            if (!key) {
              if (el.name) key = el.name;
              else if (el.querySelector) {
                var named = el.querySelector(":scope > [name]");
                if (named) key = named.name;
              }
            }
            if (key && !byKey.has(key)) byKey.set(key, el);
          });
          if (!schema) return;
          root.innerHTML = "";
          root.dataset.grouped = "true";
          var placed = new Set();
          schema.forEach(function(group) {
            var header = document.createElement("h4");
            header.className = "data-group-title";
            header.textContent = group.title;
            root.append(header);
            var grid = document.createElement("div");
            grid.className = "data-group-fields";
            group.fields.forEach(function(key) {
              var el = byKey.get(key);
              if (!el) return;
              placed.add(el);
              var labelEl = el.tagName === "LABEL" ? el : wrapControl(el, key, labels);
              var labelText = labels[key];
              if (labelText) {
                var first = labelEl.firstChild;
                if (first && first.nodeType === 3) {
                  first.textContent = labelText;
                } else {
                  var cap = labelEl.querySelector(":scope > span:first-child");
                  if (cap && cap.className.indexOf("field-hint") === -1 && cap.className.indexOf("sr-only") === -1) cap.textContent = labelText;
                }
                if (labelEl.classList && labelEl.classList.contains("check")) {
                  Array.from(labelEl.childNodes).forEach(function(n) { if (n.nodeType === 3) n.textContent = labelText; });
                }
              }
              if (WIDE_KEYS[key]) labelEl.classList.add("data-wide");
              grid.append(labelEl);
            });
            if (grid.childElementCount) root.append(grid);
          });
          var remaining = children.filter(function(el) { return !placed.has(el); });
          if (remaining.length) {
            var tail = document.createElement("div");
            tail.className = "data-group-tail";
            remaining.forEach(function(el) { tail.append(el); });
            root.append(tail);
          }
        }
      })();
      
