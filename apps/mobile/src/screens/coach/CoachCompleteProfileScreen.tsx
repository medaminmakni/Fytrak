import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
    ScrollView,
    KeyboardAvoidingView,
    Platform
} from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import type { CoachProfilePayload } from "../../services/userSession";

type CoachCompleteProfileScreenProps = {
    onComplete: (payload: CoachProfilePayload) => Promise<void>;
};

const SPECIALTIES = [
    "Fat Loss", "Muscle Gain", "Bodybuilding", "Yoga",
    "Powerlifting", "HIIT", "Nutrition", "Rehab"
];

export function CoachCompleteProfileScreen({ onComplete }: CoachCompleteProfileScreenProps) {
    const [bio, setBio] = useState("");
    const [experience, setExperience] = useState("");
    const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);

    const canSubmit = useMemo(() =>
        bio.trim().length > 10 &&
        experience.trim().length > 0 &&
        selectedSpecialties.length > 0 &&
        !isSubmitting,
        [bio, experience, selectedSpecialties, isSubmitting]);

    const toggleSpecialty = (s: string) => {
        setSelectedSpecialties(prev =>
            prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
        );
    };

    const handleContinue = async () => {
        if (!canSubmit) return;
        try {
            setIsSubmitting(true);
            setErrorText(null);
            await onComplete({ bio, specialties: selectedSpecialties, experience: parseInt(experience) || 0 });
        } catch (error) {
            setErrorText(error instanceof Error ? error.message : "Failed to save profile.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ScreenShell
            title="Professional setup"
            subtitle="Define your coaching profile to attract trainees"
            contentStyle={styles.shellContent}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                    <View style={styles.card}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Professional Bio</Text>
                            <TextInput
                                multiline
                                numberOfLines={4}
                                placeholder="Tell potential trainees about your philosophy, background and how you can help them..."
                                placeholderTextColor={colors.textMuted}
                                style={[styles.input, styles.textArea]}
                                value={bio}
                                onChangeText={setBio}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Years of Experience</Text>
                            <View style={styles.experienceStepper}>
                                <Pressable
                                    onPress={() => {
                                        const val = parseInt(experience) || 0;
                                        if (val > 0) setExperience((val - 1).toString());
                                    }}
                                    style={styles.stepperBtn}
                                >
                                    <Ionicons name="remove" size={20} color="#fff" />
                                </Pressable>
                                <View style={styles.experienceDisplay}>
                                    <Text style={styles.experienceValue}>{experience || "0"}</Text>
                                    <Text style={styles.experienceUnit}>YEARS</Text>
                                </View>
                                <Pressable
                                    onPress={() => {
                                        const val = parseInt(experience) || 0;
                                        setExperience((val + 1).toString());
                                    }}
                                    style={styles.stepperBtn}
                                >
                                    <Ionicons name="add" size={20} color={colors.primary} />
                                </Pressable>
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Your Specialties (Select all that apply)</Text>
                            <View style={styles.specialtyGrid}>
                                {SPECIALTIES.map((s) => (
                                    <Pressable
                                        key={s}
                                        onPress={() => toggleSpecialty(s)}
                                        style={[
                                            styles.specialtyPill,
                                            selectedSpecialties.includes(s) && styles.specialtyPillActive
                                        ]}
                                    >
                                        <Text style={[
                                            styles.specialtyText,
                                            selectedSpecialties.includes(s) && styles.specialtyTextActive
                                        ]}>{s}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        <Pressable
                            style={[styles.finishBtn, !canSubmit && styles.disabledButton]}
                            disabled={!canSubmit}
                            onPress={() => void handleContinue()}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color={colors.primaryText} />
                            ) : (
                                <>
                                    <Text style={styles.finishBtnText}>COMPLETE SETUP</Text>
                                    <Ionicons name="checkmark-circle" size={20} color={colors.primaryText} />
                                </>
                            )}
                        </Pressable>

                        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
                    </View>

                    <View style={styles.infoBox}>
                        <Ionicons name="shield-checkmark" size={18} color={colors.success} />
                        <Text style={styles.infoText}>Your profile will be public in the 'Find a Coach' section for trainees.</Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ScreenShell>
    );
}

const styles = StyleSheet.create({
    shellContent: {
        paddingBottom: 0,
    },
    scroll: {
        paddingBottom: 40,
        marginTop: 10,
        gap: 20,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 28,
        padding: 24,
        borderWidth: 1,
        borderColor: colors.surfaceInset,
        gap: 24,
    },
    inputGroup: {
        gap: 12,
    },
    label: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "700",
        marginStart: 2,
    },
    input: {
        backgroundColor: colors.surfaceInset,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "600",
        borderWidth: 1,
        borderColor: colors.surfaceInset,
    },
    experienceStepper: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.surfaceInset,
        borderRadius: 20,
        padding: 8,
        borderWidth: 1,
        borderColor: colors.surfaceInset,
    },
    stepperBtn: {
        width: 50,
        height: 50,
        borderRadius: 15,
        backgroundColor: colors.surfaceInset,
        alignItems: "center",
        justifyContent: "center",
    },
    experienceDisplay: {
        alignItems: "center",
    },
    experienceValue: {
        color: colors.primary,
        fontSize: 24,
        fontWeight: "900",
    },
    experienceUnit: {
        color: colors.textMuted,
        fontSize: 11,
        fontWeight: "800",
        marginTop: -4,
    },
    textArea: {
        minHeight: 120,
        textAlignVertical: "top",
    },
    specialtyGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    specialtyPill: {
        backgroundColor: colors.surfaceInset,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: colors.surfaceInset,
    },
    specialtyPillActive: {
        borderColor: colors.primary,
        backgroundColor: "#22251a",
    },
    specialtyText: {
        color: colors.textMuted,
        fontWeight: "700",
        fontSize: 13,
    },
    specialtyTextActive: {
        color: colors.primary,
    },
    finishBtn: {
        backgroundColor: colors.primary,
        borderRadius: 18,
        height: 60,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        marginTop: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    finishBtnText: {
        color: colors.primaryText,
        fontWeight: "900",
        fontSize: 14,
        letterSpacing: 1,
    },
    disabledButton: {
        opacity: 0.5,
    },
    errorText: {
        color: colors.danger,
        textAlign: "center",
        fontSize: 14,
        fontWeight: "600",
    },
    infoBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.surfaceInset,
    },
    infoText: {
        flex: 1,
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: "500",
        lineHeight: 18,
    },
});
