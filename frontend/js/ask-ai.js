import { api } from "./api.js";
import { auth } from "./auth.js";

let currentConversationId = null;
let lastFailedPrompt = null;
let activeChannel = null;
let isSubmitting = false;

// Simple markdown formatter that handles bold, lists, code, and paragraphs safely
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderMarkdown(rawText) {
  if (!rawText) return "";

  const lines = rawText.split("\n");
  let html = "";
  let inUl = false;
  let inOl = false;
  let inTable = false;

  for (let line of lines) {
    line = line.trim();

    if (!line) {
      if (inUl) { html += "</ul>"; inUl = false; }
      if (inOl) { html += "</ol>"; inOl = false; }
      if (inTable) { html += "</tbody></table></div>"; inTable = false; }
      continue;
    }

    // Markdown Table rows
    if (line.startsWith("|") && line.endsWith("|")) {
      if (inUl) { html += "</ul>"; inUl = false; }
      if (inOl) { html += "</ol>"; inOl = false; }

      // Check if separator row (e.g. |---|---|---|)
      if (line.replace(/[\s|:-]/g, "") === "") {
        continue;
      }

      const cells = line
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());

      if (!inTable) {
        inTable = true;
        html += `<div style="overflow-x: auto; margin: 12px 0;"><table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; border: 1px solid #2A2E32;"><thead><tr style="background: #1A1D20;">`;
        for (const cell of cells) {
          html += `<th style="padding: 8px 12px; border: 1px solid #2A2E32; text-align: left; color: #F0F2F5;">${formatInline(cell)}</th>`;
        }
        html += `</tr></thead><tbody>`;
        continue;
      } else {
        html += `<tr style="border-bottom: 1px solid #2A2E32;">`;
        for (const cell of cells) {
          html += `<td style="padding: 6px 12px; border: 1px solid #2A2E32; color: #D1D5DB;">${formatInline(cell)}</td>`;
        }
        html += `</tr>`;
        continue;
      }
    }

    // Close any open table if non-table line is reached
    if (inTable) {
      html += "</tbody></table></div>";
      inTable = false;
    }

    // Unordered list
    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (inOl) { html += "</ol>"; inOl = false; }
      if (!inUl) { html += "<ul>"; inUl = true; }
      const itemContent = formatInline(line.substring(2));
      html += `<li>${itemContent}</li>`;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (inUl) { html += "</ul>"; inUl = false; }
      if (!inOl) { html += "<ol>"; inOl = true; }
      const itemContent = formatInline(olMatch[2]);
      html += `<li>${itemContent}</li>`;
      continue;
    }

    // Close any open lists
    if (inUl) { html += "</ul>"; inUl = false; }
    if (inOl) { html += "</ol>"; inOl = false; }

    // Blockquote
    if (line.startsWith("> ")) {
      html += `<blockquote style="border-left: 3px solid var(--color-lime); margin: 8px 0; padding: 4px 12px; color: #9CA3AF; font-size: 0.88rem; background: rgba(255, 255, 255, 0.02);">${formatInline(line.substring(2))}</blockquote>`;
      continue;
    }

    // Headings
    if (line.startsWith("#### ")) {
      html += `<h5 style="font-size: 0.88rem; font-weight: 700; color: #E5E7EB; margin: 10px 0 4px;">${formatInline(line.substring(5))}</h5>`;
      continue;
    }
    if (line.startsWith("### ")) {
      html += `<h4 style="font-size: 0.95rem; font-weight: 700; color: #F0F2F5; margin: 12px 0 6px;">${formatInline(line.substring(4))}</h4>`;
      continue;
    }
    if (line.startsWith("## ")) {
      html += `<h3 style="font-size: 1.05rem; font-weight: 700; color: #F0F2F5; margin: 14px 0 8px;">${formatInline(line.substring(3))}</h3>`;
      continue;
    }

    // Regular paragraph
    html += `<p>${formatInline(line)}</p>`;
  }

  if (inUl) html += "</ul>";
  if (inOl) html += "</ol>";
  if (inTable) html += "</tbody></table></div>";

  return html;
}

