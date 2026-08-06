import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, ActivityIndicator, Alert, Image } from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { Typography } from "../../components/Typography";
import { auth } from "../../config/firebase";
import { NutritionRing } from "../../components/NutritionRing";
import { MacroItem } from "../../components/MacroItem";
import {
  saveMealLog,
  subscribeToDailyMeals,
  deleteMealLog,
  subscribeToUserProfile,
  subscribeToPrescribedMealHistory,
  applyPrescribedMeal,
  saveNutritionIntake,
  type Meal,
  type UserProfile,
  type PrescribedMeal
} from "../../services/userSession";
import { uploadMealPhoto } from "../../services/cloudinaryUpload";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useClientDateKey } from "../../hooks/useClientDateKey";
import { ToastService } from "../../components/Toast";
import { WaterTracker } from "../../components/WaterTracker";
import { Surface } from "../../components/Surface";
import { LogMealModal } from "../../features/nutrition/components/LogMealModal";
import { NutritionIntakeForm } from "../../features/nutrition/components/NutritionIntakeForm";
import { resolvePlanDimension } from "../../features/plans/planResolution";
import {
  selectUnscheduled,
  toMealCandidates,
  type ScheduledPrescribedMeal,
} from "../../features/plans/planAdapters";

export function NutritionScreen() {
  const uid = useCurrentUser();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [prescribed, setPrescribed] = useState<PrescribedMeal[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [applyingPlanId, setApplyingPlanId] = useState<string | null>(null);
  const [isLogModalVisible, setIsLogModalVisible] = useState(false);
  const [isSavingMeal, setIsSavingMeal] = useState(false);
  const [showIntake, setShowIntake] = useState(false);
  const [isSavingIntake, setIsSavingIntake] = useState(false);
  const dateKey = useClientDateKey(profile?.timezone);

  useEffect(() => {
    if (!uid) return;

    const unsubMeals = subscribeToDailyMeals(uid, dateKey, (data) => {
      setMeals(data);
      if (profile) setIsLoading(false);
    });

    const unsubProfile = subscribeToUserProfile(uid, (data) => {
      setProfile(data);
      if (data.nutritionProfileCompleted !== true) setShowIntake(true);
      setIsLoading(false);
    });

    const unsubPrescribed = subscribeToPrescribedMealHistory(uid, (data) => {
      setPrescribed(data);
    });

    return () => {
      unsubMeals(); unsubProfile(); unsubPrescribed();
    };
    // `profile` is intentionally not a dependency: it is set *by* this effect,
    // so including it re-subscribes every listener on first load. uid and
    // dateKey are the only real inputs — dateKey so the meal list rolls over
    // at midnight rather than pinning to the day the screen was opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, dateKey]);

  const targets = useMemo(() => profile?.macroTargets || { calories: 2100, protein: 160, carbs: 220, fats: 65 }, [profile]);

  const totals = useMemo(() => meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + (meal.calories || 0),
      protein: acc.protein + (meal.protein || 0),
      carbs: acc.carbs + (meal.carbs || 0),
      fats: acc.fats + (meal.fats || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  ), [meals]);

  const scheduledMeals = prescribed as ScheduledPrescribedMeal[];
  const todayNutritionPlan = useMemo(
    () => resolvePlanDimension({
      dateKey,
      dailyCandidates: toMealCandidates(scheduledMeals),
    }),
    [dateKey, prescribed]
  );
  const unscheduledPlans = useMemo(
    () => selectUnscheduled(scheduledMeals).filter((plan) => plan.isApplied !== true),
    [prescribed]
  );
  const visibleCoachPlan = todayNutritionPlan.sourceType === "daily"
    ? todayNutritionPlan.payload
    : unscheduledPlans[0] ?? null;

  const handleSaveIntake = async (data: any) => {
    if (!auth.currentUser) return;
    try {
      setIsSavingIntake(true);
      await saveNutritionIntake(auth.currentUser.uid, data);
      setShowIntake(false);
    } catch (e) {
      ToastService.error("Error", "Failed to save nutrition details.");
    } finally {
      setIsSavingIntake(false);
    }
  };

  const handleSaveMeal = async (data: any) => {
    if (!uid) return;

    try {
      setIsSavingMeal(true);
      let imageUrl: string | undefined;
      if (data.imageUri) {
        const result = await uploadMealPhoto(data.imageUri);
        imageUrl = result.secureUrl;
      }
      await saveMealLog(uid, {
        name: data.name,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fats: data.fats,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        ...(imageUrl && { imageUrl }),
      }, profile?.timezone);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error(error);
      ToastService.error("Error", "Failed to log meal.");
    } finally {
      setIsSavingMeal(false);
    }
  };

  const handleDeleteMeal = (id: string, name: string) => {
    ToastService.confirm({
      title: "Delete this meal?",
      message: `"${name}" will be removed from today's log.`,
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
        if (auth.currentUser) await deleteMealLog(auth.currentUser.uid, id);
      },
    });
  };

  const handleApplyCoachPlan = async (plan: PrescribedMeal) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      setApplyingPlanId(plan.id);
      await applyPrescribedMeal(uid, plan.id, plan.macros);
      ToastService.success("Success", "Daily macro targets updated based on your coach's plan.");
    } catch (error) { console.error(error); ToastService.error("Error", "Failed to apply plan."); }
    finally { setApplyingPlanId(null); }
  };

  if (showIntake) {
    return (
      <ScreenShell title="Nutrition" subtitle="Medical and lifestyle intake" contentStyle={styles.shellContent}>
        <NutritionIntakeForm onSave={handleSaveIntake} isSaving={isSavingIntake} />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell title="Nutrition" subtitle="Track your macros" contentStyle={styles.shellContent}>
        {isLoading ? <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View> : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            
            {/* 1. NUTRITION SUMMARY */}
            <Surface style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <View style={{ flex: 1 }}>
                  <Typography variant="label" color={colors.textMuted}>CALORIE INTAKE</Typography>
                  <Typography variant="metric" style={styles.largeMetric}>
                    {totals.calories} <Typography style={styles.metricSub}>/ {targets.calories} kcal</Typography>
                  </Typography>
                </View>
                <NutritionRing current={totals.calories} target={targets.calories} />
              </View>
              <View style={styles.macrosRow}>
                <MacroItem label="Protein" current={totals.protein} target={targets.protein} color={colors.success} icon="flash" />
                <MacroItem label="Carbs" current={totals.carbs} target={targets.carbs} color={colors.primary} icon="restaurant" />
                <MacroItem label="Fats" current={totals.fats} target={targets.fats} color={colors.danger} icon="water" />
              </View>
            </Surface>

            {/* 2. WATER TRACKER */}
            <WaterTracker />

            {/* 3. COACH PRESCRIPTION BANNER */}
            {(profile?.isPremium || profile?.assignmentStatus === "assigned") && visibleCoachPlan && (
              <View style={styles.coachBanner}>
                <View style={styles.bannerHeader}>
                  <Ionicons name="sparkles" size={18} color={colors.primary} />
                  <Typography variant="label" color={colors.primary} style={{ fontWeight: '900' }}>
                    {todayNutritionPlan.sourceType === "daily" ? "TODAY'S COACH PLAN" : "UNSCHEDULED COACH PLAN"}
                  </Typography>
                </View>
                <Typography variant="h2" style={styles.bannerTitle}>{visibleCoachPlan.title}</Typography>
                <View style={styles.bannerMacros}>
                  <MacroStat val={visibleCoachPlan.macros.calories} label="KCALS" />
                  <MacroStat val={visibleCoachPlan.macros.protein} label="PRO" />
                  <MacroStat val={visibleCoachPlan.macros.carbs} label="CARBS" />
                </View>
                <Pressable
                  style={styles.applyBtn}
                  onPress={() => handleApplyCoachPlan(visibleCoachPlan)}
                  disabled={!!applyingPlanId || visibleCoachPlan.isApplied === true}
                >
                  {applyingPlanId === visibleCoachPlan.id
                    ? <ActivityIndicator size="small" color="#000" />
                    : <><Typography style={styles.applyBtnText}>{visibleCoachPlan.isApplied ? "TARGETS APPLIED" : "APPLY TARGETS"}</Typography><Ionicons name="checkmark-circle" size={18} color="#000" /></>}
                </Pressable>
              </View>
            )}

            {/* 4. LOG ACTION */}
            <Pressable 
              style={styles.mainLogBtn} 
              onPress={() => setIsLogModalVisible(true)}
            >
              <View style={styles.mainLogBtnContent}>
                <View style={styles.logIconCircle}>
                  <Ionicons name="add" size={24} color={colors.primaryText} />
                </View>
                <View>
                  <Typography variant="h2" style={{ fontSize: 18, marginBottom: 2 }}>Log a Meal</Typography>
                  <Typography variant="label" color={colors.textDim}>Add entries to your daily diary</Typography>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.borderSubtle} />
            </Pressable>

            {/* 5. HISTORY SECTION */}
            <View style={styles.historySection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="list" size={18} color={colors.primary} />
                <Typography variant="h2" style={{ fontSize: 16 }}>Today's Log</Typography>
              </View>
              {meals.length === 0 ? (
                <View style={styles.emptyHistory}>
                  <Ionicons name="restaurant-outline" size={32} color={colors.borderStrong} />
                  <Typography variant="label" color={colors.textDim} style={{ marginTop: 10 }}>No meals logged yet today</Typography>
                </View>
              ) : (
                meals.map((meal) => (
                  <Pressable key={meal.id} style={styles.mealItem} onLongPress={() => handleDeleteMeal(meal.id, meal.name)}>
                    {(meal as any).imageUrl ? (
                      <Image source={{ uri: (meal as any).imageUrl }} style={styles.mealThumb} />
                    ) : (
                      <View style={styles.mealIcon}><Ionicons name="fast-food" size={20} color={colors.primary} /></View>
                    )}
                    <View style={styles.mealInfo}>
                      <Typography variant="h2" style={styles.mealName}>{meal.name}</Typography>
                      <Typography variant="label" color={colors.textFaint} style={{ fontSize: 11 }}>{meal.time}</Typography>
                    </View>
                    <View style={styles.mealStats}>
                      <Typography variant="h2" style={styles.mealCalories}>{meal.calories} <Typography style={{ fontSize: 11, color: colors.textFaint }}>kcal</Typography></Typography>
                      <Typography variant="label" color={colors.success} style={{ fontSize: 11, fontWeight: '900' }}>{meal.protein}g Protein</Typography>
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </ScreenShell>

      <LogMealModal
        visible={isLogModalVisible}
        onClose={() => setIsLogModalVisible(false)}
        onSave={handleSaveMeal}
        isSaving={isSavingMeal}
      />
    </>
  );
}

function MacroStat({ val, label }: any) {
  return (
    <View style={styles.bannerMacroItem}>
        <Typography style={styles.macroValText}>{val}</Typography>
        <Typography style={styles.macroLabelText}>{label}</Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  shellContent: { paddingBottom: 0 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingBottom: 120, gap: spacing.lg },
  
  // Geometry now comes from <Surface>; only the layout the card needs remains.
  summaryCard: { gap: 24, marginTop: 10 },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 20 },
  largeMetric: { fontSize: 32 },
  metricSub: { fontSize: 14, color: colors.textFaint },
  macrosRow: { flexDirection: "row", gap: spacing.md },

  coachBanner: { backgroundColor: colors.bgElevated, padding: spacing.xl, borderRadius: radius["2xl"], borderWidth: 1, borderColor: colors.primary, gap: 12 },
  bannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerTitle: { fontSize: 20 },
  bannerMacros: { flexDirection: 'row', gap: 12, backgroundColor: colors.bgDark, padding: spacing.md, borderRadius: radius.md },
  bannerMacroItem: { flex: 1, alignItems: 'center' },
  macroValText: { fontSize: 16, fontWeight: '900', color: colors.primary },
  macroLabelText: { fontSize: 11, color: colors.textFaint, fontWeight: '900' },
  applyBtn: { height: 50, backgroundColor: colors.primary, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 4 },
  applyBtnText: { color: colors.primaryText, fontWeight: '900', fontSize: 13 },

  mainLogBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgElevated, padding: spacing.lg, borderRadius: radius["2xl"], borderWidth: 1, borderColor: colors.borderStrong, justifyContent: 'space-between' },
  mainLogBtnContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  logIconCircle: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },

  historySection: { gap: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginStart: 4 },
  emptyHistory: { height: 140, backgroundColor: colors.bgDark, borderRadius: radius["2xl"], alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSubtle, borderStyle: 'dashed' },
  
  mealItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgElevated, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, gap: spacing.md },
  mealThumb: { width: 50, height: 50, borderRadius: radius.md, backgroundColor: colors.bgDark },
  mealIcon: { width: 50, height: 50, borderRadius: radius.md, backgroundColor: colors.bgDark, alignItems: 'center', justifyContent: 'center' },
  mealInfo: { flex: 1, gap: 2 },
  mealName: { fontSize: 15 },
  mealStats: { alignItems: 'flex-end', gap: 2 },
  mealCalories: { fontSize: 16, fontWeight: '900' },
});
