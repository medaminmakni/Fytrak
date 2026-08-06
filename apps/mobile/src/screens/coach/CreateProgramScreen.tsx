import { ToastService } from "../../components/Toast";
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
    const { traineeId = "", traineeName = "" } = route.params ?? {};

    const [title, setTitle] = useState("");
    // Blank = unscheduled program, matching every pre-Phase-D document.
    const [startDate, setStartDate] = useState("");
    const [description, setDescription] = useState("");
    const [level, setLevel] = useState<"BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT">("INTERMEDIATE");
    const [durationWeeks, setDurationWeeks] = useState("4");
    const [sessionsPerWeek, setSessionsPerWeek] = useState("3");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [weeks, setWeeks] = useState<ProgramWeek[]>([]);
    const [outlineReady, setOutlineReady] = useState(false);

    const weeksNum = useMemo(() => parseInt(durationWeeks) || 0, [durationWeeks]);
    const sessionsNum = useMemo(() => parseInt(sessionsPerWeek) || 0, [sessionsPerWeek]);

    const generateOutline = () => {
        if (weeksNum < 1 || weeksNum > 16) {
            ToastService.error("Invalid Input", "Duration must be between 1 and 16 weeks.");
            return;
        }
        if (sessionsNum < 1 || sessionsNum > 7) {
            ToastService.error("Invalid Input", "Sessions per week must be between 1 and 7.");
            return;
        }

        const generatedWeeks: ProgramWeek[] = [];
        for (let w = 1; w <= weeksNum; w++) {
            const sessions: ProgramSession[] = [];
            for (let s = 1; s <= sessionsNum; s++) {
                sessions.push({
                    id: `w${w}-s${s}`,
                    sessionNumber: s,
                    title: `Session ${s}`,
                    estimatedMinutes: 60,
                    exercises: [],
                    isCompleted: false,
                });
            }
            generatedWeeks.push({
                id: `week-${w}`,
                weekNumber: w,
                title: `Week ${w}`,
                sessions,
            });
        }
        setWeeks(generatedWeeks);
        setOutlineReady(true);
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

    const duplicateWeek = (weekId: string) => {
        setWeeks((prev) => {
            const index = prev.findIndex((week) => week.id === weekId);
            if (index === -1) return prev;
            const source = prev[index];
            const nextWeekNumber = prev.length + 1;
            const clonedSessions = source.sessions.map((session, idx) => ({
                ...session,
                id: `w${nextWeekNumber}-s${idx + 1}`,
                sessionNumber: idx + 1,
            }));
            const newWeek: ProgramWeek = {
                ...source,
                id: `week-${nextWeekNumber}`,
                weekNumber: nextWeekNumber,
                title: `Week ${nextWeekNumber}`,
                sessions: clonedSessions,
            };
            return [...prev, newWeek];
        });
    };

    const addSessionToWeek = (weekId: string) => {
        setWeeks((prev) =>
            prev.map((week) => {
                if (week.id !== weekId) return week;
                const nextNumber = week.sessions.length + 1;
                const session: ProgramSession = {
                    id: `${week.id}-s${nextNumber}`,
                    sessionNumber: nextNumber,
                    title: `Session ${nextNumber}`,
                    estimatedMinutes: 60,
                    exercises: [],
                    isCompleted: false,
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
                        
                        <View style={styles.levelRow}>
                            {(["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const).map(l => (
                                <Pressable key={l} style={[styles.levelPill, level === l && styles.levelPillActive]} onPress={() => setLevel(l)}>
                                    <Text style={[styles.levelText, level === l && styles.levelTextActive]}>{l[0]}</Text>
                                </Pressable>
                            ))}
                        </View>

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
                                        <Pressable style={styles.weekAction} onPress={() => duplicateWeek(week.id)}>
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
                                                    <Ionicons name="close-circle" size={20} color={week.sessions.length <= 1 ? "#1c1c1e" : "#f87171"} />
                                                </Pressable>
                                            </View>
                                        ))}
                                        <Pressable style={styles.addSessionBtn} onPress={() => addSessionToWeek(week.id)}>
                                            <Ionicons name="add" size={16} color={colors.primary} />
                                            <Typography variant="label" color={colors.primary}>ADD SESSION</Typography>
                                        </Pressable>
                                    </View>
                                </View>
                            ))}
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
        </ScreenShell>
    );
}

const styles = StyleSheet.create({
    shellContent: { paddingBottom: 0 },
    scroll: { paddingBottom: 100, gap: 16, marginTop: 10 },
    
    card: { backgroundColor: "#161616", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#333", gap: 16 },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },

    inputGroup: { gap: 8 },
    textInput: { backgroundColor: '#0a0a0a', borderRadius: 16, padding: 16, color: '#fff', fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: '#1c1c1e' },

    row: { flexDirection: 'row', gap: 12 },
    flex1: { flex: 1, gap: 4 },
    miniInput: { backgroundColor: '#0a0a0a', borderRadius: 12, paddingVertical: 12, textAlign: 'center', color: colors.primary, fontSize: 18, fontWeight: '900', borderWidth: 1, borderColor: '#1c1c1e' },

    levelRow: { flexDirection: 'row', gap: 8 },
    levelPill: { flex: 1, height: 40, borderRadius: 12, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#1c1c1e', alignItems: 'center', justifyContent: 'center' },
    levelPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    levelText: { color: colors.textMuted, fontSize: 11, fontWeight: '900' },
    levelTextActive: { color: '#000' },

    generateBtn: { backgroundColor: colors.primary, height: 50, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },

    list: { gap: 12 },
    weekCard: { backgroundColor: "#161616", borderRadius: 24, padding: 18, borderWidth: 1, borderColor: "#333", gap: 14 },
    weekHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#1c1c1e', paddingBottom: 10 },
    weekTitleInput: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '800' },
    weekAction: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1c1c1e' },

    sessionList: { gap: 8 },
    sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0a0a0a', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#1c1c1e' },
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
    addSessionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6, borderStyle: 'dashed', borderWidth: 1, borderColor: '#2c2c2e', borderRadius: 12 },

    footer: { marginTop: 8 },
    primaryAction: { backgroundColor: colors.primary, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
