import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

const BACKGROUND = "#0B0B0B";
const YELLOW = "#FFC300";
const MIN_HOLD_MS = 3120;
const EXIT_MS = 560;

const MARK_PATHS = [
  "M155.571 60.8135L141.706 72.4568L173.098 60.1022L152.576 48.4088L146.053 56.3613L155.571 60.8135Z",
  "M165.975 32.9003L175.217 41.7585L191.95 18.9567L174.727 31.7482L171.476 26.5527L179 17.6944H142.138L135.336 17.7766L128.761 26.6348L135.336 22.4952L142.138 25.0599L151.698 28.1656L112.05 86.2782L146.393 56.4896L154.941 45.3571L165.975 32.9003Z",
  "M171.472 14.1499C175.371 14.1499 178.532 10.9821 178.532 7.07497C178.532 3.16781 175.371 0 171.472 0C167.573 0 164.411 3.16781 164.411 7.07497C164.411 10.9821 167.573 14.1499 171.472 14.1499Z",
];

const WORD_PATHS = [
  "M3.55725 123.312H34.5447L33.047 131.848H10.6258L8.51821 143.996H0L2.10756 131.848L3.55925 123.312H3.55725ZM42.1751 119.7H4.21311L5.66481 111.164H43.6268L42.1751 119.7Z",
  "M70.1192 122.092L79.2933 115.62L84.5822 111.867C85.2061 111.398 85.9079 111.164 86.6898 111.164H99.1871L75.97 127.58L68.2456 133.068L56.1682 141.604L53.7807 143.293C53.1568 143.762 52.453 143.996 51.6731 143.996H39.1758L62.3929 127.58L70.1172 122.092H70.1192ZM44.8426 111.164H57.3399C58.0578 111.134 58.6816 111.368 59.2115 111.867L67.6378 119.794L59.9134 125.282L44.8406 111.164H44.8426Z",
  "M143.61 119.699H125.308L121.095 143.996H112.576L116.789 119.699H98.4393L99.937 111.164H145.107L143.61 119.699Z",
  "M146.277 127.065H177.405C178.464 127.035 179.394 126.674 180.19 125.985C180.986 125.298 181.492 124.436 181.712 123.406C181.93 122.437 181.728 121.569 181.104 120.803C180.48 120.038 179.668 119.671 178.67 119.701H147.543L148.995 111.166H180.17C183.509 111.166 186.169 112.362 188.15 114.754C190.132 117.147 190.826 120.032 190.234 123.408C189.702 126.035 188.564 128.365 186.817 130.397C185.069 132.431 182.931 133.9 180.404 134.807L186.677 144H175.443L169.686 135.605H153.304L151.852 144H143.334L144.786 135.605L146.283 127.069L146.277 127.065Z",
  "M255.342 117.073L254.874 119.699L250.709 143.996H242.143L246.356 119.699H244.157L205.493 143.012C204.431 143.669 203.277 143.998 202.029 143.998H188.502L240.273 112.853C242.021 111.727 243.941 111.164 246.03 111.164H250.431C252.023 111.102 253.325 111.681 254.34 112.899C255.354 114.119 255.69 115.51 255.346 117.073H255.342Z",
  "M263.836 111.164H272.355L269.827 125.845L289.441 111.867C290.097 111.398 290.813 111.164 291.595 111.164H303.998L281.623 127.111L299.503 143.996H287.1C286.382 144.026 285.758 143.794 285.226 143.293L269.405 128.329L266.69 143.996H258.172L263.834 111.162L263.836 111.164Z",
];

function Mark() {
  return (
    <Svg width={96} height={99} viewBox="110 0 84 87">
      {MARK_PATHS.map((path) => <Path key={path} d={path} fill={YELLOW} />)}
    </Svg>
  );
}

function Wordmark() {
  return (
    <Svg width={200} height={22} viewBox="0 111 304 33">
      {WORD_PATHS.map((path) => <Path key={path} d={path} fill={YELLOW} />)}
    </Svg>
  );
}

interface SplashScreenProps {
  canFinish: boolean;
  onFinish: () => void;
}

/** Native continuation of the Brand Pack HTML sequence; the MP4 is reference-only. */
export function SplashScreen({ canFinish, onFinish }: SplashScreenProps) {
  const flash = useRef(new Animated.Value(0)).current;
  const markIn = useRef(new Animated.Value(0)).current;
  const wordIn = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const onFinishRef = useRef(onFinish);
  const exitStarted = useRef(false);
  const [minimumHoldComplete, setMinimumHoldComplete] = useState(false);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const brandEase = Easing.bezier(0.2, 0.8, 0.2, 1);
    const wipeEase = Easing.bezier(0.4, 0, 0.2, 1);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(flash, {
          toValue: 0.85,
          duration: 320,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flash, {
          toValue: 0,
          duration: 880,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(markIn, {
        toValue: 1,
        duration: 480,
        easing: brandEase,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(240),
        Animated.timing(wordIn, {
          toValue: 1,
          duration: 800,
          easing: wipeEase,
          useNativeDriver: false,
        }),
      ]),
    ]).start();

    const holdTimer = setTimeout(() => setMinimumHoldComplete(true), MIN_HOLD_MS);
    return () => {
      clearTimeout(holdTimer);
      flash.stopAnimation();
      markIn.stopAnimation();
      wordIn.stopAnimation();
      exit.stopAnimation();
    };
  }, [exit, flash, markIn, wordIn]);

  useEffect(() => {
    if (!minimumHoldComplete || !canFinish || exitStarted.current) return;

    exitStarted.current = true;
    Animated.timing(exit, {
      toValue: 1,
      duration: EXIT_MS,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFinishRef.current();
    });
  }, [canFinish, exit, minimumHoldComplete]);

  const markEntranceStyle = {
    opacity: markIn,
    transform: [
      { translateY: markIn.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
      { scale: markIn.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
    ],
  };
  const sceneExitStyle = {
    opacity: exit.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1, 1, 0] }),
    transform: [
      { translateY: exit.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
      { scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) },
    ],
  };

  return (
    <View style={styles.container}>
      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flash }]} />

      <Animated.View style={[styles.scene, sceneExitStyle]}>
        <Animated.View style={markEntranceStyle}>
          <Mark />
        </Animated.View>
        <View style={styles.wordmarkFrame}>
          <Animated.View
            style={[
              styles.wordmarkReveal,
              { width: wordIn.interpolate({ inputRange: [0, 1], outputRange: [0, 200] }) },
            ]}
          >
            <Wordmark />
          </Animated.View>
        </View>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: YELLOW,
  },
  scene: {
    alignItems: "center",
    gap: 18,
  },
  wordmarkFrame: {
    width: 200,
    height: 22,
    overflow: "hidden",
  },
  wordmarkReveal: {
    height: 22,
    overflow: "hidden",
  },
});
