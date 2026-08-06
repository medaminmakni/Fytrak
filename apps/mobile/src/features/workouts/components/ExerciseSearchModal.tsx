import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";
import { Typography } from "../../../components/Typography";
import { t as tEx, type ExerciseLibraryItem } from "../../../constants/exercises";

type ExerciseSearchModalProps = {
  visible: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  isSearching: boolean;
  results: ExerciseLibraryItem[];
  onClose: () => void;
  onOpenDetails: (exercise: ExerciseLibraryItem) => void;
  onSelectExercise: (exercise: ExerciseLibraryItem) => void;
  onAddCustom: (name: string) => void;
};

export function ExerciseSearchModal({
  visible,
  query,
  onQueryChange,
  isSearching,
  results,
  onClose,
  onOpenDetails,
  onSelectExercise,
  onAddCustom,
}: ExerciseSearchModalProps) {
  const trimmedQuery = query.trim();

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
            <Typography variant="h2" style={styles.modalTitle}>
              Add Exercise
            </Typography>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>

          <TextInput
            style={[styles.input, { marginTop: 20, marginBottom: 10 }]}
            placeholder="Search 800+ exercises..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={onQueryChange}
          />

          {isSearching && (
            <View style={styles.searchingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}

          <ScrollView style={{ flex: 1 }}>
            {results.length === 0 ? (
              <View style={styles.emptyResults}>
                <Typography variant="label" color={colors.textDim}>
                  No matches found
                </Typography>
                <Pressable
                  style={[styles.loadBtn, { marginTop: 12, backgroundColor: "#111" }]}
                  onPress={() => onAddCustom(trimmedQuery || "Custom Exercise")}
                >
                  <Ionicons name="add" size={18} color={colors.primary} />
                  <Text style={styles.loadBtnText}>
                    ADD "{(trimmedQuery || "CUSTOM").toUpperCase()}"
                  </Text>
                </Pressable>
              </View>
            ) : (
              results.map((exercise) => (
                <View key={exercise.id} style={styles.exerciseSelectItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemTitle}>{tEx(exercise.name)}</Text>
                    <View style={styles.tagRow}>
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>
                          {(exercise.muscleGroup || "Unknown").toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>
                          {(exercise.equipment || "Unknown").toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.actionRow}>
                    <Pressable
                      style={styles.infoIconBtn}
                      onPress={() => onOpenDetails(exercise)}
                    >
                      <Ionicons
                        name="information-circle-outline"
                        size={22}
                        color={colors.primary}
                      />
                    </Pressable>
                    <Pressable
                      style={styles.addIconCircle}
                      onPress={() => onSelectExercise(exercise)}
                    >
                      <Ionicons name="add" size={20} color="#000" />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {!trimmedQuery && (
            <Pressable
              style={[styles.addExBtn, { marginTop: 10, borderStyle: "solid" }]}
              onPress={() => onAddCustom("Custom Exercise")}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.addExText}>ADD CUSTOM EXERCISE</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#000", borderTopLeftRadius: 32, borderTopRightRadius: 32, height: "85%", padding: 24, borderWidth: 1, borderColor: "#1c1c1e" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  modalTitle: { color: "#fff" },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  input: { backgroundColor: "#1c1c1e", borderRadius: 14, padding: 14, color: "#fff", fontSize: 14, borderWidth: 1, borderColor: "#2c2c2e" },
  searchingRow: { paddingVertical: 10, alignItems: "center" },
  emptyResults: { paddingVertical: 40, alignItems: "center" },
  exerciseSelectItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#1c1c1e", borderRadius: 20, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "#2c2c2e" },
  modalItemTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  tagRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  tag: { backgroundColor: "#1c1c1e", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#2c2c2e" },
  tagText: { color: "#aaa", fontSize: 11, fontWeight: "900" },
  actionRow: { flexDirection: "row", gap: 12 },
  infoIconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#1c1c1e", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#2c2c2e" },
  addIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  loadBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#161616", padding: 16, borderRadius: 20, borderWidth: 1, borderColor: "#2c2c2e", gap: 12 },
  loadBtnText: { color: colors.primary, fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },
  addExBtn: { minHeight: 56, backgroundColor: "#161616", paddingVertical: 18, paddingHorizontal: 20, borderRadius: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#333", gap: 10 },
  addExText: { color: colors.primary, fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },
});
