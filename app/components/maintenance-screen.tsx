import Image from "next/image";

import { FIVE_KAMPF_BRAND } from "@/lib/brand-assets";

export default function MaintenanceScreen() {
  return (
    <main className="min-h-screen bg-[#f6f3ee] text-[#1f2933]">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="relative size-28 overflow-hidden rounded-full border border-[#d9cdbb] bg-white shadow-sm sm:size-36">
            <Image
              src={FIVE_KAMPF_BRAND.mark}
              alt="5Kampf Bad Bayersoien"
              fill
              sizes="(min-width: 640px) 144px, 112px"
              className="object-cover"
              priority
            />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">
            Wartungsarbeiten
          </p>
        </div>

        <section className="w-full rounded-lg border border-[#d9cdbb] bg-white px-5 py-8 shadow-sm sm:px-8 sm:py-10">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-md border-4 border-[#f59e0b] bg-[#fef3c7] text-4xl shadow-inner">
            !
          </div>
          <h1 className="text-2xl font-bold text-[#111827] sm:text-3xl">
            Portal aktuell geschlossen
          </h1>
          <p className="mt-4 text-base leading-7 text-[#4b5563] sm:text-lg">
            Das Soier 5Kampf Portal ist derzeit wegen Wartungsarbeiten nicht erreichbar.
          </p>
          <p className="mt-3 text-sm leading-6 text-[#6b7280]">
            Wir arbeiten daran, den Zugang schnellstmöglich wieder bereitzustellen.
            Bitte versuche es später erneut.
          </p>
        </section>

        <p className="mt-8 text-xs text-[#6b7280]">
          Bad Bayersoier Fünfkampf für Mannschaften 2026
        </p>
      </div>
    </main>
  );
}
