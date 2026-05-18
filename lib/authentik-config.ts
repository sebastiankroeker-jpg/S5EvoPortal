const DEFAULT_AUTHENTIK_ISSUER = "https://auth.s5evo.de/application/o/s5-evo-portal";

function unquoteEnv(rawValue?: string) {
  if (!rawValue) {
    return rawValue;
  }

  let value = rawValue.trim();
  while (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }

  return value;
}

export function resolveAuthentikIssuer(rawIssuer?: string) {
  const issuer = (unquoteEnv(rawIssuer) || DEFAULT_AUTHENTIK_ISSUER).replace(/\/$/, "");

  // Older setup docs accidentally used the provider slug without hyphens.
  return issuer.replace("/application/o/s5evo-portal", "/application/o/s5-evo-portal");
}

export function resolveAuthentikEndSessionEndpoint(rawIssuer?: string) {
  return `${resolveAuthentikIssuer(rawIssuer)}/end-session/`;
}

export function readAuthentikClientId() {
  return unquoteEnv(process.env.AUTHENTIK_CLIENT_ID);
}

export function readAuthentikClientSecret() {
  return unquoteEnv(process.env.AUTHENTIK_CLIENT_SECRET);
}
