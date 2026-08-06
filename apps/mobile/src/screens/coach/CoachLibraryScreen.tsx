import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable, ActivityIndicator, TextInput } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { auth } from "../../config/firebase";
import { subscribeToCoachTemplates, CoachTemplate } from "../../services/userSession";

export function CoachLibraryScreen() {
    const [templates, setTemplates] = useState<CoachTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"workout" | "meal">("workout");
    const [searchQuery, setSearchQuery] = useState("");

    const navigation = useNavigation<any>();

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const unsubscribe = subscribeToCoachTemplates(user.uid, activeTab, (data) => {
            setTemplates(data);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [activeTab]);

    const filteredTemplates = templates.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <ScreenShell
            title="Library"
            subtitle="Manage your training and meal templates"
            contentStyle={styles.shellContent}
        >
            <View style={styles.headerRow}>
                <View style={styles.tabs}>
                    <Pressable
                        style={[styles.tab, activeTab === "workout" && styles.tabActive]}
                        onPress={() => { setIsLoading(true); setActiveTab("workout"); }}
                    >
                        <Text style={[styles.tabText, activeTab === "workout" && styles.tabTextActive]}>Workouts</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.tab, activeTab === "meal" && styles.tabActive]}
                        onPress={() => { setIsLoading(true); setActiveTab("meal"); }}
                    >
                        <Text style={[styles.tabText, activeTab === "meal" && styles.tabTextActive]}>Meals</Text>
                    </Pressable>
                </View>

                <Pressable
                    style={styles.addIconBtn}
                    onPress={() => navigation.navigate("CreateTemplate", { type: activeTab })}
                >
                    <Ionicons name="add" size={26} color={colors.primary} />
                </Pressable>
            </View>

            <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color={colors.iconFaint} />
                <TextInput
                    style={styles.searchInput}
                    placeholder={`Search ${activeTab}s...`}
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {isLoading ? (
                <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                    {filteredTemplates.length === 0 ? (
                        <View style={styles.emptyBox}>
                            <View style={styles.iconCircle}>
                                <Ionicons name={activeTab === "workout" ? "barbell-outline" : "nutrition-outline"} size={40} color="#333" />
                            </View>
                            <Text style={styles.emptyTitle}>Nothing found</Text>
                            <Text style={styles.emptyText}>
                                {searchQuery
                                    ? "No templates match your search."
                                    : `Save a ${activeTab} while prescribing it, or create a standalone template.`}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.grid}>
                            {filteredTemplates.map(t => (
                                <Pressable
                                    key={t.id}
                                    style={styles.templateCard}
                                    onPress={() => navigation.navigate("TemplateDetail", { templateId: t.id, type: t.type })}
                                >
                                    <View style={styles.cardAccent} />
                                    <View style={styles.cardIconBox}>
                                        <Ionicons
                                            name={t.type === "workout" ? "barbell" : "restaurant"}
                                            size={20}
                                            color={t.type === "workout" ? colors.primary : "#4ade80"}
                                        />
                                    </View>
                                    <View style={styles.cardContent}>
                                        <Text style={styles.templateTitle} numberOfLines={1}>{t.title}</Text>
                                        <Text style={styles.templateMeta}>
                                            {t.type === "workout"
                                                ? `${t.data.exercises?.length || 0} Exercises`
                                                : `${t.data.macros?.calories || 0} kcal • ${t.data.macros?.protein || 0}g Pro`}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color={colors.iconFaint} style={styles.cardArrow} />
                                </Pressable>
                            ))}
                            <Pressable
                                style={styles.addFullCard}
                                onPress={() => navigation.navigate("CreateTemplate", { type: activeTab })}
                            >
                                <View style={styles.addCircle}>
                                    <Ionicons name="add" size={24} color={colors.primary} />
                                </View>
                                <Text style={styles.addText}>Create new {activeTab}</Text>
                            </Pressable>
                        </View>
                    )}
                </ScrollView>
            )}
        </ScreenShell>
    );
}



const styles = StyleSheet.create({
    shellContent: {
        paddingBottom: 0,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 10,
        marginBottom: 10,
    },
    tabs: {
        flexDirection: "row",
        gap: 12,
    },
    addIconBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: "#1c1c1e",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#2c2c2e",
    },
    tab: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: "#161616",
        borderWidth: 1,
        borderColor: "#2c2c2e",
    },
    tabActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    tabText: {
        color: colors.textMuted,
        fontSize: 14,
        fontWeight: "700",
    },
    tabTextActive: {
        color: colors.primaryText,
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#161616",
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 52,
        gap: 12,
        borderWidth: 1,
        borderColor: "#2c2c2e",
        marginBottom: 24,
    },
    searchInput: {
        flex: 1,
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "600",
    },
    loader: {
        paddingTop: 40,
    },
    scroll: {
        paddingBottom: 100,
        gap: 24,
    },
    emptyBox: {
        backgroundColor: "#161616",
        borderRadius: 28,
        padding: 30,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#2c2c2e",
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "#1c1c1e",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
    },
    emptyTitle: {
        color: "#ffffff",
        fontSize: 20,
        fontWeight: "900",
        marginBottom: 8,
    },
    emptyText: {
        color: colors.textMuted,
        fontSize: 14,
        textAlign: "center",
        lineHeight: 20,
        marginBottom: 24,
    },
    createBtn: {
        backgroundColor: colors.primary,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 16,
        gap: 8,
    },
    createBtnText: {
        color: colors.primaryText,
        fontWeight: "900",
        fontSize: 13,
        letterSpacing: 1,
    },
    grid: {
        gap: 16,
    },
    templateCard: {
        backgroundColor: "#161616",
        borderRadius: 24,
        padding: 16,
        paddingStart: 24,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#2c2c2e",
        overflow: "hidden",
    },
    cardAccent: {
        position: "absolute",
        start: 0,
        top: 0,
        bottom: 0,
        width: 6,
        backgroundColor: colors.primary,
    },
    cardIconBox: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: "#1c1c1e",
        alignItems: "center",
        justifyContent: "center",
        marginEnd: 16,
    },
    cardContent: {
        flex: 1,
    },
    templateTitle: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "800",
        marginBottom: 4,
    },
    templateMeta: {
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: "600",
    },
    cardArrow: {
        marginStart: 8,
    },
    addFullCard: {
        height: 80,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "#2c2c2e",
        borderStyle: "dashed",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 24,
        gap: 16,
    },
    addCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#1c1c1e",
        alignItems: "center",
        justifyContent: "center",
    },
    addText: {
        color: colors.textMuted,
        fontSize: 15,
        fontWeight: "700",
    },
});
