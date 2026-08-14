    const profileControls=document.createElement("div"); profileControls.className="panel stack";
    profileControls.innerHTML='<h2>个人资料</h2><label>名称<input name="profileName"></label><label>简介<textarea name="profileBio" rows="4" maxlength="500"></textarea></label>';
    document.querySelector("#settings-form")?.prepend(profileControls);
  
