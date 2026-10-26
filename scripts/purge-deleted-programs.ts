/**
 * Hard-delete soft-deleted programs past the retention window (moderation ops).
 *
 * Retention matches slug redirect guidance: 365 days after `deleted_at`.
 *
 * Usage (from repo root):
 *   pnpm exec tsx scripts/purge-deleted-programs.ts --local
 *   pnpm exec tsx scripts/purge-deleted-programs.ts --local --execute
 *   pnpm exec tsx scripts/purge-deleted-programs.ts --remote --execute
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RETENTION_DAYS = 365;

function buildSql(cutoffUnix: number, execute: boolean): string {
  const lines: string[] = [
    "BEGIN TRANSACTION;",
    `-- cutoff deleted_at < ${cutoffUnix} (${RETENTION_DAYS}d retention)`,
  ];
  if (!execute) {
    lines.push(
      `SELECT id, user_id, slug, deleted_at FROM programs WHERE deleted_at IS NOT NULL AND deleted_at < ${cutoffUnix};`,
    );
  } else {
    lines.push(
      `DELETE FROM program_entries WHERE session_id IN (
  SELECT id FROM program_sessions WHERE program_id IN (
    SELECT id FROM programs WHERE deleted_at IS NOT NULL AND deleted_at < ${cutoffUnix}
  )
);`,
      `DELETE FROM program_sessions WHERE program_id IN (
  SELECT id FROM programs WHERE deleted_at IS NOT NULL AND deleted_at < ${cutoffUnix}
);`,
      `DELETE FROM program_slug_history WHERE program_id IN (
  SELECT id FROM programs WHERE deleted_at IS NOT NULL AND deleted_at < ${cutoffUnix}
);`,
      `DELETE FROM program_reports WHERE program_id IN (
  SELECT id FROM programs WHERE deleted_at IS NOT NULL AND deleted_at < ${cutoffUnix}
);`,
      `DELETE FROM programs WHERE deleted_at IS NOT NULL AND deleted_at < ${cutoffUnix};`,
    );
  }
  lines.push("COMMIT;");
  return lines.join("\n");
}

function main(): void {
  const remote = process.argv.includes("--remote");
  const execute = process.argv.includes("--execute");
  const target = remote ? "remote" : "local";
  const cutoffUnix =
    Math.floor(Date.now() / 1000) - RETENTION_DAYS * 24 * 60 * 60;

  const sqlDir = join(import.meta.dirname, ".import-cache");
  mkdirSync(sqlDir, { recursive: true });
  const sqlPath = join(sqlDir, "purge-deleted-programs.sql");
  writeFileSync(sqlPath, buildSql(cutoffUnix, execute), "utf8");

  const flag = remote ? "--remote" : "--local";
  console.log(
    execute
      ? `Purging programs deleted before ${new Date(cutoffUnix * 1000).toISOString()} (${target})`
      : `Dry run: programs deleted before ${new Date(cutoffUnix * 1000).toISOString()} (${target})`,
  );
  execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "physlane", flag, "--file", sqlPath],
    { stdio: "inherit", cwd: join(import.meta.dirname, "..") },
  );
}

main();
