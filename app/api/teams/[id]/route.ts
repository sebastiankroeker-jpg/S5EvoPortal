import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { TeamRegistrationSchema, type TeamRegistrationInput, birthYearToBirthDateInput, extractBirthYearFromInput } from '@/lib/domain/team';
import { classifyTeam as classifyTeamShared, evaluateTeamState } from '@/lib/domain/classification';
import { sendParticipantChangeSubmittedBatchEmails } from '@/lib/mail/participant-change';
import { diffParticipantSnapshots, serializeSnapshot, summarizeParticipantChanges, toParticipantSnapshot } from '@/lib/participant-change';
import { normalizeEmail, resolveCurrentUser } from '@/lib/current-user';
import { prisma } from '@/lib/prisma';
import { getScopedRoleFlags } from '@/lib/server-permissions';

// Map frontend gender ("M"/"W") to Prisma enum
function mapGender(g: string): "MALE" | "FEMALE" {
  return g === "W" ? "FEMALE" : "MALE";
}

// Map frontend discipline to Prisma DisciplineAssignment enum
function mapDiscipline(d: string): "RUN" | "BENCH" | "STOCK" | "ROAD" | "MTB" | "TBD" {
  const valid = ["RUN", "BENCH", "STOCK", "ROAD", "MTB", "TBD"] as const;
  return valid.includes(d as (typeof valid)[number]) ? (d as (typeof valid)[number]) : "TBD";
}

function findExistingParticipantBySubmittedData(
  submittedParticipant: TeamRegistrationInput["participants"][number],
  existingParticipants: Array<SerializableParticipant>,
  fallbackIndex: number,
) {
  if (submittedParticipant.id) {
    const byId = existingParticipants.find((participant) => participant.id === submittedParticipant.id);
    if (byId) {
      return byId;
    }
  }

  return existingParticipants[fallbackIndex];
}

function classifyTeam(participants: TeamRegistrationInput['participants']): string {
  const inputs = participants
    .map((participant) => ({
      participant,
      birthYear: extractBirthYearFromInput(participant.birthDate),
    }))
    .filter(({ participant, birthYear }) => participant.firstName && participant.lastName && birthYear !== null)
    .map(({ participant, birthYear }) => ({
      birthYear: birthYear as number,
      gender: participant.gender as "M" | "W" | "D",
    }));

  return classifyTeamShared(inputs).code;
}

type SerializedPendingChange = {
  id: string;
  status: string;
  updatedAt?: Date | null;
  reviewedAt?: Date | null;
  reviewComment?: string | null;
};

type SerializableParticipant = {
  id: string;
  firstName: string;
  lastName: string;
  gender: "MALE" | "FEMALE";
  birthYear: number | null;
  moderationNote?: string | null;
  email?: string | null;
  phone?: string | null;
  disciplineCode?: string | null;
  shirtSize?: string | null;
  pendingChanges?: SerializedPendingChange[];
};

type SerializableTeam = {
  id: string;
  name: string;
  classificationCode?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  owner?: { email?: string | null; name?: string | null } | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  participants?: SerializableParticipant[];
};

function serializeParticipant(participant: SerializableParticipant | null | undefined) {
  if (!participant) return null;
  const latestChange = Array.isArray(participant.pendingChanges) ? participant.pendingChanges[0] : null;
  return {
    id: participant.id,
    firstName: participant.firstName,
    lastName: participant.lastName,
    gender: participant.gender === "MALE" ? "M" : "W",
    birthDate: birthYearToBirthDateInput(participant.birthYear),
    moderationNote: participant.moderationNote ?? "",
    email: participant.email ?? "",
    phone: participant.phone ?? "",
    discipline: participant.disciplineCode ?? "TBD",
    shirtSize: participant.shirtSize ?? "",
    latestChange: latestChange
      ? {
          id: latestChange.id,
          status: latestChange.status,
          updatedAt: latestChange.updatedAt?.toISOString?.() ?? null,
          reviewedAt: latestChange.reviewedAt?.toISOString?.() ?? null,
          reviewComment: latestChange.reviewComment ?? null,
        }
      : null,
  };
}

