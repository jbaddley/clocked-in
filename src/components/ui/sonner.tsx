"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          // Inline on the toaster: Sonner's theme sheet sets these on the same
          // element, and that sheet loads after app CSS, so :root brand tokens lose.
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--success-bg": "color-mix(in oklch, var(--success) 14%, var(--popover))",
          "--success-border": "color-mix(in oklch, var(--success) 42%, var(--popover))",
          "--success-text": "var(--success)",
          "--info-bg": "color-mix(in oklch, var(--primary) 10%, var(--popover))",
          "--info-border": "color-mix(in oklch, var(--primary) 32%, var(--popover))",
          "--info-text": "var(--primary)",
          "--warning-bg": "color-mix(in oklch, var(--highlight) 18%, var(--popover))",
          "--warning-border": "color-mix(in oklch, var(--highlight) 48%, var(--popover))",
          "--warning-text": "var(--foreground)",
          "--error-bg": "color-mix(in oklch, var(--accent) 12%, var(--popover))",
          "--error-border": "color-mix(in oklch, var(--accent) 40%, var(--popover))",
          "--error-text": "var(--accent)",
          fontFamily: "var(--font-sans), sans-serif",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
