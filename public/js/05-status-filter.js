/* ===== 内联脚本块 #12 ===== */

        const postStatusFilter=document.createElement("select");
        postStatusFilter.id="post-status-filter";
        postStatusFilter.setAttribute("aria-label","按文章状态筛选");
        postStatusFilter.innerHTML='<option value="">全部状态</option><option value="unset">未设置</option><option value="verified">已验证</option><option value="maintenance">维护中</option><option value="outdated">可能已过时</option>';
        $("#post-featured-filter").after(postStatusFilter);
        const filteredPostsBase=filteredPosts;
        window.filteredPosts=()=>{
          const status=postStatusFilter.value;
          return filteredPostsBase().filter(post=>!status || (status==="unset" ? !post.status : post.status===status));
        };
        postStatusFilter.onchange=()=>{ currentPage=1; renderPosts(); };
        const verificationStatus=postForm.elements.status;
        const verificationDate=postForm.elements.lastVerified;
        verificationDate.readOnly=true;
        verificationStatus.addEventListener("change",()=>{
          if(verificationStatus.value==="verified") verificationDate.value=new Date().toISOString().slice(0,10);
        });
      
