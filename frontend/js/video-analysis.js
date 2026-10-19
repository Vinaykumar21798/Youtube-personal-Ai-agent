import { api } from "./api.js";

function showToast(message) {
  const toast = document.getElementById("va-toast");
  const msgEl = document.getElementById("va-toast-msg");
  if (!toast || !msgEl) return;
  msgEl.textContent = message;
  toast.style.display = "flex";
  setTimeout(() => {
    toast.style.display = "none";
  }, 2600);
}

function copyToClipboard(text, successMsg = "Copied to clipboard!") {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => showToast(successMsg));
  } else {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
      showToast(successMsg);
    } catch (err) {
      console.error("Copy failed", err);
    }
    document.body.removeChild(textArea);
  }
}

let currentPayload = null;

export async function runVideoAnalysis(targetUrlOrId) {
  const submitBtn = document.getElementById("va-submit-btn");
  const btnText = document.getElementById("va-btn-text");
  const btnSpinner = document.getElementById("va-btn-spinner");
  const errorAlert = document.getElementById("va-error-alert");
  const errorMsg = document.getElementById("va-error-message");
  const initialState = document.getElementById("va-initial-state");
  const resultsContainer = document.getElementById("va-results-container");

  if (!targetUrlOrId || !targetUrlOrId.trim()) return;

  // Reset states
  errorAlert.style.display = "none";
  submitBtn.disabled = true;
  if (btnText) btnText.textContent = "Analyzing Video...";
  if (btnSpinner) btnSpinner.style.display = "inline-block";

  try {
    const data = await api.post("/videos/analyze", { target: targetUrlOrId.trim() });
    currentPayload = data;

    renderVideoAnalysis(data);

    if (initialState) initialState.style.display = "none";
    if (resultsContainer) resultsContainer.style.display = "block";

    // Update browser URL query without reloading
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("v", data.video.video_id);
    window.history.replaceState({}, "", newUrl.toString());

  } catch (err) {
    console.error("Video analysis request failed:", err);
    errorMsg.textContent = err.message || "Failed to analyze video. Please verify the URL or ID.";
    errorAlert.style.display = "block";
  } finally {
    submitBtn.disabled = false;
    if (btnText) btnText.textContent = "Analyze Video →";
    if (btnSpinner) btnSpinner.style.display = "none";
  }
}

function formatConfidenceBadge(confidence) {
  if (confidence === null || confidence === undefined) return "Verified";
  if (typeof confidence === "number") {
    return confidence <= 1 ? `${Math.round(confidence * 100)}%` : `${confidence}%`;
  }
  const str = String(confidence).trim();
  if (!str) return "Verified";
  const num = Number(str);
  if (!isNaN(num) && isFinite(num) && !str.includes(" ")) {
    return num <= 1 && num > 0 ? `${Math.round(num * 100)}%` : `${num}%`;
  }
  return str.split(" ")[0];
}

