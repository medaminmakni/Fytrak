import { ToastService } from "../../components/Toast";
import {
    MAX_PROGRAM_WEEKS,
    MAX_SESSIONS_PER_WEEK,
    PROGRAM_LEVELS,
    duplicateWeek,
    generateScaffold,
    scaffoldHasEdits,
    sessionDateLabel,
    validateProgram,
    type ProgramLevel,
    type ProgramValidationIssue,
} from "../../features/programs/programSchedule";
import { SessionExerciseEditor } from "../../features/programs/components/SessionExerciseEditor";
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions } from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { saveProgram, ProgramWeek, ProgramSession } from "../../services/userSession";
import { useRoute, useNavigation } from "@react-navigation/native";
import { auth } from "../../config/firebase";
import { parseDayOffsetInput, parseScheduleDateInput } from "../../features/plans/scheduleInput";
import { Typography } from "../../components/Typography";

const { width } = Dimensions.get("window");

export function CreateProgramScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    // Guarded: the app registers a `fytrak://` deep-link scheme and React
    // Navigation restores persisted state, so this screen can be entered with
    // no params — destructuring directly would throw an uncatchable TypeError.
    const { traineeId = "", traineeName = "", initialDateKey = "" } = route.params ?? {};

    const [title, setTitle] = useState("");
    // Blank = unscheduled program, matching every pre-Phase-D document.
    const [startDate, setStartDate] = useState(initialDateKey);
    const [description, setDescription] = useState("");
    const [level, setLevel] = useState<ProgramLevel>("INTERMEDIATE");
    const [durationWeeks, setDurationWeeks] = useState("4");
    const [sessionsPerWeek, setSessionsPerWeek] = useState("3");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [weeks, setWeeks] = useState<ProgramWeek[]>([]);
    const [outlineReady, setOutlineReady] = useState(false);
    const [validationIssues, setValidationIssues] = useState<ProgramValidationIssue[]>([]);
    /** Which session's exercises are open for editing, if any. */
    const [editing, setEditing] = useState<{ weekId: string; sessionId: string } | null>(null);

    const weeksNum = useMemo(() => parseInt(durationWeeks) || 0, [durationWeeks]);
    const sessionsNum = useMemo(() => parseInt(sessionsPerWeek) || 0, [sessionsPerWeek]);

    /**
     * Builds the scaffold, after asking if that would destroy work.
     *
     * Regenerating used to silently replace every week — a coach who had filled
     * in three sessions and then nudged "sessions per week" lost all of it with
     * no warning. Ids also came from position (`w1-s1`), so duplicating a week
     * produced two sessions sharing an identity, and completion — which matches
     * on session id — would have credited both.
     */
    const buildScaffold = () => {
        const next = generateScaffold(weeksNum, sessionsNum);
        if (next.length === 0) {
            ToastService.error(
                "Check the numbers",
                `Duration must be 1–${MAX_PROGRAM_WEEKS} weeks and sessions per week 1–${MAX_SESSIONS_PER_WEEK}.`,
            );
            return;
        }
        setWeeks(next as unknown as ProgramWeek[]);
        setOutlineReady(true);
        setValidationIssues([]);
    };

    const generateOutline = () => {
        if (outlineReady && scaffoldHasEdits(weeks)) {
            ToastService.confirm({
                title: "Replace the scaffold?",
                message: "Some sessions have exercises or renamed titles. Regenerating discards them.",
                confirmLabel: "Replace",
                destructive: true,
                onConfirm: buildScaffold,
            });
            return;
        }
        buildScaffold();
    };

    const updateWeekTitle = (weekId: string, value: string) => {
        setWeeks((prev) => prev.map((week) => (week.id === weekId ? { ...week, title: value } : week)));
    };

    const updateSessionTitle = (weekId: string, sessionId: string, value: string) => {
        setWeeks((prev) =>
            prev.map((week) => {
                if (week.id !== weekId) return week;
                return {
                    ...week,
                    sessions: week.sessions.map((session) =>
                        session.id === sessionId ? { ...session, title: value } : session
                    ),
                };
            })
        );
    };

    /**
     * Copies a week forward with FRESH ids.
     *
     * The previous version rebuilt ids from position (`w3-s1`), so a duplicated
     * session shared an identity with the one it was copied from — and
     * completion, which matches on session id, could not tell them apart. The
     * shared helper mints new ids and shifts offsets by whole weeks.
     */
    const duplicateWeekById = (weekId: string) => {
        setWeeks((prev) => {
            const source = prev.find((week) => week.id === weekId);
            if (!source) return prev;
            const copy = duplicateWeek(source, prev.length + 1);
            return [...prev, copy as unknown as ProgramWeek];
        });
    };


    const addSessionToWeek = (weekId: string) => {
        setWeeks((prev) =>
            prev.map((week) => {
                if (week.id !== weekId) return week;
                const nextNumber = week.sessions.length + 1;
                const weekStart = (week.weekNumber - 1) * 7;
                const occupiedOffsets = new Set(
                    week.sessions
                        .map((existing) => existing.dayOffset)
                        .filter((offset): offset is number => Number.isInteger(offset))
                );
                const firstFreeOffset = Array.from({ length: 7 }, (_, index) => weekStart + index)
                    .find((offset) => !occupiedOffsets.has(offset));
                const session: ProgramSession = {
                    id: `${week.id}-s${nextNumber}`,
                    sessionNumber: nextNumber,
                    title: `Session ${nextNumber}`,
                    estimatedMinutes: 60,
                    exercises: [],
                    isCompleted: false,
                    dayOffset: firstFreeOffset,
                };
                return { ...week, sessions: [...week.sessions, session] };
            })
        );
    };

    /**
     * Sets a session's explicit day offset from the program start.
     * 0 is the start day. Blank clears it, leaving the session unscheduled.
     */
    const updateSessionDayOffset = (weekId: string, sessionId: string, raw: string) => {
        const parsed = parseDayOffsetInput(raw);
        if (!parsed.ok) return; // reject the keystroke rather than store garbage
        setWeeks((prev) =>
            prev.map((week) => {
                if (week.id !== weekId) return week;
                return {
                    ...week,
                    sessions: week.sessions.map((session) =>
                        session.id === sessionId ? { ...session, dayOffset: parsed.dayOffset } : session
                    ),
                };
            })
        );
    };

    const removeSessionFromWeek = (weekId: string, sessionId: string) => {
        setWeeks((prev) =>
            prev.map((week) => {
                if (week.id !== weekId) return week;
                const nextSessions = week.sessions.filter((session) => session.id !== sessionId);
                return { ...week, sessions: nextSessions };
            })
        );
    };

    const handleAssignProgram = async () => {
        if (!title.trim() || !durationWeeks || !sessionsPerWeek) {
            ToastService.error("Missing Fields", "Please provide a title, duration, and sessions per week.");
            return;
        }

        if (!outlineReady || weeks.length === 0) {
            generateOutline();
            return;
        }

        // Validated before any write. A blank start date is valid and means an
        // unscheduled program, which is how every pre-Phase-D program is stored.
        const schedule = parseScheduleDateInput(startDate);
        if (!schedule.ok) {
            ToastService.error("Check the start date", schedule.message);
            return;
        }

        /*
         * One validator, and it names the exact week, session, exercise and set
         * with each problem. The previous checks covered day offsets only, so a
         * program with an empty session — the normal state of a fresh scaffold —
         * saved happily and reached the client as a workout with nothing in it.
         *
         * Every issue is reported at once: a coach fixing a twelve-week program
         * one save round-trip at a time will stop using the feature.
         */
        const issues = validateProgram({
            title,
            startDateKey: schedule.scheduledDateKey,
            durationWeeks: weeks.length,
            weeks: weeks.map((week) => ({
                weekNumber: week.weekNumber,
                sessions: week.sessions.map((session) => ({
                    title: session.title,
                    sessionNumber: session.sessionNumber,
                    dayOffset: session.dayOffset,
                    estimatedMinutes: session.estimatedMinutes,
                    exercises: session.exercises.map((exercise) => ({
                        name: exercise.name,
                        suggestedSets: exercise.suggestedSets,
                    })),
                })),
            })),
        });

        if (issues.length > 0) {
            const [first, ...rest] = issues;
            ToastService.error(
                first.where,
                rest.length > 0
                    ? `${first.message} (${rest.length} more to fix)`
                    : first.message,
            );
            setValidationIssues(issues);
            return;
        }
        setValidationIssues([]);

        const user = auth.currentUser;
        if (!user) return;

        setIsSubmitting(true);

        try {
            await saveProgram(user.uid, traineeId, {
                title: title.trim(),
                description: description.trim(),
                level,
                durationWeeks: weeks.length,
                weeks: weeks,
                ...(schedule.scheduledDateKey ? { startDateKey: schedule.scheduledDateKey } : {}),
            });
            ToastService.success("Program assigned", schedule.scheduledDateKey
                    ? `Starts ${schedule.scheduledDateKey}. Sessions land on the days you set; a daily prescription still overrides the program for that date.`
                    : "Unscheduled — your client will see this plan on their Home screen under Active Program, but it will not fill specific dates.");
            navigation.goBack();
        } catch (error) {
            console.error(error);
            ToastService.error("Error", "Could not assign program.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ScreenShell
            title="New program"
            subtitle={`MULTI-WEEK PLAN FOR ${traineeName?.toUpperCase()}`}
            contentStyle={styles.shellContent}
        >
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
            >
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                    
                    {/* CORE BLUEPRINT */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="map" size={18} color={colors.primary} />
                            <Typography variant="h2">Core Blueprint</Typography>
                        </View>
                        <View style={styles.inputGroup}>
                            <Typography variant="label" color={colors.textMuted} style={{ fontSize: 11 }}>PROGRAM NAME</Typography>
                            <TextInput
                                style={styles.textInput}
                                placeholder="e.g. 8-Week Hypertrophy Masterclass"
                                placeholderTextColor={colors.textDim}
                                value={title}
                                onChangeText={setTitle}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Typography variant="label" color={colors.textMuted} style={{ fontSize: 11 }}>
                                START DATE (OPTIONAL)
                            </Typography>
                            <TextInput
                                style={styles.textInput}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={colors.textDim}
                                value={startDate}
                                onChangeText={setStartDate}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="numbers-and-punctuation"
                            />
                            <Typography variant="label" color={colors.textDim} style={{ fontSize: 11 }}>
                                {startDate.trim()
                                    ? `Day 1 falls on ${startDate.trim()} in your client's timezone.`
                                    : "Unscheduled — the program still appears on Home, but does not fill specific dates."}
                            </Typography>
                        </View>
                        <View style={styles.inputGroup}>
                            <Typography variant="label" color={colors.textMuted} style={{ fontSize: 11 }}>STRATEGIC OBJECTIVES</Typography>
                            <TextInput
                                style={[styles.textInput, { height: 100, textAlignVertical: 'top' }]}
                                placeholder="Detail the periodization and goals..."
                                placeholderTextColor={colors.textDim}
                                multiline
                                value={description}
                                onChangeText={setDescription}
                            />
                        </View>
                    </View>

                    {/* PARAMETERS */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="options" size={18} color={colors.primary} />
                            <Typography variant="h2">Architecture Parameters</Typography>
                        </View>
                        <View style={styles.row}>
                            <View style={styles.flex1}>
                                <Typography variant="label" color={colors.textMuted} style={{ fontSize: 11, textAlign: 'center' }}>WEEKS</Typography>
                                <TextInput style={styles.miniInput} keyboardType="numeric" value={durationWeeks} onChangeText={setDurationWeeks} />
                            </View>
                            <View style={styles.flex1}>
                                <Typography variant="label" color={colors.textMuted} style={{ fontSize: 11, textAlign: 'center' }}>PER WEEK</Typography>
                                <TextInput style={styles.miniInput} keyboardType="numeric" value={sessionsPerWeek} onChangeText={setSessionsPerWeek} />
                            </View>
                        </View>
                        
                        {/*
                          Full words. `l[0]` rendered "B", "I", "A" — three
                          letters a coach had to decode, and the same glyph a
                          grading scale uses. Level is a label the trainee reads,
                          so it says what it means.
                        */}
                        <View style={styles.levelRow}>
                            {PROGRAM_LEVELS.map(({ value, label }) => (
                                <Pressable
                                    key={value}
                                    style={[styles.levelPill, level === value && styles.levelPillActive]}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: level === value }}
                                    accessibilityLabel={label}
                                    onPress={() => setLevel(value)}
                                >
                                    <Text style={[styles.levelText, level === value && styles.levelTextActive]}>{label}</Text>
                                </Pressable>
                            ))}
                        </View>
                        {/*
                          Says what the field does, and what it does not.
                          Without this a coach reasonably expects picking
                          "Advanced" to change the scaffold — it changes nothing.
                        */}
                        <Typography variant="label" color={colors.textSecondary}>
                            Describes the intended training complexity for your client. It does not
                            change exercises, sets, volume, frequency or progression — you set all of
                            those yourself.
                        </Typography>

                        <Pressable style={styles.generateBtn} onPress={generateOutline}>
                            <Ionicons name="flash" size={16} color="#000" />
                            <Typography style={{ color: "#000", fontWeight: '900', fontSize: 13 }}>GENERATE SCAFFOLD</Typography>
                        </Pressable>
                    </View>

                    {/* SCAFFOLDING */}
                    {outlineReady && (
                        <View style={styles.list}>
                            <Typography variant="label" color={colors.textDim} style={{ marginStart: 4 }}>PROGRAM SCAFFOLDING</Typography>
                            {weeks.map((week) => (
                                <View key={week.id} style={styles.weekCard}>
                                    <View style={styles.weekHeader}>
                                        <TextInput style={styles.weekTitleInput} value={week.title} onChangeText={(v) => updateWeekTitle(week.id, v)} />
                                        <Pressable style={styles.weekAction} onPress={() => duplicateWeekById(week.id)}>
                                            <Ionicons name="copy-outline" size={16} color={colors.primary} />
                                        </Pressable>
                                    </View>
                                    <View style={styles.sessionList}>
                                        {week.sessions.map((session) => (
                                            <View key={session.id} style={styles.sessionRow}>
                                                <TextInput style={styles.sessionInput} value={session.title} onChangeText={(v) => updateSessionTitle(week.id, session.id, v)} />
                                                {/*
                                                  * Calendar placement is explicit. It is deliberately NOT
                                                  * derived from week or session number: a coach who reorders
                                                  * or removes a session would silently move every later one.
                                                  * Blank leaves the session unscheduled.
                                                  */}
                                                <TextInput
                                                    style={styles.sessionDayInput}
                                                    value={session.dayOffset === null || session.dayOffset === undefined ? "" : String(session.dayOffset)}
                                                    onChangeText={(v) => updateSessionDayOffset(week.id, session.id, v)}
                                                    placeholder="Day"
                                                    placeholderTextColor={colors.textDim}
                                                    keyboardType="number-pad"
                                                    accessibilityLabel={`Day offset for ${session.title}`}
                                                />
                                                <Pressable onPress={() => removeSessionFromWeek(week.id, session.id)} disabled={week.sessions.length <= 1}>
                                                    <Ionicons name="close-circle" size={20} color={week.sessions.length <= 1 ? colors.textTertiary : colors.danger} />
                                                </Pressable>
                                            </View>
                                        ))}
                                        {week.sessions.map((session) => {
                                            /*
                                              The actual day, spelled out. `dayOffset` stays the
                                              persisted truth, but a coach should not have to
                                              work out that "day 2" is a Tuesday.
                                            */
                                            const dateLabel = sessionDateLabel(startDate, session.dayOffset);
                                            const exerciseCount = session.exercises.length;
                                            return (
                                                <Pressable
                                                    key={`summary-${session.id}`}
                                                    style={styles.sessionSummary}
                                                    onPress={() => setEditing({ weekId: week.id, sessionId: session.id })}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Edit ${session.title}, ${exerciseCount} exercises`}
                                                >
                                                    <View style={{ flex: 1 }}>
                                                        <Typography variant="bodyStrong" numberOfLines={1}>{session.title}</Typography>
                                                        <Typography variant="label" color={colors.textSecondary}>
                                                            {dateLabel ?? "No date yet"}
                                                            {session.dayOffset !== null && session.dayOffset !== undefined
                                                                ? ` · Day ${session.dayOffset}` : ""}
                                                        </Typography>
                                                        {/*
                                                          An empty session is stated, not hidden. It is the
                                                          normal state of a fresh scaffold and the single
                                                          reason a program cannot be assigned.
                                                        */}
                                                        <Typography
                                                            variant="label"
                                                            color={exerciseCount === 0 ? colors.warning : colors.textTertiary}
                                                        >
                                                            {exerciseCount === 0
                                                                ? "No exercises yet"
                                                                : `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"} · ${session.estimatedMinutes} min`}
                                                        </Typography>
                                                    </View>
                                                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                                                </Pressable>
                                            );
                                        })}
                                        <Pressable style={styles.addSessionBtn} onPress={() => addSessionToWeek(week.id)}>
                                            <Ionicons name="add" size={16} color={colors.primary} />
                                            <Typography variant="label" color={colors.primary}>ADD SESSION</Typography>
                                        </Pressable>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {validationIssues.length > 0 && (
                        <View style={styles.issueBox}>
                            <Typography variant="label" color={colors.warning}>
                                {validationIssues.length} thing{validationIssues.length === 1 ? "" : "s"} to fix
                            </Typography>
                            {validationIssues.slice(0, 6).map((issue, index) => (
                                <Typography key={index} variant="label" color={colors.textSecondary}>
                                    {issue.where}: {issue.message}
                                </Typography>
                            ))}
                            {validationIssues.length > 6 ? (
                                <Typography variant="label" color={colors.textTertiary}>
                                    …and {validationIssues.length - 6} more.
                                </Typography>
                            ) : null}
                        </View>
                    )}

                    {/* FOOTER */}
                    <View style={styles.footer}>
                        <Pressable
                            style={[styles.primaryAction, isSubmitting && { opacity: 0.7 }]}
                            onPress={handleAssignProgram}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? <ActivityIndicator color="#000" /> : (
                                <Typography style={{ color: "#000", fontWeight: '900', fontSize: 14 }}>FINALIZE & ASSIGN</Typography>
                            )}
                        </Pressable>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>

            {/*
              The session editor. Reuses the app's exercise search and set types
              so a program session and a daily prescription describe work the
              same way — and the logger can open either.
            */}
            {editing ? (() => {
                const week = weeks.find((w) => w.id === editing.weekId);
                const session = week?.sessions.find((sess) => sess.id === editing.sessionId);
                if (!session) return null;
                return (
                    <SessionExerciseEditor
                        visible
                        sessionTitle={session.title}
                        dateLabel={sessionDateLabel(startDate, session.dayOffset)}
                        exercises={session.exercises}
                        onChange={(nextExercises) => setWeeks((current) => current.map((w) =>
                            w.id !== editing.weekId ? w : {
                                ...w,
                                sessions: w.sessions.map((sess) =>
                                    sess.id === editing.sessionId ? { ...sess, exercises: nextExercises } : sess),
                            }))}
                        onClose={() => setEditing(null)}
                    />
                );
            })() : null}
        </ScreenShell>
    );
}

const styles = StyleSheet.create({
    shellContent: { paddingBottom: 0 },
    scroll: { paddingBottom: 100, gap: 16, marginTop: 10 },
    
    card: { backgroundColor: colors.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#333", gap: 16 },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },

    inputGroup: { gap: 8 },
    textInput: { backgroundColor: colors.bg, borderRadius: 16, padding: 16, color: '#fff', fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: colors.surfaceInset },

    row: { flexDirection: 'row', gap: 12 },
    flex1: { flex: 1, gap: 4 },
    miniInput: { backgroundColor: colors.bg, borderRadius: 12, paddingVertical: 12, textAlign: 'center', color: colors.primary, fontSize: 18, fontWeight: '900', borderWidth: 1, borderColor: colors.surfaceInset },

    levelRow: { flexDirection: 'row', gap: 8 },
    levelPill: { flex: 1, height: 40, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.surfaceInset, alignItems: 'center', justifyContent: 'center' },
    // Selection state.
    levelPillActive: { backgroundColor: colors.surfaceInset, borderColor: colors.surfaceInset },
    levelText: { color: colors.textMuted, fontSize: 11, fontWeight: '900' },
    levelTextActive: { color: '#000' },

    // An intermediate step, not the commit — 'Assign program' is the accent.
    generateBtn: { backgroundColor: colors.surfaceInset, height: 50, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },

    list: { gap: 12 },
    weekCard: { backgroundColor: colors.surface, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: "#333", gap: 14 },
    weekHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.surfaceInset, paddingBottom: 10 },
    weekTitleInput: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '800' },
    weekAction: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.surfaceInset },

    sessionList: { gap: 8 },
    sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bg, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.surfaceInset },
    sessionInput: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
    sessionDayInput: {
        minWidth: 52,
        minHeight: 44,
        paddingHorizontal: 8,
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
        backgroundColor: colors.bgDark,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    addSessionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.surfaceInset, borderRadius: 12 },

    footer: { marginTop: 8 },
    sessionSummary: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.bg, borderRadius: 12, padding: 12, minHeight: 44,
    },
    issueBox: {
        backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 4,
    },
    primaryAction: { backgroundColor: colors.primary, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
