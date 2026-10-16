import { api } from "./api.js";

let allOpportunities = [];

export async function loadOpportunities() {
  try {
    allOpportunities = await api.get("/opportunities");
    renderOpportunitiesList(allOpportunities);
    setupFilterButtons();
    setupSearchInput();
  } catch (err) {
    console.error("Failed to load opportunities:", err);
  }
}

function renderOpportunitiesList(list) {
  const container = document.getElementById("opportunities-container");
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 56px 24px;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6E7681" stroke-width="1.5" style="margin-bottom: 12px;">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
        <h3 style="color: #F0F2F5; font-size: 1.15rem; margin-bottom: 8px;">No Content Opportunities Yet</h3>
        <p style="color: #8E959B; max-width: 440px; margin: 0 auto 20px; font-size: 0.88rem;">
          Submit a YouTube channel URL or upload analytics data in the Analyze tab to extract high-potential video topics.
        </p>
        <a href="/analyze" class="btn btn-lime btn-sm">Start Analysis →</a>
      </div>
    `;
    return;
  }

  container.innerHTML = list
    .map(
      (opp) => `
    <div class="opportunity-card">
      <div style="position: relative;">
        <div style="width: 140px; height: 84px; background: #262B2E; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6E7681" stroke-width="2">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
            <line x1="7" y1="2" x2="7" y2="22"></line>
            <line x1="17" y1="2" x2="17" y2="22"></line>
            <line x1="2" y1="12" x2="22" y2="12"></line>
          </svg>
        </div>
      </div>
      
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          ${opp.opportunity_score >= 88 ? '<span class="badge badge-lime">High Potential</span>' : ""}
          <span style="font-size: 0.78rem; color: #8E959B;">${opp.category}</span>
        </div>
        <h3 style="font-size: 1.15rem; color: #F0F2F5; margin-bottom: 6px;">${opp.title}</h3>
        <p style="font-size: 0.85rem; color: #9BA3AB; margin-bottom: 12px; line-height: 1.4;">${opp.differentiation_angle}</p>
        
        <div style="display: flex; align-items: center; gap: 8px;">
          ${(opp.tags || []).map((t) => `<span class="badge badge-tag">${t}</span>`).join("")}
          <a href="/content-studio?topic=${encodeURIComponent(opp.title)}&opp_id=${opp.id}" class="btn btn-dark btn-sm" style="margin-left: auto;">Draft Script →</a>
        </div>
      </div>

      <div class="opp-score-box">
        <div class="opp-score-value">${opp.opportunity_score}</div>
        <div style="font-size: 0.75rem; color: #8E959B;">Opportunity Score</div>
        <div class="opp-score-bar">
          <div class="opp-score-bar-fill" style="width: ${opp.opportunity_score}%;"></div>
        </div>
        <button class="btn btn-sm bookmark-btn" data-id="${opp.id}" style="margin-top: 12px; width: 100%; border: 1px solid #2A2E32;">
          ${opp.is_bookmarked ? "★ Saved" : "☆ Save"}
        </button>
      </div>
    </div>
  `
    )
    .join("");

  // Attach bookmark listeners
  document.querySelectorAll(".bookmark-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      try {
        const res = await api.post(`/opportunities/${id}/bookmark`);
        btn.textContent = res.is_bookmarked ? "★ Saved" : "☆ Save";
      } catch (e) {
        console.error("Bookmark toggle failed:", e);
      }
    });
  });
}

function setupFilterButtons() {
  const buttons = document.querySelectorAll(".filter-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const category = btn.getAttribute("data-filter");

      if (category === "all") {
        renderOpportunitiesList(allOpportunities);
      } else if (category === "high-potential") {
        renderOpportunitiesList(allOpportunities.filter((o) => o.opportunity_score >= 88));
      } else {
        renderOpportunitiesList(
          allOpportunities.filter((o) => o.category.toLowerCase().includes(category.toLowerCase()))
        );
      }
    });
  });
}

function setupSearchInput() {
  const searchInput = document.getElementById("search-opportunities-input");
  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allOpportunities.filter(
      (o) => o.title.toLowerCase().includes(q) || o.differentiation_angle.toLowerCase().includes(q)
    );
    renderOpportunitiesList(filtered);
  });
}

document.addEventListener("DOMContentLoaded", loadOpportunities);
