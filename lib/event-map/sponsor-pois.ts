export type EventMapLayer = "sponsors" | "infrastructure" | "routes";

export type SponsorConfidence = "verified" | "needs_review";

export type SponsorPoi = {
  id: string;
  layer: "sponsors";
  name: string;
  shortName: string;
  category: string;
  address: string;
  coordinates: [number, number];
  websiteUrl?: string;
  routeUrl: string;
  logoText: string;
  sourceNote: string;
  confidence: SponsorConfidence;
};

export const BAD_BAYERSOIEN_CENTER: [number, number] = [10.9987, 47.6907];

function mapsRouteUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export const SPONSOR_POIS: SponsorPoi[] = [
  {
    id: "radlstall",
    layer: "sponsors",
    name: "Radlstall",
    shortName: "Radlstall",
    category: "Radsport & Werkstatt",
    address: "Gschwendt 19, 82435 Bad Bayersoien",
    coordinates: [10.978315, 47.7003845],
    websiteUrl: "https://radlstall.com/",
    routeUrl: mapsRouteUrl("Radlstall, Gschwendt 19, 82435 Bad Bayersoien"),
    logoText: "RS",
    sourceNote: "Flyer-Logo `LOGO2Radstadl2022tif.png`, Adresse oeffentlich recherchiert.",
    confidence: "verified",
  },
  {
    id: "metzgerei-joerg",
    layer: "sponsors",
    name: "Metzgerei Joerg",
    shortName: "Joerg",
    category: "Metzgerei",
    address: "Dorfstr. 24, 82435 Bad Bayersoien",
    coordinates: [11.0004522, 47.6884496],
    websiteUrl: "https://metzgerei-joerg.de/",
    routeUrl: mapsRouteUrl("Metzgerei Joerg, Dorfstr. 24, 82435 Bad Bayersoien"),
    logoText: "MJ",
    sourceNote: "PDF-Text und Flyer-Logo; Adresse aus oeffentlichen Branchenangaben, bitte gegenpruefen.",
    confidence: "needs_review",
  },
  {
    id: "parkhotel-kletterpark",
    layer: "sponsors",
    name: "Parkhotel am Soier See / Kletterpark",
    shortName: "Kletterpark",
    category: "Freizeit & Hotel",
    address: "Am Kurpark 1, 82435 Bad Bayersoien",
    coordinates: [11.0033065, 47.6948899],
    websiteUrl: "https://www.parkhotel-bayersoien.de/",
    routeUrl: mapsRouteUrl("Am Kurpark 1, 82435 Bad Bayersoien"),
    logoText: "KP",
    sourceNote: "Flyer-Logo `Kletterwald.png`, Adresse oeffentlich recherchiert.",
    confidence: "verified",
  },
  {
    id: "schuster-bestl",
    layer: "sponsors",
    name: "Haus Schuster-Bestl",
    shortName: "Schuster",
    category: "Ferienwohnungen",
    address: "Dorfstr. 62, 82435 Bad Bayersoien",
    coordinates: [10.9973468, 47.689768],
    websiteUrl: "https://schuster-bestl.de/",
    routeUrl: mapsRouteUrl("Haus Schuster-Bestl, Dorfstr. 62, 82435 Bad Bayersoien"),
    logoText: "SB",
    sourceNote: "Flyer-Logo `Schuster.png`, Adresse aus Impressum.",
    confidence: "verified",
  },
  {
    id: "brandmeier",
    layer: "sponsors",
    name: "Brandmeier",
    shortName: "Brandmeier",
    category: "Regionaler Sponsor",
    address: "Dorfstr. 40, 82435 Bad Bayersoien",
    coordinates: [10.9943493, 47.6910423],
    routeUrl: mapsRouteUrl("Dorfstr. 40, 82435 Bad Bayersoien"),
    logoText: "BM",
    sourceNote: "Flyer-Logo `brandmeier.png`; Zuordnung/Adresse bitte pruefen.",
    confidence: "needs_review",
  },
  {
    id: "ammer-loisach-energie",
    layer: "sponsors",
    name: "Ammer-Loisach Energie",
    shortName: "ALE",
    category: "Regionale Energie",
    address: "Alte Ettaler Str. 25, 82496 Oberau",
    coordinates: [11.122674, 47.5582723],
    websiteUrl: "https://www.ammer-loisach-energie.de/",
    routeUrl: mapsRouteUrl("Ammer-Loisach Energie, Alte Ettaler Str. 25, 82496 Oberau"),
    logoText: "AL",
    sourceNote: "Flyer-Logo `Ammer_Loisach.png`; Sitz/Adresse oeffentlich recherchiert.",
    confidence: "needs_review",
  },
  {
    id: "erhard-bau",
    layer: "sponsors",
    name: "Bauunternehmen Josef Erhard",
    shortName: "Erhard Bau",
    category: "Bauunternehmen",
    address: "Raiffeisenstr. 9, 82401 Rottenbuch",
    coordinates: [10.9614851, 47.7333705],
    routeUrl: mapsRouteUrl("Bauunternehmen Josef Erhard, Raiffeisenstr. 9, 82401 Rottenbuch"),
    logoText: "EB",
    sourceNote: "PDF-Text und Flyer-Logo; Adresse oeffentlich recherchiert.",
    confidence: "needs_review",
  },
  {
    id: "huber-cars",
    layer: "sponsors",
    name: "Huber Cars",
    shortName: "Huber Cars",
    category: "Camper & Fahrzeuge",
    address: "Dorfstr. 1, 82398 Oderding",
    coordinates: [11.1078503, 47.8164298],
    routeUrl: mapsRouteUrl("Huber Cars, Dorfstr. 1, 82398 Oderding"),
    logoText: "HC",
    sourceNote: "Flyer-Logo `HuberCarsAnzeigeKBFJ24.png`, Adresse oeffentlich recherchiert.",
    confidence: "verified",
  },
];

export function sponsorsToGeoJson(sponsors: SponsorPoi[]) {
  return {
    type: "FeatureCollection" as const,
    features: sponsors.map((sponsor) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: sponsor.coordinates,
      },
      properties: {
        id: sponsor.id,
        name: sponsor.name,
        category: sponsor.category,
        confidence: sponsor.confidence,
      },
    })),
  };
}
