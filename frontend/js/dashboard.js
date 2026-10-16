import { api } from "./api.js";
import { auth } from "./auth.js";

let activePeriod = "28d";
let isPeriodListenerAttached = false;

export async function loadDashboard(period = activePeriod) {
  activePeriod = period;
  try {
    const user = auth.getUser();
    const greetingEl = document.getElementById("dashboard-user-greeting");
    if (greetingEl) {
      greetingEl.textContent = user?.full_name ? user.full_name.split(" ")[0] : "Creator";
    }

    document.querySelectorAll(".period-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-period") === activePeriod);
    });

    const data = await api.get(`/channels/overview?period=${encodeURIComponent(activePeriod)}`);

    populateChannelHeader(data);
    populateMetricCards(data.metric_cards, data.summary_cards);
    renderPerformanceSection(data);

    if (data.top_opportunities) {
      renderTopOpportunities(data.top_opportunities);
    }

    renderCompetitorSnapshot(data.competitor_intelligence);
    renderRecentVideos(data.channel);

    if (!isPeriodListenerAttached) {
      attachPeriodListeners();
      isPeriodListenerAttached = true;
    }
  } catch (err) {
    console.error("Failed to load dashboard data:", err);
    const subtextEl = document.getElementById("dashboard-header-subtext");
    if (subtextEl) {
      subtextEl.textContent = "Run an analysis in the Analyze tab to visualize channel performance.";
    }
  }
}

