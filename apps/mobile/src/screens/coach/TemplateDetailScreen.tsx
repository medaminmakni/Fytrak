import { ToastService } from "../../components/Toast";
import { useEffect, useState } from "react";
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    Pressable,
    ActivityIndicator,
    Modal,
    TextInput
} from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../../config/firebase";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { useNavigation, useRoute } from "@react-navigation/native";
import { CoachTemplate, subscribeToCoachTrainees, savePrescribedWorkout, savePrescribedMeal } from "../../services/userSession";

export function TemplateDetailScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { templateId = "", type = "workout" } = route.params ?? {};

    const [template, setTemplate] = useState<CoachTemplate | null>(null);
    const [trainees, setTrainees] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pickerVisible, setPickerVisible] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const fetchTemplate = async () => {
            try {
                const ref = doc(db, "users", user.uid, "templates", templateId);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    setTemplate({ id: snap.id, ...snap.data() } as CoachTemplate);
                }
            } catch (error) {
                console.error(error);
                ToastService.error("Error", "Could not load template details.");
            } finally {
                setIsLoading(false);
            }
        };

        const unsubTrainees = subscribeToCoachTrainees(user.uid, (data) => {
            setTrainees(data.filter(t => t.assignmentStatus === "assigned"));
        });

        fetchTemplate();
        return () => unsubTrainees();
    }, [templateId]);

    const handleAssign = async (trainee: any) => {
        if (!template) return;
        try {
            setIsAssigning(true);
            const user = auth.currentUser;
            if (!user) return;

            if (type === "workout") {
                await savePrescribedWorkout(trainee.id, {
                    coachId: user.uid,
                    coachName: user.displayName || "Your Coach",
                    title: template.title,
                    exercises: template.data.exercises,
                    isCompleted: false
                });
                ToastService.success("Routine assigned", `${trainee.name} will see it on their plan.`);
            } else {
                await savePrescribedMeal(trainee.id, {
                    coachId: user.uid,
                    coachName: user.displayName || "Your Coach",
                    title: template.title,
                    description: template.data.description,
                    macros: template.data.macros,
                    isApplied: false
                });
                ToastService.success("Nutrition plan assigned", `${trainee.name} can apply the targets from Nutrition.`);
            }
            setPickerVisible(false);
        } catch (error) {
            ToastService.error("Error", "Failed to assign template.");
        } finally {
            setIsAssigning(false);
        }
    };

    const handleDelete = () => {
        ToastService.confirm({
            title: "Delete this template?",
            message: "It will be removed from your library. This cannot be undone.",
            confirmLabel: "Delete",
            destructive: true,
            onConfirm: async () => {
                const user = auth.currentUser;
                if (!user) return;
                try {
                    const ref = doc(db, "users", user.uid, "templates", templateId);
                    await deleteDoc(ref);
                    navigation.goBack();
                } catch (error) {
                    console.error("[TemplateDetail] Delete failed:", error);
                    ToastService.error("Error", "Failed to delete template.");
                }
            },
        });
    };

    const [searchQuery, setSearchQuery] = useState("");

    const filteredTrainees = trainees.filter(t =>
        (t.name || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <ScreenShell title="Loading" contentStyle={styles.center}>
                <ActivityIndicator color={colors.primary} />
            </ScreenShell>
        );
    }

    if (!template) {
        return (
            <ScreenShell title="Not found">
                <Text style={{ color: "#fff" }}>Template not found.</Text>
            </ScreenShell>
        );
    }

    return (
        <ScreenShell
            title={template.title}
            subtitle={`${type === "workout" ? "Workout" : "Meal"} Template`}
            contentStyle={styles.shellContent}
            rightActionIcon="trash-outline"
            onRightAction={handleDelete}
        >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                {type === "workout" ? (
                    <View style={styles.section}>
                        <Text style={styles.label}>Exercises</Text>
                        {template.data.exercises?.map((ex: any, idx: number) => (
                            <View key={idx} style={styles.exerciseRow}>
                                <View style={styles.indexCircle}>
                                    <Text style={styles.indexText}>{idx + 1}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.exName}>{ex.name}</Text>
                                    <Text style={styles.exMeta}>{ex.targetSets} sets • {ex.targetReps} reps • {ex.restTime} rest</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.section}>
                        <Text style={styles.label}>Meal Details</Text>
                        <View style={styles.mealCard}>
                            <Text style={styles.mealDesc}>{template.data.description || "No description provided."}</Text>
                            <View style={styles.macroRow}>
                                <View style={styles.macroItem}>
                                    <Text style={styles.macroVal}>{template.data.macros?.calories || 0}</Text>
                                    <Text style={styles.macroLabel}>CALORIES</Text>
                                </View>
                                <View style={styles.macroItem}>
                                    <Text style={styles.macroVal}>{template.data.macros?.protein || 0}g</Text>
                                    <Text style={styles.macroLabel}>PROTEIN</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}

                <View style={styles.footer}>
                    <Pressable
                        style={[styles.primaryBtn, { backgroundColor: colors.surfaceInset, borderWidth: 1, borderColor: "#333", marginBottom: 12 }]}
                        onPress={() => navigation.navigate("CreateTemplate", { type, template })}
                    >
                        <Text style={[styles.primaryBtnText, { color: "#fff" }]}>EDIT TEMPLATE</Text>
                        <Ionicons name="create-outline" size={20} color="#fff" />
                    </Pressable>

                    <Pressable style={styles.primaryBtn} onPress={() => setPickerVisible(true)}>
                        <Text style={styles.primaryBtnText}>ASSIGN TO CLIENT</Text>
                        <Ionicons name="people" size={20} color={colors.primaryText} />
                    </Pressable>
                </View>
            </ScrollView>

            <Modal visible={pickerVisible} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Choose Client</Text>
                            <Pressable onPress={() => setPickerVisible(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </Pressable>
                        </View>

                        <View style={styles.modalSearch}>
                            <Ionicons name="search" size={18} color={colors.iconFaint} />
                            <TextInput
                                style={styles.modalSearchInput}
                                placeholder="Search clients..."
                                placeholderTextColor={colors.textMuted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {filteredTrainees.length === 0 ? (
                                <Text style={styles.emptyText}>
                                    {searchQuery ? "No clients found." : "You don't have any active clients yet."}
                                </Text>
                            ) : (
                                filteredTrainees.map(t => (
                                    <Pressable
                                        key={t.id}
                                        style={styles.traineeItem}
                                        onPress={() => handleAssign(t)}
                                        disabled={isAssigning}
                                    >
                                        <View style={styles.avatarMini}><Text style={styles.avatarTxt}>{(t.name || "?")[0]}</Text></View>
                                        <Text style={styles.traineeName}>{t.name || "Anonymous"}</Text>
                                        <Ionicons name="chevron-forward" size={18} color={colors.iconFaint} />
                                    </Pressable>
                                ))
                            )}
                        </ScrollView>
                        {isAssigning && (
                            <View style={styles.loadingOverlay}>
                                <ActivityIndicator color={colors.primary} />
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </ScreenShell>
    );
}

const styles = StyleSheet.create({
    shellContent: { paddingBottom: 0 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    scroll: { paddingBottom: 60, gap: 24, marginTop: 10 },
    section: { gap: 16 },
    label: {
        color: colors.primary,
        fontSize: 11,
        fontWeight: "900",
        letterSpacing: 1,
        textTransform: "uppercase",
    },
    exerciseRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.surfaceInset,
        gap: 16,
    },
    indexCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surfaceInset,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#333",
    },
    indexText: { color: colors.textMuted, fontSize: 13, fontWeight: "800" },
    exName: { color: "#fff", fontSize: 16, fontWeight: "700" },
    exMeta: { color: colors.textMuted, fontSize: 13, fontWeight: "500", marginTop: 2 },
    mealCard: {
        backgroundColor: colors.surface,
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.surfaceInset,
        gap: 20,
    },
    mealDesc: { color: "#fff", fontSize: 15, lineHeight: 22, fontWeight: "500" },
    macroRow: { flexDirection: "row", gap: 20 },
    macroItem: { flex: 1, gap: 4 },
    macroVal: { color: colors.primary, fontSize: 18, fontWeight: "900" },
    macroLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
    footer: { marginTop: 10 },
    primaryBtn: {
        backgroundColor: colors.primary,
        height: 60,
        borderRadius: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
    },
    primaryBtnText: { color: colors.primaryText, fontWeight: "900", fontSize: 15, letterSpacing: 1 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
    modalContent: {
        backgroundColor: "#000",
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        height: "60%",
        padding: 24,
        borderWidth: 1,
        borderColor: colors.surfaceInset,
    },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    modalTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
    closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceInset, alignItems: "center", justifyContent: "center" },
    traineeItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#222",
        gap: 16,
    },
    avatarMini: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceInset, alignItems: "center", justifyContent: "center" },
    avatarTxt: { color: colors.primaryText, fontWeight: "900", fontSize: 16 },
    traineeName: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "700" },
    emptyText: { color: colors.textMuted, textAlign: "center", marginTop: 40, fontSize: 15 },
    modalSearch: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 52,
        gap: 12,
        borderWidth: 1,
        borderColor: colors.surfaceInset,
        marginBottom: 20,
    },
    modalSearchInput: {
        flex: 1,
        color: "#fff",
        fontSize: 15,
        fontWeight: "600",
    },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", borderRadius: 32 },
});
