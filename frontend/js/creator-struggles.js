import { api } from "./api.js";

// State
let currentQuery = "My coding tutorials get impressions, but viewers do not click, and those who click leave in the first minute.";

export async function initUniversalStruggles() {
  bindEvents();
  await loadPromptSuggestions();
  // Auto-run initial investigation
  await executeInvestigation();
}

function bindEvents() {
  const searchForm = document.getElementById("struggles-search-form");
  const searchInput = document.getElementById("struggle-input");
  const refreshBtn = document.getElementById("btn-refresh-struggle");

  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = searchInput?.value.trim();
      if (val) {
        currentQuery = val;
        executeInvestigation();
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      executeInvestigation(true);
    });
  }
}

async function loadPromptSuggestions() {
  const container = document.getElementById("prompt-pills-container");
  if (!container) return;

  try {
    const data = await api.get("/creator-struggles/suggestions");
    const suggestions = data.suggestions || [];

    container.innerHTML = suggestions
      .map(
        (s) => `
      <div class="prompt-chip" data-query="${escapeHtml(s.query)}">
        <span style="color: var(--color-lime); font-weight: 600;">[${escapeHtml(s.badge)}]</span>
        <span>${escapeHtml(s.query.length > 55 ? s.query.slice(0, 55) + "..." : s.query)}</span>
      </div>
    `
      )
      .join("");

    container.querySelectorAll(".prompt-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const q = chip.getAttribute("data-query");
        if (q) {
          const input = document.getElementById("struggle-input");
          if (input) input.value = q;
          currentQuery = q;
          executeInvestigation();
        }
      });
    });
  } catch (err) {
    console.error("Failed to load suggested struggle queries:", err);
  }
}

async function executeInvestigation(forceRefresh = false) {
  const bodyYt = document.getElementById("body-youtube");
  const bodyRd = document.getElementById("body-reddit");
  const bodyX = document.getElementById("body-x");
  const bodyArt = document.getElementById("body-articles");

  // Show loading skeleton states in all 4 columns
  showColumnLoading(bodyYt, "Searching YouTube Data API...");
  showColumnLoading(bodyRd, "Searching Reddit Creator Communities...");
  showColumnLoading(bodyX, "Searching Public X Posts...");
  showColumnLoading(bodyArt, "Searching Articles & Case Studies...");

  try {
    let endpoint = `/creator-struggles/investigate?q=${encodeURIComponent(currentQuery)}`;
    if (forceRefresh) endpoint += `&force_refresh=true`;

    const data = await api.get(endpoint);

    // 1. Render Problem Understanding Banner
    renderAnalysisBanner(data.analysis, data.total_evidence_count, data.retrieved_at);

    // 2. Render Section 1: YouTube Videos
    const ytSource = data.sources?.youtube || {};
    renderYouTubeVideos(bodyYt, ytSource.results || [], ytSource.count || 0, ytSource.error);

    // 3. Render Section 2: Reddit Discussions
    const rdSource = data.sources?.reddit || {};
    renderRedditDiscussions(bodyRd, rdSource.results || [], rdSource.count || 0, rdSource.error);

    // 4. Render Section 3: X Posts
    const xSource = data.sources?.x || {};
    renderXPosts(bodyX, xSource.results || [], xSource.count || 0, xSource.error);

    // 5. Render Section 4: Internet Articles
    const artSource = data.sources?.articles || {};
    renderArticles(bodyArt, artSource.results || [], artSource.count || 0, artSource.error);
  } catch (err) {
    console.error("Investigation failed:", err);
    const errHtml = `<div class="empty-col-state" style="color: #F87171;">Investigation request failed: ${escapeHtml(err.message)}</div>`;
    if (bodyYt) bodyYt.innerHTML = errHtml;
    if (bodyRd) bodyRd.innerHTML = errHtml;
    if (bodyX) bodyX.innerHTML = errHtml;
    if (bodyArt) bodyArt.innerHTML = errHtml;
  }
}

