"use client";

import Image from "next/image";

import { FIVE_KAMPF_BRAND, type BrandDisciplineCode } from "@/lib/brand-assets";
import { cn } from "@/lib/utils";

type DisciplineBrandIconProps = {
  code?: string | null;
  label?: string;
  className?: string;
  imageClassName?: string;
};

function isBrandDisciplineCode(code?: string | null): code is BrandDisciplineCode {
  return code === "RUN" || code === "BENCH" || code === "STOCK" || code === "ROAD" || code === "MTB";
}

export function DisciplineBrandIcon({ code, label, className, imageClassName }: DisciplineBrandIconProps) {
  const brandDiscipline = isBrandDisciplineCode(code) ? FIVE_KAMPF_BRAND.disciplines[code] : null;

  if (!brandDiscipline) {
    return (
      <span
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-xs font-semibold text-muted-foreground",
          className,
        )}
        title={label || "Disziplin offen"}
        aria-hidden="true"
      >
        ?
      </span>
    );
  }

  return (
    <span
      className={cn("relative inline-flex size-8 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted", className)}
      title={label || brandDiscipline.label}
      aria-hidden="true"
    >
      <Image
        src={brandDiscipline.image}
        alt=""
        fill
        sizes="48px"
        className={cn("object-cover", imageClassName)}
      />
    </span>
  );
}

export function DisciplineBrandBadge({
  code,
  label,
  className,
}: DisciplineBrandIconProps) {
  const brandDiscipline = isBrandDisciplineCode(code) ? FIVE_KAMPF_BRAND.disciplines[code] : null;
  const displayLabel = label || brandDiscipline?.label || "Disziplin offen";

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <DisciplineBrandIcon code={code} label={displayLabel} className="size-6 rounded" />
      <span className="min-w-0 truncate">{displayLabel}</span>
    </span>
  );
}
