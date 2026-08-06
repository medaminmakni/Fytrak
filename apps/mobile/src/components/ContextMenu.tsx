import React, { useEffect, useRef } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  Modal, 
  TouchableWithoutFeedback, 
  Platform, 
  Animated, 
  Easing 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/tokens";

export type ContextMenuItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
};

type ContextMenuProps = {
  visible: boolean;
  onClose: () => void;
  items: ContextMenuItem[];
};

export function ContextMenu({ visible, onClose, items }: ContextMenuProps) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 120,
          friction: 12,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 120,
          friction: 12,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
      slideAnim.setValue(-10);
    }
  }, [visible]);

  return (
    <Modal 
      transparent 
      visible={visible} 
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View 
              style={[
                styles.menu, 
                { 
                  opacity: opacityAnim,
                  transform: [
                    { scale: scaleAnim },
                    { translateY: slideAnim }
                  ] 
                }
              ]}
            >
              <View style={styles.content}>
                {items.map((item, index) => (
                  <View key={item.label}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.item,
                        pressed && styles.pressed
                      ]}
                      onPress={() => {
                        onClose();
                        setTimeout(item.onPress, 150);
                      }}
                    >
                      <View style={styles.iconArea}>
                        <Ionicons
                          name={item.icon}
                          size={18}
                          color={item.destructive ? colors.danger : colors.text}
                        />
                      </View>
                      <Text style={[styles.label, item.destructive && styles.destructiveLabel]}>
                        {item.label}
                      </Text>
                    </Pressable>
                    {index < items.length - 1 && <View style={styles.separator} />}
                  </View>
                ))}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: Platform.OS === "ios" ? 90 : 70, // Aligned with the header bottom
    paddingEnd: 20, // Match spacing.xl
  },
  menu: {
    backgroundColor: "#111111", // Slightly warmer deep charcoal
    borderRadius: 24,
    width: 180,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 24 },
        shadowOpacity: 0.7,
        shadowRadius: 32,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  content: {
    padding: spacing.xs,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 14,
    borderRadius: 18,
  },
  pressed: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  iconArea: {
    width: 24,
    alignItems: "center",
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  destructiveLabel: {
    color: colors.danger,
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginHorizontal: 16,
    marginVertical: 2,
  },
});
