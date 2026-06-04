"use client"

import type { ReactNode } from "react"
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"

type StatusMessageTone = "error" | "warning" | "success" | "info"

const toneStyles: Record<StatusMessageTone, { container: string; icon: string; Icon: typeof Info }> = {
  error: {
    container: "border-destructive/50 border-l-destructive",
    icon: "text-destructive",
    Icon: XCircle,
  },
  warning: {
    container: "border-amber-500/60 border-l-amber-500",
    icon: "text-amber-700 dark:text-amber-300",
    Icon: AlertTriangle,
  },
  success: {
    container: "border-emerald-500/60 border-l-emerald-500",
    icon: "text-emerald-700 dark:text-emerald-300",
    Icon: CheckCircle2,
  },
  info: {
    container: "border-primary/45 border-l-primary",
    icon: "text-primary",
    Icon: Info,
  },
}

function StatusMessage({
  tone = "info",
  children,
  className,
  icon = true,
  role,
}: {
  tone?: StatusMessageTone
  children: ReactNode
  className?: string
  icon?: boolean
  role?: "alert" | "status" | "note"
}) {
  const styles = toneStyles[tone]
  const Icon = styles.Icon

  return (
    <div
      className={cn(
        "rounded-md border border-l-4 bg-card px-3 py-2.5 text-sm text-card-foreground shadow-sm",
        styles.container,
        className,
      )}
      role={role ?? (tone === "error" ? "alert" : "status")}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? (
          <Icon className={cn("mt-0.5 size-4 shrink-0", styles.icon)} aria-hidden="true" />
        ) : null}
        <div className="min-w-0 flex-1 space-y-1 leading-5">{children}</div>
      </div>
    </div>
  )
}

export { StatusMessage }