function renderVideoAnalysis(data) {
  const v = data.video || {};
  const score = data.performance_score || {};
  const metrics = data.key_metrics || {};
  const retention = data.audience_retention || {};

  // 1. Top Banner
  const bannerWatchBtn = document.getElementById("va-banner-watch-btn");
  if (bannerWatchBtn) bannerWatchBtn.href = v.url || "#";

  // 2. Section B: Video Header
  const thumbEl = document.getElementById("va-video-thumb");
  if (thumbEl && v.thumbnail_url) thumbEl.src = v.thumbnail_url;

  const durationBadge = document.getElementById("va-video-duration-badge");
  if (durationBadge) durationBadge.textContent = v.duration_formatted || "--:--";

  const titleEl = document.getElementById("va-video-title");
  if (titleEl) titleEl.textContent = v.title || "Untitled Video";

  const channelEl = document.getElementById("va-video-channel");
  if (channelEl) channelEl.textContent = v.channel_title || "YouTube Creator";

  const dateEl = document.getElementById("va-video-date");
  if (dateEl) {
    dateEl.textContent = `Published ${v.published_date_formatted || "--"} • ${v.age_days || 0}d ago`;
  }

  const descEl = document.getElementById("va-video-desc");
  if (descEl) descEl.textContent = v.short_description || "No description provided.";

  const watchLink = document.getElementById("va-watch-link");
  if (watchLink) watchLink.href = v.url || "#";

  const copyUrlBtn = document.getElementById("btn-copy-video-url");
  if (copyUrlBtn) {
    copyUrlBtn.onclick = () => copyToClipboard(v.url || window.location.href, "Video URL copied!");
  }

  // 3. Section C: Performance Score
  const scoreValEl = document.getElementById("va-score-val");
  const scoreRatingEl = document.getElementById("va-score-rating");
  const scoreSummaryEl = document.getElementById("va-score-summary");
  const scoreMethodEl = document.getElementById("va-score-methodology");
  const scorePillEl = document.getElementById("va-score-pill");

  if (scoreValEl) {
    scoreValEl.textContent = score.is_available && score.score !== null ? score.score : "--";
  }
  if (scoreRatingEl) scoreRatingEl.textContent = score.rating || "Baseline Evaluation";
  if (scoreSummaryEl) scoreSummaryEl.textContent = score.summary || "";

  if (scorePillEl) {
    scorePillEl.className = `va-badge-pill va-badge-${score.badge_color || "neutral"}`;
    scorePillEl.textContent = score.is_available ? "Verified Score" : "Unavailable State";
  }

  if (scoreMethodEl) {
    const inputsList = (score.inputs_used || []).map((inp) => `<li>${inp}</li>`).join("");
    scoreMethodEl.innerHTML = `
      <p style="margin-bottom: 6px;">${score.methodology || ""}</p>
      ${inputsList ? `<ul style="padding-left: 16px; margin: 4px 0;">${inputsList}</ul>` : ""}
    `;
  }

  // 4. Section D: 5 Key Metrics
  // Views
  const mViews = metrics.views || {};
  const vViewsVal = document.getElementById("va-m-views-val");
  const vViewsDelta = document.getElementById("va-m-views-delta");
  const vViewsLabel = document.getElementById("va-m-views-label");

  if (vViewsVal) vViewsVal.textContent = mViews.value || "--";
  if (vViewsDelta) {
    vViewsDelta.textContent = mViews.delta ? `${mViews.trend === "up" ? "↑ " : mViews.trend === "down" ? "↓ " : ""}${mViews.delta}` : "Baseline establishing";
    vViewsDelta.className = `va-metric-delta va-delta-${mViews.trend || "neutral"}`;
  }
  if (vViewsLabel) vViewsLabel.textContent = mViews.comparison_label || "Verified Public Count";

  // Duration
  const vDurationVal = document.getElementById("va-m-duration-val");
  if (vDurationVal) vDurationVal.textContent = v.duration_formatted || "--:--";

  // Secondary metrics bar
  const sec = metrics.secondary || {};
  const secLikes = document.getElementById("va-sec-likes");
  const secLikeRate = document.getElementById("va-sec-likerate");
  const secComments = document.getElementById("va-sec-comments");

  if (secLikes) secLikes.textContent = sec.likes || "--";
  if (secLikeRate) secLikeRate.textContent = sec.like_rate || "--";
  if (secComments) secComments.textContent = sec.comments || "--";

  // 5. Section E: Audience Retention & Pacing
  const retAvd = document.getElementById("va-ret-avd");
  const retPct = document.getElementById("va-ret-pct");
  if (retAvd) retAvd.textContent = retention.average_view_duration_display || "--";
  if (retPct) retPct.textContent = retention.percentage_viewed_display || "--";

  // Render Pacing breakdown
  const pacingContainer = document.getElementById("va-pacing-container");
  if (pacingContainer) {
    pacingContainer.innerHTML = (retention.pacing_breakdown || []).map((p) => `
      <div class="va-pacing-item">
        <span class="va-timestamp-pill">${p.timestamp}</span>
        <div>
          <div style="font-weight: 700; font-size: 0.82rem; color: #1E293B;">${p.phase}: ${p.title}</div>
          <div style="font-size: 0.74rem; color: #64748B;">Phase: ${p.status}</div>
        </div>
      </div>
    `).join("");
  }

  // Render Drop-offs
  const dropoffsContainer = document.getElementById("va-dropoffs-container");
  if (dropoffsContainer) {
    dropoffsContainer.innerHTML = (retention.drop_off_points || []).map((dp) => `
      <div class="va-dropoff-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span class="va-timestamp-pill" style="background: #92400E; color: #FEF3C7;">${dp.timestamp}</span>
          <span style="font-size: 0.72rem; font-weight: 700; color: #B45309; text-transform: uppercase;">${dp.risk_level}</span>
        </div>
        <div style="font-weight: 700; font-size: 0.84rem; color: #92400E; margin-bottom: 2px;">${dp.point_type}</div>
        <div style="font-size: 0.78rem; color: #78350F; line-height: 1.35;">${dp.explanation}</div>
      </div>
    `).join("");
  }

  // 6. Section F: Key Insights
  const insightsContainer = document.getElementById("va-insights-container");
  if (insightsContainer) {
    insightsContainer.innerHTML = (data.key_insights || []).map((ins, idx) => `
      <div class="va-insight-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
          <div class="va-insight-problem">${idx + 1}. ${ins.problem || ""}</div>
          <span class="va-badge-pill va-badge-lime" style="font-size: 0.65rem; white-space: nowrap;">${formatConfidenceBadge(ins.confidence)}</span>
        </div>
        <div class="va-insight-evidence"><strong>Evidence:</strong> ${ins.evidence || ""}</div>
        <div style="font-size: 0.76rem; color: #64748B; margin-bottom: 4px;"><strong>Baseline:</strong> ${ins.baseline || ""}</div>
        <div style="font-size: 0.78rem; color: #475569; margin-bottom: 6px;"><strong>Root Cause:</strong> ${ins.explanation || ""}</div>
        <div class="va-insight-rec"><strong>Actionable Fix:</strong> ${ins.recommendation || ""}</div>
      </div>
    `).join("");
  }

  // Additional Expandable Insights
  const addInsightsWrap = document.getElementById("va-additional-insights-wrap");
  if (addInsightsWrap) {
    addInsightsWrap.innerHTML = (data.additional_insights || []).map((ins, idx) => `
      <div class="va-insight-card" style="border-left-color: #94A3B8;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
          <div class="va-insight-problem">${idx + 4}. ${ins.problem || ""}</div>
          <span class="va-badge-pill va-badge-neutral" style="font-size: 0.65rem;">${formatConfidenceBadge(ins.confidence)}</span>
        </div>
        <div class="va-insight-evidence"><strong>Evidence:</strong> ${ins.evidence || ""}</div>
        <div class="va-insight-rec"><strong>Actionable Fix:</strong> ${ins.recommendation || ""}</div>
      </div>
    `).join("");
  }

  const moreCountEl = document.getElementById("va-more-insights-count");
  if (moreCountEl) {
    const count = (data.additional_insights || []).length;
    moreCountEl.textContent = count > 0 ? `(${count} more findings) ▾` : "▾";
  }

  // 7. Section G: Title Alternatives & Thumbnail Concepts
  const titlesContainer = document.getElementById("va-titles-container");
  if (titlesContainer) {
    titlesContainer.innerHTML = (data.title_suggestions || []).map((t, idx) => `
      <div class="va-suggestion-box">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span class="va-suggestion-style">Option ${idx + 1} • ${t.style}</span>
          <button type="button" class="va-copy-btn btn-copy-title" data-title="${encodeURIComponent(t.title)}">Copy</button>
        </div>
        <div class="va-suggestion-title">${t.title}</div>
        <div style="font-size: 0.75rem; color: #64748B;">${t.rationale}</div>
      </div>
    `).join("");

    titlesContainer.querySelectorAll(".btn-copy-title").forEach((b) => {
      b.onclick = () => {
        const rawTitle = decodeURIComponent(b.dataset.title);
        copyToClipboard(rawTitle, "Title copied to clipboard!");
      };
    });
  }

  const thumbsContainer = document.getElementById("va-thumbs-container");
  if (thumbsContainer) {
    thumbsContainer.innerHTML = (data.thumbnail_concepts || []).map((tc, idx) => `
      <div class="va-suggestion-box">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span class="va-suggestion-style">Concept ${idx + 1} • ${tc.title_match}</span>
          <button type="button" class="va-copy-btn btn-copy-thumb" data-concept="${encodeURIComponent(tc.main_subject + ' | Overlay: ' + tc.suggested_text)}">Copy Concept</button>
        </div>
        <div style="font-size: 0.82rem; font-weight: 700; color: #1E293B; margin-bottom: 4px;">
          Subject: ${tc.main_subject}
        </div>
        <div style="font-size: 0.76rem; color: #475569; margin-bottom: 3px;">
          <strong>Composition:</strong> ${tc.composition}
        </div>
        <div style="font-size: 0.76rem; color: #475569; margin-bottom: 3px;">
          <strong>Suggested Text:</strong> <span style="background: #111; color: #C4F22C; padding: 1px 5px; border-radius: 3px; font-family: var(--font-mono); font-weight: 700;">${tc.suggested_text}</span> (${tc.text_placement})
        </div>
        <div style="font-size: 0.76rem; color: #64748B;">
          <strong>Contrast & Readability:</strong> ${tc.contrast}
        </div>
      </div>
    `).join("");

    thumbsContainer.querySelectorAll(".btn-copy-thumb").forEach((b) => {
      b.onclick = () => {
        const concept = decodeURIComponent(b.dataset.concept);
        copyToClipboard(concept, "Thumbnail concept copied!");
      };
    });
  }

  // 8. Section H: Similar High-Performing Videos
  const compsContainer = document.getElementById("va-competitors-container");
  if (compsContainer) {
    if (!data.similar_videos || data.similar_videos.length === 0) {
      compsContainer.innerHTML = `<div style="color: #64748B; font-size: 0.84rem; padding: 12px;">No candidate benchmark videos retrieved for this specific query.</div>`;
    } else {
      compsContainer.innerHTML = data.similar_videos.map((comp) => `
        <div class="va-comp-item">
          <img src="${comp.thumbnail_url || '/assets/images/creator-avatar.svg'}" alt="Thumbnail" class="va-comp-thumb">
          <div style="flex: 1; min-width: 0;">
            <a href="${comp.url}" target="_blank" rel="noopener noreferrer" style="font-size: 0.84rem; font-weight: 700; color: #111416; text-decoration: none; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3; margin-bottom: 3px;">
              ${comp.title}
            </a>
            <div style="font-size: 0.74rem; color: #64748B; margin-bottom: 4px;">
              ${comp.channel_title} • <strong>${comp.view_count_formatted} views</strong> (${comp.views_per_day} views/day)
            </div>
            <div style="font-size: 0.74rem; color: #475569; line-height: 1.35; background: #F8FAFC; border: 1px solid #E2E8F0; padding: 4px 8px; border-radius: 4px;">
              ${comp.relevance_explanation}
            </div>
          </div>
        </div>
      `).join("");
    }
  }

  // 9. Section I: Prioritized Next Steps
  const stepsContainer = document.getElementById("va-steps-container");
  if (stepsContainer) {
    stepsContainer.innerHTML = (data.prioritized_steps || []).map((step) => `
      <div class="va-step-card">
        <div class="va-step-header">
          <span class="va-step-num">${step.priority}</span>
          <span style="font-size: 0.86rem; font-weight: 800; color: #111416;">${step.action}</span>
          <span class="va-badge-pill va-badge-neutral" style="margin-left: auto; font-size: 0.65rem;">${step.effort_level}</span>
        </div>
        <div style="font-size: 0.78rem; color: #475569; margin-bottom: 4px;">
          <strong>Problem Addressed:</strong> ${step.problem_addressed}
        </div>
        <div style="font-size: 0.78rem; color: #475569; margin-bottom: 4px;">
          <strong>Supporting Evidence:</strong> ${step.evidence}
        </div>
        <div style="font-size: 0.78rem; color: #166534; background: #F0FDF4; border: 1px solid #BBF7D0; padding: 4px 8px; border-radius: 4px; margin-bottom: 4px;">
          <strong>Expected Impact:</strong> ${step.expected_improvement}
        </div>
        <div style="font-size: 0.74rem; color: #64748B;">
          <strong>How to Measure:</strong> ${step.measurement}
        </div>
      </div>
    `).join("");
  }
}

