        const showBase=show;
        window.show=view=>{
          if(view!=="editor") clearPostSelection();
          return showBase(view);
        };
        $("#post-list").addEventListener("click",event=>{
          const button=event.target.closest("button[data-slug]");
          if(!button) return;
          clearPostSelection();
          button.closest(".post-row")?.classList.add("is-selected");
        },true);
      
