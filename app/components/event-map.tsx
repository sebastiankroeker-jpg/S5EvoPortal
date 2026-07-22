"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const MAP_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${MAPTILER_KEY}`
  : "https://demotiles.maplibre.org/style.json";
const MAPLIBRE_WORKER_URL = new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString();

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
  const maplibreRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [selectedSponsorId, setSelectedSponsorId] = useState(SPONSOR_POIS[0]?.id ?? "");
  const [sponsorsVisible, setSponsorsVisible] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const selectedSponsor = useMemo(
    () => SPONSOR_POIS.find((sponsor) => sponsor.id === selectedSponsorId) ?? SPONSOR_POIS[0],
    [selectedSponsorId],
  );

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

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let loadTimeout: number | null = null;
    const markers = markersRef.current;
    setMapLoaded(false);

    const initializeMap = async () => {
      try {
        const maplibregl = await import("maplibre-gl");
        maplibregl.setWorkerUrl(MAPLIBRE_WORKER_URL);

        if (cancelled || !mapContainerRef.current) return;

        maplibreRef.current = maplibregl;
        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: MAP_STYLE,
          center: BAD_BAYERSOIEN_CENTER,
          zoom: 14.2,
          attributionControl: false,
          cooperativeGestures: false,
          dragPan: true,
          dragRotate: false,
          touchZoomRotate: true,
        });

        mapRef.current = map;
        setMapError(null);
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

        loadTimeout = window.setTimeout(() => {
          if (!cancelled) {
            setMapError("MapLibre hat auf diesem Geraet keinen Load-Event gemeldet. Bitte Safari/WebGL oder Content-Blocker pruefen.");
          }
        }, 8000);

        map.on("load", () => {
          if (loadTimeout) {
            window.clearTimeout(loadTimeout);
            loadTimeout = null;
          }

          map.jumpTo({
            center: BAD_BAYERSOIEN_CENTER,
            zoom: 14.2,
          });

          map.addSource("sponsors", {
            type: "geojson",
            data: sponsorsToGeoJson(SPONSOR_POIS),
          });

          setMapLoaded(true);
          window.requestAnimationFrame(() => map.resize());
        });

        resizeObserver = new ResizeObserver(() => {
          window.requestAnimationFrame(() => map.resize());
        });
        resizeObserver.observe(mapContainerRef.current);

        map.on("error", (event: ErrorEvent) => {
          const message = event.error?.message || "Die Karte konnte nicht vollstaendig geladen werden.";
          setMapError(message);
        });
      } catch (error) {
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : "Die Karte konnte nicht initialisiert werden.");
        }
      }
    };

    void initializeMap();

    return () => {
      cancelled = true;
      markers.forEach((marker) => marker.remove());
      markers.clear();
      if (loadTimeout) window.clearTimeout(loadTimeout);
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (!map || !maplibregl) return;

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
  }, [mapLoaded, selectSponsor, sponsorsVisible]);

  useEffect(() => {
    markersRef.current.forEach((marker, sponsorId) => {
      const element = marker.getElement();
      element.classList.toggle("ring-4", sponsorId === selectedSponsorId);
      element.classList.toggle("ring-amber-300", sponsorId === selectedSponsorId);
      element.classList.toggle("scale-110", sponsorId === selectedSponsorId);
    });

    const selectedCard = cardRefs.current.get(selectedSponsorId);
    selectedCard?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedSponsorId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const resizeMap = () => map.resize();
    window.addEventListener("orientationchange", resizeMap);
    window.addEventListener("resize", resizeMap);
    return () => {
      window.removeEventListener("orientationchange", resizeMap);
      window.removeEventListener("resize", resizeMap);
    };
  }, []);

  return (
    <div
      ref={shellRef}
      className="relative min-h-[calc(100svh-3rem)] overflow-x-hidden bg-background lg:h-[calc(100vh-3rem)] lg:overflow-hidden"
    >
      <div className="grid min-h-[calc(100svh-3rem)] grid-cols-1 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <aside className="z-10 order-2 flex flex-col border-t border-border/50 bg-background/95 lg:order-1 lg:max-h-none lg:border-r lg:border-t-0">
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
              <div className="rounded-md border border-border/60 bg-card">
                <label className="flex items-center justify-between px-3 py-2 text-sm">
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

                {sponsorsVisible && (
                  <div className="border-t border-border/50 px-2 py-2">
                    <div className="space-y-1 border-l border-border/70 pl-2">
                      {SPONSOR_POIS.map((sponsor) => {
                        const selected = sponsor.id === selectedSponsorId;
                        return (
                          <div key={sponsor.id} className="rounded-md">
                            <button
                              ref={(node) => {
                                if (node) cardRefs.current.set(sponsor.id, node);
                                else cardRefs.current.delete(sponsor.id);
                              }}
                              type="button"
                              onClick={() => selectSponsor(sponsor)}
                              className={`w-full rounded-md px-2 py-2 text-left transition-colors ${
                                selected
                                  ? "bg-primary/10 text-foreground ring-1 ring-primary/25"
                                  : "hover:bg-accent/60"
                              }`}
                              aria-pressed={selected}
                            >
                              <span className="flex gap-2">
                                <SponsorBadge sponsor={sponsor} />
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-start justify-between gap-2">
                                    <span className="text-sm font-semibold leading-tight">{sponsor.name}</span>
                                    <ConfidenceLabel confidence={sponsor.confidence} />
                                  </span>
                                  <span className="mt-1 block text-xs text-muted-foreground">{sponsor.category}</span>
                                  <span className="mt-1 block text-xs leading-snug text-muted-foreground">{sponsor.address}</span>
                                </span>
                              </span>
                            </button>
                            {selected && selectedSponsor && (
                              <div className="ml-12 mr-2 pb-2">
                                <p className="text-xs leading-snug text-muted-foreground">{selectedSponsor.sourceNote}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <a
                                    href={selectedSponsor.routeUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 bg-background px-2.5 text-xs font-medium hover:bg-accent"
                                  >
                                    <Navigation className="h-3.5 w-3.5" />
                                    Route
                                  </a>
                                  {selectedSponsor.websiteUrl && (
                                    <a
                                      href={selectedSponsor.websiteUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 bg-background px-2.5 text-xs font-medium hover:bg-accent"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                      Website
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
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
        </aside>

        <main className="relative order-1 h-[62svh] min-h-[420px] touch-none bg-[oklch(0.94_0.025_145)] lg:order-2 lg:h-full lg:min-h-0">
          <div ref={mapContainerRef} className="absolute inset-0 touch-none" />

          {!mapLoaded && !mapError && (
            <div className="absolute left-3 top-16 z-10 rounded-md border border-border/70 bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-sm lg:top-3">
              Karte wird geladen...
            </div>
          )}

          {!MAPTILER_KEY && (
            <div className="absolute left-3 top-3 z-10 max-w-[min(24rem,calc(100vw-1.5rem))] rounded-md border border-amber-300/70 bg-amber-50/95 px-3 py-2 text-xs text-amber-950 shadow-sm dark:border-amber-500/40 dark:bg-amber-950/90 dark:text-amber-100">
              Demo-Karte aktiv. Fuer Produktion bitte `NEXT_PUBLIC_MAPTILER_KEY` setzen.
            </div>
          )}

          {mapError && (
            <div className="absolute inset-x-3 top-16 z-10 rounded-md border border-destructive/40 bg-background/95 px-3 py-2 text-sm text-destructive shadow-sm lg:top-3">
              {mapError}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
