import { StatusBar } from "expo-status-bar";
import { View, StyleSheet } from "react-native";
import "./src/i18n";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { Toast } from "./src/components/Toast";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreenNative from 'expo-splash-screen';
import { useCallback, useEffect, useState } from "react";

// Keep the native splash screen visible while we fetch resources
SplashScreenNative.preventAutoHideAsync();

export default function App() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Load Ionicons via the official component method.
        //    This uses the exact asset ID the component expects
        await Ionicons.loadFont();

        console.log('[App] Ionicons loaded successfully');
      } catch (e) {
        console.error('[App] Font loading error:', e);
      } finally {
        setAppReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      await SplashScreenNative.hideAsync();
    }
  }, [appReady]);

  if (!appReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <View onLayout={onLayoutRootView} style={styles.container}>
        <RootNavigator />
        <Toast />
        <StatusBar style="light" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
