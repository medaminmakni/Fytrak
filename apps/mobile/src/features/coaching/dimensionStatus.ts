import type { DataStatus } from "../../hooks/useTraineeDetailData";

/**
 * The honest status of a section that needs MORE THAN ONE dimension.
 *
 * Some cards on the client-day report are assembled from two reads. The
 * nutrition card is the clear case: the bars come from `meals`, but whether to
 * draw targets at all comes from the trainee's `profile`. Gating it on `meals`
 * alone meant that while the profile was still in flight, `hasTargets` was
 * false and the card stated "no plan set" — a claim about the client's coaching
 * setup, made before the document that answers it had arrived. If the profile
 * read then FAILED, that sentence simply stayed on screen as fact.
 *
 * Precedence is error, then loading, then loaded:
 *
 * - `error` wins because a section built partly from a failed read cannot be
 *   trusted, no matter how healthy its other half is.
 * - `loading` beats `loaded` because a section is only finished when all of its
 *   inputs are.
 *
 * Empty is deliberately NOT handled here. "Loaded but absent" is a question
 * about content, and each caller knows what absence means for it — no meals is
 * `meals.length === 0`, no plan is `sourceType === "none"`. Folding those into
 * one boolean is what produced "no plan set" for a failed read in the first
 * place.
 */
export const combineDimensionStatus = (statuses: DataStatus[]): DataStatus => {
  // No inputs cannot be "loaded" — there is nothing that has loaded.
  if (statuses.length === 0) return "loading";
  if (statuses.some((status) => status === "error")) return "error";
  if (statuses.some((status) => status === "loading")) return "loading";
  return "loaded";
};
