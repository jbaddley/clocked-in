"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

function scrollport(element: HTMLElement) {
  let node = element.parentElement;
  while (node && node !== document.documentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll" || overflow === "overlay") {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export function useCardPin(cardRef: RefObject<HTMLElement | null>, barRef: RefObject<HTMLElement | null>) {
  const [pin, setPin] = useState<{ left: number; width: number; top: number; docked: boolean } | null>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const bar = barRef.current;
    if (!card || !bar) {
      return;
    }

    const port = scrollport(card);
    let frame = 0;
    const update = () => {
      const rect = card.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const limit = port ? port.getBoundingClientRect().bottom : window.innerHeight;
      const left = Math.round(rect.left);
      const width = Math.round(rect.width);
      const barHeight = bar.offsetHeight;
      const stickTop = limit - barHeight;
      const top = Math.max(Math.round(rect.top), Math.min(Math.round(rect.bottom - barHeight), stickTop));
      const docked = rect.bottom <= limit + 1;
      setPin((current) =>
        current && current.left === left && current.width === width && current.top === top && current.docked === docked
          ? current
          : { left, width, top, docked },
      );
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    const observer = new ResizeObserver(schedule);
    observer.observe(card);
    observer.observe(bar);
    if (port) {
      observer.observe(port);
    }
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    port?.addEventListener("scroll", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      port?.removeEventListener("scroll", schedule);
    };
  }, [barRef, cardRef]);

  return pin;
}
