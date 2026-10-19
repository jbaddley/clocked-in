"use client";

import { useEffect } from "react";

const iconSelector = "link[rel='icon'], link[rel='shortcut icon']";

export function OrgFavicon({ href }: { href: string | null }) {
  useEffect(() => {
    if (!href) {
      return;
    }

    const apply = () => {
      const links = [...document.querySelectorAll<HTMLLinkElement>(iconSelector)];
      let match = links.find((link) => link.dataset.orgIcon === "true" && link.parentNode === document.head);
      for (const link of links) {
        if (link !== match) {
          link.remove();
        }
      }

      if (match?.getAttribute("href") === href) {
        return;
      }

      match?.remove();
      match = document.createElement("link");
      match.rel = "icon";
      match.dataset.orgIcon = "true";
      match.href = href;
      if (href.startsWith("/brand/")) {
        match.type = "image/png";
        match.setAttribute("sizes", "64x64");
      }
      document.head.appendChild(match);
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
  }, [href]);

  return null;
}
