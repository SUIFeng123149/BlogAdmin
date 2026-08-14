        const showBase=show;
        window.show=view=>{
          if(view!=="editor") clearPostSelection();
          const result=showBase(view);
          // 进入精选管理页渲染列表；进入编辑页刷新「首页精选」提示
          if(view==="featured") renderFeaturedPage();
          if(view==="editor") refreshFeaturedEditorHint();
          return result;
        };
        $("#post-list").addEventListener("click",event=>{
          const button=event.target.closest("button[data-slug]");
          if(!button) return;
          clearPostSelection();
          button.closest(".post-row")?.classList.add("is-selected");
        },true);
      
