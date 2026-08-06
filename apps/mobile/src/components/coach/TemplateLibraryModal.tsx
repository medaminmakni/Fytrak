import { Modal, View, Text, TextInput, ScrollView, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { CoachTemplate } from "../../services/userSession";

type TemplateLibraryModalProps = {
    visible: boolean;
    onClose: () => void;
    searchQuery: string;
    onSearchChange: (text: string) => void;
    filteredTemplates: CoachTemplate[];
    onApplyTemplate: (t: CoachTemplate) => void;
};

export function TemplateLibraryModal({
    visible,
    onClose,
    searchQuery,
    onSearchChange,
    filteredTemplates,
    onApplyTemplate,
}: TemplateLibraryModalProps) {
    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Select Template</Text>
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </Pressable>
                    </View>

                    <View style={styles.modalSearch}>
                        <Ionicons name="search" size={18} color={colors.iconFaint} />
                        <TextInput
                            style={styles.modalSearchInput}
                            placeholder="Search templates..."
                            placeholderTextColor={colors.textMuted}
                            value={searchQuery}
                            onChangeText={onSearchChange}
                        />
                    </View>

                    <ScrollView style={styles.modalList}>
                        {filteredTemplates.length === 0 ? (
                            <Text style={styles.emptyText}>No templates found.</Text>
                        ) : (
                            filteredTemplates.map(t => (
                                <Pressable key={t.id} style={styles.modalItem} onPress={() => onApplyTemplate(t)}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.modalItemTitle}>{t.title}</Text>
                                        <Text style={styles.modalItemSub}>{t.data.exercises?.length || 0} exercises</Text>
                                    </View>
                                    <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                                </Pressable>
                            ))
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.8)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#111",
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        height: "85%",
        padding: 24,
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    modalTitle: {
        color: "#fff",
        fontSize: 24,
        fontWeight: "900",
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#222",
        alignItems: "center",
        justifyContent: "center",
    },
    modalSearch: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#1c1c1e",
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 50,
        marginTop: 20,
        marginBottom: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: "#2c2c2e",
    },
    modalSearchInput: {
        flex: 1,
        color: "#fff",
        fontSize: 16,
    },
    modalList: {
        flex: 1,
    },
    emptyText: {
        color: colors.textMuted,
        fontSize: 14,
        textAlign: "center",
        marginTop: 40,
    },
    modalItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#222",
    },
    modalItemTitle: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "700",
    },
    modalItemSub: {
        color: colors.textMuted,
        fontSize: 13,
        marginTop: 4,
    },
});
