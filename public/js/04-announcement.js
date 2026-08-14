    const announcementControls=document.createElement("div"); announcementControls.className="panel stack";
    announcementControls.innerHTML='<h2>公告</h2><label class="check"><input name="announcementEnabled" type="checkbox"> 启用公告</label><label>公告内容<textarea name="announcementContent" rows="4" maxlength="500"></textarea></label>';
    document.querySelector("#settings-form .panel:last-child")?.before(announcementControls);
  
