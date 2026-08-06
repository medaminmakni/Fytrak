import { ToastService } from "../../components/Toast";
import { useEffect, useState } from "react";
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TextInput,
    Pressable,
    ActivityIndicator,
    Modal,
    KeyboardAvoidingView,
    Platform
} from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { savePrescribedMeal, CoachTemplate, subscribeToCoachTemplates } from "../../services/userSession";
import { auth } from "../../config/firebase";
import { useNavigation, useRoute } from "@react-navigation/native";
import { parseScheduleDateInput } from "../../features/plans/scheduleInput";
import { Typography } from "../../components/Typography";
import { useFoodSearch } from "../../hooks/useFoodSearch";
import type { FoodItem } from "../../services/nutritionSearchService";

export function PrescribeMealScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { traineeId = "", traineeName = "" } = route.params ?? {};

    const [title, setTitle] = useState("");
    // Blank = unscheduled, preserving the pre-Phase-D behaviour.
    const [scheduledDate, setScheduledDate] = useState("");
    const [description, setDescription] = useState("");
    const [macros, setMacros] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });

    const [templates, setTemplates] = useState<CoachTemplate[]>([]);
    const [libModalVisible, setLibModalVisible] = useState(false);
    const [saveAsTemplate, setSaveAsTemplate] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Food Database Search
    const { query, setQuery, results, isSearching } = useFoodSearch();

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;
        const unsubscribe = subscribeToCoachTemplates(user.uid, "meal", (data) => {
            setTemplates(data);
        });
        return () => unsubscribe();
    }, []);

    const applyTemplate = (t: CoachTemplate) => {
        setTitle(t.title);
        if (t.data) {
            setDescription(t.data.description || "");
            if (t.data.macros) {
                setMacros(t.data.macros);
            }
        }
        setLibModalVisible(false);
    };

    const selectFood = (item: FoodItem) => {
        setTitle(item.name);
        setMacros({
            calories: Math.round(item.calories),
            protein: Math.round(item.protein),
            carbs: Math.round(item.carbs),
            fats: Math.round(item.fats)
        });
        setQuery("");
    };

    const updateMacro = (field: string, value: string) => {
        setMacros({ ...macros, [field]: parseInt(value) || 0 });
    };

    const handleSave = async () => {
        if (!title.trim() || (!description.trim() && macros.calories === 0)) {
            ToastService.error("Missing Info", "Please provide a title and either a description or macros.");
            return;
        }

        // Validated before any write so a malformed date never reaches Firestore.
        const schedule = parseScheduleDateInput(scheduledDate);
        if (!schedule.ok) {
            ToastService.error("Check the date", schedule.message);
            return;
        }

        try {
            setIsSubmitting(true);
            const user = auth.currentUser;
            if (!user) throw new Error("No coach session");

            await savePrescribedMeal(traineeId, {
                coachId: user.uid,
                coachName: (user as any).displayName || "Your Coach",
                title: title.trim(),
                description: description.trim(),
                macros: macros,
                isApplied: false
            }, schedule.scheduledDateKey);

            if (saveAsTemplate) {
                const { saveCoachTemplate } = require("../../services/userSession");
                await saveCoachTemplate(user.uid, {
                    title: title.trim(),
                    type: "meal",
                    data: { description, macros }
                });
            }

            ToastService.success("Nutrition assigned", schedule.scheduledDateKey
                    ? `Scheduled for ${schedule.scheduledDateKey}. Your client will see it as that day's nutrition plan.`
                    : "Unscheduled — your client will see this plan in Nutrition and can apply the targets.");
            navigation.goBack();
        } catch (error) {
            console.error(error);
            ToastService.error("Error", "Failed to assign plan.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const [libSearchQuery, setLibSearchQuery] = useState("");
    const filteredTemplates = templates.filter(t => t.title.toLowerCase().includes(libSearchQuery.toLowerCase()));

    return (
        <ScreenShell
            title="Prescribe a meal"
            subtitle={`NUTRITION PLAN FOR ${traineeName?.toUpperCase()}`}
            contentStyle={styles.shellContent}
        >
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
            >
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    
                    {/* SEARCH & LIBRARY ROW */}
                    <View style={styles.topActionRow}>
                        <Pressable
                            style={styles.actionCard}
                            onPress={() => templates.length > 0 ? setLibModalVisible(true) : ToastService.error("Library Empty", "Save a meal plan first.")}
                        >
                            <Ionicons name="library" size={20} color="#4ade80" />
                            <Typography variant="label" color="#4ade80">LIBRARY</Typography>
                        </Pressable>
                    </View>

                    {/* FOOD DATABASE SEARCH */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="search" size={18} color={colors.primary} />
                            <Typography variant="h2">Food Database</Typography>
                        </View>
                        <View style={styles.searchBarWrapper}>
                            <Ionicons name="search" size={18} color={colors.iconFaint} style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search nutrition data..."
                                placeholderTextColor={colors.textDim}
                                value={query}
                                onChangeText={setQuery}
                            />
                            {isSearching && <ActivityIndicator size="small" color={colors.primary} />}
                        </View>
                        {results.length > 0 && query.length >= 2 && (
                            <View style={styles.resultsList}>
                                {results.slice(0, 5).map(food => (
                                    <Pressable key={food.id} style={styles.resultItem} onPress={() => selectFood(food)}>
                                        <View style={styles.resultIconBg}>
                                            <Ionicons name="fast-food" size={14} color={food.isVerified ? colors.primary : colors.iconFaint} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Typography variant="h2" style={{ fontSize: 13 }} numberOfLines={1}>{food.name}</Typography>
                                            <Typography variant="label" color={colors.textMuted} style={{ fontSize: 11 }}>{food.calories} kcal • {food.protein}g P</Typography>
                                        </View>
                                        <Ionicons name="add-circle" size={18} color={colors.primary} />
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* PLAN CORE */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="leaf" size={18} color="#4ade80" />
                            <Typography variant="h2">Plan Core</Typography>
                        </View>
                        <View style={styles.inputGroup}>
                            <Typography variant="label" color={colors.textMuted} style={{ fontSize: 11 }}>PLAN TITLE</Typography>
                            <TextInput
                                placeholder="e.g. Aggressive Lean Bulk"
                                placeholderTextColor={colors.textDim}
                                style={styles.textInput}
                                value={title}
                                onChangeText={setTitle}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Typography variant="label" color={colors.textMuted} style={{ fontSize: 11 }}>
                                SCHEDULE FOR (OPTIONAL)
                            </Typography>
                            <TextInput
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={colors.textDim}
                                style={styles.textInput}
                                value={scheduledDate}
                                onChangeText={setScheduledDate}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="numbers-and-punctuation"
                            />
                            <Typography variant="label" color={colors.textDim} style={{ fontSize: 11 }}>
                                {scheduledDate.trim()
                                    ? `Scheduled for ${scheduledDate.trim()} — nutrition only; the workout plan is unaffected.`
                                    : "Unscheduled — shown in your client's nutrition list, not tied to a day."}
                            </Typography>
                        </View>
                        <View style={styles.inputGroup}>
                            <Typography variant="label" color={colors.textMuted} style={{ fontSize: 11 }}>GUIDELINES & PROTOCOL</Typography>
                            <TextInput
                                style={[styles.textInput, { height: 100, textAlignVertical: 'top' }]}
                                placeholder="Specify meal timing, portions, and supplementation..."
                                placeholderTextColor={colors.textDim}
                                multiline
                                value={description}
                                onChangeText={setDescription}
                            />
                        </View>
                    </View>

                    {/* MACRO ARCHITECTURE */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="analytics" size={18} color="#fbbf24" />
                            <Typography variant="h2">Macro Architecture</Typography>
                        </View>
                        <View style={styles.macroGrid}>
                            <MacroField label="CALORIES" value={macros.calories.toString()} onChange={(v: string) => updateMacro("calories", v)} color="#fbbf24" />
                            <MacroField label="PROTEIN" value={macros.protein.toString()} onChange={(v: string) => updateMacro("protein", v)} color="#4ade80" />
                        </View>
                        <View style={styles.macroGrid}>
                            <MacroField label="CARBS" value={macros.carbs.toString()} onChange={(v: string) => updateMacro("carbs", v)} color={colors.primary} />
                            <MacroField label="FATS" value={macros.fats.toString()} onChange={(v: string) => updateMacro("fats", v)} color="#f87171" />
                        </View>
                    </View>

                    {/* GLOBAL SYNC */}
                    <Pressable
                        style={[styles.card, saveAsTemplate && { borderColor: '#4ade80' }]}
                        onPress={() => setSaveAsTemplate(!saveAsTemplate)}
                    >
                        <View style={styles.templateRow}>
                            <Ionicons name={saveAsTemplate ? "cloud-done" : "cloud-upload-outline"} size={22} color={saveAsTemplate ? "#4ade80" : colors.iconFaint} />
                            <View style={{ flex: 1 }}>
                                <Typography variant="h2" style={{ fontSize: 15 }}>Sync to Library</Typography>
                                <Typography variant="label" color={colors.textMuted}>Make this plan available for other trainees.</Typography>
                            </View>
                        </View>
                    </Pressable>

                    <View style={styles.footer}>
                        <Pressable
                            style={[styles.primaryAction, { backgroundColor: '#4ade80' }, isSubmitting && { opacity: 0.7 }]}
                            onPress={handleSave}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? <ActivityIndicator color="#000" /> : (
                                <>
                                    <Typography style={{ color: "#000", fontWeight: '900', fontSize: 14 }}>ASSIGN NUTRITION</Typography>
                                    <Ionicons name="send" size={16} color="#000" />
                                </>
                            )}
                        </Pressable>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>

            {/* MODAL */}
            <Modal visible={libModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Typography variant="h2">Meal Library</Typography>
                            <Pressable onPress={() => setLibModalVisible(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </Pressable>
                        </View>
                        <View style={styles.modalSearch}>
                            <Ionicons name="search" size={18} color={colors.iconFaint} />
                            <TextInput style={styles.modalSearchInput} placeholder="Search plans..." placeholderTextColor={colors.textMuted} value={libSearchQuery} onChangeText={setLibSearchQuery} />
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {filteredTemplates.map(t => (
                                <Pressable key={t.id} style={styles.modalItem} onPress={() => applyTemplate(t)}>
                                    <View style={{ flex: 1 }}>
                                        <Typography variant="h2">{t.title}</Typography>
                                        <Typography variant="label" color={colors.textMuted}>{t.data.macros?.calories || 0} kcal | {t.data.macros?.protein || 0}g P</Typography>
                                    </View>
                                    <Ionicons name="add-circle" size={24} color="#4ade80" />
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ScreenShell>
    );
}

function MacroField({ label, value, onChange, color }: any) {
    return (
        <View style={styles.macroBox}>
            <Typography variant="label" color={colors.textMuted} style={{ fontSize: 11, textAlign: 'center' }}>{label}</Typography>
            <TextInput
                keyboardType="numeric"
                style={[styles.macroInput, { color }]}
                value={value}
                onChangeText={onChange}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    shellContent: { paddingBottom: 0 },
    scroll: { paddingBottom: 100, gap: 16, marginTop: 10 },
    
    topActionRow: { flexDirection: 'row', gap: 12 },
    actionCard: { flex: 1, backgroundColor: '#161616', borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#333' },

    card: { backgroundColor: "#161616", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#333", gap: 16 },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    
    searchBarWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a', borderRadius: 16, paddingHorizontal: 16, height: 50, gap: 12, borderWidth: 1, borderColor: '#1c1c1e' },
    searchIcon: { marginEnd: 0 },
    searchInput: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
    
    resultsList: { gap: 8, marginTop: 4 },
    resultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a', borderRadius: 16, padding: 12, gap: 12, borderWidth: 1, borderColor: '#1c1c1e' },
    resultIconBg: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },

    inputGroup: { gap: 8 },
    textInput: { backgroundColor: '#0a0a0a', borderRadius: 16, padding: 16, color: '#fff', fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: '#1c1c1e' },

    macroGrid: { flexDirection: 'row', gap: 12 },
    macroBox: { flex: 1, backgroundColor: '#0a0a0a', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#1c1c1e', gap: 4 },
    macroInput: { fontSize: 20, fontWeight: '900', textAlign: 'center', padding: 0 },

    templateRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    footer: { marginTop: 8 },
    primaryAction: { height: 60, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#000', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '75%', padding: 24, borderWidth: 1, borderColor: '#333' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
    modalSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 16, paddingHorizontal: 16, height: 50, gap: 12, borderWidth: 1, borderColor: '#222', marginBottom: 20 },
    modalSearchInput: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
    modalItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 18, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#222' },
});
