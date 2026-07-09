import { en } from './en.js';
import { zh } from './zh.js';
const catalogs = { en, zh };
let language = 'en';
export function setLanguage(lang) {
    language = lang === 'zh' ? 'zh' : 'en';
}
export function t(key) {
    return catalogs[language][key] ?? en[key] ?? key;
}
//# sourceMappingURL=index.js.map