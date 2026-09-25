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
