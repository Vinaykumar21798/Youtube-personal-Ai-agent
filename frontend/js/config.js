// Frontend Global Configuration
export const CONFIG = {
  API_BASE_URL: window.location.origin ? `${window.location.origin}/api/v1` : "http://127.0.0.1:8000/api/v1",
  TOKEN_KEY: "growtube_token",
  USER_KEY: "growtube_user",
  WORKSPACE_KEY: "growtube_workspace",
};
