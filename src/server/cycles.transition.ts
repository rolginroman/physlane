/** When saving a cycle without an explicit endDate, any open cycle must close first (I2). */
export type ActiveCycleEndPlan = {
  shouldEndOpenCycles: boolean;
  /** endDate written onto currently-open cycles */
  endOpenCyclesAt: Date;
};

export function planActiveCycleEndOnSave(
  input: { endDate?: string | null },
  now: Date,
): ActiveCycleEndPlan {
  return {
    shouldEndOpenCycles: !input.endDate,
    endOpenCyclesAt: now,
  };
}
