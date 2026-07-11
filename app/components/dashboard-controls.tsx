"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type DashboardStatItem = {
  key: string;
  label: string;
  shortLabel?: string;
  value: string | number;
  total?: string | number;
  tone?: "default" | "secondary" | "outline";
  active?: boolean;
  onClick?: () => void;
};

export function DashboardControlsCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={joinClasses("rounded-md border border-border/60 bg-card/70 p-2.5 shadow-sm", className)}>{children}</div>;
}

export function DashboardSearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={joinClasses("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-8 pl-8 text-xs sm:h-9 sm:text-sm"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function DashboardStatsRow({
  items,
  className,
}: {
  items: DashboardStatItem[];
  className?: string;
}) {
  return (
    <div className={joinClasses("flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap", className)} aria-label="Statistik">
      {items.map((item) => {
        const content = (
          <>
            <span className="hidden sm:inline">{item.label}</span>
            <span className="sm:hidden">{item.shortLabel || item.label}</span>
            <span className="font-semibold tabular-nums">
              {item.value}
              {item.total !== undefined ? <span className="font-normal text-muted-foreground"> / {item.total}</span> : null}
            </span>
          </>
        );

        const inactiveClassName =
          item.tone === "secondary"
            ? "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"
            : item.tone === "default"
              ? "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
              : "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground";

        if (item.onClick) {
          return (
            <button
              key={item.key}
              type="button"
              className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[10px] leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                item.active ? "border-primary bg-primary text-primary-foreground shadow-sm" : inactiveClassName
              }`}
              aria-pressed={item.active}
              onClick={item.onClick}
            >
              {content}
            </button>
          );
        }

        return (
          <div
            key={item.key}
            className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[10px] leading-none ${
              item.active ? "border-primary bg-primary text-primary-foreground shadow-sm" : inactiveClassName
            }`}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}

export function DashboardToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={joinClasses("grid w-full min-w-0 grid-cols-[repeat(auto-fit,minmax(2.25rem,1fr))] items-center gap-1.5 lg:flex lg:w-full lg:flex-wrap lg:justify-end", className)}>
      {children}
    </div>
  );
}

export function DashboardToolbarButton({
  icon,
  label,
  open = false,
  badge,
  onClick,
  disabled,
  variant,
}: {
  icon: ReactNode;
  label: string;
  open?: boolean;
  badge?: string | number | null;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "outline" | "ghost";
}) {
  const resolvedVariant = variant ?? (open ? "default" : "outline");

  return (
    <div className="relative flex min-w-0 items-center lg:size-6">
      <Button
        type="button"
        size="icon-xs"
        className="h-7 w-full lg:size-6"
        variant={resolvedVariant}
        onClick={onClick}
        aria-expanded={open}
        title={label}
        aria-label={label}
        disabled={disabled}
      >
        {icon}
      </Button>
      {badge !== undefined && badge !== null && badge !== "" ? (
        <Badge
          className={`pointer-events-none absolute -right-1 -top-1 h-4 min-w-4 justify-center border-2 px-1 text-[10px] shadow-sm ${
            open
              ? "border-background bg-primary text-primary-foreground ring-1 ring-primary-foreground/60"
              : "border-primary/50 bg-background text-primary"
          }`}
          variant="default"
        >
          {badge}
        </Badge>
      ) : null}
    </div>
  );
}

export function DashboardPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={joinClasses("rounded-md border border-border/50 bg-popover p-1.5 text-popover-foreground shadow-sm", className)}>{children}</div>;
}
