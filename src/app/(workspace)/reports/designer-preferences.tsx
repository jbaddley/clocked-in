"use client";

import { ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";


export const designerPreferencesKey = "clocked-in.report-designer";

export const zoomSteps = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const defaultDesignerPreferences = { editorOpen: true, zoom: 1 };

export type DesignerPreferences = { editorOpen: boolean; zoom: number };

export const preferenceListeners = new Set<() => void>();
let designerPreferences: DesignerPreferences = defaultDesignerPreferences;
let designerPreferencesLoaded = false;

export function readDesignerPreferences(): DesignerPreferences {
  try {
    const raw = window.localStorage.getItem(designerPreferencesKey);
    if (!raw) return defaultDesignerPreferences;
    const parsed = JSON.parse(raw) as Partial<DesignerPreferences>;
    return {
      editorOpen: parsed.editorOpen !== false,
      zoom: zoomSteps.find((step) => step === parsed.zoom) ?? 1,
    };
  } catch {
    return defaultDesignerPreferences;
  }
}

export function loadDesignerPreferences() {
  if (!designerPreferencesLoaded) {
    designerPreferencesLoaded = true;
    designerPreferences = readDesignerPreferences();
  }
  return designerPreferences;
}

export function subscribeDesignerPreferences(listener: () => void) {
  preferenceListeners.add(listener);
  return () => preferenceListeners.delete(listener);
}

export function updateDesignerPreferences(change: Partial<DesignerPreferences>) {
  designerPreferences = { ...loadDesignerPreferences(), ...change };
  window.localStorage.setItem(designerPreferencesKey, JSON.stringify(designerPreferences));
  preferenceListeners.forEach((listener) => listener());
}

export function serverDesignerPreferences() {
  return defaultDesignerPreferences;
}

export function useDesignerPreferences() {
  const preferences = useSyncExternalStore(subscribeDesignerPreferences, loadDesignerPreferences, serverDesignerPreferences);
  const setEditorOpen = useCallback((editorOpen: boolean) => updateDesignerPreferences({ editorOpen }), []);
  const setZoom = useCallback((zoom: number) => updateDesignerPreferences({ zoom }), []);
  return { editorOpen: preferences.editorOpen, zoom: preferences.zoom, setEditorOpen, setZoom };
}

export function PreviewZoom({ zoom, onZoom }: { zoom: number; onZoom: (zoom: number) => void }) {
  const index = zoomSteps.indexOf(zoom);
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Preview zoom">
      <Button type="button" variant="outline" size="icon" aria-label="Zoom out" disabled={index <= 0} onClick={() => onZoom(zoomSteps[index - 1])}>
        <ZoomOutIcon />
      </Button>
      <Button type="button" variant="outline" className="w-16 tabular-nums" aria-label="Reset zoom" onClick={() => onZoom(1)}>
        {Math.round(zoom * 100)}%
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Zoom in"
        disabled={index === -1 || index >= zoomSteps.length - 1}
        onClick={() => onZoom(zoomSteps[index + 1])}
      >
        <ZoomInIcon />
      </Button>
    </div>
  );
}
