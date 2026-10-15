/* EXTRAS.JS — cuotas, estado abierto, contadores, scrollspy, lightbox con swipe, tilt */
(function(){
  var NUM='18095253216', $=function(s,r){return (r||document).querySelector(s)}, $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
  var calm=matchMedia('(prefers-reduced-motion:reduce)').matches, fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
  var fmt=function(n){return Number(n).toLocaleString('en-US')};
  function wa(t){return 'https://wa.me/'+NUM+'?text='+encodeURIComponent(t)}
  /* enlaces de WhatsApp con mensaje */
  $$('[data-wa]').forEach(function(a){a.href=wa(a.dataset.wa)});
  /* categorías clicables */
  $$('.cat-card').forEach(function(c){
    var n=$('h3',c).textContent; c.tabIndex=0; c.setAttribute('role','link');
    var g=document.createElement('span'); g.className='cat-go'; g.textContent='Consultar por WhatsApp →'; c.appendChild(g);
    function go(){window.open(wa('Hola, me interesa información sobre '+n+'.'),'_blank','noopener')}
    c.addEventListener('click',go); c.addEventListener('keydown',function(e){if(e.key==='Enter'){go()}});
  });
  /* abierto / cerrado (hora de R.D., lun–sáb 8:00–18:00) */
  function openState(){
    var p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Santo_Domingo',weekday:'short',hour:'numeric',minute:'numeric',hour12:false}).formatToParts(new Date()),o={};
    p.forEach(function(x){o[x.type]=x.value});
    var m=(+o.hour%24)*60+ +o.minute, d=o.weekday, open=d!=='Sun'&&m>=480&&m<1080, txt;
    if(open) txt=(1080-m)<=60?'Abierto · cierra pronto (6:00 p.m.)':'Abierto ahora · hasta las 6:00 p.m.';
    else txt=(d==='Sat'&&m>=1080)||d==='Sun'?'Cerrado · abrimos el lunes 8:00 a.m.':(m<480?'Cerrado · abrimos hoy a las 8:00 a.m.':'Cerrado · abrimos mañana 8:00 a.m.');
    $$('[data-open]').forEach(function(e){e.className='open-pill '+(open?'on':'off');e.textContent=txt});
  }
  openState(); setInterval(openState,60000);
  /* contadores */
  var cio=new IntersectionObserver(function(es){es.forEach(function(e){
    if(!e.isIntersecting)return; cio.unobserve(e.target);
    var el=e.target,end=+el.dataset.count,dec=+(el.dataset.dec||0),t0=performance.now();
    if(calm){el.textContent=end.toFixed(dec).replace('.',',');return}
    (function f(t){var k=Math.min((t-t0)/1400,1),v=end*(1-Math.pow(1-k,4));el.textContent=(dec?v.toFixed(dec).replace('.',','):Math.round(v));if(k<1)requestAnimationFrame(f)})(t0);
  })},{threshold:.6});
  $$('[data-count]').forEach(function(e){cio.observe(e)});
  /* calculadora de cuotas */
  var r=$('#calc-range');
  if(r){
    var cp=$('#calc-price'),cm=$('#calc-month'),cw=$('#calc-wa'),chips=$$('.chip');
    function upd(){
      var v=+r.value; r.style.setProperty('--p',((v-r.min)/(r.max-r.min)*100)+'%');
      cp.textContent='RD$ '+fmt(v); cm.textContent='RD$ '+fmt(Math.round(v/5));
      cw.href=wa('Hola, quiero cotizar un juego de aposento de RD$ '+fmt(v)+' a 5 meses sin intereses.');
      chips.forEach(function(c){c.classList.toggle('on',+c.dataset.v===v)});
    }
    r.addEventListener('input',upd);
    chips.forEach(function(c){c.addEventListener('click',function(){r.value=c.dataset.v;upd()})});
    upd();
  }
  /* scrollspy */
  var links=$$('.nav-links a[href^="#"]'),secs=links.map(function(a){return $(a.getAttribute('href'))}).filter(Boolean);
  var sio=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)links.forEach(function(a){a.classList.toggle('active',a.getAttribute('href')==='#'+e.target.id)})})},{rootMargin:'-45% 0px -50% 0px'});
  secs.forEach(function(s){sio.observe(s)});
  var b=$('#burger'); if(b)b.addEventListener('click',function(){b.classList.toggle('x')}); $$('#mobile-panel a').forEach(function(a){a.addEventListener('click',function(){b&&b.classList.remove('x')})});
  /* tilt 3D en ofertas + botones magnéticos (solo mouse) */
  if(fine&&!calm){
    $$('.offer').forEach(function(c){
      c.addEventListener('pointermove',function(e){var q=c.getBoundingClientRect(),x=(e.clientX-q.left)/q.width-.5,y=(e.clientY-q.top)/q.height-.5;c.style.transform='perspective(900px) rotateY('+x*7+'deg) rotateX('+-y*7+'deg) translateY(-4px)'});
      c.addEventListener('pointerleave',function(){c.style.transform=''});
    });
    $$('.btn-primary').forEach(function(m){
      m.addEventListener('pointermove',function(e){var q=m.getBoundingClientRect();m.style.translate=((e.clientX-q.left-q.width/2)*.12)+'px '+((e.clientY-q.top-q.height/2)*.2)+'px'});
      m.addEventListener('pointerleave',function(){m.style.translate=''});
    });
  }
  /* lightbox: flechas, teclado y swipe */
  var lb=$('.lightbox'),li=lb&&$('img',lb),imgs=$$('.gal-item img'),cur=0;
  if(lb){
    var pv=document.createElement('button'),nx=document.createElement('button'),ct=document.createElement('div');
    pv.className='lb-nav lb-prev';nx.className='lb-nav lb-next';ct.className='lb-count';pv.textContent='‹';nx.textContent='›';pv.setAttribute('aria-label','Anterior');nx.setAttribute('aria-label','Siguiente');
    lb.appendChild(pv);lb.appendChild(nx);lb.appendChild(ct);
    function show(i){cur=(i+imgs.length)%imgs.length;li.src=imgs[cur].src;li.alt=imgs[cur].alt;ct.textContent=(cur+1)+' / '+imgs.length}
    $$('.gal-item').forEach(function(it,i){it.addEventListener('click',function(){show(i)})});
    pv.addEventListener('click',function(e){e.stopPropagation();show(cur-1)});nx.addEventListener('click',function(e){e.stopPropagation();show(cur+1)});
    addEventListener('keydown',function(e){if(!lb.classList.contains('open'))return;if(e.key==='ArrowLeft')show(cur-1);if(e.key==='ArrowRight')show(cur+1)});
    var sx=0;lb.addEventListener('touchstart',function(e){sx=e.touches[0].clientX},{passive:true});
    lb.addEventListener('touchend',function(e){var d=e.changedTouches[0].clientX-sx;if(Math.abs(d)>50)show(cur+(d<0?1:-1))},{passive:true});
  }
})();

