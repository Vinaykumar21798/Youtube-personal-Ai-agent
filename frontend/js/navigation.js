import { auth } from "./auth.js";

export async function initNavigation() {
  const currentPath = window.location.pathname;
  const navItems = document.querySelectorAll(".nav-item");

  navItems.forEach((item) => {
    const href = item.getAttribute("href");
    if (href === currentPath) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Verify session on protected pages
  const user = await auth.checkSession();
  if (!user) return;

  // Update user greeting if present
  const greetingEl = document.getElementById("dashboard-user-greeting");
  if (greetingEl) {
    greetingEl.textContent = user.full_name ? user.full_name.split(" ")[0] : "Creator";
  }

  // Update user profile avatar in topbar only (not channel avatars)
  if (user.avatar_url) {
    document.querySelectorAll(".user-avatar").forEach((img) => {
      img.src = user.avatar_url;
    });
  }

  // Check if channel is connected to link sidebar "Channel" item to real YouTube link
  try {
    const { api } = await import("./api.js");
    const overview = await api.get("/channels/overview");
    if (overview?.channel?.channel_url) {
      document.querySelectorAll("a.nav-item[data-nav='channel']").forEach((item) => {
        item.href = overview.channel.channel_url;
        item.target = "_blank";
        item.rel = "noopener noreferrer";
        item.title = `Open ${overview.channel.title} on YouTube`;
        item.innerHTML = `
          <svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
          <span>Channel ↗</span>
        `;
      });
    }
  } catch (e) {
    // Non-critical if overview cannot be loaded yet
  }


  // Populate/render user profile card in sidebar footer
  const sidebar = document.querySelector(".sidebar");
  if (sidebar) {
    let userCard = sidebar.querySelector(".sidebar-user-card");
    if (!userCard) {
      userCard = document.createElement("div");
      userCard.className = "sidebar-user-card";
      userCard.style.cssText =
        "margin-top: auto; padding: 14px 12px; border-top: 1px solid var(--color-surface-dark-border); background: #131517; border-radius: 8px; margin: auto 12px 14px 12px;";
      sidebar.appendChild(userCard);
    }

    const initial = user.full_name ? user.full_name.charAt(0).toUpperCase() : "U";
    const avatarHtml = user.avatar_url
      ? `<img src="${user.avatar_url}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">`
      : `<div style="width: 32px; height: 32px; border-radius: 50%; background: #2A2E32; color: var(--color-lime); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem;">${initial}</div>`;

    userCard.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
        ${avatarHtml}
        <div style="overflow: hidden; flex: 1;">
          <div style="font-weight: 600; font-size: 0.82rem; color: #F0F2F5; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${user.full_name}</div>
          <div style="font-size: 0.72rem; color: #8E959B; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${user.email}</div>
        </div>
      </div>
      <button type="button" class="btn btn-dark btn-sm btn-sidebar-logout" style="width: 100%; font-size: 0.78rem; padding: 6px 10px; border-color: #2A2E32; display: flex; align-items: center; justify-content: center; gap: 6px;">
        <span>Sign Out</span>
        <span>⎋</span>
      </button>
    `;

    userCard.querySelector(".btn-sidebar-logout").addEventListener("click", async () => {
      await auth.logout();
    });
  }

  // Also bind any global .btn-logout elements
  document.querySelectorAll(".btn-logout").forEach((el) => {
    el.addEventListener("click", async (e) => {
      e.preventDefault();
      await auth.logout();
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNavigation);
} else {
  initNavigation();
}
