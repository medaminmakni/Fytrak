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
import { 
  subscribeToUserProfile, 
  subscribeToCoachTrainees, 
  subscribeToCoachTemplates, 
  saveUserProfile, 
  uploadProfileImage 
} from "../../services/userSession";
import type { SessionState } from "../../state/types";
import {
  ProfileAccountPanel,
  ProfileBioSection,
  CoachProfileHero,
  CoachExpertiseSection,
} from "../../features/profile/components/ProfileSections";

export function CoachProfileScreen({ session }: { session: SessionState }) {
  const navigation = useNavigation<any>();
  const [profile, setProfile] = useState<any>(null);
  const [traineeCount, setTraineeCount] = useState(0);
  const [templateCount, setTemplateCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [tempName, setTempName] = useState("");
  const [tempBio, setTempBio] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsubProfile = subscribeToUserProfile(user.uid, (data) => {
      setProfile(data);
      setIsLoading(false);
    });

    const unsubTrainees = subscribeToCoachTrainees(user.uid, (data) => {
      setTraineeCount(data.length);
    });

    const unsubTemplates = subscribeToCoachTemplates(user.uid, null, (data) => {
      setTemplateCount(data.length);
    });

    return () => {
      unsubProfile();
      unsubTrainees();
      unsubTemplates();
    };
  }, []);

  useEffect(() => {
    setTempName(profile?.name || auth.currentUser?.displayName || "");
  }, [profile?.name]);

  useEffect(() => {
    setTempBio(profile?.coachProfile?.bio || "");
  }, [profile?.coachProfile?.bio]);

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
      // Need to merge with existing coachProfile
      const updatedCoachProfile = {
        ...profile?.coachProfile,
        bio: tempBio.trim()
      };
      await saveUserProfile(auth.currentUser.uid, { coachProfile: updatedCoachProfile });
      setIsEditingBio(false);
      ToastService.success("Bio updated", "Your professional bio is now sharper.");
    } catch (error) {
      ToastService.error("Update failed", "Could not update your bio.");
    }
  };

  return (
    <ScreenShell
      title="Profile"
      subtitle="Professional identity and settings"
      contentStyle={styles.shellContent}
      rightActionIcon="settings-outline"
      onRightAction={() => ToastService.info("Settings", "App settings coming soon.")}
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
          <CoachProfileHero
            profile={profile}
            name={tempName}
            traineeCount={traineeCount}
            templateCount={templateCount}
            experience={profile?.coachProfile?.experience ?? 0}
            isEditingName={isEditingName}
            onNameChange={setTempName}
            onSaveName={() => void handleUpdateName()}
            onEditName={() => setIsEditingName(true)}
            onPickImage={() => void handlePickImage()}
          />

          {isUploadingImage ? (
            <View style={styles.uploading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}

          <ProfileBioSection
            bio={profile?.coachProfile?.bio}
            isEditing={isEditingBio}
            value={tempBio}
            onChange={setTempBio}
            onEdit={() => setIsEditingBio(true)}
            onSave={() => void handleUpdateBio()}
          />

          <CoachExpertiseSection 
            specialties={profile?.coachProfile?.specialties} 
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
