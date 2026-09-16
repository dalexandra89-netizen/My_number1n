(() => {
"use strict";

const CFG = {
  duration: 45,
  lives: 3,
  speed: 18.2,
  laneX: [24.5, 50, 75.5],
  heroTop: 68,
  heroBottom: 87,
  collectPoints: 90,
  shotPoints: 120,
  crashPenalty: 120
};

const GOOD = Array.from({length:8},(_,i)=>`assets/good_${String(i+1).padStart(2,"0")}.jpg`);
const BAD  = Array.from({length:10},(_,i)=>`assets/bad_${String(i+1).padStart(2,"0")}.jpg`);

const LEVEL = [
  {t:1.2,l:1,k:"good",i:0},{t:1.2,l:0,k:"bad",i:5},
  {t:3.0,l:0,k:"good",i:1},{t:3.0,l:2,k:"bad",i:6},
  {t:4.8,l:2,k:"bad",i:0},{t:4.8,l:0,k:"good",i:5},
  {t:6.7,l:1,k:"bad",i:1},{t:6.7,l:2,k:"bad",i:7},
  {t:8.5,l:2,k:"good",i:2},{t:8.5,l:1,k:"good",i:6},
  {t:10.4,l:0,k:"bad",i:2},{t:10.4,l:2,k:"bad",i:8},
  {t:12.1,l:1,k:"good",i:3},{t:12.1,l:0,k:"good",i:7},

  {t:14.0,l:0,k:"good",i:4},{t:14.0,l:2,k:"bad",i:3},
  {t:16.4,l:0,k:"bad",i:4},{t:16.4,l:1,k:"good",i:0},
  {t:19.0,l:2,k:"good",i:1},{t:19.0,l:1,k:"bad",i:0},

  {t:21.8,l:0,k:"good",i:2},{t:21.8,l:2,k:"good",i:3},
  {t:24.0,l:1,k:"bad",i:1},{t:24.0,l:2,k:"bad",i:9},
  {t:26.0,l:0,k:"bad",i:2},{t:26.0,l:2,k:"good",i:4},
  {t:28.2,l:1,k:"good",i:0},{t:28.2,l:0,k:"bad",i:6},

  {t:30.7,l:0,k:"bad",i:3},{t:30.7,l:1,k:"good",i:1},{t:30.7,l:2,k:"bad",i:4},
  {t:33.5,l:0,k:"good",i:2},{t:33.5,l:2,k:"good",i:3},{t:35.8,l:1,k:"bad",i:0},
  {t:35.8,l:2,k:"good",i:7},

  {t:38.2,l:0,k:"bad",i:1},{t:38.2,l:2,k:"good",i:4},
  {t:40.3,l:1,k:"good",i:0},{t:40.3,l:0,k:"bad",i:9},
  {t:41.3,l:0,k:"good",i:3},{t:41.3,l:2,k:"bad",i:2},
  {t:43.0,l:1,k:"bad",i:8}
];

const game = document.querySelector("#game");
const objectsRoot = document.querySelector("#objects");
const hero = document.querySelector("#hero");
const webLayer = document.querySelector("#web-layer");
const fxLayer = document.querySelector("#fx-layer");
const scoreEl = document.querySelector("#score");
const livesEl = document.querySelector("#lives");
const progressEl = document.querySelector("#progress");
const toast = document.querySelector("#toast");
const startOverlay = document.querySelector("#start");
const finishOverlay = document.querySelector("#finish");

let lane=1, score=0, lives=CFG.lives, goodCount=0, badCount=0;
let playing=false, began=0, lastFrame=0, nextIndex=0, objects=[], raf=0;
let gameRect={w:0,h:0};

function syncGameRect(){
  const r=game.getBoundingClientRect();
  gameRect.w=r.width;gameRect.h=r.height;
}
function heroOffsetPx(l){
  return ((CFG.laneX[l]-50)/100)*gameRect.w;
}
function setHeroX(){
  hero.style.setProperty("--hero-x",`${heroOffsetPx(lane)}px`);
}
function positionCard(obj){
  const py=(obj.y/100)*gameRect.h;
  obj.el.style.setProperty("--cy",`${py}px`);
}

function renderHud(){
  scoreEl.textContent = score;
  livesEl.textContent = Array.from({length:CFG.lives},(_,i)=>i<lives?"♥":"♡").join(" ");
}
function notify(text){
  toast.textContent = text;
  toast.className = "show";
  clearTimeout(notify.timer);
  notify.timer = setTimeout(()=>toast.className="",520);
}
function reset(){
  cancelAnimationFrame(raf);
  objects.forEach(o=>o.el.remove());
  objects = [];
  webLayer.innerHTML = "";
  fxLayer.innerHTML = "";
  lane=1;score=0;lives=CFG.lives;goodCount=0;badCount=0;nextIndex=0;lastFrame=0;
  syncGameRect();
  hero.className = "";
  setHeroX();
  progressEl.style.width = "0%";
  renderHud();
}
function move(dir){
  if(!playing) return;
  const old=lane;
  lane=Math.max(0,Math.min(2,lane+dir));
  if(old===lane) return;
  setHeroX();
  hero.className=dir<0?"bank-left":"bank-right";
  navigator.vibrate?.(14);
  setTimeout(()=>{if(playing)hero.className=""},170);
}
function spawn(spec){
  const el=document.createElement("div");
  el.className=`card ${spec.k}`;
  const pool=spec.k==="good"?GOOD:BAD;
  const src=pool[spec.i%pool.length];
  el.innerHTML=`<img src="${src}" alt=""><span class="${spec.k==="good"?"good-dot":"bad-dot"}">${spec.k==="good"?"✓":"!"}</span>`;
  el.style.left=`${CFG.laneX[spec.l]}%`;
  objectsRoot.appendChild(el);

  const obj={el,k:spec.k,l:spec.l,y:-18,dead:false};
  positionCard(obj);
  objects.push(obj);

  el.addEventListener("pointerdown",e=>{
    e.preventDefault();e.stopPropagation();
    if(!playing||obj.dead)return;
    if(obj.k==="bad") shoot(obj);
    else notify("Хорошую карточку нужно собрать");
  });
}
function shoot(obj){
  obj.dead=true;
  badCount++;
  score+=CFG.shotPoints;
  renderHud();
  hero.className="shoot";
  drawWeb(obj.el);
  popText(obj.el,"WEB!");
  obj.el.classList.add("shot");
  navigator.vibrate?.([16,14,20]);
  setTimeout(()=>{if(playing)hero.className=""},160);
  setTimeout(()=>removeObj(obj),270);
}
function drawWeb(target){
  const g=game.getBoundingClientRect(),h=hero.getBoundingClientRect(),t=target.getBoundingClientRect();
  const x1=((h.left+h.width*.5-g.left)/g.width)*100;
  const y1=((h.top+h.height*.34-g.top)/g.height)*100;
  const x2=((t.left+t.width*.5-g.left)/g.width)*100;
  const y2=((t.top+t.height*.5-g.top)/g.height)*100;

  [[0,0,"web"],[1.0,.7,"web2"],[-1.0,-.6,"web2"]].forEach(([ox,oy,cls])=>{
    const line=document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1",x1);line.setAttribute("y1",y1);
    line.setAttribute("x2",x2+ox);line.setAttribute("y2",y2+oy);
    line.setAttribute("class",cls);
    webLayer.appendChild(line);
    setTimeout(()=>line.remove(),260);
  });
}
function popText(target,text){
  const g=game.getBoundingClientRect(),t=target.getBoundingClientRect();
  const el=document.createElement("div");
  el.className="burst-text";el.textContent=text;
  el.style.left=`${t.left+t.width*.72-g.left}px`;
  el.style.top=`${t.top+t.height*.45-g.top}px`;
  fxLayer.appendChild(el);
  setTimeout(()=>el.remove(),430);
}
function impact(){
  const g=game.getBoundingClientRect(),h=hero.getBoundingClientRect();
  const cx=h.left+h.width*.52-g.left;
  const cy=h.top+h.height*.45-g.top;
  const el=document.createElement("div");
  el.className="impact";
  el.style.left=`${cx}px`;el.style.top=`${cy}px`;
  fxLayer.appendChild(el);
  setTimeout(()=>el.remove(),520);
}
function collect(obj){
  obj.dead=true;
  goodCount++;
  score+=CFG.collectPoints;
  renderHud();
  obj.el.classList.add("collected");
  navigator.vibrate?.(10);
  notify(`+${CFG.collectPoints}`);
  setTimeout(()=>removeObj(obj),300);
}
function crash(obj){
  obj.dead=true;
  lives--;
  score=Math.max(0,score-CFG.crashPenalty);
  renderHud();
  hero.classList.add("hit","damaged");
  impact();
  navigator.vibrate?.([45,20,45]);
  notify(`−${CFG.crashPenalty} • повреждение`);
  setTimeout(()=>hero.classList.remove("hit"),480);
  setTimeout(()=>hero.classList.remove("damaged"),900);
  removeObj(obj);
  if(lives<=0) finish();
}
function removeObj(obj){
  if(obj.el.isConnected)obj.el.remove();
  objects=objects.filter(x=>x!==obj);
}
function startGame(){
  reset();
  playing=true;
  began=performance.now();
  startOverlay.classList.remove("show");
  finishOverlay.classList.remove("show");
  raf=requestAnimationFrame(tick);
}
function finish(){
  if(!playing)return;
  playing=false;
  cancelAnimationFrame(raf);
  document.querySelector("#final-score").textContent=score;
  document.querySelector("#final-good").textContent=goodCount;
  document.querySelector("#final-bad").textContent=badCount;
  document.querySelector("#result-title").textContent=
    lives<=0?"Попробуем ещё раз!":
    score>=1900?"Супергеройский результат!":
    score>=1200?"Отличная работа!":"Миссия выполнена!";
  finishOverlay.classList.add("show");
}
function tick(now){
  if(!playing)return;
  const elapsed=(now-began)/1000;
  const progress=Math.min(1,elapsed/CFG.duration);
  progressEl.style.width=`${progress*100}%`;

  while(nextIndex<LEVEL.length&&LEVEL[nextIndex].t<=elapsed){
    spawn(LEVEL[nextIndex++]);
  }
  if(elapsed>=CFG.duration){finish();return}

  const dt=Math.min(.04,lastFrame?(now-lastFrame)/1000:.016);
  lastFrame=now;

  [...objects].forEach(obj=>{
    if(obj.dead)return;
    obj.y+=CFG.speed*(1+progress*.18)*dt;
    positionCard(obj);

    if(obj.y>CFG.heroTop&&obj.y<CFG.heroBottom&&obj.l===lane){
      obj.k==="good"?collect(obj):crash(obj);
    }else if(obj.y>107){
      removeObj(obj);
    }
  });

  raf=requestAnimationFrame(tick);
}

document.querySelector("#start-btn").addEventListener("click",startGame);
document.querySelector("#again-btn").addEventListener("click",startGame);
document.querySelectorAll(".move-zone").forEach(z=>z.addEventListener("pointerdown",e=>{
  e.preventDefault();
  move(Number(z.dataset.dir));
}));
addEventListener("keydown",e=>{
  if(e.key==="ArrowLeft")move(-1);
  if(e.key==="ArrowRight")move(1);
});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&playing)finish()});
addEventListener("resize",()=>{
  syncGameRect();
  if(playing)setHeroX();
});
syncGameRect();
setHeroX();
renderHud();
})();