/**
 * One-off exercise catalog importer (ADR 0001). Not a runtime dependency.
 *
 * LICENSE GATE (2026-10-25, wger GitHub README "License"):
 * - Application code: AGPL-3.0-or-later; exercise data: per-entry CC (mostly BY-SA).
 * - Verdict: NOT CLEAN for MIT repo + commercial ship without per-entry SA compliance.
 * - Decision: hand-curated ~150 lifts in scripts/exercise-catalog.json — NO wger data.
 *
 * Usage (from repo root):
 *   npx wrangler d1 migrations apply physlane --local   # if needed
 *   pnpm exec tsx scripts/import-exercises.ts --local
 *
 * Production (operator):
 *   pnpm exec tsx scripts/import-exercises.ts --remote
 *   # or: wrangler d1 execute physlane --remote --file <generated.sql>
 *
 * Applies generated SQL via `wrangler d1 execute physlane --local|remote --file`.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  EQUIPMENT,
  exerciseRegions,
  MUSCLES,
  MUSCLE_GROUPS,
  type Equipment,
  type Muscle,
  type MuscleRegion,
} from "#/lib/programs/taxonomy";

type CatalogExercise = {
  id: string;
  name: string;
  aliases: string[];
  musclePrimary: Muscle;
  muscleSecondary: Muscle[];
  equipment: Equipment;
  formNote?: string;
};

type CatalogAsset = {
  id: string;
  exerciseId: string;
  kind: "video" | "article" | "image";
  url: string;
  title: string;
  sortOrder: number;
};

type CatalogFile = {
  _meta: {
    idScheme: string;
    assetIdScheme: string;
    version: number;
  };
  exercises: CatalogExercise[];
  assets: CatalogAsset[];
};

const muscleSet = new Set<string>(MUSCLES);
const equipmentSet = new Set<string>(EQUIPMENT);

const TOP_50_IMPORTANCE_IDS = new Set([
  "ex-back-squat",
  "ex-front-squat",
  "ex-conventional-deadlift",
  "ex-romanian-deadlift",
  "ex-sumo-deadlift",
  "ex-bench-press",
  "ex-incline-bench-press",
  "ex-overhead-press",
  "ex-push-press",
  "ex-pull-up",
  "ex-chin-up",
  "ex-lat-pulldown",
  "ex-barbell-row",
  "ex-dumbbell-row",
  "ex-pendlay-row",
  "ex-dip",
  "ex-lateral-raise",
  "ex-rear-delt-fly",
  "ex-face-pull",
  "ex-barbell-curl",
  "ex-dumbbell-curl",
  "ex-hammer-curl",
  "ex-incline-dumbbell-curl",
  "ex-preacher-curl",
  "ex-triceps-pushdown",
  "ex-skull-crusher",
  "ex-close-grip-bench-press",
  "ex-cable-fly",
  "ex-hip-thrust",
  "ex-forward-lunge",
  "ex-walking-lunge",
  "ex-bulgarian-split-squat",
  "ex-leg-press",
  "ex-leg-extension",
  "ex-leg-curl",
  "ex-standing-calf-raise",
  "ex-seated-calf-raise",
  "ex-farmers-carry",
  "ex-kettlebell-swing",
  "ex-turkish-get-up",
  "ex-goblet-squat",
  "ex-plank",
  "ex-hanging-leg-raise",
  "ex-cable-crunch",
  "ex-ab-wheel-rollout",
  "ex-russian-twist",
  "ex-pallof-press",
  "ex-band-pull-apart",
  "ex-good-morning",
  "ex-back-extension",
]);

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function loadCatalog(): CatalogFile {
  const path = join(import.meta.dirname, "exercise-catalog.json");
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as CatalogFile;
}

function validateCatalog(catalog: CatalogFile): void {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const ex of catalog.exercises) {
    if (ids.has(ex.id)) {
      errors.push(`duplicate exercise id: ${ex.id}`);
    }
    ids.add(ex.id);
    if (!muscleSet.has(ex.musclePrimary)) {
      errors.push(`${ex.id}: invalid musclePrimary ${ex.musclePrimary}`);
    }
    for (const m of ex.muscleSecondary) {
      if (!muscleSet.has(m)) {
        errors.push(`${ex.id}: invalid muscleSecondary ${m}`);
      }
    }
    if (!equipmentSet.has(ex.equipment)) {
      errors.push(`${ex.id}: invalid equipment ${ex.equipment}`);
    }
    if (ex.muscleSecondary.includes(ex.musclePrimary)) {
      errors.push(`${ex.id}: primary listed in secondary`);
    }
  }

  const exerciseIds = new Set(catalog.exercises.map((e) => e.id));
  for (const asset of catalog.assets) {
    if (!exerciseIds.has(asset.exerciseId)) {
      errors.push(`asset ${asset.id}: unknown exerciseId ${asset.exerciseId}`);
    }
  }

  if (errors.length > 0) {
    console.error("Catalog validation failed:\n" + errors.join("\n"));
    process.exit(1);
  }
}

function buildSql(catalog: CatalogFile): string {
  const lines: string[] = ["BEGIN TRANSACTION;"];

  for (const ex of catalog.exercises) {
    const norm = normalizeName(ex.name);
    lines.push(
      `UPDATE program_entries SET exercise_id = ${sqlString(ex.id)} WHERE exercise_id IN (SELECT id FROM exercises WHERE owner_user_id IS NULL AND lower(trim(name)) = ${sqlString(norm)} AND id != ${sqlString(ex.id)});`,
    );
    lines.push(
      `UPDATE exercise_assets SET exercise_id = ${sqlString(ex.id)} WHERE exercise_id IN (SELECT id FROM exercises WHERE owner_user_id IS NULL AND lower(trim(name)) = ${sqlString(norm)} AND id != ${sqlString(ex.id)});`,
    );
    lines.push(
      `UPDATE exercises SET deleted_at = unixepoch() WHERE owner_user_id IS NULL AND lower(trim(name)) = ${sqlString(norm)} AND id != ${sqlString(ex.id)};`,
    );
    const aliasesJson = sqlString(JSON.stringify(ex.aliases));
    const secondaryJson = sqlString(JSON.stringify(ex.muscleSecondary));
    const formNote = ex.formNote ? sqlString(ex.formNote) : "NULL";
    lines.push(
      `INSERT INTO exercises (id, owner_user_id, name, aliases, muscle_primary, muscle_secondary, equipment, form_note, deleted_at)
VALUES (${sqlString(ex.id)}, NULL, ${sqlString(ex.name)}, ${aliasesJson}, ${sqlString(ex.musclePrimary)}, ${secondaryJson}, ${sqlString(ex.equipment)}, ${formNote}, NULL)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  aliases = excluded.aliases,
  muscle_primary = excluded.muscle_primary,
  muscle_secondary = excluded.muscle_secondary,
  equipment = excluded.equipment,
  form_note = excluded.form_note,
  deleted_at = NULL;`,
    );
  }

  for (const asset of catalog.assets) {
    lines.push(
      `DELETE FROM exercise_assets WHERE exercise_id = ${sqlString(asset.exerciseId)} AND url = ${sqlString(asset.url)} AND id != ${sqlString(asset.id)};`,
    );
    lines.push(
      `INSERT INTO exercise_assets (id, exercise_id, kind, url, title, sort_order)
VALUES (${sqlString(asset.id)}, ${sqlString(asset.exerciseId)}, ${sqlString(asset.kind)}, ${sqlString(asset.url)}, ${sqlString(asset.title)}, ${asset.sortOrder})
ON CONFLICT(id) DO UPDATE SET
  exercise_id = excluded.exercise_id,
  kind = excluded.kind,
  url = excluded.url,
  title = excluded.title,
  sort_order = excluded.sort_order;`,
    );
  }

  lines.push("COMMIT;");
  return lines.join("\n");
}

function countRows(target: "local" | "remote"): {
  exercises: number;
  assets: number;
} {
  const flag = target === "local" ? "--local" : "--remote";
  const query =
    "SELECT (SELECT COUNT(*) FROM exercises WHERE owner_user_id IS NULL) AS exercises, (SELECT COUNT(*) FROM exercise_assets) AS assets;";
  const out = execFileSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "physlane",
      flag,
      "--json",
      "--command",
      query,
    ],
    { encoding: "utf8", cwd: join(import.meta.dirname, "..") },
  );
  const lines = out.split("\n");
  const start = lines.findIndex((l) => l.trim().startsWith("["));
  const parsed = JSON.parse(lines.slice(start).join("\n")) as {
    results: { exercises: number; assets: number }[];
  }[];
  const row = parsed[0]?.results[0];
  return {
    exercises: row?.exercises ?? 0,
    assets: row?.assets ?? 0,
  };
}

function printQualityReport(catalog: CatalogFile): void {
  const regionCounts = new Map<MuscleRegion, number>();
  for (const region of Object.keys(MUSCLE_GROUPS) as MuscleRegion[]) {
    regionCounts.set(region, 0);
  }
  const musclePrimaryCounts = new Map<Muscle, number>();
  for (const m of MUSCLES) {
    musclePrimaryCounts.set(m, 0);
  }
  const equipmentCounts = new Map<Equipment, number>();
  for (const e of EQUIPMENT) {
    equipmentCounts.set(e, 0);
  }

  for (const ex of catalog.exercises) {
    musclePrimaryCounts.set(
      ex.musclePrimary,
      (musclePrimaryCounts.get(ex.musclePrimary) ?? 0) + 1,
    );
    equipmentCounts.set(
      ex.equipment,
      (equipmentCounts.get(ex.equipment) ?? 0) + 1,
    );
    const regions = exerciseRegions(ex.musclePrimary, ex.muscleSecondary);
    for (const r of regions) {
      regionCounts.set(r, (regionCounts.get(r) ?? 0) + 1);
    }
  }

  const videoByExercise = new Map<string, number>();
  for (const a of catalog.assets) {
    if (a.kind === "video") {
      videoByExercise.set(
        a.exerciseId,
        (videoByExercise.get(a.exerciseId) ?? 0) + 1,
      );
    }
  }

  const musclesUnderTwo = MUSCLES.filter(
    (m) => (musclePrimaryCounts.get(m) ?? 0) < 2,
  );

  const top50WithVideo = [...TOP_50_IMPORTANCE_IDS].filter((id) =>
    videoByExercise.has(id),
  );
  const top50Missing = [...TOP_50_IMPORTANCE_IDS].filter(
    (id) => !videoByExercise.has(id),
  );

  console.log("\n── Quality report ──");
  console.log(`Exercises in catalog: ${catalog.exercises.length}`);
  console.log(`Assets in catalog: ${catalog.assets.length}`);
  console.log("Per-region (primary+secondary presence):");
  for (const [region, count] of regionCounts) {
    console.log(`  ${region}: ${count}`);
  }
  console.log("Equipment distribution:");
  for (const [eq, count] of equipmentCounts) {
    console.log(`  ${eq}: ${count}`);
  }
  console.log(
    `Muscles with <2 primary assignments: ${musclesUnderTwo.join(", ") || "(none)"}`,
  );
  console.log(
    `Exercises with ≥1 video asset: ${videoByExercise.size} (${[...videoByExercise.keys()].length} unique)`,
  );
  console.log(
    `Top-50 video coverage: ${top50WithVideo.length}/${TOP_50_IMPORTANCE_IDS.size}`,
  );
  if (top50Missing.length > 0) {
    console.log(`Top-50 missing video: ${top50Missing.join(", ")}`);
  }
}

function main(): void {
  const target = process.argv.includes("--remote") ? "remote" : "local";
  const catalog = loadCatalog();
  validateCatalog(catalog);

  const sqlDir = join(import.meta.dirname, ".import-cache");
  mkdirSync(sqlDir, { recursive: true });
  const sqlPath = join(sqlDir, "import-exercises.sql");
  writeFileSync(sqlPath, buildSql(catalog), "utf8");

  const flag = target === "local" ? "--local" : "--remote";
  execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "physlane", flag, "--file", sqlPath],
    { stdio: "inherit", cwd: join(import.meta.dirname, "..") },
  );

  const counts = countRows(target);
  console.log(
    `Row counts (${target}): exercises(owner=null)=${counts.exercises}, exercise_assets=${counts.assets}`,
  );
  printQualityReport(catalog);
}

main();
