"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { ErrorEvent, Map as MapLibreMap, Marker } from "maplibre-gl";
import {
  AlertTriangle,
  Building2,
  ExternalLink,
  Layers,
  MapPin,
  Navigation,
  Route,
} from "lucide-react";
import { BAD_BAYERSOIEN_CENTER, SPONSOR_POIS, sponsorsToGeoJson, type SponsorPoi } from "@/lib/event-map/sponsor-pois";

type LeaderLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const MAP_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${MAPTILER_KEY}`
  : "https://demotiles.maplibre.org/style.json";

function boundsForSponsors(sponsors: SponsorPoi[]) {
  const bounds = new maplibregl.LngLatBounds();
  bounds.extend(BAD_BAYERSOIEN_CENTER);
  sponsors.forEach((sponsor) => bounds.extend(sponsor.coordinates));
  return bounds;
}

function SponsorBadge({ sponsor }: { sponsor: SponsorPoi }) {
  return (
    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground shadow-sm">
      {sponsor.logoText}
    </span>
  );
}

function ConfidenceLabel({ confidence }: { confidence: SponsorPoi["confidence"] }) {
  if (confidence === "verified") {
    return <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">verifiziert</span>;
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
      <AlertTriangle className="h-3 w-3" />
      pruefen
    </span>
  );
}

export default function EventMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [selectedSponsorId, setSelectedSponsorId] = useState(SPONSOR_POIS[0]?.id ?? "");
  const [sponsorsVisible, setSponsorsVisible] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [leaderLine, setLeaderLine] = useState<LeaderLine | null>(null);

  const selectedSponsor = useMemo(
    () => SPONSOR_POIS.find((sponsor) => sponsor.id === selectedSponsorId) ?? SPONSOR_POIS[0],
    [selectedSponsorId],
  );

  const updateLeaderLine = useCallback(() => {
    const shell = shellRef.current;
    const card = cardRefs.current.get(selectedSponsorId);
    const marker = markersRef.current.get(selectedSponsorId)?.getElement();
    if (!shell || !card || !marker || !sponsorsVisible) {
      setLeaderLine(null);
      return;
    }

    const shellRect = shell.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const markerVisible =
      markerRect.width > 0 &&
      markerRect.height > 0 &&
      markerRect.right >= shellRect.left &&
      markerRect.left <= shellRect.right &&
      markerRect.bottom >= shellRect.top &&
      markerRect.top <= shellRect.bottom;
    const cardVisible =
      cardRect.width > 0 &&
      cardRect.height > 0 &&
      cardRect.right >= shellRect.left &&
      cardRect.left <= shellRect.right &&
      cardRect.bottom >= shellRect.top &&
      cardRect.top <= shellRect.bottom;

    if (!markerVisible || !cardVisible) {
      setLeaderLine(null);
      return;
    }

    setLeaderLine({
      x1: cardRect.left + cardRect.width / 2 - shellRect.left,
      y1: cardRect.top + cardRect.height / 2 - shellRect.top,
      x2: markerRect.left + markerRect.width / 2 - shellRect.left,
      y2: markerRect.top + markerRect.height / 2 - shellRect.top,
    });
  }, [selectedSponsorId, sponsorsVisible]);

  const scheduleLeaderLineUpdate = useCallback(() => {
    window.requestAnimationFrame(updateLeaderLine);
  }, [updateLeaderLine]);

  const selectSponsor = useCallback((sponsor: SponsorPoi, flyTo = true) => {
    setSelectedSponsorId(sponsor.id);
    if (flyTo && mapRef.current) {
      mapRef.current.flyTo({
        center: sponsor.coordinates,
        zoom: 14.7,
        duration: 650,
        essential: true,
      });
    }
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: MAP_STYLE,
        center: BAD_BAYERSOIEN_CENTER,
        zoom: 12.6,
        attributionControl: false,
      });

      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

      map.on("load", () => {
        map.fitBounds(boundsForSponsors(SPONSOR_POIS), {
          padding: { top: 70, bottom: 70, left: 70, right: 70 },
          maxZoom: 13.2,
          duration: 0,
        });

        map.addSource("sponsors", {
          type: "geojson",
          data: sponsorsToGeoJson(SPONSOR_POIS),
        });
      });

      map.on("error", (event: ErrorEvent) => {
        const message = event.error?.message || "Die Karte konnte nicht vollstaendig geladen werden.";
        setMapError(message);
      });

      const markers = markersRef.current;
      return () => {
        markers.forEach((marker) => marker.remove());
        markers.clear();
        map.remove();
        mapRef.current = null;
      };
    } catch (error) {
      window.setTimeout(() => {
        setMapError(error instanceof Error ? error.message : "Die Karte konnte nicht initialisiert werden.");
      }, 0);
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    if (sponsorsVisible) {
      SPONSOR_POIS.forEach((sponsor) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className =
          "event-map-marker inline-flex size-9 items-center justify-center rounded-md border-2 border-white bg-primary text-[11px] font-bold text-primary-foreground shadow-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
        el.textContent = sponsor.logoText;
        el.title = sponsor.name;
        el.setAttribute("aria-label", `${sponsor.name} auf Karte fokussieren`);
        el.addEventListener("click", () => selectSponsor(sponsor, false));

        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat(sponsor.coordinates)
          .addTo(map);
        markersRef.current.set(sponsor.id, marker);
      });
    }

    scheduleLeaderLineUpdate();
  }, [selectSponsor, sponsorsVisible, scheduleLeaderLineUpdate]);

  useEffect(() => {
    markersRef.current.forEach((marker, sponsorId) => {
      const element = marker.getElement();
      element.classList.toggle("ring-4", sponsorId === selectedSponsorId);
      element.classList.toggle("ring-amber-300", sponsorId === selectedSponsorId);
      element.classList.toggle("scale-110", sponsorId === selectedSponsorId);
    });

    const selectedCard = cardRefs.current.get(selectedSponsorId);
    selectedCard?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    scheduleLeaderLineUpdate();
  }, [selectedSponsorId, scheduleLeaderLineUpdate]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.on("move", scheduleLeaderLineUpdate);
    map.on("resize", scheduleLeaderLineUpdate);
    window.addEventListener("resize", scheduleLeaderLineUpdate);
    return () => {
      map.off("move", scheduleLeaderLineUpdate);
      map.off("resize", scheduleLeaderLineUpdate);
      window.removeEventListener("resize", scheduleLeaderLineUpdate);
    };
  }, [scheduleLeaderLineUpdate]);

  return (
    <div ref={shellRef} className="relative min-h-[calc(100vh-3rem)] overflow-hidden bg-background">
      {leaderLine && (
        <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden="true">
          <line
            x1={leaderLine.x1}
            y1={leaderLine.y1}
            x2={leaderLine.x2}
            y2={leaderLine.y2}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="5 6"
            className="text-primary/45"
          />
        </svg>
      )}

      <div className="grid min-h-[calc(100vh-3rem)] grid-cols-1 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <aside className="z-10 order-2 flex max-h-[48vh] flex-col border-t border-border/50 bg-background/95 lg:order-1 lg:max-h-none lg:border-r lg:border-t-0">
          <div className="border-b border-border/50 px-4 py-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Bad Bayersoien
            </div>
            <h1 className="mt-1 text-2xl font-semibold">Event-Karte</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sponsoren als erster Layer. Strecken und Infrastruktur sind vorbereitet.
            </p>
          </div>

          <div className="border-b border-border/50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Layers className="h-4 w-4" />
              Layer
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <label className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Sponsoren
                </span>
                <input
                  type="checkbox"
                  checked={sponsorsVisible}
                  onChange={(event) => setSponsorsVisible(event.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
              </label>
              <button
                type="button"
                disabled
                className="flex cursor-not-allowed items-center justify-between rounded-md border border-dashed border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Infrastruktur
                </span>
                <span className="text-[11px]">spaeter</span>
              </button>
              <button
                type="button"
                disabled
                className="flex cursor-not-allowed items-center justify-between rounded-md border border-dashed border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  <Route className="h-4 w-4" />
                  Strecken
                </span>
                <span className="text-[11px]">spaeter</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-2">
              {SPONSOR_POIS.map((sponsor) => {
                const selected = sponsor.id === selectedSponsorId;
                return (
                  <button
                    key={sponsor.id}
                    ref={(node) => {
                      if (node) cardRefs.current.set(sponsor.id, node);
                      else cardRefs.current.delete(sponsor.id);
                    }}
                    type="button"
                    onClick={() => selectSponsor(sponsor)}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                      selected
                        ? "border-primary/70 bg-primary/10 shadow-sm ring-1 ring-primary/30"
                        : "border-border/60 bg-card hover:bg-accent/50"
                    }`}
                    aria-pressed={selected}
                  >
                    <div className="flex gap-3">
                      <SponsorBadge sponsor={sponsor} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-tight">{sponsor.name}</p>
                          <ConfidenceLabel confidence={sponsor.confidence} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{sponsor.category}</p>
                        <p className="mt-2 text-xs leading-snug text-muted-foreground">{sponsor.address}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="relative order-1 min-h-[52vh] lg:order-2 lg:min-h-[calc(100vh-3rem)]">
          <div ref={mapContainerRef} className="absolute inset-0" />

          {!MAPTILER_KEY && (
            <div className="absolute left-3 top-3 z-10 max-w-[min(24rem,calc(100vw-1.5rem))] rounded-md border border-amber-300/70 bg-amber-50/95 px-3 py-2 text-xs text-amber-950 shadow-sm dark:border-amber-500/40 dark:bg-amber-950/90 dark:text-amber-100">
              Demo-Karte aktiv. Fuer Produktion bitte `NEXT_PUBLIC_MAPTILER_KEY` setzen.
            </div>
          )}

          {mapError && (
            <div className="absolute inset-x-3 top-3 z-10 rounded-md border border-destructive/40 bg-background/95 px-3 py-2 text-sm text-destructive shadow-sm">
              {mapError}
            </div>
          )}

          {selectedSponsor && (
            <div className="absolute bottom-4 left-3 right-3 z-10 max-w-xl rounded-md border border-border/60 bg-background/95 p-3 shadow-lg backdrop-blur lg:left-4 lg:right-auto">
              <div className="flex gap-3">
                <SponsorBadge sponsor={selectedSponsor} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{selectedSponsor.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedSponsor.address}</p>
                    </div>
                    <ConfidenceLabel confidence={selectedSponsor.confidence} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{selectedSponsor.sourceNote}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={selectedSponsor.routeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 bg-card px-2.5 text-xs font-medium hover:bg-accent"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      Route
                    </a>
                    {selectedSponsor.websiteUrl && (
                      <a
                        href={selectedSponsor.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 bg-card px-2.5 text-xs font-medium hover:bg-accent"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Website
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
