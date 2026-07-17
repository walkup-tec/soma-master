/**
 * Overlay “Processando…” em submits de formulário (POST / navegação completa).
 * Roda sem React — igual ao bootstrap do tema — para não depender da hidratação.
 */
export const SOMA_PROCESSING_BOOTSTRAP_SCRIPT = `(function(){
  var ID='soma-processing-overlay';
  function ensure(){
    var el=document.getElementById(ID);
    if(el)return el;
    el=document.createElement('div');
    el.id=ID;
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    el.setAttribute('aria-busy','true');
    el.innerHTML='<div class="soma-processing-card"><div class="soma-processing-spinner" aria-hidden="true"></div><p class="soma-processing-title">Processando…</p><p class="soma-processing-sub">Aguarde enquanto a página atualiza.</p></div>';
    document.documentElement.appendChild(el);
    return el;
  }
  function show(msg){
    var el=ensure();
    var t=el.querySelector('.soma-processing-title');
    if(t&&msg)t.textContent=msg;
    el.classList.add('is-visible');
    document.documentElement.classList.add('soma-is-processing');
  }
  function hide(){
    var el=document.getElementById(ID);
    if(el)el.classList.remove('is-visible');
    document.documentElement.classList.remove('soma-is-processing');
  }
  document.addEventListener('submit',function(ev){
    var form=ev.target;
    if(!form||form.tagName!=='FORM')return;
    if(form.getAttribute('data-no-processing')!=null)return;
    var method=(form.getAttribute('method')||'get').toLowerCase();
    if(method!=='post')return;
    var label=form.getAttribute('data-processing-label')||'Processando…';
    show(label);
    var btns=form.querySelectorAll('button[type="submit"],input[type="submit"]');
    for(var i=0;i<btns.length;i++){
      btns[i].disabled=true;
      btns[i].setAttribute('aria-busy','true');
    }
  },true);
  window.addEventListener('pageshow',function(ev){
    if(ev.persisted)hide();
  });
  document.addEventListener('DOMContentLoaded',hide);
})();`;
