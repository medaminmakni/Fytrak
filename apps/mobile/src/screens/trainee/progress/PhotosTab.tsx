import { ViewerBackButton } from "../../../components/ViewerBackButton";
import { ToastService } from "../../../components/Toast";
import React, { useState, useCallback, useMemo } from "react";
import { StyleSheet, View, Pressable, Text, Image, Modal, Dimensions, FlatList, ActivityIndicator } from "react-native";
import { colors } from "../../../theme/colors";
import { spacing } from "../../../theme/tokens";
import { Typography } from "../../../components/Typography";
import { Ionicons } from "@expo/vector-icons";
import { PhotoGridItem } from "../../../components/PhotoGridItem";
import { ProgressCamera } from "../../../components/ProgressCamera";
import { CompareSlider } from "../../../components/CompareSlider";
import { useUserProfile } from "../../../hooks/useUserProfile";
import { useProgressPhotos } from "../../../hooks/useProgressPhotos";
import { useNavigation } from "@react-navigation/native";
import type { ProgressPhoto } from "../../../services/userSession";

const GAP = 8;

export function PhotosTab() {
  const { width: windowWidth } = Dimensions.get("window");
  const navigation = useNavigation<any>();
  const { profile: userProfile } = useUserProfile();
  const {
    photos,
    isSaving,
    handleCapture,
    handlePickPhoto,
    handleDeleteSelected: deleteSelected,
  } = useProgressPhotos();

  // Photo UI State
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [compareSelection, setCompareSelection] = useState<ProgressPhoto[]>([]);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [activeComparePair, setActiveComparePair] = useState<[ProgressPhoto, ProgressPhoto] | null>(null);

  const itemWidth = useMemo(() => Math.floor((windowWidth - (spacing.xl * 2) - (spacing.sm * 2) - (GAP * 2)) / 3), [windowWidth]);

  const handleCameraCapture = async (uri: string) => {
    setIsCameraVisible(false);
    await handleCapture(uri);
  };

  const toggleSelection = useCallback((p: ProgressPhoto) => {
    if (isCompareMode) {
      setCompareSelection(prev => {
        const isAlreadySelected = prev.find(x => x.id === p.id);
        if (isAlreadySelected) return prev.filter(x => x.id !== p.id);
        if (prev.length >= 2) {
          ToastService.success("Limit Reached", "Select only 2 photos to compare.");
          return prev;
        }
        return [...prev, p];
      });
      return;
    }
    setSelection(prev => {
      const next = prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id];
      if (next.length === 0) setIsSelectionMode(false);
      return next;
    });
  }, [isCompareMode]);

  const handleLongPress = useCallback((p: ProgressPhoto) => {
    if (!isSelectionMode && !isCompareMode) {
      setIsSelectionMode(true);
      setSelection([p.id]);
    }
  }, [isSelectionMode, isCompareMode]);

  const handleDeleteSelected = () => {
    deleteSelected(selection, ({ removedIds, failedIds }) => {
      if (removedIds.length > 0) {
        setSelection((current) => current.filter((id) => !removedIds.includes(id)));
      }
      if (failedIds.length === 0) {
        setSelection([]);
        setIsSelectionMode(false);
      }
    });
  };

  const startComparison = () => {
    if (compareSelection.length !== 2) return;
    const sorted = [...compareSelection].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setActiveComparePair([sorted[0], sorted[1]]);
  };

  const isPremium = userProfile?.isPremium;

  if (!isPremium) {
    return (
      <View style={styles.lockedContainer}>
        <View style={styles.vaultLocked}>
          <View style={styles.vaultLockedIcon}>
            <Ionicons name="images" size={32} color="#333" />
          </View>
          <Typography variant="h2" style={{ marginBottom: 12 }}>Unlock Transformation Vault</Typography>
          <Text style={styles.vaultLockedDesc}>Get a coach to unlock progress photos, before/after comparisons, and body composition tracking.</Text>
          <Pressable style={styles.vaultLockedCta} onPress={() => navigation.navigate("CoachAssignment")}>
            <Ionicons name="sparkles" size={14} color="#000" />
            <Text style={styles.vaultLockedCtaText}>UNLOCK WITH COACH</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Typography variant="h2">
            {isCompareMode ? "SELECT 2 PHOTOS" : isSelectionMode ? `${selection.length} SELECTED` : "Photos"}
          </Typography>
          <Typography variant="bodySmall" color={colors.textMuted}>
            {isCompareMode ? "Pick snapshots to compare" : isSelectionMode ? "Tap to select more" : "Visual transformation logs"}
          </Typography>
        </View>
        <View style={styles.headerActions}>
          {isCompareMode || isSelectionMode ? (
            <Pressable
              style={styles.cancelBtn}
              onPress={() => { setIsCompareMode(false); setIsSelectionMode(false); setSelection([]); setCompareSelection([]); }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          ) : (
            <>
              <Pressable style={styles.actionBtn} onPress={() => setIsCompareMode(true)}>
                <Ionicons name="git-compare-outline" size={20} color={colors.primary} />
              </Pressable>
              <Pressable style={styles.addBtn} disabled={isSaving} onPress={() => handlePickPhoto(() => setIsCameraVisible(true))}>
                <Ionicons name="add" size={24} color="#000" />
              </Pressable>
            </>
          )}
          {isSelectionMode && (
            <Pressable style={styles.deleteBtn} disabled={isSaving} onPress={handleDeleteSelected}>
              {isSaving
                ? <ActivityIndicator size="small" color="#ff4444" />
                : <Ionicons name="trash-outline" size={20} color="#ff4444" />}
            </Pressable>
          )}
          {isCompareMode && compareSelection.length === 2 && (
            <Pressable style={styles.compareActiveBtn} onPress={startComparison}>
              <Ionicons name="swap-horizontal" size={20} color="#000" />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.galleryScroll}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="camera-outline" size={48} color="#222" />
            <Text style={styles.emptyText}>No photos yet. Start tracking your journey!</Text>
            <Pressable style={styles.emptyAddBtn} onPress={() => setIsCameraVisible(true)}>
              <Text style={styles.emptyAddBtnText}>TAKE FIRST PHOTO</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }: { item: ProgressPhoto }) => (
          <PhotoGridItem
            photo={item}
            isSelected={selection.includes(item.id)}
            isSelectionMode={isSelectionMode}
            isCompareMode={isCompareMode}
            isCompareSelected={compareSelection.some(x => x.id === item.id)}
            onSelect={toggleSelection}
            onView={setSelectedPhoto}
            onLongPress={handleLongPress}
            width={itemWidth}
          />
        )}
      />

      <Pressable style={styles.fab} disabled={isSaving} onPress={() => setIsCameraVisible(true)}>
        <Ionicons name="camera" size={28} color="#000" />
      </Pressable>

      {/* MODALS */}
      <Modal visible={!!activeComparePair} transparent={false} animationType="slide" onRequestClose={() => setActiveComparePair(null)}>
        {activeComparePair && (
          <CompareSlider
            beforeUri={activeComparePair[0].url}
            afterUri={activeComparePair[1].url}
            beforeDate={new Date(activeComparePair[0].date).toLocaleDateString()}
            afterDate={new Date(activeComparePair[1].date).toLocaleDateString()}
            onClose={() => setActiveComparePair(null)}
          />
        )}
      </Modal>

      <Modal visible={isCameraVisible} transparent={false} animationType="slide" onRequestClose={() => setIsCameraVisible(false)}>
        <ProgressCamera
          onClose={() => setIsCameraVisible(false)}
          onCapture={handleCameraCapture}
          overlayUri={photos[0]?.url && /^https:\/\/[^\s]+$/i.test(photos[0].url) ? photos[0].url : undefined}
        />
      </Modal>

      <Modal visible={!!selectedPhoto} transparent={true} animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
        <View style={styles.viewerOverlay}>
          <ViewerBackButton
            onPress={() => setSelectedPhoto(null)}
            accessibilityLabel="Back to photos"
          />
          {selectedPhoto && (
            <View style={styles.viewerContent}>
              <Image source={{ uri: selectedPhoto }} style={styles.viewerImage} resizeMode="contain" />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  lockedContainer: {
    flex: 1,
    padding: spacing.sm,
    paddingTop: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  addBtn: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#1c1c1e",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2c2c2e",
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#251414",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#5a2222",
  },
  compareActiveBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  galleryScroll: {
    paddingBottom: 80,
  },
  columnWrapper: {
    gap: GAP,
    marginBottom: GAP,
    justifyContent: "flex-start",
  },
  emptyState: {
    marginTop: 60,
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    color: colors.textDim,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 24,
  },
  emptyAddBtn: {
    backgroundColor: "#1c1c1e",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2c2c2e",
  },
  emptyAddBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  vaultLocked: {
    alignItems: "center",
    padding: 30,
    backgroundColor: "#161616",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#2c2c2e",
    borderStyle: "dashed",
    marginTop: 20,
  },
  vaultLockedIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1c1c1e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#333",
  },
  vaultLockedDesc: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  vaultLockedCta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 10,
  },
  vaultLockedCtaText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  fab: {
    position: "absolute",
    bottom: 100,
    end: 30,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 10,
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
  },
  // viewerClose removed — ViewerBackButton owns the dismiss control now.
  viewerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImage: {
    width: "100%",
    height: "80%",
  },
});
