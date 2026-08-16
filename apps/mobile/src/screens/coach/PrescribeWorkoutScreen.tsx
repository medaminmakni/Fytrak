import { ToastService } from "../../components/Toast";
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TextInput,
    Pressable,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform
} from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { ExerciseDetailSheet } from "../../components/ExerciseDetailSheet";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import type { WorkoutSetType } from "../../services/userSession";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useWorkoutPrescriptionBuilder } from "../../hooks/useWorkoutPrescriptionBuilder";
import { TemplateLibraryModal } from "../../components/coach/TemplateLibraryModal";
import { ExerciseSearchModal } from "../../features/workouts/components/ExerciseSearchModal";
import { Typography } from "../../components/Typography";

export function PrescribeWorkoutScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { traineeId = "", traineeName = "", initialDateKey = "" } = route.params ?? {};
    /*
     * Present only when the coach came through Adjust plan. Undefined is the
     * ordinary prescribing flow, which is unchanged in every respect.
     */
    const revision = route.params?.revision ?? null;

    const {
        title,
        setTitle,
        scheduledDate,
        setScheduledDate,
        isAdjustment,
        exercises,
        templates,
        libModalVisible,
        setLibModalVisible,
        saveAsTemplate,
        setSaveAsTemplate,
        isSubmitting,
        libSearchQuery,
        setLibSearchQuery,
        filteredTemplates,
        exerciseModalVisible,
        setExerciseModalVisible,
        exerciseSearchQuery,
        setExerciseSearchQuery,
        activeExerciseIndex,
        setActiveExerciseIndex,
        selectedExerciseInfo,
        setSelectedExerciseInfo,
        isSearching,
        filteredExercises,
        applyTemplate,
        findExerciseInfo,
        applyExerciseSelection,
        addCustomExercise,
        addExercise,
        updateExercise,
        removeExercise,
        handleSave
    } = useWorkoutPrescriptionBuilder(traineeId, navigation, revision, initialDateKey);

    return (
        <ScreenShell
            title="Prescribe a workout"
            subtitle={`NEW ROUTINE FOR ${traineeName?.toUpperCase()}`}
            contentStyle={styles.shellContent}
        >
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
            >
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                    
                    {/* LIBRARY SHORTCUT */}
                    <Pressable
                        style={styles.card}
                        onPress={() => templates.length > 0 ? setLibModalVisible(true) : ToastService.error("Library Empty", "Save a template first.")}
                    >
                        <View style={styles.cardHeader}>
                            <Ionicons name="library" size={18} color={colors.primary} />
                            <Typography variant="h2">Load from Library</Typography>
                        </View>
                        <View style={styles.libContent}>
                            <Typography variant="bodySmall" color={colors.textMuted}>{templates.length} saved routines available in your coach cloud.</Typography>
                            <Ionicons name="chevron-forward" size={16} color={colors.iconFaint} />
                        </View>
                    </Pressable>

                    {/* ROUTINE CONFIG */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="create" size={18} color={colors.primary} />
                            <Typography variant="h2">Workout Details</Typography>
                        </View>
                        <View style={styles.inputGroup}>
                            <Typography variant="label" color={colors.textMuted} style={{ fontSize: 11 }}>ROUTINE TITLE</Typography>
                            <TextInput
                                placeholder="e.g. Upper Body Power"
                                placeholderTextColor={colors.textDim}
                                style={styles.textInput}
                                value={title}
                                onChangeText={setTitle}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Typography variant="label" color={colors.textMuted} style={{ fontSize: 11 }}>
                                {isAdjustment ? "REPLACING THE PLAN FOR" : "SCHEDULE FOR (OPTIONAL)"}
                            </Typography>
                            {/*
                              Locked on an adjustment. The revision record and
                              this prescription must name the same day; an
                              editable field is exactly how the two diverge, and
                              nothing downstream could detect it afterwards.
                            */}
                            <TextInput
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={colors.textDim}
                                style={[styles.textInput, isAdjustment && { opacity: 0.7 }]}
                                value={scheduledDate}
                                onChangeText={setScheduledDate}
                                editable={!isAdjustment}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="numbers-and-punctuation"
                            />
                            <Typography variant="label" color={colors.textDim} style={{ fontSize: 11 }}>
                                {isAdjustment
                                    ? `Scheduled for ${scheduledDate} — this one day only. Later days are unchanged.`
                                    : scheduledDate.trim()
                                        ? `Scheduled for ${scheduledDate.trim()} — this takes priority over the program that day.`
                                        : "Unscheduled — shown in your client's plan list, not tied to a day."}
                            </Typography>
                            {isAdjustment && revision?.reason ? (
                                <Typography variant="label" color={colors.textDim} style={{ fontSize: 11 }}>
                                    Reason on the record: {revision.reason}
                                </Typography>
                            ) : null}
                        </View>
                    </View>

                    {/* EXERCISE BUILDER */}
                    <View style={styles.builderCard}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="list" size={18} color={colors.primary} />
                            <Typography variant="h2">Exercise Sequence</Typography>
                        </View>

                        {exercises.map((ex, idx) => (
                            <View key={idx} style={styles.exerciseItem}>
                                <View style={styles.exTop}>
                                    <View style={styles.exIndexBox}><Text style={styles.exIndexText}>{idx + 1}</Text></View>
                                    <Pressable
                                        style={styles.exSelector}
                                        onPress={() => {
                                            setActiveExerciseIndex(idx);
                                            setExerciseSearchQuery("");
                                            setExerciseModalVisible(true);
                                        }}
                                    >
                                <Typography variant="h2" style={{ fontSize: 15 }} numberOfLines={1}>
                                            {ex.name || "Select exercise..."}
                                        </Typography>
                                    </Pressable>
                                    <View style={styles.exActions}>
                                        <Pressable
                                            style={styles.exActionIcon}
                                            onPress={() => {
                                                const info = findExerciseInfo(ex.name);
                                                if (info) setSelectedExerciseInfo(info);
                                            }}
                                            disabled={!ex.name}
                                        >
                                            <Ionicons name="information-circle-outline" size={20} color={ex.name ? colors.primary : "#222"} />
                                        </Pressable>
                                        <Pressable style={styles.exActionIcon} onPress={() => removeExercise(idx)}>
                                            <Ionicons name="trash-outline" size={20} color={colors.danger} />
                                        </Pressable>
                                    </View>
                                </View>

                                <View style={styles.exParams}>
                                    <View style={styles.paramBox}>
                                        <Typography variant="label" color={colors.textDim} style={styles.paramLabel}>SETS</Typography>
                                        <TextInput
                                            keyboardType="numeric"
                                            style={styles.paramInput}
                                            value={ex.targetSets.toString()}
                                            onChangeText={(v) => updateExercise(idx, "targetSets", parseInt(v) || 0)}
                                        />
                                    </View>
                                    <View style={styles.paramBox}>
                                        <Typography variant="label" color={colors.textDim} style={styles.paramLabel}>{ex.type === "TIME" ? "SEC" : "REPS"}</Typography>
                                        <TextInput
                                            style={styles.paramInput}
                                            value={ex.targetReps}
                                            placeholder={ex.type === "TIME" ? "60" : "12"}
                                            placeholderTextColor="#333"
                                            onChangeText={(v) => updateExercise(idx, "targetReps", v)}
                                        />
                                    </View>
                                    <View style={styles.paramBox}>
                                        <Typography variant="label" color={colors.textDim} style={styles.paramLabel}>REST</Typography>
                                        <TextInput
                                            style={styles.paramInput}
                                            value={ex.restTime}
                                            placeholder="90s"
                                            placeholderTextColor="#333"
                                            onChangeText={(v) => updateExercise(idx, "restTime", v)}
                                        />
                                    </View>
                                </View>
                            </View>
                        ))}

                        <Pressable style={styles.addBtn} onPress={addExercise}>
                            <Ionicons name="add" size={20} color={colors.primary} />
                            <Typography variant="label" color={colors.primary}>ADD EXERCISE</Typography>
                        </Pressable>
                    </View>

                    {/* Template saving is a separate write. Keep adjustment
                        commit semantics limited to the atomic prescription +
                        revision pair so a template failure cannot invite a
                        duplicate adjustment retry. */}
                    {!isAdjustment ? (
                        <Pressable
                            style={[styles.card, saveAsTemplate && { borderColor: colors.primary }]}
                            onPress={() => setSaveAsTemplate(!saveAsTemplate)}
                        >
                            <View style={styles.templateRow}>
                                <Ionicons name={saveAsTemplate ? "checkbox" : "square-outline"} size={22} color={saveAsTemplate ? colors.primary : colors.iconFaint} />
                                <View style={{ flex: 1 }}>
                                    <Typography variant="h2" style={{ fontSize: 15 }}>Save to Library</Typography>
                                    <Typography variant="label" color={colors.textMuted}>Sync this routine to your coach templates.</Typography>
                                </View>
                            </View>
                        </Pressable>
                    ) : null}

                    {/* FOOTER */}
                    <View style={styles.footer}>
                        <Pressable
                            style={[styles.primaryAction, isSubmitting && { opacity: 0.7 }]}
                            onPress={handleSave}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? <ActivityIndicator color="#000" /> : (
                                <>
                                    <Typography style={{ color: "#000", fontWeight: '900', fontSize: 14 }}>
                                        {isAdjustment ? "SAVE ADJUSTMENT" : "ASSIGN TO TRAINEE"}
                                    </Typography>
                                    <Ionicons name="send" size={16} color="#000" />
                                </>
                            )}
                        </Pressable>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>

            {/* MODALS */}
            <TemplateLibraryModal
                visible={libModalVisible}
                onClose={() => setLibModalVisible(false)}
                searchQuery={libSearchQuery}
                onSearchChange={setLibSearchQuery}
                filteredTemplates={filteredTemplates}
                onApplyTemplate={applyTemplate}
            />

            <ExerciseSearchModal
                visible={exerciseModalVisible}
                query={exerciseSearchQuery}
                onQueryChange={setExerciseSearchQuery}
                isSearching={isSearching}
                results={filteredExercises}
                onClose={() => setExerciseModalVisible(false)}
                onOpenDetails={(exercise) => setSelectedExerciseInfo(exercise)}
                onSelectExercise={(exercise) => {
                    applyExerciseSelection(exercise);
                    setExerciseModalVisible(false);
                    setExerciseSearchQuery("");
                }}
                onAddCustom={(name) => {
                    addCustomExercise(name);
                    setExerciseModalVisible(false);
                    setExerciseSearchQuery("");
                }}
            />

            <ExerciseDetailSheet
                exercise={selectedExerciseInfo}
                isVisible={!!selectedExerciseInfo}
                onClose={() => setSelectedExerciseInfo(null)}
                primaryActionLabel="Add to workout"
                onPrimaryAction={(exercise) => {
                    applyExerciseSelection(exercise);
                    setSelectedExerciseInfo(null);
                    setExerciseModalVisible(false);
                    setExerciseSearchQuery("");
                }}
            />

        </ScreenShell>
    );
}

