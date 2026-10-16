import { api } from "./api.js";

let activeJobId = null;
let pollTimer = null;
let selectedFile = null;

export function initAnalyze() {
  const form = document.getElementById("analyze-form");
  const fileInput = document.getElementById("analytics-file-input");
  const uploadBtn = document.getElementById("upload-trigger-btn");
  const dropzoneArea = document.getElementById("dropzone-area");
  const fileCard = document.getElementById("uploaded-file-card");
  const fileNameEl = document.getElementById("uploaded-file-name");
  const fileSizeEl = document.getElementById("uploaded-file-size");
  const analyzeFileBtn = document.getElementById("btn-analyze-uploaded-file");
  const removeFileBtn = document.getElementById("btn-remove-uploaded-file");

  // Handle URL Form Submit
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const inputEl = document.getElementById("channel-url-input");
      const target = inputEl ? inputEl.value.trim() : "";
      if (!target) {
        if (selectedFile) {
          uploadAndAnalyzeSelectedFile();
          return;
        }
        alert("Please enter a YouTube channel URL or choose an analytics file to analyze.");
        return;
      }

      try {
        setLoadingState(true);
        const job = await api.post("/jobs", { input_target: target });
        startJobWorkflow(job);
      } catch (err) {
        alert("Failed to queue analysis: " + err.message);
        setLoadingState(false);
      }
    });
  }

  // Handle File Selection
  function handleFileSelected(file) {
    if (!file) return;
    selectedFile = file;
    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) {
      const sizeKB = (file.size / 1024).toFixed(1);
      fileSizeEl.textContent = `${sizeKB} KB`;
    }
    if (fileCard) fileCard.style.display = "block";
  }

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      handleFileSelected(file);
    });
  }

  // Drag and drop support
  if (dropzoneArea) {
    dropzoneArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzoneArea.style.borderColor = "var(--color-lime)";
    });
    dropzoneArea.addEventListener("dragleave", () => {
      dropzoneArea.style.borderColor = "#2A2E32";
    });
    dropzoneArea.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzoneArea.style.borderColor = "#2A2E32";
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    });
  }

  // Remove File Button
  if (removeFileBtn) {
    removeFileBtn.addEventListener("click", () => {
      selectedFile = null;
      if (fileInput) fileInput.value = "";
      if (fileCard) fileCard.style.display = "none";
    });
  }

  // Upload and Analyze Button
  async function uploadAndAnalyzeSelectedFile() {
    if (!selectedFile) return;
    try {
      if (analyzeFileBtn) {
        analyzeFileBtn.disabled = true;
        analyzeFileBtn.textContent = "Uploading...";
      }
      const formData = new FormData();
      formData.append("file", selectedFile);
      const job = await api.post("/jobs/upload", formData);
      startJobWorkflow(job, selectedFile.name);
    } catch (err) {
      alert("Upload failed: " + err.message);
      if (analyzeFileBtn) {
        analyzeFileBtn.disabled = false;
        analyzeFileBtn.textContent = "Analyze Uploaded File →";
      }
    }
  }

  if (analyzeFileBtn) {
    analyzeFileBtn.addEventListener("click", uploadAndAnalyzeSelectedFile);
  }

  // Check if job_id passed in URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const existingJobId = urlParams.get("job_id");
  if (existingJobId) {
    startJobWorkflow({ id: existingJobId });
  }
}

function setLoadingState(loading) {
  const btn = document.getElementById("start-analyze-btn");
  if (btn) {
    btn.disabled = loading;
    btn.textContent = loading ? "Starting Agents..." : "Analyze URL →";
  }
}

function formatTargetDisplayName(rawTarget, originalFileName = null) {
  if (originalFileName) return `Uploaded File: ${originalFileName}`;
  if (!rawTarget) return "Channel Target";
  if (rawTarget.startsWith("upload://") || rawTarget.includes("/") || rawTarget.includes("\\")) {
    const filename = rawTarget.split(/[\/\\]/).pop();
    const parts = filename.split("_");
    const cleanName = parts.length > 1 ? parts.slice(1).join("_") : filename;
    return `Uploaded File: ${cleanName}`;
  }
  return rawTarget;
}

function startJobWorkflow(job, originalFileName = null) {
  activeJobId = job.id;
  document.getElementById("analyze-input-section").style.display = "none";
  document.getElementById("workflow-active-section").style.display = "block";

  const displayName = formatTargetDisplayName(job.input_target, originalFileName);
  const heading = document.getElementById("workflow-target-heading");
  if (heading) heading.textContent = `Analyzing: ${displayName}`;

  pollJobStatus(originalFileName);
  pollTimer = setInterval(() => pollJobStatus(originalFileName), 1500);
}

async function pollJobStatus(originalFileName = null) {
  if (!activeJobId) return;

  try {
    const job = await api.get(`/jobs/${activeJobId}`);

    // Update Heading & Subtext
    const heading = document.getElementById("workflow-target-heading");
    if (heading && job.input_target) {
      heading.textContent = `Analyzing: ${formatTargetDisplayName(job.input_target, originalFileName)}`;
    }

    // Update Progress Bar & Percentage
    const fillEl = document.getElementById("workflow-progress-fill");
    const percentEl = document.getElementById("workflow-progress-percent");
    const stepLabelEl = document.getElementById("workflow-current-step-label");

    if (fillEl) fillEl.style.width = `${job.progress_percent}%`;
    if (percentEl) percentEl.textContent = `${job.progress_percent}%`;
    if (stepLabelEl) stepLabelEl.textContent = job.current_stage || "Processing";

    // Update Stepper Highlight
    updateStepperStages(job.current_stage);

    // Update Live Terminal Activity
    renderTerminalLogs(job.events);

    // Check Terminal States
    if (job.status === "succeeded") {
      clearInterval(pollTimer);
      setTimeout(() => {
        window.location.href = `/report?job_id=${job.id}`;
      }, 1000);
    } else if (job.status === "failed") {
      clearInterval(pollTimer);
      alert("Analysis encountered an error: " + (job.error_message || "Unknown error"));
    }
  } catch (err) {
    console.error("Polling error:", err);
  }
}

function updateStepperStages(currentStage) {
  const stages = [
    "Collecting Data",
    "Analyzing Content",
    "Researching Opportunities",
    "Generating Insights",
    "Finalizing Report",
  ];

  const currentIdx = stages.indexOf(currentStage);

  stages.forEach((stage, idx) => {
    const row = document.getElementById(`step-row-${idx + 1}`);
    const badge = document.getElementById(`step-badge-${idx + 1}`);
    if (!row || !badge) return;

    if (idx < currentIdx || currentStage === "Finalizing Report") {
      badge.textContent = "Completed";
      badge.className = "step-status-badge completed";
    } else if (idx === currentIdx) {
      badge.textContent = "In progress...";
      badge.className = "step-status-badge running";
    } else {
      badge.textContent = "Queued";
      badge.className = "step-status-badge";
    }
  });
}

function renderTerminalLogs(events) {
  const terminal = document.getElementById("terminal-logs-stream");
  if (!terminal || !events || events.length === 0) return;

  terminal.innerHTML = events
    .map((e) => {
      const timeStr = new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const isLime = e.level === "info" && (e.message.includes("Complete") || e.message.includes("Ranked"));
      return `
      <div class="log-entry">
        <span class="log-time">${timeStr}</span>
        <span class="log-text ${isLime ? "highlight" : ""}">${e.message}</span>
      </div>
    `;
    })
    .join("");

  terminal.scrollTop = terminal.scrollHeight;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAnalyze);
} else {
  initAnalyze();
}