function serializeTeam(team: SerializableTeam | null | undefined) {
  if (!team) return null;
  return {
    id: team.id,
    name: team.name,
    category: team.classificationCode ?? "unclassified",
    contactName: team.contactName ?? team.owner?.name ?? "",
    contactEmail: team.contactEmail ?? team.owner?.email ?? "",
    contactPhone: team.contactPhone ?? "",
    ownerEmail: team.owner?.email ?? team.contactEmail ?? "",
    ownerName: team.owner?.name ?? team.contactName ?? "",
    createdAt: team.createdAt?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: team.updatedAt?.toISOString?.() ?? team.createdAt?.toISOString?.() ?? new Date().toISOString(),
    participants: Array.isArray(team.participants)
      ? team.participants.map(serializeParticipant).filter(Boolean)
      : [],
  };
}

// GET einzelnes Team
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    try {
      const team = await prisma.team.findFirst({
        where: {
          id: id,
          deletedAt: null
        },
        include: {
          participants: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            include: {
              pendingChanges: {
                orderBy: { updatedAt: 'desc' },
                take: 1,
                select: { id: true, status: true, updatedAt: true, reviewedAt: true, reviewComment: true }
              }
            }
          },
          owner: { select: { email: true, name: true } },
          competition: { select: { tenantId: true } },
        }
      });

      if (!team) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      const { user } = await resolveCurrentUser(session, { createIfMissing: true });
      const access = await getScopedRoleFlags(userEmail, team.competition.tenantId, session);
      const normalizedUserEmail = normalizeEmail(userEmail);
      const isOwner =
        team.ownerId === user?.id ||
        normalizeEmail(team.owner?.email) === normalizedUserEmail ||
        normalizeEmail(team.contactEmail) === normalizedUserEmail;

      if (!access.canViewAllTeams && !isOwner) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      return NextResponse.json({ team: serializeTeam(team) });
    } catch (dbError) {
      console.error('Database error on GET:', dbError);
      return NextResponse.json({ error: 'Database temporarily unavailable' }, { status: 503 });
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'API temporarily unavailable' }, { status: 503 });
  }
}

