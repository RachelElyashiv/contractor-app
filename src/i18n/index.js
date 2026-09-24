import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';
import { I18nManager } from 'react-native';

import ar from './locales/ar.json';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import he from './locales/he.json';
import pl from './locales/pl.json';
import pt from './locales/pt.json';
import ro from './locales/ro.json';
import ru from './locales/ru.json';
import tr from './locales/tr.json';
import uk from './locales/uk.json';

export const LANGUAGES = {
  he: { label: 'עברית', rtl: true },
  ar: { label: 'العربية', rtl: true },
  en: { label: 'English', rtl: false },
  es: { label: 'Español', rtl: false },
  pt: { label: 'Português', rtl: false },
  ru: { label: 'Русский', rtl: false },
  uk: { label: 'Українська', rtl: false },
  ro: { label: 'Română', rtl: false },
  pl: { label: 'Polski', rtl: false },
  tr: { label: 'Türkçe', rtl: false },
  fr: { label: 'Français', rtl: false },
  de: { label: 'Deutsch', rtl: false },
};

export const DEFAULT_LANGUAGE = 'he';
const STORAGE_KEY = 'app.language';

const i18n = new I18n({ he, ar, en, es, pt, ru, uk, ro, pl, tr, fr, de });
i18n.defaultLocale = DEFAULT_LANGUAGE;
i18n.enableFallback = true;
i18n.locale = DEFAULT_LANGUAGE;

export function getDeviceLanguage() {
  const code = getLocales()[0]?.languageCode;
  return code && LANGUAGES[code] ? code : DEFAULT_LANGUAGE;
}

export function getLanguage() {
  return i18n.locale;
}

export function isRTL(code = i18n.locale) {
  return LANGUAGES[code]?.rtl ?? false;
}

/**
 * Applies the stored language, or the device's if the user never chose one.
 * Returns true when the layout direction on disk disagrees with the one the
 * running app was laid out with, which only a restart can reconcile.
 */
export async function initLanguage() {
  let code;
  try {
    code = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    code = null;
  }
  if (!code || !LANGUAGES[code]) code = getDeviceLanguage();

  i18n.locale = code;
  const rtl = isRTL(code);
  I18nManager.allowRTL(rtl);
  return { code, needsRestart: I18nManager.isRTL !== rtl };
}

/**
 * Switches language. Direction changes only take effect after a restart, so the
 * caller is told when one is needed and is responsible for asking the user.
 */
export async function setLanguage(code) {
  if (!LANGUAGES[code]) throw new Error(`Unsupported language: ${code}`);

  const rtl = isRTL(code);
  const needsRestart = I18nManager.isRTL !== rtl;

  i18n.locale = code;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, code);
  } catch {
    // A failed write only costs the preference on next launch.
  }

  if (needsRestart) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }
  return { needsRestart };
}

export function t(key, options) {
  return i18n.t(key, options);
}

export default i18n;
