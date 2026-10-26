import { useEffect, useMemo, useState } from "react";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { OptionSelect } from "#/components/ui/option-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
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

const ALL_MUSCLES = "all" as const;

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
  const muscleOptions = useMemo(
    () => MUSCLES.map((m) => ({ value: m, label: muscleDisplayLabel(m) })),
    [],
  );
  const equipmentOptions = useMemo(
    () =>
      EQUIPMENT.map((eq) => ({ value: eq, label: equipmentDisplayLabel(eq) })),
    [],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-4 py-3 pr-12">
          <DialogTitle>Choose exercise</DialogTitle>
        </DialogHeader>
        <Tabs
          value={tab}
          onValueChange={setTab}
          className="flex flex-col gap-3 overflow-y-auto px-4 py-3"
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises"
            aria-label="Search exercises"
            autoFocus
          />
          <TabsList aria-label="Exercise source">
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
            <TabsTrigger value="mine">My exercises</TabsTrigger>
          </TabsList>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Region
            </span>
            <div className="flex flex-wrap gap-2">
              <ToggleGroup<MuscleRegion>
                aria-label="Region"
                variant="chip"
                size="touch"
                value={region ? [region] : []}
                onValueChange={(next) => {
                  setRegion(next[0] ?? null);
                  setMuscle(null);
                }}
              >
                {regions.map((r) => (
                  <ToggleGroupItem key={r} value={r}>
                    {regionDisplayLabel(r)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {region || muscle ? (
                <Button
                  type="button"
                  variant="link"
                  size="touch"
                  className="text-brand-text"
                  onClick={() => {
                    setRegion(null);
                    setMuscle(null);
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </div>
            {region ? (
              <ToggleGroup<Muscle | typeof ALL_MUSCLES>
                aria-label={`Muscle in ${regionDisplayLabel(region)}`}
                variant="chip"
                size="touch"
                value={[muscle ?? ALL_MUSCLES]}
                onValueChange={(next) => {
                  const picked = next[0];
                  setMuscle(
                    picked === undefined || picked === ALL_MUSCLES
                      ? null
                      : picked,
                  );
                }}
              >
                <ToggleGroupItem value={ALL_MUSCLES}>
                  All {regionDisplayLabel(region)}
                </ToggleGroupItem>
                {MUSCLE_GROUPS[region].map((m) => (
                  <ToggleGroupItem key={m} value={m}>
                    {muscleDisplayLabel(m)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Equipment
            </span>
            <ToggleGroup<Equipment>
              aria-label="Equipment"
              variant="chip"
              size="touch"
              value={equipment ? [equipment] : []}
              onValueChange={(next) => setEquipment(next[0] ?? null)}
            >
              {EQUIPMENT.map((eq) => (
                <ToggleGroupItem key={eq} value={eq}>
                  {equipmentDisplayLabel(eq)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
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
                  />
                </div>
                <div>
                  <Label htmlFor="custom-ex-muscle">Primary muscle</Label>
                  <OptionSelect
                    id="custom-ex-muscle"
                    value={customMuscle || null}
                    options={muscleOptions}
                    placeholder="Select…"
                    onValueChange={setCustomMuscle}
                  />
                </div>
                <div>
                  <Label htmlFor="custom-ex-eq">Equipment</Label>
                  <OptionSelect
                    id="custom-ex-eq"
                    value={customEquipment}
                    options={equipmentOptions}
                    onValueChange={setCustomEquipment}
                  />
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
                  />
                </div>
                {customError ? (
                  <p className="text-sm text-destructive">{customError}</p>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="touch"
                    className="flex-1"
                    onClick={() => setCreating(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="touch"
                    className="flex-1"
                    disabled={customPending}
                    onClick={() => void submitCustom()}
                  >
                    {customPending ? "Saving…" : "Save and use"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <TabsContent
            value={tab}
            className="flex flex-col gap-1"
            aria-live="polite"
          >
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
                  size="touch"
                  className="mt-2"
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
