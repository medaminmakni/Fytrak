import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Typography } from "../../../components/Typography";
import { colors } from "../../../theme/colors";
import { iconSize, radius, spacing, touchTarget, typography } from "../../../theme/tokens";
import { ExerciseSearchModal } from "../../workouts/components/ExerciseSearchModal";
import { useExerciseSearch } from "../../../hooks/useExerciseSearch";
import { t as tEx, type ExerciseLibraryItem } from "../../../constants/exercises";
import type { ProgramSessionExercise, ProgramSuggestedSet } from "../../../services/programService";
import type { WorkoutSetType } from "../../../types/domain";
import { validateSuggestedSet } from "../programSchedule";

type Props = {
  visible: boolean;
  sessionTitle: string;
  /** "Tuesday, 18 August" — the day this session actually lands on. */
  dateLabel: string | null;
  exercises: ProgramSessionExercise[];
  onChange: (exercises: ProgramSessionExercise[]) => void;
  onClose: () => void;
};

const SET_TYPES: { value: WorkoutSetType; label: string }[] = [
  { value: "WEIGHT_REPS", label: "Weight × reps" },
  { value: "BODYWEIGHT", label: "Bodyweight" },
  { value: "REPS_ONLY", label: "Reps only" },
  { value: "TIME", label: "Time" },
];

const newSet = (type: WorkoutSetType): ProgramSuggestedSet => ({ type });

/**
 * Where a coach actually writes the session.
 *
 * The scaffold generated `exercises: []` and offered no way to fill it, so a
 * "program" was a calendar of empty sessions — a client opening one got a
 * workout with nothing in it. This is the missing half.
 *
 * It reuses the app's exercise library search and its set types rather than
 * introducing a second exercise model, so a program session and a daily
 * prescription describe work the same way and the logger can open either.
 *
 * NOTHING HERE IS GENERATED. No default sets, reps, loads or exercises are
 * suggested from the program's level or from anything else — the coach decides
 * and the app records. An empty field stays empty and blocks assignment with a
 * message naming it, which is the honest alternative to filling it in for them.
 */