function formatInline(text) {
  let safe = escapeHtml(text);

  // Bold **text**
  safe = safe.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Inline code `code`
  safe = safe.replace(/`([^`]+)`/g, "<code style=\"background: #1F2327; padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.82rem; color: var(--color-lime);\">$1</code>");

  // Links [text](url)
  safe = safe.replace(/\[(.*?)\]\((https?:\/\/[^\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: var(--color-lime); text-decoration: underline;">$1</a>');

  return safe;
}

// Tool names to human friendly labels
function formatToolName(name) {
  const map = {
    get_connected_channel_summary: "Channel Overview",
    resolve_youtube_target: "Resolve Target URL",
    get_video_details: "Video Details & Stats",
    get_channel_details: "Channel Analytics",
    search_youtube_videos: "YouTube Video Search",
    search_competitor_videos: "Competitor Search",
    compare_video_with_competitors: "Competitor Comparison",
    get_video_transcript: "Video Transcript",
    get_latest_analysis_report: "Latest Growth Report",
    retrieve_creator_memories: "Creator Memory",
    calculate_metric_gap: "Metric Calculations",
    get_channel_video_inventory: "Channel Video Inventory",
    rank_and_calculate_video_metrics: "Video Metrics & Ranking",
    compare_videos_detailed: "Side-by-Side Video Comparison",
    search_youtube_growth_strategies: "Growth Strategy Research",
    research_youtube_algorithm_updates: "Algorithm Updates",
    research_niche_and_trends: "Niche Trends Research",
    search_competitor_content_strategies: "Competitor Strategy Research",
    search_external_web: "Web & Creator Forums",
    fetch_youtube_metadata: "YouTube Metadata",
    calculate_video_metrics: "Video Velocity & Metrics",
    extract_keywords_and_hashtags: "Keywords & Hashtags",
    identify_content_gaps: "Content Gap Analysis",
    generate_prioritized_recommendations: "Prioritized Action Plan",
    investigate_creator_struggles: "Universal Struggles Research",
    search_niche_radar: "Niche Radar Discovery",
  };
  return map[name] || name.replace(/_/g, " ");
}

// Initialize Ask AI page
export async function initAskAIPage() {
  const user = await auth.checkSession();
  if (!user) return;

  const chatTextarea = document.getElementById("qa-chat-textarea");
  const chatForm = document.getElementById("qa-chat-form");
  const btnSend = document.getElementById("qa-btn-send");
  const btnNewChat = document.getElementById("qa-btn-new-chat");
  const btnClearChat = document.getElementById("qa-btn-clear-chat");
  const btnRetry = document.getElementById("qa-btn-retry");
  const messagesScroll = document.getElementById("qa-messages-scroll");
  const emptyState = document.getElementById("qa-empty-state");
  const messagesList = document.getElementById("qa-messages-list");
  const loadingIndicator = document.getElementById("qa-loading-indicator");
  const errorBanner = document.getElementById("qa-error-banner");
  const errorMessage = document.getElementById("qa-error-message");

  // Load connected channel context
  await loadChannelContext();

  // Load conversations list
  await loadConversations();

  // Restore active conversation from session if available
  const savedConvId = sessionStorage.getItem("growtube_active_conv_id");
  if (savedConvId) {
    await selectConversation(savedConvId);
  }

  // Check URL query param ?q=
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get("q");
  if (initialQuery && chatTextarea) {
    chatTextarea.value = initialQuery;
    setTimeout(() => {
      chatForm.dispatchEvent(new Event("submit"));
    }, 150);
  }

  // Auto-resize textarea
  if (chatTextarea) {
    chatTextarea.addEventListener("input", () => {
      chatTextarea.style.height = "auto";
      chatTextarea.style.height = Math.min(chatTextarea.scrollHeight, 140) + "px";
    });

    // Enter to send, Shift+Enter for newline
    chatTextarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event("submit"));
      }
    });
  }

  // Handle suggested question cards
  document.querySelectorAll(".qa-suggestion-card").forEach((card) => {
    card.addEventListener("click", () => {
      const prompt = card.getAttribute("data-prompt");
      if (prompt && chatTextarea) {
        chatTextarea.value = prompt;
        chatTextarea.focus();
        chatForm.dispatchEvent(new Event("submit"));
      }
    });
  });

  // Handle Form Submit
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const prompt = chatTextarea.value.trim();
    if (!prompt) return;

    chatTextarea.value = "";
    chatTextarea.style.height = "auto";
    await sendUserMessage(prompt);
  });

  // Handle New Chat / Reset View
  btnNewChat?.addEventListener("click", () => startNewChat());
  btnClearChat?.addEventListener("click", () => startNewChat());

  // Handle Retry
  btnRetry?.addEventListener("click", async () => {
    if (lastFailedPrompt) {
      errorBanner.style.display = "none";
      await sendUserMessage(lastFailedPrompt);
    }
  });

  async function loadChannelContext() {
    try {
      const overview = await api.get("/channels/overview");
      if (overview?.channel?.title && overview.channel.title !== "No Channel Connected") {
        activeChannel = overview.channel;
        const badge = document.getElementById("qa-active-context-badge");
        const label = document.getElementById("qa-context-label");
        if (badge && label) {
          badge.style.display = "flex";
          const subText = overview.channel.custom_url || (overview.channel.analyzed_video?.title ? "Analyzed Video" : "Active Context");
          label.textContent = `${overview.channel.title} (${subText})`;
        }
      }
    } catch (_) {
      // Non-critical if no channel connected yet
    }
  }

  async function loadConversations() {
    const listEl = document.getElementById("qa-conversations-list");
    if (!listEl) return;

    try {
      const convs = await api.get("/conversations");
      if (!convs || convs.length === 0) {
        listEl.innerHTML = '<div class="qa-history-empty">No conversations yet.<br>Ask a question to start.</div>';
        return;
      }

      listEl.innerHTML = "";
      convs.forEach((c) => {
        const item = document.createElement("div");
        item.className = `qa-history-item ${c.id === currentConversationId ? "active" : ""}`;
        item.setAttribute("data-id", c.id);

        const dateStr = new Date(c.updated_at || c.created_at).toLocaleDateString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        item.innerHTML = `
          <div class="qa-history-item-content">
            <div class="qa-history-item-title">${escapeHtml(c.title || "New Growth Chat")}</div>
            <div class="qa-history-item-time">${dateStr}</div>
          </div>
          <button type="button" class="qa-history-item-del" title="Delete conversation" data-id="${c.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        `;

        item.addEventListener("click", (evt) => {
          if (evt.target.closest(".qa-history-item-del")) return;
          selectConversation(c.id);
        });

        const delBtn = item.querySelector(".qa-history-item-del");
        delBtn?.addEventListener("click", async (evt) => {
          evt.stopPropagation();
          await deleteConversation(c.id);
        });

        listEl.appendChild(item);
      });
    } catch (err) {
      console.error("Failed to load conversations:", err);
      listEl.innerHTML = '<div class="qa-history-empty">Failed to load history</div>';
    }
  }

  async function selectConversation(convId) {
    if (convId === currentConversationId) return;
    try {
      loadingIndicator.style.display = "flex";
      errorBanner.style.display = "none";
      const conv = await api.get(`/conversations/${convId}`);
      currentConversationId = conv.id;
      sessionStorage.setItem("growtube_active_conv_id", conv.id);

      // Update active highlight in history
      document.querySelectorAll(".qa-history-item").forEach((el) => {
        el.classList.toggle("active", el.getAttribute("data-id") === convId);
      });

      // Update header title
      const titleEl = document.getElementById("qa-current-chat-title");
      if (titleEl) titleEl.textContent = conv.title || "Growth Conversation";

      // Update channel context badge from persisted conversation context
      if (conv.channel_context && conv.channel_context.channel_name) {
        const badge = document.getElementById("qa-active-context-badge");
        const label = document.getElementById("qa-context-label");
        if (badge && label) {
          badge.style.display = "flex";
          const subText = conv.channel_context.custom_url || (conv.channel_context.context_source === "oauth_connected_channel" ? "OAuth Connected" : "Active Channel");
          label.textContent = `${conv.channel_context.channel_name} (${subText})`;
        }
      }

      // Render messages
      emptyState.style.display = "none";
      messagesList.style.display = "flex";
      messagesList.innerHTML = "";

      if (conv.messages && conv.messages.length > 0) {
        conv.messages.forEach((msg) => {
          renderMessageRow(msg);
        });
      }

      scrollToBottom();
    } catch (err) {
      console.error("Failed to load conversation:", err);
      errorBanner.style.display = "flex";
      errorMessage.textContent = "Failed to load conversation history.";
    } finally {
      loadingIndicator.style.display = "none";
    }
  }

  async function deleteConversation(convId) {
    if (!confirm("Are you sure you want to delete this conversation?")) return;
    try {
      await api.delete(`/conversations/${convId}`);
      if (currentConversationId === convId) {
        startNewChat();
      }
      await loadConversations();
    } catch (err) {
      alert("Failed to delete conversation: " + err.message);
    }
  }

  function startNewChat() {
    currentConversationId = null;
    lastFailedPrompt = null;
    sessionStorage.removeItem("growtube_active_conv_id");
    emptyState.style.display = "block";
    messagesList.style.display = "none";
    messagesList.innerHTML = "";
    errorBanner.style.display = "none";
    loadingIndicator.style.display = "none";

    const titleEl = document.getElementById("qa-current-chat-title");
    if (titleEl) titleEl.textContent = "Ask GrowTube AI";

    document.querySelectorAll(".qa-history-item").forEach((el) => {
      el.classList.remove("active");
    });

    // Reset badge to default workspace channel if available
    const badge = document.getElementById("qa-active-context-badge");
    const label = document.getElementById("qa-context-label");
    if (badge && label) {
      if (activeChannel?.title && activeChannel.title !== "No Channel Connected") {
        badge.style.display = "flex";
        const subText = activeChannel.custom_url || (activeChannel.analyzed_video?.title ? "Analyzed Video" : "Active Context");
        label.textContent = `${activeChannel.title} (${subText})`;
      } else {
        badge.style.display = "none";
      }
    }
  }

  // Canonical 8 Workflow Steps matching prompt requirements
  const CANONICAL_STEPS = [
    { id: "understanding", number: 1, label: "Understanding your question", defaultDesc: "Identifying what you want to find out." },
    { id: "planning", number: 2, label: "Planning with the LLM", defaultDesc: "Working out the best approach to your request." },
    { id: "selecting_tools", number: 3, label: "Selecting the right tools", defaultDesc: "Choosing the tools needed to gather relevant information." },
    { id: "calling_tools", number: 4, label: "Calling tools", defaultDesc: "Retrieving video information from YouTube." },
    { id: "reviewing_results", number: 5, label: "Reviewing tool results", defaultDesc: "Examining the information returned by the tools." },
    { id: "deciding_next", number: 6, label: "Deciding what to do next", defaultDesc: "Determining whether more information is needed." },
    { id: "validating_findings", number: 7, label: "Validating the findings", defaultDesc: "Checking the available evidence and data consistency." },
    { id: "generating_answer", number: 8, label: "Generating your answer", defaultDesc: "Turning the findings into a useful response." },
  ];

  function renderTimelineStepsHtml(timeline) {
    if (!timeline || !timeline.steps) return "";

    const stepsObj = timeline.steps;
    const toolCalls = timeline.tool_calls || [];
    let html = "";

    for (const stepDef of CANONICAL_STEPS) {
      const s = stepsObj[stepDef.id] || { status: "pending", description: stepDef.defaultDesc };
      const status = s.status || "pending";
      const label = `${stepDef.number}. ${stepDef.label}`;
      const desc = s.description || stepDef.defaultDesc;
      const isRunning = status === "running";
      const isCompleted = status === "completed";
      const isSkipped = status === "skipped";
      const isFailed = status === "failed";

      let iconHtml = `<div class="qa-step-icon-inner"></div>`;
      if (isRunning) {
        iconHtml = `<div class="qa-step-spinner" title="Step executing"></div>`;
      } else if (isCompleted) {
        iconHtml = `<svg class="qa-step-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      } else if (isSkipped) {
        iconHtml = `<span style="font-size: 13px; font-weight: bold; line-height: 1; color: #64748B;" title="Step skipped">—</span>`;
      } else if (isFailed) {
        iconHtml = `<span style="font-size: 11px; font-weight: bold; line-height: 1; color: #EF4444;" title="Step failed">✕</span>`;
      }

      let badgeText = status.toUpperCase();
      if (isRunning) badgeText = "RUNNING";
      else if (isCompleted) badgeText = "DONE";
      else if (isSkipped) badgeText = "SKIPPED";
      else if (isFailed) badgeText = "FAILED";
      else badgeText = "PENDING";

      let nestedToolsHtml = "";
      if (stepDef.id === "calling_tools" && toolCalls.length > 0) {
        const toolCards = toolCalls.map((tc) => {
          const tcStatus = tc.status || "running";
          const tcDisplayName = escapeHtml(tc.display_name || tc.tool_name || "Tool");
          const tcPurpose = escapeHtml(tc.purpose || "Gathers relevant YouTube channel and video data");
          const tcSummary = tc.result_summary ? escapeHtml(tc.result_summary) : null;
          const tcError = tc.error ? escapeHtml(tc.error) : null;

          let tcBadgeClass = tcStatus;
          let tcBadgeText = tcStatus.toUpperCase();
          if (tcStatus === "completed") tcBadgeText = "✓ Completed";
          else if (tcStatus === "running") tcBadgeText = "⟳ Running...";
          else if (tcStatus === "failed") tcBadgeText = "✕ Failed";

          return `
            <div class="qa-tool-card ${tcStatus}">
              <div class="qa-tool-card-header">
                <div class="qa-tool-card-title-wrap">
                  <svg class="qa-tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                  <span class="qa-tool-display-name">${tcDisplayName}</span>
                </div>
                <span class="qa-tool-badge ${tcBadgeClass}">${tcBadgeText}</span>
              </div>
              <div class="qa-tool-purpose">${tcPurpose}</div>
              ${tcSummary ? `<div class="qa-tool-summary-box"><strong>Summary:</strong> ${tcSummary}</div>` : ""}
              ${tcError ? `<div class="qa-step-error-msg"><strong>Error:</strong> ${tcError}</div>` : ""}
            </div>
          `;
        }).join("");

        nestedToolsHtml = `<div class="qa-tool-calls-container">${toolCards}</div>`;
      }

      html += `
        <div class="qa-step-item ${status}" data-step-id="${stepDef.id}">
          <div class="qa-step-icon-wrap">${iconHtml}</div>
          <div class="qa-step-header">
            <span class="qa-step-label">${escapeHtml(label)}</span>
            <span class="qa-step-badge ${status}">${badgeText}</span>
          </div>
          <div class="qa-step-desc">${escapeHtml(desc)}</div>
          ${s.error ? `<div class="qa-step-error-msg">${escapeHtml(s.error)}</div>` : ""}
          ${nestedToolsHtml}
        </div>
      `;
    }

    return html;
  }

  function renderWorkflowAccordionHtml(timeline) {
    if (!timeline || !timeline.steps) return "";

    const stepsObj = timeline.steps;
    const toolCalls = timeline.tool_calls || [];
    let completedCount = 0;
    for (const s of Object.values(stepsObj)) {
      if (s.status === "completed") completedCount++;
    }

    const timelineInnerHtml = renderTimelineStepsHtml(timeline);
    const toolCountStr = toolCalls.length > 0 ? ` • ${toolCalls.length} tool call(s)` : "";

    return `
      <details class="qa-workflow-accordion">
        <summary class="qa-workflow-summary" title="Click to inspect or collapse execution workflow">
          <div class="qa-workflow-summary-left">
            <svg class="qa-workflow-icon-bolt" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            <span class="qa-workflow-summary-title">Execution Workflow & Tool Calls</span>
          </div>
          <div class="qa-workflow-summary-right">
            <span class="qa-workflow-count-badge">${completedCount} of 8 steps completed${toolCountStr}</span>
            <svg class="qa-workflow-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </summary>
        <div class="qa-workflow-accordion-body">
          <div class="qa-workflow-timeline">
            ${timelineInnerHtml}
          </div>
        </div>
      </details>
    `;
  }

  async function sendUserMessage(prompt) {
    if (isSubmitting) return;
    isSubmitting = true;
    lastFailedPrompt = prompt;
    errorBanner.style.display = "none";

    emptyState.style.display = "none";
    messagesList.style.display = "flex";

    renderMessageRow({
      role: "user",
      content: prompt,
    });
    scrollToBottom();

    btnSend.disabled = true;
    loadingIndicator.style.display = "flex";

    const stepsContainer = document.getElementById("qa-workflow-live-steps");
    const summaryTextEl = document.getElementById("qa-workflow-current-summary");
    const timerEl = document.getElementById("qa-workflow-timer");

    // Initialize initial live timeline with Step 1 running
    let liveTimelineState = {
      status: "running",
      current_step_id: "understanding",
      steps: {
        understanding: { id: "understanding", name: "Understanding your question", status: "running", description: "Identifying what you want to find out." },
        planning: { id: "planning", name: "Planning with the LLM", status: "pending", description: "Working out the best approach to your request." },
        selecting_tools: { id: "selecting_tools", name: "Selecting the right tools", status: "pending", description: "Choosing the tools needed to gather relevant information." },
        calling_tools: { id: "calling_tools", name: "Calling tools", status: "pending", description: "Retrieving video information from YouTube." },
        reviewing_results: { id: "reviewing_results", name: "Reviewing tool results", status: "pending", description: "Examining the information returned by the tools." },
        deciding_next: { id: "deciding_next", name: "Deciding what to do next", status: "pending", description: "Determining whether more information is needed." },
        validating_findings: { id: "validating_findings", name: "Validating the findings", status: "pending", description: "Checking the available evidence and data consistency." },
        generating_answer: { id: "generating_answer", name: "Generating your answer", status: "pending", description: "Turning the findings into a useful response." },
      },
      tool_calls: [],
    };

    if (summaryTextEl) summaryTextEl.textContent = "Understanding your question...";
    if (stepsContainer) stepsContainer.innerHTML = renderTimelineStepsHtml(liveTimelineState);

    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      if (timerEl) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        timerEl.textContent = `${elapsed}s`;
      }
    }, 100);

    let streamCompleted = false;

    function handleAssistantResponse(response, timeline) {
      if (response.channel_context && response.channel_context.channel_name) {
        const badge = document.getElementById("qa-active-context-badge");
        const label = document.getElementById("qa-context-label");
        if (badge && label) {
          badge.style.display = "flex";
          const subText = response.channel_context.custom_url || (response.channel_context.is_oauth_connected ? "OAuth Connected" : "Active Channel");
          label.textContent = `${response.channel_context.channel_name} (${subText})`;
        }
      }

      renderMessageRow({
        role: "assistant",
        content: response.content,
        tool_calls_summary: response.tool_calls_summary,
        evidence_sources: response.evidence_sources,
        videos: response.videos || [],
        follow_up_questions: response.follow_up_questions || [],
        data_coverage: response.data_coverage || null,
        limitations: response.limitations || [],
        execution_state: response.execution_state || null,
        working_memory: response.working_memory || null,
        workflow_timeline: timeline || response.workflow_timeline || null,
      });

      lastFailedPrompt = null;
      loadConversations();
    }

    const channelCtxPayload = activeChannel?.channel_id ? {
      channel_id: activeChannel.channel_id,
      channel_name: activeChannel.title || "Connected Channel",
      custom_url: activeChannel.custom_url || null,
      view_count: activeChannel.view_count || 0,
      video_count: activeChannel.video_count || 0,
      subscriber_count: activeChannel.subscriber_count || 0,
      context_source: "frontend_active_selector",
      is_oauth_connected: false,
    } : null;

    try {
      // 1. Create conversation if none exists
      if (!currentConversationId) {
        const titleSnippet = prompt.length > 40 ? prompt.substring(0, 37) + "..." : prompt;
        const newConv = await api.post("/conversations", {
          title: titleSnippet,
          context_channel_id: activeChannel?.channel_id || null,
          context_video_id: activeChannel?.analyzed_video?.video_id || null,
          channel_context: channelCtxPayload,
        });
        currentConversationId = newConv.id;
        sessionStorage.setItem("growtube_active_conv_id", newConv.id);
        const titleEl = document.getElementById("qa-current-chat-title");
        if (titleEl) titleEl.textContent = newConv.title;
      }

      const messagePayload = {
        role: "user",
        content: prompt,
        context_channel_id: activeChannel?.channel_id || null,
        channel_context: channelCtxPayload,
      };

      // 2. Stream events using Server-Sent Events (SSE)
      await api.stream(
        `/conversations/${currentConversationId}/messages?stream=true`,
        messagePayload,
        {
          onEvent: (eventType, eventData) => {
            if (eventData) {
              if (eventData.timeline) {
                liveTimelineState = eventData.timeline;
              } else if (eventData.workflow_state) {
                liveTimelineState = eventData.workflow_state;
              } else if (eventData.steps) {
                liveTimelineState = eventData;
              }
            }

            if (eventType === "run_started") {
              if (summaryTextEl) summaryTextEl.textContent = "Understanding your question...";
            } else if (eventType === "step_started" || eventType === "progress") {
              const label = eventData?.step_label || eventData?.step_name;
              if (label && summaryTextEl) {
                summaryTextEl.textContent = `${label}...`;
              }
            } else if (eventType === "tool_started") {
              const toolName = eventData?.tool_display_name || eventData?.tool_call?.display_name || "Tool";
              if (summaryTextEl) {
                summaryTextEl.textContent = `Running ${toolName}...`;
              }
            } else if (eventType === "tool_completed") {
              const toolName = eventData?.tool_display_name || eventData?.tool_call?.display_name || "Tool";
              if (summaryTextEl) {
                summaryTextEl.textContent = `Completed ${toolName}`;
              }
            } else if (eventType === "workflow_completed") {
              streamCompleted = true;
              const resultMsg = eventData.result || eventData;
              handleAssistantResponse(resultMsg, eventData.workflow_state || eventData.timeline || liveTimelineState);
            } else if (eventType === "workflow_failed") {
              streamCompleted = true;
              throw new Error(eventData.error || "Agent execution failed");
            }

            if (stepsContainer && liveTimelineState) {
              stepsContainer.innerHTML = renderTimelineStepsHtml(liveTimelineState);
            }
            smoothScrollActiveStep();
          },
        }
      );

      // If SSE ended without terminal event, poll live-execution state
      if (!streamCompleted) {
        let attempts = 0;
        while (attempts < 60 && !streamCompleted) {
          await new Promise((r) => setTimeout(r, 1000));
          attempts++;
          try {
            const liveState = await api.get(`/conversations/${currentConversationId}/live-execution`);
            if (liveState && liveState.steps) {
              liveTimelineState = liveState;
              if (stepsContainer) {
                stepsContainer.innerHTML = renderTimelineStepsHtml(liveTimelineState);
              }
              if (liveState.current_step_name && summaryTextEl) {
                summaryTextEl.textContent = `${liveState.current_step_name}...`;
              }
              if (liveState.status === "completed" && liveState.result) {
                streamCompleted = true;
                handleAssistantResponse(liveState.result, liveState);
                break;
              }
              if (liveState.status === "failed") {
                streamCompleted = true;
                throw new Error(liveState.error || "Agent execution failed");
              }
            }
          } catch (pollErr) {
            console.warn("Polling notice:", pollErr);
          }
        }
      }

    } catch (err) {
      console.warn("SSE stream interrupted or direct error:", err);
      if (!streamCompleted) {
        try {
          if (!currentConversationId) {
            const titleSnippet = prompt.length > 40 ? prompt.substring(0, 37) + "..." : prompt;
            const newConv = await api.post("/conversations", {
              title: titleSnippet,
              context_channel_id: activeChannel?.channel_id || null,
              context_video_id: activeChannel?.analyzed_video?.video_id || null,
              channel_context: channelCtxPayload,
            });
            currentConversationId = newConv.id;
            sessionStorage.setItem("growtube_active_conv_id", newConv.id);
          }
          if (summaryTextEl) summaryTextEl.textContent = "Connecting to agent execution...";
          const fallbackRes = await api.post(`/conversations/${currentConversationId}/messages`, {
            role: "user",
            content: prompt,
            context_channel_id: activeChannel?.channel_id || null,
            channel_context: channelCtxPayload,
          });
          handleAssistantResponse(fallbackRes, fallbackRes.workflow_timeline || liveTimelineState);
        } catch (fallbackErr) {
          console.error("Agent error:", fallbackErr);
          errorBanner.style.display = "flex";
          errorMessage.textContent = fallbackErr.message || "Failed to reach GrowTube Agent. Please try again.";
          if (chatTextarea && !chatTextarea.value) {
            chatTextarea.value = prompt;
          }
        }
      }
    } finally {
      clearInterval(timerInterval);
      loadingIndicator.style.display = "none";
      btnSend.disabled = false;
      isSubmitting = false;
      scrollToBottom();
    }
  }

  function smoothScrollActiveStep() {
    if (!messagesScroll) return;
    const isNearBottom = messagesScroll.scrollHeight - messagesScroll.scrollTop <= messagesScroll.clientHeight + 160;
    if (isNearBottom) {
      messagesScroll.scrollTop = messagesScroll.scrollHeight;
    }
  }

  function renderMessageRow(msg) {
    const isUser = msg.role === "user";
    const row = document.createElement("div");
    row.className = `qa-message-row ${isUser ? "user" : "ai"}`;

    if (isUser) {
      row.innerHTML = `
        <div class="qa-bubble user">
          <div class="qa-bubble-content">${escapeHtml(msg.content).replace(/\n/g, "<br>")}</div>
        </div>
        <div class="qa-avatar user">You</div>
      `;
    } else {
      let stateBadgeHtml = "";
      const exState = msg.execution_state || msg.extra_metadata?.execution_state;
      if (exState && typeof exState === "object") {
        const st = exState.status || "completed";
        const stepsCount = (exState.completed_steps || []).length;
        const stateColor = st === "completed" ? "var(--color-lime, #CCFF00)" : (st === "failed" ? "#FF5555" : "#60A5FA");
        const stateLabel = st === "completed" ? `✓ Executed (${stepsCount} steps)` : (st === "failed" ? "⚠ Step Notice" : `⟳ ${st.replace(/_/g, " ")}`);
        stateBadgeHtml = `<span class="qa-execution-state-badge" style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 600; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: ${stateColor};">${stateLabel}</span>`;
      }

      let toolsHtml = "";
      const pills = [];
      if (stateBadgeHtml) pills.push(stateBadgeHtml);
      if (msg.tool_calls_summary && Array.isArray(msg.tool_calls_summary) && msg.tool_calls_summary.length > 0) {
        msg.tool_calls_summary.forEach((t) => {
          const name = typeof t === "string" ? t : (t.tool_name || t.tool || "agent_tool");
          pills.push(`<span class="qa-tool-pill">⚡ ${formatToolName(name)}</span>`);
        });
      }
      if (pills.length > 0) {
        toolsHtml = `<div class="qa-tools-badge-bar">${pills.join("")}</div>`;
      }

      // Collapsible Workflow Timeline Accordion
      const workflowTimeline = msg.workflow_timeline || msg.extra_metadata?.workflow_timeline;
      let workflowTimelineHtml = "";
      if (workflowTimeline && typeof workflowTimeline === "object") {
        workflowTimelineHtml = renderWorkflowAccordionHtml(workflowTimeline);
      }

      // 1. Video Cards Grid
      let videoCardsHtml = "";
      if (msg.videos && Array.isArray(msg.videos) && msg.videos.length > 0) {
        const cards = msg.videos.map((v, i) => {
          const rankBadge = v.badge || (v.rank ? `Rank #${v.rank}` : `Video #${i + 1}`);
          const durationBadge = v.duration ? `<span class="qa-video-duration">${escapeHtml(v.duration)}</span>` : "";
          const thumbUrl = v.thumbnail_url || "/assets/images/creator-avatar.svg";
          const title = escapeHtml(v.title || "Untitled Video");
          const watchUrl = v.url || `https://www.youtube.com/watch?v=${v.video_id}`;
          const views = v.view_count !== undefined && v.view_count !== null ? Number(v.view_count).toLocaleString() : "N/A";
          const likes = v.like_count ? Number(v.like_count).toLocaleString() : null;
          const comments = v.comment_count ? Number(v.comment_count).toLocaleString() : null;
          const velocity = v.views_per_day ? Number(v.views_per_day).toLocaleString() : null;
          const pubDate = v.published_at ? v.published_at.substring(0, 10) : "";

          return `
            <div class="qa-video-card">
              <div class="qa-video-thumb-wrap">
                <img src="${thumbUrl}" alt="${title}" loading="lazy" onerror="this.src='/assets/images/creator-avatar.svg';">
                <span class="qa-video-rank-badge">${escapeHtml(rankBadge)}</span>
                ${durationBadge}
              </div>
              <div class="qa-video-body">
                <h4 class="qa-video-title" title="${title}">
                  <a href="${watchUrl}" target="_blank" rel="noopener noreferrer">${title}</a>
                </h4>
                <div class="qa-video-stats-bar">
                  <span class="qa-stat-pill views">👁 ${views} views</span>
                  ${velocity ? `<span class="qa-stat-pill">🚀 ${velocity}/day</span>` : ""}
                  ${likes ? `<span class="qa-stat-pill">👍 ${likes}</span>` : ""}
                  ${comments ? `<span class="qa-stat-pill">💬 ${comments}</span>` : ""}
                </div>
                <div class="qa-video-footer">
                  <span>${pubDate ? `Published: ${pubDate}` : "Public Upload"}</span>
                  <a href="${watchUrl}" target="_blank" rel="noopener noreferrer" class="qa-video-watch-link">Watch ↗</a>
                </div>
              </div>
            </div>
          `;
        }).join("");
        videoCardsHtml = `<div class="qa-video-cards-grid">${cards}</div>`;
      }

      // 2. Verified Data Evidence Accordion
      let evidenceHtml = "";
      if (msg.evidence_sources && Array.isArray(msg.evidence_sources) && msg.evidence_sources.length > 0) {
        const items = msg.evidence_sources.map((ev) => {
          const srcLabel = ev.source || "YouTube Data API";
          const title = ev.title || ev.video_id || "Evidence reference";
          const note = ev.note || "";
          return `
            <div class="qa-evidence-item">
              <span class="qa-evidence-tag">[${srcLabel}]</span>
              <span><strong>${escapeHtml(title)}</strong>${note ? ` — ${escapeHtml(note)}` : ""}</span>
            </div>
          `;
        }).join("");

        evidenceHtml = `
          <div class="qa-evidence-accordion">
            <details>
              <summary class="qa-evidence-toggle">
                <span>Verified Data Evidence (${msg.evidence_sources.length} sources consulted)</span>
                <span>▼</span>
              </summary>
              <div class="qa-evidence-details">
                ${items}
              </div>
            </details>
          </div>
        `;
      }

      // 3. Data Coverage Badge
      let coverageHtml = "";
      if (msg.data_coverage && (msg.data_coverage.inspected_count || msg.data_coverage.coverage_percentage)) {
        const ins = msg.data_coverage.inspected_count || "All";
        const tot = msg.data_coverage.total_channel_videos || ins;
        const pct = msg.data_coverage.coverage_percentage || 100;
        const period = msg.data_coverage.observation_period || "Lifetime observations";
        coverageHtml = `
          <div class="qa-coverage-pill">
            <span>📊 Inspected <strong>${ins} of ${tot}</strong> channel uploads (${pct}% coverage) • ${escapeHtml(period)}</span>
          </div>
        `;
      }

      // 4. Data Limitations Box
      let limitationsHtml = "";
      if (msg.limitations && Array.isArray(msg.limitations) && msg.limitations.length > 0) {
        const lims = msg.limitations.map((l) => `<div>• ${escapeHtml(l)}</div>`).join("");
        limitationsHtml = `<div class="qa-limitations-box"><strong>Data Limitations:</strong>${lims}</div>`;
      }

      // 5. Contextual Follow-up Question Chips
      let followUpsHtml = "";
      if (msg.follow_up_questions && Array.isArray(msg.follow_up_questions) && msg.follow_up_questions.length > 0) {
        const chips = msg.follow_up_questions.map((q) => {
          return `<button type="button" class="qa-followup-chip" data-prompt="${escapeHtml(q)}">${escapeHtml(q)}</button>`;
        }).join("");
        followUpsHtml = `
          <div class="qa-followup-container">
            <div class="qa-followup-label">Suggested Follow-ups</div>
            <div class="qa-followup-chips">${chips}</div>
          </div>
        `;
      }

      row.innerHTML = `
        <div class="qa-avatar ai">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
        </div>
        <div class="qa-bubble ai">
          ${toolsHtml}
          ${workflowTimelineHtml}
          <div class="qa-bubble-content">${renderMarkdown(msg.content)}</div>
          ${videoCardsHtml}
          ${evidenceHtml}
          ${coverageHtml}
          ${limitationsHtml}
          ${followUpsHtml}
        </div>
      `;

      // Wire up follow-up chips
      row.querySelectorAll(".qa-followup-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          const prompt = chip.getAttribute("data-prompt");
          if (prompt && chatTextarea) {
            chatTextarea.value = prompt;
            chatTextarea.focus();
            chatForm.dispatchEvent(new Event("submit"));
          }
        });
      });
    }

    messagesList.appendChild(row);
  }

  function scrollToBottom() {
    if (messagesScroll) {
      messagesScroll.scrollTop = messagesScroll.scrollHeight;
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAskAIPage);
} else {
  initAskAIPage();
}
