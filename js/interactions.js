/* ============================================================
   INTERACTIONS.JS — menú móvil, scroll-reveal, toast de ayuda
   ============================================================ */
(function(){
  var burger = document.getElementById('burger');
  var panel = document.getElementById('mobile-panel');
  if(burger && panel){
    burger.addEventListener('click', function(){
      var open = panel.classList.toggle('open');
      burger.setAttribute('aria-expanded', open);
    });
    panel.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ panel.classList.remove('open'); burger.setAttribute('aria-expanded','false'); });
    });
  }

  var revealEls = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, {threshold:0.15});
    revealEls.forEach(function(el){ io.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add('in'); });
  }

  var toast = document.getElementById('toast');
  var toastTimer;
  window.showToast = function(msg){
    if(!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toast.classList.remove('show'); }, 3200);
  };
})();

/* ---- extras: progreso de scroll, visor de galería, año ---- */
(function(){
  var y=document.getElementById('year'); if(y) y.textContent=new Date().getFullYear();
  var bar=document.createElement('div'); bar.className='progress'; bar.setAttribute('aria-hidden','true'); document.body.appendChild(bar);
  var tick=false;
  function upd(){ var m=document.documentElement.scrollHeight-innerHeight; bar.style.transform='scaleX('+(m>0?scrollY/m:0)+')'; tick=false; }
  addEventListener('scroll',function(){ if(!tick){ tick=true; requestAnimationFrame(upd); } },{passive:true});
  var lb=document.createElement('div'); lb.className='lightbox'; lb.innerHTML='<img alt=""><button aria-label="Cerrar">×</button>'; document.body.appendChild(lb);
  var li=lb.querySelector('img');
  function close(){ lb.classList.remove('open'); }
  document.querySelectorAll('.gal-item').forEach(function(it){
    it.tabIndex=0; it.setAttribute('role','button');
    function open(){ var im=it.querySelector('img'); li.src=im.src; li.alt=im.alt; lb.classList.add('open'); }
    it.addEventListener('click',open);
    it.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); open(); } });
  });
  lb.addEventListener('click',close);
  addEventListener('keydown',function(e){ if(e.key==='Escape') close(); });
})();

/* ---- WhatsApp flotante + brillo que sigue al cursor ---- */
(function(){
  var fl=document.getElementById('wa-float');
  if(fl){
    if('IntersectionObserver' in window){
      var seen=new Set();
      var o=new IntersectionObserver(function(es){
        es.forEach(function(e){ if(e.isIntersecting) seen.add(e.target); else seen.delete(e.target); });
        fl.classList.toggle('show', seen.size===0);
      },{rootMargin:'0px 0px -90px 0px'});
      document.querySelectorAll('main a.btn-primary[href*="wa.me"]').forEach(function(b){ o.observe(b); });
    } else fl.classList.add('show');
  }
  document.querySelectorAll('.cat-card,.rev-card,.loc-card,.rating-card').forEach(function(el){
    el.addEventListener('pointermove',function(e){
      var r=el.getBoundingClientRect();
      el.style.setProperty('--mx',(e.clientX-r.left)+'px'); el.style.setProperty('--my',(e.clientY-r.top)+'px');
    });
  });
})();
