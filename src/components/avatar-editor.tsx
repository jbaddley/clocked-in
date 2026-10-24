"use client";

import { useEffect, useRef, useState } from "react";
import { ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const minZoom = 1;
const maxZoom = 3;
const outputSize = 512;

function coverScale(image: HTMLImageElement, size: number) {
  return Math.max(size / image.naturalWidth, size / image.naturalHeight);
}

function clampZoom(value: number) {
  return Math.min(maxZoom, Math.max(minZoom, value));
}

function clampOffset(offset: { x: number; y: number }, image: HTMLImageElement, zoom: number, size: number) {
  const scale = coverScale(image, size) * zoom;
  const maxX = Math.max(0, (image.naturalWidth * scale - size) / 2);
  const maxY = Math.max(0, (image.naturalHeight * scale - size) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  };
}

function paint(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  zoom: number,
  offset: { x: number; y: number },
  size: number,
) {
  const scale = coverScale(image, size) * zoom;
  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, (size - drawW) / 2 + offset.x, (size - drawH) / 2 + offset.y, drawW, drawH);
}

function canvasType() {
  const probe = document.createElement("canvas");
  probe.width = 1;
  probe.height = 1;
  return probe.toDataURL("image/webp").startsWith("data:image/webp") ? "image/webp" : "image/png";
}

async function exportSquare(image: HTMLImageElement, zoom: number, offset: { x: number; y: number }, viewport: number) {
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx || viewport <= 0) {
    throw new Error("Could not crop that photo.");
  }

  const ratio = outputSize / viewport;
  paint(ctx, image, zoom, { x: offset.x * ratio, y: offset.y * ratio }, outputSize);
  const type = canvasType();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
  if (!blob) {
    throw new Error("Could not crop that photo.");
  }

  const extension = type === "image/webp" ? "webp" : "png";
  return new File([blob], `avatar.${extension}`, { type });
}

export function AvatarEditor({
  file,
  open,
  onOpenChange,
  onConfirm,
}: {
  file: File | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (file: File) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const zoomRef = useRef(minZoom);
  const drag = useRef<{ x: number; y: number; origin: { x: number; y: number } } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(minZoom);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState(256);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    imageRef.current = image;
    zoomRef.current = zoom;
  }, [image, zoom]);

  useEffect(() => {
    if (!open || !file) {
      return;
    }

    const url = URL.createObjectURL(file);
    const next = new Image();
    let cancelled = false;
    next.onload = () => {
      if (cancelled) return;
      if (next.naturalWidth < 1 || next.naturalHeight < 1) {
        imageRef.current = null;
        setImage(null);
        setError("That file is not an image.");
        return;
      }

      imageRef.current = next;
      zoomRef.current = minZoom;
      setImage(next);
      setZoom(minZoom);
      setOffset({ x: 0, y: 0 });
      setError(null);
    };
    next.onerror = () => {
      if (cancelled) return;
      imageRef.current = null;
      setImage(null);
      setError("That file is not an image.");
    };
    next.src = url;
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file, open]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node || !open) return;
    const observer = new ResizeObserver(() => {
      const nextViewport = Math.max(1, Math.round(node.clientWidth));
      const currentImage = imageRef.current;
      setViewport(nextViewport);
      if (!currentImage) return;
      setOffset((current) => clampOffset(current, currentImage, zoomRef.current, nextViewport));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image || viewport < 1) return;
    const dpr = window.devicePixelRatio || 1;
    const size = viewport * dpr;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    paint(ctx, image, zoom, { x: offset.x * dpr, y: offset.y * dpr }, size);
  }, [image, offset, viewport, zoom]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node || !open) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const zoomValue = clampZoom(zoomRef.current + (event.deltaY < 0 ? 0.08 : -0.08));
      const currentImage = imageRef.current;
      const size = stageRef.current?.clientWidth || 256;
      zoomRef.current = zoomValue;
      setZoom(zoomValue);
      if (currentImage) {
        setOffset((current) => clampOffset(current, currentImage, zoomValue, size));
      }
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [open]);

  function changeZoom(next: number) {
    const zoomValue = clampZoom(next);
    zoomRef.current = zoomValue;
    setZoom(zoomValue);
    if (!image) return;
    setOffset((current) => clampOffset(current, image, zoomValue, viewport));
  }

  function moveBy(dx: number, dy: number) {
    if (!image) return;
    setOffset((current) => clampOffset({ x: current.x + dx, y: current.y + dy }, image, zoom, viewport));
  }

  async function confirm() {
    if (!image || saving) return;
    setSaving(true);
    setError(null);
    try {
      onConfirm(await exportSquare(image, zoom, offset, viewport));
      onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "Could not crop that photo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust photo</DialogTitle>
          <DialogDescription>Drag the photo so your face sits in the circle. The avatar is saved as a square.</DialogDescription>
        </DialogHeader>
        <div
          ref={stageRef}
          tabIndex={0}
          aria-label="Photo position. Drag to center your face, or use the arrow keys."
          className="relative mx-auto aspect-square w-full max-w-64 cursor-grab touch-none overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
          onPointerDown={(event) => {
            if (!image) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, y: event.clientY, origin: offset };
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (!start || !image) return;
            setOffset(
              clampOffset(
                { x: start.origin.x + event.clientX - start.x, y: start.origin.y + event.clientY - start.y },
                image,
                zoom,
                viewport,
              ),
            );
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 20 : 8;
            if (event.key === "ArrowLeft") moveBy(step, 0);
            else if (event.key === "ArrowRight") moveBy(-step, 0);
            else if (event.key === "ArrowUp") moveBy(0, step);
            else if (event.key === "ArrowDown") moveBy(0, -step);
            else if (event.key === "+" || event.key === "=") changeZoom(zoom + 0.08);
            else if (event.key === "-" || event.key === "_") changeZoom(zoom - 0.08);
            else return;
            event.preventDefault();
          }}
        >
          <canvas ref={canvasRef} className="size-full" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: "radial-gradient(circle closest-side, transparent calc(100% - 2px), rgb(0 0 0 / 0.55) 100%)",
            }}
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white" />
          {!image && !error ? (
            <span className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground">Loading photo…</span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <ZoomOutIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            aria-label="Zoom"
            type="range"
            min={minZoom}
            max={maxZoom}
            step={0.01}
            value={zoom}
            disabled={!image}
            className="h-2 w-full accent-primary"
            onChange={(event) => changeZoom(Number(event.target.value))}
          />
          <ZoomInIcon className="size-4 shrink-0 text-muted-foreground" />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!image || saving} onClick={() => void confirm()}>
            Use photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
