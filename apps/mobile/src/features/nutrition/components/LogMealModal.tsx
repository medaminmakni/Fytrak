import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { colors } from "../../../theme/colors";
import { Typography } from "../../../components/Typography";
import { useFoodSearch } from "../../../hooks/useFoodSearch";
import { ToastService } from "../../../components/Toast";
import type { FoodItem } from "../../../services/nutritionSearchService";

type LogMealModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (meal: any) => Promise<void>;
  isSaving: boolean;
};

export function LogMealModal({ visible, onClose, onSave, isSaving }: LogMealModalProps) {
  const { query, setQuery, results, isSearching } = useFoodSearch();
  
  // FORM STATE
  const [mealName, setMealName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");
  const [mealImageUri, setMealImageUri] = useState<string | null>(null);

  const selectFood = (item: FoodItem) => {
    setMealName(item.name);
    setCalories(item.calories.toString());
    setProtein(item.protein.toString());
    setCarbs(item.carbs.toString());
    setFats(item.fats.toString());
    setQuery("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleCapturePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      ToastService.error("Permission Required", "Camera access is needed.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5
    });
    if (!result.canceled) setMealImageUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!mealName.trim() || !Number(calories)) {
      ToastService.error("Missing Info", "Please provide a meal name and calories.");
      return;
    }
    
    await onSave({
      name: mealName.trim(),
      calories: Number(calories),
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fats: Number(fats) || 0,
      imageUri: mealImageUri
    });

    // Reset local state
    setMealName(""); setCalories(""); setProtein(""); setCarbs(""); setFats(""); setMealImageUri(null);
    setQuery("");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View>
              <Typography variant="h2" style={styles.modalTitle}>Log a Meal</Typography>
              <Typography variant="label" color={colors.textMuted}>Search or enter manually</Typography>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* SEARCH SECTION */}
            <View style={styles.searchBarWrapper}>
              <Ionicons name="search" size={18} color={colors.iconFaint} style={styles.searchIcon} />
              <TextInput
                style={styles.input}
                placeholder="Search food database..."
                placeholderTextColor={colors.textDim}
                value={query}
                onChangeText={setQuery}
              />
              {isSearching && (
                <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
              )}
            </View>

            {results.length > 0 && query.length >= 2 && (
              <View style={styles.searchResultsBox}>
                {results.map((food) => (
                  <Pressable key={food.id} style={styles.searchResultItem} onPress={() => selectFood(food)}>
                    <View style={styles.resultIconBg}>
                      <Ionicons name="fast-food" size={16} color={food.isVerified ? colors.primary : colors.iconFaint} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={styles.resultTitle}>{food.name}</Text>
                        {food.isVerified && (
                          <View style={styles.verifiedBadge}>
                            <Ionicons name="checkmark-circle" size={10} color="#000" />
                          </View>
                        )}
                      </View>
                      <Text style={styles.resultSub}>{food.brand || "General"} • {food.calories} kcal</Text>
                    </View>
                    <Ionicons name="add-circle" size={20} color={colors.primary} />
                  </Pressable>
                ))}
              </View>
            )}

            {/* FORM SECTION */}
            <View style={styles.formSection}>
              <View style={styles.mealInputRow}>
                <TextInput
                  style={styles.mainMealInput}
                  placeholder="Meal Name..."
                  placeholderTextColor="#333"
                  value={mealName}
                  onChangeText={setMealName}
                />
                <Pressable 
                  style={[styles.photoBtn, mealImageUri && styles.photoBtnActive]} 
                  onPress={handleCapturePhoto}
                >
                  <Ionicons name={mealImageUri ? "checkmark" : "camera"} size={20} color={mealImageUri ? "#000" : "#fff"} />
                </Pressable>
              </View>

              {mealImageUri && (
                <View style={styles.imagePreview}>
                  <Image source={{ uri: mealImageUri }} style={styles.previewImg} />
                  <Pressable style={styles.removeImgBtn} onPress={() => setMealImageUri(null)}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </Pressable>
                </View>
              )}

              <View style={styles.macroGrid}>
                <MacroField label="CALORIES" value={calories} onChange={setCalories} icon="flame" color="#FF9500" unit="kcal" />
                <MacroField label="PROTEIN" value={protein} onChange={setProtein} icon="flash" color="#4ade80" unit="g" />
                <MacroField label="CARBS" value={carbs} onChange={setCarbs} icon="restaurant" color={colors.primary} unit="g" />
                <MacroField label="FATS" value={fats} onChange={setFats} icon="water" color="#f87171" unit="g" />
              </View>
            </View>

            <Pressable
              style={[styles.saveBtn, (!mealName.trim() || !Number(calories) || isSaving) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Text style={styles.saveBtnText}>LOG THIS MEAL</Text>
                  <View style={styles.btnIconCircle}>
                    <Ionicons name="checkmark" size={18} color="#000" />
                  </View>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MacroField({ label, value, onChange, icon, color, unit }: any) {
  return (
    <View style={styles.macroCard}>
      <View style={styles.macroHeader}>
        <View style={[styles.macroIconBg, { backgroundColor: `${color}15` }]}>
          <Ionicons name={icon} size={12} color={color} />
        </View>
        <Text style={[styles.macroLabel, { color }]}>{label}</Text>
      </View>
      <View style={styles.macroInputWrap}>
        <TextInput
          style={styles.macroInput}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor="#222"
        />
        <Text style={styles.macroUnit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#000", borderTopLeftRadius: 32, borderTopRightRadius: 32, height: "92%", padding: 24, borderWidth: 1, borderColor: "#1c1c1e" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitle: { color: "#fff" },
  closeBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#111", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#222" },
  searchBarWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#0a0a0a", borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: "#1c1c1e", marginBottom: 12 },
  searchIcon: { marginEnd: 12 },
  loader: { marginStart: 12 },
  input: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "600" },
  searchResultsBox: { backgroundColor: "#0a0a0a", borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: "#1c1c1e", overflow: "hidden" },
  searchResultItem: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#111", gap: 12 },
  resultIconBg: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  resultTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  resultSub: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
  verifiedBadge: { backgroundColor: colors.primary, width: 14, height: 14, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  formSection: { backgroundColor: "#0a0a0a", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#1c1c1e", marginBottom: 20 },
  mealInputRow: { flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#111", paddingBottom: 10 },
  mainMealInput: { flex: 1, fontSize: 20, fontWeight: "800", color: "#fff" },
  photoBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#111", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#222" },
  photoBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  imagePreview: { marginTop: 16, position: "relative" },
  previewImg: { width: "100%", height: 150, borderRadius: 16 },
  removeImgBtn: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(255,0,0,0.8)", width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  macroGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 },
  macroCard: { flex: 1, minWidth: "47%", backgroundColor: "#111", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "#1c1c1e" },
  macroHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  macroIconBg: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  macroLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  macroInputWrap: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  macroInput: { fontSize: 20, fontWeight: "900", color: "#fff", padding: 0 },
  macroUnit: { fontSize: 11, fontWeight: "700", color: colors.textDim },
  saveBtn: { backgroundColor: colors.primary, height: 60, borderRadius: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#000", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
  btnIconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.1)", alignItems: "center", justifyContent: "center" },
});
