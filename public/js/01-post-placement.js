/* ===== 内联脚本块 #1 ===== */

    const postPlacementControls = document.createElement("div");
    postPlacementControls.className = "fields";
    postPlacementControls.innerHTML = '<label>首页分区<select name="contentSection"><option value="">自动归类</option><option value="technical">技术资料</option><option value="notes">个人随笔</option><option value="games">游戏记录</option><option value="other">其他内容</option></select></label><label class="check"><input name="featured" type="checkbox"> 首页精选</label>';
    document.querySelector("#post-form .actions")?.before(postPlacementControls);
  
