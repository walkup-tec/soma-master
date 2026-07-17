export const SOMA_THEME_STORAGE_KEY = "soma-theme";
/** Cookie espelha localStorage — sobrevive a POST/reload e permite SSR futuro. */
export const SOMA_THEME_COOKIE = "soma-theme";

export type SomaThemeMode = "light" | "dark";

export function resolveSomaTheme(value: string | null | undefined): SomaThemeMode {
  return value === "dark" ? "dark" : "light";
}

export function readStoredSomaTheme(): SomaThemeMode {
  if (typeof window === "undefined") return "light";
  try {
    const fromLs = window.localStorage.getItem(SOMA_THEME_STORAGE_KEY);
    if (fromLs === "dark" || fromLs === "light") return fromLs;
  } catch {
    /* ignore */
  }
  try {
    const match = document.cookie.match(/(?:^|;\s*)soma-theme=(dark|light)/);
    if (match?.[1]) return resolveSomaTheme(match[1]);
  } catch {
    /* ignore */
  }
  return "light";
}

/** Lê o tema já aplicado no DOM (bootstrap / classList atual). */
export function readDomSomaTheme(): SomaThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function writeThemeCookie(mode: SomaThemeMode): void {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${SOMA_THEME_COOKIE}=${mode}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function applySomaTheme(mode: SomaThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.dataset.theme = mode;
}

export function persistSomaTheme(mode: SomaThemeMode): void {
  applySomaTheme(mode);
  writeThemeCookie(mode);
  try {
    window.localStorage.setItem(SOMA_THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Anti-FOUC + reaplicar após hidratação React.
 *
 * Causa do “volta ao claro” após Atualizar status (POST 303):
 * bootstrap aplica `dark` no <html>, depois o React hidrata `<html>` sem class
 * e remove `dark` (suppressHydrationWarning só silencia o warning).
 * Este script reaplica várias vezes nos primeiros ~500ms + pageshow.
 *
 * Toggle: só via [data-theme-toggle] aqui (capture) — AppTopbar NÃO deve
 * chamar persist de novo no mesmo clique (evita toggle duplo).
 */
export const SOMA_THEME_BOOTSTRAP_SCRIPT = `(function(){
  var KEY='${SOMA_THEME_STORAGE_KEY}';
  var COOKIE='${SOMA_THEME_COOKIE}';
  function apply(dark){
    var h=document.documentElement;
    h.classList.toggle('dark',!!dark);
    h.dataset.theme=dark?'dark':'light';
    try{localStorage.setItem(KEY,dark?'dark':'light')}catch(e){}
    try{document.cookie=COOKIE+'='+(dark?'dark':'light')+'; path=/; max-age=31536000; SameSite=Lax'}catch(e){}
  }
  function readPreferred(){
    try{
      var ls=localStorage.getItem(KEY);
      if(ls==='dark'||ls==='light')return ls==='dark';
    }catch(e){}
    try{
      var m=document.cookie.match(/(?:^|;\\s*)soma-theme=(dark|light)/);
      if(m)return m[1]==='dark';
    }catch(e){}
    return false;
  }
  function syncFromStorage(){ apply(readPreferred()); }
  syncFromStorage();
  var n=0;
  var iv=setInterval(function(){
    syncFromStorage();
    if(++n>=24)clearInterval(iv);
  },25);
  document.addEventListener('click',function(ev){
    var t=ev.target&&ev.target.closest&&ev.target.closest('[data-theme-toggle]');
    if(!t)return;
    ev.preventDefault();
    ev.stopPropagation();
    apply(!document.documentElement.classList.contains('dark'));
    var dark=document.documentElement.classList.contains('dark');
    t.setAttribute('aria-label',dark?'Ativar modo claro':'Ativar modo escuro');
    t.setAttribute('title',dark?'Ativar modo claro':'Ativar modo escuro');
  },true);
  window.addEventListener('pageshow',syncFromStorage);
  document.addEventListener('DOMContentLoaded',syncFromStorage);
})();`;