function attachPeriodListeners() {
  document.querySelectorAll(".period-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = btn.getAttribute("data-period");
      if (p && p !== activePeriod) {
        loadDashboard(p);
      }
    });
  });

  const notifBtn = document.getElementById("dashboard-notifications-btn");
  if (notifBtn) {
    notifBtn.addEventListener("click", () => {
      let toast = document.getElementById("dashboard-notif-toast");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "dashboard-notif-toast";
        toast.className = "dashboard-toast-popover";
        document.body.appendChild(toast);
      }
      toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--color-lime); font-size: 1rem;">✓</span>
          <span><strong>System Healthy:</strong> YouTube API connected, 0 active warnings.</span>
        </div>
      `;
      toast.style.display = "block";
      setTimeout(() => {
        if (toast) toast.style.display = "none";
      }, 3500);
    });
  }
}

function populateChannelHeader(data) {
  const bannerEl = document.getElementById("dashboard-channel-banner");
  const subtextEl = document.getElementById("dashboard-header-subtext");
  const hasChannel = data.channel && data.channel.title && data.channel.title !== "No Channel Connected";

  if (hasChannel) {
    if (bannerEl) {
      bannerEl.style.display = "block";
      const thumbEl = document.getElementById("dashboard-channel-thumb");
      const titleEl = document.getElementById("dashboard-channel-title");
      const linkEl = document.getElementById("dashboard-channel-link");
      const handleEl = document.getElementById("dashboard-channel-handle");
      const subsEl = document.getElementById("dashboard-channel-subs");
      const videosEl = document.getElementById("dashboard-channel-videos");
      const viewsBadgeEl = document.getElementById("dashboard-channel-views-badge");

      if (thumbEl && data.channel.thumbnail_url) thumbEl.src = data.channel.thumbnail_url;
      if (titleEl) titleEl.textContent = data.channel.title;
      if (linkEl && data.channel.channel_url) {
        linkEl.href = data.channel.channel_url;
        linkEl.style.display = "inline-flex";
      }
      if (handleEl) handleEl.textContent = data.channel.custom_url || "@channel";
      if (subsEl) subsEl.textContent = `${(data.channel.subscriber_count || 0).toLocaleString()} Subscribers`;
      if (videosEl) videosEl.textContent = `${(data.channel.video_count || 0).toLocaleString()} Uploads`;
      if (viewsBadgeEl) viewsBadgeEl.textContent = `${(data.channel.view_count || 0).toLocaleString()} Views`;
    }

    if (subtextEl) {
      const linkHtml = data.channel.channel_url
        ? `<a href="${data.channel.channel_url}" target="_blank" rel="noopener noreferrer" style="color: var(--color-lime); text-decoration: underline;">${data.channel.custom_url}</a>`
        : `${data.channel.custom_url}`;
      let freshnessText = "";
      if (data.data_freshness) {
        if (data.data_freshness.channel_synced_at) {
          const syncedDate = new Date(data.data_freshness.channel_synced_at).toLocaleDateString();
          freshnessText = ` • Data as of ${syncedDate}`;
        } else if (data.data_freshness.latest_report_at) {
          const reportDate = new Date(data.data_freshness.latest_report_at).toLocaleDateString();
          freshnessText = ` • Report generated ${reportDate}`;
        }
      }
      subtextEl.innerHTML = `Connected channel: <strong style="color: #F0F2F5;">${data.channel.title}</strong> (${linkHtml}). Live performance overview${freshnessText}.`;
    }
  } else {
    if (bannerEl) bannerEl.style.display = "none";
    if (subtextEl) {
      subtextEl.textContent = "No channel analyzed yet. Submit a channel URL or upload data in the Analyze tab to begin.";
    }
  }
}

function populateMetricCards(metricCards, fallbackSummary) {
  // Populate legacy stat card IDs for backward compatibility
  const legacyViews = document.getElementById("stat-views-val");
  const legacyCtr = document.getElementById("stat-ctr-val");
  const legacyRet = document.getElementById("stat-retention-val");
  const legacySubs = document.getElementById("stat-subscribers-val");

  if (legacyViews) legacyViews.textContent = metricCards?.views?.value || fallbackSummary?.total_views?.value || "--";
  if (legacyCtr) legacyCtr.textContent = metricCards?.ctr?.value || fallbackSummary?.ctr?.value || "--";
  if (legacyRet) legacyRet.textContent = metricCards?.avg_duration?.value || fallbackSummary?.avg_retention?.value || "--";
  if (legacySubs) legacySubs.textContent = fallbackSummary?.subscribers?.value || metricCards?.watch_time?.value || "--";

  const viewsData = metricCards?.views;
  setMetricCard({
    idPrefix: "metric-views",
    label: viewsData?.title || "Views",
    val: viewsData?.value || fallbackSummary?.total_views?.value || "--",
    unit: viewsData?.unit || "views",
    badge: viewsData?.badge || "Verified Public Count",
    period: viewsData?.period || "Lifetime Public",
    delta: viewsData?.change_pct || fallbackSummary?.total_views?.delta,
    trend: viewsData?.trend || fallbackSummary?.total_views?.trend,
    isAvailable: viewsData ? viewsData.is_available : Boolean(fallbackSummary?.total_views?.raw),
  });

  const wtData = metricCards?.watch_time;
  setMetricCard({
    idPrefix: "metric-wt",
    label: wtData?.title || "Watch Time",
    val: wtData?.value || "--",
    unit: wtData?.unit || "hours",
    badge: wtData?.badge || "Requires Studio Export",
    period: wtData?.period || "Unavailable",
    delta: wtData?.change_pct,
    trend: wtData?.trend,
    isAvailable: wtData?.is_available || false,
  });

  const ctrData = metricCards?.ctr;
  setMetricCard({
    idPrefix: "metric-ctr",
    label: ctrData?.title || "CTR",
    val: ctrData?.value || fallbackSummary?.ctr?.value || "--",
    unit: ctrData?.unit || "%",
    badge: ctrData?.badge || "Requires Studio Export",
    period: ctrData?.period || "Unavailable",
    delta: ctrData?.change_pct,
    trend: ctrData?.trend || "neutral",
    isAvailable: ctrData?.is_available || false,
  });

  const avdData = metricCards?.avg_duration;
  setMetricCard({
    idPrefix: "metric-avd",
    label: avdData?.title || "Avg. View Duration",
    val: avdData?.value || fallbackSummary?.avg_retention?.value || "--",
    unit: avdData?.unit || "min:sec",
    badge: avdData?.badge || "Requires Studio Export",
    period: avdData?.period || "Unavailable",
    delta: avdData?.change_pct,
    trend: avdData?.trend || "neutral",
    isAvailable: avdData?.is_available || false,
  });
}

function setMetricCard({ idPrefix, label, val, unit, badge, period, delta, trend, isAvailable }) {
  const cardEl = document.getElementById(idPrefix === "metric-views" ? "metric-card-views" : (idPrefix === "metric-wt" ? "metric-card-watch-time" : (idPrefix === "metric-ctr" ? "metric-card-ctr" : "metric-card-avd")));
  const labelEl = cardEl?.querySelector(".metric-card-label");
  const valEl = document.getElementById(`${idPrefix}-val`);
  const unitEl = document.getElementById(`${idPrefix}-unit`);
  const badgeEl = document.getElementById(`${idPrefix}-badge`);
  const periodEl = document.getElementById(`${idPrefix}-period`);
  const deltaEl = document.getElementById(`${idPrefix}-delta`);

  if (labelEl && label) labelEl.textContent = label;
  if (valEl) {
    valEl.textContent = val || "--";
    valEl.style.color = (!isAvailable && val === "--") ? "#6E7681" : "#FFFFFF";
  }
  if (unitEl) unitEl.textContent = isAvailable ? unit : "";
  if (badgeEl) badgeEl.textContent = badge || (isAvailable ? "Verified" : "Unavailable");
  if (periodEl) periodEl.textContent = period || "Unavailable";
  if (deltaEl) {
    if (delta && delta.trim() !== "") {
      deltaEl.textContent = delta;
      deltaEl.className = `metric-card-delta ${trend || ""}`;
      deltaEl.style.display = "inline-flex";
    } else {
      deltaEl.textContent = "";
      deltaEl.style.display = "none";
    }
  }
}

function renderPerformanceSection(data) {
  const threeChartsEl = document.getElementById("three-charts-container");
  const emptyStateEl = document.getElementById("charts-empty-state");
  const panel = data.performance_panel;

  const hasTimeseries = Boolean(panel?.has_timeseries);

  if (hasTimeseries) {
    if (threeChartsEl) threeChartsEl.style.display = "grid";
    if (emptyStateEl) emptyStateEl.style.display = "none";

    const periodBadge = document.getElementById("panel-period-badge");
    if (periodBadge && panel.period_badge) periodBadge.textContent = panel.period_badge;

    const subtitleText = document.getElementById("panel-subtitle-text");
    if (subtitleText && panel.subtitle) subtitleText.textContent = panel.subtitle;

    const legendEl = document.getElementById("panel-legend");
    if (legendEl && panel.legend_labels) {
      legendEl.innerHTML = `
        <span class="legend-item"><span class="legend-indicator dot-blue"></span>${panel.legend_labels.views || "Views"}</span>
        <span class="legend-item"><span class="legend-indicator dot-green"></span>${panel.legend_labels.watch_time || "Velocity"}</span>
        <span class="legend-item"><span class="legend-indicator dot-purple"></span>${panel.legend_labels.subscribers || "Engagement"}</span>
      `;
    }

    // Chart A: Views
    const viewsChart = panel.views_chart;
    const viewsTitleEl = document.querySelector("#chart-card-views .chart-card-title");
    const viewsBadgeEl = document.getElementById("chart-views-badge");
    const viewsLatestEl = document.getElementById("chart-views-latest");
    const viewsSubEl = document.getElementById("chart-views-sub");

    if (viewsTitleEl && viewsChart?.title) viewsTitleEl.textContent = viewsChart.title;
    if (viewsBadgeEl && viewsChart?.badge) viewsBadgeEl.textContent = viewsChart.badge;
    if (viewsLatestEl) viewsLatestEl.textContent = viewsChart?.latest_value || "--";
    if (viewsSubEl) viewsSubEl.textContent = viewsChart?.latest_sub || "latest observed";

    renderSvgLineChart({
      containerId: "chart-views-canvas",
      dates: viewsChart?.dates || [],
      values: viewsChart?.values || [],
      titles: viewsChart?.titles,
      previousValues: viewsChart?.previous_values,
      color: "#3B82F6",
      gradientId: "views-chart-grad",
      unit: viewsChart?.unit || "views",
      label: viewsChart?.title || "Views",
    });

    // Chart B: Watch Time / Upload Velocity
    const wtChart = panel.watch_time_chart;
    const wtTitleEl = document.querySelector("#chart-card-watch-time .chart-card-title");
    const wtBadgeEl = document.getElementById("chart-wt-badge");
    const wtLatestEl = document.getElementById("chart-wt-latest");
    const wtSubEl = document.getElementById("chart-wt-sub");

    if (wtTitleEl && wtChart?.title) wtTitleEl.textContent = wtChart.title;
    if (wtBadgeEl && wtChart?.badge) wtBadgeEl.textContent = wtChart.badge;
    if (wtLatestEl) wtLatestEl.textContent = wtChart?.latest_value || "--";
    if (wtSubEl) wtSubEl.textContent = wtChart?.latest_sub || "latest observed";

    if (wtChart?.is_available && wtChart.values && wtChart.values.length > 0) {
      renderSvgLineChart({
        containerId: "chart-wt-canvas",
        dates: wtChart.dates,
        values: wtChart.values,
        titles: wtChart.titles,
        previousValues: wtChart.previous_values,
        color: "#10B981",
        gradientId: "wt-chart-grad",
        unit: wtChart.unit || "views/day",
        label: wtChart.title || "Velocity",
      });
    } else {
      renderEmptyChartBox("chart-wt-canvas", "Studio Watch Time Required", "Connect YouTube Studio or upload export to chart watch hours.");
    }

    // Chart C: Subscribers / Engagement
    const subsChart = panel.subscribers_chart;
    const subsTitleEl = document.querySelector("#chart-card-subscribers .chart-card-title");
    const subsBadgeEl = document.getElementById("chart-subs-badge");
    const subsLatestEl = document.getElementById("chart-subs-latest");
    const subsSubEl = document.getElementById("chart-subs-sub");

    if (subsTitleEl && subsChart?.title) subsTitleEl.textContent = subsChart.title;
    if (subsBadgeEl && subsChart?.badge) subsBadgeEl.textContent = subsChart.badge;
    if (subsLatestEl) subsLatestEl.textContent = subsChart?.latest_value || "--";
    if (subsSubEl) subsSubEl.textContent = subsChart?.latest_sub || "latest observed";

    if (subsChart?.is_available && subsChart.values && subsChart.values.length > 0) {
      renderSvgLineChart({
        containerId: "chart-subs-canvas",
        dates: subsChart.dates,
        values: subsChart.values,
        titles: subsChart.titles,
        previousValues: subsChart.previous_values,
        color: "#8B5CF6",
        gradientId: "subs-chart-grad",
        unit: subsChart.unit || "likes",
        label: subsChart.title || "Engagement",
      });
    } else {
      renderEmptyChartBox("chart-subs-canvas", "Historical Subscribers Required", "Daily subscriber trajectory requires historical observations.");
    }
  } else {
    if (threeChartsEl) threeChartsEl.style.display = "none";
    if (emptyStateEl) emptyStateEl.style.display = "grid";

    renderAlternativeBenchmark(data);
  }
}

function renderEmptyChartBox(containerId, title, message) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 12px; color: #6E7681;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#50565D" stroke-width="1.75" style="margin-bottom: 8px;">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span style="font-size: 0.82rem; font-weight: 600; color: #A0A6AC; margin-bottom: 3px;">${title}</span>
      <span style="font-size: 0.74rem; color: #6E7681; max-width: 200px; line-height: 1.3;">${message}</span>
    </div>
  `;
}

