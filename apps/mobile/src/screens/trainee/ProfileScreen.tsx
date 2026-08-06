import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { ScreenShell } from "../../components/ScreenShell";
import { ToastService } from "../../components/Toast";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/tokens";
import { auth } from "../../config/firebase";
import { logOut } from "../../services/auth";
import { saveUserProfile, uploadProfileImage } from "../../services/userSession";
import type { SessionState } from "../../state/types";
import { useProfileOverview } from "../../features/profile/hooks/useProfileOverview";
import {
  ProfileAccountPanel,
  ProfileBioSection,
  ProfileHero,
  ProfileProgressPanel,
} from "../../features/profile/components/ProfileSections";

export function ProfileScreen({ session }: { session: SessionState }) {
  const {
    profile,
    isLoading,
    totalVolume,
    weeklyWorkouts,
    streakDays,
    weeklyCharts,
    weeklyTotals,
    completionPercent,
  } = useProfileOverview();

  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [tempName, setTempName] = useState("");
  const [tempBio, setTempBio] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation();

  useEffect(() => {
    setTempName(profile?.name || auth.currentUser?.displayName || "");
  }, [profile?.name]);

  useEffect(() => {
    setTempBio(profile?.bio || "");
  }, [profile?.bio]);

  useEffect(() => {
    if (!isLoading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }).start();
    }
  }, [fadeAnim, isLoading]);

  const handleLogout = () => {
    ToastService.confirm({
      title: "Sign out",
      message: "Are you sure you want to leave Fytrak?",
      confirmLabel: "Sign out",
      destructive: true,
      onConfirm: async () => {
        try {
          await logOut();
          ToastService.info("Signed out", "Your Fytrak session has been closed.");
        } catch (error) {
          ToastService.error("Sign out failed", error instanceof Error ? error.message : "Please try again.");
        }
      },
    });
  };

  const handleUpdateName = async () => {
    const cleanName = tempName.trim();
    if (!auth.currentUser || !cleanName) {
      setIsEditingName(false);
      return;
    }

    try {
      await saveUserProfile(auth.currentUser.uid, { name: cleanName });
      setIsEditingName(false);
      ToastService.success("Profile updated", "Your identity is up to date.");
    } catch (error) {
      ToastService.error("Update failed", "Could not update your name.");
    }
  };

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        ToastService.error("Permission needed", "Photo access is required to update your profile image.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.65,
      });

      if (!result.canceled && auth.currentUser) {
        setIsUploadingImage(true);
        await uploadProfileImage(auth.currentUser.uid, result.assets[0].uri);
        ToastService.success("Photo updated", "Your profile now feels more personal.");
      }
    } catch (error) {
      ToastService.error("Upload failed", "Could not update your profile photo.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleUpdateBio = async () => {
    if (!auth.currentUser) {
      setIsEditingBio(false);
      return;
    }

    try {
      await saveUserProfile(auth.currentUser.uid, { bio: tempBio.trim() });
      setIsEditingBio(false);
      ToastService.success("Bio updated", "Your athlete statement is now sharper.");
    } catch (error) {
      ToastService.error("Update failed", "Could not update your bio.");
    }
  };

  const handleShareProfile = () => {
    ToastService.info("Share profile", "Share profile is coming soon.");
  };

  return (
    <ScreenShell
      title="Profile"
      subtitle={session.selectedCoachName ? "Identity, progress and coach connection" : "Identity, progress and account control"}
      leftActionIcon="arrow-back"
      onLeftAction={() => navigation.goBack()}
      contentStyle={styles.shellContent}
    >
      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={{ opacity: fadeAnim }}
        >
          <ProfileHero
            profile={profile}
            name={tempName}
            streakDays={streakDays}
            weeklyWorkouts={weeklyWorkouts}
            totalVolume={totalVolume}
            isEditingName={isEditingName}
            onNameChange={setTempName}
            onSaveName={() => void handleUpdateName()}
            onEditName={() => setIsEditingName(true)}
            onPickImage={() => void handlePickImage()}
            onShareProfile={handleShareProfile}
          />

          {isUploadingImage ? (
            <View style={styles.uploading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}

          <ProfileBioSection
            bio={profile?.bio}
            isEditing={isEditingBio}
            value={tempBio}
            onChange={setTempBio}
            onEdit={() => setIsEditingBio(true)}
            onSave={() => void handleUpdateBio()}
          />

          <ProfileProgressPanel
            weeklyCharts={weeklyCharts}
            weeklyTotals={weeklyTotals}
          />

          <ProfileAccountPanel
            profile={profile}
            onLogout={handleLogout}
          />
        </Animated.ScrollView>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  shellContent: {
    paddingBottom: 0,
    marginTop: spacing.md,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing["4xl"],
  },
  uploading: {
    marginTop: -spacing.sm,
    alignItems: "center",
  },
});
