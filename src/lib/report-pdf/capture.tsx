"use client";

import { createRoot } from "react-dom/client";
import { ChartPlot } from "@/components/charts";
import type { PdfBlock } from "@/lib/report-pdf/blocks";
import { captureCssHeight, captureCssWidth } from "@/lib/report-pdf/layout";

function waitFrames(count = 2) {
  return new Promise<void>((resolve) => {
    const step = (left: number) => {
      if (left <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(left - 1));
    };
    step(count);
  });
}

function inlineSvgColors(svg: SVGElement) {
  for (const node of svg.querySelectorAll("*")) {
    if (!(node instanceof SVGElement)) continue;
    const style = getComputedStyle(node);
    if (style.fill && style.fill !== "none" && !node.getAttribute("fill")) {
      node.setAttribute("fill", style.fill);
    }
    if (style.stroke && style.stroke !== "none" && !node.getAttribute("stroke")) {
      node.setAttribute("stroke", style.stroke);
    }
    if (style.fontSize) node.setAttribute("font-size", style.fontSize);
    if (style.fontFamily) node.setAttribute("font-family", style.fontFamily);
  }
}

function svgToPng(svg: SVGSVGElement) {
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || Number(svg.getAttribute("width")) || captureCssWidth));
  const height = Math.max(1, Math.round(rect.height || Number(svg.getAttribute("height")) || captureCssHeight));
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineSvgColors(clone);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  return new Promise<{ dataUrl: string; width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("Chart could not be captured."));
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({ dataUrl: canvas.toDataURL("image/png"), width, height });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Chart could not be captured."));
    };
    image.src = url;
  });
}

async function captureChart(block: Extract<PdfBlock, { kind: "chart" }>) {
  if (block.rows.length === 0) return block;
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-12000px;top:0;width:${captureCssWidth}px;height:${captureCssHeight}px;background:#fff;z-index:-1;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    root.render(
      <div style={{ width: captureCssWidth, height: captureCssHeight, background: "#fff" }}>
        <ChartPlot
          rows={block.rows}
          chartType={block.card.chartType}
          colors={block.colors}
          valueKey={block.card.valueKey}
          pattern={block.card.pattern}
          animate={false}
        />
      </div>,
    );
    await waitFrames(3);
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    const svg = host.querySelector("svg");
    if (!(svg instanceof SVGSVGElement)) return block;
    const captured = await svgToPng(svg);
    const pdfWidth = 540;
    const pdfHeight = Math.min(160, Math.round((captured.height / captured.width) * pdfWidth));
    return { ...block, image: captured.dataUrl, width: pdfWidth, height: pdfHeight };
  } finally {
    root.unmount();
    host.remove();
  }
}

export async function capturePdfCharts(blocks: PdfBlock[]) {
  const next: PdfBlock[] = [];
  for (const block of blocks) {
    next.push(block.kind === "chart" ? await captureChart(block) : block);
  }
  return next;
}
