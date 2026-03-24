"use client";

export default function LivePlaceholder() {
  return (
    <div className="text-center py-16 space-y-4">
      <span className="text-6xl">🏆</span>
      <h2 className="text-xl font-semibold">Live-Ergebnisse</h2>
      <p className="text-muted-foreground text-sm max-w-xs mx-auto">
        Ergebnisse und Ranglisten werden hier angezeigt sobald der Wettkampf läuft.
      </p>
    </div>
  );
}