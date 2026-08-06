import { ToastService } from "./Toast";
import { useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Image,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors } from "../theme/colors";
import { iconSize, radius, spacing, touchTarget, typography } from "../theme/tokens";

interface ProgressCameraProps {
  onCapture: (uri: string) => void;
  onClose: () => void;
  /**
   * The previous progress photo, shown faintly behind the viewfinder so the new
   * shot can be lined up with it. Optional, and off until the user asks for it.
   */
  overlayUri?: string;
}

/** Fixed steps rather than a free slider — this is an alignment aid, not a filter. */
const GHOST_OPACITY_STEPS = [0.2, 0.35, 0.5] as const;

export function ProgressCamera({ onCapture, onClose, overlayUri }: ProgressCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [facing, setFacing] = useState<"back" | "front">("back");

  /*
   * The alignment guide starts OFF.
   *
   * It used to render at 20% the moment the camera opened, with no label and no
   * way to switch it off — only a bare +/- stepper that took ten taps to reach
   * zero. So the first thing you saw on opening the camera was a translucent
   * copy of your last photo hanging in the viewfinder, which reads as the
   * camera failing to clear its buffer rather than as a feature. Opt-in, with
   * the control named.
   */
  const [isGuideVisible, setIsGuideVisible] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  const cameraRef = useRef<CameraView>(null);
  const showGuide = Boolean(overlayUri) && isGuideVisible;

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    const requestOrOpenSettings = () => {
      if (permission.canAskAgain) {
        void requestPermission();
      } else {
        void Linking.openSettings();
      }
    };
    return (
      <View style={[styles.container, styles.permissionContainer]}>
        <Text style={styles.message}>Fytrak needs camera access to take progress photos.</Text>
        <Pressable style={styles.permissionButton} onPress={requestOrOpenSettings}>
          <Text style={styles.permissionButtonText}>
            {permission.canAskAgain ? "Grant permission" : "Open settings"}
          </Text>
        </Pressable>
        <Pressable
          style={styles.permissionClose}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close camera"
          hitSlop={12}
        >
          <Ionicons name="close" size={iconSize.lg} color={colors.text} />
        </Pressable>
      </View>
    );
  }

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      // Fire and forget: a device without a haptic motor rejects here, and an
      // unhandled rejection should not be the cost of taking a photo.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        shutterSound: true,
      });
      if (photo) onCapture(photo.uri);
    } catch (error) {
      console.error("[ProgressCamera] Capture failed:", error);
      ToastService.error("Camera error", "The photo could not be captured. Try again, or import one from your gallery.");
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <View style={styles.container}>
      {/*
        The viewfinder, the guide and the controls are siblings in an absolute
        stack rather than children of CameraView. On Android the preview is a
        native surface, and compositing a translucent Image *inside* it is what
        made the guide flicker and smear as the preview updated. Layering above
        it in the React view hierarchy composites cleanly.
      */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        onMountError={(error) => console.error("[ProgressCamera] Mount error:", error)}
      />

      {showGuide && overlayUri ? (
        // Wrapped so the layer can opt out of touches and of the accessibility
        // tree: Image takes neither prop directly.
        <View
          style={styles.guide}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Image
            source={{ uri: overlayUri }}
            style={[styles.guideImage, { opacity: GHOST_OPACITY_STEPS[guideStep] }]}
            resizeMode="cover"
          />
        </View>
      ) : null}

      <SafeAreaView style={styles.controls} edges={["top", "bottom"]}>
        <View style={styles.topRow}>
          <Pressable
            style={styles.iconButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close camera"
          >
            <Ionicons name="close" size={iconSize.lg} color={colors.text} />
          </Pressable>

          <Pressable
            style={styles.iconButton}
            onPress={() => setFacing((previous) => (previous === "back" ? "front" : "back"))}
            accessibilityRole="button"
            accessibilityLabel={
              facing === "back" ? "Switch to front camera" : "Switch to back camera"
            }
          >
            <Ionicons name="camera-reverse" size={iconSize.lg} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.bottomRow}>
          {overlayUri ? (
            <View style={styles.guideBar}>
              <Pressable
                style={styles.guideToggle}
                onPress={() => setIsGuideVisible((previous) => !previous)}
                accessibilityRole="switch"
                accessibilityState={{ checked: showGuide }}
                accessibilityLabel="Align with last photo"
                accessibilityHint="Shows your previous photo faintly behind the viewfinder"
              >
                <Ionicons
                  name={showGuide ? "layers" : "layers-outline"}
                  size={iconSize.md}
                  color={showGuide ? colors.primary : colors.text}
                />
                <Text style={[styles.guideLabel, showGuide && styles.guideLabelActive]}>
                  Align with last photo
                </Text>
              </Pressable>

              {showGuide ? (
                <Pressable
                  style={styles.guideStepButton}
                  onPress={() =>
                    setGuideStep((previous) => (previous + 1) % GHOST_OPACITY_STEPS.length)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Guide strength ${Math.round(
                    GHOST_OPACITY_STEPS[guideStep] * 100,
                  )} percent. Tap to change.`}
                >
                  <Text style={styles.guideStepText}>
                    {Math.round(GHOST_OPACITY_STEPS[guideStep] * 100)}%
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.shutterRing}>
            <Pressable
              style={styles.shutterButton}
              onPress={() => void takePicture()}
              disabled={isCapturing}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              accessibilityState={{ disabled: isCapturing, busy: isCapturing }}
            >
              {isCapturing ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

/** Scrim behind the controls. Not a palette colour — it sits on a live preview. */
const CONTROL_SCRIM = "rgba(0, 0, 0, 0.55)";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  permissionContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["3xl"],
    gap: spacing.lg,
  },
  guide: {
    ...StyleSheet.absoluteFillObject,
  },
  guideImage: {
    width: "100%",
    height: "100%",
  },
  controls: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: spacing.xl,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.lg,
  },
  bottomRow: {
    alignItems: "center",
    gap: spacing.xl,
    paddingBottom: spacing["3xl"],
  },
  iconButton: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: radius.pill,
    backgroundColor: CONTROL_SCRIM,
    alignItems: "center",
    justifyContent: "center",
  },
  guideBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: CONTROL_SCRIM,
    borderRadius: radius.pill,
    paddingStart: spacing.lg,
    paddingEnd: spacing.sm,
  },
  guideToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchTarget.min,
  },
  guideLabel: {
    ...typography.label,
    color: colors.text,
  },
  guideLabelActive: {
    color: colors.primary,
  },
  guideStepButton: {
    minWidth: touchTarget.min,
    minHeight: touchTarget.min,
    alignItems: "center",
    justifyContent: "center",
  },
  guideStepText: {
    ...typography.label,
    color: colors.primary,
  },
  shutterRing: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    borderWidth: 4,
    borderColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterButton: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.primaryText,
  },
  message: {
    ...typography.body,
    color: colors.text,
    textAlign: "center",
  },
  permissionButton: {
    minHeight: touchTarget.large,
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.nested,
  },
  permissionButtonText: {
    ...typography.button,
    color: colors.primaryText,
  },
  permissionClose: {
    position: "absolute",
    top: spacing["4xl"],
    end: spacing.xl,
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: "center",
    justifyContent: "center",
  },
});
