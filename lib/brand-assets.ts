export type BrandDisciplineCode = "RUN" | "BENCH" | "STOCK" | "ROAD" | "MTB";

export const FIVE_KAMPF_BRAND = {
  banner: "/brand/5kampf/banner.webp",
  mark: "/brand/5kampf/mark.webp",
  disciplines: {
    RUN: {
      label: "Laufen",
      image: "/brand/5kampf/run.webp",
    },
    BENCH: {
      label: "Bankdrücken",
      image: "/brand/5kampf/bench.webp",
    },
    STOCK: {
      label: "Stockschießen",
      image: "/brand/5kampf/stock.webp",
    },
    ROAD: {
      label: "Rennrad",
      image: "/brand/5kampf/mtb.webp",
    },
    MTB: {
      label: "Mountainbike",
      image: "/brand/5kampf/road.webp",
    },
  } satisfies Record<BrandDisciplineCode, { label: string; image: string }>,
} as const;
