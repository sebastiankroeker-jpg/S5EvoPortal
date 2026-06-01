"use client";

type RouterLike = {
  push: (href: string) => void;
};

export function navigateFromExternalBottomTab(
  router: RouterLike,
  tabId: string,
  detail?: Record<string, string>,
) {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem("s5evo-active-tab", tabId);
    if (tabId === "registration") {
      window.sessionStorage.setItem("s5evo-team-view", detail?.teamView || "mannschaften");
    }
  }

  if (tabId === "profile") {
    router.push("/profile");
    return;
  }

  router.push(tabId === "home" ? "/" : `/#${tabId}`);
}
