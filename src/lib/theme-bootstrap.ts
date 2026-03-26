import { THEME_STORAGE_KEY } from '@/lib/theme-constants';

/** Script inline (avant paint) : lit le store persist zustand et pose data-theme sur <html>. */
export function getThemeBootstrapScript(): string {
  const key = JSON.stringify(THEME_STORAGE_KEY);
  return `(function(){try{var r=localStorage.getItem(${key});if(!r)return;var p=JSON.parse(r);var t=p.state&&p.state.theme;if(t==="classic"||t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;
}