function showColumnLoading(container, text) {
  if (!container) return;
  container.innerHTML = `
    <div style="padding: 50px 16px; text-align: center; color: #8E959B;">
      <div class="spinner" style="width: 24px; height: 24px; border: 3px solid rgba(196,242,44,0.15); border-top-color: var(--color-lime); border-radius: 50%; margin: 0 auto 14px; animation: spin 0.8s linear infinite;"></div>
      <div style="font-size: 0.85rem; color: #D5D9DC;">${escapeHtml(text)}</div>
      <div style="font-size: 0.75rem; color: #6E7681; margin-top: 4px;">Live parallel retrieval...</div>
    </div>
  `;
}

function renderAnalysisBanner(analysis, totalCount, retrievedAt) {
  const banner = document.getElementById("problem-analysis-banner");
  const titleEl = document.getElementById("analysis-primary-problem");
  const aspectsContainer = document.getElementById("analysis-aspects-tags");
  const metricsContainer = document.getElementById("analysis-metrics-tags");
  const countEl = document.getElementById("analysis-total-count");
  const timeEl = document.getElementById("analysis-retrieval-time");

  if (!banner || !analysis) return;
  banner.style.display = "flex";

  if (titleEl) titleEl.textContent = analysis.primary_problem || "Problem Under Investigation";

  if (aspectsContainer) {
    const aspects = analysis.sub_problems || [];
    aspectsContainer.innerHTML = aspects
      .map((a) => `<span class="badge badge-tag" style="font-size: 0.73rem;">${escapeHtml(a)}</span>`)
      .join("");
  }

  if (metricsContainer) {
    const metrics = analysis.key_metrics || [];
    metricsContainer.innerHTML = metrics
      .map((m) => `<span class="badge badge-lime" style="font-size: 0.73rem;">${escapeHtml(m)}</span>`)
      .join("");
  }

  if (countEl) countEl.textContent = `${totalCount || 0} Evidence Records`;
  if (timeEl && retrievedAt) {
    const d = new Date(retrievedAt);
    timeEl.textContent = `Retrieved: ${d.toLocaleTimeString()}`;
  }
}

// -------------------------------------------------------------
// Section 1: YouTube Videos
// -------------------------------------------------------------
function renderYouTubeVideos(container, videos, count, error) {
  const countBadge = document.getElementById("count-yt");
  if (countBadge) countBadge.textContent = count;
  if (!container) return;

  if (error) {
    container.innerHTML = `<div class="empty-col-state" style="color: #F87171;">YouTube Data API notice: ${escapeHtml(error)}</div>`;
    return;
  }

  if (!videos || videos.length === 0) {
    container.innerHTML = `<div class="empty-col-state">No matching YouTube videos found for this specific query.</div>`;
    return;
  }

  container.innerHTML = videos
    .map(
      (v) => `
    <a href="${v.url}" target="_blank" rel="noopener noreferrer" class="evidence-card">
      <div class="yt-thumb-wrap">
        <img src="${v.thumbnail_url || '/assets/images/creator-avatar.svg'}" alt="${escapeHtml(v.title)}" class="yt-thumb-img" loading="lazy">
        <span class="yt-duration-badge">${escapeHtml(v.duration_formatted || '--:--')}</span>
      </div>

      <div class="card-title">${escapeHtml(v.title)}</div>

      <div style="font-size: 0.8rem; color: #9CA3AF; margin-bottom: 6px;">
        ${escapeHtml(v.channel_title)}
      </div>

      <div class="card-meta-row">
        <span>${formatCount(v.view_count)} views</span>
        <span style="color: var(--color-lime); display: inline-flex; align-items: center; gap: 3px;">
          Watch ↗
        </span>
      </div>
    </a>
  `
    )
    .join("");
}

