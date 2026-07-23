"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CircleMarker, Map as LeafletMap, Marker as LeafletMarker, Polyline } from "leaflet";
import Image from "next/image";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  LocateFixed,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Route,
} from "lucide-react";
import {
  COURSE_DISCIPLINES,
  COURSE_DISCIPLINE_LABELS,
  COURSE_DISCIPLINE_NOTES,
  COURSE_POIS,
  COURSE_ROUTES,
  EVENT_LOCATION_CATEGORIES,
  EVENT_LOCATION_CATEGORY_LABELS,
  EVENT_LOCATION_POIS,
  type CourseDiscipline,
  type CoursePoi,
  type CourseRoute,
  type EventLocationCategory,
  type EventLocationPoi,
} from "@/lib/event-map/course-routes";
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

function toLeafletLatLngs(coordinates: [number, number][]) {
  return coordinates.map(toLeafletLatLng);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCourseClasses(classes: string[]) {
  const labels: Record<string, string> = {
    schueler: "Schueler",
    jugend: "Jugend",
    damen: "Damen",
    herren: "Herren",
  };

  return classes.map((className) => labels[className] ?? className).join(", ");
}

function buildCourseRoutePopupHtml(route: CourseRoute): string {
  return `
    <div class="event-map-course-popup-card text-sm text-foreground">
      <p class="text-base font-semibold leading-snug">${escapeHtml(route.name)}</p>
      <p class="text-sm leading-snug text-muted-foreground">${escapeHtml(COURSE_DISCIPLINE_LABELS[route.discipline])} · ${escapeHtml(formatCourseClasses(route.classes))}</p>
      <p class="text-xs leading-5 text-muted-foreground">${escapeHtml(route.sourceNote)}</p>
    </div>
  `;
}

function buildCoursePoiPopupHtml(poi: CoursePoi): string {
  const typeLabel = poi.type === "start" ? "Start" : "Ziel";
  const routeLink = poi.routeUrl
    ? `<a href="${escapeHtml(poi.routeUrl)}" target="_blank" rel="noreferrer" class="inline-flex h-8 items-center rounded-md border border-border/70 bg-background px-2.5 text-sm font-medium text-primary hover:bg-accent">Route</a>`
    : "";
  return `
    <div class="event-map-course-popup-card text-sm text-foreground">
      <p class="text-base font-semibold leading-snug">${escapeHtml(poi.name)}</p>
      <p class="text-sm leading-snug text-muted-foreground">${escapeHtml(COURSE_DISCIPLINE_LABELS[poi.discipline])} · ${typeLabel}</p>
      <p class="text-xs leading-5 text-muted-foreground">${escapeHtml(poi.note ?? "Draft-POI aus PDF-Georeferenzierung; Position vor produktiver Nutzung pruefen.")}</p>
      ${routeLink}
    </div>
  `;
}

function getEventLocationColor(category: EventLocationCategory) {
  const colors: Record<EventLocationCategory, string> = {
    competition: "#7c3aed",
    food: "#dc2626",
    sanitary: "#0891b2",
    office: "#2563eb",
    parking: "#16a34a",
  };

  return colors[category];
}

function buildEventLocationPopupHtml(poi: EventLocationPoi): string {
  const routeLink = poi.routeUrl
    ? `<a href="${escapeHtml(poi.routeUrl)}" target="_blank" rel="noreferrer" class="inline-flex h-8 items-center rounded-md border border-border/70 bg-background px-2.5 text-sm font-medium text-primary hover:bg-accent">Route</a>`
    : "";

  return `
    <div class="event-map-course-popup-card text-sm text-foreground">
      <p class="text-base font-semibold leading-snug">${escapeHtml(poi.name)}</p>
      <p class="text-sm leading-snug text-muted-foreground">${escapeHtml(EVENT_LOCATION_CATEGORY_LABELS[poi.category])}</p>
      ${poi.note ? `<p class="text-xs leading-5 text-muted-foreground">${escapeHtml(poi.note)}</p>` : ""}
      ${routeLink}
    </div>
  `;
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

function buildSponsorMarkerIcon(L: typeof import("leaflet"), sponsor: SponsorPoi, zoom: number) {
  const markerSize = getSponsorMarkerSize(zoom);

  return L.divIcon({
    className: "",
    html: buildSponsorLogoHtml(
      sponsor,
      "event-map-marker inline-flex items-center justify-center rounded-md border-2 border-white shadow-lg transition-transform hover:scale-110",
    ),
    iconSize: [markerSize.width, markerSize.height],
    iconAnchor: [markerSize.anchorX, markerSize.anchorY],
  });
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
  const courseRouteLayersRef = useRef<Map<string, Polyline>>(new Map());
  const coursePoiLayersRef = useRef<Map<string, CircleMarker>>(new Map());
  const eventLocationLayersRef = useRef<Map<string, CircleMarker>>(new Map());
  const userLocationMarkerRef = useRef<CircleMarker | null>(null);
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const popupOpenTimerRef = useRef<number | null>(null);
  const suppressPopupCloseRef = useRef(false);
  const [selectedSponsorId, setSelectedSponsorId] = useState("");
  const [visibleSponsorIds, setVisibleSponsorIds] = useState(() => new Set(SPONSOR_POIS.map((sponsor) => sponsor.id)));
  const [visibleCourseRouteIds, setVisibleCourseRouteIds] = useState(() => new Set(COURSE_ROUTES.map((route) => route.id)));
  const [visibleCoursePoiIds, setVisibleCoursePoiIds] = useState(() => new Set(COURSE_POIS.map((poi) => poi.id)));
  const [visibleEventLocationIds, setVisibleEventLocationIds] = useState(() => new Set(EVENT_LOCATION_POIS.map((poi) => poi.id)));
  const [sponsorsExpanded, setSponsorsExpanded] = useState(true);
  const [coursesExpanded, setCoursesExpanded] = useState(true);
  const [expandedCourseDisciplines, setExpandedCourseDisciplines] = useState<Set<CourseDiscipline>>(() => new Set(COURSE_DISCIPLINES));
  const [eventLocationsExpanded, setEventLocationsExpanded] = useState(true);
  const [expandedEventLocationCategories, setExpandedEventLocationCategories] = useState<Set<EventLocationCategory>>(
    () => new Set(EVENT_LOCATION_CATEGORIES),
  );
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [popupSponsorId, setPopupSponsorId] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(14);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const externalMapsAllowed = hasConsent("EXTERNAL_MAPS");
  const visibleSponsorCount = visibleSponsorIds.size;
  const sponsorsVisible = visibleSponsorCount > 0;
  const allSponsorsVisible = visibleSponsorCount === SPONSOR_POIS.length;
  const visibleCourseFeatureCount = visibleCourseRouteIds.size + visibleCoursePoiIds.size + visibleEventLocationIds.size;
  const allCourseFeaturesVisible =
    visibleCourseRouteIds.size === COURSE_ROUTES.length &&
    visibleCoursePoiIds.size === COURSE_POIS.length &&
    visibleEventLocationIds.size === EVENT_LOCATION_POIS.length;
  const someCourseFeaturesVisible = visibleCourseFeatureCount > 0;

  const setAllCourseFeaturesVisible = useCallback((visible: boolean) => {
    setVisibleCourseRouteIds(new Set(visible ? COURSE_ROUTES.map((route) => route.id) : []));
    setVisibleCoursePoiIds(new Set(visible ? COURSE_POIS.map((poi) => poi.id) : []));
    setVisibleEventLocationIds(new Set(visible ? EVENT_LOCATION_POIS.map((poi) => poi.id) : []));
  }, []);

  const clearSponsorState = useCallback((sponsorId?: string) => {
    if (popupOpenTimerRef.current) {
      window.clearTimeout(popupOpenTimerRef.current);
      popupOpenTimerRef.current = null;
    }

    setSelectedSponsorId((current) => (!sponsorId || current === sponsorId ? "" : current));
    setPopupSponsorId((current) => (!sponsorId || current === sponsorId ? null : current));
  }, []);

  const clearSponsorSelection = useCallback((sponsorId?: string) => {
    clearSponsorState(sponsorId);

    if (sponsorId) {
      markersRef.current.get(sponsorId)?.closePopup();
      return;
    }

    markersRef.current.forEach((marker) => marker.closePopup());
  }, [clearSponsorState]);

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

  const focusCourseRoute = useCallback((route: CourseRoute) => {
    const map = mapRef.current;
    const layer = courseRouteLayersRef.current.get(route.id);
    if (!map || !layer) return;

    mapViewportRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    map.invalidateSize();
    map.fitBounds(layer.getBounds().pad(0.18), { maxZoom: 15.5 });
    layer.openPopup();
  }, []);

  const focusCoursePoi = useCallback((poi: CoursePoi) => {
    const map = mapRef.current;
    const layer = coursePoiLayersRef.current.get(poi.id);
    if (!map || !layer) return;

    mapViewportRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    map.invalidateSize();
    map.flyTo(toLeafletLatLng(poi.coordinates), Math.max(map.getZoom(), 15.5), { duration: 0.45 });
    window.setTimeout(() => {
      coursePoiLayersRef.current.get(poi.id)?.openPopup();
    }, 520);
  }, []);

  const focusEventLocation = useCallback((poi: EventLocationPoi) => {
    const map = mapRef.current;
    const layer = eventLocationLayersRef.current.get(poi.id);
    if (!map || !layer) return;

    mapViewportRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    map.invalidateSize();
    map.flyTo(toLeafletLatLng(poi.coordinates), Math.max(map.getZoom(), 15.5), { duration: 0.45 });
    window.setTimeout(() => {
      eventLocationLayersRef.current.get(poi.id)?.openPopup();
    }, 520);
  }, []);

  const centerOnUserLocation = useCallback(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    if (!("geolocation" in navigator)) {
      setLocationError("Dieser Browser unterstuetzt keine Standortfreigabe.");
      return;
    }

    setLocatingUser(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latLng: [number, number] = [position.coords.latitude, position.coords.longitude];
        userLocationMarkerRef.current?.remove();
        const marker = L.circleMarker(latLng, {
          radius: 9,
          color: "#ffffff",
          weight: 3,
          fillColor: "#0284c7",
          fillOpacity: 0.95,
        }).addTo(map);
        marker.bindPopup(
          `<div class="event-map-course-popup-card text-sm text-foreground"><p class="text-base font-semibold leading-snug">Meine Position</p><p class="text-xs leading-5 text-muted-foreground">Vom Browser freigegebener Standort. Wird nicht gespeichert.</p></div>`,
          {
            className: "event-map-course-popup",
            closeButton: true,
            maxWidth: 280,
          },
        );
        userLocationMarkerRef.current = marker;
        map.invalidateSize();
        map.flyTo(latLng, Math.max(map.getZoom(), 16), { duration: 0.45 });
        window.setTimeout(() => marker.openPopup(), 520);
        setLocatingUser(false);
      },
      (error) => {
        setLocationError(error.code === error.PERMISSION_DENIED ? "Standortfreigabe wurde abgelehnt." : "Standort konnte nicht ermittelt werden.");
        setLocatingUser(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 12000,
      },
    );
  }, []);

  useEffect(() => {
    if (!externalMapsAllowed) return;
    if (!mapContainerRef.current || mapRef.current) return;

    let cancelled = false;
    let loadTimeout: number | null = null;
    const markers = markersRef.current;
    const courseRouteLayers = courseRouteLayersRef.current;
    const coursePoiLayers = coursePoiLayersRef.current;
    const eventLocationLayers = eventLocationLayersRef.current;
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
      courseRouteLayers.forEach((layer) => layer.remove());
      courseRouteLayers.clear();
      coursePoiLayers.forEach((layer) => layer.remove());
      coursePoiLayers.clear();
      eventLocationLayers.forEach((layer) => layer.remove());
      eventLocationLayers.clear();
      userLocationMarkerRef.current?.remove();
      userLocationMarkerRef.current = null;
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

    const visibleSponsors = SPONSOR_POIS.filter((sponsor) => visibleSponsorIds.has(sponsor.id));
    if (visibleSponsors.length > 0) {
      visibleSponsors.forEach((sponsor) => {
        const marker = L.marker(toLeafletLatLng(sponsor.coordinates), {
          icon: buildSponsorMarkerIcon(L, sponsor, map.getZoom()),
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
          clearSponsorState(sponsor.id);
        });
        markersRef.current.set(sponsor.id, marker);
      });
    }
    window.setTimeout(() => {
      suppressPopupCloseRef.current = false;
    }, 0);
  }, [clearSponsorState, mapReady, selectSponsor, visibleSponsorIds]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    courseRouteLayersRef.current.forEach((layer) => layer.remove());
    courseRouteLayersRef.current.clear();
    coursePoiLayersRef.current.forEach((layer) => layer.remove());
    coursePoiLayersRef.current.clear();
    eventLocationLayersRef.current.forEach((layer) => layer.remove());
    eventLocationLayersRef.current.clear();

    COURSE_ROUTES.filter((route) => visibleCourseRouteIds.has(route.id)).forEach((route) => {
      const layer = L.polyline(toLeafletLatLngs(route.coordinates), {
        color: route.color,
        weight: 5,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
      layer.bindPopup(buildCourseRoutePopupHtml(route), {
        className: "event-map-course-popup",
        closeButton: true,
        maxWidth: 300,
      });
      courseRouteLayersRef.current.set(route.id, layer);
    });

    COURSE_POIS.filter((poi) => visibleCoursePoiIds.has(poi.id)).forEach((poi) => {
      const color = poi.type === "start" ? "#16a34a" : "#f97316";
      const layer = L.circleMarker(toLeafletLatLng(poi.coordinates), {
        radius: 7,
        color: "#ffffff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95,
      }).addTo(map);
      layer.bindPopup(buildCoursePoiPopupHtml(poi), {
        className: "event-map-course-popup",
        closeButton: true,
        maxWidth: 300,
      });
      coursePoiLayersRef.current.set(poi.id, layer);
    });

    EVENT_LOCATION_POIS.filter((poi) => visibleEventLocationIds.has(poi.id)).forEach((poi) => {
      const color = getEventLocationColor(poi.category);
      const layer = L.circleMarker(toLeafletLatLng(poi.coordinates), {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95,
      }).addTo(map);
      layer.bindPopup(buildEventLocationPopupHtml(poi), {
        className: "event-map-course-popup",
        closeButton: true,
        maxWidth: 300,
      });
      eventLocationLayersRef.current.set(poi.id, layer);
    });
  }, [mapReady, visibleCoursePoiIds, visibleCourseRouteIds, visibleEventLocationIds]);

  useEffect(() => {
    const L = leafletRef.current;
    if (!L) return;

    markersRef.current.forEach((marker, sponsorId) => {
      const sponsor = SPONSOR_POIS.find((candidate) => candidate.id === sponsorId);
      if (!sponsor) return;
      marker.setIcon(buildSponsorMarkerIcon(L, sponsor, mapZoom));
    });
  }, [mapZoom]);

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

  useEffect(() => {
    if (!mapFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMapFullscreen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    window.setTimeout(() => mapRef.current?.invalidateSize(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      window.setTimeout(() => mapRef.current?.invalidateSize(), 0);
    };
  }, [mapFullscreen]);

  return (
    <div
      ref={shellRef}
      className={`${
        mapFullscreen
          ? "fixed inset-0 z-50 h-[100svh] min-h-[100svh] overflow-hidden"
          : "relative min-h-[calc(100svh-3rem)] overflow-x-hidden lg:h-[calc(100vh-3rem)] lg:overflow-hidden"
      } bg-background`}
    >
      <div
        className={`grid grid-cols-1 lg:min-h-0 ${
          mapFullscreen ? "h-full min-h-[100svh]" : "min-h-[calc(100svh-3rem)] lg:h-full lg:grid-cols-[minmax(300px,380px)_1fr]"
        }`}
      >
        <aside
          className={`z-10 order-2 min-h-0 flex-col border-t border-border/50 bg-background/95 lg:order-1 lg:max-h-none lg:border-r lg:border-t-0 ${
            mapFullscreen ? "hidden" : "flex"
          }`}
        >
          <div className="border-b border-border/50 px-4 py-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Bad Bayersoien
            </div>
            <h1 className="mt-1 text-2xl font-semibold">Event-Karte</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sponsoren, Wettkampf-Orte, Strecken und Versorgung als Layer.
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
                                      clearSponsorSelection(sponsor.id);
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
              <div className="rounded-md border border-border/60 bg-card">
                <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <button
                    type="button"
                    onClick={() => setCoursesExpanded((expanded) => !expanded)}
                    className="inline-flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={coursesExpanded}
                  >
                    {coursesExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <Route className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">Wettkampf Orte &amp; Strecken</span>
                  </button>
                  <input
                    type="checkbox"
                    ref={(node) => {
                      if (node) node.indeterminate = someCourseFeaturesVisible && !allCourseFeaturesVisible;
                    }}
                    checked={allCourseFeaturesVisible}
                    onChange={(event) => setAllCourseFeaturesVisible(event.target.checked)}
                    aria-label="Alle Wettkampf-Orte und Strecken ein- oder ausblenden"
                    className="h-4 w-4 accent-primary"
                  />
                </div>

                {coursesExpanded && (
                  <div className="border-t border-border/50 px-2 py-2">
                    <div className="space-y-2 border-l border-border/70 pl-2">
                      {COURSE_DISCIPLINES.map((discipline) => {
                        const disciplineRoutes = COURSE_ROUTES.filter((route) => route.discipline === discipline);
                        const disciplinePois = COURSE_POIS.filter((poi) => poi.discipline === discipline);
                        const visibleDisciplineRoutes = disciplineRoutes.filter((route) => visibleCourseRouteIds.has(route.id));
                        const visibleDisciplinePois = disciplinePois.filter((poi) => visibleCoursePoiIds.has(poi.id));
                        const allDisciplineVisible =
                          visibleDisciplineRoutes.length === disciplineRoutes.length &&
                          visibleDisciplinePois.length === disciplinePois.length;
                        const someDisciplineVisible = visibleDisciplineRoutes.length + visibleDisciplinePois.length > 0;
                        const disciplineExpanded = expandedCourseDisciplines.has(discipline);

                        return (
                          <div key={discipline} className="rounded-md">
                            <div className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${someDisciplineVisible ? "" : "opacity-55"}`}>
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedCourseDisciplines((current) => {
                                    const next = new Set(current);
                                    if (next.has(discipline)) next.delete(discipline);
                                    else next.add(discipline);
                                    return next;
                                  });
                                }}
                                className="inline-flex min-w-0 flex-1 items-center gap-2 text-left"
                                aria-expanded={disciplineExpanded}
                              >
                                {disciplineExpanded ? (
                                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                )}
                                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                  {COURSE_DISCIPLINE_LABELS[discipline]}
                                </span>
                              </button>
                              <input
                                type="checkbox"
                                ref={(node) => {
                                  if (node) node.indeterminate = someDisciplineVisible && !allDisciplineVisible;
                                }}
                                checked={allDisciplineVisible}
                                onChange={(event) => {
                                  const visible = event.target.checked;
                                  const routeIds = disciplineRoutes.map((route) => route.id);
                                  const poiIds = disciplinePois.map((poi) => poi.id);

                                  setVisibleCourseRouteIds((current) => {
                                    const next = new Set(current);
                                    routeIds.forEach((id) => {
                                      if (visible) next.add(id);
                                      else next.delete(id);
                                    });
                                    return next;
                                  });
                                  setVisibleCoursePoiIds((current) => {
                                    const next = new Set(current);
                                    poiIds.forEach((id) => {
                                      if (visible) next.add(id);
                                      else next.delete(id);
                                    });
                                    return next;
                                  });
                                }}
                                aria-label={`${COURSE_DISCIPLINE_LABELS[discipline]} ein- oder ausblenden`}
                                className="h-4 w-4 shrink-0 accent-primary"
                              />
                            </div>

                            {disciplineExpanded && (
                              <div className="ml-4 mt-1 space-y-1 border-l border-border/60 pl-2">
                                {COURSE_DISCIPLINE_NOTES[discipline] && (
                                  <p className="rounded-md bg-muted/40 px-2 py-1.5 text-[11px] leading-4 text-muted-foreground">
                                    {COURSE_DISCIPLINE_NOTES[discipline]}
                                  </p>
                                )}

                                {disciplineRoutes.map((route) => {
                                  const routeVisible = visibleCourseRouteIds.has(route.id);
                                  return (
                                    <div
                                      key={route.id}
                                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
                                        routeVisible ? "hover:bg-accent/60" : "opacity-55"
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (routeVisible) focusCourseRoute(route);
                                        }}
                                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                      >
                                        <span
                                          className="h-1.5 w-7 shrink-0 rounded-full"
                                          style={{ backgroundColor: route.color }}
                                        />
                                        <span className="min-w-0 flex-1 truncate text-sm">{route.name}</span>
                                      </button>
                                      <input
                                        type="checkbox"
                                        checked={routeVisible}
                                        onChange={(event) => {
                                          setVisibleCourseRouteIds((current) => {
                                            const next = new Set(current);
                                            if (event.target.checked) next.add(route.id);
                                            else next.delete(route.id);
                                            return next;
                                          });
                                        }}
                                        aria-label={`${route.name} ein- oder ausblenden`}
                                        className="h-4 w-4 shrink-0 accent-primary"
                                      />
                                    </div>
                                  );
                                })}

                                {disciplinePois.map((poi) => {
                                  const poiVisible = visibleCoursePoiIds.has(poi.id);
                                  return (
                                    <div
                                      key={poi.id}
                                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
                                        poiVisible ? "hover:bg-accent/60" : "opacity-55"
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (poiVisible) focusCoursePoi(poi);
                                        }}
                                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                      >
                                        <MapPin
                                          className={`h-4 w-4 shrink-0 ${
                                            poi.type === "start" ? "text-emerald-600" : "text-orange-500"
                                          }`}
                                        />
                                        <span className="min-w-0 flex-1 truncate text-sm">{poi.name}</span>
                                      </button>
                                      <input
                                        type="checkbox"
                                        checked={poiVisible}
                                        onChange={(event) => {
                                          setVisibleCoursePoiIds((current) => {
                                            const next = new Set(current);
                                            if (event.target.checked) next.add(poi.id);
                                            else next.delete(poi.id);
                                            return next;
                                          });
                                        }}
                                        aria-label={`${poi.name} ein- oder ausblenden`}
                                        className="h-4 w-4 shrink-0 accent-primary"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div className="rounded-md">
                        <div className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${visibleEventLocationIds.size > 0 ? "" : "opacity-55"}`}>
                          <button
                            type="button"
                            onClick={() => setEventLocationsExpanded((expanded) => !expanded)}
                            className="inline-flex min-w-0 flex-1 items-center gap-2 text-left"
                            aria-expanded={eventLocationsExpanded}
                          >
                            {eventLocationsExpanded ? (
                              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">Orte &amp; Infrastruktur</span>
                          </button>
                          <input
                            type="checkbox"
                            ref={(node) => {
                              if (node) {
                                node.indeterminate =
                                  visibleEventLocationIds.size > 0 && visibleEventLocationIds.size < EVENT_LOCATION_POIS.length;
                              }
                            }}
                            checked={visibleEventLocationIds.size === EVENT_LOCATION_POIS.length}
                            onChange={(event) => {
                              setVisibleEventLocationIds(
                                new Set(event.target.checked ? EVENT_LOCATION_POIS.map((poi) => poi.id) : []),
                              );
                            }}
                            aria-label="Alle Orte und Infrastruktur ein- oder ausblenden"
                            className="h-4 w-4 shrink-0 accent-primary"
                          />
                        </div>

                        {eventLocationsExpanded && (
                          <div className="ml-4 mt-1 space-y-2 border-l border-border/60 pl-2">
                            {EVENT_LOCATION_CATEGORIES.map((category) => {
                              const categoryPois = EVENT_LOCATION_POIS.filter((poi) => poi.category === category);
                              const visibleCategoryPois = categoryPois.filter((poi) => visibleEventLocationIds.has(poi.id));
                              const allCategoryVisible = visibleCategoryPois.length === categoryPois.length;
                              const someCategoryVisible = visibleCategoryPois.length > 0;
                              const categoryExpanded = expandedEventLocationCategories.has(category);

                              return (
                                <div key={category} className="rounded-md">
                                  <div className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${someCategoryVisible ? "" : "opacity-55"}`}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExpandedEventLocationCategories((current) => {
                                          const next = new Set(current);
                                          if (next.has(category)) next.delete(category);
                                          else next.add(category);
                                          return next;
                                        });
                                      }}
                                      className="inline-flex min-w-0 flex-1 items-center gap-2 text-left"
                                      aria-expanded={categoryExpanded}
                                    >
                                      {categoryExpanded ? (
                                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                      )}
                                      <span
                                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                                        style={{ backgroundColor: getEventLocationColor(category) }}
                                      />
                                      <span className="min-w-0 flex-1 truncate text-sm">{EVENT_LOCATION_CATEGORY_LABELS[category]}</span>
                                    </button>
                                    <input
                                      type="checkbox"
                                      ref={(node) => {
                                        if (node) node.indeterminate = someCategoryVisible && !allCategoryVisible;
                                      }}
                                      checked={allCategoryVisible}
                                      onChange={(event) => {
                                        const visible = event.target.checked;
                                        const ids = categoryPois.map((poi) => poi.id);
                                        setVisibleEventLocationIds((current) => {
                                          const next = new Set(current);
                                          ids.forEach((id) => {
                                            if (visible) next.add(id);
                                            else next.delete(id);
                                          });
                                          return next;
                                        });
                                      }}
                                      aria-label={`${EVENT_LOCATION_CATEGORY_LABELS[category]} ein- oder ausblenden`}
                                      className="h-4 w-4 shrink-0 accent-primary"
                                    />
                                  </div>

                                  {categoryExpanded && (
                                    <div className="ml-4 mt-1 space-y-1 border-l border-border/60 pl-2">
                                      {categoryPois.map((poi) => {
                                        const poiVisible = visibleEventLocationIds.has(poi.id);
                                        return (
                                          <div
                                            key={poi.id}
                                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
                                              poiVisible ? "hover:bg-accent/60" : "opacity-55"
                                            }`}
                                          >
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (poiVisible) focusEventLocation(poi);
                                              }}
                                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                            >
                                              <MapPin
                                                className="h-4 w-4 shrink-0"
                                                style={{ color: getEventLocationColor(poi.category) }}
                                              />
                                              <span className="min-w-0 flex-1 truncate text-sm">{poi.name}</span>
                                            </button>
                                            <input
                                              type="checkbox"
                                              checked={poiVisible}
                                              onChange={(event) => {
                                                setVisibleEventLocationIds((current) => {
                                                  const next = new Set(current);
                                                  if (event.target.checked) next.add(poi.id);
                                                  else next.delete(poi.id);
                                                  return next;
                                                });
                                              }}
                                              aria-label={`${poi.name} ein- oder ausblenden`}
                                              className="h-4 w-4 shrink-0 accent-primary"
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 px-2 text-[11px] leading-4 text-muted-foreground">
                      Strecken teils als Draft aus PDF-Georeferenzierung. Orte aus den gelieferten Google-Maps-Links.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        <main
          ref={mapViewportRef}
          className={`relative order-1 touch-none bg-[oklch(0.94_0.025_145)] lg:order-2 lg:h-full lg:min-h-0 ${
            mapFullscreen ? "h-full min-h-[100svh]" : "h-[calc(100svh-4rem)] min-h-[520px]"
          }`}
        >
          <div ref={mapContainerRef} className="absolute inset-0 touch-none" />

          <div className="absolute bottom-24 right-3 z-[1000] flex touch-auto flex-col items-center gap-2">
            {externalMapsAllowed && (
              <button
                type="button"
                onClick={centerOnUserLocation}
                disabled={!mapReady || locatingUser}
                title="Auf meine Position zentrieren"
                aria-label="Auf meine Position zentrieren"
                className="inline-flex size-10 items-center justify-center rounded-md border border-border/70 bg-background/95 text-foreground shadow-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LocateFixed className={`h-4 w-4 ${locatingUser ? "animate-pulse" : ""}`} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setMapFullscreen((fullscreen) => !fullscreen)}
              title={mapFullscreen ? "Vollbild verlassen" : "Karte im Vollbild anzeigen"}
              aria-label={mapFullscreen ? "Vollbild verlassen" : "Karte im Vollbild anzeigen"}
              className="inline-flex size-10 items-center justify-center rounded-md border border-border/70 bg-background/95 text-foreground shadow-sm hover:bg-accent"
            >
              {mapFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>

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

          {externalMapsAllowed && locationError && (
            <div className="absolute bottom-44 right-3 z-[1000] max-w-[min(22rem,calc(100vw-1.5rem))] rounded-md border border-amber-300/70 bg-amber-50/95 px-3 py-2 text-xs text-amber-950 shadow-sm dark:border-amber-500/40 dark:bg-amber-950/90 dark:text-amber-100">
              {locationError}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
