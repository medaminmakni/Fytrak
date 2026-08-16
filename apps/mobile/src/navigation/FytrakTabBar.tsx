import { useEffect, useRef, useState } from "react";
import { ParamListBase, TabNavigationState } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Animated, Easing, Keyboard, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/colors";
import { radius, typography } from "../theme/tokens";

const iconByRoute: Record<string, keyof typeof Ionicons.glyphMap> = {
  Workouts: "barbell-outline",
  Nutrition: "nutrition-outline",
  Home: "home-outline",
  Progress: "stats-chart-outline",
  Chat: "chatbubbles-outline",
  // Coach routes
  CoachHome: "home-outline",
  CoachClients: "people-outline",
  CoachLibrary: "library-outline",
  CoachInbox: "chatbubbles-outline",
  CoachProfile: "person-outline",
};

/*
 * Capsule geometry, from the design sheet. Every number here is a point value
 * at 390pt width and maps 1:1 to React Native units.
 */
/** 16 each side. */
const TAB_BAR_HORIZONTAL_MARGIN = 32;
const BAR_HEIGHT = 64;
/** Uniform padding inside the capsule; the active cell insets by exactly this. */
const CAPSULE_PADDING = 5;
/**
 * The scrim above the capsule.
 *
 * The bar floats over scrolling content, so a photo or a bright card passing
 * underneath used to bleed against its edge. A short fade to the page colour
 * separates them without drawing a line.
 */
const SCRIM_HEIGHT = 28;
/** Indicator travel: 280ms on the design's easing curve. */
const INDICATOR_DURATION = 280;

const labelByRoute: Record<string, string> = {
  Home: "Today",
  Workouts: "Workout",
  Nutrition: "Nutrition",
  Progress: "Progress",
  Chat: "Coach",
  CoachHome: "Today",
  CoachClients: "Clients",
  CoachLibrary: "Library",
  CoachInbox: "Inbox",
  CoachProfile: "You",
};

type FytrakTabBarProps = {
  state: TabNavigationState<ParamListBase>;
  navigation: {
    emit: (options: { type: "tabPress"; target?: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
  /**
   * Unread counts keyed by route name. A route absent from this map, or mapped
   * to 0, renders no badge — the badge is never decorative, it only appears
   * when a real count is passed in.
   */
  badges?: Record<string, number>;
};

export function FytrakTabBar({ state, navigation, badges }: FytrakTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const barWidth = width - TAB_BAR_HORIZONTAL_MARGIN;
  const tabWidth = (barWidth - CAPSULE_PADDING * 2) / state.routes.length;

  const translateX = useRef(new Animated.Value(0)).current;
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    /*
     * Timing, not spring. The design specifies 280ms on cubic-bezier(.2,.8,.2,1)
     * — a curve that leaves quickly and settles without overshoot. A spring
     * bounces past the target cell and back, which on a five-cell bar reads as
     * the indicator briefly selecting the wrong tab.
     */
    Animated.timing(translateX, {
      toValue: state.index * tabWidth,
      duration: INDICATOR_DURATION,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [state.index, tabWidth, translateX]);

  if (isKeyboardVisible) return null;

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {/* Fades content out behind the floating capsule. Not interactive. */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(11,11,11,0)", colors.bg]}
        style={styles.scrim}
      />
      <View style={[styles.bar, { width: barWidth }]}>
        <Animated.View
          style={[
            styles.indicator,
            {
              width: tabWidth,
              transform: [{ translateX }],
            },
          ]}
        >
          <View style={styles.indicatorBubble} />
        </Animated.View>

        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const iconName = iconByRoute[route.name] ?? "ellipse-outline";
          const activeIconName = iconName.replace("-outline", "") as keyof typeof Ionicons.glyphMap;
          const label = labelByRoute[route.name] ?? route.name;
          const badgeCount = badges?.[route.name] ?? 0;

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityLabel={
                badgeCount > 0 ? `${label} tab, ${badgeCount} unread` : `${label} tab`
              }
              accessibilityState={{ selected: isFocused }}
              style={styles.tabButton}
              hitSlop={8}
            >
              <View style={styles.iconSlot}>
                <AnimatedIcon
                  name={isFocused ? activeIconName : iconName}
                  color={isFocused ? colors.primary : colors.textMuted}
                  size={22}
                />
                {badgeCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText} numberOfLines={1}>
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[styles.tabLabel, isFocused && styles.tabLabelActive]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function AnimatedIcon({
  name,
  color,
  size,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
    }).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}


const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "transparent",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    // Sits directly on top of the capsule's own row.
    bottom: "100%",
    height: SCRIM_HEIGHT,
  },
  bar: {
    height: BAR_HEIGHT,
    backgroundColor: colors.surfaceTabBar,
    borderRadius: radius.tabBar,
    padding: CAPSULE_PADDING,
    // Borderless AND shadowless. The design carries elevation with surface
    // lightness alone; this previously drew a 20pt 50%-opacity shadow, the only
    // shadow in the app and the one thing making the bar look pasted on.
    flexDirection: "row",
    alignItems: "center",
  },
  indicator: {
    position: "absolute",
    top: CAPSULE_PADDING,
    bottom: CAPSULE_PADDING,
    left: CAPSULE_PADDING,
  },
  /*
   * The active state is a tinted panel behind the whole tab — icon *and* label —
   * rather than a circle behind the icon alone. It makes the selected tab read
   * as one unit and gives the label a reason to be yellow.
   */
  indicatorBubble: {
    flex: 1,
    borderRadius: radius.tabCell,
    backgroundColor: colors.primaryMuted,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    minWidth: 44,
    zIndex: 1,
    gap: 4,
  },
  iconSlot: {
    // Sized to the glyph, not to a 44px circle. The Pressable already spans the
    // full bar height, so the touch target is unaffected.
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -6,
    left: 10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  /*
   * 10px, and deliberately so. This is a numeral inside a fixed 16pt pill, not
   * text — the 12px floor exists for language, and a badge count is a glyph.
   * The design sheet specifies 10/700 here for the same reason.
   */
  badgeText: {
    color: colors.primaryText,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
  },
  tabLabel: {
    ...typography.tabLabel,
    color: colors.textSecondary,
    textAlign: "center",
    width: "100%",
  },
  tabLabelActive: {
    color: colors.primary,
  },
});


