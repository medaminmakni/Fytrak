import { ToastService } from "../../components/Toast";
import { useState } from "react";
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
import { UserProfile } from "../../services/userSession";
import { auth, db } from "../../config/firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import { useEffect } from "react";

export function EditCoachProfileScreen() {
    const navigation = useNavigation<any>();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [name, setName] = useState("");
    const [bio, setBio] = useState("");
    const [experience, setExperience] = useState(0);
    const [specialties, setSpecialties] = useState<string[]>([]);
    const [newSpecialty, setNewSpecialty] = useState("");

    useEffect(() => {
        const fetchProfile = async () => {
            const user = auth.currentUser;
            if (!user) return;

            try {
                const ref = doc(db, "users", user.uid);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data() as UserProfile;
                    setName(data.name || "");
                    if (data.coachProfile) {
                        setBio(data.coachProfile.bio || "");
                        setExperience(Number(data.coachProfile.experience) || 0);
                        setSpecialties(data.coachProfile.specialties || []);
                    }
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleAddSpecialty = () => {
        if (!newSpecialty.trim()) return;
        if (specialties.includes(newSpecialty.trim())) {
            setNewSpecialty("");
            return;
        }
        setSpecialties([...specialties, newSpecialty.trim()]);
        setNewSpecialty("");
    };

    const removeSpecialty = (s: string) => {
        setSpecialties(specialties.filter(item => item !== s));
    };

    const handleSave = async () => {
        if (!name.trim() || !bio.trim() || specialties.length === 0) {
            ToastService.error("Missing Info", "Please fill in your name, bio, and at least one specialty.");
            return;
        }

        try {
            setIsSaving(true);
            const user = auth.currentUser;
            if (!user) return;

            const ref = doc(db, "users", user.uid);
            await setDoc(ref, {
                name: name.trim(),
                coachProfile: {
                    bio: bio.trim(),
                    experience: experience,
                    specialties
                },
                updatedAt: serverTimestamp()
            }, { merge: true });

            ToastService.success("Success", "Profile updated successfully!");
            navigation.goBack();
        } catch (error) {
            console.error(error);
            ToastService.error("Error", "Failed to save profile.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return (
        <ScreenShell title="Edit profile" centered>
            <ActivityIndicator color={colors.primary} />
        </ScreenShell>
    );

    return (
        <ScreenShell
            title="Edit coach profile"
            subtitle="Update your professional brand"
            contentStyle={styles.shellContent}
        >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                <View style={styles.section}>
                    <Text style={styles.label}>Display Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Your full name"
                        placeholderTextColor={colors.textDim}
                        value={name}
                        onChangeText={setName}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Professional Bio</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Tell trainees about your philosophy and results..."
                        placeholderTextColor={colors.textDim}
                        multiline
                        numberOfLines={4}
                        value={bio}
                        onChangeText={setBio}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Years of Experience</Text>
                    <View style={styles.stepperContainer}>
                        <Pressable
                            style={styles.stepperBtn}
                            onPress={() => setExperience(Math.max(0, experience - 1))}
                        >
                            <Ionicons name="remove" size={24} color={colors.primary} />
                        </Pressable>
                        <View style={styles.stepperValue}>
                            <Text style={styles.stepperText}>{experience}</Text>
                            <Text style={styles.stepperSubtext}>YEARS</Text>
                        </View>
                        <Pressable
                            style={styles.stepperBtn}
                            onPress={() => setExperience(experience + 1)}
                        >
                            <Ionicons name="add" size={24} color={colors.primary} />
                        </Pressable>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Areas of Expertise</Text>
                    <View style={styles.specialtyInputRow}>
                        <TextInput
                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                            placeholder="Add a specialty (e.g. Powerlifting)"
                            placeholderTextColor={colors.textDim}
                            value={newSpecialty}
                            onChangeText={setNewSpecialty}
                            onSubmitEditing={handleAddSpecialty}
                        />
                        <Pressable style={styles.addMiniBtn} onPress={handleAddSpecialty}>
                            <Ionicons name="add" size={24} color={colors.primaryText} />
                        </Pressable>
                    </View>

                    <View style={styles.tagGrid}>
                        {specialties.map(s => (
                            <Pressable
                                key={s}
                                style={styles.tag}
                                onPress={() => removeSpecialty(s)}
                            >
                                <Text style={styles.tagText}>{s}</Text>
                                <Ionicons name="close-circle" size={14} color={colors.primary} style={{ marginStart: 4 }} />
                            </Pressable>
                        ))}
                    </View>
                </View>

                <View style={styles.footer}>
                    <Pressable
                        style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
                        onPress={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? <ActivityIndicator color={colors.primaryText} /> : (
                            <>
                                <Text style={styles.saveBtnText}>SAVE CHANGES</Text>
                                <Ionicons name="checkmark-done" size={20} color={colors.primaryText} />
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
    scroll: { paddingBottom: 60, gap: 24, marginTop: 10 },
    section: { gap: 10 },
    label: {
        color: colors.primary,
        fontSize: 11,
        fontWeight: "900",
        letterSpacing: 1,
        textTransform: "uppercase",
        paddingStart: 4,
    },
    input: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        color: "#fff",
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.surfaceInset,
        marginBottom: 4,
    },
    textArea: {
        height: 120,
        textAlignVertical: "top",
    },
    specialtyInputRow: {
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
    },
    // Secondary to the save button, which is this screen's one accent.
    addMiniBtn: {
        width: 52,
        height: 52,
        borderRadius: 14,
        backgroundColor: colors.surfaceInset,
        alignItems: "center",
        justifyContent: "center",
    },
    tagGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 4,
    },
    tag: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surfaceInset,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#333",
    },
    tagText: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: "700",
    },
    footer: {
        marginTop: 20,
    },
    saveBtn: {
        backgroundColor: colors.primary,
        borderRadius: 20,
        height: 60,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
    },
    saveBtnText: {
        color: colors.primaryText,
        fontWeight: "900",
        fontSize: 15,
        letterSpacing: 1,
    },
    stepperContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 8,
        borderWidth: 1,
        borderColor: colors.surfaceInset,
        justifyContent: "space-between",
    },
    stepperBtn: {
        width: 50,
        height: 50,
        borderRadius: 15,
        backgroundColor: colors.surfaceInset,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#333",
    },
    stepperValue: {
        alignItems: "center",
        flex: 1,
    },
    stepperText: {
        color: "#fff",
        fontSize: 24,
        fontWeight: "900",
    },
    stepperSubtext: {
        color: colors.primary,
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1,
        marginTop: -2,
    },
});