const styles = StyleSheet.create({
    shellContent: { paddingBottom: 0 },
    scroll: { paddingBottom: 100, gap: 16, marginTop: 10 },
    
    card: { backgroundColor: colors.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#333", gap: 16 },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    libContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 },

    inputGroup: { gap: 8 },
    textInput: { backgroundColor: colors.bg, borderRadius: 16, padding: 16, color: '#fff', fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: colors.surfaceInset },

    builderCard: { backgroundColor: colors.surface, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: "#333", gap: 16 },
    exerciseItem: { backgroundColor: colors.bg, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.surfaceInset, gap: 16 },
    exTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    exIndexBox: { width: 24, height: 24, borderRadius: 6, backgroundColor: colors.surfaceInset, alignItems: 'center', justifyContent: 'center' },
    exIndexText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
    exSelector: { flex: 1 },
    exActions: { flexDirection: 'row', gap: 8 },
    exActionIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.surfaceInset },

    exParams: { flexDirection: 'row', gap: 10 },
    paramBox: { flex: 1, gap: 4 },
    paramLabel: { textAlign: 'center', fontSize: 11, fontWeight: '900' },
    paramInput: { backgroundColor: colors.surface, borderRadius: 10, paddingVertical: 10, textAlign: 'center', color: colors.primary, fontSize: 16, fontWeight: '900', borderWidth: 1, borderColor: colors.surfaceInset },

    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.surfaceInset, borderRadius: 16 },

    templateRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },

    footer: { marginTop: 8 },
    primaryAction: { backgroundColor: colors.primary, height: 60, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
});
