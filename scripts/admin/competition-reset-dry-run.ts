import { resetCompetitionData } from "../../lib/competition-reset";

async function main() {
  const [tenantId, competitionId, ...reasonParts] = process.argv.slice(2);
  const reason = reasonParts.join(" ").trim() || "Dry-Run fuer Competition Reset";

  if (!tenantId || !competitionId) {
    throw new Error("Usage: tsx scripts/admin/competition-reset-dry-run.ts <tenantId> <competitionId> [reason...]");
  }

  const result = await resetCompetitionData({
    tenantId,
    competitionId,
    reason,
    dryRun: true,
  });

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main().catch((error) => {
  process.stderr.write((error instanceof Error ? error.stack || error.message : String(error)) + "\n");
  process.exit(1);
});
