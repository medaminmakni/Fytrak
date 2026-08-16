import React, { useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Image, PanResponder, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../theme/colors';
import { radius, spacing, touchTarget, typography } from '../../../theme/tokens';
import { OnboardingHeader } from '../../../components/OnboardingHeader';
import { Typography } from '../../../components/Typography';
import { PrimaryButton } from '../../../components/Button';
import {
  HEIGHT_RANGE_CM,
  WEIGHT_RANGE_KG,
  clampHeightCm,
  clampWeightKg,
  figureScaleForHeight,
  figureWidthForWeight,
  formatHeight,
  formatWeight,
  heightUnitLabel,
  weightUnitLabel,
  type UnitSystem,
} from '../../../features/onboarding/units';

const ATHLETE_MALE = require('../../../../assets/branding/raster/male.png');
const ATHLETE_FEMALE = require('../../../../assets/branding/raster/female.png');

interface BodyMetricsStepProps {
  onNext: (data: { height: number; weight: number }) => void;
  onBack: () => void;
  /**
   * Chosen on the previous step. Null only if someone reaches this screen
   * without answering, in which case no figure is shown rather than a default
   * body being picked for them.
   */
  gender?: 'male' | 'female' | null;
}

/** Which metric the ruler is currently driving. */
type ActiveMetric = 'height' | 'weight';

/** Points of drag per unit. Tuned so a full swipe covers most of the range. */
const DRAG_SENSITIVITY = 2.2;

export function BodyMetricsStep({ onNext, onBack, gender = null }: BodyMetricsStepProps) {
  const [userHeight, setUserHeight] = useState(178);
  const [userWeight, setUserWeight] = useState(76);
  const [system, setSystem] = useState<UnitSystem>('metric');
  const [active, setActive] = useState<ActiveMetric>('height');

  /*
   * The pan reads these through refs rather than closing over state.
   *
   * `PanResponder.create` runs once, so a handler that closed over `userHeight`
   * would keep comparing against the value it had on first render — the drag
   * would snap back to the starting number on every gesture.
   */
  const heightRef = useRef(userHeight);
  const weightRef = useRef(userWeight);
  const activeRef = useRef<ActiveMetric>(active);
  heightRef.current = userHeight;
  weightRef.current = userWeight;
  activeRef.current = active;

  /** The value when the current gesture began, so drags are relative. */
  const gestureStart = useRef(0);

  const ruler = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        gestureStart.current = activeRef.current === 'height' ? heightRef.current : weightRef.current;
      },
      onPanResponderMove: (_, gs) => {
        // Dragging right increases, which matches the ruler moving under a
        // fixed centre marker.
        const delta = gs.dx / DRAG_SENSITIVITY;
        if (activeRef.current === 'height') {
          setUserHeight(clampHeightCm(gestureStart.current + delta));
        } else {
          setUserWeight(clampWeightKg(gestureStart.current + delta));
        }
      },
    })
  ).current;

  const figure = gender === 'male' ? ATHLETE_MALE : gender === 'female' ? ATHLETE_FEMALE : null;

  /*
   * The ruler's ticks, centred on the current value. Rendered from the value
   * itself rather than scrolled, so the marker stays put and the scale moves —
   * which is what makes the centre line read as "you are here".
   */
  const range = active === 'height' ? HEIGHT_RANGE_CM : WEIGHT_RANGE_KG;
  const current = active === 'height' ? userHeight : userWeight;
  const ticks = useMemo(() => {
    const span = 12;
    return Array.from({ length: span * 2 + 1 }, (_, i) => current - span + i)
      .filter((value) => value >= range.min && value <= range.max);
  }, [current, range.min, range.max]);

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingHeader onBack={onBack} progress={60} />

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Typography variant="h1" style={styles.grow}>Your physique</Typography>
          {/*
            Display only. Height is always stored in centimetres and weight in
            kilograms — converting on the way into storage would lose a little
            precision every time someone toggled.
          */}
          <View style={styles.unitToggle}>
            {(['metric', 'imperial'] as const).map((option) => {
              const isActive = system === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setSystem(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isActive }}
                  accessibilityLabel={option === 'metric' ? 'Centimetres and kilograms' : 'Feet and pounds'}
                  style={[styles.unitOption, isActive && styles.unitOptionActive]}
                >
                  <Typography
                    variant="label"
                    color={isActive ? colors.primaryText : colors.textSecondary}
                  >
                    {option === 'metric' ? 'cm' : 'ft'}
                  </Typography>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Typography variant="body" color={colors.textSecondary} style={styles.sub}>
          These two set the size of your calorie budget. Change either any time in your profile.
        </Typography>

        <View style={styles.tiles}>
          {(['height', 'weight'] as const).map((metric) => {
            const isActive = active === metric;
            const value = metric === 'height'
              ? formatHeight(userHeight, system)
              : formatWeight(userWeight, system);
            const unit = metric === 'height' ? heightUnitLabel(system) : weightUnitLabel(system);
            return (
              <Pressable
                key={metric}
                onPress={() => setActive(metric)}
                accessibilityRole="radio"
                accessibilityState={{ checked: isActive }}
                accessibilityLabel={`${metric}, ${value}${unit}. Tap to adjust with the ruler.`}
                style={[styles.tile, isActive && styles.tileActive]}
              >
                <Typography variant="label" color={isActive ? colors.primary : colors.textSecondary}>
                  {metric === 'height' ? 'HEIGHT' : 'WEIGHT'}
                </Typography>
                <View style={styles.valueRow}>
                  <Typography variant="metric" style={styles.value}>{value}</Typography>
                  {unit ? (
                    <Typography variant="label" color={colors.textSecondary}>{unit}</Typography>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.stage}>
          {figure ? (
            <Image
              source={figure}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="Figure showing your selected build"
              style={[
                styles.figure,
                {
                  transform: [
                    { scaleY: figureScaleForHeight(userHeight) },
                    { scaleX: figureWidthForWeight(userWeight) },
                  ],
                },
              ]}
            />
          ) : (
            /*
             * No gender chosen, so no figure. Picking one would be assigning
             * someone a body they did not select, on the screen that asks them
             * about their body.
             */
            <Typography variant="label" color={colors.textTertiary} style={styles.noFigure}>
              Choose a profile on the previous step to see the figure.
            </Typography>
          )}
          <Typography variant="label" color={colors.textSecondary} style={styles.hint}>
            Drag the ruler — the figure follows
          </Typography>
        </View>

        <View style={styles.ruler} {...ruler.panHandlers}>
          <View style={styles.ticks}>
            {ticks.map((value) => {
              const isMajor = value % 10 === 0;
              const isCurrent = value === current;
              return (
                <View
                  key={value}
                  style={[
                    styles.tick,
                    isMajor && styles.tickMajor,
                    isCurrent && styles.tickCurrent,
                  ]}
                />
              );
            })}
          </View>
          <View style={styles.tickLabels}>
            {ticks.filter((value) => value % 10 === 0).map((value) => (
              <Typography key={value} variant="label" color={colors.textTertiary}>
                {value}
              </Typography>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          title="Continue"
          onPress={() => onNext({ height: userHeight, weight: userWeight })}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1 },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
  },
  unitOption: {
    minWidth: 44,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitOptionActive: { backgroundColor: colors.primary },
  sub: { marginTop: -spacing.xs },

  tiles: { flexDirection: 'row', gap: spacing.md },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.xs,
    minHeight: touchTarget.large,
  },
  /* The selected tile carries the accent, because it is what the ruler drives. */
  tileActive: { backgroundColor: colors.primaryMuted },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  value: { fontVariant: ['tabular-nums'] },

  stage: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: spacing.lg,
    overflow: 'hidden',
  },
  figure: { flex: 1, width: '60%' },
  noFigure: { flex: 1, textAlign: 'center', textAlignVertical: 'center', paddingHorizontal: spacing.xl },
  hint: { marginTop: spacing.sm },

  ruler: { paddingVertical: spacing.md, gap: spacing.xs },
  ticks: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 34 },
  tick: { width: 2, height: 14, borderRadius: 1, backgroundColor: colors.surfaceInset },
  tickMajor: { height: 24, backgroundColor: colors.textTertiary },
  /* The centre of the scale, and the only accent on the ruler. */
  tickCurrent: { height: 34, backgroundColor: colors.primary },
  tickLabels: { flexDirection: 'row', justifyContent: 'space-between' },

  footer: { padding: spacing.xl, paddingBottom: spacing['4xl'] },
});