// PUT Team aktualisieren
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    
    const validation = TeamRegistrationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const teamData = validation.data;

    try {
      // Prüfe ob Team existiert und dem User gehört
      const existingTeam = await prisma.team.findFirst({
        where: {
          id: id,
          deletedAt: null
        },
        include: {
          participants: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            include: {
              pendingChanges: {
                orderBy: { updatedAt: 'desc' },
                take: 1,
                select: { id: true, status: true, updatedAt: true, reviewedAt: true, reviewComment: true }
              }
            }
          },
          owner: { select: { email: true, name: true } },
          competition: {
            select: {
              tenantId: true,
              name: true,
              year: true,
              registrationNotificationEmail: true,
              tenant: {
                select: {
                  name: true,
                  contactEmail: true,
                },
              },
            },
          },
        }
      });

      if (!existingTeam) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      const { user } = await resolveCurrentUser(session, { createIfMissing: true });
      const access = await getScopedRoleFlags(userEmail, existingTeam.competition.tenantId, session);
      const normalizedUserEmail = normalizeEmail(userEmail);
      const isOwner =
        existingTeam.ownerId === user?.id ||
        normalizeEmail(existingTeam.owner?.email) === normalizedUserEmail ||
        normalizeEmail(existingTeam.contactEmail) === normalizedUserEmail;

      if (!access.canEditAllTeams && !isOwner) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const canDirectEdit = access.canEditAllTeams;
      const requestedTeamState = evaluateTeamState(
        teamData.participants.map((participant) => ({
          birthYear: extractBirthYearFromInput(participant.birthDate),
          gender: participant.gender,
          disciplineCode: participant.discipline,
        })),
        existingTeam.classificationCode,
      );

      if (!requestedTeamState.discipline.valid) {
        return NextResponse.json(
          {
            error: requestedTeamState.discipline.warnings.join(' · '),
            disciplineWarnings: requestedTeamState.discipline.warnings,
          },
          { status: 409 }
        );
      }

      // Neue Klassifizierung berechnen
      const autoCategory = requestedTeamState.classification.code;
      const normalizedTeamName = teamData.teamName?.trim();
      
      // Team-Name beibehalten wenn leer
      const finalTeamName = normalizedTeamName && normalizedTeamName.length >= 3
        ? normalizedTeamName
        : existingTeam.name;

      if (!canDirectEdit && finalTeamName !== existingTeam.name) {
        return NextResponse.json(
          { error: 'Teamname-Aenderungen laufen fuer Teamchefs noch nicht ueber den Genehmigungsworkflow. Bitte nur Teilnehmerdaten aendern.' },
          { status: 409 }
        );
      }

      // Berechne neues Gesamtalter
      const validParticipants = teamData.participants
        .map((participant) => ({
          participant,
          birthYear: extractBirthYearFromInput(participant.birthDate),
        }))
        .filter(({ participant, birthYear }) => participant.firstName && participant.lastName && birthYear !== null);
      const totalAge = validParticipants.reduce((sum, entry) => sum + (2026 - (entry.birthYear as number)), 0);

      if (!canDirectEdit) {
        let createdRequests = 0;
        let updatedRequests = 0;
        const createdChangeMailItems: Array<{
          participantName: string;
          changeSummary: ReturnType<typeof summarizeParticipantChanges>;
        }> = [];

        for (let index = 0; index < teamData.participants.length; index += 1) {
          const submittedParticipant = teamData.participants[index];
          const existingParticipant = findExistingParticipantBySubmittedData(
            submittedParticipant,
            existingTeam.participants,
            index,
          );

          if (!submittedParticipant || !existingParticipant) continue;

          const requestedBirthYear = extractBirthYearFromInput(submittedParticipant.birthDate);
          const currentSnapshot = toParticipantSnapshot(existingParticipant);
          const requestedSnapshot = toParticipantSnapshot({
            firstName: submittedParticipant.firstName,
            lastName: submittedParticipant.lastName,
            birthYear: requestedBirthYear,
            gender: mapGender(submittedParticipant.gender),
            disciplineCode: mapDiscipline(submittedParticipant.discipline),
            shirtSize: submittedParticipant.shirtSize || null,
            moderationNote: submittedParticipant.moderationNote?.trim() || null,
            email: submittedParticipant.email || null,
            phone: submittedParticipant.phone || null,
          });

          const changedFields = diffParticipantSnapshots(currentSnapshot, requestedSnapshot);
          const changeSummary = summarizeParticipantChanges(currentSnapshot, requestedSnapshot);
          if (Object.keys(changedFields).length === 0) {
            continue;
          }

          const existingPendingChange = await prisma.pendingChange.findFirst({
            where: {
              participantId: existingParticipant.id,
              status: 'PENDING',
            },
            orderBy: { createdAt: 'desc' },
          });

          if (existingPendingChange) {
            updatedRequests += 1;
            await prisma.$transaction(async (tx) => {
              const updatedPendingChange = await tx.pendingChange.update({
                where: { id: existingPendingChange.id },
                data: {
                  beforeData: serializeSnapshot(currentSnapshot),
                  changeData: serializeSnapshot(requestedSnapshot),
                  requestedById: user!.id,
                  reviewComment: null,
                  reviewedAt: null,
                  reviewedById: null,
                },
              });

              await tx.participantAuditLog.create({
                data: {
                  action: 'REQUEST_UPDATED',
                  participantId: existingParticipant.id,
                  actorId: user!.id,
                  pendingChangeId: updatedPendingChange.id,
                  beforeData: serializeSnapshot(currentSnapshot),
                  afterData: serializeSnapshot(requestedSnapshot),
                  message: 'Offene Aenderungsanfrage durch Teamchef aktualisiert',
                },
              });
            });
          } else {
            createdRequests += 1;
            await prisma.$transaction(async (tx) => {
              const createdPendingChange = await tx.pendingChange.create({
                data: {
                  beforeData: serializeSnapshot(currentSnapshot),
                  changeData: serializeSnapshot(requestedSnapshot),
                  status: 'PENDING',
                  participantId: existingParticipant.id,
                  requestedById: user!.id,
                },
              });

              await tx.participantAuditLog.create({
                data: {
                  action: 'REQUEST_SUBMITTED',
                  participantId: existingParticipant.id,
                  actorId: user!.id,
                  pendingChangeId: createdPendingChange.id,
                  beforeData: serializeSnapshot(currentSnapshot),
                  afterData: serializeSnapshot(requestedSnapshot),
                  message: 'Aenderungsanfrage durch Teamchef eingereicht',
                },
              });
            });

            createdChangeMailItems.push({
              participantName: existingParticipant.firstName + ' ' + existingParticipant.lastName,
              changeSummary,
            });
          }
        }

        if (createdChangeMailItems.length > 0) {
          await sendParticipantChangeSubmittedBatchEmails({
            competition: existingTeam.competition,
            teamName: finalTeamName,
            teamContactEmail: existingTeam.contactEmail,
            requester: {
              name: user?.name || userEmail || 'Teamchef',
              email: userEmail,
            },
            participants: createdChangeMailItems,
          });
        }

        const refreshedTeam = await prisma.team.findFirst({
          where: { id, deletedAt: null },
          include: {
            participants: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'asc' },
              include: {
                pendingChanges: {
                  orderBy: { updatedAt: 'desc' },
                  take: 1,
                  select: { id: true, status: true, updatedAt: true, reviewedAt: true, reviewComment: true },
                },
              },
            },
            owner: { select: { email: true, name: true } },
          },
        });

        if (!refreshedTeam) {
          return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        if (createdRequests === 0 && updatedRequests === 0) {
          return NextResponse.json({
            success: true,
            applied: false,
            message: 'Keine Aenderungen erkannt',
            classificationWarnings: requestedTeamState.classificationWarnings,
            team: serializeTeam(refreshedTeam),
          });
        }

        return NextResponse.json({
          success: true,
          applied: false,
          message:
            createdRequests > 0 && updatedRequests > 0
              ? `${createdRequests} Aenderungsanfrage(n) eingereicht, ${updatedRequests} offene Anfrage(n) aktualisiert`
              : createdRequests > 0
                ? `${createdRequests} Aenderungsanfrage(n) zur Genehmigung eingereicht`
                : `${updatedRequests} offene Aenderungsanfrage(n) aktualisiert`,
          classificationWarnings: requestedTeamState.classificationWarnings,
          pendingCount: createdRequests + updatedRequests,
          team: serializeTeam(refreshedTeam),
        });
      }

      // Lösche alte Participants (soft delete)
      await prisma.participant.updateMany({
        where: { teamId: id },
        data: { deletedAt: new Date() }
      });

      // Update Team mit neuen Participants
      const updatedTeam = await prisma.team.update({
        where: { id: id },
        data: {
          name: finalTeamName,
          contactName: body.contactName || existingTeam.contactName,
          contactEmail: body.contactEmail || existingTeam.contactEmail,
          classificationCode: autoCategory,
          totalAge: totalAge || null,
          participants: {
            create: validParticipants.map(({ participant, birthYear }) => ({
              firstName: participant.firstName,
              lastName: participant.lastName,
              birthYear: birthYear as number,
              gender: mapGender(participant.gender),
              disciplineCode: mapDiscipline(participant.discipline),
              shirtSize: participant.shirtSize || null,
              moderationNote: participant.moderationNote?.trim() || null,
              consentGiven: true,
              email: participant.email || null,
              phone: participant.phone || null,
            }))
          }
        },
        include: {
          participants: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
          owner: { select: { email: true, name: true } }
        }
      });

      return NextResponse.json({ 
        success: true,
        applied: true,
        message: `Team "${finalTeamName}" erfolgreich aktualisiert! Klasse: ${autoCategory}`,
        classificationWarnings: requestedTeamState.classificationWarnings,
        team: serializeTeam(updatedTeam)
      });

    } catch (dbError) {
      console.error('Database error on PUT:', dbError);
      return NextResponse.json(
        { error: 'Datenbankfehler bei der Aktualisierung. Bitte versuche es erneut.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
  }
}

// DELETE Team (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
      // Prüfe ob Team existiert und dem User gehört
      const existingTeam = await prisma.team.findFirst({
        where: {
          id: id,
          deletedAt: null
        },
        include: {
          owner: { select: { email: true, name: true } },
          competition: { select: { tenantId: true } },
        },
      });

      if (!existingTeam) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      const { user } = await resolveCurrentUser(session, { createIfMissing: true });
      const access = await getScopedRoleFlags(userEmail, existingTeam.competition.tenantId, session);
      const normalizedUserEmail = normalizeEmail(userEmail);
      const isOwner =
        existingTeam.ownerId === user?.id ||
        normalizeEmail(existingTeam.owner?.email) === normalizedUserEmail ||
        normalizeEmail(existingTeam.contactEmail) === normalizedUserEmail;

      if (!access.canEditAllTeams && !isOwner) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Soft delete: setze deletedAt
      await prisma.team.update({
        where: { id: id },
        data: { 
          deletedAt: new Date()
        }
      });

      // Auch alle Participants des Teams soft-deleten
      await prisma.participant.updateMany({
        where: { teamId: id },
        data: { deletedAt: new Date() }
      });

      return NextResponse.json({ 
        success: true,
        message: `Team "${existingTeam.name}" wurde gelöscht.`
      });

    } catch (dbError) {
      console.error('Database error on DELETE:', dbError);
      return NextResponse.json(
        { error: 'Datenbankfehler beim Löschen. Bitte versuche es erneut.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 });
  }
}