// Bind DOM event listeners
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("va-input-form");
  const input = document.getElementById("va-target-input");

  if (form && input) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      runVideoAnalysis(input.value);
    });
  }

  // Example Buttons
  const ex1 = document.getElementById("btn-example-1");
  if (ex1) {
    ex1.addEventListener("click", () => {
      const url = "https://www.youtube.com/watch?v=bTMPwUgLZf0";
      if (input) input.value = url;
      runVideoAnalysis(url);
    });
  }

  const ex2 = document.getElementById("btn-example-2");
  if (ex2) {
    ex2.addEventListener("click", () => {
      const url = "https://www.youtube.com/watch?v=UsfpzxZNsPo";
      if (input) input.value = url;
      runVideoAnalysis(url);
    });
  }

  // Share report button
  const shareBtn = document.getElementById("btn-share-report");
  if (shareBtn) {
    shareBtn.addEventListener("click", () => {
      copyToClipboard(window.location.href, "Report URL copied to clipboard!");
    });
  }

  // Toggle More Insights
  const toggleMoreBtn = document.getElementById("btn-toggle-more-insights");
  const addInsightsWrap = document.getElementById("va-additional-insights-wrap");
  if (toggleMoreBtn && addInsightsWrap) {
    toggleMoreBtn.addEventListener("click", () => {
      const isHidden = addInsightsWrap.style.display === "none";
      addInsightsWrap.style.display = isHidden ? "block" : "none";
      toggleMoreBtn.querySelector("span").textContent = isHidden ? "Hide Additional Insights" : "View More Insights";
    });
  }

  // Auto-run if query param 'v' or 'url' is present
  const params = new URLSearchParams(window.location.search);
  const videoParam = params.get("v") || params.get("url") || params.get("video_id");
  if (videoParam) {
    if (input) input.value = videoParam;
    runVideoAnalysis(videoParam);
  }
});
