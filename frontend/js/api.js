import { CONFIG } from "./config.js";

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

export const api = {
  async request(endpoint, options = {}) {
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    const workspace = localStorage.getItem(CONFIG.WORKSPACE_KEY);
    const csrfToken = getCookie("growtube_csrf") || localStorage.getItem("growtube_csrf");

    const headers = {
      ...(options.headers || {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (workspace) {
      headers["X-Workspace-Id"] = workspace;
    }

    const method = (options.method || "GET").toUpperCase();
    if (csrfToken && ["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
      headers["X-CSRF-Token"] = csrfToken;
    }

    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      ...options,
      credentials: "include", // Send HttpOnly session cookies automatically
      headers,
    });

    if (response.status === 401) {
      console.warn("Session expired or unauthorized for endpoint:", endpoint);
      const publicPaths = ["/login", "/", ""];
      if (!publicPaths.includes(window.location.pathname)) {
        localStorage.removeItem(CONFIG.TOKEN_KEY);
        localStorage.removeItem(CONFIG.USER_KEY);
        localStorage.removeItem(CONFIG.WORKSPACE_KEY);
        window.location.href = "/login?error=session_expired";
      }
    }

    if (!response.ok) {
      let errorMsg = `Error ${response.status}`;
      try {
        const errJson = await response.json();
        errorMsg = errJson.detail || errorMsg;
      } catch (_) {}
      throw new Error(errorMsg);
    }

    return response.json();
  },

  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  },

  post(endpoint, data) {
    const isForm = data instanceof FormData;
    return this.request(endpoint, {
      method: "POST",
      body: isForm ? data : JSON.stringify(data),
    });
  },

  put(endpoint, data) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  },

  async stream(endpoint, data, { onEvent, onError, onComplete } = {}) {
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    const workspace = localStorage.getItem(CONFIG.WORKSPACE_KEY);
    const csrfToken = getCookie("growtube_csrf") || localStorage.getItem("growtube_csrf");

    const headers = {
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (workspace) headers["X-Workspace-Id"] = workspace;
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(data),
    });

    if (response.status === 401) {
      console.warn("Session expired or unauthorized for stream:", endpoint);
      const publicPaths = ["/login", "/", ""];
      if (!publicPaths.includes(window.location.pathname)) {
        localStorage.removeItem(CONFIG.TOKEN_KEY);
        localStorage.removeItem(CONFIG.USER_KEY);
        localStorage.removeItem(CONFIG.WORKSPACE_KEY);
        window.location.href = "/login?error=session_expired";
      }
      throw new Error("Session expired. Please log in again.");
    }

    if (!response.ok) {
      let errText = `Error ${response.status}`;
      try {
        const errJson = await response.json();
        errText = errJson.detail || errText;
      } catch (_) {}
      throw new Error(errText);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop();

      for (const part of parts) {
        if (!part.trim() || part.startsWith(":")) continue;
        let eventType = "message";
        let eventData = "";

        const lines = part.split("\n");
        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventType = line.substring(6).trim();
          } else if (line.startsWith("data:")) {
            eventData = line.substring(5).trim();
          }
        }

        if (eventData) {
          try {
            const parsed = JSON.parse(eventData);
            if (onEvent) onEvent(eventType, parsed);
          } catch (e) {
            console.warn("Failed to parse SSE event data:", eventData);
          }
        }
      }
    }

    if (onComplete) onComplete();
  },
};
