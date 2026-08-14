        const refreshArticleCoverBase=window.refreshArticleCover,renderDataFieldsWithDiary=window.renderDataFields;
        const deleteArticleCoverButton=document.createElement("button");
        deleteArticleCoverButton.type="button";
        deleteArticleCoverButton.className="danger hidden";
        deleteArticleCoverButton.textContent="删除封面";
        document.querySelector("#cover-thumbnail")?.after(deleteArticleCoverButton);
        window.refreshArticleCover=()=>{ refreshArticleCoverBase(); deleteArticleCoverButton.classList.toggle("hidden",!postForm.elements.image.value); };
        async function deleteArticleCover() { const path=postForm.elements.image.value,slug=articleStorageKey(); if(!path) return; let deleted=false; if(slug) { try { await api(`/api/posts/${encodeURIComponent(slug)}/assets/${encodeURIComponent(path.split("/").pop())}`,{method:"DELETE"}); deleted=true; } catch { deleted=false; } } postForm.elements.image.value=""; refreshArticleCover(); showToast(deleted?"封面已删除":"封面已移除",deleted?"封面文件与引用已清除。":"封面引用已清除（文件可能已不存在）。"); }
        deleteArticleCoverButton.onclick=deleteArticleCover;
        async function attachCollectionImageRemoval() { if(!["projects","music"].includes(activeCollection)) return; const field=$("#data-fields [name=image],#data-fields [name=cover]"); if(!field||!field.value) return; const label=field.closest("label"),thumbnail=label?.querySelector(".image-thumbnail"); if(!label||label.querySelector("[data-remove-collection-image]")) return; const button=document.createElement("button"); button.type="button"; button.className="danger"; button.dataset.removeCollectionImage="true"; button.textContent="删除图片"; button.onclick=async()=>{ const path=field.value; if(!path) return; try { await runButtonAction(button,"删除中...","图片已删除",()=>api(`/api/data/${activeCollection}/assets/${encodeURIComponent(path.split("/").pop())}`,{method:"DELETE"})); field.value=""; refreshCollectionImagePreview(field,thumbnail); button.remove(); } catch(error) { showToast("图片未删除",error.message||"请重试。","error"); } }; label.append(button); }
        window.renderDataFields=item=>{ const result=renderDataFieldsWithDiary(item); attachCollectionImageRemoval(); return result; };
      
