import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Dimensions,
  Image,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { Typography } from './Typography';
import { ExerciseLibraryItem, t } from '../constants/exercises';
import { getExerciseVideoLink } from '../utils/videoLinks';

type Props = {
  exercise: ExerciseLibraryItem | null;
  isVisible: boolean;
  onClose: () => void;
  primaryActionLabel?: string;
  onPrimaryAction?: (exercise: ExerciseLibraryItem) => void;
};

export function ExerciseDetailSheet({ exercise, isVisible, onClose, primaryActionLabel, onPrimaryAction }: Props) {
  const { height: windowHeight } = Dimensions.get("window");
  const [videoError, setVideoError] = useState<string | null>(null);

  const videoLink = useMemo(() => {
    return getExerciseVideoLink(exercise?.videoUrl);
  }, [exercise]);

  useEffect(() => {
    setVideoError(null);
  }, [exercise?.id]);

  if (!exercise) return null;

  const openVideo = async () => {
    if (!videoLink) return;

    setVideoError(null);
    try {
      await WebBrowser.openBrowserAsync(videoLink.watchUrl);
    } catch {
      setVideoError("Could not open the video. Please try again.");
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { height: windowHeight * 0.9 }]}>
          
          <View style={styles.handleContainer}>
             <View style={styles.handle} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

            <View style={styles.videoContainer}>
              {videoLink ? (
                <Pressable style={styles.videoPreview} onPress={openVideo}>
                  {videoLink.thumbnailUrl ? (
                    <Image source={{ uri: videoLink.thumbnailUrl }} style={styles.videoThumbnail} resizeMode="cover" />
                  ) : (
                    <View style={styles.videoPlaceholder}>
                      <Ionicons name="film" size={44} color={colors.primary} />
                    </View>
                  )}
                  <View style={styles.videoScrim} />
                  <View style={styles.playButton}>
                    <Ionicons name="play" size={32} color="#000" />
                  </View>
                  <View style={styles.videoCaption}>
                    <Typography variant="label" color="#fff">Video demonstration</Typography>
                    <Text style={styles.videoCaptionText}>
                      {videoLink.isYouTube ? "Open on YouTube" : "Open video"}
                    </Text>
                  </View>
                </Pressable>
              ) : (
                <View style={styles.videoPlaceholder}>
                  <Ionicons name="videocam-off" size={48} color="#333" />
                  <Typography variant="label" color={colors.textDim}>No video available</Typography>
                </View>
              )}
            </View>

            <View style={styles.body}>
              <View style={styles.exerciseHeader}>
                <Typography variant="h1" style={styles.title}>{t(exercise.name)}</Typography>
                <View style={styles.tagRow}>
                  <View style={styles.pill}><Text style={styles.pillText}>{exercise.muscleGroup.toUpperCase()}</Text></View>
                  <View style={[styles.pill, styles.secondaryPill]}><Text style={styles.secondaryPillText}>{exercise.equipment.toUpperCase()}</Text></View>
                </View>
                {videoError ? <Text style={styles.errorText}>{videoError}</Text> : null}
              </View>

              <View style={styles.section}>
                <Typography variant="h2" style={styles.sectionTitle}>Instructions</Typography>
                {exercise.instructions && exercise.instructions.length > 0 ? (
                  exercise.instructions.map((inst, idx) => (
                    <View key={idx} style={styles.stepRow}>
                      <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{idx + 1}</Text></View>
                      <Text style={styles.stepText}>{t(inst)}</Text>
                    </View>
                  ))
                ) : (
                  <Typography variant="label" color={colors.textMuted}>No instructions provided for this exercise.</Typography>
                )}
              </View>

              <View style={styles.section}>
                <Typography variant="h2" style={styles.sectionTitle}>Target Areas</Typography>
                <View style={styles.muscleMapPlaceholder}>
                   <Ionicons name="body" size={32} color={colors.primary} />
                   <View style={styles.muscleInfo}>
                      <Typography variant="h2" style={{ fontSize: 16 }}>Primary: {exercise.muscleGroup}</Typography>
                      <Typography variant="label" color={colors.textMuted}>Mechanics: {exercise.mechanicsType || 'N/A'}</Typography>
                   </View>
                </View>
              </View>
            </View>
          </ScrollView>

          {onPrimaryAction ? (
            <View style={styles.actionDock}>
              <Pressable style={styles.primaryActionButton} onPress={() => onPrimaryAction(exercise)}>
                <Ionicons name="add" size={20} color={colors.primaryText} />
                <Text style={styles.primaryActionText}>{primaryActionLabel || "Add to workout"}</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.surfaceInset,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  videoPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoThumbnail: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  videoScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  playButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingStart: 4,
  },
  videoCaption: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 16,
  },
  videoCaptionText: {
    color: '#cfcfcf',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  exerciseHeader: {
    gap: 10,
  },
  title: {
    fontSize: 26,
    color: '#fff',
    lineHeight: 32,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  secondaryPill: {
    backgroundColor: colors.surfaceInset,
    borderWidth: 1,
    borderColor: colors.surfaceInset,
  },
  pillText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '900',
  },
  secondaryPillText: {
    color: '#d6d6d6',
    fontSize: 11,
    fontWeight: '900',
  },
  body: {
    padding: 20,
    gap: 28,
  },
  errorText: {
    color: '#ff7777',
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    letterSpacing: 0.5,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
  },
  stepText: {
    flex: 1,
    color: '#ccc',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  muscleMapPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 16,
    gap: 20,
    borderWidth: 1,
    borderColor: colors.surfaceInset,
  },
  muscleInfo: {
    gap: 4,
  },
  closeBtn: {
    position: 'absolute',
    top: 18,
    end: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 22,
    backgroundColor: 'rgba(10,10,10,0.96)',
    borderTopWidth: 1,
    borderTopColor: colors.surfaceInset,
  },
  primaryActionButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryActionText: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  }
});
