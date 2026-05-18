import type { Session } from "next-auth";

import { prisma } from "@/lib/prisma";

export function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? null;
}

type SessionIdentity = {
  authentikSub: string | null;
  email: string | null;
  name: string | null;
  image: string | null;
};

function getSessionIdentity(session: Session | null): SessionIdentity {
  const sessionUser = session?.user as
    | {
        id?: string;
        email?: string | null;
        name?: string | null;
        image?: string | null;
      }
    | undefined;

  return {
    authentikSub: typeof sessionUser?.id === "string" ? sessionUser.id : null,
    email: normalizeEmail(sessionUser?.email),
    name: sessionUser?.name?.trim() || null,
    image: sessionUser?.image || null,
  };
}

async function syncResolvedUser(
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    authentikSub: string | null;
  },
  identity: SessionIdentity,
  allowEmailUpdate: boolean,
) {
  const data: {
    email?: string;
    name?: string | null;
    image?: string | null;
    authentikSub?: string;
  } = {};

  if (allowEmailUpdate && identity.email && user.email !== identity.email) {
    data.email = identity.email;
  }

  if (identity.name && user.name !== identity.name) {
    data.name = identity.name;
  }

  if (identity.image && user.image !== identity.image) {
    data.image = identity.image;
  }

  if (identity.authentikSub && user.authentikSub !== identity.authentikSub) {
    data.authentikSub = identity.authentikSub;
  }

  if (Object.keys(data).length === 0) {
    return user;
  }

  return prisma.user.update({
    where: { id: user.id },
    data,
  });
}

export async function resolveCurrentUser(
  session: Session | null,
  options?: { createIfMissing?: boolean },
) {
  const identity = getSessionIdentity(session);

  if (!identity.email) {
    return { identity, user: null };
  }

  if (identity.authentikSub) {
    const userBySub = await prisma.user.findUnique({
      where: { authentikSub: identity.authentikSub },
    });

    if (userBySub && !userBySub.deletedAt) {
      return {
        identity,
        user: await syncResolvedUser(userBySub, identity, true),
      };
    }
  }

  const emailMatches = await prisma.user.findMany({
    where: {
      deletedAt: null,
      email: {
        equals: identity.email,
        mode: "insensitive",
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const preferredMatch =
    emailMatches.find((user) => normalizeEmail(user.email) === identity.email) ?? emailMatches[0] ?? null;

  if (preferredMatch) {
    if (emailMatches.length > 1) {
      console.warn("[auth] MULTIPLE_DB_USERS_FOR_EMAIL", {
        email: identity.email,
        ids: emailMatches.map((user) => user.id),
      });
    }

    return {
      identity,
      user: await syncResolvedUser(preferredMatch, identity, emailMatches.length === 1),
    };
  }

  if (!options?.createIfMissing) {
    return { identity, user: null };
  }

  return {
    identity,
    user: await prisma.user.create({
      data: {
        email: identity.email,
        name: identity.name,
        image: identity.image,
        authentikSub: identity.authentikSub,
      },
    }),
  };
}
