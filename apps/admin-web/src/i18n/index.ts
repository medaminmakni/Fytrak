import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "./resources";
import type { AdminLanguage } from "./resources";

const supportedLanguages: AdminLanguage[] = ["en", "fr", "ar"];
const configuredLanguage = (import.meta.env.VITE_DEFAULT_LANGUAGE || "en").toLowerCase();

const initialLanguage: AdminLanguage = supportedLanguages.includes(configuredLanguage as AdminLanguage)
  ? (configuredLanguage as AdminLanguage)
  : "en";

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
