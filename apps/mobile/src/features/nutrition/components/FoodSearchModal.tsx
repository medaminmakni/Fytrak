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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";
import { Typography } from "../../../components/Typography";
import type { FoodItem } from "../../../services/nutritionSearchService";

type FoodSearchModalProps = {
  visible: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  isSearching: boolean;
  results: FoodItem[];
  onClose: () => void;
  onSelectFood: (food: FoodItem) => void;
};

export function FoodSearchModal({
  visible,
  query,
  onQueryChange,
  isSearching,
  results,
  onClose,
  onSelectFood,
}: FoodSearchModalProps) {
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
            <View>
              <Typography variant="h2" style={styles.modalTitle}>
                Find Food
              </Typography>
              <Typography variant="label" color={colors.textDim}>
                INNTA Verified & Global DB
              </Typography>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.searchBarWrapper}>
            <Ionicons name="search" size={18} color={colors.iconFaint} style={styles.searchIcon} />
            <TextInput
              style={styles.input}
              placeholder="Search dishes or products..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={onQueryChange}
              autoFocus
            />
            {isSearching && (
              <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
            )}
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            {results.length === 0 ? (
              trimmedQuery.length >= 2 ? (
                <View style={styles.emptyResults}>
                  <Typography variant="label" color={colors.textDim}>
                    No matches found in our database
                  </Typography>
                </View>
              ) : (
                <View style={styles.initialState}>
                  <Ionicons name="restaurant-outline" size={48} color="#1c1c1e" />
                  <Typography variant="label" color={colors.textDim} style={{ marginTop: 12 }}>
                    Type at least 2 characters to search
                  </Typography>
                </View>
              )
            ) : (
              results.map((food) => (
                <Pressable 
                  key={food.id} 
                  style={styles.foodSelectItem}
                  onPress={() => onSelectFood(food)}
                >
                  {food.imageUrl ? (
                    <Image source={{ uri: food.imageUrl }} style={styles.foodThumb} />
                  ) : (
                    <View style={styles.foodIconPlaceholder}>
                      <Ionicons 
                        name="fast-food" 
                        size={18} 
                        color={food.isVerified ? colors.primary : colors.textDim} 
                      />
                    </View>
                  )}
                  
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.modalItemTitle}>{food.name}</Text>
                      {food.isVerified && (
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="checkmark-circle" size={10} color="#000" />
                          <Text style={styles.verifiedText}>INNTA</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.modalItemSub}>
                      {food.brand || "General"} • {food.calories} kcal
                    </Text>
                  </View>

                  <View style={styles.addIconCircle}>
                    <Ionicons name="add" size={20} color="#000" />
                  </View>
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
    backgroundColor: "rgba(0,0,0,0.85)", 
    justifyContent: "flex-end" 
  },
  modalContent: { 
    backgroundColor: "#000", 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    height: "90%", 
    padding: 24, 
    borderWidth: 1, 
    borderColor: "#1c1c1e" 
  },
  modalHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: 20 
  },
  modalTitle: { color: "#fff" },
  closeBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 14, 
    backgroundColor: "#111", 
    alignItems: "center", 
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#222"
  },
  searchBarWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: "#222",
    marginBottom: 20,
  },
  searchIcon: { marginEnd: 12 },
  loader: { marginStart: 12 },
  input: { 
    flex: 1, 
    color: "#fff", 
    fontSize: 16, 
    fontWeight: "600" 
  },
  initialState: { 
    flex: 1, 
    paddingVertical: 60, 
    alignItems: "center" 
  },
  emptyResults: { 
    paddingVertical: 40, 
    alignItems: "center" 
  },
  foodSelectItem: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "#0a0a0a", 
    borderRadius: 20, 
    padding: 16, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: "#1c1c1e",
    gap: 16
  },
  foodThumb: { 
    width: 48, 
    height: 48, 
    borderRadius: 12 
  },
  foodIconPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#222"
  },
  nameRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8,
    marginBottom: 2
  },
  modalItemTitle: { 
    color: "#fff", 
    fontSize: 15, 
    fontWeight: "800",
    flexShrink: 1
  },
  modalItemSub: { 
    color: colors.textMuted, 
    fontSize: 12, 
    fontWeight: "600" 
  },
  verifiedBadge: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 4, 
    backgroundColor: colors.primary, 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 8 
  },
  verifiedText: { 
    color: "#000", 
    fontSize: 11, 
    fontWeight: "900" 
  },
  addIconCircle: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: colors.primary, 
    alignItems: "center", 
    justifyContent: "center" 
  },
});
