/**
 * useProgressPhotos — Subscribes to progress photos and provides CRUD handlers.
 * Extracts photo management logic from ProgressScreen.
 */
import { ToastService } from "../components/Toast";
import { useCallback, useState, useEffect } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  subscribeToProgressPhotos,
  saveProgressPhoto,
  deleteProgressPhoto,
  type ProgressPhoto,
} from "../services/profileService";
import { uploadProgressPhoto } from "../services/cloudinaryUpload";
import { subscribeWithCache } from "../data/subscriptions/subscriptionCache";
import { useCurrentUser } from "./useCurrentUser";
import { useUserProfile } from "./useUserProfile";
import { clientDateFields, resolveClientDateContext } from "../utils/dateKeys";

export function useProgressPhotos() {
  const uid = useCurrentUser();
  const { profile } = useUserProfile();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!uid) return;
    // Cached: both DailyTab and PhotosTab consume this hook and ProgressScreen
    // keeps every tab mounted, so this was two identical listeners.
    const unsubscribe = subscribeWithCache<ProgressPhoto[]>(
      `progressPhotos:${uid}`,
      (emit) => subscribeToProgressPhotos(uid, emit),
      setPhotos
    );
    return unsubscribe;
  }, [uid]);

  /**
   * Uploads the day's photo and records its metadata.
   *
   * The two failure modes are reported separately on purpose. If the upload
   * fails nothing was stored. If the upload succeeded but the metadata write
   * failed, the image IS already on the media provider — telling the client
   * "failed to upload" would be false, and they deserve to know a copy exists.
   */
  const handleCapture = useCallback(async (uri: string) => {
    if (!uid) return;
    if (!uri) {
      ToastService.error("No photo selected", "Nothing was captured, so nothing was saved.");
      return;
    }

    let uploadedUrl: string | null = null;
    try {
      setIsSaving(true);

      try {
        const result = await uploadProgressPhoto(uri);
        uploadedUrl = result.secureUrl;
      } catch (error) {
        console.error("[ProgressPhotos] Upload failed:", error);
        ToastService.error("Upload failed", "The photo could not be uploaded. Nothing was saved — please try again.");
        return;
      }

      try {
        // Writing to today's client-local date key replaces the day's photo
        // rather than adding a second document — one photo per client day.
        await saveProgressPhoto(uid, {
          url: uploadedUrl,
          ...clientDateFields(resolveClientDateContext(profile?.timezone)),
          type: "front",
        });
      } catch (error) {
        console.error("[ProgressPhotos] Metadata write failed:", error);
        ToastService.error("Photo not saved", "The image uploaded but we could not record it, so it will not appear in your progress. Please try again.");
        return;
      }

      ToastService.success("Saved", "Today's progress photo is saved.");
    } finally {
      setIsSaving(false);
    }
  }, [uid, profile?.timezone]);

  const handlePickFromLibrary = useCallback(async () => {
    const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      // Previously a silent return, which looked like the app had frozen.
      ToastService.error("Photo access needed", canAskAgain
          ? "Fytrak needs access to your photos to add a progress photo. You can also use the camera instead."
          : "Photo access is turned off. Enable it in Settings, or use the camera instead.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
    });

    // Guards both cancellation and an empty//malformed asset list, either of
    // which previously risked reading `assets[0].uri` off undefined.
    if (result.canceled) return;
    const pickedUri = result.assets?.[0]?.uri;
    if (!pickedUri) {
      ToastService.error("No photo selected", "Nothing was captured, so nothing was saved.");
      return;
    }
    handleCapture(pickedUri);
  }, [handleCapture]);

  const handlePickPhoto = useCallback((openCamera: () => void) => {
    ToastService.choose({
      title: "Add a progress photo",
      message: "Take a new one, or pick an existing photo.",
      options: [
        // "Ghost Overlay" named an implementation detail the user had never
        // seen. The alignment guide is now an opt-in control inside the camera.
        { label: "Take a photo", onPress: openCamera },
        { label: "Choose from gallery", onPress: handlePickFromLibrary },
      ],
    });
  }, [handlePickFromLibrary]);

  const handleDeleteSelected = useCallback((
    selectedIds: string[],
    onComplete?: (result: { removedIds: string[]; failedIds: string[] }) => void
  ) => {
    if (!uid || selectedIds.length === 0) return;

    ToastService.confirm({
      title: selectedIds.length === 1 ? "Delete this photo?" : `Delete ${selectedIds.length} photos?`,
      message: "This removes them from your progress. It cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
          // Deletion failures used to be swallowed, so a photo that was still
          // there looked deleted. Each one is attempted independently and the
          // outcome is reported honestly.
          //
          // This removes the Firestore record only. The uploaded image remains
          // on the media provider — removing the bytes needs an authenticated
          // admin call that cannot be made from an untrusted client, so the
          // wording below never claims the image itself is gone.
          setIsSaving(true);
          const failed: string[] = [];
          const removed: string[] = [];
          for (const id of selectedIds) {
            try {
              await deleteProgressPhoto(uid, id);
              removed.push(id);
            } catch (error) {
              console.error("[ProgressPhotos] Delete failed:", id, error);
              failed.push(id);
            }
          }
          setIsSaving(false);
          onComplete?.({ removedIds: removed, failedIds: failed });

          if (failed.length === 0) {
            ToastService.success("Removed", selectedIds.length === 1
                ? "The photo was removed from your progress."
                : `${selectedIds.length} photos were removed from your progress.`);
            return;
          }
          ToastService.error("Some photos were not removed", `${failed.length} of ${selectedIds.length} could not be removed. Please try again.`);
      },
    });
  }, [uid]);

  return {
    photos,
    isSaving,
    handleCapture,
    handlePickFromLibrary,
    handlePickPhoto,
    handleDeleteSelected,
  };
}
