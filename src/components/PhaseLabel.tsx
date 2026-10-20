import type { CycleDTO } from "#/server/cycles.fns";

/** Cycle phase word (CUT / BULK / MAINTAIN): brand text, no box. */
export default function PhaseLabel({ phase }: { phase: CycleDTO["phase"] }) {
  return (
    <span className="text-base font-semibold tracking-wide text-brand-text">
      {phase.toUpperCase()}
    </span>
  );
}
