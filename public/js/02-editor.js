    const postForm=document.querySelector("#post-form");
    const hiddenPostMetadata=["series", "seriesOrder", "testedOn"];
    let postCategoriesBySection={ notes: ["日记", "随笔", "生活", "思考"], games: ["游戏记录", "游戏攻略", "游戏评测"], other: ["其他"] };
  async function syncSectionCategoriesFromConfig() { try { const r=await api("/api/data/sections"); const bySlug={}; (r.items||[]).forEach(sec=>{ bySlug[sec.slug]=[...(sec.categories||[])]; }); postCategoriesBySection=bySlug; } catch(e){} }
    const legacySlugField=postForm.elements.slug;
    if(legacySlugField) {
      const label=legacySlugField.closest("label");
      const hint=document.createElement("p");
      hint.className="field-hint";
      hint.textContent="文件名会在首次保存时根据标题自动生成。";
      label?.replaceWith(hint);
    }
    hiddenPostMetadata.forEach(name=>{
      const field=postForm.elements[name];
      if(!field) return;
      const hidden=document.createElement("input");
      hidden.type="hidden";
      hidden.name=name;
      field.closest("label")?.remove();
      postForm.append(hidden);
    });
    const legacyCategoryField=postForm.elements.category;
    const postCategoryField=document.createElement("select");
    postCategoryField.name="category";
    postCategoryField.required=true;
    legacyCategoryField.replaceWith(postCategoryField);
    function availablePostCategories(section) {
      if(postCategoriesBySection[section]) return postCategoriesBySection[section];
      const all=[...new Set([...(categoryOptions.projects||[]),...(categoryOptions.all||[])])];
      if(section==="technical") { const technical=all.filter(category=>!Object.values(postCategoriesBySection).flat().includes(category)); return technical.length ? technical : (all.length ? all : ["未分类"]); }
      return all.length ? all : ["未分类"];
    }
    function refreshPostCategoryOptions(preferred="") {
      const section=postForm.elements.contentSection?.value||"";
      const categories=availablePostCategories(section);
      const current=preferred||postCategoryField.value;
      postCategoryField.innerHTML=categories.map(category=>`<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
      if(categories.includes(current)) postCategoryField.value=current;
    }
    function articleStorageKey() { return currentSlug||postForm.elements.title.value.trim(); }
    async function refreshTagOptions() { [tagOptions,techStackOptions,categoryOptions]=await Promise.all([api("/api/tags"),api("/api/options/tech-stack"),api("/api/options/categories")]); $("#tag-options").innerHTML=[...new Set([...tagOptions,...techStackOptions])].map(tag=>`<option value="${escapeHtml(tag)}"></option>`).join(""); const categories=[...categoryOptions.projects,...categoryOptions.all.filter(item=>!categoryOptions.projects.includes(item))]; $("#category-options").innerHTML=categories.map(category=>`<option value="${escapeHtml(category)}"></option>`).join(""); refreshPostCategoryOptions(); }
    function refreshMarkdownPreview() { const preview=$("#markdown-preview"); if(!window.marked) { preview.textContent="正在加载 Markdown 预览..."; return; } window.marked.setOptions({ breaks:true, gfm:true }); preview.innerHTML=window.marked.parse(postForm.elements.body.value||""); const slug=articleStorageKey(); if(slug) preview.querySelectorAll("img[src],video[src],video source[src]").forEach(media=>{ const raw=media.getAttribute("src")||""; if((raw.startsWith("./")&&raw.includes(".assets/"))||raw.includes("/post-assets/"))
			media.setAttribute("src",`/api/posts/${encodeURIComponent(slug)}/assets/${encodeURIComponent(raw.split("/").pop())}`); }); addPreviewHeadingAnchors(preview); if(!preview.innerHTML.trim()) preview.innerHTML='<p class="muted">开始写作即可看到预览。</p>'; }
    function articleAssetPreviewPath(path) { const slug=articleStorageKey(); return !path||!slug||!String(path).includes(".assets/") ? "" : `/api/posts/${encodeURIComponent(slug)}/assets/${encodeURIComponent(String(path).split("/").pop())}`; }
    async function importMarkdownFile(file) { if(!file||!file.name.toLowerCase().endsWith(".md")) { showToast("导入失败","请选择 .md 文件。","error"); return; } try { const parsed=parseMarkdownFile(await file.text()); fill(postForm,{...parsed.frontmatter,body:parsed.body}); if(parsed.frontmatter.tags) mountPostTags(parsed.frontmatter.tags); if(!postForm.elements.title.value.trim()) postForm.elements.title.value=file.name.replace(/\.md$/i,""); refreshMarkdownPreview(); showToast("Markdown 已导入",`${file.name} 已就绪，可检查后保存。`); } catch(error) { showToast("导入失败",error.message||"无法读取该 Markdown 文件。","error"); } }
    async function importPdfFile(file) { if(!file||!/\.pdf$/i.test(file.name)) { showToast("导入失败","请选择 .pdf 文件。","error"); return; } try { const data=await new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error("文件无法读取。")); reader.readAsDataURL(file); }); const result=await api("/api/pdf-to-markdown",{method:"POST",body:JSON.stringify({name:file.name,data})}); postForm.elements.body.value=result.markdown; refreshMarkdownPreview(); if(!postForm.elements.title.value.trim()) postForm.elements.title.value=(result.title||file.name).replace(/\.pdf$/i,""); showToast("PDF 已转换",`${file.name} 已转为 Markdown 并写入编辑区，检查后可手动保存。`); } catch(error) { showToast("转换失败",error.message||"PDF 转换失败。","error"); } }
    async function uploadArticleCover(file, button) { const slug=articleStorageKey(); if(!slug) { showToast("封面上传需要标题","请先填写文章标题。","error"); return; } if(!file||!["image/webp","image/png","image/jpeg","image/gif","image/tiff","image/avif"].includes(file.type)) { showToast("图片格式不支持","请上传 PNG、JPEG、GIF、WebP、TIFF 或 AVIF 图片，将自动转为 WebP。","error"); return; } try { const data=await new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error("文件无法读取。")); reader.readAsDataURL(file); }); const result=await runButtonAction(button,"上传中...","封面上传成功",()=>api(`/api/posts/${encodeURIComponent(slug)}/assets`,{method:"POST",body:JSON.stringify({name:file.name,data,kind:"image",cover:true,alt:"cover"})})); postForm.elements.image.value=result.path; refreshArticleCover(); showToast("封面路径已添加","保存文章即可发布封面引用。"); } catch(error) { showToast("封面上传失败",error.message||"封面未上传。","error"); } }
    async function uploadPostMedia(file, kind, button) { const slug=articleStorageKey(); if(!slug) { showToast("上传需要标题","请先填写文章标题。","error"); return; } if(kind==="image"&&!["image/webp","image/png","image/jpeg","image/gif","image/tiff","image/avif"].includes(file.type)) { showToast("图片格式不支持","请上传 PNG、JPEG、GIF、WebP、TIFF 或 AVIF 图片，将自动转为 WebP。","error"); return; } if(kind==="video"&&!["video/mp4","video/webm"].includes(file.type)) { showToast("视频格式不支持","视频必须为 MP4 或 WebM 文件。","error"); return; } try { const data=await new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error("文件无法读取。")); reader.readAsDataURL(file); }); const result=await runButtonAction(button,"上传中...",kind==="image"?"图片已上传":"视频已上传",()=>api(`/api/posts/${encodeURIComponent(slug)}/assets`,{method:"POST",body:JSON.stringify({name:file.name,data,kind,alt:file.name.replace(/\.[^.]+$/,"")})})); // OSS 完整 URL 转站内相对路径 ./slug.assets/文件名：
	// 编辑框存相对路径，预览时经 /api/posts/... 代理读取（绕过本地 Referer 防盗链），
	// 发布后站内按相对路径正常解析
	const filename=result.path.split("/").pop();
	const markdown=kind==="image"
		? `![${file.name.replace(/\.[^.]+$/,"")}](./${slug}.assets/${filename})`
		: `<video controls src="./${slug}.assets/${filename}"></video>`;
	insertMarkdownAtCursor(markdown); showToast("媒体已插入","媒体路径已添加到 Markdown，保存文章即可发布。"); } catch(error) { showToast("上传失败",error.message||"媒体未上传。","error"); } }
    function newPost() { showToast("新建文章","填写标题和内容后保存即可。"); currentSlug=null; postForm.reset(); refreshArticleCover(); mountPostTags([]); refreshPostCategoryOptions(); refreshMarkdownPreview(); postForm.elements.published.value=new Date().toISOString().slice(0,10); $("#delete-post").classList.add("hidden"); show("editor"); }
    async function edit(slug) { const data=await api("/api/posts/"+encodeURIComponent(slug)); currentSlug=slug; fill(postForm,data); refreshPostCategoryOptions(data.category); refreshMarkdownPreview(); $("#delete-post").classList.remove("hidden"); show("editor"); }
    postForm.elements.contentSection.addEventListener("change",()=>refreshPostCategoryOptions());
    document.querySelector("#new-post").onclick=newPost;
    refreshPostCategoryOptions();
    

    $("#post-form").elements.body.addEventListener("input",refreshMarkdownPreview); document.querySelectorAll("[data-markdown-mode]").forEach(button=>button.onclick=()=>{ const mode=button.dataset.markdownMode; markdownDropZone.classList.remove("markdown-mode-edit","markdown-mode-preview","markdown-mode-split"); markdownDropZone.classList.add(`markdown-mode-${mode}`); document.querySelectorAll("[data-markdown-mode]").forEach(item=>item.classList.toggle("active",item===button)); refreshMarkdownPreview(); });
