type AnalyticsEventMap = {
  workout_completed: {
    setsCompleted: number;
    totalVolume: number;
    durationMinutes: number;
    personalRecords: number;
    /** `program_session` was added when program sessions became traceable. */
    source: "manual" | "coach_prescribed" | "program_session";
  };
  active_workout_resumed: {
    exerciseCount: number;
    ageMinutes: number;
  };
  today_mission_action_pressed: {
    missionId: "workout" | "nutrition" | "coach" | "bodyMetric";
    completionPercent: number;
  };
  /*
   * `coach_risk_card_opened` was removed here. It carried `risk:
   * "high"|"medium"|"low"` and `complianceScore` — the two values the coach
   * dashboard stopped deriving in Phase 2 and whose engine was deleted in
   * Phase 5. It had no emitters; the type was the last reference in the app to
   * a number that graded clients on meals photographed.
   */
};

export type AnalyticsEventName = keyof AnalyticsEventMap;

const sanitizePayload = <T extends AnalyticsEventName>(payload: AnalyticsEventMap[T]) => {
  return JSON.parse(JSON.stringify(payload)) as AnalyticsEventMap[T];
};

export function trackEvent<T extends AnalyticsEventName>(
  eventName: T,
  payload: AnalyticsEventMap[T]
): void {
  const safePayload = sanitizePayload(payload);

  if (__DEV__) {
    console.log(`[Analytics] ${eventName}`, safePayload);
  }

  // Production adapter goes here: Firebase Analytics, Segment, Amplitude, etc.
}
