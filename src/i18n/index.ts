import { en, type MessageKey } from './en.js';
import { zh } from './zh.js';
import type { Language } from '../config.js';

const catalogs: Record<Language, Record<MessageKey, string>> = { en, zh };

let language: Language = 'en';

export function setLanguage(lang: Language): void {
  language = lang === 'zh' ? 'zh' : 'en';
}

export function t(key: MessageKey): string {
  return catalogs[language][key] ?? en[key] ?? key;
}
