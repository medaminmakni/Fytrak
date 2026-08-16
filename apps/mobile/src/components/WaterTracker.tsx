import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Pressable, Animated, Easing, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { Typography } from './Typography';
import { Surface } from './Surface';
import * as Haptics from 'expo-haptics';
import { saveWaterIntake, setWaterIntake } from '../services/waterService';
import { useDailyWater } from '../hooks/useDailyWater';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useUserProfile } from '../hooks/useUserProfile';

type Props = {
  onLog?: (amount: number) => void;
};

export function WaterTracker({ onLog }: Props) {
  const uid = useCurrentUser();
  const { profile } = useUserProfile();
  const ml = useDailyWater(profile?.timezone);
  const [customAmount, setCustomAmount] = useState("");
  const target = 2500;
  const progress = Math.min(ml / target, 1);
  
  // Wave Animation
  const waveAnim = new Animated.Value(0);
  
  useEffect(() => {
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const handleAdd = async (amount: number) => {
    if (!uid) return;
    await saveWaterIntake(uid, amount, profile?.timezone);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onLog) onLog(amount);
  };

  const handleCustomAdd = async () => {
    const val = Number(customAmount);
    if (isNaN(val) || val <= 0) return;
    await handleAdd(val);
    setCustomAmount("");
  };

  return (
    <Surface>
      <View style={styles.header}>
        <View style={styles.titleRow}>
           <Ionicons name="water" size={18} color="#60a5fa" />
           <Typography variant="h2" style={{ fontSize: 18 }}>Hydration</Typography>
        </View>
        <View style={styles.statsCol}>
           <Typography variant="label" color="#fff" style={{ fontSize: 14, fontWeight: "900" }}>{ml} ml</Typography>
           <Typography variant="label" color={colors.textDim}>of {target}ml goal</Typography>
        </View>
      </View>

      <View style={styles.trackArea}>
         <View style={styles.glassContainer}>
            <View style={styles.glass}>
               <View style={[styles.fill, { height: `${progress * 100}%` }]}>
                  <View style={styles.waveEffect} />
               </View>
               <View style={styles.glassOverlay}>
                  <Typography variant="h2" style={{ color: progress > 0.5 ? '#fff' : colors.textDim }}>{Math.round(progress * 100)}%</Typography>
               </View>
            </View>
         </View>

         <View style={styles.actions}>
            <View style={styles.quickButtons}>
               <Pressable style={styles.quickBtn} onPress={() => handleAdd(250)}>
                  <Text style={styles.quickBtnText}>+250ml</Text>
               </Pressable>
               <Pressable style={styles.quickBtn} onPress={() => handleAdd(500)}>
                  <Text style={styles.quickBtnText}>+500ml</Text>
               </Pressable>
            </View>

            <View style={styles.customInputRow}>
               <TextInput 
                  style={styles.customInput}
                  placeholder="Custom ml..."
                  placeholderTextColor={colors.textDim}
                  keyboardType="numeric"
                  value={customAmount}
                  onChangeText={setCustomAmount}
               />
               <Pressable style={styles.addBtn} onPress={handleCustomAdd}>
                  <Ionicons name="add" size={20} color="#000" />
               </Pressable>
            </View>

            <Pressable style={styles.resetBtn} onPress={() => uid && setWaterIntake(uid, 0, profile?.timezone)}>
               <Typography variant="label" color={colors.danger} style={{ fontSize: 11, fontWeight: "900" }}>RESET PROGRESS</Typography>
            </Pressable>
         </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statsCol: {
    alignItems: 'flex-end',
  },
  trackArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  glassContainer: {
    alignItems: 'center',
  },
  glass: {
    width: 70,
    height: 110,
    backgroundColor: colors.bg,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.surfaceInset,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fill: {
    width: '100%',
    backgroundColor: '#3b82f6',
  },
  waveEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flex: 1,
    gap: 12,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: colors.surfaceInset,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceInset,
  },
  quickBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  customInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: colors.surfaceInset,
    height: 44,
  },
  addBtn: {
    width: 44,
    height: 44,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtn: {
    marginTop: 4,
    alignSelf: 'center',
  }
});
