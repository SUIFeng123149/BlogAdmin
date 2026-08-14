    const workspaceNav=document.createElement("button"); workspaceNav.dataset.view="workspace"; workspaceNav.innerHTML='<span class="nav-symbol">发</span><span class="nav-label">发布工作台</span>'; document.querySelector("nav")?.append(workspaceNav);
    async function loadWorkspace(){const data=await api("/api/workspace"); const root=document.querySelector("#workspace-status"); root.innerHTML=data.changed.length?`<strong>${data.changed.length} 个待处理改动</strong><ul>${data.changed.map(path=>`<li>${escapeHtml(path)}</li>`).join("")}</ul>`:"工作区干净，可以安全构建。";}
    workspaceNav.onclick=()=>{show("workspace");loadWorkspace().catch(e=>showToast("读取失败",e.message,"error"));}; document.querySelector("#refresh-workspace").onclick=()=>loadWorkspace().catch(e=>showToast("读取失败",e.message,"error"));
    document.querySelector("main")?.append(document.querySelector("#albums"), document.querySelector("#workspace"));
  
