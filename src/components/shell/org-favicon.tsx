"use client";

import { useEffect } from "react";

const iconSelector = "link[rel='icon'], link[rel='shortcut icon']";

export function OrgFavicon({ href }: { href: string | null }) {
  useEffect(() => {
    if (!href) {
      return;
    }

    const links = [...document.head.querySelectorAll<HTMLLinkElement>(iconSelector)];
    const current = new URL(href, window.location.origin).href;
    if (links.length > 0 && links.every((link) => link.href === current)) {
      return;
    }

    const snapshot = links.map((link) => ({
      link,
      href: link.getAttribute("href"),
      type: link.getAttribute("type"),
      sizes: link.getAttribute("sizes"),
    }));

    const apply = (link: HTMLLinkElement) => {
      link.href = href;
      if (href.startsWith("/brand/")) {
        link.type = "image/webp";
        link.sizes = "64x64";
        return;
      }

      link.removeAttribute("type");
      link.removeAttribute("sizes");
    };

    if (links.length === 0) {
      const link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
      apply(link);
      return () => link.remove();
    }

    for (const link of links) {
      apply(link);
    }

    return () => {
      for (const item of snapshot) {
        if (item.link.getAttribute("href") !== href && item.link.href !== current) {
          continue;
        }

        restore(item.link, "href", item.href);
        restore(item.link, "type", item.type);
        restore(item.link, "sizes", item.sizes);
      }
    };
  }, [href]);

  return null;
}

function restore(link: HTMLLinkElement, name: string, value: string | null) {
  if (value == null) {
    link.removeAttribute(name);
  } else {
    link.setAttribute(name, value);
  }
}
