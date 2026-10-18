/**
 * Day-14 target prompt — pure trigger logic and state machine (G3.1).
 *
 * The kcal prefill heuristic (kcal-start.ts, 32/33/31 kcal per kg) exists to
 * be corrected: once the estimator is ready and the measured burn disagrees
 * with the daily target by more than 150 kcal, the user is offered to follow
 * the measurement. Never nags: a dismissal holds 28 days, an apply holds
 * until the estimate itself moves by more than 10%, and only one prompt
 * exists at a time.
 */

export type TargetPromptState = {
	lastAppliedAt: Date | null;
	lastDismissedAt: Date | null;
	/** Measured kcal at the last Apply; powers the >10% re-prompt rule. */
	appliedKcal: number | null;
};

export const PROMPT_DIFF_KCAL = 150;
export const REPROMPT_MOVE_FRACTION = 0.1;
export const REPROMPT_AFTER_DISMISS_DAYS = 28;

const DAY_MS = 86_400_000;

/** True when the measured estimate moved >10% from the last applied value. */
export function estimateMovedSinceApply(measuredKcal: number, state: TargetPromptState): boolean {
	if (state.appliedKcal == null || !Number.isFinite(state.appliedKcal)) return false;
	return Math.abs(measuredKcal - state.appliedKcal) > REPROMPT_MOVE_FRACTION * state.appliedKcal;
}

/**
 * Eligible exactly when: the estimate is ready, a daily target exists, the
 * measured burn disagrees with it by more than 150 kcal, and no answer
 * (apply or dismissal) still holds.
 */
export function targetPromptEligible(input: {
	measuredKcal: number | null;
	targetKcalPerDay: number | null;
	state: TargetPromptState;
	now: Date;
}): boolean {
	const { measuredKcal, targetKcalPerDay, state, now } = input;
	if (measuredKcal == null || !Number.isFinite(measuredKcal)) return false;
	if (targetKcalPerDay == null || !Number.isFinite(targetKcalPerDay)) return false;
	if (Math.abs(measuredKcal - targetKcalPerDay) <= PROMPT_DIFF_KCAL) return false;

	const dismissed = state.lastDismissedAt;
	const appliedAt = state.lastAppliedAt;
	const dismissedAfterApply = dismissed != null && (appliedAt == null || dismissed > appliedAt);

	if (dismissedAfterApply && dismissed != null) {
		// Dismissal holds 28 days, unless the estimate itself has moved since.
		const daysSinceDismiss = (now.getTime() - dismissed.getTime()) / DAY_MS;
		return (
			daysSinceDismiss >= REPROMPT_AFTER_DISMISS_DAYS || estimateMovedSinceApply(measuredKcal, state)
		);
	}
	if (appliedAt != null) {
		// Answered by applying: only a moved estimate reopens the question.
		return estimateMovedSinceApply(measuredKcal, state);
	}
	return true;
}
