import { THEME_STORAGE_KEY } from '@/lib/theme-constants';

/** Script inline (avant paint) : lit le store persist et pose data-theme sur <html> (dark | light uniquement). */
export function getThemeBootstrapScript(): string {
  const key = JSON.stringify(THEME_STORAGE_KEY);
  return `(function(){try{var r=localStorage.getItem(${key});var t='dark';if(r){var p=JSON.parse(r);var s=p.state&&p.state.theme;if(s==='light')t='light';else t='dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;
}
