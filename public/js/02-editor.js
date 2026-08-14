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
    function refreshMarkdownPreview() { const preview=$("#markdown-preview"); if(!window.marked) { preview.textContent="正在加载 Markdown 预览..."; return; } window.marked.setOptions({ breaks:true, gfm:true }); preview.innerHTML=window.marked.parse(postForm.elements.body.value||""); const slug=articleStorageKey(); if(slug) preview.querySelectorAll("img[src],video[src],video source[src]").forEach(media=>{ const raw=media.getAttribute("src")||""; if(raw.startsWith("./")&&raw.includes(".assets/")) media.setAttribute("src",`/api/posts/${encodeURIComponent(slug)}/assets/${encodeURIComponent(raw.split("/").pop())}`); }); addPreviewHeadingAnchors(preview); if(!preview.innerHTML.trim()) preview.innerHTML='<p class="muted">开始写作即可看到预览。</p>'; }
    function articleAssetPreviewPath(path) { const slug=articleStorageKey(); return !path||!slug||!String(path).includes(".assets/") ? "" : `/api/posts/${encodeURIComponent(slug)}/assets/${encodeURIComponent(String(path).split("/").pop())}`; }
    async function importMarkdownFile(file) { if(!file||!file.name.toLowerCase().endsWith(".md")) { showToast("导入失败","请选择 .md 文件。","error"); return; } try { const parsed=parseMarkdownFile(await file.text()); fill(postForm,{...parsed.frontmatter,body:parsed.body}); if(parsed.frontmatter.tags) mountPostTags(parsed.frontmatter.tags); if(!postForm.elements.title.value.trim()) postForm.elements.title.value=file.name.replace(/\.md$/i,""); refreshMarkdownPreview(); showToast("Markdown 已导入",`${file.name} 已就绪，可检查后保存。`); } catch(error) { showToast("导入失败",error.message||"无法读取该 Markdown 文件。","error"); } }
    async function importPdfFile(file) { if(!file||!/\.pdf$/i.test(file.name)) { showToast("导入失败","请选择 .pdf 文件。","error"); return; } try { const data=await new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error("文件无法读取。")); reader.readAsDataURL(file); }); const result=await api("/api/pdf-to-markdown",{method:"POST",body:JSON.stringify({name:file.name,data})}); postForm.elements.body.value=result.markdown; refreshMarkdownPreview(); if(!postForm.elements.title.value.trim()) postForm.elements.title.value=(result.title||file.name).replace(/\.pdf$/i,""); showToast("PDF 已转换",`${file.name} 已转为 Markdown 并写入编辑区，检查后可手动保存。`); } catch(error) { showToast("转换失败",error.message||"PDF 转换失败。","error"); } }
    async function uploadArticleCover(file, button) { const slug=articleStorageKey(); if(!slug) { showToast("封面上传需要标题","请先填写文章标题。","error"); return; } if(!file||!["image/webp","image/png","image/jpeg","image/gif","image/tiff","image/avif"].includes(file.type)) { showToast("图片格式不支持","请上传 PNG、JPEG、GIF、WebP、TIFF 或 AVIF 图片，将自动转为 WebP。","error"); return; } try { const data=await new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error("文件无法读取。")); reader.readAsDataURL(file); }); const result=await runButtonAction(button,"上传中...","封面上传成功",()=>api(`/api/posts/${encodeURIComponent(slug)}/assets`,{method:"POST",body:JSON.stringify({name:file.name,data,kind:"image",cover:true,alt:"cover"})})); postForm.elements.image.value=result.path; refreshArticleCover(); showToast("封面路径已添加","保存文章即可发布封面引用。"); } catch(error) { showToast("封面上传失败",error.message||"封面未上传。","error"); } }
    async function uploadPostMedia(file, kind, button) { const slug=articleStorageKey(); if(!slug) { showToast("上传需要标题","请先填写文章标题。","error"); return; } if(kind==="image"&&!["image/webp","image/png","image/jpeg","image/gif","image/tiff","image/avif"].includes(file.type)) { showToast("图片格式不支持","请上传 PNG、JPEG、GIF、WebP、TIFF 或 AVIF 图片，将自动转为 WebP。","error"); return; } if(kind==="video"&&!["video/mp4","video/webm"].includes(file.type)) { showToast("视频格式不支持","视频必须为 MP4 或 WebM 文件。","error"); return; } try { const data=await new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error("文件无法读取。")); reader.readAsDataURL(file); }); const result=await runButtonAction(button,"上传中...",kind==="image"?"图片已上传":"视频已上传",()=>api(`/api/posts/${encodeURIComponent(slug)}/assets`,{method:"POST",body:JSON.stringify({name:file.name,data,kind,alt:file.name.replace(/\.[^.]+$/,"")})})); insertMarkdownAtCursor(result.markdown); showToast("媒体已插入","媒体路径已添加到 Markdown，保存文章即可发布。"); } catch(error) { showToast("上传失败",error.message||"媒体未上传。","error"); } }
    function newPost() { showToast("新建文章","填写标题和内容后保存即可。"); currentSlug=null; postForm.reset(); refreshArticleCover(); mountPostTags([]); refreshPostCategoryOptions(); refreshMarkdownPreview(); postForm.elements.published.value=new Date().toISOString().slice(0,10); $("#delete-post").classList.add("hidden"); show("editor"); }
    async function edit(slug) { const data=await api("/api/posts/"+encodeURIComponent(slug)); currentSlug=slug; fill(postForm,data); refreshPostCategoryOptions(data.category); refreshMarkdownPreview(); $("#delete-post").classList.remove("hidden"); show("editor"); }
    postForm.elements.contentSection.addEventListener("change",()=>refreshPostCategoryOptions());
    document.querySelector("#new-post").onclick=newPost;
    refreshPostCategoryOptions();
    /* ---- 图片转 WebP 工具 ---- */
    const convertQueue=[],convertResults=[];
    const convertDropZone=$("#convert-drop-zone"),convertFileInput=$("#convert-file-input"),convertSelectBtn=$("#convert-select-btn");
    const convertQueueEl=$("#convert-queue"),convertResultsEl=$("#convert-results");
    const convertStart=$("#convert-start"),convertClear=$("#convert-clear"),convertQuality=$("#convert-quality"),convertQualityLabel=$("#convert-quality-label");
    function formatImageSize(bytes){if(bytes<1024)return bytes+" B";if(bytes<1048576)return(bytes/1024).toFixed(1)+" KB";return(bytes/1048576).toFixed(2)+" MB"}
    function updateConvertUI(){const hasItems=convertQueue.length>0;convertStart.disabled=!hasItems;convertClear.disabled=!hasItems;convertQueueEl.classList.toggle("hidden",!hasItems);}
    function addToQueue(file){const existing=convertQueue.find(f=>f.name===file.name&&f.size===file.size);if(existing)return;convertQueue.push(file);renderQueue();updateConvertUI();}
    function renderQueue(){convertQueueEl.innerHTML=convertQueue.map((f,i)=>`<div class="convert-queue-item" data-index="${i}"><img class="thumb" src="${URL.createObjectURL(f)}" alt="thumbnail"><div class="info"><strong>${escapeHtml(f.name)}</strong><span class="size">${formatImageSize(f.size)}</span></div><button class="remove-btn" data-index="${i}" type="button">×</button></div>`).join("");convertQueueEl.querySelectorAll(".remove-btn").forEach(btn=>btn.onclick=()=>{convertQueue.splice(Number(btn.dataset.index),1);renderQueue();updateConvertUI();});}
    convertDropZone.onclick=()=>convertFileInput.click();
    convertDropZone.ondragover=e=>{e.preventDefault();convertDropZone.classList.add("is-dragging");};
    convertDropZone.ondragleave=()=>convertDropZone.classList.remove("is-dragging");
    convertDropZone.ondrop=e=>{e.preventDefault();convertDropZone.classList.remove("is-dragging");[...(e.dataTransfer.files||[])].forEach(f=>{if(f.type.match(/^image\/(png|jpeg|gif|tiff|avif)$/i)||/\.(png|jpg|jpeg|gif|tiff|tif|avif)$/i.test(f.name))addToQueue(f);});};
    convertSelectBtn.onclick=e=>{e.stopPropagation();convertFileInput.click();};
    convertFileInput.onchange=()=>{[...convertFileInput.files].forEach(f=>addToQueue(f));convertFileInput.value="";};
    convertQuality.oninput=()=>{convertQualityLabel.textContent=convertQuality.value;};
    convertClear.onclick=()=>{convertQueue.length=0;convertResults.length=0;renderQueue();convertResultsEl.classList.add("hidden");convertResultsEl.innerHTML="";updateConvertUI();};
    convertStart.onclick=async()=>{const quality=Number(convertQuality.value);const total=convertQueue.length;if(!total)return;convertStart.disabled=true;convertStart.textContent="转换中...";convertResultsEl.classList.remove("hidden");convertResultsEl.innerHTML="";convertResults.length=0;for(let i=0;i<total;i++){const file=convertQueue[i];const itemEl=document.createElement("div");itemEl.className="convert-result-item";itemEl.innerHTML=`<strong>${escapeHtml(file.name)}</strong><br><span class="muted">转换中...</span>`;convertResultsEl.appendChild(itemEl);try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("文件无法读取"));reader.readAsDataURL(file);});const result=await api("/api/convert-webp",{method:"POST",body:JSON.stringify({name:file.name,data,quality})});const webpBytes=result.data.split(",")[1];const webpBlob=new Blob([Uint8Array.from(atob(webpBytes),c=>c.charCodeAt(0))],{type:"image/webp"});const downloadUrl=URL.createObjectURL(webpBlob);const downloadName=file.name.replace(/\.[^.]+$/,"")+".webp";convertResults.push({name:downloadName,url:downloadUrl,size:webpBlob.size});itemEl.innerHTML=`<strong>${escapeHtml(downloadName)}</strong><br><span class="savings">压缩: ${result.compression}%</span> (${formatImageSize(result.webpSize)} / ${formatImageSize(result.originalSize)})<br><a class="download-link" href="${downloadUrl}" download="${escapeHtml(downloadName)}">下载</a>`;const queueItem=convertQueueEl.querySelector(`[data-index="${i}"]`);if(queueItem)queueItem.classList.add("done");}catch(err){itemEl.innerHTML=`<strong>${escapeHtml(file.name)}</strong><br><span class="failed">转换失败: ${err.message}</span>`;}}convertStart.disabled=false;convertStart.textContent="开始转换";showToast("转换完成",`${total} 张图片已转换。`);};
    /* ---- 音频转 MP3 工具 ---- */
    const audioQueue=[];
    const audioDropZone=$("#audio-drop-zone"),audioFileInput=$("#audio-file-input"),audioSelectBtn=$("#audio-select-btn");
    const audioQueueEl=$("#audio-queue"),audioResultsEl=$("#audio-results");
    const audioStart=$("#audio-start"),audioClear=$("#audio-clear"),audioBitrate=$("#audio-bitrate"),audioBitrateLabel=$("#audio-bitrate-label");
    function updateAudioUI(){const hasItems=audioQueue.length>0;audioStart.disabled=!hasItems;audioClear.disabled=!hasItems;audioQueueEl.classList.toggle("hidden",!hasItems);}
    function addToAudioQueue(file){const existing=audioQueue.find(f=>f.name===file.name&&f.size===file.size);if(existing)return;audioQueue.push(file);renderAudioQueue();updateAudioUI();}
    function renderAudioQueue(){audioQueueEl.innerHTML=audioQueue.map((f,i)=>`<div class="convert-queue-item" data-index="${i}"><div class="info"><strong>${escapeHtml(f.name)}</strong><span class="size">${formatImageSize(f.size)}</span></div><button class="remove-btn" data-index="${i}" type="button">×</button></div>`).join("");audioQueueEl.querySelectorAll(".remove-btn").forEach(btn=>btn.onclick=()=>{audioQueue.splice(Number(btn.dataset.index),1);renderAudioQueue();updateAudioUI();});}
    audioDropZone.onclick=()=>audioFileInput.click();
    audioDropZone.ondragover=e=>{e.preventDefault();audioDropZone.classList.add("is-dragging");};
    audioDropZone.ondragleave=()=>audioDropZone.classList.remove("is-dragging");
    audioDropZone.ondrop=e=>{e.preventDefault();audioDropZone.classList.remove("is-dragging");[...(e.dataTransfer.files||[])].forEach(f=>{if(/\.(ncm|flac|wav|aac|ogg|m4a|wma|opus|mp3)$/i.test(f.name))addToAudioQueue(f);});};
    audioSelectBtn.onclick=e=>{e.stopPropagation();audioFileInput.click();};
    audioFileInput.onchange=()=>{[...audioFileInput.files].forEach(f=>addToAudioQueue(f));audioFileInput.value="";};
    audioBitrate.oninput=()=>{audioBitrateLabel.textContent=audioBitrate.value;};
    audioClear.onclick=()=>{audioQueue.length=0;renderAudioQueue();audioResultsEl.classList.add("hidden");audioResultsEl.innerHTML="";updateAudioUI();};
    audioStart.onclick=async()=>{const bitRate=Number(audioBitrate.value);const total=audioQueue.length;if(!total)return;audioStart.disabled=true;audioStart.textContent="转换中...";audioResultsEl.classList.remove("hidden");audioResultsEl.innerHTML="";for(let i=0;i<total;i++){const file=audioQueue[i];const itemEl=document.createElement("div");itemEl.className="convert-result-item";itemEl.innerHTML=`<strong>${escapeHtml(file.name)}</strong><br><span class="muted">转换中...</span>`;audioResultsEl.appendChild(itemEl);try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("文件无法读取"));reader.readAsDataURL(file);});const result=await api("/api/convert-audio",{method:"POST",body:JSON.stringify({name:file.name,data,bitRate})});const mp3Bytes=result.data.split(",")[1];const mp3Blob=new Blob([Uint8Array.from(atob(mp3Bytes),c=>c.charCodeAt(0))],{type:"audio/mpeg"});const downloadUrl=URL.createObjectURL(mp3Blob);const downloadName=file.name.replace(/\.[^.]+$/,"")+".mp3";const note=result.note?" · "+result.note:"";itemEl.innerHTML=`<strong>${escapeHtml(downloadName)}</strong>${note}<br><span class="savings">压缩: ${result.compression}%</span> (${formatImageSize(result.mp3Size)} / ${formatImageSize(result.originalSize)})<br><a class="download-link" href="${downloadUrl}" download="${escapeHtml(downloadName)}">下载</a>`;const queueItem=audioQueueEl.querySelector(`[data-index="${i}"]`);if(queueItem)queueItem.classList.add("done");}catch(err){itemEl.innerHTML=`<strong>${escapeHtml(file.name)}</strong><br><span class="failed">转换失败: ${err.message}</span>`;}}audioStart.disabled=false;audioStart.textContent="开始转换";showToast("转换完成",`${total} 个音频文件已转换。`);};
  
