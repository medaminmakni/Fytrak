import { ToastService } from "../../components/Toast";
import { useEffect, useState } from "react";
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TextInput,
    Pressable,
    ActivityIndicator
} from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { saveCoachTemplate, updateCoachTemplate } from "../../services/userSession";
import { auth } from "../../config/firebase";
import { useNavigation, useRoute } from "@react-navigation/native";

export function CreateTemplateScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation();
    const { type = "workout", template } = route.params ?? {}; // template is present if editing

    const [title, setTitle] = useState(template?.title || "");
    const [exercises, setExercises] = useState(template?.data?.exercises || [
        { name: "", targetSets: 4, targetReps: "10-12", restTime: "60s" }
    ]);
    const [mealData, setMealData] = useState(template?.type === "meal" ? template.data : { description: "", macros: { calories: 0, protein: 0, carbs: 0, fats: 0 } });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const addExercise = () => {
        setExercises([...exercises, { name: "", targetSets: 4, targetReps: "10-12", restTime: "60s" }]);
    };

    const updateExercise = (index: number, field: string, value: any) => {
        const newEx = [...exercises];
        newEx[index] = { ...newEx[index], [field]: value };
        setExercises(newEx);
    };

    const handleSave = async () => {
        if (!title.trim()) {
            ToastService.error("Missing Title", "Please give this template a name.");
            return;
        }

        try {
            setIsSubmitting(true);
            const user = auth.currentUser;
            if (!user) throw new Error("No coach session");

            const templateData = type === "workout" ? { exercises } : mealData;

            if (template?.id) {
                await updateCoachTemplate(user.uid, template.id, {
                    title: title.trim(),
                    data: templateData
                });
                ToastService.success("Template updated", "Your library is up to date.");
                    navigation.goBack();
            } else {
                await saveCoachTemplate(user.uid, {
                    title: title.trim(),
                    type,
                    data: templateData
                });
                ToastService.success("Template saved", "You can reuse it from your library.");
                    navigation.goBack();
            }
        } catch (error) {
            console.error(error);
            ToastService.error("Error", "Failed to save template.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ScreenShell
            title={template ? `Edit Template` : `New ${type === "workout" ? "Workout" : "Meal"} Template`}
            subtitle={template ? "Modify your existing program" : "Create a reusable program for your roster"}
            contentStyle={styles.shellContent}
        >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                <View style={styles.card}>
                    <Text style={styles.label}>Template Title</Text>
                    <TextInput
                        style={styles.titleInput}
                        placeholder={`e.g. ${type === "workout" ? "Leg Day Power" : "Post-Workout Fuel"}`}
                        placeholderTextColor={colors.textDim}
                        value={title}
                        onChangeText={setTitle}
                    />
                </View>

                {type === "workout" ? (
                    <>
                        {exercises.map((ex: any, idx: number) => (
                            <View key={idx} style={styles.exerciseCard}>
                                <View style={styles.exHeader}>
                                    <Text style={styles.exNumber}>EXERCISE #{idx + 1}</Text>
                                    <Pressable
                                        onPress={() => setExercises(exercises.filter((_: any, i: number) => i !== idx))}
                                        disabled={exercises.length === 1}
                                    >
                                        <Ionicons name="trash-outline" size={18} color={exercises.length === 1 ? colors.surfaceInset : colors.danger} />
                                    </Pressable>
                                </View>

                                <TextInput
                                    style={styles.exNameInput}
                                    placeholder="Exercise Name"
                                    placeholderTextColor={colors.textMuted}
                                    value={ex.name}
                                    onChangeText={(v) => updateExercise(idx, "name", v)}
                                />

                                <View style={styles.paramGrid}>
                                    <View style={styles.paramItem}>
                                        <Text style={styles.paramLabel}>SETS</Text>
                                        <TextInput
                                            style={styles.paramInput}
                                            keyboardType="numeric"
                                            value={ex.targetSets.toString()}
                                            onChangeText={(v) => updateExercise(idx, "targetSets", parseInt(v) || 0)}
                                        />
                                    </View>
                                    <View style={styles.paramItem}>
                                        <Text style={styles.paramLabel}>REPS</Text>
                                        <TextInput
                                            style={styles.paramInput}
                                            value={ex.targetReps}
                                            onChangeText={(v) => updateExercise(idx, "targetReps", v)}
                                        />
                                    </View>
                                    <View style={styles.paramItem}>
                                        <Text style={styles.paramLabel}>REST</Text>
                                        <TextInput
                                            style={styles.paramInput}
                                            value={ex.restTime}
                                            onChangeText={(v) => updateExercise(idx, "restTime", v)}
                                        />
                                    </View>
                                </View>
                            </View>
                        ))}

                        <Pressable style={styles.addBtn} onPress={addExercise}>
                            <Ionicons name="add-circle" size={24} color={colors.primary} />
                            <Text style={styles.addBtnText}>ADD EXERCISE</Text>
                        </Pressable>
                    </>
                ) : (
                    <View style={styles.exerciseCard}>
                        <Text style={styles.label}>Meal Description</Text>
                        <TextInput
                            style={[styles.exNameInput, { height: 100, textAlignVertical: "top" }]}
                            placeholder="e.g. 200g Grilled Chicken..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            value={mealData.description}
                            onChangeText={(v) => setMealData({ ...mealData, description: v })}
                        />
                        <View style={styles.paramGrid}>
                            <View style={styles.paramItem}>
                                <Text style={styles.paramLabel}>CALORIES</Text>
                                <TextInput
                                    style={styles.paramInput}
                                    keyboardType="numeric"
                                    value={mealData.macros.calories.toString()}
                                    onChangeText={(v) => setMealData({ ...mealData, macros: { ...mealData.macros, calories: parseInt(v) || 0 } })}
                                />
                            </View>
                            <View style={styles.paramItem}>
                                <Text style={styles.paramLabel}>PROTEIN (G)</Text>
                                <TextInput
                                    style={styles.paramInput}
                                    keyboardType="numeric"
                                    value={mealData.macros.protein.toString()}
                                    onChangeText={(v) => setMealData({ ...mealData, macros: { ...mealData.macros, protein: parseInt(v) || 0 } })}
                                />
                            </View>
                        </View>
                    </View>
                )}

                <View style={styles.footer}>
                    <Pressable
                        style={[styles.saveBtn, isSubmitting && { opacity: 0.7 }]}
                        onPress={handleSave}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? <ActivityIndicator color={colors.primaryText} /> : (
                            <>
                                <Text style={styles.saveBtnText}>{template ? "UPDATE TEMPLATE" : "SAVE TO LIBRARY"}</Text>
                                <Ionicons name="bookmark" size={20} color={colors.primaryText} />
                            </>
                        )}
                    </Pressable>
                </View>
            </ScrollView>
        </ScreenShell>
    );
}

