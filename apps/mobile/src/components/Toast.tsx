import { useState, useEffect, useRef, useCallback } from 'react';
import { Animated, StyleSheet, Text, View, DeviceEventEmitter, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { iconSize, radius, spacing, touchTarget, typography } from '../theme/tokens';
import { Typography } from './Typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const ToastEvent = 'SHOW_TOAST';

type ToastType = 'success' | 'error' | 'info' | 'confirm';

export type ToastAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type ToastConfig = {
  title: string;
  message?: string;
  type?: ToastType;
  duration?: number;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDestructive?: boolean;
  /** Set by `choose`. When present these replace the confirm/cancel pair. */
  actions?: ToastAction[];
};

// Global imperative API
export const ToastService = {
  show: (config: ToastConfig) => {
    DeviceEventEmitter.emit(ToastEvent, config);
  },
  success: (title: string, message?: string) => {
    DeviceEventEmitter.emit(ToastEvent, { title, message, type: 'success' });
  },
  error: (title: string, message?: string) => {
    DeviceEventEmitter.emit(ToastEvent, { title, message, type: 'error' });
  },
  info: (title: string, message?: string) => {
    DeviceEventEmitter.emit(ToastEvent, { title, message, type: 'info' });
  },
  confirm: (opts: {
    title: string;
    message?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
  }) => {
    DeviceEventEmitter.emit(ToastEvent, {
      title: opts.title,
      message: opts.message,
      type: 'confirm' as ToastType,
      onConfirm: opts.onConfirm,
      onCancel: opts.onCancel,
      confirmLabel: opts.confirmLabel || 'Confirm',
      cancelLabel: opts.cancelLabel || 'Cancel',
      confirmDestructive: opts.destructive ?? false,
    });
  },
  /**
   * A pick-one-of-several prompt, for cases that are a choice rather than a
   * yes/no — "camera or gallery?". Dismissing runs nothing.
   */
  choose: (opts: {
    title: string;
    message?: string;
    options: ToastAction[];
    cancelLabel?: string;
  }) => {
    DeviceEventEmitter.emit(ToastEvent, {
      title: opts.title,
      message: opts.message,
      type: 'confirm' as ToastType,
      actions: opts.options,
      cancelLabel: opts.cancelLabel || 'Cancel',
    });
  },
};

const OFFSCREEN_Y = -150;
const EXIT_DURATION = 220;
const FADE_DURATION = 220;

/** One live toast. `key` changes per emission so the entrance effect re-runs. */
type ActiveToast = ToastConfig & { key: number };

let nextToastKey = 0;

const ICON_BY_TYPE: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  error: 'alert-circle',
  info: 'information-circle',
  confirm: 'help-circle',
  success: 'checkmark-circle',
};

