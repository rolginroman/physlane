import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { cn } from "#/lib/cn";
import {
  equipmentDisplayLabel,
  muscleDisplayLabel,
  regionDisplayLabel,
} from "#/lib/programs/display-labels";
import {
  EQUIPMENT,
  MUSCLE_GROUPS,
  MUSCLES,
  type Equipment,
  type Muscle,
  type MuscleRegion,
} from "#/lib/programs/taxonomy";
import {
  searchCatalogExercises,
  upsertCustomExercise,
  type ExercisePickerRowDTO,
} from "#/server/programs.fns";

type PickerTab = "catalog" | "mine";

export type ExercisePickerSelection = {
  id: string;
  name: string;
  musclePrimary: Muscle;
  equipment: Equipment;
  formNote: string | null;
  isCustom: boolean;
};

type ExercisePickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (exercise: ExercisePickerSelection) => void;
};

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function ExercisePicker({
  open,
  onOpenChange,
  onSelect,
}: ExercisePickerProps) {
  const [tab, setTab] = useState<PickerTab>("catalog");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [region, setRegion] = useState<MuscleRegion | null>(null);
  const [regionMenu, setRegionMenu] = useState<MuscleRegion | null>(null);
  const [rows, setRows] = useState<ExercisePickerRowDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customMuscle, setCustomMuscle] = useState<Muscle | "">("");
  const [customEquipment, setCustomEquipment] = useState<Equipment>("barbell");
  const [customAliases, setCustomAliases] = useState("");
  const [customFormNote, setCustomFormNote] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [customPending, setCustomPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Ignore responses from superseded filters so a slow reply can't overwrite a newer one.
    let cancelled = false;
    setLoading(true);
    setError(false);
    searchCatalogExercises({
      data: {
        query: debouncedQuery,
        equipment: equipment ?? undefined,
        muscle: muscle ?? undefined,
        region: region ?? undefined,
        source: tab === "mine" ? "mine" : "all",
      },
    })
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, debouncedQuery, equipment, muscle, region, tab, reloadKey]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setEquipment(null);
      setMuscle(null);
      setRegion(null);
      setRegionMenu(null);
      setTab("catalog");
      setCreating(false);
      setCustomError(null);
    }
  }, [open]);

  const showCreateRow =
    debouncedQuery.trim().length > 0 &&
    !rows.some(
      (r) => r.name.toLowerCase() === debouncedQuery.trim().toLowerCase(),
    );

  const pick = (row: ExercisePickerRowDTO) => {
    onSelect({
      id: row.id,
      name: row.name,
      musclePrimary: row.musclePrimary,
      equipment: row.equipment,
      formNote: row.formNote,
      isCustom: row.isCustom,
    });
    onOpenChange(false);
  };

  const startCreate = () => {
    setCreating(true);
    setCustomName(debouncedQuery.trim());
    setCustomMuscle("");
    setCustomEquipment("barbell");
    setCustomAliases("");
    setCustomFormNote("");
    setCustomError(null);
  };

  const submitCustom = async () => {
    if (!customName.trim()) {
      setCustomError("Add a name.");
      return;
    }
    if (!customMuscle) {
      setCustomError("Choose a primary muscle.");
      return;
    }
    setCustomPending(true);
    setCustomError(null);
    try {
      const created = await upsertCustomExercise({
        data: {
          name: customName.trim(),
          musclePrimary: customMuscle,
          muscleSecondary: [],
          equipment: customEquipment,
          aliases: customAliases
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          formNote: customFormNote.trim() || null,
        },
      });
      pick({
        ...created,
        isCustom: true,
        hasVideo: false,
        hasArticle: false,
      });
    } catch {
      setCustomError("Could not save this exercise. Try another name.");
    } finally {
      setCustomPending(false);
    }
  };

  const regions = Object.keys(MUSCLE_GROUPS) as MuscleRegion[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle>Choose exercise</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 overflow-y-auto px-4 py-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises"
            aria-label="Search exercises"
            autoFocus
            className="min-h-11"
          />
          <div
            role="tablist"
            aria-label="Exercise source"
            className="flex gap-1 rounded-lg border border-border bg-muted p-1"
          >
            {(
              [
                ["catalog", "Catalog"],
                ["mine", "My exercises"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "min-h-11 flex-1 rounded-md text-sm font-medium",
                  tab === id
                    ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                    : "text-text-secondary",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Region
            </span>
            <div className="flex flex-wrap gap-2">
              {regions.map((r) => (
                <div key={r} className="relative">
                  <button
                    type="button"
                    aria-pressed={region === r && !muscle}
                    onClick={() => {
                      setRegion(r);
                      setMuscle(null);
                      setRegionMenu(regionMenu === r ? null : r);
                    }}
                    className={cn(
                      "min-h-11 rounded-lg border px-3 text-sm font-medium",
                      region === r && !muscle
                        ? "border-primary bg-brand-soft text-foreground"
                        : "border-border bg-card text-text-secondary",
                    )}
                  >
                    {regionDisplayLabel(r)}
                  </button>
                  {regionMenu === r ? (
                    <div
                      className="absolute top-full z-10 mt-1 flex min-w-[10rem] flex-col rounded-lg border border-border bg-popover p-1 shadow-lg"
                      role="menu"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="min-h-11 rounded-md px-3 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setRegion(r);
                          setMuscle(null);
                          setRegionMenu(null);
                        }}
                      >
                        All {regionDisplayLabel(r)}
                      </button>
                      {MUSCLE_GROUPS[r].map((m) => (
                        <button
                          key={m}
                          type="button"
                          role="menuitem"
                          className="min-h-11 rounded-md px-3 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            setRegion(r);
                            setMuscle(m);
                            setRegionMenu(null);
                          }}
                        >
                          {muscleDisplayLabel(m)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {region || muscle ? (
                <button
                  type="button"
                  className="min-h-11 text-sm text-brand-text underline"
                  onClick={() => {
                    setRegion(null);
                    setMuscle(null);
                    setRegionMenu(null);
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Equipment
            </span>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT.map((eq) => (
                <button
                  key={eq}
                  type="button"
                  aria-pressed={equipment === eq}
                  onClick={() => setEquipment(equipment === eq ? null : eq)}
                  className={cn(
                    "min-h-11 rounded-lg border px-3 text-sm font-medium",
                    equipment === eq
                      ? "border-primary bg-brand-soft text-foreground"
                      : "border-border bg-card text-text-secondary",
                  )}
                >
                  {equipmentDisplayLabel(eq)}
                </button>
              ))}
            </div>
          </div>

          {creating ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="m-0 text-sm font-semibold">New exercise</h3>
              <div className="mt-3 flex flex-col gap-3">
                <div>
                  <Label htmlFor="custom-ex-name">Name</Label>
                  <Input
                    id="custom-ex-name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="mt-1 min-h-11"
                  />
                </div>
                <div>
                  <Label htmlFor="custom-ex-muscle">Primary muscle</Label>
                  <select
                    id="custom-ex-muscle"
                    value={customMuscle}
                    onChange={(e) =>
                      setCustomMuscle(e.target.value as Muscle | "")
                    }
                    className="mt-1 flex h-11 w-full rounded-lg border border-border bg-card px-3 text-sm"
                  >
                    <option value="">Select…</option>
                    {MUSCLES.map((m) => (
                      <option key={m} value={m}>
                        {muscleDisplayLabel(m)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="custom-ex-eq">Equipment</Label>
                  <select
                    id="custom-ex-eq"
                    value={customEquipment}
                    onChange={(e) =>
                      setCustomEquipment(e.target.value as Equipment)
                    }
                    className="mt-1 flex h-11 w-full rounded-lg border border-border bg-card px-3 text-sm"
                  >
                    {EQUIPMENT.map((eq) => (
                      <option key={eq} value={eq}>
                        {equipmentDisplayLabel(eq)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="custom-ex-aliases">
                    Aliases <span className="font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="custom-ex-aliases"
                    value={customAliases}
                    onChange={(e) => setCustomAliases(e.target.value)}
                    placeholder="Comma-separated"
                    className="mt-1 min-h-11"
                  />
                </div>
                <div>
                  <Label htmlFor="custom-ex-note">
                    Form note <span className="font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="custom-ex-note"
                    value={customFormNote}
                    onChange={(e) => setCustomFormNote(e.target.value)}
                    className="mt-1 min-h-11"
                  />
                </div>
                {customError ? (
                  <p className="text-sm text-destructive">{customError}</p>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 flex-1"
                    onClick={() => setCreating(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="min-h-11 flex-1"
                    disabled={customPending}
                    onClick={() => void submitCustom()}
                  >
                    {customPending ? "Saving…" : "Save and use"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1" aria-live="polite">
            {loading ? (
              <ul className="flex flex-col gap-2" aria-busy="true">
                {[0, 1, 2, 3].map((i) => (
                  <li
                    key={i}
                    className="h-16 animate-pulse rounded-lg bg-muted"
                  />
                ))}
              </ul>
            ) : error ? (
              <div className="rounded-lg border border-destructive/40 bg-muted p-4">
                <p className="m-0 text-sm">Could not load exercises.</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 min-h-11"
                  onClick={() => setReloadKey((k) => k + 1)}
                >
                  Try again
                </Button>
              </div>
            ) : rows.length === 0 && !showCreateRow ? (
              <p className="text-sm text-muted-foreground">
                {tab === "mine"
                  ? "No custom exercises yet. Search the catalog or create one below."
                  : "No exercises match these filters."}
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {rows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => pick(row)}
                      className="flex min-h-11 w-full flex-col gap-0.5 rounded-lg border border-transparent px-3 py-2 text-left hover:border-border hover:bg-muted/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        {row.name}
                        {row.hasVideo || row.hasArticle ? (
                          <span
                            className="text-xs text-muted-foreground"
                            aria-label={
                              row.hasVideo ? "Has video" : "Has article"
                            }
                          >
                            {row.hasVideo ? "▶" : "↗"}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-sm text-text-secondary">
                        {muscleDisplayLabel(row.musclePrimary)} ·{" "}
                        {equipmentDisplayLabel(row.equipment)}
                      </span>
                      {row.formNote ? (
                        <span className="text-sm text-muted-foreground">
                          {row.formNote}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
                {showCreateRow ? (
                  <li>
                    <button
                      type="button"
                      onClick={startCreate}
                      className="flex min-h-11 w-full items-center rounded-lg border border-dashed border-border px-3 text-left text-sm font-medium text-brand-text hover:bg-brand-soft/40"
                    >
                      Create &quot;{debouncedQuery.trim()}&quot;
                    </button>
                  </li>
                ) : null}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
