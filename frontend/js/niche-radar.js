import { api } from "./api.js";
import { auth } from "./auth.js";

let currentNiche = "";
let currentTimePeriod = "all";
let currentCategory = "most_viewed";
let currentSort = "default";
let isLoading = false;
let lastResults = null;

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function initNicheRadarPage() {
  const searchForm = document.getElementById("niche-search-form");
  const searchInput = document.getElementById("niche-search-input");
  const btnSearch = document.getElementById("niche-btn-search");
  const btnRefresh = document.getElementById("niche-btn-refresh");
  const chipsContainer = document.getElementById("niche-chips-container");
  const sortSelect = document.getElementById("niche-sort-select");
  const resultsContainer = document.getElementById("niche-results-container");
  const videoGrid = document.getElementById("niche-video-grid");
  const statusStrip = document.getElementById("niche-status-strip");
  const lastUpdatedEl = document.getElementById("niche-last-updated");
  const quotaAlert = document.getElementById("niche-quota-alert");
  const emptyState = document.getElementById("niche-empty-state");
  const initialPromptState = document.getElementById("niche-initial-prompt");
  const connectedContextBadge = document.getElementById("niche-connected-badge");

  // 1. Load Suggestions and Connected Channel
  await loadSuggestions();

  // 2. Check URL params (e.g. ?niche=AI+Agents)
  const urlParams = new URLSearchParams(window.location.search);
  const qNiche = urlParams.get("niche");
  const qCat = urlParams.get("category");
  const qTime = urlParams.get("time");

  if (qCat) currentCategory = qCat;
  if (qTime) currentTimePeriod = qTime;

  // Sync category tabs and time pills to active
  updateCategoryTabsUI();
  updateTimePillsUI();

  if (qNiche) {
    if (searchInput) searchInput.value = qNiche;
    executeSearch(qNiche, false);
  } else if (searchInput && searchInput.value.trim()) {
    executeSearch(searchInput.value.trim(), false);
  }

  // 3. Setup Event Listeners
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = searchInput?.value.trim();
      if (val) executeSearch(val, false);
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      const val = searchInput?.value.trim() || currentNiche;
      if (val) {
        executeSearch(val, true);
      }
    });
  }

  // Category Tabs
  document.querySelectorAll(".niche-cat-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const cat = tab.getAttribute("data-category");
      if (cat && cat !== currentCategory) {
        currentCategory = cat;
        updateCategoryTabsUI();
        const val = searchInput?.value.trim() || currentNiche;
        if (val) executeSearch(val, false);
      }
    });
  });

  // Time Period Filter Pills
  document.querySelectorAll(".niche-time-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const t = pill.getAttribute("data-time");
      if (t && t !== currentTimePeriod) {
        currentTimePeriod = t;
        updateTimePillsUI();
        const val = searchInput?.value.trim() || currentNiche;
        if (val) executeSearch(val, false);
      }
    });
  });

  // Sort Dropdown
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      currentSort = sortSelect.value;
      const val = searchInput?.value.trim() || currentNiche;
      if (val) executeSearch(val, false);
    });
  }

  // Load Niche Suggestions
  async function loadSuggestions() {
    try {
      const data = await api.get("/niche-radar/suggest");
      if (data && chipsContainer) {
        const chips = (data.suggested_niches || []).map((n) => {
          return `<button type="button" class="niche-chip-btn" data-niche="${escapeHtml(n)}">${escapeHtml(n)}</button>`;
        }).join("");
        chipsContainer.innerHTML = chips;

        // Wire click handler
        chipsContainer.querySelectorAll(".niche-chip-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            const chosen = btn.getAttribute("data-niche");
            if (chosen && searchInput) {
              searchInput.value = chosen;
              executeSearch(chosen, false);
            }
          });
        });
      }

      if (data?.connected_channel && connectedContextBadge) {
        connectedContextBadge.style.display = "inline-flex";
        connectedContextBadge.textContent = `Channel: ${data.connected_channel}`;
      }
    } catch (err) {
      console.warn("Could not load niche suggestions:", err);
    }
  }

  function updateCategoryTabsUI() {
    document.querySelectorAll(".niche-cat-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.getAttribute("data-category") === currentCategory);
    });
  }

  function updateTimePillsUI() {
    document.querySelectorAll(".niche-time-pill").forEach((pill) => {
      pill.classList.toggle("active", pill.getAttribute("data-time") === currentTimePeriod);
    });
  }

  // Execute Search
  async function executeSearch(nicheQuery, forceRefresh = false) {
    if (isLoading) return;
    currentNiche = nicheQuery;

    // UI Updates
    isLoading = true;
    if (btnSearch) btnSearch.disabled = true;
    if (btnRefresh) {
      btnRefresh.disabled = true;
      btnRefresh.classList.add("spinning");
    }
    if (quotaAlert) quotaAlert.style.display = "none";
    if (initialPromptState) initialPromptState.style.display = "none";
    if (emptyState) emptyState.style.display = "none";

    renderSkeletons();

    try {
      const endpoint = `/niche-radar/search?niche=${encodeURIComponent(nicheQuery)}&time_period=${encodeURIComponent(currentTimePeriod)}&category=${encodeURIComponent(currentCategory)}&sort_by=${encodeURIComponent(currentSort)}&force_refresh=${forceRefresh ? "true" : "false"}`;
      const res = await api.get(endpoint);
      lastResults = res;

      // Update URL query parameters cleanly without reload
      const newUrl = new URL(window.location);
      newUrl.searchParams.set("niche", nicheQuery);
      newUrl.searchParams.set("category", currentCategory);
      newUrl.searchParams.set("time", currentTimePeriod);
      window.history.replaceState({}, "", newUrl);

      renderResults(res);
    } catch (err) {
      console.error("Niche Radar error:", err);
      handleError(err);
    } finally {
      isLoading = false;
      if (btnSearch) btnSearch.disabled = false;
      if (btnRefresh) {
        btnRefresh.disabled = false;
        btnRefresh.classList.remove("spinning");
      }
    }
  }

  function renderSkeletons() {
    if (!videoGrid) return;
    if (statusStrip) statusStrip.style.display = "none";
    videoGrid.innerHTML = Array.from({ length: 6 }).map(() => `
      <div class="niche-skeleton-card">
        <div class="niche-skeleton-thumb"></div>
        <div class="niche-skeleton-body">
          <div class="niche-skeleton-line" style="width: 85%;"></div>
          <div class="niche-skeleton-line" style="width: 60%;"></div>
          <div class="niche-skeleton-line" style="width: 45%; margin-top: 10px;"></div>
          <div class="niche-skeleton-line" style="width: 100%; height: 60px; margin-top: 8px;"></div>
        </div>
      </div>
    `).join("");
  }

  function renderResults(res) {
    if (!videoGrid) return;

    const videos = res.videos || [];
    if (videos.length === 0) {
      videoGrid.innerHTML = "";
      if (statusStrip) statusStrip.style.display = "none";
      if (emptyState) {
        emptyState.style.display = "block";
        const titleEl = document.getElementById("niche-empty-title");
        const msgEl = document.getElementById("niche-empty-message");
        if (titleEl) titleEl.textContent = `No videos found for "${escapeHtml(res.niche)}"`;
        if (msgEl) {
          msgEl.textContent = res.time_period !== "all"
            ? `Try expanding your time filter from "${res.time_period}" to "All time", or try a broader niche keyword.`
            : "No public videos matched your criteria. Try another niche topic.";
        }
      }
      return;
    }

    // Render Status Strip
    if (statusStrip) {
      statusStrip.style.display = "flex";
      const countEl = document.getElementById("niche-status-count");
      const badgeWrap = document.getElementById("niche-status-badge");
      if (countEl) {
        countEl.textContent = `Showing ${videos.length} real YouTube uploads in "${res.niche}"`;
      }
      if (badgeWrap) {
        const timeFormatted = formatTime(res.last_refreshed_at);
        badgeWrap.innerHTML = res.is_cached
          ? `<span class="niche-badge-cached" title="Data cached to save YouTube API quota">⚡ Cached (${timeFormatted}) — Click Refresh for live snapshot</span>`
          : `<span class="niche-badge-fresh" title="Freshly retrieved from YouTube Data API v3">✓ Live Snapshot (${timeFormatted})</span>`;
      }
    }

    // Check momentum disclosure note
    let momentumAlertHtml = "";
    if (currentCategory === "momentum" && res.data_coverage && !res.data_coverage.has_momentum_delta_data) {
      momentumAlertHtml = `
        <div style="grid-column: 1 / -1; background: rgba(186, 255, 41, 0.05); border: 1px dashed rgba(186, 255, 41, 0.35); border-radius: 8px; padding: 14px 18px; margin-bottom: 8px; font-size: 0.83rem; color: #C5CBD2; line-height: 1.5;">
          <strong>⏱ Snapshot 1 of 2 Recorded:</strong>
          ${escapeHtml(res.data_coverage.momentum_explanation)}
          The videos below are currently sorted by daily velocity. Check back in a few hours to view real measured view growth deltas.
        </div>
      `;
    }

    // Render Video Cards
    const cardsHtml = videos.map((v) => {
      const watchUrl = v.url || `https://www.youtube.com/watch?v=${v.video_id}`;
      const thumb = v.thumbnail_url || "/assets/images/creator-avatar.svg";
      const title = escapeHtml(v.title);
      const chName = escapeHtml(v.channel_title || "YouTube Creator");
      const chAvatar = v.channel_avatar_url || "/assets/images/creator-avatar.svg";
      const chSubs = v.channel_subscriber_count != null ? `${Number(v.channel_subscriber_count).toLocaleString()} subs` : "Subscribers hidden";
      const rankBadge = v.rank_badge || "🎯 Niche Standout";
      const rankReason = v.rank_reason || "";
      const dur = v.duration_formatted ? `<span class="niche-duration-badge">${v.duration_formatted}</span>` : "";

      // Metric pills
      const views = v.view_count_formatted || Number(v.view_count).toLocaleString();
      const viewsPerDay = v.views_per_day_formatted || `${Number(v.views_per_day).toLocaleString()}/day`;
      const age = v.video_age_formatted || "Recent";
      const pubDate = v.published_date_formatted || "";
      const likes = v.like_count_formatted ? `👍 ${v.like_count_formatted}` : null;
      const comments = v.comment_count_formatted ? `💬 ${v.comment_count_formatted}` : null;

      // Growth Row
      let growthHtml = "";
      if (v.recent_growth_formatted) {
        const isDelta = v.recent_growth !== null && v.recent_growth > 0;
        growthHtml = `
          <div class="niche-growth-indicator">
            <span>Snapshot Delta:</span>
            <strong>${isDelta ? "📈 " : ""}${escapeHtml(v.recent_growth_formatted)}</strong>
          </div>
        `;
      }

      // Baseline Strip
      let baselineHtml = "";
      if (v.channel_baseline_text) {
        baselineHtml = `<div class="niche-baseline-indicator">${escapeHtml(v.channel_baseline_text)}</div>`;
      }

      return `
        <div class="niche-video-card" data-video-id="${v.video_id}">
          <div class="niche-card-thumb-wrap">
            <a href="${watchUrl}" target="_blank" rel="noopener noreferrer">
              <img src="${thumb}" alt="${title}" class="niche-card-thumb" loading="lazy" onerror="this.src='/assets/images/creator-avatar.svg';">
            </a>
            <span class="niche-rank-badge">${escapeHtml(rankBadge)}</span>
            ${dur}
          </div>

          <div class="niche-card-body">
            <h3 class="niche-card-title" title="${title}">
              <a href="${watchUrl}" target="_blank" rel="noopener noreferrer">${title}</a>
            </h3>

            <div class="niche-card-channel">
              <img src="${chAvatar}" alt="${chName}" class="niche-channel-avatar" onerror="this.src='/assets/images/creator-avatar.svg';">
              <div class="niche-channel-meta">
                <span class="niche-channel-name" title="${chName}">${chName}</span>
                <span class="niche-channel-subtext">${chSubs}</span>
              </div>
            </div>

            <div class="niche-stats-grid">
              <div class="niche-stat-box">
                <span class="niche-stat-label">Total Views</span>
                <span class="niche-stat-val views">${views}</span>
              </div>
              <div class="niche-stat-box">
                <span class="niche-stat-label">Avg / Day</span>
                <span class="niche-stat-val">${viewsPerDay}</span>
              </div>
              <div class="niche-stat-box">
                <span class="niche-stat-label">Uploaded</span>
                <span class="niche-stat-val" style="font-size: 0.8rem;">${age}</span>
              </div>
              <div class="niche-stat-box">
                <span class="niche-stat-label">Engagement</span>
                <span class="niche-stat-val" style="font-size: 0.8rem;">${likes || (comments || "Public")}</span>
              </div>
            </div>

            ${growthHtml}
            ${baselineHtml}

            ${rankReason ? `
              <div class="niche-rank-reason-pill">
                <span>💡 ${escapeHtml(rankReason)}</span>
              </div>
            ` : ""}

            <div class="niche-card-actions">
              <a href="${watchUrl}" target="_blank" rel="noopener noreferrer" class="niche-action-btn primary" title="Open YouTube Watch Page">
                Watch ↗
              </a>
              <button type="button" class="niche-action-btn btn-action-analyze" data-vid="${v.video_id}" data-url="${watchUrl}" title="Analyze video pacing and retention signals">
                Analyze
              </button>
              <button type="button" class="niche-action-btn btn-action-similar" data-title="${title}" title="Search niche radar for similar topics">
                Find Similar
              </button>
              <a href="/ask-ai?q=${encodeURIComponent(`Compare my best video with "${v.title}" (${v.video_id})`)}" class="niche-action-btn" title="Ask AI to compare with my uploads">
                Compare
              </a>
              <a href="/ask-ai?q=${encodeURIComponent(`Why is this competitor video performing well: "${v.title}" (${v.video_id})`)}" class="niche-action-btn" title="Ask AI growth strategy analysis">
                Ask AI
              </a>
            </div>
          </div>
        </div>
      `;
    }).join("");

    videoGrid.innerHTML = momentumAlertHtml + cardsHtml;

    // Attach card action listeners
    videoGrid.querySelectorAll(".btn-action-analyze").forEach((btn) => {
      btn.addEventListener("click", () => {
        const vidUrl = btn.getAttribute("data-url");
        if (vidUrl) {
          window.location.href = `/analyze?url=${encodeURIComponent(vidUrl)}`;
        }
      });
    });

    videoGrid.querySelectorAll(".btn-action-similar").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rawTitle = btn.getAttribute("data-title") || "";
        // Clean out brackets, emojis, numbers to find keywords
        const keywords = rawTitle.replace(/[\[\]\(\)\{\}\#\!\|\-]/g, " ").trim().split(/\s+/).slice(0, 3).join(" ");
        if (keywords && searchInput) {
          searchInput.value = keywords;
          executeSearch(keywords, false);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    });
  }

  function handleError(err) {
    if (!videoGrid) return;
    videoGrid.innerHTML = "";

    const msg = err.message || "";
    if (msg.includes("quota") || msg.includes("429") || msg.includes("QUOTA")) {
      if (quotaAlert) {
        quotaAlert.style.display = "block";
      }
    } else {
      if (emptyState) {
        emptyState.style.display = "block";
        const titleEl = document.getElementById("niche-empty-title");
        const msgEl = document.getElementById("niche-empty-message");
        if (titleEl) titleEl.textContent = "Unable to fetch niche videos";
        if (msgEl) msgEl.textContent = `${err.message || "Failed to reach YouTube Data API"}. Please try again shortly.`;
      }
    }
  }

  function formatTime(isoStr) {
    if (!isoStr) return "Just now";
    try {
      const dt = new Date(isoStr);
      return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (_) {
      return "Recent";
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNicheRadarPage);
} else {
  initNicheRadarPage();
}
