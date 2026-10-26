import { getViewer } from "#/lib/auth-guard.fns";
import type { UnitSystem } from "#/lib/units";

/** Signed-in viewer preference; anonymous SSR defaults to metric (schema default). */
export async function loadViewerUnitSystem(): Promise<UnitSystem> {
  const viewer = await getViewer();
  return viewer?.unitSystem ?? "metric";
}
