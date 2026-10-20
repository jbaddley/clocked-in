"use client";

import { useEffect } from "react";

const iconSelector = "link[rel='icon'], link[rel='shortcut icon']";
const appleSelector = "link[rel='apple-touch-icon'], link[rel='apple-touch-icon-precomposed']";

export function OrgFavicon({ href }: { href: string | null }) {
  useEffect(() => {
    // Next.js rewrites <head> during client navigations. Removing those links
    // from a mutation observer races React's own removeChild and the navigation
    // never commits. Attribute updates leave React's nodes in place. A separate
    // link this effect owns is what the browser re-reads when the mark changes.
    let frame = 0;
    let owned: HTMLLinkElement | null = document.head.querySelector("link[data-org-icon='owned']");

    const apply = () => {
      frame = 0;
      if (!href) {
        restoreIcons();
        owned = dropOwned(owned);
        return;
      }

      for (const link of document.querySelectorAll<HTMLLinkElement>(`${iconSelector}, ${appleSelector}`)) {
        if (link.dataset.orgIcon === "owned") continue;
        remember(link);
        paint(link, href);
      }
      owned = ensureOwned(owned, href);
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "rel", "sizes", "type"],
    });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      restoreIcons();
      dropOwned(owned);
    };
  }, [href]);

  return null;
}

function remember(link: HTMLLinkElement) {
  if ("orgOriginalHref" in link.dataset) return;
  link.dataset.orgOriginalHref = link.getAttribute("href") ?? "";
  link.dataset.orgOriginalType = link.getAttribute("type") ?? "";
  link.dataset.orgOriginalSizes = link.getAttribute("sizes") ?? "";
}

function paint(link: HTMLLinkElement, href: string) {
  if (!sameHref(link, href)) {
    link.setAttribute("href", href);
  }
  if (!href.startsWith("/brand/")) return;
  if (link.getAttribute("type") !== "image/png") {
    link.setAttribute("type", "image/png");
  }
  if (link.getAttribute("sizes") !== "64x64") {
    link.setAttribute("sizes", "64x64");
  }
}

function ensureOwned(owned: HTMLLinkElement | null, href: string) {
  if (owned?.isConnected && owned.dataset.orgIcon === "owned" && sameHref(owned, href) && owned.rel === "icon") {
    if (href.startsWith("/brand/") && owned.getAttribute("sizes") !== "any") {
      owned.setAttribute("sizes", "any");
    }
    return owned;
  }

  const next = document.createElement("link");
  next.rel = "icon";
  next.dataset.orgIcon = "owned";
  next.setAttribute("href", href);
  if (href.startsWith("/brand/")) {
    next.type = "image/png";
    // sizes=any wins over the 64×64 copies, and it points at the org PNG.
    next.setAttribute("sizes", "any");
  }
  if (owned?.isConnected) {
    owned.replaceWith(next);
  } else {
    document.head.appendChild(next);
  }
  return next;
}

function restoreIcons() {
  for (const link of document.querySelectorAll<HTMLLinkElement>("[data-org-original-href]")) {
    const href = link.dataset.orgOriginalHref ?? "";
    const type = link.dataset.orgOriginalType ?? "";
    const sizes = link.dataset.orgOriginalSizes ?? "";
    if (href) link.setAttribute("href", href);
    if (type) link.setAttribute("type", type);
    else link.removeAttribute("type");
    if (sizes) link.setAttribute("sizes", sizes);
    else link.removeAttribute("sizes");
    delete link.dataset.orgOriginalHref;
    delete link.dataset.orgOriginalType;
    delete link.dataset.orgOriginalSizes;
  }
}

function dropOwned(owned: HTMLLinkElement | null) {
  owned?.remove();
  return null;
}

function sameHref(link: HTMLLinkElement, href: string) {
  const current = link.getAttribute("href");
  if (current === href) return true;
  try {
    return new URL(current ?? "", location.origin).href === new URL(href, location.origin).href;
  } catch {
    return false;
  }
}