export function Toast() {
  const [active, setActive] = useState<ActiveToast | null>(null);
  const translateY = useRef(new Animated.Value(OFFSCREEN_Y)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const callbackRef = useRef<{ onConfirm?: () => void; onCancel?: () => void }>({});

  /**
   * Slides the toast out, then runs the caller's callback.
   *
   * The order matters and used to be reversed. `onConfirm` on the sign-out
   * toast calls `logOut()`, which swaps the entire navigation tree — running
   * that first meant the exit animation was competing with a full remount and
   * visibly dropped frames. It also immediately emitted a second toast, whose
   * entrance reset these shared Animated values while the exit was still
   * running, so the card snapped instead of sliding.
   */
  const dismiss = useCallback(
    (runAfterExit?: () => void) => {
      const dismissingKey = active?.key;
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: OFFSCREEN_Y,
          duration: EXIT_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: FADE_DURATION,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        // A newer toast may have taken over mid-exit. Only tear down if the
        // toast we started dismissing is still the one on screen.
        if (!finished) return;
        setActive((current) => (current?.key === dismissingKey ? null : current));
        callbackRef.current = {};
        runAfterExit?.();
      });
    },
    [active?.key, translateY, opacity, backdropOpacity],
  );

  useEffect(() => {
    const listener = DeviceEventEmitter.addListener(ToastEvent, (data: ToastConfig) => {
      callbackRef.current = { onConfirm: data.onConfirm, onCancel: data.onCancel };
      setActive({ ...data, type: data.type || 'success', key: nextToastKey++ });
    });
    return () => listener.remove();
  }, []);

  /*
   * The entrance runs here rather than inside the event listener.
   *
   * It used to call `.start()` in the same synchronous block as
   * `setVisible(true)` — so the animation was already running against a view
   * React had not mounted yet, and the first frames were applied late. That is
   * the pop you see as the card appears. An effect runs after commit, so the
   * view exists before the first frame.
   */
  const activeKey = active?.key;
  const isConfirm = active?.type === 'confirm';
  useEffect(() => {
    if (!active) return;

    translateY.setValue(OFFSCREEN_Y);
    opacity.setValue(0);
    backdropOpacity.setValue(0);

    const entrance = Animated.parallel([
      Animated.spring(translateY, {
        toValue: insets.top + spacing.md,
        useNativeDriver: true,
        bounciness: 6,
        speed: 14,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: isConfirm ? 1 : 0,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }),
    ]);
    entrance.start();

    const timer = isConfirm
      ? null
      : setTimeout(() => dismiss(), active.duration ?? 3000);

    return () => {
      entrance.stop();
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  if (!active) return null;

  const getIconColor = () => {
    switch (active.type) {
      case 'error':
        return colors.danger;
      case 'info':
        return colors.info;
      case 'confirm':
        return active.confirmDestructive ? colors.danger : colors.warning;
      default:
        return colors.primary;
    }
  };

  const config = active;

  return (
    <>
      {/* Backdrop for confirm toasts */}
      {isConfirm && (
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
          pointerEvents={isConfirm ? 'auto' : 'none'}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            onPress={() => dismiss(callbackRef.current.onCancel)}
          />
        </Animated.View>
      )}

      <Animated.View
        style={[styles.container, { transform: [{ translateY }], opacity }]}
        accessibilityLiveRegion="polite"
      >
        <Pressable
          onPress={isConfirm ? undefined : () => dismiss()}
          accessibilityRole={isConfirm ? undefined : 'button'}
          accessibilityLabel={isConfirm ? undefined : `${config.title}. Tap to dismiss.`}
          style={[styles.innerContainer, isConfirm && styles.confirmContainer]}
        >
          <View style={styles.topRow}>
            <View style={[styles.iconContainer, { backgroundColor: getIconColor() }]}>
              <Ionicons
                name={ICON_BY_TYPE[config.type ?? 'success']}
                size={iconSize.lg}
                color={colors.primaryText}
              />
            </View>
            <View style={styles.content}>
              <Typography variant="h2" style={styles.title}>{config.title}</Typography>
              {config.message ? <Text style={styles.message}>{config.message}</Text> : null}
            </View>
          </View>

          {/*
            A `choose` prompt stacks its options vertically with a dismiss row
            underneath. Side-by-side only works for two, and reading three
            labels across a narrow card is worse than reading them down it.
          */}
          {isConfirm && config.actions?.length ? (
            <View style={styles.buttonColumn}>
              {config.actions.map((action) => (
                <Pressable
                  key={action.label}
                  style={[
                    styles.confirmButton,
                    action.destructive && styles.confirmDestructiveButton,
                  ]}
                  accessibilityRole="button"
                  onPress={() => dismiss(action.onPress)}
                >
                  <Text
                    style={[
                      styles.confirmButtonText,
                      action.destructive && styles.confirmDestructiveText,
                    ]}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={styles.cancelButton}
                accessibilityRole="button"
                onPress={() => dismiss()}
              >
                <Text style={styles.cancelButtonText}>
                  {config.cancelLabel || 'Cancel'}
                </Text>
              </Pressable>
            </View>
          ) : isConfirm ? (
            <View style={styles.buttonRow}>
              <Pressable
                style={styles.cancelButton}
                accessibilityRole="button"
                onPress={() => dismiss(callbackRef.current.onCancel)}
              >
                <Text style={styles.cancelButtonText}>
                  {config.cancelLabel || 'Cancel'}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.confirmButton,
                  config.confirmDestructive && styles.confirmDestructiveButton,
                ]}
                accessibilityRole="button"
                onPress={() => dismiss(callbackRef.current.onConfirm)}
              >
                <Text style={[
                  styles.confirmButtonText,
                  config.confirmDestructive && styles.confirmDestructiveText,
                ]}>
                  {config.confirmLabel || 'Confirm'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 99998,
  },
  container: {
    position: 'absolute',
    top: 0,
    left: spacing.xl,
    right: spacing.xl,
    zIndex: 99999,
  },
  /*
   * The one card in the app that keeps a shadow. It floats over live content
   * rather than sitting in the page flow, so it needs the depth cue that flat
   * cards deliberately do not have. The 1px outline is gone.
   */
  innerContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  confirmContainer: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: spacing.md,
  },
  content: { flex: 1, justifyContent: 'center' },
  title: { color: colors.text },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  buttonColumn: {
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    minHeight: touchTarget.min,
    backgroundColor: colors.surfaceInset,
    borderRadius: radius.nested,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sentence case, no letter-spacing — same as every other button in the app.
  cancelButtonText: {
    ...typography.button,
    color: colors.text,
  },
  confirmButton: {
    flex: 1,
    minHeight: touchTarget.min,
    backgroundColor: colors.primary,
    borderRadius: radius.nested,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    ...typography.button,
    color: colors.primaryText,
  },
  confirmDestructiveButton: {
    backgroundColor: colors.dangerMuted,
  },
  confirmDestructiveText: {
    color: colors.danger,
  },
});
