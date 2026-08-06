import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import { I18nManager } from "react-native";
import { resources, AppLanguage } from "./resources";

const supportedLanguages: AppLanguage[] = ["en", "fr", "ar"];

const getInitialLanguage = (): AppLanguage => {
  const deviceLanguage = getLocales()[0]?.languageCode?.toLowerCase();

  if (deviceLanguage && supportedLanguages.includes(deviceLanguage as AppLanguage)) {
    return deviceLanguage as AppLanguage;
  }

  return "en";
};

const initialLanguage = getInitialLanguage();
const shouldUseRTL = initialLanguage === "ar";

I18nManager.allowRTL(shouldUseRTL);
if (I18nManager.isRTL !== shouldUseRTL) {
  I18nManager.forceRTL(shouldUseRTL);
}

/**
 * KNOWN LIMITATION — RTL requires a native reload.
 *
 * `I18nManager.forceRTL` only takes effect after the native layer restarts.
 * The first launch in which Arabic is detected therefore still renders LTR;
 * the correct direction appears on the next cold start.
 *
 * This is accepted for now. Resolving it needs either expo-updates'
 * `reloadAsync()` or a "restart to apply" prompt attached to a language
 * switcher — neither exists yet, and both were deliberately deferred rather
 * than half-built. Revisit alongside string extraction, which is the point at
 * which Arabic first becomes testable end to end.
 */

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