export function SessionExerciseEditor({
  visible, sessionTitle, dateLabel, exercises, onChange, onClose,
}: Props) {
  const [searchFor, setSearchFor] = useState<number | null>(null);
  const { query, setQuery, filteredExercises, isSearching } = useExerciseSearch();

  const patch = (index: number, next: Partial<ProgramSessionExercise>) => {
    onChange(exercises.map((exercise, i) => (i === index ? { ...exercise, ...next } : exercise)));
  };

  const patchSet = (exIdx: number, setIdx: number, next: Partial<ProgramSuggestedSet>) => {
    patch(exIdx, {
      suggestedSets: exercises[exIdx].suggestedSets.map((set, i) =>
        i === setIdx ? { ...set, ...next } : set),
    });
  };

  const numeric = (raw: string): number | undefined => {
    const trimmed = raw.trim();
    if (trimmed === "") return undefined;
    const value = Number(trimmed);
    // Never store NaN or a negative prescription.
    return Number.isFinite(value) && value > 0 ? value : undefined;
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= exercises.length) return;
    const next = [...exercises];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Done" style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={iconSize.lg} color={colors.text} />
          </Pressable>
          <View style={styles.grow}>
            <Typography variant="h2" numberOfLines={1}>{sessionTitle}</Typography>
            {/*
              The date, not the offset. A coach should not have to work out what
              "day 2" means; the integer stays the persisted truth underneath.
            */}
            <Typography variant="label" color={colors.textSecondary}>
              {dateLabel ?? "No date — set the program start date"}
            </Typography>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {exercises.length === 0 ? (
            <Typography variant="label" color={colors.textTertiary}>
              No exercises yet. A session must have at least one before the program can be assigned.
            </Typography>
          ) : null}

          {exercises.map((exercise, exIdx) => (
            <View key={`${exercise.id ?? exercise.name}-${exIdx}`} style={styles.card}>
              <View style={styles.cardHeader}>
                <Pressable
                  style={styles.grow}
                  onPress={() => { setSearchFor(exIdx); setQuery(""); }}
                  accessibilityRole="button"
                  accessibilityLabel={exercise.name ? `Change ${exercise.name}` : "Choose an exercise"}
                >
                  <Typography variant="bodyStrong" color={exercise.name ? colors.text : colors.textTertiary}>
                    {exercise.name || "Choose an exercise…"}
                  </Typography>
                </Pressable>
                <Pressable onPress={() => move(exIdx, -1)} disabled={exIdx === 0} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Move up">
                  <Ionicons name="chevron-up" size={iconSize.md} color={exIdx === 0 ? colors.textTertiary : colors.text} />
                </Pressable>
                <Pressable onPress={() => move(exIdx, 1)} disabled={exIdx === exercises.length - 1} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Move down">
                  <Ionicons name="chevron-down" size={iconSize.md} color={exIdx === exercises.length - 1 ? colors.textTertiary : colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => onChange(exercises.filter((_, i) => i !== exIdx))}
                  style={styles.iconBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${exercise.name || "exercise"}`}
                >
                  <Ionicons name="trash-outline" size={iconSize.md} color={colors.danger} />
                </Pressable>
              </View>

              <TextInput
                style={styles.input}
                value={exercise.instructions ?? ""}
                onChangeText={(v) => patch(exIdx, { instructions: v })}
                placeholder="Instructions for this exercise (optional)"
                placeholderTextColor={colors.textTertiary}
                multiline
                accessibilityLabel="Exercise instructions"
              />
              <TextInput
                style={styles.input}
                value={exercise.restTimeSec ? String(exercise.restTimeSec) : ""}
                onChangeText={(v) => patch(exIdx, { restTimeSec: numeric(v) })}
                placeholder="Rest between sets, in seconds"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                accessibilityLabel="Rest time in seconds"
              />

              <View style={styles.typeRow}>
                {SET_TYPES.map(({ value, label }) => {
                  const active = (exercise.suggestedSets[0]?.type ?? "WEIGHT_REPS") === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => patch(exIdx, {
                        // One type per exercise, matching the logger.
                        suggestedSets: exercise.suggestedSets.map((set) => ({ ...set, type: value })),
                      })}
                      style={[styles.typePill, active && styles.typePillActive]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      accessibilityLabel={label}
                    >
                      <Typography variant="label" color={active ? colors.primaryText : colors.textSecondary}>
                        {label}
                      </Typography>
                    </Pressable>
                  );
                })}
              </View>

              {exercise.suggestedSets.map((set, setIdx) => {
                const problem = validateSuggestedSet(set);
                return (
                  <View key={setIdx} style={styles.setRow}>
                    <Typography variant="label" color={colors.textSecondary} style={styles.setNumber}>
                      {setIdx + 1}
                    </Typography>
                    {set.type === "TIME" ? (
                      <TextInput
                        style={styles.setInput}
                        value={set.targetDurationSec ? String(set.targetDurationSec) : ""}
                        onChangeText={(v) => patchSet(exIdx, setIdx, { targetDurationSec: numeric(v) })}
                        placeholder="secs"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                        accessibilityLabel={`Set ${setIdx + 1} target duration`}
                      />
                    ) : (
                      <>
                        {set.type === "WEIGHT_REPS" ? (
                          <TextInput
                            style={styles.setInput}
                            value={set.targetWeight ? String(set.targetWeight) : ""}
                            onChangeText={(v) => patchSet(exIdx, setIdx, { targetWeight: numeric(v) })}
                            placeholder="kg"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="decimal-pad"
                            accessibilityLabel={`Set ${setIdx + 1} target weight`}
                          />
                        ) : null}
                        <TextInput
                          style={styles.setInput}
                          value={set.targetReps ? String(set.targetReps) : ""}
                          onChangeText={(v) => patchSet(exIdx, setIdx, { targetReps: numeric(v) })}
                          placeholder="reps"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="number-pad"
                          accessibilityLabel={`Set ${setIdx + 1} target reps`}
                        />
                      </>
                    )}
                    {/* The same rule the save path enforces, shown while typing. */}
                    {problem ? (
                      <Ionicons name="alert-circle-outline" size={iconSize.sm} color={colors.warning} />
                    ) : null}
                    <Pressable
                      onPress={() => patch(exIdx, {
                        suggestedSets: exercise.suggestedSets.filter((_, i) => i !== setIdx),
                      })}
                      style={styles.iconBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove set ${setIdx + 1}`}
                    >
                      <Ionicons name="close" size={iconSize.sm} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                );
              })}

              <Pressable
                onPress={() => patch(exIdx, {
                  suggestedSets: [
                    ...exercise.suggestedSets,
                    newSet(exercise.suggestedSets[exercise.suggestedSets.length - 1]?.type ?? "WEIGHT_REPS"),
                  ],
                })}
                style={styles.ghostBtn}
                accessibilityRole="button"
                accessibilityLabel="Add a set"
              >
                <Ionicons name="add" size={iconSize.sm} color={colors.primary} />
                <Typography variant="label" color={colors.primary}>Add set</Typography>
              </Pressable>
            </View>
          ))}

          <Pressable
            onPress={() => {
              onChange([...exercises, { name: "", suggestedSets: [newSet("WEIGHT_REPS")] }]);
              setSearchFor(exercises.length);
              setQuery("");
            }}
            style={styles.addExercise}
            accessibilityRole="button"
            accessibilityLabel="Add an exercise"
          >
            <Ionicons name="add" size={iconSize.md} color={colors.primary} />
            <Typography variant="button" color={colors.primary}>Add exercise</Typography>
          </Pressable>
        </ScrollView>
      </View>

      <ExerciseSearchModal
        visible={searchFor !== null}
        query={query}
        onQueryChange={setQuery}
        isSearching={isSearching}
        results={filteredExercises}
        onClose={() => setSearchFor(null)}
        onOpenDetails={() => {}}
        onSelectExercise={(exercise: ExerciseLibraryItem) => {
          // `tEx` resolves the library's localized name to a plain string, the
          // same way the logger does — so a program exercise and a logged one
          // carry identical names and the coach's review can match them.
          if (searchFor !== null) patch(searchFor, { name: tEx(exercise.name) });
          setSearchFor(null);
        }}
        onAddCustom={(name: string) => {
          if (searchFor !== null) patch(searchFor, { name: name.trim() });
          setSearchFor(null);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.lg, paddingTop: spacing["4xl"],
  },
  headerBtn: { minWidth: touchTarget.min, minHeight: touchTarget.min, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["4xl"] },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.lg, gap: spacing.sm },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  iconBtn: { minWidth: touchTarget.min, minHeight: touchTarget.min, alignItems: "center", justifyContent: "center" },
  input: {
    backgroundColor: colors.surfaceInset, borderRadius: radius.nested,
    minHeight: touchTarget.min, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.text, ...typography.body,
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  typePill: {
    paddingHorizontal: spacing.md, minHeight: 36, justifyContent: "center",
    borderRadius: radius.pill, backgroundColor: colors.surfaceInset,
  },
  typePillActive: { backgroundColor: colors.primary },
  setRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  setNumber: { width: 20, textAlign: "center" },
  setInput: {
    flex: 1, backgroundColor: colors.surfaceInset, borderRadius: radius.nested,
    height: 44, textAlign: "center", color: colors.text, ...typography.bodyStrong,
  },
  ghostBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: touchTarget.min },
  addExercise: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    minHeight: touchTarget.large, borderRadius: radius.card, backgroundColor: colors.surface,
  },
});
