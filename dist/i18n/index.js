import { en } from './en.js';
import { zh } from './zh.js';
const catalogs = { en, zh };
let language = 'zh';
export function setLanguage(lang) {
    language = lang === 'en' ? 'en' : 'zh';
}
export function t(key) {
    return catalogs[language][key] ?? en[key] ?? key;
}
//# sourceMappingURL=index.js.map