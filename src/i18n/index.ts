import { en, type MessageKey } from './en.js';
import { zh } from './zh.js';
import type { Language } from '../config.js';

const catalogs: Record<Language, Record<MessageKey, string>> = { en, zh };

let language: Language = 'zh';

export function setLanguage(lang: Language): void {
  language = lang === 'en' ? 'en' : 'zh';
}

export function t(key: MessageKey): string {
  return catalogs[language][key] ?? en[key] ?? key;
}
