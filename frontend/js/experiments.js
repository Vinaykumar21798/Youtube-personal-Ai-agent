import { api } from "./api.js";

export async function loadExperiments() {
  try {
    const list = await api.get("/experiments");
    renderExperiments(list);
    setupNewExperimentForm();
  } catch (err) {
    console.error("Failed to load experiments:", err);
  }
}

function renderExperiments(list) {
  const container = document.getElementById("experiments-list-container");
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 48px; color: #8E959B;">
        No active experiments logged. Register your first pre-publish hypothesis below.
      </div>
    `;
    return;
  }

  container.innerHTML = list
    .map(
      (exp) => `
    <div class="card" style="margin-bottom: 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <span class="badge ${exp.status === "validated" ? "badge-lime" : "badge-tag"}">${exp.status.toUpperCase()}</span>
        <span class="mono-text" style="color: #8E959B;">Metric: ${exp.target_metric}</span>
      </div>
      <h3 style="font-size: 1.1rem; color: #F0F2F5; margin-bottom: 10px;">${exp.hypothesis}</h3>
      <div style="display: flex; gap: 24px; font-size: 0.85rem; color: #9BA3AB; margin-bottom: 12px;">
        <div>Baseline: <strong style="color: #FFF;">${exp.baseline_value}%</strong></div>
        <div>Expected: <strong style="color: #FFF;">${exp.expected_value}%</strong></div>
        <div>Observed: <strong style="color: #C4F22C;">${exp.observed_value !== null ? exp.observed_value + "%" : "Measuring..."}</strong></div>
      </div>
      ${exp.notes ? `<div style="font-size: 0.82rem; color: #C4F22C; border-top: 1px solid #2A2E32; padding-top: 8px;">Outcome Note: ${exp.notes}</div>` : ""}
    </div>
  `
    )
    .join("");
}

function setupNewExperimentForm() {
  const form = document.getElementById("new-experiment-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const hypothesis = document.getElementById("exp-hypothesis-input").value;
    const target_metric = document.getElementById("exp-metric-input").value;
    const baseline_value = parseFloat(document.getElementById("exp-baseline-input").value);
    const expected_value = parseFloat(document.getElementById("exp-expected-input").value);

    try {
      await api.post("/experiments", {
        hypothesis,
        target_metric,
        baseline_value,
        expected_value,
      });
      form.reset();
      await loadExperiments();
      alert("Hypothesis registered successfully!");
    } catch (err) {
      alert("Failed to register hypothesis: " + err.message);
    }
  });
}

document.addEventListener("DOMContentLoaded", loadExperiments);