const styles = StyleSheet.create({
    shellContent: { paddingBottom: 0 },
    scroll: { paddingBottom: 60, gap: 20, marginTop: 10 },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.surfaceInset,
        gap: 8,
    },
    label: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
    titleInput: { color: "#ffffff", fontSize: 20, fontWeight: "800", paddingVertical: 8 },
    exerciseCard: { backgroundColor: colors.surfaceInset, borderRadius: 20, padding: 20, gap: 16, borderWidth: 1, borderColor: colors.surfaceInset },
    exHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    exNumber: { color: colors.textDim, fontSize: 12, fontWeight: "900" },
    exNameInput: { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: "#ffffff", fontSize: 16, fontWeight: "700", borderWidth: 1, borderColor: colors.surfaceInset },
    paramGrid: { flexDirection: "row", gap: 12 },
    paramItem: { flex: 1, gap: 6 },
    paramLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "900", textAlign: "center" },
    paramInput: { backgroundColor: colors.surface, borderRadius: 10, paddingVertical: 10, textAlign: "center", color: colors.primary, fontSize: 15, fontWeight: "800", borderWidth: 1, borderColor: colors.surfaceInset },
    addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 10, backgroundColor: colors.surface, borderRadius: 16, borderStyle: "dashed", borderWidth: 1, borderColor: "#333" },
    addBtnText: { color: colors.primary, fontWeight: "900", fontSize: 13 },
    footer: { marginTop: 10 },
    saveBtn: { backgroundColor: colors.primary, borderRadius: 20, height: 64, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
    saveBtnText: { color: colors.primaryText, fontWeight: "900", fontSize: 16, letterSpacing: 1 },
});
