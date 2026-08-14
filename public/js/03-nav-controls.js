/* ===== 内联脚本块 #3 ===== */

    const albumNav=document.createElement("button"); albumNav.dataset.view="albums"; albumNav.innerHTML='<span class="nav-symbol">册</span><span class="nav-label">相册</span>'; document.querySelector("nav")?.append(albumNav);
    let albums=[]; const albumList=document.querySelector("#album-list"),albumForm=document.querySelector("#album-form");
    async function loadAlbums(){ albums=(await api("/api/albums")).items; albumList.innerHTML=albums.map(a=>`<button class="post-row" data-id="${encodeURIComponent(a.id)}"><span><strong>${escapeHtml(a.title||a.id)}</strong><br><span class="muted">${a.images.length} 张 · ${a.hidden?"隐藏":"可见"}</span></span><span class="post-meta">${escapeHtml(a.date||"")}</span></button>`).join("")||'<p class="muted">暂无相册。</p>'; albumList.querySelectorAll("button").forEach(b=>b.onclick=()=>editAlbum(decodeURIComponent(b.dataset.id))); }
    async function editAlbum(id){ const {item}=await api(`/api/albums/${encodeURIComponent(id)}`); albumForm.reset(); Object.entries(item).forEach(([k,v])=>{const f=albumForm.elements[k];if(f) f.type==="checkbox"?f.checked=!!v:f.value=v??"";}); albumForm.classList.remove("hidden"); }
    albumNav.onclick=()=>{show("albums");loadAlbums().catch(e=>showToast("相册加载失败",e.message,"error"));}; document.querySelector("#new-album").onclick=()=>{albumForm.reset();albumForm.elements.columns.value=3;albumForm.classList.remove("hidden");}; albumForm.onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(albumForm));data.hidden=albumForm.elements.hidden.checked;data.columns=Number(data.columns||3);await api(`/api/albums/${encodeURIComponent(data.id)}`,{method:"PUT",body:JSON.stringify(data)});showToast("相册已保存","相册信息已更新。");loadAlbums();};
  

/* ===== 内联脚本块 #4 ===== */

    const announcementControls=document.createElement("div"); announcementControls.className="panel stack";
    announcementControls.innerHTML='<h2>公告</h2><label class="check"><input name="announcementEnabled" type="checkbox"> 启用公告</label><label>公告内容<textarea name="announcementContent" rows="4" maxlength="500"></textarea></label>';
    document.querySelector("#settings-form .panel:last-child")?.before(announcementControls);
  

/* ===== 内联脚本块 #5 ===== */

    const profileControls=document.createElement("div"); profileControls.className="panel stack";
    profileControls.innerHTML='<h2>个人资料</h2><label>名称<input name="profileName"></label><label>简介<textarea name="profileBio" rows="4" maxlength="500"></textarea></label>';
    document.querySelector("#settings-form")?.prepend(profileControls);
  

/* ===== 内联脚本块 #6 ===== */

    const workspaceNav=document.createElement("button"); workspaceNav.dataset.view="workspace"; workspaceNav.innerHTML='<span class="nav-symbol">发</span><span class="nav-label">发布工作台</span>'; document.querySelector("nav")?.append(workspaceNav);
    async function loadWorkspace(){const data=await api("/api/workspace"); const root=document.querySelector("#workspace-status"); root.innerHTML=data.changed.length?`<strong>${data.changed.length} 个待处理改动</strong><ul>${data.changed.map(path=>`<li>${escapeHtml(path)}</li>`).join("")}</ul>`:"工作区干净，可以安全构建。";}
    workspaceNav.onclick=()=>{show("workspace");loadWorkspace().catch(e=>showToast("读取失败",e.message,"error"));}; document.querySelector("#refresh-workspace").onclick=()=>loadWorkspace().catch(e=>showToast("读取失败",e.message,"error"));
    document.querySelector("main")?.append(document.querySelector("#albums"), document.querySelector("#workspace"));
  

/* ===== 内联脚本块 #7 ===== */

    const featuredLimit=6;
    async function setPostFeatured(slug, featured, input) { const featuredCountValue=posts.filter(post=>post.featured).length; if(featured&&featuredCountValue>=featuredLimit) { input.checked=false; showToast("最多 6 篇精选文章","请先取消一篇已精选文章。","error"); return; } try { const post=await api(`/api/posts/${encodeURIComponent(slug)}`); await api(`/api/posts/${encodeURIComponent(slug)}`,{method:"PUT",body:JSON.stringify({...post,featured})}); showToast(featured?"已加入首页精选":"已取消首页精选",post.title); await loadPosts(); } catch(error) { input.checked=!featured; showToast("精选状态未更新",error.message||"请稍后重试。","error"); } }
  
