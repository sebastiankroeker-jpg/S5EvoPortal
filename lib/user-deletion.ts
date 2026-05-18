function sanitizeEmailLocalPart(localPart: string) {
  return localPart.replace(/[^a-zA-Z0-9._+-]/g, "_").slice(0, 48) || "user";
}

export function buildDeletedUserIdentity(email: string, userId: string, deletedAt: Date) {
  const [localPart, domainPart = "deleted.local"] = email.split("@");
  const safeLocalPart = sanitizeEmailLocalPart(localPart || "user");
  const stamp = deletedAt.toISOString().replace(/[:.]/g, "-");

  return {
    archivedEmail: "deleted+" + safeLocalPart + "+" + userId.slice(0, 8) + "+" + stamp + "@" + domainPart,
    archivedAuthentikSub: "deleted:" + userId + ":" + deletedAt.getTime(),
  };
}
