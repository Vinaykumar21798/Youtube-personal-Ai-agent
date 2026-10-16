import { api } from "./api.js";
import { CONFIG } from "./config.js";

export const auth = {
  getToken() {
    return localStorage.getItem(CONFIG.TOKEN_KEY);
  },

  getUser() {
    const raw = localStorage.getItem(CONFIG.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  setSession(data) {
    if (data.access_token) {
      localStorage.setItem(CONFIG.TOKEN_KEY, data.access_token);
    }
    if (data.user) {
      localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(data.user));
    }
    if (data.active_workspace) {
      localStorage.setItem(CONFIG.WORKSPACE_KEY, data.active_workspace.id);
    }
    if (data.csrf_token) {
      localStorage.setItem("growtube_csrf", data.csrf_token);
    }
  },

  clearSession() {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
    localStorage.removeItem(CONFIG.WORKSPACE_KEY);
    localStorage.removeItem("growtube_csrf");
  },

  async login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    this.setSession(res);
    return res;
  },

  async register(email, password, fullName) {
    const res = await api.post("/auth/register", {
      email,
      password,
      full_name: fullName,
    });
    this.setSession(res);
    return res;
  },

  async checkSession() {
    // Validate active session with server; redirects if unauthorized on protected pages.
    const publicPaths = ["/login", "/", ""];
    const isPublic = publicPaths.includes(window.location.pathname);

    try {
      const user = await api.get("/auth/me");
      if (user) {
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
        if (user.workspaces && user.workspaces.length > 0 && !localStorage.getItem(CONFIG.WORKSPACE_KEY)) {
          localStorage.setItem(CONFIG.WORKSPACE_KEY, user.workspaces[0].id);
        }
        if (user.csrf_token) {
          localStorage.setItem("growtube_csrf", user.csrf_token);
        }
        return user;
      }
    } catch (err) {
      this.clearSession();
      if (!isPublic) {
        const dest = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?error=session_expired&return_to=${dest}`;
      }
      return null;
    }
  },

  async logout() {
    try {
      await api.post("/auth/logout", {});
    } catch (err) {
      console.warn("Server logout response:", err);
    } finally {
      this.clearSession();
      window.location.href = "/login";
    }
  },
};
