        let metadataGenerationTimer;
        function autoGeneratePostMetadata() {
          if(currentSlug) return;
          const plainText=postForm.elements.body.value.replace(/```[\s\S]*?```/g,"").replace(/!?(?:\[[^\]]*\])?\([^)]*\)/g,"").replace(/[#>*_`~-]/g," ").replace(/\s+/g," ").trim();
          postForm.elements.description.value=plainText.slice(0,200);
          refreshPostCategoryOptions();
          if(!postCategoryField.value) postCategoryField.value=availablePostCategories(postForm.elements.contentSection.value)[0]||"";
          const source=[postForm.elements.title.value,postForm.elements.description.value,postForm.elements.body.value].join(" ").toLowerCase();
          const matches=[...new Set([...tagOptions,...techStackOptions].filter(tag=>tag&&source.includes(String(tag).toLowerCase())))].slice(0,8);
          if(matches.length) mountPostTags(matches);
        }
        [postForm.elements.title,postForm.elements.description,postForm.elements.body,postForm.elements.contentSection].forEach(field=>field.addEventListener("input",()=>{ clearTimeout(metadataGenerationTimer); metadataGenerationTimer=setTimeout(autoGeneratePostMetadata,250); }));
        postForm.elements.contentSection.addEventListener("change",autoGeneratePostMetadata);
        postForm.elements.published.readOnly=true;
        postForm.elements.description.closest("label")?.classList.add("hidden");
        postCategoryField.closest("label")?.classList.add("hidden");
        $("#post-tag-picker").closest("label")?.classList.add("hidden");
      
