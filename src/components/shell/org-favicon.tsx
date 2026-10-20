"use client";

import { useEffect } from "react";

const iconSelector = "link[rel='icon'], link[rel='shortcut icon']";

export function OrgFavicon({ href }: { href: string | null }) {
  useEffect(() => {
    if (!href) {
      return;
    }

    // Next.js rewrites <head> during the first client navigation after a fresh
    // build. Removing those nodes from a mutation observer races React's own
    // removeChild and the navigation never commits, so the next click is the
    // one that works. Point the existing icons at the org mark instead.
    let frame = 0;
    const apply = () => {
      frame = 0;
      const links = [...document.querySelectorAll<HTMLLinkElement>(iconSelector)];
      if (links.length === 0) {
        const link = document.createElement("link");
        link.rel = "icon";
        link.dataset.orgIcon = "true";
        link.href = href;
        if (href.startsWith("/brand/")) {
          link.type = "image/png";
          link.setAttribute("sizes", "64x64");
        }
        document.head.appendChild(link);
        return;
      }

      for (const link of links) {
        if (link.getAttribute("href") !== href) {
          link.href = href;
        }
        link.dataset.orgIcon = "true";
        if (href.startsWith("/brand/")) {
          link.type = "image/png";
          link.setAttribute("sizes", "64x64");
        }
      }
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
      attributeFilter: ["href"],
    });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [href]);

  return null;
}
