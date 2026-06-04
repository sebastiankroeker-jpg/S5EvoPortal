"use client";

import { Eye, EyeOff } from "lucide-react";

type ParticipantPublicationPreference = "NAME_VERBERGEN" | "NAME_VEROEFFENTLICHEN" | string | null | undefined;

export default function ParticipantPublicationPreferenceIcon({
  preference,
  teamPublicationLevel,
  className = "",
}: {
  preference?: ParticipantPublicationPreference;
  teamPublicationLevel?: string | null;
  className?: string;
}) {
  const publishesName = preference === "NAME_VEROEFFENTLICHEN";
  const Icon = publishesName ? Eye : EyeOff;
  const teamLimitsPublication = publishesName && teamPublicationLevel !== "ALLES_OEFFENTLICH";
  const tooltip = publishesName
    ? teamLimitsPublication
      ? "Datenschutzpraeferenz: Name darf veroeffentlicht werden, die Team-Sichtbarkeit begrenzt aber die oeffentliche Anzeige."
      : "Datenschutzpraeferenz: Name darf oeffentlich angezeigt werden."
    : "Datenschutzpraeferenz: Name nicht oeffentlich anzeigen. Berechtigte Rollen sehen den Namen intern.";

  return (
    <span
      className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full ${
        publishesName ? "text-green-700" : "text-amber-700"
      } ${className}`}
      title={tooltip}
      aria-label={tooltip}
      onClick={(event) => event.stopPropagation()}
    >
      <Icon className="size-3" aria-hidden="true" />
    </span>
  );
}
