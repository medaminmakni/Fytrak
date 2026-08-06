import { useEffect, useRef, useState } from "react";
import { ParamListBase, TabNavigationState } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Animated, Keyboard, Pressable, StyleSheet, Text, Dimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { radius } from "../theme/tokens";

const iconByRoute: Record<string, keyof typeof Ionicons.glyphMap> = {
  Workouts: "barbell-outline",
  Nutrition: "nutrition-outline",
  Home: "home-outline",
  Progress: "stats-chart-outline",
  Chat: "chatbubbles-outline",
  // Coach routes
  CoachHome: "grid-outline",
  CoachClients: "people-outline",
  CoachLibrary: "library-outline",
  CoachInbox: "chatbubbles-outline",
  CoachProfile: "person-outline",
};

const TAB_BAR_HORIZONTAL_MARGIN = 40;
const BAR_HEIGHT = 68;
/** Vertical inset of the active pill inside the bar, top and bottom. */
const INDICATOR_INSET = 6;
/** Horizontal gap between the active pill and its neighbours. */
const INDICATOR_GAP = 4;

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
  CoachProfile: "Profile",
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
  const { width } = Dimensions.get("window");
  const barWidth = width - TAB_BAR_HORIZONTAL_MARGIN;
  const tabWidth = barWidth / state.routes.length;

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
    Animated.spring(translateX, {
      toValue: state.index * tabWidth,
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
  }, [state.index, tabWidth]);

  if (isKeyboardVisible) return null;

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={[styles.bar, { width: barWidth }]}>
        <Animated.View
          style={[
            styles.indicator,
            {
              width: tabWidth,
              transform: [{
                translateX: translateX.interpolate({
                  inputRange: [0, tabWidth * (state.routes.length - 1)],
                  outputRange: [0, tabWidth * (state.routes.length - 1)]
                })
              }],
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
  bar: {
    height: BAR_HEIGHT,
    backgroundColor: colors.surface,
    // A rounded rect, not a pill: at this height a pill radius bows the ends in
    // past the outer tabs and crowds their labels.
    borderRadius: radius.card,
    // Borderless. The surface is two steps lighter than the page background,
    // which separates the bar on its own; an outline on top of that reads as a
    // second, competing edge next to the active pill's.
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  indicator: {
    position: "absolute",
    top: INDICATOR_INSET,
    bottom: INDICATOR_INSET,
  },
  /*
   * The active state is a tinted panel behind the whole tab — icon *and* label —
   * rather than a circle behind the icon alone. It makes the selected tab read
   * as one unit and gives the label a reason to be yellow.
   */
  indicatorBubble: {
    flex: 1,
    marginHorizontal: INDICATOR_GAP,
    borderRadius: radius.nested,
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
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: colors.primaryText,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 13,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
    textAlign: "center",
    width: "100%",
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: "800",
  },
});



