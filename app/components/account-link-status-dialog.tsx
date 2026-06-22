"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, Ban, Mail, UserCheck, UserRound, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AccountLinkStatusMeta } from "@/lib/account-link-status";

export type AccountLinkDialogTargetType = "team" | "user" | "claim" | "default";

export type AccountLinkDialogRow = {
  label: string;
  value?: ReactNode | null;
  onClick?: () => void;
  targetType?: AccountLinkDialogTargetType;
  title?: string;
};

export type AccountLinkDialogAction = {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary" | "destructive";
};

export function AccountLinkStatusIcon({
  status,
  className,
}: {
  status: AccountLinkStatusMeta["status"];
  className: string;
}) {
  switch (status) {
    case "linked":
      return <UserCheck className={className} />;
    case "portal_account":
    case "placeholder_user":
      return <UserRound className={className} />;
    case "invitation_open":
      return <Mail className={className} />;
    case "expired":
      return <AlertTriangle className={className} />;
    case "revoked":
      return <Ban className={className} />;
    case "missing_email":
      return <AlertTriangle className={className} />;
    default:
      return <Mail className={className} />;
  }
}

function getTargetClassName(targetType?: AccountLinkDialogTargetType) {
  if (targetType === "team") return "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10";
  if (targetType === "user") return "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100";
  if (targetType === "claim") return "border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100";
  return "border-border/60 bg-muted/20 hover:bg-muted/40";
}

function getTargetIcon(targetType?: AccountLinkDialogTargetType) {
  if (targetType === "team") return <UsersRound className="size-3.5" />;
  if (targetType === "user") return <UserRound className="size-3.5" />;
  if (targetType === "claim") return <Mail className="size-3.5" />;
  return null;
}

export default function AccountLinkStatusDialog({
  meta,
  title,
  rows,
  actions,
  compact = false,
  stopPropagation = true,
}: {
  meta: AccountLinkStatusMeta;
  title: string;
  rows: AccountLinkDialogRow[];
  actions?: AccountLinkDialogAction[];
  compact?: boolean;
  stopPropagation?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const visibleRows = rows.filter((row) => row.value !== undefined && row.value !== null && row.value !== "");
  const hasTargetRows = visibleRows.some((row) => row.onClick);
  const visibleActions = hasTargetRows ? [] : actions ?? [];

  const runAndClose = (callback: () => void) => {
    setOpen(false);
    window.setTimeout(callback, 0);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className={`inline-flex max-w-full items-center justify-center gap-1 rounded-md border px-1.5 font-medium transition-colors hover:bg-muted ${compact ? "h-5 text-[10px]" : "h-6 text-[10px]"} ${meta.className}`}
            title={meta.description}
            onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
          />
        }
      >
        <AccountLinkStatusIcon status={meta.status} className="size-3 shrink-0" />
        <span className="truncate">{meta.label}</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className={`inline-flex w-fit items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${meta.className}`}>
            <AccountLinkStatusIcon status={meta.status} className="size-3.5" />
            {meta.label}
          </div>
          <div className="grid gap-2 text-sm">
            {visibleRows.map((row) => {
              const targetIcon = getTargetIcon(row.targetType);
              const className = getTargetClassName(row.targetType);
              const content = (
                <>
                  <span className="flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground">
                    {targetIcon}
                    {row.label}
                  </span>
                  <span className="flex min-w-0 items-center justify-between gap-2 break-words text-foreground">
                    <span className="min-w-0 break-words">{row.value}</span>
                    {row.onClick && <ArrowRight className="size-3.5 shrink-0 opacity-70" />}
                  </span>
                </>
              );

              if (row.onClick) {
                return (
                  <button
                    key={row.label}
                    type="button"
                    className={`grid gap-1 rounded-md border px-3 py-2 text-left transition-colors sm:grid-cols-[9rem_minmax(0,1fr)] ${className}`}
                    title={row.title}
                    onClick={() => runAndClose(row.onClick!)}
                  >
                    {content}
                  </button>
                );
              }

              return (
                <div key={row.label} className={`grid gap-1 rounded-md border px-3 py-2 sm:grid-cols-[9rem_minmax(0,1fr)] ${className}`}>
                  {content}
                </div>
              );
            })}
          </div>
        </div>
        {visibleActions.length > 0 && (
          <DialogFooter>
            {visibleActions.map((action) => (
              <Button key={action.label} type="button" variant={action.variant || "outline"} onClick={() => runAndClose(action.onClick)}>
                {action.label}
              </Button>
            ))}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