// -------------------------------------------------------------
// Section 2: Reddit Discussions
// -------------------------------------------------------------
function renderRedditDiscussions(container, threads, count, error) {
  const countBadge = document.getElementById("count-rd");
  if (countBadge) countBadge.textContent = count;
  if (!container) return;

  if (error) {
    container.innerHTML = `<div class="empty-col-state" style="color: #F87171;">Reddit search notice: ${escapeHtml(error)}</div>`;
    return;
  }

  if (!threads || threads.length === 0) {
    container.innerHTML = `<div class="empty-col-state">No relevant Reddit discussions retrieved for this query.</div>`;
    return;
  }

  container.innerHTML = threads
    .map(
      (t) => `
    <a href="${t.url}" target="_blank" rel="noopener noreferrer" class="evidence-card">
      <div class="sub-badge">
        <span>${escapeHtml(t.subreddit || "r/NewTubers")}</span>
      </div>

      <div class="card-title">${escapeHtml(t.title)}</div>

      <div class="card-excerpt">
        ${escapeHtml(t.content || "First-person discussion post available directly on Reddit.")}
      </div>

      <div class="card-meta-row">
        <span style="font-size: 0.74rem;">Verified Thread</span>
        <span style="color: #FF5722; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;">
          Open Thread ↗
        </span>
      </div>
    </a>
  `
    )
    .join("");
}

// -------------------------------------------------------------
// Section 3: X Posts
// -------------------------------------------------------------
function renderXPosts(container, posts, count, error) {
  const countBadge = document.getElementById("count-x");
  if (countBadge) countBadge.textContent = count;
  if (!container) return;

  if (error) {
    container.innerHTML = `<div class="empty-col-state" style="color: #F87171;">X search notice: ${escapeHtml(error)}</div>`;
    return;
  }

  if (!posts || posts.length === 0) {
    container.innerHTML = `<div class="empty-col-state">No public X posts retrieved for this specific query.</div>`;
    return;
  }

  container.innerHTML = posts
    .map(
      (p) => `
    <a href="${p.url}" target="_blank" rel="noopener noreferrer" class="evidence-card">
      <div class="x-author-row">
        <span class="x-author-name">${escapeHtml(p.author_name || "Creator")}</span>
        <span class="x-author-handle">${escapeHtml(p.author_handle || "@creator")}</span>
      </div>

      <div class="card-excerpt" style="-webkit-line-clamp: 5;">
        ${escapeHtml(p.content || p.title || "Post text available on X.")}
      </div>

      <div class="card-meta-row">
        <span style="font-size: 0.74rem;">Public Post</span>
        <span style="color: #E2E8F0; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;">
          View on X ↗
        </span>
      </div>
    </a>
  `
    )
    .join("");
}

// -------------------------------------------------------------
// Section 4: Internet Articles & Case Studies
// -------------------------------------------------------------
function renderArticles(container, articles, count, error) {
  const countBadge = document.getElementById("count-art");
  if (countBadge) countBadge.textContent = count;
  if (!container) return;

  if (error) {
    container.innerHTML = `<div class="empty-col-state" style="color: #F87171;">Web search notice: ${escapeHtml(error)}</div>`;
    return;
  }

  if (!articles || articles.length === 0) {
    container.innerHTML = `<div class="empty-col-state">No web articles or case studies found for this query.</div>`;
    return;
  }

  container.innerHTML = articles
    .map(
      (a) => `
    <a href="${a.url}" target="_blank" rel="noopener noreferrer" class="evidence-card">
      <div class="web-domain-badge">
        <span>${escapeHtml(a.domain || "Web Guide")}</span>
      </div>

      <div class="card-title">${escapeHtml(a.title)}</div>

      <div class="card-excerpt">
        ${escapeHtml(a.content || "Case study and platform documentation.")}
      </div>

      <div class="card-meta-row">
        <span style="font-size: 0.74rem;">Publication</span>
        <span style="color: #60A5FA; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;">
          Read Article ↗
        </span>
      </div>
    </a>
  `
    )
    .join("");
}

function formatCount(num) {
  if (!num || isNaN(num)) return "0";
  const n = Number(num);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Auto initialize on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUniversalStruggles);
} else {
  initUniversalStruggles();
}