/* ---- vida + rendimiento: pausa del 3D, brillo de cursor, hexágonos, ripple ---- */
(function(){
  var lb=document.querySelector('.lightbox'),mp=document.getElementById('mobile-panel');
  function hold(){window.__sceneHold=!!((lb&&lb.classList.contains('open'))||(mp&&mp.classList.contains('open')))}
  var mo=new MutationObserver(hold);[lb,mp].forEach(function(e){e&&mo.observe(e,{attributes:true,attributeFilter:['class']})});
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  var hx=document.createElement('div');hx.className='hexes';hx.setAttribute('aria-hidden','true');
  var cols=['var(--red-500)','var(--blue-400)','var(--cream)'];
  for(var i=0;i<9;i++){var h=document.createElement('i'),st=h.style;
    st.setProperty('--x',(6+i*10.5+Math.random()*4)+'%');st.setProperty('--s',(16+Math.random()*30)+'px');
    st.setProperty('--c',cols[i%3]);st.setProperty('--d',(24+Math.random()*22)+'s');st.setProperty('--dl',(-Math.random()*40)+'s');
    st.setProperty('--dx',((Math.random()-.5)*160)+'px');hx.appendChild(h)}
  document.body.appendChild(hx);
  if(matchMedia('(hover:hover) and (pointer:fine)').matches){
    var g=document.createElement('div');g.className='cursor-glow';g.setAttribute('aria-hidden','true');document.body.appendChild(g);
    var gx=innerWidth/2,gy=innerHeight/2,tx=gx,ty=gy,run=false;
    function loop(){gx+=(tx-gx)*.12;gy+=(ty-gy)*.12;g.style.transform='translate3d('+gx+'px,'+gy+'px,0)';
      if(Math.abs(tx-gx)+Math.abs(ty-gy)>.5&&!document.hidden)requestAnimationFrame(loop);else run=false}
    addEventListener('pointermove',function(e){tx=e.clientX;ty=e.clientY;g.classList.add('on');if(!run){run=true;requestAnimationFrame(loop)}},{passive:true});
    document.addEventListener('pointerleave',function(){g.classList.remove('on')});
  }else{
    addEventListener('pointerdown',function(e){var r=document.createElement('span');r.className='ripple';r.style.left=e.clientX+'px';r.style.top=e.clientY+'px';
      document.body.appendChild(r);r.addEventListener('animationend',function(){r.remove()})},{passive:true});
  }
})();
