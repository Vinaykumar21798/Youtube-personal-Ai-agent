import { api } from "./api.js";

let currentScriptId = null;

export async function initContentStudio() {
  const urlParams = new URLSearchParams(window.location.search);
  const topicParam = urlParams.get("topic");
  const oppIdParam = urlParams.get("opp_id");

  if (topicParam) {
    const titleInput = document.getElementById("script-title-input");
    if (titleInput) titleInput.value = topicParam;
    await generateScript(topicParam, oppIdParam);
  } else {
    await loadLatestScript();
  }

  // Setup generate button
  const genBtn = document.getElementById("btn-generate-script");
  if (genBtn) {
    genBtn.addEventListener("click", async () => {
      const titleInput = document.getElementById("script-title-input");
      const title = titleInput.value.trim();
      if (!title) {
        alert("Please enter a video topic or title");
        return;
      }
      await generateScript(title);
    });
  }

  // Setup save draft button
  const saveBtn = document.getElementById("btn-save-draft");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      if (!currentScriptId) return;
      const draftText = document.getElementById("script-draft-textarea").value;
      try {
        await api.put(`/studio/scripts/${currentScriptId}`, { script_draft: draftText });
        saveBtn.textContent = "Saved ✓";
        setTimeout(() => (saveBtn.textContent = "Save Changes"), 2000);
      } catch (err) {
        alert("Failed to save draft: " + err.message);
      }
    });
  }
}

async function loadLatestScript() {
  try {
    const scripts = await api.get("/studio/scripts");
    if (scripts && scripts.length > 0) {
      renderScript(scripts[0]);
    }
  } catch (err) {
    console.error("Failed to load scripts:", err);
  }
}

async function generateScript(title, oppId = null) {
  const genBtn = document.getElementById("btn-generate-script");
  if (genBtn) {
    genBtn.disabled = true;
    genBtn.textContent = "Generating...";
  }

  try {
    const script = await api.post("/studio/scripts/generate", {
      title,
      video_type: "YouTube Video",
      opportunity_id: oppId,
    });
    renderScript(script);
  } catch (err) {
    alert("Generation failed: " + err.message);
  } finally {
    if (genBtn) {
      genBtn.disabled = false;
      genBtn.textContent = "Generate →";
    }
  }
}

function renderScript(script) {
  currentScriptId = script.id;
  const titleInput = document.getElementById("script-title-input");
  const textarea = document.getElementById("script-draft-textarea");
  if (titleInput) titleInput.value = script.title;
  if (textarea) textarea.value = script.script_draft;

  // Render checklist
  const checklistContainer = document.getElementById("script-checklist-container");
  if (checklistContainer && script.checklist) {
    checklistContainer.innerHTML = script.checklist
      .map(
        (item) => `
      <div class="checklist-item">
        <div class="checklist-check">✓</div>
        <span>${item.label}</span>
      </div>
    `
      )
      .join("");
  }
}

document.addEventListener("DOMContentLoaded", initContentStudio);
