"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import Image from "next/image";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Layers,
  MapPin,
  Route,
} from "lucide-react";
import { BAD_BAYERSOIEN_CENTER, SPONSOR_POIS, type SponsorPoi } from "@/lib/event-map/sponsor-pois";
import { usePrivacyConsent } from "@/lib/privacy-consent-context";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const MAPTILER_RASTER_TILE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/outdoor-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
  : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAP_ATTRIBUTION = MAPTILER_KEY ? "MapTiler | OpenStreetMap contributors" : "OpenStreetMap contributors";

function toLeafletLatLng(coordinates: [number, number]): [number, number] {
  return [coordinates[1], coordinates[0]];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildSponsorLogoHtml(sponsor: SponsorPoi, className: string): string {
  if (!sponsor.logoSrc) {
    return `<span class="${className} bg-primary text-xs font-semibold text-primary-foreground">${escapeHtml(sponsor.logoText)}</span>`;
  }

  return `
    <span class="${className} overflow-hidden bg-white p-0.5">
      <img src="${escapeHtml(sponsor.logoSrc)}" alt="${escapeHtml(sponsor.name)}" class="h-full w-full object-contain" loading="lazy" />
    </span>
  `;
}

function buildSponsorPopupHtml(sponsor: SponsorPoi): string {
  const websiteLink = sponsor.websiteUrl
    ? `<a href="${escapeHtml(sponsor.websiteUrl)}" target="_blank" rel="noreferrer" class="inline-flex h-8 items-center rounded-md border border-border/70 bg-background px-2.5 text-sm font-medium text-primary hover:bg-accent">Website</a>`
    : "";

  return `
    <div class="event-map-popup-card text-sm text-foreground">
      ${buildSponsorLogoHtml(sponsor, "event-map-popup-logo inline-flex items-center justify-center rounded-md border border-border/60")}
      <div class="event-map-popup-details">
        <p class="text-base font-semibold leading-snug">${escapeHtml(sponsor.name)} - ${escapeHtml(sponsor.category)}</p>
        <p class="text-sm leading-snug text-muted-foreground">${escapeHtml(sponsor.address)}</p>
        <div class="flex flex-wrap gap-2">
          <a href="${escapeHtml(sponsor.routeUrl)}" target="_blank" rel="noreferrer" class="inline-flex h-8 items-center rounded-md border border-border/70 bg-background px-2.5 text-sm font-medium text-primary hover:bg-accent">Route</a>
          ${websiteLink}
        </div>
      </div>
    </div>
  `;
}

function getSponsorMarkerSize(zoom: number) {
  const scale = zoom <= 15 ? 1 : Math.min(2.15, 1 + (zoom - 15) * 0.28);
  const width = Math.round(44 * scale);
  const height = Math.round(36 * scale);
  return {
    width,
    height,
    anchorX: Math.round(width / 2),
    anchorY: Math.round(height / 2),
  };
}

function SponsorBadge({ sponsor }: { sponsor: SponsorPoi }) {
  if (sponsor.logoSrc) {
    return (
      <span className="inline-flex h-8 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-white p-0.5 shadow-sm">
        <Image src={sponsor.logoSrc} alt={sponsor.name} width={40} height={32} className="h-full w-full object-contain" />
      </span>
    );
  }

  return (
    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground shadow-sm">
      {sponsor.logoText}
    </span>
  );
}

export default function EventMap() {
  const { categories, hasConsent, saveConsent } = usePrivacyConsent();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapViewportRef = useRef<HTMLElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const popupOpenTimerRef = useRef<number | null>(null);
  const suppressPopupCloseRef = useRef(false);
  const [selectedSponsorId, setSelectedSponsorId] = useState("");
  const [visibleSponsorIds, setVisibleSponsorIds] = useState(() => new Set(SPONSOR_POIS.map((sponsor) => sponsor.id)));
  const [sponsorsExpanded, setSponsorsExpanded] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [popupSponsorId, setPopupSponsorId] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(14);
  const externalMapsAllowed = hasConsent("EXTERNAL_MAPS");
  const visibleSponsorCount = visibleSponsorIds.size;
  const sponsorsVisible = visibleSponsorCount > 0;
  const allSponsorsVisible = visibleSponsorCount === SPONSOR_POIS.length;

  const clearSponsorSelection = useCallback((sponsorId?: string) => {
    if (popupOpenTimerRef.current) {
      window.clearTimeout(popupOpenTimerRef.current);
      popupOpenTimerRef.current = null;
    }

    setSelectedSponsorId((current) => (!sponsorId || current === sponsorId ? "" : current));
    setPopupSponsorId((current) => (!sponsorId || current === sponsorId ? null : current));

    if (sponsorId) {
      markersRef.current.get(sponsorId)?.closePopup();
      return;
    }

    markersRef.current.forEach((marker) => marker.closePopup());
  }, []);

  const selectSponsor = useCallback((sponsor: SponsorPoi, options: { scrollMapIntoView?: boolean } = {}) => {
    setSelectedSponsorId(sponsor.id);
    setPopupSponsorId(null);

    if (popupOpenTimerRef.current) {
      window.clearTimeout(popupOpenTimerRef.current);
    }

    const map = mapRef.current;
    if (!map) {
      setPopupSponsorId(sponsor.id);
      return;
    }

    if (options.scrollMapIntoView) {
      mapViewportRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }

    const targetZoom = Math.max(map.getZoom(), 15);
    const markerLatLng = toLeafletLatLng(sponsor.coordinates);
    const popupFocusLatLng = map.unproject(map.project(markerLatLng, targetZoom).subtract([0, 110]), targetZoom);
    map.invalidateSize();
    map.flyTo(popupFocusLatLng, targetZoom, { duration: 0.45 });
    popupOpenTimerRef.current = window.setTimeout(() => {
      setPopupSponsorId(sponsor.id);
      popupOpenTimerRef.current = null;
    }, 520);
  }, []);

  useEffect(() => {
    if (!externalMapsAllowed) return;
    if (!mapContainerRef.current || mapRef.current) return;

    let cancelled = false;
    let loadTimeout: number | null = null;
    const markers = markersRef.current;
    setMapLoaded(false);

    const initializeMap = async () => {
      try {
        const L = await import("leaflet");

        if (cancelled || !mapContainerRef.current) return;

        leafletRef.current = L;
        const map = L.map(mapContainerRef.current, {
          center: toLeafletLatLng(BAD_BAYERSOIEN_CENTER),
          zoom: 14,
          zoomSnap: 0.5,
          zoomDelta: 0.5,
          zoomControl: false,
          attributionControl: false,
          dragging: true,
          touchZoom: true,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          boxZoom: false,
          keyboard: true,
          wheelPxPerZoomLevel: 120,
        });

        mapRef.current = map;
        setMapReady(true);
        setMapZoom(map.getZoom());
        map.on("zoomend", () => setMapZoom(map.getZoom()));
        setMapError(null);
        L.control.zoom({ position: "bottomright" }).addTo(map);
        L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);

        const tileLayer = L.tileLayer(MAPTILER_RASTER_TILE_URL, {
          attribution: MAP_ATTRIBUTION,
          tileSize: 256,
          maxZoom: 22,
          crossOrigin: true,
        }).addTo(map);

        loadTimeout = window.setTimeout(() => {
          if (!cancelled) {
            setMapError("Leaflet hat auf diesem Geraet keine Kartenkacheln geladen. Bitte Content-Blocker oder Netz pruefen.");
          }
        }, 8000);

        tileLayer.on("load", () => {
          if (loadTimeout) {
            window.clearTimeout(loadTimeout);
            loadTimeout = null;
          }
          setMapLoaded(true);
          window.requestAnimationFrame(() => map.invalidateSize());
        });

        tileLayer.on("tileerror", () => {
          setMapError("Eine Kartenkachel konnte nicht geladen werden. Bitte MapTiler-Referer oder Netzwerk pruefen.");
        });

        window.requestAnimationFrame(() => {
          map.invalidateSize();
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
      suppressPopupCloseRef.current = true;
      markers.forEach((marker) => marker.remove());
      markers.clear();
      suppressPopupCloseRef.current = false;
      if (popupOpenTimerRef.current) window.clearTimeout(popupOpenTimerRef.current);
      if (loadTimeout) window.clearTimeout(loadTimeout);
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      setMapReady(false);
    };
  }, [externalMapsAllowed]);

  const enableExternalMaps = useCallback(() => {
    void saveConsent({ ...categories, EXTERNAL_MAPS: true }, "PROFILE");
  }, [categories, saveConsent]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    suppressPopupCloseRef.current = true;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    suppressPopupCloseRef.current = false;

    const visibleSponsors = SPONSOR_POIS.filter((sponsor) => visibleSponsorIds.has(sponsor.id));
    if (visibleSponsors.length > 0) {
      visibleSponsors.forEach((sponsor) => {
        const markerSize = getSponsorMarkerSize(mapZoom);
        const marker = L.marker(toLeafletLatLng(sponsor.coordinates), {
          icon: L.divIcon({
            className: "",
            html: buildSponsorLogoHtml(
              sponsor,
              "event-map-marker inline-flex items-center justify-center rounded-md border-2 border-white shadow-lg transition-transform hover:scale-110",
            ),
            iconSize: [markerSize.width, markerSize.height],
            iconAnchor: [markerSize.anchorX, markerSize.anchorY],
          }),
          title: sponsor.name,
        }).addTo(map);
        marker.bindPopup(buildSponsorPopupHtml(sponsor), {
          className: "event-map-popup",
          closeButton: true,
          maxWidth: 312,
          autoPan: true,
          keepInView: true,
          autoPanPaddingTopLeft: [18, 18],
          autoPanPaddingBottomRight: [18, 72],
        });
        marker.on("click", () => {
          selectSponsor(sponsor);
        });
        marker.on("popupclose", () => {
          if (suppressPopupCloseRef.current) return;
          clearSponsorSelection(sponsor.id);
        });
        markersRef.current.set(sponsor.id, marker);
      });
    }
  }, [clearSponsorSelection, mapReady, mapZoom, selectSponsor, visibleSponsorIds]);

  useEffect(() => {
    markersRef.current.forEach((marker, sponsorId) => {
      const element = marker.getElement();
      if (!element) return;
      element.classList.toggle("ring-4", sponsorId === selectedSponsorId);
      element.classList.toggle("ring-amber-300", sponsorId === selectedSponsorId);
      element.classList.toggle("scale-110", sponsorId === selectedSponsorId);

      if (sponsorId === popupSponsorId && visibleSponsorIds.has(sponsorId)) {
        marker.openPopup();
      }
    });
  }, [mapLoaded, mapZoom, popupSponsorId, selectedSponsorId, visibleSponsorIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const resizeMap = () => map.invalidateSize();
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
        <aside className="z-10 order-2 flex min-h-0 flex-col border-t border-border/50 bg-background/95 lg:order-1 lg:max-h-none lg:border-r lg:border-t-0">
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

          <div className="min-h-0 flex-1 overflow-y-auto border-b border-border/50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Layers className="h-4 w-4" />
              Layer
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <div className="rounded-md border border-border/60 bg-card">
                <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <button
                    type="button"
                    onClick={() => setSponsorsExpanded((expanded) => !expanded)}
                    className="inline-flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={sponsorsExpanded}
                  >
                    {sponsorsExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <Building2 className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">Vielen Dank an unsere Sponsoren 🫶</span>
                  </button>
                  <input
                    type="checkbox"
                    ref={(node) => {
                      if (node) node.indeterminate = sponsorsVisible && !allSponsorsVisible;
                    }}
                    checked={allSponsorsVisible}
                    onChange={(event) => {
                      const nextVisibleIds = event.target.checked
                        ? SPONSOR_POIS.map((sponsor) => sponsor.id)
                        : [];
                      setVisibleSponsorIds(new Set(nextVisibleIds));
                    }}
                    aria-label="Alle Sponsoren ein- oder ausblenden"
                    className="h-4 w-4 accent-primary"
                  />
                </div>

                {sponsorsExpanded && (
                  <div className="border-t border-border/50 px-2 py-2">
                    <div className="space-y-1 border-l border-border/70 pl-2">
                      {SPONSOR_POIS.map((sponsor) => {
                        const selected = sponsor.id === selectedSponsorId;
                        const sponsorVisible = visibleSponsorIds.has(sponsor.id);
                        return (
                          <div key={sponsor.id} className="rounded-md">
                            <div
                              className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
                                selected
                                  ? "bg-primary/10 text-foreground ring-1 ring-primary/25"
                                  : "hover:bg-accent/60"
                              } ${sponsorVisible ? "" : "opacity-55"}`}
                            >
                              <button
                                ref={(node) => {
                                  if (node) cardRefs.current.set(sponsor.id, node);
                                  else cardRefs.current.delete(sponsor.id);
                                }}
                                type="button"
                                onClick={() => {
                                  if (!sponsorVisible) return;
                                  if (selected) {
                                    clearSponsorSelection(sponsor.id);
                                    return;
                                  }
                                  selectSponsor(sponsor, { scrollMapIntoView: true });
                                }}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                aria-pressed={selected}
                              >
                                <SponsorBadge sponsor={sponsor} />
                                <span className="min-w-0 flex-1 truncate text-sm leading-tight">
                                  <span className="font-semibold">{sponsor.name}</span>
                                  <span className="text-muted-foreground"> · {sponsor.category}</span>
                                </span>
                              </button>
                              <input
                                type="checkbox"
                                checked={sponsorVisible}
                                onChange={(event) => {
                                  setVisibleSponsorIds((current) => {
                                    const next = new Set(current);
                                    if (event.target.checked) {
                                      next.add(sponsor.id);
                                    } else {
                                      next.delete(sponsor.id);
                                      if (popupSponsorId === sponsor.id) setPopupSponsorId(null);
                                    }
                                    return next;
                                  });
                                }}
                                aria-label={`${sponsor.name} ein- oder ausblenden`}
                                className="h-4 w-4 shrink-0 accent-primary"
                              />
                            </div>
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

        <main ref={mapViewportRef} className="relative order-1 h-[62svh] min-h-[420px] touch-none bg-[oklch(0.94_0.025_145)] lg:order-2 lg:h-full lg:min-h-0">
          <div ref={mapContainerRef} className="absolute inset-0 touch-none" />

          {!externalMapsAllowed && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[oklch(0.94_0.025_145)] p-4">
              <div className="max-w-sm rounded-md border border-border/70 bg-background/95 p-4 text-center shadow-sm">
                <MapPin className="mx-auto mb-2 size-8 text-primary" />
                <p className="text-sm font-semibold">Externe Karte laden?</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Die Sponsor-Karte nutzt externe Kartenkacheln von MapTiler/OpenStreetMap.
                  Ohne Einwilligung bleibt die Kartenflaeche deaktiviert; die Sponsorenliste
                  links funktioniert weiter.
                </p>
                <button
                  type="button"
                  onClick={enableExternalMaps}
                  className="mt-3 inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Karte laden
                </button>
              </div>
            </div>
          )}

          {externalMapsAllowed && !mapLoaded && !mapError && (
            <div className="absolute left-3 top-16 z-10 rounded-md border border-border/70 bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-sm lg:top-3">
              Karte wird geladen...
            </div>
          )}

          {externalMapsAllowed && !MAPTILER_KEY && (
            <div className="absolute left-3 top-3 z-10 max-w-[min(24rem,calc(100vw-1.5rem))] rounded-md border border-amber-300/70 bg-amber-50/95 px-3 py-2 text-xs text-amber-950 shadow-sm dark:border-amber-500/40 dark:bg-amber-950/90 dark:text-amber-100">
              Demo-Karte aktiv. Fuer Produktion bitte `NEXT_PUBLIC_MAPTILER_KEY` setzen.
            </div>
          )}

          {externalMapsAllowed && mapError && (
            <div className="absolute inset-x-3 top-16 z-10 rounded-md border border-destructive/40 bg-background/95 px-3 py-2 text-sm text-destructive shadow-sm lg:top-3">
              {mapError}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
