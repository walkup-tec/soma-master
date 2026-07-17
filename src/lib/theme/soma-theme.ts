export const SOMA_THEME_STORAGE_KEY = "soma-theme";

export type SomaThemeMode = "light" | "dark";

export function resolveSomaTheme(value: string | null | undefined): SomaThemeMode {
  return value === "dark" ? "dark" : "light";
}

export function readStoredSomaTheme(): SomaThemeMode {
  if (typeof window === "undefined") return "light";
  try {
    return resolveSomaTheme(window.localStorage.getItem(SOMA_THEME_STORAGE_KEY));
  } catch {
    return "light";
  }
}

/** Lê o tema já aplicado no DOM (bootstrap / classList atual). */
export function readDomSomaTheme(): SomaThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applySomaTheme(mode: SomaThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.dataset.theme = mode;
}

export function persistSomaTheme(mode: SomaThemeMode): void {
  applySomaTheme(mode);
  try {
    window.localStorage.setItem(SOMA_THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Anti-FOUC + toggle sem React.
 * Causa raiz do “modo escuro morto”: onClick do React não roda se a hidratação falha
 * (node_modules em junction). Este script roda no HTML clássico e responde ao clique.
 */
export const SOMA_THEME_BOOTSTRAP_SCRIPT = `(function(){
  var KEY='${SOMA_THEME_STORAGE_KEY}';
  function apply(dark){
    var h=document.documentElement;
    h.classList.toggle('dark',!!dark);
    h.dataset.theme=dark?'dark':'light';
    try{localStorage.setItem(KEY,dark?'dark':'light')}catch(e){}
  }
  function syncFromStorage(){
    try{apply(localStorage.getItem(KEY)==='dark')}catch(e){}
  }
  syncFromStorage();
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
  // Após POST/reload ou bfcache — reaplicar tema guardado
  window.addEventListener('pageshow',syncFromStorage);
  document.addEventListener('DOMContentLoaded',syncFromStorage);
})();`;