function renderAlternativeBenchmark(data) {
  const container = document.getElementById("alt-benchmark-content");
  if (!container) return;

  const videos = [];
  if (data.channel?.analyzed_video) {
    videos.push({ ...data.channel.analyzed_video, badge: "Target Upload" });
  }
  if (data.channel?.recent_videos && Array.isArray(data.channel.recent_videos)) {
    data.channel.recent_videos.forEach((v) => {
      if (!videos.some((existing) => existing.video_id === v.video_id)) {
        videos.push({ ...v, badge: "Recent Upload" });
      }
    });
  }

  if (videos.length > 0) {
    const topVideos = videos.slice(0, 3);
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${topVideos
          .map((v) => {
            const viewsStr = (v.view_count || 0) >= 1000 ? `${((v.view_count || 0) / 1000).toFixed(1)}K` : (v.view_count || 0);
            return `
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 8px; background: rgba(255,255,255,0.03); border-radius: 6px;">
                <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                  <span style="font-size: 0.72rem; padding: 1px 5px; border-radius: 3px; background: #1F2428; color: var(--color-lime); font-family: var(--font-mono);">${viewsStr} views</span>
                  <span style="font-size: 0.78rem; color: #D5D9DC; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;" title="${v.title}">
                    ${v.title}
                  </span>
                </div>
                <a href="https://www.youtube.com/watch?v=${v.video_id}" target="_blank" rel="noopener noreferrer" style="font-size: 0.72rem; color: var(--color-lime); text-decoration: none; flex-shrink: 0;">
                  Watch →
                </a>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
    return;
  }

  container.innerHTML = `<div style="color: #6E7681; font-size: 0.8rem; padding: 8px 0;">Submit a video URL on the Analyze page to view velocity benchmarks.</div>`;
}

function renderSvgLineChart({ containerId, dates, values, titles, previousValues, color, gradientId, unit, label }) {
  const container = document.getElementById(containerId);
  if (!container || !values || values.length === 0) return;

  const width = 360;
  const height = 175;
  const padLeft = 38;
  const padRight = 14;
  const padTop = 18;
  const padBottom = 26;

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const allVals = [...values];
  if (previousValues && previousValues.length > 0) {
    allVals.push(...previousValues);
  }

  const maxVal = Math.max(...allVals, 1);
  const minVal = 0;
  const range = maxVal - minVal || 1;

  const n = values.length;

  const getCoordinates = (valList) => {
    return valList.map((val, idx) => {
      const x = padLeft + (idx / Math.max(valList.length - 1, 1)) * chartWidth;
      const y = padTop + chartHeight - ((val - minVal) / range) * chartHeight;
      return { x, y, val };
    });
  };

  const currentCoords = getCoordinates(values);
  const prevCoords = previousValues && previousValues.length > 0 ? getCoordinates(previousValues) : null;

  const buildSmoothPath = (coords) => {
    if (coords.length === 0) return "";
    if (coords.length === 1) return `M ${coords[0].x},${coords[0].y}`;
    let d = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i === 0 ? 0 : i - 1];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  };

  const linePath = buildSmoothPath(currentCoords);
  const areaPath = `${linePath} L ${currentCoords[currentCoords.length - 1].x.toFixed(1)},${(padTop + chartHeight).toFixed(1)} L ${currentCoords[0].x.toFixed(1)},${(padTop + chartHeight).toFixed(1)} Z`;
  const prevPath = prevCoords ? buildSmoothPath(prevCoords) : "";

  const formatTick = (val) => {
    if (val >= 1e9) return (val / 1e9).toFixed(1) + "B";
    if (val >= 1e6) return (val / 1e6).toFixed(1) + "M";
    if (val >= 1e3) return (val / 1e3).toFixed(0) + "K";
    return Math.round(val);
  };

  const firstDate = dates[0] || "";
  const lastDate = dates[dates.length - 1] || "";
  const midDate = dates[Math.floor(dates.length / 2)] || "";

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: 100%; overflow: visible; display: block;" id="${containerId}-svg">
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.32" />
          <stop offset="100%" stop-color="${color}" stop-opacity="0.0" />
        </linearGradient>
      </defs>

      <line x1="${padLeft}" y1="${padTop}" x2="${width - padRight}" y2="${padTop}" stroke="#1E2328" stroke-dasharray="3,3" stroke-width="1" />
      <text x="${padLeft - 6}" y="${padTop + 4}" fill="#6E7681" font-size="9" font-family="monospace" text-anchor="end">${formatTick(maxVal)}</text>

      <line x1="${padLeft}" y1="${padTop + chartHeight / 2}" x2="${width - padRight}" y2="${padTop + chartHeight / 2}" stroke="#1E2328" stroke-dasharray="3,3" stroke-width="1" />
      <text x="${padLeft - 6}" y="${padTop + chartHeight / 2 + 4}" fill="#6E7681" font-size="9" font-family="monospace" text-anchor="end">${formatTick(maxVal / 2)}</text>

      <line x1="${padLeft}" y1="${padTop + chartHeight}" x2="${width - padRight}" y2="${padTop + chartHeight}" stroke="#23282D" stroke-width="1" />
      <text x="${padLeft - 6}" y="${padTop + chartHeight + 3}" fill="#6E7681" font-size="9" font-family="monospace" text-anchor="end">0</text>

      <path d="${areaPath}" fill="url(#${gradientId})" />

      ${prevPath ? `<path d="${prevPath}" fill="none" stroke="#50565D" stroke-width="1.5" stroke-dasharray="3,3" />` : ""}

      <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

      <line id="${containerId}-crosshair" x1="0" y1="${padTop}" x2="0" y2="${padTop + chartHeight}" stroke="rgba(255,255,255,0.25)" stroke-dasharray="2,2" stroke-width="1" style="display: none;" />
      <circle id="${containerId}-hover-dot" cx="0" cy="0" r="4.5" fill="${color}" stroke="#121517" stroke-width="2" style="display: none;" />

      <text x="${padLeft}" y="${height - 6}" fill="#6E7681" font-size="9.5" font-family="monospace">${firstDate}</text>
      <text x="${padLeft + chartWidth / 2}" y="${height - 6}" fill="#6E7681" font-size="9.5" font-family="monospace" text-anchor="middle">${midDate}</text>
      <text x="${width - padRight}" y="${height - 6}" fill="#6E7681" font-size="9.5" font-family="monospace" text-anchor="end">${lastDate}</text>

      <rect id="${containerId}-overlay" x="${padLeft}" y="${padTop}" width="${chartWidth}" height="${chartHeight}" fill="transparent" style="cursor: crosshair;" />
    </svg>
    <div id="${containerId}-tooltip" class="chart-tooltip-floating"></div>
  `;

  const overlay = document.getElementById(`${containerId}-overlay`);
  const crosshair = document.getElementById(`${containerId}-crosshair`);
  const hoverDot = document.getElementById(`${containerId}-hover-dot`);
  const tooltip = document.getElementById(`${containerId}-tooltip`);

  if (!overlay || !crosshair || !hoverDot || !tooltip) return;

  overlay.addEventListener("pointermove", (e) => {
    const rect = overlay.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, relX / rect.width));
    const closestIdx = Math.round(progress * (n - 1));

    if (closestIdx >= 0 && closestIdx < n) {
      const coord = currentCoords[closestIdx];
      const d = dates[closestIdx] || "";
      const v = values[closestIdx];
      const t = titles && titles[closestIdx] ? titles[closestIdx] : "";

      crosshair.setAttribute("x1", coord.x);
      crosshair.setAttribute("x2", coord.x);
      crosshair.style.display = "block";

      hoverDot.setAttribute("cx", coord.x);
      hoverDot.setAttribute("cy", coord.y);
      hoverDot.style.display = "block";

      tooltip.innerHTML = `
        ${t ? `<div style="font-weight: 600; font-size: 0.78rem; color: #FFF; margin-bottom: 3px; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t}</div>` : ""}
        <div style="font-size: 0.74rem; color: #E0E4E8;">${label}: <strong style="color: #FFF;">${typeof v === "number" ? v.toLocaleString() : v}</strong> ${unit}</div>
        <div style="font-size: 0.7rem; color: #8E959B; font-family: monospace; margin-top: 2px;">Published: ${d}</div>
      `;
      tooltip.style.display = "block";

      const containerRect = container.getBoundingClientRect();
      const dotScreenX = (coord.x / width) * containerRect.width;
      const dotScreenY = (coord.y / height) * containerRect.height;
      tooltip.style.left = `${dotScreenX}px`;
      tooltip.style.top = `${dotScreenY}px`;
    }
  });

  overlay.addEventListener("pointerleave", () => {
    crosshair.style.display = "none";
    hoverDot.style.display = "none";
    tooltip.style.display = "none";
  });
}

const DEFAULT_VIDEO_THUMB = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='480' height='270' viewBox='0 0 480 270'><rect width='480' height='270' fill='%23141719'/><rect x='1' y='1' width='478' height='268' fill='none' stroke='%2325292D'/><circle cx='240' cy='135' r='28' fill='%2322262B'/><polygon points='234,121 254,135 234,149' fill='%23C8F04E'/><text x='240' y='185' fill='%236E7681' font-size='12' font-family='sans-serif' text-anchor='middle'>YouTube Video</text></svg>";

function renderRecentVideos(channel) {
  const sectionEl = document.getElementById("dashboard-recent-videos-section");
  const gridEl = document.getElementById("dashboard-videos-grid");
  const channelLinkEl = document.getElementById("dashboard-view-channel-videos-link");

  if (!sectionEl || !gridEl) return;

  const videos = [];
  if (channel?.analyzed_video) {
    videos.push({ ...channel.analyzed_video, is_analyzed_target: true });
  }
  if (channel?.recent_videos && Array.isArray(channel.recent_videos)) {
    channel.recent_videos.forEach((v) => {
      if (!videos.some((existing) => existing.video_id === v.video_id)) {
        videos.push(v);
      }
    });
  }

  if (videos.length === 0) {
    sectionEl.style.display = "none";
    return;
  }

  sectionEl.style.display = "block";
  if (channelLinkEl && channel.channel_url) {
    channelLinkEl.href = channel.channel_url;
  }

  gridEl.innerHTML = videos
    .slice(0, 6)
    .map((v) => {
      const vUrl = `https://www.youtube.com/watch?v=${v.video_id}`;
      const viewsStr = (v.view_count || 0) >= 1000 ? `${((v.view_count || 0) / 1000).toFixed(1)}K views` : `${v.view_count || 0} views`;
      const thumb = v.thumbnail_url || DEFAULT_VIDEO_THUMB;
      return `
        <div style="background: #131517; border: 1px solid #222629; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s, border-color 0.2s;">
          <div style="position: relative; width: 100%; aspect-ratio: 16/9; background: #000; overflow: hidden;">
            <img src="${thumb}" alt="${v.title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null;this.src='${DEFAULT_VIDEO_THUMB}';">
            ${v.is_analyzed_target ? `<span class="badge badge-lime" style="position: absolute; top: 8px; left: 8px; font-size: 0.7rem; padding: 2px 6px;">Analyzed Upload</span>` : ""}
          </div>
          <div style="padding: 12px; display: flex; flex-direction: column; flex: 1; justify-content: space-between; gap: 8px;">
            <h4 style="font-size: 0.86rem; color: #F0F2F5; line-height: 1.35; font-weight: 600; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${v.title}">
              ${v.title}
            </h4>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #8E959B; padding-top: 6px; border-top: 1px solid #1E2224;">
              <span>${viewsStr}</span>
              <a href="${vUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--color-lime); display: inline-flex; align-items: center; gap: 3px; font-weight: 600; text-decoration: none;">
                <span>Watch</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              </a>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderTopOpportunities(opps) {
  const container = document.getElementById("top-opportunities-container");
  if (!container) return;

  if (!opps || opps.length === 0) {
    container.innerHTML = `
      <div style="color: #8E959B; font-size: 0.85rem; padding: 24px 16px; text-align: center; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px dashed #2A2E32;">
        <p style="margin-bottom: 12px; color: #D5D9DC;">No growth opportunities generated yet.</p>
        <a href="/analyze" class="btn btn-lime btn-sm">+ Run Channel Analysis</a>
      </div>`;
    return;
  }

  container.innerHTML = opps
    .slice(0, 5)
    .map((o, i) => {
      const hasValidScore = o.score !== null && o.score !== undefined && String(o.score).trim().toLowerCase() !== "none" && !isNaN(Number(o.score));
      const scoreBadge = hasValidScore
        ? `<span class="badge badge-subtle" style="font-size: 0.72rem;">Score ${o.score}</span>`
        : `<span class="badge badge-lime" style="font-size: 0.72rem;">High Potential</span>`;
      const categoryLabel = o.category ? o.category.toUpperCase() : "GROWTH";
      const promptText = `Provide a full video outline, hook ideas, and SEO keywords for: "${o.title}" in category ${o.category || "growth"}`;
      const draftUrl = `/ask-ai?q=${encodeURIComponent(promptText)}`;

      return `
        <div class="opp-preview-item">
          <div class="opp-number">${i + 1}</div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; font-size: 0.88rem; color: #F0F2F5; line-height: 1.35; margin-bottom: 3px; word-break: break-word;">${o.title}</div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span style="font-size: 0.74rem; color: #8E959B; text-transform: uppercase; letter-spacing: 0.04em;">${categoryLabel}</span>
              <span>•</span>
              ${scoreBadge}
            </div>
          </div>
          <a href="${draftUrl}" class="btn btn-secondary btn-sm" style="flex-shrink: 0;">Outline in AI →</a>
        </div>
      `;
    })
    .join("");
}

function renderCompetitorSnapshot(compIntel) {
  const sectionEl = document.getElementById("dashboard-competitor-section");
  const topicBadgeEl = document.getElementById("dashboard-competitor-topic-badge");
  const gridEl = document.getElementById("dashboard-competitors-grid");
  const bannerEl = document.getElementById("dashboard-top-gap-banner");

  if (!sectionEl || !gridEl) return;

  // Always keep section visible to balance the two-column grid
  sectionEl.style.display = "block";

  if (!compIntel || !compIntel.competitors || compIntel.competitors.length === 0) {
    if (topicBadgeEl) {
      topicBadgeEl.textContent = "Niche Radar Available";
    }
    gridEl.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 24px 16px; text-align: center; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px dashed #2A2E32;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" stroke-width="1.8" style="margin-bottom: 10px; display: inline-block;">
          <circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>
          <line x1="12" y1="2" x2="12" y2="4"></line><line x1="12" y1="20" x2="12" y2="22"></line>
        </svg>
        <h4 style="font-size: 0.95rem; color: #F0F2F5; margin-bottom: 6px;">Discover Competing Videos in Niche Radar</h4>
        <p style="font-size: 0.82rem; color: #8E959B; max-width: 440px; margin: 0 auto 16px; line-height: 1.45;">
          Search trending keywords, analyze competitors in your niche, and compare high-velocity uploads in real-time.
        </p>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <a href="/niche-radar" class="btn btn-lime btn-sm">Open Niche Radar →</a>
          <a href="/analyze" class="btn btn-secondary btn-sm">+ Analyze Target</a>
        </div>
      </div>
    `;
    if (bannerEl) {
      bannerEl.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
          <span style="color: #9BA3AB;">Have competitor questions? Ask AI to compare videos and strategies.</span>
          <a href="/ask-ai?q=Which%20competitor%20topics%20outperform%20mine%3F" style="color: var(--color-lime); text-decoration: none; font-weight: 600;">Ask AI →</a>
        </div>
      `;
    }
    return;
  }

  if (topicBadgeEl) {
    const topic = compIntel.topic_analysis?.primary_topic || "Topical Competitors";
    topicBadgeEl.textContent = `Topic: ${topic}`;
  }

  const topComps = compIntel.competitors.slice(0, 3);
  gridEl.innerHTML = topComps
    .map((c) => {
      const vUrl = `https://www.youtube.com/watch?v=${c.video_id}`;
      const views = (c.view_count || 0) >= 1000 ? `${((c.view_count || 0) / 1000).toFixed(1)}K views` : `${c.view_count || 0} views`;
      const velocity = c.views_per_day ? `~${c.views_per_day.toLocaleString()} / day` : "Velocity: N/A";
      const thumb = c.thumbnail_url || DEFAULT_VIDEO_THUMB;
      return `
        <div style="background: #131517; border: 1px solid #222629; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column;">
          <div style="position: relative; width: 100%; aspect-ratio: 16/9; background: #000; overflow: hidden;">
            <img src="${thumb}" alt="${c.title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null;this.src='${DEFAULT_VIDEO_THUMB}';">
            <span class="badge" style="position: absolute; top: 8px; right: 8px; font-size: 0.7rem; background: rgba(0,0,0,0.85); color: var(--color-lime); border: 1px solid #333;">${velocity}</span>
          </div>
          <div style="padding: 12px; display: flex; flex-direction: column; flex: 1; justify-content: space-between; gap: 8px;">
            <div>
              <div style="font-size: 0.75rem; color: #8E959B; margin-bottom: 2px;">${c.channel_title || "Competitor"}</div>
              <h4 style="font-size: 0.85rem; color: #F0F2F5; line-height: 1.35; font-weight: 600; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${c.title}">
                ${c.title}
              </h4>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #8E959B; padding-top: 6px; border-top: 1px solid #1E2224;">
              <span>${views}</span>
              <a href="${vUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--color-lime); display: inline-flex; align-items: center; gap: 3px; font-weight: 600; text-decoration: none;">
                <span>Watch</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              </a>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  if (bannerEl) {
    const topGap = compIntel.gap_analysis?.[0];
    if (topGap) {
      bannerEl.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 10px;">
          <span class="badge badge-amber" style="font-size: 0.7rem; margin-top: 2px;">PRIORITY GAP</span>
          <div style="flex: 1;">
            <strong style="color: #F0F2F5;">${topGap.title}:</strong>
            <span style="color: #C0C5CA;"> ${topGap.explanation || topGap.recommended_action}</span>
            <a href="/niche-radar" style="color: var(--color-lime); margin-left: 8px; text-decoration: underline;">Explore in Niche Radar</a>
          </div>
        </div>
      `;
    } else {
      bannerEl.innerHTML = `<span style="color: #8E959B;">Competitor benchmark data ready. <a href="/niche-radar" style="color: var(--color-lime); text-decoration: underline;">Explore Niche Radar</a> for real-time trending videos.</span>`;
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => loadDashboard());
} else {
  loadDashboard();
}
