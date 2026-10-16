import { api } from "./api.js";

export async function loadReport() {
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get("job_id");
  const endpoint = jobId ? `/reports/${jobId}` : "/reports/latest";

  try {
    const report = await api.get(endpoint);

    // Channel metadata & links
    const channelNameEl = document.getElementById("report-channel-name");
    const channelSubEl = document.getElementById("report-channel-sub");
    const dateRangeEl = document.getElementById("report-date-range");
    const channelAvatarEl = document.getElementById("report-channel-avatar");
    const channelLinkEl = document.getElementById("report-channel-link");
    const channelHandleEl = document.getElementById("report-channel-handle");

    if (channelNameEl) channelNameEl.textContent = report.channel_title;
    if (channelSubEl) channelSubEl.textContent = report.subscriber_count || "Channel Verified";
    if (dateRangeEl) dateRangeEl.textContent = report.date_range || "Observed Performance Window";
    if (channelAvatarEl && report.thumbnail_url) channelAvatarEl.src = report.thumbnail_url;
    if (channelLinkEl && report.channel_url) {
      channelLinkEl.href = report.channel_url;
      channelLinkEl.style.display = "inline-flex";
    }
    if (channelHandleEl) channelHandleEl.textContent = report.custom_url || "@channel";

    // Analyzed Video Badge if specific video analyzed
    const analyzedBadgeEl = document.getElementById("report-analyzed-video-badge");
    const analyzedTitleEl = document.getElementById("report-analyzed-video-title");
    const analyzedLinkEl = document.getElementById("report-analyzed-video-link");

    if (report.analyzed_video) {
      if (analyzedBadgeEl) analyzedBadgeEl.style.display = "block";
      if (analyzedTitleEl) analyzedTitleEl.textContent = report.analyzed_video.title || "Analyzed Video";
      if (analyzedLinkEl) {
        const vId = report.analyzed_video.video_id;
        analyzedLinkEl.href = vId ? `https://www.youtube.com/watch?v=${vId}` : (report.channel_url || "#");
      }
    } else if (analyzedBadgeEl) {
      analyzedBadgeEl.style.display = "none";
    }

    // Stat cards (honest public counts & Studio requirements)
    const m = report.metrics_summary;
    if (m) {
      setCard("stat-views", m.total_views?.value, m.total_views?.delta, m.total_views?.trend);
      setCard("stat-ctr", m.ctr?.value, m.ctr?.delta, m.ctr?.trend);
      setCard("stat-retention", m.avg_retention?.value, m.avg_retention?.delta, m.avg_retention?.trend);
      setCard("stat-subscribers", m.subscribers?.value, m.subscribers?.delta, m.subscribers?.trend);
    }

    // Key findings
    const findingsContainer = document.getElementById("report-findings-container");
    if (findingsContainer && report.key_findings) {
      findingsContainer.innerHTML = report.key_findings
        .map(
          (f, idx) => `
        <div class="finding-card">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div class="finding-number">${idx + 1}</div>
            <span class="badge badge-lime">${f.priority ? `${f.priority} Priority` : "Evidence Verified"}</span>
          </div>
          <h3 style="font-size: 1.15rem; color: #F0F2F5;">${f.title}</h3>
          <p style="font-size: 0.88rem; color: #9BA3AB;">${f.description}</p>
          <div style="margin-top: auto; padding-top: 10px; border-top: 1px solid #2A2E32; font-size: 0.82rem; color: #C4F22C;">
            <strong>Recommendation:</strong> ${f.recommendation}
          </div>
        </div>
      `
        )
        .join("");
    }

    // Render Competitor Intelligence Sections
    const compIntel = report.competitor_intelligence || report.metrics_summary?.competitor_intelligence;
    renderCompetitorIntelligence(compIntel);

    // Evidence Sources list with Real Clickable URLs
    const evidenceContainer = document.getElementById("report-evidence-container");
    if (evidenceContainer && report.evidence_sources) {
      evidenceContainer.innerHTML = report.evidence_sources
        .map(
          (ev) => `
        <div style="padding: 14px 18px; background-color: rgba(255,255,255,0.02); border: 1px solid #2A2E32; border-radius: 8px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 8px;">
            <strong style="color: #F0F2F5; font-size: 0.92rem;">${ev.title}</strong>
            <span class="badge badge-tag">${ev.type} • ${(ev.confidence * 100).toFixed(0)}% Conf</span>
          </div>
          <p style="font-size: 0.85rem; color: #8E959B; margin-bottom: ${ev.url ? "10px" : "0"};">${ev.snippet}</p>
          ${
            ev.url
              ? `
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #222629;">
              <a href="${ev.url}" target="_blank" rel="noopener noreferrer" style="color: var(--color-lime); font-size: 0.8rem; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                <span>🔗 Verified Public URL:</span>
                <span style="text-decoration: underline; word-break: break-all;">${ev.url}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              </a>
            </div>
          `
              : ""
          }
        </div>
      `
        )
        .join("");
    }

    // Link Create Content button to Studio with top recommendation or title
    const createBtn = document.getElementById("btn-create-content-from-report");
    if (createBtn) {
      createBtn.addEventListener("click", () => {
        const topFinding = report.key_findings?.[0]?.title || report.channel_title;
        window.location.href = `/content-studio?topic=${encodeURIComponent(topFinding)}`;
      });
    }
  } catch (err) {
    console.error("Failed to load report:", err);
    const container = document.getElementById("report-content-body");
    if (container) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 60px;">
          <h2 style="margin-bottom: 16px;">No Analysis Report Found</h2>
          <p style="color: #9BA3AB; margin-bottom: 24px;">Submit a YouTube channel or video URL on the Analyze page to generate your competitor intelligence report.</p>
          <a href="/analyze" class="btn btn-lime">Go to Analyze →</a>
        </div>
      `;
    }
  }
}

function renderCompetitorIntelligence(intel) {
  const section = document.getElementById("report-competitor-section");
  if (!section) return;

  if (!intel || (!intel.topic_intent && !intel.side_by_side_matrix && !intel.selected_competitors)) {
    // Show polite notice if competitor intelligence was not recorded in an older report
    const topicTitleEl = document.getElementById("report-topic-title");
    const topicDescEl = document.getElementById("report-topic-desc");
    if (topicTitleEl) topicTitleEl.textContent = "Competitor Benchmark Not Generated";
    if (topicDescEl) topicDescEl.textContent = "This historical report was generated before live competitor discovery was run. Submit a URL on the Analyze page to benchmark live competing videos.";
    return;
  }

  // 1. Topic & Intent Header
  try {
    const topic = intel.topic_intent || intel.topic_analysis;
    if (topic) {
      const topicTitleEl = document.getElementById("report-topic-title");
      const topicDescEl = document.getElementById("report-topic-desc");
      const intentBadge = document.getElementById("badge-search-intent");
      const formatBadge = document.getElementById("badge-content-format");
      const audBadge = document.getElementById("badge-audience");

      if (topicTitleEl) topicTitleEl.textContent = `Topic: ${topic.primary_topic || "Topical Audit"}`;
      if (topicDescEl) topicDescEl.textContent = topic.main_problem_addressed || "Grounded topical audit.";
      if (intentBadge) intentBadge.textContent = `Intent: ${topic.search_intent || "Educational"}`;
      if (formatBadge) formatBadge.textContent = `Format: ${topic.content_format || "Video"}`;
      if (audBadge) audBadge.textContent = `Audience: ${topic.intended_audience || "Topic Practitioners"}`;
    }
  } catch (err) {
    console.error("Error rendering topic header:", err);
  }

  // 2. Side-by-Side Comparison Matrix Table
  try {
    const tbodyComp = document.getElementById("report-comparison-tbody");
    const matrix = intel.side_by_side_matrix || [];
    if (tbodyComp) {
      if (matrix.length > 0) {
        tbodyComp.innerHTML = matrix
          .map((row) => {
            const isSub = Boolean(row.is_submitted);
            const bgStyle = isSub ? "background: rgba(200, 240, 73, 0.05); border-left: 3px solid var(--color-lime);" : "";
            const badgeLabel = isSub ? `<span class="badge badge-lime" style="font-size: 0.68rem; margin-right: 6px;">Your Video</span>` : `<span class="badge badge-tag" style="font-size: 0.68rem; margin-right: 6px;">Competitor</span>`;
            const viewsStr = Number(row.view_count || 0).toLocaleString();
            const vpdStr = Number(row.views_per_day || 0).toLocaleString();
            const thumb = row.thumbnail_url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200";

            return `
            <tr style="border-bottom: 1px solid #1E2224; ${bgStyle}">
              <td style="padding: 12px; display: flex; align-items: center; gap: 12px;">
                <img src="${thumb}" alt="Thumbnail" style="width: 52px; height: 32px; object-fit: cover; border-radius: 4px; background: #000; flex-shrink: 0;">
                <div style="max-width: 320px;">
                  <div style="font-weight: 600; color: #F0F2F5; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${badgeLabel}${row.title || "Untitled"}
                  </div>
                  <div style="font-size: 0.75rem; color: #8E959B; margin-top: 2px;">${row.channel_title || ""}</div>
                </div>
              </td>
              <td style="padding: 12px; color: #CBD5E1;">
                <div>${row.published_at || "--"}</div>
                <div style="font-size: 0.72rem; color: #6E7681;">${row.age_days || 0} days ago</div>
              </td>
              <td style="padding: 12px;">
                <div style="font-weight: 600; color: #F0F2F5;">${viewsStr}</div>
                <div style="font-size: 0.74rem; color: var(--color-lime);">${vpdStr} views/day</div>
              </td>
              <td style="padding: 12px; color: #CBD5E1;">${row.duration || "--"}</td>
              <td style="padding: 12px; color: #CBD5E1;">${row.like_rate_percent !== null && row.like_rate_percent !== undefined ? `${row.like_rate_percent}%` : "--"}</td>
              <td style="padding: 12px;">
                ${row.has_timestamps ? `<span style="color: #34D399; font-weight: 600;">✓ Yes</span>` : `<span style="color: #6E7681;">None</span>`}
              </td>
              <td style="padding: 12px; text-align: right;">
                ${
                  row.video_url
                    ? `
                  <a href="${row.video_url}" target="_blank" rel="noopener noreferrer" class="btn btn-dark btn-sm" style="font-size: 0.75rem; padding: 4px 10px;">
                    Watch ↗
                  </a>
                `
                    : "--"
                }
              </td>
            </tr>
          `;
          })
          .join("");
      } else {
        tbodyComp.innerHTML = `<tr><td colspan="7" style="padding: 20px; text-align: center; color: #6E7681;">No competitor matrix available for this upload.</td></tr>`;
      }
    }
  } catch (err) {
    console.error("Error rendering competitor matrix:", err);
  }

  // 3. Side-by-Side Keyword Table
  try {
    const tbodyKeywords = document.getElementById("report-keywords-tbody");
    const keywords = intel.keyword_analysis || [];
    if (tbodyKeywords) {
      if (keywords.length > 0) {
        tbodyKeywords.innerHTML = keywords
          .map((kw) => {
            const statusStr = String(kw.match_status || "");
            const isGap = statusStr.includes("Gap");
            const statusClass = isGap ? "badge-tag" : statusStr.includes("Alignment") ? "badge-lime" : "badge-tag";
            return `
            <tr style="border-bottom: 1px solid #1E2224;">
              <td style="padding: 12px; font-weight: 600; color: #F0F2F5;">${kw.keyword || "--"}</td>
              <td style="padding: 12px; color: #CBD5E1; font-size: 0.82rem;">${kw.submitted_evidence || "--"}</td>
              <td style="padding: 12px; color: #8E959B; font-size: 0.82rem;">${kw.competitor_evidence || "--"}</td>
              <td style="padding: 12px;"><span class="badge ${statusClass}">${kw.match_status || "Observed"}</span></td>
              <td style="padding: 12px; color: #CBD5E1; font-size: 0.82rem;">${kw.opportunity_gap || "--"}</td>
            </tr>
          `;
          })
          .join("");
      } else {
        tbodyKeywords.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #6E7681;">No keyword comparison records found.</td></tr>`;
      }
    }
  } catch (err) {
    console.error("Error rendering keywords table:", err);
  }

  // 4. Hashtag Analysis
  try {
    const hashtagsGrid = document.getElementById("report-hashtags-grid");
    const htData = intel.hashtag_analysis;
    if (hashtagsGrid) {
      if (htData) {
        const sTags = htData.submitted_hashtags || [];
        const missing = htData.missing_competitor_hashtags || [];
        const recommended = htData.recommended_hashtags || [];

        hashtagsGrid.innerHTML = `
          <div style="background: #141719; border: 1px solid #222629; border-radius: 8px; padding: 16px;">
            <h4 style="font-size: 0.88rem; color: #CBD5E1; margin-bottom: 10px; font-weight: 600;">Your Observed Hashtags</h4>
            ${
              sTags.length > 0
                ? `<div style="display: flex; gap: 6px; flex-wrap: wrap;">${sTags.map((t) => `<span class="badge badge-lime">${t}</span>`).join("")}</div>`
                : `<div style="font-size: 0.8rem; color: #6E7681;">No hashtags observed in submitted title or description.</div>`
            }
          </div>

          <div style="background: #141719; border: 1px solid #222629; border-radius: 8px; padding: 16px;">
            <h4 style="font-size: 0.88rem; color: #CBD5E1; margin-bottom: 10px; font-weight: 600;">Competitor Observed Hashtags</h4>
            ${
              missing.length > 0
                ? `<div style="display: flex; gap: 6px; flex-wrap: wrap;">${missing.map((m) => `<span class="badge badge-tag" title="${m.reason || ""}">${m.tag} (${m.competitor_count || 1})</span>`).join("")}</div>`
                : `<div style="font-size: 0.8rem; color: #6E7681;">No recurring competitor hashtags observed.</div>`
            }
          </div>

          <div style="background: #141719; border: 1px solid #222629; border-radius: 8px; padding: 16px;">
            <h4 style="font-size: 0.88rem; color: #CBD5E1; margin-bottom: 10px; font-weight: 600;">Recommended Topical Hashtags</h4>
            ${
              recommended.length > 0
                ? `<div style="display: flex; gap: 6px; flex-wrap: wrap;">${recommended.map((r) => `<span class="badge badge-lime" title="${r.rationale || ""}">${r.tag}</span>`).join("")}</div>`
                : `<div style="font-size: 0.8rem; color: #6E7681;">Hashtag coverage aligns with topic.</div>`
            }
          </div>
        `;
      } else {
        hashtagsGrid.innerHTML = `
          <div style="background: #141719; border: 1px solid #222629; border-radius: 8px; padding: 16px; color: #8E959B; font-size: 0.85rem; grid-column: 1 / -1;">
            No competitor hashtag data available for this report.
          </div>
        `;
      }
    }
  } catch (err) {
    console.error("Error rendering hashtags:", err);
  }

  // 5. Evidence-Grounded Gap Analysis Cards
  try {
    const gapsGrid = document.getElementById("report-gaps-grid");
    const gaps = intel.gap_analysis || [];
    if (gapsGrid) {
      if (gaps.length > 0) {
        gapsGrid.innerHTML = gaps
          .map((gap, i) => {
            const pClass = gap.priority === "High" ? "badge-lime" : "badge-tag";
            return `
            <div class="card" style="padding: 18px 22px; border: 1px solid #26292B; background: #131517;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span class="finding-number" style="width: 24px; height: 24px; font-size: 0.8rem;">${i + 1}</span>
                  <strong style="color: #F0F2F5; font-size: 1rem;">${gap.title || "Gap"}</strong>
                  <span style="font-size: 0.78rem; color: #8E959B;">[${gap.category || "General"}]</span>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <span class="badge ${pClass}">${gap.priority || "Standard"} Priority</span>
                  <span class="badge badge-tag">Effort: ${gap.effort || "Low"}</span>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin: 12px 0; font-size: 0.83rem;">
                <div style="background: rgba(255,255,255,0.02); padding: 10px 14px; border-radius: 6px; border: 1px solid #222629;">
                  <div style="font-size: 0.72rem; color: #8E959B; text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Submitted Video Evidence</div>
                  <div style="color: #CBD5E1;">${gap.submitted_evidence || "None reported"}</div>
                </div>
                <div style="background: rgba(255,255,255,0.02); padding: 10px 14px; border-radius: 6px; border: 1px solid #222629;">
                  <div style="font-size: 0.72rem; color: var(--color-lime); text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Competitor Benchmark Evidence</div>
                  <div style="color: #CBD5E1;">${gap.competitor_evidence || "None reported"}</div>
                </div>
              </div>

              <div style="padding-top: 10px; border-top: 1px solid #202426; font-size: 0.84rem; display: flex; flex-direction: column; gap: 4px;">
                <div><strong style="color: var(--color-lime);">Recommended Action:</strong> <span style="color: #F0F2F5;">${gap.recommended_action || "Refine metadata"}</span></div>
                <div style="font-size: 0.78rem; color: #9BA3AB;"><strong>Expected Benefit (Hypothesis):</strong> ${gap.expected_benefit || "May improve search alignment."}</div>
              </div>
            </div>
          `;
          })
          .join("");
      } else {
        gapsGrid.innerHTML = `
          <div style="padding: 18px 22px; border: 1px solid #26292B; background: #131517; border-radius: 8px; color: #8E959B; font-size: 0.85rem;">
            No competitor gaps detected. Your video metadata closely matches topical competitor benchmarks.
          </div>
        `;
      }
    }
  } catch (err) {
    console.error("Error rendering gaps:", err);
  }

  // 6. Prioritized Action Plan
  try {
    const planContainer = document.getElementById("report-action-plan-container");
    const plan = intel.action_plan || [];
    if (planContainer) {
      if (plan.length > 0) {
        planContainer.innerHTML = plan
          .map(
            (step) => `
          <div style="display: flex; gap: 14px; align-items: flex-start; padding: 12px 16px; background: rgba(0,0,0,0.25); border: 1px solid #262A2D; border-radius: 6px;">
            <div style="width: 26px; height: 26px; border-radius: 50%; background: var(--color-lime); color: #111; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; flex-shrink: 0;">
              ${step.step || "•"}
            </div>
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px; flex-wrap: wrap;">
                <strong style="color: #F0F2F5; font-size: 0.92rem;">${step.action || "Action item"}</strong>
                <span class="badge ${step.priority === "High" ? "badge-lime" : "badge-tag"}" style="font-size: 0.7rem;">${step.priority || "Normal"}</span>
              </div>
              <div style="font-size: 0.82rem; color: #9BA3AB; margin-bottom: 4px;">${step.rationale || ""}</div>
              <div style="font-size: 0.75rem; color: #6E7681;"><strong>Validation:</strong> ${step.validation_method || "Track analytics over 7 days"}</div>
            </div>
          </div>
        `
          )
          .join("");
      } else {
        planContainer.innerHTML = `
          <div style="padding: 14px 18px; background: rgba(0,0,0,0.25); border: 1px solid #262A2D; border-radius: 6px; color: #8E959B; font-size: 0.85rem;">
            No pending action items required for this video.
          </div>
        `;
      }
    }
  } catch (err) {
    console.error("Error rendering action plan:", err);
  }
}

function setCard(id, val, delta, trend) {
  const vEl = document.getElementById(`${id}-val`);
  const dEl = document.getElementById(`${id}-delta`);
  if (vEl) vEl.textContent = val || "--";
  if (dEl) {
    dEl.textContent = delta || "";
    dEl.className = `stat-delta ${trend || ""}`;
  }
}

// Immediate execution guard for ES module loading
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadReport);
} else {
  loadReport();
}

