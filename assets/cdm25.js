
(function(){
  document.body.classList.remove('no-js');
  var K='cdm_lang';
  function get(){try{return localStorage.getItem(K)}catch(e){return null}}
  function put(v){try{localStorage.setItem(K,v)}catch(e){}}
  function setL(l){
    if(['fr','en','nl'].indexOf(l)<0) l='fr';
    document.documentElement.lang=l;
    var els=document.querySelectorAll('.t');
    for(var i=0;i<els.length;i++){var v=els[i].getAttribute('data-'+l);if(v!==null)els[i].innerHTML=v;}
    var b=document.querySelectorAll('.langs button');
    for(var j=0;j<b.length;j++)b[j].classList.toggle('on',b[j].getAttribute('data-l')===l);
    put(l);
  }
  window.setL=setL;
  setL(get()||((navigator.language||'fr').slice(0,2)));
  document.addEventListener('click',function(e){var t=e.target.closest('.langs button');if(t)setL(t.getAttribute('data-l'));});

  var d=document.getElementById('drawer');
  document.getElementById('burger').onclick=function(){d.classList.add('open')};
  document.getElementById('closeDrawer').onclick=function(){d.classList.remove('open')};
  d.addEventListener('click',function(e){if(e.target.tagName==='A')d.classList.remove('open')});


  var ua=navigator.userAgent||'',store=/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&'ontouchend' in document)?'https://apps.apple.com/be/app/coach-dm/id6792289062':(/Android/.test(ua)?'https://play.google.com/store/apps/details?id=be.coachdm.app':null);
  if(store){var dl=document.querySelectorAll('.dl-app');for(var z=0;z<dl.length;z++){dl[z].href=store;dl[z].target='_blank';dl[z].rel='noopener'}}
  var ga=document.getElementById('getapp');
  if(ga){
    var band=document.querySelector('.appband');
    function gs(){var inB=false;if(band){var r=band.getBoundingClientRect();inB=r.top<innerHeight&&r.bottom>0}ga.classList.toggle('show',window.scrollY>300&&!inB)}
    window.addEventListener('scroll',gs,{passive:true});gs();}
  var nav=document.getElementById('nav');
  function onScroll(){nav.classList.toggle('solid',window.scrollY>30)}
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();

  var els=document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{rootMargin:'0px 0px -6% 0px'});
    els.forEach(function(el){io.observe(el)});
  } else els.forEach(function(el){el.classList.add('in')});

  var r=document.getElementById('reel');
  if(r){
  function step(){var f=r.querySelector('figure');return f?f.getBoundingClientRect().width+22:300}
  document.getElementById('prev').onclick=function(){r.scrollBy({left:-step(),behavior:'smooth'})};
  document.getElementById('next').onclick=function(){r.scrollBy({left:step(),behavior:'smooth'})};
  var down=false,sx=0,sl=0;
  r.addEventListener('mousedown',function(e){down=true;sx=e.pageX;sl=r.scrollLeft;r.style.scrollSnapType='none'});
  window.addEventListener('mouseup',function(){if(down){down=false;r.style.scrollSnapType=''}});
  r.addEventListener('mousemove',function(e){if(down){e.preventDefault();r.scrollLeft=sl-(e.pageX-sx)}});
  }

  /* Catalogue : filtres */
  var fb=document.querySelectorAll('.filters button');
  fb.forEach(function(b){b.addEventListener('click',function(){
    var c=b.getAttribute('data-cat');
    fb.forEach(function(x){x.classList.toggle('on',x===b)});
    document.querySelectorAll('.prog').forEach(function(p){p.hidden=!(c==='all'||p.getAttribute('data-cat')===c)});
  })});
})();
