"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, Ban, Mail, MessageCircle, UserCheck, UserRound, UsersRound } from "lucide-react";

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

export type AccountLinkDialogTargetType = "team" | "user" | "claim" | "message" | "default";

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
  if (targetType === "user") return "border-sky-500/40 bg-sky-500/10 text-sky-700 hover:bg-sky-500/15 dark:text-sky-200";
  if (targetType === "claim") return "border-violet-500/40 bg-violet-500/10 text-violet-700 hover:bg-violet-500/15 dark:text-violet-200";
  if (targetType === "message") return "border-rose-500/40 bg-rose-500/10 text-rose-700 hover:bg-rose-500/15 dark:text-rose-200";
  return "border-border/60 bg-muted/20 text-foreground hover:bg-muted/40";
}

function getTargetIcon(targetType?: AccountLinkDialogTargetType) {
  if (targetType === "team") return <UsersRound className="size-3.5" />;
  if (targetType === "user") return <UserRound className="size-3.5" />;
  if (targetType === "claim") return <Mail className="size-3.5" />;
  if (targetType === "message") return <MessageCircle className="size-3.5" />;
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
  const visibleActions = actions ?? [];

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
      <DialogContent
        className="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-lg"
        onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
      >
        <DialogHeader className="border-b border-border/60 px-4 py-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-3 overflow-y-auto px-4 py-4">
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
          <DialogFooter className="mt-0">
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
