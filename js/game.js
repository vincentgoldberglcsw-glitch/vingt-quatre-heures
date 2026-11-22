import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {mergeVertices,mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildTables,makeCar as makeDyn,createVehicle,createInput,createEnv,resetVehicle,stepVehicle,latCap,MU_REF} from './sim/vehicle.js';
import {BOOT} from './boot.js';
import {Terrain} from './world/terrain.js';

await BOOT.step('TYRE AND ENGINE TABLES',.02);
let seed=7; const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
const ALM={u:{value:0},an:[],cat:null,dust:null,dn:0};   // Alameda scenery: sway clock, wandering animals, the caterpillar, dust
const rr=(a,b)=>a+rnd()*(b-a), pick=a=>a[rnd()*a.length|0], R=(a,b)=>a+Math.random()*(b-a);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),lerp=(a,b,t)=>a+(b-a)*t,sst=(x,a,b)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const QS=new URLSearchParams(location.search),$=id=>document.getElementById(id);

const renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15;
document.body.appendChild(renderer.domElement);
const ANISO=renderer.capabilities.getMaxAnisotropy();

const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0xd8cfb4,80,1100);
const camera=new THREE.PerspectiveCamera(16,innerWidth/innerHeight,0.12,5000);

function canvas(w,h,fn,srgb=true){const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=ANISO;return t;}
const std=o=>new THREE.MeshStandardMaterial(o);
const STORM={ships:[],tex:null,a:0,b:0};   // the stormy sea on the right of I-80 South, out to Berkeley (see stormTick)
const LIT={p:null,t:3};   // litter thrown from passing cars (see litterTick)
const SFSM=[];   // smoke sources on the decayed San Francisco towers
const SFP=[];    // the San Francisco pyramid towers, left unbaked so they can fall in the city quake (sfPyrTick)
const DSTK=[];   // two Richmond refinery stacks (and the houses beyond them), left unbaked so the daddy beetle's stomping can topple them (dadStackTick)
const BBQ=[];   // the roadside billboards on I-880 that fall during the quake (see bbQuakeTick)
const VANS=[];   // the ice-cream truck and the taco truck, driving up and down Paru (see vanTick)
const BEARS=[],BUFF=[];let DRUMG=null,DRUMM=null;
const MILLC={tw:[],i:-1,t:0,x:0,z:0,ry:0,y:0,w:null};   // the steel mill: its track index, and a timer for the falling pieces during the quake
const SHOP={ic:0,F:0,list:null,t:0};   // the supermarket shoppers (see shopTick)
const DOME={x:0,z:0,i:-1,hit:0},SAFEZ=()=>DRIVE&&((PL.idx<Z.tu0||zoneArr[PL.idx]===1)&&!DOME.hit||(PL.idx>=Z.wt1&&PL.idx<Z.wt0)||(Z.rb1>0&&PL.idx>=Z.rb1&&PL.idx<Z.i80));   /* (and Richmond, off the San Rafael bridge to I-80: hits only bounce) */   // (and the Webster Tube: no crashing in it)   // the green eyed dome in the road before the Posey Tube
const DETR={a:-1};   // the detour ramp: starts at index a, 240 segments long, drops to the ground by 60% of the way
// hyperspace jump into the portal: streaking stars stretch out from the centre (w 0..1 building), then on arrival they shrink away again (w 0..-1)
const WARP={c:null,s:null};
function warpDraw(w){if(!WARP.c){const c=document.createElement('canvas');c.width=480;c.height=270;c.style.cssText='position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:50;display:none';document.body.appendChild(c);WARP.c=c;WARP.s=Array.from({length:110},()=>({a:Math.random()*6.283,r:Math.random(),v:.5+Math.random()}));}
  const c=WARP.c;if(w===null||Math.abs(w)>=1){c.style.display='none';return;}c.style.display='block';const g=c.getContext('2d'),W=c.width,Hh=c.height,cx=W/2,cy=Hh/2,k=Math.abs(w),build=w>0;
  g.fillStyle=build?'rgba(0,6,24,'+(.15+k*.35)+')':'rgba(0,6,24,'+(.5*(1-k))+')';g.fillRect(0,0,W,Hh);
  const len=build?k*k*.5:(1-k)*.4,run=Math.max(W,Hh);
  for(const s of WARP.s){const r0=(s.r*.3+(build?k:1-k)*s.v*.7)*run*.55,r1=r0+len*run*s.v+2;g.strokeStyle=s.v>1?'#ffffff':'#9fd2ff';g.lineWidth=1+s.v;g.beginPath();g.moveTo(cx+Math.cos(s.a)*r0,cy+Math.sin(s.a)*r0);g.lineTo(cx+Math.cos(s.a)*r1,cy+Math.sin(s.a)*r1);g.stroke();}
  if(build&&k>.75){g.fillStyle='rgba(255,255,255,'+((k-.75)*4)+')';g.fillRect(0,0,W,Hh);}}
const PORTAL={c:null,tex:null,g:null,i:1e9,t:0,rail:null};   // the Richmond portal: its swirl canvas is redrawn a few times a second
const PPLM={};const pplM=c=>PPLM[c]||(PPLM[c]=std({color:c,roughness:.9}));
const SHIRTS=[0x8a3a30,0x2f5f7a,0xd8cfb0,0x4a6a4a,0x3a3a4a,0xc9a84a,0x6a4a6a,0xe8e4d8,0x1f3a5a,0xb3241c],PANTS=[0x2a2a30,0x3a4a6a,0x5a4a3a,0x1c1c1e,0x6a6a62],SKINS=[0xe0b896,0xc8946a,0x8a5a3a,0xf0d0b0,0x5a3a28];
const M4=new THREE.Matrix4(),Q=new THREE.Quaternion(),V=new THREE.Vector3(),V2=new THREE.Vector3(),S=new THREE.Vector3(),C=new THREE.Color(),E=new THREE.Euler();
const YAX=new THREE.Vector3(0,1,0);

await BOOT.step('SURVEYING THE ROAD',.04);
/* ================= TRACK ================= */
// pit straight (grandstand), fast right-hander, back straight, esses, hairpin loop
// Free drive (mode=drive) is a second world on the same engine: a town street, a tube, a freeway, a long bridge, a city, and a shore road home.
const DRIVE=QS.get('mode')==='drive',RW=DRIVE?6.6:9.5,LAPS=3;   // RW: half-width of the tarmac (the circuit is wider than the public road)
// Free drive route: a turtle drives the loop and leaves named marks. Axes: x is east, z is south; a heading th points along (sin th, cos th), so a right turn lowers th.
// From 1611 San Antonio: west straight into Central Ave, right up Wilma Chan Way, the Posey Tube, I-880 past the port, the Bay Bridge,
// downtown San Francisco, up Hyde Street, down to the Marina, the Golden Gate, the Marin redwoods, past San Quentin, the Richmond bridge, Richmond and Shane Drive,
// I-80 south past Berkeley, Emeryville and Oakland, then the Webster Tube back under the estuary, Buena Vista Avenue, and home.
const D2R=Math.PI/180;
// Marina Blvd: the turn off the foot of Hyde St is a wide, smooth sweep (radius MR). Hyde St and the Marina straight are each shortened by MR-60 so the turn ends exactly where the old 60 m corner did, and the Golden Gate, Marin and the rest of the loop do not move.
const MR=220;
// Alameda: every corner is a wide sweep. PR: San Antonio onto Paru (the straight before it is shortened by PR-52 so Paru St stays where it was), CR: Paru onto Central, WR: Central onto Wilma Chan Way,
// HR1..HR3: the way home (San Antonio from Grand, Grand from Buena Vista, Buena Vista from the Webster Tube). Grand St stays where it was too.
const PB=72,PLEN=PB*9+62,PR=110,CR=160,WR=260,HR1=120,HR2=110,HR3=110;
function routeTurtle(x,z,th){const pts=[],mk={},T={pts,mk,get x(){return x},get z(){return z},get th(){return th},
  push(){pts.push([x,z]);},
  S(len,st=40){const n=Math.max(1,Math.round(len/st));for(let k=0;k<n;k++){x+=Math.sin(th)*len/n;z+=Math.cos(th)*len/n;T.push();}return T;},
  A(deg,r){const a=deg*D2R,sg=Math.sign(a),cx=x+Math.cos(th)*r*sg,cz=z-Math.sin(th)*r*sg,n=Math.max(2,Math.ceil(Math.abs(a)*r/14));for(let k=1;k<=n;k++){const t2=th+a*k/n;x=cx-Math.cos(t2)*r*sg;z=cz+Math.sin(t2)*r*sg;T.push();}th+=a;return T;},
  L(d,r){return T.A(d,r);},R(d,r){return T.A(-d,r);},M(n){mk[n]=pts.length-1;return T;}};T.push();return T;}
function buildRoute(X80=-600){
  // Corners are swept, not square: every junction on the loop has about twice the radius it had, so it can be driven as a corner rather than stopped for.
  // The two straights into the Posey Tube are trimmed to suit, so that the tube mouth - and with it the port, the bridges and the coastlines - stays exactly where it was.
  const old=routeTurtle(0,0,-90*D2R).S(40).S(260).R(90,24).S(920).L(90,24).S(400).R(70,45).S(560).R(20,200);
  const lead=(a,b)=>routeTurtle(0,0,-90*D2R).M('t0').S(40).M('start').S(120).M('central').S(a).R(70,WR).M('wilma').S(b).R(20,420).M('tu0');   // the last bend into the Posey Tube: a long, wide, banked sweep
  const p0=lead(1,1),wd=-160*D2R,wl=1+(old.z-p0.z)/Math.cos(wd),cl=1-(old.x-p0.x-(wl-1)*Math.sin(wd));
  const f=lead(cl,wl);
  f.S(580,40).M('tu1')
   .S(260).L(12,500).M('i880').S(1700,60).M('detour').S(380,60).L(78,420).M('toll').S(520,52).M('b0').S(3300,70).M('b1')
   .S(791,35).M('downtown').R(90,100).M('hyde').S(655,30).M('marina').L(90,MR).S(415,45).R(90,120).M('gg0').S(1560,60).M('gg1')
   .S(260).R(25,500).M('woods').S(700,50).R(30,400).S(600,50).M('sq').R(35,300).S(700,50).M('rb0').S(2150,70).M('rb1')
   .S(380,40).M('richmond').L(25,260).S(400,40).M('shane').S(300,40).R(25,260);
  f.S(X80-700-f.x,50).M('refinery').R(90,700).M('i80');   // a wide, gentle sweep onto I-80, banked for speed
  // the way home, driven backwards from the house so the two ends can be made to meet: east on San Antonio, north on Grand, west on Buena Vista, north through the Webster Tube, then up to the I-80 line
  const tu=f.pts[f.mk.tu0],Xt=tu[0]+90,r1=HR1,r2=HR2,r3=HR3,S0=280-r1,n=-tu[1]-r1-r2-r3-250,w=S0+r1-r2-r3-Xt;
  const ret=d=>{const r=routeTurtle(0,0,90*D2R);r.S(S0).L(90,r1).S(n).M('bv').L(90,r2).S(w).R(90,r3).S(250).M('wt0').S(580,40).M('wt1').S(80).R(35,700).S(d,60).L(35,700);return r;};
  const g=d=>ret(d).x-X80;let a=50,b=4000;for(let k=0;k<60;k++){const mid=(a+b)/2;if(g(a)*g(mid)<=0)b=mid;else a=mid;}const r=ret((a+b)/2);
  // I-80 south: a climb, then two winding S-bends (each cancels out, so the road comes back to the I-80 line), a short run to Berkeley, the Emeryville interchange, then straight on towards Oakland to meet the way home
  f.S(120,60).R(8,1100).S(100,60).L(16,1100).S(100,60).R(8,1100).M('berkeley').S(100,60).L(10,1100).S(120,60).R(20,1100).S(120,60).L(10,1100).M('emeryville').S(1650,60).M('oakland');f.S(r.z-f.z,60);
  const pts=f.pts.slice(),mk={...f.mk},rp=r.pts.slice().reverse();rp.pop();
  const o=pts.length-1;for(const[k,v]of Object.entries(r.mk))mk[k]=o+(r.pts.length-1-v);
  for(let i=1;i<rp.length;i++)pts.push(rp[i]);
  return {pts,mk};}
const ROUTE=DRIVE?buildRoute():null,DRIVE_PTS=DRIVE?ROUTE.pts:null;
const ctrl=(DRIVE?DRIVE_PTS:[[0,0],[300,0],[600,0],[900,0],[1200,0],[1500,0],[1690,50],[1800,210],[1790,420],[1650,545],[1400,570],[1120,566],[840,562],[560,560],[420,500],[280,540],[120,610],[-140,600],[-360,470],[-430,240],[-340,60],[-170,0]]).map(p=>new THREE.Vector3(p[0],0,p[1]));
const curve=new THREE.CatmullRomCurve3(ctrl,true,'centripetal'); curve.arcLengthDivisions=DRIVE?30000:3000;
const LEN=curve.getLength(), NS=Math.floor(LEN/2), SEG=LEN/NS;
const BK=new Float32Array(NS+1),bkY=(i,o)=>{const b=BK[i];if(!b)return 0;const s=b>0?1:-1,q=s>0?Math.max(-7,Math.min(11,o)):Math.min(7,Math.max(-11,o));return(q+7*s)*b;};   // banked curves: BK is the rise per metre across the road (+ raises the left-hand side). The road tilts up from its low edge (7 m out on the inside of the bend), so nothing sinks below the ground; anything built along it tilts too, out to 11 m
const P=[],T=[],Nn=[];
for(let i=0;i<=NS;i++){const u=(i%NS)/NS;const p=curve.getPointAt(u),t=curve.getTangentAt(u);P.push(p);T.push(t);Nn.push(new THREE.Vector3(t.z,0,-t.x));}
const yaw=i=>Math.atan2(T[i].x,T[i].z);
const off=(i,o,y=0,out=new THREE.Vector3())=>out.set(P[i].x+Nn[i].x*o,y+P[i].y+bkY(i,o),P[i].z+Nn[i].z*o);   // y is height above the road at that point
const IGCL={h:[],c:[]};   // houses and parked cars the iguanas can climb on (iguMoreTick)
const wrapI=i=>((i%NS)+NS)%NS, wrapS=s=>((s%LEN)+LEN)%LEN, wdiff=d=>((d+LEN*1.5)%LEN)-LEN/2;
// position on track by arc length + lateral offset
function at(s,lat,y=0,out=new THREE.Vector3()){s=wrapS(s);const f=s/SEG,i=Math.floor(f)%NS,k=f-Math.floor(f),a=P[i],b=P[i+1],n=Nn[i];return out.set(lerp(a.x,b.x,k)+n.x*lat,y+lerp(a.y,b.y,k)+lerp(bkY(i,lat),bkY(i+1,lat),k),lerp(a.z,b.z,k)+n.z*lat);}
// curvature, racing line, speed limits
const kS=[],vc=[],line=[];
{const raw=[];for(let i=0;i<NS;i++){const b=T[(i+1)%NS],a=T[i];raw.push(((b.x-a.x)*Nn[i].x+(b.z-a.z)*Nn[i].z)/SEG);}
 for(let i=0;i<NS;i++){let s=0;for(let j=-10;j<=10;j++)s+=raw[wrapI(i+j)];kS.push(s/21);}
 for(let i=0;i<NS;i++)line.push(clamp(kS[i]*420,-1,1)*(RW-3));}
// fastest speed each point of the track can be taken at (same grip curve as the car), then walked backwards so braking distance is built in
const limV=(mult,brake)=>{const a=[];for(let i=0;i<NS;i++){const k=Math.max(Math.abs(kS[i]),1e-4);let v=60;for(let j=0;j<5;j++)v=Math.sqrt(latCap(Math.min(v,112))*mult/k);a.push(Math.min(112,v));}
  for(let p=0;p<2;p++)for(let i=NS-1;i>=0;i--)a[i]=Math.min(a[i],Math.sqrt(a[(i+1)%NS]**2+2*brake*SEG));return a;};
for(const v of limV(.86,16))vc.push(v);const vcp=limV(.95,15);
// where the solid edge of the road is (guardrail, kerb, tunnel wall) and where the tarmac ends, per point of the track
const wallAt=new Float32Array(NS).fill(8.75),edgeAt=new Float32Array(NS).fill(RW+.1),wallR=new Float32Array(NS),KB=new Uint8Array(NS),zoneArr=new Uint8Array(NS),ZN=['race','town','tunnel','freeway','bridge','city','return','forest','hills'],zoneOf=i=>ZN[zoneArr[wrapI(i)]],landIdx=[];   // wallR: a wider right-hand edge where an exit lane opens
const Z=DRIVE?(()=>{const z={};for(const k in ROUTE.mk){const[x,zz]=DRIVE_PTS[ROUTE.mk[k]];let b=0,bd=1e18;for(let i=0;i<NS;i++){const d=(P[i].x-x)**2+(P[i].z-zz)**2;if(d<bd){bd=d;b=i;}}z[k]=b;}z.t0=0;
  const fill=(a,b,code,wall,edge)=>{for(let i=a;i!==b;i=(i+1)%NS){zoneArr[i]=code;wallAt[i]=wall;edgeAt[i]=edge;}};
  // town and city streets: the wall stands at the back of the pavement, so the car can mount the kerb and run along the pavement (trees, hedges and parked cars are still in the way)
  fill(0,z.wilma,1,8.6,9.5);fill(z.wilma,z.tu0,3,7.2,6.7);fill(z.tu0,z.tu1,2,5.8,9);fill(z.tu1,z.b0,3,7.2,6.7);fill(z.b0,z.b1,4,7.2,9);fill(z.b1,z.gg0,5,8.6,9.5);fill(z.gg0,z.gg1,4,7.2,9);
  fill(z.gg1,z.rb0,7,11,6.7);fill(z.rb0,z.rb1,4,7.2,9);fill(z.rb1,z.i80,8,9,6.7);fill(z.i80,z.wt1,3,7.2,6.7);fill(z.wt1,z.wt0,2,5.4,9);fill(z.wt0,0,1,8.6,9.5);
  for(let k=1;k<=Math.round(320/SEG);k++){wallAt[z.gg0-k]=8.2;edgeAt[z.gg0-k]=6.7;}   // the approach to the Golden Gate has concrete barriers, not pavement
  for(const[a,b,w0]of[[z.tu0,z.tu1,5.8],[z.wt1,z.wt0,5.4]])for(let k=1;k<=50;k++){wallAt[a-k]=Math.min(wallAt[a-k],w0+k*.056);wallAt[b+k]=Math.min(wallAt[b+k],w0+k*.036);}
  z.BR=[[z.b0,z.b1],[z.gg0,z.gg1],[z.rb0,z.rb1]];return z;})():null;
const CLF=Z?[Z.sq-Math.round(720/SEG),Z.sq-Math.round(380/SEG)]:null;   // Marin: the stretch where the road runs along a cliff above the bay, on the left
const LKR={im:null,p:[],fly:[]},LAKE={g:null,wy:0,col:new THREE.Color(0x35401e)};   // the breakable timber rail along the Marin cliff, and the lake below it (lakeStart etc.)
const BRH=[];   // the suspension spans (where the hanging cables are) and the height of the main cable along them, for the quakes' snapping cables
// Free drive only: H is the height of the road at each point (Wilma Chan's overpass, the freeway viaducts, the climbs onto the bridges, Hyde Street, the Marin headlands, Shane Drive), XW is extra half-width (avenues, freeways, the toll plaza).
const XW=new Float32Array(NS+1),H=new Float32Array(NS+1);
if(DRIVE){const bump=(i,a,b,c,d)=>sst(i,a,b)*(1-sst(i,c,d)),m=x=>Math.round(x/SEG),z=Z,xwT=new Float32Array(NS),WL=Math.min(z.tu0-z.wilma,m(464));
  for(let i=0;i<NS;i++){const c=zoneArr[i];xwT[i]=c===1?2.2:c===3?(i<z.tu0?1.4:2.4):c===4?1.8:c===5?1.2:c===8?.6:0;if((i>z.tu0-m(220)&&i<z.tu1+m(220))||(i>z.wt1-m(220)&&i<z.wt0+m(220)))xwT[i]=0;}
  for(let i=0;i<NS;i++){let s=0;for(let j=-25;j<=25;j++)s+=xwT[wrapI(i+j)];XW[i]=s/51+4.6*bump(i,z.toll+m(70),z.toll+m(120),z.toll+m(240),z.toll+m(290))+1.3*bump(i,z.detour+m(170),z.detour+m(260),z.toll+m(110),z.toll+m(170))+2.4*bump(i,z.hyde-m(20),z.hyde+m(40),z.marina-m(70),z.marina-m(10));   /* the approach to the toll plaza is a little wider, with lane lines */
    H[i]=5.4*bump(i,z.wilma+WL*.10,z.wilma+WL*.36,z.wilma+WL*.5,z.wilma+WL*.665)+1.5*bump(i,z.wilma+WL*.33,z.wilma+WL*.365,z.wilma+WL*.365,z.wilma+WL*.40)+1.6*bump(i,z.wilma+WL*.10,z.wilma+WL*.36,z.wilma+WL*.685,z.wilma+WL*.705)   /* Wilma Chan overpass: comes down to a short level lip and drops off it - a small jump on the way to the tube */
      +22*bump(i,z.tu1+m(240),z.tu1+m(520),z.toll-m(520),z.toll-m(260))
      +22*bump(i,z.b0-m(240),z.b0-m(10),z.b1-m(460),z.b1-m(120))
      +15*bump(i,z.rb0-m(1150),z.rb0-m(750),z.rb0-m(480),z.rb0-m(15))   /* before the Richmond-San Rafael bridge: the road climbs to a headland over the bay, then comes gently down onto the deck */
      +78*bump(i,z.hyde+m(50),z.hyde+m(360),z.hyde+m(425),z.hyde+m(645))   /* Hyde St: a long, very steep climb, a short crest, then a sharp drop towards the Wharf */
      +26*bump(i,z.gg0-m(300),z.gg0-m(20),z.sq-m(650),z.sq-m(150))
      +30*bump(i,z.sq-m(1500),z.sq-m(1100),z.sq-m(1050),z.sq-m(850))   /* out of the redwoods: a long, steeper climb to a crest, then a sharp drop */
      +9*Math.sin((i-z.gg1)*SEG/170)*bump(i,z.gg1+m(150),z.gg1+m(350),z.sq-m(900),z.sq-m(700))
      +16*bump(i,z.rb0+m(500),z.rb0+m(1000),z.rb0+m(1500),z.rb0+m(2000))
      +24*bump(i,z.richmond+m(80),z.shane-m(80),z.shane+m(150),z.refinery-m(300))
      +7*Math.sin((i-z.richmond)*SEG/140)*bump(i,z.richmond+m(60),z.richmond+m(200),z.shane-m(60),z.shane-m(10))   /* rolling hills through Richmond */
      +12*bump(i,z.i80+m(150),z.i80+m(330),z.wt1-m(600),z.wt1-m(380))+16*bump(i,z.i80+m(260),z.i80+m(700),z.berkeley-m(260),z.berkeley+m(200));   /* I-80: up onto the viaduct, then a climb over the first bends, and down towards Berkeley */
    wallAt[i]+=XW[i];edgeAt[i]+=XW[i];if(i>=z.wilma+m(10)&&i<=z.wilma+m(75))wallAt[i]=edgeAt[i]=38;   // the drive-in lot on Wilma Chan Way is open ground
    if(i>=z.detour-m(30)&&i<=z.detour-m(30)+175){const u=(i-(z.detour-m(30)))/240;wallR[i]=RW+XW[i]+14+150*u*u;}}   // the detour exit lane opens on the right
  // banked bends: the outside of the curve raised, by how tightly the road turns (from the tangents), faded in and out at the ends of each stretch
  const bankOn=(a,b,amt,g=45)=>{const fd=m(25);for(let i=a;i<=b;i++){let c=0;for(let q=-8;q<8;q++){const u=wrapI(i+q),v=wrapI(u+1);c+=(T[v].x-T[u].x)*Nn[u].x+(T[v].z-T[u].z)*Nn[u].z;}const env=sst(i,a,a+fd)*(1-sst(i,b-fd,b));BK[wrapI(i)]=clamp(-c/(16*SEG)*g,-amt,amt)*env;}};
  bankOn(z.refinery-m(60),z.i80+m(60),.17,120);bankOn(z.i80+m(80),z.berkeley+m(40),.12,120);bankOn(z.berkeley+m(60),z.emeryville+m(40),.12,120);   // the wide sweep from Shane Drive onto I-80, taken at speed
  bankOn(z.rb1+m(80),z.richmond+m(60),.16);bankOn(z.rb0-m(1000),z.rb0-m(60),.16);bankOn(z.sq+m(40),z.rb0+m(20),.1);   // past San Quentin: a gentle banked curve through the badlands
  bankOn(z.richmond+m(40),z.shane,.08);   // Richmond's sloping bend
  bankOn(z.wilma-m(WR*1.222+40),z.wilma+m(40),.26);   // the Alameda corners: wide and steeply banked, for 175 mph
  bankOn(z.sq-m(830),z.sq-m(590),.22);   // the bend out of the redwoods into the prison field, for 150 mph
  bankOn(z.tu0-m(200),z.tu0-m(10),.2);   // into the Posey Tube
  bankOn(z.tu1+m(200),z.tu1+m(430),.08);   // out of the tube and up onto I-880
  bankOn(z.oakland+m(100),z.wt1-m(50),.12,120);   // the long, gentle bend down off I-80 into the Webster Tube
  bankOn(z.marina-m(30),z.marina+m(MR*1.571+30),.26);   // Marina Blvd: the left turn is wide and steeply banked, for 150 mph
  XW[NS]=XW[0];H[NS]=H[0];for(let i=0;i<=NS;i++)P[i].y=H[i];
  for(let i=0;i<NS;i++){const c=zoneArr[i];if((c===1||c===3||c===7||c===8)&&H[i]<.5)landIdx.push(i);}}
const span=(a,b,fn)=>{if(a<b)fn(a,b);else{fn(a,NS);fn(0,b);}};   // vc: rivals, vcp: the player's own limit (drives the brake warning)

function ribbon(o1,o2,y1,y2,mat,vScale=12,i0=0,i1=NS){
  const pos=[],uv=[],idx=[];
  const fv=(v,i)=>typeof v==='function'?v(i):v;   // offsets and heights may vary along the road
  for(let i=i0;i<=i1;i++){const p=P[i],n=Nn[i],a=fv(o1,i),b=fv(o2,i);
    pos.push(p.x+n.x*a,fv(y1,i)+p.y+bkY(i,a),p.z+n.z*a, p.x+n.x*b,fv(y2,i)+p.y+bkY(i,b),p.z+n.z*b);uv.push(0,i*2/vScale,1,i*2/vScale);
    if(i<i1){const q=(i-i0)*2;idx.push(q,q+2,q+1,q+1,q+2,q+3);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);g.computeVertexNormals();const m=new THREE.Mesh(g,mat);m.receiveShadow=true;scene.add(m);return m;
}
const speck=(g,w,h,n,cols,sz=2)=>{for(let i=0;i<n;i++){g.fillStyle=cols[Math.random()*cols.length|0];g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*sz,1+Math.random()*sz);}};

const roadTex=canvas(1024,2048,(g,w,h)=>{
  g.fillStyle='#57585b';g.fillRect(0,0,w,h);
  speck(g,w,h,160000,['rgba(30,30,32,.35)','rgba(120,120,118,.3)','rgba(150,146,136,.22)','rgba(70,68,66,.4)'],2);
  for(let i=0;i<9;i++){g.fillStyle=`rgba(${40+Math.random()*30|0},${40+Math.random()*30|0},${44+Math.random()*30|0},.35)`;const x=60+Math.random()*(w-300),y=Math.random()*h;g.fillRect(x,y,120+Math.random()*260,160+Math.random()*420);}
  let gr=g.createLinearGradient(0,0,w,0);gr.addColorStop(.1,'rgba(18,18,22,0)');gr.addColorStop(.34,'rgba(18,18,22,.36)');gr.addColorStop(.62,'rgba(18,18,22,.3)');gr.addColorStop(.9,'rgba(18,18,22,0)');
  g.fillStyle=gr;g.fillRect(0,0,w,h);
  for(let i=0;i<34;i++){g.strokeStyle=`rgba(10,10,12,${.08+Math.random()*.22})`;g.lineWidth=5+Math.random()*9;const x=220+Math.random()*560;g.beginPath();g.moveTo(x,0);g.bezierCurveTo(x+60,h*.3,x-60,h*.6,x,h);g.stroke();}
  g.strokeStyle='rgba(20,20,22,.55)';g.lineWidth=1.5;for(let i=0;i<40;i++){let x=Math.random()*w,y=Math.random()*h;g.beginPath();g.moveTo(x,y);for(let k=0;k<10;k++){x+=(Math.random()-.5)*46;y+=Math.random()*40;g.lineTo(x,y);}g.stroke();}
  for(const x of [40,968]){g.fillStyle='#c9a332';g.fillRect(x,0,15,h);}
  g.fillStyle='rgba(228,222,206,.85)';g.fillRect(506,0,11,h*.42);
  speck(g,w,h,9000,['rgba(84,84,86,.75)'],5);
  for(let i=0;i<5000;i++){g.fillStyle='rgba(84,84,86,.7)';const x=[40,968,506][i%3]+Math.random()*15;g.fillRect(x,Math.random()*h,3,3+Math.random()*9);}
});
const roadBump=canvas(512,512,(g,w,h)=>{g.fillStyle='#808080';g.fillRect(0,0,w,h);for(let i=0;i<60000;i++){const v=Math.random()*255|0;g.fillStyle=`rgb(${v},${v},${v})`;g.fillRect(Math.random()*w,Math.random()*h,1.5,1.5);}},false);
roadTex.wrapS=roadTex.wrapT=roadBump.wrapS=roadBump.wrapT=THREE.RepeatWrapping;roadBump.repeat.set(6,6);
const roadMat=std({map:roadTex,bumpMap:roadBump,bumpScale:1.2,roughness:.72});
let QK=null;
// the Bay Bridge earthquake: 120 m of deck goes, all the right-hand lanes and most of the left, leaving a strip about 4 m wide along the left rail (ls: where the break runs)
if(DRIVE){const qa=Z.b0+Math.round((Z.b1-Z.b0)*.74),qb=qa+36,ls=1.2;ribbon(i=>-RW-XW[i],i=>RW+XW[i],.02,.02,roadMat,28,0,qa);ribbon(i=>-RW-XW[i],i=>RW+XW[i],.02,.02,roadMat,28,qb,NS);
  QK={a:qa,b:qb,ls,st:0,t:0,side:-1,half:[ribbon(ls,i=>RW+XW[i],.02,.02,roadMat,28,qa,qb),ribbon(i=>-RW-XW[i],ls,.02,.02,roadMat,28,qa,qb)]};}   // half[0] is the strip that stays; half[1] is what falls
else ribbon(-RW,RW,0.02,0.02,roadMat,28);
const dirtTex=canvas(256,512,(g,w,h)=>{g.fillStyle='#8f8566';g.fillRect(0,0,w,h);speck(g,w,h,30000,['rgba(60,54,40,.35)','rgba(170,160,128,.4)','rgba(110,120,70,.35)','rgba(190,184,160,.3)'],3);
  let gr=g.createLinearGradient(0,0,w,0);gr.addColorStop(0,'rgba(86,104,52,.9)');gr.addColorStop(.45,'rgba(86,104,52,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
dirtTex.wrapS=dirtTex.wrapT=THREE.RepeatWrapping;
const dirtMat=std({map:dirtTex,roughness:1});
if(!DRIVE){ribbon(-9.6,-RW,0.01,0.015,dirtMat,6);ribbon(9.6,RW,0.01,0.015,dirtMat,6);}
const armTex=canvas(64,256,(g,w,h)=>{g.fillStyle='#c9cac2';g.fillRect(0,0,w,h);speck(g,w,h,900,['rgba(120,90,60,.35)','rgba(255,255,255,.3)','rgba(80,80,80,.25)'],4);g.fillStyle='rgba(40,40,40,.6)';g.fillRect(0,0,w,3);for(const x of[14,50]){g.beginPath();g.arc(x,12,3,0,7);g.fill();}});
armTex.wrapS=armTex.wrapT=THREE.RepeatWrapping;
const armMat=std({map:armTex,roughness:.45,metalness:.7,side:THREE.DoubleSide});
if(!DRIVE)for(const o of [-9.7,9.7]){for(const[y1,y2]of[[.3,.62],[.7,1.02]]){ribbon(o,o,y1,y2,armMat,4).castShadow=true;ribbon(o+.05*Math.sign(o),o,(y1+y2)/2,y2,armMat,4);}}
if(!DRIVE){const n=Math.floor(NS/2)*2,posts=new THREE.InstancedMesh(new THREE.BoxGeometry(.09,1.08,.14),std({color:0x6e6b60,metalness:.5,roughness:.6}),n);let k=0;
 for(let i=0;i<NS;i+=2)for(const sd of[-1,1]){Q.setFromAxisAngle(YAX,yaw(i));M4.compose(off(i,sd*9.82,.54,V),Q,S.set(1,1,1));posts.setMatrixAt(k++,M4);}posts.castShadow=true;scene.add(posts);}

const grassTex=canvas(512,512,(g,w,h)=>{g.fillStyle='#62753c';g.fillRect(0,0,w,h);
  for(let i=0;i<60000;i++){const k=Math.random();g.fillStyle=k<.5?'rgba(52,78,36,.5)':k<.85?'rgba(120,130,60,.45)':'rgba(170,158,88,.4)';g.fillRect(Math.random()*w,Math.random()*h,1.5,3+Math.random()*5);}});
grassTex.wrapS=grassTex.wrapT=THREE.RepeatWrapping;grassTex.repeat.set(900,900);
const groundMat=std({map:grassTex,roughness:1});
const ground=new THREE.Mesh(new THREE.PlaneGeometry(7000,7000),groundMat);
ground.rotation.x=-Math.PI/2;ground.position.set(170,0,220);ground.receiveShadow=true;scene.add(ground);
const START_I=DRIVE?Z.start:120,S0=START_I*SEG;
if(!DRIVE){const chk=canvas(256,32,(g,w,h)=>{for(let x=0;x<32;x++)for(let y=0;y<4;y++){g.fillStyle=(x+y)%2?'#e8e2d0':'#1b1b1b';g.fillRect(x*8,y*8,8,8);}});
 const m=new THREE.Mesh(new THREE.PlaneGeometry(13.2,1.2),std({map:chk,roughness:.8,polygonOffset:true,polygonOffsetFactor:-2}));m.rotation.set(-Math.PI/2,0,yaw(START_I));m.rotation.order='YXZ';m.rotation.set(-Math.PI/2,yaw(START_I),0);m.position.copy(P[START_I]).setY(.025);scene.add(m);}

await BOOT.step('PLANTING THE VERGES',.11);
/* ================= VEGETATION ================= */
// a grid of the road's points, so "how near is the road" is quick even on a 34 km loop
const GRID=new Map(),GC=60,gk=(cx,cz)=>cx*100003+cz;
for(let i=0;i<NS;i++){const k=gk(Math.floor(P[i].x/GC),Math.floor(P[i].z/GC));let a=GRID.get(k);if(!a)GRID.set(k,a=[]);a.push(i);}
function nearIdx(x,z,r,fn){const c0=Math.floor((x-r)/GC),c1=Math.floor((x+r)/GC),d0=Math.floor((z-r)/GC),d1=Math.floor((z+r)/GC);for(let cx=c0;cx<=c1;cx++)for(let cz=d0;cz<=d1;cz++){const a=GRID.get(gk(cx,cz));if(a)for(const i of a)if(fn(i)===false)return false;}return true;}
const farFromRoad=(x,z,min)=>nearIdx(x,z,min,i=>((P[i].x-x)**2+(P[i].z-z)**2<min*min)?false:undefined);
let groundAt=()=>0,groundNear=(x,z)=>groundAt(x,z);const LANDM=[],CULL=[];   /* CULL: scenery tiles drawn only within a few km of the camera */   // free drive: height of the land at a point (it rises with the road on real hills); the land materials, for snow
// Merge static scenery: every plain mesh is baked into world space and grouped by material and by a 350 m square, so a huge world costs few draw calls.
function bakeStatic(objs,keep){const buckets=new Map(),rm=[],skip=o=>{for(let p=o;p;p=p.parent)if(keep.has(p))return true;return false;};
  for(const o of objs){if(keep.has(o))continue;o.updateMatrixWorld(true);
    o.traverse(c=>{if(!c.isMesh||c.isInstancedMesh||Array.isArray(c.material)||skip(c))return;const g=c.geometry;if(!g.attributes.position||!g.attributes.normal||!g.attributes.uv)return;
      const gg=g.index?g.toNonIndexed():g.clone();for(const k of Object.keys(gg.attributes))if(k!=='position'&&k!=='normal'&&k!=='uv')gg.deleteAttribute(k);gg.morphAttributes={};gg.clearGroups();gg.applyMatrix4(c.matrixWorld);
      const e=c.matrixWorld.elements,key=c.material.uuid+'|'+Math.floor(e[12]/200)+'|'+Math.floor(e[14]/200)+'|'+(c.castShadow?1:0)+(c.visible?1:0);
      let b=buckets.get(key);if(!b)buckets.set(key,b={m:c.material,list:[],cs:c.castShadow,vis:c.visible});b.list.push(gg);rm.push(c);});}
  for(const c of rm)c.parent.remove(c);
  for(const b of buckets.values()){const g=mergeGeometries(b.list,false);if(!g)continue;const me=new THREE.Mesh(g,b.m);me.castShadow=b.cs;me.receiveShadow=true;me.visible=b.vis;scene.add(me);g.computeBoundingSphere();if(b.vis&&g.boundingSphere.radius<600)CULL.push(me);}
  for(const o of objs)if(!keep.has(o)&&o.isGroup&&!o.children.length)scene.remove(o);}
// Split big instanced batches (grass, trees, containers...) into 300 m tiles, so they can be culled by view and by distance like the rest.
function splitInstanced(im,cell=300){const n=im.count,groups=new Map(),mm=new THREE.Matrix4(),p=new THREE.Vector3(),cc=new THREE.Color();
  for(let k=0;k<n;k++){im.getMatrixAt(k,mm);p.setFromMatrixPosition(mm);const key=Math.floor(p.x/cell)+','+Math.floor(p.z/cell);let g=groups.get(key);if(!g)groups.set(key,g=[]);g.push(k);}
  for(const ids of groups.values()){const c=new THREE.InstancedMesh(im.geometry,im.material,ids.length);ids.forEach((k,j)=>{im.getMatrixAt(k,mm);c.setMatrixAt(j,mm);if(im.instanceColor){im.getColorAt(k,cc);c.setColorAt(j,cc);}});
    c.castShadow=im.castShadow;c.receiveShadow=im.receiveShadow;c.computeBoundingSphere();im.parent.add(c);if(c.boundingSphere.radius<600)CULL.push(c);}
  im.parent.remove(im);}
const GS0=70,GS1=170;
const leafTex=canvas(256,256,(g,w,h)=>{g.clearRect(0,0,w,h);
  for(let i=0;i<340;i++){const a=Math.random()*6.283,r=Math.sqrt(Math.random())*108;const x=128+Math.cos(a)*r,y=128+Math.sin(a)*r*.92;
    const l=30+Math.random()*30,s=5+Math.random()*7;g.save();g.translate(x,y);g.rotate(Math.random()*6.283);
    g.fillStyle=`hsl(${78+Math.random()*26},${26+Math.random()*20}%,${l}%)`;g.beginPath();g.ellipse(0,0,s*1.5,s*.62,0,0,7);g.fill();
    g.strokeStyle='rgba(20,34,14,.35)';g.lineWidth=.7;g.beginPath();g.moveTo(-s*1.4,0);g.lineTo(s*1.4,0);g.stroke();g.restore();}
  g.globalCompositeOperation='destination-out';for(let i=0;i<26;i++){g.beginPath();g.arc(Math.random()*w,Math.random()*h,4+Math.random()*10,0,7);g.fill();}});
const leafMat=std({map:leafTex,alphaTest:.5,side:THREE.DoubleSide,roughness:.9});
let coreG=new THREE.IcosahedronGeometry(1,2);coreG.deleteAttribute('uv');coreG.deleteAttribute('normal');coreG=mergeVertices(coreG);
{const p=coreG.attributes.position;for(let i=0;i<p.count;i++){V.fromBufferAttribute(p,i);V.multiplyScalar(1+.2*Math.sin(V.x*4.1+V.y*2.3)*Math.cos(V.z*3.7)+.1*Math.sin(V.y*7+V.x*5));p.setXYZ(i,V.x,V.y,V.z);}coreG.computeVertexNormals();}
const treePos=[],TOWNT=[];   // TOWNT: the street trees in town, which stand in the pavement and are solid
for(let i=0;i<NS;i+=3)for(const sd of [-1,1])for(let k=0;k<3;k++){
  if(rnd()<.14)continue;let o=sd*(22+k*14+rr(0,16)),minD=16;
  if(DRIVE&&sd<0&&i>Z.wilma+20/SEG&&i<Z.tu0-130/SEG){   // Wilma Chan Way: a thick belt of trees on the right. Own hash for spacing and jitter, so the seeded scenery after this is unchanged
    const hh=n=>{const s=Math.sin(i*12.9898+k*78.233+n*37.719)*43758.5453;return s-Math.floor(s);};
    if(hh(0)>=.3){const oo=-(13.5+k*6.5+hh(1)*4+XW[i]),x=P[i].x+Nn[i].x*oo+(hh(2)-.5)*3,z=P[i].z+Nn[i].z*oo+(hh(3)-.5)*3;if(farFromRoad(x,z,10))treePos.push([x,z]);}}
  if(DRIVE){const zn=zoneOf(i);if(zn==='town'){if(k||i%9||(i>Z.wt0-5&&i<Z.wt0+70))continue;o=sd*11.2;minD=9.5;}else if(zn==='freeway'){if(k||rnd()<.6||H[i]>1)continue;o=sd*rr(26,60);}else if(zn==='hills'){if(rnd()<.6||H[i]>.5)continue;}else continue;}   // street trees in town, a few by the freeways, oaks at the foot of the Richmond hills; the redwoods are their own
  else if(sd>0&&i>GS0-8&&i<GS1+8&&Math.abs(o)<36||sd<0&&i>GS0&&i<GS1)continue;
  const x=P[i].x+Nn[i].x*o+rr(-3,3)*(minD<16?.2:1),z=P[i].z+Nn[i].z*o+rr(-3,3)*(minD<16?.2:1);if(farFromRoad(x,z,minD)){treePos.push([x,z]);if(minD===9.5)TOWNT.push([x,z]);}}
const CARDS=34,NT=treePos.length;
const leaves=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),leafMat,NT*CARDS);
const cores=new THREE.InstancedMesh(coreG,std({roughness:1}),NT*2);
const barkTex=canvas(64,256,(g,w,h)=>{g.fillStyle='#4a3b2e';g.fillRect(0,0,w,h);for(let i=0;i<260;i++){g.fillStyle=Math.random()<.5?'rgba(24,18,14,.5)':'rgba(120,104,84,.35)';g.fillRect(Math.random()*w,Math.random()*h,2+Math.random()*3,10+Math.random()*40);}});
const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.2,.36,1,8),std({map:barkTex,roughness:1}),NT);
const boughs=new THREE.InstancedMesh(new THREE.CylinderGeometry(.06,.13,1,5),std({map:barkTex,roughness:1}),NT*3);
leaves.castShadow=cores.castShadow=trunks.castShadow=true;leaves.receiveShadow=true;
treePos.forEach(([x,z],i)=>{const hsl=[rr(.2,.29),rr(.24,.4),rr(.19,.28)];const pop=rnd()<.55;
  const H=pop?rr(17,26):rr(10,16),W=pop?rr(1.6,2.3):rr(3.4,5.4),th=pop?3.2:H*.36,cy=pop?(th+H)/2:th+(H-th)*.5,ry=pop?(H-th)/2:(H-th)*.55;
  M4.compose(V.set(x,(th+1.5)/2,z),Q.identity(),S.set(pop?1:1.3,th+1.5,pop?1:1.3));trunks.setMatrixAt(i,M4);
  for(let b=0;b<3;b++){E.set(rr(.5,1.1),rr(0,6.3),0,'YXZ');Q.setFromEuler(E);const L=pop?2:W*.9;V.set(0,L/2,0).applyQuaternion(Q).add(S.set(x,th+b*.9,z));M4.compose(V,Q,S.set(1,L,1));boughs.setMatrixAt(i*3+b,M4);}
  for(let b=0;b<2;b++){M4.compose(V.set(x+rr(-.4,.4),cy+(b?ry*.35:-ry*.25),z+rr(-.4,.4)),Q.setFromAxisAngle(YAX,rr(0,6)),S.set(W*(b?.36:.48),ry*(b?.45:.55),W*(b?.36:.48)));cores.setMatrixAt(i*2+b,M4);cores.setColorAt(i*2+b,C.setHSL(hsl[0],hsl[1],hsl[2]*.16));}
  for(let c=0;c<CARDS;c++){const a=rr(0,6.283),yy=rr(-.85,1),rad=Math.sqrt(1-yy*yy*.8)*rr(.35,1.02);
    V.set(x+Math.cos(a)*rad*W,cy+yy*ry,z+Math.sin(a)*rad*W);E.set(rr(-.9,.9),rr(0,6.283),rr(-.6,.6));Q.setFromEuler(E);
    const sc=pop?rr(2.8,4):rr(3.8,5.8);M4.compose(V,Q,S.set(sc,sc,1));leaves.setMatrixAt(i*CARDS+c,M4);
    leaves.setColorAt(i*CARDS+c,C.setHSL(hsl[0]+rr(-.025,.025),hsl[1]*(pop?.85:1),hsl[2]*(.72+(yy+1)*.3)*(pop?.8:1)+rr(-.03,.03)));}});
scene.add(leaves,cores,trunks,boughs);

const tuftTex=canvas(128,128,(g,w,h)=>{g.clearRect(0,0,w,h);for(let i=0;i<70;i++){const x=10+Math.random()*108,t=(Math.random()-.5)*46,hh=40+Math.random()*82;
  g.strokeStyle=`hsl(${68+Math.random()*34},${30+Math.random()*24}%,${30+Math.random()*30}%)`;g.lineWidth=1.2+Math.random()*1.6;g.beginPath();g.moveTo(x,h);g.quadraticCurveTo(x+t*.2,h-hh*.6,x+t,h-hh);g.stroke();}
  for(let i=0;i<5;i++){g.fillStyle=Math.random()<.5?'#d8cf9a':'#c7c08a';g.beginPath();g.ellipse(20+Math.random()*90,14+Math.random()*40,2,5,Math.random(),0,7);g.fill();}});
const poppyTex=canvas(128,128,(g,w,h)=>{g.clearRect(0,0,w,h);for(let i=0;i<9;i++){const x=12+Math.random()*104,y=14+Math.random()*60;g.strokeStyle='#4f6a34';g.lineWidth=1.5;g.beginPath();g.moveTo(x,h);g.lineTo(x+R(-4,4),y);g.stroke();
  g.fillStyle=Math.random()<.75?'#c9301f':'#e8e2c8';g.beginPath();g.arc(x,y,5+Math.random()*3,0,7);g.fill();g.fillStyle='#1a1a1a';g.beginPath();g.arc(x,y,1.6,0,7);g.fill();}});
const tuftMat=std({map:tuftTex,alphaTest:.4,side:THREE.DoubleSide,roughness:1});
{const tg=mergeGeometries([new THREE.PlaneGeometry(1,1).translate(0,.5,0),new THREE.PlaneGeometry(1,1).translate(0,.5,0).rotateY(Math.PI/2)]);
 const NTUFT=DRIVE?32000:52000,NPOP=DRIVE?3000:5000;
 const tufts=new THREE.InstancedMesh(tg,tuftMat,NTUFT);
 const pops=new THREE.InstancedMesh(tg,std({map:poppyTex,alphaTest:.4,side:THREE.DoubleSide,roughness:1}),NPOP);
 // in town the tufts keep to the front lawns, behind the pavement, and none grow in the supermarket car park or on the paved crossroads
 const mS=x=>Math.round(x/SEG),bare=[];
 const put=(mesh,k,lo,hi,s0,s1)=>{const i=DRIVE?landIdx[rnd()*landIdx.length|0]:rnd()*NS|0,sd=rnd()<.5?-1:1;let o=sd*(lo+Math.pow(rnd(),1.6)*(hi-lo));
   if(DRIVE&&zoneArr[i]===1){const e=12.4+XW[i];if(Math.abs(o)<e)o=sd*(e+(Math.abs(o)-lo)*.5);}off(i,o,0,V);V.x+=T[i].x*rr(-1,1);V.z+=T[i].z*rr(-1,1);
   Q.setFromAxisAngle(YAX,rr(0,6.3));const s=rr(s0,s1),sx=s*rr(.9,1.5),gone=bare.some(([a,b,ss])=>i>=a&&i<=b&&sd===ss&&Math.abs(o)<60);M4.compose(V,Q,S.set(gone?0:sx,gone?0:s,gone?0:s));mesh.setMatrixAt(k,M4);};
 for(let k=0;k<NTUFT;k++){put(tufts,k,9.9,30,.35,.95);tufts.setColorAt(k,C.setHSL(rr(.17,.27),rr(.28,.5),rr(.38,.58)));}
 for(let k=0;k<NPOP;k++)put(pops,k,10,26,.5,.9);
 tufts.receiveShadow=pops.receiveShadow=true;scene.add(tufts,pops);}

/* ================= CROWD ================= */
// Spectators are painted, out-of-focus strips, like a crowd behind a long lens: a handful of quads instead of thousands of limbs.
const cyl=(a,b,h,s=8)=>new THREE.CylinderGeometry(a,b,h,s);
function crowdTex(s0,density){let s=s0;const r=()=>{s=(s*16807)%2147483647;return(s-1)/2147483646;},pk=a=>a[r()*a.length|0];
  const cl=['#d9d4c3','#c8552b','#35558a','#7a8f9c','#b9a36a','#2c2c2c','#a33a2e','#e3d9b0','#5d7a4a','#cfcfcf','#8a5a3a','#d8b23c','#e8e4d8','#4e6f8f','#b07a8c'],sk=['#d9a988','#c99878','#e2b99a','#b98463'],hr=['#2a2018','#4a3a28','#8a6a3a','#1a1a1a','#b8a888','#d8c896'],tr=['#3a3a3c','#4a4f66','#6b5d48','#2a2a2a','#8a8370'];
  const t=canvas(256,2048,(g,W,H)=>{g.clearRect(0,0,W,H);g.transform(0,1,1,0,0,0);   // after the swap: x runs along the fence, y is up
    const fig=(x,base,sc)=>{const h=(186+r()*34)*sc,w=h*.27,c=pk(cl),up=r()<.2;
      g.fillStyle=pk(tr);g.fillRect(x-w*.36,base,w*.3,h*.48);g.fillRect(x+w*.06,base,w*.3,h*.48);
      g.fillStyle=c;g.beginPath();g.roundRect(x-w*.5,base+h*.45,w,h*.4,w*.2);g.fill();
      g.fillRect(x-w*.74,base+h*.5,w*.22,h*.33);g.fillRect(x+w*.52,base+h*(up?.78:.5),w*.22,h*.33);
      g.fillStyle=pk(sk);g.beginPath();g.ellipse(x,base+h*.915,w*.27,h*.082,0,0,7);g.fill();
      g.fillStyle=pk(hr);g.beginPath();g.ellipse(x,base+h*.968,w*.28,h*.042,0,0,7);g.fill();};
    g.filter='blur(2px) brightness(.7)';for(let x=8;x<H;x+=20+r()*14)if(Math.sin(x*.011+s0)+r()>density)fig(x,26,.94);
    g.filter='blur(1.3px)';for(let x=0;x<H;x+=24+r()*16)if(Math.sin(x*.008+s0*2)+r()>density)fig(x,0,1);g.filter='none';});
  t.wrapT=THREE.RepeatWrapping;return t;}
if(!DRIVE){const mk=(s0,d)=>std({map:crowdTex(s0,d),alphaTest:.3,side:THREE.DoubleSide,roughness:1});
 const a=mk(11,.35),b=mk(29,.6),c=mk(47,-3),d=mk(83,-3);
 for(const sd of[-1,1]){ribbon(sd*10.9,sd*10.9,0,2.2,a,16);ribbon(sd*12.3,sd*12.3,0,2.35,b,13.3);}
 [16,13.3,17.1,14.2,15.3,12.4].forEach((vs,k)=>ribbon(15.5+k*1.5,15.5+k*1.5,.7+k*.6,2.75+k*.6,k%2?c:d,vs,GS0,GS1));}

await BOOT.step('TRACKSIDE STRUCTURES',.16);
/* ================= STRUCTURES ================= */
const concrete=std({color:0xb9b3a2,roughness:.95}),wood=std({color:0x5a4a3a,roughness:1}),steel=std({color:0x54564f,roughness:.6,metalness:.5});
const lampMat=std({color:0x222222,emissive:0xffe2a8,emissiveIntensity:0});
// the pool of light a street lamp throws on the road at night (sodium orange-white, soft-edged); its strength follows the dark, in setTime()
const POOLM=new THREE.MeshBasicMaterial({map:canvas(128,128,(g)=>{const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.45,'rgba(255,255,255,.5)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,128,128);}),
  color:0xffc98a,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4});
if(!DRIVE){ // grandstand
  const n=GS1-GS0,tiers=new THREE.InstancedMesh(new THREE.BoxGeometry(1.5,1,2.06),concrete,n*6),roof=new THREE.InstancedMesh(new THREE.BoxGeometry(11.5,.18,2.06),std({color:0x8a2f24,roughness:.7}),n),
   back=new THREE.InstancedMesh(new THREE.BoxGeometry(.2,8.6,2.06),std({color:0xd9d2bd,roughness:.9}),n),rail=new THREE.InstancedMesh(new THREE.BoxGeometry(.06,.06,2.06),steel,n*6),
   lamps=new THREE.InstancedMesh(new THREE.BoxGeometry(.3,.1,1.2),lampMat,n);let k=0,pc=0;
  const posts=new THREE.InstancedMesh(new THREE.BoxGeometry(.18,9,.18),steel,Math.ceil(n/5)*2);
  for(let i=GS0;i<GS1;i++){Q.setFromAxisAngle(YAX,yaw(i));
    for(let t=0;t<6;t++){const hh=.7+t*.6;M4.compose(off(i,15.4+t*1.5,hh/2,V),Q,S.set(1,hh,1));tiers.setMatrixAt(k,M4);M4.compose(off(i,14.7+t*1.5,hh+.45,V),Q,S.set(1,1,1));rail.setMatrixAt(k++,M4);}
    M4.compose(off(i,15.2,8.9,V),Q,S.set(1,1,1));lamps.setMatrixAt(i-GS0,M4);
    E.set(0,yaw(i),-.07);Q.setFromEuler(E);M4.compose(off(i,19.4,9.2,V),Q,S.set(1,1,1));roof.setMatrixAt(i-GS0,M4);
    Q.setFromAxisAngle(YAX,yaw(i));M4.compose(off(i,24.5,4.3,V),Q,S.set(1,1,1));back.setMatrixAt(i-GS0,M4);
    if((i-GS0)%5===0){M4.compose(off(i,14.4,4.5,V),Q,S.set(1,1,1));posts.setMatrixAt(pc++,M4);M4.compose(off(i,24.3,4.5,V),Q,S.set(1,1,1));posts.setMatrixAt(pc++,M4);}}
  posts.count=pc;for(const m of[tiers,roof,back,posts]){m.castShadow=m.receiveShadow=true;}scene.add(tiers,roof,back,rail,posts,lamps);
  const fas=canvas(1024,96,(g,w,h)=>{g.fillStyle='#efe8d2';g.fillRect(0,0,w,h);g.fillStyle='#1c2a4a';g.font='900 64px Arial Black,Arial';g.textAlign='center';g.textBaseline='middle';g.fillText('TRIBUNE  ·  24 HEURES  ·  TRIBUNE',w/2,h/2+4);g.fillStyle='#a3301f';g.fillRect(0,0,w,8);g.fillRect(0,h-8,w,8);});
  for(let i=GS0+6;i<GS1-6;i+=12){const b=new THREE.Mesh(new THREE.BoxGeometry(.1,1,22),std({map:fas,roughness:.8}));off(i,13.75,9.1,b.position);b.rotation.y=yaw(i)+Math.PI;scene.add(b);}
  const tri=canvas(96,64,(g)=>{g.fillStyle='#22407a';g.fillRect(0,0,32,64);g.fillStyle='#ece8dc';g.fillRect(32,0,32,64);g.fillStyle='#b8322a';g.fillRect(64,0,32,64);});
  const bands=(cols,vert)=>canvas(96,64,(g)=>{cols.forEach((c,k)=>{g.fillStyle=c;if(vert)g.fillRect(k*96/cols.length,0,96/cols.length+1,64);else g.fillRect(0,k*64/cols.length,96,64/cols.length+1);});});
  const FLG=[tri,bands(['#b8322a','#e3c94a','#b8322a']),bands(['#1c1c1c','#b8322a','#e3b63a']),bands(['#2f6b45','#ece8dc','#b8322a'],1),bands(['#b8322a','#ece8dc','#b8322a','#ece8dc','#b8322a','#ece8dc']),bands(['#ece8dc','#b8322a']),bands(['#22407a','#e3c94a'])];
  for(let i=GS0-22;i<GS1;i+=4){const pole=new THREE.Mesh(cyl(.04,.04,4,6),steel);off(i,13.8,11.6,pole.position);scene.add(pole);
    const fg=new THREE.PlaneGeometry(2.1,1.3,10,4);const p=fg.attributes.position;for(let j=0;j<p.count;j++)p.setZ(j,Math.sin(p.getX(j)*3+i)*.14*(p.getX(j)+1.05));fg.computeVertexNormals();
    const f=new THREE.Mesh(fg,std({map:FLG[((i-GS0+24)/4|0)%FLG.length],side:THREE.DoubleSide,roughness:.9}));off(i,13.8,12.9,f.position);f.position.addScaledVector(T[i],-1.08);f.rotation.y=yaw(i)+Math.PI/2;f.castShadow=true;scene.add(f);}
}
if(!DRIVE){ // the tyre bridge: a footbridge shaped like half a giant racing tyre arching over the road, lettered on both sidewalls
  const i=215,RA=17.5,RT=2.7,g=new THREE.Group();
  const tex=canvas(4096,512,(c,w,h)=>{c.fillStyle='#121212';c.fillRect(0,0,w,h);speck(c,w,h,9000,['rgba(60,60,60,.3)','rgba(0,0,0,.4)'],4);
    // tread blocks on the crown (the top and bottom edges of this strip meet on the outside of the tyre)
    c.fillStyle='#050505';for(let x=0;x<w;x+=44){for(const[y0,y1]of[[0,62],[h-62,h]]){c.save();c.translate(x,(y0+y1)/2);c.rotate(.5);c.fillRect(-5,-44,10,88);c.restore();}}
    c.strokeStyle='#050505';c.lineWidth=7;for(const y of[70,h-70]){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
    const word=(y,flip)=>{c.save();c.translate(w/2,y);if(flip)c.rotate(Math.PI);c.fillStyle='#f2efe6';c.font='900 150px Arial Black,Arial';c.textAlign='center';c.textBaseline='middle';c.fillText('PNEUS  COURSE',0,-6);
      c.fillStyle='#e3b63a';c.font='900 40px Arial Black,Arial';c.fillText('GRAND PRIX  ·  24 HEURES  ·  GRAND PRIX',0,84);c.restore();};
    word(h*.25,false);word(h*.75,true);                 // one sidewall each, the second turned so both read the right way up
    c.strokeStyle='#e3b63a';c.lineWidth=5;for(const y of[h*.5-36,h*.5+36]){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}});
  const arch=new THREE.Mesh(new THREE.TorusGeometry(RA,RT,28,96,Math.PI),std({map:tex,roughness:.85,bumpMap:roadBump,bumpScale:.6}));g.add(arch);
  for(const sx of[-1,1]){const b=new THREE.Mesh(new THREE.BoxGeometry(RT*2.6,2.4,RT*2.6),concrete);b.position.set(sx*RA,1.2,0);g.add(b);
    for(let st=0;st<8;st++){const s=new THREE.Mesh(new THREE.BoxGeometry(2.2,.3,1),concrete);s.position.set(sx*(RA+2.2+st*.55),2.25-st*.3,0);g.add(s);}}
  g.traverse(o=>{o.castShadow=o.receiveShadow=true;});g.position.copy(P[i]);g.rotation.y=yaw(i);scene.add(g);
}
if(!DRIVE){ // telegraph poles + wires
  const pts=[],pg=mergeGeometries([cyl(.09,.13,8.5,6).translate(0,4.25,0),new THREE.BoxGeometry(1.6,.1,.1).translate(0,7.9,0),new THREE.BoxGeometry(1.2,.1,.1).translate(0,7.4,0)]);
  const idxs=[];for(let i=0;i<NS;i+=22)if(!(i>GS0-10&&i<GS1+10))idxs.push(i);
  const poles=new THREE.InstancedMesh(pg,wood,idxs.length);poles.castShadow=true;
  idxs.forEach((i,k)=>{Q.setFromAxisAngle(YAX,yaw(i)+Math.PI/2);M4.compose(off(i,-16.5,0,V),Q,S.set(1,1,1));poles.setMatrixAt(k,M4);
    if(k===idxs.length-1)return;const j=idxs[k+1];if(j-i>30)return;
    for(const[w,y]of[[-.7,7.95],[.7,7.95],[-.5,7.45],[.5,7.45]]){const A=off(i,-16.5+w,y),B=off(j,-16.5+w,y);let a=A.clone();
      for(let s=1;s<=8;s++){const f=s/8,c=A.clone().lerp(B,f);c.y-=Math.sin(f*Math.PI)*.9;pts.push(a.x,a.y,a.z,c.x,c.y,c.z);a=c;}}});
  const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  scene.add(poles,new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0x1c1c1c})));
}
if(!DRIVE){ // farmhouses
  const wall=canvas(512,256,(g,w,h)=>{g.fillStyle='#e2d8bf';g.fillRect(0,0,w,h);speck(g,w,h,5000,['rgba(150,130,100,.18)','rgba(255,255,255,.2)'],5);
    g.fillStyle='rgba(110,96,70,.25)';g.fillRect(0,h-30,w,30);
    for(let x=40;x<w;x+=118){for(const y of[40,150]){if(y===150&&x===276){g.fillStyle='#4a3424';g.fillRect(x,y-10,44,116);continue;}
      g.fillStyle='#232a2e';g.fillRect(x,y,40,58);g.strokeStyle='#efe8d6';g.lineWidth=3;g.strokeRect(x,y,40,58);g.beginPath();g.moveTo(x+20,y);g.lineTo(x+20,y+58);g.stroke();
      g.fillStyle=y===40?'#4d6a58':'#7a3a2a';g.fillRect(x-18,y,16,58);g.fillRect(x+42,y,16,58);}}});
  const roofT=canvas(256,256,(g,w,h)=>{g.fillStyle='#a8573a';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=10)for(let x=0;x<w;x+=14){g.fillStyle=`hsl(${14+Math.random()*10},${40+Math.random()*16}%,${34+Math.random()*16}%)`;g.fillRect(x+(y/10%2)*7,y,13,9);}});
  const tri=new THREE.Shape();tri.moveTo(-1,0);tri.lineTo(1,0);tri.lineTo(0,1);
  let made=0;for(let t=0;t<200&&made<16;t++){const i=rnd()*NS|0,sd=rnd()<.5?-1:1,o=sd*rr(48,95);off(i,o,0,V);if(!farFromRoad(V.x,V.z,44))continue;if(sd>0&&i>GS0-30&&i<GS1+30)continue;made++;
    const L=rr(9,15),D=rr(6,8),H=rr(5,6.5),g=new THREE.Group();
    const b=new THREE.Mesh(new THREE.BoxGeometry(L,H,D),std({map:wall,roughness:.95}));b.position.y=H/2;g.add(b);
    const rf=new THREE.Mesh(new THREE.ExtrudeGeometry(tri,{depth:L+.8,bevelEnabled:false}),std({map:roofT,roughness:.9}));rf.scale.set(D/2+.5,3.2,1);rf.rotation.y=Math.PI/2;rf.position.set(-(L+.8)/2,H,0);g.add(rf);
    const ch=new THREE.Mesh(new THREE.BoxGeometry(.8,2.4,.8),std({color:0x9a6a52}));ch.position.set(L*.3,H+2.4,0);g.add(ch);
    g.traverse(m=>{m.castShadow=m.receiveShadow=true;});g.position.copy(V);g.rotation.y=yaw(i)+rr(-.4,.4);scene.add(g);}
}
if(!DRIVE){ // hay bales
  const straw=canvas(128,128,(g,w,h)=>{g.fillStyle='#c4a95e';g.fillRect(0,0,w,h);for(let i=0;i<900;i++){g.strokeStyle=`hsl(${40+Math.random()*10},${40+Math.random()*20}%,${42+Math.random()*30}%)`;g.lineWidth=1;const x=Math.random()*w,y=Math.random()*h;g.beginPath();g.moveTo(x,y);g.lineTo(x+R(-3,3),y+10+Math.random()*10);g.stroke();}
    g.fillStyle='rgba(60,40,20,.7)';g.fillRect(0,38,w,3);g.fillRect(0,88,w,3);});
  const idx=[];for(let i=0;i<NS;i++)if(Math.sin(i*.034+1)>.5)idx.push(i);
  const bales=new THREE.InstancedMesh(new THREE.BoxGeometry(.56,.5,1.9),std({map:straw,roughness:1}),idx.length*3);bales.castShadow=bales.receiveShadow=true;let k=0;
  for(const i of idx){const sd=Math.sin(i*.01)>0?1:-1;for(const[o,y]of[[9.05,.25],[9.45,.25],[9.25,.75]]){if(y>.5&&rnd()<.4)continue;Q.setFromAxisAngle(YAX,yaw(i)+rr(-.06,.06));M4.compose(off(i,sd*o,y,V),Q,S.set(1,1,1));bales.setMatrixAt(k++,M4);}}
  bales.count=k;scene.add(bales);
}
if(!DRIVE){ // advertising boards
  const signs=[['24 HEURES','#f2ead2','#1c2a4a'],['HUILES MOTEUR','#c8402a','#f2ead2'],['PNEUS COURSE','#e3b63a','#1a1a1a'],['CAFÉ DU CIRCUIT','#f2ead2','#a3301f'],['BOUGIES','#1f4f8a','#f2ead2'],['VIRAGE','#f2ead2','#1a1a1a'],['ESSENCE','#2f6b45','#f2ead2'],['APÉRITIF','#7a1f2a','#e3c94a']];
  const mats=signs.map(sg=>std({roughness:.8,map:canvas(1024,160,(g,w,h)=>{g.fillStyle=sg[1];g.fillRect(0,0,w,h);g.fillStyle=sg[2];g.font='900 108px Arial Black,Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(sg[0],w/2,h/2+6);
    g.strokeStyle=sg[2];g.lineWidth=8;g.strokeRect(10,10,w-20,h-20);speck(g,w,h,700,['rgba(90,80,60,.14)'],7);})}));
  const bg=new THREE.BoxGeometry(.1,1.5,10),pg=new THREE.BoxGeometry(.12,3,.12);
  for(let k=0;k<44;k++){const i=(k*NS/44+rr(0,14))|0,sd=k%2?1:-1;if(sd>0&&i>GS0-6&&i<GS1+6)continue;
    const b=new THREE.Mesh(bg,mats[k%mats.length]);off(i,sd*10.05,2.2,b.position);b.rotation.y=yaw(i)+(sd>0?Math.PI:0);b.castShadow=true;scene.add(b);
    for(const dz of[-4.5,0,4.5]){const post=new THREE.Mesh(pg,wood);post.position.copy(b.position).addScaledVector(T[i],dz).addScaledVector(Nn[i],sd*.12);post.position.y=1.5;scene.add(post);}}
}

if(!DRIVE){ // braking boards 300 / 200 / 100 m before each real corner, on the outside of the turn
  const bt=n=>std({roughness:.8,map:canvas(128,128,(g)=>{g.fillStyle='#f2ead2';g.fillRect(0,0,128,128);g.fillStyle='#111';g.font='900 60px Arial Black,Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(n,64,70);g.strokeStyle='#a3301f';g.lineWidth=10;g.strokeRect(5,5,118,118);})});
  const mats=[bt('300'),bt('200'),bt('100')],bg=new THREE.BoxGeometry(.06,.9,.9),pg=new THREE.BoxGeometry(.06,.7,.06);let last=-999;
  for(let i=0;i<NS;i++){const k=Math.abs(kS[i]),prev=Math.abs(kS[wrapI(i-1)]);if(k>=.0035&&prev<.0035&&i-last>120){last=i;const sd=-Math.sign(kS[i]);
    [150,100,50].forEach((d,j)=>{const q=wrapI(i-d),b=new THREE.Mesh(bg,mats[j]);off(q,sd*8.9,1.1,b.position);b.rotation.y=yaw(q)+Math.PI/2;b.castShadow=true;scene.add(b);
      const p=new THREE.Mesh(pg,wood);off(q,sd*8.9,.35,p.position);scene.add(p);});}}
}
if(!DRIVE){ // start area dressing: painted echelon bays on the pit side, and a continuous wall of hoardings opposite
  const white=new THREE.MeshBasicMaterial({color:0xd8d4c6,transparent:true,opacity:.8,polygonOffset:true,polygonOffsetFactor:-2}),lg=new THREE.PlaneGeometry(.14,5.6);
  for(let k=0;k<=8;k++){const m=new THREE.Mesh(lg,white);at(S0-2.2-k*7.5,RW-1.9,.03,m.position);m.rotation.order='YXZ';m.rotation.set(-Math.PI/2,yaw(START_I)-.55,0);scene.add(m);}
  const names=[['HUILES',' #c8402a','#f2ead2'],['BOUGIES','#f2ead2','#1c2a4a'],['PNEUS','#e3b63a','#161616'],['APÉRITIF','#7a1f2a','#e3c94a'],['ESSENCE','#f2ead2','#a3301f'],['FREINS','#1f4f8a','#f2ead2'],['CAFÉ','#2f6b45','#f2ead2'],['24 HEURES','#f2ead2','#161616']];
  const ht=canvas(128,2048,(g,W,H)=>{g.transform(0,1,1,0,0,0);names.forEach((n,i)=>{const x=i*256;g.fillStyle=n[1].trim();g.fillRect(x,0,256,128);g.strokeStyle=n[2];g.lineWidth=6;g.strokeRect(x+6,6,244,116);
    g.save();g.translate(x+128,64);g.scale(1,-1);g.fillStyle=n[2];g.font='900 54px Arial Black,Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(n[0],0,4,226);g.restore();});speck(g,H,W,2500,['rgba(90,80,60,.14)'],6);});
  ht.wrapT=THREE.RepeatWrapping;const hm=std({map:ht,roughness:.8,side:THREE.DoubleSide});
  ribbon(-10.25,-10.25,0,1.25,hm,24,20,230).castShadow=true;ribbon(10.25,10.25,0,1.25,hm,24,20,GS0-2);
}
let ferris;const gondolas=[];
if(!DRIVE){ // fairground opposite the grandstand: big wheel with lights, striped tents
  const Rw=17,fw=new THREE.Group();ferris=new THREE.Group();const white=std({color:0xe6e1d0,roughness:.6,metalness:.3}),bulbG=new THREE.SphereGeometry(.16,6,5);
  for(const dz of[-1.3,1.3]){const rim=new THREE.Mesh(new THREE.TorusGeometry(Rw,.13,6,64),white);rim.position.z=dz;ferris.add(rim);const rim2=new THREE.Mesh(new THREE.TorusGeometry(Rw*.6,.08,6,48),white);rim2.position.z=dz;ferris.add(rim2);
    for(let k=0;k<16;k++){const sp=new THREE.Mesh(cyl(.05,.05,Rw,5),white);const a=k/16*6.283;sp.position.set(Math.cos(a)*Rw/2,Math.sin(a)*Rw/2,dz);sp.rotation.z=a+Math.PI/2;ferris.add(sp);}
    for(let k=0;k<48;k++){const b=new THREE.Mesh(bulbG,lampMat);const a=k/48*6.283;b.position.set(Math.cos(a)*Rw,Math.sin(a)*Rw,dz*1.12);ferris.add(b);}}
  const gcol=[0xb8322a,0xe3b63a,0x2f5f9a,0xe6e1d0,0x2f6b45];
  for(let k=0;k<16;k++){const a=k/16*6.283,g=new THREE.Group();const ax=new THREE.Mesh(cyl(.05,.05,2.6,5),white);ax.rotation.x=Math.PI/2;g.add(ax);
    const car=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.3,1.9),std({color:gcol[k%5],roughness:.6}));car.position.y=-1.5;g.add(car);const top=new THREE.Mesh(new THREE.ConeGeometry(1.5,.7,8),white);top.position.y=-.35;g.add(top);
    g.position.set(Math.cos(a)*Rw,Math.sin(a)*Rw,0);ferris.add(g);gondolas.push(g);}
  ferris.position.y=Rw+3.5;fw.add(ferris);
  for(const dz of[-2,2])for(const dx of[-7,7]){const leg=new THREE.Mesh(cyl(.16,.2,Rw+5,6),white);leg.position.set(dx/2,(Rw+3.5)/2,dz);leg.rotation.z=-Math.atan2(dx,Rw+3.5);fw.add(leg);}
  fw.traverse(o=>{o.castShadow=true;});off(128,-64,0,fw.position);fw.rotation.y=yaw(128)+.5;scene.add(fw);
  const stripe=(a,b)=>{const t=canvas(256,64,(g,w,h)=>{for(let x=0;x<w;x+=32){g.fillStyle=(x/32)%2?a:b;g.fillRect(x,0,32,h);}speck(g,w,h,400,['rgba(90,80,60,.12)'],6);});t.wrapS=THREE.RepeatWrapping;return t;};
  const st=[stripe('#b8322a','#ece6d4'),stripe('#2f5f9a','#ece6d4'),stripe('#e3b63a','#ece6d4'),stripe('#2f6b45','#ece6d4')];
  for(let k=0;k<18;k++){const i=GS0+4+(rnd()*(GS1-GS0-8)|0),o=-(20+rnd()*30),g=new THREE.Group(),sz=rr(4,7),m=std({map:st[k%4],roughness:.9,side:THREE.DoubleSide});
    if(Math.abs(i-128)<14&&o<-40)continue;
    const w=new THREE.Mesh(new THREE.BoxGeometry(sz,2.3,sz),m);w.position.y=1.15;g.add(w);const r=new THREE.Mesh(new THREE.ConeGeometry(sz*.76,2,4),m);r.position.y=3.3;r.rotation.y=Math.PI/4;g.add(r);
    const pp=new THREE.Mesh(cyl(.03,.03,1.4,5),white);pp.position.y=4.6;g.add(pp);const pen=new THREE.Mesh(new THREE.PlaneGeometry(.9,.4),std({color:gcol[k%5],side:THREE.DoubleSide}));pen.position.set(.45,5.1,0);g.add(pen);
    g.traverse(x=>{x.castShadow=x.receiveShadow=true;});off(i,o,0,g.position);g.rotation.y=yaw(i)+rr(-.3,.3);scene.add(g);}
}

// potholes: broken patches in the surface that jolt the car, knock it off line and scrub a little speed
const HOLES=[];{const ht=canvas(128,128,(g)=>{g.clearRect(0,0,128,128);g.fillStyle='rgba(16,15,14,.94)';g.beginPath();for(let a=0;a<6.3;a+=.45){const r=36+Math.random()*22;g.lineTo(64+Math.cos(a)*r,64+Math.sin(a)*r);}g.fill();g.strokeStyle='rgba(126,122,112,.75)';g.lineWidth=4;g.stroke();
    g.fillStyle='rgba(70,66,58,.85)';for(let i=0;i<46;i++)g.fillRect(34+Math.random()*60,34+Math.random()*60,3,3);});
  const n=DRIVE?70:50,im=new THREE.InstancedMesh(new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2),std({map:ht,transparent:true,roughness:1,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3}),n);
  for(let k=0;k<n;k++){let i=rnd()*NS|0;if(DRIVE){for(let q=0;q<30&&(zoneArr[i]===2||zoneArr[i]===4||Math.abs(i-Z.start)<25);q++)i=rnd()*NS|0;}else{if(k<18)i=160+(rnd()*560|0);if(i>70&&i<135)i+=120;}   // plenty on the long straight, none on the grid
    const r=rr(.55,1.05);off(i,rr(-5,5),.034,V);Q.setFromAxisAngle(YAX,rr(0,6.3));M4.compose(V,Q,S.set(r,1,r*rr(.7,1.2)));im.setMatrixAt(k,M4);HOLES.push({x:V.x,z:V.z,r,cd:0});}
  im.receiveShadow=true;scene.add(im);}

await BOOT.step('ROADSIDE',.20);
/* ================= FREE DRIVE WORLD ================= */
// A quiet island town street, the tube under the estuary with its portal buildings, a freeway past the port, then a long suspension bridge.
// The whole route is level: the bay is simply 45 m below the road, so the bridge is high without the engine needing hills.
const MILL=[],CRN=[],REFS=[],AIR={g:null,st:0,t:0,cd:6};let tunLampB=null;const TFL={cd:1,t:9,T:0,kind:0};
const SFX=[],cityMats=[],OBST=TOWNT.map(([x,z])=>({x,z,r:1.2})),CROWS=[],FLARES=[];let tunL=null,SHIP=null,manatee=null,pelicans=null,exotics=null,SWOOP=null,EYES=null,SEAM=null,SEAW=null;const BURN=[],OILX=[],OILB={t:6,q:[]},TOX={l:[],slime:0,hit:0,mm:null,car:null},SQX={},MOSQ={g:null,on:0,t:0,armed:1,lift:null},BTL={g:null,on:0,t:0,wat:-44.6,rs:0,armed:{bb:1,gg:1,rb:1},br:{},bsA:0,bsT:0,wv:0,wt:0},TNK={on:0,t:0,armed:1,wat:-44.6}; let BAYV=null;const BAYB={b:[],c:[],cd:2},cGLD=[new THREE.Color(0xf4a44e),new THREE.Color(0x4e5a8e),new THREE.Color(0xd99a62),new THREE.Color(0xffb062)];  /* TOX: leaking toxic barrels and their ooze; SQX: the San Quentin yard fence, its hole, the watchtower searchlight */   // BURN: fires that always burn (ruins, wrecks, the refinery flare)
if(!DRIVE){ // roadside advertising boards, as on the old circuit: cigarettes, wine and bread, by turns
  const ad=(kind,name,sub)=>canvas(1024,460,(g,w,h)=>{const bg={cig:'#1d4f8a',wine:'#efe6cc',bread:'#f0c23a'}[kind],ink={cig:'#f4f1e8',wine:'#7a1626',bread:'#3a2412'}[kind];g.fillStyle=bg;g.fillRect(0,0,w,h);g.strokeStyle=ink;g.lineWidth=10;g.strokeRect(14,14,w-28,h-28);
    if(kind==='cig'){g.save();g.translate(190,250);g.rotate(-.1);g.fillStyle='#f4f1e8';g.fillRect(-90,-110,180,250);g.fillStyle='#c8302a';g.fillRect(-90,-30,180,90);g.fillStyle='#f4f1e8';g.beginPath();g.ellipse(0,15,62,30,0,0,7);g.fill();g.fillStyle='#c8302a';g.font='900 30px Georgia';g.textAlign='center';g.fillText('M',0,26);
      for(const[x,up]of[[-58,60],[-20,95],[18,70]]){g.fillStyle='#f8f6ee';g.fillRect(x,-110-up,30,up);g.fillStyle='#d99a4a';g.fillRect(x,-110-up,30,Math.min(26,up*.35));}g.restore();}
    if(kind==='wine'){g.fillStyle='#1f3a22';g.beginPath();g.moveTo(150,420);g.lineTo(150,190);g.quadraticCurveTo(150,150,172,130);g.lineTo(172,50);g.lineTo(208,50);g.lineTo(208,130);g.quadraticCurveTo(230,150,230,190);g.lineTo(230,420);g.fill();g.fillStyle='#f4efdc';g.fillRect(156,230,68,96);g.fillStyle='#7a1626';g.fillRect(164,256,52,8);g.fillRect(172,50,36,26);
      g.strokeStyle='#5a4a3a';g.lineWidth=5;g.beginPath();g.moveTo(300,420);g.lineTo(300,330);g.moveTo(268,420);g.lineTo(332,420);g.stroke();g.fillStyle='#8a1a2c';g.beginPath();g.moveTo(258,240);g.quadraticCurveTo(262,330,300,332);g.quadraticCurveTo(338,330,342,240);g.fill();g.strokeStyle='#5a4a3a';g.lineWidth=3;g.beginPath();g.moveTo(256,200);g.quadraticCurveTo(258,330,300,333);g.quadraticCurveTo(342,330,344,200);g.stroke();}
    if(kind==='bread'){for(const[x,y,r]of[[190,300,-.5],[230,290,-.25],[150,320,-.75]]){g.save();g.translate(x,y);g.rotate(r);g.fillStyle='#c98a3a';g.beginPath();g.ellipse(0,0,165,30,0,0,7);g.fill();g.strokeStyle='#8a5a22';g.lineWidth=6;for(let k=-3;k<=3;k++){g.beginPath();g.moveTo(k*38-12,-16);g.lineTo(k*38+12,14);g.stroke();}g.restore();}}
    g.fillStyle=ink;g.textAlign='center';g.font='900 '+(name.length>9?92:120)+'px Georgia';g.fillText(name,650,230);g.font='italic 700 46px Georgia';g.fillText(sub,650,320);g.fillRect(430,350,440,6);});
  const ADS=[['cig','MISTRAL','cigarettes · goût français'],['wine','CLOS DU CIRCUIT','grand vin rouge'],['bread','PAIN DORÉ','le bon pain de chez nous'],['cig','CORSAIRE','filtre · tabac brun'],['wine','VIEUX MOULIN','vins fins de table'],['bread','LA BAGUETTE','boulangerie du Mans'],['cig','MISTRAL','cigarettes · goût français'],['wine','CLOS DU CIRCUIT','grand vin rouge'],['bread','PAIN DORÉ','le bon pain de chez nous']];
  const postM=std({color:0x4a4038,roughness:.9}),backM=std({color:0x2c2a26,roughness:.9});
  ADS.forEach((a,k)=>{const i=Math.floor(NS*(k+.62)/ADS.length),sd=k%2?1:-1,g=new THREE.Group(),bd=new THREE.Mesh(new THREE.PlaneGeometry(12,5.4),std({map:ad(...a),roughness:.75}));bd.position.y=6.4;g.add(bd);
    const bk=new THREE.Mesh(new THREE.BoxGeometry(12.3,5.7,.2),backM);bk.position.set(0,6.4,-.12);g.add(bk);for(const x of[-4.5,4.5]){const p=new THREE.Mesh(new THREE.BoxGeometry(.35,7,.35),postM);p.position.set(x,3.5,-.3);g.add(p);}
    g.traverse(o=>{o.castShadow=true;});off(i,sd*(wallAt[i]+8.5),0,g.position);g.rotation.y=yaw(i)+Math.PI-sd*.38;scene.add(g);});
}
if(DRIVE){
  const D2=THREE.DoubleSide,m=x=>Math.round(x/SEG),MC={},mat=(k,o)=>MC[k]||(MC[k]=std(o)),A0=scene.children.length;
  const side=std({color:0xb9b3a2,roughness:.9,side:D2}),hedge=std({roughness:.8,side:D2,alphaTest:.5,map:(()=>{const t=canvas(64,64,(g)=>{g.clearRect(0,0,64,64);g.fillStyle='#f4f1e8';for(let y=1;y<64;y+=8){g.fillRect(0,y,54,5);g.beginPath();g.moveTo(54,y);g.lineTo(62,y+2.5);g.lineTo(54,y+5);g.fill();}g.fillRect(14,0,5,64);g.fillRect(40,0,5,64);});t.wrapT=THREE.RepeatWrapping;return t;})()}),jersey=std({color:0xa9a69a,roughness:.9,side:D2}),
    steelM=std({color:0x8b9196,roughness:.55,metalness:.5}),railM=std({color:0x7f868b,roughness:.5,metalness:.6,side:D2}),cream=std({color:0xe2cfa8,roughness:.85,side:D2}),white=std({color:0xf4f1e8,roughness:.8});
  const faceRoad=(i,sd)=>Math.atan2(-sd*Nn[i].x,-sd*Nn[i].z),curved=i=>Math.abs(kS[wrapI(i)])>.004;
  const B=(sx,sy,sz,mm,x,y,z,ry=0,par=scene)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mm);o.position.set(x,y,z);o.rotation.y=ry;o.castShadow=o.receiveShadow=true;par.add(o);return o;};
  const sign=(w,h,txt,bg,fg,font,sub)=>canvas(w,h,(c)=>{c.fillStyle=bg;c.fillRect(0,0,w,h);c.strokeStyle=fg;c.lineWidth=Math.max(4,h*.05);c.strokeRect(c.lineWidth,c.lineWidth,w-c.lineWidth*2,h-c.lineWidth*2);c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';c.font=font;c.fillText(txt,w/2,sub?h*.38:h*.54,w*.92);if(sub){c.font=font.replace(/\d+px/,m0=>Math.round(parseInt(m0)*.62)+'px');c.fillText(sub,w/2,h*.74,w*.92);}});
  // a roadside board on two legs, facing the driver coming towards it
  const board=(i,lat,w,h,tex,y=0,emi=.3)=>{const g=new THREE.Group(),b=new THREE.Mesh(new THREE.BoxGeometry(w,h,.25),std({map:tex,emissiveMap:tex,emissive:0xffffff,emissiveIntensity:emi,roughness:.6}));b.position.y=y+h/2+2;g.add(b);
    for(const x of[-w*.35,w*.35]){const p=new THREE.Mesh(new THREE.BoxGeometry(.25,y+h/2+2,.25),steelM);p.position.set(x,(y+h/2+2)/2,-.2);g.add(p);}g.traverse(o=>{o.castShadow=true;});off(i,lat,0,g.position);g.rotation.y=yaw(i)+Math.PI;scene.add(g);return g;};
  // the ground beside the road: level, except where the road climbs a real hill (the land rises with it) - the viaducts stand on flat ground
  const HZ={5:[30,1.5],7:[40,2.4],8:[40,2]};
  groundAt=(x,z)=>{let best=0;nearIdx(x,z,330,i=>{const q=HZ[zoneArr[i]];if(!q||H[i]<.5)return;const d=Math.hypot(P[i].x-x,P[i].z-z),v=H[i]*clamp(1-(d-q[0])/(H[i]*q[1]+1),0,1);if(v>best)best=v;});return best;};
  groundNear=(x,z)=>{let bi=-1,bd=1e18;nearIdx(x,z,330,i=>{if(!HZ[zoneArr[i]])return;const d=(P[i].x-x)**2+(P[i].z-z)**2;if(d<bd){bd=d;bi=i;}});if(bi<0)return groundAt(x,z);   // the height of the banked ground actually drawn here: from the nearest bit of road only (groundAt takes the highest bit within reach, so things stood on it float)
    const q=HZ[zoneArr[bi]],h=H[bi],la=(x-P[bi].x)*Nn[bi].x+(z-P[bi].z)*Nn[bi].z,al=Math.abs(la),bk=bkY(bi,la);if(h<.5)return 0;if(al<=q[0])return h+bk-.03;const u=clamp((al-q[0])/(h*q[1]),0,1);return Math.max(0,(h-.03)*(1-u)+bk*(1-u));};
  const gpos=(i,lat,out=new THREE.Vector3())=>{off(i,lat,0,out);out.y=groundAt(out.x,out.z);return out;};

await BOOT.step('SURVEYING THE BAY · REAL ELEVATION',.21);
try{await Terrain.load('assets/bay-dem.png');}catch(e){console.warn('no elevation data',e);}
{const mk={};for(const k in ROUTE.mk){const i=Z[k];mk[k]=[P[i].x,P[i].z];}if(mk.marina){const t=T[Z.marina];mk.marina=[mk.marina[0]+t.x*(MR-60),mk.marina[1]+t.z*(MR-60)];}   /* georeference the Marina at the old corner, where Hyde meets Beach St, not at the start of the wider sweep */
  Terrain.georef(mk);Terrain.setRoad(P,NS);}
await BOOT.step('LAND AND WATER',.22);
  // ---- land and water: Alameda, the East Bay, San Francisco, Marin, and the islands; the bay is 45 m below the road everywhere
  ground.visible=false;
  const landTex=grassTex.clone();landTex.wrapS=landTex.wrapT=THREE.RepeatWrapping;landTex.repeat.set(1/8,1/8);landTex.needsUpdate=true;
  const landM=std({map:landTex,roughness:1}),urbanM=std({color:0x4e5052,roughness:.95}),rockM=std({color:0x6f6452,roughness:1});LANDM.push(landM,urbanM);
  const land=(pts,mm,top=0)=>{Terrain.addLand(pts,mm===urbanM?'urban':'land');const g=new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,z))),{depth:45+top,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,top,0);const me=new THREE.Mesh(g,mm);me.receiveShadow=true;scene.add(me);return me;};
  const flat=(pts,mm,y=.04)=>{const g=new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,-z))));g.rotateX(-Math.PI/2);g.translate(0,y,0);const me=new THREE.Mesh(g,mm);me.receiveShadow=true;scene.add(me);return me;};
  land([[-1350,350],[600,350],[600,-1500],[-600,-1640],[-1350,-1640]],landM);                                                                   // Alameda
  land([[-1780,-2130],[4200,-2130],[4200,-12800],[-2500,-12800],[-3060,-10300],[-3060,-9200],[-1650,-8100],[-1950,-6000],[-2520,-5680],[-2520,-5300],[-1900,-4900]],landM);   // Oakland, Emeryville, Berkeley, Richmond
  land([[-5960,-2400],[-5960,-5300],[-5920,-5700],[-6080,-6670],[-7700,-6670],[-8900,-6510],[-8900,-2400]],urbanM);                              // San Francisco
  land([[-9200,-8108],[-6900,-8108],[-6200,-8780],[-5560,-9250],[-5560,-10150],[-6300,-10700],[-9200,-12800]],landM);                           // Marin
  flat([[-1780,-2150],[-1150,-2150],[-1180,-4700],[-1890,-4820]],urbanM);flat([[-1950,-5300],[-1500,-5250],[-1500,-5760],[-2500,-5700],[-2500,-5330]],urbanM);   // the port yards, and the flats by the toll plaza
  flat([[-1500,-5300],[600,-5300],[600,-6400],[-1500,-6400]],urbanM);flat([[-200,-2300],[1600,-2300],[1600,-4200],[-200,-4200]],urbanM);                 // Emeryville and downtown Oakland
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(40000,40000),std({color:0x36454a,roughness:.16,metalness:.35,bumpMap:roadBump,bumpScale:1.5}));sea.rotation.x=-Math.PI/2;sea.position.set(-3000,-45,-6000);scene.add(sea);SEAM=sea.material;
  {const isl=(x,z,sx,sz,h)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(1,24,12),rockM);o.scale.set(sx,h,sz);o.position.set(x,-45,z);o.receiveShadow=true;scene.add(o);};
   isl(-4300,-6300,520,380,110);isl(-4900,-8300,700,600,240);isl(-3600,-4600,260,200,60);}   // Yerba Buena, Angel Island, a rock or two

await BOOT.step('KERBS AND BARRIERS',.26);
  // ---- kerbs, pavements, fences and concrete barriers
  const pavement=(a,b,hedged,sides=[-1,1])=>{if(b-a<3)return;for(const sd of sides){for(let i=a;i<b;i++)KB[i]|=sd>0?1:2;ribbon(i=>sd*(9.6+XW[i]),i=>sd*(6.6+XW[i]),.13,.13,side,3,a,b);ribbon(i=>sd*(6.6+XW[i]),i=>sd*(6.6+XW[i]),0,.13,side,3,a,b);if(hedged){let a0=a;for(const[g0,g1]of(sd<0?HG:[])){if(g1<=a0||g0>=b)continue;if(g0-a0>=2)ribbon(i=>sd*(9.6+XW[i]),i=>sd*(9.6+XW[i]),.13,1.05,hedge,3,a0,g0);a0=Math.max(a0,g1);}if(b-a0>=2)ribbon(i=>sd*(9.6+XW[i]),i=>sd*(9.6+XW[i]),.13,1.05,hedge,3,a0,b);}}};
  const HG=DRIVE?(h=>[[h-6,h-1],[h+1,h+3]])(Math.round(Z.start/9)*9):[];   // gaps in the front fence at 1611 for the driveway and the walk (the house stands at the multiple of 9 nearest Z.start, its driveway 7 m back along the street)
  const barrier=(a,b,sides=[-1,1],mm=jersey)=>{if(b-a<3)return;for(const sd of sides){ribbon(i=>sd*(8.3+XW[i]),i=>sd*(6.6+XW[i]),.012,.012,side,4,a,b);ribbon(i=>sd*(8.3+XW[i]),i=>sd*(8.3+XW[i]),0,.85,mm,4,a,b).castShadow=true;}};
  const CROSS=[];   // (Paru St and its nine cross streets are gone: San Antonio runs straight into Central Ave)
  const CROSS2=[];for(let d=85;Z.central+m(d)<Z.wilma-m(70);d+=112){if(Math.abs(d-190)<38||Math.abs(d-420)<26)d+=40;const c=Z.central+m(d);if(c<Z.wilma-m(70)&&!curved(c)&&!curved(c+8)&&!curved(c-8))CROSS2.push(c);}   // cross streets on Central Ave, clear of the theatre and the roadside board (visual only, like Paru's)
  if(DRIVE)for(let d=110;Z.b1+m(d)<Z.downtown-m(70);d+=115)SFX.push(Z.b1+m(d));   // cross streets off to the left along the downtown street in San Francisco (visual only)
  const nearCross=(i,d)=>CROSS.some(c=>Math.abs(i-c)<d),nearCross2=(i,d)=>CROSS2.some(c=>Math.abs(i-c)<d);
  // the two corners into Paru and onto Central are crossroads: the road through the turn keeps its pavement only on the inside, the outside is open junction (built with the cross streets below)
  const JN=[];
 for(const J of JN)J.i0=J.c-Math.round(J.R*Math.PI/2/SEG);   // R: the turn's radius in buildRoute(); os: which side is the outside of the turn (+1 left)
  {let a=Z.central;for(const c of CROSS2){pavement(a,c-8,false);a=c+8;}pavement(a,Z.wilma,false);
    span(Z.wt0+m(130),0,(a,b)=>pavement(a,b,true));pavement(0,Z.central,true);}
  pavement(Z.b1+m(30),Z.gg0-m(320),false,[-1]);{let a=Z.b1+m(30);for(const c of SFX){pavement(a,c-8,false,[1]);a=c+8;}pavement(a,Z.gg0-m(320),false,[1]);}pavement(Z.rb1+m(30),Z.i80-m(20),false);
  const ivy=std({color:0x3e5a2c,roughness:1,side:D2});
  barrier(Z.wilma+m(82),Z.tu0-52,[-1,1],ivy);barrier(Z.tu1+52,Z.detour-m(30));barrier(Z.detour-m(30),Z.detour+m(220),[1]);barrier(Z.detour+m(220),Z.b0);barrier(Z.i80+m(20),Z.wt1-52);barrier(Z.gg0-m(320),Z.gg0);
  {const wr=std({color:0x6a5240,roughness:.9,side:D2}),a=CLF[0]+15,b=CLF[1];ribbon(-9.2,-9.2,.45,.75,wr,3,Z.gg1,Z.rb0);ribbon(9.2,9.2,.45,.75,wr,3,Z.gg1,a);ribbon(9.2,9.2,.45,.75,wr,3,b,Z.rb0);   // a timber guard rail through the woods
    const N=Math.ceil((b-a)/2),pg=new THREE.BoxGeometry(.1,.3,2*SEG+.04),im=new THREE.InstancedMesh(pg,wr,N),po=new THREE.InstancedMesh(new THREE.BoxGeometry(.16,.85,.16),wr,N);   /* along the cliff above the lake it is planks on posts that a hard hit breaks (LKR, lakeRailBreak) */
    for(let k=0;k<N;k++){const i=a+k*2;off(i+1,9.2,.6,V);Q.setFromAxisAngle(YAX,yaw(i));const m=new THREE.Matrix4().compose(V,Q,S.set(1,1,1));off(i,9.2,.42,V);const mp=new THREE.Matrix4().compose(V,Q,S.set(1,1,1));im.setMatrixAt(k,m);po.setMatrixAt(k,mp);LKR.p.push({i:i+1,m,mp,br:0});}
    im.castShadow=po.castShadow=true;scene.add(im,po);Object.assign(LKR,{im,po,pg:new THREE.BoxGeometry(.1,.3,1.3),mat:wr,Z0:new THREE.Matrix4().makeScale(0,0,0)});}
  const loft=(a,b,prof,mm,vS=6)=>{const pos=[],uv=[],idx=[],n=prof.length;for(let i=a;i<=b;i++){const p=P[i],nn=Nn[i];prof.forEach(([o,y],j)=>{pos.push(p.x+nn.x*o,y+p.y,p.z+nn.z*o);uv.push(j/(n-1),i*2/vS);});
      if(i<b)for(let j=0;j<n-1;j++){const q=(i-a)*n+j;idx.push(q,q+n,q+1,q+1,q+n,q+n+1);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const me=new THREE.Mesh(g,mm);me.castShadow=me.receiveShadow=true;scene.add(me);return me;};
  // elevated roads: deck edge, soffit and columns wherever the road stands more than 3 m above flat ground
  const conc=std({color:0x9a968c,roughness:.9,side:D2});
  const deck=(a,b)=>{for(const sd of[-1,1])ribbon(i=>sd*(8.45+XW[i]),i=>sd*(8.45+XW[i]),i=>(H[i]>2?-1.6:-H[i]-.02)-(H[i]>2?0:bkY(i,sd*(8.45+XW[i]))),0,conc,8,a,b).castShadow=true;ribbon(i=>8.45+XW[i],i=>-8.45-XW[i],i=>-Math.min(1.6,H[i]),i=>-Math.min(1.6,H[i]),conc,8,a,b);
    for(let i=a;i<b;i+=14){if(H[i]<3)continue;const hh=H[i]-1.6;B(2.2,hh,2.4,conc,P[i].x,hh/2,P[i].z,yaw(i));B(15+XW[i]*2,1.2,2.6,conc,P[i].x,hh-.6,P[i].z,yaw(i));}};
  deck(Z.wilma,Z.tu0-60);deck(Z.tu1+60,Z.toll);deck(Z.i80,Z.wt1-60);deck(Z.gg0-m(320),Z.gg0);

await BOOT.step('BORING THE TUBES',.29);
  // ---- the two tubes under the estuary: tiled bore, sodium lamps, railings, open cuts down to each mouth, and a portal building at every end
  const lampT=canvas(32,64,(g)=>{g.clearRect(0,0,32,64);const r=g.createRadialGradient(16,32,1,16,32,15);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.5,'rgba(255,220,150,.9)');r.addColorStop(1,'rgba(255,200,120,0)');g.fillStyle=r;g.fillRect(0,0,32,64);});lampT.wrapT=THREE.RepeatWrapping;
  const tunLamp=new THREE.MeshBasicMaterial({map:lampT,color:new THREE.Color(1.7,1.3,.62),transparent:true,side:D2,depthWrite:false,fog:false});
  const tile=canvas(256,256,(g,w,h)=>{g.fillStyle='#d9c9a2';g.fillRect(0,0,w,h);g.strokeStyle='rgba(120,100,70,.35)';g.lineWidth=1;for(let x=0;x<w;x+=16){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}for(let y=0;y<h;y+=32){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
    speck(g,w,h,2500,['rgba(90,70,40,.12)','rgba(255,255,255,.1)'],5);g.fillStyle='rgba(60,45,25,.35)';g.fillRect(0,0,26,h);g.fillRect(w-26,0,26,h);});tile.wrapS=tile.wrapT=THREE.RepeatWrapping;const tileM=std({map:tile,roughness:.55,side:D2});
  const portalFace=name=>{const t=canvas(1024,512,(g,w,h)=>{const X=x=>(x+15)/30*w,Y=y=>(1-y/16)*h;g.fillStyle='#e3cfa6';g.fillRect(0,0,w,h);speck(g,w,h,6000,['rgba(150,120,80,.1)','rgba(255,255,255,.12)'],6);
      g.strokeStyle='rgba(120,95,60,.55)';g.lineWidth=3;for(const y of[6.6,9,12.6,15.2]){g.beginPath();g.moveTo(0,Y(y));g.lineTo(w,Y(y));g.stroke();}for(const x of[-9.2,-4.8,4.8,9.2]){g.beginPath();g.moveTo(X(x),Y(6.6));g.lineTo(X(x),0);g.stroke();}
      const win=(x0,x1,y0,y1,arch)=>{g.fillStyle='#232b30';g.beginPath();g.moveTo(X(x0),Y(y0));g.lineTo(X(x0),Y(y1));if(arch)g.quadraticCurveTo(X((x0+x1)/2),Y(y1+(x1-x0)*.42),X(x1),Y(y1));else g.lineTo(X(x1),Y(y1));g.lineTo(X(x1),Y(y0));g.fill();
        g.strokeStyle='rgba(215,205,180,.75)';g.lineWidth=2;for(let x=x0+.5;x<x1;x+=.6){g.beginPath();g.moveTo(X(x),Y(y0));g.lineTo(X(x),Y(y1+(arch?.3:0)));g.stroke();}for(let y=y0+.7;y<y1;y+=.8){g.beginPath();g.moveTo(X(x0),Y(y));g.lineTo(X(x1),Y(y));g.stroke();}};
      win(-3.6,3.6,9.4,13.2,true);for(const x of[-3.6,-.6,2.4])win(x,x+1.2,6.9,8.5,true);for(const x of[-8,6.9])win(x,x+1.1,7,8.4,true);for(const x of[-13,11.8])win(x,x+1.2,9.6,11.6,false);
      g.fillStyle='#e3b63a';g.fillRect(X(-4.4),Y(6.4),X(4.4)-X(-4.4),Y(6)-Y(6.4));g.fillStyle='#5a4630';g.font='700 15px Arial';g.textAlign='center';g.fillText(name,X(0),Y(14.1));});t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1/30,1/16);t.offset.set(.5,0);return std({map:t,roughness:.85});};
  const pSh=new THREE.Shape();pSh.moveTo(-15,0);pSh.lineTo(15,0);pSh.lineTo(15,11.5);pSh.lineTo(9.6,11.5);pSh.lineTo(9.6,16);pSh.lineTo(-9.6,16);pSh.lineTo(-9.6,11.5);pSh.lineTo(-15,11.5);pSh.lineTo(-15,0);
  {const ho=new THREE.Path();ho.moveTo(-6.5,0);ho.lineTo(-6.5,3.2);ho.bezierCurveTo(-6.5,6.25,6.5,6.25,6.5,3.2);ho.lineTo(6.5,0);ho.lineTo(-6.5,0);pSh.holes.push(ho);}
  const pGeo=new THREE.ExtrudeGeometry(pSh,{depth:9,bevelEnabled:false}),tileR=std({color:0xa8492f,roughness:.8}),lampGreen=std({color:0x2f5a3a,roughness:.5,metalness:.4});
  const tube=(a,b,name,w=1,h=1,lm=tunLamp)=>{loft(a,b,[[-6.5,0],[-6.5,3.2],[-5.6,4.6],[-3.5,5.3],[0,5.5],[3.5,5.3],[5.6,4.6],[6.5,3.2],[6.5,0]].map(([x,y])=>[x*w,y*h]),tileM,8);loft(a+3,b-3,[[-15,0],[-9,6.4],[9,6.4],[15,0]].map(([x,y])=>[x*w,y*h]),groundMat,60);   // w, h: how much wider and taller than the old bore
    const wi=w>1?6.3:5.9;for(const sd of[-1,1]){ribbon(sd*6.42*w,sd*6.42*w,2.85*h,3.35*h,lm,3.4,a+2,b-2).receiveShadow=false;ribbon(sd*(wi+.05),sd*(wi+.05),.55,1.15,railM,2,a,b);ribbon(sd*6.5*w,sd*wi,.5,.5,side,3,a,b);}
    // open cuts leading down to each mouth: cream retaining walls with a balustrade, and the green lamp standards of the old approach
    const cut=(c0,c1,rise)=>{for(const sd of[-1,1]){const pos=[],uv=[],idx=[];for(let i=c0;i<=c1;i++){const k=(i-c0)/(c1-c0),hgt=.9+(rise>0?k:1-k)*(6.3*h+.6*(h-1)),o=sd*7.1*w,p=P[i],nn=Nn[i];pos.push(p.x+nn.x*o,p.y+bkY(i,o),p.z+nn.z*o,p.x+nn.x*o,p.y+hgt+bkY(i,o),p.z+nn.z*o);uv.push(0,i/4,hgt/7,i/4);if(i<c1){const q=(i-c0)*2;idx.push(q,q+2,q+1,q+1,q+2,q+3);}}
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const me=new THREE.Mesh(g,cream);me.castShadow=me.receiveShadow=true;scene.add(me);
        ribbon(sd*6.6*w,sd*6.6*w,.5,1.2,railM,2,c0,c1);ribbon(sd*7.1*w,sd*6.6,.012,.012,side,3,c0,c1);
        for(let i=c0+4;i<c1;i+=11){const k=(i-c0)/(c1-c0),top=.9+(rise>0?k:1-k)*(6.3*h+.6*(h-1)),lp=new THREE.Group();B(.22,4.2,.22,lampGreen,0,2.1,0,0,lp);B(.5,.5,.5,lampGreen,0,.25,0,0,lp);const gl=new THREE.Mesh(new THREE.SphereGeometry(.34,10,8),lampMat);gl.position.y=4.5;lp.add(gl);B(.7,.12,.7,lampGreen,0,4.9,0,0,lp);
          off(i,sd*7.6*w,top,lp.position);scene.add(lp);}}};
    cut(a-52,a,1);cut(b,b+52,-1);
    const face=portalFace(name);for(const[i,flip]of[[a,0],[b,1]]){const g=new THREE.Group();g.add(new THREE.Mesh(pGeo,face));
      for(const x of[-7.2,7.2]){B(5.2,4.6,6,cream,x,18.3,4.2,0,g);const r=new THREE.Mesh(new THREE.ConeGeometry(4.3,2.6,4),tileR);r.position.set(x,21.9,4.2);r.rotation.y=Math.PI/4;g.add(r);}
      for(const x of[-12.3,12.3])B(5.4,1,9,tileR,x,11.9,4.5,0,g);g.traverse(o=>{o.castShadow=o.receiveShadow=true;});g.scale.set(w,h,1);g.position.copy(P[i]);g.rotation.y=yaw(i)+(flip?Math.PI:0);scene.add(g);}};
  tunLampB=new THREE.MeshBasicMaterial({map:lampT,color:new THREE.Color(.8,1.15,1.8),transparent:true,side:D2,depthWrite:false,fog:false});   // the Posey Tube's own lamps: cold and bluish, and they flicker
  tube(Z.tu0,Z.tu1,'P O S E Y   T U B E',1.2,1.3,tunLampB);tube(Z.wt1,Z.wt0,'W E B S T E R   T U B E');
  {// graffiti along the Posey Tube's walls, above the railing: tags and big letters in spray paint, with drips
    const TAGS=['OAKTOWN','24H','McQ','VQH','ESTUARY','ZORRO','RIP','POSEY','510','KRUSH','BAYSIDE','LE MANS','TUBE RAT','ALAMEDA','NO EXIT','DEEP','FISH','SKEET','ROACH','WET FLOOR','HI MOM','GHOST','NEON','9 LIVES','DIG','OHM','WAVE','ISLAND','BOP'],COL=['#f4f1e8','#f4f1e8','#f4f1e8','#c8c8c8','#d4af37','#f4f1e8','#c0c8d0'];
    const gm=TAGS.map((s,n)=>{const tx=canvas(512,192,(g,w,h)=>{g.clearRect(0,0,w,h);const c1=COL[n%COL.length],c2=n%7===2?'#d8261c':n%6===0?COL[4]:n%6===3?COL[6]:'#111';g.save();g.translate(w/2,h/2);g.rotate(R(-.12,.08));
      g.font=`900 ${s.length>6?78:110}px Impact, "Arial Black", sans-serif`;g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';
      const sty=n%4;if(sty===1)g.font=`italic 900 ${s.length>6?70:100}px Georgia, serif`;else if(sty===2)g.font=`900 ${s.length>6?64:92}px "Comic Sans MS", Chewy, cursive`;g.lineWidth=sty===3?10:22;g.strokeStyle='#111';g.strokeText(s,0,0);g.lineWidth=9;g.strokeStyle=c2;g.strokeText(s,0,0);g.fillStyle=sty===3?'rgba(0,0,0,0)':c1;g.fillText(s,0,0);
      g.strokeStyle=c2;g.fillStyle=c1;g.lineWidth=6;const dk=n%5;if(dk===0){g.beginPath();for(let q=0;q<10;q++){const a=q*.628-1.57,r=q%2?14:30;g.lineTo(-w*.36+Math.cos(a)*r,-52+Math.sin(a)*r);}g.closePath();g.fill();}else if(dk===1){g.beginPath();g.arc(w*.34,-50,24,0,7);g.stroke();g.fillRect(w*.34-9,-56,5,5);g.fillRect(w*.34+5,-56,5,5);g.beginPath();g.arc(w*.34,-46,11,.2,2.9);g.stroke();}else if(dk===2){g.beginPath();g.moveTo(-w*.4,58);g.lineTo(w*.4,58);g.lineTo(w*.4-16,46);g.moveTo(w*.4,58);g.lineTo(w*.4-16,70);g.stroke();}else if(dk===3){g.beginPath();g.moveTo(-26,-70);g.lineTo(-14,-92);g.lineTo(0,-72);g.lineTo(14,-92);g.lineTo(26,-70);g.closePath();g.fill();}
      for(let k=0;k<7;k++)g.fillRect(R(-w*.38,w*.38),R(14,34),3,R(14,48));g.restore();});return std({map:tx,emissiveMap:tx,emissive:0xffffff,emissiveIntensity:.6,transparent:true,alphaTest:.1,roughness:.7,polygonOffset:true,polygonOffsetFactor:-2,side:D2});});   // a little self-lit, so the paint reads in the gloom
    // street-art pieces among the tags: a top-hatted skeleton with a red-outlined face, a red radiation-warning poster on torn paper, a monster ape poster
    const torn=(g,x,y,pw,ph,col)=>{g.fillStyle=col;g.beginPath();g.moveTo(x,y);for(let q=1;q<=12;q++)g.lineTo(x+pw*q/12,y+R(-5,5));for(let q=1;q<=6;q++)g.lineTo(x+pw+R(-5,5),y+ph*q/6);for(let q=11;q>=0;q--)g.lineTo(x+pw*q/12,y+ph+R(-5,5));for(let q=5;q>=0;q--)g.lineTo(x+R(-5,5),y+ph*q/6);g.fill();};
    const artM=pn=>{const tx=canvas(512,192,(g,w,h)=>{g.clearRect(0,0,w,h);g.lineJoin='round';g.lineCap='round';
      if(pn===0){g.fillStyle='#111';g.fillRect(212,6,88,56);g.fillRect(180,60,152,12);g.fillStyle='#d8261c';g.fillRect(212,46,88,9);   // top hat
        g.fillStyle='#f4f1e8';g.beginPath();g.ellipse(256,112,50,44,0,0,7);g.fill();g.strokeStyle='#d8261c';g.lineWidth=7;g.stroke();g.fillStyle='#111';for(const dx of[-19,19]){g.beginPath();g.ellipse(256+dx,106,13,16,0,0,7);g.fill();}g.beginPath();g.moveTo(256,118);g.lineTo(249,132);g.lineTo(263,132);g.fill();
        g.fillStyle='#f4f1e8';g.fillRect(228,142,56,16);g.strokeStyle='#111';g.lineWidth=3;for(let k=0;k<5;k++){g.beginPath();g.moveTo(236+k*10,142);g.lineTo(236+k*10,158);g.stroke();}
        g.strokeStyle='#f4f1e8';g.lineWidth=7;for(let k=0;k<4;k++){g.beginPath();g.moveTo(200,170+k*5-5);g.quadraticCurveTo(256,176+k*5,312,170+k*5-5);g.stroke();}   // ribs
        g.fillStyle='#d4af37';g.font='900 40px Impact,"Arial Black",Arial';g.textAlign='left';g.fillText('DEAD',330,100);g.fillText('MAN',330,142);g.strokeStyle='#111';g.lineWidth=2;g.strokeText('DEAD',330,100);g.strokeText('MAN',330,142);}
      else if(pn===1){torn(g,70,8,372,176,'#c8bfa8');torn(g,86,14,340,164,'#d8261c');const cx=190,cy=96;g.fillStyle='#111';g.beginPath();g.arc(cx,cy,12,0,7);g.fill();for(let k=0;k<3;k++){const a0=k*2.094+.52;g.beginPath();g.moveTo(cx,cy);g.arc(cx,cy,56,a0,a0+1.047);g.closePath();g.fill();}   // the trefoil
        g.fillStyle='#f4f1e8';g.font='900 46px Impact,"Arial Black",Arial';g.textAlign='left';g.fillText('DANGER',262,86);g.font='900 24px Impact,Arial';g.fillText('RADIATION',262,116);g.fillText('KEEP OUT',262,146);g.strokeStyle='#111';g.lineWidth=5;g.strokeRect(100,24,312,144);}
      else if(pn===3){torn(g,40,6,432,180,'#2a241c');torn(g,52,14,408,164,'#cdbf9c');const sv=g.createLinearGradient(100,0,180,0);sv.addColorStop(0,'#7a7770');sv.addColorStop(.5,'#e8e6dc');sv.addColorStop(1,'#6a6760');g.fillStyle=sv;   // a tall silver robot with a visor, drawn in the style of an old film still
        g.beginPath();g.ellipse(140,40,22,24,0,0,7);g.fill();g.fillStyle='#14120e';g.fillRect(120,34,40,8);g.fillStyle=sv;g.fillRect(124,60,32,14);g.beginPath();g.roundRect(108,72,64,60,12);g.fill();g.fillRect(96,76,14,52);g.fillRect(170,76,14,52);g.fillRect(118,130,18,44);g.fillRect(144,130,18,44);g.fillStyle='#14120e';g.fillRect(114,172,26,6);g.fillRect(140,172,26,6);
        g.fillStyle='#1c1810';g.font='900 38px Impact,"Arial Black",Arial';g.textAlign='left';g.fillText('KLAATU',224,70);g.fillText('BARADA',224,114);g.fillText('NIKTO',224,158);g.strokeStyle='#1c1810';g.lineWidth=3;g.strokeRect(210,24,214,144);}
      else{torn(g,40,6,432,180,'#2a2a2a');torn(g,52,14,408,164,'#cfc9b8');g.fillStyle='#161616';g.beginPath();g.ellipse(170,100,70,66,0,0,7);g.fill();g.beginPath();g.ellipse(170,138,58,36,0,0,7);g.fill();   // the monster ape's head and jaw
        g.fillStyle='#cfc9b8';g.fillRect(112,86,116,16);g.fillStyle='#d8261c';for(const dx of[-24,24]){g.beginPath();g.arc(170+dx,94,7,0,7);g.fill();}g.fillStyle='#f4f1e8';for(let k=0;k<7;k++)g.fillRect(136+k*10,134,6,14);g.fillStyle='#111';g.fillRect(160,112,6,10);g.fillRect(174,112,6,10);
        g.fillStyle='#111';g.font='900 56px Impact,"Arial Black",Arial';g.textAlign='left';g.fillText('MONSTER',260,92,200);g.fillText('APE!',260,150,200);}
      });return std({map:tx,emissiveMap:tx,emissive:0xffffff,emissiveIntensity:.6,transparent:true,alphaTest:.1,roughness:.7,polygonOffset:true,polygonOffsetFactor:-2,side:D2});};
    gm.push(artM(0),artM(1),artM(2),artM(0),artM(1),artM(2),artM(3));const gort=gm[gm.length-1];for(const q of gm){q.opacity=.5;q.emissiveIntensity=.22;}gort.opacity=.38;   // toned down: fewer, fainter tags; the robot poster smaller and fainter still
    let n=0;for(let i=Z.tu0+m(20);i<Z.tu1-m(15);i+=m(R(18,32))){const sd=Math.random()<.5?1:-1,mt=gm[(n*7+(Math.random()*5|0))%gm.length],len=R(3,5.5)*(mt===gort?.55:1),me=new THREE.Mesh(new THREE.PlaneGeometry(len,len*.375),mt);
      off(i,sd*(6.5*1.2-.05),mt===gort?3:2.6,me.position);me.rotation.y=Math.atan2(-sd*Nn[i].x,-sd*Nn[i].z);scene.add(me);n++;}}
  tunL=new THREE.PointLight(0xffc27a,0,46,1.3);scene.add(tunL);

await BOOT.step('BUILDING ALAMEDA · HOUSE BY HOUSE',.33);
if(DRIVE)await Promise.race([document.fonts.load('84px Chewy'),new Promise(r=>setTimeout(r,2500))]).catch(()=>{});   // the rounded hand-lettered face on the Fuzzy Caterpillar billboard (falls back to a system face offline)
  // ---- Alameda: craftsman bungalows, Victorians and corner apartments, lawns and hedges, parked cars, the shops on Central, the house at 1611
  const wallT=canvas(256,256,(g,w,h)=>{g.fillStyle='#fff';g.fillRect(0,0,w,h);g.strokeStyle='rgba(0,0,0,.09)';g.lineWidth=1;for(let y=0;y<h;y+=9){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
    const win=(x,y,ww,hh)=>{g.fillStyle='#fbfaf4';g.fillRect(x-5,y-5,ww+10,hh+10);g.fillStyle='#27323a';g.fillRect(x,y,ww,hh);g.strokeStyle='#fbfaf4';g.lineWidth=3;g.beginPath();g.moveTo(x+ww/2,y);g.lineTo(x+ww/2,y+hh);g.moveTo(x,y+hh/2);g.lineTo(x+ww,y+hh/2);g.stroke();};
    win(30,36,44,60);win(182,36,44,60);win(30,150,44,66);win(182,150,44,66);g.fillStyle='#fbfaf4';g.fillRect(104,140,48,116);g.fillStyle='#5a3a2a';g.fillRect(110,148,36,108);});
  const aptT=canvas(256,256,(g,w,h)=>{g.fillStyle='#fff';g.fillRect(0,0,w,h);for(let fl=0;fl<3;fl++)for(let k=0;k<4;k++){const x=16+k*60,y=20+fl*82;g.fillStyle='#f4f1e8';g.fillRect(x-4,y-4,44,58);g.fillStyle='#2a343c';g.fillRect(x,y,36,50);g.fillStyle='rgba(240,236,220,.8)';g.fillRect(x,y+24,36,3);}});
  const roofT=canvas(128,128,(g,w,h)=>{g.fillStyle='#6a5a4c';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=8)for(let x=0;x<w;x+=12){g.fillStyle=`rgba(${40+Math.random()*50|0},${36+Math.random()*40|0},${30+Math.random()*36|0},.5)`;g.fillRect(x+(y/8%2)*6,y,11,7);}});roofT.wrapS=roofT.wrapT=THREE.RepeatWrapping;roofT.repeat.set(.4,.4);
  const tri=new THREE.Shape();tri.moveTo(-1,0);tri.lineTo(1,0);tri.lineTo(0,1);
  const VIC=[0x8fa9a3,0xc9cdc4,0xe6dcc0,0x7d9a9c,0xb4bfc0,0xd8d2b8,0x9db3ad,0xa7b3b8,0xe8e0c8],CRAFT=[0x4a4f55,0x5b4a3a,0x6f7a5a,0x7a4a36,0x3e4a52,0x8a7a5a,0x56604a],roofM=std({map:roofT,roughness:.9}),brick=std({color:0x8a4a38,roughness:.95}),lawnM=std({color:0x5f7a3a,roughness:1});
  const wallM=c=>mat('w'+c,{map:wallT,color:c,roughness:.9}),plainM=c=>mat('p'+c,{color:c,roughness:.9});
  // Victorian dressing, as on the old Alameda streets: canted two-storey bay windows in white frames, a small gable over the bay, white gingerbread brackets and a finial on the main gable,
  // and in front of some a big Canary Island date palm (thick trunk, wide fan of arching fronds) and a clipped yellow-green hedge. Own random numbers, so the shared ones run on as before.
  let vs=1893;const vq=()=>(vs=(vs*16807)%2147483647)/2147483647;
  const vGlass=mat('vglass',{color:0x1f2a30,roughness:.1,metalness:.4}),vTrunk=mat('ptrunk',{color:0x6e5c46,roughness:1}),vHedge=mat('vhedge',{color:0x8a9a32,roughness:1});
  const vFrondM=std({roughness:.85,side:D2,alphaTest:.5,map:canvas(64,256,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='#5f7a2c';c.lineWidth=3;c.beginPath();c.moveTo(w/2,0);c.lineTo(w/2,h);c.stroke();c.lineWidth=2.4;for(let y=8;y<h-6;y+=6){const s=(1-y/h)*.5+.5;c.strokeStyle=y%12?'#4e6e28':'#6d8a34';c.beginPath();c.moveTo(w/2,y);c.lineTo(w/2-28*s,y+14);c.moveTo(w/2,y);c.lineTo(w/2+28*s,y+14);c.stroke();}})});
  const vFrondG=new THREE.PlaneGeometry(1.5,4.8).translate(0,2.4,0),vTrunkG=cyl(.85,1.05,1,10);
  const vicDress=(g,w,d,h,mm)=>{const bx=w*.3,fz=d/2+1.2;
    for(const y of[1.95,h*.42+.5+h*.22]){B(w*.22,1.95,.05,white,bx,y,fz+.02,0,g);B(w*.17,1.6,.06,vGlass,bx,y,fz+.05,0,g);for(const s of[-1,1]){const sp=B(.9,1.6,.06,vGlass,bx+s*(w*.15+.25),y,fz-.32,0,g);sp.rotation.y=s*.8;}}
    const bg=new THREE.Mesh(new THREE.ExtrudeGeometry(tri,{depth:1.5,bevelEnabled:false}),roofM);bg.scale.set(w*.17,1.7,1);bg.position.set(bx,h*.8+.5,fz-1.4);g.add(bg);
    const bt=new THREE.Mesh(new THREE.ExtrudeGeometry(tri,{depth:.1,bevelEnabled:false}),white);bt.scale.set(w*.11,1.05,1);bt.position.set(bx,h*.8+.62,fz+.12);g.add(bt);
    B(w+.3,.32,.12,white,0,h+.3,d/2+.06,0,g);for(let k=0;k<7;k++)B(.12,.55,.3,white,-w/2+.3+k*(w-.6)/6,h+.05,d/2+.18,0,g);B(.16,1.1,.16,white,0,h+3.3,d/2-.1,0,g);
    const sb=new THREE.Mesh(new THREE.ExtrudeGeometry(tri,{depth:.06,bevelEnabled:false}),white);sb.scale.set(1.3,.9,1);sb.position.set(0,h+1.6,d/2+.06);g.add(sb);
    if(vq()<.38){const ph=3.6+vq()*2.4,px=-w*.4,pz=d/2+4.4,tk=new THREE.Mesh(vTrunkG,vTrunk);tk.scale.set(1,ph,1);tk.position.set(px,ph/2,pz);g.add(tk);
      const cr=new THREE.Mesh(new THREE.SphereGeometry(1.4,8,6),vTrunk);cr.scale.set(1,.8,1);cr.position.set(px,ph,pz);g.add(cr);
      for(let j=0;j<42;j++){const up=j<12,f=new THREE.Mesh(vFrondG,vFrondM);f.position.set(px,ph+.3,pz);f.rotation.set(0,j*2.39996+vq()*.3,0,'YXZ');f.rotateX(up?.4+vq()*.4:1.0+vq()*.95);f.scale.setScalar(1+vq()*.4);g.add(f);}}
    if(vq()<.55){const hz=d/2+5.35,px=-w*.14,L=(w+4)/2;B(px-1.1+L,1.1,.9,vHedge,(px-1.1-L)/2,.55,hz,0,g);B(L-px-1.1,1.1,.9,vHedge,(px+1.1+L)/2,.55,hz,0,g);}};
  const house=(x,y,z,rot,col,num,style)=>{const g=new THREE.Group(),craft=style==='craft',w=rr(8,10.5),d=rr(9,11),h=craft?rr(5.2,6.6):rr(6,7.4),mm=wallM(col),pm=plainM(col);
    B(w,h,d,mm,0,h/2+.5,0,0,g);B(w+.2,.5,d+.2,craft?brick:side,0,.25,0,0,g);
    const rf=new THREE.Mesh(new THREE.ExtrudeGeometry(tri,{depth:d+1,bevelEnabled:false}),roofM);rf.scale.set(w/2+(craft?1.1:.6),craft?rr(1.8,2.4):rr(2.8,3.8),1);rf.position.set(0,h+.5,-(d+1)/2);g.add(rf);
    const gab=new THREE.Mesh(new THREE.ExtrudeGeometry(tri,{depth:.3,bevelEnabled:false}),pm);gab.scale.set(w/2,craft?1.8:2.5,1);gab.position.set(0,h+.5,d/2-.25);g.add(gab);
    for(const s of[-1,1]){const bb=new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(w/2,2.5)+.3,.16,.14),white);bb.position.set(s*w/4,h+1.75,d/2+.12);bb.rotation.z=-s*Math.atan2(2.5,w/2);g.add(bb);}
    B(w+.16,.2,d+.16,white,0,h*.52+.5,0,0,g);B(w*.62,.08,.08,white,-w*.14,1.35,d/2+2.5,0,g);
    if(style==='vic'&&!num&&rnd()<.4){const tw=new THREE.Mesh(cyl(1.5,1.5,h+2,10),mm);tw.position.set(w/2-.4,(h+2)/2+.5,d/2-.4);g.add(tw);const cn=new THREE.Mesh(new THREE.ConeGeometry(1.85,3.2,10),roofM);cn.position.set(w/2-.4,h+4.1,d/2-.4);g.add(cn);}
    if(craft||num){const dm=new THREE.Group();B(3.4,1.8,2.6,mm,0,.9,0,0,dm);const dr=new THREE.Mesh(new THREE.ExtrudeGeometry(tri,{depth:3.2,bevelEnabled:false}),roofM);dr.scale.set(2.2,1.3,1);dr.position.set(0,1.8,-1.6);dr.rotation.y=Math.PI/2;dm.add(dr);dm.position.set(0,h+.6,d/2-1.6);g.add(dm);}   // a dormer in the roof
    B(w*.62,.22,2.6,roofM,-w*.14,3.3,d/2+1.3,0,g);B(w*.62,.5,2.6,craft?brick:side,-w*.14,.25,d/2+1.3,0,g);
    for(const px of[-w*.44,-w*.14,w*.16]){if(craft){B(.45,1.6,.45,white,px,2.4,d/2+2.45,0,g);B(.7,1.1,.7,brick,px,1.05,d/2+2.45,0,g);}else B(.18,2.8,.18,white,px,1.9,d/2+2.45,0,g);}
    B(w*.3,h*.8,1.2,mm,w*.3,h*.42+.5,d/2+.6,0,g);B(.8,2.2,.8,brick,w*.25,h+2.6,-1,0,g);
    if(style==='vic'&&!num)vicDress(g,w,d,h,mm);   // bay windows, gable trim, and sometimes a Canary Island palm and a hedge (own random numbers)
    for(let s=0;s<3;s++)B(1.6,.17,.4,side,-w*.14,.08+s*.17,d/2+3.2-s*.4,0,g);
    B(w+4,.06,5.6,lawnM,0,.03,d/2+2.9,0,g);if(rnd()<.7){const bu=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),mat("bush"+(rnd()<.3?1:0),{color:rnd()<.3?0xc9b83a:0x3f6a34,roughness:1}));bu.scale.set(1.6,1.2,1.4);bu.position.set(w*.35,.9,d/2+3);g.add(bu);}
    if(num){const pl=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.5),new THREE.MeshBasicMaterial({map:canvas(128,64,(c)=>{c.fillStyle='#1c2a4a';c.fillRect(0,0,128,64);c.fillStyle='#f4f1e8';c.font='900 46px Arial Black,Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(num,64,36);})}));pl.position.set(-w*.14,2.7,d/2+2.56);g.add(pl);}
    g.userData.ig={w,d,y0:.5,top:h+.5,rh:rf.scale.y,ax:'z'};g.traverse(o=>{o.castShadow=o.receiveShadow=true;});g.position.set(x,y,z);g.rotation.y=rot;scene.add(g);};
  // ---- 1611 San Antonio Ave, in detail: a boxy 2½-storey Craftsman in dark brown-grey shingle under a low hipped roof with a hipped dormer and louvred vent,
  // two pairs of tall white sash windows over a white railing band, a red brick chimney up the right-hand corner, a recessed porch on the left and a bay window,
  // a yellow flowering shrub and a dark rounded one on the lawn, a straight walk to the door, and on the right a two-strip driveway with a white SUV and a blue bin.
  // Own random numbers; it stores where the driveway is in Z.home (track coordinates) for the start and the finish of the drive.
  const home1611=(x,z,rot,i0)=>{let rs=1611;const lr=()=>(rs=(rs*16807)%2147483647)/2147483647,g=new THREE.Group(),w=9.6,d=11,b=.6,h1=3.3,h2=3.1,top=b+h1+h2;
    const shT=canvas(256,256,(c,W,Hh)=>{c.fillStyle='#4a423c';c.fillRect(0,0,W,Hh);for(let y=0;y<Hh;y+=16)for(let x0=-(y/16%2)*10;x0<W;x0+=20){const v=lr();c.fillStyle=`rgb(${66+v*26|0},${58+v*22|0},${52+v*18|0})`;c.fillRect(x0+1,y+1,18,15);c.fillStyle='rgba(20,16,14,.55)';c.fillRect(x0,y+14,20,2);}});
    shT.wrapS=shT.wrapT=THREE.RepeatWrapping;shT.repeat.set(2.5,2);
    const shM=std({map:shT,roughness:.95}),trimW=std({color:0xf2f0e8,roughness:.6}),glass=std({color:0x1d262c,roughness:.12,metalness:.4}),rfM=std({color:0x3e3530,roughness:.95}),brk=std({color:0x9a4632,roughness:.95}),
      conc=std({color:0xb8b4aa,roughness:.95}),lawn=std({color:0x5f9a3a,roughness:1}),dk=std({color:0x2a2420,roughness:.9});
    const win=(wx,wy,ww,wh,wz=d/2)=>{B(ww+.28,wh+.28,.1,trimW,wx,wy,wz+.04,0,g);B(ww,wh,.12,glass,wx,wy,wz+.06,0,g);B(ww,.07,.16,trimW,wx,wy+.02,wz+.08,0,g);B(ww+.4,.12,.22,trimW,wx,wy-wh/2-.18,wz+.1,0,g);};
    // the body: the upper floor full width; below it the porch is cut back on the left
    B(w,h2,d,shM,0,b+h1+h2/2,0,0,g);B(w-2.8,h1,d,shM,1.4,b+h1/2,0,0,g);B(2.8,h1,d-2.1,shM,-w/2+1.4,b+h1/2,-1.05,0,g);B(w+.12,b,d+.12,dk,0,b/2,0,0,g);
    B(w+.2,.14,d+.2,trimW,0,b+h1,0,0,g);   // the belt course between the floors
    // the low hipped roof with deep eaves, and the hipped dormer with its louvred vent
    const hip=(rw,rd,rh)=>{const m=new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT2,1,4,1).rotateY(Math.PI/4).translate(0,.5,0),rfM);m.scale.set(rw/2,rh,rd/2);return m;};
    const rf=hip(w+2,d+2,2.5);rf.position.y=top;g.add(rf);B(w+2,.22,d+2,dk,0,top-.05,0,0,g);
    const dm=new THREE.Group();B(2.8,1.5,2.4,shM,0,.75,0,0,dm);const dr=hip(3.6,3.1,1);dr.position.y=1.5;dm.add(dr);
    const louv=new THREE.Mesh(new THREE.PlaneGeometry(1.7,.85),std({map:canvas(128,64,(c)=>{c.fillStyle='#f2f0e8';c.fillRect(0,0,128,64);c.fillStyle='#3a3430';for(let y=10;y<56;y+=8)c.fillRect(10,y,108,4);}),roughness:.7}));louv.position.set(0,.8,1.22);dm.add(louv);
    dm.position.set(0,top+.25,d/2-1.6);g.add(dm);
    // upper floor: two pairs of tall white sash windows, and the white railing band under them
    for(const px of[-2.3,2.1])for(const k of[-.6,.6])win(px+k,b+h1+1.55,.95,1.75);
    B(w*.86,.32,.3,trimW,-.1,b+h1+.42,d/2+.15,0,g);B(w*.86,.08,.4,trimW,-.1,b+h1+.62,d/2+.2,0,g);for(let k=0;k<17;k++)B(.07,.24,.07,dk,-.1-w*.41+k*w*.82/16,b+h1+.42,d/2+.31,0,g);
    // the red brick chimney up the right-hand front corner and above the roof
    B(1,top+3.2,1.1,brk,w/2+.5,(top+3.2)/2,d/2-1.4,0,g);B(1.2,.2,1.3,brk,w/2+.5,top+3.2,d/2-1.4,0,g);
    // ground floor: the recessed porch on the left (posts, small hipped roof, door, steps) and the bay window to its right
    for(const px of[-w/2+.15,-w/2+2.65])B(.26,h1,.26,trimW,px,b+h1/2,d/2-.13,0,g);
    const pr=hip(3.6,1.8,.6);pr.position.set(-w/2+1.4,b+h1-.15,d/2+.55);g.add(pr);B(1.05,2.2,.1,std({color:0x5a3a28,roughness:.6}),-w/2+1.4,b+1.1,d/2-2.05,0,g);B(1.35,2.45,.08,trimW,-w/2+1.4,b+1.18,d/2-2.1,0,g);
    for(let s=0;s<3;s++)B(1.8,.2,.4,conc,-w/2+1.4,.1+s*.2,d/2+.6-s*.4,0,g);B(2.8,.06,2.1,conc,-w/2+1.4,b+.03,d/2-1.05,0,g);
    B(3.4,2.3,.85,shM,.9,b+1.5,d/2+.42,0,g);for(const k of[-1,0,1])win(.9+k*1.05,b+1.6,.85,1.4,d/2+.85);const bt=hip(3.8,1.2,.4);bt.position.set(.9,b+2.65,d/2+.45);g.add(bt);
    win(3.6,b+1.6,.9,1.5);
    // front garden: lawn, the concrete walk, the yellow shrub and the tall dark one
    const yard=14.4-d/2;B(w+4.4,.05,yard,lawn,-1.2,.03,d/2+yard/2,0,g);B(1.2,.07,yard,conc,-w/2+1.4,.04,d/2+yard/2,0,g);
    const bush=(bx,bz,sx,sy,sz,c)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,12,9),std({color:c,roughness:1}));m.scale.set(sx,sy,sz);m.position.set(bx,sy*.85,bz);g.add(m);};
    bush(-1.4,d/2+2.1,1.9,1.6,1.5,0xe8d020);bush(-.4,d/2+1.4,1.1,1.1,1,0xd8c018);bush(2.4,d/2+1.5,1.5,2.4,1.4,0x2f5a26);
    for(let k=0;k<5;k++)bush(-w/2+3+lr()*5,d/2+.6,.5,.45,.5,0x3f6a34);
    // the driveway: two concrete wheel strips with grass between, from the kerb back beside the house; the white SUV partway up it and a blue bin
    const dx=w/2+2.4,dz0=-d/2-1,dz1=14.4,dl=dz1-dz0;for(const k of[-.78,.78])B(.62,.07,dl,conc,dx+k,.045,(dz0+dz1)/2,0,g);B(.95,.05,dl,lawn,dx,.03,(dz0+dz1)/2,0,g);
    const suv=new THREE.Group(),wht=std({color:0xeceff0,roughness:.35,metalness:.3});B(1.9,.95,4.6,wht,0,.85,0,0,suv);B(1.75,.7,2.7,glass,0,1.65,-.35,0,suv);B(1.78,.08,2.75,wht,0,2.02,-.35,0,suv);
    for(const[wx,wz]of[[-.88,1.45],[.88,1.45],[-.88,-1.45],[.88,-1.45]]){const t=new THREE.Mesh(cyl(.38,.38,.26,12).rotateZ(Math.PI/2),dk);t.position.set(wx,.38,wz);suv.add(t);}
    suv.position.set(dx,0,-1.6);g.add(suv);B(.62,1.05,.72,std({color:0x1f5ab8,roughness:.6}),dx+1.6,.53,1.6,0,g);B(.66,.08,.76,std({color:0x16448e,roughness:.6}),dx+1.6,1.08,1.6,0,g);
    const pl=new THREE.Mesh(new THREE.PlaneGeometry(.9,.4),new THREE.MeshBasicMaterial({map:canvas(128,64,(c)=>{c.fillStyle='#f2f0e8';c.fillRect(0,0,128,64);c.fillStyle='#2a2420';c.font='900 44px Georgia,serif';c.textAlign='center';c.textBaseline='middle';c.fillText('1611',64,36);})}));pl.position.set(-w/2+2.65,b+2.4,d/2+.06);g.add(pl);
    g.traverse(o=>{o.castShadow=o.receiveShadow=true;});g.position.set(x,0,z);g.rotation.y=rot;scene.add(g);g.updateMatrixWorld(true);
    // where things are on the track: the player's car sits in the driveway (local z 6.6), nose to the house
    const tr=(lx,lz)=>{const v=new THREE.Vector3(lx,0,lz).applyMatrix4(g.matrixWorld),ex=v.x-P[i0].x,ez=v.z-P[i0].z;return{s:i0*SEG+ex*T[i0].x+ez*T[i0].z,lat:ex*Nn[i0].x+ez*Nn[i0].z,x:v.x,z:v.z};};
    const c0=tr(dx,6.6),c1=tr(dx,5.6),sv=tr(dx,-1.6);OBST.push({x:sv.x,z:sv.z,r:2});Z.home={s:c0.s,lat:c0.lat,h:Math.atan2(c1.x-c0.x,c1.z-c0.z)};};
  const apt=(x,y,z,rot,col)=>{const g=new THREE.Group(),w=rr(16,22),h=rr(8,10.5),d=rr(12,15);B(w,h,d,mat('a'+col,{map:aptT,color:col,roughness:.9}),0,h/2,0,0,g);B(w+.6,.5,d+.6,white,0,h+.25,0,0,g);B(w+.2,.4,d+.2,side,0,.2,0,0,g);
    B(3,3,.3,mat('door',{color:0x3a2a22}),0,1.5,d/2+.1,0,g);B(4,.25,2,white,0,3.2,d/2+1,0,g);for(const x2 of[-w*.32,w*.32]){const bu=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),mat('bush0',{color:0x3f6a34,roughness:1}));bu.scale.set(2.4,1.2,1.2);bu.position.set(x2,.9,d/2+1.2);g.add(bu);}
    g.traverse(o=>{o.castShadow=o.receiveShadow=true;});g.position.set(x,y,z);g.rotation.y=rot;scene.add(g);};
  // the shops on Central: no two alike. Each is one of five fronts (flat cornice, stepped art-deco top, brick with arched windows, Spanish tile, modern glass), one or two storeys,
  // with its own awning, lettering and odds and ends on the pavement. Own random numbers (the two the old shop drew are still drawn, so the scenery after it is unchanged).
  const shopN=[['CAFÉ','#7a1f2a'],['BAKERY','#2f6b45'],['HARDWARE','#1f4f8a'],['BOOKS','#8a5a2a'],['DINER','#b3241c'],['FLORIST','#5d7a4a'],['BARBER','#22407a'],['RECORDS','#3a2a5a'],['TACOS','#b35a1c'],
    ['PHARMACY','#1f6a5a'],['ICE CREAM','#c0507a'],['PIZZA','#a8301c'],['THRIFT','#6a4a8a'],['SUSHI','#1c1c1c'],['PHO','#b8862a'],['BIKES','#2a5a8a'],['TOYS','#d0601c'],['LAUNDRY','#3a7aa8'],['DELI','#5a3a1c'],
    ['WINE','#5a1428'],['PET SUPPLY','#2f7a3a'],['TAILOR','#2a2a4a'],['OPTICIAN','#4a5a6a'],['NOODLES','#a8401c'],['JEWELER','#7a6a2a']];let sn=0,shs=7;
  const shR=()=>{shs=(shs*16807)%2147483647;return shs/2147483647;},shP=a=>a[shR()*a.length|0];
  const FONTS=['900 48px Arial Black,Arial','italic 900 46px Georgia,serif','700 46px "Courier New",monospace','50px Chewy,"Comic Sans MS",cursive','900 44px Impact,"Arial Narrow",Arial','700 44px Georgia,serif'];
  const shop=(x,y,z,rot)=>{const g=new THREE.Group(),[nm,c]=shopN[sn++%shopN.length],h0=rr(6,8.5),col0=pick(VIC),style=shR()*5|0,two=shR()<.55,w=10.5+shR()*5.5,h=two?h0+2.5:Math.min(h0,5.4),d=9;
    const glassM2=mat('glass',{color:0x1d262b,roughness:.1,metalness:.4}),trimC=shP([0xf2ead2,0x2a2a2a,0x6a4a2a,0x8a8f94]),trim=mat('t'+trimC,{color:trimC,roughness:.7});
    const wallC=style===2?0x8a4a38:style===4?0xb8bec4:col0,wallS=mat('s'+wallC,{color:wallC,roughness:style===4?.4:.9,metalness:style===4?.4:0});
    B(w,h,d,wallS,0,h/2,0,0,g);
    // the shop front: big glass, a door with its own frame, a stall riser below the glass
    const sf=new THREE.Mesh(new THREE.PlaneGeometry(w-1.6,2.6),glassM2);sf.position.set(0,1.75,d/2+.02);g.add(sf);B(w-1.4,.45,.12,trim,0,.22,d/2+.06,0,g);
    const dx=(shR()-.5)*(w-4);B(1.3,2.5,.14,mat('door'+(sn%3),{color:[0x3a2a22,0x1f3a2a,0x2a2a3a][sn%3],roughness:.6}),dx,1.25,d/2+.08,0,g);for(const k of[-1,1])B(.12,2.9,.16,trim,dx+k*.7,1.45,d/2+.1,0,g);
    for(let k=1;k<4;k++)B(.08,2.6,.1,trim,-w/2+.8+k*(w-1.6)/4,1.75,d/2+.06,0,g);
    // the upper floor: a row of sash windows (round-headed on the brick fronts)
    if(two){const n=Math.max(2,Math.round(w/3.4));for(let k=0;k<n;k++){const wx=-w/2+(k+.5)*w/n;B(1.3,1.7,.1,glassM2,wx,h-2.4,d/2+.04,0,g);B(1.6,.18,.16,trim,wx,h-3.35,d/2+.08,0,g);
      if(style===2){const ar=new THREE.Mesh(new THREE.CircleGeometry(.65,12,0,Math.PI),glassM2);ar.position.set(wx,h-1.55,d/2+.05);g.add(ar);}else B(1.6,.18,.16,trim,wx,h-1.45,d/2+.08,0,g);}}
    // the top of the front
    if(style===0)B(w+.5,.5,d+.5,trim,0,h+.25,0,0,g);
    else if(style===1){B(w,1.2,.4,wallS,0,h+.6,d/2-.2,0,g);B(w*.5,2,.4,wallS,0,h+1,d/2-.2,0,g);B(w*.2,2.8,.4,trim,0,h+1.4,d/2-.18,0,g);for(const k of[-1,1])B(.3,h+1.2,.3,trim,k*(w/2-.15),(h+1.2)/2,d/2+.05,0,g);}
    else if(style===2){B(w+.2,.35,d+.2,mat('stone',{color:0xd8ccb4,roughness:.9}),0,h+.17,0,0,g);for(let yy=1;yy<h;yy+=.9)B(w+.02,.05,.02,mat('mortar',{color:0x6a3a2c,roughness:1}),0,yy,d/2+.01,0,g);}
    else if(style===3){const rf=new THREE.Mesh(new THREE.BoxGeometry(w+1.2,.25,2.4),mat('tile',{color:0xa8452e,roughness:.85}));rf.position.set(0,h-.2,d/2+.6);rf.rotation.x=.38;g.add(rf);B(w,.6,.2,wallS,0,h+.3,d/2-.1,0,g);}
    else{B(w+.1,.25,d+.1,mat('alu',{color:0x5a6066,metalness:.6,roughness:.35}),0,h+.12,0,0,g);if(two)B(w-1,h-3.4,.06,glassM2,0,(h+3.4)/2,d/2+.03,0,g);}
    // the awning: striped fabric, a plain colour, a flat metal canopy, or none
    const aType=shR()*4|0;
    if(aType===0||aType===1){const ac=new THREE.Color(c),stT=canvas(256,64,(k,ww,hh)=>{k.fillStyle=c;k.fillRect(0,0,ww,hh);if(aType===0){k.fillStyle='#f2ead2';for(let s=0;s<ww;s+=32)k.fillRect(s,0,16,hh);}k.fillStyle='rgba(0,0,0,.25)';k.fillRect(0,hh-10,ww,10);});
      const aw=new THREE.Mesh(new THREE.BoxGeometry(w-.8,.08,2.2),std({map:stT,roughness:.9}));aw.position.set(0,3.35,d/2+1.05);aw.rotation.x=.42;g.add(aw);const vl=new THREE.Mesh(new THREE.PlaneGeometry(w-.8,.4),std({map:stT,roughness:.9,side:THREE.DoubleSide}));vl.position.set(0,2.75,d/2+2.05);g.add(vl);}
    else if(aType===2)B(w-.4,.15,1.6,trim,0,3.3,d/2+.8,0,g);
    // the lettering: on a fascia board over the window, sometimes a hanging blade sign too
    const fc=shP(['#f2ead2','#1c1c1c','#2a3a2a','#e8d8a8']),dark=fc==='#1c1c1c'||fc==='#2a3a2a',font=shP(FONTS);
    const sT=canvas(512,96,(k,ww,hh)=>{k.fillStyle=fc;k.fillRect(0,0,ww,hh);k.fillStyle=dark?'#e8d8a8':c;k.font=font;k.textAlign='center';k.textBaseline='middle';k.fillText(nm,ww/2,hh/2+3,ww-30);
      if(shR()<.5){k.strokeStyle=dark?'#e8d8a8':c;k.lineWidth=3;k.strokeRect(8,8,ww-16,hh-16);}});
    const sg=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w-1.4,9),1.5),std({map:sT,roughness:.8,emissiveMap:sT,emissive:0xffffff,emissiveIntensity:dark?.35:.05}));sg.position.set(0,two?4.15:4.35,d/2+.08);g.add(sg);
    if(shR()<.4){const bT=canvas(128,256,(k,ww,hh)=>{k.fillStyle=c;k.fillRect(0,0,ww,hh);k.fillStyle='#f2ead2';k.font='900 30px Arial';k.textAlign='center';k.textBaseline='middle';[...nm.replace(' ','')].slice(0,7).forEach((ch,j,a)=>k.fillText(ch,ww/2,hh/2+(j-(a.length-1)/2)*32));});
      const bl=new THREE.Mesh(new THREE.BoxGeometry(.12,2.2,1.1),std({map:bT,roughness:.7}));bl.position.set(w/2-.8,two?h-1.6:3.9,d/2+.75);g.add(bl);B(.06,.06,.9,trim,w/2-.8,(two?h-1.6:3.9)+1.15,d/2+.5,0,g);}
    // odds and ends on the pavement: a planter, a sandwich board, a bench or a bike rack
    const odd=shR()*5|0,ob=[],obAt=(x,z)=>ob.push(new THREE.Vector3(x,0,z));
    if(odd===0)for(const k of[-1,1]){obAt(k*(w/2-1),d/2+.7);B(.8,.6,.8,mat('planter',{color:0x6a6a62,roughness:.95}),k*(w/2-1),.3,d/2+.7,0,g);const pl=new THREE.Mesh(new THREE.SphereGeometry(.55,8,6),mat('bush0',{color:0x3f6a34,roughness:1}));pl.position.set(k*(w/2-1),.95,d/2+.7);g.add(pl);}
    else if(odd===1){obAt(dx+1.8,d/2+1.3);const sb=B(.7,1,.05,mat('board',{color:0x1c1c1c,roughness:.8}),dx+1.8,.5,d/2+1.3,0,g);sb.rotation.x=.2;}
    else if(odd===2){obAt(-dx*.5-.6,d/2+.6);obAt(-dx*.5+.6,d/2+.6);B(1.8,.08,.5,mat('bench',{color:0x5a3a22,roughness:.8}),-dx*.5,.5,d/2+.6,0,g);for(const k of[-1,1])B(.08,.5,.45,steelM,-dx*.5+k*.8,.25,d/2+.6,0,g);}
    else if(odd===3)for(let k=0;k<3;k++){obAt(-w/2+1.5+k*.6,d/2+1);const r=new THREE.Mesh(new THREE.TorusGeometry(.4,.03,5,12,Math.PI),steelM);r.position.set(-w/2+1.5+k*.6,0,d/2+1);r.rotation.y=Math.PI/2;g.add(r);}
    g.traverse(o=>{o.castShadow=o.receiveShadow=true;});g.position.set(x,y,z);g.rotation.y=rot;scene.add(g);g.updateMatrixWorld(true);for(const v of ob){v.applyMatrix4(g.matrixWorld);OBST.push({x:v.x,z:v.z,r:.7});}};
  const carG=mergeGeometries([new THREE.BoxGeometry(1.8,.62,4.5).translate(0,.62,0),new THREE.BoxGeometry(1.6,.52,2.3).translate(0,1.17,-.2)]),whG=mergeGeometries([[-.85,1.4],[.85,1.4],[-.85,-1.4],[.85,-1.4]].map(([x,z])=>cyl(.33,.33,.22,12).rotateZ(Math.PI/2).translate(x,.33,z))),tyreM=std({color:0x131313,roughness:.9}),glassM=std({color:0x1b2328,roughness:.1});
  const PCOL=[0x9db8c4,0xd8cfb0,0x8a3a30,0x4a5f52,0xe8e4d8,0x2f3f5f,0xc9a84a,0x6a6f74,0x3a4250];
  // the angular electric pickup: one slab-sided wedge of brushed stainless steel, a single peak over the cab, a light bar across the nose
  const ctruck=(()=>{const s=new THREE.Shape(),pr=[[-2.9,.45],[2.9,.45],[2.9,1.02],[2.78,1.1],[.3,1.9],[-2.9,1.17]];s.moveTo(...pr[0]);for(const p of pr.slice(1))s.lineTo(...p);
    const body=new THREE.ExtrudeGeometry(s,{depth:2,bevelEnabled:false}).translate(0,0,-1).rotateY(-Math.PI/2),steel=std({color:0xb9bdc1,roughness:.32,metalness:.85}),win=std({color:0x15191d,roughness:.08,metalness:.5}),bar=std({color:0xffffff,emissive:0xffffff,emissiveIntensity:.7});
    const ws=new THREE.BoxGeometry(1.86,.03,1.1),sl=Math.atan2(1.9-1.1,2.78-.3);
    return()=>{const g=new THREE.Group();g.add(new THREE.Mesh(body,steel));const w=new THREE.Mesh(ws,win);w.position.set(0,1.62,1.1);w.rotation.x=sl;g.add(w);   // windscreen high on the front slope
      for(const s2 of[-1,1]){const sw=new THREE.Mesh(new THREE.BoxGeometry(.03,.36,1.9),win);sw.position.set(s2*1.005,1.38,.15);g.add(sw);const ar=new THREE.Mesh(new THREE.BoxGeometry(.06,.5,4.6),std({color:0x2a2c2e,roughness:.8}));ar.position.set(s2*1.01,.5,0);g.add(ar);}
      const lb=new THREE.Mesh(new THREE.BoxGeometry(1.95,.05,.04),bar);lb.position.set(0,1.0,2.91);g.add(lb);const tb=new THREE.Mesh(new THREE.BoxGeometry(1.95,.06,.04),std({color:0x8a1010,emissive:0xff2010,emissiveIntensity:.5}));tb.position.set(0,1.1,-2.91);g.add(tb);
      const wh=new THREE.Mesh(whG,tyreM);wh.scale.set(1.12,1.25,1.25);g.add(wh);return g;};})();
  const parked=(i,sd)=>{const g=new THREE.Group();const cm=mat('car'+(rnd()*PCOL.length|0),{color:pick(PCOL),roughness:.4,metalness:.3});
    if((((i/9)|0)*5+(sd>0?2:0))%7===0)g.add(ctruck());   // now and then the stainless pickup instead of an ordinary car (chosen without the shared random numbers, so the rest of the street is unchanged)
    else g.add(new THREE.Mesh(carG,cm),new THREE.Mesh(whG,tyreM),new THREE.Mesh(new THREE.BoxGeometry(1.62,.36,2.32).translate(0,1.2,-.2),glassM));
    g.traverse(o=>{o.castShadow=true;});off(i,sd*(5.55+XW[i]),0,g.position);g.rotation.y=yaw(i)+(sd>0?Math.PI:0);scene.add(g);OBST.push({x:g.position.x,z:g.position.z});if(g.children.length===3)IGCL.c.push({g,i:wrapI(i)});};
  {let n=0;const homeI=Z.start;   // houses on both sides wherever the town zone runs straight, with gaps at the cross streets and the shops on Central Ave
    for(let i=0;i<NS;i+=9){if(zoneArr[i]!==1||curved(i)||curved(i+6)||curved(i-6)||nearCross(i,m(16))||(i>Z.wt0-5&&i<Z.wt0+m(140)))continue;const shops=i>Z.central+m(30)&&i<Z.wilma-m(20);
      for(const sd of[-1,1]){const isHome=sd<0&&Math.abs(i-homeI)<5;if(!shops&&!isHome&&(i/9|0)%3===1)continue;   /* open spaces between the houses */if(shops&&sd<0&&Math.abs(i-(Z.central+m(190)))<14)continue;   // the theatre's plot
        off(i,sd*((shops?14.2:21)+XW[i]),0,V);const rot=faceRoad(i,sd);
        const xc=shops&&nearCross2(i,m(14)),n0=scene.children.length,o0=OBST.length;   /* a Central Ave cross street: the shop is still built (so the shared random numbers run on as before) and then taken away */
        if(shops)shop(V.x,0,V.z,rot);else if(isHome){house(V.x,0,V.z,rot,0x3a3d40,'1611','craft');scene.remove(scene.children[scene.children.length-1]);home1611(V.x,V.z,rot,i);}   /* the plain house is still built and dropped, so the shared random numbers run on as before */else if(nearCross(i,m(30))&&rnd()<.35)apt(V.x,0,V.z,rot,pick([0xb8d0b0,0xe8dcc0,0xc9d6c2,0xd9c7b8]));
        else{const cr=rnd()<.55,hx=V.x,hz=V.z;house(V.x,0,V.z,rot,cr?CRAFT[n++%CRAFT.length]:VIC[n++%VIC.length],'',cr?'craft':'vic');IGCL.h.push({g:scene.children[scene.children.length-1],i});if(!farFromRoad(hx,hz,17)){scene.remove(...scene.children.slice(n0));OBST.length=o0;}}   /* a house that would stand in another road (Buena Vista's backs against Wilma Chan Way) is built, so the shared random numbers run on, and taken away */
        if(!isHome&&rnd()<.42&&Math.abs(i-homeI)>14&&!nearCross(i+3,m(22))){const n1=scene.children.length,o1=OBST.length;parked(wrapI(i+3),sd);if(shops&&nearCross2(i+3,m(12))){scene.remove(...scene.children.slice(n1));OBST.length=o1;}}
        if(xc){scene.remove(...scene.children.slice(n0));OBST.length=o0;}}}}
  {// the cross streets on Paru: asphalt across the avenue, yellow ladder crosswalks, a white stop line and STOP painted on the road, stop signs, and the green street-name blades
    const asph=mat('asph',{color:0x4a4b4e,roughness:.85}),yel=mat('yel',{color:0xe8c032,roughness:.7,polygonOffset:true,polygonOffsetFactor:-2}),wln=mat('wln',{color:0xe8e4d6,roughness:.7,polygonOffset:true,polygonOffsetFactor:-2});
    const stopT=canvas(256,256,(c)=>{c.translate(128,128);c.fillStyle='#f4f1e8';c.beginPath();for(let k=0;k<8;k++){const a=k/8*6.283+Math.PI/8;c.lineTo(Math.cos(a)*126,Math.sin(a)*126);}c.fill();c.fillStyle='#c8241c';c.beginPath();for(let k=0;k<8;k++){const a=k/8*6.283+Math.PI/8;c.lineTo(Math.cos(a)*114,Math.sin(a)*114);}c.fill();c.fillStyle='#f4f1e8';c.font='900 78px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText('STOP',0,6);});
    const stopM=std({map:stopT,transparent:true,alphaTest:.5,roughness:.6}),paintT=canvas(256,128,(c)=>{c.clearRect(0,0,256,128);c.fillStyle='#e8e4d6';c.font='900 120px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText('STOP',128,70);}),paintM=std({map:paintT,transparent:true,roughness:.7,polygonOffset:true,polygonOffsetFactor:-2});
    const NAMES=['ENCINAL AVE','SAN JOSE AVE','CLINTON AVE','TAYLOR AVE','SANTA CLARA AVE','LINCOLN AVE','PACIFIC AVE','EAGLE AVE','BLANDING AVE'];
    const flatAt=(i,along,lat,w,l,mm,y=.03,ry=0)=>{const o=new THREE.Mesh(new THREE.PlaneGeometry(w,l).rotateX(-Math.PI/2),mm);at(i*SEG+along,lat,y,o.position);o.rotation.y=yaw(i)+ry;o.receiveShadow=true;scene.add(o);return o;};
    const blade=(txt)=>std({roughness:.6,map:canvas(512,80,(c)=>{c.fillStyle='#1f5a3a';c.fillRect(0,0,512,80);c.fillStyle='#f4f1e8';c.font='900 44px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(txt,256,42,490);})});
    const corner=(i,txt,txt2,sd=-1)=>{const g=new THREE.Group();B(.08,3.4,.08,steelM,0,1.7,0,0,g);const b1=new THREE.Mesh(new THREE.BoxGeometry(2.1,.3,.03),blade(txt));b1.position.y=3.25;b1.rotation.y=Math.PI/2;g.add(b1);if(txt2){const b2=new THREE.Mesh(new THREE.BoxGeometry(2.1,.3,.03),blade(txt2));b2.position.y=3.6;g.add(b2);}off(i,sd*(10.4+XW[i]),0,g.position);g.rotation.y=yaw(i);scene.add(g);};
    CROSS.forEach((c,k)=>{flatAt(c,0,0,13,110,asph,.022,Math.PI/2);for(const d of[-9.5,9.5]){for(let q=-5;q<=5;q++)flatAt(c,d,q*1.25,.7,3.2,yel,.034);}
      for(const sd of[-1,1])for(let q=-3;q<=3;q++)flatAt(c,q*1.6,sd*(13+XW[c]),.7,3.4,yel,.034,Math.PI/2);
      flatAt(c,-12.5,-(RW+XW[c])/2,RW+XW[c],.45,wln,.036,0);const pt=flatAt(c,-16,-(RW+XW[c])/2,3.4,1.7,paintM,.037,Math.PI);
      for(const[dd,sd]of[[-11,-1],[11,1]]){const s=new THREE.Group();B(.07,2.4,.07,steelM,0,1.2,0,0,s);const pl=new THREE.Mesh(new THREE.PlaneGeometry(.8,.8),stopM);pl.position.set(0,2.5,.05);s.add(pl);at(c*SEG+dd,sd*(9.6+XW[c]),0,s.position);s.rotation.y=yaw(c)+(sd<0?Math.PI:0);scene.add(s);}
      corner(c+6,'PARU ST',NAMES[k]);});
    const NAMES2=['OAK ST','WALNUT ST','WILLOW ST','CHESTNUT ST','BAY ST','MORTON ST','SHERMAN ST','WOOD ST'];   // the cross streets on Central Ave: the same paint and signs, a shorter stub each side between the shops
    CROSS2.forEach((c,k)=>{flatAt(c,0,0,13,70,asph,.022,Math.PI/2);for(const d of[-9.5,9.5]){for(let q=-5;q<=5;q++)flatAt(c,d,q*1.25,.7,3.2,yel,.034);}
      for(const sd of[-1,1])for(let q=-3;q<=3;q++)flatAt(c,q*1.6,sd*(13+XW[c]),.7,3.4,yel,.034,Math.PI/2);flatAt(c,-12.5,-(RW+XW[c])/2,RW+XW[c],.45,wln,.036,0);
      for(const[dd,sd]of[[-11,-1],[11,1]]){const s=new THREE.Group();B(.07,2.4,.07,steelM,0,1.2,0,0,s);const pl=new THREE.Mesh(new THREE.PlaneGeometry(.8,.8),stopM);pl.position.set(0,2.5,.05);s.add(pl);at(c*SEG+dd,sd*(9.6+XW[c]),0,s.position);s.rotation.y=yaw(c)+(sd<0?Math.PI:0);scene.add(s);}
      corner(c+6,'CENTRAL AVE',NAMES2[k%NAMES2.length]);});
    // San Francisco: the cross streets off to the left of the downtown street, each laid in short pieces that follow the ground, with a centre line, a stop line, a stop sign and a street sign
    const NAMES3=['FREMONT ST','FIRST ST','SECOND ST','THIRD ST','FOURTH ST','FIFTH ST'];
    SFX.forEach((c,k)=>{const e=RW+XW[c];for(let q=0;q<12;q++){const la=e-.5+q*12+6,o=flatAt(c,0,la,13,12.4,asph,.03,Math.PI/2);const gy=groundAt(o.position.x,o.position.z);if(gy>o.position.y)o.position.y=gy+.03;
        if(q>0){const y=flatAt(c,0,la,.16,3.4,yel,.05,Math.PI/2);y.position.y=o.position.y+.02;}}
      flatAt(c,0,e+2.5,13,.45,wln,.04,Math.PI/2);
      {const s=new THREE.Group();B(.07,2.4,.07,steelM,0,1.2,0,0,s);const pl=new THREE.Mesh(new THREE.PlaneGeometry(.8,.8),stopM);pl.position.set(0,2.5,.05);s.add(pl);at(c*SEG-8,e+3.2,0,s.position);s.rotation.y=yaw(c)-Math.PI/2;scene.add(s);}
      corner(c+5,'HARRISON ST',NAMES3[k%NAMES3.length],1);});
    corner(Z.central-4,'CENTRAL AVE','SAN ANTONIO AVE');
    // the crossroads at the two corners: both streets carry straight on past the junction, the whole junction is paved, and the outside of the turn is open,
    // so the corner can be taken wide across the junction instead of along a walled curve
    for(const J of JN){const{c,i0,os}=J,a0=T[i0],b0=T[c],W1=RW+XW[i0],W2=RW+XW[c],L=150,v2=(x,z)=>new THREE.Vector2(x,z);
      const n1=v2(Nn[i0].x*os,Nn[i0].z*os),n2=v2(Nn[c].x*os,Nn[c].z*os),d=v2(P[c].x-P[i0].x,P[c].z-P[i0].z),det=a0.x*b0.z-a0.z*b0.x,s=(d.x*b0.z-d.y*b0.x)/det,u=(a0.x*d.y-a0.z*d.x)/det;
      const V=v2(P[i0].x+a0.x*s,P[i0].z+a0.z*s),Vo=V.clone().addScaledVector(n1,W1).addScaledVector(n2,W2);J.Vo=Vo;J.n1=n1;J.n2=n2;
      const sh=new THREE.Shape();for(let i=i0;i<=c;i++){const w=(RW+XW[i])*os;const x=P[i].x+Nn[i].x*w,z=P[i].z+Nn[i].z*w;i===i0?sh.moveTo(x,-z):sh.lineTo(x,-z);}sh.lineTo(Vo.x,-Vo.y);
      const fillM=new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(-Math.PI/2),std({color:0x4a4b4e,roughness:.85,side:THREE.DoubleSide}));fillM.position.y=.018;fillM.receiveShadow=true;scene.add(fillM);
      // a flat strip of length l along direction dir from point p, offset sideways by off, w wide, at height y (a box when h is given)
      const strip=(p,dir,l,off,w,mm,y,h)=>{const nx=dir.z,nz=-dir.x,o=new THREE.Mesh(h?new THREE.BoxGeometry(w,h,l):new THREE.PlaneGeometry(w,l).rotateX(-Math.PI/2),mm);
        o.position.set(p.x+dir.x*l/2+nx*off,y,p.y+dir.z*l/2+nz*off);o.rotation.y=Math.atan2(dir.x,dir.z);o.receiveShadow=true;if(h)o.castShadow=true;scene.add(o);return o;};
      const sgn=(dir,n)=>Math.sign(dir.z*n.x-dir.x*n.y)||1;   // which way the strip's left side faces relative to n
      const A=v2(a0.x,a0.z),st1=V.clone().addScaledVector(A,W2),st2=V.clone().addScaledVector(v2(b0.x,b0.z),-W1),bk=v2(-b0.x,-b0.z),bkd={x:-b0.x,z:-b0.z};
      strip(st1,a0,L,0,2*W1,asph,.018);strip(st2,bkd,L,0,2*W2,asph,.018);                                         // the streets carrying on: ahead past the turn, and back the other way
      for(const sd of[-1,1]){strip(st1.clone().addScaledVector(A,-3),a0,L+3,sd*(W1+1.5),3,side,.065,.13);strip(st2.clone().addScaledVector(bk,-3),bkd,L+3,sd*(W2+1.5),3,side,.065,.13);}   // their pavements
      const pi0=v2(P[i0].x,P[i0].z),pc=v2(P[c].x,P[c].z);
      strip(pi0,a0,Math.max(1,s-W2+3),sgn(a0,n1)*(W1+1.5),3,side,.065,.13);                                        // the pavement along the outside of each street, up to the junction
      strip(pc,bkd,Math.max(1,u-W1+3),sgn(bkd,n2)*(W2+1.5),3,side,.065,.13);
      for(const[p,dir,W]of[[st1,a0,W1],[st2,bkd,W2]])for(let q=-Math.floor(W/1.25);q<=Math.floor(W/1.25);q++)strip(p.clone().addScaledVector(v2(dir.x,dir.z),.6).addScaledVector(v2(dir.z,-dir.x),q*1.25),dir,3.2,0,.7,yel,.034);   // yellow ladder crosswalks across each mouth
      const sg=new THREE.Group();B(.08,3.4,.08,steelM,0,1.7,0,0,sg);for(const[k,ry]of[[0,0],[1,Math.PI/2]]){const bl=new THREE.Mesh(new THREE.BoxGeometry(2.1,.3,.03),blade(J.name[k]));bl.position.y=3.25+k*.35;bl.rotation.y=ry;sg.add(bl);}
      const sp=Vo.clone().addScaledVector(n1,1.6).addScaledVector(n2,1.6);sg.position.set(sp.x,0,sp.y);sg.rotation.y=Math.atan2(a0.x,a0.z);scene.add(sg);OBST.push({x:sp.x,z:sp.y,r:.4});   // street-name blades on the far corner
      // the walls: on the outside of the turn they stand at the far edge of the junction, everywhere through the corner
      for(let i=i0-4;i<=c+4;i++){const no=v2(Nn[i].x*os,Nn[i].z*os),q=v2(Vo.x-P[i].x,Vo.y-P[i].z);let t=40;for(const nk of[n1,n2]){const dn=no.dot(nk);if(dn>.05)t=Math.min(t,q.dot(nk)/dn);}
        const ow=Math.max(wallAt[i],t-1.1);if(os>0){if(!wallR[i])wallR[i]=wallAt[i];wallAt[i]=ow;}else wallR[i]=ow;edgeAt[i]=Math.max(edgeAt[i],ow+.5);}}corner(Z.wilma+m(30),'WILMA CHAN WAY');corner(Z.bv+16,'GRAND ST','BUENA VISTA AVE');corner(Z.start+7,'SAN ANTONIO AVE');
    const mb=new THREE.Group();B(.22,.24,.46,steelM,0,1.1,0,0,mb);B(.07,1,.07,wood,0,.5,0,0,mb);off(Z.start-2,-(12+XW[Z.start]),0,mb.position);scene.add(mb);}
  { // ---- the Alameda Theatre on Central: tall art-deco front, a vertical blade sign, a marquee; and the Fuzzy Caterpillar billboard over the road
    const q=Z.central+m(190),th=new THREE.Group(),fc=mat('deco',{color:0xd9c9a8,roughness:.85}),gold=mat('gold',{color:0xc9a03a,roughness:.5,metalness:.4});
    B(24,15,16,fc,0,7.5,0,0,th);B(10,6,16,fc,0,18,-1,0,th);B(4,4,12,fc,0,23,-2,0,th);for(const x of[-9,-3,3,9])B(.6,15,.5,gold,x,7.5,8.05,0,th);
    const mq=new THREE.Mesh(new THREE.BoxGeometry(16,1.6,3.4),new THREE.MeshBasicMaterial({map:canvas(512,64,(c)=>{c.fillStyle='#f4eede';c.fillRect(0,0,512,64);c.fillStyle='#b3241c';c.font='900 32px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText('NOW SHOWING  ·  LE MANS',256,34);})}));mq.position.set(0,4.4,9.6);th.add(mq);
    const vs=new THREE.Mesh(new THREE.BoxGeometry(2.4,19,.9),new THREE.MeshBasicMaterial({map:canvas(96,640,(c)=>{c.fillStyle='#7a1512';c.fillRect(0,0,96,640);c.fillStyle='#ffd27a';c.font='900 64px Arial Black,Arial';c.textAlign='center';'ALAMEDA'.split('').forEach((ch,k)=>c.fillText(ch,48,82+k*84));})}));vs.position.set(-6,15,9.2);th.add(vs);
    const zig=new THREE.Mesh(new THREE.ConeGeometry(1.4,4,4),gold);zig.position.set(-6,26.5,9.2);th.add(zig);
    th.traverse(o=>{o.castShadow=true;});off(q,-(19+XW[q]),0,th.position);th.rotation.y=faceRoad(q,-1);scene.add(th);
    for(let k=0;k<80;k++){const i=q+m(2+k*.75),p=mkPerson(R(.9,1.05));at(i*SEG+R(-.15,.15),-(8.3+XW[i])+R(-.3,.3),.13,p.position);p.rotation.y=yaw(i)+Math.PI+R(-.4,.4);if(k%5===2)p.legs[0].rotation.x=.25;scene.add(p);}   // the queue for the picture, along the pavement from the box office
    const bt=canvas(1024,460,(g,w,h)=>{const sky=g.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#bfe3f2');sky.addColorStop(1,'#e9f5d8');g.fillStyle=sky;g.fillRect(0,0,w,h);
      g.fillStyle='#5fa544';g.beginPath();g.ellipse(520,480,640,150,0,0,7);g.fill();g.fillStyle='#4a8a38';g.beginPath();g.ellipse(330,290,330,74,-.12,0,7);g.fill();
      for(let k=0;k<8;k++){const x=120+k*52,y=226-Math.sin(k*.9)*20,r=k?34:26;g.fillStyle=k%2?'#58b548':'#e6ef5a';g.beginPath();g.arc(x,y,r,0,7);g.fill();g.fillStyle='#1c1c1c';g.fillRect(x-10,y+r-4,6,16);g.fillRect(x+6,y+r-4,6,16);}
      const hx=536,hy=200;g.fillStyle='#f0c23a';g.beginPath();g.arc(hx,hy,46,0,7);g.fill();g.fillStyle='#fff';for(const dx of[-15,15]){g.beginPath();g.arc(hx+dx,hy-8,11,0,7);g.fill();}g.fillStyle='#1c1c1c';for(const dx of[-13,17]){g.beginPath();g.arc(hx+dx,hy-7,5,0,7);g.fill();}
      g.strokeStyle='#1c1c1c';g.lineWidth=4;g.beginPath();g.arc(hx,hy+4,26,.2,2.94);g.stroke();
      g.font='96px Chewy,"Comic Sans MS",cursive';g.textAlign='center';g.lineJoin='round';g.strokeStyle='#fffdf2';g.lineWidth=14;g.strokeText('Fuzzy Caterpillar School',w/2,412,960);g.fillStyle='#22407a';g.fillText('Fuzzy Caterpillar School',w/2,412,960);g.strokeStyle='#1c2a4a';g.lineWidth=16;g.strokeRect(8,8,w-16,h-16);});
    const i=Z.central+m(320),bb=new THREE.Group(),fm=new THREE.MeshStandardMaterial({map:bt,roughness:.7,emissiveMap:bt,emissive:0xffffff,emissiveIntensity:.25});const bd=new THREE.Mesh(new THREE.BoxGeometry(28,12.6,.4),[steelM,steelM,steelM,steelM,fm,steelM]);bd.position.y=13.6;bb.add(bd);
    for(const x of[-12.6,12.6])B(.7,8,.7,steelM,x,4,-.3,0,bb);bb.traverse(o=>{o.castShadow=true;});{const gm=std({color:0x7ccf3a,roughness:1}),cs=[];for(let k=0;k<9;k++){const sp=new THREE.Mesh(new THREE.SphereGeometry(k===8?1.15:.95,10,8),k%2?gm:std({color:0x4fa02a,roughness:1}));bb.add(sp);cs.push(sp);}
      const hd=cs[8];for(const sx of[-.4,.4]){const e=new THREE.Mesh(new THREE.SphereGeometry(.28,8,6),std({color:0xffffff}));e.position.set(sx,.3,.9);hd.add(e);const pu=new THREE.Mesh(new THREE.SphereGeometry(.13,6,5),std({color:0x111111}));pu.position.set(sx,.3,1.1);hd.add(pu);}
      const arm=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,1.6,5).translate(0,.8,0),gm);arm.position.set(1,-.2,0);hd.add(arm);ALM.cat={cs,arm};}
    off(i,0,0,bb.position);bb.rotation.y=yaw(i)+Math.PI;scene.add(bb);}
  { // ---- a huge billboard before the Bay Bridge: a stern three-eyed man, monochrome torn paper, "DOG MOAT HAS A POSSE", one little yellow sticker
    const bt=canvas(1024,512,(g,w,h)=>{g.fillStyle='#cfcac0';g.fillRect(0,0,w,h);
      for(let k=0;k<7;k++){const x=rr(0,w-200),y=rr(0,h-160),pw=rr(220,520),ph=rr(120,300),v=Math.floor(rr(150,235));g.fillStyle=`rgb(${v},${v-3},${v-10})`;g.beginPath();g.moveTo(x,y);for(let q=1;q<=10;q++)g.lineTo(x+pw*q/10,y+rr(-9,9));for(let q=1;q<=8;q++)g.lineTo(x+pw+rr(-9,9),y+ph*q/8);for(let q=9;q>=0;q--)g.lineTo(x+pw*q/10,y+ph+rr(-9,9));for(let q=7;q>=0;q--)g.lineTo(x+rr(-9,9),y+ph*q/8);g.fill();}   // torn-paper layers
      g.fillStyle='#262626';g.beginPath();g.ellipse(300,250,150,185,0,0,7);g.fill();   // the head
      g.fillStyle='#d9d6cd';g.beginPath();g.ellipse(300,262,122,160,0,0,7);g.fill();
      g.fillStyle='#262626';g.beginPath();g.moveTo(170,170);g.quadraticCurveTo(300,40,430,170);g.quadraticCurveTo(300,110,170,170);g.fill();   // cropped hair
      g.lineWidth=14;g.strokeStyle='#161616';g.lineCap='round';g.beginPath();g.moveTo(205,215);g.lineTo(282,235);g.moveTo(395,215);g.lineTo(318,235);g.stroke();   // heavy, angry brows
      for(const[ex,ey,er]of[[245,262,20],[355,262,20],[300,170,17]]){g.fillStyle='#f4f2ea';g.beginPath();g.ellipse(ex,ey,er*1.3,er*.8,0,0,7);g.fill();g.fillStyle='#111';g.beginPath();g.arc(ex,ey,er*.5,0,7);g.fill();g.strokeStyle='#111';g.lineWidth=4;g.stroke();}   // two eyes and the third on the forehead
      g.strokeStyle='#161616';g.lineWidth=8;g.beginPath();g.moveTo(300,275);g.lineTo(288,345);g.lineTo(312,347);g.stroke();g.lineWidth=11;g.beginPath();g.moveTo(255,395);g.lineTo(345,395);g.stroke();   // nose and a flat, stern mouth
      g.fillStyle='rgba(0,0,0,.25)';for(let k=0;k<160;k++)g.fillRect(rr(190,410),rr(130,400),2,2);
      g.fillStyle='#161616';g.fillRect(500,80,470,310);g.fillStyle='#e6e3da';g.font='900 100px Impact,"Arial Black",Arial';g.textAlign='left';g.textBaseline='alphabetic';g.fillText('DOG MOAT',520,180,430);g.fillText('HAS A',520,282,430);g.fillText('POSSE',520,382,430);   // headline
      g.fillStyle='#f2d11a';g.beginPath();g.arc(930,440,40,0,7);g.fill();g.strokeStyle='#161616';g.lineWidth=3;g.stroke();g.fillStyle='#161616';g.font='900 20px Arial';g.textAlign='center';g.fillText('JOIN',930,436);g.fillText('US',930,458);   // small yellow sticker
      g.strokeStyle='#161616';g.lineWidth=10;g.strokeRect(5,5,w-10,h-10);});
    const q=Z.b0-m(170),bb=new THREE.Group(),fm=new THREE.MeshStandardMaterial({map:bt,roughness:.75,emissiveMap:bt,emissive:0xffffff,emissiveIntensity:.3});
    const bd=new THREE.Mesh(new THREE.BoxGeometry(44,22,.6),[steelM,steelM,steelM,steelM,fm,steelM]);bd.position.y=20;bb.add(bd);
    for(const x of[-15,15])B(1,12,1,steelM,x,6,-.5,0,bb);bb.traverse(o=>{o.castShadow=true;});
    off(q,-(26+XW[q]),0,bb.position);bb.rotation.y=yaw(q)+Math.PI;scene.add(bb);}
  { // ---- telephone poles down San Antonio and Paru, wires strung between them, and crows sitting on the crossarms
    const wd=std({color:0x4a3a2c,roughness:.9}),crowM=std({color:0x101013,roughness:.45,metalness:.15}),bk=std({color:0x2a2a2e,roughness:.5}),wire=new THREE.MeshBasicMaterial({color:0x151515,side:D2}),ids=[];
    // a crow: glossy black body, head, heavy beak, wedge tail, legs, and two wings on hinges so it can fold them or fly. Each one is its own object (CROWS) so it can take off.
    const cBody=new THREE.SphereGeometry(.19,12,9),cHead=new THREE.SphereGeometry(.1,10,8),cBeak=new THREE.ConeGeometry(.035,.17,6).rotateX(Math.PI/2),cTail=new THREE.BoxGeometry(.14,.03,.3),cWing=new THREE.BoxGeometry(.36,.025,.4).translate(.18,0,0),cLeg=cyl(.008,.008,.12,4);
    const crow=(pos,ry)=>{const g=new THREE.Group(),M=(geo,mm,x,y,z)=>{const o=new THREE.Mesh(geo,mm);o.position.set(x,y,z);g.add(o);return o;};
      M(cBody,crowM,0,.22,0).scale.set(.85,.9,1.5);const hd=new THREE.Group();hd.position.set(0,.38,.2);g.add(hd);hd.add(new THREE.Mesh(cHead,crowM));const bb=new THREE.Mesh(cBeak,bk);bb.position.set(0,-.01,.13);hd.add(bb);
      M(cTail,crowM,0,.17,-.34).rotation.x=.4;for(const s of[-1,1])M(cLeg,bk,s*.05,.06,.02);
      const wings=[-1,1].map(s=>{const p=new THREE.Group();p.position.set(s*.12,.28,.02);p.scale.x=s;p.add(new THREE.Mesh(cWing,crowM));p.rotation.z=-1.35;g.add(p);return p;});
      g.scale.setScalar(1.25);g.position.copy(pos);g.rotation.y=ry;scene.add(g);CROWS.push({g,hd,wings,h:pos.clone(),ry,st:0,t:R(0,3),hy:0,v:new THREE.Vector3(),dl:0});};
    for(let i=Z.start-9;i<Z.central-m(30);i+=15){if(nearCross(i,m(12))||curved(i)||curved(i+8)||curved(i-8))continue;ids.push(i);}
    ids.forEach((i,n)=>{const g=new THREE.Group(),A=(geo,mm,x,y,z)=>{const o=new THREE.Mesh(geo,mm);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
      A(cyl(.12,.16,9.6,8),wd,0,4.8,0);A(new THREE.BoxGeometry(2.7,.14,.14),wd,0,8.6,0);A(new THREE.BoxGeometry(1.9,.12,.12),wd,0,7.8,0);
      off(i,-(10.7+XW[i]),0,g.position);g.rotation.y=yaw(i);scene.add(g);g.updateMatrixWorld(true);
      const nc=[4,2,5,3,1,4,3][n%7];for(let c=0;c<nc;c++){const x=(c-(nc-1)/2)*.62+(nc===1?.5:0),f=(n+c)%2?1:-1;crow(new THREE.Vector3(x,8.67,0).applyMatrix4(g.matrixWorld),yaw(i)+(f>0?0:Math.PI)+R(-.4,.4));}});
    for(let k=0;k+1<ids.length;k++)for(const s of[-1.2,1.2]){const a=off(ids[k],-(10.7+XW[ids[k]]),8.68),b=off(ids[k+1],-(10.7+XW[ids[k+1]]),8.68),mid=a.clone().lerp(b,.5);mid.y-=.5;
      const ry=yaw(ids[k]),sh=new THREE.Vector3(Math.cos(ry)*s,0,-Math.sin(ry)*s),cu=new THREE.QuadraticBezierCurve3(a,mid,b);const w=new THREE.Mesh(new THREE.TubeGeometry(cu,8,.025,3,false),wire);w.position.copy(sh);scene.add(w);
      if((k*7+(s>0?3:0))%5<2){const nw=1+(k%3);for(let q=0;q<nw;q++)crow(cu.getPoint(.25+q*.18+((k*13)%7)*.02).add(sh).setY(cu.getPoint(.25+q*.18).y-.05),ry+(s>0?1:-1)*Math.PI/2+R(-.3,.3));}}}   // and a few on the wires, facing the street or away from it

  { // ---- Wilma Chan Way: yellow-flowering hedges, the drive-in on the left with its mission tower and red tiles, the burger on a pole, palms; the road climbs over an ivy-walled overpass
    const c=Z.wilma+m(45),lotM=std({color:0x47484b,roughness:.92,side:D2}),lineM=new THREE.MeshBasicMaterial({color:0xe6e2d2,transparent:true,opacity:.75,polygonOffset:true,polygonOffsetFactor:-3,side:D2});
    ribbon(i=>RW+XW[i]-.1,40,.03,.03,lotM,8,c-m(32),c+m(32));for(let i=c-m(28);i<=c+m(28);i+=2){if(Math.abs(i-c)<m(14))continue;const l=new THREE.Mesh(new THREE.PlaneGeometry(.14,5.2).rotateX(-Math.PI/2),lineM);off(i,32,.05,l.position);l.rotation.y=yaw(i)+Math.PI/2;scene.add(l);}
    const g=new THREE.Group(),rot=faceRoad(c,1),stucco=std({color:0xf2ede2,roughness:.9}),tileRed=std({color:0xa8402a,roughness:.75}),red=std({color:0xc32a22,roughness:.6}),wht=std({color:0xf6f3ea,roughness:.7});
    const A=(geo,mm,x,y,z)=>{const o=new THREE.Mesh(geo,mm);o.position.set(x,y,z);g.add(o);return o;},bx=(a,b,c2)=>new THREE.BoxGeometry(a,b,c2);
    A(bx(24,5.6,12),stucco,0,2.8,0);const rf=A(new THREE.CylinderGeometry(.01,13.6,3.4,4,1),tileRed,0,7.3,0);rf.rotation.y=Math.PI/4;rf.scale.set(1.25,1,.62);
    A(bx(5.6,13,5.6),stucco,-8.5,6.5,1);const tr=A(new THREE.ConeGeometry(4.4,3.4,4),tileRed,-8.5,14.7,1);tr.rotation.y=Math.PI/4;for(const z of[3.9])for(const y of[9.5,11.4])A(bx(1.1,1.4,.1),mat('glass',{color:0x1d262b,roughness:.1,metalness:.4}),-8.5,y,z);
    for(let k=0;k<5;k++){A(bx(2.2,2.6,.1),mat('glass',{color:0x1d262b,roughness:.1,metalness:.4}),-2+k*4,2.3,6.03);A(new THREE.CylinderGeometry(1.1,1.1,.12,12,1,false,0,Math.PI),stucco,-2+k*4,3.6,6.08).rotation.set(Math.PI/2,0,Math.PI/2);}
    const st=canvas(1024,220,(k,w,h)=>{k.fillStyle='#c32a22';k.fillRect(0,0,w,h);k.strokeStyle='#f6f3ea';k.lineWidth=10;k.strokeRect(10,10,w-20,h-20);k.fillStyle='#f6f3ea';k.textAlign='center';k.font='900 120px Georgia';k.fillText('OUT AND IN',400,150);k.fillStyle='#f2c230';k.font='900 84px Georgia';k.fillText('BURGER',820,146,330);});
    A(bx(14,3,.35),std({map:st,emissiveMap:st,emissive:0xffffff,emissiveIntensity:.45,roughness:.6}),3,6.9,6.2);
    {const bx0=11,bz0=9,by=9.2,s=1.25,P2=(geo,mm,y)=>{const o=A(geo,mm,bx0,by+y*s,bz0);o.scale.multiplyScalar(s);return o;};
      A(cyl(.3,.4,by,12),wht,bx0,by/2,bz0);P2(cyl(2.7,2.5,.8,24),std({color:0xd9a45a,roughness:.8}),.4);P2(cyl(2.85,2.85,.55,24),std({color:0x5a3220,roughness:.9}),1.07);P2(bx(5.1,.12,5.1),std({color:0xf2c230,roughness:.6}),1.41).rotation.y=.5;
      P2(cyl(3,3,.22,14),std({color:0x5fa544,roughness:.9}),1.59);P2(cyl(2.6,2.6,.24,24),std({color:0xc8302a,roughness:.6}),1.82);const bun=P2(new THREE.SphereGeometry(2.75,24,12,0,6.283,0,1.5708),std({color:0xd9a45a,roughness:.75}),1.93);bun.scale.y*=.72;}
    for(let k=0;k<3;k++){A(cyl(.9,.9,.08,12),wht,-1+k*3.6,.78,9.6);A(cyl(.06,.06,2.4,6),steelM,-1+k*3.6,1.2,9.6);A(new THREE.ConeGeometry(1.5,.7,10),k%2?red:wht,-1+k*3.6,2.6,9.6);}
    g.traverse(o=>{o.castShadow=o.receiveShadow=true;});off(c,78,0,g.position);g.position.y+=12;g.rotation.y=rot;scene.add(g);   // up on a hill, far back from the road
    const ob=(x,z,r)=>{V.set(x,0,z).applyAxisAngle(YAX,rot).add(g.position);OBST.push({x:V.x,z:V.z,r});};for(const x of[-8,0,8])ob(x,0,7);ob(11,9,.7);
    const bush=new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,7),std({roughness:1,color:0xffffff}),260);let k=0;
    for(let i=Z.wilma+4;i<Z.tu0-m(130)&&k<260;i+=3)for(const sd of[-1,1]){if(sd>0&&Math.abs(i-c)<m(40))continue;if(k>=260)break;gpos(i,sd*rr(10.5,15)+sd*XW[i],V);M4.compose(V,Q.identity(),S.set(rr(1.4,2.4),rr(.9,1.5),rr(1.4,2.4)));bush.setMatrixAt(k,M4);bush.setColorAt(k++,C.setHex(rnd()<.45?0xd9c23a:pick([0x3f6a34,0x4f7a3a,0x5a7a2f])));}
    bush.count=k;bush.castShadow=true;scene.add(bush);
    const lp=new THREE.InstancedMesh(new THREE.BoxGeometry(.25,11,.25),steelM,60),lh=new THREE.InstancedMesh(new THREE.BoxGeometry(1.6,.25,.5),lampMat,60);k=0;
    for(let i=Z.wilma+m(20);i<Z.tu0-60&&k<60;i+=m(40)){const sd=k%2?1:-1;off(i,sd*(9.1+XW[i]),5.5,V);M4.compose(V,Q.setFromAxisAngle(YAX,yaw(i)),S.set(1,1,1));lp.setMatrixAt(k,M4);off(i,sd*(8.3+XW[i]),11,V);M4.compose(V,Q,S);lh.setMatrixAt(k++,M4);}lp.count=lh.count=k;scene.add(lp,lh);
    const t=canvas(512,300,(kk,w,h)=>{kk.fillStyle='#f6f3ea';kk.fillRect(0,0,w,h);kk.strokeStyle='#c32a22';kk.lineWidth=12;kk.strokeRect(10,10,w-20,h-20);kk.fillStyle='#c32a22';kk.textAlign='center';kk.font='900 74px Georgia';kk.fillText('OUT AND IN',256,100);
      kk.fillStyle='#f2a21e';kk.font='900 58px Georgia';kk.fillText('BURGER',256,162);kk.fillStyle='#2a2a2a';kk.font='700 30px Arial';kk.fillText('WILMA CHAN WAY',256,214);kk.font='900 40px Arial';kk.fillText('NEXT LEFT  ↖',256,266);});
    board(Z.central+m(420),13.6+XW[Z.central+m(420)],6.4,3.75,t);}
if(DRIVE){ // ---- Alameda scenery: the hill and driveway to the burger, eucalyptus and bushes and a plough team on Wilma Chan Way, turn arrows, wind-blown wildflowers, wildlife
  const tv=new THREE.Vector3(),tq=new THREE.Quaternion(),tm=new THREE.Matrix4(),ts=new THREE.Vector3(),tc=new THREE.Color(),w0=Z.wilma,wE=Z.tu0-m(160),cB=Z.wilma+m(45),inLot=i=>Math.abs(i-cB)<m(40);
  const hill=new THREE.Mesh(new THREE.CylinderGeometry(16,46,12,24),std({color:0x6a7f3f,roughness:1}));off(cB,78,6,hill.position);scene.add(hill);
  {const N=20,pos=[],idx=[],A=new THREE.Vector3();for(let s=0;s<=N;s++){const lat=11+60*s/N,t=Math.min(1,Math.max(0,(lat-32)/30)),y=12*t*t*(3-2*t)+.09;for(const sg of[-1,1]){off(cB,lat,0,A);pos.push(A.x+T[cB].x*3.5*sg,A.y+y,A.z+T[cB].z*3.5*sg);}}
    for(let s=0;s<N;s++){const a=s*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));gg.setIndex(idx);gg.computeVertexNormals();
    scene.add(new THREE.Mesh(gg,std({color:0x47484b,roughness:.92,side:D2})));}
  // eucalyptus (tall, pale trunks, grey-green crowns) and bushes on the left of Wilma Chan Way
  const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.22,.4,1,6).translate(0,.5,0),std({color:0xb9b2a0,roughness:.95}),60),crown=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),std({roughness:1,color:0xffffff}),60),shr=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),std({roughness:1,color:0xffffff}),140);
  let nt=0,nb=0;for(let i=w0+m(8);i<wE&&nt<60;i+=m(14)){if(inLot(i))continue;gpos(i,rr(17,34),tv);const h=rr(14,21);tm.compose(tv,tq.identity(),ts.set(rr(.8,1.2),h,1));trunk.setMatrixAt(nt,tm);tm.compose(ts.copy(tv).setY(tv.y+h*.78),tq,new THREE.Vector3(rr(2.6,3.4),h*.42,rr(2.6,3.4)));crown.setMatrixAt(nt,tm);crown.setColorAt(nt++,tc.setHex(pick([0x6f8a6a,0x7d9577,0x5f7c5c])));}
  for(let i=w0+m(4);i<wE&&nb<140;i+=m(3.5)){if(inLot(i))continue;gpos(i,rr(15,37),tv);tm.compose(tv,tq.identity(),ts.set(rr(1,2),rr(.7,1.2),rr(1,2)));shr.setMatrixAt(nb,tm);shr.setColorAt(nb++,tc.setHex(pick([0x3f6a34,0x4f7a3a,0x5a7a2f,0x6b8a3a])));}
  trunk.count=crown.count=nt;shr.count=nb;trunk.castShadow=crown.castShadow=true;scene.add(trunk,crown,shr);
  // wind-blown wildflowers and weeds: small cones swayed in the vertex shader by ALM.u
  {const tuft=new THREE.InstancedMesh(new THREE.ConeGeometry(.32,1,4).translate(0,.5,0),std({color:0xffffff,roughness:1,side:D2}),900);
    tuft.material.onBeforeCompile=sh=>{sh.uniforms.uT=ALM.u;sh.vertexShader='uniform float uT;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfloat ph=instanceMatrix[3].x*.7+instanceMatrix[3].z*.5;transformed.x+=sin(uT*2.2+ph)*.28*position.y*position.y;transformed.z+=cos(uT*1.7+ph)*.2*position.y*position.y;');};
    const fl=[0xf2d230,0xe8e8f0,0xd45a9a,0x9a6ad8,0xe8803a,0x8a9a4a,0x9aa860];let n=0;
    for(let i=Z.start+m(20);i<wE&&n<900;i+=m(2.2)){if(zoneArr[i]!==1||curved(i)||nearCross(i,m(12))||inLot(i))continue;const sd=n%2?1:-1,left=i>=w0;for(let q=0;q<2&&n<900;q++){gpos(i,sd*rr(11.6,left?30:16.5),tv);tm.compose(tv,tq.setFromAxisAngle(YAX,rr(0,6.3)),ts.set(rr(.8,1.4),rr(.5,1.3),rr(.8,1.4)));tuft.setMatrixAt(n,tm);tuft.setColorAt(n++,tc.setHex(pick(fl)));}}
    tuft.count=n;scene.add(tuft);}
  {// a convenience store and gas station on the right of Wilma Chan Way before the Posey Tube: a lit shop with a red and yellow band, a canopy with two pumps, a tall price sign (invented brand "QUIK MART")
    const B=(sx,sy,sz,mm,x,y,z,ry=0,par=scene)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mm);o.position.set(x,y,z);o.rotation.y=ry;par.add(o);return o;},i=Z.tu0-m(330),g=new THREE.Group(),asp=std({color:0x3a3b3e,roughness:.95}),wal=std({color:0xe8e4d6,roughness:.85}),stl=std({color:0x9aa0a4,metalness:.6,roughness:.4}),glw=std({color:0x1f2a30,roughness:.1,metalness:.4}),
      lit=(w,h,fn)=>new THREE.MeshBasicMaterial({map:canvas(w,h,fn),side:THREE.DoubleSide});
    off(i,-(RW+XW[i]+20),0,V);g.position.set(V.x,H[i]-.05,V.z);g.rotation.y=yaw(i)+Math.PI/2;   // local +z faces the road
    B(40,.06,30,asp,0,.03,0,0,g);B(18,4.2,9,wal,0,2.1,-9,0,g);B(18.4,.9,9.4,std({color:0xc8241c,roughness:.7}),0,3.9,-9,0,g);B(18.4,.4,9.4,std({color:0xf2c230,roughness:.7}),0,3.35,-9,0,g);B(11,2.4,.1,glw,0,1.6,-4.45,0,g);
    const sg=new THREE.Mesh(new THREE.PlaneGeometry(9,1.5),lit(512,96,(c,w,h)=>{c.fillStyle='#c8241c';c.fillRect(0,0,w,h);c.fillStyle='#f2c230';c.font='900 64px Arial Black,Arial';c.textAlign='center';c.textBaseline='middle';c.fillText('QUIK MART · 24 HRS',w/2,h/2+3,w-20);}));sg.position.set(0,5.4,-4.4);g.add(sg);
    B(18,.4,9,wal,5,5.2,4,0,g);for(const x of[-2,12])for(const z of[1,7])B(.4,5,.4,stl,x,2.5,z,0,g);for(const x of[2,8]){B(.7,1.5,.6,std({color:0xc8241c,roughness:.5}),x,.75,4,0,g);}
    const pm=new THREE.Mesh(new THREE.PlaneGeometry(2.4,3.6),lit(128,192,(c,w,h)=>{c.fillStyle='#1c1c1e';c.fillRect(0,0,w,h);c.fillStyle='#f2c230';c.font='900 26px Arial Black,Arial';c.textAlign='center';c.fillText('QUIK',w/2,34);c.fillStyle='#fff';c.font='900 34px Arial';for(let k=0;k<3;k++)c.fillText(['3.89','4.19','4.49'][k],w/2,84+k*40);}));pm.position.set(-14,8.5,10);g.add(pm);B(.3,7,.3,stl,-14,3.5,10,0,g);
    g.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});scene.add(g);}
  {// the owner's photo billboards (the newest pictures, so the biggest boards, set close to the road and turned towards the oncoming driver): steel legs, a frame, a catwalk and lamps; lit at night
    const TL=new THREE.TextureLoader(),fr=std({color:0x2b2f33,roughness:.5,metalness:.6});
    // a picture cropped to [x,y,w,h] (pixels) on a canvas, small patches painted over with a nearby colour (phone badges)
    const pic=(f,cx,cy,cw,ch,patch=[])=>{const c=document.createElement('canvas');c.width=cw;c.height=ch;const g=c.getContext('2d');g.fillStyle='#222';g.fillRect(0,0,cw,ch);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=ANISO;
      TL.load('assets/billboards/'+f,src=>{g.drawImage(src.image,cx,cy,cw,ch,0,0,cw,ch);for(const[x,y,w,h,sx,sy]of patch){const d=g.getImageData(sx-cx,sy-cy,1,1).data;g.fillStyle=`rgb(${d[0]},${d[1]},${d[2]})`;g.fillRect(x-cx,y-cy,w,h);}t.needsUpdate=true;});return t;};
    const pboard=(i,sd,panels,H=16)=>{const g=new THREE.Group(),gap=1,W=panels.reduce((a,[t,ar])=>a+H*ar,0)+gap*(panels.length-1),y0=4.5;let x=-W/2;
      for(const[t,ar]of panels){const w=H*ar,mm=std({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.55,roughness:.6});B(w,H,.3,[fr,fr,fr,fr,mm,fr],x+w/2,y0+H/2,0,0,g);x+=w+gap;}
      B(W+1.2,.6,.5,fr,0,y0-.3,0,0,g);B(W+1.2,.6,.5,fr,0,y0+H+.3,0,0,g);B(.6,H+1.2,.5,fr,-W/2-.3,y0+H/2,0,0,g);B(.6,H+1.2,.5,fr,W/2+.3,y0+H/2,0,0,g);   // the frame
      B(W+1.2,.15,1.6,steelM,0,y0-.65,.7,0,g);   // catwalk
      const nl=Math.max(2,Math.round(W/5));for(let k=0;k<nl;k++){const lx=-W/2+W*(k+.5)/nl;B(.12,.12,1.8,steelM,lx,y0-.5,1.4,0,g);B(.9,.3,.5,lampMat,lx,y0-.4,2.3,0,g);}   // lamps shining up at the face
      const nleg=W>14?3:2;for(let k=0;k<nleg;k++)B(.9,y0+H*.6,.9,steelM,nleg===2?(k?1:-1)*W*.3:(k-1)*W*.38,(y0+H*.6)/2,-.6,0,g);
      const t=T[i],n=Nn[i],tl=Math.hypot(t.x,t.z)||1;off(i,sd*(RW+XW[i]+8+W*.15),0,g.position);g.rotation.y=Math.atan2(-t.x/tl-sd*.45*n.x,-t.z/tl-sd*.45*n.z);g.traverse(o=>{o.castShadow=true;});scene.add(g);OBST.push({x:g.position.x,z:g.position.z,r:2});return g;};
    const sol=pic('red-poster-soldiers.jpg',0,26,512,614,[[425,26,87,36,506,140],[0,26,34,16,4,140]]),
      gp=pic('good-and-plenty.jpg',22,44,476,596),
      cafe=pic('cafe-con-pan.jpg',30,88,300,468),
      sun=pic('red-sun-poster.jpg',0,68,728,758),
      clown=pic('clown-mask.jpg',0,28,512,612);
    const lead=pic('red-leader-film-poster.jpg',0,0,484,596,[[412,12,66,46,478,90]]),afr=pic('africa-poster.jpg',76,56,328,556),apes=pic('apes-startrek-comic.jpg',0,0,640,640,[[564,514,56,88,628,505]]);
    pboard(Z.tu1+m(2200),-1,[[apes,1]],15);   // I-880, on towards the Bay Bridge
    pboard(Z.berkeley+m(900),-1,[[afr,328/556]],17);   // I-80, past Berkeley
    pboard(Z.emeryville+m(700),1,[[lead,484/596]],18);   // I-80, Emeryville into Oakland
    pboard(Z.tu1+m(450),1,[[sol,512/614]]);   // I-880, out of the Posey Tube
    pboard(Z.i80+m(220),-1,[[gp,476/596]],15);   // I-80 south, off the Richmond bridge
    pboard(Z.oakland+m(600),-1,[[cafe,300/468]],18);   // the last freeway, through Oakland to the Webster Tube: the two biggest
    pboard(Z.oakland+m(1500),1,[[sun,728/758]],18);
    pboard(Z.wt0+m(260),1,[[clown,512/612]],13);}   // out of the Webster Tube into Alameda (on the right, so it no longer stands in Wilma Chan Way)
  {// "OLIVER IS... THE SILVOR SORFER": a few billboards, an art-deco film poster (redrawn: a teal city at night behind a big bald head) on Wilma Chan Way, I-880 and I-80
    const ol=(bg,hl,sk)=>canvas(1024,512,(c,w,h)=>{const gr=c.createLinearGradient(0,0,0,h);gr.addColorStop(0,bg[0]);gr.addColorStop(1,bg[1]);c.fillStyle=gr;c.fillRect(0,0,w,h);
      c.fillStyle='rgba(255,255,230,.12)';for(const x of[560,660,760]){c.beginPath();c.moveTo(x,0);c.lineTo(x-70,h);c.lineTo(x+70,h);c.fill();}   // searchlights
      c.fillStyle=hl;for(const[x,bw,bh]of[[430,70,250],[500,50,330],[780,60,300],[840,80,220],[920,70,280],[980,60,200],[560,40,180]]){c.fillRect(x,h-bh,bw,bh);c.fillStyle='#ffe9a0';for(let yy=h-bh+10;yy<h-10;yy+=18)for(let xx=x+8;xx<x+bw-8;xx+=14)if(Math.random()<.45)c.fillRect(xx,yy,5,7);c.fillStyle=hl;}
      c.fillStyle=hl;c.beginPath();c.moveTo(520,h-330);c.lineTo(525,h-380);c.lineTo(530,h-330);c.fill();   // a spire
      c.fillStyle=sk;c.beginPath();c.ellipse(700,250,118,148,0,0,7);c.fill();c.fillStyle='rgba(0,0,0,.18)';c.beginPath();c.ellipse(730,270,80,128,0,0,7);c.fill();   // the head
      c.strokeStyle='rgba(40,50,50,.55)';c.lineWidth=5;c.beginPath();c.moveTo(584,215);c.quadraticCurveTo(700,150,816,215);c.stroke();   // swim-cap line
      c.fillStyle='#14201f';c.beginPath();c.ellipse(655,262,15,8,0,0,7);c.fill();c.beginPath();c.ellipse(745,262,15,8,0,0,7);c.fill();c.fillStyle='#d8e4dc';c.beginPath();c.arc(659,262,4,0,7);c.fill();c.beginPath();c.arc(749,262,4,0,7);c.fill();
      c.strokeStyle='#14201f';c.lineWidth=4;c.beginPath();c.moveTo(636,236);c.lineTo(672,232);c.moveTo(728,232);c.lineTo(764,236);c.stroke();c.beginPath();c.moveTo(704,270);c.lineTo(698,312);c.lineTo(716,316);c.stroke();c.fillStyle='#4a3030';c.beginPath();c.ellipse(704,350,26,8,0,0,7);c.fill();
      c.fillStyle=sk;c.fillRect(640,370,120,140);
      c.fillStyle='#f4edd2';c.textAlign='left';c.textBaseline='alphabetic';c.font='900 150px Georgia,serif';c.fillText('OLIVER',24,160);c.font='900 44px Arial Black,Arial';c.fillText('IS...',30,236);c.fillText('THE SILVOR',30,292);c.fillText('SORFER',30,348);
      c.fillStyle='#e8c060';c.font='900 26px Georgia,serif';c.fillText('IMPERIAL · WEEK OF OCTOBER · FOR SIX DAYS',30,470,520);});
    board(Z.wilma+m(330),-(12+XW[Z.wilma+m(330)]),9,4.5,ol(['#1f4a48','#0d2424'],'#10302e','#a9c4bc'),0,.35);
    board(Z.tu1+m(720),12+XW[Z.tu1+m(720)],9,4.5,ol(['#3a2c20','#1a120c'],'#2a1c12','#c9b08a'),0,.35);
    board(Z.i80+m(380),-(12+XW[Z.i80+m(380)]),9,4.5,ol(['#2a2a4a','#0e0e22'],'#14143a','#b8bcd4'),0,.35);}
  {// one silver robot standing in the flats beside I-880 (a tall, plain statue facing the road), and one sepia poster of it
    const mt=std({color:0xc9c6bc,roughness:.3,metalness:.85}),vz=std({color:0x0e0d0b,roughness:.2,metalness:.5}),g=new THREE.Group(),Cy=(r1,r2,h,x,y,z,m2=mt)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,12),m2);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
    Cy(.9,1.1,6,-.9,3,0);Cy(.9,1.1,6,.9,3,0);Cy(2.6,2.1,5.5,0,8.8,0);Cy(.65,.75,5.2,-3.1,8.6,0);Cy(.65,.75,5.2,3.1,8.6,0);Cy(.7,.7,1.2,0,12.1,0);Cy(1.5,1.6,2.4,0,13.7,0);const vs=new THREE.Mesh(new THREE.BoxGeometry(2.7,.5,2.4),vz);vs.position.set(0,13.8,.35);g.add(vs);
    const i=Z.tu1+m(1100);off(i,-150,0,V);g.position.copy(V);g.rotation.y=Math.atan2(P[i].x-V.x,P[i].z-V.z);scene.add(g);
    const kp=canvas(1024,512,(c,w,h)=>{c.fillStyle='#2a241c';c.fillRect(0,0,w,h);const gr=c.createRadialGradient(700,200,40,700,260,420);gr.addColorStop(0,'#d8c9a0');gr.addColorStop(1,'#3a2e20');c.fillStyle=gr;c.fillRect(0,0,w,h);
      const sv=c.createLinearGradient(620,0,780,0);sv.addColorStop(0,'#6a675f');sv.addColorStop(.5,'#ece9de');sv.addColorStop(1,'#5a574f');c.fillStyle=sv;c.beginPath();c.ellipse(700,90,48,54,0,0,7);c.fill();c.fillStyle='#12100c';c.fillRect(656,76,88,16);c.fillStyle=sv;c.fillRect(670,138,60,26);c.beginPath();c.roundRect(620,160,160,170,26);c.fill();c.fillRect(580,170,36,150);c.fillRect(784,170,36,150);c.fillRect(640,326,56,170);c.fillRect(704,326,56,170);
      c.fillStyle='#e8dcc0';c.textAlign='left';c.font='900 96px Georgia,serif';c.fillText('KLAATU',40,150);c.fillText('BARADA',40,260);c.fillText('NIKTO',40,370);c.font='700 30px Georgia,serif';c.fillText('THE ROBOT IS WAITING',44,440);});
    board(Z.tu1+m(980),12+XW[Z.tu1+m(980)],9,4.5,kp,0,.35);}
  {// one recruiting-poster billboard: a bespectacled chimp in a leather jacket points at you, "GO APE!" (invented sponsor "APE CORPS")
    const ap=canvas(1024,512,(c,w,h)=>{c.fillStyle='#b9ccd8';c.fillRect(0,0,w,h);c.fillStyle='#f4f1e8';c.fillRect(12,12,w-24,h-24);c.fillStyle='#b9ccd8';c.fillRect(24,24,w-48,h-48);
      c.fillStyle='#1f4a7a';c.fillRect(60,36,300,64);c.fillStyle='#f4f1e8';c.font='900 40px Arial Black,Arial';c.textAlign='center';c.fillText('APE CORPS',210,82);
      const tx=(t,x,y,sz,al='left')=>{c.textAlign=al;c.font='900 '+sz+'px Impact,"Arial Black",Arial';c.lineWidth=8;c.strokeStyle='#1f4a7a';c.strokeText(t,x,y);c.fillStyle='#d8472a';c.fillText(t,x,y);};
      tx('WANTS YOU',60,170,58);tx('TO...',60,232,58);tx('GO APE!',40,470,150);
      c.fillStyle='#2a2a2c';c.beginPath();c.ellipse(700,430,210,150,0,Math.PI,0);c.fill();c.fillStyle='#6a3a1e';c.fillRect(740,360,26,150);   // the jacket and a strap
      c.fillStyle='#2a2a2a';c.beginPath();c.ellipse(700,215,115,130,0,0,7);c.fill();c.fillStyle='#b8845c';c.beginPath();c.ellipse(700,240,78,92,0,0,7);c.fill();c.beginPath();c.ellipse(590,225,26,32,0,0,7);c.ellipse(810,225,26,32,0,0,7);c.fill();   // fur, face, ears
      c.fillStyle='#a07048';c.beginPath();c.ellipse(700,290,36,30,0,0,7);c.fill();c.fillStyle='#2a1a10';c.beginPath();c.ellipse(690,278,5,4,0,0,7);c.ellipse(712,278,5,4,0,0,7);c.fill();c.fillRect(680,308,40,4);
      c.strokeStyle='#5a3a24';c.lineWidth=6;for(const x of[656,744]){c.beginPath();c.arc(x,232,30,0,7);c.stroke();}c.beginPath();c.moveTo(686,230);c.lineTo(714,230);c.stroke();c.fillStyle='#5a8ac8';for(const x of[656,744]){c.beginPath();c.arc(x,232,8,0,7);c.fill();}
      c.fillStyle='#161618';c.beginPath();c.ellipse(560,360,70,84,-.3,0,7);c.fill();c.beginPath();c.ellipse(540,300,26,52,-.1,0,7);c.fill();   // a big gloved hand, finger pointing at you
    });
    board(Z.i80+m(800),12+XW[Z.i80+m(800)],9,4.5,ap,0,.35);}
  // turn arrows: a yellow board before each corner, on the side the road bends to
  {const arrow=(d)=>canvas(256,256,(g,w,h)=>{g.fillStyle='#f2c230';g.fillRect(0,0,w,h);g.strokeStyle='#111';g.lineWidth=12;g.strokeRect(10,10,w-20,h-20);g.fillStyle='#111';g.beginPath();g.moveTo(w/2+d*86,h/2);g.lineTo(w/2+d*8,h/2-76);g.lineTo(w/2+d*8,h/2-30);g.lineTo(w/2-d*86,h/2-30);g.lineTo(w/2-d*86,h/2+30);g.lineTo(w/2+d*8,h/2+30);g.lineTo(w/2+d*8,h/2+76);g.closePath();g.fill();});
    // dir +1 = left turn (sign on the left, +lat); the board faces back along the road, so its canvas is drawn mirrored (left turn = arrow pointing +x on the canvas)
    for(const[mk,arc,dir]of[[Z.wilma,WR*1.222,-1]]){const i=mk-m(arc+45);board(i,dir*(11.8+XW[i]),3,3,arrow(dir),0,.4);}}
  {// vintage public-information posters (yellow paper, black and red lettering, red-ringed hazard icon), some scrawled over near the Posey Tube; and family names as tags and small shop/house signs
    const PL=[['BOOBY TRAPS','CAN KILL','wire'],['CHECK FOR','LOOSE WIRES · STRANGE OBJECTS','obj'],['DON\'T','HESITATE','tri'],['DON\'T END UP AS','A BOOBY PRIZE','car'],['REMINDER: STAY ALERT','DON\'T SWITCH OFF — OFF DUTY','tri'],['CHECK EVERY TIME','LOOSE WIRES · FISHING LINE','wire']];
    const GC=['#f4f1e8','#c8ccd2','#d4af37','#111'];
    const poster=(v,gr)=>{const[a,b,ic]=PL[v%PL.length];let s=v*131+7;const q=()=>(s=(s*16807)%2147483647)/2147483647;return canvas(512,384,(g,w,h)=>{g.fillStyle='#f0d25a';g.fillRect(0,0,w,h);g.strokeStyle='#1a1410';g.lineWidth=14;g.strokeRect(7,7,w-14,h-14);g.strokeStyle='#c32a22';g.lineWidth=4;g.strokeRect(24,24,w-48,h-48);
      g.textAlign='center';g.textBaseline='middle';g.fillStyle='#c32a22';g.font='900 '+(a.length>12?44:62)+'px Impact,"Arial Black",Arial';g.fillText(a,w/2,70,w-70);g.fillStyle='#1a1410';g.font='900 '+(b.length>14?27:50)+'px Impact,"Arial Black",Arial';g.fillText(b,w/2,318,w-70);
      const cx=w/2,cy=190;g.fillStyle='#f7e9b0';g.beginPath();g.arc(cx,cy,78,0,7);g.fill();g.strokeStyle='#c32a22';g.lineWidth=12;g.stroke();g.strokeStyle='#1a1410';g.fillStyle='#1a1410';g.lineWidth=6;g.lineCap='round';g.lineJoin='round';
      if(ic==='wire'){g.beginPath();g.moveTo(cx-60,cy-30);g.quadraticCurveTo(cx-20,cy-50,cx-6,cy-4);g.moveTo(cx+6,cy+4);g.quadraticCurveTo(cx+24,cy+48,cx+60,cy+30);g.stroke();g.strokeStyle='#c32a22';g.beginPath();g.moveTo(cx-12,cy-10);g.lineTo(cx+12,cy+10);g.stroke();}
      else if(ic==='obj'){g.fillRect(cx-34,cy-8,68,44);g.fillStyle='#c32a22';g.fillRect(cx-34,cy-8,68,10);g.strokeStyle='#1a1410';g.beginPath();g.moveTo(cx,cy-8);g.lineTo(cx,cy-40);g.stroke();g.beginPath();g.arc(cx,cy-46,8,0,7);g.stroke();}
      else if(ic==='tri'){g.fillStyle='#c32a22';g.beginPath();g.moveTo(cx,cy-52);g.lineTo(cx+56,cy+40);g.lineTo(cx-56,cy+40);g.closePath();g.fill();g.stroke();g.fillStyle='#f7e9b0';g.font='900 56px Arial Black,Arial';g.fillText('!',cx,cy+10);}
      else{g.beginPath();g.roundRect(cx-56,cy-4,112,34,8);g.fill();g.beginPath();g.moveTo(cx-34,cy-4);g.lineTo(cx-18,cy-30);g.lineTo(cx+22,cy-30);g.lineTo(cx+38,cy-4);g.fill();g.fillStyle='#f7e9b0';for(const dx of[-32,32]){g.beginPath();g.arc(cx+dx,cy+32,12,0,7);g.fill();g.stroke();}g.strokeStyle='#c32a22';g.beginPath();g.moveTo(cx-20,cy-24);g.lineTo(cx+18,cy+26);g.moveTo(cx+18,cy-24);g.lineTo(cx-20,cy+26);g.stroke();}
      if(gr){const nm=['DYLAN','THEO','RAFE','OLIVER','DEBBIE','UNCLE VINCE'];for(let k=0;k<3;k++){const t=k?nm[(q()*6)|0]:['NO EXIT','BOP','TUBE RAT','WET FLOOR'][(q()*4)|0],c=GC[(q()*4)|0];g.save();g.translate(w*(.25+q()*.5),h*(.3+q()*.5));g.rotate((q()-.5)*.6);g.font='900 '+(48+q()*26|0)+'px Impact,"Arial Black",Arial';g.lineJoin='round';g.strokeStyle=q()<.25?'#d8261c':c==='#111'?'#f4f1e8':'#111';g.lineWidth=9;g.strokeText(t,0,0);g.fillStyle=c;g.fillText(t,0,0);for(let d=0;d<5;d++){g.fillRect((q()-.5)*120,16,3,10+q()*34);}g.restore();}}});};
    const at2=(i,sd,v,gr)=>{if(curved(i)||curved(i+8)||curved(i-8))return;board(i,sd*(12+XW[i]),5.2,3.9,poster(v,gr),0,.35);};
    let pv=0;for(const d of[150])at2(Z.start+m(d),pv%2?1:-1,pv++,false);for(const d of[420])at2(Z.wilma+m(d),pv%2?1:-1,pv++,false);
    for(const d of[-300,-150])at2(Z.tu0+m(d),pv%2?1:-1,pv++,true);
    const NM=[['DYLAN\'S','GARAGE'],['Theo\'s','TACOS'],['RAFE','BIKES'],['Debbie\'s','BAKERY'],['Uncle Vince','PIZZA'],['OLIVER','BOOKS'],['Aunt Melanie\'s','FLOWERS']],TG=['Dylan','Theo','Rafe','Debbie','Uncle Vince','Oliver','Aunt Melanie'];
    const nameSign=(n,k)=>canvas(512,256,(g,w,h)=>{g.textAlign='center';g.textBaseline='middle';if(k%2){g.fillStyle='#e8e0c8';g.fillRect(0,0,w,h);g.strokeStyle='#5a3a2a';g.lineWidth=14;g.strokeRect(7,7,w-14,h-14);g.fillStyle='#8a2a22';g.font='900 '+(NM[n][0].length>9?58:76)+'px Georgia,serif';g.fillText(NM[n][0],w/2,90,w-50);g.fillStyle='#2a2a2a';g.font='700 56px Arial';g.fillText(NM[n][1],w/2,185,w-50);}
      else{g.fillStyle='#6a5a4c';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=32){g.fillStyle='rgba(0,0,0,.18)';g.fillRect(0,y,w,3);}g.save();g.translate(w/2,h/2);g.rotate(-.1);g.font='900 '+(TG[n].length>7?76:110)+'px Impact,"Arial Black",Arial';g.lineJoin='round';g.strokeStyle='#111';g.lineWidth=16;g.strokeText(TG[n],0,0);g.fillStyle=['#f4f1e8','#c8ccd2','#d4af37'][k%3];g.fillText(TG[n],0,0);g.restore();}});
    let nk=0;for(let d=70;d<1250;d+=95){const i=Z.start+m(d);if(i>=Z.central+m(300)||curved(i)||curved(i+8)||curved(i-8)||nearCross(i,m(14)))continue;const n=nk%7;board(i,(nk%2?1:-1)*(10.6+XW[i]),2.6,1.3,nameSign(n,nk),0,.3);nk++;}}
  // wildlife: a plough team of wildebeest (big horns, dust kicked up behind) on Wilma Chan Way's left, deer and rabbits in the fields
  const bodyM=std({color:0x4a4640,roughness:1}),hornM=std({color:0xe8e0c8,roughness:.6}),woodM=std({color:0x6a4a2a,roughness:.9}),tanM=std({color:0xa8794a,roughness:1}),pale=std({color:0xd8cdb8,roughness:1}),bx=(a,b,c)=>new THREE.BoxGeometry(a,b,c);
  const beast=(sc,hornL,col,antl)=>{const g=new THREE.Group(),A=(geo,mm,x,y,z)=>{const o=new THREE.Mesh(geo,mm);o.position.set(x,y,z);g.add(o);return o;},legs=[];
    A(bx(.8,.8,1.6),col,0,1.1,0);const hd=new THREE.Group();hd.position.set(0,1.45,.95);g.add(hd);const hm=new THREE.Mesh(bx(.5,.55,.8),col);hm.position.z=.25;hd.add(hm);
    if(hornL)for(const s of[-1,1]){const h=new THREE.Mesh(new THREE.ConeGeometry(.08,hornL,5),hornM);h.position.set(s*(.3+hornL*.18),.35+(antl?hornL*.4:0),.1);h.rotation.z=-s*(antl?.25:1.1);hd.add(h);}
    for(const[x,z]of[[-.28,.6],[.28,.6],[-.28,-.6],[.28,-.6]]){const l=new THREE.Mesh(bx(.14,.8,.14).translate(0,-.4,0),col);l.position.set(x,.8,z);g.add(l);legs.push(l);}
    g.scale.setScalar(sc);scene.add(g);return{g,hd,legs};};
  const mkA=(kind,i0,lat,lo,hi)=>{const b=kind==='w'?beast(1.25,1.2,bodyM,false):kind==='d'?beast(.9,.7,tanM,true):beast(.3,0,pale,false);const o={...b,kind,i:i0,lat,dir:1,ph:Math.random()*6,sp:kind==='w'?.9:kind==='d'?.6:1.4,lo,hi};ALM.an.push(o);return o;};
  {const a=w0+m(100),b=Math.min(wE-m(10),w0+m(200));for(let k=0;k<4;k++){const an=mkA('w',a+m(k*3),41+(k%2)*3,a,b);const pl=new THREE.Group();   // a plough behind them
      pl.add(new THREE.Mesh(bx(.15,.15,3.2),woodM));const sh=new THREE.Mesh(bx(.1,.5,.9),std({color:0x555a5e,roughness:.5}));sh.position.set(0,-.4,-1.5);pl.add(sh);pl.position.set(0,.6,-2.2);an.g.add(pl);}
    for(let k=0;k<3;k++)mkA('d',w0+m(60+k*60),rr(26,36),w0+m(30),wE-m(20));}
  for(let k=0;k<8;k++){const i0=Z.start+m(120)+((Z.central-Z.start-m(240))*k/8|0);mkA(k%3===2?'d':'r',i0,(k%2?1:-1)*rr(13,19),i0-m(40),i0+m(40));}
  const dust=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:0xb59a74,transparent:true,opacity:.45,depthWrite:false}),80);dust.frustumCulled=false;
  ALM.dust={m:dust,p:Array.from({length:80},()=>({x:0,y:-99,z:0,l:0,vx:0,vz:0}))};tm.makeScale(0,0,0);for(let k=0;k<80;k++)dust.setMatrixAt(k,tm);scene.add(dust);
}

await BOOT.step('THE PORT OF OAKLAND',.43);
  // ---- I-880 north past the Port of Oakland: cranes along the wharf, container yards, ships at berth, a train beside the freeway; warehouses and the dead steel works on the other side; downtown Oakland beyond
  const wt=(lit,cs=16,dens=.42)=>canvas(128,256,(g,w,h)=>{g.fillStyle=lit?'#000':'#d2d3d0';g.fillRect(0,0,w,h);if(!lit){g.fillStyle='rgba(0,0,0,.1)';for(let y=0;y<h;y+=cs)g.fillRect(0,y,w,2);}for(let y=cs*.35;y<h;y+=cs){const fl=Math.random()<.1,dk=Math.random()<.2;for(let x=cs*.35;x<w;x+=cs){const on=!dk&&(fl||Math.random()<dens);
    g.fillStyle=lit?(on?['#cfe4ff','#ffd08a','#ffe9b8','#fff4d8','#ffbf6a'][Math.random()*5|0]:'#000'):(on?'#6f8597':'#3d4a55');if(lit&&on)g.globalAlpha=R(.4,1);g.fillRect(x,y,cs*.62,cs*.68);g.globalAlpha=1;}}});
  const VAR=[[0],[1],[2]];
  [[2,0xb9b3a6],[5,0x9aa3ab],[9,0xc9c2b0],[10,0x5a4238],[12,0xe6e0d0],[2,0x8a6a58,0,12,.5],[3,0xd9cdb4,0,20,.3],[4,0x6f7f8c,1,20,.3],[6,0xd8c8a8,1,12,.55],[5,0x8a7c70,1,16,.35],[7,0x6a7480,2,10,.6],[10,0x7a8894,2,22,.28],[8,0xb8a68c,2,14,.5],[9,0x9aa0a8,2,8,.7]].forEach(([ry,tint,cls,cs,dens])=>{
    const a=wt(false,cs,dens),e=wt(true,cs,dens);for(const t of[a,e]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,ry);}cityMats.push(std({map:a,emissiveMap:e,emissive:0xffd9a0,emissiveIntensity:0,color:tint,roughness:.7}));if(cls!==undefined)VAR[cls].push(cityMats.length-1);});
  const crown=[0x8a5cff,0x2ad4c8,0x3a8cff,0xff4c9a,0xfff0c8,0x58e06a].map(c=>{const mm=std({color:0x202226,emissive:c,emissiveIntensity:0,roughness:.5});cityMats.push(mm);return mm;}),beacon=new THREE.MeshBasicMaterial({color:0xff2a1a}),capM=std({color:0x3a3c40,roughness:.6});
  // a cluster of towers, tallest in the middle, standing on the ground (or the hill) wherever it is clear of the road
  const skyline=(cx,cz,rx,rz,n,hMax,clear=26)=>{for(let k=0;k<n;k++){const x=cx+rr(-rx,rx),z=cz+rr(-rz,rz);if(!farFromRoad(x,z,clear))continue;if(SFX.some(c=>{const dx=x-P[c].x,dz=z-P[c].z,al=dx*T[c].x+dz*T[c].z,la=dx*Nn[c].x+dz*Nn[c].z;return Math.abs(al)<26&&la>0&&la<260;}))continue;   /* keep the San Francisco cross streets open */const pk=Math.exp(-((x-cx)**2/(rx*rx*.35)+(z-cz)**2/(rz*rz*.35))),c=pk>.55?2:pk>.2?1:(rnd()*2|0),cm=cityMats[pick(VAR[c])],gy=groundAt(x,z),h=[rr(18,40),rr(45,90),rr(100,hMax)][c]*(.6+.6*pk),w=rr(16,34),d=rr(16,34);
    B(w,h,d,cm,x,gy+h/2,z);if(h>70){const th=h*rr(.1,.2);B(w*.66,th,d*.66,cm,x,gy+h+th/2,z);B(w*.7,1.2,d*.7,capM,x,gy+h+th+.6,z);if(rnd()<.5)B(w*.6,3.2,d*.6,pick(crown),x,gy+h+th+2.8,z);
      if(rnd()<.4){const an=new THREE.Mesh(cyl(.25,.5,26,5),capM);an.position.set(x,gy+h+th+13,z);scene.add(an);const bc=new THREE.Mesh(new THREE.SphereGeometry(1,6,5),beacon);bc.position.set(x,gy+h+th+26.5,z);scene.add(bc);}}}};
  const corr=std({roughness:.85,map:canvas(128,128,(g,w,h)=>{g.fillStyle='#fff';g.fillRect(0,0,w,h);for(let x=0;x<w;x+=6){g.fillStyle='rgba(0,0,0,.12)';g.fillRect(x,0,2,h);}speck(g,w,h,600,['rgba(120,70,40,.25)','rgba(0,0,0,.15)'],4);})});
  const corrM=c=>mat('corr'+c,{map:corr.map,color:c,roughness:.85});
  {const crane=(x,z,ry,up)=>{const g=new THREE.Group(),mm=mat('crane',{color:0xe6e4de,roughness:.55,metalness:.3}),bm=(x0,y0,z0,x1,y1,z1,t=1.2)=>{const o=B(t,t,Math.hypot(x1-x0,y1-y0,z1-z0),mm,(x0+x1)/2,(y0+y1)/2,(z0+z1)/2,0,g);o.lookAt(x1,y1,z1);return o;};
      // the photo's ship-to-shore cranes: four legs on a portal with X bracing, the machinery house, a tall A-frame, and the boom out over the water (some raised up, parked)
      for(const[lx,lz]of[[-9,-7],[9,-7],[-9,7],[9,7]])B(1.4,48,1.4,mm,lx,24,lz,0,g);for(const lz of[-7,7]){B(19,1.6,1.6,mm,0,46,lz,0,g);B(19,1.2,1.2,mm,0,14,lz,0,g);bm(-9,14,lz,9,46,lz,.7);bm(9,14,lz,-9,46,lz,.7);}
      for(const lx of[-9,9])B(1.6,1.6,15,mm,lx,46,0,0,g);B(9,6,13,mm,0,50,-12,0,g);
      for(const lx of[-3.5,3.5]){bm(lx,47,-19,0,82,-6,1.3);bm(lx,47,6,0,82,-6,1.3);bm(lx,52,-26,lx,52,8,1.5);
        if(up)bm(lx,52,8,lx,52+68*Math.sin(1.25),8+68*Math.cos(1.25),1.4);else bm(lx,52,8,lx,52,72,1.4);}
      const tip=up?[52+68*Math.sin(1.25),8+68*Math.cos(1.25)]:[52,72];bm(0,82,-6,0,tip[0],tip[1],.35);bm(0,82,-6,0,52,-26,.35);
      g.position.set(x,0,z);g.rotation.y=ry;scene.add(g);CRN.push({g,ry,t:R(3,25),a:0,d:1,k:0});};
    for(let k=0;k<10;k++){const t=k/9,x=lerp(-1780,-1840,t),z=lerp(-3450,-4550,t);crane(x,z,-Math.PI/2,k%3===1);}   // the cranes stand along the far end of the wharf: on the left you pass warehouses, then the rail yard, then the port
    {// a bulk carrier crossing the bay off the port, slowly: dark hull with a red boot top, white superstructure at the stern, hatch covers and four white deck cranes (moved in the drive's tick)
      const g=new THREE.Group(),A=(geo,mm,px,py,pz)=>{const o=new THREE.Mesh(geo,mm);o.position.set(px,py,pz);o.castShadow=true;g.add(o);return o;},bx=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
      const hullM=mat('bchull',{color:0x23272c,roughness:.7}),redM=mat('bcred',{color:0x8a2a20,roughness:.8}),whM=mat('bcwh',{color:0xeceae2,roughness:.55}),hatchM=mat('bchatch',{color:0x6a2a22,roughness:.8});
      A(bx(30,13,180),hullM,0,4.5,0);A(bx(30.3,2.4,180.3),redM,0,-.4,0);const bw=A(new THREE.ConeGeometry(15,28,4),hullM,0,4.5,103);bw.rotation.x=Math.PI/2;bw.rotation.y=Math.PI/4;bw.scale.set(1,1,.44);
      for(let k=0;k<5;k++)A(bx(20,2,22),hatchM,0,12,62-k*28);
      for(let k=0;k<4;k++){const z=48-k*28;A(cyl(1.4,1.6,10,8),whM,0,16,z);A(bx(2.6,2.6,4),whM,0,22,z);const j=A(bx(1.2,1.2,22),whM,0,26,z+9);j.rotation.x=-.5;}
      A(bx(24,16,16),whM,0,19,-74);A(bx(30,2,9),whM,0,28,-70);A(bx(18,3,12),whM,0,30,-76);A(bx(3,6,4),mat('bcfun',{color:0xd8d4c8,roughness:.6}),0,34,-84);A(bx(26,1,3),mat('vglass',{color:0x1f2a30,roughness:.1,metalness:.4}),0,25,-66);
      g.position.set(-2350,0,-3600);g.rotation.y=Math.PI;scene.add(g);SHIP=g;}
    const cont=new THREE.InstancedMesh(new THREE.BoxGeometry(12,2.6,2.5),std({roughness:.8,color:0xffffff}),1400);let k=0;
    for(let q=0;q<1400;q++){const t=rnd(),x=lerp(-1700,-1760,t)+rr(0,240),z=lerp(-3400,-4500,t)+rr(-30,30);if(!farFromRoad(x,z,50))continue;const st=rnd()*4|0;M4.compose(V.set(x,1.3+st*2.6,z),Q.setFromAxisAngle(YAX,Math.PI/2+(rnd()<.1?.2:0)),S.set(1,1,1));cont.setMatrixAt(k,M4);cont.setColorAt(k++,C.setHex(pick([0x8a3a30,0x2f5f7a,0xb9a36a,0x4a6f52,0x9a4a2a,0x3a3a5a,0xc9c4b8])));}
    cont.count=k;cont.castShadow=true;scene.add(cont);
    for(let k2=0;k2<4;k2++){const g=new THREE.Group(),z=-3550-k2*300,hull=mat('hull'+k2%2,{color:k2%2?0x1c2a3a:0x6a2a22,roughness:.7});B(32,14,220,hull,0,2,0,0,g);B(30,3,214,mat('deckg',{color:0x5a5a52}),0,10.5,0,0,g);B(26,18,22,white,0,21,-88,0,g);
      for(let q=0;q<28;q++)B(11,2.5+(q%3)*2.6,11.6,mat('cs'+q%5,{color:[0x8a3a30,0x2f5f7a,0xb9a36a,0x4a6f52,0x9a4a2a][q%5],roughness:.8}),(q%2?-6:6),13+(q%3)*1.3,-60+(q>>1)*11);g.position.set(-1960,-45,z);scene.add(g);}}
  {// rails beside the freeway, and the train that runs on them
    const sl=60;for(const o of[sl-.75,sl+.75])ribbon(o-.05,o+.05,i=>-H[i]+.18,i=>-H[i]+.18,steelM,4,Z.tu1+m(260),Z.detour);ribbon(sl-1.6,sl+1.6,i=>-H[i]+.05,i=>-H[i]+.05,mat('ballast',{color:0x5a544a,roughness:1}),4,Z.tu1+m(260),Z.detour);}
  {// warehouses on the land side, and further out the steel works: rusted sheds, still working - glowing windows, stacks and a blast furnace belching black smoke, conveyor bridges
    const rust=corrM(0x8a5a3a),rust2=corrM(0x6a4a3a),fade=corrM(0xb9b3a6),fade2=corrM(0x8a9298);
    const MW=[];for(let x=8;x<256;x+=24)for(let y=10;y<128;y+=34)MW.push([x,y,Math.random()<.7,Math.random()<.3,R(0,22),R(0,16)]);   // rusty but working: most windows glow with the furnaces inside
    const broken=std({roughness:.9,map:canvas(256,128,(g,w,h)=>{g.fillStyle='#7a5a44';g.fillRect(0,0,w,h);for(const[x,y,lit,brk,a,b]of MW){g.fillStyle=lit?'#ffb35a':'#3a4a52';g.fillRect(x,y,16,22);if(brk){g.fillStyle='#141210';g.beginPath();g.moveTo(x,y);g.lineTo(x+16,y+a);g.lineTo(x+b,y+22);g.fill();}}speck(g,w,h,800,['rgba(40,20,10,.4)','rgba(160,90,40,.3)'],6);}),
      emissiveMap:canvas(256,128,(g,w,h)=>{g.fillStyle='#000';g.fillRect(0,0,w,h);for(const[x,y,lit]of MW)if(lit){g.fillStyle='#ff8a30';g.fillRect(x,y,16,22);}}),emissive:0xffffff,emissiveIntensity:.9});
    for(let i=Z.tu1+m(250);i<Z.detour-m(200);i+=m(90)){const sd=-1,lat=-rr(70,120);gpos(i,lat,V);const w=rr(40,80),d=rr(30,60),h=rr(9,16),wm=pick([fade,fade2,rust2]);if(!farFromRoad(V.x,V.z,Math.hypot(w,d)/2+12))continue;B(w,h,d,wm,V.x,h/2,V.z,yaw(i));const rf=B(w+1,1,d+1,mat('roofgrey',{color:0x5a5c5e}),V.x,h+.3,V.z,yaw(i));}
    const mill=Z.tu1+m(1300);MILLC.i=mill;gpos(mill,-230,V);const mx=V.x,mz=V.z,ry=yaw(mill);MILLC.x=mx;MILLC.z=mz;MILLC.ry=ry;MILLC.y=V.y;const R2=(lx,lz)=>{const c=Math.cos(ry),s=Math.sin(ry);return[mx+lx*c+lz*s,mz-lx*s+lz*c];};
    {const blk=std({color:0x0e0d0c,roughness:1}),pipeM=corrM(0x7a4a32),M=(lx,lz,y,w,h,d,mt,rot=0)=>{const[x,z]=R2(lx,lz);return B(w,h,d,mt,x,y,z,ry+rot);};   // the works in partial ruin, spread over a big footprint (local x across, z along)
      for(const sx of[-40,40]){const L=210,W=46,Hh=15;M(sx,0,Hh/2,W,Hh,L,broken);   // two long sheds with sawtooth roofs and holes shot in the walls and roof
        for(let q=-L/2+8;q<L/2-6;q+=14){const t=M(sx,q,Hh+2.4,W,5,.8,rust);t.rotation.order='YXZ';t.rotation.x=.45;}
        for(const[hz,hy,hw]of[[-60,8,10],[10,7,7],[70,9,12],[-20,12,6]])M(sx+(sx<0?-W/2-.1:W/2+.1),hz,hy,.4,hw*.6,hw,blk);
        M(sx,rr(-60,60),Hh+4.6,12,.4,16,blk);}   // a hole through the roof
      const towerAdd=(st,x,z,h,ex,me)=>{const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);g.attach(st);for(const e of ex)g.attach(e);const dr=Math.random()<.5?1:-1,dx=Math.sin(ry)*dr,dz=Math.cos(ry)*dr;MILLC.tw.push({g,me,H:me?me.y:h,x,z,dx,dz,ax:new THREE.Vector3(dz,0,-dx),d:R(1,7),u:0,s:0});};
      for(let k=0;k<6;k++){const[x,z]=R2(100,-70+k*26),hh=k===4?26:k===5?9:rr(42,48),st=new THREE.Mesh(cyl(6,6.4,hh,14),k%2?rust:rust2);st.position.set(x,hh/2,z);if(k===4){st.rotation.z=.32;st.position.x+=4;}st.castShadow=true;scene.add(st);   // hot-blast stoves: one leaning, one a broken stump
        if(k<4){const dm=new THREE.Mesh(new THREE.SphereGeometry(6,12,6,0,6.2832,0,1.5708),rust2);dm.position.set(x,hh,z);scene.add(dm);}}
      M(100,-5,32,3,3,150,pipeM);M(100,-5,22,3,3,150,pipeM);M(88,-5,12,3,26,3,pipeM);   // pipework along the stoves
      {const[x,z]=R2(150,-20);const bf=new THREE.Mesh(cyl(8,11,56,16),rust);bf.position.set(x,28,z);bf.castShadow=true;scene.add(bf);const tp=new THREE.Mesh(new THREE.ConeGeometry(8,14,16),rust2);tp.position.set(x,63,z);scene.add(tp);const fme={x,y:71,z,t:0,k:1.6};MILL.push(fme);towerAdd(bf,x,z,56,[tp],fme);   // the furnace tower, its throat still smoking
        const hs=M(185,-20,28,80,2.4,3.4,rust2);hs.rotation.order='YXZ';hs.rotation.z=.52;M(150,-20,8,3,16,3,rust2);}   // the skip hoist climbing slanted up to the throat
      for(let k=0;k<5;k++){const h=[96,90,84,58,42][k],[x,z]=R2(-120,-100+k*45),st=new THREE.Mesh(cyl(1.7,3,h,12),k%2?rust:rust2);st.position.set(x,h/2,z);st.castShadow=true;scene.add(st);const tex=[];let tme=null;
        if(k<3){tex.push(B(5,1,5,rust,x,h,z));tme={x,y:h+1,z,t:R(0,.3),k:1.2};MILL.push(tme);}   // smoke from the intact stack tops only
        else{const jg=new THREE.Mesh(new THREE.ConeGeometry(2.6,5,5),blk);jg.position.set(x,h+1.5,z);jg.rotation.z=rr(-.5,.5);scene.add(jg);tex.push(jg);if(k===3){const f=new THREE.Mesh(cyl(1.4,1.7,22,10),rust2);f.position.set(x+9,1.2,z+4);f.rotation.set(1.45,0,1.2);scene.add(f);}}towerAdd(st,x,z,h,tex,tme);}   // the tops broken off, one fallen; each tall tower can topple in the quake
      for(let k=0;k<9;k++)M(-170,-90+k*13,2.2,4.6,2.6,11,k%3?rust2:rust);   // ore cars on the siding
      M(-170,0,.6,1,.3,170,blk);M(-168,0,.6,1,.3,170,blk);
      for(let k=0;k<14;k++)M(rr(-190,190),rr(-120,120),.8,rr(2,6),rr(1,3),rr(2,6),k%2?rust2:blk,rr(0,3));   // more ruin: rubble piles, twisted girders, collapsed roof sections, stumps of stacks and stoves
      for(let k=0;k<9;k++){const o=M(rr(-170,170),rr(-110,110),rr(1,3),.5,.5,rr(8,16),pipeM,rr(0,3));o.rotation.order='YXZ';o.rotation.x=rr(-.7,.7);o.rotation.z=rr(-.3,.3);}
      for(const sx of[-40,40])for(let k=0;k<2;k++){const o=M(sx+rr(-12,12),rr(-70,70),15.5,rr(12,18),.6,rr(12,20),blk);o.rotation.order='YXZ';o.rotation.x=rr(.2,.5);o.rotation.z=rr(-.3,.3);}
      for(let k=0;k<3;k++){const[x,z]=R2(-150,-90+k*60),h=rr(14,34),st=new THREE.Mesh(cyl(1.8,3,h,12),rust2);st.position.set(x,h/2,z);scene.add(st);const jg=new THREE.Mesh(new THREE.ConeGeometry(2.6,4,5),blk);jg.position.set(x,h+1.2,z);jg.rotation.z=rr(-.5,.5);scene.add(jg);}
      for(let k=0;k<2;k++){const[x,z]=R2(100,-110-k*28),st=new THREE.Mesh(cyl(6,6.4,rr(8,16),14),rust);st.position.set(x,5,z);st.rotation.z=rr(.4,.9);scene.add(st);}
    const ms=sign(1024,200,'BAYSIDE STEEL WORKS','#3a2a20','#c9a37a','900 96px Georgia');{const[x,z]=R2(0,-130);const sg=new THREE.Mesh(new THREE.PlaneGeometry(50,9.8),std({map:ms,roughness:.9}));sg.position.set(x,30,z);sg.rotation.y=ry+Math.PI/2;scene.add(sg);}}
    for(let k=0;k<6;k++){const[x,z]=R2(rr(-90,90),rr(-150,120));const tk=new THREE.Mesh(cyl(9,9,12,16),fade2);tk.position.set(x,6,z);tk.castShadow=true;scene.add(tk);}
    {const ads=[['BAY STEEL','BUILT TO LAST','#1f3a5a','#ffd23a'],['OAKLAND A\'S','PLAY BALL','#1f5a3a','#f4f1e8'],['INJURY LAWYER','CALL 1-800-OUCH','#5a1f1f','#fff'],['PORT OF OAKLAND','WORLD CLASS','#1c2a3a','#9fd0ff'],['DRIVE SAFE','THE LIFE YOU SAVE','#3a2a1c','#ffd23a']];   // dedicated billboards beside I-880 that tip over in the quake
      ads.forEach(([t1,t2,bg,fg],k)=>{const i=Z.tu1+m(260+k*230),sd=k%2?1:-1,g=new THREE.Group(),tx=sign(1024,320,t1,bg,fg,'900 96px Arial',t2);
        B(.5,8,.5,std({color:0x4a4c50,roughness:.8}),0,4,0,0,g);B(.4,4.2,11,std({map:tx,roughness:.7}),0,9.6,0,0,g);
        off(i,sd*(RW+XW[i]+9),0,g.position);g.rotation.y=yaw(i);g.updateMatrixWorld(true);const ex=Math.cos(yaw(i))*Nn[i].x-Math.sin(yaw(i))*Nn[i].z;
        scene.add(g);BBQ.push({g,i,dir:-Math.sign(ex*sd)||1,t:-1,ang:0,w:0});});}
    {const dec=canvas(256,512,(c,w,h)=>{c.fillStyle='#57534c';c.fillRect(0,0,w,h);for(let y=10;y<h-8;y+=26)for(let x=8;x<w-8;x+=22){const r=Math.random();c.fillStyle=r<.22?'#1b1814':r<.3?'#6a6258':'#161c22';c.fillRect(x,y,14,16);if(r>.85){c.strokeStyle='#9aa8b0';c.lineWidth=1;c.beginPath();c.moveTo(x,y+14);c.lineTo(x+13,y+2);c.stroke();}}
        for(let k=0;k<26;k++){c.fillStyle=Math.random()<.5?'rgba(10,8,6,.35)':'rgba(130,70,34,.3)';c.fillRect(Math.random()*w,Math.random()*h*.7,3+Math.random()*7,60+Math.random()*220);}
        c.strokeStyle='rgba(0,0,0,.55)';c.lineWidth=2;for(let k=0;k<5;k++){c.beginPath();let x=Math.random()*w,y=Math.random()*h;c.moveTo(x,y);for(let j=0;j<6;j++){x+=Math.random()*24-12;y+=14+Math.random()*20;c.lineTo(x,y);}c.stroke();}}),
        dm=std({map:dec,roughness:.95}),blk=std({color:0x0d0c0b,roughness:1}),rst=std({color:0x6a3a24,roughness:1});   // dark and missing windows, soot, rust streaks and cracks
      for(let k=0;k<9;k++){const i=Z.b1+m(110+k*135),lat=70+rr(0,70)+(k%2)*30;gpos(i,lat,V);const g=new THREE.Group(),pyr=k%3!==2,h=pyr?rr(95,150):rr(70,115),r=pyr?rr(10,13):rr(15,20),broken=k%3===0||k%4===1;
        if(pyr){const body=new THREE.Mesh(new THREE.CylinderGeometry(broken?r*.28:r*.04,r,h,4),dm);body.position.y=h/2;g.add(body);   // the Transamerica-style pyramid: tapering to a point, with a wing either side
          for(const s of[-1,1]){B(2.6,h*.42,9,dm,s*r*.62,h*.21+h*.05,0,0,g);}
          if(broken){const jg=new THREE.Mesh(new THREE.ConeGeometry(r*.3,7,5),blk);jg.position.y=h+2;jg.rotation.z=rr(-.5,.5);g.add(jg);g.userData.tip=jg;}else{const sp=new THREE.Mesh(cyl(.25,.8,30,6),rst);sp.position.y=h+12;g.add(sp);g.userData.tip=sp;}}
        else{B(r*1.8,h,r*1.4,dm,0,h/2,0,0,g);const top=B(r*1.6,5,r*1.2,rst,0,h+1,0,0,g);top.rotation.z=rr(-.25,.25);B(r*1.8+.3,6,r*1.4+.3,blk,0,h*rr(.35,.7),0,0,g);}   // a box tower with a tilted broken top and one floor collapsed
        g.position.set(V.x,0,V.z);g.rotation.order='YXZ';g.rotation.set(rr(-.04,.04),yaw(i),rr(-.05,.05));g.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(g);if(pyr)SFP.push({g,i,h,r});if(broken||k%2)SFSM.push({x:V.x,y:h*.95,z:V.z,i,t:R(0,2)});}}
    // the left (bay) side, in order: warehouses, then the rail yard, then the port with its cranes
    for(let i=Z.tu1+m(150);i<Z.tu1+m(620);i+=m(rr(55,80))){gpos(i,rr(150,200),V);const w=rr(40,70),d=rr(26,44),h=rr(9,15);B(w,h,d,pick([fade,fade2,rust2,rust]),V.x,V.y+h/2,V.z,yaw(i));B(w+1,1,d+1,mat('roofgrey',{color:0x5a5c5e}),V.x,V.y+h+.3,V.z,yaw(i));
      for(let q=-1;q<=1;q++){const[dx,dz]=[Math.cos(yaw(i))*q*w*.28,-Math.sin(yaw(i))*q*w*.28];B(5,5,.3,mat('dock',{color:0x3a3c3e}),V.x+dx-Nn[i].x*d/2,V.y+2.5,V.z+dz-Nn[i].z*d/2,yaw(i));}}   // loading doors facing the freeway
    {const y0=Z.tu1+m(650),y1=Z.tu1+m(1250),bal=mat('ballast',{color:0x5a544a,roughness:1});ribbon(200,280,i=>-H[i]+.04,i=>-H[i]+.04,bal,4,y0,y1);
      for(let t=0;t<8;t++){const lat=205+t*10;for(const o of[lat-.75,lat+.75])ribbon(o-.05,o+.05,i=>-H[i]+.18,i=>-H[i]+.18,steelM,4,y0,y1);}   // eight tracks side by side
      const fc=new THREE.InstancedMesh(new THREE.BoxGeometry(3.1,3.8,14),std({roughness:.85,color:0xffffff}),420);let k=0;
      for(let t=0;t<8;t++){let i=y0+m(rr(0,40));while(i<y1-m(10)&&k<420){if(rnd()<.18){i+=m(rr(30,90));continue;}off(i,205+t*10,0,V);V.y=2.2;M4.compose(V,Q.setFromAxisAngle(YAX,yaw(i)),S.set(1,rnd()<.25?.75:1,1));fc.setMatrixAt(k,M4);
        fc.setColorAt(k++,C.setHex(pick([0x7a3a28,0x5a3a2a,0x8a5a2a,0x2f4f6a,0x6a6a62,0xb98a3a,0x3a5a3a])));i+=m(15);}}fc.count=k;fc.castShadow=true;scene.add(fc);
      for(const[d,t]of[[200,1],[420,4],[560,6]]){const i=y0+m(d);off(i,205+t*10,0,V);const lo=B(3.2,4.4,18,mat('loco',{color:0xd8a020,roughness:.6}),V.x,2.6,V.z,yaw(i));B(3.3,.6,18.2,mat('locoband',{color:0x1a1a1a}),V.x,1.2,V.z,yaw(i));}}
    // the airport, out on the flats beyond the warehouses and the yard: a runway along the shore, a terminal and a control tower. Planes take off now and then (planesTick).
    {const a0=Z.tu1+m(180),a1=Z.tu1+m(1150),mid=(a0+a1)>>1,lat=660,rw=canvas(64,1024,(g,w,h)=>{g.fillStyle='#2e3034';g.fillRect(0,0,w,h);speck(g,w,h,900,['rgba(255,255,255,.05)','rgba(0,0,0,.2)'],3);g.fillStyle='#e8e8e0';for(let y=40;y<h-40;y+=48)g.fillRect(w/2-1.5,y,3,24);
        for(const y of[6,h-30])for(let x=6;x<w-4;x+=7)g.fillRect(x,y,4,24);g.fillRect(2,0,2,h);g.fillRect(w-4,0,2,h);});
      off(mid,lat,0,V);const gy=Math.max(groundAt(V.x,V.z),0)+.08,len=(a1-a0)*SEG,ry=yaw(mid);
      const run=new THREE.Mesh(new THREE.PlaneGeometry(46,len).rotateX(-Math.PI/2),std({map:rw,roughness:.9}));run.position.set(V.x,gy,V.z);run.rotation.y=ry;run.receiveShadow=true;scene.add(run);
      const apron=new THREE.Mesh(new THREE.PlaneGeometry(90,len*.6).rotateX(-Math.PI/2),std({color:0x55575a,roughness:.95}));off(mid,lat-95,0,V2);apron.position.set(V2.x,gy-.02,V2.z);apron.rotation.y=ry;scene.add(apron);
      off(mid-m(120),lat-150,0,V2);B(150,14,42,mat('terminal',{color:0xd8d4c8,roughness:.6}),V2.x,gy+7,V2.z,ry);B(152,2.5,44,mat('termglass',{color:0x2a3a48,roughness:.15,metalness:.6}),V2.x,gy+10,V2.z,ry);
      off(mid+m(160),lat-140,0,V2);const tw=new THREE.Mesh(cyl(2.4,3.2,34,10),white);tw.position.set(V2.x,gy+17,V2.z);scene.add(tw);const cab=new THREE.Mesh(cyl(5.5,4.2,5,8),mat('termglass',{color:0x2a3a48,roughness:.15,metalness:.6}));cab.position.set(V2.x,gy+36.5,V2.z);scene.add(cab);
      for(let q=0;q<3;q++){off(mid-m(240)+m(q*60),lat-90,0,V2);const pl=AIRmk();pl.position.set(V2.x,gy,V2.z);pl.rotation.y=ry+Math.PI/2;scene.add(pl);}   // parked at the gates
      off(a0,lat,0,V);AIR.A=V.clone().setY(gy);off(a1,lat,0,V);AIR.B=V.clone().setY(gy);AIR.ry=ry;}
    // the stadium, on the right before the steel works: an oval bowl, its seats, the field, and four light towers
    {const i=Z.tu1+m(820);gpos(i,-300,V);const g=new THREE.Group(),con=std({color:0xb8b2a4,roughness:.9,side:D2});
      const out=new THREE.Mesh(new THREE.CylinderGeometry(80,74,26,48,1,true),con);out.position.y=13;g.add(out);
      const seats=new THREE.Mesh(new THREE.CylinderGeometry(76,48,22,48,1,true),std({color:0x2f5a8a,roughness:.8,side:D2}));seats.position.y=12;g.add(seats);
      const fld=new THREE.Mesh(new THREE.CircleGeometry(48,40).rotateX(-Math.PI/2),std({color:0x3a7a3a,roughness:1}));fld.position.y=.6;g.add(fld);
      for(const a of[.6,2.5,3.8,5.7]){const x=Math.cos(a)*86,z=Math.sin(a)*86;B(1.6,58,1.6,steelM,x,29,z,0,g);const pn=B(12,7,1,lampMat,x,60,z,-a+Math.PI/2,g);pn.lookAt(0,0,0);}
      const sg=new THREE.Mesh(new THREE.PlaneGeometry(40,6),std({map:sign(1024,160,'COLISEUM','#1a3a24','#f2c230','900 110px Arial'),roughness:.8}));sg.position.set(0,20,80.3);g.add(sg);
      g.scale.set(1,1,1.3);g.position.copy(V);g.rotation.y=yaw(i)+Math.PI/2;g.traverse(o=>{o.castShadow=true;});scene.add(g);}
    // downtown Oakland, seen across the flats from both freeways
    skyline(500,-3300,420,500,90,150);}
  { // overhead signs on the freeways
    const gant=(i,txt,sub,bg='#1f5a3a',fg='#f4f1e8',off2=-2.5)=>{const g=new THREE.Group(),w=10+XW[i]*2;for(const x of[-(9.4+XW[i]),9.4+XW[i]])B(.35,8,.35,steelM,x,4,0,0,g);B(2*(9.4+XW[i]),.5,.5,steelM,0,8,0,0,g);
      const s=new THREE.Mesh(new THREE.BoxGeometry(11,3.2,.12),std({roughness:.6,map:sign(1024,296,txt,bg,fg,'900 96px Arial',sub),emissive:0xffffff,emissiveIntensity:.15}));s.position.set(off2,6.5,-.3);g.add(s);g.traverse(o=>{o.castShadow=true;});g.position.copy(P[i]);g.rotation.y=yaw(i);scene.add(g);};
    gant(Z.tu1+m(500),'I-880 NORTH','OAKLAND · PORT');gant(Z.tu1+m(1500),'BAY BRIDGE','SAN FRANCISCO  ↑');gant(Z.detour-m(140),'BAY BRIDGE','SAN FRANCISCO  ↑',undefined,undefined,3);
    gant(Z.i80+m(400),'I-80 WEST','BERKELEY · OAKLAND');gant(Z.berkeley-m(200),'UNIVERSITY AVE','UC BERKELEY  ←');gant(Z.emeryville-m(900),'POWELL ST','EMERYVILLE');
    { // the Emeryville interchange: I-80 West peels off to the right, back over the Bay Bridge to San Francisco (scenery only - the barrier stays closed), keep left for Oakland
      const gant2=(i,pn)=>{const g=new THREE.Group(),hw=9.4+XW[i];for(const x of[-hw,hw])B(.35,8,.35,steelM,x,4,0,0,g);B(2*hw,.5,.5,steelM,0,8,0,0,g);
        for(const[txt,sub,x]of pn){const s=new THREE.Mesh(new THREE.BoxGeometry(9.6,3.2,.12),std({roughness:.6,map:sign(1024,296,txt,'#1f5a3a','#f4f1e8','900 96px Arial',sub),emissive:0xffffff,emissiveIntensity:.15}));s.position.set(x,6.5,-.3);g.add(s);}
        g.traverse(o=>{o.castShadow=true;});g.position.copy(P[i]);g.rotation.y=yaw(i);scene.add(g);};
      const E=Z.emeryville;gant2(E-m(200),[['OAKLAND','580 · 980   KEEP LEFT  ↖',4.9],['SAN FRANCISCO','80 WEST · BAY BRIDGE  ↗  1/2 MI',-5.3]]);
      gant2(E+m(150),[['OAKLAND','WEBSTER TUBE · ALAMEDA  ↑',4.9],['SAN FRANCISCO','BAY BRIDGE   EXIT ONLY  ↘',-5.3]]);
      const pts=[],i0=E+m(250),i1=E+m(450);for(let i=i0;i<=i1;i+=5){const u=(i-i0)/(i1-i0);off(i,-(RW+XW[i]+5.2)-50*u*u,u*u*3,V);pts.push(V.clone());}   // the ramp leaves alongside the barrier, then sweeps away west on a rising flyover
      {const n0=pts.length,y0=pts[n0-1].y;let p=pts[n0-1],th=Math.atan2(p.x-pts[n0-2].x,p.z-pts[n0-2].z);for(let k=1;k<=36;k++){const u=k/36;th-=90*D2R/36;p=new THREE.Vector3(p.x+Math.sin(th)*15,y0+9*sst(u,0,.6)-4*sst(u,.75,1),p.z+Math.cos(th)*15);pts.push(p);}}
      const N=pts.length,tg=pts.map((_,k)=>{const a=pts[Math.max(0,k-1)],b=pts[Math.min(N-1,k+1)];return Math.atan2(b.x-a.x,b.z-a.z);});
      const strip=(o1,y1,o2,y2,mm,vs)=>{const pos=[],uv=[],idx=[];let L=0;for(let k=0;k<N;k++){const p=pts[k];if(k)L+=p.distanceTo(pts[k-1]);const nx=Math.cos(tg[k]),nz=-Math.sin(tg[k]);pos.push(p.x+nx*o1,p.y+y1,p.z+nz*o1,p.x+nx*o2,p.y+y2,p.z+nz*o2);uv.push(0,L/vs,1,L/vs);if(k<N-1){const q=k*2;idx.push(q,q+2,q+1,q+1,q+2,q+3);}}
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const o=new THREE.Mesh(g,mm);o.receiveShadow=true;scene.add(o);return o;};
      const at2=canvas(64,256,(c,w,h)=>{c.fillStyle='#3c3d40';c.fillRect(0,0,w,h);c.fillStyle='#e8e4d6';c.fillRect(3,0,3,h);c.fillRect(w-6,0,3,h);c.fillRect(w/2-1.5,0,3,h*.45);});at2.wrapS=at2.wrapT=THREE.RepeatWrapping;
      const cc=std({color:0xb8b4aa,roughness:.9,side:THREE.DoubleSide});strip(4.6,.02,-4.6,.02,std({map:at2,roughness:.85,side:THREE.DoubleSide}),12);
      for(const sd of[-1,1]){strip(sd*4.6,-1.4,sd*4.6,.9,cc,8).castShadow=true;strip(sd*4.6,.9,sd*4.95,.9,cc,8);}strip(4.6,-1.4,-4.6,-1.4,cc,8);
      for(let k=6;k<N;k+=3){const p=pts[k];if(p.y<3)continue;const c=new THREE.Mesh(cyl(1.1,1.3,p.y+4,10),cc);c.position.set(p.x,p.y/2-2.7,p.z);c.castShadow=true;scene.add(c);}}
gant(Z.oakland-m(300),'WEBSTER TUBE','ALAMEDA  ↓');
    // the detour: orange signs, a gantry pointing right, and the exit lane peeling off the viaduct towards Berkeley and Richmond
    const det=sign(512,512,'DETOUR','#f08a1c','#141414','900 110px Arial','→');for(const d of[400,300,200])board(Z.detour-m(d),-(11+XW[Z.detour-m(d)]),2.6,2.6,det,1,.45);
    gant(Z.detour-m(60),'DETOUR  ↗','BERKELEY · RICHMOND',"#f08a1c",'#141414',-3.8);
    const a=Z.detour-m(30),n=60,pos=[],uv=[];DETR.a=a;const _x=[],idx=[];for(let k=0;k<=n;k++){const u=k/n,i=a+k*4,lat=-(RW+XW[i])-4.2-150*u*u,y=H[i]*(1-sst(u,.08,.6)),p=P[i],nn=Nn[i];for(const s of[-4,4])pos.push(p.x+nn.x*(lat+s),y+.02-s*.09*Math.sin(Math.PI*u),p.z+nn.z*(lat+s));uv.push(0,k*.6,1,k*.6);if(k<n){const q=k*2;idx.push(q,q+2,q+1,q+1,q+2,q+3);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const rm=new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:roadTex,roughness:.72,side:D2}));rm.receiveShadow=true;scene.add(rm);
    const cone=new THREE.InstancedMesh(new THREE.ConeGeometry(.28,.8,10),std({color:0xf06a1c,roughness:.6}),30);for(let k=0;k<30;k++){const i=a-m(40)+k*3,lat=-(RW+XW[i])-.4-k*.1;off(i,lat,.4,V);M4.compose(V,Q.identity(),S.set(1,1,1));cone.setMatrixAt(k,M4);}
    { // the portal to Richmond: the exit road sweeps down to the ground and ends in a low ring with a swirling blue hole (the car is carried through it - see the rail in the tick)
      const lanePos=k=>{const u=k/n,i=a+k*4;return{i,u,lat:-(RW+XW[i])-4.2-150*u*u,y:H[i]*(1-sst(u,.08,.6))};};
      const hd=k=>{const p0=lanePos(Math.max(0,k-1)),p1=lanePos(k+1);off(p0.i,p0.lat,0,V);off(p1.i,p1.lat,0,V2);return Math.atan2(V2.x-V.x,V2.z-V.z);};
      {const ln=new THREE.InstancedMesh(new THREE.BoxGeometry(.22,.04,2.2),new THREE.MeshBasicMaterial({color:0xf2f0e0}),19);let nl=0;   // white centre dashes down the road to the ring
        for(let k=0;k<=36;k+=2){const p=lanePos(k);E.set(0,hd(k),0);Q.setFromEuler(E);off(p.i,p.lat,p.y+.06,V);M4.compose(V,Q,S.set(1,1,1));ln.setMatrixAt(nl++,M4);}ln.count=nl;scene.add(ln);}
      const q=lanePos(36),g=new THREE.Group(),dk=std({color:0x1d2229,roughness:.45,metalness:.8}),bl=new THREE.MeshBasicMaterial({color:0x6fd0ff});
      const rg=new THREE.Mesh(new THREE.TorusGeometry(5,.9,12,40),dk);rg.position.y=5.3;g.add(rg);
      for(const[r,tb]of[[4.05,.13],[5.95,.1]]){const lt=new THREE.Mesh(new THREE.TorusGeometry(r,tb,6,48),bl);lt.position.y=5.3;g.add(lt);}
      PORTAL.tex=canvas(128,128,()=>{});PORTAL.c=PORTAL.tex.image;const dm=new THREE.Mesh(new THREE.CircleGeometry(4.1,40),new THREE.MeshBasicMaterial({map:PORTAL.tex,side:D2}));dm.position.y=5.3;g.add(dm);
      g.scale.setScalar(.72);off(q.i,q.lat,Math.max(q.y,0),g.position);g.rotation.y=hd(36);scene.add(g);PORTAL.g=g;PORTAL.i=q.i;
      const gx=g.position.x,gz=g.position.z,lane=[];for(let k=0;k<=44;k++){const p=lanePos(k);off(p.i,p.lat,0,V);lane.push([V.x,V.z]);}
      const clear=(x,z,r)=>Math.hypot(x-gx,z-gz)>r+60&&lane.every(l=>Math.hypot(l[0]-x,l[1]-z)>r+30)&&farFromRoad(x,z,r+26);
      // an industrial wasteland round the lower ramp, kept well back from the ring: abandoned warehouses with broken windows and graffiti, wrecked cars
      const iw=std({roughness:.95,map:canvas(512,256,(g2,w,h)=>{g2.fillStyle='#6d665e';g2.fillRect(0,0,w,h);speck(g2,w,h,2500,['rgba(30,24,20,.35)','rgba(150,130,100,.25)'],5);
        for(let x=14;x<w-30;x+=52)for(let y=16;y<h-60;y+=62){if(Math.random()<.22){g2.fillStyle='#5a3a30';g2.fillRect(x,y,34,40);continue;}g2.fillStyle='#10161a';g2.fillRect(x,y,34,40);if(Math.random()<.6){g2.strokeStyle='#8fa3ad';g2.lineWidth=1.5;g2.beginPath();g2.moveTo(x+4,y+34);g2.lineTo(x+20,y+8);g2.lineTo(x+30,y+26);g2.moveTo(x+20,y+8);g2.lineTo(x+12,y+4);g2.stroke();}}   // dark panes, cracked or missing
        g2.lineCap='round';const tags=['ZERO','RAT','NO MORE','KRUSH','1999','VOID'];for(let k=0;k<5;k++){g2.fillStyle=g2.strokeStyle=['#0a0a0a','#f2f2f2','#b8bcc0'][k%3];g2.font='900 '+(40+k*8)+'px Arial';g2.lineWidth=5;g2.save();g2.translate(30+k*95,h-18-(k%2)*34);g2.rotate(-.12+k*.05);g2.fillText(tags[k],0,0);g2.beginPath();g2.moveTo(0,10);g2.bezierCurveTo(50,22,80,-6,130,12);g2.stroke();g2.restore();}})}),rm=std({color:0x4a3a30,roughness:1});
      let nb=0;for(let t=0;t<80&&nb<6;t++){const an=rr(0,6.283),d=rr(80,210),x=gx+Math.cos(an)*d,z=gz+Math.sin(an)*d,w=rr(28,56),dp=rr(18,32),h=rr(8,15);if(!clear(x,z,Math.hypot(w,dp)/2))continue;nb++;const ry=rr(0,3);B(w,h,dp,iw,x,h/2,z,ry);B(w+.5,.6,dp+.5,rm,x,h+.3,z,ry);}
      const rust=std({color:0x6a3a24,roughness:1}),rust2=std({color:0x4c4a46,roughness:1}),tyre=std({color:0x151515,roughness:.95});let nc=0;
      for(let t=0;t<80&&nc<12;t++){const an=rr(0,6.283),d=rr(70,170),x=gx+Math.cos(an)*d,z=gz+Math.sin(an)*d;if(!clear(x,z,4))continue;nc++;const c=new THREE.Group(),mm=nc%2?rust:rust2;
        B(1.8,.7,4.4,mm,0,.6,0,0,c);B(1.6,.55,2.2,rust2,0,1.2,-.2,0,c);if(nc%3===0)B(.1,.5,1.4,tyre,.9,1.2,-.2,0,c);for(const[wx,wz]of[[-.9,1.5],[.9,1.5],[-.9,-1.5],[.9,-1.5]])if(Math.random()<.5){const wh=new THREE.Mesh(cyl(.33,.33,.25,8),tyre);wh.rotation.z=Math.PI/2;wh.position.set(wx,.33,wz);c.add(wh);}
        c.position.set(x,0,z);c.rotation.set(0,rr(0,6.28),nc%4===0?.35:rr(-.05,.05));scene.add(c);}}}

  { // ---- toll plaza: booths under a lit canopy, a gantry of lane signs, palms; then the flats before the bridge - burnt-out buildings, still smouldering
    const wh=std({color:0xdcdfdb,roughness:.6,metalness:.3}),i=Z.toll+m(190),g=new THREE.Group();
    B(27,.5,7.5,wh,0,5.7,0,0,g);const und=new THREE.Mesh(new THREE.BoxGeometry(26.4,.08,6.9),lampMat);und.position.y=5.42;g.add(und);
    const fas=new THREE.Mesh(new THREE.BoxGeometry(27,1.1,.12),std({roughness:.6,map:sign(1024,64,'BAY BRIDGE  ·  TOLL PLAZA  ·  STOP AHEAD','#1f5a3a','#f4f1e8','900 40px Arial')}));fas.position.set(0,6.1,-3.8);g.add(fas);
    for(const x of[-11.3,-3.75,3.75,11.3]){B(1.1,2.6,3.2,mat('booth',{color:0xe6e1d0,roughness:.8}),x,1.3,0,0,g);B(1.14,.9,2.2,glassM,x,1.9,0,0,g);for(const z of[-3,3])B(.3,5.5,.3,wh,x,2.75,z,0,g);B(1.5,.25,10,side,x,.125,0,0,g);
      for(const dz of[-3.6,-1.2,1.2,3.6]){V.set(x,0,dz).applyAxisAngle(YAX,yaw(i)).add(P[i]);OBST.push({x:V.x,z:V.z,r:1.2});}}
    g.traverse(o=>{o.castShadow=o.receiveShadow=true;});g.position.copy(P[i]);g.rotation.y=yaw(i);scene.add(g);
    const frond=new THREE.PlaneGeometry(.7,3.6).translate(0,-1.8,0),np=60,tr=new THREE.InstancedMesh(cyl(.2,.3,1,8),std({color:0x6a5a48,roughness:1}),np),fr=new THREE.InstancedMesh(frond,std({color:0x3f6a34,roughness:.9,side:D2}),np*11);let k=0,f=0;
    const palm=(x,y,z)=>{const h=rr(8,11.5);M4.compose(V.set(x,y+h/2,z),Q.identity(),S.set(1,h,1));tr.setMatrixAt(k++,M4);for(let j=0;j<11;j++){E.set(0,j/11*6.283+rr(-.2,.2),rr(1.9,2.4),'YXZ');Q.setFromEuler(E);M4.compose(V.set(x,y+h,z),Q,S.set(1,rr(.8,1.1),1));fr.setMatrixAt(f++,M4);}};
    for(let q=Z.toll+m(60);q<Z.toll+m(300)&&k<20;q+=8){off(q,11.5+XW[q],0,V2);palm(V2.x,0,V2.z);}
    for(const q of[Z.start-14,Z.start+40,Z.wilma+m(100),Z.wilma+m(160),Z.bv+m(300),Z.bv+m(700)]){off(q,(q%2?1:-1)*(12.8+XW[q]),0,V2);palm(V2.x,0,V2.z);}
    tr.count=k;fr.count=f;tr.castShadow=fr.castShadow=true;scene.add(tr,fr);
    const ruinM=std({roughness:.95,map:canvas(256,256,(gg,w,h)=>{gg.fillStyle='#5a5048';gg.fillRect(0,0,w,h);speck(gg,w,h,3000,['rgba(20,16,14,.5)','rgba(120,100,80,.3)'],8);for(let x=10;x<w;x+=40)for(let y=12;y<h;y+=46){gg.fillStyle='#0c0b0a';gg.fillRect(x,y,24,30);gg.fillStyle='rgba(0,0,0,.6)';gg.fillRect(x-4,y-14,32,14);}})});
    for(let q=Z.detour+m(260);q<Z.b0+m(30);q+=m(55))for(const sd of[-1,1]){if(rnd()<.25)continue;gpos(q,sd*rr(40,110),V);if(V.y>.5||!farFromRoad(V.x,V.z,32))continue;const w=rr(14,34),d=rr(12,26),h=rr(7,22),ry=yaw(q)+rr(-.3,.3);
      const b=B(w,h,d,ruinM,V.x,h/2,V.z,ry);if(rnd()<.6){const sl=B(w*.8,.8,d*.9,mat('ruinroof',{color:0x2a2622,roughness:1}),V.x,h*.7,V.z,ry);sl.rotation.z=rr(.25,.5)*(rnd()<.5?-1:1);}
      if(rnd()<.55)BURN.push({x:V.x+rr(-w*.3,w*.3),y:h*rr(.3,1),z:V.z+rr(-d*.3,d*.3),s:rr(.7,1.4)});}}

await BOOT.step('SPANNING THE BAY · THREE BRIDGES',.49);
  // ---- the three bridges. The Bay Bridge: a riveted truss for the eastern half, then a suspension span on tall towers. The Golden Gate in international orange. The Richmond bridge: long, low, with two humped truss spans.
  {const trussT=canvas(128,128,(g)=>{g.clearRect(0,0,128,128);g.strokeStyle='#fff';g.lineWidth=11;g.strokeRect(5,5,118,118);g.beginPath();g.moveTo(0,0);g.lineTo(128,128);g.moveTo(128,0);g.lineTo(0,128);g.stroke();});trussT.wrapS=trussT.wrapT=THREE.RepeatWrapping;
    const bridge=(a,b,o)=>{const col=o.col,sm=std({color:col,roughness:.55,metalness:.5}),trussM=std({map:trussT,color:col,alphaTest:.4,side:D2,roughness:.6,metalness:.4}),cableM=std({color:o.cable||0x767c81,roughness:.5,metalness:.6}),TH=o.TH;
      const openT=o.open?canvas(64,128,g=>{g.clearRect(0,0,64,128);g.fillStyle="#fff";g.fillRect(0,0,64,14);g.fillRect(0,0,7,128);g.fillRect(28,0,6,128);g.fillRect(55,0,9,128);}):null;if(openT)openT.wrapS=openT.wrapT=THREE.RepeatWrapping;   // an open rail: three thin bars and a post each few metres, so you see the bay through it
      for(const sd of[-1,1]){ribbon(i=>sd*(8.4+XW[i]),i=>sd*(6.6+XW[i]),.14,.14,side,3,a,b);const rl=ribbon(i=>sd*(8.3+XW[i]),i=>sd*(8.3+XW[i]),.14,1.2,o.open?std({map:openT,color:0x9aa1a6,alphaTest:.5,side:D2,roughness:.5,metalness:.6}):o.rail?std({color:col,roughness:.6,side:D2}):railM,2,a,b);rl.castShadow=!o.open;ribbon(i=>sd*(8.5+XW[i]),i=>sd*(8.5+XW[i]),-6,0,trussM,6,a,b);}
      const und=std({color:0x4a4e52,roughness:.8,side:D2}),gap=QK&&a<QK.a&&b>QK.b;   // the underside of the deck; where the Bay Bridge's right-hand lanes fall away it stops at the centre line, so the hole opens onto the water
      if(gap){ribbon(i=>8.5+XW[i],i=>-8.5-XW[i],-6,-6,und,6,a,QK.a);ribbon(i=>8.5+XW[i],i=>-8.5-XW[i],-6,-6,und,6,QK.b,b);ribbon(i=>8.5+XW[i],QK.ls,-6,-6,und,6,QK.a,QK.b);}else ribbon(i=>8.5+XW[i],i=>-8.5-XW[i],-6,-6,und,6,a,b);
      for(let i=a+m(30);i<b-m(20);i+=m(o.pier||60)){if(gap&&i>QK.a-m(12)&&i<QK.b+m(12))continue;const h=45+H[i]-6;B(4,h,15+2*XW[i],mat('pier',{color:0x8a8a84,roughness:.9}),P[i].x,-45+h/2,P[i].z,yaw(i));}
      if(o.truss)for(const[t0,t1,hh]of o.truss){const c0=a+Math.round((b-a)*t0),c1=a+Math.round((b-a)*t1);for(const sd of[-1,1])ribbon(i=>sd*(9.2+XW[i]),i=>sd*(9.2+XW[i]),1.2,hh,trussM,8.3,c0,c1).castShadow=true;ribbon(i=>9.2+XW[i],i=>-9.2-XW[i],hh,hh,trussM,8.3,c0,c1);
        for(let i=c0;i<=c1;i+=8){const g=new THREE.Group();for(const x of[-9.2-XW[i],9.2+XW[i]])B(.55,hh,.55,sm,x,hh/2,0,0,g);B(18.9+2*XW[i],.6,.6,sm,0,hh,0,0,g);g.position.copy(P[i]);g.rotation.y=yaw(i);scene.add(g);}}
      if(!TH)return;const sup=o.sup.map(f=>a+Math.round((b-a)*f));
      const hgt=i=>{let j=0;while(j<sup.length-2&&i>sup[j+1])j++;const ya=j?TH:2,yb=j+1<sup.length-1?TH:2,u=(i-sup[j])/(sup[j+1]-sup[j]),sag=ya===yb?TH-9:16;return ya+(yb-ya)*u-sag*4*u*(1-u);};
      const c0=sup[0],c1=sup[sup.length-1];BRH.push({c0,c1,hgt});
      for(const sd of[-1,1]){const pts=[];for(let i=c0;i<=c1;i+=5)pts.push(off(i,sd*(10.3+XW[i]),hgt(i)));pts.push(off(c1,sd*(10.3+XW[c1]),hgt(c1)));const cb=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),pts.length*3,o.cr||.4,6,false),cableM);cb.castShadow=true;scene.add(cb);}
      const n=c1-c0,cnt=Math.floor(n/6)*2,susp=new THREE.InstancedMesh(cyl(.07,.07,1,5),cableM,cnt);let k=0;for(let i=c0+6;i<c1;i+=6)for(const sd of[-1,1]){const h=hgt(i)-1.2;if(h<1.5||k>=cnt)continue;M4.compose(off(i,sd*(10.3+XW[i]),1.2+h/2,V),Q.identity(),S.set(1,h,1));susp.setMatrixAt(k++,M4);}susp.count=k;scene.add(susp);
      {const cl=new THREE.InstancedMesh(new THREE.SphereGeometry(.32,6,5),lampMat,Math.floor(n/3)*2+4);let c=0;for(let i=c0+3;i<c1;i+=3)for(const sd of[-1,1]){M4.compose(off(i,sd*(10.3+XW[i]),hgt(i)+.6,V),Q.identity(),S.set(1,1,1));cl.setMatrixAt(c++,M4);}cl.count=c;scene.add(cl);}
      const ln=Math.floor((b-a)/22)*2,posts=new THREE.InstancedMesh(new THREE.BoxGeometry(.16,7.5,.16),sm,ln),bulbs=new THREE.InstancedMesh(new THREE.SphereGeometry(.34,8,6),lampMat,ln);k=0;
      for(let i=a+11;i<b&&k<ln;i+=22)for(const sd of[-1,1]){M4.compose(off(i,sd*(8.7+XW[i]),3.75,V),Q.identity(),S.set(1,1,1));posts.setMatrixAt(k,M4);M4.compose(off(i,sd*(8.1+XW[i]),7.5,V),Q,S);bulbs.setMatrixAt(k++,M4);}posts.count=bulbs.count=k;scene.add(posts,bulbs);
      for(const i of sup.slice(1,-1)){const g=new THREE.Group(),deep=45+H[i],xw=XW[i];for(const sd of[-1,1]){B(o.leg||2.6,TH+deep,o.legD||3.6,sm,sd*(10.3+xw),(TH-deep)/2,0,0,g);if(o.deco){for(const y of[TH*.35,TH*.6,TH*.82])B((o.leg||2.6)+.8,3,(o.legD||3.6)+.8,sm,sd*(10.3+xw),y,0,0,g);}}
        for(const y of o.deco?[TH*.34,TH*.59,TH*.81,TH]:[11.5,34,57,TH])B(20.6+2*xw,o.deco?5:2.2,o.deco?3.4:2.8,sm,0,y,0,0,g);
        if(!o.deco){for(const[y0,y1]of[[12.6,33],[35,56],[58,TH-1]])for(const s of[-1,1]){const x=B(Math.hypot(18+2*xw,y1-y0),.9,.9,sm,0,(y0+y1)/2,0,0,g);x.rotation.z=s*Math.atan2(y1-y0,18+2*xw);}}
        for(const sd of[-1,1]){const bc=new THREE.Mesh(new THREE.SphereGeometry(.8,8,6),beacon);bc.position.set(sd*(10.3+xw),TH+3.2,0);g.add(bc);}g.position.copy(P[i]);g.rotation.y=yaw(i);scene.add(g);}};
    let k0=scene.children.length;const grab=k=>{const objs=scene.children.slice(k0),was=new Set(scene.children);bakeStatic(objs,new Set());BTL.br[k]=[...objs.filter(o=>o.parent===scene),...scene.children.filter(o=>!was.has(o))].map(o=>[o,o.position.clone(),o.rotation.z]);k0=scene.children.length;};   // each bridge merged on its own, so the beetle can shake it
    bridge(Z.b0,Z.b1,{col:0x8b9196,TH:80,open:1,sup:[.4,.55,.7,.85,1],truss:[[.004,.36,9.5]],pier:70});grab("bb");
    bridge(Z.gg0,Z.gg1,{col:0xc0392b,cable:0xb8402e,TH:150,sup:[0,.18,.82,1],deco:1,leg:4.2,legD:5,cr:.9,rail:1,pier:90});grab("gg");
    bridge(Z.rb0,Z.rb1,{col:0x8a7f6a,TH:0,truss:[[.17,.39,14],[.58,.77,14]],pier:40});grab("rb");
    // street lights for the freeways and the San Rafael bridge: tall poles with an arm and a cobra head, and under each a pool of light on the road at night
    // (a glow laid on the tarmac, not a real light, so hundreds cost almost nothing). noPost: only the pools, under lamps that are already there.
    const roadLamps=(a,b,step,base,{h=10,arm=2.4,noPost=false,headY=0}={})=>{const ids=[];for(let i=a;i<b;i+=step)ids.push(i);const n=ids.length*2;
      const posts=noPost?null:new THREE.InstancedMesh(new THREE.BoxGeometry(.24,h,.24).translate(0,h/2,0),steelM,n),arms=noPost?null:new THREE.InstancedMesh(new THREE.BoxGeometry(arm,.14,.14).translate(-arm/2,0,0),steelM,n),
        heads=noPost?null:new THREE.InstancedMesh(new THREE.BoxGeometry(1.1,.22,.5),lampMat,n),pools=new THREE.InstancedMesh(new THREE.PlaneGeometry(11,11).rotateX(-Math.PI/2),POOLM,n);let k=0;
      for(const i of ids)for(const sd of[-1,1]){const w=base+XW[i],ry=yaw(i)+(sd>0?0:Math.PI);Q.setFromAxisAngle(YAX,ry);
        if(!noPost){off(i,sd*w,0,V);M4.compose(V,Q,S.set(1,1,1));posts.setMatrixAt(k,M4);V.y+=h;M4.compose(V,Q,S);arms.setMatrixAt(k,M4);off(i,sd*(w-arm),h-.1,V);M4.compose(V,Q,S);heads.setMatrixAt(k,M4);}
        off(i,sd*(w-arm-1.2),.06,V);M4.compose(V,Q.identity(),S.set(1,1,1));pools.setMatrixAt(k++,M4);}
      if(!noPost){posts.castShadow=true;scene.add(posts,arms,heads);}pools.renderOrder=2;scene.add(pools);};
    roadLamps(Z.tu1+m(60),Z.toll-m(60),20,8.6+.4);roadLamps(Z.i80+m(40),Z.wt1-m(80),20,8.6+.4);   // I-880 and I-80
    roadLamps(Z.rb0+4,Z.rb1-4,12,8.7,{h:9,arm:2});                                               // the San Rafael bridge, close together
    roadLamps(Z.b0+11,Z.b1,22,8.1+.5,{noPost:true});roadLamps(Z.gg0+11,Z.gg1,22,8.1+.5,{noPost:true});}   // pools under the lamps the suspension bridges already have

await BOOT.step('SAN FRANCISCO',.55);
  // ---- San Francisco: a dense downtown as you come off the bridge with the pyramid tower ahead, Victorians stepping up Hyde Street with the cable car tracks, the view from the top, Fisherman's Wharf at the bottom, then the Marina
  {skyline(-6330,-5250,330,230,170,230,24);skyline(-6600,-5700,220,160,40,120,24);skyline(-6200,-5820,190,150,45,150,24);skyline(-6210,-5600,215,105,80,140,22);skyline(-6700,-5420,260,120,50,110,22);
    const px=-6230,pz=-5660,py=new THREE.Mesh(new THREE.ConeGeometry(25,255,4),cityMats[4]);py.position.set(px,127.5,pz);py.rotation.y=Math.PI/4;py.castShadow=true;scene.add(py);
    const sp=new THREE.Mesh(new THREE.ConeGeometry(2.6,44,4),std({color:0xd8dadc,metalness:.7,roughness:.3}));sp.position.set(px,267,pz);sp.rotation.y=Math.PI/4;scene.add(sp);for(const s of[-1,1])B(7,88,4,cityMats[4],px+s*8.6,165,pz);const bc=new THREE.Mesh(new THREE.SphereGeometry(1.3,8,6),beacon);bc.position.set(px,290,pz);scene.add(bc);
    // Victorians up and over the hill, stepped like the real ones, bay windows and cornices
    const vt=canvas(128,256,(g,w,h)=>{g.fillStyle='#fff';g.fillRect(0,0,w,h);for(let fl=0;fl<3;fl++){const y=20+fl*78;g.fillStyle='#f4f1e8';g.fillRect(8,y-6,112,4);for(const x of[18,74]){g.fillStyle='#f4f1e8';g.fillRect(x-4,y-4,44,64);g.fillStyle='#2a343c';g.fillRect(x,y,36,56);}}});
    const cols=[0xe6c9a8,0xb8c9d6,0xd8b7b0,0xc9d6c2,0xf0ead8,0xe8dcc0,0xc7c3d8,0x9fb8a8,0xe8b8a0];
    // fewer of them, spaced out, in mixed shapes, colours and heights: Victorians with bay windows, flat-topped apartment blocks, narrow towers with steep roofs, and now and then a crumbled ruin, some still burning
    const char=mat('hydeRuin',{color:0x3a3430,roughness:1}),soot=mat('hydeSoot',{color:0x1c1916,roughness:1}),roofM=mat('hydeRoof',{color:0x4a3c36,roughness:.9});
    for(const sd of[-1,1])for(let i=Z.hyde+m(30+rr(0,15));i<Z.marina-m(30);i+=m(rr(17,28))){if(i>Z.hyde+m(340)&&i<Z.hyde+m(445))continue;   /* open at the crest, for the view */
      const t=rnd(),w=rr(7,12),d=rr(9,12),g=new THREE.Group(),c=pick(cols),mm=mat('vt'+c,{map:vt,color:c,roughness:.85});off(i,sd*(10.2+d/2+XW[i]),0,V);
      if(t<.13){let top=0;for(let q=0;q<3;q++){const hh=rr(2,7)*(q?.7:1),ww=w*rr(.3,.55);top=Math.max(top,hh);B(ww,hh,d*rr(.5,.9),q?soot:char,(q-1)*w*.3,hh/2,rr(-1.5,1.5),rr(-.2,.2),g);}   // a ruin: broken walls and rubble
        B(w*.9,.8,d*.8,soot,0,.4,0,rr(-.3,.3),g);if(rnd()<.6){off(i,sd*(10.2+d/2+XW[i]),top*.6,V2);BURN.push({x:V2.x,y:V2.y,z:V2.z,s:rr(.6,1.1)});}}
      else{const h=t<.55?rr(9,15):t<.82?rr(14,24):rr(16,28),ww=t>=.82?w*.7:w;B(ww,h,d,mm,0,h/2,0,0,g);B(ww+.5,.6,d+.4,white,0,h+.3,0,0,g);
        if(t<.55)B(ww*.45,h*.7,1.4,mm,ww*.2,h*.42,d/2+.6,0,g);   // Victorian bay window
        else if(t>=.82){const r=new THREE.Mesh(new THREE.ConeGeometry(.72,1,4).rotateY(Math.PI/4),roofM);r.scale.set(ww*1.02,rr(4,7),d*1.02);r.position.y=h+.6+r.scale.y/2;r.castShadow=true;g.add(r);}}   // a steep roof on the narrow ones
      B(w+.3,40,d,mat('step',{color:0x9a968c}),0,-20+.05,0,0,g);   // the footing, down the slope of the hill
      g.position.copy(V);g.rotation.y=faceRoad(i,sd);scene.add(g);}
    // the cable car slots and rails: two tracks down the middle of the street, up on the right, down on the left
    const sl=std({color:0x2a2a2a,roughness:.4,metalness:.6});for(const c of[-2.4,2.4])for(const o of[c-.7,c,c+.7])ribbon(o-.05,o+.05,.03,.03,sl,4,Z.hyde+4,Z.marina-m(40));
    // Coit Tower on its hill to the right of the view, Alcatraz straight ahead in the bay, and the Golden Gate off to the left
    const wht=std({color:0xe8e4d6,roughness:.8}),grn=std({color:0x4f6238,roughness:1});const cx=-6000,cz=-6250;
    {const h=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),grn);h.scale.set(110,48,110);h.position.set(cx,-6,cz);scene.add(h);const t=new THREE.Mesh(cyl(5,5.8,52,24),wht);t.position.set(cx,68,cz);t.castShadow=true;scene.add(t);
      const tp=new THREE.Mesh(cyl(5.5,5.5,6,24),wht);tp.position.set(cx,97,cz);scene.add(tp);const t2=new THREE.Mesh(cyl(4.3,4.8,5,24),wht);t2.position.set(cx,102.5,cz);scene.add(t2);}
    {const ax=-6420,az=-7350,crm=std({color:0xd9d2bc,roughness:.9});const r=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),rockM);r.scale.set(160,40,95);r.position.set(ax,-45,az);scene.add(r);
      B(92,13,22,crm,ax-6,-4,az,0.3);B(30,9,16,crm,ax+62,-10,az+14,.3);B(22,8,14,crm,ax-74,-12,az-10,.3);const lt=new THREE.Mesh(cyl(2.2,2.8,24,12),wht);lt.position.set(ax+44,10,az-18);scene.add(lt);const lg=new THREE.Mesh(new THREE.SphereGeometry(1.2,8,6),new THREE.MeshBasicMaterial({color:0xfff2c0}));lg.position.set(ax+44,24,az-18);scene.add(lg);
      const wt2=new THREE.Mesh(cyl(4,4,6,12),std({color:0x8a8d90,roughness:.7}));wt2.position.set(ax-44,14,az+20);scene.add(wt2);}
    // the sign over the bottom of Hyde: Fisherman's Wharf, with the crab
    const ws=canvas(512,512,(g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle='#f4f1e8';g.beginPath();g.arc(256,256,250,0,7);g.fill();g.fillStyle='#1f4f8a';g.beginPath();g.arc(256,256,232,0,7);g.fill();g.fillStyle='#f4f1e8';g.beginPath();g.arc(256,256,150,0,7);g.fill();
      g.fillStyle='#d8452a';g.beginPath();g.ellipse(256,268,70,48,0,0,7);g.fill();for(const s of[-1,1]){g.strokeStyle='#d8452a';g.lineWidth=12;for(let k2=0;k2<3;k2++){g.beginPath();g.moveTo(256+s*55,262+k2*16);g.lineTo(256+s*112,246+k2*26);g.stroke();}
        g.beginPath();g.moveTo(256+s*45,238);g.quadraticCurveTo(256+s*92,196,256+s*70,168);g.stroke();g.beginPath();g.arc(256+s*72,160,20,0,7);g.fill();g.fillStyle='#1c1c1c';g.beginPath();g.arc(256+s*18,236,6,0,7);g.fill();g.fillStyle='#d8452a';}
      g.fillStyle='#f4f1e8';g.font='900 40px Georgia';g.textAlign='center';const txt="FISHERMAN'S WHARF";for(let q=0;q<txt.length;q++){const a=-Math.PI/2+(q-(txt.length-1)/2)*.155;g.save();g.translate(256+Math.cos(a)*192,256+Math.sin(a)*192);g.rotate(a+Math.PI/2);g.fillText(txt[q],0,13);g.restore();}g.font='900 26px Georgia';g.fillText('OF SAN FRANCISCO',256,468);});
    const w0=Z.marina-m(20),wg=new THREE.Group(),disc=new THREE.Mesh(new THREE.CircleGeometry(4.6,40),std({map:ws,emissiveMap:ws,emissive:0xffffff,emissiveIntensity:.3,transparent:true,side:D2,roughness:.7}));disc.position.y=10.2;wg.add(disc);
    for(const x of[-12.6,12.6])B(.4,9,.4,steelM,x,4.5,-.1,0,wg);B(26,.5,.5,steelM,0,6.6,-.1,0,wg);off(w0,0,0,wg.position);wg.rotation.y=yaw(w0)+Math.PI;scene.add(wg);
    // the Marina: a yacht harbour off to the right, a long green, and the rotunda of the old exposition palace on the left
    for(let k=0;k<40;k++){const x=-6600-k*22,z=-6640-rr(0,60),bt=new THREE.Group();B(2.6,1.4,8,white,0,-44,0,0,bt);const ms=new THREE.Mesh(cyl(.06,.08,12,5),white);ms.position.y=-37;bt.add(ms);bt.position.set(x,0,z);bt.rotation.y=rr(-.2,.2);scene.add(bt);}
    flat([[-6500,-6560],[-7300,-6560],[-7300,-6520],[-6500,-6520]],lawnM,.05);
    {const rx=-7150,rz=-6380,ro=mat('rot',{color:0xd8b88a,roughness:.85});const dm=new THREE.Mesh(new THREE.SphereGeometry(18,24,12,0,6.283,0,1.5708),ro);dm.position.set(rx,24,rz);scene.add(dm);const dr=new THREE.Mesh(cyl(18,18,12,24),ro);dr.position.set(rx,18,rz);scene.add(dr);
      for(let k=0;k<16;k++){const a=k/16*6.283,c2=new THREE.Mesh(cyl(1,1.2,14,10),ro);c2.position.set(rx+Math.cos(a)*22,7,rz+Math.sin(a)*22);c2.castShadow=true;scene.add(c2);}}
    // street lamps up and over the hill
    const n=Math.floor((Z.gg0-Z.b1)/12)*2+4,posts=new THREE.InstancedMesh(new THREE.BoxGeometry(.16,7,.16),steelM,n),bulbs=new THREE.InstancedMesh(new THREE.SphereGeometry(.22,8,6),lampMat,n);let k=0;
    for(let i=Z.b1+6;i<Z.gg0-m(320)&&k<n;i+=12)for(const sd of[-1,1]){if(sd>0&&SFX.some(c=>Math.abs(i-c)<8))continue;M4.compose(off(i,sd*(9.9+XW[i]),3.5,V),Q.identity(),S.set(1,1,1));posts.setMatrixAt(k,M4);M4.compose(off(i,sd*(9.3+XW[i]),7,V),Q,S);bulbs.setMatrixAt(k++,M4);}posts.count=bulbs.count=k;scene.add(posts,bulbs);}
  { // ---- hills: a level shelf either side of the road, then a bank running down to the flat ground (Hyde St, the Marin headlands, Shane Drive)
    const grass=std({color:0x5f7239,roughness:1,side:D2}),cg=std({color:0x7a7c78,roughness:.95,side:D2});
    const bank=(a,b,mm,sh,k,sds=[-1,1])=>{for(const sd of sds){ribbon(i=>sd*(9.6+XW[i]),sd*sh,-.03,-.03,mm,8,a,b);ribbon(sd*sh,i=>sd*(sh+H[i]*k),-.03,i=>-H[i],mm,8,a,b);}};
    bank(Z.hyde,Z.marina,cg,30,1.5);bank(Z.gg1-2,Z.sq,grass,40,2.4,[-1]);bank(Z.gg1-2,CLF[0]+1,grass,40,2.4,[1]);bank(CLF[1]-1,Z.sq+m(60),grass,40,2.4,[1]);
    {const vg=std({map:dirtTex,roughness:1,side:D2});for(const sd of[-1,1])ribbon(i=>sd*(RW+XW[i]-.05),i=>sd*(9.7+XW[i]),-.005,-.01,vg,6,Z.gg1-2,Z.sq+m(400));}   // Marin to San Quentin: a dirt verge between the road edge and the grass banks (it used to be an open gap down to the ground below)
    {const rk=std({color:0x5e554a,roughness:1,side:D2}),[c0,c1]=CLF,ft=i=>13+H[i]*.3;   // Marin: on the left a narrow rocky ledge, then a cliff straight down to the rocks and the bay
      ribbon(i=>9.6+XW[i],13,-.03,-.03,rk,8,c0,c1);ribbon(13,ft,-.03,i=>-H[i],rk,6,c0,c1);ribbon(i=>ft(i)-2,i=>ft(i)+150,i=>.35-H[i],i=>.35-H[i],std({color:0x434630,roughness:.12,metalness:.3}),20,c0-40,c1+40);   /* the lake: murky green-brown water below the cliff (LAKE) */
      {const gl=std({color:0x5f7239,roughness:1}),md=std({color:0x5e4e34,roughness:1});ribbon(i=>ft(i)+148,i=>ft(i)+160,i=>.3-H[i],i=>1.1-H[i],md,8,c0-40,c1+40);ribbon(i=>ft(i)+160,i=>ft(i)+700,i=>1.1-H[i],i=>2.5-H[i],gl,20,c0-40,c1+40);   // the far shore: a muddy bank, then meadow
        ribbon(13,i=>ft(i)+700,i=>1.1-H[i],i=>1.1-H[i],gl,20,c0-60,c0+8);ribbon(13,i=>ft(i)+700,i=>1.1-H[i],i=>1.1-H[i],gl,20,c1+2,c1+60);   // and the two ends, closing it in
        const rd=new THREE.InstancedMesh(new THREE.ConeGeometry(.07,1,4).translate(0,.5,0),std({color:0x6a7038,roughness:1}),900);let n=0;
        for(let q=0;q<900;q++){const i=c0+8+Math.floor(Math.random()*(c1-c0-8)),far=q%3>0,lat=far?ft(i)+R(140,152):ft(i)+R(-1,6);off(i,lat,.3-H[i],V);M4.compose(V,Q.setFromAxisAngle(YAX,R(0,6)),S.set(R(.8,1.5),R(1.2,2.6),R(.8,1.5)));rd.setMatrixAt(n++,M4);}rd.count=n;scene.add(rd);   // reeds along both shores
        const tk=new THREE.InstancedMesh(cyl(.3,.45,1,6).translate(0,.5,0),std({color:0x4a3b2e,roughness:1}),50),cr=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),std({color:0x3f5a2c,roughness:.9,flatShading:true}),50);
        for(let q=0;q<50;q++){const i=c0+Math.floor(q/50*(c1-c0)),h=R(6,11);off(i,ft(i)+R(165,260),1.1-H[i],V);M4.compose(V,Q.identity(),S.set(1,h,1));tk.setMatrixAt(q,M4);V.y+=h+1;M4.compose(V,Q.identity(),S.setScalar(R(3,5)));cr.setMatrixAt(q,M4);}scene.add(tk,cr);}   // willows and oaks on the far side
      
      const N=420,im=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),rk,N);let k=0;for(let i=c0;i<=c1&&k<N-1;i+=1)for(let q=0;q<2;q++){const y=Math.random()<.3?-H[i]*Math.random():-H[i];off(i,y>-H[i]?13+(y/-H[i])*(ft(i)-13):ft(i)+R(-1,6),y,V);M4.compose(V,Q.setFromEuler(new THREE.Euler(R(0,3),R(0,3),R(0,3))),S.set(R(1,3),R(.8,2.4),R(1,3)));im.setMatrixAt(k++,M4);}im.count=k;im.castShadow=true;scene.add(im);}bank(Z.richmond,Z.refinery,grass,40,2);}
    if(0){const bs=sign(1024,340,'WELCOME TO THE BADLANDS','#7a3f1e','#d9b48a','900 92px Arial','EST. LONG AGO · ENTER AT YOUR OWN RISK');board(Z.sq+m(350),-12,9,3,bs,0,.05);board(Z.sq+m(365),12,9,3,bs,0,.05);}
    if(0){const P=[['VISIT THE BADLANDS','#f2a63a','#2a1a3a',0],['SEE THE PAINTED ROCKS','#5ab8c8','#3a1a10',1],['BADLANDS: STOP, SNAP A PHOTO!','#e8604a','#fff6d8',2],['GREETINGS FROM THE BADLANDS','#9ac85a','#2a2a10',0]];   // retro tourist posters on the approach: sun, rocks, cactus; some sun-faded, some bullet-pocked
      P.forEach(([t,bg,fg,art],k)=>{const tx=canvas(512,384,(c,w,h)=>{c.fillStyle=bg;c.fillRect(0,0,w,h);c.fillStyle='#ffe9a8';c.beginPath();c.arc(w*.72,h*.38,56,0,7);c.fill();c.fillStyle='#b8532c';c.beginPath();c.moveTo(0,h*.8);c.lineTo(w*.2,h*.45);c.lineTo(w*.32,h*.55);c.lineTo(w*.5,h*.3);c.lineTo(w*.7,h*.8);c.lineTo(w,h*.62);c.lineTo(w,h);c.lineTo(0,h);c.fill();c.fillStyle='#8a3a1e';for(let y=h*.5;y<h*.9;y+=14)c.fillRect(w*.25,y,w*.35,3);
          c.fillStyle='#3a6a2a';c.fillRect(w*.8,h*.62,12,h*.2);c.fillRect(w*.8-14,h*.68,14,8);c.fillRect(w*.8-14,h*.62,8,14);c.fillRect(w*.8+12,h*.7,14,8);
          c.fillStyle=fg;c.font='900 '+(t.length>20?34:44)+'px Arial Black,Arial';c.textAlign='center';c.fillText(t,w/2,h*.14,480);
          if(k%2===0){c.fillStyle='rgba(235,225,200,.4)';c.fillRect(0,0,w,h);}   // sun-faded
          if(k%2===1)for(let b=0;b<7;b++){c.fillStyle='#0c0b0a';c.beginPath();c.arc(Math.random()*w,Math.random()*h,3+Math.random()*3,0,7);c.fill();}   // bullet holes
        });board(Z.sq+m(110+k*60),(k%2?1:-1)*12.5,5.4,4,tx,0,.05);});}
    {const w1=canvas(512,384,(c,w,h)=>{c.fillStyle='#f6c81c';c.fillRect(0,0,w,h);c.strokeStyle='#111';c.lineWidth=10;c.strokeRect(8,8,w-16,h-16);c.fillStyle='#111';c.font='900 58px Arial Black,Arial';c.textAlign='center';c.fillText('WARNING',w/2,72);
        c.font='900 34px Arial Black,Arial';c.fillText('YOU ARE APPROACHING',w/2,118,470);c.fillText('A FEDERAL PRISON',w/2,158,470);
        c.fillRect(w/2-90,300,180,12);c.fillRect(w/2-20,200,40,100);c.fillRect(w/2-34,176,68,28);c.beginPath();c.moveTo(w/2-44,176);c.lineTo(w/2,150);c.lineTo(w/2+44,176);c.fill();   // a generic guard tower
        for(let x=w/2-140;x<=w/2-60;x+=20)c.fillRect(x,190,8,110);for(let x=w/2+60;x<=w/2+140;x+=20)c.fillRect(x,190,8,110);c.fillRect(w/2-150,190,100,8);c.fillRect(w/2+50,190,100,8);prisonSeal(c,62,326,42);prisonRunner(c,452,318,.5);}),   // and cell bars either side; the seal and a running prisoner
        w2=canvas(512,384,(c,w,h)=>{c.fillStyle='#f4f1e8';c.fillRect(0,0,w,h);c.strokeStyle='#c8241c';c.lineWidth=12;c.strokeRect(8,8,w-16,h-16);c.fillStyle='#d8261c';c.font='900 70px Arial Black,Arial';c.textAlign='center';c.fillText('DO NOT',320,125,330);c.fillText('STOP FOR',320,215,330);c.fillText('PRISONERS',320,305,330);prisonRunner(c,95,140,.95,'#d8261c');prisonSeal(c,95,298,56);});
      board(Z.sq-m(300),12.5,5.6,4.2,w1,0,.05);board(Z.sq-m(150),12.5,5.6,4.2,w2,0,.05);}
    {const RS=[['DANGER','FLAMMABLE VAPOURS','w'],['VOLTEX','SYNTHETIC MOTOR OIL','p'],['NO STOPPING','REFINERY ZONE','w'],['SLICKO','PETROLEUM JELLY · SOFT AS SIN','p'],['AUTHORIZED','VEHICLES ONLY','w'],['KRONOS PREMIUM','UNLEADED · FUELING THE BAY','p'],['RICHMOND REFINING','FUELING THE BAY · SINCE 1902','p']];   // ominous refinery warnings and invented petroleum brands, some dim and sooty
      RS.forEach(([a1,a2,ty],k)=>{const tx=canvas(512,256,(c,w,h)=>{const wr=ty==='w';c.fillStyle=wr?'#e8b81c':'#1a0f0e';c.fillRect(0,0,w,h);c.strokeStyle=wr?'#111':'#c8241c';c.lineWidth=10;c.strokeRect(8,8,w-16,h-16);
          if(wr){c.fillStyle='#111';for(let x=-40;x<w;x+=50){c.beginPath();c.moveTo(x,h-36);c.lineTo(x+25,h-36);c.lineTo(x+45,h-8);c.lineTo(x+20,h-8);c.fill();}}else{c.fillStyle='#c8241c';c.beginPath();c.moveTo(70,170);c.quadraticCurveTo(40,110,70,60);c.quadraticCurveTo(100,110,70,170);c.fill();}
          c.fillStyle=wr?'#111':'#f2e6c8';c.font='900 '+(a1.length>12?40:60)+'px Arial Black,Arial';c.textAlign='center';c.fillText(a1,w*(wr?.5:.58),100,wr?470:380);c.font='900 26px Arial Black,Arial';c.fillStyle=wr?'#8a1010':'#ffb02a';c.fillText(a2,w*(wr?.5:.58),160,wr?470:380);
          for(let q=0;q<(k%2?160:60);q++){c.fillStyle='rgba(10,8,6,'+(.1+Math.random()*.2)+')';c.fillRect(Math.random()*w,Math.random()*h,2+Math.random()*10,2+Math.random()*30);}if(k%3===1){c.fillStyle='rgba(0,0,0,.35)';c.fillRect(0,0,w,h);}});   // soot stains, a few dimmed
        board(Z.rb1+m(140+k*130),(k%2?1:-1)*12.5,5.2,2.6,tx,0,.05);});}
    {const asp=std({color:0x3a3b3e,roughness:.95}),wal=std({color:0xd8cdb4,roughness:.9}),wal2=std({color:0x8a3a2a,roughness:.85}),stl=std({color:0x9aa0a4,metalness:.6,roughness:.4}),glw=std({color:0x1f2a30,roughness:.1,metalness:.4}),
        lit=(w,h,fn)=>new THREE.MeshBasicMaterial({map:canvas(w,h,fn),side:THREE.DoubleSide}),
        site=(i,sd,fn)=>{const g=new THREE.Group();off(i,sd*(RW+XW[i]+18),0,V);g.position.set(V.x,H[i]-.05,V.z);g.rotation.y=faceRoad(i,sd);fn(g);g.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});scene.add(g);};   // local +z faces the road; the building stands behind a paved forecourt (Shane Drive, before the I-80 ramp)
      const i0=Z.shane+m(260);
      site(i0,1,g=>{B(40,.06,26,asp,0,.03,-3,0,g);B(18,.5,11,wal,0,5.2,4,0,g);for(const x of[-7,7])for(const z of[1,7])B(.4,5,.4,stl,x,2.5,z,0,g);for(const x of[-4.5,4.5])B(.7,1.5,.6,wal2,x,.75,4,0,g);   // a gas station: canopy, pumps and a little shop
        B(12,3.8,6,wal,0,1.9,-12,0,g);B(8,1.6,.1,glw,0,1.9,-8.95,0,g);B(18.3,.7,11.3,wal2,0,5.7,4,0,g);
        B(.5,9,.5,stl,16,4.5,2,0,g);const ps=new THREE.Mesh(new THREE.BoxGeometry(4.6,5.4,.5),lit(256,300,(c,w,h)=>{c.fillStyle='#1a1a1a';c.fillRect(0,0,w,h);c.fillStyle='#d8261c';c.fillRect(0,0,w,70);c.fillStyle='#fff';c.font='900 40px Arial Black,Arial';c.textAlign='center';c.fillText('GASCO',w/2,52);c.fillStyle='#ffe23a';c.font='900 34px Arial';c.fillText('REGULAR 5.19',w/2,130);c.fillText('PREMIUM 5.69',w/2,190);c.fillText('DIESEL 5.99',w/2,250);}));ps.position.set(16,9.8,2);g.add(ps);});
      site(Z.shane+m(500),1,g=>{B(70,.06,34,asp,0,.03,-6,0,g);B(40,7.5,22,wal,0,3.75,-26,0,g);B(40.6,.8,22.6,wal2,0,7.9,-26,0,g);B(16,3.2,.1,glw,-8,2,-14.95,0,g);B(8,3.6,.2,glw,12,2,-14.95,0,g);   // a supermarket: a low box with a big lit sign and a car park
        const sg=new THREE.Mesh(new THREE.PlaneGeometry(26,6),lit(1024,240,(c,w,h)=>{c.fillStyle='#1f6a3a';c.fillRect(0,0,w,h);c.fillStyle='#fff';c.font='900 130px Arial Black,Arial';c.textAlign='center';c.textBaseline='middle';c.fillText('SUPERMARKET',w/2,h/2+6,980);}));sg.position.set(0,11.5,-14.8);g.add(sg);B(.4,4.5,.4,stl,-12,9.3,-15,0,g);B(.4,4.5,.4,stl,12,9.3,-15,0,g);
        for(let k=-3;k<=3;k++)B(.15,.02,5,std({color:0xe8e4d6}),k*5,.08,2,0,g);});
      site(Z.shane+m(740),1,g=>{B(40,.06,26,asp,0,.03,-3,0,g);B(15,4.6,10,wal,0,2.3,-13,0,g);B(15.6,.9,10.6,wal2,0,4.9,-13,0,g);B(10,1.8,.1,glw,0,2.3,-7.95,0,g);   // a fast-food restaurant with a drive-through lane and a tall lit pole sign
        B(5,.04,24,asp,-13,.08,-6,0,g);B(1.2,1.6,.8,stl,-9.6,.9,-8,0,g);B(.6,10,.6,stl,14,5,0,0,g);
        const bs=new THREE.Mesh(new THREE.BoxGeometry(5.4,5.4,.5),lit(256,256,(c,w,h)=>{c.fillStyle='#c8241c';c.fillRect(0,0,w,h);c.fillStyle='#e8a43a';c.beginPath();c.ellipse(128,90,70,40,0,Math.PI,0);c.fill();c.fillStyle='#4a2a1a';c.fillRect(58,92,140,16);c.fillStyle='#5aa83a';c.fillRect(54,108,148,8);c.fillStyle='#e8a43a';c.fillRect(60,116,136,18);c.fillStyle='#ffe23a';c.font='900 38px Arial Black,Arial';c.textAlign='center';c.fillText('BURGER BARON',w/2,186,236);c.font='700 26px Arial';c.fillStyle='#fff';c.fillText('DRIVE-THRU',w/2,230);}));bs.position.set(14,10.6,0);g.add(bs);});}
    {const a=Z.i80,b=Z.emeryville-m(250),wt=canvas(256,256,(c,w,h)=>{c.fillStyle='#34373a';c.fillRect(0,0,w,h);for(let k=0;k<110;k++){c.strokeStyle=k%3?'rgba(120,126,130,.3)':'rgba(235,240,240,.55)';c.lineWidth=1+Math.random()*2;const x=Math.random()*w,y=Math.random()*h;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+20,y-8,x+44,y);c.stroke();}});   // a stormy sea down the whole right-hand side of I-80 to Berkeley: dark grey-green, whitecaps, ships bobbing
      wt.wrapS=wt.wrapT=THREE.RepeatWrapping;STORM.tex=wt;STORM.a=a;STORM.b=b;ribbon(i=>-RW-XW[i]-26,i=>-RW-XW[i]-520,i=>-H[i]+.1,i=>-H[i]+.1,new THREE.MeshStandardMaterial({map:wt,color:0x9a9ea2,roughness:.5,metalness:.2,side:THREE.DoubleSide}),30,a,b);
      {const N=90,cr=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1).translate(0,.5,0),std({color:0xd8dcdc,roughness:.7}),N),bd=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1).translate(0,.5,0),std({color:0x2c2f32,roughness:.6}),N);cr.frustumCulled=bd.frustumCulled=false;   // big rolling swells with white crests, marching in toward the freeway
        STORM.wv={cr,bd,l:Array.from({length:N},()=>({i:a+Math.floor(Math.random()*(b-a)),ph:Math.random(),L:rr(18,42),sp:rr(.05,.09)}))};scene.add(cr,bd);}
      const hull=std({color:0x2a2c30,roughness:.8}),red=std({color:0x8a2a22,roughness:.8}),wht=std({color:0xe4e4e0,roughness:.7}),blu=std({color:0x2a4a6a,roughness:.8});
      for(let k=0;k<16;k++){const i=a+m(60+k*(b-a>0?(b-a)*SEG/17:150)),lat=-(RW+XW[i]+rr(70,330)),tk=k%5===0,g=new THREE.Group();   // a tanker every fifth ship, otherwise a trawler or a small boat
        if(tk){B(8,5,46,k%2?hull:red,0,1.6,0,0,g);B(7,6,8,wht,0,6,-17,0,g);B(2,3,2,red,0,10,-17,0,g);}else{const sc=k%3===0?.6:1;B(3.2*sc,1.6*sc,10*sc,k%2?blu:red,0,.5,0,0,g);B(2.4*sc,2.2*sc,3*sc,wht,0,2,-1.5*sc,0,g);const mast=new THREE.Mesh(cyl(.08,.1,7*sc,5),hull);mast.position.set(0,4.5*sc,2.5*sc);g.add(mast);B(.12,.12,3*sc,hull,0,6*sc,2.5*sc,0,g).rotation.z=Math.PI/2;}
        off(i,lat,0,V);g.position.set(V.x,.1,V.z);g.rotation.y=yaw(i)+rr(-.6,.6);g.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(g);STORM.ships.push({g,ph:rr(0,6.3),sp:rr(.8,1.4),am:tk?.02:.07,smoke:!tk&&k%2===0});if(tk)OILX.push({g,y:4.5,L:40,s:.55});}}
    { // far across the bay, seen from I-80 only: San Francisco's skyline, the Bay Bridge running out to it, the Golden Gate beyond, the freeway maze stacked up ahead on the left,
      // and shafts of sun through the storm. Low-detail, fog-free silhouettes tinted by the haze every frame; the layer drifts slowly with the car (bayTick), so it always stays far off
      const g=new THREE.Group(),mats=[],mk=(tint,k)=>{const mm=new THREE.MeshBasicMaterial({color:tint,fog:false});mm.userData={tint:new THREE.Color(tint),k};mats.push(mm);return mm;};
      const bld=mk(0x283038,.55),bld2=mk(0x3e4650,.42),red=mk(0xa83a24,.6),brg=mk(0x4a5058,.5),hwy=mk(0x8c8a84,.4),hwy2=mk(0x5a5c60,.45);
      const bx=(w,h,d,mm,x,y,z,ry=0)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mm);o.position.set(x,y,z);o.rotation.y=ry;g.add(o);return o;};
      for(let k=0;k<48;k++){const x=rr(-1900,-1420),z=rr(2120,2480),c=1-Math.min(1,Math.hypot(x+1650,z-2300)/300),h=rr(20,50)+c*rr(30,150),w=rr(18,40);bx(w,h,rr(18,40),k%3?bld:bld2,x,h/2,z);}   // the city: a spread of towers, tallest in the middle
      bx(36,260,36,bld,-1630,130,2290);{const py=new THREE.Mesh(new THREE.ConeGeometry(24,210,4),bld2);py.position.set(-1700,105,2250);g.add(py);}
      const span=(ax,az,bx_,bz,y,mm,th)=>{const L=Math.hypot(bx_-ax,bz-az);bx(th,th*.8,L,mm,(ax+bx_)/2,y,(az+bz)/2,Math.atan2(bx_-ax,bz-az));};
      const cable=(pts,mm,r)=>{const o=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),40,r,4),mm);g.add(o);};
      // the Bay Bridge: a long deck from the Oakland shore out to the city, its western half hung from two tall towers
      {const A=[-760,1250],Bq=[-1420,2260],L=(u,y)=>[lerp(A[0],Bq[0],u),y,lerp(A[1],Bq[1],u)];span(A[0],A[1],Bq[0],Bq[1],38,brg,9);
        for(let u=.04;u<.5;u+=.06){const p=L(u,0);bx(5,38,5,brg,p[0],19,p[2]);}   // the eastern viaduct on piers
        const tw=[.62,.86];for(const u of tw){const p=L(u,0);bx(7,150,7,brg,p[0],75,p[2]);}
        const cp=[];for(let k=0;k<=24;k++){const u=.5+k/24*.5,a=(u-.62)/.24,y=u<.62?lerp(42,150,(u-.5)/.12)**1:u<.86?150-90*4*a*(1-a):lerp(150,42,(u-.86)/.14);cp.push(L(u,y));}cable(cp,brg,1.6);}
      // the Golden Gate, red, far off to the right: two towers, the deck and the sweep of the main cables
      {const A=[-2080,1950],Bq=[-2180,2420],L=(u,y)=>[lerp(A[0],Bq[0],u),y,lerp(A[1],Bq[1],u)];span(A[0],A[1],Bq[0],Bq[1],60,red,8);
        for(const u of[.25,.75]){const p=L(u,0),ry=Math.atan2(Bq[0]-A[0],Bq[1]-A[1]);for(const sd of[-1,1])bx(5,190,5,red,p[0]+Math.cos(ry)*sd*6,95,p[2]-Math.sin(ry)*sd*6,ry);bx(16,6,5,red,p[0],170,p[2],ry+Math.PI/2);}
        const cp=[];for(let k=0;k<=30;k++){const u=k/30;let y;if(u<.25)y=lerp(62,185,u/.25);else if(u<.75){const a=(u-.25)/.5;y=185-118*4*a*(1-a);}else y=lerp(185,62,(u-.75)/.25);cp.push(L(u,y));}cable(cp,red,2);
        const hl=new THREE.Mesh(new THREE.SphereGeometry(1,16,8),bld2);hl.scale.set(260,90,320);hl.position.set(-2250,-20,1720);g.add(hl);}   // the Marin headlands behind its north end
      // the maze: curving freeway ramps stacked three high, on tall piers
      {const cx=280,cz=1700;[[14,380,.3,1.9,hwy],[25,300,2.4,2.0,hwy2],[36,420,4.1,1.5,hwy],[18,240,5.0,1.6,hwy2]].forEach(([y,r,t0,tl,mm])=>{
          const d=new THREE.Mesh(new THREE.RingGeometry(r-9,r,40,1,t0,tl).rotateX(-Math.PI/2),mm);d.material.side=THREE.DoubleSide;d.position.set(cx,y,cz);g.add(d);
          const f=new THREE.Mesh(new THREE.CylinderGeometry(r,r,2.2,40,1,true,t0+Math.PI/2,tl),mm);f.material.side=THREE.DoubleSide;f.position.set(cx,y-1,cz);f.scale.x=-1;g.add(f);
          for(let k=0;k<=6;k++){const a=t0+tl*k/6,x=cx+Math.cos(a)*(r-4.5),z=cz-Math.sin(a)*(r-4.5);bx(3,y,3,mm,x,y/2,z);}});
        span(cx-380,cz-250,cx+120,cz+420,30,hwy,9);span(cx-420,cz+120,cx+420,cz-60,20,hwy2,9);}
      // shafts of sun breaking through the storm, out over the water ahead on the right
      const rt=canvas(64,256,(c,w,h)=>{const gr=c.createLinearGradient(0,0,w,0);gr.addColorStop(0,'rgba(255,240,200,0)');gr.addColorStop(.5,'rgba(255,240,200,1)');gr.addColorStop(1,'rgba(255,240,200,0)');c.fillStyle=gr;c.fillRect(0,0,w,h);c.globalCompositeOperation='destination-in';const gv=c.createLinearGradient(0,0,0,h);gv.addColorStop(0,'rgba(0,0,0,0)');gv.addColorStop(.25,'rgba(0,0,0,.7)');gv.addColorStop(1,'rgba(0,0,0,1)');c.fillStyle=gv;c.fillRect(0,0,w,h);}),rays=[];
      for(let k=0;k<4;k++){const m2=new THREE.MeshBasicMaterial({map:rt,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,color:0xffe6b8}),o=new THREE.Mesh(new THREE.PlaneGeometry(rr(120,220),900).translate(0,450,0),m2);
        o.position.set(rr(-1450,-900),0,rr(1300,2000));o.rotation.order='YXZ';o.rotation.z=rr(-.18,.08);g.add(o);rays.push({m:o,o:rr(.25,.45),ph:rr(0,6)});}
      g.visible=false;scene.add(g);BAYV={g,mats,rays};}
    {// badlands past San Quentin: banded mud hills in yellow, rust, purple and blue-grey with ridged fans (vertex colours, one mesh per side)
    {// plain desert between San Quentin and the badlands: sand, cacti, tombstones, skeletons (three instanced meshes)
      const d0=Z.sq+m(40),d1=Z.sq+m(340),sand=std({color:0xc9aa72,roughness:1,side:D2});for(const sd of[-1,1])ribbon(i=>sd*(9.6+XW[i]),sd*120,-.03,-.05,sand,12,d0,d1);
      const geos=[[new THREE.CylinderGeometry(.5,.6,4,6),std({color:0x4f7a3c,roughness:1}),22,2],[new THREE.BoxGeometry(1,1.5,.3),std({color:0x8f8f88,roughness:1}),16,.75],[new THREE.SphereGeometry(.45,6,4),std({color:0xe8e2cf,roughness:1}),10,.3]];
      for(const[g,mt,N,hy]of geos){const im=new THREE.InstancedMesh(g,mt,N);for(let k=0;k<N;k++){const i=d0+m(10)+(Math.random()*(d1-d0-m(20))|0);off(i,(Math.random()<.5?-1:1)*R(14,60),hy,V);M4.compose(V,Q.setFromEuler(new THREE.Euler(0,R(0,6),g.type==='SphereGeometry'?0:R(-.1,.1))),S.set(1,hy===2?R(.7,1.4):1,1));im.setMatrixAt(k,M4);}im.castShadow=true;scene.add(im);}}
      const BC=[0xe3b04a,0xb4562f,0x7d5a86,0x7f93a8,0xd9a066,0xa04a3a].map(h=>new THREE.Color(h)),a0=Z.sq+m(340),a1=Z.rb0-m(200),LN=12,tc=new THREE.Color(),pos=[],col=[],idx=[];
      for(const sd of[]){pos.length=0;col.length=0;   // owner 2026-11-20: badlands hills removed so San Quentin stands out
      idx.length=0;let n=0;
        for(let i=a0;i<=a1;i+=2){const e=sst(i,a0,a0+m(80))*(1-sst(i,a1-m(80),a1));
          for(let j=0;j<=LN;j++){const t=j/LN,lat=sd*(32+t*t*150),rd=Math.sin(i*.9+j*1.7)*.5+Math.sin(i*.31-j*.8)*.5,y=t<.1?-.03:e*(10+17*(1+Math.sin(i*.07+sd))+Math.abs(rd)*7)*Math.pow(t,.8)-.03;
            off(i,lat,y,V);pos.push(V.x,V.y,V.z);const bnd=y*.55+rd*.6+i*.013+Math.floor(j/2)*.4,k=Math.floor(Math.abs(bnd))%BC.length;tc.copy(BC[k]).lerp(BC[(k+1)%BC.length],(Math.abs(bnd)%1>.8)?.5:0);if(y<.5)tc.set(0x8a7a4e);col.push(tc.r,tc.g,tc.b);}
          if(i+2<=a1){for(let j=0;j<LN;j++){const q=n*(LN+1)+j;idx.push(q,q+1,q+LN+1,q+1,q+LN+2,q+LN+1);}}n++;}
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos.slice(),3));g.setAttribute('color',new THREE.Float32BufferAttribute(col.slice(),3));g.setIndex(idx.slice());g.computeVertexNormals();
        const mh=new THREE.Mesh(g,std({vertexColors:true,roughness:1,flatShading:true,side:D2}));mh.receiveShadow=true;scene.add(mh);}}

await BOOT.step('THE MARIN REDWOODS',.63);
  // ---- Marin: a redwood forest - tall red trunks and dark spires all round, ferns on the floor - then San Quentin by the water
  {const N=1500,bark=std({color:0x7a3e26,roughness:1,map:canvas(64,256,(g,w,h)=>{g.fillStyle='#fff';g.fillRect(0,0,w,h);for(let i=0;i<200;i++){g.fillStyle=Math.random()<.5?'rgba(40,16,8,.4)':'rgba(255,220,200,.25)';g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*3,20+Math.random()*60);}})});
    const trunk=new THREE.InstancedMesh(cyl(.35,1,1,9),bark,N),cone=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,8),std({color:0x24402a,roughness:1}),N*3);let k=0,c=0;
    for(let i=Z.gg1+m(160);i<Z.sq-m(200)&&k<N;i+=2){for(let q=0;q<2&&k<N;q++){const sd=rnd()<.5?-1:1,lat=sd*(11.5+Math.pow(rnd(),1.4)*120);off(i,lat,0,V);if(i>=Z.sq-m(610)||!farFromRoad(V.x,V.z,10.5)||(sd>0&&i>CLF[0]-50&&i<CLF[1]+50))continue;V.y=groundNear(V.x,V.z);const wet=V.y<.3&&Terrain.landAt(V.x,V.z)<.2?0:1;
      const h=rr(45,85),r=rr(1,2.3);M4.compose(V2.set(V.x,V.y+h/2-2,V.z),Q.identity(),S.set(r,h,r).multiplyScalar(wet));trunk.setMatrixAt(k++,M4);
      for(let j=0;j<3;j++){const ch=h*rr(.25,.38),cy=V.y+h*(.55+j*.17);M4.compose(V2.set(V.x,cy,V.z),Q.setFromAxisAngle(YAX,rr(0,6)),S.set(r*rr(3.5,5)*(1-j*.22),ch,r*rr(3.5,5)*(1-j*.22)).multiplyScalar(wet));cone.setMatrixAt(c++,M4);}}}
    trunk.count=k;cone.count=c;trunk.castShadow=cone.castShadow=true;scene.add(trunk,cone);
    const fern=new THREE.InstancedMesh(mergeGeometries([new THREE.PlaneGeometry(1.6,1).translate(0,.5,0),new THREE.PlaneGeometry(1.6,1).translate(0,.5,0).rotateY(Math.PI/2)]),std({map:tuftTex,alphaTest:.4,side:D2,roughness:1,color:0x4a7a3a}),2500);k=0;
    for(let q=0;q<2500;q++){const i=Z.gg1+m(160)+(rnd()*(Z.sq-Z.gg1-m(360))|0),lat=(rnd()<.5?-1:1)*rr(10,60);if(i>=Z.sq-m(610)||(lat>0&&i>CLF[0]-50&&i<CLF[1]+50))continue;off(i,lat,0,V);V.y=groundNear(V.x,V.z);M4.compose(V,Q.setFromAxisAngle(YAX,rr(0,6)),S.setScalar(rr(.8,1.6)));fern.setMatrixAt(k++,M4);}fern.count=k;scene.add(fern);
    {// bears in the redwoods near the entrance: some peep out from behind a trunk to see what is going on, some climb up a trunk (BEARS, animated in bearsTick)
      const fur=std({color:0x4a3322,roughness:1}),fur2=std({color:0x6a4a30,roughness:1}),nose=std({color:0x14100c,roughness:.5}),bk=std({color:0x6a3a22,roughness:1}),tg=new THREE.Vector3(),bs=new THREE.SphereGeometry(1,10,8);
      const mkBear=()=>{const g=new THREE.Group(),P_=(geo,mt,x,y,z,sx,sy,sz)=>{const o=new THREE.Mesh(geo,mt);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;g.add(o);return o;};
        P_(bs,fur,0,.95,0,.62,.55,.95);const hd=new THREE.Group();hd.position.set(0,1.15,.9);g.add(hd);const H=(geo,mt,x,y,z,sx,sy,sz)=>{const o=new THREE.Mesh(geo,mt);o.position.set(x,y,z);o.scale.set(sx,sy,sz);hd.add(o);};
        H(bs,fur,0,0,0,.34,.32,.34);H(bs,fur2,0,-.1,.28,.17,.13,.2);H(bs,nose,0,-.05,.45,.06,.05,.05);for(const s of[-1,1]){H(bs,fur,s*.24,.26,-.04,.1,.1,.06);H(bs,nose,s*.13,.08,.3,.035,.035,.03);}
        for(const[x,z]of[[-.4,.55],[.4,.55],[-.4,-.55],[.4,-.55]])P_(new THREE.BoxGeometry(.24,.7,.26),fur,x,.35,z,1,1,1);
        g.scale.setScalar(1.7);g.hd=hd;return g;};
      const nb=11;for(let q=0;q<nb;q++){const i=Z.gg1+m(170+q*85+Math.random()*40),sd=(q%3===1&&i>CLF[0]-50&&i<CLF[1]+50)?-1:(Math.random()<.5?-1:1);if(sd>0&&i>CLF[0]-50&&i<CLF[1]+50)continue;
        off(i,sd*R(12.2,14),0,V);V.y=groundNear(V.x,V.z);const tx=V.x,ty=V.y,tz=V.z,n=Nn[i],tn=T[i],climb=q%2===1,tr=new THREE.Mesh(cyl(1.35,1.6,40,10),bk);tr.position.set(tx,ty+20,tz);tr.castShadow=true;scene.add(tr);
        const g=mkBear(),pv=new THREE.Group();pv.add(g);scene.add(pv);BEARS.push({g:pv,b:g,climb,tx,ty,tz,nx:n.x*sd,nz:n.z*sd,tx2:tn.x,tz2:tn.z,ph:R(0,6.3),sd});}
    }
    {// the open field before the prison (the redwoods stop at the banked bend): tall grass, water buffalo grazing on the left, and more prison warnings
      const gs=std({color:0xffffff,roughness:1,side:D2}),gr=new THREE.InstancedMesh(new THREE.ConeGeometry(.28,1,4).translate(0,.5,0),gs,1500);let gk=0;const a0=Z.sq-m(590),a1=Z.sq-m(40),gc=[0x8a8a3a,0x9a9a48,0x7a8a3a,0xa8a050];
      for(let q=0;q<1500;q++){const i=a0+Math.floor(Math.random()*(a1-a0)),sd=Math.random()<.6?1:-1;if(sd>0&&i<CLF[1]+45)continue;off(i,sd*R(11,sd>0?75:40),0,V);V.y=groundNear(V.x,V.z);M4.compose(V,Q.setFromAxisAngle(YAX,R(0,6.3)),S.set(R(.9,1.6),R(1.1,2.1),R(.9,1.6)));gr.setMatrixAt(gk,M4);gr.setColorAt(gk++,new THREE.Color(gc[q%4]));}gr.count=gk;scene.add(gr);
      const bm=std({color:0x2c2622,roughness:1}),hm=std({color:0xd8d0b8,roughness:.6}),bg=new THREE.SphereGeometry(1,10,8);
      for(let q=0;q<9;q++){const i=a0+m(30+q*52)+Math.floor(Math.random()*m(20));off(i,R(18,60),0,V);V.y=groundNear(V.x,V.z);const g=new THREE.Group(),B_=(geo,mt,x,y,z,sx,sy,sz,p=g)=>{const o=new THREE.Mesh(geo,mt);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;p.add(o);return o;};
        B_(bg,bm,0,1.15,0,.62,.62,1.05);B_(bg,bm,0,1.55,.45,.55,.45,.5);const hd=new THREE.Group();hd.position.set(0,1.1,1.05);g.add(hd);B_(bg,bm,0,0,.1,.3,.33,.4,hd);for(const s of[-1,1]){const h=B_(new THREE.ConeGeometry(.07,.8,6),hm,s*.36,.12,.05,1,1,1,hd);h.rotation.z=-s*1.15;}
        for(const[x,z]of[[-.35,.6],[.35,.6],[-.35,-.6],[.35,-.6]])B_(new THREE.BoxGeometry(.22,.9,.24),bm,x,.45,z,1,1,1);
        g.position.copy(V);g.rotation.y=R(0,6.3);g.scale.setScalar(1.4);scene.add(g);BUFF.push({g,hd,ph:R(0,6.3)});}
      const wF=canvas(512,384,(c,w,h)=>{c.fillStyle='#f6c81c';c.fillRect(0,0,w,h);c.strokeStyle='#111';c.lineWidth=10;c.strokeRect(8,8,w-16,h-16);c.fillStyle='#111';c.font='900 52px Arial Black,Arial';c.textAlign='center';c.fillText('WARNING',w/2,76);c.font='900 36px Arial Black,Arial';c.fillText('ENTERING A',w/2,132,470);c.fillText('FEDERAL PRISON',w/2,178,470);c.fillText('SECURE ZONE',w/2,224,470);c.font='900 25px Arial';c.fillText('NO STOPPING',w/2,292,250);c.fillText('NO HITCHHIKERS',w/2,326,250);prisonSeal(c,82,302,56);prisonRunner(c,436,312,.62);}),
        wB=canvas(512,384,(c,w,h)=>{c.fillStyle='#f4f1e8';c.fillRect(0,0,w,h);c.strokeStyle='#c8241c';c.lineWidth=14;c.strokeRect(8,8,w-16,h-16);c.fillStyle='#d8261c';c.font='900 64px Arial Black,Arial';c.textAlign='center';c.fillText('BEWARE OF',335,120,320);c.fillText('ESCAPED',335,205,320);c.fillText('PRISONERS',335,290,320);
          c.font='700 20px Arial';c.fillStyle='#1c2f5a';c.fillText('BY ORDER OF THE BUREAU',335,334,320);prisonRunner(c,100,140,1,'#d8261c');prisonSeal(c,100,296,60);});   // a running prisoner and the (invented) federal seal
      board(Z.sq-m(560),12.5,5.6,4.2,wF,0,.05);board(Z.sq-m(450),-12.5,5.6,4.2,wF,0,.05);board(Z.sq-m(380),12.5,5.6,4.2,wB,0,.05);board(Z.sq-m(230),-12.5,5.6,4.2,wB,0,.05);board(Z.sq-m(80),12.5,5.6,4.2,wB,0,.05);
      // STEEP CLIFF: yellow warning boards before the road runs out along the cliff edge (a car going over the edge into the water)
      const wC=canvas(512,384,(c,w,h)=>{c.fillStyle='#f6c81c';c.fillRect(0,0,w,h);c.strokeStyle='#111';c.lineWidth=10;c.strokeRect(8,8,w-16,h-16);c.fillStyle='#111';
        c.beginPath();c.moveTo(60,120);c.lineTo(250,120);c.lineTo(262,140);c.lineTo(255,175);c.lineTo(268,215);c.lineTo(60,215);c.closePath();c.fill();   // the clifftop and its broken face
        c.lineWidth=6;c.strokeStyle='#111';for(let k=0;k<3;k++){c.beginPath();for(let x=280;x<=460;x+=10)c.lineTo(x,200+k*16+Math.sin(x*.12+k)*4);c.stroke();}   // the water below
        c.save();c.translate(330,120);c.rotate(.75);c.fillRect(-40,-14,80,26);c.fillRect(-24,-30,44,18);c.beginPath();c.arc(-24,14,11,0,7);c.arc(24,14,11,0,7);c.fill();c.restore();   // a car tipping over
        c.font='900 78px Arial Black,Arial';c.textAlign='center';c.fillText('STEEP CLIFF',w/2,298,470);c.font='900 30px Arial';c.fillText('DROP-OFF · KEEP RIGHT',w/2,346,470);});
      board(CLF[0]-m(330),-12.5,5.6,4.2,wC,0,.05);board(CLF[0]-m(200),12.5,5.6,4.2,wC,0,.05);board(CLF[0]-m(70),-12.5,5.6,4.2,wC,0,.05);}
    // an old silver Airstream trailer parked off the road where the redwoods thin out, its wheels sunk in the dirt
    {const i=Z.sq-m(250),g=new THREE.Group(),al=std({color:0xc9ccce,metalness:.85,roughness:.3}),dk=std({color:0x1a1e22,roughness:.15,metalness:.3}),tyr=std({color:0x141414,roughness:.9}),dirt=std({color:0x7a4a30,roughness:1}),blk=std({color:0x1c1c1e,roughness:.8});
      const bod=new THREE.Mesh(new THREE.CapsuleGeometry(1.2,4.6,10,20).rotateX(Math.PI/2),al);bod.scale.set(.95,1.05,1);bod.position.y=1.62;bod.castShadow=true;g.add(bod);
      const bt=(sx,sy,sz,mm,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mm);o.position.set(x,y,z);g.add(o);return o;};
      bt(2.18,.08,6.8,std({color:0x9a9ea0,metalness:.7,roughness:.4}),0,1.62,0);for(const z of[-1.6,0,1.6])bt(2.24,.42,.75,dk,0,2.05,z);bt(1.4,.4,.3,dk,0,1.95,3.45);
      bt(.05,1.55,.72,std({color:0xaeb2b4,metalness:.8,roughness:.4}),1.15,1.35,-.7);bt(1.6,.35,6,blk,0,.55,0);
      for(const s of[-1,1]){const w=new THREE.Mesh(cyl(.36,.36,.24,14).rotateZ(Math.PI/2),tyr);w.position.set(s*1.05,.3,0);g.add(w);}
      const tg=bt(.12,.12,1.6,blk,0,.5,3.9);tg.rotation.x=-.08;bt(.08,.6,.08,blk,0,.3,4.5);
      const pad=new THREE.Mesh(new THREE.CircleGeometry(5.5,20),dirt);pad.rotation.x=-Math.PI/2;pad.position.y=.03;pad.scale.set(.7,1,1);g.add(pad);
      off(i,15.5,0,V);g.position.set(V.x,groundAt(V.x,V.z)-.08,V.z);g.rotation.y=yaw(i)+2.7;g.rotation.z=.02;scene.add(g);}
    const sq=Z.sq+m(260);gpos(sq,-170,V);const sx=V.x,sz=V.z,ry=yaw(sq),tan=mat('sq',{color:0xd8c8a0,roughness:.9}),tan2=mat('sq2',{color:0xc4b48c,roughness:.9});
    const R2=(lx,lz)=>{const cc=Math.cos(ry),s=Math.sin(ry);return[sx+lx*cc+lz*s,sz-lx*s+lz*cc];};
    for(const[lx,lz,w,d,h,mm]of[[0,0,140,30,26,tan],[-60,-60,30,110,20,tan2],[60,-60,30,110,20,tan2],[0,-110,120,26,18,tan],[0,40,40,20,34,tan]]){const[x,z]=R2(lx,lz);B(w,h,d,mm,x,h/2,z,ry);}
    for(const[lx,lz]of[[-110,60],[110,60],[-110,-160],[110,-160]]){const[x,z]=R2(lx,lz);B(6,16,6,tan2,x,8,z,ry);B(8,4,8,glassM,x,18,z,ry);}
    for(const[a2,b2,c2,d2]of[[-110,60,110,60],[-110,-160,110,-160],[-110,60,-110,-160],[110,60,110,-160]]){const[x0,z0]=R2(a2,b2),[x1,z1]=R2(c2,d2);const L=Math.hypot(x1-x0,z1-z0);B(L,7,1.4,tan,(x0+x1)/2,3.5,(z0+z1)/2,Math.atan2(-(z1-z0),x1-x0));}
    board(Z.sq+m(120),-(12),9,3,canvas(1024,340,(c,w,h)=>{c.fillStyle='#1f5a3a';c.fillRect(0,0,w,h);c.strokeStyle='#f4f1e8';c.lineWidth=17;c.strokeRect(17,17,w-34,h-34);c.fillStyle='#f4f1e8';c.textAlign='center';c.textBaseline='middle';c.font='900 112px Arial';c.fillText('SAN QUENTIN',590,130,700);c.font='900 70px Arial';c.fillText('STATE PRISON  →',590,250,700);prisonSeal(c,150,170,118);}));
    board(Z.sq-m(90),-12,10,3.6,canvas(1024,368,(c,w,h)=>{c.fillStyle='#f2c230';c.fillRect(0,0,w,h);c.strokeStyle='#111';c.lineWidth=16;c.strokeRect(14,14,w-28,h-28);c.fillStyle='#111';c.textAlign='center';c.textBaseline='middle';c.font='900 84px Arial';c.fillText('YOU ARE APPROACHING',600,h*.34,700);c.fillText('A FEDERAL PRISON',600,h*.68,700);prisonSeal(c,140,h/2,112);}));
    // the perimeter fence a little way outside the walls: steel posts, chain-link, and coils of razor wire all along the top
    {const fh=5,lnk=canvas(64,64,(g,w,h)=>{g.clearRect(0,0,w,h);g.strokeStyle='#d8dce0';g.lineWidth=7;g.beginPath();g.moveTo(0,0);g.lineTo(w,h);g.moveTo(w,0);g.lineTo(0,h);g.stroke();});
     const corners=[[124,74],[124,-174],[-124,-174],[-124,74]].map(([a,b])=>R2(a,b)),posts=[],coils=[];
     for(let e=0;e<4;e++){const[x0,z0]=corners[e],[x1,z1]=corners[(e+1)%4],L=Math.hypot(x1-x0,z1-z0),a=Math.atan2(-(z1-z0),x1-x0),tx=lnk.clone();tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.repeat.set(L/1.6,fh/1.6);tx.needsUpdate=true;
       const pl=new THREE.Mesh(new THREE.PlaneGeometry(L,fh),std({map:tx,transparent:true,alphaTest:.3,side:THREE.DoubleSide,metalness:.6,roughness:.5}));pl.position.set((x0+x1)/2,fh/2,(z0+z1)/2);pl.rotation.y=a;scene.add(pl);
       for(let d=0;d<=L;d+=4)posts.push([x0+(x1-x0)*d/L,z0+(z1-z0)*d/L]);for(let d=0;d<L;d+=.32)coils.push([x0+(x1-x0)*d/L,z0+(z1-z0)*d/L,a]);}
     const pm=new THREE.InstancedMesh(cyl(.09,.09,fh+.6,6),steelM,posts.length);posts.forEach(([x,z],n)=>{M4.compose(V.set(x,(fh+.6)/2,z),Q.identity(),S.set(1,1,1));pm.setMatrixAt(n,M4);});
     const cm=new THREE.InstancedMesh(new THREE.TorusGeometry(.45,.038,4,14),std({color:0xb8bcc0,metalness:.8,roughness:.35}),coils.length);coils.forEach(([x,z,a],n)=>{M4.compose(V.set(x,fh+.45,z),Q.setFromAxisAngle(YAX,a+Math.PI/2+(n%2?.22:-.22)),S.set(1,1,1));cm.setMatrixAt(n,M4);});
     pm.castShadow=true;scene.add(pm,cm);}
    {// the yard beside the road: a chain-link fence with a hole torn in it (the prisoners pour out of it as you come by), and a watchtower whose searchlight sweeps the yard
     const a=Z.sq+m(260),w=RW+XW[a],FL=-(w+26),sh=a*SEG,fh=3.6,lk=canvas(64,64,(g,ww,hh)=>{g.clearRect(0,0,ww,hh);g.strokeStyle='#cfd4d8';g.lineWidth=6;g.beginPath();g.moveTo(0,0);g.lineTo(ww,hh);g.moveTo(ww,0);g.lineTo(0,hh);g.stroke();});lk.wrapS=lk.wrapT=THREE.RepeatWrapping;lk.repeat.set(5/1.4,fh/1.4);
     const fm=std({map:lk,transparent:true,alphaTest:.3,side:THREE.DoubleSide,metalness:.6,roughness:.5}),pa=new THREE.Vector3(),pb=new THREE.Vector3();
     const panel=(s0,s1,lat,flap)=>{at(s0,lat,0,pa);at(s1,lat,0,pb);const L=pa.distanceTo(pb),pl=new THREE.Mesh(new THREE.PlaneGeometry(L,fh),fm);pl.position.set((pa.x+pb.x)/2,(pa.y+pb.y)/2+fh/2,(pa.z+pb.z)/2);pl.rotation.y=Math.atan2(-(pb.z-pa.z),pb.x-pa.x)+(flap||0);scene.add(pl);
       const po=new THREE.Mesh(cyl(.08,.08,fh+.3,6),steelM);po.position.set(pa.x,pa.y+(fh+.3)/2,pa.z);scene.add(po);return pl;};
     for(let s=sh-60;s<sh+60;s+=5){const s1=Math.min(s+5,sh+60);if(s1<=sh-1.8||s>=sh+1.8)panel(s,s1,FL);else{if(s<sh-1.8)panel(s,sh-1.8,FL);if(s1>sh+1.8)panel(sh+1.8,s1,FL);}}
     {const f1=panel(sh-1.8,sh-.4,FL,.9),f2=panel(sh+.4,sh+1.8,FL,-.9);f1.position.y-=.5;f1.rotation.z=.15;f2.position.y-=.3;f2.rotation.z=-.2;}   // the cut chain-link bent back either side of the hole
     at(sh,FL+.6,.03,pa);const hole=new THREE.Mesh(new THREE.CircleGeometry(1.7,12),std({color:0x3a2c1c,roughness:1}));hole.rotation.x=-Math.PI/2;hole.position.copy(pa);hole.scale.set(1,.6,1);scene.add(hole);   // trampled dirt through the gap
     const st=sh+40,tl=FL-22;at(st,tl,0,pa);const tw=new THREE.Group();tw.position.copy(pa);tw.rotation.y=yaw(a);scene.add(tw);const dk=std({color:0x3a3a3c,roughness:.7,metalness:.4});
     for(const[x,z]of[[-1.8,-1.8],[1.8,-1.8],[-1.8,1.8],[1.8,1.8]])B(.35,13,.35,steelM,x,6.5,z,0,tw);B(4.6,2.6,4.6,mat('sq2',{color:0xc4b48c,roughness:.9}),0,14.3,0,0,tw);B(5.4,.4,5.4,dk,0,15.8,0,0,tw);B(4.7,.9,4.7,glassM,0,14.6,0,0,tw);
     const lamp=new THREE.Mesh(cyl(.45,.55,.8,12).rotateX(Math.PI/2),dk);lamp.position.set(2.6,15.2,0);tw.add(lamp);tw.traverse(o=>{o.castShadow=true;});tw.updateMatrixWorld(true);
     const lp=new THREE.Vector3();lamp.getWorldPosition(lp);const sp=new THREE.SpotLight(0xfff2d0,2,260,.17,.5,0),tg=new THREE.Object3D();sp.position.copy(lp);sp.target=tg;scene.add(sp,tg);
     const bg=new THREE.ConeGeometry(1,1,20,1,true).translate(0,-.5,0).rotateX(-Math.PI/2),beam=new THREE.Mesh(bg,new THREE.MeshBasicMaterial({color:0xfffbe8,transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide,fog:false}));beam.position.copy(lp);
     const pool=new THREE.Mesh(new THREE.CircleGeometry(1,24),new THREE.MeshBasicMaterial({color:0xfff4d8,transparent:true,opacity:.2,blending:THREE.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3}));pool.rotation.x=-Math.PI/2;
     Object.assign(SQX,{a,s:sh,lat:FL,sp,tg,beam,pool,lp,t:0});}}

await BOOT.step('RICHMOND · SHANE DRIVE',.68);
  // ---- Richmond: ranch houses up the hill, Shane Drive and number 3060, and the refinery down by the freeway
  {const FLG=[canvas(256,160,(c,w,h)=>{c.fillStyle="#f4f1e8";c.fillRect(0,0,w,h);for(let k=0;k<7;k++){c.fillStyle="#b3222a";c.fillRect(0,k*2*h/13,w,h/13);}c.fillStyle="#1f3a7a";c.fillRect(0,0,w*.42,h*7/13);c.fillStyle="#f4f1e8";for(let a=0;a<5;a++)for(let b=0;b<4;b++)c.fillRect(12+a*20,10+b*17,5,5);}),canvas(256,160,(c,w,h)=>{c.fillStyle="#8a1a22";c.fillRect(0,0,w,h);c.fillStyle="#e3b92e";c.beginPath();for(let k=0;k<10;k++){const r=k%2?26:56,a=-Math.PI/2+k*Math.PI/5;c.lineTo(w/2+Math.cos(a)*r,h/2-6+Math.sin(a)*r);}c.fill();c.fillStyle="#f4f1e8";c.font="900 22px Arial Black,Arial";c.textAlign="center";c.fillText("THE LEADER",w/2,h-12);})];   // an American flag and the leader's banner (invented), flown from some of the houses
  const ranch=(x,y,z,rot,col,num)=>{const g=new THREE.Group(),w=rr(13,17),d=rr(9,11),h=3.4,mm=wallM(col);B(w,h,d,mm,0,h/2+.3,0,0,g);const rf=new THREE.Mesh(new THREE.ExtrudeGeometry(tri,{depth:w+1.2,bevelEnabled:false}),roofM);rf.scale.set(d/2+.8,1.6,1);rf.rotation.y=Math.PI/2;rf.position.set(-(w+1.2)/2,h+.3,0);g.add(rf);
      B(5,2.6,.2,mat('garage',{color:0xe8e4d6}),w*.28,1.6,d/2+.05,0,g);B(w+6,.06,8,lawnM,0,.03,d/2+4,0,g);B(4.8,.05,8,mat("drive",{color:0x8a8780}),w*.28,.05,d/2+4,0,g);
      if(num){const pl=new THREE.Mesh(new THREE.PlaneGeometry(1.6,.6),new THREE.MeshBasicMaterial({map:canvas(160,64,(c)=>{c.fillStyle='#1c2a4a';c.fillRect(0,0,160,64);c.fillStyle='#f4f1e8';c.font='900 46px Arial Black,Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(num,80,36);})}));pl.position.set(-w*.2,2.4,d/2+.06);g.add(pl);
        const mb=new THREE.Group();B(.24,.26,.5,mat('mbox',{color:0x2a2a2a}),0,1.1,0,0,mb);B(.08,1,.08,wood,0,.5,0,0,mb);mb.position.set(w*.28-3.4,0,d/2+8.4);g.add(mb);}
      if(Math.random()<.65){const cc=[0x8a2a22,0x2f3f5f,0xd8d4c8,0x3a4a3a,0x6a6f74,0x1c1c1e,0x9a7a2a][Math.random()*7|0];B(1.9,.7,4.3,mat("rc"+cc,{color:cc}),w*.28,.65,d/2+5,0,g);B(1.6,.55,2.2,mat("rcg",{color:0x1b2328}),w*.28,1.2,d/2+4.9,0,g);}   // a car parked in the driveway
      if(Math.random()<.5){B(.07,5.2,.07,steelM,-w*.36,2.6,d/2+3,0,g);const fl=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.1),new THREE.MeshBasicMaterial({map:FLG[Math.random()<.6?0:1],side:THREE.DoubleSide}));fl.position.set(-w*.36+.95,4.65,d/2+3);g.add(fl);}   // a flagpole on the lawn
      g.userData.ig={w,d,y0:.3,top:h+.3,rh:1.6,ax:'x'};g.traverse(o=>{o.castShadow=o.receiveShadow=true;});g.position.set(x,y,z);g.rotation.y=rot;scene.add(g);};
    const RC=[0xe8dcc0,0xd8c8a8,0xb8c9d6,0xe6e0d0,0xc9b89a,0xd0d8c8,0xe8d0b8];let n=0;
    for(let i=Z.rb1+m(60);i<Z.refinery-m(120);i+=10)for(const sd of[-1,1]){if(curved(i)||(rnd()<.5&&!(sd>0&&Math.abs(i-Z.shane)<5)))continue;off(i,sd*(24+XW[i]),0,V);const isShane=sd>0&&Math.abs(i-Z.shane)<5;ranch(V.x,V.y,V.z,faceRoad(i,sd),isShane?0xc9d6c2:RC[n++%RC.length],isShane?'3060':'');IGCL.h.push({g:scene.children[scene.children.length-1],i});if(rnd()<.3)parked(i+4,sd);}
    const bl=std({roughness:.6,map:canvas(512,80,(c)=>{c.fillStyle='#1f5a3a';c.fillRect(0,0,512,80);c.fillStyle='#f4f1e8';c.font='900 46px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText('SHANE DR',256,42);})});
    const sg=new THREE.Group();B(.08,3.2,.08,steelM,0,1.6,0,0,sg);const bd=new THREE.Mesh(new THREE.BoxGeometry(1.9,.3,.03),bl);bd.position.y=3.05;sg.add(bd);off(Z.shane-m(160),-(10.4+XW[Z.shane]),0,sg.position);sg.rotation.y=yaw(Z.shane);scene.add(sg);
    board(Z.richmond-m(30),-12,8,3,sign(1024,384,'RICHMOND','#1f5a3a','#f4f1e8','900 130px Arial','CITY LIMIT · WATCH FOR TURKEYS'));
    const tankM=std({color:0xe8e6de,roughness:.6,metalness:.2});for(let k=0;k<26;k++){gpos(Z.refinery-m(320)+k*m(12),rr(60,240),V);const r=rr(10,22);if(!farFromRoad(V.x,V.z,r+14))continue;const t=new THREE.Mesh(cyl(r,r,rr(8,16),20),tankM);t.position.set(V.x,6,V.z);t.castShadow=true;scene.add(t);}
    gpos(Z.refinery-m(120),210,V);const fl=new THREE.Mesh(cyl(1.2,1.8,70,8),steelM);fl.position.set(V.x,35,V.z);scene.add(fl);BURN.push({x:V.x,y:72,z:V.z,s:1.2,flare:1});
    for(let k=0;k<8;k++){gpos(Z.refinery-m(260)+k*m(20),rr(50,140),V);if(!farFromRoad(V.x,V.z,20))continue;const h=rr(30,55);
      if(DSTK.length<2&&k%3===0){const i0=Z.refinery-m(260)+k*m(20),c=off(i0,0,0,new THREE.Vector3()),g=new THREE.Group(),secs=[],hs=[];let dx=V.x-c.x,dz=V.z-c.z;const dl=Math.hypot(dx,dz)||1;dx/=dl;dz/=dl;   // one the daddy beetle can topple: in three sections, pivoting at its foot; two houses stand beyond it, away from the road
        g.position.set(V.x,0,V.z);for(let q=0;q<3;q++){const s=new THREE.Mesh(cyl(2.4,2.4,h/3,10),steelM);s.position.y=h/6+q*h/3;g.add(s);secs.push(s);}scene.add(g);
        for(const f of[.6,.92]){const j=rr(-3,3),x=V.x+dx*h*f-dz*j,z=V.z+dz*h*f+dx*j;ranch(x,groundAt(x,z),z,Math.atan2(-dx,-dz),RC[n++%RC.length],'');hs.push(scene.children[scene.children.length-1]);}
        DSTK.push({g,secs,hs,h,i:i0,d:new THREE.Vector3(dx,0,dz),ax:new THREE.Vector3(dz,0,-dx),st:0,t:0,th:0,w:0,kick:0,br:secs.map(()=>({x:R(-1.5,1.5),y:0,rx:R(-.35,.35),rz:R(-.35,.35)}))});continue;}
      const tw=new THREE.Mesh(cyl(2.4,2.4,h,10),steelM);tw.position.set(V.x,h/2,V.z);scene.add(tw);}
    // the big refinery at the Richmond end of the San Rafael bridge, seen across the water on the way in: tank farms, distillation columns with lit platforms,
    // pipe racks, and flare stacks burning off gas, their flames visible from the far end of the bridge. Oil tankers lie at anchor either side of the bridge.
    {let rs=5;const rq=()=>{rs=(rs*16807)%2147483647;return rs/2147483647;},onLand=(x,z)=>Terrain.landAt(x,z)>.2;
     const cand=[];for(let i=Z.rb1-m(700);i<Z.rb1+m(600);i+=m(46))for(const sd of[-1,1])for(let o=160;o<760;o+=46){gpos(i,sd*(o+rq()*20),V);if(onLand(V.x,V.z)&&farFromRoad(V.x,V.z,70))cand.push([V.x,V.y,V.z,o]);}
     const tankW=std({color:0xe4e2da,roughness:.6,metalness:.2}),tankG=std({color:0xb8bcb8,roughness:.6,metalness:.3}),rust=std({color:0x8a6a4a,roughness:.8,metalness:.3}),N=Math.min(cand.length,90);
     const tanks=new THREE.InstancedMesh(cyl(1,1,1,20).translate(0,.5,0),tankW,N),domes=new THREE.InstancedMesh(new THREE.SphereGeometry(1,16,6,0,6.283,0,.5),tankG,N),cols=new THREE.InstancedMesh(cyl(1,1,1,10).translate(0,.5,0),rust,N),
       lights=new THREE.InstancedMesh(new THREE.SphereGeometry(.6,6,5),lampMat,N*6);let nt=0,nc=0,nl=0;const M=new THREE.Matrix4(),Sc=new THREE.Vector3(),Pp=new THREE.Vector3(),Qi=new THREE.Quaternion();
     const flareSites=[];
     cand.slice(0,N).forEach(([x,y,z,o],k)=>{const r=rq();
       if(r<.62){const rad=9+rq()*12,h=8+rq()*8;M.compose(Pp.set(x,y,z),Qi,Sc.set(rad,h,rad));tanks.setMatrixAt(nt,M);M.compose(Pp.set(x,y+h,z),Qi,Sc.set(rad,rad*.35,rad));domes.setMatrixAt(nt++,M);}
       else if(r<.9){for(let q=0;q<3;q++){const rad=2+rq()*2.2,h=28+rq()*34,px=x+(q-1)*9,pz=z+(rq()-.5)*8;M.compose(Pp.set(px,y,pz),Qi,Sc.set(rad,h,rad));cols.setMatrixAt(nc++,M);
         for(let l=1;l<=2;l++){M.compose(Pp.set(px+rad,y+h*l/2.4,pz),Qi,Sc.set(1,1,1));lights.setMatrixAt(nl++,M);}REFS.push({x:px,y:y+h+1,z:pz,t:rq(),k:1});}}
       else flareSites.push([x,y,z,o]);});
     tanks.count=domes.count=nt;cols.count=nc;lights.count=nl;for(const im of[tanks,domes,cols])im.castShadow=true;scene.add(tanks,domes,cols,lights);
     // pipe racks running between the tank farms
     const pr=std({color:0x7a7f84,roughness:.6,metalness:.5});for(let k=0;k+1<Math.min(cand.length,40);k+=3){const[a1,ay,a2]=cand[k],[b1,,b2]=cand[k+1],L=Math.hypot(b1-a1,b2-a2);if(L>140||L<20)continue;const p=new THREE.Mesh(new THREE.BoxGeometry(2.4,1.2,L),pr);p.position.set((a1+b1)/2,ay+5,(a2+b2)/2);p.rotation.y=Math.atan2(b1-a1,b2-a2);scene.add(p);}
     // flare stacks: a tall thin stack, and a flame on top that is a glowing sprite (so it shows from kilometres away) as well as fire particles close to
     const ft=canvas(128,256,(g,w,h)=>{const r=g.createRadialGradient(w/2,h*.62,4,w/2,h*.55,h*.5);r.addColorStop(0,'rgba(255,236,170,1)');r.addColorStop(.22,'rgba(255,160,40,.95)');r.addColorStop(.55,'rgba(240,80,10,.6)');r.addColorStop(1,'rgba(200,40,0,0)');g.fillStyle=r;g.fillRect(0,0,w,h);});
     if(!flareSites.length&&cand.length)flareSites.push(cand[cand.length-1]);
     flareSites.sort((a,b)=>b[3]-a[3]).slice(0,5).forEach(([x,y,z])=>{const h=80+rq()*25,st=new THREE.Mesh(cyl(1.1,1.8,h,8),std({color:0x9a3a2a,roughness:.7}));st.position.set(x,y+h/2,z);scene.add(st);
       const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:ft,color:0xffffff,depthWrite:false,transparent:true,fog:false}));sp.position.set(x,y+h+20,z);sp.scale.set(26,52,1);scene.add(sp);FLARES.push({sp,b:sp.position.y,ph:rq()*6});REFS.push({x,y:y+h+3,z,t:rq(),k:1.5});BURN.push({x,y:y+h+2,z,s:1.6,flare:1});});
     // tankers at anchor: long dark hulls with a white bridge house at the stern
     const hullM=std({color:0x2a2c30,roughness:.7}),redM=std({color:0x8a2a20,roughness:.8}),whM=std({color:0xe8e4da,roughness:.6}),dkM=std({color:0x5a3a2a,roughness:.8});
     const tanker=(x,z,ry)=>{const g=new THREE.Group(),A=(geo,mm,px,py,pz)=>{const o=new THREE.Mesh(geo,mm);o.position.set(px,py,pz);g.add(o);return o;};
       A(new THREE.BoxGeometry(26,10,170),hullM,0,5,0);A(new THREE.BoxGeometry(26.3,3.2,170.3),redM,0,.6,0);const bw=A(new THREE.ConeGeometry(13,24,4),hullM,0,5,97);bw.rotation.x=Math.PI/2;bw.rotation.y=Math.PI/4;bw.scale.set(1,1,.42);
       A(new THREE.BoxGeometry(22,1,150),dkM,0,10.4,5);A(new THREE.BoxGeometry(18,15,14),whM,0,17,-70);A(new THREE.BoxGeometry(24,2,16),whM,0,25,-70);A(cyl(2.5,2.8,10,10),redM,0,27,-80);
       for(let k=0;k<6;k++)A(cyl(.4,.4,4,6),whM,0,12.5,-40+k*22);const ml=A(new THREE.SphereGeometry(.7,6,5),lampMat,0,33,-80);ml.scale.setScalar(1.4);
       g.position.set(x,-45,z);g.rotation.y=ry;scene.add(g);OILX.push({g,y:11,L:150,s:1});};
     let placed=0;for(const[f,sd,o]of[[.06,-1,300],[.14,1,380],[.25,1,520],[.55,-1,640],[.8,1,420],[.4,-1,900],[.7,1,1100]]){if(placed>=6)break;const i=Z.rb0+Math.round((Z.rb1-Z.rb0)*f);off(i,sd*o,0,V);const ry=yaw(i)+rq()*1.2-.6,dx=Math.sin(ry)*90,dz=Math.cos(ry)*90;
       if(onLand(V.x,V.z)||onLand(V.x+dx,V.z+dz)||onLand(V.x-dx,V.z-dz))continue;tanker(V.x,V.z,ry);placed++;}}}

await BOOT.step('THE EAST BAY · BERKELEY · EMERYVILLE',.72);
  // ---- I-80 along the East Bay: the Berkeley hills on the left with houses up the slopes and the university's campanile, Emeryville's towers, then Oakland
  {const hm=std({color:0x55663a,roughness:1}),hm2=std({color:0x6a7448,roughness:1});
    const onHill=(lo,up)=>{for(let q=0;q<40;q++){const x=rr(250,3900),z=rr(-12400,-2400),y=Terrain.heightAt(x,z);if(y>lo&&y<up)return V.set(x,y,z);}return V.set(0,-200,0);};   // a spot on the real hillside (the hills themselves are js/world/terrain.js)
    const hs=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),std({color:0xe6dcc6,roughness:.9}),700);for(let k=0;k<700;k++){onHill(5,150);V.y+=2;M4.compose(V,Q.identity(),S.set(rr(8,14),rr(5,8),rr(8,14)));hs.setMatrixAt(k,M4);}scene.add(hs);
    const tr=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),std({color:0x3f5a30,roughness:1}),900);for(let k=0;k<900;k++){onHill(4,260);V.y+=3;M4.compose(V,Q.identity(),S.set(rr(5,9),rr(5,8),rr(5,9)));tr.setMatrixAt(k,M4);}scene.add(tr);
    // the university: white granite and red tile, the stadium in a fold of the hills, and the campanile standing over it all
    const gran=std({color:0xe8e2d2,roughness:.85}),tileRd=std({color:0xa8492f,roughness:.8}),cz=P[Z.berkeley].z-150,cx=420;
    for(let k=0;k<16;k++){const x=cx+rr(-260,260),z=cz+rr(-220,220),w=rr(30,70),d=rr(20,40),h=rr(14,24);B(w,h,d,gran,x,h/2,z);const rf=new THREE.Mesh(new THREE.CylinderGeometry(.01,Math.hypot(w,d)/2,5,4,1),tileRd);rf.scale.set(w/Math.hypot(w,d)*1.414,1,d/Math.hypot(w,d)*1.414);rf.rotation.y=Math.PI/4;rf.position.set(x,h+2.5,z);scene.add(rf);}
    B(12,82,12,gran,cx,41,cz);B(14,10,14,gran,cx,87,cz);const cap=new THREE.Mesh(new THREE.ConeGeometry(10.5,18,4),std({color:0x5a7a6a,roughness:.6,metalness:.3}));cap.position.set(cx,101,cz);cap.rotation.y=Math.PI/4;scene.add(cap);
    const clockT=canvas(128,128,(c)=>{c.fillStyle='#1c2a2a';c.beginPath();c.arc(64,64,62,0,7);c.fill();c.fillStyle='#e8e2d2';c.beginPath();c.arc(64,64,54,0,7);c.fill();c.strokeStyle='#1c1c1c';c.lineWidth=6;c.beginPath();c.moveTo(64,64);c.lineTo(64,22);c.moveTo(64,64);c.lineTo(92,70);c.stroke();});
    for(let k=0;k<4;k++){const f=new THREE.Mesh(new THREE.CircleGeometry(3.6,24),new THREE.MeshBasicMaterial({map:clockT}));const a=k*Math.PI/2;f.position.set(cx+Math.sin(a)*7.05,87,cz+Math.cos(a)*7.05);f.rotation.y=a;scene.add(f);}
    {const st=new THREE.Mesh(new THREE.CylinderGeometry(110,90,24,32,1,true),std({color:0x9a968c,roughness:.9,side:D2}));st.position.set(cx+520,40,cz-80);st.scale.z=.7;scene.add(st);const fld=new THREE.Mesh(new THREE.CircleGeometry(88,32).rotateX(-Math.PI/2),std({color:0x4f7a3a,roughness:1}));fld.scale.z=.7;fld.position.set(cx+520,29,cz-80);scene.add(fld);
      const bk=new THREE.Mesh(new THREE.SphereGeometry(1,20,10),hm);bk.scale.set(160,40,140);bk.position.set(cx+520,-12,cz-80);scene.add(bk);}
    skyline(-1350,P[Z.emeryville].z,200,240,40,110,30);skyline(-200,P[Z.emeryville].z-200,260,300,40,80,30);
    for(const[x,z]of[[-1350,P[Z.emeryville].z+300],[-1310,P[Z.emeryville].z+380]]){const tw=new THREE.Mesh(cyl(18,18,90,6),cityMats[8]);tw.position.set(x,45,z);tw.castShadow=true;scene.add(tw);}}

  { // ---- advertising for the new economy: boards for made-up AI companies, each with its own robot, all round the route but thickest in the city
    const ADS=[['ROBO-BUTLER','He never sleeps. He never judges.','#12324a','#5fd0ff'],['THINKLY.AI','We do the thinking. You do the nodding.','#2a1846','#c79bff'],['GIGABRAIN','Now with 40% more brain.','#0f3a2e','#6dffb0'],['HELLO, I AM BOLT','Your new coworker. Please be nice.','#4a1e12','#ffb27a'],
      ['SYNTHIA','An assistant with feelings (beta).','#3a1238','#ff8ad8'],['NEURO NOODLE','Artificial intelligence, al dente.','#3a3210','#ffe36d'],['OMNIBOT 9000','It can do your job. It would rather not.','#1a1f2e','#9fb4ff'],['PROMPTLY','Ask nicely. Get everything.','#10363a','#7df2ff'],
      ['DEEPMIND-ISH','Like the real thing, but cheaper.','#2a2a10','#e8ff6d'],['AGENTIC','It books your flights. And your feelings.','#38200e','#ffc46d'],['TOKENS R US','Buy one billion, get one free.','#0e2238','#6db8ff'],['ALIGNMENT CO.','Our robots mean well. Probably.','#30101a','#ff6d8a'],
      ['LATENT SPACE','Office space for your vectors.','#102a30','#6dffe8'],['HALLUCINATE','Facts optional. Confidence guaranteed.','#2e1036','#e86dff']];
    const tex=([name,tag,bg,ac],v)=>canvas(1024,460,(g,w,h)=>{const gr=g.createLinearGradient(0,0,w,h);gr.addColorStop(0,bg);gr.addColorStop(1,'#07090c');g.fillStyle=gr;g.fillRect(0,0,w,h);g.strokeStyle=ac;g.lineWidth=8;g.strokeRect(12,12,w-24,h-24);
      const cx=190,cy=235;g.strokeStyle=ac;g.fillStyle=ac;g.lineWidth=7;g.beginPath();g.moveTo(cx,cy-120);g.lineTo(cx,cy-165);g.stroke();g.beginPath();g.arc(cx,cy-175,13,0,7);g.fill();
      g.fillStyle='#d8dde2';const r=v%3===0?60:22;g.beginPath();g.roundRect(cx-105,cy-120,210,190,r);g.fill();g.fillStyle='#8a9198';g.fillRect(cx-128,cy-50,24,60);g.fillRect(cx+104,cy-50,24,60);g.beginPath();g.roundRect(cx-70,cy+78,140,70,14);g.fill();
      g.fillStyle='#10161c';if(v%2){g.beginPath();g.roundRect(cx-80,cy-80,160,70,20);g.fill();g.fillStyle=ac;for(const dx of[-38,38]){g.beginPath();g.arc(cx+dx,cy-45,17,0,7);g.fill();}}else{for(const dx of[-45,45]){g.beginPath();g.arc(cx+dx,cy-45,30,0,7);g.fill();}g.fillStyle=ac;for(const dx of[-45,45]){g.beginPath();g.arc(cx+dx+6,cy-45,13,0,7);g.fill();}}
      g.fillStyle='#10161c';if(v%4<2){for(let q=0;q<6;q++)g.fillRect(cx-56+q*20,cy+18,10,28);}else{g.lineWidth=8;g.strokeStyle='#10161c';g.beginPath();g.arc(cx,cy+12,42,.2,2.94);g.stroke();}
      g.fillStyle='#f4f6f8';g.textAlign='left';g.font='900 '+(name.length>12?74:96)+'px Arial Black,Arial';g.fillText(name,360,225,620);g.fillStyle=ac;g.font='italic 700 36px Georgia';g.fillText(tag,362,292,620);g.fillRect(362,318,300,6);g.font='700 22px Arial';g.fillStyle='rgba(244,246,248,.6)';g.fillText('artificial intelligence  ·  san francisco',362,372);graffiti(g,w,h,v);});
    const spots=[[Z.b1+m(40),-1],[Z.b1+m(140),1],[Z.b1+m(260),-1],[Z.downtown-m(60),1],[Z.hyde+m(120),1],[Z.hyde+m(300),-1],[Z.marina+m(200),1],[Z.tu1+m(700),1],[Z.tu1+m(1900),-1],[Z.b0+m(200),1],[Z.i80+m(900),-1],[Z.emeryville+m(100),1],[Z.oakland+m(300),-1],[Z.b0-m(120),-1]];
    spots.forEach(([i,sd],v)=>{const t=tex(ADS[v%ADS.length],v),g=new THREE.Group(),bd=new THREE.Mesh(new THREE.PlaneGeometry(13.5,6),new THREE.MeshStandardMaterial({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.55,roughness:.6}));bd.position.y=8;g.add(bd);
      B(13.8,6.3,.25,steelM,0,8,-.15,0,g);const leg=8+(H[i]>2?H[i]:0);for(const x of[-5,5])B(.4,leg,.4,steelM,x,8-3-leg/2,-.35,0,g);
      g.traverse(o=>{o.castShadow=true;});off(i,sd*(wallAt[i]+8),0,g.position);g.rotation.y=yaw(i)+Math.PI-sd*.36;scene.add(g);});
    {// I-880 after the tube: chemicals, poison, a wonder drug, robot repair, and warnings about animals and insects (drawn symbols)
      const HZ=[['CHEMCO','Industrial Solvents · Acids · Bulk','chem','#1d3a5a','#ffd23a'],['RAT-B-GONE','Poison. Handle With Gloves.','skull','#2a1a2a','#9aff6a'],['MIRACULIN','The Wonder Drug! Ask Your Doctor','pill','#f0f4f8','#c0262c'],
        ['ROBO-FIX','Robot Repair · While U Wait','wrench','#243040','#7ad8ff'],['WARNING','Ducks Crossing · Slow Down','duck','#f2c230','#1a1a1a'],['DANGER','Killer Bees · Do Not Stop','bee','#f2c230','#1a1a1a'],['BEWARE','Skunks, Raccoons & Possums','skunk','#f2c230','#1a1a1a'],['TOXIC','Chemical Storage · Keep Out','chem','#2a2a2a','#ffd23a']];
      HZ.forEach(([name,tag,pic,bg,fg],v)=>{const t=canvas(1024,460,(g,w,h)=>{g.fillStyle=bg;g.fillRect(0,0,w,h);g.strokeStyle=fg;g.lineWidth=12;g.strokeRect(14,14,w-28,h-28);const cx=200,cy=230;g.fillStyle=fg;g.strokeStyle=fg;g.lineCap='round';
          if(pic==='chem'){g.beginPath();g.moveTo(cx-30,cy-120);g.lineTo(cx+30,cy-120);g.lineTo(cx+30,cy-30);g.lineTo(cx+90,cy+90);g.lineTo(cx-90,cy+90);g.lineTo(cx-30,cy-30);g.closePath();g.lineWidth=10;g.stroke();g.globalAlpha=.7;g.fillRect(cx-70,cy+30,140,56);g.globalAlpha=1;}
          else if(pic==='skull'){g.beginPath();g.arc(cx,cy-20,80,0,7);g.fill();g.fillRect(cx-45,cy+40,90,50);g.fillStyle=bg;for(const d of[-34,34]){g.beginPath();g.arc(cx+d,cy-20,22,0,7);g.fill();}g.fillRect(cx-6,cy+10,12,22);for(let q=-2;q<=2;q++)g.fillRect(cx+q*16-3,cy+60,6,30);g.strokeStyle=fg;g.lineWidth=16;g.beginPath();g.moveTo(cx-110,cy+100);g.lineTo(cx+110,cy+130);g.moveTo(cx+110,cy+100);g.lineTo(cx-110,cy+130);g.stroke();}
          else if(pic==='pill'){g.save();g.translate(cx,cy);g.rotate(-.6);g.beginPath();g.roundRect(-110,-48,110,96,48);g.fill();g.fillStyle='#2a5ec0';g.beginPath();g.roundRect(0,-48,110,96,48);g.fill();g.restore();g.fillStyle='#f2c230';for(let q=0;q<5;q++){const a=q*1.256;g.beginPath();g.arc(cx+Math.cos(a)*150,cy+Math.sin(a)*150,8,0,7);g.fill();}}
          else if(pic==='wrench'){g.lineWidth=26;g.beginPath();g.moveTo(cx-90,cy+100);g.lineTo(cx+50,cy-40);g.stroke();g.beginPath();g.arc(cx+66,cy-56,40,0,7);g.lineWidth=22;g.stroke();g.fillStyle='#d8dde2';g.fillRect(cx-120,cy-120,80,70);g.fillStyle=bg;for(const d of[-100,-60])g.fillRect(cx+d,cy-100,16,16);}
          else if(pic==='duck'){g.beginPath();g.ellipse(cx,cy+30,100,60,0,0,7);g.fill();g.beginPath();g.arc(cx+80,cy-50,40,0,7);g.fill();g.fillRect(cx+110,cy-58,50,16);g.fillStyle=bg;g.beginPath();g.arc(cx+92,cy-58,8,0,7);g.fill();g.fillStyle=fg;for(let q=0;q<3;q++){g.beginPath();g.ellipse(cx-110+q*0,cy+110,0,0,0,0,7);g.fill();}for(let q=0;q<3;q++){g.beginPath();g.ellipse(cx-60+q*60,cy+110,18,12,0,0,7);g.fill();}}
          else if(pic==='bee'){g.beginPath();g.ellipse(cx,cy,80,56,0,0,7);g.fill();g.fillStyle=bg;for(const d of[-30,10,48])g.fillRect(cx+d,cy-56,14,112);g.fillStyle=fg;g.globalAlpha=.6;for(const d of[-1,1]){g.beginPath();g.ellipse(cx+d*30,cy-80,34,52,d*.5,0,7);g.fill();}g.globalAlpha=1;g.beginPath();g.moveTo(cx+80,cy);g.lineTo(cx+125,cy);g.lineTo(cx+80,cy+12);g.fill();}
          else{g.beginPath();g.ellipse(cx,cy+30,90,50,0,0,7);g.fill();g.beginPath();g.arc(cx+90,cy-10,32,0,7);g.fill();g.save();g.translate(cx-80,cy);g.rotate(-1.1);g.beginPath();g.ellipse(0,-40,30,90,0,0,7);g.fill();g.restore();g.fillStyle=bg;g.fillRect(cx-40,cy-8,80,12);g.fillRect(cx-40,cy+24,80,12);g.fillRect(cx-20,cy-26,50,10);g.fillStyle=fg;for(const d of[-50,-10,30,60])g.fillRect(cx+d,cy+60,12,36);}
          g.fillStyle=fg;g.textAlign='left';g.font='900 '+(name.length>8?84:100)+'px Arial Black,Arial';g.fillText(name,370,220,610);g.font='italic 700 34px Georgia';g.fillText(tag,372,290,610);g.fillRect(372,312,300,6);});
        const g=new THREE.Group(),bd=new THREE.Mesh(new THREE.PlaneGeometry(13.5,6),new THREE.MeshStandardMaterial({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.4,roughness:.6}));bd.position.y=8;g.add(bd);B(13.8,6.3,.25,steelM,0,8,-.15,0,g);
        const i=Z.tu1+m(120+v*200),sd=v%2?-1:1,leg=8+(H[i]>2?H[i]:0);for(const x of[-5,5])B(.4,leg,.4,steelM,x,8-3-leg/2,-.35,0,g);g.traverse(o=>{o.castShadow=true;});off(i,sd*(wallAt[i]+8),0,g.position);g.rotation.y=yaw(i)+Math.PI-sd*.36;scene.add(g);});}
    // old-fashioned roadside boards along I-880 and I-80: cream paper, a drawing, a slogan. Old-time candy above all (and a robot lollipop), a roller rink, a drive-in, a tyre shop.
    const RETRO=[['PEPPERMINT PETE\'S','Old-Time Candy · Since 1921','mint','#b3241c'],['TAFFY TOWN','Salt Water Taffy · 40 Flavors','taffy','#2a6aa8'],['CANDY CANE LANE','Penny Candy · Root Beer Barrels · Licorice','cane','#2f7a3a'],
      ['ROBO-POP','The Lollipop Made by Robots!','robo','#7a2a8a'],['ISLAND ROLLER RINK','Skate Every Night · Organ Music','skate','#c0601c'],['STARLITE DRIVE-IN','Two Features Tonight · Car Hop Service','film','#1c3a6a'],['BAY TIRE & BRAKE','We Stop for Nothing','tire','#3a3a3a'],['JAWBREAKER JIM\'S','Fudge · Brittle · Jawbreakers','jaw','#a8401c']];
    const rtex=([name,tag,pic,col])=>canvas(1024,460,(g,w,h)=>{g.fillStyle='#efe4c8';g.fillRect(0,0,w,h);for(let k=0;k<1800;k++){g.fillStyle=`rgba(120,90,50,${Math.random()*.07})`;g.fillRect(Math.random()*w,Math.random()*h,2+Math.random()*6,1+Math.random()*3);}
      g.strokeStyle=col;g.lineWidth=14;g.strokeRect(16,16,w-32,h-32);g.lineWidth=3;g.strokeRect(36,36,w-72,h-72);const cx=200,cy=235;
      const swirl=(x,y,r,a,b)=>{for(let k=0;k<12;k++){g.fillStyle=k%2?a:b;g.beginPath();g.moveTo(x,y);g.arc(x,y,r,k/12*6.283,(k+1)/12*6.283);g.fill();}};
      if(pic==='mint'){swirl(cx,cy,120,'#c8241c','#fbf6ea');g.fillStyle='#fbf6ea';g.beginPath();g.arc(cx,cy,26,0,7);g.fill();for(const s of[-1,1]){g.fillStyle='rgba(200,36,28,.85)';g.beginPath();g.moveTo(cx+s*118,cy);g.lineTo(cx+s*170,cy-40);g.lineTo(cx+s*170,cy+40);g.fill();}}
      else if(pic==='taffy')for(let k=0;k<5;k++){const x=90+k*52,y=170+(k%2)*90;g.fillStyle=['#f0a0b8','#a8d8f0','#f8e080','#b8e8a0','#f8c098'][k];g.fillRect(x-30,y-20,60,40);g.strokeStyle='#fbf6ea';g.lineWidth=4;g.beginPath();g.moveTo(x-30,y);g.lineTo(x-48,y-14);g.lineTo(x-48,y+14);g.closePath();g.moveTo(x+30,y);g.lineTo(x+48,y-14);g.lineTo(x+48,y+14);g.closePath();g.stroke();}
      else if(pic==='cane'){g.lineCap='round';g.lineWidth=44;g.strokeStyle='#fbf6ea';g.beginPath();g.moveTo(cx+30,cy+150);g.lineTo(cx+30,cy-60);g.arc(cx-30,cy-60,60,0,Math.PI,true);g.stroke();g.lineWidth=12;g.strokeStyle='#c8241c';g.setLineDash([22,26]);g.stroke();g.setLineDash([]);}
      else if(pic==='robo'){g.strokeStyle='#5a4a3a';g.lineWidth=10;g.beginPath();g.moveTo(cx+70,cy-30);g.lineTo(cx+70,cy+170);g.stroke();swirl(cx+70,cy-90,70,'#7a2a8a','#f8e080');
        g.fillStyle='#9aa4ac';g.fillRect(cx-150,cy-60,110,90);g.fillRect(cx-160,cy+40,130,120);g.fillStyle='#e8ecef';for(const dx of[-120,-75]){g.beginPath();g.arc(cx+dx,cy-20,14,0,7);g.fill();}g.fillStyle='#c8241c';g.fillRect(cx-128,cy+5,66,8);g.fillStyle='#9aa4ac';g.fillRect(cx-30,cy+60,90,22);}
      else if(pic==='skate'){g.fillStyle=col;g.beginPath();g.moveTo(cx-110,cy+60);g.lineTo(cx-110,cy-110);g.lineTo(cx-20,cy-110);g.lineTo(cx-10,cy-20);g.lineTo(cx+110,cy+10);g.lineTo(cx+110,cy+60);g.fill();g.fillStyle='#2a2a2a';for(const dx of[-80,-20,40,95]){g.beginPath();g.arc(cx+dx,cy+90,26,0,7);g.fill();}}
      else if(pic==='film'){g.fillStyle='#1c1c1c';g.beginPath();g.arc(cx,cy,120,0,7);g.fill();g.fillStyle='#efe4c8';for(let k=0;k<6;k++){const a=k/6*6.283;g.beginPath();g.arc(cx+Math.cos(a)*65,cy+Math.sin(a)*65,26,0,7);g.fill();}g.beginPath();g.arc(cx,cy,14,0,7);g.fill();g.fillStyle='#f0c020';for(let k=0;k<5;k++){const a=-1.6+k*1.256;g.beginPath();g.arc(cx+Math.cos(a)*150,cy+Math.sin(a)*150,9,0,7);g.fill();}}
      else if(pic==='tire'){g.fillStyle='#1c1c1c';g.beginPath();g.arc(cx,cy,125,0,7);g.fill();g.fillStyle='#8a8f94';g.beginPath();g.arc(cx,cy,62,0,7);g.fill();g.strokeStyle='#3a3a3a';g.lineWidth=6;for(let k=0;k<24;k++){const a=k/24*6.283;g.beginPath();g.moveTo(cx+Math.cos(a)*100,cy+Math.sin(a)*100);g.lineTo(cx+Math.cos(a)*122,cy+Math.sin(a)*122);g.stroke();}}
      else{for(let k=0;k<6;k++){const x=110+(k%3)*85,y=170+(k/3|0)*110;g.fillStyle=['#e83a3a','#3a8ae8','#f0c020','#3ac06a','#e870c0','#f08a20'][k];g.beginPath();g.arc(x,y,40,0,7);g.fill();g.fillStyle='rgba(255,255,255,.5)';g.beginPath();g.arc(x-13,y-13,11,0,7);g.fill();}}
      g.fillStyle=col;g.textAlign='left';g.font='italic 900 '+(name.length>14?66:84)+'px Georgia,serif';g.fillText(name,380,220,600);g.fillStyle='#3a2a1a';g.font='700 34px Georgia,serif';g.fillText(tag,382,290,600);
      g.fillStyle=col;g.fillRect(382,316,260,5);g.font='italic 700 24px Georgia,serif';g.fillStyle='rgba(58,42,26,.75)';g.fillText(pic==='robo'?'ask for it by name · beep boop':'next exit · alameda & oakland',382,362);});
    [[Z.tu1+m(350),-1],[Z.tu1+m(1100),1],[Z.tu1+m(1500),-1],[Z.tu1+m(2450),1],[Z.i80+m(400),1],[Z.i80+m(1700),-1],[Z.berkeley+m(400),1],[Z.oakland-m(600),1]].forEach(([i,sd],v)=>{const t=rtex(RETRO[v%RETRO.length]),g=new THREE.Group(),bd=new THREE.Mesh(new THREE.PlaneGeometry(13.5,6),new THREE.MeshStandardMaterial({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.3,roughness:.75}));bd.position.y=8;g.add(bd);
      B(13.9,6.4,.3,mat('woodBoard',{color:0x5a4a38,roughness:.9}),0,8,-.17,0,g);const leg=8+(H[i]>2?H[i]:0);for(const x of[-4.5,0,4.5])B(.35,leg,.35,mat('woodPost',{color:0x6a5440,roughness:.9}),x,8-3-leg/2,-.35,0,g);for(const x of[-4,4]){const lm=B(.6,.25,.6,lampMat,x,11.6,.6,0,g);lm.castShadow=false;}   // gooseneck lamps over the top
      g.traverse(o=>{o.castShadow=true;});off(i,sd*(wallAt[i]+8),0,g.position);g.rotation.y=yaw(i)+Math.PI-sd*.36;scene.add(g);});
    // past San Quentin: signs for the chemical works, and the first posters for the Leader; past the San Rafael bridge, Richmond is covered in WE LOVE THE LEADER boards
    const ldr=(title,sub,bg,fg)=>canvas(1024,460,(g,w,h)=>{g.fillStyle=bg;g.fillRect(0,0,w,h);const cx=230,cy=250;g.save();g.translate(cx,cy);for(let k=0;k<24;k++){g.rotate(Math.PI/12);g.fillStyle=k%2?fg:bg;g.beginPath();g.moveTo(0,0);g.lineTo(600,-80);g.lineTo(600,80);g.fill();}g.restore();
      g.fillStyle=bg;g.beginPath();g.arc(cx,cy,150,0,7);g.fill();leaderAlien(g,cx,cy);   // the Leader in a sunburst
      g.fillStyle='rgba(0,0,0,.55)';g.fillRect(420,110,570,250);g.fillStyle='#f4ead2';g.textAlign='center';g.textBaseline='middle';
      g.font='900 '+(title.length>16?60:78)+'px Impact,"Arial Black",Arial';g.fillText(title,705,195,550);g.font='700 34px Georgia,serif';g.fillStyle=fg;g.fillText(sub,705,285,550);});
    const chem=(name,sub,col)=>canvas(1024,460,(g,w,h)=>{g.fillStyle='#e8e6e0';g.fillRect(0,0,w,h);g.fillStyle=col;g.fillRect(0,0,w,90);g.fillRect(0,h-40,w,40);g.fillStyle='#f4f4f4';g.font='900 54px Arial';g.textAlign='left';g.fillText(name,40,62,940);
      g.save();g.translate(190,270);g.rotate(Math.PI/4);g.fillStyle='#f0c020';g.fillRect(-95,-95,190,190);g.strokeStyle='#141414';g.lineWidth=8;g.strokeRect(-95,-95,190,190);g.restore();g.fillStyle='#141414';g.font='900 120px Arial';g.textAlign='center';g.fillText('!',190,312);
      g.font='700 40px Arial';g.textAlign='left';g.fillText(sub,360,240,620);g.font='700 28px Arial';g.fillStyle='#5a5a5a';g.fillText('NEXT RIGHT · TRUCK ENTRANCE · NO VISITORS',360,300,620);});
    const tall=(i,sd,t)=>{const g=new THREE.Group(),bd=new THREE.Mesh(new THREE.PlaneGeometry(13.5,6),new THREE.MeshStandardMaterial({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.45,roughness:.6}));bd.position.y=8;g.add(bd);
      B(13.8,6.3,.25,steelM,0,8,-.15,0,g);const leg=8+(H[i]>2?H[i]:0);for(const x of[-5,5])B(.4,leg,.4,steelM,x,8-3-leg/2,-.35,0,g);g.traverse(o=>{o.castShadow=true;});off(i,sd*(wallAt[i]+8),0,g.position);g.rotation.y=yaw(i)+Math.PI-sd*.36;scene.add(g);};
    tall(Z.sq+m(220),-1,chem('PACIFIC POLYMERS INC.','INDUSTRIAL SOLVENTS & RESINS','#1f4f8a'));tall(Z.sq+m(420),1,ldr('THE LEADER KNOWS THE WAY','Follow. Believe. Belong.','#7a1414','#d8a83a'));
    tall(Z.sq+m(600),-1,chem('BAYCHEM CHLORINE WORKS','CHLORINE · CAUSTIC SODA · ACIDS','#2f6b45'));tall(Z.sq+m(780),1,chem('TRI-COUNTY PETROCHEMICAL','BENZENE · TOLUENE · XYLENE','#8a3a1a'));
    [['WE LOVE THE LEADER','Richmond is grateful.'],['WE ♥ THE LEADER','He watches over us.'],['THE LEADER PROVIDES','Thank him tonight.'],['WE LOVE THE LEADER','Obey with joy.'],['ONE CITY · ONE LEADER','Unity is strength.']].forEach(([a,b],k)=>
      tall(Z.rb1+m(60+k*130),k%2?-1:1,ldr(a,b,['#7a1414','#14284a','#3a1458'][k%3],'#d8a83a')));
    // Hyde Street: WE LOVE THE LEADER boards on the way down, and a big propaganda board at the bottom
    [[Z.hyde+m(365),-1,'WE LOVE THE LEADER','He keeps the city safe.','#8a1010'],[Z.hyde+m(430),1,'WE LOVE THE LEADER','Gratitude is duty.','#14284a'],[Z.marina-m(150),1,'WE ♥ THE LEADER','His eyes are on Hyde Street.','#3a1458']].forEach(([i,sd,a,b,bg])=>tall(i,sd,leaderPoster(a,b,bg)));
    {const n0=scene.children.length;tall(Z.marina-m(35),-1,leaderPoster('THE LEADER','KNOWS · SEES · PROVIDES','#8a1010',1));   /* the big one */const g=scene.children[n0];if(g)g.scale.setScalar(1.35);}
    {// leaking toxic-waste barrels on I-880 and the bridges, glowing green ooze spreading out into the lane (drive through it and the car is slimed green for a while: TOX, toxTick)
      const bm=std({color:0xc8a820,roughness:.5,metalness:.4}),bm2=std({color:0x2a5a8a,roughness:.5,metalness:.4}),om=new THREE.MeshBasicMaterial({color:0x7dff2e,transparent:true,opacity:.92,polygonOffset:true,polygonOffsetFactor:-4,depthWrite:false}),gm=new THREE.MeshBasicMaterial({color:0xaaff55,transparent:true,opacity:.3,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-5,depthWrite:false,fog:false});
      TOX.mm=[om,gm];
      for(const[i,sd]of[[Z.tu1+m(1200),-1],[Z.tu1+m(2600),1],[Z.b0+m(520),1],[Z.b0+m(1700),-1],[Z.rb0+m(500),-1]]){const w=RW+XW[i],s=i*SEG,ol=sd*(w-3.3),sh=new THREE.Shape();
        for(let k=0;k<16;k++){const an=k/16*6.283,r=(k%2?2.3:3)*(.85+Math.random()*.3),x=Math.cos(an)*r,y=Math.sin(an)*r*1.5;k?sh.lineTo(x,y):sh.moveTo(x,y);}
        const g=new THREE.ShapeGeometry(sh).rotateX(-Math.PI/2);at(s,ol,.05,V);for(const[mm,sc,dy]of[[om,1,0],[gm,1.3,.02]]){const pd=new THREE.Mesh(g,mm);pd.position.copy(V);pd.position.y+=dy;pd.rotation.y=yaw(i);pd.scale.setScalar(sc);scene.add(pd);}
        for(let k=0;k<3;k++){const d=new THREE.Mesh(cyl(.3,.3,.9,12),k===1?bm2:bm);if(k===1){at(s,sd*(w-.35),.3,V);d.position.copy(V);d.rotation.set(0,yaw(i),Math.PI/2);}else{at(s+(k-1)*1.2,sd*(w+.25),.45,V);d.position.copy(V);}
          const st=new THREE.Mesh(cyl(.31,.31,.16,12),om);st.position.y=k===1?0:.32;d.add(st);d.castShadow=true;scene.add(d);}   // a band of glowing slime round each drum
        TOX.l.push({s,lat:ol,rs:4.2,rl:2.7});}}
    // the Posey Tube: oil-drum fires along both walls, their smoke hanging under the roof
    {const drum=std({color:0x4a3a2c,roughness:.8,metalness:.4});for(let k=0;k<8;k++){const i=Z.tu0+m(40)+Math.round(k*(Z.tu1-Z.tu0-m(80))/7),sd=k%2?1:-1;off(i,sd*4.6,0,V);
      const d=new THREE.Mesh(cyl(.32,.3,.9,12),drum);d.position.set(V.x,V.y+.45,V.z);scene.add(d);OBST.push({x:V.x,z:V.z,r:.7});BURN.push({x:V.x,y:V.y+1,z:V.z,s:.45});}}
    // San Francisco downtown: tents and tarps along the backs of the pavements, with oil-drum fires and small fires on the kerb between them
    {const drum=std({color:0x4a3a2c,roughness:.8,metalness:.4}),tarps=[0x2f5d8a,0x3f6b3a,0x8a6d2f,0x6b2f2f,0x5a5f66,0x8a8a7a,0x2b3d5a].map(c=>std({color:c,roughness:.9,side:THREE.DoubleSide})),dome=new THREE.SphereGeometry(1,10,6,0,Math.PI*2,0,Math.PI/2),ridge=new THREE.ConeGeometry(1,1,4,1,true).rotateY(Math.PI/4).translate(0,.5,0);
      for(const sd of[-1,1])for(let i=Z.b1+m(70+rr(0,20));i<Z.downtown-m(30);i+=m(rr(9,20))){if(sd>0&&SFX.some(c=>Math.abs(i-c)<m(12)))continue;const r=rnd(),lat=sd*(8.9+XW[i]);
        if(r<.5){const tm=pick(tarps),g=new THREE.Mesh(r<.32?dome:ridge,tm);off(i,lat,0,g.position);g.position.y+=.13;g.scale.set(rr(1.2,1.6),rr(1.1,1.5),rr(1.4,2));g.rotation.y=yaw(i)+rr(-.4,.4);g.castShadow=true;scene.add(g);OBST.push({x:g.position.x,z:g.position.z,r:1});
          if(rnd()<.4){const t2=new THREE.Mesh(ridge,pick(tarps));off(i+m(2.6),lat,0,t2.position);t2.position.y+=.13;t2.scale.set(1.1,1.2,1.6);t2.rotation.y=yaw(i)+rr(-.6,.6);scene.add(t2);}}
        else if(r<.62){off(i,sd*(8.2+XW[i]),0,V);const d=new THREE.Mesh(cyl(.32,.3,.9,12),drum);d.position.set(V.x,V.y+.58,V.z);scene.add(d);OBST.push({x:V.x,z:V.z,r:.7});BURN.push({x:V.x,y:V.y+1.1,z:V.z,s:.45});}
        else if(r<.7){off(i,sd*(8.4+XW[i]),0,V);BURN.push({x:V.x,y:V.y+.3,z:V.z,s:.35});}}}
    // the board with the giant eyes: it watches the traffic, and now and then it blinks
    // textures: 0 ahead, 1 left, 2 right, 3 half shut, 4 shut, 5 down-left, 6 down-right, 7 down; +8 = the same, angry (red irises, brows slammed down, lids narrowed)
    const eyeTex=(look,open,ly=0,ang=0)=>canvas(1024,460,(g,w,h)=>{g.fillStyle=ang?'#1a0706':'#0b0d10';g.fillRect(0,0,w,h);g.strokeStyle='#ff4c3a';g.lineWidth=ang?14:8;g.strokeRect(12,12,w-24,h-24);
      for(const sx of[-1,1]){const cx=w/2+sx*230,cy=200,px=cx+look*70,py=cy+ly*62;g.save();g.beginPath();g.moveTo(cx-190,cy);g.quadraticCurveTo(cx,cy-170*open,cx+190,cy);g.quadraticCurveTo(cx,cy+170*open,cx-190,cy);g.closePath();g.fillStyle=ang?'#f3d9cf':'#f1ede4';g.fill();g.clip();
        if(ang){g.strokeStyle='rgba(200,30,20,.55)';g.lineWidth=3;for(let k=0;k<7;k++){const a=k*.9+sx;g.beginPath();g.moveTo(cx+Math.cos(a)*185,cy+Math.sin(a)*90);g.quadraticCurveTo(cx+Math.cos(a+.3)*130,cy+Math.sin(a+.3)*60,cx+Math.cos(a)*95,cy+Math.sin(a)*45);g.stroke();}}   // bloodshot
        g.fillStyle=ang?'#c0261a':'#2f7fc0';g.beginPath();g.arc(px,py,82,0,7);g.fill();g.fillStyle='#050505';g.beginPath();g.arc(px,py,ang?26:36,0,7);g.fill();g.fillStyle='rgba(255,255,255,.9)';g.beginPath();g.arc(px-24,py-26,13,0,7);g.fill();
        if(ang||ly>0){const iy=ang?cy-30:cy-120,oy=ang?cy-150:cy-120,ix=w/2+sx*40,ox=cx+sx*200;g.fillStyle='#2a1a14';g.beginPath();g.moveTo(ix,iy);g.lineTo(ox,oy);g.lineTo(ox,cy-260);g.lineTo(ix,cy-260);g.closePath();g.fill();}   // the upper lid comes down: heavy-lidded looking down, slanted when angry
        g.restore();
        g.strokeStyle='#1c1c1c';g.lineWidth=12;g.beginPath();g.moveTo(cx-190,cy);g.quadraticCurveTo(cx,cy-170*open,cx+190,cy);g.stroke();
        if(ang){g.lineWidth=34;g.lineCap='round';g.beginPath();g.moveTo(w/2+sx*45,cy-50);g.lineTo(cx+sx*195,cy-175);g.stroke();g.lineCap='butt';}   // brows: inner ends down, outer ends up
        else{g.lineWidth=20;g.beginPath();g.moveTo(cx-170,cy-120-(1-open)*40);g.quadraticCurveTo(cx,cy-190,cx+170,cy-120);g.stroke();}}
      g.fillStyle='#ff4c3a';g.font='900 46px Arial Black,Arial';g.textAlign='center';g.fillText(ang?'WE ARE WATCHING YOU.  ·  OMNISIGHT AI':'WE SEE YOU.  ·  OMNISIGHT AI',w/2,432);});
    const ET=[];for(const a of[0,1])ET.push(eyeTex(0,1,0,a),eyeTex(-1,1,0,a),eyeTex(1,1,0,a),eyeTex(0,.45,0,a),eyeTex(0,.04,0,a),eyeTex(-.75,1,1,a),eyeTex(.75,1,1,a),eyeTex(0,1,1,a));
    EYES={tex:ET,mats:[],bd:[],t:0,look:0,blink:-1,ang:0,at:R(6,10)};
    for(const[i,sd,sc]of[[Z.b1+m(90),1,1.6],[Z.hyde+m(200),-1,1.2],[Z.i80+m(1300),-1,1.6],[Z.tu1+m(1100),-1,1.4]]){const mm=new THREE.MeshStandardMaterial({map:ET[0],emissiveMap:ET[0],emissive:0xffffff,emissiveIntensity:.7,roughness:.6});EYES.mats.push(mm);EYES.bd.push({mm,s:i*SEG,sd,k:-1});
      const g=new THREE.Group(),bd=new THREE.Mesh(new THREE.PlaneGeometry(22*sc,9.9*sc),mm);bd.position.y=12+5*sc;g.add(bd);B(22*sc+.4,9.9*sc+.4,.3,steelM,0,12+5*sc,-.2,0,g);const leg=12+(H[i]>2?H[i]:0);for(const x of[-7*sc,7*sc])B(.6,leg,.6,steelM,x,12-leg/2,-.4,0,g);
      g.traverse(o=>{o.castShadow=true;});off(i,sd*(wallAt[i]+14),0,g.position);g.rotation.y=yaw(i)+Math.PI-sd*.3;scene.add(g);}}

  { // ---- flights of birds: pelicans between the bridge towers, macaws and flamingos, and the hawks that swoop at you in the redwoods
    pelicans=new THREE.Group();pelicans.birds=[];const bm=std({color:0x8d8a80,roughness:.9}),wm=std({color:0x6a675f,roughness:.9,side:D2}),bill=std({color:0xd9b46a,roughness:.7});
    for(let n=0;n<7;n++){const b=new THREE.Group(),r=Math.ceil(n/2),s=n%2?1:-1;b.position.set(s*r*2.1,r*.3,-r*1.9);
      const body=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),bm);body.scale.set(.24,.22,.62);b.add(body);const hd=new THREE.Mesh(new THREE.SphereGeometry(.14,10,8),bm);hd.position.set(0,.16,.62);b.add(hd);
      const bl=new THREE.Mesh(new THREE.BoxGeometry(.07,.07,.6),bill);bl.position.set(0,.1,1.02);b.add(bl);b.w=[1,-1].map(sx=>{const p=new THREE.Group();p.position.set(sx*.18,.08,.05);const w=new THREE.Mesh(new THREE.PlaneGeometry(1.5,.55).rotateX(-Math.PI/2),wm);w.position.x=sx*.75;p.add(w);b.add(p);return p;});
      pelicans.add(b);pelicans.birds.push(b);}
    pelicans.visible=false;scene.add(pelicans);
    const bird=(body,wing,beak,long)=>{const b=new THREE.Group(),bm2=std({color:body,roughness:.8}),wm2=std({color:wing,roughness:.8,side:D2});const o=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),bm2);o.scale.set(.2,.19,long?.5:.42);b.add(o);
      const hd=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),bm2);hd.position.set(0,long?.3:.12,long?.95:.46);b.add(hd);if(long){const nk=new THREE.Mesh(cyl(.035,.045,.7,6),bm2);nk.position.set(0,.16,.7);nk.rotation.x=1.1;b.add(nk);}
      const bl=new THREE.Mesh(new THREE.ConeGeometry(.06,.2,6),std({color:beak}));bl.rotation.x=Math.PI/2;bl.position.set(0,long?.28:.1,long?1.12:.64);b.add(bl);
      b.w=[1,-1].map(sx=>{const p=new THREE.Group();p.position.set(sx*.15,.06,.02);const w=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.5).rotateX(-Math.PI/2),wm2);w.position.x=sx*.55;p.add(w);b.add(p);return p;});return b;};
    exotics=new THREE.Group();exotics.birds=[];const kinds=[[0xd8262a,0x2a56c8,0x222222,0],[0x2f9a3a,0xe8c62a,0xd8d0b8,0],[0xff7fb0,0xff4f8a,0x222222,1],[0x2a6ad8,0xf2c230,0x222222,0],[0xff7fb0,0xe8508a,0x222222,1],[0xf2c230,0x2f9a3a,0x222222,0]];
    for(let n=0;n<11;n++){const b=bird(...kinds[n%kinds.length]);b.position.set(rr(-7,7),rr(-1.5,2.5),rr(-6,6));exotics.add(b);exotics.birds.push(b);}
    exotics.scale.setScalar(2.4);pelicans.scale.setScalar(2.2);exotics.visible=false;scene.add(exotics);
    SWOOP=new THREE.Group();SWOOP.birds=[];for(let n=0;n<6;n++){const b=bird(0x3a2a1e,0x4a3424,0xd9b46a,0);b.position.set(rr(-5,5),rr(-2,2),-n*2.4);SWOOP.add(b);SWOOP.birds.push(b);}SWOOP.scale.setScalar(2.6);SWOOP.visible=false;scene.add(SWOOP);}
  { // ---- the manatee: a big, slow, grey sea cow with a paddle tail (nose points along +z)
    const sk=std({color:0x7d858a,roughness:.75}),bl=std({color:0x4f565b,roughness:.8}),S3=(r,x,y,z,sx,sy,sz,mm=sk)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(r,20,14),mm);o.position.set(x,y,z);o.scale.set(sx,sy,sz);return o;};
    manatee=new THREE.Group();manatee.add(S3(1,0,0,0,.85,.62,1.9),S3(1,0,.02,1.75,.52,.46,.62),S3(1,0,-.08,2.3,.36,.3,.34),S3(.035,.24,.2,2.05,1,1,1,bl),S3(.035,-.24,.2,2.05,1,1,1,bl),S3(.03,.1,-.02,2.6,1,1,1,bl),S3(.03,-.1,-.02,2.6,1,1,1,bl));
    manatee.fl=[1,-1].map(sx=>{const g=new THREE.Group();g.position.set(sx*.7,-.2,1.05);g.add(S3(1,sx*.42,-.1,0,.48,.1,.26));manatee.add(g);return g;});
    manatee.tail=new THREE.Group();manatee.tail.position.set(0,0,-1.7);manatee.tail.add(S3(1,0,0,-.35,.4,.3,.6),S3(1,0,0,-1.15,.82,.11,.62));manatee.add(manatee.tail);
    manatee.traverse(o=>{o.castShadow=true;});manatee.scale.setScalar(1.15);manatee.visible=false;scene.add(manatee);}
  // the bridge's burning wrecks: cars left on the shoulder, charred and smoking
  {const ch=std({color:0x1c1a18,roughness:1});for(const f of[.12,.27,.45,.6,.83]){const i=Z.b0+Math.round((Z.b1-Z.b0)*f),sd=f*10%2<1?1:-1,g=new THREE.Group();g.add(new THREE.Mesh(carG,ch),new THREE.Mesh(whG,ch));off(i,sd*7.4,0,g.position);g.rotation.set(0,yaw(i)+rr(-.6,.6),sd*.12);scene.add(g);OBST.push({x:g.position.x,z:g.position.z,r:2.2});BURN.push({x:g.position.x,y:g.position.y+1,z:g.position.z,s:.8});}}
  // last of all, merge the static scenery by material and by area, so the whole bay draws in a few hundred calls instead of tens of thousands
  Terrain.occupy(scene.children.slice(A0));Terrain.start(scene,CULL,LANDM,grassTex);   // the real hills: level ground is kept under everything built above, and the rest is queued to be raised tile by tile
  bakeStatic(scene.children.slice(A0),new Set([SHIP,pelicans,exotics,manatee,tunL,SWOOP,...(BAYV?[BAYV.g]:[]),...CROWS.map(c=>c.g),...MILLC.tw.map(t=>t.g),...BEARS.map(b=>b.g),...SFP.map(o=>o.g),...DSTK.flatMap(o=>[o.g,...o.hs]),...Object.values(BTL.br).flat().map(x=>x[0])]));
  for(const o of [...scene.children])if(o.isInstancedMesh&&o.frustumCulled&&o.count>60)splitInstanced(o);
}

await BOOT.step('ROLLING OUT THE CARS',.78);
/* ================= CARS ================= */
const spl=a=>{const c=new THREE.CatmullRomCurve3(a.map((y,i)=>new THREE.Vector3(i,y,0)),false,'catmullrom',.5);return v=>c.getPoint(clamp(v,0,1)).y;};
const MODELS={
  k:{name:'Porsche 917K',year:'1970',desc:'Kurzheck. Short upswept tail: the most grip, the classic.',CL:4.4,B:[.54,.53,.50,.46,.42,.39,.37,.35,.30,.19,.03],W:[.90,.95,.98,.98,.97,.96,.97,.98,.96,.88,.66],rb:.2,top:100,grip:1,acc:1,twitch:0},
  o:{name:'Porsche 917',year:'1969',desc:'The original. Sloping tail: fast but nervous at speed.',CL:4.55,B:[.24,.35,.44,.46,.43,.39,.37,.35,.30,.19,.03],W:[.86,.93,.97,.98,.97,.96,.97,.98,.96,.88,.66],rb:.15,top:104,grip:.9,acc:1.03,twitch:1},
  lh:{name:'Porsche 917LH',year:'1971',desc:'Langheck. Long low-drag tail: highest top speed, less grip.',CL:5.3,B:[.30,.36,.41,.45,.47,.44,.40,.36,.31,.19,.03],W:[.78,.86,.92,.96,.98,.97,.96,.97,.96,.88,.66],rb:.13,top:108,grip:.92,acc:.97,twitch:0},
  lhs:{name:'Porsche 917LH Aluminium',year:'1970',desc:'Langheck in bare silver: an even longer, flatter tail ending in two fins and a blade. The fastest 917, a touch less grip.',CL:5.55,B:[.40,.41,.43,.46,.47,.44,.40,.36,.31,.19,.03],W:[.88,.91,.94,.96,.98,.97,.96,.97,.96,.88,.66],rb:.15,fb:.33,top:109,grip:.9,acc:.97,twitch:0,wh:'multi'},
  f512:{name:'Ferrari 512 S',year:'1970',desc:'The V12 rival. Low wedge nose, tall front wings, a flat high tail with a lip.',CL:4.3,B:[.60,.60,.585,.54,.46,.40,.37,.34,.25,.13,.035],W:[.99,1.01,1.02,1.02,1,.99,1,1.02,1.01,.95,.8],rb:.2,fb:.36,top:101,grip:.97,acc:1.03,twitch:0,cy:.95,cw:1.05,cz:.14,lamp:'rect'},
  gt40:{name:'Ford GT40 Spyder',year:'1965',desc:'Open-top, older and heavier, with a blunt nose and a chopped tail: slower on the straight, steady in the corners.',CL:4.05,B:[.50,.51,.50,.47,.43,.40,.39,.39,.38,.33,.16],W:[.90,.92,.93,.92,.91,.90,.91,.92,.93,.92,.84],rb:.07,fb:.1,top:95,grip:1.01,acc:.92,twitch:0,cy:.6,cw:.94,open:1,lamp:'round'},
  // classic cars: a separate class from the racers. int: the cockpit (dash, instrument panel, wheel rim, spokes)
  m1:{cls:1,name:'BMW M1',year:'1978',desc:'Mid-engined wedge: flat nose, louvred tail. Quick and well balanced.',CL:4.36,B:[.50,.53,.54,.53,.49,.43,.37,.32,.28,.23,.10],W:[.90,.93,.94,.94,.93,.92,.93,.94,.93,.89,.76],rb:.07,fb:.08,top:74,grip:.93,acc:.8,twitch:0,cy:1.04,cw:1.02,cz:.1,lamp:'rect',int:{dash:0x121212,panel:0x161616,rim:0x101010,spoke:0x1a1a1a,hub:0xc9cbc8}},
  p904:{cls:1,name:'Porsche 904 Carrera GTS',year:'1964',desc:'Small, light and curvy, with round wings. Not the fastest, but nimble.',CL:4.09,B:[.40,.47,.51,.51,.47,.41,.37,.37,.37,.31,.12],W:[.80,.88,.93,.95,.94,.92,.93,.95,.94,.86,.62],rb:.26,fb:.3,top:71,grip:.97,acc:.74,twitch:0,cy:1.02,cw:.92,lamp:'round',int:{dash:0xb8201a,panel:0xb8201a,rim:0x8a5a2a,spoke:0xc9cbc8,hub:0x141414}},
  ghibli:{cls:1,name:'Maserati Ghibli',year:'1967',desc:'Front-engined grand tourer: a very long bonnet and a fastback tail. Fast, heavy, likes a straight.',CL:4.59,B:[.40,.48,.53,.55,.53,.48,.45,.43,.41,.37,.20],W:[.84,.90,.93,.94,.94,.93,.93,.93,.92,.88,.72],rb:.09,fb:.07,top:75,grip:.86,acc:.76,twitch:0,cy:1,cw:1,cz:-.55,lamp:'rect',int:{dash:0x1c1c1e,panel:0x3a3a3c,rim:0x8a5a2a,spoke:0xc9cbc8,hub:0x141414}},
  bb:{cls:1,name:'Ferrari 512 BB',year:'1976',desc:'Flat-twelve berlinetta: low wedge, black below the waist. The fastest of the classics.',CL:4.4,B:[.47,.51,.52,.51,.47,.42,.37,.32,.28,.22,.09],W:[.92,.95,.96,.96,.95,.94,.95,.96,.95,.91,.78],rb:.1,fb:.1,top:81,grip:.92,acc:.86,twitch:0,cy:1,cw:1.03,cz:.05,lamp:'rect',int:{dash:0x121212,panel:0x1a1a1a,rim:0x101010,spoke:0xc9cbc8,hub:0x141414}},
  lp400:{cls:1,name:'Lamborghini Countach LP400',year:'1974',desc:'Periscopio. A flat, sharp wedge with a periscope in the roof. The fastest of the classics, and twitchy with it.',CL:4.14,B:[.42,.46,.46,.43,.39,.35,.32,.28,.23,.17,.1],W:[.95,.98,.99,.99,.98,.96,.95,.95,.93,.88,.76],rb:.12,fb:.06,top:84,grip:.9,acc:.9,twitch:1,cy:1.12,cw:1.04,cz:.2,lamp:'rect',wh:'dial',road:.85,int:{dash:0x121212,panel:0x1a1a1a,rim:0x101010,spoke:0x2a2a2a,hub:0x141414}},
  f400:{cls:1,name:'Ferrari 400 Superamerica',year:'1962',desc:'Coupé aerodinamico: a long nose with covered lamps and a fastback tail. Smooth, stable and quick.',CL:4.7,B:[.2,.46,.56,.60,.60,.58,.57,.56,.54,.48,.30],W:[.66,.84,.91,.93,.93,.92,.92,.92,.91,.86,.64],rb:.07,fb:.12,top:77,grip:.88,acc:.78,twitch:0,cy:1.45,cw:.9,cz:-.55,cs:1.3,wh:'wire',road:.62,int:{dash:0x2a1a12,panel:0x3a3a3c,rim:0x8a5a2a,spoke:0xc9cbc8,hub:0x141414}},
  van:{cls:1,name:'Ford Econoline window van',year:'1962',desc:'A flat-fronted box on wheels with windows all round. Slow, soft and leans in the corners: take it easy.',CL:4.3,B:[1.7,1.75,1.76,1.76,1.76,1.76,1.76,1.76,1.75,1.73,1.68],W:[.9,.93,.94,.94,.94,.94,.94,.94,.94,.93,.91],rb:.001,fb:.001,top:40,grip:.74,acc:.46,twitch:0,cy:1,lamp:'none',plain:1,roll:1,hs:.8,camY:2.25,road:.9,int:{dash:0x8f8f8a,panel:0x2a2a2a,rim:0xe8e4d6,spoke:0xc9cbc8,hub:0x141414}},
  sherp:{cls:1,name:'Sherp N 1200',year:'2015',desc:'A box cab on four huge low-pressure balloon tyres, steered by braking one side like a tank. Slow, but it grips and goes where it is pointed.',CL:3.4,B:[1.7,1.75,1.76,1.76,1.76,1.76,1.76,1.76,1.75,1.73,1.68],W:[.9,.93,.94,.94,.94,.94,.94,.94,.94,.93,.91],rb:.001,fb:.001,top:36,grip:1.08,acc:.55,twitch:0,cy:1,lamp:'none',plain:1,hs:.8,camY:2.6,road:.9,int:{dash:0x2a2a2a,panel:0x1a1a1a,rim:0x141414,spoke:0x2a2a2a,hub:0x141414}},   // sherp: everything visible is built in makeCar's sherp branch; the body profile above is hidden
  p911:{cls:1,name:'Porsche 911 Carrera',year:'1973',desc:'The early-seventies rear-engined coupé: round lamps up on the wings, a ducktail on the engine lid. Light, nimble and quick, and a bit twitchy at the back: lift off or turn in hard and the tail steps out, but it can be caught.',CL:4.15,B:[.56,.62,.66,.68,.66,.62,.6,.6,.58,.53,.42],W:[.82,.88,.9,.9,.88,.86,.86,.87,.86,.82,.7],rb:.22,fb:.24,top:74,grip:.95,acc:.85,twitch:1,cy:1.42,cw:.9,cz:-.2,cs:1.12,lamp:'none',road:.75,int:{dash:0x141414,panel:0x1c1c1c,rim:0x141414,spoke:0x2a2a2a,hub:0x141414}},   // Bay drive only, like the Sherp
  bz:{cls:1,name:'Bizzarrini 5300 Strada',year:'1965',desc:'A Corvette V8 under a very low, very long nose, and a short fastback cut off square. Fast and lively.',CL:4.37,B:[.48,.52,.53,.52,.48,.42,.36,.3,.24,.17,.09],W:[.84,.89,.91,.91,.9,.88,.88,.89,.88,.82,.66],rb:.1,fb:.1,top:82,grip:.9,acc:.87,twitch:0,cy:1.25,cw:.92,cz:-.45,cs:1.02,lamp:'none',road:.75,int:{dash:0x1c1c1e,panel:0x2a2a2c,rim:0x8a5a2a,spoke:0xc9cbc8,hub:0x141414}},
  b507:{cls:1,name:'BMW 507',year:'1957',desc:'A V8 roadster with its hardtop on: a long low bonnet, a wide twin-kidney grille and round lamps in the wings. Smooth and balanced, a grand tourer rather than a racer.',CL:4.38,B:[.3,.5,.56,.58,.58,.57,.56,.55,.54,.5,.4],W:[.7,.83,.87,.88,.88,.87,.87,.88,.87,.84,.72],rb:.08,fb:.1,top:70,grip:.88,acc:.72,twitch:0,cy:1.4,cw:.86,cz:-.55,cs:1.0,lamp:'none',plain:1,wh:'cap',road:.62,tlx:.72,int:{dash:0xb89a72,panel:0x2a2a2c,rim:0xe8e0c8,spoke:0xc9cbc8,hub:0xc9cbc8}},
  ac:{cls:1,name:'Concept Coupe',year:'2025',desc:'A low, wide, matte mid-engined concept: a black grille face with light-strip lamps, louvres over the engine and dark wheels. Fast, grippy and a little stiff.',CL:4.42,B:[.46,.5,.51,.5,.46,.41,.36,.31,.26,.2,.09],W:[.94,.97,.98,.98,.97,.96,.96,.97,.96,.91,.78],rb:.1,fb:.08,top:88,grip:1.0,acc:.92,twitch:0,cy:.98,cw:1.04,cz:.12,lamp:'none',road:.85,int:{dash:0x1a1a1a,panel:0x262626,rim:0x101010,spoke:0x2a2a2a,hub:0x141414}}};
buildTables();for(const k in MODELS)MODELS[k].dyn=makeDyn(k,MODELS[k]);   // tyre and engine tables, and each car's weights, gearing and aerodynamics (js/sim/vehicle.js)
const RACERS=['o','k','lh','lhs','f512','gt40'],CLASSICS=['m1','p904','ghibli','bb','lp400','f400','bz','b507','van'].concat(DRIVE?['sherp','p911']:[]),ZF=2.2,WZ=[1.25,-1.3];let MKEYS=RACERS;
function arch(z){for(const zw of WZ){const d=z-zw;if(Math.abs(d)<.41)return .33+Math.sqrt(.41*.41-d*d);}return 0;}
for(const k in MODELS){const m=MODELS[k];m.Bf=spl(m.B);m.Wf=spl(m.W);m.zR=ZF-m.CL;
  m.topY=(u,v,z)=>{const a=Math.abs(u),e=Math.exp(-(((a-.78)/.24)**2));return .14+m.Bf(v)*Math.sqrt(1-a**8)+e*((m.fb||.25)*Math.exp(-(((z-1.25)/.44)**2))+m.rb*Math.exp(-(((z+1.3)/.75)**2)));};
  const NV=Math.round(40*m.CL),NU=80,pos=[],uv=[],idx=[];
  for(let i=0;i<=NV;i++){const v=i/NV,z=m.zR+v*m.CL,w=m.Wf(v);
    for(let j=0;j<=NU;j++){const u=Math.sin(-Math.PI/2+Math.PI*j/NU);let y=m.topY(u,v,z);
      if(Math.abs(u)>.9){const a=arch(z);if(a>0)y=Math.max(y,Math.min(a,m.topY(.86*Math.sign(u),v,z)-.035));}
      pos.push(u*w,y,z);uv.push((1-u)/2,v);
      if(i<NV&&j<NU){const a=i*(NU+1)+j;idx.push(a,a+1,a+NU+1,a+1,a+NU+2,a+NU+1);}}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();m.geo=g;
  const cp=[0,.14+m.B[0]*.5,m.zR+.02],ci=[];for(let j=0;j<=NU;j++){cp.push(pos[j*3],pos[j*3+1],pos[j*3+2]);if(j<NU)ci.push(0,j+1,j+2);}
  m.cap=new THREE.BufferGeometry();m.cap.setAttribute('position',new THREE.Float32BufferAttribute(cp,3));m.cap.setIndex(ci);m.cap.computeVertexNormals();}
// canopy: lofted wraparound greenhouse (replaces the old dome)
const cTop=spl([.66,.76,.84,.90,.93,.94,.93,.90,.82,.68,.50]),cHw=spl([.42,.5,.56,.6,.63,.65,.67,.68,.68,.64,.5]),CZ0=-1.15,CZ1=1.08,CYB=.38;
const canPt=(u,s)=>{const t=Math.PI*u,c=Math.cos(t),f=Math.pow(Math.sin(t),.7),x=Math.sign(c)*Math.pow(Math.abs(c),.55)*cHw(s)*(1-.3*f);return[x,CYB+(cTop(s)-CYB)*f,f];};
const CANOPY=(()=>{const NV=64,NU=72,pos=[],uv=[],idx=[];
  for(let i=0;i<=NV;i++){const s=i/NV;for(let j=0;j<=NU;j++){const u=j/NU,[x,y]=canPt(u,s);pos.push(x,y,lerp(CZ0,CZ1,s));uv.push(u,s);if(i<NV&&j<NU){const a=i*(NU+1)+j;idx.push(a,a+NU+1,a+1,a+1,a+NU+1,a+NU+2);}}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;})();
function canopyTex(o,res){const W=512*res,H=256*res;return canvas(W,H,(g)=>{const im=g.createImageData(W,H),d=im.data;
  const toS=h=>{const c=new THREE.Color(h);return[c.r,c.g,c.b].map(v=>Math.pow(v,1/2.2)*255);},B=toS(o.base),St=toS(o.stripe||o.base),Hc=toS(o.helmet);
  for(let py=0;py<H;py++){const s=1-py/H;for(let px=0;px<W;px++){const u=px/W,[x,y,f]=canPt(u,s),k=(py*W+px)*4;let r,gg,b;
    const ws=s>.7&&s<.985&&f>.2, wsI=s>.715&&s<.97&&f>.25;
    const sw=s>.43&&s<=.69&&f>.3&&f<.84&&Math.abs(x)>.3, swI=s>.445&&s<.675&&f>.34&&f<.8&&Math.abs(x)>.34;
    const rw=s>.1&&s<.37&&Math.abs(x)<.3&&f>.6, rwI=s>.115&&s<.355&&Math.abs(x)<.28;
    if(wsI||swI||(rw&&rwI)){const sk=clamp((y-.5)/.45,0,1);r=14+sk*74;gg=22+sk*94;b=28+sk*110;const hl=Math.exp(-((u-.28-s*.25)**2)/.0012)*85;r+=hl;gg+=hl;b+=hl;
      if(wsI){const dx=x+.26,dy=y-.74;if(dx*dx+dy*dy*1.2<.0125){r=Hc[0]*.85;gg=Hc[1]*.85;b=Hc[2]*.85;   // helmet, with the white fireproof balaclava and just the eyes showing
          if(Math.abs(dx)<.07&&dy<.015&&dy>-.1){r=232;gg=228;b=216;if(dy<-.005&&dy>-.032&&Math.abs(dx)<.055){r=196;gg=150;b=124;if(Math.abs(Math.abs(dx)-.026)<.011&&dy<-.012&&dy>-.026){r=60;gg=110;b=170;}}}}
        else if(y<.66&&Math.abs(x+.26)<.2){r=206;gg=201;b=188;}
        else if(y<.62&&x>-.02&&x<.5){r=24;gg=24;b=24;}}
      if(rw&&rwI&&((s*60|0)%2)){r*=.5;gg*=.5;b*=.5;}}
    else if(ws||sw||rw){r=16;gg=17;b=18;}
    else if(Math.abs(x)<.082&&o.stripe){[r,gg,b]=St;}
    else{[r,gg,b]=B;if(Math.abs(s-.4)<.004||Math.abs(s-.7)<.003){r*=.6;gg*=.6;b*=.6;}}
    d[k]=r;d[k+1]=gg;d[k+2]=b;d[k+3]=255;}}
  g.putImageData(im,0,0);});}
function liveryLines(g,w,h,col,lw){g.strokeStyle=col;g.lineWidth=lw;g.lineCap='round';
  const L=(...p)=>{g.beginPath();g.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)g.lineTo(p[i],p[i+1]);g.stroke();};
  L(0,318,w,318);L(0,690,150,690,170,712,342,712,362,690,w,690);
  for(const x of[0,1]){const m=v=>x?w-v:v;L(m(6),330,m(96),336,m(104),610,m(6),620);L(m(120),318,m(150),690);}
  L(150,712,150,1010);L(362,712,362,1010);L(150,1010,362,1010);
  g.beginPath();g.ellipse(256,34,96,13,0,0,7);g.stroke();}
function livery(o,M,res){const ky=4.4/M.CL;
  const map=canvas(512*res,1024*res,(g)=>{g.scale(res,res);const w=512,h=1024;g.fillStyle=o.base;g.fillRect(0,0,w,h);
    if(o.patina){let sd=7;const q=()=>{sd=(sd*16807)%2147483647;return sd/2147483647;};   // barn find: paint faded pale in patches, darker blotches, rust spots and dust
      for(let i=0;i<70;i++){const x=q()*w,y=q()*h,r=20+q()*90;const rg=g.createRadialGradient(x,y,0,x,y,r);const c=q()<.55?'232,170,150':q()<.5?'70,22,14':'140,120,96';rg.addColorStop(0,`rgba(${c},${.18+q()*.3})`);rg.addColorStop(1,`rgba(${c},0)`);g.fillStyle=rg;g.fillRect(x-r,y-r,2*r,2*r);}
      for(let i=0;i<160;i++){const x=q()*w,y=q()*h,r=1+q()*q()*14;g.fillStyle=`rgba(${q()<.5?'110,52,24':'60,30,18'},${.5+q()*.4})`;g.beginPath();g.ellipse(x,y,r*(1+q()),r,q()*3,0,7);g.fill();}
      for(let i=0;i<3000;i++){g.fillStyle=`rgba(150,130,104,${q()*.18})`;g.fillRect(q()*w,q()*h,1+q()*3,1+q()*3);}}
    if(!M.plain){
    if(o.stripe){g.fillStyle=o.stripe;g.fillRect(w/2-38,0,76,h);g.beginPath();g.moveTo(w/2-38,h*.82);g.lineTo(w/2-118,h);g.lineTo(w/2+118,h);g.lineTo(w/2+38,h*.82);g.fill();
      g.strokeStyle=o.pin;g.lineWidth=2.2;g.beginPath();g.moveTo(w/2-41,150*ky);g.lineTo(w/2-41,h*.82);g.lineTo(w/2-122,h);g.moveTo(w/2+41,150*ky);g.lineTo(w/2+41,h*.82);g.lineTo(w/2+122,h);g.stroke();}
    if(o.edge){g.fillStyle=o.edge;g.fillRect(0,0,16,h);g.fillRect(w-16,0,16,h);}
    if(o.swoop){g.fillStyle=o.swoop;for(const sx of[-1,1]){const X=v=>w/2+sx*v;g.beginPath();g.moveTo(X(8),0);g.bezierCurveTo(X(40),110*ky,X(192),170*ky,X(198),330*ky);g.lineTo(X(198),h);g.lineTo(X(142),h);g.lineTo(X(142),340*ky);g.bezierCurveTo(X(136),235*ky,X(60),195*ky,X(8),150*ky);g.closePath();g.fill();}}
    if(o.sideF){g.fillStyle=o.sideF;for(const x of[0,1]){const X=v=>x?w-v:v;g.beginPath();g.moveTo(X(0),0);g.lineTo(X(40),0);g.lineTo(X(40),300/ky);g.lineTo(X(0),430/ky);g.fill();}}   // white front wings running down the sides, red behind
    if(o.twin){g.fillStyle=o.twin;g.fillRect(w/2-70,0,26,h);g.fillRect(w/2+44,0,26,h);}
    if(o.swirl){let sd=11;const q=()=>{sd=(sd*16807)%2147483647;return sd/2147483647;};g.strokeStyle=o.swirl;g.lineCap='round';
      for(let i=0;i<16;i++){g.lineWidth=14+q()*22;const x=q()*w,y=q()*h;g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x+(q()-.5)*300,y+q()*160,x+(q()-.5)*300,y+160+q()*160,x+(q()-.5)*120,y+320+q()*120);g.stroke();}
      g.strokeStyle='#e9d24a';g.lineWidth=5;for(let i=0;i<12;i++){g.beginPath();g.arc(q()*w,q()*h,20+q()*40,q()*6,q()*6+3.4);g.stroke();}}
    g.save();g.scale(1,ky);
    if(o.band){g.fillStyle=o.band;g.fillRect(0,88,w,34);g.fillRect(0,430,w,58);}
    if(o.stripe){g.fillStyle=o.stripe;g.beginPath();g.moveTo(0,0);g.lineTo(w,0);g.lineTo(w,70);g.quadraticCurveTo(w/2,150,0,70);g.fill();g.strokeStyle=o.pin;g.lineWidth=2.2;g.beginPath();g.moveTo(0,73);g.quadraticCurveTo(w/2,154,w,73);g.stroke();}
    if(o.nose){g.fillStyle=o.nose;g.beginPath();g.moveTo(0,0);g.lineTo(w,0);g.lineTo(w,48);g.quadraticCurveTo(w/2,96,0,48);g.fill();}
    g.fillStyle='#0b0c0d';g.beginPath();g.ellipse(256,34,92,10,0,0,7);g.fill();for(const x of[150,362]){g.beginPath();g.ellipse(x,62,22,8,0,0,7);g.fill();}
    g.strokeStyle='#3a3d40';g.lineWidth=1;for(let x=176;x<340;x+=9){g.beginPath();g.moveTo(x,26);g.lineTo(x,42);g.stroke();}
    const lampDot=(x,y,r)=>{const rg=g.createRadialGradient(x,y,2,x,y,r);rg.addColorStop(0,'#fffbe8');rg.addColorStop(.6,'#cfc9ae');rg.addColorStop(1,'#77735f');g.fillStyle=rg;g.beginPath();g.arc(x,y,r,0,7);g.fill();};
    if(M.lamp==='rect'){for(const x of[84,428]){g.fillStyle='#cfd3cf';g.beginPath();g.roundRect(x-36,96,72,118,22);g.fill();lampDot(x,170,24);g.strokeStyle='#202224';g.lineWidth=3.5;g.beginPath();g.roundRect(x-36,96,72,118,22);g.stroke();}   // long glazed covers, twin lamps in the nose
      g.fillStyle='#e8e6d8';g.fillRect(212,16,88,28);g.strokeStyle='#202224';g.lineWidth=2;g.strokeRect(212,16,88,28);g.beginPath();g.moveTo(256,16);g.lineTo(256,44);g.stroke();g.fillStyle='#0b0c0d';g.fillRect(116,22,84,14);g.fillRect(312,22,84,14);}
    if(M.lamp==='round'){for(const x of[88,424])for(const y of[92,150]){g.fillStyle='#b9b6aa';g.beginPath();g.arc(x,y,27,0,7);g.fill();lampDot(x,y,22);}g.fillStyle='#0b0c0d';g.fillRect(150,18,212,18);}              // stacked round lamps, wide slot
    if(!M.lamp)for(const x of[92,420]){g.fillStyle='#d9d2b4';g.beginPath();g.ellipse(x,150,34,58,0,0,7);g.fill();
      for(const yy of[128,172]){const rg=g.createRadialGradient(x,yy,2,x,yy,18);rg.addColorStop(0,'#fffbe8');rg.addColorStop(.6,'#cfc9ae');rg.addColorStop(1,'#77735f');g.fillStyle=rg;g.beginPath();g.arc(x,yy,17,0,7);g.fill();}
      g.strokeStyle='#202224';g.lineWidth=3.5;g.beginPath();g.ellipse(x,150,34,58,0,0,7);g.stroke();g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=1.5;g.beginPath();g.ellipse(x-6,140,22,44,0,3.4,4.7);g.stroke();}
    if(o.bare){g.fillStyle='#ecebe4';g.fillRect(w/2-46,52,92,16);g.strokeStyle='#202224';g.lineWidth=1.5;g.strokeRect(w/2-46,52,92,16);g.save();g.translate(w/2,60);g.rotate(Math.PI);g.fillStyle='#202224';g.font='700 12px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText('S - 917',0,1);g.restore();   // slim plate on the nose, little Porsche crest above it
      g.save();g.translate(w/2,150);g.fillStyle='#b8943c';g.beginPath();g.moveTo(-13,-15);g.lineTo(13,-15);g.lineTo(13,3);g.quadraticCurveTo(12,13,0,17);g.quadraticCurveTo(-12,13,-13,3);g.closePath();g.fill();g.fillStyle='#b3241c';g.fillRect(-10,-12,9,6);g.fillRect(1,1,9,6);g.fillStyle='#141414';g.fillRect(1,-12,9,6);g.fillRect(-10,1,9,6);g.fillStyle='#e3b63a';g.fillRect(-4,-5,8,8);g.restore();}
    if(!M.cls&&!o.bare){g.fillStyle='#f3efe2';g.beginPath();g.ellipse(w/2,186,56,50,0,0,7);g.fill();g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=1.5;g.stroke();   // race number on the nose (the classic cars carry none)
    g.save();g.translate(w/2,186);g.rotate(Math.PI);g.fillStyle='#111';g.font='900 70px Arial Black,Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(o.num,0,4);g.restore();}
    if(o.logos==='shell'){g.save();g.translate(w/2,262);g.rotate(Math.PI);g.fillStyle='#f3efe2';g.fillRect(-46,-13,92,26);g.fillStyle='#c4231a';g.font='900 19px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText('Shell',0,1);g.fillStyle='#f3efe2';g.font='900 15px Arial';g.fillText('PORSCHE',0,-28);g.restore();}   // Salzburg: Shell badge and PORSCHE under the number
    if(o.logos==='gulf'){g.save();g.translate(w/2,262);g.rotate(Math.PI);g.fillStyle='#1c2f55';g.beginPath();g.arc(0,0,22,0,7);g.fill();g.fillStyle='#e0612a';g.beginPath();g.arc(0,0,18,0,7);g.fill();g.fillStyle='#1c2f55';g.font='900 13px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText('Gulf',0,1);g.restore();}   // Gulf badge on the nose
    g.fillStyle='#0d0e0f';for(const x of[76,436]){g.beginPath();g.moveTo(x-9,268);g.lineTo(x+9,268);g.lineTo(x+3,306);g.lineTo(x-3,306);g.fill();}
    for(const[x,y]of[[112,350],[400,350]]){g.fillStyle='#b9b6aa';g.beginPath();g.arc(x,y,9,0,7);g.fill();g.strokeStyle='#33352f';g.lineWidth=2;g.stroke();g.beginPath();g.moveTo(x-6,y);g.lineTo(x+6,y);g.stroke();}
    g.fillStyle='#c9c6b8';for(const[x,y]of[[170,300],[342,300],[60,326],[452,326],[170,700],[342,700],[30,700],[482,700]]){g.beginPath();g.arc(x,y,3.2,0,7);g.fill();}
    const stick=(x,y,t,bg,fg,ww=44)=>{g.save();g.translate(x,y);g.rotate(Math.PI);g.fillStyle=bg;g.fillRect(-ww/2,-8,ww,16);g.fillStyle=fg;g.font='900 11px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(t,0,1);g.restore();};
    if(!M.road&&!o.bare){stick(52,250,'HUILES','#f2ead2','#a3301f');stick(460,250,'PNEUS','#e3b63a','#111');stick(44,292,'BOUGIES','#1f4f8a','#f2ead2',50);stick(468,292,'FREINS','#f2ead2','#111');}
    g.fillStyle='#0e0f10';if(!M.road)for(let y=792;y<980;y+=11){g.fillRect(168,y,74,5);g.fillRect(270,y,74,5);}
    for(const x of[60,452]){for(let y=742;y<800;y+=9)g.fillRect(x-22,y,44,4);}
    liveryLines(g,w,h,'rgba(18,26,34,.6)',1.6);g.restore();}
    if(o.logos){g.fillStyle='#f3efe2';g.beginPath();g.arc(w/2,h-44,34,0,7);g.fill();g.strokeStyle='rgba(0,0,0,.4)';g.lineWidth=1.5;g.stroke();g.fillStyle='#111';g.font='900 40px Arial Black,Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(o.num,w/2,h-41);}   // the number again on the tail
    for(const x of[0,1]){const gr=g.createLinearGradient(x?w:0,0,x?w-50:50,0);gr.addColorStop(0,'rgba(60,52,40,.55)');gr.addColorStop(1,'rgba(60,52,40,0)');g.fillStyle=gr;g.fillRect(x?w-50:0,0,50,h);}
    const tg=g.createLinearGradient(0,h,0,h-140);tg.addColorStop(0,'rgba(20,18,16,.6)');tg.addColorStop(1,'rgba(20,18,16,0)');g.fillStyle=tg;g.fillRect(0,h-140,w,140);
    for(let i=0;i<5200;i++){g.fillStyle=`rgba(64,54,40,${Math.random()*.11})`;g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*4,2+Math.random()*16);}
  });
  const bump=canvas(512,1024,(g,w,h)=>{g.fillStyle='#808080';g.fillRect(0,0,w,h);if(M.plain)return;g.scale(1,ky);liveryLines(g,w,h,'#101010',3);g.fillStyle='#202020';g.beginPath();g.ellipse(256,34,92,10,0,0,7);g.fill();
    if(!M.road)for(let y=792;y<980;y+=11){g.fillRect(168,y,74,5);g.fillRect(270,y,74,5);}g.fillStyle='#c8c8c8';for(const x of[92,420]){g.beginPath();g.ellipse(x,150,34,58,0,0,7);g.fill();}},false);
  const emis=canvas(256,512,(g,w,h)=>{g.fillStyle='#000';g.fillRect(0,0,w,h);g.scale(1,ky);g.fillStyle='#fff';
    for(const[x,y,r]of(M.lamp==='rect'?[[42,85,11],[214,85,11],[118,15,6],[138,15,6]]:M.lamp==='round'?[[44,46,10],[44,75,10],[212,46,10],[212,75,10]]:[[46,64,7.5],[46,86,7.5],[210,64,7.5],[210,86,7.5]])){g.beginPath();g.arc(x,y,r,0,7);g.fill();}});
  return new THREE.MeshPhysicalMaterial({map,bumpMap:bump,bumpScale:2.5,emissiveMap:emis,emissive:o.bare?0xffcf78:0xffe6b0,emissiveIntensity:M.lamp==='none'?0:5,roughness:o.patina?.78:o.bare?.3:.34,metalness:o.bare?.3:.05,clearcoat:o.patina?.05:.8,clearcoatRoughness:.2,side:THREE.DoubleSide});
}
const hubTex=canvas(256,256,(g)=>{g.clearRect(0,0,256,256);g.fillStyle='#111';g.beginPath();g.arc(128,128,127,0,7);g.arc(128,128,78,0,7,true);g.fill();
  g.strokeStyle='#1d1d1d';g.lineWidth=2;for(const r of[120,112,86]){g.beginPath();g.arc(128,128,r,0,7);g.stroke();}
  g.fillStyle='#d8cf9e';g.font='700 17px Arial';g.textAlign='center';g.textBaseline='middle';const txt='GRAND PRIX  ·  COURSE  ·  GRAND PRIX  ·  COURSE  ·  ';for(let i=0;i<txt.length;i++){const a=i/txt.length*6.283;g.save();g.translate(128+Math.cos(a)*100,128+Math.sin(a)*100);g.rotate(a+Math.PI/2);g.fillText(txt[i],0,0);g.restore();}});
const tyreMat=std({color:0x131313,roughness:.92}),rimSilver=std({color:0xa9a48f,roughness:.35,metalness:.85}),rimDark=std({color:0x2a2a28,roughness:.6,metalness:.5});
const wallMat=std({map:hubTex,transparent:true,roughness:.9,polygonOffset:true,polygonOffsetFactor:-2});
const P2=(r,y)=>new THREE.Vector2(r,y);
const WHEELG=[.32,.42].map(wd=>{const h=wd/2;return{tyre:new THREE.LatheGeometry([P2(.2,-h),P2(.285,-h),P2(.318,-h+.025),P2(.33,-h+.07),P2(.33,h-.07),P2(.318,h-.025),P2(.285,h),P2(.2,h)],32),
  rim:new THREE.LatheGeometry([P2(.001,h-.11),P2(.07,h-.11),P2(.15,h-.075),P2(.195,h-.02),P2(.205,h+.004),P2(.2,h-.03)],32),h};});
const spokeG=new THREE.BoxGeometry(.045,.03,.15),wireG=new THREE.BoxGeometry(.007,.007,.19),earG=new THREE.BoxGeometry(.03,.025,.15),nutG=cyl(.035,.045,.07,6),ringG=new THREE.RingGeometry(.2,.33,36),nutMat=std({color:0xc9b060,metalness:.9,roughness:.3});
function wheel(k,rimMat=rimSilver,st){const g=new THREE.Group(),W=WHEELG[k],h=W.h;
  const tyre=new THREE.Mesh(W.tyre,tyreMat);tyre.castShadow=true;g.add(tyre);g.add(new THREE.Mesh(W.rim,rimMat));
  if(st==='dial'){const d=new THREE.Mesh(cyl(.19,.19,.02,28),rimMat);d.position.y=h-.07;g.add(d);for(let i=0;i<5;i++){const a=i/5*6.283,ho=new THREE.Mesh(cyl(.045,.045,.024,14),dark);ho.position.set(Math.sin(a)*.118,h-.064,Math.cos(a)*.118);g.add(ho);}}   // telephone-dial wheel: a flat disc with five round holes
  else if(st==='cap'){const d=new THREE.Mesh(cyl(.19,.19,.02,28),rimMat);d.position.y=h-.07;g.add(d);const c=new THREE.Mesh(cyl(.105,.125,.06,24),chrome);c.position.y=h-.035;g.add(c);}   // painted steel wheel with a chrome hubcap
  else if(st==='wire'){for(let i=0;i<36;i++){const s=new THREE.Mesh(wireG,chrome),a=i/36*6.283;s.position.set(Math.sin(a)*.1,h-.06-(i%2)*.04,Math.cos(a)*.1);s.rotation.y=a+(i%2?.18:-.18);g.add(s);}   // wire wheel and a three-eared knock-off
    for(let i=0;i<3;i++){const e=new THREE.Mesh(earG,chrome);e.position.y=h-.02;e.rotation.y=i*2.094;g.add(e);}}
  else for(let i=0,n=st==='multi'?12:5;i<n;i++){const s=new THREE.Mesh(spokeG,rimMat);const a=i/n*6.283;if(n>5)s.scale.x=.45;s.position.set(Math.sin(a)*.105,h-.075,Math.cos(a)*.105);s.rotation.y=a;g.add(s);}
  const nut=new THREE.Mesh(nutG,nutMat);nut.position.y=h-.05;g.add(nut);
  const wall=new THREE.Mesh(ringG,wallMat);wall.rotation.x=-Math.PI/2;wall.position.y=h+.002;g.add(wall);return g;}
const dark=std({color:0x0c0c0d,roughness:.8,side:THREE.DoubleSide}),chrome=std({color:0xd8d8d0,metalness:1,roughness:.18});
function decal(tex,w,h){return new THREE.Mesh(new THREE.PlaneGeometry(w,h),std({map:tex,transparent:true,roughness:.5,polygonOffset:true,polygonOffsetFactor:-4}));}
const textTex=(t,bg,fg)=>canvas(256,86,(g,w,h)=>{g.fillStyle=bg;g.fillRect(0,0,w,h);g.fillStyle=fg;g.font='900 50px Arial Black,Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(t,w/2,h/2+4,w-14);});
const DEC=[textTex('HUILES','#f2ead2','#a3301f'),textTex('PNEUS','#e3b63a','#111'),textTex('BOUGIES','#1f4f8a','#f2ead2')];
const LOGO={shell:[textTex('Shell','#f3efe2','#c4231a'),textTex('PORSCHE','#c4281c','#f3efe2')],gulf:canvas(128,128,(g)=>{g.clearRect(0,0,128,128);g.fillStyle='#1c2f55';g.beginPath();g.arc(64,64,62,0,7);g.fill();g.fillStyle='#e0612a';g.beginPath();g.arc(64,64,52,0,7);g.fill();g.fillStyle='#1c2f55';g.font='900 36px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText('Gulf',64,66);})};   // sponsor badges for the Salzburg and Gulf 917s
const roundel=num=>canvas(256,256,(g)=>{g.clearRect(0,0,256,256);g.fillStyle='#f3efe2';g.beginPath();g.arc(128,128,124,0,7);g.fill();g.strokeStyle='rgba(0,0,0,.4)';g.lineWidth=3;g.stroke();g.fillStyle='#111';g.font='900 150px Arial Black,Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(num,128,138);});
const glowTex=canvas(128,128,(g)=>{const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.3,'rgba(255,255,255,.45)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,128,128);});

const paintOf=c=>new THREE.MeshPhysicalMaterial({color:c,roughness:.34,clearcoat:.8,clearcoatRoughness:.2}),rimGold=std({color:0xb8943c,roughness:.32,metalness:.9});
const FING=(()=>{const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(1,0);s.lineTo(1,.32);s.lineTo(.62,.32);s.lineTo(0,0);return new THREE.ExtrudeGeometry(s,{depth:.024,bevelEnabled:false});})();
function makeCar(o){
  const M=MODELS[o.model],zR=M.zR,car=new THREE.Group(),bodyMat=livery(o,M,o.res||1);car.rotation.order='YXZ';
  const add=(m,x,y,z,sh=true)=>{m.position.set(x,y,z);m.castShadow=sh;car.add(m);return m;};
  const body=add(new THREE.Mesh(M.geo,bodyMat),0,0,0);body.receiveShadow=true;car.body=body;
  const paint=new THREE.MeshPhysicalMaterial({color:o.base,roughness:o.bare?.3:.34,metalness:o.bare?.3:0,clearcoat:.8,clearcoatRoughness:.2}),acc=new THREE.MeshPhysicalMaterial({color:o.stripe||o.edge||o.base,roughness:.34,clearcoat:.8});
  add(new THREE.Mesh(M.cap,dark),0,0,0,false);
  add(new THREE.Mesh(new THREE.BoxGeometry(1.2,.26,M.CL-1.3),dark),0,.22,(ZF+zR)/2-.1);
  add(new THREE.Mesh(new THREE.BoxGeometry(1.5,.03,.5),dark),0,.105,ZF-.2);
  const can=add(new THREE.Mesh(CANOPY,new THREE.MeshPhysicalMaterial({map:canopyTex(o,o.res||1),roughness:.14,metalness:.1,clearcoat:1,clearcoatRoughness:.05})),0,0,0);
  if(M.cy){can.scale.y=M.cy;can.position.y=CYB*(1-M.cy);}if(M.cw)can.scale.x=M.cw;if(M.cz)can.position.z=M.cz;if(M.cs)can.scale.z=M.cs;
  if(o.model==='lp400'){   // Countach: periscope channel in the roof, airboxes behind the side windows, NACA ducts in the flanks, a thin black nose strip
    add(new THREE.Mesh(new THREE.BoxGeometry(.4,.03,.55),dark),0,.965,-.3,false);
    const naca=new THREE.ShapeGeometry((()=>{const s=new THREE.Shape();s.moveTo(0,.03);s.lineTo(.55,-.02);s.lineTo(.55,.1);s.closePath();return s;})());
    for(const sd of[-1,1]){const ab=add(new THREE.Mesh(new THREE.BoxGeometry(.2,.17,.6),paint),sd*.74,.64,-.88);add(new THREE.Mesh(new THREE.BoxGeometry(.16,.11,.02),dark),sd*.74,.65,-.575,false);
      add(new THREE.Mesh(naca,dark),sd*.965,.4,-.38,false).rotation.y=Math.PI/2;}
    add(new THREE.Mesh(new THREE.BoxGeometry(1.42,.045,.06),dark),0,.165,ZF);}
  if(o.model==='f400'){   // Superamerica: bonnet scoop, oval egg-crate grille with fog lamps, chrome bumpers, vents behind the front wheels, twin round tail lamps
    add(new THREE.Mesh(new THREE.BoxGeometry(.34,.06,.5),paint),0,.71,1.42).rotation.x=.15;add(new THREE.Mesh(new THREE.BoxGeometry(.28,.035,.02),dark),0,.71,1.67,false);
    const gr=add(new THREE.Mesh(cyl(.25,.25,.05,28),dark),0,.255,ZF-.01,false);gr.rotation.x=Math.PI/2;gr.scale.z=.42;
    const rg=add(new THREE.Mesh(new THREE.TorusGeometry(.25,.013,6,32),chrome),0,.255,ZF+.016,false);rg.scale.y=.42;
    for(const y of[-.04,0,.04])add(new THREE.Mesh(new THREE.BoxGeometry(.44,.006,.01),chrome),0,.255+y,ZF+.016,false);
    for(const x of[-.1,0,.1])add(new THREE.Mesh(new THREE.BoxGeometry(.006,.09,.01),chrome),x,.255,ZF+.016,false);
    const fogM=std({color:0xeeeadc,emissive:0xffe6b0,emissiveIntensity:.4,roughness:.2});
    for(const sd of[-1,1]){add(new THREE.Mesh(new THREE.SphereGeometry(.04,12,8),fogM),sd*.16,.25,ZF+.025,false);
      add(new THREE.Mesh(new THREE.BoxGeometry(.42,.035,.06),chrome),sd*.47,.19,ZF-.07,false).rotation.y=sd*.3;
      add(new THREE.Mesh(new THREE.BoxGeometry(.6,.035,.06),chrome),sd*.32,.22,zR+.03,false).rotation.y=-sd*.22;
      add(new THREE.Mesh(new THREE.BoxGeometry(.06,.09,.24),dark),sd*.9,.46,.72,false);for(const y of[-.025,0,.025])add(new THREE.Mesh(new THREE.BoxGeometry(.065,.008,.24),chrome),sd*.9,.46+y,.72,false);
      const tl2=add(new THREE.Mesh(cyl(.045,.045,.03,14),std({color:0x5a0d08,emissive:0xff2a12,emissiveIntensity:1.8})),sd*.44,.14+M.B[0]*.62,zR+.02,false);tl2.rotation.x=Math.PI/2;}}
  const bx=(sx,sy,sz,m,x,y,z)=>add(new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m),x,y,z,false);
  if(o.model==='van'){   // Econoline window van: a box, grey below, maroon above with a row of side windows, a flat front with round lamps and chrome bars
    can.scale.setScalar(.001);const up=paintOf(o.upper||'#7a1e22'),lo=paintOf(o.base),win=std({color:0x161c20,roughness:.08,metalness:.4}),scr=std({color:0x1b2328,roughness:.05,metalness:.3,transparent:true,opacity:.45}),mz=(ZF+zR)/2,L=M.CL;
    const lampM=std({color:0xf4f0dc,emissive:0xffe6b0,emissiveIntensity:.6,roughness:.2});
    bx(1.86,.04,L-.06,up,0,1.9,mz);
    for(const sd of[-1,1]){bx(.03,.78,L-.1,up,sd*.955,1.5,mz);bx(.03,.07,L-.5,up,sd*.955,.82,mz);bx(.012,.03,L-.3,chrome,sd*.965,1.1,mz);
      for(const z of[1.42,.68,-.06,-.8,-1.54])bx(.04,.44,z>1?.56:.64,win,sd*.96,1.5,z);
      bx(.05,.18,.1,dark,sd*1.0,1.32,ZF-.25);bx(.04,.2,.14,chrome,sd*1.04,1.42,ZF-.25);
      add(new THREE.Mesh(new THREE.TorusGeometry(.105,.02,8,24),chrome),sd*.66,.74,ZF+.035,false);add(new THREE.Mesh(cyl(.095,.095,.03,20),lampM),sd*.66,.74,ZF+.03,false).rotation.x=Math.PI/2;
      bx(.62,.42,.03,win,sd*.42,1.52,zR-.035);bx(.14,.6,.04,up,sd*.86,1.41,ZF+.01);}
    bx(1.86,.98,.04,lo,0,.62,ZF+.01);bx(1.86,.22,.04,up,0,1.79,ZF+.01);bx(1.86,.1,.04,up,0,1.13,ZF+.01);bx(.05,.56,.04,up,0,1.41,ZF+.012);bx(1.6,.56,.02,scr,0,1.41,ZF);
    for(const y of[.5,.57,.64])bx(.92,.025,.03,chrome,0,y,ZF+.04);for(const x of[-.3,-.1,.1,.3])bx(.02,.18,.03,chrome,x,.57,ZF+.045);
    bx(1.96,.12,.1,chrome,0,.32,ZF+.06);bx(1.96,.12,.1,chrome,0,.32,zR-.06);bx(1.86,.98,.04,lo,0,.62,zR-.01);bx(1.86,.82,.04,up,0,1.5,zR-.01);}
  if(o.model==='sherp'){   // Sherp: a narrow hull between four huge balloon tyres, a wider box cab on top with a big sloping windscreen. Built here; the generic car parts are hidden at the end of makeCar
    const sh=(m)=>{m.userData.sh=1;return m;},Y=paintOf(o.base),glass=std({color:0x10161a,roughness:.08,metalness:.4}),blk=std({color:0x161616,roughness:.8}),lampM=std({color:0xf4f0dc,emissive:0xffe6b0,emissiveIntensity:.8,roughness:.2});
    const prof=(pts,w,m)=>{const s=new THREE.Shape();s.moveTo(pts[0][0],pts[0][1]);for(const p of pts.slice(1))s.lineTo(p[0],p[1]);s.closePath();const me=sh(add(new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:w,bevelEnabled:false}),m),w/2,0,0));me.rotation.y=-Math.PI/2;return me;};   // side profile (z,y) pushed out across the width
    prof([[-1.62,.48],[1.5,.48],[1.68,.75],[1.68,1.72],[-1.66,1.72],[-1.66,.7]],1.56,Y);                        // hull between the tyres
    prof([[-1.66,1.72],[1.7,1.72],[1.7,1.86],[1.24,2.64],[-1.58,2.64],[-1.66,2.52]],1.96,Y);                    // cab, overhanging the tyres
    const sb=(sx,sy,sz,m,x,y,z)=>sh(bx(sx,sy,sz,m,x,y,z));
    {const ws=sb(1.7,.02,.9,glass,0,2.25,1.49);ws.rotation.x=Math.PI/2-Math.atan2(.46,.78);}   // the big windscreen
    for(const sd of[-1,1]){sb(.02,.5,.95,glass,sd*.985,2.2,.55);sb(.02,.46,.5,glass,sd*.985,2.2,-.35);sb(.02,.36,.3,blk,sd*.79,1.12,0);   // side windows; dark hull panel between the tyres
      for(let k=0;k<4;k++)sb(.015,.025,.9-k*.12,blk,sd*.99,1.86+k*.07,-1.1+k*.06);                                // black stripes on the rear flanks
      sb(.035,.035,2.9,chrome,sd*.9,2.67,-.15);sb(.18,.12,.05,lampM,sd*.7,1.8,1.71);}   // roof rails, headlamps
    sb(.5,.6,.02,glass,-.3,2.1,-1.675);sb(1.6,.14,.12,blk,0,.6,1.62);sb(1.5,.12,.1,blk,0,.6,-1.64);                 // rear window, front and back step bars
    car.sherpTyres=[];
    for(const z of[1.02,-1.02])for(const sd of[-1,1]){const kn=sh(new THREE.Group()),holder=new THREE.Group(),R=.85;kn.position.set(sd*1.13,R,z);holder.rotation.z=-sd*Math.PI/2;
      const t=new THREE.Mesh(cyl(R,R,.62,32),blk);t.castShadow=true;
      for(let k=0;k<16;k++){const a=k/16*Math.PI*2,l=new THREE.Mesh(new THREE.BoxGeometry(.07,.5,.2),blk);l.position.set(Math.cos(a)*(R+.025),0,Math.sin(a)*(R+.025));l.rotation.y=-a;t.add(l);}   // tread lugs
      const hub=new THREE.Mesh(cyl(.36,.36,.64,24),std({color:0x2a2a2a,roughness:.5,metalness:.3}));t.add(hub);const ring=new THREE.Mesh(new THREE.TorusGeometry(.3,.03,6,24),std({color:0x9a9c9e,roughness:.35,metalness:.8}));ring.rotation.x=Math.PI/2;ring.position.y=.33;t.add(ring);
      for(let k=0;k<6;k++){const a=k/6*Math.PI*2,b=new THREE.Mesh(cyl(.035,.035,.04,8),chrome);b.position.set(Math.cos(a)*.16,.33,Math.sin(a)*.16);t.add(b);}   // wheel nuts
      t.userData.dir=sd*.33/(R*M.hs);holder.add(t);kn.add(holder);car.add(kn);car.sherpTyres.push([t,kn]);}}   // dir: spun at the speed a .33 m wheel would turn, scaled to this tyre's size
  if(o.model==='p911'){   // 911 Carrera (early 70s), built here from its side silhouette (the generic body is hidden after the wheels go on): a sloping bonnet, round lamps standing up on the
    // front wings, a tall glasshouse with slim pillars, the long fastback down to a black-lipped ducktail, wheel arches, a black side stripe low down, slim bumpers, a red tail-lamp band
    can.scale.setScalar(.001);const sh=m=>{m.userData.sh=1;return m;},ex=(pts,arcs,w,bev,mat,x=0)=>{const s=new THREE.Shape();s.moveTo(pts[0][0],pts[0][1]);for(let k=1;k<pts.length;k++){const p=pts[k];if(p.length===3)s.absarc(p[0],p[1],p[2],Math.PI,0,true);else s.lineTo(p[0],p[1]);}
      const g=new THREE.ExtrudeGeometry(s,{depth:w,bevelEnabled:bev>0,bevelThickness:bev,bevelSize:bev*.5,bevelSegments:3,curveSegments:14});g.translate(0,0,-w/2);g.rotateY(-Math.PI/2);const m=sh(add(new THREE.Mesh(g,mat),x,0,0));m.receiveShadow=true;return m;};
    const glass=std({color:0x10161a,roughness:.08,metalness:.4}),lampM=std({color:0xf4f0dc,emissive:0xffe6b0,emissiveIntensity:.6,roughness:.2}),tlM=std({color:0x5a0d08,emissive:0xff2a12,emissiveIntensity:1.8}),sdM=std({color:o.side||'#141414',roughness:.5});
    ex([[2.2,.24],[2.25,.42],[2.17,.5],[1.9,.59],[1.5,.67],[1.05,.73],[.85,.77],[0,.8],[-.7,.81],[-1.45,.82],[-1.72,.77],[-1.9,.83],[-1.99,.8],[-2.0,.55],[-1.97,.24],[-1.72,.24],[-1.72,.33],[-1.3,.33,.42],[-.88,.24],[.83,.24],[.83,.33],[1.25,.33,.42],[1.67,.24]],0,1.52,.14,paint);   // the body
    ex([[.86,.76],[.2,1.24],[-.56,1.25],[-1.48,.83],[-1.48,.78],[.86,.78]],0,1.26,.04,glass);   // the glasshouse
    ex([[.24,1.21],[.18,1.29],[-.58,1.3],[-.66,1.22]],0,1.32,.03,paint);   // the roof
    for(const sd of[-1,1]){ex([[-.42,1.2],[-.6,1.27],[-1.48,.84],[-1.1,.8],[-.42,.8]],0,.03,0,paint,sd*.66);ex([[.84,.79],[.5,1.04],[.44,1.04],[.76,.79]],0,.03,0,paint,sd*.66);   // the rear quarter panel and the windscreen pillar
      const bs=new THREE.SphereGeometry(1,20,12);sh(add(new THREE.Mesh(bs,paint),sd*.6,.56,1.5)).scale.set(.32,.22,.78);sh(add(new THREE.Mesh(bs,paint),sd*.63,.6,-1.22)).scale.set(.3,.24,.82);   // round front wings and wide rear hips
      const z=1.92;sh(add(new THREE.Mesh(cyl(.105,.11,.1,20),paint),sd*.6,.7,z,false)).rotation.x=Math.PI/2-.12;   // the lamp pod on the wing
      sh(add(new THREE.Mesh(new THREE.SphereGeometry(.088,14,10),lampM),sd*.6,.71,z+.05,false)).scale.z=.5;sh(add(new THREE.Mesh(new THREE.TorusGeometry(.098,.012,6,20),chrome),sd*.6,.71,z+.065,false)).rotation.x=-.12;
      sh(bx(.02,.05,1.6,sdM,sd*.905,.36,0));sh(bx(.02,.05,.4,sdM,sd*.905,.43,-.92)).rotation.x=-.4;   // the side stripe, kicking up at the back
      sh(bx(.18,.06,.03,tlM,sd*.6,.72,-2.0));sh(bx(.12,.1,.04,dark,sd*.84,.94,.62));}   // tail lamps; door mirrors
    sh(bx(.95,.04,.02,tlM,0,.72,-2.005));sh(bx(1.66,.07,.07,dark,0,.3,2.25));sh(bx(1.66,.07,.07,dark,0,.3,-2.02));sh(bx(1.4,.04,.12,dark,0,.9,-1.94));   // tail band, bumpers, ducktail lip
    for(let k=0;k<5;k++)sh(bx(.55,.012,.03,chrome,0,.89-k*.006,-1.5-k*.06));}   // engine-lid grille
  if(o.model==='bz'){   // Bizzarrini 5300: round lamps sunk in the long nose, gills behind the front wheels, a cut-off Kamm tail in body colour with round lamps
    add(new THREE.Mesh(M.cap,paint),0,0,-.004,false);const lampM=std({color:0xf4f0dc,emissive:0xffe6b0,emissiveIntensity:.6,roughness:.2}),tlM=std({color:0x5a0d08,emissive:0xff2a12,emissiveIntensity:1.8});
    for(const sd of[-1,1]){const z=ZF-.3,y=M.topY(.68,(z-zR)/M.CL,z);const rc=add(new THREE.Mesh(cyl(.1,.1,.08,18),dark),sd*.58,y-.03,z,false);rc.rotation.x=Math.PI/2-.45;
      add(new THREE.Mesh(new THREE.SphereGeometry(.075,14,10),lampM),sd*.58,y-.025,z+.02,false);add(new THREE.Mesh(new THREE.TorusGeometry(.1,.012,6,20),chrome),sd*.58,y-.01,z+.01,false).rotation.x=-.45;
      for(let k=0;k<3;k++)bx(.035,.22,.05,dark,sd*.885,.46,.5+k*.09);
      bx(.42,.03,.05,chrome,sd*.48,.2,ZF-.08).rotation.y=sd*.4;bx(.5,.03,.05,chrome,sd*.42,.22,zR-.02);
      add(new THREE.Mesh(cyl(.055,.055,.03,14),tlM),sd*.6,.14+M.B[0]*.62,zR-.005,false).rotation.x=Math.PI/2;}}
  if(o.model==='b507'){   // BMW 507: painted nose, wide low twin-kidney grille with chrome bars, roundel, round lamps in the wings, bonnet crease, gills behind the front wheels, slim bumpers with overriders
    add(new THREE.Mesh(M.cap,paint),0,0,-.004,false);
    {const p=M.geo.attributes.position.array,NU=80,b=(p.length/3-NU-1)*3,cp=[0,.3,ZF],ci=[];for(let j=0;j<=NU;j++){cp.push(p[b+j*3],p[b+j*3+1],p[b+j*3+2]);if(j<NU)ci.push(0,j+1,j+2);}
      const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(cp,3));cg.setIndex(ci);cg.computeVertexNormals();add(new THREE.Mesh(cg,new THREE.MeshPhysicalMaterial({color:o.base,roughness:.34,clearcoat:.8,side:THREE.DoubleSide})),0,0,.002,false);}
    const lampM=std({color:0xf4f0dc,emissive:0xffe6b0,emissiveIntensity:.6,roughness:.2});
    for(const sd of[-1,1]){const k=add(new THREE.Mesh(cyl(.17,.17,.04,28),dark),sd*.19,.3,ZF+.01,false);k.rotation.x=Math.PI/2;k.scale.z=.36;
      const kr=add(new THREE.Mesh(new THREE.TorusGeometry(.17,.011,6,32),chrome),sd*.19,.3,ZF+.03,false);kr.scale.y=.36;
      for(const y of[-.03,-.01,.01,.03])bx(.3-Math.abs(y)*3,.007,.01,chrome,sd*.19,.3+y,ZF+.032);
      add(new THREE.Mesh(new THREE.TorusGeometry(.1,.016,8,24),chrome),sd*.56,.39,ZF+.035,false);add(new THREE.Mesh(new THREE.SphereGeometry(.088,16,10),lampM),sd*.56,.39,ZF+.005,false).scale.z=.5;
      bx(.03,.15,.3,dark,sd*.875,.38,.6);for(const y of[-.045,-.015,.015,.045])bx(.035,.012,.28,chrome,sd*.878,.38+y,.6);
      bx(.42,.03,.05,chrome,sd*.5,.2,ZF-.02).rotation.y=sd*.32;bx(.04,.15,.07,chrome,sd*.36,.25,ZF+.05);
      bx(.42,.03,.05,chrome,sd*.48,.2,zR+.06).rotation.y=-sd*.4;bx(.04,.15,.07,chrome,sd*.3,.25,zR-.05);}
    bx(.5,.03,.05,chrome,0,.2,ZF+.05);bx(.5,.03,.05,chrome,0,.2,zR-.04);
    add(new THREE.Mesh(new THREE.CircleGeometry(.045,24),std({map:canvas(64,64,(g)=>{g.fillStyle='#141414';g.beginPath();g.arc(32,32,32,0,7);g.fill();for(let q=0;q<4;q++){g.fillStyle=q%2?'#f0f0ec':'#2a6ec4';g.beginPath();g.moveTo(32,32);g.arc(32,32,21,q*Math.PI/2,(q+1)*Math.PI/2);g.fill();}}),roughness:.3})),0,.42,ZF+.012,false);
    for(let k=0;k<9;k++){const z=.5+k*.18,y=M.topY(0,(z-zR)/M.CL,z),sl=(M.topY(0,(z+.05-zR)/M.CL,z+.05)-M.topY(0,(z-.05-zR)/M.CL,z-.05))/.1;bx(.022,.018,.19,chrome,0,y+.004,z).rotation.x=-Math.atan(sl);}
    {const z=zR+.1,y=M.topY(0,.1/M.CL,z);bx(.3,.025,.04,chrome,0,y-.05,z-.03);}}
  if(o.model==='ac'){   // Concept Coupe: black grille face, light-strip lamps, louvres over the engine, black sills and diffuser, red light-bar tail
    add(new THREE.Mesh(M.cap,paint),0,0,-.004,false);const led=std({color:0xf4f8ff,emissive:0xcfe4ff,emissiveIntensity:1.6,roughness:.2}),bar=std({color:0x5a0d08,emissive:0xff2a12,emissiveIntensity:1.8});
    bx(.86,.2,.05,dark,0,.3,ZF+.005);for(let k=-3;k<=3;k++)bx(.01,.17,.055,chrome,k*.11,.3,ZF+.012);
    for(const sd of[-1,1]){bx(.34,.035,.05,led,sd*.52,.42,ZF-.07).rotation.y=sd*.12;bx(.22,.03,.05,led,sd*.8,.38,ZF-.2);bx(.3,.16,.05,dark,sd*.6,.27,ZF+.005);
      bx(.06,.07,1.6,dark,sd*.96,.2,-.03);bx(.03,.1,.6,dark,sd*.97,.46,.1);}
    for(let k=0;k<7;k++){const z=zR+.3+k*.11;bx(1.0,.025,.07,dark,0,M.topY(0,(z-zR)/M.CL,z)+.012,z).rotation.x=-.25;}
    bx(1.5,.035,.04,bar,0,.14+M.B[0]*.62,zR+.005);bx(1.4,.1,.12,dark,0,.14,zR+.02);}
  if(o.model==='f512')for(const sd of[-1,1]){   // the Ferrari's tall stalk mirrors
    const stk=add(new THREE.Mesh(new THREE.BoxGeometry(.05,.36,.07),paintOf(o.base)),sd*.56,.9,.86);stk.rotation.x=-.25;const mh=add(new THREE.Mesh(new THREE.SphereGeometry(.1,14,10),paintOf(o.base)),sd*.56,1.1,.8);mh.scale.set(1,.72,.6);}
  if(o.model==='gt40'){for(const sd of[-1,1])add(new THREE.Mesh(new THREE.BoxGeometry(.34,.05,.5),dark),sd*.3,.6,1.42).rotation.x=.2;   // twin bonnet vents
    add(new THREE.Mesh(new THREE.BoxGeometry(1.66,.34,.05),dark),0,.4,M.zR+.01);}                                                    // chopped tail panel
  if(o.model==='m1'||o.model==='bb'||o.model==='lp400')for(let k=0;k<5;k++){const z=M.zR+.32+k*.16,y=M.topY(0,(z-M.zR)/M.CL,z);add(new THREE.Mesh(new THREE.BoxGeometry(1.1,.03,.09),dark),0,y+.014,z,false).rotation.x=-.25;}
  if(M.open){ // open car: low screen only, so the driver's helmet and a roll hoop show above it
    add(new THREE.Mesh(new THREE.SphereGeometry(.13,16,12),new THREE.MeshPhysicalMaterial({color:o.helmet,roughness:.25,clearcoat:1})),-.26,.84,.05);
    add(new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),std({color:0xeeeae0,roughness:.9})),-.26,.8,.14).scale.set(1,.8,.7);
    const hoop=add(new THREE.Mesh(new THREE.TorusGeometry(.3,.022,6,18,Math.PI),chrome),-.02,.66,-.32);hoop.scale.set(1.5,1,1);}
  const tailY=.14+M.B[0],tw=M.W[0],tailM=std({color:0x5a0d08,emissive:0xff2a12,emissiveIntensity:1.8});
  for(const sd of[-1,1]){add(new THREE.Mesh(cyl(.012,.012,.14,6),chrome),sd*.72,.69,.95);const mh=add(new THREE.Mesh(new THREE.SphereGeometry(.07,12,8),paint),sd*.72,.78,.94);mh.scale.set(1,.72,.55);
    add(new THREE.Mesh(new THREE.BoxGeometry(.035,.09,1.5),acc),sd*.955,.2,-.03);
    if(o.model==='k'){const f=add(new THREE.Mesh(FING,paint),sd*.8-.012,tailY-.03,zR+.62);f.rotation.y=Math.PI/2;f.scale.set(.6,.62,1);}
    if(o.model==='lh'){const f=add(new THREE.Mesh(FING,paint),sd*(tw-.1)-.012,tailY-.04,zR+1.05);f.rotation.y=Math.PI/2;f.scale.set(1.05,1.05,1);}
    if(o.model==='lhs'){const f=add(new THREE.Mesh(FING,paint),sd*(tw-.08)-.012,tailY-.05,zR+1.2);f.rotation.y=Math.PI/2;f.scale.set(1.2,1.15,1);}   // the long tail's two upswept fins
    if(o.model==='o')add(new THREE.Mesh(new THREE.BoxGeometry(.5,.02,.2),acc),sd*.5,tailY+.03,zR+.08).rotation.x=.35;
    if(!M.cls&&!o.bare){const rd=decal(o.rt,.4,.4);add(rd,sd*.985,.36,-.12,false);rd.rotation.order='YXZ';rd.rotation.set(-.12,sd*Math.PI/2,0);}
    if(o.logos==='shell')[[LOGO.shell[0],.5,.3,.24,.08],[LOGO.shell[1],.05,.12,.62,.1]].forEach(([t,z,y,dw,dh])=>{const d=decal(t,dw,dh);add(d,sd*.99,y,z,false);d.rotation.order='YXZ';d.rotation.set(-.1,sd*Math.PI/2,0);});
    else if(o.logos==='gulf'){const d=decal(LOGO.gulf,.16,.16);add(d,sd*.99,.36,-.42,false);d.rotation.order='YXZ';d.rotation.set(-.12,sd*Math.PI/2,0);}
    else if(!M.road&&!o.bare)[[.5,.3,0],[.5,.2,1],[-.62,.3,2]].forEach(([z,y,k])=>{const d=decal(DEC[k],.24,.08);add(d,sd*.99,y,z,false);d.rotation.order='YXZ';d.rotation.set(-.1,sd*Math.PI/2,0);});
    const tl=add(new THREE.Mesh(cyl(.055,.055,.03,14),tailM),sd*tw*(M.tlx||.42),.14+M.B[0]*.62,zR-.005,false);tl.rotation.x=Math.PI/2;
    const ex=add(new THREE.Mesh(new THREE.CylinderGeometry(.075,.04,.42,14,1,true),std({color:0x6a665c,metalness:.85,roughness:.35,side:THREE.DoubleSide})),sd*.2,.24,zR-.1);ex.rotation.x=-Math.PI/2+.12;}
  if(o.model==='k')add(new THREE.Mesh(new THREE.BoxGeometry(1.5,.02,.2),paint),0,tailY+.045,zR+.1).rotation.x=.25;
  if(o.model==='f512')add(new THREE.Mesh(new THREE.BoxGeometry(tw*2-.12,.11,.025),paint),0,tailY+.03,zR+.03).rotation.x=-.3;
  if(o.model==='lh')add(new THREE.Mesh(new THREE.BoxGeometry(tw*2-.2,.025,.26),paint),0,tailY+.27,zR+.2).rotation.x=.06;
  if(o.model==='lhs'){add(new THREE.Mesh(new THREE.BoxGeometry(tw*2-.18,.025,.3),paint),0,tailY+.3,zR+.22).rotation.x=.06;add(new THREE.Mesh(new THREE.BoxGeometry(.4,.012,.02),dark),.42,.66,.95,false).rotation.set(.55,0,.5);}   // spoiler blade between the fins, second wiper
  const wip=add(new THREE.Mesh(new THREE.BoxGeometry(.4,.012,.02),dark),-.05,.66,.95,false);wip.rotation.set(.55,0,.5);
  // night glow
  const glowM=new THREE.SpriteMaterial({map:glowTex,color:0xffe2a8,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:0});car.glow=glowM;
  for(const sd of[-1,1]){const g=new THREE.Sprite(glowM);g.scale.set(.8,.8,1);g.position.set(sd*.66,.5,ZF-.45);car.add(g);}
  const pool=new THREE.Mesh(new THREE.PlaneGeometry(9,22),new THREE.MeshBasicMaterial({map:glowTex,color:0xffe2a8,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:0}));pool.rotation.x=-Math.PI/2;pool.position.set(0,.06,ZF+9);car.add(pool);car.pool=pool.material;
  car.wheels=[];car.knuckles=[];car.corners=[];car.tail=tailM;
  WZ.forEach((z,k)=>{for(const sd of[-1,1]){const wd=k?.42:.32,kn=new THREE.Group(),holder=new THREE.Group();kn.position.set(sd*(.965-wd/2),.33,z);holder.rotation.z=-sd*Math.PI/2;
    const w=wheel(k,M.wh==='cap'?paintOf(o.base):o.rim==='gold'?rimGold:o.rim==='black'?rimDark:rimSilver,M.wh);if(M.road){w.children.pop();w.scale.y=M.road;}holder.add(w);kn.add(holder);car.add(kn);w.userData.dir=sd;car.wheels.push(w);car.corners.push(kn);if(!k)car.knuckles.push(kn);}});
  if(o.model==='p911')for(const c of car.children)if(!c.userData.sh&&!c.isSprite&&c!==pool&&!car.corners.includes(c))c.visible=false;   // 911: only its own body and the wheels
  if(car.sherpTyres){   // Sherp: hide the generic body, cockpit, mirrors and wheels; its own tyres turn instead (no steered wheels: it skid-steers)
    for(const c of car.children)if(!c.userData.sh&&!c.isSprite&&c!==pool)c.visible=false;
    for(const sd of[-1,1])add(new THREE.Mesh(new THREE.BoxGeometry(.16,.1,.04),tailM),sd*.72,1.82,-1.68,false);
    car.wheels=car.sherpTyres.map(a=>a[0]);car.corners=car.sherpTyres.map(a=>a[1]);car.knuckles=[];}
  car.bodyMat=bodyMat;car.canopy=can;car.M=M;car.o=o;scene.add(car);return car;
}
// the colours the player can choose for their own car
const GULF={name:'BLEU CIEL ET ORANGE',d:'Pale blue with the orange stripe.',base:'#a9cbdd',stripe:'#e0612a',pin:'#1c2f55',helmet:'#1d3a6a'};
const GULF20={...GULF,name:'GULF',d:'Gulf light blue, orange stripe down the middle, Gulf badges. No. 20.',base:'#94c6e4',num:'20',logos:'gulf',rim:'black'},SALZ23={name:'SALZBURG',d:'Red with white sweeps, Shell and PORSCHE. No. 23.',base:'#c4281c',swoop:'#f3efe2',num:'23',helmet:'#e6e1d0',logos:'shell',rim:'black',sideF:'#f3efe2'};   // the two famous 917 schemes
const LIVS={   // each car has its own set of colours
  k:[GULF20,SALZ23,{name:'BLANC ET BLEU',d:'White with a dark blue stripe. No. 21.',base:'#eae6d8',stripe:'#1f3358',pin:'#b3241c',num:'21',helmet:'#b3241c'}],
  o:[{name:'BLANC USINE',d:'Works white with a red nose and sills. No. 12.',base:'#ece8dc',nose:'#b3241c',edge:'#b3241c',num:'12',helmet:'#b3241c'},{name:'BLEU NUIT',d:'Midnight blue with a yellow stripe. No. 14.',base:'#1f3358',stripe:'#e3c94a',pin:'#0e1830',num:'14',helmet:'#e3c94a'},{name:'VERT ANGLAIS',d:'Dark green with a white nose. No. 15.',base:'#23492f',nose:'#ece8dc',edge:'#ece8dc',num:'15',helmet:'#ece8dc'},SALZ23,GULF20],
  lhs:[{name:'ALUMINIUM',d:'Bare silver aluminium, no numbers, no stickers. Black wheels.',base:'#d4d7d9',bare:1,num:'917',helmet:'#e6e1d0',rim:'black'},GULF20,SALZ23],
  lh:[{name:'PSYCHÉDÉLIQUE',d:'Purple with green swirls. No. 3.',base:'#4a2f7a',swirl:'#7fc46a',num:'3',helmet:'#e6e1d0'},{name:'ARGENT RAYÉ',d:'Silver with blue and red stripes. No. 21.',base:'#c9cbc8',twin:'#1f3358',stripe:'#b3241c',pin:'#7a1512',num:'21',helmet:'#1f3358'},{...GULF,d:GULF.d+' No. 18.',num:'18'},SALZ23,GULF20],
  f512:[{name:'ROSSO CORSA',d:'Racing red, white band and roundel, gold wheels. No. 7.',base:'#c4231a',band:'#f3efe2',num:'7',helmet:'#e6e1d0',rim:'gold'},{name:'GIALLO',d:'Yellow with a red stripe, gold wheels. No. 9.',base:'#e3b92e',stripe:'#b3241c',pin:'#3a0c08',num:'9',helmet:'#1a1a1a',rim:'gold'},{name:'ROSSO E BLU',d:'Red with a blue and white nose band. No. 11.',base:'#b81f18',band:'#1f3f8a',nose:'#f3efe2',num:'11',helmet:'#1f3f8a',rim:'gold'}],
  gt40:[{name:'WHITE AND BLUE',d:'White with twin blue stripes. No. 2.',base:'#ece8dc',twin:'#1f3f8a',num:'2',helmet:'#1f3f8a'},{name:'BLACK AND SILVER',d:'Black with a silver stripe. No. 1.',base:'#1c1d1f',stripe:'#b9bcc0',pin:'#55585c',num:'1',helmet:'#b9bcc0'},{...GULF,d:GULF.d+' No. 6.',num:'6'}],
  m1:[{name:'ORANGE',d:'Bright orange, as it left the factory.',base:'#e2501c',num:'41',helmet:'#e6e1d0'},{name:'PROCAR',d:'White with blue and red stripes.',base:'#ece8dc',twin:'#1f6fd0',stripe:'#c8302a',pin:'#3a2a8a',num:'40',helmet:'#1f6fd0'},{name:'NOIR',d:'Black with a silver line.',base:'#17181a',pin:'#b9bcc0',stripe:'#2a2c30',num:'42',helmet:'#b9bcc0'}],
  p911:[{name:'GIALLO',d:'Signal yellow with a black side stripe.',base:'#f2c21a',side:'#141414',num:'911',helmet:'#141414'},{name:'GRAND PRIX WHITE',d:'White with a blue side stripe.',base:'#eeebe2',side:'#1d4fa8',num:'73',helmet:'#1d4fa8'},{name:'BLOOD ORANGE',d:'Orange with a black side stripe.',base:'#e2601e',side:'#141414',num:'27',helmet:'#141414'}],
  p904:[{name:'ROT',d:'Signal red.',base:'#c4231a',num:'31',helmet:'#e6e1d0'},{name:'SILBER',d:'Works silver with a red nose.',base:'#c9cbc8',nose:'#b3241c',num:'32',helmet:'#b3241c'},{name:'BLAU',d:'Dark blue with a white stripe.',base:'#1f3f8a',stripe:'#ece8dc',pin:'#0e1830',num:'33',helmet:'#ece8dc'}],
  ghibli:[{name:'VERDE GEMMA',d:'Metallic lime-gold green.',base:'#a8b02a',num:'51',helmet:'#e6e1d0'},{name:'BLU SERA',d:'Midnight blue.',base:'#141c36',num:'52',helmet:'#b9bcc0'},{name:'ROSSO',d:'Deep red.',base:'#b81f18',num:'53',helmet:'#1a1a1a'}],
  bb:[{name:'ROSSO E NERO',d:'Burgundy red over black.',base:'#9a1f2a',edge:'#141414',num:'61',helmet:'#e6e1d0'},{name:'NERO',d:'Black, with a white nose panel.',base:'#141416',nose:'#e6e1d0',num:'62',helmet:'#c4231a'},{name:'GIALLO E NERO',d:'Yellow over black.',base:'#e3b92e',edge:'#141414',num:'63',helmet:'#141414'}],
  lp400:[{name:'ROSSO ARANCIO',d:'Red-orange, as in the brochure.',base:'#d8401c',num:'71',helmet:'#e6e1d0'},{name:'BLU TAHITI',d:'Bright mid blue.',base:'#2c56b8',num:'72',helmet:'#e6e1d0'},{name:'ARGENTO',d:'Metallic silver.',base:'#b8bcbe',num:'73',helmet:'#c4231a'},{name:'GIALLO FLY',d:'Yellow.',base:'#e8c21e',num:'74',helmet:'#141414'}],
  f400:[{name:'BLU SERA',d:'Deep metallic blue, chrome and wire wheels.',base:'#1b2a4a',num:'81',helmet:'#e6e1d0'},{name:'ROSSO SCURO',d:'Dark red.',base:'#6a1418',num:'82',helmet:'#e6e1d0'},{name:'ARGENTO',d:'Silver.',base:'#b4b8ba',num:'83',helmet:'#1b2a4a'}],
  bz:[{name:'ROSSO, AS FOUND',d:'Barn find: faded red, rust spots and dust.',base:'#b8402e',patina:1,num:'91',helmet:'#e6e1d0'},{name:'ROSSO RESTAURATO',d:'Restored: deep gloss red.',base:'#b3201a',num:'92',helmet:'#e6e1d0'},{name:'ARGENTO',d:'Silver.',base:'#b8bcbe',num:'93',helmet:'#b3201a'},{name:'BLU',d:'Mid blue.',base:'#2a4a8a',num:'94',helmet:'#e6e1d0'}],
  b507:[{name:'GRAPHITE',d:'Dark metallic grey, chrome and painted wheels.',base:'#3b3f44',num:'57',helmet:'#e6e1d0'},{name:'SILBER',d:'Silver.',base:'#b8bcbe',num:'58',helmet:'#2a3a5a'},{name:'WEISS',d:'White.',base:'#e8e6dc',num:'59',helmet:'#b3201a'},{name:'ROT',d:'Red.',base:'#a81f1c',num:'60',helmet:'#e6e1d0'}],
  ac:[{name:'GREIGE MATTE',d:'Warm matte grey-beige, black wheels.',base:'#a9a393',num:'101',helmet:'#e6e1d0',rim:'black'},{name:'NERO',d:'Satin black.',base:'#1a1b1d',num:'102',helmet:'#c9cbc8',rim:'black'},{name:'ROSSO',d:'Deep red.',base:'#a5201c',num:'103',helmet:'#e6e1d0',rim:'black'},{name:'BLEU',d:'Dark blue.',base:'#1f2f55',num:'104',helmet:'#e6e1d0',rim:'black'}],
  sherp:[{name:'YELLOW',d:'Expedition yellow with black stripes.',base:'#e8b52a',num:'1',helmet:'#e6e1d0'},{name:'OLIVE',d:'Military olive drab.',base:'#5e6438',num:'2',helmet:'#e6e1d0'},{name:'ORANGE',d:'Rescue orange.',base:'#e0602a',num:'3',helmet:'#e6e1d0'}],
  van:[{name:'GREY AND MAROON',d:'Silver-grey below, maroon roof and stripe.',base:'#8f8f8a',upper:'#7a1e22',num:'1',helmet:'#e6e1d0'},{name:'CREAM AND TURQUOISE',d:'Turquoise below, a cream roof.',base:'#4aa8a0',upper:'#ece6d2',num:'2',helmet:'#e6e1d0'},{name:'BEIGE AND BROWN',d:'Beige below, brown above.',base:'#cfc2a0',upper:'#5a3a26',num:'3',helmet:'#e6e1d0'}]};
const LIV=()=>{const a=LIVS[G.model];return a[G.liv%a.length];};
const RIV=[
  {base:'#b3241c',nose:'#e3c94a',edge:'#e3c94a',num:'5',helmet:'#d8d2c0',model:'f512',name:'J. AUBERT'},
  {base:'#e6e1d0',stripe:'#2f6b45',pin:'#16301f',num:'31',helmet:'#b3241c',model:'lh',name:'E. BRANDT'},
  {base:'#d9b23a',stripe:'#1a1a1a',pin:'#f3efe2',num:'12',helmet:'#e6e1d0',model:'k',name:'P. LACROIX'},
  {base:'#b3241c',nose:'#f3efe2',edge:'#f3efe2',num:'8',helmet:'#1a1a1a',model:'f512',name:'T. RICCI'},
  {base:'#1f3358',stripe:'#e6e1d0',pin:'#0e1830',num:'3',helmet:'#e3c94a',model:'lh',name:'H. VOGEL'},
  {base:'#c9c9c2',stripe:'#b3241c',pin:'#3a0c08',num:'22',helmet:'#1f3358',model:'k',name:'D. MARSH'},
  {base:'#23492f',stripe:'#e3c94a',pin:'#102216',num:'44',helmet:'#e6e1d0',model:'gt40',name:'L. FERRAND'}];
const mk=o=>makeCar({...o,rt:roundel(o.num)});
let hero=null,interior=null,spot=null;
const ents=[];
function disposeCar(c){scene.remove(c);c.traverse(m=>{if(m.material&&m.material.map&&m.material!==wallMat&&!DEC.includes(m.material.map)&&m.material.map!==glowTex)m.material.map.dispose();});}
function buildHero(model){
  if(hero)disposeCar(hero);
  hero=mk({...LIV(),res:2,model});if(MODELS[model].hs)hero.scale.setScalar(MODELS[model].hs);   // hs: shrink a tall car (the van) so you can see past it$('hnum').textContent=LIV().num;$('hnumW').style.display=MODELS[model].cls?'none':'';
  // cockpit interior (only shown in cockpit camera)
  interior=new THREE.Group();const IN=MODELS[model].int||{},dashM=std({color:IN.dash||0x141414,roughness:.7}),rimM=std({color:IN.rim||0x141414,roughness:IN.rim?.45:.7}),spokeM=IN.spoke?std({color:IN.spoke,metalness:.7,roughness:.35}):chrome,blk=std({color:0x141414,roughness:.7}),suit=std({color:0xe8e4d6,roughness:.9});
  const dash=new THREE.Mesh(new THREE.BoxGeometry(1.25,.1,.3),dashM);dash.position.set(0,.54,.78);interior.add(dash);
  const cowl=new THREE.Mesh(new THREE.SphereGeometry(.16,16,8,0,6.283,0,1.57),blk);cowl.scale.set(1,.5,.8);cowl.position.set(-.24,.64,.7);interior.add(cowl);
  // dial faces: numbered major marks with fine graduations between them, and a needle with a hub
  const faceTex=(marks,label,red,minor)=>canvas(256,256,(g)=>{const c=128;g.fillStyle='#0a0a0a';g.beginPath();g.arc(c,c,125,0,7);g.fill();g.strokeStyle='#8a8678';g.lineWidth=4;g.stroke();
    g.strokeStyle=g.fillStyle='#e8e4d6';g.font='700 26px Arial';g.textAlign='center';g.textBaseline='middle';const st=minor+1,n=(marks.length-1)*st;
    for(let i=0;i<=n;i++){const a=Math.PI*.75+i/n*Math.PI*1.5,maj=i%st===0,mid=st%2===0&&i%st===st/2;g.lineWidth=maj?6:mid?3.5:2;const r0=maj?93:mid?100:106;g.beginPath();g.moveTo(c+Math.cos(a)*r0,c+Math.sin(a)*r0);g.lineTo(c+Math.cos(a)*117,c+Math.sin(a)*117);g.stroke();if(maj)g.fillText(marks[i/st],c+Math.cos(a)*70,c+Math.sin(a)*70);}
    if(red){g.strokeStyle='#c8402a';g.lineWidth=9;g.beginPath();g.arc(c,c,111,Math.PI*(2.25-red*1.5),Math.PI*2.25);g.stroke();}
    g.fillStyle='#e9a13a';g.font='700 19px Arial';g.fillText(label,c,188);});
  const mkNeedle=(r,x,y,z)=>{const n=new THREE.Group(),b=new THREE.Mesh(new THREE.BoxGeometry(r*.085,r*1.08,.002),new THREE.MeshBasicMaterial({color:0xff7a1a}));b.position.y=r*.34;n.add(b);
    const h=new THREE.Mesh(new THREE.CircleGeometry(r*.16,14),new THREE.MeshBasicMaterial({color:0x2a2a2a}));h.rotation.y=Math.PI;h.position.z=-.002;n.add(h);n.position.set(x,y,z);interior.add(n);return n;};
  const dial=(x,y,z,r,label,marks,red,minor=9)=>{const face=new THREE.Mesh(new THREE.CircleGeometry(r,32),new THREE.MeshBasicMaterial({map:faceTex(marks,label,red,minor)}));face.position.set(x,y,z);face.rotation.y=Math.PI;interior.add(face);return mkNeedle(r,x,y,z-.004);};
  interior.needle=dial(-.24,.675,.63,.062,'T/MIN ×1000',['0','1','2','3','4','5','6','7','8'],.2,4);
  const panel=new THREE.Mesh(new THREE.BoxGeometry(.86,.118,.02),std({color:IN.panel||0x2b2a27,roughness:.6}));panel.position.set(-.05,.664,.662);interior.add(panel);
  interior.d={spd:dial(-.095,.668,.645,.05,'KM/H',['0','100','200','300','400']),temp:dial(-.385,.668,.645,.042,'HUILE °C',['40','80','120'],.25),
    press:dial(.03,.662,.645,.038,'HUILE BAR',['0','5','10']),fuel:dial(.125,.662,.645,.038,'ESSENCE',['0','½','1']),amp:dial(.22,.662,.645,.038,'VOLT',['8','12','16'])};
  for(let i=0;i<4;i++){const sw=new THREE.Mesh(new THREE.BoxGeometry(.012,.03,.012),chrome);sw.position.set(.3+i*.035,.655,.645);interior.add(sw);}
  const lamp=new THREE.Mesh(new THREE.CircleGeometry(.012,10),new THREE.MeshBasicMaterial({color:0x330000}));lamp.position.set(-.318,.728,.644);lamp.rotation.y=Math.PI;interior.add(lamp);interior.lamp=lamp;
  // he drives with a cigarette in his right hand; the smoke hangs in the cabin
  const cig=new THREE.Mesh(cyl(.005,.005,.075,6),std({color:0xf4f0e6}));cig.rotation.z=.6;cig.position.set(-.165,.105,-.02);
  const ctip=new THREE.Mesh(new THREE.SphereGeometry(.007,6,4),new THREE.MeshBasicMaterial({color:0xff6a20}));ctip.position.set(-.187,.136,-.02);
  interior.smoke=[];for(let i=0;i<28;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTex,color:0xdcdad4,transparent:true,depthWrite:false,opacity:0}));s.userData={t:i/28*5,L:5,sx:R(-1,1),sz:R(-1,1)};interior.add(s);interior.smoke.push(s);}
  const tilt=new THREE.Group();tilt.position.set(-.24,.62,.5);tilt.rotation.x=-.42;const spin=new THREE.Group();tilt.add(spin);interior.add(tilt);interior.spin=spin;spin.add(cig,ctip);
  spin.add(new THREE.Mesh(new THREE.TorusGeometry(.155,IN.rim?.017:.014,8,32),rimM));if(IN.hub){const hb=new THREE.Mesh(cyl(.038,.038,.012,16).rotateX(Math.PI/2),std({color:IN.hub,metalness:.5,roughness:.4}));spin.add(hb);}for(let i=0;i<3;i++){const sp=new THREE.Mesh(new THREE.BoxGeometry(.15,IN.spoke?.03:.02,.006),spokeM);const a=i*2.094+Math.PI/2;sp.position.set(Math.cos(a)*.075,Math.sin(a)*.075,0);sp.rotation.z=a;spin.add(sp);}
  for(const sd of[-1,1]){const hnd=new THREE.Mesh(new THREE.SphereGeometry(.036,10,8),suit);hnd.position.set(sd*.14,.06,-.01);spin.add(hnd);
    const fa=new THREE.Mesh(cyl(.028,.036,.36,8),suit);fa.position.set(sd*.2,-.1,-.16);fa.rotation.set(.85,0,-sd*.3);spin.add(fa);}
  for(const sd of[-1,1]){const a=new THREE.Vector3(sd*.6,.52,1.02),b=new THREE.Vector3(sd*.46,1.0,.42),pl=new THREE.Mesh(new THREE.BoxGeometry(.022,.022,a.distanceTo(b)),blk);pl.position.copy(a).add(b).multiplyScalar(.5);pl.lookAt(b);if(!MODELS[model].open)interior.add(pl);}
  interior.visible=false;hero.add(interior);
  spot=new THREE.SpotLight(0xfff0cc,0,240,.44,.7,1.3);spot.position.set(0,.6,1.6);spot.target.position.set(0,-.2,40);hero.add(spot,spot.target);
  if(ents.length)ents.find(e=>e.player).car=hero;
  $('mdl').textContent=MODELS[model].name;
}

await BOOT.step('THE DRIVER',.84);
/* ================= McQUEEN ================= */
// Figures are stylised but human-proportioned: tapered torso, thighs, knees and calves, neck, jaw, nose and ears, arms built from shoulder to elbow to hand.
function stretch(m,a,b){m.position.copy(a).add(b).multiplyScalar(.5);const d=b.clone().sub(a),L=d.length();m.scale.set(1,L,1);m.quaternion.setFromUnitVectors(YAX,d.divideScalar(L));}
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
function bodyBase(g,c){const sk=std({color:c.skin||0xd9a988,roughness:.75}),legs=std({color:c.legs,roughness:.85}),shoe=std({color:c.shoe||0x2a2622,roughness:.6}),hairM=std({color:c.hair,roughness:.95});
  const A=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
  for(const sx of[-1,1]){A(cyl(.09,.07,.46,12),legs,sx*.098,.67,0).rotation.z=sx*.04;A(new THREE.SphereGeometry(.068,10,8),legs,sx*.108,.45,.004);A(cyl(.066,.048,.42,12),legs,sx*.112,.245,-.008);
    const sh=A(new THREE.CapsuleGeometry(.047,.15,4,8),shoe,sx*.116,.045,.045);sh.rotation.x=Math.PI/2;sh.scale.set(1.05,1,.85);
    A(new THREE.SphereGeometry(.07,10,8),c.torso,sx*.205,1.395,0).scale.set(1,.9,.9);A(new THREE.SphereGeometry(.02,6,5),sk,sx*.094,1.655,0).scale.set(.5,1.2,.9);}
  const prof=[[.002,.86],[.15,.865],[.172,.94],[.158,1.05],[.166,1.19],[.196,1.32],[.202,1.39],[.15,1.452],[.06,1.474],[.002,1.478]].map(p=>new THREE.Vector2(p[0],p[1]));
  A(new THREE.LatheGeometry(prof,22),c.torso,0,0,0).scale.z=.64;if(c.belt)A(cyl(.166,.166,.035,20),shoe,0,.985,0).scale.z=.66;
  A(cyl(.046,.052,.1,10),sk,0,1.515,0);A(new THREE.SphereGeometry(.1,20,14),c.face||sk,0,1.66,0).scale.set(.93,1.13,1);A(new THREE.SphereGeometry(.074,12,10),sk,0,1.607,.02).scale.set(.92,.78,.9);
  A(new THREE.SphereGeometry(.019,6,5),sk,0,1.645,.1).scale.set(.85,1.3,1);
  A(new THREE.SphereGeometry(.106,14,9,0,6.283,0,1.42),hairM,0,1.675,-.012).scale.set(.96,1.1,1.06);if(c.fringe)A(new THREE.SphereGeometry(.06,10,6),hairM,.022,1.752,.066).scale.set(1.5,.4,.9);return{A,sk};}
function limb(g,mat,a,b,r0,r1){const m=new THREE.Mesh(cyl(r1,r0,1,10),mat);m.castShadow=true;g.add(m);stretch(m,a,b);return m;}
const mcq=new THREE.Group();
{const suit=std({color:0xeeeae0,roughness:.85});
 const stex=canvas(256,128,(g,w,h)=>{g.fillStyle='#eeeae0';g.fillRect(0,0,w,h);let x=16;for(const[c,ww]of[['#1d3a7a',12],['#eeeae0',5],['#d8452a',12]]){g.fillStyle=c;g.fillRect(x,0,ww,h);g.fillRect(x+ww-256,0,ww,h);x+=ww;}
   g.fillStyle='#fff';g.fillRect(214,30,24,15);g.fillStyle='#b3241c';for(let y=30;y<45;y+=4)g.fillRect(214,y,24,2);g.fillStyle='#1d3a7a';g.fillRect(214,30,10,8);
   g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=2;g.beginPath();g.moveTo(1,8);g.lineTo(1,h);g.moveTo(255,8);g.lineTo(255,h);g.stroke();g.strokeStyle='rgba(0,0,0,.18)';for(const y of[40,70,96]){g.beginPath();g.moveTo(0,y);g.quadraticCurveTo(128,y+5,256,y);g.stroke();}});
 const face=canvas(256,128,(g,w,h)=>{g.fillStyle='#d9a988';g.fillRect(0,0,w,h);const cx=64;g.fillStyle='rgba(120,70,50,.22)';g.fillRect(0,88,w,40);g.fillStyle='rgba(200,110,90,.2)';for(const dx of[-19,19]){g.beginPath();g.arc(cx+dx,74,9,0,7);g.fill();}
   g.fillStyle='#f6f2e8';for(const dx of[-13,13]){g.beginPath();g.ellipse(cx+dx,58,7,4,0,0,7);g.fill();}g.fillStyle='#2f66a8';for(const dx of[-13,13]){g.beginPath();g.arc(cx+dx,58,3.4,0,7);g.fill();}
   g.fillStyle='#7a5a2a';for(const dx of[-13,13])g.fillRect(cx+dx-9,47,18,3.5);g.fillStyle='#7a2f28';g.beginPath();g.ellipse(cx,85,10,2.4,0,0,7);g.fill();
   g.strokeStyle='rgba(110,60,40,.45)';g.lineWidth=1.6;for(const dx of[-22,22]){g.beginPath();g.moveTo(cx+dx*.5,72);g.quadraticCurveTo(cx+dx,80,cx+dx*.75,92);g.stroke();}});
 const{A,sk}=bodyBase(mcq,{legs:0xeeeae0,torso:std({map:stex,roughness:.85}),face:std({map:face,roughness:.8}),hair:0xa98a4c,fringe:1,belt:1});
 limb(mcq,suit,V3(.215,1.39,0),V3(.275,1.12,.015),.052,.046);limb(mcq,suit,V3(.275,1.12,.015),V3(.3,.9,.12),.044,.036);A(new THREE.SphereGeometry(.045,8,6),sk,.3,.87,.13);      // left arm, relaxed
 A(new THREE.SphereGeometry(.135,16,12),new THREE.MeshPhysicalMaterial({color:0x1d3a6a,roughness:.25,clearcoat:1}),.35,.99,.1);                                               // helmet tucked under it
 mcq.up_=A(cyl(.045,.052,1,10),suit,0,0,0);mcq.fore=A(cyl(.036,.044,1,10),suit,0,0,0);mcq.hand=A(new THREE.SphereGeometry(.045,8,6),sk,0,0,0);                                // right arm is posed each frame (the cigarette)
 mcq.cig=A(cyl(.008,.008,.08,6).rotateX(Math.PI/2),std({color:0xf4f0e6}),0,0,0);mcq.tip=A(new THREE.SphereGeometry(.011,6,4),std({color:0x331100,emissive:0xff5a14,emissiveIntensity:3}),0,0,0);
 mcq.rotation.order='YXZ';mcq.visible=false;scene.add(mcq);
 // so he can move like a person standing about: the whole figure goes in an inner group that sways and breathes, and the head (neck up) on a pivot that looks around
 {const inner=new THREE.Group(),head=new THREE.Group();head.position.set(0,1.5,0);const posed=[mcq.up_,mcq.fore,mcq.hand,mcq.cig,mcq.tip];
  const legs=[-1,1].map(sx=>{const p=new THREE.Group();p.position.set(sx*.1,.9,0);inner.add(p);return p;});   // hip joints, so he can stand with his weight on one leg
  for(const o of[...mcq.children]){const x=o.position.x,y=o.position.y;if(!posed.includes(o)&&y>1.49&&Math.abs(x)<.15){o.position.y-=1.5;head.add(o);}
    else if(y<.9&&Math.abs(x)>.05&&Math.abs(x)<.15){const p=legs[x<0?0:1];o.position.x-=p.position.x;o.position.y-=.9;p.add(o);}else inner.add(o);}
  mcq.legs=legs;
  {const hc=V3(.35,.99,.1),dkV=std({color:0x0c0d10,roughness:.2,metalness:.3}),wh=std({color:0xeeeae0,roughness:.4});   // the helmet under his arm: an open face and a white stripe, so it reads as a helmet and not a ball
   const op=new THREE.Mesh(new THREE.SphereGeometry(.137,18,12,-.75,1.5,1.05,.75),dkV);op.position.copy(hc);op.rotation.y=Math.PI/2+.5;inner.add(op);
   const sp=new THREE.Mesh(new THREE.TorusGeometry(.136,.012,6,28,Math.PI),wh);sp.position.copy(hc);sp.rotation.set(0,.5,0);inner.add(sp);}
  inner.add(head);mcq.add(inner);mcq.inner=inner;mcq.head=head;mcq.scale.setScalar(.93);mcq.lk={t:0,y:0,x:0};mcq.sm={t0:0,per:8};}}   // .93: about 1.66 m, rather than 1.78
// the starter at the line, who waves the chequered flag on the last lap
let flagman=null;
if(!DRIVE){flagman=new THREE.Group();const dk=std({color:0x1c1c1e,roughness:.8});const{A,sk}=bodyBase(flagman,{legs:0x8a8d90,torso:dk,hair:0x2a2018});
  limb(flagman,dk,V3(.215,1.39,0),V3(.27,1.12,0),.052,.046);limb(flagman,dk,V3(.27,1.12,0),V3(.29,.88,.05),.044,.036);A(new THREE.SphereGeometry(.045,8,6),sk,.29,.85,.05);
  const arm=new THREE.Group();arm.position.set(-.215,1.39,0);flagman.add(arm);const am=new THREE.Mesh(cyl(.038,.05,.6,10),dk);am.position.y=.3;arm.add(am);const hd=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),sk);hd.position.y=.63;arm.add(hd);
  const pole=new THREE.Mesh(cyl(.013,.013,1.5,6),std({color:0x5a4a3a}));pole.position.y=1.25;arm.add(pole);
  const fg=new THREE.PlaneGeometry(1.35,1,8,6),fl=new THREE.Mesh(fg,std({side:THREE.DoubleSide,roughness:.9,map:canvas(128,96,(g)=>{for(let x=0;x<8;x++)for(let y=0;y<6;y++){g.fillStyle=(x+y)%2?'#f2efe6':'#141414';g.fillRect(x*16,y*16,16,16);}})}));fl.position.set(.69,1.5,0);fl.castShadow=true;arm.add(fl);
  flagman.arm=arm;flagman.flag=fl;at(S0+1.5,-(RW-.7),0,flagman.position);flagman.rotation.y=yaw(START_I)+Math.PI;scene.add(flagman);}
// the other drivers, seen only during the running start
const runners=[];{const suitM=std({color:0xeeeae0,roughness:.85}),skinM=std({color:0xd9a988,roughness:.8}),helmC=[0xd8d2c0,0xb3241c,0xe6e1d0,0x1a1a1a,0xe3c94a,0x1d3a6a,0x1f3358,0xe6e1d0];
  for(let i=0;i<8;i++){const g=new THREE.Group(),limb=(x,y,len,r)=>{const p=new THREE.Group();p.position.set(x,y,0);const m=new THREE.Mesh(new THREE.CapsuleGeometry(r,len,3,8),suitM);m.position.y=-len/2-r*.4;m.castShadow=true;p.add(m);g.add(p);return p;};
    const t=new THREE.Mesh(new THREE.CapsuleGeometry(.17,.38,4,10),suitM);t.position.y=1.16;t.scale.z=.7;t.castShadow=true;g.add(t);
    const h=new THREE.Mesh(new THREE.SphereGeometry(.125,12,10),std({color:helmC[i],roughness:.3}));h.position.y=1.64;g.add(h);const f=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),skinM);f.position.set(0,1.62,.085);g.add(f);
    g.legs=[limb(-.09,.9,.7,.075),limb(.09,.9,.7,.075)];g.arms=[limb(-.24,1.4,.5,.05),limb(.24,1.4,.5,.05)];g.visible=false;scene.add(g);runners.push(g);}}
const between=(m,a,b)=>{m.position.copy(a).add(b).multiplyScalar(.5);V.copy(b).sub(a);const L=V.length();m.scale.set(1,L,1);m.quaternion.setFromUnitVectors(YAX,V.divideScalar(L));};
const mSh=new THREE.Vector3(-.235,1.4,0),mH=new THREE.Vector3(),mE=new THREE.Vector3();
function updateMcq(tm,rdt){if(!mcq.visible)return;const sm=mcq.sm;if(tm<sm.t0||tm>sm.t0+sm.per){sm.t0=tm;sm.per=R(6.5,11);}   // a drag on the cigarette now and then, not on a metronome
  const ph=(tm-sm.t0)/sm.per,up=sst(ph,.55,.66)-sst(ph,.82,.93);
  const I=mcq.inner,lk=mcq.lk;I.rotation.z=Math.sin(tm*.63)*.02+Math.sin(tm*1.7)*.004;I.rotation.y=Math.sin(tm*.29)*.07;I.position.x=Math.sin(tm*.63)*.018;I.scale.y=1+Math.sin(tm*1.5)*.007;   // weight shifting from foot to foot, and breathing
  const ws=Math.sin(tm*.63);mcq.legs[0].rotation.set(-.05-.05*Math.max(0,-ws),0,-.05-.02*ws);mcq.legs[1].rotation.set(-.03-.07*Math.max(0,ws),.12,.07-.02*ws);   // feet apart and turned out a little, the free knee easing forward
  if(tm>lk.t||tm<lk.t-6){lk.t=tm+R(1.4,4.2);lk.y=Math.random()<.35?0:R(-.75,.75);lk.x=R(-.12,.1);}                                                                                       // where he glances next
  const k=clamp(rdt*3,0,1),hy=lk.y*(1-up),hx=lk.x*(1-up)-.04*up;mcq.head.rotation.y+=(hy-mcq.head.rotation.y)*k;mcq.head.rotation.x+=(hx-mcq.head.rotation.x)*k;
  mH.set(lerp(-.3,-.05,up),lerp(1.02,1.57,up),lerp(.16,.15,up));mE.copy(mSh).add(mH).multiplyScalar(.5).add(V2.set(-.11-.05*up,-.13,-.06+.1*up));
  between(mcq.up_,mSh,mE);between(mcq.fore,mE,mH);mcq.hand.position.copy(mH);mcq.cig.position.set(mH.x+.02,mH.y+.03,mH.z+.07);mcq.tip.position.set(mH.x+.02,mH.y+.03,mH.z+.11);
  mcq.tip.material.emissiveIntensity=2+up*5;
  if(Math.random()<rdt*14){V.copy(mcq.tip.position);mcq.inner.localToWorld(V);puff(V,R(-.1,.1),R(.25,.5),R(-.1,.1),.06,.5,R(1.6,2.6),.22,0xe6e6e0);}
  if(ph>.93&&ph<.99&&Math.random()<rdt*40){V.set(-.02,.08,.14);mcq.head.localToWorld(V);V2.set(0,0,1).applyQuaternion(mcq.quaternion);puff(V,V2.x*.8,.15,V2.z*.8,.08,.8,2.2,.3,0xe6e6e0);}}

await BOOT.step('LIGHTING THE SKY',.86);
/* ================= SKY + LIGHT ================= */
const sunDir=new THREE.Vector3(0,1,0);
const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:{sun:{value:sunDir},hz:{value:new THREE.Color()},zn:{value:new THREE.Color()},night:{value:0},cov:{value:.7},dayk:{value:1},fl:{value:0},dk:{value:0}},
  vertexShader:'varying vec3 d;void main(){d=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec3 d;uniform vec3 sun,hz,zn;uniform float night,cov,dayk,fl,dk;
   float h(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5);}
   float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
   float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*n(p);p=p*2.07+3.1;a*=.5;}return s;}
   void main(){vec3 v=normalize(d);float y=max(v.y,0.);vec3 c=mix(hz,zn,pow(y,.42));
   float s=max(dot(v,sun),0.);c+=vec3(1.,.72,.42)*(pow(s,6.)*.18+pow(s,60.)*.8+pow(s,1500.)*30.)*dayk*(1.-cov*.9);
   c+=step(.9972,h(floor(v.xz/(v.y+.25)*150.)))*night*(1.-cov)*smoothstep(0.,.15,v.y)*1.4;
   vec2 q=v.xz/(v.y+.14)*1.3;float cl=fbm(q+vec2(2.,7.));float m=smoothstep(.46-cov*.44,.72-cov*.42,cl)*smoothstep(.0,.16,v.y);
   float sh=fbm(q+sun.xz*.12+vec2(2.,7.));vec3 cc=mix(vec3(.62,.64,.7),vec3(1.2,1.14,1.04),smoothstep(.35,.7,cl-sh*.25+.2));
   cc=mix(cc,vec3(.6,.61,.63)*(.75+.35*cl),cov*.75)*mix(.06,1.,dayk);cc*=1.-dk*(.25+.4*smoothstep(.35,.85,cl+sh*.3));
   c=mix(c,cc,m*.88);c+=fl*vec3(.75,.8,1.)*(.15+.45*m);gl_FragColor=vec4(c,1.);}`});
const sky=new THREE.Mesh(new THREE.SphereGeometry(3500,32,16),skyMat);scene.add(sky);
const hillTex=canvas(2048,128,(g,w,h)=>{g.clearRect(0,0,w,h);for(const[c,b,a]of[['#9fb0ad',70,26],['#869a8c',92,20],['#6f8672',108,13]]){g.fillStyle=c;g.beginPath();g.moveTo(0,h);for(let x=0;x<=w;x+=8)g.lineTo(x,b-(Math.sin(x*.012+b)+Math.sin(x*.031+b*2)*.5+Math.sin(x*.0427+b)*.25)*a*.5);g.lineTo(w,h);g.fill();}});
hillTex.wrapS=THREE.RepeatWrapping;hillTex.repeat.x=3;
const hills=new THREE.Mesh(new THREE.CylinderGeometry(3000,3000,300,64,1,true),new THREE.MeshBasicMaterial({map:hillTex,transparent:true,side:THREE.BackSide,fog:false,depthWrite:false}));hills.renderOrder=-1;scene.add(hills);
if(DRIVE){hills.material.map=Terrain.panorama();hills.material.needsUpdate=true;}   // free drive: the true skyline from where the car is, drawn from the survey
const sun=new THREE.DirectionalLight(0xffdcae,3.4);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);
Object.assign(sun.shadow.camera,{left:-75,right:75,top:75,bottom:-75,near:1,far:500});sun.shadow.bias=-.0004;sun.shadow.normalBias=.04;
scene.add(sun,sun.target);
const hemi=new THREE.HemisphereLight(0xbcd3e2,0x6a6a44,1.1);scene.add(hemi);
const boom=new THREE.PointLight(0xff8a30,0,140,1.6);scene.add(boom);
const pmr=new THREE.PMREMGenerator(renderer);const es=new THREE.Scene();es.add(new THREE.Mesh(sky.geometry,skyMat));
let envT=-99;

await BOOT.step('WEATHER FRONTS',.88);
/* ================= WEATHER ================= */
const WX={sun:{name:'GRAND SOLEIL',d:'Bright sun. Hot track, full grip.',grip:1.04,sunK:1.25,cov:.12,fn:150,ff:1900,wet:0,snow:0},
  overcast:{name:'COUVERT',d:'Overcast, as on film. Normal grip.',grip:1,sunK:1,cov:.6,fn:80,ff:1050,wet:0,snow:0},
  rain:{name:'PLUIE',d:'Rain. Two-thirds grip, long braking, aquaplaning at speed.',grip:.66,sunK:.32,cov:1,fn:35,ff:430,wet:1,snow:0},
  hail:{name:'GRÊLE',d:'Hail. Slippery, and stones knock the car about.',grip:.76,sunK:.36,cov:1,fn:40,ff:480,wet:.5,snow:0},
  snow:{name:'NEIGE',d:'Snow. Under half grip, wheelspin, heavy drag off line.',grip:.42,sunK:.5,cov:1,fn:26,ff:310,wet:0,snow:1}};
const WKEYS=['sun','overcast','rain','hail','snow'];
if(DRIVE)Object.assign(WX.overcast,{name:'COUVERT',d:'Slightly overcast, with dark clouds rolling over the bay now and then. Normal grip.',cov:.5,fn:200,ff:3400});   // the bay drive: a light grey sky; updateWeather() darkens it from time to time
const wx={...WX.overcast};
const NR=1700,rainPos=new Float32Array(NR*6),rainG=new THREE.BufferGeometry();rainG.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
const rain=new THREE.LineSegments(rainG,new THREE.LineBasicMaterial({color:0xcfd8e0,transparent:true,opacity:.42,fog:false}));rain.frustumCulled=false;scene.add(rain);
const NF=2600,flPos=new Float32Array(NF*3),flG=new THREE.BufferGeometry();flG.setAttribute('position',new THREE.BufferAttribute(flPos,3));
const flakes=new THREE.Points(flG,new THREE.PointsMaterial({map:glowTex,color:0xffffff,size:.16,transparent:true,depthWrite:false,opacity:.9,fog:false}));flakes.frustumCulled=false;scene.add(flakes);
const pr=[];for(let i=0;i<Math.max(NR,NF);i++)pr.push([R(-30,30),R(0,26),R(-30,30),Math.random()]);
const camPrev=new THREE.Vector3(),camVel=new THREE.Vector3(),camFwd=new THREE.Vector3();
function updatePrecip(rdt,tm){const w=G.weather,isRain=w==='rain',isSnow=w==='snow',isHail=w==='hail';
  rain.visible=isRain&&G.tun<.5;flakes.visible=(isSnow||isHail)&&G.tun<.5;if(!rain.visible&&!flakes.visible)return;
  camera.getWorldDirection(camFwd);const cx=camera.position.x+camFwd.x*16,cy=camera.position.y,cz=camera.position.z+camFwd.z*16;
  const fall=isRain?22:isHail?26:2.2,n=isRain?NR:NF;
  if(flakes.visible){flakes.material.size=isHail?.11:.17;flakes.material.opacity=isHail?1:.9;}
  for(let i=0;i<n;i++){const p=pr[i];p[1]-=fall*rdt*(.8+p[3]*.4);p[0]+=(isSnow?Math.sin(tm+p[3]*40)*.8:1.5)*rdt;
    let x=p[0]+cx,y=p[1],z=p[2]+cz;
    // wrap around the camera box
    p[0]=((p[0]+30)%60+60)%60-30;p[2]=((p[2]+30)%60+60)%60-30;if(p[1]<0){p[1]+=26;}
    x=cx+p[0];z=cz+p[2];y=cy-8+p[1];if(y<0.05)y=.05+Math.random()*.2*(isHail?1:0);
    if(isRain){const k=.03;rainPos.set([x,y,z,x-(camVel.x-1.5)*k,y+fall*k,z-camVel.z*k],i*6);}else flPos.set([x,y,z],i*3);}
  (isRain?rainG:flG).attributes.position.needsUpdate=true;
  // keep particles roughly centred as the camera moves
  for(let i=0;i<n;i++){pr[i][0]-=camVel.x*rdt;pr[i][2]-=camVel.z*rdt;}}

// lightning (rain only): the sky flashes and thunders, bolts hit the countryside, and now and then a car
const LT={next:5,flash:0,again:0,strike:R(35,60),bolt:null,boltT:0};
const boltMat=new THREE.MeshBasicMaterial({color:new THREE.Color(2.6,2.9,3.6),fog:false});
function boltTo(x,z){if(LT.bolt){scene.remove(LT.bolt);LT.bolt.geometry.dispose();}const pts=[],px=x+R(-40,40),pz=z+R(-40,40),N=12;
  for(let i=0;i<=N;i++){const f=i/N,j=i&&i<N?1:0;pts.push(new THREE.Vector3(lerp(px,x,f)+j*R(-9,9),lerp(240,0,f),lerp(pz,z,f)+j*R(-9,9)));}
  LT.bolt=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,false,'catmullrom',.1),40,.35,5,false),boltMat);scene.add(LT.bolt);LT.boltT=.24;LT.flash=1;LT.again=.09;
  const d=Math.hypot(camera.position.x-x,camera.position.z-z);sfxThunder(d);G.shake=Math.max(G.shake,clamp(40/(d+10),0,.9));}
function updateLightning(rdt){LT.flash*=Math.exp(-9*rdt);if(LT.again>0){LT.again-=rdt;if(LT.again<=0)LT.flash=Math.max(LT.flash,.7);}
  if(LT.bolt){LT.boltT-=rdt;LT.bolt.visible=LT.boltT>0&&Math.random()<.8;if(LT.boltT<=0){scene.remove(LT.bolt);LT.bolt.geometry.dispose();LT.bolt=null;}}
  if(DRIVE&&!G.paused&&G.state==='race'&&(G.sqs||0)>.6&&PL.idx>Z.sq-Math.round(400/SEG)&&PL.idx<Z.rb0+Math.round(300/SEG)){LT.sq=(LT.sq===undefined?3:LT.sq)-rdt;   // lightning over the hills as you come up to the San Rafael bridge, whatever the weather
    if(LT.sq<=0){LT.sq=R(4,9);if(Math.random()<.5){LT.flash=.8;LT.again=.12;sfxThunder(R(400,1400));}else{const p0=ents.find(e=>e.player);at(Math.min(p0.s+R(150,520),(Z.rb0-10)*SEG),R(60,260),0,V2);boltTo(V2.x,V2.z);}}}
  if(G.weather!=='rain'||wx.wet<.6||G.paused)return;const pe=ents.find(e=>e.player);
  LT.next-=rdt;if(LT.next<=0){LT.next=R(5,13);
    if(Math.random()<.45){LT.flash=.8;LT.again=.12;sfxThunder(R(500,1500));}                                              // sheet lightning, far off
    else{at(pe.s+R(80,520),(Math.random()<.5?-1:1)*R(26,220),0,V2);boltTo(V2.x,V2.z);fires.push({x:V2.x,z:V2.z,t:5});}}   // a strike in the fields
  if(G.state!=='race')return;LT.strike-=rdt;
  if(LT.strike<=0){LT.strike=R(45,85);const c=ents.filter(e=>!e.player&&!e.car.wreck&&e.out<=0&&Math.abs(wdiff(e.s-pe.s))<260);
    const e=(Math.random()<.45||!c.length)?pe:c[Math.random()*c.length|0];if(e.player&&(PL.crash||PL.safe>0))return;struck(e);}}

/* ================= PARTICLES / WRECKS ================= */
const smokeTex=canvas(128,128,(g)=>{for(let i=0;i<26;i++){const x=64+R(-26,26),y=64+R(-26,26),r=R(14,34);const rg=g.createRadialGradient(x,y,0,x,y,r);rg.addColorStop(0,'rgba(255,255,255,.22)');rg.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=rg;g.fillRect(0,0,128,128);}});
let NOGY=0,GY=0;   // height of the road under the action (free drive hills); 0 on the circuit
const parts=[],mkPool=(n,tex,add)=>{const a=[];for(let i=0;i<n;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false,blending:add?THREE.AdditiveBlending:THREE.NormalBlending,opacity:0}));s.visible=false;scene.add(s);a.push({s,life:0});}return a;};
const fireP=mkPool(240,glowTex,true),smokeP=mkPool(320,smokeTex,false);let fi=0,si=0;
const refP=DRIVE?mkPool(300,smokeTex,false):null;let ri=0;
const millP=DRIVE?mkPool(380,smokeTex,false):null;let mi=0;   // the steel mill's black smoke has a pool of its own, so it never steals the cars' exhaust
function emit(pool,idx,pos,vx,vy,vz,s0,s1,life,op,col,grav=0,drag=.6){const p=pool[idx%pool.length];p.s.position.copy(pos);p.fl=NOGY?pos.y-1e3:GY;if(GY>.6&&!NOGY&&pos.y<GY-.5)p.s.position.y+=GY;p.vx=vx;p.vy=vy;p.vz=vz;p.s0=s0;p.s1=s1;p.life=p.max=life;p.op=op;p.grav=grav;p.drag=drag;p.s.material.color.setHex(col);p.s.material.rotation=Math.random()*6.28;p.s.visible=true;if(!p.on){p.on=true;parts.push(p);}}
const flame=(pos,vx,vy,vz,s0,s1,life,col=0xff9a3a)=>emit(fireP,fi++,pos,vx,vy,vz,s0,s1,life,.24,col,0);
const spark=(pos,vx,vy,vz)=>emit(fireP,fi++,pos,vx,vy,vz,.14,.05,R(.35,.9),1,0xffd27a,20);
const puff=(pos,vx,vy,vz,s0,s1,life,op=.6,col=0x2a2826)=>emit(smokeP,si++,pos,vx,vy,vz,s0,s1,life,op,col,-.4);
function updateParts(dt){for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.life-=dt;if(p.life<=0){p.s.visible=false;p.on=false;parts.splice(i,1);continue;}
  const k=1-p.life/p.max,s=lerp(p.s0,p.s1,Math.sqrt(k));p.vy-=p.grav*dt;const dr=Math.exp(-p.drag*dt);p.vx*=dr;p.vz*=dr;if(p.grav<=0)p.vy*=dr;
  p.s.position.x+=p.vx*dt;p.s.position.y+=p.vy*dt;p.s.position.z+=p.vz*dt;if(p.s.position.y<p.fl+.05&&p.grav>0){p.s.position.y=p.fl+.05;p.vy*=-.4;}
  p.s.scale.set(s,s,1);p.s.material.opacity=p.op*(k<.1?k*10:1-(k-.1)/.9);}}
// loose bodywork and wheels
const debris=[];{const dg=new THREE.BoxGeometry(1,1,1),tg=cyl(.33,.33,.34,16).rotateZ(Math.PI/2);
  for(let i=0;i<42;i++){const m=new THREE.Mesh(i<6?tg:dg,i<6?tyreMat:new THREE.MeshStandardMaterial({roughness:.5}));m.visible=false;m.castShadow=true;scene.add(m);debris.push({m,life:0,v:new THREE.Vector3(),w:new THREE.Vector3(),wheel:i<6});}}
function shed(pos,vx,vz,n,col){for(const d of debris){if(n<=0)break;if(d.life>0||d.wheel)continue;n--;d.life=R(6,10);d.m.visible=true;d.g=GY;d.m.position.set(pos.x+R(-.8,.8),pos.y+R(0,.4)+(GY>.6&&pos.y<GY-.5?GY:0),pos.z+R(-.8,.8));
  d.v.set(vx*R(.3,.95)+R(-7,7),R(2,9),vz*R(.3,.95)+R(-7,7));d.w.set(R(-12,12),R(-12,12),R(-12,12));d.m.scale.set(R(.15,.75),R(.012,.03),R(.15,.6));d.m.material.color.setHex(Math.random()<.7?col:0x18181a);}}
function shedWheel(pos,vx,vz){const d=debris.find(d=>d.wheel&&d.life<=0);if(!d)return;d.life=10;d.m.visible=true;d.g=GY;d.m.position.set(pos.x,.5+GY,pos.z);d.v.set(vx*R(.7,1.05)+R(-5,5),R(3,8),vz*R(.7,1.05)+R(-5,5));d.w.set(R(-4,4),R(-3,3),R(-14,14));}
// skid marks: a ring buffer of dark quads laid on the road
const SKN=1400,skPos=new Float32Array(SKN*18),skG=new THREE.BufferGeometry();skG.setAttribute('position',new THREE.BufferAttribute(skPos,3));
const skid=new THREE.Mesh(skG,new THREE.MeshBasicMaterial({color:0x0c0c0c,transparent:true,opacity:.5,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3}));skid.frustumCulled=false;scene.add(skid);let skI=0;const skLast=[null,null];
function addSkid(k,x,z){const p=skLast[k],d2=p?(x-p[0])**2+(z-p[1])**2:1e9;if(d2>64){skLast[k]=[x,z];return;}if(d2<.04)return;
  const dx=x-p[0],dz=z-p[1],L=Math.sqrt(d2),nx=-dz/L*.17,nz=dx/L*.17,o=(skI++%SKN)*18,y=.035+GY;
  skPos.set([p[0]-nx,y,p[1]-nz,p[0]+nx,y,p[1]+nz,x+nx,y,z+nz,p[0]-nx,y,p[1]-nz,x+nx,y,z+nz,x-nx,y,z-nz],o);skG.attributes.position.needsUpdate=true;skLast[k]=[x,z];}
const endSkid=()=>{skLast[0]=skLast[1]=null;};
// A wreck is the real car body carried on by its own momentum: it slides, spins, bounces off the rail, can roll, sheds parts, and may catch fire.
const wrecks=[],fires=[];
function startWreck(e,vx,vz,sev,atWall){const car=e.car;if(car.wreck)return car.wreck;
  const w={e,car,x:car.position.x,z:car.position.z,y:0,vy:0,h:car.rotation.y,vx,vz,wy:R(1.2,3.5)*(Math.random()<.5?-1:1),roll:0,wr:0,t:0,fire:0,burn:0,idx:wrapI(Math.floor(e.s/SEG)),col:new THREE.Color(car.o.base).getHex()};
  car.wreck=w;wrecks.push(w);underside(car);if(!atWall)impact(w,sev);return w;}
// What you see when a car goes over: floor pan, frame tubes, the flat engine and its exhausts, gearbox, driveshafts and wishbones. Built the first time a car wrecks.
const UND_TEX=canvas(256,512,(g,w,h)=>{g.fillStyle='#a4a8aa';g.fillRect(0,0,w,h);for(let i=0;i<900;i++){g.fillStyle=`rgba(${Math.random()<.5?255:0},${Math.random()<.5?255:0},${Math.random()<.5?255:0},.035)`;g.fillRect(R(0,w),R(0,h),R(20,90),1);}
  g.strokeStyle='rgba(20,22,24,.75)';g.lineWidth=2;const ys=[0,84,170,262,350,430,512];for(const y of ys){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}for(const x of[64,128,192]){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}
  g.fillStyle='rgba(30,32,34,.8)';for(const y of ys)for(let x=8;x<w;x+=14){g.beginPath();g.arc(x,y+5,1.6,0,7);g.fill();g.beginPath();g.arc(x,y-5,1.6,0,7);g.fill();}for(const x of[64,128,192])for(let y=8;y<h;y+=14){g.beginPath();g.arc(x+5,y,1.6,0,7);g.fill();}
  for(let i=0;i<9;i++){const x=R(70,186),y=R(300,500),r=R(18,60),rg=g.createRadialGradient(x,y,0,x,y,r);rg.addColorStop(0,'rgba(18,14,10,.6)');rg.addColorStop(1,'rgba(18,14,10,0)');g.fillStyle=rg;g.fillRect(0,0,w,h);}
  g.strokeStyle='rgba(235,238,240,.5)';g.lineWidth=1;for(let i=0;i<60;i++){const x=R(0,w),y=R(0,h);g.beginPath();g.moveTo(x,y);g.lineTo(x+R(-6,6),y+R(20,90));g.stroke();}
  g.fillStyle='rgba(20,20,20,.7)';g.font='900 30px Arial';g.textAlign='center';g.fillText('917',128,60);});
function underside(car){if(car.under){car.under.visible=true;return;}const M=car.M,zR=M.zR,g=new THREE.Group(),alu=std({color:0xb4b8ba,metalness:.75,roughness:.42}),iron=std({color:0x55524c,metalness:.6,roughness:.6}),rust=std({color:0x8a5636,metalness:.5,roughness:.7}),blk=std({color:0x161616,roughness:.8});
  const box=(sx,sy,sz,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m);o.position.set(x,y,z);g.add(o);return o;},tube=(a,b,r,m)=>{const o=new THREE.Mesh(cyl(r,r,1,8),m);g.add(o);stretch(o,a,b);return o;};
  box(1.56,.012,ZF-zR-.5,std({map:UND_TEX,metalness:.55,roughness:.5}),0,.084,(ZF+zR)/2);
  for(const z of[ZF-.6,.75,-.15,-1.0,zR+.55])tube(V3(-.52,.06,z),V3(.52,.06,z),.02,alu);
  box(.3,.05,.84,iron,0,.05,-.6);for(let k=0;k<7;k++)box(.34,.022,.03,blk,0,.03,-.96+k*.12);           // sump, finned
  const gb=new THREE.Mesh(cyl(.09,.14,.75,12),alu);gb.rotation.x=Math.PI/2;gb.scale.z=.42;gb.position.set(0,.065,WZ[1]-.3);g.add(gb);box(.5,.03,.3,blk,0,.06,ZF-.5);tube(V3(-.62,.075,WZ[0]+.17),V3(.62,.075,WZ[0]+.17),.018,iron);
  for(const sd of[-1,1]){tube(V3(sd*.52,.06,zR+.5),V3(sd*.52,.06,ZF-.5),.024,alu);tube(V3(sd*.52,.06,-.15),V3(0,.06,.75),.018,alu);tube(V3(sd*.52,.06,-1),V3(0,.06,zR+.55),.018,alu);
    box(.24,.045,.8,alu,sd*.3,.055,-.6);box(.2,.03,1.25,blk,sd*.67,.064,.25);
    for(let k=0;k<3;k++)tube(V3(sd*.44,.05,-.3-k*.27),V3(sd*.36,.05,zR+.75),.028,rust);tube(V3(sd*.36,.05,zR+.75),V3(sd*.2,.13,zR+.05),.046,rust);
    tube(V3(sd*.1,.085,WZ[1]),V3(sd*.76,.2,WZ[1]),.028,iron);
    for(const z of WZ)for(const dz of[-.25,.25])tube(V3(sd*.42,.065,z+dz),V3(sd*.78,.15,z),.017,alu);}
  car.add(g);car.under=g;}
// Bodywork gives way where it is hit: the panel is pushed in toward the middle of the car and buckles unevenly, over a few frames.
function crumple(w,lx,ly,lz,sev){const car=w.car;if(!w.tgt){car.body.geometry=car.M.geo.clone();w.tgt=Float32Array.from(car.body.geometry.attributes.position.array);}
  const t=w.tgt,rad=clamp(.8+sev*.06,.9,1.9),dep=clamp(.1+sev*.028,.12,.6);let dx=-lx,dy=.3-ly,dz=(ZF+car.M.zR)/2-lz;const dl=Math.hypot(dx,dy,dz)||1;dx/=dl;dy/=dl;dz/=dl;
  for(let i=0;i<t.length;i+=3){const d=Math.hypot(t[i]-lx,t[i+1]-ly,t[i+2]-lz);if(d>rad)continue;const k=(1-d/rad)**2*dep,n=Math.sin(t[i]*37.1+t[i+1]*61.7+t[i+2]*23.3+sev)*.55;
    t[i]+=dx*k*(1+n);t[i+1]=Math.max(.09,t[i+1]+dy*k*(1+n)+n*k*.35);t[i+2]+=dz*k*(1-n);}
  w.defT=.4;}
function squashRoof(w){const can=w.car.canopy,b=w.car.M.cy||1,cy=Math.max(can.scale.y*.8,.45*b);can.scale.y=cy;can.position.y=CYB*(1-cy);crumple(w,R(-.5,.5),.8,R(-.9,1.1),8);}
function impact(w,sev,dir){V.set(w.x,.45+w.y,w.z);
  {const ax=dir?dir[0]:w.vx,az=dir?dir[1]:w.vz,al=Math.hypot(ax,az)||1,c=Math.cos(w.h),s=Math.sin(w.h),lx=(ax*c-az*s)/al,lz=(ax*s+az*c)/al,hl=(ZF-w.car.M.zR)/2,k=Math.min(.95/Math.max(Math.abs(lx),.01),hl/Math.max(Math.abs(lz),.01));
    crumple(w,lx*k+R(-.2,.2),R(.25,.5),(ZF+w.car.M.zR)/2+lz*k,sev);}
  shed(V,w.vx,w.vz,Math.min(9,2+(sev*.45|0)),w.col);
  for(let i=0;i<8+sev*2;i++)spark(V,w.vx*.5+R(-9,9),R(1,9),w.vz*.5+R(-9,9));
  for(let i=0;i<5;i++)puff(V,w.vx*.2+R(-2,2),R(.5,2.5),w.vz*.2+R(-2,2),.8,3.5,R(.8,1.6),.45,0x8a8478);
  if(sev>8){const on=w.car.corners.filter(c=>c.visible);if(on.length>1&&Math.random()<.75){on[Math.random()*on.length|0].visible=false;shedWheel(V,w.vx,w.vz);}}
  if(sev>10&&w.y<.05){w.vy=R(2,3.5)+sev*.14;w.wr=(Math.random()<.5?-1:1)*R(3.5,7.5);}
  w.wy+=R(-3.5,3.5);if(!w.fire&&sev>9.5)w.fire=w.t+R(.3,.8);
  const near=clamp(70/(camera.position.distanceTo(V)+10),.1,1);G.shake=Math.max(G.shake,(.5+sev*.05)*near);sfxCrunch(clamp(sev/14,.3,1)*near);}
function ignite(w){w.burn=.01;V.set(w.x,.7+w.y,w.z);
  for(let i=0;i<26;i++){const a=R(0,6.283),sp=R(2,9);flame(V,Math.cos(a)*sp+w.vx*.4,R(3,11),Math.sin(a)*sp+w.vz*.4,R(1,2),R(3.5,6.5),R(.5,1.2),Math.random()<.5?0xffb347:0xff5a1a);}
  for(let i=0;i<14;i++)puff(V,R(-3,3)+w.vx*.3,R(3,7),R(-3,3)+w.vz*.3,R(2,3),R(7,12),R(3,6),.7,0x1a1816);
  for(let i=0;i<30;i++)spark(V,R(-16,16),R(4,18),R(-16,16));
  boom.position.set(w.x,2.5,w.z);boom.intensity=1800;const near=clamp(80/(camera.position.distanceTo(V)+10),0,1);$('flash').style.opacity=.4*near;G.shake=Math.max(G.shake,1.1*near);sfxBoom();}
function endWreck(w){const car=w.car;car.wreck=null;for(const c of car.corners)c.visible=true;car.bodyMat.color.setScalar(1);car.canopy.material.color.setScalar(1);car.rotation.set(0,w.h,0);if(w.tgt){car.body.geometry.dispose();car.body.geometry=car.M.geo;}if(car.under)car.under.visible=false;{const cy=car.M.cy||1;car.canopy.scale.y=cy;car.canopy.position.y=CYB*(1-cy);}
  const i=wrecks.indexOf(w);if(i>=0)wrecks.splice(i,1);if(w.burn)fires.push({x:w.x,z:w.z,t:5});}
function updateWrecks(dt){for(const w of [...wrecks]){const car=w.car;w.t+=dt;const gy=w.free?0:H[w.idx];if(w.e.player)GY=gy;w.x+=w.vx*dt;w.z+=w.vz*dt;w.h+=w.wy*dt;const sp=Math.hypot(w.vx,w.vz);
  if(w.y<=0){const dec=Math.min(sp,(w.brake||(w.wr?9:6.5))*dt);if(sp>.01){w.vx-=w.vx/sp*dec;w.vz-=w.vz/sp*dec;}w.wy*=Math.exp(-1.3*dt);
    if(sp>5&&Math.random()<dt*45)spark(V.set(w.x+R(-.8,.8),.08,w.z+R(-.8,.8)),w.vx*.6+R(-3,3),R(.5,4),w.vz*.6+R(-3,3));
    if(w.wr){const q0=Math.floor(w.roll/(Math.PI/2));w.roll+=w.wr*dt;if(Math.floor(w.roll/(Math.PI/2))!==q0){w.wr*=.7;
      if(Math.abs(w.wr)>2.3&&sp>4){w.vy=1.2+Math.abs(w.wr)*.32;shed(V.set(w.x,.3,w.z),w.vx,w.vz,1,w.col);for(let i=0;i<6;i++)spark(V,w.vx*.5+R(-5,5),R(1,5),w.vz*.5+R(-5,5));sfxCrunch(.35);squashRoof(w);}
      else{w.wr=0;w.roll=Math.round(w.roll/Math.PI)*Math.PI;}}}}
  else w.roll+=w.wr*dt;
  w.vy-=17*dt;w.y+=w.vy*dt;
  if(w.y<0){w.y=0;if(w.free&&!w.landed){w.landed=1;impact(w,13);w.vx*=.5;w.vz*=.5;if(DRIVE&&CLF&&w.e.player&&PL.idx>=CLF[0]-40&&PL.idx<=CLF[1]+40){sfxBigSplash();G.shake=.9;NOGY=1;for(let q=0;q<46;q++){const a=R(0,6.283),sp=R(2,9);puff(V.set(w.x,.4,w.z),Math.cos(a)*sp,R(5,18),Math.sin(a)*sp,R(.8,1.6),R(4,7),R(1.2,2.4),.8,0xeef2f4);}NOGY=0;}}   /* off the Marin cliff: into the bay with a heavy splash */if(w.vy<-3.5){shed(V.set(w.x,.3,w.z),w.vx,w.vz,2,w.col);for(let i=0;i<10;i++)spark(V,w.vx*.5+R(-6,6),R(1,6),w.vz*.5+R(-6,6));sfxCrunch(.5);G.shake=Math.max(G.shake,.35);w.vy*=-.25;}else w.vy=0;}
  // guardrail
  let best=1e9,bi=w.idx;for(let k=-10;k<=10;k++){const i=wrapI(w.idx+k),dx=w.x-P[i].x,dz=w.z-P[i].z,d=dx*dx+dz*dz;if(d<best){best=d;bi=i;}}w.idx=bi;
  const n=Nn[bi],lat=(w.x-P[bi].x)*n.x+(w.z-P[bi].z)*n.z;
  const WW=wallAt[bi]+.15;
  if(!w.free&&Math.abs(lat)>WW&&w.y<1.2){const sd=Math.sign(lat),vn=(w.vx*n.x+w.vz*n.z)*sd;w.x-=n.x*sd*(Math.abs(lat)-WW);w.z-=n.z*sd*(Math.abs(lat)-WW);
    if(vn>0){w.vx-=n.x*sd*vn*1.4;w.vz-=n.z*sd*vn*1.4;w.vx*=.86;w.vz*=.86;if(vn>1.5)impact(w,vn,[n.x*sd,n.z*sd]);}}
  w.e.s=bi*SEG;w.e.lat=clamp(lat,-8.5,8.5);
  if(w.fire&&!w.burn&&w.t>w.fire)ignite(w);
  if(w.burn){w.burn=Math.min(1,w.burn+dt*.45);const c=lerp(1,.14,w.burn);car.bodyMat.color.setScalar(c);car.canopy.material.color.setScalar(c);
    if(Math.random()<dt*42)flame(V.set(w.x+R(-.7,.7),w.y+.6,w.z+R(-1.1,1.1)),w.vx*.5+R(-.6,.6),R(2,5),w.vz*.5+R(-.6,.6),R(.8,1.5),R(1.8,3.4),R(.4,.9),Math.random()<.5?0xffa53a:0xff6a1e);
    if(Math.random()<dt*13)puff(V.set(w.x+R(-.5,.5),w.y+1.3,w.z+R(-.5,.5)),R(.3,1.6),R(2.5,5),R(-.5,.5),R(1.5,2.5),R(6,11),R(4,7),.6,0x1c1a18);
    boom.intensity=Math.max(boom.intensity,220*(.7+Math.random()*.6));boom.position.set(w.x,2,w.z);}
  else if(w.t>.3&&Math.random()<dt*9)puff(V.set(w.x,w.y+.7,w.z),R(-.5,.5),R(1,2.5),R(-.5,.5),.8,3.5,R(1.5,3),.35,0xb8b8b4);
  if(w.defT>0){w.defT-=dt;const a=car.body.geometry.attributes.position,arr=a.array,tg=w.tgt,k=clamp(dt*15,0,1);for(let i=0;i<arr.length;i++)arr[i]+=(tg[i]-arr[i])*k;a.needsUpdate=true;car.body.geometry.computeVertexNormals();}
  car.position.set(w.x,gy+w.y+.45*(1-Math.cos(w.roll)),w.z);car.rotation.set(0,w.h,w.roll);}}
function updateFx(dt,rdt){updateParts(dt);
  for(const d of debris){if(d.life<=0)continue;d.life-=dt;if(d.life<=0){d.m.visible=false;continue;}d.v.y-=20*dt;d.m.position.addScaledVector(d.v,dt);
    const fl=(d.wheel?.33:.05)+(d.g||0);if(d.m.position.y<fl){d.m.position.y=fl;if(d.v.y<-1){d.v.y*=-.42;d.v.x*=.75;d.v.z*=.75;d.w.multiplyScalar(.7);}else{d.v.y=0;d.v.x*=1-2*dt;d.v.z*=1-2*dt;d.w.multiplyScalar(1-3*dt);}}
    d.m.rotation.x+=d.w.x*dt;d.m.rotation.y+=d.w.y*dt;d.m.rotation.z+=d.w.z*dt;}
  for(let i=fires.length-1;i>=0;i--){const f=fires[i];f.t-=dt;if(f.t<=0){fires.splice(i,1);continue;}const q=Math.min(1,f.t/3);
    if(Math.random()<dt*26*q)flame(V.set(f.x+R(-.7,.7),.4,f.z+R(-.9,.9)),R(-.5,.5),R(1.5,4),R(-.5,.5),R(.6,1.2),R(1.2,2.4)*q+.3,R(.4,.8),0xff7a2a);
    if(Math.random()<dt*8)puff(V.set(f.x,1,f.z),R(.3,1.4),R(2,4),R(-.5,.5),R(1.2,2),R(5,9),R(3,6),.5,0x1c1a18);}
  boom.intensity*=Math.exp(-5*rdt);const fl=$('flash');if(+fl.style.opacity>0.01)fl.style.opacity=+fl.style.opacity*Math.exp(-6*rdt);else fl.style.opacity=0;}
function sfxCrunch(v){if(!AC)return;const t=AC.currentTime;hit(t,.32,.9*v,900,'lowpass',master);hit(t,.18,.5*v,3200,'bandpass',master);tone('square',80,t,.16,.5*v,master,{to:38});}

await BOOT.step('TUNING THE ENGINE NOTE',.90);
/* ================= AUDIO ================= */
let AC=null,master,musicG,engOsc=[],engFilt,engG,windG,squealG,rainG_,musicOn=false,nextStep=0,stepN=0,rev;
function noiseBuf(sec){const b=AC.createBuffer(1,AC.sampleRate*sec,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b;}
function initAudio(){if(AC)return;try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return;}
  master=AC.createGain();master.gain.value=.85;const comp=AC.createDynamicsCompressor();master.connect(comp);comp.connect(AC.destination);
  const nb=noiseBuf(2),loopN=(type,f,q)=>{const s=AC.createBufferSource();s.buffer=nb;s.loop=true;const fl=AC.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;const g=AC.createGain();g.gain.value=0;s.connect(fl);fl.connect(g);g.connect(master);s.start();return g;};
  engFilt=AC.createBiquadFilter();engFilt.type='lowpass';engFilt.frequency.value=600;engFilt.Q.value=2;engG=AC.createGain();engG.gain.value=0;engFilt.connect(engG);engG.connect(master);
  {const eg=AC.createGain(),dl=AC.createDelay(1),fb=AC.createGain(),d2=AC.createDelay(1);eg.gain.value=0;dl.delayTime.value=.12;d2.delayTime.value=.31;fb.gain.value=.6;engG.connect(eg);eg.connect(dl);eg.connect(d2);dl.connect(fb);fb.connect(dl);dl.connect(master);d2.connect(master);engG.echo=eg;}   // the tube throws the engine note back at you
  [['sawtooth',1,.5],['sawtooth',2.01,.22],['square',.5,.32],['sawtooth',1.5,.14]].forEach(([t,m,g])=>{const o=AC.createOscillator();o.type=t;const gg=AC.createGain();gg.gain.value=g;o.connect(gg);gg.connect(engFilt);o.start();engOsc.push([o,m]);});
  windG=loopN('bandpass',700,.6);squealG=loopN('bandpass',1900,6);rainG_=loopN('highpass',2500,.5);
  musicG=AC.createGain();musicG.gain.value=.5;musicG.connect(master);
  rev=AC.createConvolver();const ib=AC.createBuffer(2,AC.sampleRate*1.8,AC.sampleRate);for(let c=0;c<2;c++){const d=ib.getChannelData(c);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2.6);}rev.buffer=ib;const rg=AC.createGain();rg.gain.value=.35;rev.connect(rg);rg.connect(musicG);
  { // loudspeaker murmur: a buzzy voice source through two wandering formants and a tinny PA filter
    const o=AC.createOscillator();o.type='sawtooth';o.frequency.value=130;const f1=AC.createBiquadFilter(),f2=AC.createBiquadFilter();f1.type=f2.type='bandpass';f1.Q.value=6;f2.Q.value=8;
    const g=AC.createGain();g.gain.value=0;const pa=AC.createBiquadFilter();pa.type='bandpass';pa.frequency.value=1300;pa.Q.value=.8;const out=AC.createGain();out.gain.value=.09;
    o.connect(f1);o.connect(f2);f1.connect(g);f2.connect(g);g.connect(pa);pa.connect(out);out.connect(master);o.start();
    setInterval(()=>{const t=AC.currentTime;if(ANN.on&&!ANN.voice&&t<ANN.until&&!G.paused){o.frequency.setTargetAtTime(R(105,175),t,.04);f1.frequency.setTargetAtTime(R(300,820),t,.03);f2.frequency.setTargetAtTime(R(1000,2300),t,.03);
      g.gain.setTargetAtTime(Math.random()<.85?R(.5,1):0,t,.02);g.gain.setTargetAtTime(0,t+.11,.03);}else g.gain.setTargetAtTime(0,t,.05);},170);}
  nextStep=AC.currentTime+.1;setInterval(schedule,40);}
const mtof=m=>440*Math.pow(2,(m-69)/12);
function tone(type,f,t,dur,vol,dest,opt={}){const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(opt.to)o.frequency.exponentialRampToValueAtTime(opt.to,t+dur);if(opt.det)o.detune.value=opt.det;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+(opt.a||.005));g.gain.setValueAtTime(vol,t+dur*(opt.h||.5));g.gain.exponentialRampToValueAtTime(.0008,t+dur);
  let out=g;if(opt.lp){const fl=AC.createBiquadFilter();fl.type=opt.ft||'lowpass';fl.frequency.setValueAtTime(opt.lp,t);if(opt.lpTo)fl.frequency.exponentialRampToValueAtTime(opt.lpTo,t+dur);fl.Q.value=opt.q||1;g.connect(fl);out=fl;}
  o.connect(g);out.connect(dest||musicG);if(opt.rev)out.connect(rev);o.start(t);o.stop(t+dur+.05);}
function hit(t,dur,vol,f,type='highpass',dest){const s=AC.createBufferSource();s.buffer=noiseBuf(Math.max(dur,.05));const fl=AC.createBiquadFilter();fl.type=type;fl.frequency.value=f;const g=AC.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0008,t+dur);s.connect(fl);fl.connect(g);g.connect(dest||musicG);s.start(t);s.stop(t+dur+.02);}
// original groove in the style of early-70s French pop: melodic bass up front, dry drums, wah guitar, strings
const CH=[{r:40,c:[55,59,62,66]},{r:40,c:[55,59,62,66]},{r:45,c:[55,61,64,66]},{r:45,c:[55,61,64,67]},{r:36,c:[55,59,60,64]},{r:36,c:[52,55,59,64]},{r:35,c:[54,57,63,66]},{r:35,c:[51,57,59,66]}];
const _=null,BASS=[[0,_,_,0,_,7,_,10,12,_,10,7,_,5,7,_],[0,_,_,0,_,7,10,_,12,_,15,14,12,10,7,3],[0,_,_,0,_,4,_,7,9,_,7,4,_,2,4,_],[0,_,_,0,_,4,7,_,10,_,9,7,_,4,2,-1],[0,_,_,0,_,7,_,9,12,_,11,7,_,4,7,_],[0,_,_,0,_,7,_,4,7,_,9,11,12,_,11,9],[0,_,_,0,_,4,_,7,10,_,7,4,_,3,2,1],[0,_,0,_,4,_,7,_,10,_,12,_,10,7,4,3]];
const MEL=[[71,_],[74,71],[76,73],[_,69],[79,76],[83,79],[78,75],[71,_]];
function schedule(){if(!AC||AC.state!=='running')return;const sp=60/94/4;
  while(nextStep<AC.currentTime+.18){const t=nextStep,st=stepN%16,bar=(stepN>>4)%8,sec=(stepN>>7)%4,ch=CH[bar],sw=st%2?sp*.14:0,tt=t+sw;
    if(musicOn&&G.state!=='title'||musicOn&&G.state==='title'){
      const b=BASS[bar][st];if(b!==null){const f=mtof(ch.r+b);tone('sawtooth',f,tt,sp*1.9,.42,musicG,{lp:900,lpTo:180,q:3,h:.3});tone('triangle',f,tt,sp*1.7,.34,musicG,{h:.4});}
      if(st===0||st===7||st===10)tone('sine',130,tt,.16,.9,musicG,{to:42,h:.2});
      if(st===4||st===12){hit(tt,.13,.4,1400,'bandpass');tone('triangle',190,tt,.09,.28,musicG,{to:140});}
      if(st===15&&bar%2)hit(tt,.06,.14,1800,'bandpass');
      if(st%2===0)hit(tt,st===14?.16:.035,st%4===2?.13:.08,7500);
      if(sec>0&&[2,5,8,11,14].includes(st)){const wah=st%3?1700:800;ch.c.slice(1).forEach(n=>tone('square',mtof(n),tt,.085,.045,musicG,{lp:wah,ft:'bandpass',q:5,rev:1}));}
      if(sec>=2&&st===0){ch.c.forEach((n,i)=>{for(const d of[-9,8])tone('sawtooth',mtof(n+12),t,sp*16.5,.028,musicG,{a:.45,h:.8,lp:1900,det:d,rev:1});});}
      if(sec===3){const m=MEL[bar][st===0?0:st===8?1:2];if(m)for(const d of[-6,6])tone('sawtooth',mtof(m+12),t,sp*7.6,.05,musicG,{a:.2,h:.7,lp:2600,det:d,rev:1});}
      if(sec===1&&st===0&&bar%2===0)ch.c.forEach(n=>tone('triangle',mtof(n),t,sp*10,.05,musicG,{a:.02,h:.3,rev:1}));
    }
    nextStep+=sp;stepN++;}}
function sfxBoom(){if(!AC)return;const t=AC.currentTime;hit(t,2.2,1.6,260,'lowpass',master);hit(t,.5,.9,1800,'lowpass',master);tone('sine',95,t,1.6,1.3,master,{to:26,h:.15});for(let i=0;i<7;i++)hit(t+.25+i*.17+Math.random()*.1,.12,.25,R(900,3000),'bandpass',master);}
function sfxMushroom(k){if(!AC)return;sfxBoom();const t=AC.currentTime;hit(t,3.5,1.8*k,140,'lowpass',master);tone('sine',62,t,3.8,1.4*k,master,{to:18});tone('triangle',40,t+.1,3,.6*k,master,{to:16});for(let i=0;i<9;i++)hit(t+.6+i*.55+Math.random()*.3,R(1.2,2.2),R(.5,.9)*k*(1-i/12),R(90,200),'lowpass',master);}   // the tanker: a deeper boom and a long rolling rumble
function sfxScrape(v){if(!AC)return;const t=AC.currentTime;hit(t,.28,.5*v,2400,'bandpass',master);tone('square',70,t,.12,.4*v,master,{to:40});}
function sfxPing(){if(!AC)return;tone('triangle',R(1800,3400),AC.currentTime,.05,.12,master);}
function sfxBeep(hi){if(!AC)return;tone('square',hi?880:440,AC.currentTime,hi?.5:.14,.2,master,{lp:2000});}
function updateAudio(rpm,thr,speed,slip){if(!AC)return;const t=AC.currentTime,f=rpm/60*3*(G.slow<1?.7:1),on=G.state==='race'||G.state==='count'||G.state==='finish';
  for(const[o,m]of engOsc)o.frequency.setTargetAtTime(f*m,t,.03);
  engFilt.frequency.setTargetAtTime(500+rpm*.28+thr*1700,t,.05);engG.gain.setTargetAtTime(on&&!G.paused&&!PL.crash?(.11+thr*.15)*(G.cam===1?1.15:1):0,t,.06);
  windG.gain.setTargetAtTime(on&&!G.paused?Math.min(.22,speed*speed*.00003):0,t,.1);squealG.gain.setTargetAtTime(on&&!G.paused&&!PL.crash&&!(DRIVE&&thr>.2&&Math.abs(PL.steer)<.2&&!PL.brk)?clamp((slip-2.6)*.055,0,.32):0,t,.05);engG.echo.gain.setTargetAtTime(G.tun*1.1,t,.15);
  rainG_.gain.setTargetAtTime(G.paused?0:G.weather==='rain'?.1:G.weather==='hail'?.14:0,t,.3);musicG.gain.setTargetAtTime(musicOn?(G.state==='title'?.65:.42):0,t,.2);}

function sfxThunder(d){if(!AC)return;const t=AC.currentTime+Math.min(3,d/340),v=clamp(140/(d+60),.15,1);hit(t,3.2,1.1*v,140,'lowpass',master);hit(t+.3,2.4,.7*v,90,'lowpass',master);if(d<250)hit(t,.25,1.2*v,2600,'highpass',master);}
// Trackside announcer, kept faint. Uses the computer's French voice if it has one; otherwise an unintelligible loudspeaker murmur.
const ANN={on:true,voice:null,idle:6,pos:0,posT:0,night:null,until:0};
const ORD=['première','deuxième','troisième','quatrième','cinquième','sixième','septième','huitième'];
const FILL=['Quelle course magnifique, mesdames et messieurs.','Les voitures passent devant les tribunes à plus de trois cents kilomètres à l\'heure.','La Porsche numéro vingt de McQueen continue son effort.','Le public est venu très nombreux cette année.','Attention au freinage au bout de la ligne droite.','Les mécaniciens attendent dans les stands.','Quel rythme impressionnant en tête de la course.','Vingt-quatre heures, c\'est très long pour les pilotes et pour les machines.'];
const WXFR={sun:'Le soleil est revenu sur le circuit.',overcast:'Le ciel se couvre au-dessus du circuit.',rain:'La pluie arrive sur le circuit, attention !',hail:'De la grêle maintenant, c\'est incroyable !',snow:'Il neige sur le circuit, du jamais vu !'};
if(window.speechSynthesis){const pv=()=>{ANN.voice=speechSynthesis.getVoices().find(v=>/^fr/i.test(v.lang))||null;};pv();speechSynthesis.addEventListener('voiceschanged',pv);}
function announce(txt){if(!ANN.on||G.paused)return;ANN.idle=R(9,16);
  if(ANN.voice){if(speechSynthesis.speaking)return;const u=new SpeechSynthesisUtterance(txt);u.voice=ANN.voice;u.lang=ANN.voice.lang;u.volume=.25;u.rate=1.15;u.pitch=.9;speechSynthesis.speak(u);}
  else if(AC)ANN.until=AC.currentTime+1.2+txt.length*.05;}
function announcerTick(rdt,pe){if(G.state!=='race'||G.paused)return;ANN.idle-=rdt;ANN.posT-=rdt;
  const p=standings().indexOf(pe)+1;if(ANN.pos&&p!==ANN.pos&&!PL.crash&&ANN.posT<=0&&G.raceT>8){ANN.posT=6;announce(p<ANN.pos?`McQueen prend la ${ORD[p-1]} place !`:'McQueen perd une place.');}ANN.pos=p;
  const nt=dayK<.3;if(ANN.night!==null&&nt!==ANN.night)announce(nt?'La nuit tombe sur le circuit.':'Le jour se lève sur le circuit.');ANN.night=nt;
  if(ANN.idle<=0)announce(FILL[Math.random()*FILL.length|0]);}

/* ================= GAME ================= */
const G={state:'title',t:0,raceT:0,RACE:DRIVE?1e9:+(QS.get('len')||360),tun:0,brg:0,slow:1,slowT:0,cam:+(QS.get('cam')||0),model:QS.get('model')||'k',weather:QS.get('wx')||(DRIVE?['sun','sun','overcast','overcast','rain','rain','hail','snow'][Math.random()*8|0]:'overcast'),paused:false,doomT:30,shake:0,msgT:0,tvS:null,tvSide:1,stopT:0,camH:0,finT:0,sens:clamp(+(localStorage.getItem('vqh-sens')||.5),.1,1),aids:localStorage.getItem('vqh-aids')!=='0',pad:false,liv:+(QS.get('liv')||0),titleClose:0};
const PL={x:0,z:0,h:0,vx:0,vz:0,idx:0,steer:0,delta:0,yawR:0,rpm:1200,gear:1,thr:0,brk:0,slip:0,under:0,warn:false,crash:null,safe:0,lapStart:0,last:0,best:0,lapN:0,hailT:0,wasThr:0};
const keys={};
const VS=createVehicle(),VI=createInput(),VE=createEnv(),OFF_MU=.55;   // the player's car: state, pedals and wheel, and the road under each tyre (see js/sim/vehicle.js)
function say(t,sub='',dur=2.2){$('msg').innerHTML=t+(sub?`<small>${sub}</small>`:'');G.msgT=dur;}
// lateral grip available at a given speed: tyres plus a little downforce
const GRID_A=.55;   // angle the cars sit at on the echelon grid
const gripAt=(v,g)=>(18+.26*Math.min(Math.abs(v),90))*g;
const RIVC=[   // the field when you race the classics
  {base:'#c4231a',num:'34',helmet:'#d8d2c0',model:'p904',name:'J. AUBERT'},{base:'#17181a',pin:'#b9bcc0',num:'43',helmet:'#b9bcc0',model:'m1',name:'K. BRANDT'},{base:'#141c36',num:'54',helmet:'#e6e1d0',model:'ghibli',name:'L. FERRO'},
  {base:'#e3b92e',edge:'#141414',num:'64',helmet:'#141414',model:'bb',name:'R. CONTI'},{base:'#d8401c',num:'71',helmet:'#e6e1d0',model:'lp400',name:'H. WEISS'},{base:'#c9cbc8',nose:'#b3241c',num:'35',helmet:'#b3241c',model:'p904',name:'P. LANG'},
  {base:'#5e1418',num:'82',helmet:'#1a1a1a',model:'f400',name:'M. ROSSI'},{base:'#b8402e',patina:1,num:'65',helmet:'#e6e1d0',model:'bz',name:'D. MARTIN'}];
function setupGrid(){for(const r of[...RIV,...RIVC])if(r.car)r.car.visible=false;for(const w of [...wrecks])endWreck(w);fires.length=0;ents.length=0;const order=DRIVE?['p']:[0,1,2,3,4,'p',5,6];
  order.forEach((id,k)=>{const s=DRIVE?S0:S0-6-k*7.5,lat=DRIVE?-(5.3+XW[START_I]):RW-2.2;   /* free drive: parked at the kerb in front of the house */   // echelon start: cars parked nose-out along the pit side, as in 1970
    if(id==='p'){ents.push({player:true,car:hero,s,lat,v:0,dist:s-S0,name:'S. McQUEEN',num:LIV().num,out:0});at(s,lat,0,V);PL.x=V.x;PL.z=V.z;PL.idx=wrapI(Math.round(s/SEG));PL.h=yaw(PL.idx)-(DRIVE?0:GRID_A);G.camH=yaw(PL.idx);PL.vx=PL.vz=0;PL.steer=0;resetVehicle(VS,hero.M.dyn,0);PL.crash=null;PL.auto=null;PL.safe=0;PL.lapN=0;PL.last=PL.best=0;}
    else{const r=(MKEYS===CLASSICS?RIVC:RIV)[id];if(!r.car)r.car=mk(r);r.car.visible=true;ents.push({car:r.car,s,lat,v:0,dist:s-S0,skill:.93+id*.01+rnd()*.015,vmax:MODELS[r.model].top*.94,off:rr(-1,1),pass:0,out:0,doom:0,ang:-GRID_A,name:r.name,num:r.num});}});
  G.raceT=0;G.doomT=30;G.stopT=0;G.finT=0;endSkid();placeAll(0);}
function placeAll(dt){for(const e of ents){if(e.player||e.car.wreck)continue;const i=wrapI(Math.floor(e.s/SEG));at(e.s,e.lat,0,e.car.position);e.car.rotation.set(0,yaw(i)+(e.doom?e.doom*.45:0)+e.ang,0);if(e.v>2)e.ang*=Math.exp(-1.6*dt);
    for(const w of e.car.wheels)w.rotation.y+=w.userData.dir*e.v*dt/.33;e.car.tail.emissiveIntensity=e.braking?7:1.8;}
  if(!hero.wreck&&!(PL.crash&&PL.crash.dive)){hero.position.x=PL.x;hero.position.z=PL.z;hero.rotation.y=PL.h;}}
const accelOf=(f,M)=>Math.max(0,13.5*M.acc*(1-f/M.top));
function speak(txt,rate,pitch){try{if(!window.speechSynthesis||G.paused)return;const u=new SpeechSynthesisUtterance(txt);u.rate=rate;u.pitch=pitch;u.volume=1;const v=speechSynthesis.getVoices().find(v=>/^en/i.test(v.lang));if(v){u.voice=v;u.lang=v.lang;}else u.lang='en-US';speechSynthesis.cancel();speechSynthesis.speak(u);}catch(e){}}
function ohNo(){try{if(window.speechSynthesis){const u=new SpeechSynthesisUtterance('Oh, nooooooooooo!');u.rate=.7;u.pitch=.6;u.volume=1;const v=speechSynthesis.getVoices().find(v=>/^en/i.test(v.lang));if(v)u.voice=v;speechSynthesis.cancel();speechSynthesis.speak(u);return;}}catch(e){}
  if(AC)tone('sawtooth',330,AC.currentTime,1.4,.5,master,{to:110,a:.05,h:.7,lp:900,ft:'bandpass',q:3});}
// Crash inside the Posey Tube: the whole tube goes up in flames for a couple of seconds, then the car is put back on the road past the exit.
const TUF={st:null,V:new THREE.Vector3()};
function tubeFire(dt){const F=TUF;if(!F.st){const m=new THREE.MeshBasicMaterial({color:0xff7a1c,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});F.st=[];for(let n=0;n<8;n++){const o=new THREE.Mesh(new THREE.BoxGeometry(.5,.9,26),m.clone());o.visible=false;scene.add(o);F.st.push(o);}}
  const c=PL.crash,tb=c&&!c.dive&&PL.idx>=Z.tu0&&PL.idx<=Z.tu1;
  if(!tb){if(F.on){F.on=0;for(const o of F.st)o.visible=false;}return;}
  if(!F.on){F.on=1;c.tf=0;sfxCrunch(1);}c.tf+=dt;
  const len=Z.tu1-Z.tu0;for(let n=0;n<8;n++){const o=F.st[n],j=Math.max(Z.tu0,Math.min(Z.tu1-1,Math.round(PL.idx+(n-3.5)*(len/8)*.6))),w=RW+XW[j];at(j*SEG,(n%2?1:-1)*(w-.6),.45,F.V);o.position.copy(F.V);o.rotation.set(0,yaw(j),0);o.scale.set(1,.7+.5*Math.sin(tmNow()*13+n*2.1),1);o.material.opacity=.45+.3*Math.sin(tmNow()*17+n);o.visible=true;}
  for(let q=0;q<2;q++){const a=R(-60,60),j=Math.max(Z.tu0,Math.min(Z.tu1-1,PL.idx+Math.round(a/SEG))),w=RW+XW[j];at(j*SEG,R(-w+.6,w-.6),R(.2,1.2),F.V);puff(F.V,R(-.4,.4),R(2,5),R(-.4,.4),R(1.2,2.2),R(3,5),R(.7,1.3),.8,q?0xff7a1c:0xffc050);}
  if(Math.random()<dt*6)puff(V.set(PL.x,3.5,PL.z),R(-1,1),R(.5,2),R(-1,1),R(2,3),R(6,9),R(1.5,2.5),.5,0x151311);}
// Webster Tube approach (I-80 south): a tanker truck ahead loses control, slews off the road and tips over; green liquid spreads from it over one side of the road (low grip there only, the other side stays clear).
const SPILL={g:1,st:0,done:false,s:0,lat:0,v:0,t:0,sd:1,yw:0,tip:0,R:0,gr:null,pm:null,pc:new THREE.Vector3(),V:new THREE.Vector3()};
function spillTick(rdt){const K=SPILL,pe=ents.find(e=>e.player);if(!pe||!DRIVE||!Z.wt1)return;const m=x=>Math.round(x/SEG),s0=Z.wt1-m(700);
  if(!K.gr){const g=new THREE.Group(),mt=(c,r,mm)=>std({color:c,roughness:r,metalness:mm||0}),A=(geo,mat,x,y,z)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);g.add(o);return o;};
    A(new THREE.BoxGeometry(2.4,2.5,2.2),mt(0xc8c8c8,.5),0,1.9,4.2);A(new THREE.BoxGeometry(2.3,.9,9.5),mt(0x222222,.8),0,.7,-.3);A(new THREE.CylinderGeometry(1.25,1.25,7.2,16).rotateX(Math.PI/2),mt(0xc9ccd0,.3,.7),0,2.2,-1.2);
    A(new THREE.BoxGeometry(2.5,.5,.1),mt(0xd8302a,.6),0,2.8,4.4);g.rotation.order='YXZ';g.visible=false;scene.add(g);K.gr=g;
    K.pm=new THREE.Mesh(new THREE.CircleGeometry(1,28).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x35e04f,transparent:true,opacity:.72,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-6,fog:true}));K.pm.visible=false;scene.add(K.pm);}
  if(PL.idx<s0-m(650))K.done=false;
  const ds=wdiff(K.s-pe.s);
  if(K.st===0){if(!K.done&&G.state==='race'&&PL.idx>s0-m(330)&&PL.idx<s0+m(60)&&pe.v>8){K.st=1;K.done=true;K.s=pe.s+Math.max(110,pe.v*3.5);K.lat=0;K.v=26;K.t=0;K.yw=0;K.tip=0;K.R=0;K.sd=Math.random()<.5?-1:1;K.gr.visible=true;}}
  else{K.t+=rdt;if(K.st<3){K.s=wrapS(K.s+K.v*rdt);if(K.st===1&&K.t>1.2)K.st=2;
      if(K.st===2){const u=K.t-1.2;K.lat+=K.sd*(5+u*5)*rdt;K.yw+=K.sd*-(.4+u*.9)*rdt;K.v=Math.max(7,K.v-11*rdt);const j=wrapI(Math.floor(K.s/SEG)),w=RW+XW[j];K.tip=K.sd*Math.min(1.35,u*.5);
        if(Math.abs(K.lat)>w-1.4||u>2.6){K.lat=clamp(K.lat,-(w-1.4),w-1.4);K.st=3;K.t=0;K.v=0;sfxCrunch(1);G.shake=Math.max(G.shake,.2);at(K.s+8,K.sd*w*.5,.08,K.pc);K.pm.visible=true;}}
      if(K.st===1)K.lat=Math.sin(K.t*3)*.25;}
    else{K.tip+=(K.sd*1.5-K.tip)*clamp(rdt*3,0,1);K.R=Math.min((RW+XW[wrapI(Math.floor(K.s/SEG))])*.5,K.R+rdt*1.6);K.pm.scale.set(K.R,1,K.R*1.25);K.pm.position.copy(K.pc);}
    const j=wrapI(Math.floor(K.s/SEG));at(K.s,K.lat,0,K.V);K.gr.position.copy(K.V);K.gr.rotation.set(0,yaw(j)+K.yw,K.tip);
    if(K.st===3&&Math.random()<rdt*5)puff(V.set(K.V.x,2.5,K.V.z),R(-.5,.5),R(1,3),R(-.5,.5),.8,2.5,R(.8,1.5),.35,0xaab8aa);
    if(ds<-420||ds>900){K.st=0;K.gr.visible=false;K.pm.visible=false;}}
  const tg=K.st===3&&Math.hypot(PL.x-K.pc.x,PL.z-K.pc.z)<K.R?.3:1;K.g+=(tg-K.g)*clamp(rdt*6,0,1);}
function crashPlayer(sev,atWall){if(PL.crash||PL.safe>0)return;if(SAFEZ()){PL.vx*=.8;PL.vz*=.8;G.shake=Math.max(G.shake,.4);return;}   /* no crashing before the Posey Tube: a hit only bounces and slows */ohNo();const pe=ents.find(e=>e.player);PL.crash={t:0,sd:Math.sign(pe.lat)||1,s:pe.s};startWreck(pe,PL.vx,PL.vz,sev,atWall);PL.vx=PL.vz=0;pe.v=0;G.slow=.3;G.slowT=2.6;say('ACCIDENT','No. '+LIV().num+' · McQUEEN',3);endSkid();announce('Accident ! La Porsche de McQueen est sortie de la piste !');}
function fallOff(sd,vn,bi){const n=Nn[bi],h=H[bi],vx=PL.vx,vz=PL.vz;crashPlayer(vn,true);const w=hero.wreck;if(!w)return;const out=Math.max(vn,7);   // through the barrier and down to the ground below
  w.free=1;w.y=h;w.vy=2;w.x+=n.x*sd*2.4;w.z+=n.z*sd*2.4;w.vx=vx*.8+n.x*sd*out;w.vz=vz*.8+n.z*sd*out;w.wr=sd*R(2.5,4.5);w.fire=R(1.9,2.6);PL.crash.cam=1;camP.set(PL.x+n.x*sd*26+T[bi].x*20,2.4,PL.z+n.z*sd*26+T[bi].z*20);say('OVER THE EDGE','No. '+LIV().num+' - McQUEEN',3);}
function HRL(bi){return DRIVE&&((bi>Z.tu1&&bi<Z.b0)||(bi>=Z.i80&&bi<Z.berkeley+Math.round(400/SEG)));}   // where the freeway rail holds the car up to 150 mph: I-880, and I-80 towards Berkeley
function crashAI(e,sev,lv=0){if(e.car.wreck)return;const i=wrapI(Math.floor(e.s/SEG));e.out=10;startWreck(e,T[i].x*e.v+Nn[i].x*lv,T[i].z*e.v+Nn[i].z*lv,sev,lv!==0);e.doom=0;e.v=0;
  if(!PL.crash&&camera.position.distanceTo(e.car.position)<260){G.slow=.4;G.slowT=1.6;say('ACCIDENT','No. '+e.num+' · '+e.name,2.6);announce('Accident pour la voiture numéro '+e.num+' !');}}
// a lightning strike sets the car alight where it is: it coasts to a stop burning, no tumble
function struck(e){const car=e.car;if(e.player&&SAFEZ())return;boltTo(car.position.x,car.position.z);let w;
  if(e.player){PL.crash={t:0,sd:Math.sign(e.lat)||1,s:e.s};w=startWreck(e,PL.vx,PL.vz,0,true);PL.vx=PL.vz=0;G.slow=.35;G.slowT=2.2;say('FOUDRE !','LIGHTNING STRIKE · No. '+LIV().num,3);endSkid();announce('La foudre ! La Porsche de McQueen est en feu !');}
  else{const i=wrapI(Math.floor(e.s/SEG));e.out=10;w=startWreck(e,T[i].x*e.v,T[i].z*e.v,0,true);e.v=0;say('FOUDRE !','No. '+e.num+' · '+e.name,2.4);announce('La foudre a frappé la voiture numéro '+e.num+' !');}
  w.fire=.01;w.wy=R(-.5,.5);w.brake=15;}
function readInput(racing){let st=0,thr=0,brk=0;if(!racing)return[0,0,0];
  st=((keys.ArrowLeft||keys.KeyA)?1:0)-((keys.ArrowRight||keys.KeyD)?1:0);thr=(keys.ArrowUp||keys.KeyW)?1:0;brk=(keys.ArrowDown||keys.KeyS||keys.Space)?1:0;
  const gp=navigator.getGamepads?[...navigator.getGamepads()].find(p=>p):null;G.pad=!!gp&&(Math.abs(gp.axes[0]||0)>.08||(gp.buttons[7]&&gp.buttons[7].value>.05)||(gp.buttons[6]&&gp.buttons[6].value>.05));
  if(gp){const ax=gp.axes[0]||0;if(Math.abs(ax)>.08)st=-ax;if(gp.buttons[7])thr=Math.max(thr,gp.buttons[7].value);if(gp.buttons[6])brk=Math.max(brk,gp.buttons[6].value);}
  if(G.autoSt!=null)st=G.autoSt;return[st,thr,brk];}
function playerUpdate(dt,pe){const M=hero.M,g=wx.grip*M.grip*SPILL.g*(1-(PL.melt||0)*.1),racing=G.state==='race';
  if(PL.crash){PL.crash.t+=dt/Math.max(G.slow,.3);return;}
  if(DRIVE&&NUDG.on&&nudgeCarry(dt,pe))return;   // pushed back onto the road by a giant iguana (nudgeTick)
  if(MOSQ.lift&&mosqCarry(dt,pe))return;   // held up by the giant mosquito: driving paused, the car carried along the road (mosqCarry)
  if(PL.auto&&autoDrive(dt,pe))return;   // backing out of the driveway at the start, pulling in at the finish
  let[st,thr,brk]=readInput(racing);if(G.state==='finish')brk=1;
  const rev=racing&&keys.KeyX?1:0;                                                                           // reverse is its own key; the brake only ever stops the car
  if(G.state==='finish'&&G.finT<2.6){brk=0;thr=1;}                                                           // cross the line at racing speed, then slow down
  // ---- vehicle dynamics (js/sim/vehicle.js): tyres, engine, gearbox, weight transfer. The car's speed is handed over in its own frame every time, so walls, bumps and other cars can still shove it about in between.
  let fx=Math.sin(PL.h),fz=Math.cos(PL.h);const offroad=Math.abs(pe.lat)>edgeAt[PL.idx],ed=edgeAt[PL.idx],f0=PL.vx*fx+PL.vz*fz;
  VS.x=PL.x;VS.z=PL.z;VS.h=PL.h;VS.u=f0;VS.v=PL.vx*fz-PL.vz*fx;
  if(M.twitch&&f0>70)VS.r+=Math.sin(G.raceT*7.3)*Math.sin(G.raceT*3.1)*.5*dt*(f0-70)/12;                      // 1969 car wanders at speed
  if(wx.wet>.8&&f0>62&&!offroad)VS.r+=Math.sin(G.raceT*5.1+Math.sin(G.raceT*1.7)*3)*.6*dt*(f0-62)/14;         // aquaplaning
  if(G.weather==='hail'){PL.hailT-=dt;if(PL.hailT<0){PL.hailT=R(.12,.5);VS.r+=R(-.05,.05)*(1+f0/60);G.shake=Math.max(G.shake,.12);sfxPing();}}
  {const gl=Math.abs(pe.lat+.72)>ed?g*OFF_MU:g,gr=Math.abs(pe.lat-.72)>ed?g*OFF_MU:g,aq=wx.wet>.8&&f0>62?1-.25*clamp((f0-62)/30,0,1):1,nOff=(gl<g?.5:0)+(gr<g?.5:0);   // each side of the car has its own surface: two wheels on the grass pull it round
   VE.mu[0]=gl*aq;VE.mu[1]=gr*aq;VE.mu[2]=gl;VE.mu[3]=gr;VE.rr=nOff*(2+.05*Math.abs(f0)+wx.snow*2)+(1-nOff)*(wx.snow*.5+wx.wet*.15);}
  if(DRIVE&&zoneArr[PL.idx]===1&&!offroad){let c=0;for(let q=-6;q<14;q++){const u=wrapI(PL.idx+q),v=wrapI(u+1);c+=Math.abs((T[v].x-T[u].x)*Nn[u].x+(T[v].z-T[u].z)*Nn[u].z);}   // Alameda's big corners hold at 200 mph: the grip rises with what the bend asks for at this speed
    const need=f0*f0*(c/(20*SEG))/9.81;if(need>.6*g){const k=Math.min(7,need*1.35/(g||1));for(let q=0;q<4;q++)VE.mu[q]*=Math.max(1,k);}}
  if(PL.wash>0){const w=PL.wash;for(let k=0;k<4;k++)VE.mu[k]*=1-.2*w;VE.rr+=w*(1.2+.025*Math.abs(f0));VS.v+=w*2.2*dt;VS.r+=Math.sin(G.raceT*3.3)*.2*w*dt;}   /* a wave washing over the Marina: a little drag (light, so it barely slows you), slightly less grip, and a shove towards the field (marinaTick) */
  if(DRIVE&&PL.dustW>0){const w=PL.dustW;VS.v+=Math.sin(G.raceT*9)*7*w*dt;VS.r+=Math.sin(G.raceT*6.1)*.3*w*dt;}   /* inside a dust devil: a slight sideways wobble that cancels itself out (dustTick) */
  VE.grade=PL.slope||0;VE.air=PL.air?1:0;VE.aids=G.aids?1:0;VE.sens=G.sens;VI.st=st;VI.thr=thr;VI.brk=brk;VI.rev=rev;VI.analog=G.pad?1:0;
  stepVehicle(VS,M.dyn,VI,VE,dt);
  if(G.state==='finish'&&G.finT>=2.6&&VS.u<.3){VS.u=VS.v=VS.r=0;}
  PL.x=VS.x;PL.z=VS.z;PL.h=VS.h;fx=Math.sin(PL.h);fz=Math.cos(PL.h);PL.vx=fx*VS.u+fz*VS.v;PL.vz=fz*VS.u-fx*VS.v;
  const f=VS.u,v=Math.abs(f),a=VS.axF,yawR=VS.r,delta=VS.delta,spin=VS.spin;
  PL.steer=VS.steerN;PL.thr=VS.thr;PL.brk=VS.brk;PL.delta=delta;PL.yawR=yawR;PL.under=VS.under;PL.slip=VS.slip;PL.gear=VS.gear;PL.rpm=VS.rpm;
  // where are we on the track
  let best=1e9,bi=PL.idx;for(let k=-14;k<=14;k++){const i=wrapI(PL.idx+k),dx=PL.x-P[i].x,dz=PL.z-P[i].z,d=dx*dx+dz*dz;if(d<best){best=d;bi=i;}}
  PL.idx=bi;const dx=PL.x-P[bi].x,dz=PL.z-P[bi].z;let lat=dx*Nn[bi].x+dz*Nn[bi].z;const ns=wrapS(bi*SEG+dx*T[bi].x+dz*T[bi].z);
  {const k=clamp((dx*T[bi].x+dz*T[bi].z)/SEG,-1,1),j=wrapI(bi+(k>=0?1:-1));PL.gy=H[bi]+(H[j]-H[bi])*Math.abs(k)+bkY(bi,lat);
    if(DETR.a>=0&&bi>=DETR.a&&bi<=DETR.a+240&&lat<-(RW+XW[bi])-1.2){const u=(bi-DETR.a)/240;PL.gy=H[bi]*(1-sst(u,.08,.6));}   // on the detour ramp the ground goes down with the lane
    if(DRIVE){const e=RW+XW[bi],al=Math.abs(lat);if((KB[bi]&(lat>0?1:2))&&al>e+.25&&al<e+3.1)PL.gy+=.13;}   // up the kerb onto the pavement (KB: which sides have pavement here)
    PL.slope=(H[wrapI(bi+1)]-H[wrapI(bi-1)])/(2*SEG)*(fx*T[bi].x+fz*T[bi].z);GY=PL.gy;
    if(PL.cy===undefined||dt<=0){PL.cy=PL.gy;PL.vy=0;PL.air=0;}
    else if(PL.air){PL.vy-=24*dt;PL.cy+=PL.vy*dt;if(PL.cy>PL.gy+3.2){PL.cy=PL.gy+3.2;PL.vy=Math.min(PL.vy,0);}if(PL.cy<=PL.gy){const dn=(PL.slope||0)*f-PL.vy;/* how hard it meets the road, not how fast it falls */PL.cy=PL.gy;PL.air=0;PL.vy=(PL.slope||0)*f;/* land moving with the road, so it does not hop straight off again */if(dn>3){const k=clamp(dn/9,.3,1.6);PL.land=.12*k;G.shake=Math.max(G.shake,.7*k);sfxThump(k);for(let q=0;q<10;q++)spark(V.set(PL.x+R(-.8,.8),PL.gy+.1,PL.z+R(-.8,.8)),PL.vx*.6+R(-3,3),R(.5,3),PL.vz*.6+R(-3,3));}}}
    else{const vg=(PL.gy-PL.cy)/dt;if(vg<PL.vy-24*dt-.05&&v>12){PL.air=1;PL.vy-=24*dt;PL.cy+=PL.vy*dt;}else{PL.vy=vg;PL.cy=PL.gy;}}}   // where the road drops away faster than the car can fall, it flies   // height of the road here, and how steeply it climbs the way the car is pointing
  pe.dist+=wdiff(ns-pe.s);pe.s=ns;pe.v=f;PL.warn=racing&&f>vcp[wrapI(bi+3)]*Math.sqrt(g*M.dyn.gk)*1.03&&f>25;
  // guardrail: a glancing touch scrapes and bounces, a real hit is a crash
  const WLL=lat<0&&wallR[bi]?wallR[bi]:wallAt[bi];
  if(Math.abs(lat)>WLL){const sd=Math.sign(lat),vn=(PL.vx*Nn[bi].x+PL.vz*Nn[bi].z)*sd,spd=Math.hypot(PL.vx,PL.vz),RUB=DRIVE&&((bi>=Z.gg0-Math.round(320/SEG)&&bi<Z.gg0+Math.round(60/SEG))||(bi>=Z.toll-Math.round(60/SEG)&&bi<Z.toll+Math.round(330/SEG))||(bi>=Z.downtown-Math.round(60/SEG)&&bi<Z.hyde+Math.round(40/SEG))||(bi>=Z.marina-Math.round(30/SEG)&&bi<Z.marina+Math.round((MR*1.571+40)/SEG)));   /* the approach to the Golden Gate: rubbery rails, you bounce and never crash or fall */
    if(!RUB&&racing&&DRIVE&&zoneArr[bi]===4&&PL.safe<=0&&spd>44.7&&vn>3.5){startDive(sd,vn,bi);return;}   // on the bridge the rail holds the car up to 100 mph (44.7 m/s); a real hit above that takes you through
    if(!RUB&&racing&&DRIVE&&zoneArr[bi]===3&&H[bi]>6&&PL.safe<=0&&spd>(HRL(bi)?67:44.7)&&vn>(HRL(bi)?6:3.5)){pe.lat=lat;fallOff(sd,vn,bi);return;}   // and off the elevated freeway (I-880, and I-80 towards Berkeley: only at 150 mph)
    if(!RUB&&racing&&DRIVE&&CLF&&sd>0&&bi>=CLF[0]+15&&bi<=CLF[1]&&PL.safe<=0&&spd>22&&vn>4.5){pe.lat=lat;lakeCrash(sd,vn,bi,pe);return;}   // Marin: a hard hit breaks the timber rail above the lake, and over the edge into it
    if(!RUB&&racing&&DRIVE&&CLF&&sd>0&&bi>=CLF[0]&&bi<=CLF[1]&&PL.safe<=0&&spd>22&&vn>4.5){pe.lat=lat;fallOff(sd,vn,bi);say('OFF THE CLIFF','No. '+LIV().num+' - McQUEEN',3);return;}   // Marin: through the rail and off the cliff into the rocks
    if(!RUB&&racing&&PL.safe<=0&&spd>(HRL(bi)?67:50)&&vn>7){pe.lat=lat;crashPlayer(vn,true);return;}                              // only a hit at real speed wrecks the car
    PL.x-=Nn[bi].x*sd*(Math.abs(lat)-WLL);PL.z-=Nn[bi].z*sd*(Math.abs(lat)-WLL);lat=WLL*sd;
    if(vn>0){if(RUB){PL.vx-=Nn[bi].x*sd*vn*.8;PL.vz-=Nn[bi].z*sd*vn*.8;}PL.vx-=Nn[bi].x*sd*vn*1.35;PL.vz-=Nn[bi].z*sd*vn*1.35;PL.vx*=.9;PL.vz*=.9;VS.r*=.4;let dh=((yaw(bi)-PL.h+Math.PI*3)%(Math.PI*2))-Math.PI;if(Math.abs(dh)<1.6)PL.h+=dh*.22;
      if(vn>1.5){sfxScrape(clamp(vn/8,.3,1));G.shake=Math.max(G.shake,.4);for(let i=0;i<10;i++)spark(V.set(PL.x+Nn[bi].x*sd,.5,PL.z+Nn[bi].z*sd),PL.vx*.6+R(-4,4),R(1,6),PL.vz*.6+R(-4,4));}}}
  pe.lat=lat;
  // other cars, including wrecks left on the road
  for(const e of ents){if(e.player)continue;const isW=!!e.car.wreck;if(e.out>0&&!isW)continue;const ex=e.car.position.x-PL.x,ez=e.car.position.z-PL.z,dzf=ex*fx+ez*fz,dxs=ex*fz-ez*fx;
    if(Math.abs(dzf)<4.3&&Math.abs(dxs)<1.95){const ev=isW?0:e.v,close=dzf>0?f-ev:ev-f;
      if(racing&&close>30&&v>78.2&&PL.safe<=0){if(!isW)crashAI(e,close*.5);crashPlayer(close*.5,false);return;}   // only above 175 mph (78.2 m/s) is a hit a crash
      if(close>2&&!isW&&!(e.bT>tmNow())){e.bT=tmNow()+.5;e.lat+=Math.sign(dxs||1)*(Nn[bi].x*fz-Nn[bi].z*fx>0?1:-1)*clamp(close*.08,.4,1.6);G.shake=Math.max(G.shake,.25);sfxBoing(clamp(close/20+.45,.45,1));}   // below that a rubbery bump: boing, and it is shoved aside
      const push=(1.95-Math.abs(dxs))*.5*Math.sign(dxs||1);PL.x-=fz*push;PL.z+=fx*push;if(!isW)e.lat+=push*(Nn[bi].x*fz-Nn[bi].z*fx>0?1:-1)*.5;
      if(close>0){if(dzf>0){const nf=Math.max(0,ev-1.5),k=f>1?nf/f:1;PL.vx*=k;PL.vz*=k;if(!isW)e.v+=1.2;}else if(!isW)e.v=Math.max(0,f-1.5);sfxScrape(.5);G.shake=Math.max(G.shake,.3);}}}
  for(const o of OBST){const ox=PL.x-o.x,oz=PL.z-o.z,d2=ox*ox+oz*oz,R0=o.r||2.5;if(o.deb&&d2<R0*R0&&v>3){const dd=o.deb,kk=OBST.indexOf(o);if(kk>=0)OBST.splice(kk,1);dd.ob=null;dd.done=false;dd.vy=R(7,13);dd.vx=PL.vx*1.1+R(-4,4);dd.vz=PL.vz*1.1+R(-4,4);dd.w=R(-7,7);if(hero.sherpTyres){PL.bump=Math.max(PL.bump||0,.45);sfxThump(.6);}else{PL.vx*=.94;PL.vz*=.94;sfxScrape(.8);}G.shake=Math.max(G.shake,.35);continue;}   /* the Sherp just bucks over it */if(d2<R0*R0&&d2>.01){const d=Math.sqrt(d2),k=(R0-d)/d;PL.x+=ox*k;PL.z+=oz*k;if(o.soft){PL.vx*=.995;PL.vz*=.995;}else if(v>3){PL.vx*=.7;PL.vz*=.7;sfxScrape(clamp(v/20,.3,1));G.shake=Math.max(G.shake,.3);}}}   // parked cars
  for(const hl of HOLES){if(hl.cd>0){hl.cd-=dt;continue;}const hx=PL.x-hl.x,hz=PL.z-hl.z;if(v>6&&hx*hx+hz*hz<(hl.r+.8)**2){hl.cd=.7;const k=clamp(v/50,.3,1.5);PL.h+=R(-.03,.03)*k;PL.vx*=1-.035*k;PL.vz*=1-.035*k;PL.bump=.09*k;G.shake=Math.max(G.shake,.6*k);sfxThump(k);}}
  if(PL.land){PL.bump=Math.max(PL.bump||0,PL.land);PL.land=0;}PL.bump=(PL.bump||0)*Math.exp(-9*dt);
  const ln=Math.floor(pe.dist/LEN);if(!DRIVE&&pe.dist>=0&&ln>PL.lapN){PL.last=G.raceT-PL.lapStart;PL.lapStart=G.raceT;PL.lapN=ln;if(!PL.best||PL.last<PL.best)PL.best=PL.last;if(ln<LAPS)say(ln===LAPS-1?'DERNIER TOUR':'LAP '+(ln+1),ln===LAPS-1?'FINAL LAP · '+fmt(PL.last):fmt(PL.last),2);announce(`McQueen boucle son tour en ${Math.round(PL.last)} secondes.`);}
  // pose: the body pitches under braking, rolls in corners, and the front wheels turn
  hero.position.set(PL.x,PL.cy-PL.bump*.25,PL.z);hero.rotation.set(VS.pitch+PL.bump*.1-Math.atan(PL.air?clamp(PL.vy/Math.max(Math.abs(VS.u),5),(PL.slope||0)-(PL.cy-PL.gy+.05)/2.3,(PL.slope||0)+(PL.cy-PL.gy+.05)/2.5):PL.slope||0),PL.h,VS.roll*(hero.M.roll?2.6:1)+(BK[PL.idx]?Math.atan(BK[PL.idx])*(Nn[PL.idx].x*Math.cos(PL.h)-Nn[PL.idx].z*Math.sin(PL.h)):0));   /* in the air the body follows its flight path, but never tips its nose or tail into the road below */
  if(hero.sherpTyres&&!PL.air){const S=PL.sh||(PL.sh={y:0,vy:0,p:0,vp:0,r:0,vr:0,pb:0}),sp=Math.min(v,40);   // Sherp: a bouncy four-wheel-drive ride: the box cab rocks and bobs on its soft tyres over the road, and bucks over every bump, hole and bit of debris
    if(Math.random()<dt*(.6+sp*.09)){const k=R(.4,1)*(.2+sp*.03);S.vy+=k*R(.6,1.3);S.vp+=R(-1,1)*k*.35;S.vr+=R(-1,1)*k*.45;}
    if(PL.bump>S.pb+.02){const k=Math.min(3,(PL.bump-S.pb)*7);S.vy+=k*1.8;S.vp+=R(-.5,1)*k*.5;S.vr+=R(-1,1)*k*.6;}S.pb=PL.bump;
    S.vy+=(-55*S.y-4.5*S.vy)*dt;S.y+=S.vy*dt;S.vp+=(-70*S.p-5*S.vp)*dt;S.p+=S.vp*dt;S.vr+=(-60*S.r-4.5*S.vr)*dt;S.r+=S.vr*dt;
    S.y=clamp(S.y,-.15,.4);S.p=clamp(S.p,-.12,.12);S.r=clamp(S.r,-.14,.14);hero.position.y+=S.y;hero.rotation.x+=S.p;hero.rotation.z+=S.r;}
  for(const w of hero.wheels)w.rotation.y+=w.userData.dir*f*dt/.33;for(const k of hero.knuckles)k.rotation.y=clamp(delta*1.5+PL.steer*.06,-.5,.5);
  hero.tail.emissiveIntensity=brk?7:1.8;
  const onRoad=!offroad&&dt>0;
  if(onRoad&&PL.slip>4.2){for(const sx of[-1,1])addSkid(sx<0?0:1,PL.x+fz*sx*.76-fx*1.3,PL.z-fx*sx*.76-fz*1.3);
    if(PL.slip>6&&Math.random()<dt*24)puff(V.set(PL.x-fx*1.6+R(-.7,.7),.25,PL.z-fz*1.6+R(-.7,.7)),PL.vx*.25,R(.4,1.2),PL.vz*.25,.6,2.6,R(.5,1),.3,0xd8d6d0);}else endSkid();
  if(PL.wasThr&&!thr&&PL.rpm>6200){for(const sx of[-.2,.2]){V.set(sx,.24,M.zR-.35);hero.localToWorld(V);flame(V,PL.vx*.9,.4,PL.vz*.9,.25,.7,.14,0xffb060);}}PL.wasThr=thr;
  if(offroad&&v>8&&Math.random()<dt*30)puff(V.set(PL.x-fx*1.8,.3,PL.z-fz*1.8),R(-1,1),R(.5,2),R(-1,1),.8,3.5,R(.8,1.6),.4,wx.snow>.5?0xe8ecf0:0x9a8c6a);
  // exhaust: thick smoke that alternates black and white
  if(racing&&dt>0&&Math.random()<dt*(thr?26:v>4?9:2.5)){const wht=Math.floor(G.raceT*1.6)%2;V.set(Math.random()<.5?-.2:.2,.26,M.zR-.4);hero.localToWorld(V);for(let q=0;q<2;q++)puff(V,PL.vx*.6-fx*2+R(-.6,.6),R(.2,1),PL.vz*.6-fz*2+R(-.6,.6),.4,R(1.5,2.4),R(1,1.7),wht?.8:.95,wht?0xf0eee8:0x0e0d0c);}
  // now and then a small fire takes hold on the engine cover and burns itself out; it changes nothing about the driving
  if(racing){PL.fireT=(PL.fireT===undefined?R(14,26):PL.fireT)-dt;if(PL.fireT<-R(4.5,7))PL.fireT=R(22,45);
    if(PL.fireT<0&&Math.random()<dt*30){V.set(R(-.35,.35),.62+M.B[0]*.3,M.zR+R(.5,1.3));hero.localToWorld(V);flame(V,PL.vx*.96+R(-.3,.3),R(.8,2),PL.vz*.96+R(-.3,.3),R(.22,.4),R(.45,.8),R(.18,.4),Math.random()<.5?0xffa53a:0xff6a1e);
      if(Math.random()<.2)puff(V,PL.vx*.6,R(1,2),PL.vz*.6,.3,1.4,R(.6,1.1),.4,0x1c1a18);}}
  // overtaking
  if(racing&&G.raceT>5)for(const e of ents){if(e.player)continue;const d=pe.dist-e.dist;if(e.pd!==undefined&&e.pd<=0&&d>0&&d<30&&e.out<=0&&!e.car.wreck&&G.raceT>(PL.sayT||0)){PL.sayT=G.raceT+5;speak('So long, sucker!',1,.75);}e.pd=d;}
}
function aiUpdate(e,dt,pe){
  if(e.out>0){e.out-=dt;if(e.out<=0){const w=e.car.wreck;if(w){e.s=w.idx*SEG;endWreck(w);}e.car.visible=true;e.v=22;e.lat=0;}return;}
  const i=wrapI(Math.floor(e.s/SEG));let target=Math.min(vc[i]*e.skill*Math.sqrt(wx.grip*(MKEYS===CLASSICS?.78:1)),e.vmax);
  target*=clamp(1-(e.dist-pe.dist)/480,.35,1.15);                                                            // the field stays in touch: rivals ahead ease off, rivals behind push on
  for(const o of ents){if(o===e||(o.out>0&&!o.car.wreck))continue;const ds=wdiff(o.s-e.s);if(ds>0&&ds<16&&Math.abs(o.lat-e.lat)<2.3){target=Math.min(target,(o.car.wreck?0:o.v)+(ds-6)*.8);e.pass=(o.lat>e.lat?-1:1);}}
  e.pass*=Math.exp(-dt*.7);
  if(e.doom){e.lat+=e.doom*10*dt;e.v-=6*dt;if(Math.abs(e.lat)>8.7){crashAI(e,13,e.doom*10);return;}}
  else{const lt=clamp(line[i]*.85+e.off+e.pass*2.7,-(RW-1.6),RW-1.6);e.lat+=clamp(lt-e.lat,-2.4*dt,2.4*dt);}
  if(G.state==='finish'&&G.finT>2.6)target=0;
  e.braking=target<e.v-1;e.v+=(target>e.v?Math.min(accelOf(e.v,MODELS.k)*e.skill,10.5*wx.grip):-16*(.4+.6*wx.grip))*dt;if(e.v<0)e.v=0;
  const ds=e.v*dt;e.s=wrapS(e.s+ds);e.dist+=ds;
  if(wx.wet>.5&&e.v>25&&Math.random()<dt*7)puff(at(e.s-2.5,e.lat,.5,V),R(-1,1),R(1,2.5),R(-1,1),1,4.5,R(.6,1.1),.3,0xd0d6da);
}
// Bay drive: where the car goes back on the road after a crash or a fall - the spot where it happened (never further back), in the right-hand lane facing along the road,
// stepping forward only until it is clear of traffic, obstacles and the quake gap. The distance driven moves with it, so nothing along the way fires twice or gets skipped.
function backOnRoad(pe,j0,s0=pe.s){let j=wrapI(j0),lat=-(RW+XW[j])/2;
  for(let k=0;k<80;k++){const jj=wrapI(j0+k),l=-(RW+XW[jj])/2,s=jj*SEG;at(s,l,0,V);let ok=!(QK&&QK.st&&jj>=QK.a-2&&jj<=QK.b+4);
    if(ok)for(const t of TRAF)if(t.act&&!t.fall&&Math.abs(wdiff(t.s-s))<14&&Math.abs(t.lat-l)<2.8){ok=false;break;}
    if(ok)for(const o of OBST)if(o.r<30&&Math.hypot(o.x-V.x,o.z-V.z)<o.r+3){ok=false;break;}
    if(ok){j=jj;lat=l;break;}}
  pe.dist+=wdiff(j*SEG-s0);pe.s=j*SEG;pe.lat=lat;at(pe.s,lat,0,V);PL.idx=j;PL.x=V.x;PL.z=V.z;PL.h=G.camH=yaw(j);return j;}
function sim(dt){const pe=ents.find(e=>e.player);
  if(G.state==='race')G.raceT+=dt;
  if(!DRIVE&&G.state==='race'){turkeysTick(dt);oldManTick(dt,pe);leadTick(dt,pe);}
  if(G.state==='race')heatTick(dt,pe);
  if(G.state==='race'&&G.cam===1&&!PL.crash){PL.cough=(PL.cough??R(3,6))-dt;if(PL.cough<=0){PL.cough=R(6,13);sfxCough();}}   // the smoke gets to him
  if(PL.safe>0)PL.safe-=dt;
  playerUpdate(dt,pe);for(const e of ents)if(!e.player)aiUpdate(e,dt,pe);updateWrecks(dt);placeAll(dt);
  if(wx.wet>.5&&!PL.crash&&pe.v>20&&Math.random()<dt*26)puff(V.set(PL.x-Math.sin(PL.h)*2.6,.5,PL.z-Math.cos(PL.h)*2.6),R(-1.5,1.5),R(1,3),R(-1.5,1.5),1.2,5.5,R(.7,1.2),.34,0xd0d6da);
  if(PL.crash&&PL.crash.dive)diveTick(dt,pe);
  else if(PL.crash){const w=hero.wreck,still=!w||(Math.hypot(w.vx,w.vz)<1&&w.y<=0&&!w.wr);tubeFire(dt);const tb=PL.crash.tf>2.3;
    if(tb||PL.crash.t>4||(PL.crash.t>2.5&&still)){const wi=w?w.idx:PL.idx;   // Bay drive: back on the road at the spot where it crashed
      let i=PL.idx=wrapI(tb?Z.tu1+30:DRIVE?Math.floor(PL.crash.s/SEG)+Math.round(4/SEG):wi+35);if(w)endWreck(w);if(TUF.st){TUF.on=0;for(const o of TUF.st)o.visible=false;}
      if(DRIVE)i=backOnRoad(pe,i,PL.crash.s);else{pe.s=i*SEG;pe.lat=0;PL.x=P[i].x;PL.z=P[i].z;PL.h=G.camH=yaw(i);}PL.vx=PL.vz=0;PL.steer=0;PL.crash=null;sndRestore();PL.safe=3;resetVehicle(VS,hero.M.dyn,0);clearCrack();fqAfterReset();
      hero.position.set(PL.x,H[i],PL.z);hero.rotation.set(0,PL.h,0);GY=PL.gy=PL.cy=H[i];PL.air=0;PL.vy=0;say(DRIVE?'BACK ON THE ROAD':'BACK IN THE RACE','',1.5);}}
  if(G.state==='race'){G.doomT-=dt;if(G.doomT<=0){G.doomT=R(38,70);const c=ents.filter(e=>!e.player&&e.out<=0&&!e.doom&&wdiff(e.s-pe.s)>45&&wdiff(e.s-pe.s)<230&&e.v>35);if(c.length){const e=c[Math.random()*c.length|0];e.doom=Math.random()<.5?-1:1;}else G.doomT=6;}
    if(!DRIVE&&pe.dist>=LAPS*LEN){G.state='finish';G.finT=0;G.slow=.3;G.slowT=3.2;first=true;sfxCheer();say('DRAPEAU À DAMIER','P'+(standings().indexOf(pe)+1)+' · '+LAPS+' LAPS',4);announce("Le drapeau à damier ! Les vingt-quatre heures sont terminées !");}}
  driveHome(pe);if(G.state==='finish'&&DRIVE){VS.u*=Math.exp(-1.6*dt);VS.v*=Math.exp(-3*dt);}   // home: the car rolls to a stop at the kerb
  if(G.state==='finish'){if(Math.abs(pe.v)<.5&&!(PL.auto&&!PL.auto.fin))G.stopT+=dt;if(G.stopT>.6&&$('res').style.display!=='block')showResults();}
}
const fmt=t=>{const m=Math.floor(t/60),s=t-m*60;return m+':'+(s<10?'0':'')+s.toFixed(2);};
function standings(){return [...ents].sort((a,b)=>b.dist-a.dist);}
function showResults(){if(DRIVE){document.querySelector('#res h1').textContent='HOME';document.querySelector('#res .go').textContent='ENTER — DRIVE AGAIN';$('resList').innerHTML=`<div class="me">1611 SAN ANTONIO AVE, ALAMEDA</div><div>Round the bay: 34 km</div><div>Time: ${fmt(G.raceT)}</div>`;$('res').style.display='block';$('msg').innerHTML='';G.msgT=0;$('tl').classList.add('hide');return;}const st=standings();$('resList').innerHTML=st.map((e,i)=>`<div class="${e.player?'me':''}">${i+1}. &nbsp;No. ${e.num} &nbsp;${e.name} &nbsp;· ${(Math.max(e.dist,0)/1000).toFixed(2)} km</div>`).join('');$('res').style.display='block';$('msg').innerHTML='';G.msgT=0;$('tl').classList.add('hide');}

/* ================= TIME OF DAY ================= */
const cHZD=new THREE.Color(0xd6d4c6),cHZG=new THREE.Color(0xeaa468),cHZN=new THREE.Color(0x0b101c),cZND=new THREE.Color(0x6f98bd),cZNG=new THREE.Color(0x46568a),cZNN=new THREE.Color(0x04060d),cOG=new THREE.Color(0xa9aaa6),cT=new THREE.Color(),cSunLo=new THREE.Color(0xff8a4a),cSunHi=new THREE.Color(0xfff0d8),cMoon=new THREE.Color(0x8fa8d0),cHemiD=new THREE.Color(0xbcd3e2),cHemiN=new THREE.Color(0x2a3550),moonDir=new THREE.Vector3(.4,.7,.3).normalize();
let az0;{const t=T[125];az0=Math.atan2(t.z*.6+t.x*.7,t.x*.6-t.z*.7);}
let dayK=1;
const cMist=new THREE.Color();
function setTime(h,tm){
  const inDay=h>=5.5&&h<=21.5,el=inDay?Math.sin(Math.PI*(h-5.5)/16):-Math.sin(Math.PI*((h>21.5?h-21.5:h+2.5)/8))*.5;
  const alt=el*1.02,az=az0+(h-16)/24*Math.PI*2;sunDir.set(Math.cos(az)*Math.cos(alt),Math.sin(alt),Math.sin(az)*Math.cos(alt));
  const d=sst(el,-.12,.2),g=d*(1-sst(el,.08,.5))*(1-wx.cov*.6);dayK=d;
  const u=skyMat.uniforms;u.hz.value.copy(cHZD).lerp(cHZG,g).lerp(cOG,wx.cov*.8*(1-g*.5)).lerp(cHZN,1-d);u.zn.value.copy(cZND).lerp(cZNG,g).lerp(cOG,wx.cov*.55).lerp(cZNN,1-d);
  u.night.value=1-d;u.cov.value=wx.cov;u.dayk.value=d;u.dk.value=DRIVE?clamp((wx.cov-.4)*1.6,0,.85):0;
  scene.fog.color.copy(u.hz.value).multiplyScalar(lerp(1,.86,wx.cov));scene.fog.near=wx.fn;scene.fog.far=wx.ff;
  if(DRIVE&&G.tun>.05&&PL.idx>Z.tu0-60&&PL.idx<Z.tu1+60){const k=G.tun*.85;scene.fog.near=lerp(scene.fog.near,5,k);scene.fog.far=lerp(scene.fog.far,130,k);}   // the drum fires fill the Posey Tube with smoke
  if(DRIVE&&G.mist){const u=G.raceT;if(u>21)G.mist=0;const k=G.mist?1-sst(u,15,21):0;   /* morning fog at the driveway at 1611; it lifts about ten seconds after the car has backed out (the reverse-out takes ~7 s) */
    if(k>0){scene.fog.color.lerp(cMist.setRGB(.86,.88,.9).multiplyScalar(.3+.7*dayK),k*.9);scene.fog.near=lerp(scene.fog.near,3,k);scene.fog.far=lerp(scene.fog.far,110,k);}}
  if(el>.02){sun.color.copy(cSunLo).lerp(cSunHi,sst(el,0,.45));sun.intensity=3.5*sst(el,.02,.22)*wx.sunK;V.copy(sunDir);}
  else{sun.color.copy(cMoon);sun.intensity=.32*sst(-el,0,.12)*(1-wx.cov*.6);V.copy(moonDir);}
  sun.target.position.copy(hero.position);sun.position.copy(hero.position).addScaledVector(V,200);
  hemi.intensity=lerp(.34,1.1,d)*lerp(1,.82,wx.cov);hemi.color.copy(cHemiN).lerp(cHemiD,d);
  if(DRIVE&&G.gold>.01){const k=G.gold*d;u.hz.value.lerp(cGLD[0],k*.75);u.zn.value.lerp(cGLD[1],k*.45);scene.fog.color.lerp(cGLD[2],k*.6);hemi.color.lerp(cGLD[2],k*.35);if(el>.02){sun.color.lerp(cGLD[3],k);sun.intensity*=1+.3*k;}}   // the golden glow over the bay
  if(LT.flash>.01){hemi.intensity+=LT.flash*1.5;scene.fog.color.lerp(cT.setRGB(.8,.85,1),LT.flash*.3);}u.fl.value=LT.flash;
  if(DRIVE){const b=G.brg,tn=G.tun;   // the bridge sits in thick bay fog whatever the weather; the tube is lit only by its own lamps
    scene.fog.near=lerp(scene.fog.near,10,b);scene.fog.far=lerp(scene.fog.far,200,b);u.cov.value=lerp(wx.cov,1,b);scene.fog.color.lerp(cT.setRGB(.6,.63,.66).multiplyScalar(lerp(.1,1,d)),b*.85);sun.intensity*=(1-b*.65)*(1-tn);
    hemi.intensity*=lerp(1,.2,tn);if(tn>.01){scene.fog.color.lerp(cT.setRGB(.07,.05,.025),tn*.95);scene.fog.near=lerp(scene.fog.near,60,tn);scene.fog.far=lerp(scene.fog.far,700,tn);}
    hills.material.opacity=1-b*.94;tunL.intensity=tn*38;tunL.position.set(hero.position.x,3.4,hero.position.z);
    {const pz=PL.idx>Z.tu0-30&&PL.idx<Z.tu1+30,F=TFL;tunL.color.setHex(pz?0x9fc4ff:0xffc27a);   // the Posey Tube: cold blue light that flickers, now and then dies for a moment, and now and then flashes white
      if(pz){const t=performance.now()/1000;F.cd-=1/60;if(F.cd<=0){F.cd=R(.6,2.6);F.kind=Math.random()<.35?2:1;F.t=0;F.T=F.kind===2?R(.06,.14):R(.15,.6);}F.t+=1/60;
        let k=.82+.12*Math.sin(t*41)*Math.sin(t*7.3)+.06*(Math.random()-.5);if(F.t<F.T){if(F.kind===1)k*=Math.random()<.5?.08:.4;else{k=2.6;tunL.color.setHex(0xe8f0ff);}}
        tunL.intensity=tn*38*k;tunLampB.color.setRGB(.8*k,1.15*k,1.8*Math.min(k,1.6));if(F.kind===2&&F.t<F.T)hemi.intensity+=tn*.6;}}for(const m of cityMats)m.emissiveIntensity=(1-d)*1.6;}
  renderer.toneMappingExposure=lerp(.95,1.16,d)*(1-.5*Math.min(1,(G.qd||0)*2.5));shadeMat.opacity=.44*d;   // (an earthquake darkens everything for a while)
  if(tm-envT>4){envT=tm;const old=scene.environment;scene.environment=pmr.fromScene(es).texture;if(old)old.dispose();}
  scene.environmentIntensity=lerp(.14,.8,d)*(1-G.tun*.85);
  const lights=clamp(1-d+wx.wet*.5+wx.snow*.3,0,1);
  for(const e of ents){e.car.bodyMat.emissiveIntensity=3+lights*10;e.car.glow.opacity=lights*.3;e.car.pool.opacity=(1-d)*.3;}
  if(spot)spot.intensity=(1-d)*1500;lampMat.emissiveIntensity=(1-d)*6;POOLM.opacity=(1-d)*.4;POOLM.visible=d<.98;
  hills.material.color.setScalar(lerp(.07,1,d)*lerp(1,.8,wx.cov));
  // surfaces react to weather
  const sn=wx.snow*lerp(.12,1,d);roadMat.roughness=lerp(.72,.2,wx.wet);roadMat.color.setScalar(lerp(1,.6,wx.wet));roadMat.emissive.setScalar(sn*.36);
  groundMat.emissive.setScalar(sn*.8);for(const m of LANDM)m.emissive.setScalar(sn*.8);dirtMat.emissive.setScalar(sn*.7);leafMat.emissive.setScalar(sn*.3);tuftMat.emissive.setScalar(sn*.6);
}
function updateWeather(rdt){const t=WX[G.weather],k=clamp(rdt*.9,0,1);for(const p of['grip','sunK','cov','fn','ff','wet','snow'])wx[p]=lerp(wx[p],t[p],k);
  if(DRIVE&&G.weather==='overcast'){const s=Math.sin(G.t*.021)+.6*Math.sin(G.t*.0137+1.7),dark=sst(s,.75,1.35),s2=Math.sin(G.t*.0127+4.1)+.55*Math.sin(G.t*.029+.4),sunny=sst(s2,.65,1.25)*(1-dark);wx.cov=lerp(wx.cov,t.cov+.36*dark-.42*sunny,k);wx.sunK=lerp(wx.sunK,t.sunK*(1+.3*sunny),k);}   /* and, on a slower cycle of its own, the cloud thins and the sun breaks through */
  if(DRIVE){const i=PL.idx,on=i>=Z.gg1+Math.round(150/SEG)&&i<Z.rb0+Math.round(500/SEG);G.sqs=lerp(G.sqs||0,on?1:0,clamp(rdt*.35,0,1));const q=G.sqs;   // the road to San Quentin is always under a dark grey sky
    if(q>.01){wx.cov=lerp(wx.cov,Math.max(wx.cov,1.15),q);wx.sunK=lerp(wx.sunK,Math.min(wx.sunK,.3),q);wx.fn=lerp(wx.fn,Math.min(wx.fn,70),q*.7);wx.ff=lerp(wx.ff,Math.min(wx.ff,1300),q*.7);}}
  if(DRIVE){const i=PL.idx,on=i>=Z.i80-Math.round(250/SEG)&&i<Z.wt1-Math.round(120/SEG);G.i8=lerp(G.i8||0,on?1:0,clamp(rdt*.35,0,1));const q=G.i8;   // over the bay on I-80 the sky keeps changing: dark storm clouds with the sun breaking through, then a golden evening glow, and back
    const c=Math.sin(G.t*.07+.6)+.35*Math.sin(G.t*.023),st=sst(c,-.15,.45),gd=(1-sst(c,-.55,-.1))*(1-sst(wx.wet+wx.snow,.2,.6));G.i8s=q*st;G.gold=q*gd;
    if(q>.01){wx.cov=lerp(wx.cov,Math.max(wx.cov,1.12),q*st);wx.sunK=lerp(wx.sunK,Math.min(wx.sunK,.45),q*st);wx.ff=lerp(wx.ff,Math.min(wx.ff,1500),q*st*.6);
      wx.cov=lerp(wx.cov,Math.min(wx.cov,.42),q*gd);wx.sunK=lerp(wx.sunK,Math.max(wx.sunK,1.25),q*gd);wx.ff=lerp(wx.ff,Math.max(wx.ff,2300),q*gd);}}
  if(G.qd>0){G.qd=Math.max(0,G.qd-rdt/45);const q=Math.min(1,G.qd*2.5);wx.cov=Math.max(wx.cov,lerp(wx.cov,1.25,q));wx.fn=lerp(wx.fn,40,q);wx.ff=lerp(wx.ff,900,q);}}   // an earthquake turns the sky black almost at once, and it clears over the next minute or so

await BOOT.step('LOADING THE FILM',.92);
/* ================= POST ================= */
const rt=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:4});
const composer=new EffectComposer(renderer,rt);
composer.addPass(new RenderPass(scene,camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.3,.7,.92));
composer.addPass(new OutputPass());
// grade: muted 1970 print — soft contrast, olive greens, cool shadows, cream highlights, grain
const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},time:{value:0},res:{value:new THREE.Vector2(innerWidth,innerHeight)}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform sampler2D tDiffuse;uniform float time;uniform vec2 res;varying vec2 vUv;
   float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
   void main(){vec2 d=vUv-.5;float r2=dot(d,d);vec2 o=d*.012*r2;
   vec3 c=vec3(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b);
   vec3 st=vec3(0.);for(int i=-14;i<=14;i++){vec3 t=texture2D(tDiffuse,vUv+vec2(float(i)*.006,0.)).rgb;float w=1.-abs(float(i))/15.;st+=max(t-.93,0.)*w;}
   c+=st*vec3(.45,.6,1.)*.9;
   float l=dot(c,vec3(.299,.587,.114));
   c=mix(vec3(l),c,.84);
   c.g=mix(c.g,(c.r+c.g)*.5,.12);
   c=mix(c,c*c*(3.-2.*c),.34);
   c=c*.9+.055;
   c+=(1.-l)*vec3(-.006,.012,.03);c+=l*vec3(.036,.022,-.03);
   c*=1.-r2*.95;
   c+=(hash(vUv*res+fract(time)*91.7)-.5)*.065;
   gl_FragColor=vec4(c,1.);}`});
composer.addPass(grade);

await BOOT.step('DASHBOARD AND CONTROLS',.93);
/* ================= UI + INPUT ================= */
function refreshTitle(){const M=MODELS[G.model],W=WX[G.weather];$('oCls').textContent=M.cls?'CLASSIC CARS':'RACING CARS';$('oModel').textContent=`${M.name} · ${M.year}`;$('oDesc').textContent=`${M.desc} Top speed ${Math.round(M.top*3.6)} km/h.`;$('oWx').textContent=W.name;$('oWxD').textContent=W.d;$('wxl').textContent=W.name;$('oLiv').textContent=LIV().name;$('oLivD').textContent=LIV().d;$('oSens').textContent=Math.round(G.sens*100)+'%';}
function startRace(){clearCrack();initAudio();if(AC&&AC.state==='suspended')AC.resume();window.focus();$('title').classList.add('hide');$('res').style.display='none';for(const id of['tl','tr','br','lf','map','bl'])$(id).classList.remove('hide');
  seed=7+Math.random()*1000|0;setupGrid();hero.visible=true;G.state='count';G.t=0;G.count=4;PL.lapStart=0;first=true;}
// ---- free drive: start, zone-by-zone atmosphere, and the bridge's horns and gulls
const ZLABEL={town:'ALAMEDA',tunnel:'THE TUBE',freeway:'FREEWAY',bridge:'BAY BRIDGE',city:'THE CITY',return:'SHORE ROAD',forest:'MARIN',hills:'RICHMOND',race:''},DA={horn:4,gull:2,zn:''};
// where you are, by name, all the way round: [first point, name on the dashboard, line under it when you arrive]
const PLACES=DRIVE?(()=>{const m=x=>Math.round(x/SEG);return[[0,'SAN ANTONIO AVE','ALAMEDA'],[Z.central,'CENTRAL AVE','PAST THE ALAMEDA THEATRE'],[Z.wilma,'WILMA CHAN WAY','TO THE POSEY TUBE'],[Z.tu0,'POSEY TUBE','UNDER THE ESTUARY'],
  [Z.tu1,'I-880 NORTH','THE PORT OF OAKLAND'],[Z.toll,'TOLL PLAZA','BAY BRIDGE'],[Z.b0,'BAY BRIDGE','TO SAN FRANCISCO'],[Z.b1,'SAN FRANCISCO','DOWNTOWN'],[Z.hyde,'HYDE ST','THE CABLE CAR LINE · RUSSIAN HILL'],[Z.marina+m(40),'MARINA BLVD','WEST TO THE GOLDEN GATE'],
  [Z.gg0,'GOLDEN GATE BRIDGE','NORTH TO MARIN'],[Z.gg1,'MARIN','THE REDWOODS'],[Z.sq,'SAN QUENTIN','EAST TO THE BRIDGE'],[Z.rb0,'RICHMOND–SAN RAFAEL BRIDGE',''],[Z.rb1,'RICHMOND','WATCH FOR TURKEYS'],[Z.shane-m(160),'SHANE DR','RICHMOND'],
  [Z.i80,'I-80 SOUTH','BERKELEY HILLS ON THE LEFT'],[Z.berkeley,'BERKELEY','THE UNIVERSITY UP THE HILL'],[Z.emeryville,'EMERYVILLE',''],[Z.oakland,'OAKLAND','NEXT EXIT ALAMEDA'],[Z.wt1,'WEBSTER TUBE','BACK UNDER THE ESTUARY'],[Z.wt0,'ALAMEDA','HOME TO SAN ANTONIO AVE'],[Z.wt0+m(390),'BUENA VISTA AVE','ALAMEDA'],[Z.bv,'GRAND ST','SOUTH TO SAN ANTONIO'],[NS-m(240),'SAN ANTONIO AVE','ALMOST HOME · 1611 ON THE RIGHT']];})():[];
const placeOf=i=>{let p=PLACES[0];for(const q of PLACES)if(i>=q[0])p=q;return p;};
const tmNow=()=>performance.now()/1000;
function startDrive(){clearCrack();fqArm();initAudio();if(AC&&AC.state==='suspended')AC.resume();window.focus();$('title').classList.add('hide');$('res').style.display='none';for(const id of['tl','br','lf','map','bl'])$(id).classList.remove('hide');
  setupGrid();hero.visible=true;ANN.on=false;G.state='race';first=true;PL.lapStart=0;const J=JUMPS[JUMP];if(J)jumpTo(J[0]);else homeStart();DA.zn=placeOf(PL.idx)[1];
  if(J)say(J[1],J[2],4);else say('1611 SAN ANTONIO AVE','ALAMEDA · BACKING OUT OF THE DRIVEWAY · AROUND THE BAY AND HOME',4);}
// Jump points: the Alameda drive can start partway round instead of at the house (chosen on the home screen, ?from=bb|sf|gg|i80). The car sits stopped in the right-hand lane,
// and the distance already "driven" is counted from the house, so getting home still finishes the drive.
const JUMPS=DRIVE?{bb:[Z.b0-Math.round(200/SEG),'BAY BRIDGE','THE TOLL PLAZA BEHIND YOU · WEST TO SAN FRANCISCO'],sf:[Z.b1,'SAN FRANCISCO','OFF THE BAY BRIDGE · DOWNTOWN'],
  gg:[Z.gg0-Math.round(250/SEG),'GOLDEN GATE BRIDGE','NORTH TO MARIN'],i80:[Z.i80,'I-80 SOUTH','BERKELEY, EMERYVILLE, OAKLAND · THEN HOME'],i880:[Z.tu1+20,'I-880 NORTH','OUT OF THE TUBE · OAKLAND AND THE PORT'],marin:[Z.gg1+20,'MARIN','THE REDWOODS · NORTH OF THE GOLDEN GATE']}:{};
const JUMPN={'':'THE HOUSE',bb:'THE BAY BRIDGE',sf:'SAN FRANCISCO',gg:'THE GOLDEN GATE',i80:'I-80',i880:'I-880',marin:'MARIN'};
let JUMP=JUMPS[QS.get('from')]?QS.get('from'):'';
function jumpTo(j){j=wrapI(j);PL.auto=null;G.mist=0;const pe=ents.find(e=>e.player),lat=-(RW+XW[j])/2;pe.s=j*SEG;pe.lat=lat;pe.v=0;pe.dist=wrapI(j-START_I)*SEG;at(pe.s,lat,0,V);
  PL.x=V.x;PL.z=V.z;PL.idx=j;PL.h=G.camH=yaw(j);PL.vx=PL.vz=0;PL.cy=PL.gy=H[j];PL.air=0;PL.vy=0;PL.steer=0;resetVehicle(VS,hero.M.dyn,0);placeAll(0);first=true;}
// Town streets: dead leaves, and now and then a bit of litter, blown about by a gusty wind and thrown up by the car as it passes.
let LV=null;if(DRIVE){const N=110,m=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({side:THREE.DoubleSide,roughness:.9}),N),c=new THREE.Color(),p=[];m.frustumCulled=false;
  for(let i=0;i<N;i++){const lit=i%8===0,big=lit&&i%16===0;p.push({x:1e9,z:1e9,y:0,vx:0,vy:0,vz:0,a:R(0,6),b:R(0,6),s:lit?(big?R(.3,.42):R(.14,.2)):R(.1,.2),asp:lit?(big?1.35:1.8):R(.55,.8),lit});
    m.setColorAt(i,c.setHex(lit?(big?[0xf2efe6,0xe6e0cc,0xd9d4c4][i%3]:[0xc8302a,0x2a6a9a,0xd8d8d8][i%3]):[0xb5651d,0xd98a2b,0x8a5a22,0xc9b23a,0x7a6a2a,0xa8421e][i%6]));M4.makeScale(0,0,0);m.setMatrixAt(i,M4);}
  scene.add(m);LV={m,p,t:0};}
function leavesTick(rdt,on){if(!LV)return;LV.t+=rdt;const fx=Math.sin(PL.h),fz=Math.cos(PL.h),sp=Math.hypot(PL.vx,PL.vz),gust=Math.max(0,1.5+1.5*Math.sin(LV.t*.55)+.9*Math.sin(LV.t*1.9+1));
  LV.p.forEach((p,i)=>{let dx=p.x-PL.x,dz=p.z-PL.z,d2=dx*dx+dz*dz;
    if(d2>55*55){if(!on){M4.makeScale(0,0,0);LV.m.setMatrixAt(i,M4);return;}const a=R(6,50),b=R(-14,14);p.x=PL.x+fx*a+fz*b;p.z=PL.z+fz*a-fx*b;p.y=Math.random()<.3?R(.3,3.2):.04;p.vx=p.vy=p.vz=0;dx=p.x-PL.x;dz=p.z-PL.z;d2=dx*dx+dz*dz;}
    const gr=p.y<=.045,k=gr?(gust>2.3?.7:.04):1;p.vx+=(.8*gust*1.7*k-p.vx)*Math.min(1,rdt*2.2);p.vz+=(.6*gust*1.7*k-p.vz)*Math.min(1,rdt*2.2);
    if(d2<40&&sp>6){const d=Math.sqrt(d2)+.4,w=sp*rdt*7/(1+d2*.25);p.vx+=(dx/d*.6+PL.vx/sp*.5)*w;p.vz+=(dz/d*.6+PL.vz/sp*.5)*w;p.vy+=w*.55;}   // the car's wake
    if(gr&&gust>2.5&&Math.random()<rdt*.9)p.vy=R(.8,2.4);
    if(!gr||p.vy>0){p.vy-=(p.lit?3.4:2.6)*rdt;p.vy+=Math.sin(LV.t*5+i)*rdt*1.6;p.vy*=Math.exp(-1.2*rdt);p.a+=(2.5+Math.hypot(p.vx,p.vz))*rdt;p.b+=(1.5+i%3)*rdt;}
    p.x+=p.vx*rdt;p.y+=p.vy*rdt;p.z+=p.vz*rdt;if(p.y<.04){p.y=.04;p.vy=0;}else if(gr)p.b+=Math.hypot(p.vx,p.vz)*rdt*2;
    E.set(p.y<=.045?-Math.PI/2:p.a,p.b,0,'YXZ');M4.compose(V.set(p.x,p.y+H[wrapI(PL.idx+Math.round((dx*fx+dz*fz)/SEG))],p.z),Q.setFromEuler(E),S.set(p.s,p.s*p.asp,1));LV.m.setMatrixAt(i,M4);});
  LV.m.instanceMatrix.needsUpdate=true;}
// Smoker's cough, heard from the driver's seat.
function sfxCough(){if(!AC)return;let t=AC.currentTime+.02;const n=2+(Math.random()*3|0);for(let i=0;i<n;i++){const v=i?R(.7,1):1.15;hit(t,.19,2.6*v,R(650,1050),'bandpass',master);hit(t,.1,1.6*v,2700,'bandpass',master);tone('sawtooth',R(140,185),t,.17,1.2*v,master,{to:85,a:.005,h:.3,lp:900});t+=R(.24,.36);}}
// A faint jazz station on the car radio in Alameda: walking bass, ride cymbal, piano stabs and a wandering horn, with a mellow announcer now and then.
const JZ={next:0,beat:0,say:R(16,28),bus:null},JCH=[[38,[62,65,69,72]],[43,[59,62,65,69]],[36,[60,64,67,71]],[45,[61,64,67,70]]],mf=m=>440*Math.pow(2,(m-69)/12);
const RADIO=["You're listening to Radio Alameda. Smooth jazz for the East Bay.","That was the quartet, recorded live. Stay cool out there.","It's a foggy one on the bay tonight. Drive easy.","Radio Alameda. Jazz, all night long.","Coming up, more music, and no news whatsoever."];
function radioSay(){try{if(!window.speechSynthesis||speechSynthesis.speaking||G.paused)return;const u=new SpeechSynthesisUtterance(RADIO[Math.random()*RADIO.length|0]);u.rate=.78;u.pitch=.5;u.volume=.85;const v=speechSynthesis.getVoices().find(v=>/^en/i.test(v.lang));if(v){u.voice=v;u.lang=v.lang;}speechSynthesis.speak(u);}catch(e){}}
// The car radio in Alameda is the real thing now: KCSM, live from San Mateo (jazz). It plays for the whole drive, from backing out of the driveway; paused with the game.
const KCSM='https://ice5.securenetsystems.net/KCSM';let radioEl=null,radioT=0,radioOn=false;   // the radio is switched off for now (owner 2026-11-21): no stream, no choice at the start, no Y key; birds and wind instead
// the choice offered while backing out of the driveway: a list so other stations can be added (number keys; Y toggles later). With the radio off only birds and wind play (there are no sirens in this bed).
const RADIO_OPTS=[{k:'Digit1',name:'KCSM 91.1 · JAZZ',on:true},{k:'Digit2',name:'RADIO OFF',on:false}],RPICK={on:false,t:0,last:true},AMB={t:1,w:2};
function radioPick(o){RPICK.on=false;radioOn=o.on;try{localStorage.setItem('vqh-radio',o.on?'1':'0');}catch(e){}say(o.name,o.on?'':'BIRDS AND WIND',1.6);}
function ambTick(rdt,on){if(!AC||!on||radioOn||G.paused||G.tun>.5)return;const t=AC.currentTime;AMB.t-=rdt;AMB.w-=rdt;
  if(AMB.t<=0){AMB.t=R(.8,4);const n=2+(Math.random()*4|0),f=R(2600,4600);let u=t;for(let i=0;i<n;i++){tone('sine',f*R(.9,1.15),u,.09,.03,master,{to:f*R(1.1,1.5),a:.01,h:.4});u+=R(.08,.14);}}   // a bird's twitter
  if(AMB.w<=0){AMB.w=R(3,7);hit(t,R(2.5,4),.05,R(350,700),'bandpass',master);}}   // a soft gust
function jazzTick(rdt,on){if(RPICK.on){RPICK.t-=rdt;if(RPICK.t<=0){RPICK.on=false;radioOn=RPICK.last;}}ambTick(rdt,on&&!RPICK.on);if(RPICK.on)on=false;if(!on||!radioOn){if(radioEl&&!radioEl.paused)radioEl.pause();return;}if(!radioEl){radioEl=new Audio();radioEl.preload='none';}radioEl.volume=G.tun>.5?.35:.55;
  if(radioEl.paused){radioT-=rdt;if(radioT<=0){radioT=5;radioEl.src=KCSM+'?t='+Date.now();radioEl.play().catch(()=>{});}}}
function jazzSynth(rdt,on){if(!AC)return;if(!JZ.bus){const g=AC.createGain(),f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=1100;f.Q.value=.6;g.gain.value=0;g.connect(f);f.connect(master);JZ.bus=g;}
  JZ.bus.gain.setTargetAtTime(on?(G.cam===1?1.15:.85):0,AC.currentTime,.6);if(!on)return;
  const B=60/126;if(JZ.next<AC.currentTime)JZ.next=AC.currentTime+.05;
  while(JZ.next<AC.currentTime+.3){const t=JZ.next,b=JZ.beat++,bar=Math.floor(b/4)%4,[root,ch]=JCH[bar],k=b%4,bn=[root,ch[1]-24,ch[2]-24,JCH[(bar+1)%4][0]+1][k];
    tone('triangle',mf(bn),t,B*.9,.5,JZ.bus,{a:.01,h:.6,lp:500});hit(t,.06,.12,8000,'highpass',JZ.bus);if(k%2)hit(t+B*.66,.04,.08,8000,'highpass',JZ.bus);
    if(k===1||(k===3&&Math.random()<.5)){const o=Math.random()<.5?B*.66:0;for(const m of ch)tone('triangle',mf(m),t+o,B*.5,.1,JZ.bus,{a:.01,h:.4});}
    if(Math.random()<.45){const sc=[62,64,65,67,69,72,74,76];tone('sawtooth',mf(sc[Math.random()*sc.length|0]+12),t+(Math.random()<.5?0:B*.66),B*R(.4,1.3),.13,JZ.bus,{a:.03,h:.6,lp:1500});}
    JZ.next+=B;}
  JZ.say-=rdt;if(JZ.say<=0){JZ.say=R(40,70);radioSay();}}
// Wild turkeys wander the avenue in small groups. Hit one and it goes up in a cloud of feathers, gobbling; now and then one keeps going and flies off.
function sfxGobble(){if(!AC)return;let t=AC.currentTime;const n=8+(Math.random()*5|0);for(let i=0;i<n;i++){const f=R(540,660)-i*20;tone('sawtooth',f,t,.075,.6,master,{to:f*.68,a:.005,h:.3,lp:2400,ft:'bandpass',q:4});t+=.056+i*.004;}}
const TK=[];
{const bm=std({color:0x3a2a1e,roughness:.9}),fm=std({color:0x6a4426,roughness:.9,side:THREE.DoubleSide}),rm=std({color:0xc02a20,roughness:.7}),hm=std({color:0x8fa3b0,roughness:.8}),lm=std({color:0x8a6a4a});
  const mk=()=>{const g=new THREE.Group(),A=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
    A(new THREE.SphereGeometry(.3,10,8),bm,0,.55,0).scale.set(.85,.9,1.2);A(new THREE.CircleGeometry(.52,12,0,Math.PI),fm,0,.6,-.32).rotation.x=-.35;A(cyl(.045,.06,.4,6),hm,0,.9,.3).rotation.x=.3;A(new THREE.SphereGeometry(.075,8,6),hm,0,1.1,.38);
    A(new THREE.SphereGeometry(.045,6,5),rm,0,1,.44).scale.y=1.8;A(new THREE.ConeGeometry(.025,.09,5),lm,0,1.1,.47).rotation.x=Math.PI/2;for(const s of[-1,1])A(cyl(.02,.02,.32,5),lm,s*.1,.16,0);
    g.w=[1,-1].map(s=>{const p=new THREE.Group();p.position.set(s*.2,.66,0);const w=new THREE.Mesh(new THREE.PlaneGeometry(.62,.42).rotateX(-Math.PI/2),fm);w.position.x=s*.31;p.add(w);g.add(p);return p;});g.scale.setScalar(1.25);scene.add(g);return g;};
  const tm_=x=>Math.round(x/SEG);   // free drive: a few flocks in Alameda, and Richmond is overrun with them
  for(const ci of DRIVE?[Z.start+tm_(150),Z.central+tm_(120),Z.central+tm_(420),Z.bv+tm_(400),Z.rb1+tm_(120),Z.richmond+tm_(120),Z.shane-tm_(200),Z.shane-tm_(60),Z.shane+tm_(80),Z.shane+tm_(220),Z.shane+tm_(380),Z.refinery-tm_(400),Z.refinery-tm_(220)]:[Math.floor(NS*.27),Math.floor(NS*.52),Math.floor(NS*.78)])for(let k=0;k<4;k++)TK.push({m:mk(),ci,lat:R(-11,11),ds:R(-9,9),tl:R(-11,11),td:R(-9,9),tt:R(1,5),st:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,h:R(0,6),sp:0});}
// newspapers in the tubes: loose sheets that skitter along the floor in the draught, tumble in the air, and are flung up behind a passing car. A small pool, kept ahead of the player.
let PAPERS=null;
function papersTick(rdt){const inT=zoneArr[PL.idx]===2;if(!PAPERS){if(!inT)return;
    const tx=canvas(256,180,(g,w,h)=>{g.fillStyle='#e9e4d4';g.fillRect(0,0,w,h);g.fillStyle='#1c1c1c';g.font='900 26px Georgia,serif';g.textAlign='center';g.fillText('THE ISLAND TIMES',w/2,28);g.fillRect(10,36,w-20,2);
      g.font='900 19px Georgia,serif';g.fillText('BRIDGE QUAKE: LANES LOST',w/2,60,w-20);g.fillStyle='#8a8a84';g.fillRect(14,72,100,60);for(let c=0;c<3;c++)for(let y=72+(c?0:68);y<h-8;y+=7)g.fillRect(c?122+(c-1)*66:14,y,c?58:100,3);});
    const mm=std({map:tx,side:THREE.DoubleSide,roughness:.9,emissiveMap:tx,emissive:0xfff2d8,emissiveIntensity:.35}),geo=new THREE.PlaneGeometry(.95,.66,3,1);PAPERS=[];   // fewer sheets than before
    for(let k=0;k<6;k++){const m=new THREE.Mesh(geo,mm);m.castShadow=false;m.visible=false;scene.add(m);PAPERS.push({m,s:0,lat:0,y:0,vs:0,vl:0,vy:0,sp:new THREE.Vector3(),live:false});}}
  const pe=ents.find(e=>e.player),v=Math.hypot(PL.vx,PL.vz);
  for(const p of PAPERS){if(!inT){p.live=false;p.m.visible=false;continue;}
    const ds=wdiff(p.s-pe.s);if(!p.live||ds<-40||ds>170){const s=wrapS(pe.s+(p.live?R(90,165):R(-10,150))),i=wrapI(Math.floor(s/SEG));if(zoneArr[i]!==2){p.live=false;p.m.visible=false;continue;}
      p.live=true;p.s=s;p.lat=R(-RW,RW);p.y=Math.random()<.6?.04:R(.2,2);p.vs=R(-2.5,-.5);p.vl=R(-.6,.6);p.vy=0;p.sp.set(R(-3,3),R(-4,4),R(-3,3));p.m.rotation.set(-Math.PI/2,0,R(0,6.3));p.m.visible=true;}
    // the car's wake: close behind or beside a fast car, a sheet is thrown up and dragged along
    const dl=p.lat-pe.lat;if(Math.abs(ds)<5&&Math.abs(dl)<3&&v>10){p.vy=Math.max(p.vy,R(2.5,5)*Math.min(1,v/40));p.vs+=v*R(.25,.45);p.vl+=Math.sign(dl||1)*R(1,3);p.sp.set(R(-9,9),R(-12,12),R(-9,9));}
    p.vy-=3.2*rdt;p.y+=p.vy*rdt;const air=p.y>.05;if(!air){p.y=.04;p.vy=0;p.vs+=(-1.2-p.vs)*clamp(rdt*1.5,0,1);p.vl*=1-clamp(rdt*2,0,1);p.sp.multiplyScalar(1-clamp(rdt*4,0,1));}   // on the floor: slides with the draught
    else{p.vy=Math.max(p.vy,-1.1);p.vs+=(-1.5-p.vs)*clamp(rdt*.4,0,1);}                                                                                                                       // in the air: falls slowly, flutters
    p.s=wrapS(p.s+p.vs*rdt);p.lat=clamp(p.lat+p.vl*rdt,-RW-1,RW+1);at(p.s,p.lat,p.y,p.m.position);
    if(air){p.m.rotation.x+=p.sp.x*rdt;p.m.rotation.y+=p.sp.y*rdt;p.m.rotation.z+=p.sp.z*rdt+Math.sin(tmNow()*7+p.s)*rdt*2;}else{p.m.rotation.x+=(-Math.PI/2-p.m.rotation.x)*clamp(rdt*6,0,1);p.m.rotation.y*=.9;p.m.rotation.z+=p.vs*rdt*.3;}}}
// on I-880, now and then, a mother duck leads her ducklings across all the lanes. Traffic stops for them; drive through and they scatter, flapping, unhurt.
const DUCK={st:0,t:45,s:0,lat:0,dir:1,birds:null};
function sfxQuack(n=1){if(!AC)return;let t=AC.currentTime;for(let k=0;k<n;k++){const f=R(380,460);tone('square',f,t,.13,.05,master,{to:f*.8,a:.006,h:.3,lp:1400,ft:'bandpass',q:2});t+=R(.16,.3);}}
function ducksTick(rdt){const i0=PL.idx,on=zoneArr[i0]===3&&i0>Z.tu1+60&&i0<Z.detour-150,pe=ents.find(e=>e.player);
  if(!DUCK.birds){const brown=std({color:0x7a5a3a,roughness:.85}),dk=std({color:0x4a3624,roughness:.85}),fuzz=std({color:0xc8a84a,roughness:1}),fz2=std({color:0x5a4a2a,roughness:1}),bill=std({color:0xd08a2a,roughness:.6});
    DUCK.birds=[0,1,2,3,4,5,6,7,8,9,10,11,12,13].map(k=>{const mom=!k,s=mom?1:.5,g=new THREE.Group(),bm=mom?brown:(k%2?fuzz:fz2);
      const b=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),bm);b.scale.set(.85,.7,1.35);b.position.y=.2;g.add(b);const hd=new THREE.Mesh(new THREE.SphereGeometry(.1,8,6),mom?dk:bm);hd.position.set(0,.42,.2);g.add(hd);
      const bl=new THREE.Mesh(new THREE.BoxGeometry(.07,.025,.12),bill);bl.position.set(0,.4,.32);g.add(bl);const tl=new THREE.Mesh(new THREE.ConeGeometry(.07,.16,5),bm);tl.rotation.x=-1.9;tl.position.set(0,.26,-.28);g.add(tl);
      for(const sd of[-1,1]){const w=new THREE.Mesh(new THREE.BoxGeometry(.03,.14,.3),mom?dk:bm);w.position.set(sd*.17,.24,-.02);g.add(w);}
      g.scale.setScalar(s*1.15);g.visible=false;scene.add(g);return{g,k,ph:R(0,6),fly:null};});}
  if(DUCK.st===0){if(!on||G.state!=='race')return;DUCK.t-=rdt;if(DUCK.t>0||pe.v<12)return;
    const s=wrapS(pe.s+pe.v*4.5+60),i=wrapI(Math.floor(s/SEG));if(zoneArr[i]!==3||i>Z.detour-120){DUCK.t=5;return;}
    DUCK.st=1;DUCK.s=s;DUCK.dir=Math.random()<.5?1:-1;DUCK.lat=-DUCK.dir*(RW+XW[i]+2);for(const d of DUCK.birds){d.fly=null;d.g.visible=true;d.g.rotation.set(0,0,0);}
    say('CANARDS !','A MOTHER DUCK AND HER DUCKLINGS ARE CROSSING - SLOW DOWN',3.4);sfxQuack(3);return;}
  const i=wrapI(Math.floor(DUCK.s/SEG)),edge=RW+XW[i]+2.5,tm=tmNow();DUCK.lat+=DUCK.dir*1.9*rdt;let done=true;
  for(const d of DUCK.birds){const lat=DUCK.lat-DUCK.dir*d.k*.5,s=DUCK.s+Math.sin(d.k*1.7)*.25;
    if(d.fly){const f=d.fly;f.t+=rdt;f.v.y-=4*rdt;d.g.position.addScaledVector(f.v,rdt);d.g.children[4].rotation.z=Math.sin(f.t*30)*.9;d.g.children[5].rotation.z=-Math.sin(f.t*30)*.9;if(f.t<4)done=false;else d.g.visible=false;continue;}
    if(Math.abs(lat)<edge+d.k*.6)done=false;
    at(s,lat,0,d.g.position);d.g.rotation.set(0,yaw(i)+DUCK.dir*Math.PI/2,Math.sin(tm*9+d.ph)*.12);d.g.position.y+=Math.abs(Math.sin(tm*9+d.ph))*.04;   // the waddle
    const dx=d.g.position.x-PL.x,dz=d.g.position.z-PL.z;if(!d.k&&dx*dx+dz*dz<2.6*2.6&&pe.v>2){d.fly={t:0,v:new THREE.Vector3(R(-3,3)+PL.vx*.15,R(3,5),R(-3,3)+PL.vz*.15)};sfxQuack(2);NOGY=1;puff(d.g.position,R(-1,1),R(1,2),R(-1,1),.3,1,1.2,.5,0xd8c8a0);NOGY=0;}}   // a near miss: up and away in a flurry
  if(done||wdiff(DUCK.s-pe.s)<-150||!on&&wdiff(DUCK.s-pe.s)<-20){DUCK.st=0;DUCK.t=R(45,95);for(const d of DUCK.birds)d.g.visible=false;}}
// spray-paint over the AI boards: a slogan in drippy capitals, a tag, and now and then a big cross through the robot
function graffiti(g,w,h,v){let s=v*7919+13;const r=()=>{s=(s*16807)%2147483647;return s/2147483647;};
  const SL=['AI = SLOP','HUMANS ONLY','UNPLUG IT','NO BOTS','THINK FOR YOURSELF','ROBOTS OUT','FAKE','WE ARE NOT DATA','ASK A PERSON'],col=['#d8261c','#141414','#2fd04a','#f0e020','#e040c0','#f4f4f4'][(r()*6)|0];
  g.save();g.translate(w*(.35+r()*.3),h*(.45+r()*.35));g.rotate((r()-.5)*.5);g.font='900 '+(70+r()*40|0)+'px Impact,"Arial Black",Arial';g.textAlign='center';g.textBaseline='middle';
  g.lineJoin='round';g.strokeStyle='rgba(0,0,0,.45)';g.lineWidth=10;const t=SL[(r()*SL.length)|0];g.strokeText(t,0,0);g.fillStyle=col;g.fillText(t,0,0);
  const tw=g.measureText(t).width;g.fillRect(-tw/2,0,0,0);for(let k=0;k<9;k++){const x=-tw/2+r()*tw,len=10+r()*45;g.fillRect(x,18,3+r()*3,len);g.beginPath();g.arc(x+2.5,18+len,3.5,0,7);g.fill();}g.restore();   // drips
  if(r()<.55){g.strokeStyle=col==='#141414'?'#d8261c':'#141414';g.lineWidth=16;g.lineCap='round';g.beginPath();g.moveTo(70,90);g.lineTo(320,390);g.moveTo(320,90);g.lineTo(70,390);g.stroke();}
  g.fillStyle=['#2fd04a','#f0e020','#f4f4f4'][(r()*3)|0];g.font='italic 900 40px "Comic Sans MS",cursive';g.fillText(['K-RAT','ZORP','HUMN','MOSS'][(r()*4)|0],w-200,h-60);}
// a turkey through the windscreen: a crazed star of cracks stays on the glass until the drive starts again
function crackScreen(){let el=$('crack');if(!el){el=document.createElement('div');el.id='crack';el.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:5;opacity:0;transition:opacity .08s';
    const c=document.createElement('canvas');c.width=1600;c.height=1000;const g=c.getContext('2d'),cx=980+Math.random()*200,cy=380+Math.random()*120;g.strokeStyle='rgba(235,240,245,.85)';g.lineCap='round';
    const br=(x,y,a,len,wd,d)=>{if(d>5||len<12)return;g.lineWidth=wd;g.beginPath();g.moveTo(x,y);let px=x,py=y;for(let k=0;k<5;k++){a+=(Math.random()-.5)*.5;px+=Math.cos(a)*len/5;py+=Math.sin(a)*len/5;g.lineTo(px,py);}g.stroke();
      for(let k=0;k<2;k++)if(Math.random()<.6)br(px,py,a+(Math.random()-.5)*1.4,len*.6,wd*.7,d+1);};
    for(let k=0;k<14;k++)br(cx,cy,k/14*6.283+Math.random()*.3,180+Math.random()*420,3,0);for(const rr of[40,85,140])
      {g.lineWidth=1.6;g.beginPath();for(let k=0;k<=24;k++){const a=k/24*6.283,q=rr*(.85+Math.random()*.3);k?g.lineTo(cx+Math.cos(a)*q,cy+Math.sin(a)*q):g.moveTo(cx+Math.cos(a)*q,cy+Math.sin(a)*q);}g.stroke();}
    const rg=g.createRadialGradient(cx,cy,0,cx,cy,60);rg.addColorStop(0,'rgba(240,245,250,.75)');rg.addColorStop(1,'rgba(240,245,250,0)');g.fillStyle=rg;g.fillRect(cx-60,cy-60,120,120);
    el.style.background=`url(${c.toDataURL()}) center/cover no-repeat`;document.body.appendChild(el);}
  if(el.style.opacity!=='1'){el.style.opacity='1';say('GOBBLE !','A TURKEY HAS CRACKED THE WINDSCREEN',2.6);sfxCrunch(.7);clearTimeout(crackScreen.to);crackScreen.to=setTimeout(clearCrack,2000);}}
function clearCrack(){const el=$('crack');if(el)el.style.opacity='0';}
// the free drive ends where it began: back outside 1611 San Antonio Ave after the whole loop, the car rolls to a stop and the time is shown
function driveHome(pe){if(!DRIVE)return;const H0=Z.home;if(!H0||G.state!=='race'||PL.crash||PL.auto||pe.dist<LEN*.97)return;const ahead=wdiff(H0.s-pe.s);if(ahead<14||ahead>150)return;
  const lane=-(RW+XW[wrapI(Math.round(H0.s/SEG))])/2,v0=Math.max(8,Math.abs(pe.v)),go=ahead+12,c=Math.min(go/3,30),e=pe.s+go;   // pull up past the driveway, then back into it (the start's reverse-out, run the other way)
  PL.auto={t:0,T:clamp(2*go/v0,2.5,9),ease:'out',hold:.5,rev:false,p:[[pe.s,pe.lat],[pe.s+c,pe.lat],[e-c,lane],[e,lane]],
    next:{t:0,T:6.5,rev:true,fin:true,p:[[e,lane],[e-12,lane-.4],[e-12,H0.lat+5.5],[e-12,H0.lat]]}};
  G.state='finish';G.finT=0;G.stopT=0;sfxCheer();say('HOME','1611 SAN ANTONIO AVE · ROUND THE BAY IN '+fmt(G.raceT),6);homeParty();}
function homeParty(){try{const st=document.createElement("style");st.textContent="@keyframes cfl{to{transform:translateY(105vh) rotate(720deg)}}";document.head.appendChild(st);const w=document.createElement("div");w.style.cssText="position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:50";const bn=document.createElement("div");bn.textContent="YOU'RE HOME !";bn.style.cssText="position:absolute;top:22%;width:100%;text-align:center;font:900 clamp(48px,11vw,150px) Georgia,serif;color:#ffd23c;text-shadow:0 4px 0 #b3201a,0 0 30px #000";w.appendChild(bn);const C=["#e8432e","#2fb7e8","#f2c230","#7ad13a","#e85bd0","#fff"];for(let k=0;k<160;k++){const c=document.createElement("i");c.style.cssText="position:absolute;top:-20px;left:"+Math.random()*100+"vw;width:10px;height:16px;background:"+C[k%6]+";animation:cfl "+(2.5+Math.random()*3)+"s linear "+Math.random()*2+"s forwards";w.appendChild(c);}document.body.appendChild(w);setTimeout(()=>{w.remove();st.remove();},8000);for(let k=1;k<4;k++)setTimeout(sfxCheer,k*900);}catch(e){}}
// the start of the free drive: the car is in the driveway at 1611, nose to the house, and backs out across the pavement, swinging into the lane facing the right way.
// PL.auto runs a path in track coordinates (a Bézier over s and lateral), and the player takes over when it ends. driveHome() uses the same thing to bring the car in.
function homeStart(){if(!DRIVE)return;const H0=Z.home;if(!H0)return;const pe=ents.find(e=>e.player),lane=-(RW+XW[wrapI(Math.round(H0.s/SEG))])/2;
  PARTY.done=0;PL.auto={t:0,T:6.5,hold:.4,rev:true,p:[[H0.s,H0.lat],[H0.s,H0.lat+5.5],[H0.s,lane-.4],[H0.s-10,lane]]};autoPlace(0,pe,true);pe.v=0;PL.vx=PL.vz=0;PL.steer=0;G.camH=PL.h;first=true;G.mist=1;radioOn=false;}
function bez(p,u,k){const a=1-u;return a*a*a*p[0][k]+3*a*a*u*p[1][k]+3*a*u*u*p[2][k]+u*u*u*p[3][k];}
function autoPlace(u,pe,init){const A=PL.auto,s=bez(A.p,u,0),lat=bez(A.p,u,1),u2=Math.min(1,u+.002),u1=u2-.002,ds=bez(A.p,u2,0)-bez(A.p,u1,0),dl=bez(A.p,u2,1)-bez(A.p,u1,1),ns=wrapS(s),i=wrapI(Math.floor(ns/SEG));
  at(ns,lat,0,V);const sg=A.rev?-1:1,fx=sg*(T[i].x*ds+Nn[i].x*dl),fz=sg*(T[i].z*ds+Nn[i].z*dl);PL.x=V.x;PL.z=V.z;if(fx||fz)PL.h=Math.atan2(fx,fz);PL.idx=i;pe.lat=lat;
  pe.dist=init?wdiff(ns-S0):pe.dist+wdiff(ns-pe.s);pe.s=ns;PL.gy=PL.cy=H[i];PL.vy=0;PL.air=0;}
function autoDrive(dt,pe){const A=PL.auto;if(dt<=0)return true;A.t+=dt;const k=clamp(A.t/A.T,0,1),u=A.ease==='out'?1-(1-k)*(1-k):k*k*(3-2*k),px=PL.x,pz=PL.z;autoPlace(u,pe,false);
  PL.vx=(PL.x-px)/dt;PL.vz=(PL.z-pz)/dt;const v=Math.hypot(PL.vx,PL.vz);pe.v=A.rev?-v:v;PL.steer=A.rev?clamp(Math.sin(k*Math.PI)*.8,0,1)*Math.sign(-A.p[3][0]+A.p[0][0]||1)*.6:0;
  if(k<1)return true;PL.vx=PL.vz=0;pe.v=0;if(A.fin)return true;A.hold-=dt;if(A.hold>0)return true;if(A.next){PL.auto=A.next;G.stopT=0;return true;}PL.auto=null;PL.steer=0;resetVehicle(VS,hero.M.dyn,0);return true;}
// the crows on the poles and wires: they look about while they sit; drive past quickly and they go up, flapping and calling, and settle again once you have gone
let cawT=0;
function crowsTick(rdt){if(!CROWS.length)return;cawT-=rdt;const v=Math.hypot(PL.vx,PL.vz),tm=tmNow();
  for(const c of CROWS){const g=c.g,dx=c.h.x-PL.x,dz=c.h.z-PL.z,d2=dx*dx+dz*dz;
    if(c.st===0){if(d2>180*180)continue;c.t-=rdt;if(c.t<0){c.t=R(.5,2.8);c.hy=Math.random()<.3?0:R(-1,1);}c.hd.rotation.y+=(c.hy-c.hd.rotation.y)*clamp(rdt*9,0,1);c.hd.rotation.x=Math.max(0,Math.sin(tm*1.3+c.h.x))**8*.5;   // a look round, now and then a peck
      if(d2<140*140&&Math.random()<rdt*.015){c.st=1;c.t=0;c.v.set(R(-5,5),R(2.5,4.5),R(-5,5));if(cawT<=0&&d2<60*60){sfxCaw();cawT=R(1,2.2);}}   // now and then one just takes off and flaps about
      else if(d2<40*40&&v>8){if(!c.dl)c.dl=R(.05,.9);c.dl-=rdt;if(c.dl<=0){const d=Math.sqrt(d2)||1;c.st=1;c.t=0;c.dl=0;c.v.set(dx/d*R(3,6)+R(-2,2),R(3.5,5.5),dz/d*R(3,6)+R(-2,2));if(cawT<=0){sfxCaw();cawT=R(1,2.2);}}}}
    else if(c.st===1){c.t+=rdt;c.v.y+=(1.2-c.v.y)*clamp(rdt*.6,0,1);g.position.addScaledVector(c.v,rdt);g.rotation.y=Math.atan2(c.v.x,c.v.z);g.rotation.x=-.25;
      const fl=Math.sin(c.t*15+c.h.z);for(let k=0;k<2;k++)c.wings[k].rotation.z=fl*.85;if(c.t>9){c.st=2;g.visible=false;}}
    else if(d2>170*170){c.st=0;g.visible=true;g.position.copy(c.h);g.rotation.set(0,c.ry,0);for(const w of c.wings)w.rotation.z=-1.35;}}}   // home again, out of sight
// A flock of small dark birds now and then swoops down over the Alameda streets ahead, wheels low across the road and climbs away. One InstancedMesh; wings flap by flipping the V's height (scale y).
const BIRDS={im:null,st:0,t:0,cd:20,n:0,b:[],s:0,dir:1,T:7,V:new THREE.Vector3(),Q:new THREE.Quaternion(),E:new THREE.Euler(0,0,0,'YXZ'),S:new THREE.Vector3(),M:new THREE.Matrix4()};
function birdsTick(rdt){const B=BIRDS,pe=ents.find(e=>e.player);if(!pe)return;
  if(!B.im){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array([0,0,.13, 0,0,-.12, -.38,.16,-.06, 0,0,.13, .38,.16,-.06, 0,0,-.12]),3));g.computeVertexNormals();
    B.im=new THREE.InstancedMesh(g,new THREE.MeshBasicMaterial({color:0x17161a,side:THREE.DoubleSide}),30);B.im.frustumCulled=false;B.im.count=0;scene.add(B.im);
    for(let k=0;k<30;k++)B.b.push({ox:0,oy:0,oz:0,ph:0,w:0,r:0});}
  if(DRIVE){if(PL.idx<Z.tu0)B.tb=0;else if(!B.tb&&B.st===0&&G.state==='race'&&PL.idx>=Z.tu1-Math.round(40/SEG)&&PL.idx<Z.tu1+Math.round(80/SEG)){   // coming out of the Posey Tube a flock bursts up from the road ahead (once per run)
    B.tb=1;B.bat=1;B.st=1;B.t=0;B.n=26+(Math.random()*5|0);B.s=pe.s+R(40,60);B.dir=Math.random()<.5?-1:1;B.T=R(6,8);
    for(let k=0;k<B.n;k++){const b=B.b[k];b.ox=R(-7,7);b.oy=R(-2,2.5);b.oz=R(-8,8);b.ph=R(0,6.3);b.w=R(.6,1.4)*(Math.random()<.5?-1:1);b.r=R(1,3);}}}
  if(B.st===0){B.im.count=0;const mar=DRIVE&&PL.idx>=Z.gg1&&PL.idx<Z.sq;if((zoneArr[PL.idx]!==1&&!mar)||G.state!=='race')return;B.cd-=rdt;if(B.cd>0)return;
    B.bat=0;B.st=1;B.t=0;B.cd=mar?R(5,10):R(30,60);B.n=mar?24+(Math.random()*7|0):15+(Math.random()*16|0);B.s=pe.s+R(45,80);B.dir=Math.random()<.5?-1:1;B.T=R(6,8);
    for(let k=0;k<B.n;k++){const b=B.b[k];b.ox=R(-7,7);b.oy=R(-2,2.5);b.oz=R(-8,8);b.ph=R(0,6.3);b.w=R(.6,1.4)*(Math.random()<.5?-1:1);b.r=R(1,3);}return;}
  B.t+=rdt;const u=B.t/B.T;if(u>=1){B.st=0;B.im.count=0;return;}
  let lat=B.dir*lerp(-55,55,u),h=2.6+34*Math.pow(Math.abs(2*u-1),1.6),sAl=B.s+lerp(-10,10,u);const tm=B.t;
  if(B.bat){lat=B.dir*Math.sin(u*5)*3.5;h=2+46*u*u;sAl=pe.s+lerp(-14,40,Math.min(1,u*1.6));}   /* bats out of the Posey Tube: they stream out with the car and climb away into the sky */
  at(sAl,lat,0,B.V);at(sAl,lat+B.dir,0,B.S);const hd=Math.atan2(B.S.x-B.V.x,B.S.z-B.V.z),pt=u<.5?.35:-.35;
  for(let k=0;k<B.n;k++){const b=B.b[k],a=tm*b.w+b.ph,cx=b.ox*Math.cos(a*.5)+Math.sin(a)*b.r,cz=b.oz+Math.cos(a)*b.r,cy=b.oy*(.5+.5*Math.abs(2*u-1))+Math.sin(a*1.3)*.6;
    at(sAl+cz,lat+cx,h+cy,B.V);B.E.set(pt,hd+Math.sin(a)*.3,Math.sin(a)*.4);B.Q.setFromEuler(B.E);
    const fl=Math.sin(tm*(14+k%5)+b.ph);B.S.set(1.3,fl*1.3,1.3);B.M.compose(B.V,B.Q,B.S);B.im.setMatrixAt(k,B.M);}
  B.im.count=B.n;B.im.instanceMatrix.needsUpdate=true;}
// Owls: wet, ruffled and a bit grumpy. Perched on poles and snags in Alameda and the Marin redwoods, turning their heads; now and then one swoops low across the road far ahead and climbs away (also on I-80). Never solid.
const OWL={p:[],f:null,cd:12,t:0,on:0,dir:1,T:3.4,s:0};
function mkOwl(v){const g=new THREE.Group(),dk=v===0,hc=dk?0x5a4030:0xf2f0ea,fc=dk?0x2a1c14:0x111111,M=(c,r=.35)=>std({color:c,roughness:r,metalness:.05}),
  tex=canvas(64,64,(c,w,h)=>{c.fillStyle=dk?'#4a3426':'#dcd8d0';c.fillRect(0,0,w,h);c.fillStyle=dk?'rgba(20,10,6,.65)':'rgba(70,60,50,.5)';for(let x=2;x<w;x+=6)c.fillRect(x+R(-1,1),0,2,h);c.fillStyle=dk?'rgba(200,170,130,.35)':'rgba(40,30,20,.5)';for(let k=0;k<30;k++)c.fillRect(R(0,w),R(0,h),3,2);}),
  sp=(r,m,sx,sy,sz,x,y,z,p=g)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(r,10,8),m);o.scale.set(sx,sy,sz);o.position.set(x,y,z);p.add(o);return o;};
  sp(.2,std({map:tex,roughness:.3}),1,1.3,.9,0,.28,0);
  for(let k=0;k<7;k++){const c=new THREE.Mesh(new THREE.ConeGeometry(.03,.14,4),M(dk?0x3a2a1e:0xcfcac0));c.position.set(R(-.15,.15),R(.18,.45),R(-.12,.12));c.rotation.set(R(-.9,.9),0,R(-.9,.9));g.add(c);}   // ruffled, wet feathers
  const hd=new THREE.Group();hd.position.set(0,.58,.02);g.add(hd);sp(.15,M(hc),1,.95,.95,0,0,0,hd);sp(.125,M(fc),1.05,.95,.4,0,-.01,.09,hd);
  for(const x of[-.065,.065]){sp(.055,std({color:0xff8a10,emissive:0xaa4400,emissiveIntensity:.6,roughness:.3}),1,1,.6,x,.02,.13,hd);sp(.022,M(0x050505),1,1,.6,x,.02,.17,hd);if(dk){const e=new THREE.Mesh(new THREE.ConeGeometry(.035,.12,4),M(0x3a2a1e));e.position.set(x*1.6,.15,0);hd.add(e);}}
  const bk=new THREE.Mesh(new THREE.ConeGeometry(.03,.07,4),M(0xb8a060));bk.rotation.x=Math.PI/2;bk.position.set(0,-.04,.17);hd.add(bk);
  const tl=new THREE.Mesh(new THREE.BoxGeometry(.12,.02,.24),M(dk?0x3a2a1e:0xb8b4aa));tl.position.set(0,.1,-.2);tl.rotation.x=.4;g.add(tl);
  g.wp=[];for(const k of[1,-1]){const w=new THREE.Group();w.position.set(k*.19,.42,0);sp(.2,M(dk?0x3e2c20:0xcfcbc2),.35,1.6,.8,0,-.3,0,w);w.rotation.z=k*.1;w.k=k;g.add(w);g.wp.push(w);}
  g.head=hd;return g;}
function owlsTick(rdt){if(!DRIVE||G.state!=='race')return;const pe=ents.find(e=>e.player);if(!pe)return;const O=OWL,t=tmNow(),zOf=s=>zoneArr[wrapI(Math.floor(s/SEG))],okZ=s=>{const z=zOf(s);return z===1||z===7;};
  if(!O.p.length){for(let k=0;k<3;k++){const g=new THREE.Group(),forest=k===2,tr=new THREE.Mesh(new THREE.CylinderGeometry(forest?.3:.14,forest?.4:.17,7,8),std({color:forest?0x4a2a1a:0x5a4630,roughness:1}));tr.position.y=3.5;g.add(tr);
      const arm=new THREE.Mesh(new THREE.BoxGeometry(2.4,.14,.14),std({color:0x4a3a28,roughness:1}));arm.position.y=6.8;g.add(arm);const ow=mkOwl(k===1?1:0);ow.position.set(k===1?.4:-.3,6.85,0);ow.scale.setScalar(1.7);g.add(ow);g.visible=false;scene.add(g);O.p.push({g,ow,ph:R(0,6),s:-1e9});}
    const f=mkOwl(1);f.scale.setScalar(2.4);f.rotation.order='YXZ';f.visible=false;scene.add(f);O.f=f;}
  for(const q of O.p){if(q.g.visible&&q.s>pe.s-35&&q.s<pe.s+320){q.ow.head.rotation.y=Math.sign(Math.sin(t*.45+q.ph))*Math.pow(Math.abs(Math.sin(t*.45+q.ph)),.4)*1.7;continue;}
    const ns=pe.s+R(70,260);if(!okZ(ns)||O.p.some(o=>o!==q&&Math.abs(o.s-ns)<60)){q.g.visible=false;q.s=-1e9;continue;}
    const side=Math.random()<.5?-1:1;at(ns,side*R(9,11),0,V);at(ns,0,0,V2);q.g.position.copy(V);q.g.rotation.y=Math.atan2(V2.x-V.x,V2.z-V.z);q.s=ns;q.g.visible=true;}
  const f=O.f;O.cd-=rdt;
  if(!O.on&&O.cd<=0){const i=PL.idx;if(okZ(pe.s)||(i>Z.i80&&i<Z.wt1)){O.on=1;O.t=0;O.dir=Math.random()<.5?-1:1;O.cd=R(30,55);}else O.cd=4;}
  if(O.on){O.t+=rdt;const u=O.t/O.T;if(u>=1){O.on=0;f.visible=false;return;}
    const pos=(u,o)=>at(pe.s+lerp(75,28,u),O.dir*lerp(-24,24,u),2.4+6*Math.pow(Math.abs(2*u-1),1.4),o);pos(u,V);pos(Math.min(1,u+.03),V2);
    f.visible=true;f.position.copy(V);f.rotation.set(-Math.atan2(V2.y-V.y,Math.hypot(V2.x-V.x,V2.z-V.z)),Math.atan2(V2.x-V.x,V2.z-V.z),O.dir*.25*Math.sin(u*6.283));
    const a=.9+.6*Math.sin(t*16)*(u>.55?1:.4);for(const w of f.wp)w.rotation.z=w.k*a;f.head.rotation.y=0;}}
// Skunks on the Alameda streets, lots of them: every few seconds one (sometimes a mother with two or three babies trotting behind) runs out from either kerb into the road ahead,
// stops, turns its back to the car, raises its tail and sprays a big yellow-green mist, then scurries on across or back. Not solid; no tint over the view.
const SKUNK={l:[],cd:4,V:new THREE.Vector3(),W:new THREE.Vector3()};
// The tea party at 1611: as you back out the creatures sit round a little table on the lawn sipping tea in party hats, then stand and wave goodbye.
const PARTY={g:null,an:[],done:0};
function partyTick(rdt,pe){const P=PARTY,H0=Z.home;if(!DRIVE||!H0||G.state!=='race'||P.done||(!P.g&&G.raceT>8))return;
  if(!P.g){const g=new THREE.Group(),M=(c,r=.9)=>std({color:c,roughness:r}),bx=(sx,sy,sz,m,x,y,z,p)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m);o.position.set(x,y,z);p.add(o);return o;};
    const tb=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.04,14),M(0xf2ece0));tb.position.y=.62;g.add(tb);const lg=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.6,6),M(0x6a4a2a));lg.position.y=.3;g.add(lg);
    const pot=new THREE.Mesh(new THREE.SphereGeometry(.1,10,8),M(0xd8d8e8,.4));pot.position.set(0,.74,0);g.add(pot);
    const kinds=[[0x121214,0xf4f4ee],[0x9a968c,0xece6da],[0x6e6a62,0x1a1a1a],[0x121214,0xf4f4ee]];
    kinds.forEach(([c,c2],n)=>{const a=n/4*Math.PI*2+.4,an=new THREE.Group();an.position.set(Math.sin(a)*.95,0,Math.cos(a)*.95);an.rotation.y=a+Math.PI;g.add(an);
      const body=new THREE.Mesh(new THREE.SphereGeometry(.28,10,8),M(c));body.scale.set(.8,1.1,.8);body.position.y=.5;an.add(body);const hd=new THREE.Mesh(new THREE.SphereGeometry(.17,10,8),M(c2));hd.position.set(0,.9,.03);an.add(hd);
      for(const x of[-.1,.1]){const e=new THREE.Mesh(new THREE.SphereGeometry(.05,6,5),M(c));e.position.set(x,1.05,0);an.add(e);}
      const cn=new THREE.Mesh(new THREE.ConeGeometry(.08,.2,8),M([0xe03a7a,0x3a8ae0,0xf0c020,0x40c060][n]));cn.position.set(0,1.12,.03);an.add(cn);
      const arm=new THREE.Group();arm.position.set(.25,.7,.05);an.add(arm);bx(.07,.3,.07,M(c),0,-.13,0,arm);const cup=new THREE.Mesh(new THREE.CylinderGeometry(.04,.03,.06,8),M(0xf6f2ea));cup.position.set(0,-.3,.03);arm.add(cup);
      const tl=new THREE.Mesh(new THREE.SphereGeometry(.14,8,6),M(n===2?0x7a7a72:c));tl.scale.set(.5,.5,1.4);tl.position.set(0,.3,-.3);an.add(tl);
      P.an.push({an,arm,cup,hd,ph:n*1.3});});
    scene.add(g);P.g=g;}
  const sd=Math.sign(-(RW+XW[wrapI(Math.round(H0.s/SEG))])/2-H0.lat)||1,s=H0.s+5;at(s,H0.lat+sd*2.5,0,P.g.position);P.g.rotation.y=Math.atan2(Nn[wrapI(Math.round(s/SEG))].x*sd,Nn[wrapI(Math.round(s/SEG))].z*sd)-Math.PI/2*0;
  const wave=G.raceT>2.5,t=tmNow();for(const o of P.an){o.arm.rotation.x=wave?-2.6:-1.1+Math.sin(t*1.5+o.ph)*.25-(Math.sin(t*.7+o.ph)>.6?.5:0);o.arm.rotation.z=wave?Math.sin(t*9+o.ph)*.5:0;o.hd.rotation.z=wave?0:Math.sin(t*1.1+o.ph)*.08;}
  if(wdiff(s-pe.s)<-60||pe.dist>200){scene.remove(P.g);P.g=null;P.an.length=0;P.done=1;}}
function skunksTick(rdt){const K=SKUNK,pe=ents.find(e=>e.player);if(!pe)return;partyTick(rdt,pe);
  if(!K.l.length){const blk=std({color:0x121214,roughness:1}),wht=std({color:0xf4f4ee,roughness:1}),gry=std({color:0x9a968c,roughness:1}),pf=std({color:0xece6da,roughness:1}),pk=std({color:0xd9a0a0,roughness:.8}),rg=std({color:0x6e6a62,roughness:1}),rh=std({color:0x9a958a,roughness:1});
    // kind 0 a skunk, 1 a possum (grizzled grey, white face, long bare pink tail), 2 a raccoon (grey, black mask, ringed bushy tail)
    const mk=(sc,kd)=>{let kn=null;const g=new THREE.Group(),b=new THREE.Group();g.add(b);const S=(r,mm,sx,sy,sz,x,y,z,p=b)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(r,8,6),mm);o.scale.set(sx,sy,sz);o.position.set(x,y,z);p.add(o);return o;};
      const bm=[blk,gry,rg][kd],hm=[blk,pf,rh][kd];
      S(1,bm,kd===2?.22:.2,kd===2?.19:.17,kd===1?.38:.34,0,.24,0);
      if(kd===0){for(const x of[-.06,.06]){const st=new THREE.Mesh(new THREE.BoxGeometry(.05,.035,.6),wht);st.position.set(x,.4,-.02);b.add(st);}const bz=new THREE.Mesh(new THREE.BoxGeometry(.03,.02,.16),wht);bz.position.set(0,.33,.38);b.add(bz);}   // the two white stripes down the back
      S(.11,hm,1,.9,kd===1?1.7:1.3,0,.24,kd===1?.4:.36);
      if(kd===1){S(.03,pk,1,1,1,0,.23,.58);for(const x of[-.06,.06])S(.035,blk,1,1,.4,x,.34,.36);}   // pink nose, dark round ears
      if(kd===2){kn=new THREE.Group();kn.position.set(.1,.3,.4);kn.visible=false;b.add(kn);const bl=new THREE.Mesh(new THREE.BoxGeometry(.02,.03,.22),std({color:0xd8dce0,metalness:.6,roughness:.3}));bl.position.z=.12;kn.add(bl);const hd2=new THREE.Mesh(new THREE.BoxGeometry(.035,.035,.08),blk);kn.add(hd2);const mask=new THREE.Mesh(new THREE.BoxGeometry(.23,.05,.1),blk);mask.position.set(0,.27,.44);b.add(mask);S(.03,blk,1,1,1,0,.22,.5);for(const x of[-.07,.07])S(.04,rg,1,1.2,.5,x,.35,.34);}
      for(const[x,z]of[[-.11,.2],[.11,.2],[-.11,-.2],[.11,-.2]]){const lg=new THREE.Mesh(new THREE.BoxGeometry(.06,.14,.06),kd===1?pf:blk);lg.position.set(x,.07,z);b.add(lg);}
      const tp=new THREE.Group();tp.position.set(0,.3,-.3);b.add(tp);
      if(kd===0){S(1,blk,.16,.15,.36,0,0,-.3,tp);S(1,wht,.1,.08,.3,0,.11,-.3,tp);}
      else if(kd===1){const tl=new THREE.Mesh(cyl(.012,.035,.55,6),pk);tl.rotation.x=Math.PI/2;tl.position.z=-.28;tp.add(tl);}
      else for(let q=0;q<5;q++)S(.075,q%2?blk:rh,1,1,1.1,0,-.02*q,-.08-q*.1,tp);
      g.scale.setScalar(sc);g.visible=false;scene.add(g);return{g,b,tp,kn,ks:0,kd,st:0,t:0,s:0,lat:0,side:1,tg:0,ry:0,mv:0,sp:0,ma:null,n:0,baby:sc<1};};
    for(let kd=0;kd<3;kd++){for(let n=0;n<6;n++)K.l.push(mk(1.5,kd));for(let n=0;n<10;n++)K.l.push(mk(.85,kd));}}
  const town=zoneArr[PL.idx]===1&&G.state==='race',v=Math.abs(pe.v),act=K.l.filter(o=>o.st&&!o.baby).length;
  if(PL.idx>Z.tu1&&PL.idx<Z.wt1)K.spN=0;   // the spray count starts again for the way home
  if(town){K.cd-=rdt;if(K.cd<=0){K.cd=R(5,9);const rr=Math.random(),kd=rr<.2?0:rr<.6?1:2,k=K.l.find(o=>!o.st&&!o.baby&&o.kd===kd);   // fewer of them, and skunks the rarest
    if(k&&act<4){const s=pe.s+Math.max(42,v*3.4)+R(0,30),i=wrapI(Math.floor(s/SEG)),w=RW+XW[i];k.st=1;k.t=0;k.sp=0;k.s=s;k.side=Math.random()<.5?-1:1;k.mv=R(2.4,3.4);const grp=Math.random(),fam=grp>.65,pair=!fam&&grp>.35;   // alone, a pair, or a family
      k.cross=kd?true:fam?Math.random()<.8:Math.random()<.55;   // only skunks spray, and only some of them; the rest just trot across
      if(k.cross){k.mv=kd===1?R(1.3,1.9):R(1.8,2.6);k.lat=Math.random()<.3?k.side*R(1,w-1.5):k.side*(w+1.6);k.tg=-k.side*(w+9);}
      else if(Math.random()<.15){k.lat=k.side*R(1,w-1.5);k.tg=-k.side*R(0,w-2);}   // already out in the road, crossing
      else{k.lat=k.side*(w+1.6);k.tg=k.side*(w-R(2,5));}
      k.ks=kd===2&&Math.random()<.45?1:0;if(k.kn)k.kn.visible=!!k.ks;if(k.ks){k.cross=false;k.lat=k.side*(w+1.6);k.tg=k.lat;}   /* a raccoon with a knife stands at the kerb and stabs at the car */
      const up=kd===0?.55:kd===1?.1:.2;k.g.visible=true;k.tp.rotation.x=up;
      if(fam||pair){const nb=pair?1:2+(Math.random()*3|0);let c=0;for(const b of K.l){if(c>=nb)break;if(b.baby&&!b.st&&b.kd===kd){b.st=1;b.ma=k;b.n=c++;b.t=R(0,1);b.s=k.s+R(-.35,.35);b.lat=k.lat+k.side*(b.n+1)*.55;b.g.scale.setScalar(pair?1.45:.85);b.g.visible=true;b.tp.rotation.x=up+.15;}}}}}}
  for(const k of K.l){if(!k.st)continue;k.t+=rdt;
    if(k.air){const a=k.air;a.vy-=18*rdt;k.y+=a.vy*rdt;k.s+=a.vs*rdt;k.lat+=a.vl*rdt;a.vs*=Math.exp(-1.2*rdt);k.g.rotation.x+=a.sx*rdt;k.g.rotation.z+=a.sz*rdt;   // knocked flying: up in a little arc, tumbling...
      if(k.y<=0){k.y=0;k.air=null;k.g.rotation.x=k.g.rotation.z=0;k.b.rotation.x=0;if(!k.baby){const w=RW+XW[wrapI(Math.floor(k.s/SEG))];k.st=3;k.t=0;k.sp=1;k.tg=(Math.sign(k.lat)||1)*(w+9);k.mv=R(4.5,6);}}   // ...lands on its feet and runs off the road
      at(k.s,k.lat,k.y,K.V);k.g.position.copy(K.V);continue;}
    {const cx=k.g.position.x-PL.x,cz=k.g.position.z-PL.z,vv=Math.abs(pe.v);if(k.t>.2&&vv>2&&!PL.crash&&cx*cx+cz*cz<2.3*2.3){k.y=0;k.air={vy:clamp(3+vv*.1,4,8.5),vs:pe.v*.55+R(1,3),vl:(Math.sign(k.lat-pe.lat)||1)*R(1.5,3.5),sx:R(-11,11),sz:R(-9,9)};sfxBoing(.45);sfxSqueak();if(k.kd===0&&!k.baby&&(K.spN||0)<3){K.spN=(K.spN||0)+1;skunkSpray(k);}G.shake=Math.max(G.shake,.08);continue;}}   // hit by the car: bounced, never squashed
    if(k.baby){const m=k.ma;if(!m||!m.st){k.st=0;k.ma=null;k.g.visible=false;continue;}   // babies trot along behind their mother and hide behind her while she sprays
      const dir=Math.sign(m.tg-m.lat)||-m.side,want=m.lat-dir*(k.n+1)*.55,d=want-k.lat;k.lat+=Math.sign(d)*Math.min(Math.abs(d),(m.mv+1)*rdt);k.s+=(m.s+(k.n-1)*.25-k.s)*clamp(rdt*3,0,1);
      at(k.s,k.lat,0,K.V);k.g.position.copy(K.V);const mov=Math.abs(d)>.03;
      if(mov){at(k.s,k.lat+Math.sign(d),0,K.W);k.ry=Math.atan2(K.W.x-K.V.x,K.W.z-K.V.z);}k.g.rotation.y=k.ry;
      k.b.rotation.z=mov?Math.sin(k.t*26)*.14:0;k.b.position.y=mov?Math.abs(Math.sin(k.t*26))*.03:0;continue;}
    const ds=wdiff(k.s-pe.s);
    if(ds<-40||ds>260||(!town&&k.st!==3)){k.st=0;k.g.visible=false;continue;}
    let mv=0,face=Math.sign(k.tg-k.lat)||-k.side;
    if(k.st===1){mv=k.mv;if(Math.abs(k.tg-k.lat)<.05){if(k.cross){k.st=0;k.g.visible=false;continue;}k.st=2;k.t=0;}}   // run out into the road
    else if(k.st===2){face=0;const tr=clamp((k.t-.25)/.35,0,1);k.tp.rotation.x=lerp(.55,1.6,tr);k.b.rotation.x=-tr*.12;   // stop, turn round, tail up...
      if(k.t>(k.ks?5:2)){k.st=3;k.t=0;k.sp=0;const w=RW+XW[wrapI(Math.floor(k.s/SEG))];k.tg=(Math.random()<.6?-k.side:k.side)*(w+9);k.mv=R(3,4.2);}}
    else if(k.st===3){mv=k.mv;k.b.rotation.x=0;k.tp.rotation.x=lerp(k.tp.rotation.x,.45,clamp(rdt*3,0,1));if(Math.abs(k.lat-k.tg)<.2){k.st=0;k.g.visible=false;continue;}}   // move on, off the road
    if(mv){const d=k.tg-k.lat;k.lat+=Math.sign(d)*Math.min(Math.abs(d),mv*rdt);}
    at(k.s,k.lat,0,K.V);k.g.position.copy(K.V);
    if(face){at(k.s,k.lat+face,0,K.W);k.ry=Math.atan2(K.W.x-K.V.x,K.W.z-K.V.z);}else k.ry=Math.atan2(K.V.x-PL.x,K.V.z-PL.z)+(k.ks?Math.PI:0);   /* spraying: back to the car; the knife raccoon faces it */
    if(k.ks&&k.kn){const q=Math.max(0,Math.sin(k.t*9));k.kn.position.z=.4+.22*q;k.kn.rotation.x=-.9+1.5*q;k.b.position.z=.1*q;}
    k.g.rotation.y=k.ry;const wd=mv&&Math.abs(k.tg-k.lat)>.05?1:0;k.b.rotation.z=wd*Math.sin(k.t*22)*.12;k.b.position.y=wd*Math.abs(Math.sin(k.t*22))*.035;}}
function skunkSpray(k){const K=SKUNK;at(k.s,k.lat,.55,K.V);const dx=PL.x-K.V.x,dz=PL.z-K.V.z,d=Math.hypot(dx,dz)||1;   // only when the car hits a skunk
  for(let n=0;n<22;n++)puff(K.V,dx/d*R(3,9)+R(-1.8,1.8),R(.3,2.4),dz/d*R(3,9)+R(-1.8,1.8),.9,R(5,10),R(2.5,4.5),.7,n%3?0xc2d24e:0x8fb02a);
  for(let n=0;n<10;n++)puff(K.V,R(-1.2,1.2),R(.2,.9),R(-1.2,1.2),1.4,R(6,11),R(3.5,5.5),.45,0xd4dc7a);say('PHEW! SKUNK!','',2);sfxHiss();}
function sfxSqueak(){if(!AC)return;const t=AC.currentTime;tone('square',1500,t,.09,.05,master,{to:2300,a:.004,h:.3,lp:4000});tone('square',1900,t+.1,.08,.05,master,{to:1200,a:.004,h:.3,lp:4000});}
function sfxHiss(){if(!AC)return;const t=AC.currentTime;hit(t,.9,.35,4200,'highpass',master);hit(t+.05,.7,.25,2200,'bandpass',master);}
// Tumbleweeds blowing across the Alameda streets and the toll plaza: dry wiry balls that bounce and roll from one side of the road to the other. Not solid; one that meets the car hops up over it.
const TUMB={l:[],cd:2,V:new THREE.Vector3(),W:new THREE.Vector3(),A:new THREE.Vector3(),Q:new THREE.Quaternion()};
// Penny-farthing riders on the Alameda and San Francisco streets: a gentleman in a top hat perched high over the big wheel, pedalling slowly along by the kerb.
// You can't run them over: a car that catches one just bounces it on ahead with a boing, the rider wobbles and rides on.
const PENNY={rs:1,l:[],cd:6,V:new THREE.Vector3(),W:new THREE.Vector3()};
function pennyTick(rdt){const P_=PENNY,pe=ents.find(e=>e.player);if(!pe||!DRIVE)return;
  if(!P_.l.length){const blk=std({color:0x1a1a1c,roughness:.5,metalness:.6}),tyre=std({color:0x111111,roughness:.9}),sk=std({color:0xd9a988,roughness:.8});
    const coats=[0x2a2f4a,0x4a2a22,0x2f3a2a,0x5a4a3a,0x3a3a3e];
    for(let n=0;n<6;n++){const g=new THREE.Group(),b=new THREE.Group();g.add(b);const bx=(sx,sy,sz,mm,x,y,z,p=b)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mm);o.position.set(x,y,z);p.add(o);return o;};
      const big=new THREE.Group();big.position.set(0,.76,.2);b.add(big);const rim=new THREE.Mesh(new THREE.TorusGeometry(.74,.03,6,28),tyre);rim.rotation.y=Math.PI/2;big.add(rim);
      for(let q=0;q<8;q++){const sp=bx(.012,1.46,.012,blk,0,0,0,big);sp.rotation.x=q*Math.PI/8;}
      const sm=new THREE.Group();sm.position.set(0,.2,-.82);b.add(sm);const r2=new THREE.Mesh(new THREE.TorusGeometry(.18,.025,5,14),tyre);r2.rotation.y=Math.PI/2;sm.add(r2);
      const bb=new THREE.Mesh(new THREE.TorusGeometry(.9,.03,5,16,1.6),blk);bb.rotation.y=Math.PI/2;bb.rotation.z=Math.PI*.42;bb.position.set(0,.55,-.1);b.add(bb);   // the curved backbone from the saddle down to the little wheel
      bx(.5,.03,.03,blk,0,1.62,.24);bx(.03,.2,.03,blk,0,1.55,.2);
      const coat=std({color:coats[n%coats.length],roughness:.9});bx(.36,.55,.24,coat,0,1.95,.08);const hd=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),sk);hd.position.set(0,2.36,.1);b.add(hd);
      const hat=new THREE.Group();hat.position.set(0,2.47,.1);b.add(hat);const hb=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.02,12),blk);hat.add(hb);const ht=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.24,12),blk);ht.position.set(0,.13,0);hat.add(ht);   // the top hat is one group so he can tip it
      for(const s of[-1,1]){const a=bx(.08,.42,.09,coat,s*.21,1.9,.22);a.rotation.x=-.9;}
      const legs=[-1,1].map(s=>{const p=new THREE.Group();p.position.set(s*.11,1.72,.15);bx(.12,.75,.13,std({color:0x2a2622,roughness:.9}),0,-.36,0,p);b.add(p);return p;});
      g.visible=false;scene.add(g);P_.l.push({g,b,big,sm,legs,hat,tip:0,st:0,s:0,lat:0,v:0,y:0,vy:0,wob:0,bt:0,t:0});}}
  const i=PL.idx,zn=zoneArr[i],on=G.state==='race'&&(zn===1||zn===5||zn===7)&&!(zn===5&&i>Z.hyde-20&&i<Z.marina);
  if(on){P_.cd-=rdt;if(P_.cd<=0){P_.cd=R(5,11);const k=P_.l.find(o=>!o.st),act=P_.l.filter(o=>o.st).length;
    if(k&&act<3){const s=pe.s+Math.max(60,Math.abs(pe.v)*4)+R(0,60),j=wrapI(Math.floor(s/SEG)),w=RW+XW[j];k.st=1;k.s=s;k.lat=-(w-1.6)*(Math.random()<.8?1:-1)*PENNY.rs;k.v=R(3.5,5.5);k.y=0;k.vy=0;k.wob=0;k.bt=0;k.t=R(0,6);k.g.visible=true;}}}
  for(const k of P_.l){if(!k.st)continue;k.t+=rdt;const ds=wdiff(k.s-pe.s);if(ds<-60||ds>400){k.st=0;k.g.visible=false;continue;}
    k.s=wrapS(k.s+k.v*rdt);k.vy-=16*rdt;k.y=Math.max(0,k.y+k.vy*rdt);if(k.y===0)k.vy=0;if(k.bt>0)k.bt-=rdt;
    at(k.s,k.lat,k.y,PENNY.V);k.g.position.copy(PENNY.V);const j=wrapI(Math.floor(k.s/SEG));k.g.rotation.set(0,yaw(j),0);
    k.big.rotation.x+=k.v*rdt/.76;k.sm.rotation.x+=k.v*rdt/.2;const cr=k.big.rotation.x;k.legs[0].rotation.x=Math.sin(cr)*.5;k.legs[1].rotation.x=-Math.sin(cr)*.5;
    k.wob=Math.max(0,k.wob-rdt*.7);k.b.rotation.z=Math.sin(k.t*1.7)*.04+Math.sin(k.t*9)*k.wob*.35;
    const dx=PENNY.V.x-PL.x,dz=PENNY.V.z-PL.z;
    {const near=dx*dx+dz*dz<16*16&&Math.abs(ds)<20?1:0;k.tip+=(near-k.tip)*clamp(rdt*5,0,1);const tp=k.tip*(.75+.25*Math.sin(k.t*7));k.hat.position.set(0,2.47+tp*.2,.1);k.hat.rotation.z=tp*.7*(k.lat>0?-1:1);}   // tips his hat to the passing car
    if(dx*dx+dz*dz<2.6*2.6&&!(k.bt>0)&&!PL.crash){k.bt=.8;k.vy=R(3,4.5);k.wob=1;k.s+=2;k.v=Math.max(k.v,Math.abs(pe.v)+R(2,4));PL.vx*=.97;PL.vz*=.97;G.shake=Math.max(G.shake,.15);sfxBoing(.7);}   // boing: bounced on ahead, never run over
    else if(k.bt<=0&&k.v>5.5)k.v=Math.max(R(3.5,5.5),k.v-rdt*3);}}
// Iguanas: grey-green, spiny crest, round scale patch on the cheek. They scurry along the road edge, now and then dart across, and one the car hits is flung up in an arc, lands and scurries off. Never a crash, no slowdown.
const IGU={l:[],cd:3,V:new THREE.Vector3()};
// the small land iguana (lizMk), about a third of a car long (1.45 m at scale 1): slim and smooth, a long thin tail, a low spiny crest; built as a chain of segments like
// bigIguMk ({g,b,segs,legs}) so the same side-to-side body wave and leg swing drive it
function lizMk(){const M=lizMk.M||(lizMk.M=[std({color:0x6f8a4a,roughness:.7}),std({color:0x4e6a36,roughness:.75}),std({color:0xc2cc9a,roughness:.7}),std({color:0x15110a,roughness:.3})]),sg=lizMk.sg||(lizMk.sg=new THREE.SphereGeometry(1,10,7)),
  g=new THREE.Group(),b=new THREE.Group();g.add(b);const segs=[],sp=(p,m,sx,sy,sz,x,y,z)=>{const o=new THREE.Mesh(sg,m);o.scale.set(sx,sy,sz);o.position.set(x,y,z);o.castShadow=true;p.add(o);return o;};
  const D=[[.6,.07,.045,.1],[.47,.06,.05,.09],[.33,.085,.065,.12],[.18,.09,.07,.12],[.03,.08,.06,.11],[-.11,.057,.046,.11],[-.25,.042,.036,.11],[-.39,.031,.028,.1],[-.53,.023,.021,.1],[-.66,.016,.015,.09],[-.78,.01,.01,.08]];   // z, half-width, half-height, half-length: head to tail tip
  D.forEach(([z,w,h,l],n)=>{const s=new THREE.Group();s.position.z=z;b.add(s);sp(s,n%2&&n>4?M[1]:M[0],w,h,l,0,.11+(n<5?0:-.02*Math.min(1,(n-4)/3)),0);if(n>=1&&n<=6)sp(s,M[1],.008,.022,.012,0,.11+h+.012,0);if(n>=2&&n<=4)sp(s,M[2],w*.8,h*.4,l*.85,0,.11-h*.55,0);segs.push({g:s,z});});   // body, crest spines, pale belly
  const hd=segs[0].g;sp(hd,M[0],.045,.035,.06,0,.1,.08);for(const s of[-1,1])sp(hd,M[3],.012,.012,.012,s*.05,.13,.03);   // snout and eyes
  const legs=[];for(const[si,zz]of[[2,.04],[4,-.02]])for(const s of[-1,1]){const lg=new THREE.Group();lg.position.set(s*D[si][1]*.8,.1,zz);segs[si].g.add(lg);
    const up=sp(lg,M[0],.07,.018,.02,s*.07,-.01,0);const ft=sp(lg,M[1],.018,.05,.018,s*.13,-.06,.01);ft.rotation.z=s*.4;legs.push({g:lg,s,f:si===2?1:-1});}   // thin legs splayed out to the sides
  g.visible=false;scene.add(g);return{g,b,segs,legs};}
function lizWig(k,sp,rdt){k.ph=(k.ph||0)+rdt*sp*6.5;const mv=sp>.05?1:0,ph=k.ph,K=3.2;for(const sg of k.segs){const z=sg.z,A=(.03+.1*Math.max(0,.6-z)/1.4)*(.35+.65*mv);sg.g.position.x=A*Math.sin(ph-K*z);sg.g.rotation.y=Math.atan(-A*K*Math.cos(ph-K*z));}   // the side-to-side wiggle down the body and tail
  for(const L of k.legs){const q=Math.sin(ph)*L.s*L.f;L.g.rotation.y=q*.6*mv;L.g.rotation.z=L.s*Math.max(0,Math.cos(ph)*L.s*L.f)*.3*mv;}}
function iguMk(){const[bm,dm,cm]=IGU.M||(IGU.M=[std({color:0x7d8a68,roughness:.85}),std({color:0x56633f,roughness:.9}),std({color:0xb9c29a,roughness:.7})]),g=new THREE.Group(),b=new THREE.Group();g.add(b);const bx=(sx,sy,sz,mm,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mm);o.position.set(x,y,z);b.add(o);return o;};
  bx(.16,.1,.4,bm,0,.1,0);bx(.11,.09,.15,bm,0,.12,.27);bx(.04,.04,.03,cm,.058,.12,.3).scale.set(1,1.4,1);   // body, head, round scale patch on the cheek
  bx(.07,.06,.4,dm,0,.08,-.4);bx(.04,.04,.35,dm,0,.07,-.72);
  for(let q=0;q<7;q++){const sp=bx(.025,.07,.04,dm,0,.19,.3-q*.1);sp.rotation.x=-.4;}   // spiny crest down the back
  for(const s of[-1,1])for(const z of[-.12,.14]){const l=bx(.04,.1,.05,dm,s*.11,.05,z);l.rotation.z=s*.5;}
  return{g,b};}
function iguanaTick(rdt){const I_=IGU,pe=ents.find(e=>e.player);if(!pe||!DRIVE)return;
  if(!I_.l.length){
    for(let n=0;n<6;n++){const{g,b,segs,legs}=lizMk();
      g.visible=false;scene.add(g);const tr=new THREE.Mesh(new THREE.CylinderGeometry(.55,.7,34,8),std({color:0x6a3a26,roughness:1}));tr.visible=false;scene.add(tr);I_.l.push({g,b,segs,legs,pz:0,ph:0,tr,st:0,s:0,lat:0,tl:0,v:0,vl:0,y:0,vy:0,t:0,x:0,z:0,vx:0,vz:0,sp:0});}}
  const i=PL.idx,zn=zoneArr[i],on=G.state==='race'&&(zn===1||zn===7||zn===8);
  if(on){I_.cd-=rdt;if(I_.cd<=0){I_.cd=R(3,8);const k=I_.l.find(o=>!o.st);
    if(k){const s=pe.s+Math.max(50,Math.abs(pe.v)*3)+R(0,60),j=wrapI(Math.floor(s/SEG)),w=RW+XW[j],sd=Math.random()<.5?-1:1;k.st=1;k.s=s;k.lat=sd*(w+R(1,3));k.tl=k.lat;k.v=R(1,3)*(Math.random()<.5?-1:1);k.vl=0;k.y=0;k.vy=0;k.t=R(0,5);k.climb=zn===7&&Math.random()<.6;k.b.rotation.set(0,0,0);k.g.visible=true;}}}
  for(const k of I_.l){if(!k.st)continue;const ds=wdiff(k.s-pe.s);if(ds<-40||ds>320){k.st=0;k.g.visible=false;k.tr.visible=false;continue;}
    k.t+=rdt;const j=wrapI(Math.floor(k.s/SEG)),w=RW+XW[j];
    if(k.st===2){k.vy-=14*rdt;k.x+=k.vx*rdt;k.z+=k.vz*rdt;k.y+=k.vy*rdt;k.b.rotation.x+=k.sp*rdt;
      if(k.y<=H[j]&&k.vy<0&&k.t>.2){k.st=1;k.b.rotation.set(0,0,0);k.y=0;k.s=wrapS(pe.s+ds);k.lat=Math.sign(k.lat||1)*(w+2);k.tl=k.lat;k.vl=0;k.v=R(3,5)*(Math.random()<.5?-1:1);continue;}   // landed: scurries away
      k.g.position.set(k.x,k.y,k.z);continue;}
    if(k.st===3){k.y+=2.4*rdt;at(k.s,k.lat,0,I_.V);I_.V.y+=k.y;k.g.position.copy(I_.V);k.g.rotation.y=yaw(j)+Math.sign(k.lat)*Math.PI/2;k.b.rotation.set(-Math.PI/2,0,Math.sin(k.t*14)*.12);k.b.position.y=0;if(k.y>26){k.st=0;k.g.visible=false;k.tr.visible=false;}continue;}   // up the trunk, head first
    if(k.climb&&k.st===1&&ds>28&&ds<130&&Math.abs(k.lat)>=w&&Math.random()<rdt*.7){k.st=3;k.y=0;k.v=0;k.lat=Math.sign(k.lat)*(w+3.2);at(k.s,Math.sign(k.lat)*(w+3.9),0,I_.V);k.tr.position.set(I_.V.x,I_.V.y+16,I_.V.z);k.tr.visible=true;continue;}   // in the redwoods: scurry up a tree
    if(k.pz>0)k.pz-=rdt;else k.s=wrapS(k.s+k.v*rdt);const dl=k.tl-k.lat;if(Math.abs(dl)<=.1&&k.pz<=0&&Math.random()<rdt*.35)k.pz=R(.4,1.3);   /* stops dead now and then */ 
    if(Math.abs(dl)>.1)k.lat+=Math.sign(dl)*Math.min(Math.abs(dl),k.vl*rdt);
    else if(Math.random()<rdt*.15&&ds>25){k.tl=-Math.sign(k.lat)*(w+R(1,3));k.vl=R(5,7);}   // dart across the road
    else if(Math.random()<rdt*.5)k.v=R(1,3)*(Math.random()<.5?-1:1);
    at(k.s,k.lat,0,I_.V);k.g.position.copy(I_.V);k.g.rotation.y=Math.abs(dl)>.1?yaw(j)+Math.sign(dl)*Math.PI/2:yaw(j)+(k.v<0?Math.PI:0);
    lizWig(k,Math.abs(dl)>.1?k.vl:k.pz>0?0:Math.abs(k.v),rdt);
    const dx=I_.V.x-PL.x,dz=I_.V.z-PL.z;if(dx*dx+dz*dz<4&&Math.abs(pe.v)>2&&!PL.crash){k.st=2;k.t=0;k.x=I_.V.x;k.z=I_.V.z;k.y=I_.V.y+.2;k.vx=PL.vx*.6+R(-2,2);k.vz=PL.vz*.6+R(-2,2);k.vy=R(7,10);k.sp=R(-8,8);sfxSqueak();}}}   // hit: flung up in an arc
// The giant iguana of San Antonio Ave: about 2.3 m long, green and turquoise, a spiny crest and a dewlap. Now and then one walks slowly out of the open field on the right
// just past 1611, its body swinging side to side (spine, tail and legs all moving), crosses the street and goes on into the gardens opposite. One the car hits is flung up, lands and walks on. Never a crash, no slowdown.
const BIGI={l:[],gaps:null,V:new THREE.Vector3()};
function bigIguMk(mar){const M=c=>std({color:c,roughness:mar?.88:.7}),gr=M(mar?0x2b2c2d:0x3f9a52),tq=M(mar?0x3b3a37:0x2bb3a3),dk=M(mar?0x161718:0x2a6a44),be=M(mar?0x4b4945:0xa9dba2),cr=M(mar?0x5e5a52:0x6fd6c0),ey=std({color:0x15110a,roughness:.3}),g=new THREE.Group(),b=new THREE.Group();g.add(b);
  const bx=(par,sx,sy,sz,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m);o.position.set(x,y,z);o.castShadow=true;par.add(o);return o;};
  const D=[[.98,.28,.19,.16,gr],[.74,.22,.23,.2,tq],[.46,.36,.34,.26,gr],[.12,.34,.36,.25,gr],[-.2,.3,.24,.19,dk],[-.46,.26,.18,.15,tq],[-.69,.24,.14,.12,dk],[-.9,.22,.11,.1,tq],[-1.08,.2,.08,.08,dk],[-1.24,.18,.05,.06,tq]],segs=[];   // the spine, head to tail tip: z, length, width, height, colour
  D.forEach(([z,l,w,h,m],n)=>{const sg=new THREE.Group();sg.position.set(0,0,z);b.add(sg);const y=.13+h/2*(n<4?1:.7);bx(sg,w,h,l+.04,m,0,y,0);if(n===2||n===3)bx(sg,w*.8,.04,l,be,0,y-h/2-.01,0);   // pale belly
    const ns=n===0?1:n<4?3:n<7?2:0;for(let q=0;q<ns;q++){const sp=bx(sg,.025,(n<4?.13:.08)*(n===0?.6:1),.05,cr,0,y+h/2+.05,l/2-(q+.5)*l/ns);sp.rotation.x=-.35;}   // spiny crest
    segs.push({g:sg,z});});
  const hd=segs[0].g;if(mar){bx(hd,.17,.12,.06,gr,0,.17,.13);bx(hd,.15,.03,.13,M(0xa8a399),0,.245,.02);}else bx(hd,.13,.1,.12,gr,0,.17,.17);   /* marine iguana (mar): dark grey-black, blunt snout, pale salt-crusted cap */
 for(const s of[-1,1]){bx(hd,.035,.045,.045,ey,s*.095,.24,.06);bx(hd,.02,.07,.07,cr,s*.097,.17,-.03);}   // snout, eyes, round cheek scales
  if(!mar)bx(segs[1].g,.03,.14,.18,tq,0,.05,.04);   // dewlap
  const legs=[];for(const[si,zz]of[[2,.08],[3,-.06]])for(const s of[-1,1]){const lg=new THREE.Group();lg.position.set(s*D[si][2]/2,.2,zz);segs[si].g.add(lg);
    bx(lg,.2,.07,.08,gr,s*.1,0,0);bx(lg,.06,.18,.07,dk,s*.2,-.08,0);bx(lg,.1,.03,.14,dk,s*.22,-.17,.04);legs.push({g:lg,s,f:si===2?1:-1});}
  g.visible=false;scene.add(g);return{g,b,segs,legs};}
function bigIguTick(rdt){const B_=BIGI,pe=ents.find(e=>e.player);if(!pe||!DRIVE)return;
  if(!B_.gaps){B_.gaps=[];for(let i=Math.ceil((Z.start+3)/9)*9;i<Z.start+Math.round(200/SEG)&&B_.gaps.length<2;i+=9)if((i/9|0)%3===1&&zoneArr[i]===1)B_.gaps.push(i);   // the open spaces between the houses on the right
    for(const i of B_.gaps)B_.l.push(Object.assign(bigIguMk(),{i,st:0,cd:B_.l.length*4,s:0,lat:0,y:0,vy:0,vs:0,vl:0,v:1,t:0,ph:0,sp:0,pz:0}));}
  for(const k of B_.l){
    if(!k.st){k.cd-=rdt;const d0=wdiff(k.i*SEG-pe.s);if(k.cd<=0&&d0>12&&d0<260){const w=RW+XW[k.i];k.st=1;k.s=k.i*SEG+R(-4,4);k.lat=-(w+R(1.5,7));k.v=R(.8,1.1);k.t=0;k.y=0;k.pz=0;k.b.rotation.set(0,0,0);k.g.visible=true;}continue;}
    const ds=wdiff(k.s-pe.s),j=wrapI(Math.floor(k.s/SEG)),w=RW+XW[j];k.t+=rdt;
    if(ds<-60||ds>420||k.lat>w+26){k.st=0;k.g.visible=false;k.cd=R(4,10);continue;}
    if(k.st===2){k.vy-=14*rdt;k.y+=k.vy*rdt;k.s=wrapS(k.s+k.vs*rdt);k.lat+=k.vl*rdt;k.b.rotation.x+=k.sp*rdt;k.b.rotation.z+=k.sp*.4*rdt;if(k.y<=0&&k.vy<0){k.y=0;k.st=1;k.b.rotation.set(0,0,0);}}   // flung up; lands and walks on
    else if(k.pz>0)k.pz-=rdt;   // stops a moment and bobs its head
    else{k.lat+=k.v*rdt;k.ph+=rdt*k.v*4.2;if(Math.random()<rdt*.12)k.pz=R(.8,2);}
    at(k.s,k.lat,0,B_.V);B_.V.y+=k.y;k.g.position.copy(B_.V);k.g.rotation.y=yaw(j)+Math.PI/2;
    const ph=k.ph,K=3.2;for(const sg of k.segs){const z=sg.z,A=.04+.1*Math.max(0,.6-z)/1.9;sg.g.position.x=A*Math.sin(ph-K*z);sg.g.rotation.y=Math.atan(-A*K*Math.cos(ph-K*z));}   // the side-to-side wave down the body and tail
    k.segs[0].g.rotation.x=k.pz>0?-Math.max(0,Math.sin(k.t*6))*.3:0;
    for(const L of k.legs){const q=Math.sin(ph)*L.s*L.f;L.g.rotation.y=q*.55;L.g.rotation.z=L.s*Math.max(0,Math.cos(ph)*L.s*L.f)*.25;}   // diagonal pairs swing together, the forward one lifted
    if(k.st===1){const dx=B_.V.x-PL.x,dz=B_.V.z-PL.z;if(dx*dx+dz*dz<2.1*2.1&&Math.abs(pe.v)>2&&!PL.crash){k.st=2;k.vy=R(6,8);k.vs=clamp(pe.v*.5,-12,12)+R(-1,1);k.vl=R(-1.5,1.5);k.sp=R(-6,6);sfxBoing(.9);}}}}
// Richmond, past the end of Shane Drive on the way to the I-80 on-ramp: a few giant iguanas (3 to 5 times the big model) slithering slowly among the trees beside
// the road, bodies and tails swinging, stopping now and then to bob their heads. They keep well off the road (visual only) (WIGU, woodIguTick).
const WIGU={l:null,V:new THREE.Vector3()};
function woodIguTick(rdt){const W_=WIGU;if(!DRIVE||!(Z.rb1>0)||!Z.refinery)return;const m_=x=>Math.round(x/SEG),a=Z.refinery-m_(80),b=Z.i80-m_(40);
  if(!W_.l){W_.l=[];const tr=[];for(const[x,z]of treePos){let bi=-1,bd=4900;for(let i=a;i<b;i+=2){const d=(P[i].x-x)**2+(P[i].z-z)**2;if(d<bd){bd=d;bi=i;}}if(bi>=0&&farFromRoad(x,z,16))tr.push([x,z,bi,bd]);}
    if(tr.length<8){const bark=std({color:0x4a3b2e,roughness:1}),lf=[0x3d5a2a,0x4a6a30,0x35502a].map(c=>std({color:c,roughness:.9,flatShading:true}));   // too few trees on this stretch: plant some oaks by the road
      for(let k=0;k<14;k++){const i=a+Math.floor((k+.5)/14*(b-a)),sd=k%2?1:-1;off(i,sd*(RW+XW[i]+R(14,34)),0,W_.V);const x=W_.V.x,z=W_.V.z;if(!farFromRoad(x,z,16))continue;
        const y=groundAt(x,z),h=R(5,8),g=new THREE.Group(),tk=new THREE.Mesh(cyl(.35,.6,h,7),bark);tk.position.y=h/2;g.add(tk);
        for(let q=0;q<4;q++){const c=new THREE.Mesh(new THREE.IcosahedronGeometry(R(2.6,3.8),0),lf[q%3]);c.position.set(R(-2,2),h+R(-.5,1.5),R(-2,2));g.add(c);}
        g.traverse(o=>{if(o.isMesh)o.castShadow=true;});g.position.set(x,y,z);scene.add(g);tr.push([x,z,i,0]);}}
    W_.tr=tr;const hm=tr.filter(p=>p[3]<45*45);if(hm.length<4)hm.push(...tr);hm.sort((p,q)=>p[2]-q[2]);const N=Math.min(4,hm.length);   // homes: trees fairly near the road, spread along the stretch
    for(let n=0;n<N;n++){const h=hm[Math.floor((n+.5)/N*hm.length)],o=bigIguMk(),sc=R(3.8,5);o.g.scale.setScalar(sc);
      W_.l.push(Object.assign(o,{sc,hx:h[0],hz:h[1],x:h[0]+R(-4,4),z:h[1]+R(-4,4),hd:R(0,6.28),tx:0,tz:0,v:R(.45,.7)*sc,ph:0,pz:R(0,2),t:R(0,5)}));}
    for(const k of W_.l){k.tx=k.x;k.tz=k.z;}}
  const near=G.state==='race'&&PL.idx>a-m_(500)&&PL.idx<b+m_(150);for(const k of W_.l)k.g.visible=near;if(!near)return;
  for(const k of W_.l){k.t+=rdt;let dx=k.tx-k.x,dz=k.tz-k.z,d=Math.hypot(dx,dz);
    if(d<1.5*k.sc&&k.pz<=0){   // there: pick somewhere else among the trees near home, never towards the road
      for(let q=0;q<8;q++){const tt=W_.tr[Math.random()*W_.tr.length|0];if((tt[0]-k.hx)**2+(tt[1]-k.hz)**2>40*40)continue;const ang=R(0,6.28),r=R(4,9),x=tt[0]+Math.cos(ang)*r,z=tt[1]+Math.sin(ang)*r;
        if(farFromRoad(x,z,13+k.sc*1.6)){k.tx=x;k.tz=z;break;}}
      if(Math.random()<.5)k.pz=R(1,2.5);dx=k.tx-k.x;dz=k.tz-k.z;d=Math.hypot(dx,dz);}
    if(k.pz>0)k.pz-=rdt;   // stops and bobs its head
    else if(d>.01){let dh=Math.atan2(dx,dz)-k.hd;dh=Math.atan2(Math.sin(dh),Math.cos(dh));k.hd+=dh*clamp(rdt*1.2,0,1);const st=k.v*rdt*(1-.6*Math.min(1,Math.abs(dh)));   // turning slowly, slithering on
      k.x+=Math.sin(k.hd)*st;k.z+=Math.cos(k.hd)*st;k.ph+=st/k.sc*4.2;if(Math.random()<rdt*.08)k.pz=R(1,2.5);}
    k.g.position.set(k.x,groundAt(k.x,k.z),k.z);k.g.rotation.y=k.hd;
    const ph=k.ph,K=3.2;for(const sg of k.segs){const z=sg.z,A=.04+.1*Math.max(0,.6-z)/1.9;sg.g.position.x=A*Math.sin(ph-K*z);sg.g.rotation.y=Math.atan(-A*K*Math.cos(ph-K*z));}   // the side-to-side wave down the body and tail
    k.segs[0].g.rotation.x=k.pz>0?-Math.max(0,Math.sin(k.t*5))*.3:0;
    for(const L of k.legs){const q=Math.sin(ph)*L.s*L.f;L.g.rotation.y=q*.55;L.g.rotation.z=L.s*Math.max(0,Math.cos(ph)*L.s*L.f)*.25;}}}
// Richmond woods past the end of Shane Drive, before the I-80 on-ramp: six fat green-and-black caterpillars (about a quarter of a car long) inching slowly across the road, a hump
// rippling down each body and the body swaying. Run one over and it squishes flat with a squelch and a splash of pink ooze. Never a crash, no slowdown (CATP, catTick).
const CATP={l:null,goo:[],V:new THREE.Vector3()};
function catMk(){const C=CATP,M=C.M||(C.M=[std({color:0x4c8a26,roughness:.5}),std({color:0x121410,roughness:.45}),std({color:0xe0d25a,roughness:.5}),std({color:0x1c2412,roughness:.4}),std({color:0x9ac26a,roughness:.6})]),
  sg=C.sg||(C.sg=new THREE.SphereGeometry(1,12,9)),g=new THREE.Group(),b=new THREE.Group();g.add(b);const segs=[],sp=(par,m,sx,sy,sz,x,y,z)=>{const o=new THREE.Mesh(sg,m);o.scale.set(sx,sy,sz);o.position.set(x,y,z);par.add(o);return o;};
  for(let n=0;n<11;n++){const z=.52-n*.1,r=n===0?.078:.094-Math.max(0,n-7)*.01,s=new THREE.Group();s.position.z=z;b.add(s);
    sp(s,n===0?M[3]:M[0],r,r*.92,r*1.08,0,r*.92,0);sp(s,M[4],r*.85,r*.3,r*.7,0,r*.32,0);   // round body segment, paler belly
    if(n>0){sp(s,M[1],r*1.02,r*.95,r*.2,0,r*.93,-.05);for(const sd of[-1,1])sp(s,M[2],.016,.016,.016,sd*r*.45,r*1.74,.01);   // a black band, two yellow spots on the back
      if(n<4||n>6)for(const sd of[-1,1])sp(s,M[3],.022,.03,.022,sd*r*.55,.03,0);}   // little stubby legs
    segs.push({g:s,z,r});}
  const hd=segs[0].g;for(const sd of[-1,1]){const a=new THREE.Mesh(cyl(.005,.007,.1,5),M[1]);a.position.set(sd*.03,.15,.03);a.rotation.set(.5,0,-sd*.4);hd.add(a);sp(hd,M[1],.012,.012,.012,sd*.045,.1,.06);}   // feelers and eyes
  g.visible=false;scene.add(g);return{g,b,segs};}
function catGoo(x,y,z,vx,vz){const C=CATP;if(!C.gm){C.gm=new THREE.MeshBasicMaterial({color:0xf07aa8});C.gs=new THREE.SphereGeometry(1,7,5);}
  for(let q=0;q<14;q++){let o=C.goo.find(p=>p.t<=0);if(!o){if(C.goo.length>60)break;o={m:new THREE.Mesh(C.gs,C.gm),t:0};scene.add(o.m);C.goo.push(o);}
    const a=R(0,6.28),u=R(.5,3.2);Object.assign(o,{t:R(.6,1.1),x,y:y+.1,z,gy:y,vx:Math.cos(a)*u+vx*.35,vz:Math.sin(a)*u+vz*.35,vy:R(1.5,4.5)});o.m.scale.setScalar(R(.04,.1));o.m.visible=true;o.m.position.set(x,y,z);}}
function catTick(rdt){const C=CATP,pe=ents.find(e=>e.player);if(!pe||!DRIVE||!(Z.rb1>0)||!Z.refinery)return;const m_=x=>Math.round(x/SEG),a=Z.refinery-m_(80),b=Z.i80-m_(40);
  for(const o of C.goo)if(o.t>0){o.t-=rdt;o.vy-=12*rdt;o.x+=o.vx*rdt;o.y+=o.vy*rdt;o.z+=o.vz*rdt;if(o.y<o.gy){o.y=o.gy;o.vy=0;o.vx*=.5;o.vz*=.5;}o.m.position.set(o.x,o.y,o.z);if(o.t<=0)o.m.visible=false;}
  if(b-a<10)return;
  if(!C.l){C.l=[];const sm=new THREE.MeshBasicMaterial({color:0xe2648f,transparent:true,opacity:.85,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),cg=new THREE.CircleGeometry(1,14).rotateX(-Math.PI/2);
    for(let n=0;n<6;n++){const k=catMk(),sl=new THREE.Group();for(let q=0;q<5;q++){const c=new THREE.Mesh(cg,sm);c.scale.set(R(.15,.35),1,R(.12,.3));c.position.set(q?R(-.4,.4):0,0,q?R(-.5,.5):0);if(!q)c.scale.set(.45,1,.6);sl.add(c);}   // the pink splat left on the road
      sl.visible=false;scene.add(sl);C.l.push(Object.assign(k,{n,sl,st:0,s:0,lat:0,hd:0,v:R(.18,.28),ph:R(0,6),pz:0,t:R(0,5)}));}}
  const near=G.state==='race'&&PL.idx>a-m_(500)&&PL.idx<b+m_(150);
  if(!near){for(const k of C.l){k.g.visible=false;k.sl.visible=false;k.st=0;}return;}
  for(const k of C.l){const j0=wrapI(Math.floor(k.s/SEG));
    if(!k.st){k.st=1;k.s=(a+(k.n+.3+R(0,.4))/C.l.length*(b-a))*SEG;const j=wrapI(Math.floor(k.s/SEG));k.lat=R(-1,1)*(edgeAt[j]-1.2);k.hd=(Math.random()<.5?1:-1)*R(1.1,1.9);k.b.scale.set(1,1,1);k.b.position.y=0;k.g.visible=true;k.sl.visible=false;}   // laid out along the stretch, crossing the road
    const j=wrapI(Math.floor(k.s/SEG));k.t+=rdt;
    if(k.st===1){if(k.pz>0)k.pz-=rdt;else{const st=k.v*rdt;k.s=wrapS(k.s+Math.cos(k.hd)*st);k.lat+=Math.sin(k.hd)*st;k.ph+=st*26;if(Math.random()<rdt*.06)k.pz=R(.8,2);}   // inching along, resting now and then
      const e=edgeAt[j]-.8;if(Math.abs(k.lat)>e&&Math.sign(k.lat)===Math.sign(Math.sin(k.hd)))k.hd+=Math.PI*R(.8,1.2);   // reached the edge of the road: turns back across
      k.hd+=Math.sin(k.t*.4+k.n)*.08*rdt;
      at(k.s,k.lat,0,C.V);k.g.position.copy(C.V);k.g.rotation.y=yaw(j)+Math.atan2(Math.sin(k.hd),Math.cos(k.hd));
      const ph=k.ph;for(const sg of k.segs){const q=ph-sg.z*9;sg.g.position.y=Math.max(0,Math.sin(q))**3*.05;sg.g.position.x=Math.sin(ph*.35-sg.z*4)*.035;sg.g.rotation.x=-Math.cos(q)*Math.max(0,Math.sin(q))*.5;}   // a hump travels from tail to head; the body sways a little
      k.segs[0].g.rotation.y=Math.sin(k.t*1.7+k.n)*.3;
      const dx=C.V.x-PL.x,dz=C.V.z-PL.z,ch=Math.sin(PL.h),cc=Math.cos(PL.h),al=dx*ch+dz*cc,ac=dx*cc-dz*ch;
      if(Math.abs(al)<2.5&&Math.abs(ac)<1.25&&Math.abs(pe.v)>1&&!PL.crash&&Math.abs(PL.cy-C.V.y)<1.5){k.st=2;   // squished: flattened, a pink splat and a spray of pink ooze
        k.b.scale.set(1.45,.2,1.15);k.b.position.y=.012;for(const sg of k.segs){sg.g.position.y=0;sg.g.rotation.x=0;}k.segs[0].g.rotation.y=0;
        at(k.s,k.lat,.005,C.V);k.sl.position.copy(C.V);k.sl.rotation.y=R(0,6.28);k.sl.visible=true;catGoo(C.V.x,C.V.y,C.V.z,PL.vx||0,PL.vz||0);sfxSquelch();}}}}
// I-80 south, the Richmond-to-Berkeley stretch, near Berkeley: a car-sized marine iguana (dark grey-black, blunt head, spiky crest). First its head rises over the edge of the elevated
// freeway, it looks about, then it hauls itself up over the rail onto the road on a random side and darts about the lanes ahead (quick dashes and pauses). Once per pass. One the car
// hits is flung up, lands and runs on. Never a crash, no slowdown (FWI, fwIguTick).
const FWI={k:null,st:0,armed:1,s0:0,V:new THREE.Vector3(),A:new THREE.Vector3(),B:new THREE.Vector3(),SC:1.85};
function fwIguStart(s0){const Q=FWI,pe=ents.find(e=>e.player);if(!pe||!DRIVE)return;if(!Q.k){Q.k=bigIguMk(1);Q.k.g.scale.setScalar(Q.SC);Q.k.g.rotation.order='YXZ';}
  const k=Q.k,j=wrapI(Math.floor(s0/SEG));Object.assign(Q,{st:1,armed:0,t:0,s:s0,sd:Math.random()<.5?-1:1,pz:0,ts:s0,tl:0,v:0,y:0,vy:0,vs:0,vl:0,sp:0,ph:0,tt:0});Q.lat=Q.sd*(8.45+XW[j]+.75);Q.l0=Q.lat;
  k.b.rotation.set(0,0,0);k.g.visible=true;sfxHiss();}
function fwIguTick(rdt){const Q=FWI,pe=ents.find(e=>e.player);if(!pe||!DRIVE||!(Z.berkeley>Z.i80))return;const m_=x=>Math.round(x/SEG),i=PL.idx;
  if(i<Z.i80-m_(100)||i>Z.berkeley+m_(500)||G.state!=='race'){if(Q.st){Q.st=0;Q.k.g.visible=false;}if(i<Z.i80-m_(100)||i>Z.berkeley+m_(500)){Q.armed=1;Q.s0=0;}return;}
  if(!Q.st){if(Q.armed){if(!Q.s0)Q.s0=Math.max(Z.i80+m_(300),Z.berkeley-m_(R(250,650)))*SEG;const d=wdiff(Q.s0-pe.s);if(d>40&&d<Math.max(150,Math.abs(pe.v)*5.5))fwIguStart(Q.s0);}return;}
  const k=Q.k,SC=Q.SC;Q.t+=rdt;let j=wrapI(Math.floor(Q.s/SEG));const ds=wdiff(Q.s-pe.s);
  if(ds<-90||ds>600||Q.t>60){Q.st=0;k.g.visible=false;Q.s0=0;return;}
  const into=Q.sd*-1,face=yaw(j)-Q.sd*Math.PI/2,ed=8.45+XW[j];let us=0,ul=0,pitch=0,mv=0;
  if(Q.st===1){const u=sst(Q.t,0,1.8);pitch=1.25;Q.y=lerp(-3.2,-.15,u);mv=Q.t<1.8?.6:0;Q.ph+=rdt*2*mv;   // clinging to the side of the viaduct, the head rises over the edge
    k.segs[0].g.rotation.y=Q.t>1.8?Math.sin((Q.t-1.8)*2.2)*.45:0;k.segs[0].g.rotation.x=Q.t>1.8?-.25:0;   // looks up and down the road
    if(Q.t>3.4){Q.st=2;Q.t=0;sfxGrunt();}}
  else if(Q.st===2){const u=sst(Q.t,0,1.6);pitch=1.25*(1-u);Q.y=lerp(-.15,0,u)+Math.sin(u*Math.PI)*.9;Q.lat=Q.l0+into*u*(1.4*SC);mv=1;Q.ph+=rdt*7;   // hauls itself up over the rail
    k.segs[0].g.rotation.set(0,0,0);if(Q.t>1.6){Q.st=3;Q.t=0;Q.y=0;Q.pz=R(.4,.9);}}
  else if(Q.st===3){if(Q.pz>0){Q.pz-=rdt;k.segs[0].g.rotation.x=-Math.max(0,Math.sin(Q.t*7))*.3;   // stops, bobs its head
      if(Q.pz<=0){const fwd=ds<30?R(30,60):R(-12,25);Q.ts=Q.s+fwd;Q.tl=R(-1,1)*(edgeAt[j]-2.2);Q.v=R(8,13);}}   // then picks a spot and dashes for it (keeping ahead of the car)
    else{const dS=wdiff(Q.ts-Q.s),dL=Q.tl-Q.lat,d=Math.hypot(dS,dL),st=Q.v*rdt;k.segs[0].g.rotation.x=0;
      if(d<=st||d<.5){Q.s=wrapS(Q.ts);Q.lat=Q.tl;Q.pz=R(.35,1.3);}else{us=dS/d*Q.v;ul=dL/d*Q.v;Q.s=wrapS(Q.s+us*rdt);Q.lat+=ul*rdt;mv=1;Q.ph+=rdt*Q.v*5/SC;}}
    Q.lat=clamp(Q.lat,-(edgeAt[j]-1.2),edgeAt[j]-1.2);}
  else if(Q.st===4){Q.vy-=14*rdt;Q.y+=Q.vy*rdt;Q.s=wrapS(Q.s+Q.vs*rdt);Q.lat=clamp(Q.lat+Q.vl*rdt,-(edgeAt[j]-1.2),edgeAt[j]-1.2);k.b.rotation.x+=Q.sp*rdt;k.b.rotation.z+=Q.sp*.4*rdt;us=Q.vs;ul=Q.vl;   // flung up
    if(Q.y<=0&&Q.vy<0){Q.y=0;k.b.rotation.set(0,0,0);Q.st=3;Q.pz=R(.3,.7);}}
  j=wrapI(Math.floor(Q.s/SEG));at(Q.s,Q.lat,0,Q.V);Q.V.y+=Q.y;k.g.position.copy(Q.V);
  if(Q.st<3)k.g.rotation.set(-pitch,face,0);
  else{const n=Math.hypot(us,ul);if(n>1e-3&&Q.st===3){const u=us/n,w=ul/n;at(Q.s+u*2,Q.lat+w*2,0,Q.A);at(Q.s-u*2,Q.lat-w*2,0,Q.B);k.g.rotation.set(-Math.atan2(Q.A.y-Q.B.y,Math.hypot(Q.A.x-Q.B.x,Q.A.z-Q.B.z)),Math.atan2(Q.A.x-Q.B.x,Q.A.z-Q.B.z),0);}}
  const ph=Q.ph,K=3.2;for(const sg of k.segs){const z=sg.z,A=(.04+.1*Math.max(0,.6-z)/1.9)*(.4+.6*mv);sg.g.position.x=A*Math.sin(ph-K*z);if(sg!==k.segs[0]||Q.st>=2)sg.g.rotation.y=Math.atan(-A*K*Math.cos(ph-K*z));}   // body and tail swinging
  for(const L of k.legs){const q=Math.sin(ph)*L.s*L.f;L.g.rotation.y=q*.55;L.g.rotation.z=L.s*Math.max(0,Math.cos(ph)*L.s*L.f)*.25;}
  if(Q.st===3){const dx=Q.V.x-PL.x,dz=Q.V.z-PL.z,ch=Math.sin(PL.h),cc=Math.cos(PL.h),al=dx*ch+dz*cc,ac=dx*cc-dz*ch;
    if(Math.abs(al)<2.2+1.6*SC*.6&&Math.abs(ac)<1+.25*SC&&Math.abs(pe.v)>2&&!PL.crash){Q.st=4;Q.vy=R(8,10);Q.vs=clamp(pe.v*.6,-16,16)+R(-1,2);Q.vl=(Math.sign(ac)||1)*R(1,3);Q.sp=R(-5,5);Q.pz=0;sfxBoing(1);sfxGrunt();}}}
// Iguanas on top of the Posey Tube's portal: a little group on the flat roof between the two towers, darting about, stopping, bobbing their heads. Visual only.
const TUBI={g:null,l:[]};
function tubeIguTick(rdt){const T_=TUBI;if(!DRIVE)return;
  if(!T_.g){T_.g=new THREE.Group();T_.g.position.copy(P[Z.tu0]);T_.g.position.y+=16*1.3;T_.g.rotation.y=yaw(Z.tu0);scene.add(T_.g);
    for(let n=0;n<7;n++){const{g,b,segs,legs}=lizMk();g.visible=true;g.scale.setScalar(.8);T_.g.add(g);const k={g,b,segs,legs,ph:0,x:R(-4.6,4.6),z:R(.8,8.2),tx:0,tz:0,st:0,w:R(0,2),t:R(0,5),v:0};g.position.set(k.x,0,k.z);g.rotation.y=R(0,6.28);T_.l.push(k);}}
  const near=PL.idx>Z.tu0-Math.round(500/SEG)&&PL.idx<Z.tu0+5;T_.g.visible=near;if(!near)return;
  for(const k of T_.l){k.t+=rdt;
    if(k.st===0){k.w-=rdt;const bob=Math.max(0,Math.sin(k.t*7))*(Math.sin(k.t*.9+k.x)>0?1:0);k.b.rotation.set(-bob*.2,0,0);k.b.position.y=bob*.03;
      if(k.w<=0){k.st=1;k.tx=clamp(k.x+R(-3,3),-4.6,4.6);k.tz=clamp(k.z+R(-3,3),.8,8.2);k.v=R(2.5,4.5);k.g.rotation.y=Math.atan2(k.tx-k.x,k.tz-k.z);}}
    else{const dx=k.tx-k.x,dz=k.tz-k.z,d=Math.hypot(dx,dz),st=k.v*rdt;if(d<=st){k.x=k.tx;k.z=k.tz;k.st=0;k.w=R(.6,3);}else{k.x+=dx/d*st;k.z+=dz/d*st;}
      k.b.position.y=0;k.b.rotation.set(0,0,0);lizWig(k,k.v,rdt);}
    k.g.position.set(k.x,0,k.z);}}
// Richmond's iguanas: big ones (the San Antonio model at twice-plus size) scurrying up and down both pavements from the San Rafael bridge through Shane Drive to I-80, stopping now and then
// to bob their heads. Every so often one darts out across the road ahead of the car; one the car hits is flung up, lands and runs on to the kerb. Never a crash, no slowdown (RIGI, rigiTick).
const RIGI={l:[],cd:4,V:new THREE.Vector3(),A:new THREE.Vector3(),B:new THREE.Vector3(),SC:1};
function rigiTick(rdt){const Q=RIGI,pe=ents.find(e=>e.player);if(!pe||!DRIVE||!(Z.rb1>0))return;const m_=x=>Math.round(x/SEG),a=Z.rb1+m_(30),b=Z.i80-m_(20),SC=Q.SC,pv=wrapI(Math.floor(pe.s/SEG));
  const inR=i=>i>=a&&i<b,pl=j=>6.6+XW[j]+1.5;   // the middle of the pavement
  if(!Q.l.length)for(let n=0;n<7;n++){const k=Object.assign(lizMk(),{st:0,cd:0,s:0,lat:0,tl:0,dir:1,y:0,vy:0,vs:0,vl:0,v:4,t:0,ph:R(0,6),sp:0,pz:0,fr:1});k.g.scale.setScalar(SC);k.g.rotation.order='YXZ';Q.l.push(k);}
  const near=pv>=a-m_(400)&&pv<b+m_(60);
  if(!near){for(const k of Q.l)if(k.st){k.st=0;k.g.visible=false;k.fr=1;}return;}
  const spawn=(k,s,side)=>{const j=wrapI(Math.floor(s/SEG));k.st=1;k.s=s;k.lat=side*pl(j)+R(-.6,.6);k.dir=Math.random()<.5?1:-1;k.v=R(3.5,6.5);k.y=0;k.pz=0;k.t=0;k.b.rotation.set(0,0,0);k.g.visible=true;};
  for(const k of Q.l)if(!k.st){k.cd-=rdt;if(k.cd>0)continue;const s=wrapS(pe.s+(k.fr?R(-30,320):R(200,380))),j=wrapI(Math.floor(s/SEG));if(inR(j)){spawn(k,s,Math.random()<.5?1:-1);k.fr=0;}else k.cd=R(.5,1.5);}
  Q.cd-=rdt;if(Q.cd<=0&&inR(pv)){Q.cd=R(3.5,7);const lo=Math.max(30,Math.abs(pe.v)*1.6),hi=lo+50;   // one darts out into the road ahead
    let k=Q.l.find(k=>k.st===1&&(d=>d>lo&&d<hi)(wdiff(k.s-pe.s)));if(!k){k=Q.l.find(k=>k.st===1&&wdiff(k.s-pe.s)<-20)||Q.l.find(k=>k.st===1&&wdiff(k.s-pe.s)>hi+80);if(k){const s=wrapS(pe.s+R(lo,hi));if(inR(wrapI(Math.floor(s/SEG))))spawn(k,s,Math.random()<.5?1:-1);else k=null;}}
    if(k){const j=wrapI(Math.floor(k.s/SEG)),sd=Math.sign(k.lat)||1;k.st=3;k.tl=-sd*pl(j);k.turn=Math.random()<.3?R(1.5,3.5):0;k.v=R(5,7.5);k.pz=0;}}
  for(const k of Q.l){if(!k.st)continue;const ds=wdiff(k.s-pe.s),j=wrapI(Math.floor(k.s/SEG));k.t+=rdt;
    if(ds<-60||ds>450||(k.st===1&&!inR(j))){k.st=0;k.g.visible=false;k.cd=R(.5,3);continue;}
    let us=0,ul=0;
    if(k.st===2){k.vy-=14*rdt;k.y+=k.vy*rdt;k.s=wrapS(k.s+k.vs*rdt);k.lat+=k.vl*rdt;k.b.rotation.x+=k.sp*rdt;k.b.rotation.z+=k.sp*.4*rdt;us=k.vs;ul=k.vl;
      if(k.y<=0&&k.vy<0){k.y=0;k.b.rotation.set(0,0,0);const jj=wrapI(Math.floor(k.s/SEG));k.st=3;k.turn=0;k.tl=(Math.sign(k.lat)||1)*pl(jj);k.v=R(5,7);}}   // flung up; lands and runs on to the nearest pavement
    else if(k.pz>0){k.pz-=rdt;us=k.dir*.01;}   // stops a moment and bobs its head
    else if(k.st===1){k.s=wrapS(k.s+k.dir*k.v*rdt);k.lat+=(Math.sign(k.lat)*pl(j)-k.lat)*clamp(rdt*.5,0,1);us=k.dir*k.v;ul=Math.sin(k.t*.7+k.ph)*.4;k.lat+=ul*rdt;k.ph+=rdt*k.v*5/SC;if(Math.random()<rdt*.1)k.pz=R(.6,1.6);if(Math.random()<rdt*.04)k.dir=-k.dir;}
    else{const dl=k.tl-k.lat,st=k.v*rdt;if(k.turn>0&&Math.abs(k.lat)<k.turn){k.tl=-k.tl;k.turn=0;}   // across the road (sometimes it thinks better of it halfway and turns back)
      if(Math.abs(dl)<=st){k.lat=k.tl;k.st=1;}else{k.lat+=Math.sign(dl)*st;ul=Math.sign(dl)*k.v;us=k.dir*k.v*.35;k.s=wrapS(k.s+us*rdt);}k.ph+=rdt*k.v*5/SC;}
    const al=Math.abs(k.lat),h=al>6.6+XW[j]&&al<9.6+XW[j]?.13:0;at(k.s,k.lat,h,Q.V);Q.V.y+=k.y;k.g.position.copy(Q.V);
    const n=Math.hypot(us,ul);if(n>1e-4&&k.st!==2){const u=us/n,w=ul/n;at(k.s+u*2,k.lat+w*2,0,Q.A);at(k.s-u*2,k.lat-w*2,0,Q.B);   // faces the way it runs, nose up or down with the slope
      k.g.rotation.set(-Math.atan2(Q.A.y-Q.B.y,Math.hypot(Q.A.x-Q.B.x,Q.A.z-Q.B.z)),Math.atan2(Q.A.x-Q.B.x,Q.A.z-Q.B.z),0);}
    const ph=k.ph,K=3.2,mv=k.pz>0||k.st===2?0:1;for(const sg of k.segs){const z=sg.z,A=(.04+.1*Math.max(0,.6-z)/1.9)*(.4+.6*mv);sg.g.position.x=A*Math.sin(ph-K*z);sg.g.rotation.y=Math.atan(-A*K*Math.cos(ph-K*z));}   // body and tail swinging
    k.segs[0].g.rotation.x=k.pz>0?-Math.max(0,Math.sin(k.t*6))*.3:0;
    for(const L of k.legs){const q=Math.sin(ph)*L.s*L.f;L.g.rotation.y=q*.55;L.g.rotation.z=L.s*Math.max(0,Math.cos(ph)*L.s*L.f)*.25;}
    if(k.st!==2){const dx=Q.V.x-PL.x,dz=Q.V.z-PL.z;if(dx*dx+dz*dz<1.9*1.9&&Math.abs(pe.v)>2&&!PL.crash){k.st=2;k.vy=R(7,9.5);k.vs=clamp(pe.v*.5,-12,12)+R(-1,1);k.vl=R(-2,2);k.sp=R(-6,6);k.pz=0;sfxBoing(.9);}}}}
// Stuck on the Bay drive (off the road, or wedged and barely moving with the throttle down for a few seconds): a giant iguana scuttles in, puts its head to the car and shoves it
// smoothly back onto the road, facing along it, in the lane by the edge; a bump and a grunt, then it bobs its head and scuttles off. Never a crash (NUDG: nudgeTick, nudgeCarry).
const NUDG={k:null,on:0,stk:0,ph:0,t:0,SC:2.4,V:new THREE.Vector3(),A:new THREE.Vector3(),B:new THREE.Vector3()};
function sfxGrunt(){if(!AC)return;const t=AC.currentTime;tone('sawtooth',72,t,.45,.35,master,{to:48,h:.25});tone('square',55,t+.05,.35,.2,master,{to:40});hit(t,.3,.3,500,'lowpass',master);}
function nudgeStart(){const Q=NUDG,pe=ents.find(e=>e.player);if(!DRIVE||!pe||Q.on||PL.crash)return;const m_=x=>Math.round(x/SEG);
  if(!Q.k){Q.k=bigIguMk();Q.k.g.scale.setScalar(Q.SC);Q.k.g.rotation.order='YXZ';}
  const sd=Math.sign(pe.lat)||1,j1=wrapI(PL.idx+m_(6)),ed=edgeAt[j1],l1=sd*Math.max(1.6,Math.min(Math.abs(pe.lat),ed-2.6)),dS=wdiff(j1*SEG-pe.s),dl=l1-pe.lat,n=Math.hypot(dS,dl)||1;
  Object.assign(Q,{on:1,ph:0,t:0,s0:pe.s,l0:pe.lat,dS,l1,h0:PL.h,dH:((yaw(j1)-PL.h+Math.PI*3)%(Math.PI*2))-Math.PI,ux:dS/n,ul:dl/n,R:Q.SC*1.15+2.3,D:clamp(n/5,1.4,3),aph:0});
  Q.is=pe.s-Q.ux*(Q.R+16);Q.il=pe.lat-Q.ul*(Q.R+16);Q.k.b.rotation.set(0,0,0);Q.k.g.visible=true;}
function nudgeCarry(dt,pe){const Q=NUDG;if(!Q.on||Q.ph>1)return false;   // the car is held, then slid across, while the iguana does its work
  const u=Q.ph===1?sst(Q.t,0,Q.D):0,s=wrapS(Q.s0+Q.dS*u),lat=lerp(Q.l0,Q.l1,u),i=PL.idx=wrapI(Math.floor(s/SEG));
  pe.dist+=wdiff(s-pe.s);pe.s=s;pe.lat=lat;pe.v=0;at(s,lat,0,V);PL.x=V.x;PL.z=V.z;const e=RW+XW[i],al=Math.abs(lat);
  GY=PL.gy=PL.cy=V.y+((KB[i]&(lat>0?1:2))&&al>e+.25&&al<e+3.1?.13:0);PL.air=0;PL.vy=0;PL.slope=0;PL.vx=PL.vz=0;PL.h=Q.h0+Q.dH*u;VS.u=VS.v=VS.r=0;
  hero.position.set(PL.x,PL.cy,PL.z);hero.rotation.set(0,PL.h,Q.ph===1?Math.sin(Q.t*11)*.015:0);return true;}
function nudgeTick(rdt){const Q=NUDG,pe=ents.find(e=>e.player);if(!DRIVE||!pe)return;
  if(!Q.on){const off=Math.abs(pe.lat)>edgeAt[PL.idx]+.5,thr=PL.thr>.3||keys.KeyX,ok=G.state==='race'&&!PL.crash&&!PL.auto&&!MOSQ.lift&&!PL.air&&Math.abs(wdiff(pe.s-S0))>40;
    Q.stk=ok&&Math.abs(pe.v)<2&&(thr||off)?Q.stk+rdt*(thr?1:.5):Math.max(0,Q.stk-rdt*2);if(Q.stk>=4){Q.stk=0;nudgeStart();}return;}
  const k=Q.k;Q.t+=rdt;if(PL.crash||G.state!=='race'){Q.on=0;k.g.visible=false;return;}
  let s,l,us=Q.ux,ul=Q.ul,mv=1,bob=0;const cs=Q.ph<=1?pe.s:0,cl=pe.lat;
  if(Q.ph===0){const ts=cs-Q.ux*Q.R,tl=cl-Q.ul*Q.R,ds=wdiff(ts-Q.is),dl=tl-Q.il,d=Math.hypot(ds,dl),st=9*rdt;   // scuttles in from behind the car
    if(d<=st||Q.t>4){Q.is=ts;Q.il=tl;Q.ph=1;Q.t=0;sfxGrunt();sfxScrape(.7);G.shake=Math.max(G.shake,.3);say('AN IGUANA GIVES YOU A PUSH','',2.2);}else{Q.is+=ds/d*st;Q.il+=dl/d*st;us=ds;ul=dl;}s=Q.is;l=Q.il;Q.aph+=rdt*9*5/Q.SC;}
  else if(Q.ph===1){s=cs-Q.ux*Q.R;l=cl-Q.ul*Q.R;Q.aph+=rdt*Math.hypot(Q.dS,Q.l1-Q.l0)/Q.D*5/Q.SC*1.6;if(Math.random()<rdt*3)sfxScrape(.35);   // head down, pushing
    if(Q.t>=Q.D){Q.ph=2;Q.t=0;Q.is=s;Q.il=l;sfxThump(.7);G.shake=Math.max(G.shake,.45);sfxGrunt();resetVehicle(VS,hero.M.dyn,0);VS.x=PL.x;VS.z=PL.z;VS.h=PL.h;PL.safe=Math.max(PL.safe,2);}}
  else if(Q.ph===2){s=Q.is;l=Q.il;mv=0;bob=1;if(Q.t>1.4){Q.ph=3;Q.t=0;}}   // bobs its head
  else{const a=Math.min(1,Q.t*2),bs=-Q.ux,bl=-Q.ul,qs=Q.ul*(Q.l0>0?-1:1)*.5,ql=-Q.ux*.5;us=lerp(Q.ux,bs+qs,a);ul=lerp(Q.ul,bl+ql,a);const n=Math.hypot(us,ul)||1;Q.is+=us/n*8*rdt*a;Q.il+=ul/n*8*rdt*a;s=Q.is;l=Q.il;Q.aph+=rdt*8*5/Q.SC;   // turns and scuttles off
    if(Q.t>3){Q.on=0;k.g.visible=false;return;}}
  const j=wrapI(Math.floor(wrapS(s)/SEG)),al=Math.abs(l);at(s,l,al>6.6+XW[j]&&al<9.6+XW[j]?.13:0,Q.V);k.g.position.copy(Q.V);
  const n=Math.hypot(us,ul)||1,uu=us/n,ww=ul/n;at(s+uu*2,l+ww*2,0,Q.A);at(s-uu*2,l-ww*2,0,Q.B);k.g.rotation.set(-Math.atan2(Q.A.y-Q.B.y,Math.hypot(Q.A.x-Q.B.x,Q.A.z-Q.B.z)),Math.atan2(Q.A.x-Q.B.x,Q.A.z-Q.B.z),0);
  const ph=Q.aph,K=3.2;for(const sg of k.segs){const z=sg.z,A=(.04+.1*Math.max(0,.6-z)/1.9)*(.4+.6*mv);sg.g.position.x=A*Math.sin(ph-K*z);sg.g.rotation.y=Math.atan(-A*K*Math.cos(ph-K*z));}
  k.segs[0].g.rotation.x=bob?-Math.max(0,Math.sin(Q.t*6))*.3:Q.ph===1?.15:0;
  for(const L of k.legs){const q=Math.sin(ph)*L.s*L.f*mv;L.g.rotation.y=q*.55;L.g.rotation.z=L.s*Math.max(0,Math.cos(ph)*L.s*L.f)*.25*mv;}}
// More iguanas, in Alameda (the streets before the Posey Tube) and Richmond: now and then a family crosses the road ahead, a big one leading 2-4 babies in a wobbly line (they wait
// when she stops to bob her head); any the car hits is flung up, lands and runs on (never a crash, no slowdown). And a few cling to the parked cars (roof and bonnet) and the houses
// beside the road, up and down the front walls and along the roof ridges, bodies flat to the surface, bobbing their heads now and then. Visual only (IGF, IGC, iguMoreTick).
const IGF={l:[],on:0,cd:3,V:new THREE.Vector3(),A:new THREE.Vector3(),B:new THREE.Vector3()},IGC={l:[],P:null,M:new THREE.Matrix4(),Q:new THREE.Quaternion(),W:new THREE.Vector3(),X:new THREE.Vector3(),N:new THREE.Vector3(),F:new THREE.Vector3()};
function iguGait(k,mv){const ph=k.ph,K=3.2;for(const sg of k.segs){const z=sg.z,A=(.04+.1*Math.max(0,.6-z)/1.9)*(.4+.6*mv);sg.g.position.x=A*Math.sin(ph-K*z);sg.g.rotation.y=Math.atan(-A*K*Math.cos(ph-K*z));}
  k.segs[0].g.rotation.x=k.pz>0?-Math.max(0,Math.sin(k.t*6))*.3:0;for(const L of k.legs){const q=Math.sin(ph)*L.s*L.f;L.g.rotation.y=q*.55*mv;L.g.rotation.z=L.s*Math.max(0,Math.cos(ph)*L.s*L.f)*.25*mv;}}
const igcY=z=>z<.8?1.44:z>1.15?.94:lerp(1.44,.94,(z-.8)/.35);   // parked car: roof, then down the windscreen to the bonnet
function igcTarget(k){const U=k.p.g.userData.ig;
  if(k.m==='c'){if(Math.random()<.7){k.tx=R(-.45,.45);k.tz=R(-1.1,.6);}else{k.tx=R(-.5,.5);k.tz=R(1.35,1.95);}k.ty=igcY(k.tz);}
  else if(k.m==='w'){k.tx=R(-U.w/2+1.3,U.w/2-1.3);k.ty=R(U.y0+1,U.top-.8);k.tz=U.d/2+.1;}
  else{const y=U.top+U.rh;if(U.ax==='z'){k.tx=0;k.tz=R(-U.d/2+.5,U.d/2-.5);}else{k.tz=0;k.tx=R(-U.w/2+.8,U.w/2-.8);}k.ty=y;}}
function iguMoreTick(rdt){const pe=ents.find(e=>e.player);if(!pe||!DRIVE)return;const m_=x=>Math.round(x/SEG),pv=wrapI(Math.floor(pe.s/SEG)),
    ala=i=>i<Z.tu0&&zoneArr[i]===1,ric=i=>Z.rb1>0&&i>=Z.rb1+m_(30)&&i<Z.i80-m_(20),inA=ala(pv),inR=ric(pv);
  const F=IGF;if(!F.l.length)for(let n=0;n<5;n++){const k=Object.assign(lizMk(),{n,st:0,s:0,lat:0,tl:0,dir:1,y:0,vy:0,vs:0,vl:0,v:3,t:0,ph:R(0,6),sp:0,pz:0,wb:0,sc:1,fu:0,fl:1});k.g.rotation.order='YXZ';if(n)k.g.traverse(o=>{o.castShadow=false;});F.l.push(k);}
  if(!F.on){F.cd-=rdt;if(F.cd<=0&&(inA||inR)){F.cd=R(6,12);const lo=Math.max(35,Math.abs(pe.v)*1.8),s=wrapS(pe.s+R(lo,lo+45)),j=wrapI(Math.floor(s/SEG));   // a family sets off across the road ahead
      if(inA?ala(j):ric(j)){const sd=Math.random()<.5?1:-1,w=(inR?6.6:RW)+XW[j],nb=2+(Math.random()*3|0),v=R(3,4.2),sa=R(1,1.1);F.on=1;F.ric=inR;
        F.l.forEach((k,n)=>{if(n>nb){k.st=0;k.g.visible=false;return;}k.sc=n?R(.45,.55):sa;k.g.scale.setScalar(k.sc);k.st=1;k.s=wrapS(s+(n?R(-.5,.5):0));
          k.lat=sd*(w+1.5+(n?sa*1.4+.4+(n-1)*1.1:0));k.dir=-sd;k.tl=-sd*(w+R(12,16));k.v=v;k.wb=R(0,6);k.y=0;k.pz=0;k.t=0;k.fu=0;k.fl=-sd;k.b.rotation.set(0,0,0);k.g.visible=true;});}}}
  else{const L0=F.l[0],hold=L0.st===1&&L0.pz>0;let live=0;
    for(const k of F.l){if(!k.st)continue;const ds=wdiff(k.s-pe.s);k.t+=rdt;if(ds<-40||ds>450){k.st=0;k.g.visible=false;continue;}let mv=0;
      if(k.st===2){k.vy-=14*rdt;k.y+=k.vy*rdt;k.s=wrapS(k.s+k.vs*rdt);k.lat+=k.vl*rdt;k.b.rotation.x+=k.sp*rdt;k.b.rotation.z+=k.sp*.4*rdt;if(k.y<=0&&k.vy<0){k.y=0;k.st=1;k.pz=0;k.b.rotation.set(0,0,0);}}   // flung up; lands and runs on
      else if(k.pz>0)k.pz-=rdt;   // the big one stops a moment and bobs her head
      else if(!(k.n&&hold)){const vv=k.v*(1+.15*Math.sin(k.t*3+k.wb)),ul=k.dir*vv,us=Math.sin(k.t*2.4+k.wb)*(k.n?.7:.3);k.lat+=ul*rdt;k.s=wrapS(k.s+us*rdt);k.ph+=rdt*vv*5/k.sc;mv=1;k.fu=us;k.fl=ul;
        if(!k.n&&Math.random()<rdt*.15)k.pz=R(.5,1.1);if((k.tl-k.lat)*k.dir<=0){k.st=0;k.g.visible=false;continue;}}
      live++;const j=wrapI(Math.floor(k.s/SEG)),al=Math.abs(k.lat),h=F.ric&&al>6.6+XW[j]&&al<9.6+XW[j]?.13:0;at(k.s,k.lat,h,F.V);F.V.y+=k.y;k.g.position.copy(F.V);
      if(k.st!==2){const n=Math.hypot(k.fu,k.fl)||1,u=k.fu/n,w=k.fl/n;at(k.s+u*2,k.lat+w*2,0,F.A);at(k.s-u*2,k.lat-w*2,0,F.B);k.g.rotation.set(-Math.atan2(F.A.y-F.B.y,Math.hypot(F.A.x-F.B.x,F.A.z-F.B.z)),Math.atan2(F.A.x-F.B.x,F.A.z-F.B.z),0);}
      iguGait(k,mv);
      if(k.st===1){const dx=F.V.x-PL.x,dz=F.V.z-PL.z,r=.8+1.2*k.sc;if(dx*dx+dz*dz<r*r&&Math.abs(pe.v)>2&&!PL.crash){k.st=2;k.vy=R(6,8)*(k.n?.8:1.1);k.vs=clamp(pe.v*.5,-12,12)+R(-1,1);k.vl=R(-1.5,1.5);k.sp=R(-6,6);k.pz=0;sfxBoing(.9);}}}
    if(!live)F.on=0;}
  // the climbers
  const C=IGC;if(!C.P){C.P=[];const ok=g=>g.parent===scene||!g.children.length;   // still standing (baked into the merged scenery, its group keeps the transform), not taken away while building
    for(const p of IGCL.h)if(ok(p.g)&&p.g.userData.ig)C.P.push({g:p.g,i:p.i,k:'h',u:0});for(const p of IGCL.c)if(ok(p.g))C.P.push({g:p.g,i:p.i,k:'c',u:0});
    for(let n=0;n<5;n++)C.l.push(Object.assign(lizMk(),{st:0,p:null,m:'',cd:n*.3,t:0,ph:R(0,6),pz:0,x:0,y:0,z:0,tx:0,ty:0,tz:0,v:1,sc:1,fr:1}));}
  const reg=inA||inR;
  for(const k of C.l){
    if(k.st){const d=wdiff(k.p.i*SEG-pe.s);if(d<-30||d>360||!reg){k.st=0;k.p.u=0;k.g.visible=false;k.cd=R(.3,1.5);if(!reg)k.fr=1;}}
    if(!k.st){k.cd-=rdt;if(k.cd>0||!reg)continue;k.cd=R(.4,1.2);const lo=k.fr?10:80,c=[];for(const p of C.P){if(p.u)continue;const d=wdiff(p.i*SEG-pe.s);if(d>lo&&d<300&&(ala(p.i)||ric(p.i)))c.push(p);}
      if(!c.length)continue;const p=c[Math.random()*c.length|0];k.fr=0;p.u=1;k.p=p;k.st=1;k.g.visible=true;p.g.updateMatrixWorld();k.t=0;k.pz=R(0,1.5);
      k.m=p.k==='c'?'c':Math.random()<.35?'r':'w';k.sc=k.m==='c'?R(.8,.9):R(.85,1);k.g.scale.setScalar(k.sc);k.v=R(.7,1.3);
      igcTarget(k);k.x=k.tx;k.y=k.ty;k.z=k.tz;igcTarget(k);k.d0=1;}
    k.t+=rdt;let mv=0;
    if(k.pz>0){k.pz-=rdt;if(k.pz<=0)igcTarget(k);}   // stops, bobs its head, then sets off somewhere else
    else{const dx=k.tx-k.x,dy=k.ty-k.y,dz=k.tz-k.z,d=Math.hypot(dx,dy,dz),st=k.v*rdt;mv=1;k.ph+=rdt*k.v*5/k.sc;
      if(d<=st){k.x=k.tx;k.y=k.ty;k.z=k.tz;k.pz=R(.8,3);}else{k.x+=dx/d*st;k.y+=dy/d*st;k.z+=dz/d*st;if(k.m==='c')k.y=igcY(k.z);}
      if(d>.01||k.d0){k.d0=0;if(k.m==='w'){C.N.set(0,0,1);C.F.set(dx,dy,0);}else{C.N.set(0,1,0);C.F.set(dx,0,dz);}if(C.F.lengthSq()<1e-6)C.F.set(0,k.m==='w'?1:0,k.m==='w'?0:1);C.F.normalize();   // body flat to the wall, roof or car
        C.X.crossVectors(C.N,C.F);C.M.makeBasis(C.X,C.N,C.F);C.Q.setFromRotationMatrix(C.M);k.g.quaternion.copy(k.p.g.quaternion).multiply(C.Q);}}
    k.g.position.copy(C.W.set(k.x,k.y,k.z).applyMatrix4(k.p.g.matrixWorld));iguGait(k,mv);}}
// Shooting stars: at night (clear sky only) an occasional bright streak crosses the sky. One pooled line, child of the sky dome, vertices rewritten in place.
const SHOOT={t:0,dur:1,len:600,cd:6,l:null,p:null,o:new THREE.Vector3(),d:new THREE.Vector3(),h:new THREE.Vector3(),q:new THREE.Vector3()};
function shootTick(rdt){const S_=SHOOT,u=skyMat.uniforms;if(!S_.l){const g=new THREE.BufferGeometry();S_.p=new Float32Array(6);g.setAttribute('position',new THREE.BufferAttribute(S_.p,3));
    S_.l=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0,fog:false,depthWrite:false}));S_.l.frustumCulled=false;S_.l.visible=false;sky.add(S_.l);}
  if(S_.t>0){S_.t-=rdt;const k=clamp(1-S_.t/S_.dur,0,1);S_.h.copy(S_.o).addScaledVector(S_.d,k*S_.len);S_.q.copy(S_.o).addScaledVector(S_.d,Math.max(0,k-.25)*S_.len);
    S_.p[0]=S_.q.x;S_.p[1]=S_.q.y;S_.p[2]=S_.q.z;S_.p[3]=S_.h.x;S_.p[4]=S_.h.y;S_.p[5]=S_.h.z;S_.l.geometry.attributes.position.needsUpdate=true;S_.l.material.opacity=Math.sin(Math.PI*k)*.9;if(S_.t<=0)S_.l.visible=false;return;}
  if(!(u.night.value>.9&&u.cov.value<.6))return;S_.cd-=rdt;if(S_.cd>0)return;S_.cd=R(8,25);
  const az=R(0,6.283),el=R(.35,1.0);S_.o.set(Math.cos(az)*Math.cos(el),Math.sin(el),Math.sin(az)*Math.cos(el)).multiplyScalar(3300);
  S_.d.set(R(-1,1),R(-.5,-.2),R(-1,1)).normalize();S_.len=R(500,900);S_.dur=R(.5,.9);S_.t=S_.dur;S_.l.visible=true;}
function tumbleTick(rdt){const T_=TUMB,pe=ents.find(e=>e.player);if(!pe)return;
  if(!T_.l.length){const mats=[0x9c7a48,0x86663a,0xb08c58].map(c=>new THREE.MeshBasicMaterial({color:c,wireframe:true}));
    for(let k=0;k<24;k++){const g=new THREE.Group(),r=k%4===0?R(1.1,1.7):k%4===1?R(.6,1):k%4===2?R(.3,.5):R(.14,.28);   // small, middling and big ones
     const sh=k%4,sq=sh===1?[1.2,.72,1.05]:sh===2?[1.25,.95,.8]:[R(.9,1.1),R(.85,1.05),R(.9,1.1)];g.scale.set(...sq);   // round, squashed flat, lopsided, or a clump of two or three balls
     const lumps=sh===3?[[0,0,0,1],[r*.7,-r*.15,r*.2,.62],[-r*.35,r*.25,-r*.55,.5]]:sh===2?[[0,0,0,1],[r*.45,r*.1,0,.7]]:[[0,0,0,1]];
     for(const[x,y,z,f]of lumps)for(let q=0;q<3;q++){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(r*f*R(.7,1),1),mats[q]);m.position.set(x,y,z);m.scale.set(R(.8,1.2),R(.75,1.15),R(.8,1.2));m.rotation.set(R(0,6),R(0,6),R(0,6));g.add(m);}
      const core=new THREE.Mesh(new THREE.IcosahedronGeometry(r*.45,0),new THREE.MeshStandardMaterial({color:0x6e5530,roughness:1,transparent:true,opacity:.55}));g.add(core);
      {const pts=[];for(let q=0;q<6+(r*5|0);q++){let a=R(0,6.3),b=R(-1.2,1.2),d=r*R(.8,1);let x=Math.cos(a)*Math.cos(b)*d,y=Math.sin(b)*d,z=Math.sin(a)*Math.cos(b)*d;const L=r*R(.4,1.1);for(let e=0;e<3;e++){const nx=x+(x/d)*L/3+R(-.12,.12)*r,ny=y+(y/d)*L/3-L*.08,nz=z+(z/d)*L/3+R(-.12,.12)*r;pts.push(x,y,z,nx,ny,nz);x=nx;y=ny;z=nz;}}   // loose wiry strands sticking out and trailing off
        const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));g.add(new THREE.LineSegments(lg,T_.lm||(T_.lm=new THREE.LineBasicMaterial({color:0x8a6a3c}))));}
      g.visible=false;scene.add(g);T_.l.push({g,r,st:0,s:0,lat:0,dir:1,v:0,y:0,vy:0,ds:0});}
    // bits that snap off: a small pool of short twiggy strands that fall away and fade
    T_.bits=[];for(let q=0;q<48;q++){const lg=new THREE.BufferGeometry();const p=[];let x=0,y=0,z=0;for(let e=0;e<3;e++){const nx=x+R(-.18,.18),ny=y+R(-.18,.18),nz=z+R(-.18,.18);p.push(x,y,z,nx,ny,nz);x=nx;y=ny;z=nz;}lg.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
      const m=new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0x9c7a48,transparent:true,opacity:1}));m.visible=false;m.frustumCulled=false;scene.add(m);T_.bits.push({m,t:0,vx:0,vy:0,vz:0,w:0});}}
  const snap=(k,n,kick)=>{for(let q=0;q<n;q++){const b=T_.bits.find(o=>o.t<=0);if(!b)return;b.t=R(1.2,2.2);b.m.visible=true;b.m.material.opacity=1;b.m.position.copy(k.g.position).add(T_.W.set(R(-1,1),R(-.6,1),R(-1,1)).multiplyScalar(k.r));b.m.rotation.set(R(0,6),R(0,6),R(0,6));b.m.scale.setScalar(k.r*R(1.2,2.4));b.vx=R(-2,2)+PL.vx*kick;b.vy=R(.5,3);b.vz=R(-2,2)+PL.vz*kick;b.w=R(-8,8);}};
  for(const b of T_.bits){if(b.t<=0)continue;b.t-=rdt;b.vy-=6*rdt;b.vx*=Math.exp(-1.5*rdt);b.vz*=Math.exp(-1.5*rdt);b.m.position.x+=b.vx*rdt;b.m.position.y=Math.max(b.m.position.y+b.vy*rdt,H[PL.idx]+.03);b.m.position.z+=b.vz*rdt;b.m.rotation.x+=b.w*rdt;b.m.rotation.y+=b.w*.6*rdt;b.m.material.opacity=clamp(b.t/.8,0,1);if(b.t<=0)b.m.visible=false;}   // drifting down, tumbling, fading out
  const i=PL.idx,m_=x=>Math.round(x/SEG),on=G.state==='race'&&(zoneArr[i]===1||(DRIVE&&Z.toll&&i>Z.toll-m_(400)&&i<Z.toll+m_(320)));
  if(on){T_.cd-=rdt;if(T_.cd<=0){T_.cd=R(.8,2.6);const k=T_.l.find(o=>!o.st);
    if(k){const v=Math.abs(pe.v),s=pe.s+Math.max(35,v*3)+R(0,60),j=wrapI(Math.floor(s/SEG)),w=RW+XW[j];k.st=1;k.s=s;k.dir=Math.random()<.5?-1:1;k.lat=-k.dir*(w+R(4,10));k.v=R(4,8);k.y=0;k.vy=R(1,3);k.ds=R(-1.5,1.5);if(Math.random()<.35){k.s=pe.s+Math.max(70,v*4)+R(0,80);k.lat=R(-w+1,w-1);k.v=R(0,1.5);k.ds=-R(4,9);}   /* some roll down the road towards the car */k.g.visible=true;}}}
  for(const k of T_.l){if(!k.st)continue;const dsP=wdiff(k.s-pe.s),j=wrapI(Math.floor(k.s/SEG)),w=RW+XW[j];
    if(dsP<-40||dsP>320||Math.abs(k.lat)>w+16||(!on&&dsP<0)){k.st=0;k.g.visible=false;continue;}
    k.lat+=k.dir*k.v*rdt;k.s+=k.ds*rdt;k.vy-=14*rdt;k.y+=k.vy*rdt;if(k.y<=0){const hard=k.vy<-6;k.y=0;k.vy=R(1.5,3.8)*(Math.random()<.2?1.6:1);if(hard&&k.g.visible)snap(k,2+(Math.random()*3|0),0);}   // gusts carry it across in bounces; a hard landing after a high one shakes bits loose
    at(k.s,k.lat,k.y+k.r,T_.V);k.g.position.copy(T_.V);
    const dx=T_.V.x-PL.x,dz=T_.V.z-PL.z;if(dx*dx+dz*dz<(k.r+1.6)**2&&k.y<1.2){if(Math.random()<.33){snap(k,14+(Math.random()*8|0),.6);k.st=0;k.g.visible=false;continue;}   /* 1 in 3 disintegrates into a burst of bits */k.vy=R(6,9);k.ds=pe.v*.6;snap(k,5+(Math.random()*4|0),.5);}   // bounced up over the car, shedding twigs
    const mv=Math.hypot(k.v,k.ds)||1;at(k.s+k.ds/mv,k.lat+k.dir*k.v/mv,0,T_.W);at(k.s,k.lat,0,T_.A);T_.W.sub(T_.A);T_.A.set(T_.W.z,0,-T_.W.x).normalize();T_.Q.setFromAxisAngle(T_.A,mv*rdt/k.r);k.g.quaternion.premultiply(T_.Q);}}
function turkeysTick(rdt){const v=Math.hypot(PL.vx,PL.vz);for(const k of TK){const m=k.m,gy=H[k.ci];
    if(k.st===0){k.tt-=rdt;if(k.tt<=0){k.tt=R(2,7);{const a=R(0,6.283),d=R(3,12);k.tl=clamp(k.lat+Math.cos(a)*d,-13,13);k.td=clamp(k.ds+Math.sin(a)*d*1.6,-22,22);}}
      at(k.ci*SEG+k.ds,k.lat,0,V);const near=(V.x-PL.x)**2+(V.z-PL.z)**2,sc=near<260&&v>5?3.2:.75;if(sc>1&&Math.abs(k.tl-k.lat)<1)k.tl=clamp(k.lat+(k.lat>=0?9:-9),-14,14);   // they scuttle aside when a car comes
      const dl=k.tl-k.lat,dd=k.td-k.ds,d=Math.hypot(dl,dd);if(d>.2){k.lat+=dl/d*sc*rdt;k.ds+=dd/d*sc*rdt;k.h=Math.atan2(Nn[k.ci].x*dl+T[k.ci].x*dd,Nn[k.ci].z*dl+T[k.ci].z*dd);}
      at(k.ci*SEG+k.ds,k.lat,0,m.position);m.position.y+=d>.2?Math.abs(Math.sin(tmNow()*9+k.ci+k.tl))*.04:0;m.rotation.set(0,k.h,0);m.w[0].rotation.z=m.w[1].rotation.z=0;m.w[0].scale.x=m.w[1].scale.x=.25;
      if(near<3.2&&v>3&&!PL.crash){k.st=1;crackScreen();k.x=m.position.x;k.z=m.position.z;k.y=m.position.y;k.vx=PL.vx*.55+R(-4,4);k.vz=PL.vz*.55+R(-4,4);k.vy=R(6.5,10.5);k.sp=R(-9,9);k.fly=Math.random()<.35;sfxGobble();G.shake=Math.max(G.shake,.25);
        for(let i=0;i<9;i++)puff(V.set(k.x,k.y+.6,k.z),R(-3,3)+PL.vx*.2,R(1,4),R(-3,3)+PL.vz*.2,.15,.5,R(.6,1.3),.8,i%2?0x6a4426:0xe8e0d0);}
      continue;}
    if(k.st===3){k.tt-=rdt;m.visible=false;if(k.tt<=0){k.st=0;m.visible=true;k.lat=R(-11,11);k.ds=R(-9,9);k.tl=k.lat;k.td=k.ds;k.tt=1;}continue;}
    const fl=Math.sin(tmNow()*22+k.ci)*.9;m.w[0].scale.x=m.w[1].scale.x=1;m.w[0].rotation.z=fl;m.w[1].rotation.z=-fl;
    if(k.st===1){k.vy-=11*rdt;if(k.fly&&k.vy<1.5){k.st=2;k.h=Math.atan2(k.vx,k.vz);sfxGobble();}
      k.x+=k.vx*rdt;k.y+=k.vy*rdt;k.z+=k.vz*rdt;k.vx*=Math.exp(-.8*rdt);k.vz*=Math.exp(-.8*rdt);m.rotation.x+=k.sp*rdt;m.rotation.z+=k.sp*.6*rdt;
      if(k.y<=gy){const dx=k.x-P[k.ci].x,dz=k.z-P[k.ci].z;k.ds=clamp(dx*T[k.ci].x+dz*T[k.ci].z,-40,40);k.lat=clamp(dx*Nn[k.ci].x+dz*Nn[k.ci].z,-14,14);k.tl=k.lat;k.td=k.ds;k.tt=R(1,2);k.st=0;}}
    else{k.vy+=(5.5-k.vy)*Math.min(1,rdt*2);const s=9+k.y*.1;k.x+=Math.sin(k.h)*s*rdt;k.z+=Math.cos(k.h)*s*rdt;k.y+=k.vy*rdt;m.rotation.set(-.35,k.h,0);if(k.y>gy+75){k.st=3;k.tt=R(10,18);}}
    m.position.set(k.x,k.y,k.z);}}
// Dappled tree shadow lying across the road, in patches
const shadeTex=canvas(256,1024,(g,w,h)=>{g.clearRect(0,0,w,h);for(const[y0,n]of[[90,150],[330,90],[540,170],[840,110]])for(let i=0;i<n;i++){g.fillStyle=`rgba(0,0,0,${R(.3,.7)})`;g.beginPath();g.ellipse(R(-10,w+10),y0+R(-1,1)*R(0,70),R(7,30),R(4,14),R(0,3),0,7);g.fill();}});shadeTex.wrapS=shadeTex.wrapT=THREE.RepeatWrapping;
const shadeMat=new THREE.MeshBasicMaterial({map:shadeTex,color:0,transparent:true,opacity:.4,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4});
{const band=(a,b)=>{if(b-a>4)ribbon(i=>-RW-XW[i]-2.5,i=>RW+XW[i]+2.5,.045,.045,shadeMat,170,a,b).receiveShadow=false;};
  if(DRIVE){span(Z.wt0+120,Z.central,band);band(Z.rb1+20,Z.refinery-20);}else{band(205,NS);band(0,62);}}
function driveTick(rdt){const zn=zoneOf(PL.idx);
  if(G.state==='race'&&!QS.has('wx')){DA.wxT=(DA.wxT||R(150,300))-rdt;if(DA.wxT<=0){DA.wxT=R(150,300);const ws=['sun','overcast','rain','hail','snow'].filter(w=>w!==G.weather),w=ws[Math.random()<.75?Math.random()*2|0:Math.random()*ws.length|0];G.weather=w;say(WX[w].name,'',2.4);}}   // Bay weather turns every few minutes
  leavesTick(rdt,zn!=='tunnel'&&zn!=='bridge'&&zn!=='freeway');G.tun=lerp(G.tun,zn==='tunnel'?1:0,clamp(rdt*3.5,0,1));G.brg=lerp(G.brg,zn==='bridge'&&PL.idx>=Z.gg0&&PL.idx<Z.gg1?clamp(.3+.6*Math.sin(PL.idx*.0105+tmNow()*.035),0,.8):0,clamp(rdt*.7,0,1));   /* fog banks roll through the Golden Gate only */jazzTick(rdt,(G.state==='race'||G.state==='finish')&&!G.paused&&!QS.has('mute'));   // on the bridge you drive through banks of fog and out into the sun again
  if(G.state!=='race'||G.paused)return;
  {const pl=placeOf(PL.idx);if(pl[1]!==DA.zn){DA.zn=pl[1];say(pl[1],pl[2],2.6);}}turkeysTick(rdt);shopTick(rdt);vanTick(rdt);bbQuakeTick(rdt);conesTick(rdt);bearsTick(rdt);rsrTick(rdt);bitsTick(rdt);dustTick(rdt);sfSmokeTick(rdt);litterTick(rdt);rtkTick(rdt);stormTick(rdt);bayTick(rdt);crowsTick(rdt);birdsTick(rdt);owlsTick(rdt);skunksTick(rdt);tumbleTick(rdt);iguanaTick(rdt);bigIguTick(rdt);woodIguTick(rdt);catTick(rdt);fwIguTick(rdt);tubeIguTick(rdt);rigiTick(rdt);nudgeTick(rdt);iguMoreTick(rdt);spillTick(rdt);toxTick(rdt);mosqTick(rdt);lakeRailTick(rdt);beetleTick(rdt);eyeMonTick(rdt);dadBeetleTick(rdt);bigfootTick(rdt);seaMonTick(rdt);sfBldTick(rdt);sfPyrTick(rdt);clayTick(rdt);hydMosqTick(rdt);hydIguTick(rdt);tnkTick(rdt);pennyTick(rdt);shootTick(rdt);snapTick(rdt);millTick(rdt);craneTick(rdt);refTick(rdt);planesTick(rdt);pedsTick(rdt);exhaustTick(rdt);papersTick(rdt);ducksTick(rdt);debrisTick(rdt);for(const f of FLARES){const q=tmNow()*6+f.ph,k=.85+Math.sin(q)*.08+Math.sin(q*2.7)*.06;f.sp.scale.set(26*k,52*k*(1+Math.sin(q*1.9)*.08),1);f.sp.position.y=f.b+Math.sin(q*1.3)*1.2;}quakeTick(rdt);cityQuakeTick(rdt);fqTick(rdt);centTick(rdt);ggqTick(rdt);marinTick(rdt);extrasTick(rdt);almTick(rdt);sqHydTick(rdt);if(!MAR.hold)marinaTick(rdt);ggCloudTick(rdt);
  {const sp=Math.hypot(PL.vx,PL.vz);howlTick((zn==='bridge'?1:zn==='freeway'?clamp(H[PL.idx]/9,0,1):0)*clamp(sp/45,.4,1)*(PL.crash?.3:1));
    if(zn==='town'){DA.caw=(DA.caw??5)-rdt;if(DA.caw<=0){DA.caw=R(7,16);sfxCaw();}}
    G.smk=clamp((G.smk||0)+(zn==='tunnel'?rdt/15:-rdt/2.5),0,1);
    if(G.smk>.03&&zn==='tunnel'){const fx=Math.sin(PL.h),fz=Math.cos(PL.h);if(Math.random()<rdt*26*G.smk){const a=R(-6,46),b=R(-5.5,5.5);puff(V.set(PL.x+fx*a+fz*b,R(.8,4.8),PL.z+fz*a-fx*b),R(-.4,.4),R(.1,.6),R(-.4,.4),R(2.5,4),R(5,8),R(2.5,4),.55*G.smk,0x0a0a0a);}
      if(G.smk>.3){PL.cough=(PL.cough??2)-rdt*1.6;if(PL.cough<=0){PL.cough=R(4,8);sfxCough();}}}}
  if(DA.pf){const F=DA.pf,fl=F.fl;F.t+=rdt;const u=F.t/F.dur;if(u>=1){DA.pf=null;fl.visible=false;DA.pel=R(5,9);}else{fl.visible=true;fl.position.lerpVectors(F.a,F.b,u);fl.position.y+=Math.sin(u*9)*1.2;fl.rotation.y=Math.atan2(F.b.x-F.a.x,F.b.z-F.a.z);
      fl.birds.forEach((b,n)=>{const q=tmNow()*(fl===exotics?9:6.5)+n,w=Math.sin(q)>-.3?Math.sin(q)*.55:-.12;b.w[0].rotation.z=w;b.w[1].rotation.z=-w;});}}
  else if(zn==='bridge'){DA.pel=(DA.pel??2)-rdt;if(DA.pel<=0){const pe=ents.find(e=>e.player),s0=pe.s+R(90,150)+pe.v*2.5,sd=Math.random()<.5?-1:1,y=R(9,20);DA.fn=!DA.fn;DA.pf={t:0,dur:R(7,10),fl:DA.fn?pelicans:exotics,a:at(s0,-sd*60,y),b:at(s0+R(20,60),sd*60,y+R(-3,5))};}}   // pelicans and tropical birds take turns crossing low between the towers, just ahead of the car
  if(zn==='bridge'){DA.horn-=rdt;DA.gull-=rdt;if(DA.horn<=0){DA.horn=R(8,17);sfxHorn();}if(DA.gull<=0){DA.gull=R(2.5,7);sfxGull();}}}
// Through the rail: the car arcs off the deck and falls 45 m into the bay. The driver bobs up, still smoking, and a manatee carries him to shore.
// Under the bay: what the camera finds when the car goes off the bridge. Seabed and kelp, a shoal of fish, jellyfish, a turtle, a shark, and the octopus that takes the car.
let SEA=null;
if(DRIVE){const g=new THREE.Group(),D2=THREE.DoubleSide,A=(par,geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);par.add(o);return o;};
  A(g,new THREE.CircleGeometry(75,32).rotateX(-Math.PI/2),std({color:0x8a8468,roughness:1}),0,-21,0);
  // a kelp forest: tall stalks from the seabed to the surface, blades and floats all the way up, a golden canopy overhead and shafts of light coming down through it
  const kt=canvas(128,1024,(k,w,h)=>{k.clearRect(0,0,w,h);k.strokeStyle='#6a5a1e';k.lineWidth=5;k.beginPath();k.moveTo(64,h);for(let y=h;y>=0;y-=32)k.lineTo(64+Math.sin(y*.02)*8,y);k.stroke();
    for(let y=h-20;y>10;y-=30){const s=(y/30|0)%2?1:-1,x0=64+Math.sin(y*.02)*8,L=R(34,54);k.fillStyle=`hsl(${R(42,62)},${R(55,75)}%,${R(26,44)}%)`;k.beginPath();k.moveTo(x0,y);k.quadraticCurveTo(x0+s*L*.5,y-22,x0+s*L,y-R(4,16));k.quadraticCurveTo(x0+s*L*.5,y+6,x0,y);k.fill();
      k.fillStyle='#c9a23a';k.beginPath();k.ellipse(x0+s*7,y-3,5,7,0,0,7);k.fill();}});
  const km=std({map:kt,alphaTest:.4,side:D2,roughness:.8,emissive:0x3a2c08,emissiveIntensity:.5}),kelp=[];
  for(let k=0;k<56;k++){const a=R(0,6.283),r=R(13,44),h=R(19,22.5),st=new THREE.Group();for(const ry of[0,1.57])A(st,new THREE.PlaneGeometry(2.2,h).translate(0,h/2,0),km,0,0,0).rotation.y=ry;st.position.set(Math.cos(a)*r,-21,Math.sin(a)*r);st.rotation.y=R(0,3);g.add(st);kelp.push(st);}
  const cnp=canvas(256,256,(k,w,h)=>{k.clearRect(0,0,w,h);for(let i=0;i<420;i++){k.fillStyle=`hsla(${R(38,56)},${R(60,85)}%,${R(30,58)}%,${R(.5,.95)})`;k.beginPath();k.ellipse(R(0,w),R(0,h),R(4,16),R(2,6),R(0,3),0,7);k.fill();}});cnp.wrapS=cnp.wrapT=THREE.RepeatWrapping;cnp.repeat.set(5,5);
  A(g,new THREE.CircleGeometry(60,24).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({map:cnp,transparent:true,alphaTest:.3,side:D2,fog:false,color:0xffd27a}),0,-.6,0);
  const rayM=new THREE.MeshBasicMaterial({color:0xfff0b8,transparent:true,opacity:.035,blending:THREE.AdditiveBlending,depthWrite:false,side:D2,fog:false}),rays=[];
  for(let k=0;k<16;k++){const a=R(0,6.283),r=R(2,26),m=A(g,new THREE.ConeGeometry(R(.8,2),24,6,1,true).translate(0,-12,0),rayM,Math.cos(a)*r,0,Math.sin(a)*r);m.rotation.set(R(-.25,.05),0,R(-.2,.2));rays.push(m);}
  for(let k=0;k<16;k++){const a=R(0,6.283),r=R(5,42);A(g,new THREE.SphereGeometry(R(.6,2.4),8,6),std({color:0x5a5a52,roughness:1}),Math.cos(a)*r,-21,Math.sin(a)*r).scale.y=.6;}
  const NF=80,fg=mergeGeometries([new THREE.SphereGeometry(.3,8,6).scale(.35,.6,1.2),new THREE.ConeGeometry(.2,.3,4).rotateX(-Math.PI/2).scale(.3,1,1).translate(0,0,-.45)]),fish=new THREE.InstancedMesh(fg,std({roughness:.5,metalness:.3}),NF),fd=[],c=new THREE.Color();
  for(let i=0;i<NF;i++){fd.push({r:R(4,22),a:R(0,6.283),w:R(.25,.7)*(i%2?1:-1),y:R(-17,-2),s:R(.6,1.7)});fish.setColorAt(i,c.setHex([0x1c2a30,0x24343a,0xf2a23a,0x18242a,0x2c3c40,0xd8dde2,0x1c2a30,0xff6a4a][i%8]));}fish.frustumCulled=false;g.add(fish);
  const jm=new THREE.MeshStandardMaterial({color:0xff9ad0,emissive:0xff5aa8,emissiveIntensity:.6,transparent:true,opacity:.6,side:D2,depthWrite:false}),jel=[];
  for(let k=0;k<7;k++){const j=new THREE.Group();A(j,new THREE.SphereGeometry(.7,14,8,0,6.283,0,1.5708),jm,0,0,0);for(let q=0;q<6;q++)A(j,new THREE.PlaneGeometry(.06,1.8),jm,Math.cos(q)*.4,-.9,Math.sin(q)*.4).rotation.y=q;j.userData={a:R(0,6.283),r:R(4,13),y:R(-16,-4)};g.add(j);jel.push(j);}
  const tu=new THREE.Group(),tg=std({color:0x4a6a3a,roughness:.8}),ts=std({color:0x8a9a52,roughness:.8});A(tu,new THREE.SphereGeometry(.8,14,10),tg,0,0,0).scale.set(1,.45,1.25);A(tu,new THREE.SphereGeometry(.25,10,8),ts,0,.05,1.1);
  tu.fl=[[-1,.5],[1,.5],[-1,-.6],[1,-.6]].map(([sx,z])=>{const p=new THREE.Group();p.position.set(sx*.7,0,z);A(p,new THREE.SphereGeometry(.4,8,6),ts,sx*.35,0,0).scale.set(1.2,.15,.5);tu.add(p);return p;});g.add(tu);
  const sk=new THREE.Group(),sm=std({color:0x6a747c,roughness:.6});A(sk,new THREE.SphereGeometry(.6,14,10),sm,0,0,0).scale.set(.75,.8,3.4);A(sk,new THREE.ConeGeometry(.4,1,4),sm,0,.75,.1).scale.set(.25,1,1);
  for(const s of[-1,1])A(sk,new THREE.BoxGeometry(1,.06,.5),sm,s*.75,-.2,.5).rotation.z=-s*.4;sk.tail=new THREE.Group();sk.tail.position.z=-1.8;A(sk.tail,new THREE.BoxGeometry(.07,1.5,.7),sm,0,.1,-.4).rotation.x=.3;sk.add(sk.tail);g.add(sk);
  // the octopus: mantle, eyes, and eight arms modelled already curled round the shape of the car
  const oc=new THREE.Group(),om=std({color:0xc8452a,roughness:.55}),arms=new THREE.Group();A(oc,new THREE.SphereGeometry(1.25,18,14),om,0,-.6,-3.7).scale.set(1,1.15,1.3);
  for(const s of[-1,1]){A(oc,new THREE.SphereGeometry(.22,10,8),std({color:0xf2e05a,roughness:.4}),s*.6,-.05,-2.8);A(oc,new THREE.SphereGeometry(.1,8,6),std({color:0x111111}),s*.64,-.05,-2.6).scale.set(1.6,.5,1);}
  for(let k=0;k<8;k++){const s=k%2?1:-1,zk=-1.9+(k>>1)*1.25,pts=[V3(s*.5,-.6,-3),V3(s*1.55,-.5,zk-.5),V3(s*1.38,.5,zk),V3(s*.7,1.18,zk+.1),V3(-s*.2,1.24,zk+.3),V3(-s*.78,1.02,zk+.5)];
    arms.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,.15,7,false),om));const tip=new THREE.Mesh(new THREE.SphereGeometry(.15,8,6),om);tip.position.copy(pts[5]);arms.add(tip);}
  oc.add(arms);oc.arms=arms;oc.visible=false;
  const dome=new THREE.Mesh(new THREE.SphereGeometry(58,24,14),new THREE.MeshBasicMaterial({side:THREE.BackSide,fog:false,map:canvas(4,128,(k,w,h)=>{const gr=k.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#e8d27a');gr.addColorStop(.14,'#6fc8c0');gr.addColorStop(.4,'#1f7f86');gr.addColorStop(1,'#03161d');k.fillStyle=gr;k.fillRect(0,0,w,h);})}));dome.visible=false;
  const light=new THREE.PointLight(0xbff4ec,0,70,1.1);
  // and the manatee's pipe
  const pipe=new THREE.Group(),pm=std({color:0x3a2416,roughness:.6});A(pipe,cyl(.028,.028,.5,6).rotateX(Math.PI/2),pm,0,0,.25);A(pipe,cyl(.1,.075,.17,10),pm,0,.07,.5);pipe.position.set(.1,-.16,2.6);pipe.visible=false;manatee.add(pipe);manatee.pipe=pipe;manatee.rotation.order='YXZ';
  // a crocodilian cruising the dive scene: dark olive scaly body, open toothy mouth
  const al=new THREE.Group(),alm=std({color:0x3b4524,roughness:.9}),alb=std({color:0x8a8a62,roughness:.8}),tm_=std({color:0xf0ead2,roughness:.5}),alx=(sx,sy,sz,mm,x,y,z,p=al)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mm);o.position.set(x,y,z);p.add(o);return o;};
  alx(.9,.55,3,alm,0,0,0);alx(.7,.2,2.6,alb,0,-.3,0);for(let q=0;q<8;q++)alx(.16,.14,.2,alm,(q%2?.2:-.2),.32,1.1-q*.34);   // body, pale belly, scale ridges
  al.tail=new THREE.Group();al.tail.position.set(0,0,-1.5);alx(.55,.4,1.8,alm,0,0,-.9,al.tail);alx(.3,.25,1.6,alm,0,0,-2.4,al.tail);al.add(al.tail);
  al.jaw=new THREE.Group();al.jaw.position.set(0,-.1,1.5);alx(.55,.12,1.6,alb,0,0,.8,al.jaw);for(let q=0;q<6;q++)for(const s of[-1,1])alx(.05,.12,.05,tm_,s*.24,.08,.25+q*.24,al.jaw);al.add(al.jaw);   // lower jaw with teeth
  alx(.6,.14,1.6,alm,0,.14,2.3);for(let q=0;q<6;q++)for(const s of[-1,1])alx(.05,.12,.05,tm_,s*.24,.02,1.6+q*.24);alx(.2,.16,.2,alm,.22,.32,1.75);alx(.2,.16,.2,alm,-.22,.32,1.75);   // upper jaw, teeth, eye bumps
  for(const s of[-1,1])for(const z of[.9,-.9]){const l=alx(.18,.14,.7,alm,s*.6,-.3,z);l.rotation.y=s*.5;}
  al.scale.setScalar(1.6);g.add(al);  g.visible=false;scene.add(g,oc,dome,light);SEA={g,fish,fd,jel,tu,sk,al,kelp,rays,oc,dome,light,col:new THREE.Color(0x0e4f58)};}
function seaTick(tm,D){const S_=SEA;S_.g.position.set(D.wx,-45,D.wz);
  S_.fd.forEach((f,i)=>{const a=f.a+tm*f.w,sg=Math.sign(f.w);E.set(0,Math.atan2(-Math.sin(a)*sg,Math.cos(a)*sg),0,'YXZ');M4.compose(V.set(Math.cos(a)*f.r,f.y+Math.sin(tm+i)*.4,Math.sin(a)*f.r),Q.setFromEuler(E),S.set(f.s,f.s,f.s));S_.fish.setMatrixAt(i,M4);});S_.fish.instanceMatrix.needsUpdate=true;
  S_.jel.forEach((j,k)=>{const u=j.userData;j.position.set(Math.cos(u.a)*u.r,u.y+Math.sin(tm*.8+k)*1.3,Math.sin(u.a)*u.r);j.scale.set(1-Math.sin(tm*3+k)*.12,1+Math.sin(tm*3+k)*.22,1-Math.sin(tm*3+k)*.12);});
  {const a=tm*.3;S_.tu.position.set(Math.cos(a)*9,-8+Math.sin(tm*.5),Math.sin(a)*9);S_.tu.rotation.y=Math.atan2(-Math.sin(a),Math.cos(a));S_.tu.fl.forEach((p,k)=>{p.rotation.z=Math.sin(tm*2.5+k)*.5;});}
  {const a=-tm*.22;S_.sk.position.set(Math.cos(a)*16,-11,Math.sin(a)*16);S_.sk.rotation.y=Math.atan2(Math.sin(a),-Math.cos(a));S_.sk.tail.rotation.y=Math.sin(tm*4)*.35;}
  {const a=tm*.18+2;S_.al.position.set(Math.cos(a)*13,-14+Math.sin(tm*.4)*.8,Math.sin(a)*13);S_.al.rotation.y=Math.atan2(-Math.sin(a),Math.cos(a));S_.al.tail.rotation.y=Math.sin(tm*2.2)*.4;S_.al.jaw.rotation.x=.14+Math.sin(tm*1.6)*.1;}
  S_.kelp.forEach((m,k)=>{m.rotation.z=Math.sin(tm*.9+k)*.06;m.rotation.x=Math.sin(tm*.7+k*1.7)*.05;});S_.rays.forEach((m,k)=>{m.rotation.z=Math.sin(tm*.3+k)*.12;});}
// water closes over the camera: teal murk, a dome of deepening colour, and a soft light on the car
function underwater(k){scene.fog.color.lerp(G.uwCol||SEA.col,k);scene.fog.near=lerp(scene.fog.near,1,k);scene.fog.far=lerp(scene.fog.far,G.uwFar||44,k);SEA.dome.visible=k>.4;SEA.dome.position.copy(camera.position);SEA.light.intensity=k*(G.uwLt||340);SEA.light.position.copy(hero.position);SEA.light.position.y+=7;}
function sfxBubble(){if(!AC)return;let t=AC.currentTime;for(let i=0;i<3+(Math.random()*4|0);i++){tone('sine',R(260,520),t,.1,.22,master,{to:R(800,1400),a:.01,h:.3});t+=R(.05,.14);}}
function sfxCaw(){return;/* crow calls switched off at the owner's request */if(!AC)return;let t=AC.currentTime;const n=2+(Math.random()*3|0),v=R(.16,.3);for(let i=0;i<n;i++){const f=R(520,640);tone('sawtooth',f,t,.2,v,master,{to:f*.66,a:.01,h:.5,lp:1900,ft:'bandpass',q:2.5});hit(t,.17,v*.8,1500,'bandpass',master);t+=R(.28,.4);}}
// wind howling through the viaduct and the bridge: resonant noise whose pitch keeps sliding
let HW=null;
function howlTick(k){if(!AC)return;if(!HW){const nb=noiseBuf(2),g=AC.createGain();g.gain.value=0;g.connect(master);HW={g,f:[]};for(const f0 of[330,520]){const s=AC.createBufferSource();s.buffer=nb;s.loop=true;const fl=AC.createBiquadFilter();fl.type='bandpass';fl.frequency.value=f0;fl.Q.value=14;const gg=AC.createGain();gg.gain.value=f0<400?1:.6;s.connect(fl);fl.connect(gg);gg.connect(g);s.start();HW.f.push(fl);}}
  const t=AC.currentTime;HW.g.gain.setTargetAtTime(k*(1.6+.7*Math.sin(t*.9)),t,.25);HW.f[0].frequency.setTargetAtTime(330+130*Math.sin(t*.63)+50*Math.sin(t*2.1),t,.2);HW.f[1].frequency.setTargetAtTime(540+190*Math.sin(t*.41+1)+70*Math.sin(t*1.7),t,.2);}
// Le Mans: tell the driver when he is leading, and keep telling him
function leadTick(dt,pe){if(G.raceT<6)return;const p=standings().indexOf(pe)+1;$('pos').style.color=p===1?'#e9a13a':'';
  if(p===1&&!PL.crash){PL.leadT=(PL.leadT||0)-dt;if(!PL.lead||PL.leadT<=0){say('EN TÊTE !',"YOU'RE IN THE LEAD",2.4);PL.leadT=20;if(!PL.lead)sfxBeep(1);}PL.lead=1;}else PL.lead=0;}
// Le Mans: now and then an old man with a white cane sets out across the track, well ahead of you. Go round him.
let OM=null;
if(!DRIVE){const g=new THREE.Group(),coat=std({color:0xb9975a,roughness:.9}),cap=std({color:0x3a2a22,roughness:.9});const{A,sk}=bodyBase(g,{legs:0x6a6a66,torso:coat,hair:0xd9d9d6});
  A(cyl(.19,.27,.6,14),coat,0,.78,0).scale.z=.7;A(new THREE.SphereGeometry(.11,12,8),cap,0,1.75,.01).scale.set(1.05,.45,1.15);A(new THREE.BoxGeometry(.16,.02,.1),cap,0,1.72,.11);
  limb(g,coat,V3(.215,1.39,0),V3(.27,1.12,.08),.052,.046);limb(g,coat,V3(.27,1.12,.08),V3(.3,.9,.24),.044,.036);A(new THREE.SphereGeometry(.045,8,6),sk,.3,.88,.25);limb(g,std({color:0xf2f0ea}),V3(.3,.9,.25),V3(.36,0,.52),.012,.012);
  limb(g,coat,V3(-.215,1.39,0),V3(-.26,1.12,0),.052,.046);limb(g,coat,V3(-.26,1.12,0),V3(-.27,.88,.05),.044,.036);A(new THREE.SphereGeometry(.045,8,6),sk,-.27,.85,.05);
  g.rotation.order='YXZ';g.visible=false;scene.add(g);OM={g,st:0,t:R(22,36),s:0,lat:0,dir:1};}
function oldManTick(dt,pe){if(!OM||G.raceT<10)return;const o=OM;
  if(o.st===0){o.t-=dt;if(o.t<=0&&!PL.crash&&pe.v>30){o.st=1;o.s=wrapS(pe.s+pe.v*5.5+70);o.dir=Math.random()<.5?-1:1;o.lat=-o.dir*R(1,5);o.g.visible=true;say('PIÉTON SUR LA PISTE !','AN OLD MAN IS CROSSING AHEAD - GO ROUND HIM',3.2);sfxBeep(0);}return;}
  o.lat+=o.dir*.8*dt;at(o.s,o.lat,0,o.g.position);const i=wrapI(Math.floor(o.s/SEG));o.g.rotation.set(.16,Math.atan2(Nn[i].x*o.dir,Nn[i].z*o.dir),Math.sin(G.raceT*5)*.04);o.g.position.y+=Math.abs(Math.sin(G.raceT*5))*.02;
  const dx=o.g.position.x-PL.x,dz=o.g.position.z-PL.z,v=Math.hypot(PL.vx,PL.vz);
  if(dx*dx+dz*dz<2.4&&v>6&&!PL.crash&&PL.safe<=0){o.lat+=o.dir*1.8;say('ATTENTION !','YOU NEARLY HIT THE OLD MAN',2.6);if(v>40)crashPlayer(9,false);else{PL.vx*=.3;PL.vz*=.3;sfxScrape(.6);}}   // he steps clear; you do not
  if(wdiff(pe.s-o.s)>60||Math.abs(o.lat)>RW+1.5){o.st=0;o.t=R(35,65);o.g.visible=false;}}
// Bay Bridge: an earthquake. One side of the deck gives way some way ahead, with time to move over; drive into the gap and you go down to the water.
function sfxQuake(){if(!AC)return;const t=AC.currentTime;hit(t,4.5,1.4,70,'lowpass',master);hit(t+.4,3.5,1,130,'lowpass',master);tone('sine',38,t,4.5,.9,master,{to:30,a:.3,h:.8});}
// falling debris, for both earthquakes: lumps of concrete, slabs of building front with their windows, bricks and glass. Each waits, falls (drifting in from where it broke off),
// and lands: on the road it stays as an obstacle with a burst of dust; over a hole or the bay it carries on down into the water.
const DEB=[];let debM=null;
function debMats(){if(debM)return debM;const fac=canvas(128,128,(g,w,h)=>{g.fillStyle='#c8bfae';g.fillRect(0,0,w,h);g.fillStyle='#2a3238';for(let y=10;y<h;y+=40)for(let x=10;x<w;x+=34)g.fillRect(x,y,20,26);g.strokeStyle='rgba(0,0,0,.4)';g.lineWidth=3;g.beginPath();g.moveTo(0,h*.3);g.lineTo(w*.6,h*.55);g.lineTo(w,h*.4);g.stroke();});
  debM={con:[0x8a8d90,0x9a968c,0x6f7477,0xa8a094].map(c=>std({color:c,roughness:.95})),fac:std({map:fac,roughness:.9}),brick:std({color:0x8a4a38,roughness:.95}),metal:[0x7f868b,0x6b5446,0x8b9196,0x5a5f63].map(c=>std({color:c,roughness:.5,metalness:.7})),glass:std({color:0xa8c8d8,roughness:.05,metalness:.6,transparent:true,opacity:.7,side:THREE.DoubleSide})};return debM;}
function spawnDeb(s,lat,h,kind,delay,water,inward=0,sc=1){const M=debMats();let geo,mm,sz;
  if(kind==='slab'){const w=R(3,6);geo=new THREE.BoxGeometry(w,R(2.5,4.5),.45);mm=M.fac;sz=w*.45;}else if(kind==='brick'){geo=new THREE.BoxGeometry(.45,.22,.22);mm=M.brick;sz=.2;}
  else if(kind==='metal'){const t=Math.random()*4|0;geo=t===0?new THREE.CylinderGeometry(.07,.07,R(2.5,4.5),6):t===1?new THREE.CylinderGeometry(.09,.12,R(4,6),6):t===2?new THREE.CylinderGeometry(.04,.04,R(4,7),5):new THREE.BoxGeometry(R(1.4,2.8),.32,.14);mm=pick(M.metal);sz=t===3?.16:.12;}   // bent poles, lamp standards, cable, girder bits: small, never in the way
  else if(kind==='glass'){geo=new THREE.PlaneGeometry(R(.4,1.1),R(.4,1.1));mm=M.glass;sz=.05;}else{const k=R(1.2,3);geo=new THREE.BoxGeometry(k*R(.8,1.3),k*R(.6,1),k*R(.8,1.3));mm=pick(M.con);sz=k*.42;}
  sz*=sc;const m=new THREE.Mesh(geo,mm);m.scale.setScalar(sc);m.castShadow=kind!=='glass';at(s,lat,h,m.position);m.rotation.set(R(0,6),R(0,6),R(0,6));m.visible=delay<=0;scene.add(m);
  const i=wrapI(Math.floor(s/SEG)),n=Nn[i];DEB.push({m,kind,t:delay,vy:0,vx:-n.x*inward,vz:-n.z*inward,w:R(-3,3),gy:H[i],sz,water,ob:null,done:false});}
function debrisTick(rdt){for(let k=DEB.length-1;k>=0;k--){const d=DEB[k];if(d.done)continue;if(d.t>0){d.t-=rdt;if(d.t>0)continue;d.m.visible=true;}
    d.vy-=(d.kind==='glass'?9:20)*rdt;d.m.position.x+=d.vx*rdt;d.m.position.z+=d.vz*rdt;d.m.position.y+=d.vy*rdt;d.m.rotation.x+=d.w*rdt;d.m.rotation.z+=d.w*.7*rdt;
    const p=d.m.position,dx=p.x-PL.x,dz=p.z-PL.z;
    if(!d.water&&p.y<=d.gy+d.sz){p.y=d.gy+d.sz;d.done=true;if(d.kind==='glass'){d.m.rotation.x=-Math.PI/2;continue;}if(d.kind==='metal'){d.m.rotation.set(R(-.15,.15),R(0,6.3),d.m.geometry.type==='CylinderGeometry'?Math.PI/2:0);if(dx*dx+dz*dz<900)sfxScrape(.35);continue;}if(d.kind!=='brick'&&d.sz>.5){d.ob={x:p.x,z:p.z,r:d.sz*1.6+.4,deb:d};OBST.push(d.ob);}
      if(d.sz>.5){sfxCrunch(clamp(d.sz*.35,.25,.8));NOGY=1;for(let q=0;q<9;q++)puff(V.set(p.x+R(-1,1),p.y,p.z+R(-1,1)),R(-4,4),R(1,4),R(-4,4),1,R(4,7),R(1.5,3),.55,0xa8a094);NOGY=0;}
      if(dx*dx+dz*dz<(d.sz+1.6)**2&&!PL.crash){G.shake=Math.max(G.shake,.9);PL.vx*=.55;PL.vz*=.55;sfxScrape(1);}}   // landed on the car, or just in front of it
    else if(d.water&&p.y<-44){d.done=true;d.m.visible=false;if(d.sz>.5){sfxSplash();NOGY=1;for(let q=0;q<10;q++)puff(V.set(p.x,-44.6,p.z),R(-3,3),R(4,10),R(-3,3),.8,R(3,6),R(1.2,2.2),.7,0xeef2f4);NOGY=0;}}}}
function clearDeb(){for(const d of DEB){scene.remove(d.m);d.m.geometry.dispose();if(d.ob){const k=OBST.indexOf(d.ob);if(k>=0)OBST.splice(k,1);}}DEB.length=0;}
function quakeTick(rdt){const q=QK,i=PL.idx;G.roll=0;if(!q)return;
  if(q.st===0){if(i>q.a-330&&i<q.a-40&&!PL.crash){q.st=1;q.t=0;q.cr=0;q.side=-1;q.jolt=0;say('EARTHQUAKE !','THE BRIDGE IS BREAKING UP AHEAD - KEEP TO THE LEFT RAIL',6);sfxQuake();quakeStart(q);G.qd=1;for(let k=0;k<10;k++)crackRoad((q.a-R(4,70))*SEG,R(-RW,RW));
      // metal shaken off the bridge (bent poles, lamp standards, cable, girder bits) and some bricks: some lands on the lanes that are left, some goes down through the gap
      for(let k=0;k<40;k++){const j=q.a-60+Math.random()*(q.b-q.a+110),inGap=j>q.a&&j<q.b,lat=inGap?R(-RW,q.ls-1):R(-RW,RW),over=inGap;spawnDeb(j*SEG,lat,R(18,45),'metal',R(1.2,9),over,0,R(.6,1.1));}}return;}   // only metal: no lumps of concrete
  q.t+=rdt;const m=q.half[1],sw=sst(q.t,.5,1.1)*(1-sst(q.t,1.7,2.1))+sst(q.t,5.4,6.2)*(1-sst(q.t,10.5,12.5)),ph=Math.sin(q.t*2.4);G.shake=Math.max(G.shake,q.t<8?(.65*(1-q.t/8)+.15)*(1-.8*sw):0);   // the rumble and the sway take turns
  {const lat=.85*sw*ph,d=lat-(q.sw||0);q.sw=lat;if(!PL.crash){const n=Nn[i];PL.x+=n.x*d;PL.z+=n.z*d;}G.roll=.05*sw*Math.sin(q.t*2.4+.5);   // the deck rolls a little from side to side, carrying the car and the view with it
    const ax=QK.ax||(QK.ax=new THREE.Vector3()),pv=QK.pv||(QK.pv=new THREE.Vector3()),qq=QK.qq||(QK.qq=new THREE.Quaternion()),c=(q.a+q.b)>>1;ax.set(T[c].x,0,T[c].z).normalize();pv.copy(P[c]);qq.setFromAxisAngle(ax,.022*sw*ph);
    for(const h of q.t<2.2?q.half:[q.half[0]]){h.quaternion.copy(qq);h.position.copy(pv).sub(V.copy(pv).applyQuaternion(qq));}}
  if(q.t>2.2){const u=q.t-2.2;m.position.set(0,-Math.min(70,9*u*u),0);m.quaternion.identity();if(!q.cr){q.cr=1;sfxCrunch(1);G.shake=1;}
    if(u<3&&Math.random()<rdt*40){const j=q.a+(Math.random()*(q.b-q.a)|0);puff(off(j,R(-RW,q.ls),R(-3,1),V),R(-2,2),R(1,4),R(-2,2),2,6,R(1.5,3),.5,0x9a968c);}}
  if(q.t>4.5&&!q.jolt){q.jolt=1;sfxQuake();G.shake=.8;say('AFTERSHOCK !','',2);}   // a second jolt, as you come up to the gap
  if(q.t>2.8&&i>=q.a-1&&i<=q.b&&!PL.crash&&PL.safe<=0){const pe=ents.find(e=>e.player);if(pe.lat<q.ls-.3)startDive(q.side,1.2,i,{room:(q.b-i)*SEG-6});}   // anywhere but the strip along the left rail, down you go
  if(!PL.crash&&(i>q.b+260||i<q.a-360)){q.st=0;q.sw=0;for(const h of q.half){h.position.set(0,0,0);h.quaternion.identity();}quakeEnd();clearDeb();clearCracks();}}
// the tanker that breaks up the manatee's pipe
if(DRIVE){const tk=new THREE.Group(),A=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);tk.add(o);return o;},bx=(a,b,c)=>new THREE.BoxGeometry(a,b,c),wh=std({color:0xeeeae0,roughness:.6});
  A(bx(150,11,24),std({color:0x1c1c1e,roughness:.7}),0,5.5,0);A(bx(150.4,3.4,24.4),std({color:0x8a2a20,roughness:.8}),0,.6,0);A(bx(120,1.2,20),std({color:0x8a3a2a,roughness:.8}),10,11.4,0);
  const bow=A(new THREE.ConeGeometry(12,26,4),std({color:0x1c1c1e,roughness:.7}),86,5.5,0);bow.rotation.z=-Math.PI/2;bow.scale.set(1,1,.48);
  A(bx(16,14,20),wh,-58,18,0);A(bx(18,2.4,24),wh,-57,26.2,0);A(cyl(2.4,2.8,9,12),std({color:0xc8402a,roughness:.6}),-66,30,0);for(let k=0;k<5;k++)A(cyl(.5,.5,7,6),wh,-30+k*24,15,0);
  tk.visible=false;scene.add(tk);SEA.tk=tk;}
// ---- free drive extras: traffic on the freeways and bridges (horse and buggy among it), fires that never go out, the watching eyes, the cable car on Hyde St,
// hawks in the redwoods, the port train, the detour to Richmond, and the cones and falling traffic when the Bay Bridge gives way
const TRAF=[],FQ={list:[]};let CABLE=null,TRAIN=null,CONES=null;const FADE={k:0,t:0,go:null};
if(DRIVE){const m_=x=>Math.round(x/SEG),D2=THREE.DoubleSide;
  const box=(g,sx,sy,sz,c,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),c);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
  const paint=c=>std({color:c,roughness:.45,metalness:.35}),tyre=std({color:0x141414,roughness:.9}),glass=std({color:0x1b2328,roughness:.1}),skin=std({color:0xd9a988,roughness:.8}),dark=std({color:0x1c1c1e,roughness:.8});
  const wheel=(g,x,z,r=.36)=>{const w=new THREE.Mesh(cyl(r,r,.26,12).rotateZ(Math.PI/2),tyre);w.position.set(x,r,z);g.add(w);g.wh.push(w);return w;};
  const rider=(g,x,y,z,c,hat)=>{box(g,.5,.68,.34,std({color:c,roughness:.9}),x,y+.34,z);const h=new THREE.Mesh(new THREE.SphereGeometry(.15,10,8),skin);h.position.set(x,y+.84,z);g.add(h);
    if(hat==='helmet'){const hm=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),paint(0xc8302a));hm.position.set(x,y+.88,z);g.add(hm);}else if(hat){box(g,.5,.04,.5,dark,x,y+.98,z);box(g,.3,.26,.3,dark,x,y+1.12,z);}};
  const CC=[0x9db8c4,0xd8cfb0,0x8a3a30,0x4a5f52,0xe8e4d8,0x2f3f5f,0xc9a84a,0x6a6f74,0x1c1c1e,0xb3241c];
  const MK={
    car:()=>{const g=new THREE.Group();g.wh=[];const c=paint(pick(CC));box(g,1.8,.62,4.5,c,0,.62,0);box(g,1.6,.52,2.3,glass,0,1.17,-.2);for(const[x,z]of[[-.85,1.4],[.85,1.4],[-.85,-1.4],[.85,-1.4]])wheel(g,x,z,.33);return{g,len:4.6,r:2,vb:R(20,26)};},
    pickup:()=>{const g=new THREE.Group();g.wh=[];const c=paint(pick([0x8a3a30,0x2f3f5f,0xe8e4d8,0x4a5f52,0x6a6f74,0x1c1c1e]));box(g,1.95,.75,5.4,c,0,.85,0);box(g,1.85,.85,2,c,0,1.65,1);box(g,1.87,.5,1.4,glass,0,1.72,1.2);
      for(const s of[-1,1])box(g,.1,.5,2.6,c,s*.92,1.45,-1.3);box(g,1.9,.5,.1,c,0,1.45,-2.6);for(const[x,z]of[[-.9,1.7],[.9,1.7],[-.9,-1.7],[.9,-1.7]])wheel(g,x,z,.42);return{g,len:5.4,r:2.1,vb:R(18,24)};},
    truck:()=>{const g=new THREE.Group();g.wh=[];const c=paint(pick([0xe8e4d8,0xb3241c,0x2f5f7a,0xd8cfb0]));box(g,2.3,2.2,2.3,c,0,1.6,3.6);box(g,2.2,.8,1.4,glass,0,2.2,4.1);box(g,2.5,3.2,7,paint(0xe8e6de),0,2.3,-1.2);
      for(const[x,z]of[[-1.05,3.6],[1.05,3.6],[-1.05,-2.6],[1.05,-2.6],[-1.05,-3.8],[1.05,-3.8]])wheel(g,x,z,.5);{const sk=new THREE.Mesh(cyl(.11,.13,3.6,8),std({color:0x9a9ea2,roughness:.35,metalness:.8}));sk.position.set(1.3,2.6,2.45);g.add(sk);g.ex=new THREE.Vector3(1.3,4.5,2.45);}return{g,len:9.6,r:2.7,vb:R(14,19)};},   /* a chrome exhaust stack behind the cab */
    moto:()=>{const g=new THREE.Group();g.wh=[];const c=paint(pick([0x1c1c1e,0xb3241c,0x2f5f7a,0xc9a84a]));box(g,.32,.45,1.5,c,0,.65,0);box(g,.5,.3,.7,c,0,.95,.35);wheel(g,0,.75,.33).scale.set(.5,1,1);wheel(g,0,-.75,.33).scale.set(.5,1,1);
      rider(g,0,.8,-.15,pick([0x2a2a2a,0x5a3a22,0x22407a]),'helmet');return{g,len:2,r:1,vb:R(26,32)};},
    buggy:()=>{const g=new THREE.Group();g.wh=[];g.legs=[];const hc=std({color:pick([0x5a3a22,0x2a1e16,0x8a6a4a,0xe8e0d0]),roughness:.85});
      const bd=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),hc);bd.scale.set(.42,.48,1.05);bd.position.set(0,1.55,3);g.add(bd);const nk=new THREE.Mesh(cyl(.17,.24,.95,8),hc);nk.position.set(0,2.05,3.85);nk.rotation.x=.75;g.add(nk);
      const hd=new THREE.Mesh(new THREE.BoxGeometry(.24,.28,.62),hc);hd.position.set(0,2.35,4.3);hd.rotation.x=.5;g.add(hd);const mane=box(g,.08,.5,.5,dark,0,2.2,3.8);mane.rotation.x=.75;
      for(const[x,z]of[[-.2,3.65],[.2,3.65],[-.2,2.35],[.2,2.35]]){const p=new THREE.Group();p.position.set(x,1.4,z);const l=new THREE.Mesh(cyl(.07,.06,1.4,6),hc);l.position.y=-.7;p.add(l);g.add(p);g.legs.push(p);}
      for(const s of[-1,1]){const sh=box(g,.06,.06,2.6,dark,s*.55,1.25,2.3);sh.rotation.x=.08;}
      const bg=std({color:0x1a1a1a,roughness:.6});box(g,1.4,.5,1.8,bg,0,1.1,.2);box(g,1.4,.7,.12,bg,0,1.55,-.65);box(g,1.6,.55,.5,bg,0,1.95,-.75);   /* the hood folded down behind the seat, so the driver can be seen */
      for(const s of[-1,1]){const w=new THREE.Mesh(new THREE.TorusGeometry(.72,.05,6,18),bg);w.rotation.y=Math.PI/2;w.position.set(s*.82,.72,.1);g.add(w);g.wh.push(w);}
      rider(g,0,1.3,.15,0x22222a);{const hm=std({color:0x161414,roughness:.6}),z=.15;const br=new THREE.Mesh(cyl(.24,.24,.03,14),hm);br.position.set(0,2.27,z);g.add(br);const cr=new THREE.Mesh(cyl(.15,.15,.38,14),hm);cr.position.set(0,2.47,z);g.add(cr);box(g,.31,.05,.31,std({color:0x6a1a1a,roughness:.7}),0,2.31,z);   // the driver: a tall black top hat with a band
        const pw=std({color:0x5a3a22,roughness:.7}),st=new THREE.Mesh(cyl(.015,.015,.16,6),pw);st.rotation.x=1.35;st.position.set(.05,2.08,z+.2);g.add(st);const bw=new THREE.Mesh(cyl(.04,.035,.08,8),pw);bw.position.set(.05,2.12,z+.29);g.add(bw);g.ex=new THREE.Vector3(.05,2.18,z+.29);}   // and a pipe
      return{g,len:6,r:1.7,vb:R(6,8)};},
    ox:()=>{const v=MK.buggy(),g=v.g,wd=std({color:0x6a4a2a,roughness:.9}),hay=std({color:0xc8a84a,roughness:1}),horn=std({color:0xe8e0c8,roughness:.5});   // an ox cart: the horse made stocky and horned, a wooden bed with a hay load, a hatted rider, plodding slowly
      for(const s of[-1,1]){const hn=new THREE.Mesh(new THREE.ConeGeometry(.06,.5,6),horn);hn.position.set(s*.2,2.62,4.3);hn.rotation.z=-s*.9;g.add(hn);}
      box(g,1.5,.3,2,wd,0,1.45,-.4);box(g,1.2,.5,1.2,hay,0,1.8,-.9);v.len=6;v.r=1.8;v.vb=R(2.2,3.2);return v;},
    truck2:()=>{const g=new THREE.Group();g.wh=[];const pk=a=>a[Math.random()*a.length|0],c=paint(pk([0xe8e4d8,0xb3241c,0x2f5f7a,0xd8cfb0,0x3a5a3a])),tr=paint(pk([0xe8e6de,0xc9ccd0,0xd8cfb0]));   /* a cab pulling two trailers */
      box(g,2.3,2.3,2.4,c,0,1.65,7.4);box(g,2.2,.8,.1,glass,0,2.3,8.62);box(g,2.5,3.1,6.6,tr,0,2.25,2.6);box(g,2.5,3.1,6.6,tr,0,2.25,-4.9);box(g,.3,.3,1.2,dark,0,.9,-1.15);
      for(const z of[7.6,5.2,.1,-1.1,-2.4,-7.4,-6.3])for(const x of[-1.05,1.05])wheel(g,x,z,.5);{const sk=new THREE.Mesh(cyl(.11,.13,3.8,8),std({color:0x9a9ea2,roughness:.35,metalness:.8}));sk.position.set(1.3,2.7,6.1);g.add(sk);g.ex=new THREE.Vector3(1.3,4.7,6.1);}return{g,len:17.2,r:2.8,vb:R(14,18)};},
    tanker:()=>{const g=new THREE.Group();g.wh=[];const c=paint(pick([0xb3241c,0xe8e4d8,0x2f5f7a,0xc9a84a])),sil=std({color:0xc4c8cc,roughness:.25,metalness:.85}),rd=std({color:0xc8201a,roughness:.5});   /* a fuel tanker: cab, and a long silver tank with a red band and FLAMMABLE diamonds */
      box(g,2.3,2.2,2.3,c,0,1.6,4.4);box(g,2.2,.8,.1,glass,0,2.2,5.56);box(g,2.2,.3,9.4,dark,0,.85,-1.2);const tk=new THREE.Mesh(cyl(1.25,1.25,9,16).rotateX(Math.PI/2),sil);tk.position.set(0,2.25,-1.3);g.add(tk);
      for(const z of[3.15,-5.75]){const e=new THREE.Mesh(new THREE.SphereGeometry(1.25,14,8),sil);e.scale.z=.35;e.position.set(0,2.25,z);g.add(e);}const bnd=new THREE.Mesh(cyl(1.27,1.27,.5,16).rotateX(Math.PI/2),rd);bnd.position.set(0,2.25,-1.3);g.add(bnd);
      for(const s of[-1,1]){const dm=box(g,.05,.8,.8,rd,s*1.27,2.25,-3.4);dm.rotation.x=Math.PI/4;}box(g,.4,.3,9,sil,0,3.55,-1.3);
      for(const[x,z]of[[-1.05,4.4],[1.05,4.4],[-1.05,-3.6],[1.05,-3.6],[-1.05,-4.9],[1.05,-4.9]])wheel(g,x,z,.5);{const sk=new THREE.Mesh(cyl(.11,.13,3.6,8),std({color:0x9a9ea2,roughness:.35,metalness:.8}));sk.position.set(1.3,2.6,3.2);g.add(sk);g.ex=new THREE.Vector3(1.3,4.5,3.2);}return{g,len:11.2,r:2.7,vb:R(14,18)};},
    police:()=>{const g=new THREE.Group();g.wh=[];if(!TRAF.pol)TRAF.pol=[std({color:0x501010,emissive:0xff2020,emissiveIntensity:.2,roughness:.4}),std({color:0x101850,emissive:0x2050ff,emissiveIntensity:.2,roughness:.4})];   /* black and white, with a light bar flashing red and blue */
      const blk=paint(0x111214),wht=paint(0xf2f2ee);box(g,1.8,.62,4.6,blk,0,.62,0);box(g,1.84,.5,2.1,wht,0,.66,-.1);box(g,1.6,.52,2.3,glass,0,1.17,-.2);box(g,1.62,.06,1.6,wht,0,1.45,-.2);
      box(g,1.25,.12,.32,dark,0,1.53,0);box(g,.55,.17,.3,TRAF.pol[0],-.33,1.62,0);box(g,.55,.17,.3,TRAF.pol[1],.33,1.62,0);for(const[x,z]of[[-.85,1.4],[.85,1.4],[-.85,-1.4],[.85,-1.4]])wheel(g,x,z,.33);return{g,len:4.7,r:2,vb:R(26,31)};}};
  const KINDS=['car','tanker','buggy','moto','truck','tanker','pickup','moto','ox','tanker','truck','pickup','car','moto','buggy','pickup','car','truck','car','pickup'];
  KINDS.forEach((k,n)=>{const v=MK[k]();if(k==='truck'&&n%2===0)addDrums(v.g,-1.2,3.9,7);v.g.visible=false;scene.add(v.g);const t={...v,kind:k,n,s:0,lat:0,lt:0,v:0,act:false,fall:null,ob:{x:1e9,z:1e9,r:v.r,soft:1}};TRAF.push(t);OBST.push(t.ob);});
  [['police',1],['truck2',3],['police',6],['truck2',8],['police',10],['tanker',99]].forEach(([k,n])=>{const v=MK[k]();if(k==='truck2'&&n===3){addDrums(v.g,2.6,3.8,6.6);}v.g.visible=false;scene.add(v.g);const t={...v,kind:k,n,extra:true,s:0,lat:0,lt:0,v:0,act:false,fall:null,ob:{x:1e9,z:1e9,r:v.r,soft:1}};TRAF.push(t);OBST.push(t.ob);});   // double-trailer trucks and police cars, added after the others and using Math.random, so the seeded scenery stays put
  TRAF.mkPol=MK.police;   // for the police cars at San Quentin
  // the cable car: red and cream, open at the ends, with passengers hanging on
  CABLE=[];const red=std({color:0xa8241c,roughness:.6}),crm=std({color:0xe8dcb8,roughness:.7}),wd=std({color:0x5a3a22,roughness:.8});for(const dir of[1,-1]){const g=new THREE.Group();g.wh=[];
    box(g,2.5,1,8.4,red,0,.9,0);box(g,2.4,1.3,4.4,crm,0,2.05,0);box(g,2.6,.18,8.8,wd,0,3.3,0);box(g,2.2,.4,8.2,crm,0,3.55,0);for(const z of[-3.9,-2.3,2.3,3.9])for(const x of[-1.15,1.15])box(g,.08,1.6,.08,wd,x,2.1,z);
    for(let k=0;k<7;k++)rider(g,(k%2?1:-1)*1.25,1,-3.4+k*1.1,pick([0x2a3a5a,0x8a3a30,0xc9a84a,0x3a5a3a,0xe8e4d6]),k===3);const sg=new THREE.Mesh(new THREE.PlaneGeometry(2,.4),new THREE.MeshBasicMaterial({map:canvas(256,52,(c)=>{c.fillStyle='#e8dcb8';c.fillRect(0,0,256,52);c.fillStyle='#a8241c';c.font='900 30px Georgia';c.textAlign='center';c.fillText('HYDE & BEACH',128,36);})}));sg.position.set(0,3.3,4.42);g.add(sg);
    for(const[x,z]of[[-.8,3],[.8,3],[-.8,-3],[.8,-3]])wheel(g,x,z,.35);g.rotation.order='YXZ';g.visible=false;scene.add(g);const cc={g,dir,lat:-2.4*dir,s:0,act:false,bell:2+dir,obs:[{x:1e9,z:1e9,r:2},{x:1e9,z:1e9,r:2},{x:1e9,z:1e9,r:2}]};cc.obs.forEach(o=>OBST.push(o));CABLE.push(cc);}   // two cars: one climbing in the right-hand track, one coming down in the left
  // the passenger train beside I-880: a locomotive and double-deck cars
  {const g=new THREE.Group(),st=std({color:0xc9ccd0,roughness:.45,metalness:.5}),stripe=std({color:0x22407a,roughness:.5}),red=std({color:0xb3241c,roughness:.5}),win=std({color:0x1b2328,roughness:.15});g.cars=[];
    for(let k=0;k<7;k++){const c=new THREE.Group();box(c,3,4.6,24,st,0,2.8,0);box(c,3.04,.5,24,stripe,0,1.4,0);box(c,3.04,.25,24,red,0,1.8,0);for(const y of[2.6,4])box(c,3.06,.7,22,win,0,y,0);if(!k){box(c,3.05,1.6,3,red,0,3.4,11.2);}g.add(c);g.cars.push(c);}
    g.visible=false;scene.add(g);TRAIN={g,s:0};}
  // the bridge collapse: cones in a taper across the right-hand lanes and along the edge of the hole, and warning boards
  {const CP=[],q=QK,cone=new THREE.InstancedMesh(new THREE.ConeGeometry(.3,.9,10),std({color:0xf06a1c,roughness:.55,emissive:0x401000}),120),band=new THREE.InstancedMesh(new THREE.CylinderGeometry(.19,.24,.14,10),std({color:0xf4f1e8,roughness:.5}),120);let k=0;
    const put=(i,lat)=>{if(k>=120)return;at(i*SEG,lat,.45,V);CP[k]={x:V.x,y:V.y,z:V.z,ox:V.x,oz:V.z,t:-1,vx:0,vz:0,a:0};M4.compose(V,Q.identity(),S.set(1,1,1));cone.setMatrixAt(k,M4);V.y+=.12;M4.compose(V,Q,S);band.setMatrixAt(k++,M4);};
    for(let j=0;j<=24;j++){const u=j/24;put(q.a-m_(150)+Math.round(u*m_(80)),-(RW-.4)+u*(RW-.4+q.ls-.4));}for(let i=q.a-m_(70);i<=q.b+m_(8);i+=2)put(i,q.ls-.4);for(let j=0;j<9;j++)put(q.a-m_(6),q.ls-1-j*.95);
    cone.count=band.count=k;const sgn=canvas(512,512,(c)=>{c.fillStyle='#141414';c.fillRect(0,0,512,512);c.translate(256,240);c.rotate(Math.PI/4);c.fillStyle='#f08a1c';c.fillRect(-150,-150,300,300);c.rotate(-Math.PI/4);c.fillStyle='#141414';c.font='900 64px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText('WARNING',0,-12);c.font='900 40px Arial';c.fillText('BRIDGE OUT',0,44);c.fillStyle='#f08a1c';c.font='900 42px Arial';c.fillText('RIGHT LANES CLOSED',0,236);});
    const boards=[];for(const[d,lat]of[[160,-3.3],[95,-5],[40,-1.6]]){const g=new THREE.Group(),fm=std({map:sgn,emissiveMap:sgn,emissive:0xffffff,emissiveIntensity:.35,roughness:.6}),b=new THREE.Mesh(new THREE.BoxGeometry(2.2,2.2,.08),fm);b.position.y=1.9;b.rotation.x=-.12;g.add(b);
      for(const s of[-1,1]){const l=box(g,.08,1.9,.08,std({color:0xf4f1e8}),s*.9,.95,-.25);l.rotation.x=.25;}at((q.a-m_(d))*SEG,lat,0,g.position);g.rotation.y=yaw(q.a)+Math.PI;g.visible=false;scene.add(g);boards.push(g);}
    cone.visible=band.visible=false;scene.add(cone,band);CONES={list:[cone,band,...boards],cone,band,CP,n:k};}}
// the collapse cones: hit one and it tips over, skids ahead a little and lies on its side (put upright again when the quake re-arms)
function conesTick(rdt){const C=CONES;if(!C||!C.CP||!C.cone.visible)return;const sp=Math.hypot(PL.vx,PL.vz);let ch=false;const m=new THREE.Matrix4(),p=new THREE.Vector3(),qq=new THREE.Quaternion(),sc=new THREE.Vector3(1,1,1),ax=new THREE.Vector3(),o=new THREE.Vector3();
  for(let k=0;k<C.n;k++){const c=C.CP[k];
    if(c.t<0){const dx=c.x-PL.x,dz=c.z-PL.z;if(sp>2&&dx*dx+dz*dz<2.1&&Math.abs(PL.gy-c.y)<3){c.t=0;c.vx=PL.vx*.55+dx*2;c.vz=PL.vz*.55+dz*2;c.a=0;sfxThump(.3);}else continue;}
    if(c.t>=1.6)continue;c.t+=rdt;c.a=Math.min(1.45,c.a+rdt*5);c.vx*=1-rdt*1.8;c.vz*=1-rdt*1.8;c.x+=c.vx*rdt;c.z+=c.vz*rdt;
    const vl=Math.hypot(c.vx,c.vz)||1;ax.set(c.vz/vl,0,-c.vx/vl);qq.setFromAxisAngle(ax,c.a);p.set(c.x,c.y-.15*Math.sin(c.a),c.z);m.compose(p,qq,sc);C.cone.setMatrixAt(k,m);
    o.set(0,.12,0).applyQuaternion(qq);p.add(o);m.compose(p,qq,sc);C.band.setMatrixAt(k,m);ch=true;}
  if(ch){C.cone.instanceMatrix.needsUpdate=true;C.band.instanceMatrix.needsUpdate=true;}}
function conesReset(){const C=CONES;if(!C||!C.CP)return;const m=new THREE.Matrix4(),p=new THREE.Vector3(),qq=new THREE.Quaternion(),sc=new THREE.Vector3(1,1,1);let ch=false;
  for(let k=0;k<C.n;k++){const c=C.CP[k];if(c.t<0)continue;c.t=-1;c.a=0;c.vx=c.vz=0;c.x=c.ox;c.z=c.oz;p.set(c.x,c.y,c.z);m.compose(p,qq,sc);C.cone.setMatrixAt(k,m);p.y+=.12;m.compose(p,qq,sc);C.band.setMatrixAt(k,m);ch=true;}
  if(ch){C.cone.instanceMatrix.needsUpdate=true;C.band.instanceMatrix.needsUpdate=true;}}
// bears in the redwoods near the Marin entrance: peeping round trunks at the car, and climbing up trunks
let BEART=0;
function bearsTick(rdt){if(!BEARS.length)return;BEART+=rdt;const t=BEART;for(const f of BUFF){f.hd.rotation.x=.55+Math.sin(t*.7+f.ph)*.25;}   // buffalo graze, heads down and bobbing
  for(const b of BEARS){const dx=b.tx-PL.x,dz=b.tz-PL.z,d2=dx*dx+dz*dz;if(d2>320*320){b.g.visible=false;continue;}b.g.visible=true;
    if(b.climb){const y=b.ty+3.5+5.5*(Math.sin(t*.22+b.ph)+1)/2*1.0+3*Math.max(0,Math.sin(t*.07+b.ph*2));b.g.position.set(b.tx-b.nx*1.05,y,b.tz-b.nz*1.05);b.g.rotation.set(0,Math.atan2(b.nx,b.nz),0);b.b.rotation.set(-Math.PI/2,0,Math.sin(t*2.2+b.ph)*.06);b.b.hd.rotation.x=.5+Math.sin(t*.6+b.ph)*.25;}
    else{const u=(Math.sin(t*.5+b.ph)+1)/2,s=-.2+1.8*u*u*(3-2*u);b.g.position.set(b.tx+b.nx*1.9+b.tx2*s*b.sd,b.ty,b.tz+b.nz*1.9+b.tz2*s*b.sd);const ya=Math.atan2(PL.x-b.g.position.x,PL.z-b.g.position.z);b.g.rotation.set(0,ya,0);b.b.rotation.set(0,0,0);b.b.hd.rotation.y=Math.sin(t*.9+b.ph)*.3;}}}
// Richmond-San Rafael Bridge: waves break over the side onto the deck, spread across it and recede, leaving small tin cans (RSR). Also the loose bits (BITS): toxic-waste drums shaken off trucks, and kicked tin cans.
const RSR={w:[],cans:[],next:3,init:0},BITS=[];
function drumMesh(){if(!DRUMG){DRUMG=new THREE.CylinderGeometry(.3,.3,.9,10);DRUMM=[std({color:0xc8a820,roughness:.5,metalness:.4}),std({color:0x2a6a30,roughness:.5,metalness:.4})];}return new THREE.Mesh(DRUMG,DRUMM[Math.random()<.5?0:1]);}
function addDrums(g,zc,yt,L){const a=[];const n=4+(Math.random()*3|0);for(let k=0;k<n;k++){const m=drumMesh();m.position.set((k%2?1:-1)*.55,yt+.45,zc+((k>>1)-.9)*Math.min(1.7,L/3.5));m.castShadow=true;g.add(m);a.push(m);
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.305,.305,.12,10),std({color:0x151515,roughness:.6}));b.position.y=.1;m.add(b);}g.drums=a;}
function dropDrums(t,sd,n){const g=t.g;if(!g.drums||!g.drums.length)return false;const tg=T[wrapI(Math.round(t.s/SEG))];for(const m of g.drums){scene.attach(m);BITS.push({m,vx:tg.x*t.v*.6+n.x*sd*R(-4,-1)+R(-2,2),vy:R(3,7),vz:tg.z*t.v*.6+n.z*sd*R(-4,-1)+R(-2,2),sp:R(-5,5),gy:PL.gy,r:.4,big:1,ttl:30,st:0});}g.drums=null;return true;}
function bitsTick(rdt){for(let k=BITS.length-1;k>=0;k--){const b=BITS[k],m=b.m,p=m.position;b.ttl-=rdt;if(b.ttl<=0||Math.abs(p.x-PL.x)+Math.abs(p.z-PL.z)>600){if(b.c)b.c.on=0;m.visible=false;if(b.big)m.parent.remove(m);BITS.splice(k,1);continue;}
    if(b.st<2){b.vy-=9.8*rdt;p.x+=b.vx*rdt;p.y+=b.vy*rdt;p.z+=b.vz*rdt;m.rotation.x+=b.sp*rdt;const fl=b.gy+(b.big?.45:.06);if(p.y<=fl){p.y=fl;if(Math.abs(b.vy)>2){b.vy*=-.35;b.vx*=.7;b.vz*=.7;if(b.big)sfxThump(.4);}else{b.vy=0;b.st=1;b.vx*=.9;b.vz*=.9;}}
      if(b.st===1){b.vx*=1-rdt*2.2;b.vz*=1-rdt*2.2;if(Math.hypot(b.vx,b.vz)<.2)b.st=2;}}
    if(b.st>=1&&b.st<3){const dx=p.x-PL.x,dz=p.z-PL.z,sp=Math.hypot(PL.vx,PL.vz);if(sp>3&&dx*dx+dz*dz<(b.r+1.5)**2&&Math.abs(PL.gy-b.gy)<2){b.st=0;b.vy=R(2,5);b.vx=PL.vx*.5+dx*1.5;b.vz=PL.vz*.5+dz*1.5;b.sp=R(-8,8);if(b.big){PL.vx*=.93;PL.vz*=.93;G.shake=Math.max(G.shake,.2);sfxThump(.5);}else if(AC)tone('triangle',R(1500,2300),AC.currentTime,.12,.05,master,{to:900});}}}}
function rsrTick(rdt){return;   // owner 2026-11-19: no more waves crashing over the Richmond-San Rafael Bridge (the toxic drums, in bitsTick, stay)
  const pe=ents.find(e=>e.player);if(!pe||!DRIVE||G.state!=='race')return;const i0=PL.idx,on=i0>=Z.rb0-Math.round(60/SEG)&&i0<=Z.rb1;
  if(!RSR.init&&on){RSR.init=1;const fm=new THREE.MeshBasicMaterial({color:0xeef4f6,transparent:true,opacity:.8,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3});for(let k=0;k<3;k++){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),fm.clone());m.visible=false;scene.add(m);RSR.w.push({m,t:-1,s0:0,sd:1,e:8,i:0,hit:0});}
    const cg=new THREE.CylinderGeometry(.07,.07,.12,8),cm=[std({color:0xb8bcbe,roughness:.35,metalness:.8}),std({color:0x8a5a3a,roughness:.7,metalness:.5})];for(let k=0;k<16;k++){const m=new THREE.Mesh(cg,cm[k%2]);m.visible=false;scene.add(m);RSR.cans.push({m,on:0});}}
  if(!RSR.init)return;
  if(on){RSR.next-=rdt;if(RSR.next<=0){RSR.next=R(2.2,5);const w=RSR.w.find(q=>q.t<0);if(w){const s0=pe.s+Math.max(pe.v,8)*2.4+R(-6,6),i=wrapI(Math.floor(s0/SEG));if(i>Z.rb0+8&&i<Z.rb1-8){Object.assign(w,{t:0,s0,sd:Math.random()<.5?-1:1,i,e:edgeAt[i]-.3,hit:0});w.m.visible=true;}}}}
  const V3=new THREE.Vector3();
  for(const w of RSR.w){if(w.t<0)continue;w.t+=rdt;const u=w.t,e=w.e,rise=sst(u,.1,1.1),rec=1-sst(u,2.2,5.2),ext=Math.max(.01,Math.min(e*1.05,e*.9*rise*rec+.3*rise*rec)),near=Math.abs(wdiff(w.s0-pe.s));
    if(!w.hit){w.hit=1;if(near<300){for(let q=0;q<26;q++){at(w.s0+R(-12,12),w.sd*(e+.2),R(1,2.5),V3);puff(V3,-w.sd*R(0,2),R(5,12),R(-1,1),2,R(5,9),R(1.2,2.2),.85,0xe8eef0);}if(near<160)sfxSplash();if(near<50)G.shake=Math.max(G.shake,.25);}}
    at(w.s0,w.sd*(e-ext/2),.07,w.m.position);w.m.rotation.y=yaw(w.i);w.m.scale.set(ext,1,30);w.m.material.opacity=.8*(u<4.2?1:Math.max(0,1-(u-4.2)/1));
    if(u>1.1&&!w.cn){w.cn=1;const n=3+(Math.random()*3|0);for(let q=0;q<n;q++){const c=RSR.cans.find(o=>!o.on);if(!c)break;const lat=w.sd*(e-R(.6,Math.max(.8,ext*.9)));at(w.s0+R(-12,12),lat,.06,c.m.position);c.m.rotation.set(Math.PI/2*R(0,1),R(0,6),R(0,1.5));c.m.visible=true;c.on=1;c.m.scale.setScalar(1);c.gone=Math.random()<.5;c.sd=w.sd;c.w=w;
        if(!c.gone){BITS.push({m:c.m,vx:0,vy:0,vz:0,sp:0,gy:c.m.position.y-.06,r:.15,big:0,ttl:90,st:2,c});}}}
    if(u>=2.2&&u<5.2)for(const c of RSR.cans){if(c.w===w&&c.on&&c.gone){const p=c.m.position,i=wrapI(Math.floor(w.s0/SEG)),n=Nn[i],k=(rdt*1.4);p.x+=n.x*w.sd*k*2.2;p.z+=n.z*w.sd*k*2.2;}}
    if(u<4.6&&near<16&&Math.abs(PL.gy-H[w.i])<3){const lat=((PL.x-P[w.i].x)*Nn[w.i].x+(PL.z-P[w.i].z)*Nn[w.i].z)*w.sd;if(lat>e-ext-.5)PL.wash=Math.max(PL.wash||0,.9);}
    if(u>5.4){w.t=-1;w.m.visible=false;for(const c of RSR.cans)if(c.w===w){c.w=null;if(c.gone){c.on=0;c.m.visible=false;}}w.cn=0;}}}
// Dust devils: tall spinning columns of dust, wider at the top, wandering across and along the road in Richmond (from the San Rafael bridge to I-80, in the dry yellow fields)
// and on Alameda's streets (out to the Posey Tube, and home from the Webster Tube), carrying scraps of paper and leaves round with them; now and then one heads right across your line.
// Drive into one and dust swirls round the car and browns the windscreen for a moment, the car shakes and wobbles a little (never slowed or pushed off line), a gust whooshes past and dust kicks out from the wheels.
const DUSTD={l:[],init:0,hz:null};
function dustZone(i){const m_=x=>Math.round(x/SEG);if(i>=Z.rb1-m_(120)&&i<=Z.i80)return 1;if((i>Z.start+m_(60)&&i<Z.tu0-m_(60))||(i>Z.wt0+m_(60)&&i<NS-m_(30)))return 2;return 0;}
function sfxDustGust(){if(!AC)return;const t=AC.currentTime,s=AC.createBufferSource();s.buffer=noiseBuf(1.7);const fl=AC.createBiquadFilter();fl.type='bandpass';fl.Q.value=1.3;fl.frequency.setValueAtTime(300,t);fl.frequency.linearRampToValueAtTime(1500,t+.45);fl.frequency.linearRampToValueAtTime(700,t+.8);fl.frequency.linearRampToValueAtTime(1200,t+1.05);fl.frequency.linearRampToValueAtTime(400,t+1.6);
  const g=AC.createGain();g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.5,t+.25);g.gain.linearRampToValueAtTime(.28,t+.65);g.gain.linearRampToValueAtTime(.42,t+.95);g.gain.exponentialRampToValueAtTime(.001,t+1.65);s.connect(fl);fl.connect(g);g.connect(master);s.start(t);s.stop(t+1.7);}
function dustTick(rdt){if(!DRIVE)return;PL.dustW=Math.max(0,(PL.dustW||0)-rdt*.9);if(DUSTD.hz)DUSTD.hz.style.opacity=(PL.dustW*.8).toFixed(3);if(PL.dustW>0)G.shake=Math.max(G.shake,.3*PL.dustW);if(G.state!=='race')return;
  const pe=ents.find(e=>e.player);if(!pe)return;const zn=dustZone(PL.idx);if(!zn&&!DUSTD.init)return;
  if(!DUSTD.init){DUSTD.init=1;const mt=new THREE.MeshBasicMaterial({color:0xc9a866,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide}),cg=[],pg=new THREE.PlaneGeometry(.45,.32),
      pm=[0xe8e2cc,0xa8823e,0x7d7a34,0xd6ccb0].map(c=>new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide}));   /* papers and dry leaves */
    for(let k=0;k<7;k++)cg.push(new THREE.CylinderGeometry(1.2+k*.55,.6+k*.5,3,10,1,true));
    for(let q=0;q<8;q++){const g=new THREE.Group(),cs=[],bits=[];for(let k=0;k<7;k++){const c=new THREE.Mesh(cg[k],mt);c.position.y=1.5+k*2.9;g.add(c);cs.push(c);}
      for(let k=0;k<5;k++){const b=new THREE.Mesh(pg,pm[k%4]);g.add(b);bits.push({m:b,a:R(0,6.3),h:R(1,15),r:R(1,3.5),w:R(2.5,4.5)});}
      g.visible=false;scene.add(g);DUSTD.l.push({g,cs,bits,on:0,s:0,lat:0,tl:0,vl:0,ph:R(0,6),gt:0,k:1,zn:0,hit:0,aim:1});}
    const hz=document.createElement('div');hz.style.cssText='position:fixed;inset:0;opacity:0;z-index:4;pointer-events:none;background:radial-gradient(ellipse at 50% 45%,rgba(184,146,90,.5) 0,rgba(156,118,66,.82) 60%,rgba(120,88,48,.95) 100%)';document.body.appendChild(hz);DUSTD.hz=hz;}   /* the brown haze over the windscreen */
  const V3=DUSTD.v||(DUSTD.v=new THREE.Vector3());DUSTD.t=(DUSTD.t||0)+rdt;const t=DUSTD.t,want=zn===1?7:zn===2?5:0;let act=0;for(const d of DUSTD.l)if(d.on)act++;
  for(const d of DUSTD.l){
    if(d.on){const ds=wdiff(d.s-pe.s);if(ds<-140||ds>720){d.on=0;d.g.visible=false;act--;}}
    if(!d.on&&act<want&&Math.random()<rdt*1.2){const s=pe.s+R(160,540),zz=dustZone(wrapI(Math.floor(wrapS(s)/SEG)));   /* a new one whips up somewhere ahead */
      if(zz){const sd=Math.random()<.5?-1:1,w=zz===1?[10,60]:[5,17];d.on=1;act++;d.zn=zz;d.s=s;d.lat=sd*R(w[0],w[1]);d.tl=Math.random()<.55?-sd*R(w[0]*.5,w[1]):d.lat;d.vl=0;d.gt=R(5,10);d.k=zz===1?R(.9,1.5):R(.7,1.1);d.hit=0;d.aim=Math.random()<.4?0:1;d.g.visible=true;}}
    if(!d.on)continue;const ds=wdiff(d.s-pe.s),w=d.zn===1?60:17;
    d.gt-=rdt;if(d.gt<=0){d.gt=R(5,11);d.tl=(Math.random()<.5?-1:1)*Math.sign(d.lat||1)*R(4,w);}   /* a gust sends it wandering, sometimes right across the road */
    if(!d.aim&&ds>20&&ds<150){d.aim=1;d.tl=pe.lat+R(-1.5,1.5);d.gt=R(4,6);}   /* this one crosses right over your line */
    d.vl+=(clamp((d.tl-d.lat)*.9,-9,9)-d.vl)*rdt*.9;d.lat+=d.vl*rdt;d.s+=Math.sin(t*.3+d.ph)*3*rdt;
    at(d.s,d.lat,0,d.g.position);d.cs.forEach((c,k)=>{c.rotation.y=t*(2.2-k*.18)+d.ph;c.position.x=Math.sin(t*1.3+k*.7+d.ph)*(.5+k*.25);c.position.z=Math.cos(t*1.1+k*.6)*(.4+k*.2);});d.g.scale.set(d.k,1,d.k);
    for(const b of d.bits){b.a+=rdt*b.w;b.m.position.set(Math.cos(b.a)*b.r*(1+b.h*.06),b.h+Math.sin(t*1.7+b.a)*1.2,Math.sin(b.a)*b.r*(1+b.h*.06));b.m.rotation.set(t*3+b.a,t*2.1,b.a);}
    if(Math.abs(ds)<220&&Math.random()<rdt*(Math.abs(ds)<90?9:3)){at(d.s+R(-4,4),d.lat+R(-3,3),R(.3,2),V3);const a=R(0,6.283);puff(V3,Math.cos(a)*R(3,7),R(.8,2.5),Math.sin(a)*R(3,7),1,R(5,9),R(2,3.4),.45,0xc8a868);}   /* dust kicked up round its foot */
    const dd=Math.hypot(d.g.position.x-PL.x,d.g.position.z-PL.z),rr=3*d.k+1.3;
    if(dd<rr&&!PL.crash){PL.dustW=Math.min(1,Math.max(.85,PL.dustW+rdt*6));G.shake=Math.max(G.shake,.32);if(!d.hit){d.hit=1;sfxDustGust();}
      if(Math.random()<rdt*30){const a=R(0,6.283),r=R(1.5,3);puff(V3.set(PL.x+Math.cos(a)*r,PL.gy+R(.4,2.2),PL.z+Math.sin(a)*r),PL.vx*.7-Math.sin(a)*7,R(1,4),PL.vz*.7+Math.cos(a)*7,1,R(4,7),R(1,1.8),.55,0xc8a868);}   /* swirling round the car */
      if(Math.random()<rdt*24){puff(V3.set(PL.x+R(-1.1,1.1),PL.gy+.25,PL.z+R(-1.1,1.1)),PL.vx*.3+R(-5,5),R(1,3),PL.vz*.3+R(-5,5),.8,R(3,5),R(.8,1.4),.6,0xb89860);}}   /* kicked out from the wheels */
    else if(dd>rr+8)d.hit=0;}
  if(zn===1&&Math.random()<rdt*3.5){at(pe.s+R(30,160),(Math.random()<.5?-1:1)*R(14,24),R(.2,1),V3);puff(V3,R(-3,3),R(.4,1.5),R(-3,3),1,R(4,8),R(2,3.4),.35,0xc8a868);}   /* loose dust drifting across the road */
}
function sfxBell(){if(!AC)return;let t=AC.currentTime;for(let k=0;k<2;k++){for(const[f,v]of[[1760,.22],[2640,.1],[4400,.05]])tone('sine',f,t,.9,v,master,{a:.002,h:.08});t+=.24;}}
function sfxScreech(){if(!AC)return;const t=AC.currentTime;tone('sawtooth',2300,t,.9,.12,master,{to:1300,a:.05,h:.4,lp:3200,ft:'bandpass',q:6});}
function quakeStart(q){for(const o of CONES.list)o.visible=true;conesReset();let n=0;   // traffic already on the bridge runs on into the gap: five vehicles in the right-hand lanes, timed to reach it just after it goes
  for(const t of TRAF){if(n>=9)break;if(t.kind==='moto'||t.kind==='buggy'||t.kind==='ox')continue;t.act=true;t.qf=true;t.fall=null;t.g.visible=true;if(t.vb0==null)t.vb0=t.vb;t.s=q.a*SEG-16*(2.5+n*.85)-R(0,4);t.v=t.vb=16;t.lt=n%2?-RW*.75:-RW*.25;t.lat=t.lt;t.g.rotation.set(0,0,0);n++;}}   // qf: kept running whatever the rest of the traffic is doing
function quakeEnd(){for(const o of CONES.list)o.visible=false;for(const t of TRAF){t.qf=false;if(t.vb0!=null){t.vb=t.vb0;t.vb0=null;}}}   // the vehicles slowed for the collapse go back to their own speeds
// ---- the log truck in the Marin redwoods: a cab pulling a trailer stacked with logs. Bump it (below 175 mph it's rubbery, like all traffic) and the load spills:
// the logs tumble off, bounce, roll and settle on the road, and can be shoved about. All put back on the truck once you're well away.
const LOGT={g:null,logs:[],act:false,spill:0,s:0,lat:0,v:0,bt:0,wob:0,s0:0,kc:0};
if(DRIVE){const g=new THREE.Group(),bx=(sx,sy,sz,c,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),c);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
  const cab=std({color:0x2f5a3a,roughness:.45,metalness:.35}),blk=std({color:0x1c1c1e,roughness:.8}),gl=std({color:0x1b2328,roughness:.1}),stl=std({color:0x9a9ea2,roughness:.35,metalness:.8}),tyr=std({color:0x141414,roughness:.9});
  bx(2.4,2.3,2.4,cab,0,1.85,6.2);bx(2.2,.8,.1,gl,0,2.4,7.42);bx(2.2,1.1,1.8,cab,0,1.25,8.3);bx(1.6,.9,.06,stl,0,1.25,9.22);bx(2.5,.25,.2,stl,0,.6,9.25);   // cab, bonnet and grille
  bx(.9,.35,14,blk,0,.95,1.6);g.wh=[];for(const z of[8.4,4.6,3.4,-3.4,-4.6])for(const x of[-1.05,1.05]){const w=new THREE.Mesh(cyl(.5,.5,.35,12).rotateZ(Math.PI/2),tyr);w.position.set(x,.5,z);g.add(w);g.wh.push(w);}
  {const sk=new THREE.Mesh(cyl(.11,.13,3.6,8),stl);sk.position.set(1.3,2.7,4.9);g.add(sk);}
  for(const z of[3.2,-.6,-4.2]){bx(2.5,.2,.3,blk,0,1.15,z);for(const x of[-1.2,1.2])bx(.14,2.3,.14,blk,x,2.2,z);}   // bunks and stakes
  const bark=std({color:0x5a3624,roughness:1}),end=std({color:0xc89a62,roughness:.9}),lg=cyl(1,1,1,12).rotateX(Math.PI/2);
  let k=0;for(const[n,y]of[[4,1.62],[3,2.2],[2,2.76]])for(let j=0;j<n;j++){const r=.29+((k*37)%7)*.01,L=9+((k*53)%5)*.25,m=new THREE.Mesh(lg,[bark,end,end]);m.scale.set(r,r,L);m.position.set((j-(n-1)/2)*.62,y,-.6+((k*29)%3-1)*.2);m.castShadow=true;g.add(m);
    LOGT.logs.push({m,r,L,home:m.position.clone(),s:0,lat:0,y:0,vs:0,vl:0,vy:0,ya:0,pi:0,ro:0,wy:0,wp:0,wr:0});k++;}
  g.visible=false;scene.add(g);LOGT.g=g;}
function logSpill(sd,rear){const L=LOGT,i=wrapI(Math.floor(L.s/SEG)),xs=Math.sign(T[i].z*Nn[i].x-T[i].x*Nn[i].z)||1;L.spill=1;L.s0=L.s;
  for(const o of L.logs){L.g.remove(o.m);scene.add(o.m);o.m.rotation.order='YXZ';o.s=L.s+o.home.z;o.lat=L.lat+xs*o.home.x;o.y=o.home.y;o.ya=o.pi=o.ro=0;
    o.vs=L.v*.8+R(-1,3);o.vl=(rear?(Math.random()<.5?-1:1):-sd)*R(1.5,6.5)+R(-1,1);o.vy=R(1.5,4.5)+o.home.y-1.6;o.wp=R(-1.6,1.6);o.wy=R(-.8,.8);o.wr=R(-4,4);}
  sfxCrunch(.5);say('LOGS ON THE ROAD','',2);}
function logTick(dt,pe){const L=LOGT;if(!L.g)return;const m_=x=>Math.round(x/SEG),i0=PL.idx;
  if(L.spill&&Math.abs(wdiff(pe.s-L.s0))>600){for(const o of L.logs){scene.remove(o.m);L.g.add(o.m);o.m.rotation.order='XYZ';o.m.rotation.set(0,0,0);o.m.position.copy(o.home);}L.spill=0;L.act=false;L.g.visible=false;}   // well away: load it back up
  if(!L.act&&!L.spill&&i0>Z.gg1+m_(150)&&i0<Z.sq-m_(300)&&Math.random()<dt*.6){const s=wrapS(pe.s+R(260,420)),i=wrapI(Math.floor(s/SEG));if(i<Z.sq-m_(80)){L.act=true;L.s=s;L.lat=-.25*(RW+XW[i]);L.v=15;L.g.visible=true;}}
  if(L.act){let i=wrapI(Math.floor(L.s/SEG));const ds=wdiff(L.s-pe.s);
    if(!L.spill&&(ds<-220||ds>1300||i>Z.sq+m_(150))){L.act=false;L.g.visible=false;}
    else{let v=L.spill?0:15;const dp=wdiff(pe.s-L.s);if(dp>0&&dp<24&&Math.abs(pe.lat-L.lat)<2.6)v=Math.min(v,Math.max(0,pe.v-2));
      L.v+=clamp(v-L.v,-7*dt,2.5*dt);L.s=wrapS(L.s+L.v*dt);i=wrapI(Math.floor(L.s/SEG));at(L.s,L.lat,0,L.g.position);const sl=(H[wrapI(i+1)]-H[wrapI(i-1)])/(2*SEG);L.g.rotation.set(-Math.atan(sl),yaw(i),0);
      for(const w of L.g.wh)w.rotation.x+=L.v*dt/.5;if(L.bt>0)L.bt-=dt;
      if(L.wob>0){L.wob=Math.max(0,L.wob-dt*1.6);const q=Math.sin(L.wob*34)*L.wob*.12;L.g.scale.set(1+q,1-q,1+q*.4);if(!L.wob)L.g.scale.set(1,1,1);}
      const dc=wdiff(pe.s-(L.s+1.95)),dl=pe.lat-L.lat;
      if(Math.abs(dc)<8.6&&Math.abs(dl)<2.25&&!PL.crash&&G.state==='race'){
        if(pe.v>78.2&&PL.safe<=0)crashPlayer(Math.max(Math.abs(pe.v-L.v),20)*.4,false);   // over 175 mph it's a crash, as with any vehicle
        else{const n=Nn[i],tg=T[i],sd=Math.sign(dl)||1,rear=Math.abs(dl)<1.2;
          if(rear){const ov=8.6-Math.abs(dc),sg=Math.sign(dc);PL.x+=tg.x*sg*ov;PL.z+=tg.z*sg*ov;}else{const ov=2.25-Math.abs(dl);PL.x+=n.x*sd*ov;PL.z+=n.z*sd*ov;}
          if(!(L.bt>0)){L.bt=.7;L.wob=1;PL.vx*=rear?.8:.93;PL.vz*=rear?.8:.93;G.shake=Math.max(G.shake,.25);sfxBoing(clamp(Math.abs(pe.v-L.v)/20+.45,.45,1));if(!L.spill)logSpill(sd,rear);}}}}}
  if(!L.spill)return;if(L.kc>0)L.kc-=dt;
  for(const o of L.logs){const i=wrapI(Math.floor(o.s/SEG)),xs=Math.sign(T[i].z*Nn[i].x-T[i].x*Nn[i].z)||1,as=Math.cos(o.ya),al=xs*Math.sin(o.ya);
    // the player shoves a log aside: soft, never a crash
    const rs=wdiff(pe.s-o.s),rl=pe.lat-o.lat,tt=clamp(rs*as+rl*al,-o.L/2,o.L/2),dS=rs-as*tt,dL=rl-al*tt,d=Math.hypot(dS,dL);
    if(d<o.r+1.1&&o.y<2.5&&d>.01&&G.state==='race'){const imp=clamp(pe.v*.5,3,30);o.vs+=-dS/d*imp*.6+pe.v*.35;o.vl+=-dL/d*imp;o.vy+=imp*.12;o.wy+=R(-1,1);
      const ov=o.r+1.1-d,n=Nn[i],tg=T[i];PL.x+=(tg.x*dS/d+n.x*dL/d)*ov*.5;PL.z+=(tg.z*dS/d+n.z*dL/d)*ov*.5;PL.vx*=.97;PL.vz*=.97;if(!(L.kc>0)){L.kc=.35;sfxBoing(.5);}}
    o.vy-=20*dt;o.s=wrapS(o.s+o.vs*dt);o.lat+=o.vl*dt;o.y+=o.vy*dt;o.pi+=o.wp*dt;o.ya+=o.wy*dt;
    const fl=o.r+Math.abs(Math.sin(o.pi))*o.L/2;
    if(o.y<=fl+.02){if(o.y<fl){o.y=fl;if(o.vy<-2.5){o.vy*=-.3;o.wp*=-.5;o.wy*=.6;sfxBoing(.25);}else o.vy=0;}
      o.pi-=Math.round(o.pi/Math.PI)*Math.PI;o.pi*=Math.exp(-5*dt);o.wp*=Math.exp(-5*dt);o.wy*=Math.exp(-2.5*dt);
      const ps=-al,pl=as,va=o.vs*as+o.vl*al,vp=o.vs*ps+o.vl*pl,va2=va*Math.exp(-3.5*dt),vp2=vp*Math.exp(-.9*dt);o.vs=va2*as+vp2*ps;o.vl=va2*al+vp2*pl;o.wr=-vp2/o.r;}
    o.ro+=o.wr*dt;const wl=wallAt[i]-.6;if(Math.abs(o.lat)>wl){o.lat=Math.sign(o.lat)*wl;o.vl*=-.3;}
    at(o.s,o.lat,o.y,o.m.position);o.m.rotation.set(o.pi,yaw(i)+o.ya,o.ro);}}
function placeVehicle(t){const i=wrapI(Math.floor(t.s/SEG)),j=wrapI(i+1);at(t.s,t.lat,0,t.g.position);const sl=(H[wrapI(i+1)]-H[wrapI(i-1)])/(2*SEG);t.g.rotation.set(-Math.atan(sl),yaw(i),0);t.ob.x=t.g.position.x;t.ob.z=t.g.position.z;}
// Wheels that come off a failing vehicle: a small pool of loose tyres that roll and bounce away, then vanish
const WHL={l:null};
function wheelsOff(t){const W=WHL;if(!W.l){const gm=new THREE.CylinderGeometry(.4,.4,.3,12).rotateZ(Math.PI/2),mm=std({color:0x151515,roughness:.9});W.l=[];for(let k=0;k<10;k++){const m=new THREE.Mesh(gm,mm);m.visible=false;scene.add(m);W.l.push({m,t:0,vx:0,vy:0,vz:0,gy:0,w:0});}}
  const i=wrapI(Math.floor(t.s/SEG)),n=Nn[i],tg=T[i];t.g.updateMatrixWorld(true);
  for(const wh of t.g.wh){const o=W.l.find(q=>q.t<=0);wh.visible=false;if(!o)continue;wh.getWorldPosition(o.m.position);o.gy=o.m.position.y;o.t=R(4,6.5);o.m.visible=true;o.m.rotation.set(0,yaw(i),0);const sd=wh.position.x>=0?1:-1;
    o.vx=tg.x*t.v*R(.8,1.3)+n.x*sd*R(2,7);o.vz=tg.z*t.v*R(.8,1.3)+n.z*sd*R(2,7);o.vy=R(3,7);o.w=R(8,16);}
  t.dead=1;sfxCrunch(.6);sfxScrape(1);G.shake=Math.max(G.shake,.2);}
function wheelsTick(dt){const W=WHL;if(!W.l)return;for(const o of W.l){if(o.t<=0)continue;o.t-=dt;if(o.t<=0){o.m.visible=false;continue;}o.vy-=20*dt;const p=o.m.position;p.x+=o.vx*dt;p.z+=o.vz*dt;p.y+=o.vy*dt;if(p.y<o.gy&&o.vy<0){p.y=o.gy;o.vy*=-.4;if(o.vy<1)o.vy=0;const k=Math.exp(-.5*dt*6);o.vx*=k;o.vz*=k;}o.m.rotation.x+=o.w*dt;}}
function trafficTick(dt,pe){bubbleTick(dt);wheelsTick(dt);if(TRAF.pol){const f=(tmNow()*7|0)%2;TRAF.pol[0].emissiveIntensity=f?4:.15;TRAF.pol[1].emissiveIntensity=f?.15:4;}const i0=PL.idx,zn=zoneArr[i0],road=i=>{const c=zoneArr[i];return(c===3&&i>Z.tu1+40&&!(i>Z.detour-60&&i<Z.detour+90))||c===4;},on=road(i0),bay=i0>=Z.b0-250&&i0<=Z.b1,
    rsr=i0>=Z.rb0-250&&i0<=Z.rb1,i880=i0>Z.tu1&&i0<Z.b0-250,gap=bay?48:rsr?90:70,spd=bay?1:1.2;   // I-880 and the San Rafael bridge: fewer vehicles, further apart and a bit quicker; the Bay Bridge stays busy for the earthquake
  {const gt=TRAF.find(o=>o.n===99);if(gt){if(i0<Z.gg0-200||i0>Z.gg1+200){TRAF.ggDone=0;if(gt.act&&i0>Z.gg1+100)gt.qf=false;}   // the Golden Gate tanker: one sure fuel tanker trundling along in your lane on the bridge, every time you cross
    if(!TRAF.ggDone&&!gt.act&&!gt.fall&&i0>=Z.gg0&&i0<Z.gg0+40&&G.state==="race"){TRAF.ggDone=1;const s=wrapS(pe.s+170),i=wrapI(Math.floor(s/SEG)),w=RW+XW[i],ln=[-.75,-.25,.25,.75].map(k=>k*w).reduce((a,b)=>Math.abs(b-pe.lat)<Math.abs(a-pe.lat)?b:a);
      Object.assign(gt,{act:true,s,lt:ln,lat:ln,vb:9,v:9,dead:0,stop:0,sk:0,lw:0,qf:true,hit:0});gt.g.visible=true;gt.g.rotation.z=0;for(const wh of gt.g.wh)wh.visible=true;}}}
  for(const t of TRAF){
    if(t.cr){const C=t.cr;C.t+=dt;const k=sst(C.t,0,.22);t.g.scale.set(1+.32*k,1-.74*k,1+.1*k);t.g.position.y=C.y-.15*k;t.ob.x=1e9;   // crushed by the beetle: flattened, it stays as a wreck, smoking, then is cleared away
      if(C.t<2.5&&Math.random()<dt*5)puff(V.set(t.g.position.x,t.g.position.y+.4,t.g.position.z),R(-.5,.5),R(1.5,3),R(-.5,.5),R(1,2),R(3,5),R(1.2,2),.5,0x2a2826);
      if(C.t>7||wdiff(t.s-pe.s)<-160){t.cr=null;t.act=false;t.qf=false;t.g.visible=false;t.g.scale.set(1,1,1);t.dead=0;t.stop=0;for(const wh of t.g.wh)wh.visible=true;}continue;}
    if(t.fall){const F=t.fall;F.vy-=20*dt;if(F.boom>0){F.boom-=dt;if(F.boom<=0)fireball(t.g.position,t);}
      t.g.position.x+=F.vx*dt;t.g.position.z+=F.vz*dt;t.g.position.y+=F.vy*dt;t.g.rotation.x+=F.w*dt;t.g.rotation.z+=F.w*.3*dt;t.ob.x=1e9;
      if(t.g.position.y<-44&&!F.sp){F.sp=1;sfxSplash();NOGY=1;for(let k=0;k<26;k++){const a=R(0,6.283),sp=R(2,8);puff(V.set(t.g.position.x,-44.6,t.g.position.z),Math.cos(a)*sp,R(5,16),Math.sin(a)*sp,R(.8,1.6),R(4,7),R(1.2,2.4),.8,0xeef2f4);}NOGY=0;}
      if(t.g.position.y<-60){t.hit=0;t.fall=null;t.act=false;t.qf=false;t.g.visible=false;}continue;}
    const want=on&&t.n<(bay?11:rsr?4:i880?5:9);
    if(t.act){const ds=wdiff(t.s-pe.s),i=wrapI(Math.floor(t.s/SEG));if(!t.qf&&(ds<-160||ds>1000||(!want&&ds>-40)||!road(i))){t.act=false;t.g.visible=false;t.ob.x=1e9;}}
    if(!t.act){if(want&&Math.random()<dt*1.5){const s=wrapS(pe.s+R(300,850)),i=wrapI(Math.floor(s/SEG));if(road(i)&&!(QK.st&&i>QK.a-200&&i<QK.b+10)&&!FQ.list.some(q=>(q.Fs||[]).some(F=>Math.abs(wdiff(F.s-s))<160))){const w=RW+XW[i],ln=[-.75,-.25,.25,.75][Math.random()*4|0]*w;
        if(TRAF.every(o=>!o.act||Math.abs(wdiff(o.s-s))>gap||Math.abs(o.lt-ln)>1.5)){t.act=true;t.s=s;t.lt=t.lat=ln;t.v=t.vb*spd;t.g.visible=true;t.dead=0;t.stop=0;t.sk=0;t.g.rotation.z=0;for(const wh of t.g.wh)wh.visible=true;t.lw=t.kind!=='moto'&&t.kind!=='bike'&&t.kind!=='buggy'&&!t.g.legs&&!t.extra&&Math.random()<.12?R(3,9):0;}}}continue;}
    let v=t.kind==='buggy'||t.kind==='ox'?t.vb:t.vb*spd;for(const o of TRAF){if(o===t||!o.act||o.fall||Math.abs(o.lt-t.lt)>1.5)continue;const d=wdiff(o.s-t.s);if(d>0&&d<(t.len+o.len)/2+14)v=Math.min(v,o.v*.9);}
    if(DUCK.st===1){const dd=wdiff(DUCK.s-t.s);if(dd>0&&dd<55)v=Math.min(v,Math.max(0,(dd-t.len/2-7)*.5));}   // everyone stops for the ducks
    t.sw=0;for(const q of FQ.list)for(const F of q.Fs||[]){if(F.kL<.05)continue;const dd=wdiff(F.s-t.s);if(dd>-6&&dd<170&&t.lat>F.lo-1.6&&t.lat<F.hi+1.6){t.lt=F.free;t.sw=1;if(Math.abs(t.lat-F.free)>1.2)v=Math.min(v,Math.sqrt(12*Math.max(0,dd-t.len/2-5)));}}   // and for a fissure: brake hard, and squeeze past in the open lane
    if(t.dead)v=0;   // no wheels: grinds to a halt
    const dp=wdiff(pe.s-t.s);if(dp>0&&dp<(t.len/2+16)&&Math.abs(pe.lat-t.lat)<2.6)v=Math.min(v,Math.max(0,pe.v-2));   // don't run into the player from behind
    const i=wrapI(Math.floor(t.s/SEG));
    if(QK&&QK.st&&QK.t>2.2&&t.lat<QK.ls-.4&&i>=QK.a&&i<=QK.b){const tg=T[i];t.fall={vx:tg.x*Math.max(t.v,5),vz:tg.z*Math.max(t.v,5),vy:1,w:R(.8,1.5)};sfxCrunch(.5);continue;}   // the road has gone from under it
    if(t.sk)t.v=Math.max(0,t.v-(t.v*.9+2)*dt);else t.v+=clamp(v-t.v,-9*dt,3*dt);t.s=wrapS(t.s+t.v*dt);const w=RW+XW[i];t.lt=clamp(t.lt,-.75*w,.75*w);t.lat+=clamp(t.lt-t.lat,-(t.sw?3:1.5)*dt,(t.sw?3:1.5)*dt);
    if(t.kv){t.lat+=t.kv*dt;t.kv*=Math.exp(-2.2*dt);if(Math.abs(t.kv)<.2)t.kv=0;t.lt=clamp(t.lat,-.75*w,.75*w);const wl=wallAt[i]-.5;   // knocked sideways by the player
      if(Math.abs(t.lat)>wl){if(zoneArr[i]===4){const n=Nn[i],tg=T[i],sd=Math.sign(t.lat),out=Math.max(3,Math.abs(t.kv));t.fall={vx:tg.x*t.v+n.x*sd*out,vz:tg.z*t.v+n.z*sd*out,vy:2.5,w:R(1,1.8)*sd};t.kv=0;sfxCrunch(.8);sfxScrape(1);G.shake=Math.max(G.shake,.4);placeVehicle(t);continue;}   // over the bridge rail and down into the bay, tipping as it goes
        t.lat=Math.sign(t.lat)*wl;t.kv=0;}}
    placeVehicle(t);if(t.jp)beetleJump(t,dt);
    if(t.spr||t.spa){t.spa=(t.spa||0)+(t.spr||0)*dt;t.spr=(t.spr||0)*Math.exp(-1.1*dt);   // careening after a hit by the Sherp: spins round, tyre smoke, then straightens up and drives on
      if(Math.abs(t.spr)<.4){t.spr=0;t.spa=Math.atan2(Math.sin(t.spa),Math.cos(t.spa))*Math.exp(-2.5*dt);if(Math.abs(t.spa)<.02)t.spa=0;}
      t.g.rotation.y+=t.spa;t.g.rotation.z=Math.sin(t.spa*2)*.08*Math.min(1,Math.abs(t.spr)/4);
      if(Math.abs(t.spr)>1&&Math.random()<dt*20){NOGY=1;puff(V.set(t.g.position.x+R(-1,1),t.g.position.y+.3,t.g.position.z+R(-1,1)),R(-1,1),R(.5,1.5),R(-1,1),.5,R(2,4),R(.8,1.4),.45,0xd8d4cc);NOGY=0;}}
    if(t.sk){t.g.rotation.z=t.skd*1.45;t.g.position.y+=.25;if(t.v>1){if(Math.random()<dt*40)spark(V.set(t.g.position.x,t.g.position.y,t.g.position.z),R(-3,3),R(1,4),R(-3,3));if(Math.random()<dt*3&&(t.g.position.x-PL.x)**2+(t.g.position.z-PL.z)**2<1600)sfxScrape(.5);}else if(!t.stop){t.dead=1;t.stop=1;t.ob.x=1e9;}}   // a hit motorbike lies down and slides on ahead, throwing sparks, and stops after 30 m or so
    if(t.lw>0){t.lw-=dt;if(t.lw<=0){if(wdiff(t.s-pe.s)>12&&t.g.visible)wheelsOff(t);else t.lw=.5;}}   // somewhere ahead of the player, the wheels come off
    if(t.dead&&t.v<.3){t.stop=1;t.ob.x=1e9;}   // stopped for good: you can drive through it
    for(const wh of t.g.wh)wh.rotation.x+=t.v*dt/.4;if(t.g.legs){const q=tmNow()*9;t.g.legs.forEach((l,k)=>{l.rotation.x=Math.sin(q+(k%2?0:Math.PI)+(k>1?.6:0))*.5;});}
    if(t.bt>0)t.bt-=dt;
    if(t.wob>0){t.wob=Math.max(0,t.wob-dt*1.6);const q=Math.sin(t.wob*34)*t.wob*.22;t.g.scale.set(1+q,1-q,1+q*.6);if(!t.wob)t.g.scale.set(1,1,1);}   // rubbery: it squashes and springs back a few times after a bump
    const dx=t.g.position.x-PL.x,dz=t.g.position.z-PL.z,rel=Math.abs(pe.v-t.v);
    if(dx*dx+dz*dz<(t.r+1)**2&&!PL.crash&&!t.stop&&G.state==='race'){const two=t.kind==='moto'||t.kind==='bike',n=Nn[i],sd=(dx*n.x+dz*n.z)>=0?1:-1;
      if(t.kind==='tanker'){tankerBoom(t);continue;}   // a fuel tanker: hit it and it goes up in a fireball; the car drives on through untouched
      if(two){if(!(t.bt>0)){t.bt=.6;t.wob=1;if(t.kind==='moto'&&zoneArr[i]===4&&i>=Z.b0&&i<=Z.b1&&(t.hit=(t.hit||0)+1)>=2){const tg=T[i],s2=Math.sign(t.lat)||sd;t.fall={vx:tg.x*Math.max(t.v,8)+n.x*s2*9,vz:tg.z*Math.max(t.v,8)+n.z*s2*9,vy:2,w:R(2,4)*s2};sfxCrunch(.6);sfxScrape(1);bubble(t.g,"HEY DUDE, WATCH IT!");}
        t.s+=2.5;t.v=Math.max(t.v,pe.v+R(5,9));t.kv=sd*R(3.5,6.5);PL.vx*=.98;PL.vz*=.98;G.shake=Math.max(G.shake,.15);sfxBoing(.6);if(t.kind==='moto'&&!t.fall){t.sk=1;t.skd=sd;t.v=Math.max(pe.v*.95,16);t.kv=sd*R(1,2.5);sfxScrape(1);}}}   // motorcycles and bicycles: never a crash, at any speed, just bounced on ahead
      else if(pe.v>78.2&&PL.safe<=0)crashPlayer(Math.max(rel,20)*.4,false);   // over 175 mph, a crash
      else if(!(t.bt>0)){t.bt=.7;t.wob=1;if(t.g.drums&&dropDrums(t,sd,n)){PL.vx*=.85;PL.vz*=.85;sfxCrunch(.5);say('THE DRUMS FALL OFF','TOXIC WASTE',1.8);}if((t.kind==='truck'||t.kind==='truck2')&&zoneArr[i]===4&&(t.hit=(t.hit||0)+1)>=2){const tg=T[i],s2=Math.sign(t.lat)||sd;t.fall={vx:tg.x*t.v+n.x*s2*8,vz:tg.z*t.v+n.z*s2*8,vy:3,w:R(.5,1)*s2,boom:.7};sfxScrape(1);}
        t.kv=sd*clamp(rel*.55+6,6,18);t.v=Math.max(t.v*.85,t.v+(pe.v>t.v?rel*.3:0));PL.vx*=.93;PL.vz*=.93;PL.x-=n.x*sd*.6;PL.z-=n.z*sd*.6;G.shake=Math.max(G.shake,.25);sfxBoing(clamp(rel/20+.45,.45,1));
        if(hero.sherpTyres){t.kv=sd*clamp(rel*.7+12,12,26);t.spr=(Math.random()<.5?-1:1)*R(6,10);t.v=Math.max(3,t.v*.7);PL.vx/=.95;PL.vz/=.95;PL.bump=Math.max(PL.bump||0,.35);sfxScrape(.7);}}}}}   // the Sherp barely notices: whatever it hits careens away, spinning out of control   // below that a soft, rubbery bump: both bounce apart, hardly slowed, and the other one wobbles like jelly
// a small floating speech bubble over a vehicle (one shared sprite), and the fireball when a tanker goes up
const BUB={sp:null,c:null,tx:null,g:null,t:0};
function bubble(g,txt){if(!BUB.sp){const c=document.createElement('canvas');c.width=512;c.height=96;BUB.c=c;BUB.tx=new THREE.CanvasTexture(c);BUB.tx.colorSpace=THREE.SRGBColorSpace;BUB.sp=new THREE.Sprite(new THREE.SpriteMaterial({map:BUB.tx,depthTest:false,transparent:true}));BUB.sp.scale.set(7,1.31,1);BUB.sp.renderOrder=9;scene.add(BUB.sp);}
  const x=BUB.c.getContext('2d');x.clearRect(0,0,512,96);x.fillStyle='#fff';x.strokeStyle='#111';x.lineWidth=5;x.beginPath();x.roundRect?x.roundRect(4,4,504,72,24):x.rect(4,4,504,72);x.fill();x.stroke();x.fillStyle='#111';x.font='900 40px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(txt,256,42,480);BUB.tx.needsUpdate=true;BUB.g=g;BUB.t=3;BUB.sp.visible=true;}
function bubbleTick(dt){if(!BUB.sp||BUB.t<=0)return;BUB.t-=dt;if(BUB.t<=0||!BUB.g){BUB.sp.visible=false;return;}BUB.sp.position.set(BUB.g.position.x,BUB.g.position.y+3.2,BUB.g.position.z);}
function fireball(p,t){const x=p.x,y=p.y,z=p.z;for(let k=0;k<34;k++){const a=R(0,6.283),sp=R(1,9);puff(V.set(x,y+1,z),Math.cos(a)*sp,R(2,14),Math.sin(a)*sp,R(2,4),R(7,13),R(.7,1.6),.9,k%3?0xff7a1c:0xffd060);}
  for(let k=0;k<16;k++){const a=R(0,6.283),sp=R(1,5);puff(V.set(x,y+2,z),Math.cos(a)*sp,R(5,16),Math.sin(a)*sp,R(3,5),R(9,16),R(1.8,3.2),.7,0x151311);}
  sfxCrunch(1);sfxBoing(.3);G.shake=Math.max(G.shake,.5);t.fall=null;t.act=false;t.qf=false;t.hit=0;t.g.visible=false;t.ob.x=1e9;}
function tankerBoom(t){const p=V2.copy(t.g.position),x=p.x,y=p.y,z=p.z;   // a tanker truck going up: a big fireball, burning wreckage flung about, a black mushroom; the player feels only the shake
  for(let k=0;k<40;k++){const a=R(0,6.283),sp=R(3,15);puff(V.set(x+R(-3,3),y+2,z+R(-3,3)),Math.cos(a)*sp,R(6,24),Math.sin(a)*sp,R(3,6),R(12,22),R(1,2),.95,k%3?0xff7a1c:0xffd060);}
  for(let k=0;k<20;k++){const a=R(0,6.283),sp=R(1,6);puff(V.set(x,y+6,z),Math.cos(a)*sp,R(12,24),Math.sin(a)*sp,R(5,8),R(18,30),R(2.5,4.5),.75,0x151311);}
  for(let k=0;k<18;k++){const a=R(0,6.283),sp=R(6,18);flame(V.set(x,y+2,z),Math.cos(a)*sp,R(6,16),Math.sin(a)*sp,R(.8,1.6),R(2,4),R(.8,1.6),0xff8a2a);}
  fireball(p,t);sfxThump(2.2);say("KABOOM !","THE TANKER GOES UP",1.6);}
function sfxBoing(k){if(!AC)return;const t=AC.currentTime;tone('sine',R(150,190),t,.32,.5*k,master,{to:R(330,420),a:.004,h:.15});tone('sine',R(90,110),t+.06,.28,.3*k,master,{to:60,h:.2});}
// ---- San Quentin's beach (east of the prison, down to the bay): big surf crashing in and people flying kites. Hyde St: a few people on the pavements, and kids skateboarding down the middle of the road below the crest (solid: steer round them).
// All made after bakeStatic, with their own seeded numbers so nothing else moves.
const SQB={g:null,waves:[],kites:[]},HYD={walk:[],kids:[],t:0,go:0};
if(DRIVE){const m_=x=>Math.round(x/SEG),lr=(()=>{let s=90210;return()=>(s=(s*16807)%2147483647)/2147483647;})(),LR=(a,b)=>a+lr()*(b-a);
  const skin=[0xd9a988,0x8a5a3c,0xc48a62,0xf0c8a8,0x5a3a26].map(c=>std({color:c,roughness:.8})),cloth=c=>std({color:c,roughness:.9});
  const person=(top,leg,sc=1,par=scene)=>{const g=new THREE.Group(),b=new THREE.Group();g.add(b);const bx=(sx,sy,sz,mm,x,y,z,p=b)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mm);o.position.set(x,y,z);o.castShadow=true;p.add(o);return o;};
    bx(.46,.62,.26,cloth(top),0,1.18,0);const hd=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),skin[lr()*skin.length|0]);hd.position.y=1.66;b.add(hd);
    g.legs=[-1,1].map(s=>{const p=new THREE.Group();p.position.set(s*.12,.86,0);bx(.16,.84,.18,cloth(leg),0,-.42,0,p);b.add(p);return p;});
    g.arms=[-1,1].map(s=>{const p=new THREE.Group();p.position.set(s*.3,1.45,0);bx(.11,.6,.13,cloth(top),0,-.3,0,p);b.add(p);return p;});
    g.scale.setScalar(sc);g.b=b;par.add(g);return g;};
  const TOPS=[0x8a2a2a,0x2a4a7a,0xd8d0b8,0x3a5a3a,0xc98a2a,0x5a3a6a,0x1c1c1e,0xe0e0e0],LEGS=[0x2a2f3a,0x3a3a3a,0x6a5a44,0x22324a];
  for(let k=0;k<9;k++){const g=person(TOPS[k%TOPS.length],LEGS[k%LEGS.length]),o={x:1e9,z:1e9,r:.55};g.visible=false;OBST.push(o);
    HYD.walk.push({g,o,sd:k%2?1:-1,s:(Z.hyde+m_(LR(40,600)))*SEG,dir:lr()<.5?-1:1,sp:LR(1.1,1.6),lo:(Z.hyde+m_(30))*SEG,hi:(Z.marina-m_(40))*SEG,ph:lr()*6});}
  const deck=std({color:0x8a4a22,roughness:.7}),whl=std({color:0xe8e0c8,roughness:.6});
  for(let k=0;k<9;k++){const g=person(TOPS[(k*3+1)%TOPS.length],LEGS[k%LEGS.length],.78),bd=new THREE.Mesh(new THREE.BoxGeometry(.24,.05,.82),deck);bd.position.y=.1;g.add(bd);
    for(const[x,z]of[[-.09,.28],[.09,.28],[-.09,-.28],[.09,-.28]]){const w=new THREE.Mesh(cyl(.035,.035,.04,8).rotateZ(Math.PI/2),whl);w.position.set(x,.04,z);g.add(w);}
    g.b.position.y=.13;g.b.rotation.y=Math.PI/2*(k%2?1:-1)*.85;g.legs[0].rotation.x=.25;g.legs[1].rotation.x=-.25;g.arms[0].rotation.z=-.9;g.arms[1].rotation.z=.9;g.visible=false;const o={x:1e9,z:1e9,r:.9};OBST.push(o);
    HYD.kids.push({g,o,bd:g.children[1],up:k>=5,s:(Z.hyde+m_(300-(k-5)*40))*SEG,tt:LR(1,4),tr:-1,s0:(Z.hyde+m_(450+k*32))*SEG,d:0,sp:LR(2.5,4.5),ph:lr()*6,wf:LR(.35,.6),c:k>=5?-LR(2,3.4):LR(-3.2,3.2)});}
  // the beach: sand from the edge of the Marin shore (x -5560) down into the bay, with the waterline at about x -5100, right beside the San Rafael bridge
  const G0=new THREE.Group();G0.visible=false;scene.add(G0);SQB.g=G0;const x0=-5561,x1=-5100,xe=-4950,z0=-9420,z1=-9772,yb=x=>-45*(x-x0)/(x1-x0);SQB.yb=yb;SQB.x1=x1;
  {const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([x0,.05,z0, x0,.05,z1, xe,yb(xe),z0, xe,yb(xe),z1],3));g.setIndex([0,2,1,1,2,3]);g.computeVertexNormals();
   const s=new THREE.Mesh(g,std({color:0xcbb68a,roughness:1,side:THREE.DoubleSide}));s.receiveShadow=true;G0.add(s);}
  const wg=new THREE.CylinderGeometry(1,1,z0-z1,18,1,true,0,Math.PI).rotateX(Math.PI/2).rotateZ(Math.PI/2),fg=new THREE.PlaneGeometry(1,z0-z1).rotateX(-Math.PI/2),wm=std({color:0x4f6e74,roughness:.25,metalness:.2,side:THREE.DoubleSide}),lm=std({color:0xeef2f2,roughness:.6});
  for(let k=0;k<5;k++){const w=new THREE.Mesh(wg,wm),lip=new THREE.Mesh(new THREE.BoxGeometry(3.2,1.4,z0-z1-6),lm),fm=new THREE.MeshBasicMaterial({color:0xf2f5f5,transparent:true,opacity:0,depthWrite:false}),f=new THREE.Mesh(fg,fm);
    w.position.z=lip.position.z=f.position.z=(z0+z1)/2;f.rotation.z=-Math.atan(45/(x1-x0));G0.add(w,lip,f);SQB.waves.push({w,lip,f,fm,ph:k/5});}
  const KC=[0xd8261c,0xf2c230,0x1f6fd8,0x2aa84a,0xe85aa8,0xffffff];
  for(let k=0;k<5;k++){const x=LR(-5450,-5300),z=LR(z1+40,z0-40),p=person(TOPS[(k+2)%TOPS.length],LEGS[k%LEGS.length],1,G0);p.position.set(x,yb(x),z);p.rotation.y=-Math.PI/2;p.arms[1].rotation.x=-2.2;p.arms[0].rotation.x=-1.4;
    const kt=new THREE.Mesh(new THREE.PlaneGeometry(2.6,2.6),std({color:KC[k%KC.length],roughness:.7,side:THREE.DoubleSide}));kt.scale.set(.75,1.15,1);const kg=new THREE.Group(),kd=new THREE.Group();kd.rotation.z=Math.PI/4;kd.add(kt);kg.add(kd);
    const tl=new THREE.Mesh(new THREE.PlaneGeometry(.2,6).translate(0,-4.2,0),std({color:KC[(k+3)%KC.length],side:THREE.DoubleSide}));kg.add(tl);G0.add(kg);
    const ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0x222222}));ln.frustumCulled=false;G0.add(ln);
    SQB.kites.push({p,kg,tl,ln,x,y:yb(x),z,ph:lr()*6,L:LR(40,58)});}}
function LR2(a,b){return a+Math.random()*(b-a);}
// tricks for a skater: an ollie (hop), a kickflip (the board spins on its long axis) or a 360 spin, arms out, now and then
function skTrick(k,rdt){k.tt-=rdt;if(k.tr<0&&k.tt<=0){k.tr=0;k.kind=Math.random()*3|0;k.tt=LR2(2.5,5);}
  if(k.tr>=0){k.tr+=rdt/.7;const u=Math.min(1,k.tr);k.hop=Math.sin(u*Math.PI)*(k.kind===2?.35:.75);if(k.bd)k.bd.rotation.z=k.kind===1?u*Math.PI*2:0;k.sp360=k.kind===2?u*Math.PI*2:0;k.g.arms[0].rotation.z=-1.5;k.g.arms[1].rotation.z=1.5;if(k.tr>=1){k.tr=-1;k.hop=0;k.sp360=0;if(k.bd)k.bd.rotation.z=0;k.g.arms[0].rotation.z=-.9;k.g.arms[1].rotation.z=.9;}}}
function mh_(x){return Math.round(x/SEG);}
function sqHydTick(rdt){if(!DRIVE)return;const pe=ents.find(e=>e.player);if(!pe)return;HYD.t+=rdt;const t=HYD.t,i0=PL.idx,city=i0>=Z.b1&&i0<Z.gg0;
  for(const w of HYD.walk){if(!city){if(w.g.visible){w.g.visible=false;w.o.x=1e9;}continue;}w.s+=w.dir*w.sp*rdt;if(w.s>w.hi){w.s=w.hi;w.dir=-1;}if(w.s<w.lo){w.s=w.lo;w.dir=1;}
    const i=wrapI(Math.floor(w.s/SEG)),q=Math.sin(t*w.sp*5.5+w.ph)*.5;at(w.s,w.sd*(8.1+XW[i]),.13,w.g.position);w.g.rotation.y=yaw(i)+(w.dir<0?Math.PI:0);w.g.visible=true;
    w.g.legs[0].rotation.x=q;w.g.legs[1].rotation.x=-q;w.g.arms[0].rotation.x=-q*.8;w.g.arms[1].rotation.x=q*.8;w.o.x=w.g.position.x;w.o.z=w.g.position.z;}
  const bot=(Z.marina-Math.round(40/SEG))*SEG;
  if(i0<Z.hyde)HYD.go=0;else if(i0>=Z.hyde+mh_(345))HYD.go=1;   // the downhill kids start rolling when you reach the top of Hyde St
  for(const k of HYD.kids){const lo=Z.hyde-mh_(20),hi=Z.hyde+mh_(380);if(k.up){if(!city||i0<lo||i0>hi){if(k.g.visible){k.g.visible=false;k.o.x=1e9;}continue;}
      k.s-=k.sp*1.5*rdt;if(k.s<pe.s-70||k.s<(Z.hyde+mh_(30))*SEG)k.s=Math.min(pe.s+LR2(130,260),(Z.hyde+mh_(355))*SEG);   // up kids roll down the climb towards and past you, then are put back up the hill ahead
      const i=wrapI(Math.floor(k.s/SEG)),a=t*k.wf+k.ph,lat=clamp(k.c+Math.sin(a)*1.6,-5.4,5.4),sl=(H[wrapI(i+1)]-H[wrapI(i-1)])/(2*SEG);skTrick(k,rdt);at(k.s,lat,k.hop||0,k.g.position);k.g.rotation.set(-Math.atan(sl),Math.atan2(-T[i].x,-T[i].z)+(k.sp360||0),0,'YXZ');k.g.visible=true;k.o.x=k.g.position.x;k.o.z=k.g.position.z;}}
  for(const k of HYD.kids){if(k.up)continue;if(!city){if(k.g.visible){k.g.visible=false;k.o.x=1e9;}continue;}
    let s=k.s0+k.d;const gap=s-pe.s,air=k.ay>0||k.held;if(!air&&(gap<-60||k.d>260)&&Math.abs(gap)>150){k.d=0;s=k.s0;}   /* once well behind the driver, back up the hill to go again */
    if(HYD.go&&s<bot){k.d+=k.sp*rdt;s=k.s0+k.d;if(s>=bot&&!air)k.d=0;}if(HYD.go&&!air)skTrick(k,rdt);
    const i=wrapI(Math.floor(s/SEG)),a=t*k.wf+k.ph,lat=clamp(k.c+Math.sin(a)*2.6,-5.4,5.4),dl=Math.cos(a)*2.6*k.wf/Math.max(k.sp,.5),sl=(H[wrapI(i+1)]-H[wrapI(i-1)])/(2*SEG);
    at(s,lat,(k.hop||0)+(k.ay||0),k.g.position);k.g.rotation.set(-Math.atan(sl),Math.atan2(T[i].x+Nn[i].x*dl,T[i].z+Nn[i].z*dl)+(k.sp360||0),0,"YXZ");k.g.visible=true;k.o.x=k.g.position.x;k.o.z=k.g.position.z;}
  const near=i0>Z.sq-Math.round(300/SEG)&&i0<Z.rb0+Math.round(700/SEG);SQB.g.visible=near;if(!near)return;
  const yb=SQB.yb,x1=SQB.x1;
  for(const w of SQB.waves){const p=(t/8+w.ph)%1,x=x1+250-p*245,h=p<.72?lerp(.8,7.5,p/.72):7.5*Math.max(0,1-(p-.72)/.12);   // each wave rolls in, rears up, and breaks on the sand
    w.w.position.set(x,-45,w.w.position.z);w.w.scale.set(lerp(13,7,p),Math.max(h,.01),1);w.w.visible=h>.05;w.lip.position.set(x-lerp(1,4,p),-45+h,w.lip.position.z);w.lip.rotation.z=p>.6?(p-.6)*4:0;w.lip.visible=h>.3;w.lip.scale.y=lerp(.5,1.6,clamp(p/.72,0,1));
    const q=p<.8?-1:(p-.8)/.2;w.f.visible=q>=0;if(q>=0){const fx=x1-q*48;w.f.position.set(fx,yb(fx)+.12,w.f.position.z);w.f.scale.x=lerp(30,12,q);w.fm.opacity=.85*(1-q);}}
  for(const k of SQB.kites){const a=t*.6+k.ph,kx=k.x-k.L*.7+Math.sin(a*.7)*3,ky=k.y+k.L*.75+Math.sin(a)*2.5,kz=k.z+Math.sin(a*.5)*5;k.kg.position.set(kx,ky,kz);k.kg.rotation.set(Math.sin(a*1.3)*.2,Math.PI/2,Math.sin(a*.9)*.35);k.tl.rotation.z=Math.sin(a*3)*.3;
    const pa=k.ln.geometry.attributes.position;pa.setXYZ(0,k.x,k.y+1.8,k.z);pa.setXYZ(1,kx,ky,kz);pa.needsUpdate=true;}}
// ---- Marina Blvd: a field of grazing cows on the left; on the right a dark grey sea, heaving behind a sea wall. Now and then a wave breaks over the wall and washes right across the lanes,
// leaving fish, squid and seaweed on the road for a minute or two (small pieces get kicked about by the car; the odd big fish is solid). Driving into the wash splashes, drags the car and pushes it sideways (PL.wash, read in playerUpdate).
// All made after bakeStatic, with its own seeded numbers, so nothing else on the loop moves.
const MAR={on:false,t:0,cows:[],deb:[],waves:[],next:2,g:null,sea:null,a:0,b:0};window.__MAR=MAR;
if(DRIVE){const m_=x=>Math.round(x/SEG),lr=(()=>{let s=4471;return()=>(s=(s*16807)%2147483647)/2147483647;})(),LR=(a,b)=>a+lr()*(b-a),D2=THREE.DoubleSide;
  const a=Z.marina+m_(150),b=Z.gg0-m_(340),G1=new THREE.Group();MAR.a=a;MAR.b=b;MAR.g=G1;scene.add(G1);
  const add=o=>{scene.remove(o);G1.add(o);return o;};   /* ribbon() puts its strip straight into the scene: keep the Marina's in one group so the whole stretch can be hidden at once */
  // the field: rough grass from the back of the pavement out to 95 m, with a post-and-rail fence along the road
  const grassT=canvas(256,256,(g,w,h)=>{g.fillStyle='#4d682c';g.fillRect(0,0,w,h);const C=['#5d7a34','#41572a','#6c8b3e','#38491f','#7a8a44'];for(let k=0;k<3200;k++){g.fillStyle=C[k%5];g.fillRect(lr()*w,lr()*h,1+lr()*2,2+lr()*6);}});
  grassT.wrapS=grassT.wrapT=THREE.RepeatWrapping;grassT.repeat.set(8,1);
  add(ribbon(i=>edgeAt[i]+.3,95,.06,.06,std({map:grassT,roughness:1}),10,a,b));
  const woodM=std({color:0x6e5a44,roughness:1,side:D2});for(const y of[.62,1.08])add(ribbon(i=>edgeAt[i]+1.4,i=>edgeAt[i]+1.4,y,y+.12,woodM,10,a,b));
  {const n=Math.ceil((b-a)/2)+2,posts=new THREE.InstancedMesh(new THREE.BoxGeometry(.13,1.35,.13),woodM,n),M=new THREE.Matrix4(),V=new THREE.Vector3();let k=0;
   for(let i=a;i<=b&&k<n;i+=2){off(i,edgeAt[i]+1.4,.67,V);M.makeTranslation(V.x,V.y,V.z);posts.setMatrixAt(k++,M);}posts.count=k;posts.castShadow=true;G1.add(posts);}
  // the cows: a small herd in two loose groups, Holsteins and a few browns
  const hideT=canvas(128,128,(g,w,h)=>{g.fillStyle='#f0ede6';g.fillRect(0,0,w,h);g.fillStyle='#181614';for(let k=0;k<8;k++){g.beginPath();g.ellipse(lr()*w,lr()*h,8+lr()*24,6+lr()*16,lr()*3,0,6.283);g.fill();}});
  const cowMs=[std({map:hideT,roughness:.9}),std({color:0x6a4026,roughness:.9}),std({map:hideT,roughness:.9}),std({color:0x2a2420,roughness:.9}),std({color:0x9a6a3e,roughness:.9})],
    pinkM=std({color:0xd89a92,roughness:.8}),hoofM=std({color:0x1c1a18,roughness:.8}),hornM=std({color:0xd8d0b8,roughness:.6});
  const bx=(sx,sy,sz,mm,x,y,z,p)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mm);o.position.set(x,y,z);o.castShadow=true;p.add(o);return o;};
  const cow=mm=>{const g=new THREE.Group();bx(.8,.8,1.8,mm,0,1.14,0,g);bx(.46,.14,.42,pinkM,0,.7,-.5,g);
    const legs=[[-.27,.64],[.27,.64],[-.27,-.64],[.27,-.64]].map(([x,z])=>{const p=new THREE.Group();p.position.set(x,.82,z);bx(.17,.74,.19,mm,0,-.37,0,p);bx(.18,.1,.2,hoofM,0,-.77,0,p);g.add(p);return p;});
    const nk=new THREE.Group();nk.rotation.order='YXZ';nk.position.set(0,1.34,.82);g.add(nk);bx(.4,.44,.5,mm,0,-.02,.18,nk);bx(.36,.42,.52,mm,0,-.12,.62,nk);bx(.3,.24,.18,pinkM,0,-.24,.94,nk);
    for(const s of[-1,1]){bx(.2,.08,.12,mm,s*.26,0,.5,nk);const hr=new THREE.Mesh(cyl(.02,.04,.18,6),hornM);hr.position.set(s*.13,.13,.48);hr.rotation.z=-s*.6;nk.add(hr);}
    const tl=new THREE.Group();tl.position.set(0,1.46,-.9);g.add(tl);bx(.06,.82,.06,mm,0,-.41,0,tl);bx(.1,.2,.1,hoofM,0,-.86,0,tl);
    G1.add(g);return {g,legs,nk,tl};};
  for(let k=0;k<12;k++){const grp=k%3,i=Math.round(lerp(a,b,[.22,.5,.78][grp])+LR(-30,30)),lat=edgeAt[i]+LR(5,26),V=off(i,lat,0),c=cow(cowMs[lr()*cowMs.length|0]);
    const sc=LR(.9,1.08);c.g.scale.setScalar(sc);Object.assign(c,{x:V.x,y:V.y+.06,z:V.z,x0:V.x,z0:V.z,h:LR(0,6.283),dh:0,st:'graze',tm:LR(1,9),th:1.2,ph:lr()*6.283,yw:0});MAR.cows.push(c);}
  // the sea wall: a plain concrete wall just beyond the lamps, with the water lapping high against it
  const concM=std({color:0x8c8a84,roughness:.95,side:D2}),w0=i=>-(edgeAt[i]+.6),w1=i=>-(edgeAt[i]+1.3);
  add(ribbon(w0,w0,0,1.05,concM,8,a,b));add(ribbon(w0,w1,1.05,1.05,concM,8,a,b));add(ribbon(w1,w1,-1,1.05,concM,8,a,b));
  // the sea: a dark, choppy grey swell rolling in towards the wall; it is lifted to just under the top of the wall (the land beside the Marina is at road level), and drops to the bay at its far edge
  {const LAT=[0,-2,-6,-12,-21,-34,-52,-76,-105,-140,-180,-222,-272],nc=LAT.length,rows=[];for(let i=a;i<=b;i+=3)rows.push(i);if(rows[rows.length-1]!==b)rows.push(b);
   const nr=rows.length,pos=new Float32Array(nr*nc*3),col=new Float32Array(nr*nc*3),la=new Float32Array(nr*nc),sa=new Float32Array(nr*nc),idx=[];
   rows.forEach((i,r)=>{for(let c=0;c<nc;c++){const lat=c===nc-1?LAT[c]:w1(i)+LAT[c],p=off(i,lat,0),q=r*nc+c;pos[q*3]=p.x;pos[q*3+1]=c===nc-1?-45:.7;pos[q*3+2]=p.z;la[q]=lat;sa[q]=i*SEG;
     if(r<nr-1&&c<nc-1)idx.push(q,q+nc,q+1,q+1,q+nc,q+nc+1);}});
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();
   const m=new THREE.Mesh(g,std({vertexColors:true,roughness:.32,metalness:.3,flatShading:true,side:D2}));m.receiveShadow=true;m.frustumCulled=false;G1.add(m);MAR.sea={g,pos,col,la,sa,nc};}
  // breakwaters of dark rock at each end, so the sea has edges
  {const rk=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),std({color:0x3c3a38,roughness:1,flatShading:true}),120),M=new THREE.Matrix4(),Q=new THREE.Quaternion(),E=new THREE.Euler(),S=new THREE.Vector3(),V=new THREE.Vector3();let k=0;
   for(const i of[a,b])for(let lat=-(edgeAt[i]+2.2);lat>-232&&k<120;lat-=LR(3,4.5)){off(i+Math.round(LR(-1,1)),lat,LR(.2,1.4),V);E.set(LR(0,3),LR(0,3),LR(0,3));Q.setFromEuler(E);const s=LR(1.6,2.8);M.compose(V,Q,S.set(s,s*LR(.6,.9),s));rk.setMatrixAt(k++,M);}
   rk.count=k;rk.castShadow=true;G1.add(rk);}
  // the breaking waves: a few, reused. Each is a group set square to the road: local +x is to the left (towards the field), local z is along the road.
  const LW=40,foamT=canvas(128,256,(g,w,h)=>{g.fillStyle='rgba(120,134,138,.75)';g.fillRect(0,0,w,h);for(let k=0;k<1500;k++){g.fillStyle=`rgba(240,244,245,${.35+lr()*.6})`;g.beginPath();g.ellipse(lr()*w,lr()*h,1+lr()*7,1+lr()*3,lr()*3,0,6.283);g.fill();}},true),
    sprayT=canvas(128,128,(g,w,h)=>{for(let k=0;k<1600;k++){const y=h*Math.pow(lr(),1.4);g.fillStyle=`rgba(245,248,250,${(.3+lr()*.6)*(1-.7*y/h)})`;g.beginPath();g.arc(lr()*w,h-y,2+lr()*12*(1-.5*y/h),0,6.283);g.fill();}},true);
  foamT.wrapS=foamT.wrapT=THREE.RepeatWrapping;
  const crestG=new THREE.CylinderGeometry(1,1,LW,18,1,true,0,Math.PI).rotateX(Math.PI/2).rotateZ(Math.PI/2),crestT=canvas(256,16,(g,w,h)=>{const gr=g.createLinearGradient(0,0,w,0);gr.addColorStop(0,"#2c3836");gr.addColorStop(.3,"#4a5c5a");gr.addColorStop(.46,"#c8d2d2");gr.addColorStop(.52,"#f2f5f5");gr.addColorStop(.62,"#8a9a9a");gr.addColorStop(1,"#3a4846");g.fillStyle=gr;g.fillRect(0,0,w,h);for(let k=0;k<400;k++){g.fillStyle=`rgba(240,244,245,${lr()*.5})`;g.fillRect(lr()*w,lr()*h,1+lr()*6,1);}}),crestM=std({map:crestT,roughness:.3,metalness:.15,side:D2}),lipM=std({color:0xe9eef0,roughness:.6});
  for(let k=0;k<3;k++){const g=new THREE.Group();g.visible=false;G1.add(g);const crest=new THREE.Mesh(crestG,crestM),lip=new THREE.Mesh(new THREE.BoxGeometry(1.6,.6,LW-3),lipM);
    const sprayM=new THREE.MeshBasicMaterial({map:sprayT,color:0xeef3f5,transparent:true,opacity:0,depthWrite:false,side:D2}),spray=new THREE.Mesh(new THREE.PlaneGeometry(LW,1).translate(0,.5,0).rotateY(Math.PI/2),sprayM);
    const ft=foamT.clone();ft.needsUpdate=true;ft.repeat.set(1,LW/12);const foamM=new THREE.MeshBasicMaterial({map:ft,color:0xe4eaeb,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),
      foam=new THREE.Mesh(new THREE.PlaneGeometry(1,LW).rotateX(-Math.PI/2).translate(.5,0,0),foamM);foam.position.y=.1;
    const sp2=new THREE.Mesh(spray.geometry,sprayM);sp2.rotation.z=-.65;spray.add(sp2);g.add(crest,lip,spray,foam);MAR.waves.push({g,crest,lip,spray,sprayM,foam,foamM,ft,t:-1,s0:0,ed:10,hit:false,deb:false,fr:0,bk:0});}
  // what the waves leave behind: fish (silver, dark, red), squid, tangles of kelp, and now and then a big fish that is solid
  const fishMs=[std({color:0xa8b2b6,roughness:.3,metalness:.6}),std({color:0x4c5a5c,roughness:.4,metalness:.4}),std({color:0xc0604a,roughness:.4,metalness:.2})],eyeM=std({color:0x0a0a0a,roughness:.2}),
    sqM=std({color:0xdcaaa0,roughness:.35,transparent:true,opacity:.92}),kelpMs=[std({color:0x3c3a18,roughness:.6,side:D2}),std({color:0x4e4a20,roughness:.6,side:D2}),std({color:0x2c3418,roughness:.6,side:D2})],
    octM=[std({color:0x9a3a4a,roughness:.4}),std({color:0xb8584a,roughness:.4})],glassMs=[std({color:0x2f6b3a,roughness:.15,metalness:.2,transparent:true,opacity:.8}),std({color:0x6b3f1a,roughness:.15,metalness:.2,transparent:true,opacity:.8}),std({color:0xc8d8d0,roughness:.1,transparent:true,opacity:.6})],
    trashMs=[std({color:0x1a1a1c,roughness:.5}),std({color:0xd8d4c8,roughness:.8}),std({color:0x8a6a44,roughness:.9}),std({color:0xb83a2a,roughness:.3,metalness:.7})],
    ball=new THREE.SphereGeometry(.5,12,8),fin=new THREE.ConeGeometry(.5,.5,3).rotateX(-Math.PI/2);
  const mk=(kind)=>{const g=new THREE.Group(),bd=new THREE.Group();g.add(bd);const M_=(geo,mm,x,y,z,sx,sy,sz)=>{const o=new THREE.Mesh(geo,mm);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;bd.add(o);return o;};
    if(kind==='fish'||kind==='big'){const s=kind==='big'?LR(3.6,4.4):LR(.8,1.25),fm=fishMs[lr()*fishMs.length|0];M_(ball,fm,0,.06*s,0,.34*s,.12*s,.9*s);M_(fin,fm,0,.06*s,-.55*s,.34*s,.04*s,.3*s);M_(ball,eyeM,.09*s,.12*s,.32*s,.05*s,.05*s,.05*s);}
    else if(kind==='skel'){const s=LR(.7,1.3),bn=std({color:0xe8e2cc,roughness:.8});M_(new THREE.BoxGeometry(1,1,1),bn,0,.03,0,.035*s,.03*s,.95*s);M_(ball,bn,0,.04,.52*s,.1*s,.07*s,.17*s);M_(fin,bn,0,.03,-.55*s,.2*s,.02*s,.22*s);
      for(let k=0;k<7;k++){const z=(k-3)*.11*s;M_(new THREE.BoxGeometry(1,1,1),bn,0,.03,z,.34*s*(1-Math.abs(k-3)*.1),.014*s,.014*s);}}
    else if(kind==='squid'){M_(new THREE.ConeGeometry(.5,1,8).rotateX(Math.PI/2),sqM,0,.07,.18,.18,.18,.42);M_(ball,sqM,0,.07,-.06,.17,.14,.2);
      for(let k=0;k<7;k++){const a=(k/6-.5)*1.4,t=new THREE.Mesh(new THREE.BoxGeometry(.025,.02,.36+lr()*.2),sqM);t.position.set(Math.sin(a)*.12,.02,-.2-Math.cos(a)*.14);t.rotation.y=a;bd.add(t);}}
    else if(kind==='octo'){const om=octM[lr()*2|0];M_(ball,om,0,.16,0,.42,.3,.5);for(let k=0;k<8;k++){const a=k/8*6.283+LR(-.2,.2),L=LR(.5,.8),t=new THREE.Mesh(new THREE.BoxGeometry(.07,.03,L).translate(0,0,L/2),om);t.position.set(Math.sin(a)*.16,.03,Math.cos(a)*.16);t.rotation.y=a+LR(-.5,.5);bd.add(t);}}
    else if(kind==='bottle'){const gm=glassMs[lr()*3|0],b=new THREE.Group();b.add(new THREE.Mesh(cyl(.07,.07,.24,8),gm),new THREE.Mesh(cyl(.025,.06,.1,8).translate(0,.17,0),gm));b.rotation.x=Math.PI/2;b.position.y=.07;b.children.forEach(o=>o.castShadow=true);bd.add(b);}
    else if(kind==='trash'){const tm=trashMs[lr()*trashMs.length|0];if(lr()<.5){M_(new THREE.IcosahedronGeometry(.5,0),tm,0,.14,0,LR(.4,.6),LR(.28,.4),LR(.4,.6));}else{M_(new THREE.BoxGeometry(1,1,1),tm,0,.08,0,LR(.25,.5),LR(.1,.2),LR(.3,.5));M_(cyl(.033,.033,.12,8).rotateX(Math.PI/2),trashMs[3],.3,.035,.1,1,1,1);}}
    else{const n=3+(lr()*4|0);for(let k=0;k<n;k++){const L=LR(.6,1.8),t=new THREE.Mesh(new THREE.BoxGeometry(LR(.06,.14),.015,L).translate(0,0,L/2),kelpMs[lr()*3|0]);t.position.y=.02+k*.004;t.rotation.y=LR(-1.2,1.2)+k*.9;bd.add(t);}
      M_(ball,kelpMs[0],0,.05,0,.12,.1,.12);}
    g.visible=false;G1.add(g);return g;};
  for(let k=0;k<40;k++){const kind=k<3?'big':['fish','weed','fish','squid','fish','weed'][k%6],g=mk(kind),o=kind==='big'?{x:1e9,z:1e9,r:1.2}:null;if(o)OBST.push(o);
    MAR.deb.push({g,bd:g.children[0],kind,o,on:false,age:0,life:60,flop:0,ph:0,gy:0,fly:false,vx:0,vy:0,vz:0,sp:0});}
  for(let k=0;k<30;k++){const kind=k%5<3?'weed':'squid',g=mk(kind);MAR.deb.push({g,bd:g.children[0],kind,o:null,on:false,age:0,life:60,flop:0,ph:0,gy:0,fly:false,vx:0,vy:0,vz:0,sp:0});}   // a bigger pool for the extra squid and seaweed
  for(let k=0;k<60;k++){const kind=['bottle','trash','octo','weed','squid','bottle','trash','weed'][k%8],g=mk(kind);MAR.deb.push({g,bd:g.children[0],kind,o:null,on:false,age:0,life:60,flop:0,ph:0,gy:0,fly:false,vx:0,vy:0,vz:0,sp:0});}   // bottles, rubbish and octopus
  for(let k=0;k<44;k++){const g=mk('skel');MAR.deb.push({g,bd:g.children[0],kind:'skel',o:null,on:false,age:0,life:60,flop:0,ph:0,gy:0,fly:false,vx:0,vy:0,vz:0,sp:0});}   // fish skeletons
  // two whale skeletons, some 15 m and 22 m long, each washed up onto the road by one wave a pass (MAR.whs): local z runs along the body, skull at +z; plain meshes, all with normals
  MAR.whs=[];for(const sc of[1,1.5]){const bn=std({color:0xe2dcc4,roughness:.8}),g=new THREE.Group(),bd=new THREE.Group();g.add(bd);const UP=new THREE.Vector3(0,1,0),V1=new THREE.Vector3(),vG=new THREE.BoxGeometry(1,1,1),V3=(x,y,z)=>new THREE.Vector3(x,y,z);
   const bone=(a,b,r,mm,sh)=>{const o=new THREE.Mesh(cyl(r,r*.85,a.distanceTo(b),7),mm);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(UP,V1.copy(b).sub(a).normalize());o.castShadow=!!sh;bd.add(o);return o;};
   const box=(mm,x,y,z,sx,sy,sz,sh)=>{const o=new THREE.Mesh(vG,mm);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=!!sh;bd.add(o);return o;};
   const ss=t=>{t=clamp(t,0,1);return t*t*(3-2*t);},hz=z=>z<1.2?.12+2.68*ss((z+7.6)/8.8):2.8-1.1*ss((z-1.2)/2.6);   // the height of the spine: up off the road at the tail, highest over the ribs, down to the skull
   for(let z=-7.6;z<=3.75;z+=.34){const u=(z+7.6)/11.4,r=.07+.2*Math.min(1,u*1.7),y=hz(z);box(bn,0,y,z,r*2.3,r*1.7,.22,u>.3);if(u>.3)box(bn,0,y+r*1.6,z,.06,r*2.4,.1).rotation.x=-.45;if(u>.3&&u<.8)for(const s of[-1,1])box(bn,s*r*1.8,y,z,r*1.6,.06,.08);}   // the vertebrae, small at the tail
   for(let k=0;k<12;k++){const z=-1.6+k*.42,h=hz(z)-.1,Rr=h-.12,TG=new THREE.TorusGeometry(Rr,.075,5,14,Math.PI/2-.1);   // tall curved ribs, splaying down from the spine to the road
     for(const s of[-1,1]){const o=new THREE.Mesh(TG,bn);o.position.set(0,.12,z);o.rotation.set(-.18,s<0?Math.PI:0,0);o.scale.set(.82,1,1);o.castShadow=true;bd.add(o);}}
   const sk=new THREE.Mesh(new THREE.ConeGeometry(1,1,4).rotateY(Math.PI/4).rotateX(Math.PI/2),bn);sk.position.set(0,.75,5.9);sk.scale.set(1.25,.42,3.9);sk.castShadow=true;bd.add(sk);   // the long skull
   box(bn,0,1.05,4.05,1.9,.9,1.3,true);box(bn,0,1.5,4.3,1.1,.25,.9);for(const s of[-1,1]){box(bn,s*.95,1.05,4.6,.25,.35,.6);   // the cranium and the brow ridges
     const J=[V3(s*.85,.18,3.7),V3(s*1.25,.2,4.8),V3(s*1.2,.2,5.9),V3(s*.85,.2,6.9),V3(s*.3,.18,7.75)];for(let q=0;q<4;q++)bone(J[q],J[q+1],.14-q*.015,bn,true);   // the jaw bones, bowed out on the road
     const sh=V3(s*1.5,.55,2.4),el=V3(s*2.4,.18,2.8),wr=V3(s*3,.12,3.3);bone(V3(s*.7,1.2,2.2),sh,.12,bn);bone(sh,el,.14,bn,true);bone(el,wr,.1,bn);   // flipper: arm bones out to the road
     for(let f=0;f<4;f++){let p=wr.clone();const a=-.5+f*.33;for(let q=0;q<3;q++){const n=p.clone().add(V3(s*Math.cos(a)*.42,0,Math.sin(a)*.42+.25));bone(p,n,.055-q*.01,bn);p=n;}}}   // and the finger bones fanning out
   for(let k=0;k<18;k++){const z=R(-2,4),s=Math.random()<.5?-1:1,h=hz(z),km=kelpMs[k%3],a=V3(s*R(.1,.5),h+.05,z),b=V3(s*R(.9,1.6),h*R(.45,.65),z+R(-.4,.4)),c=V3(s*R(1.6,2.3),.06,z+R(-.5,.5));bone(a,b,R(.05,.09),km);bone(b,c,R(.04,.08),km);}   // strands of seaweed draped over the ribs and spine
   for(let k=0;k<4;k++){const z=R(4,7),s=Math.random()<.5?-1:1;bone(V3(s*R(0,.4),R(.9,1.3),z),V3(s*R(1,1.6),.08,z+R(-.6,.6)),.07,kelpMs[k%3]);}   // and over the skull
   for(let k=0;k<12;k++){const z=R(-6,7),s=Math.random()<.5?-1:1,o=new THREE.Mesh(ball,kelpMs[k%3]);o.position.set(s*R(.6,2.6),.1,z);o.scale.set(R(.7,1.4),R(.18,.32),R(.7,1.6));bd.add(o);}   // clumps of weed tangled round the bones
   g.visible=false;G1.add(g);const os=[[-5.6,1],[-2.8,1.7],[0,2.3],[2.6,2.3],[5,1.5],[7,1]].map(([z,r])=>{const o={x:1e9,z:1e9,r:r*sc,soft:1,lz:z};OBST.push(o);return o;});
   bd.children.forEach(o=>{const tp=o.geometry.type;o.userData.p0=o.position.clone();o.userData.q0=o.quaternion.clone();o.userData.qf=new THREE.Quaternion().setFromEuler(new THREE.Euler(tp==='TorusGeometry'?-Math.PI/2:tp==='CylinderGeometry'?Math.PI/2:0,R(0,6.283),0,'YXZ'));});   /* where each bone ends up when it breaks apart: lying flat on the road */
   g.scale.setScalar(sc);MAR.whs.push({g,bd,os,sc,st:0,t:0,armed:1,cd:0});}MAR.wh=MAR.whs[0];
  G1.visible=false;}
const MARK=['fish','weed','squid','bottle','weed','trash','squid','octo','fish','weed','bottle','trash','skel','skel','skel'];
function marSpawn(big,s,lat,kind){let d=null;for(const q of MAR.deb)if((q.kind==='big')===big&&(!kind||q.kind===kind)&&!q.on){d=q;break;}
  if(!d){for(const q of MAR.deb)if((q.kind==='big')===big&&(!kind||q.kind===kind)&&(!d||q.age-q.life>d.age-d.life))d=q;}if(!d)return;
  const i=wrapI(Math.floor(s/SEG));at(s,lat,.02,d.g.position);d.gy=d.g.position.y;d.g.rotation.y=Math.random()*6.283;d.g.scale.setScalar(1);d.g.visible=true;
  Object.assign(d,{on:true,i,age:0,life:R(55,120),flop:d.kind==='fish'?R(3,9):d.kind==='big'?R(4,7):0,ph:Math.random()*6,fly:false});if(d.o){d.o.x=d.g.position.x;d.o.z=d.g.position.z;}return d;}
MAR.tick=rdt=>marinaTick(rdt);MAR.stick=d=>marStick(d);   /* for scripted tests: the autopilot only steps sim(), and this runs per frame */
function marinaTick(rdt){if(!DRIVE||!MAR.g)return;const LW=40;   /* the length of road one wave washes over, as in the build above */
 const pe=ents.find(e=>e.player);if(!pe)return;
  const i0=PL.idx,on=i0>Z.hyde&&i0<Z.gg0+Math.round(500/SEG);PL.wash=Math.max(0,(PL.wash||0)-rdt*1.4);
  if(on!==MAR.on){MAR.on=on;MAR.g.visible=on;if(on){for(const W of MAR.whs||[])W.armed=1;for(let k=0;k<30;k++){const s=MAR.a*SEG+R(-40,330),i=wrapI(Math.floor(s/SEG)),e=edgeAt[i]-.7,d=marSpawn(false,s,R(-e,e),'skel');if(d)d.life=R(400,900);}}   /* the Marina opens with a scatter of fish skeletons on the road */
    if(!on){MAR.gust=0;MAR.stk=null;for(const W of MAR.whs||[]){W.st=0;W.g.visible=false;for(const o of W.os)o.x=1e9;}for(const d of MAR.deb){if(d.stk){MAR.g.add(d.g);d.stk=0;d.g.scale.setScalar(1);}d.on=false;d.g.visible=false;if(d.o)d.o.x=1e9;}for(const w of MAR.waves){w.t=-1;w.g.visible=false;}}}
  if(!on)return;MAR.t+=rdt;const t=MAR.t;
  // the swell
  {const S=MAR.sea,n=S.la.length,nc=S.nc;for(let q=0;q<n;q++){const c=q%nc;if(c===nc-1)continue;const l=S.la[q],s=S.sa[q],sw=.42*Math.sin(.11*l-1.25*t+.02*s)+.28*Math.sin(.045*s-.7*t+.03*l)+.15*Math.sin(.29*l+.21*s-2.1*t),
     k=c===0?.4:.62,y=.52+sw*k;S.pos[q*3+1]=y;const f=sst(sw,.2,.55),dk=.075+.03*Math.sin(.013*s+.02*l);S.col[q*3]=dk+f*.6;S.col[q*3+1]=dk+.018+f*.6;S.col[q*3+2]=dk+.03+f*.6;}
   S.g.attributes.position.needsUpdate=true;S.g.attributes.color.needsUpdate=true;}
  // a new wave every few seconds: often timed to break just as the car gets there
  MAR.next-=rdt;let wh=null,sw=0;
  if(MAR.whs&&MAR.t>1&&!MAR.waves.some(q=>q.wh&&q.t>=0&&!q.hit)){sw=pe.s+Math.max(pe.v,8)*3.2+R(30,45);const f=(wrapI(Math.floor(sw/SEG))-MAR.a)/(MAR.b-MAR.a),[A,B]=MAR.whs;   /* the first whale early on the Marina, the big one further on toward the bridge */
    if(A.armed&&!A.st&&f<.8)wh=A;else if(B.armed&&!B.st&&!A.armed&&f>.45&&(!A.st||sw-A.s>80))wh=B;}
  if(MAR.next<=0||wh){if(!wh)MAR.next=R(2.5,6);const w=MAR.waves.find(q=>q.t<0);
    if(w){const s0=wh?sw:pe.s+(Math.random()<.5?Math.max(pe.v,8)*2.6+R(-8,8):R(50,220)),i=wrapI(Math.floor(s0/SEG));w.wh=0;   /* a whale's wave goes out as soon as it is due, already rolling in, and breaks far enough ahead that the whale has landed before the car gets there */
      if(i>MAR.a+12&&i<MAR.b-12){w.s0=s0;w.ed=edgeAt[i];w.t=wh?1:0;w.hit=w.deb=false;w.g.position.copy(P[i]);w.g.rotation.y=yaw(i);w.g.visible=true;w.wh=wh;}}}
  let wet=false;const V=new THREE.Vector3();
  for(const w of MAR.waves){if(w.t<0)continue;w.t+=rdt;const u=w.t,ed=w.ed,near=Math.abs(wdiff(w.s0-pe.s));
    if(u<2.2){const k=u/2.2,h=lerp(.6,5.4,k*k),cx=lerp(-75,-(ed+1.8),k);w.crest.visible=true;w.crest.position.set(cx,.5,0);w.crest.scale.set(lerp(9,3.2,k),h,1);w.lip.visible=k>.35;w.lip.position.set(cx+.4*k,.5+h,0);w.lip.rotation.z=-k*.7;}
    else w.crest.visible=w.lip.visible=false;
    if(u>=2.2&&!w.hit){w.hit=true;if(near<320){for(let q=0;q<40;q++){at(w.s0+R(-LW/2,LW/2),-(ed+.9),R(1,2.5),V);puff(V,R(-1,1),R(6,13),R(-1,1),2,R(6,11),R(1.4,2.4),.85,0xe8eef0);}}
      if(near<170)sfxSplash();if(near<60)G.shake=Math.max(G.shake,.3*(1-near/60));
      if(w.wh&&w.wh.armed&&!w.wh.st){const dd=wdiff(w.s0-pe.s);if(dd>20)marWhale(w.wh,w,pe,dd);}}   /* once a pass each, a wave brings in a whale skeleton */
    if(u>=2.2&&u<4.8){const q=(u-2.2)/2.6;w.spray.visible=true;w.spray.position.x=-(ed+.95);w.spray.scale.y=.5+15*Math.sin(Math.min(q*3,1)*Math.PI/2)-q*q*3;w.sprayM.opacity=Math.min(1,1.6*(1-q));}else w.spray.visible=false;
    if(u>=2.35&&u<7.2){const q=clamp((u-2.35)/1.3,0,1),fr=lerp(-(ed+1.2),ed+2.5,1-(1-q)*(1-q)),bk=-(ed+1.2)+Math.max(0,u-4.6)*3.2;w.fr=fr;w.bk=bk;w.foam.visible=true;w.foam.position.x=bk;w.foam.scale.x=Math.max(.01,fr-bk);
      w.foamM.opacity=u<5?.92:.92*Math.max(0,1-(u-5)/2.2);w.ft.offset.x=-u*.25;w.ft.offset.y=u*.05;
      if(u<5.4&&Math.abs(wdiff(pe.s-w.s0))<LW/2+1.5&&pe.lat<fr+.8&&pe.lat>bk-1)wet=true;}else w.foam.visible=false;
    if(u>=3&&!w.deb){w.deb=true;const n=5+(Math.random()*7|0);for(let k=0;k<n;k++){const kd=MARK[Math.random()*MARK.length|0],c=kd==='fish'?1:2+(Math.random()<.5?1:0);for(let j=0;j<c;j++){const lat=R(-ed+.6,Math.min(w.fr,ed)-.6);marSpawn(false,w.s0+R(-LW/2+2,LW/2-2),lat,kd);}}   /* squid and seaweed come in two or three times as thick as the fish */
      if(Math.random()<.35){const lat=Math.random()<.5?R(-ed+1.5,-5):R(5,ed-1.5);marSpawn(true,w.s0+R(-LW/2+4,LW/2-4),lat);}}
    if(u>7.4){w.t=-1;w.g.visible=false;}}
  // the car in the wash: a burst of spray as it hits the water, then drag and a shove towards the field side
  if(wet){if(PL.wash<.35&&!PL.crash){sfxSplash();G.shake=Math.max(G.shake,.35);for(let q=0;q<18;q++)puff(V.set(PL.x+R(-1.5,1.5),.4,PL.z+R(-1.5,1.5)),PL.vx*.3+R(-3,3),R(3,8),PL.vz*.3+R(-3,3),.8,R(3,5),R(.8,1.5),.7,0xe8eef0);}PL.wash=1;}
  if(PL.wash>.2&&Math.abs(pe.v)>3&&Math.random()<rdt*30)puff(V.set(PL.x+R(-1,1),.3,PL.z+R(-1,1)),PL.vx*.2+R(-1,1),R(1.5,4),PL.vz*.2+R(-1,1),.5,R(2,3.5),R(.5,1),.55*PL.wash,0xe2e8ea);
  // the catch on the road: fish flop for a while, small things get kicked up by the car, and after a minute or two it all goes
  if(!MAR.stk&&!MAR.gust&&PL.idx>MAR.b-Math.round(60/SEG)&&PL.idx<MAR.b&&Math.abs(pe.v)>8){MAR.gust=1;if(Math.random()<.5){const d=MAR.deb.find(q=>!q.on&&(q.kind==='weed'||q.kind==='squid'||q.kind==='octo'));if(d)marStick(d);}}   /* a gust off the water at the end of the Marina: half the time it slaps something on the windscreen */
  for(const d of MAR.deb){if(!d.on)continue;if(d.stk){marStuck(d,rdt,pe);continue;}d.age+=rdt;const p=d.g.position;
    if(d.fly){d.vy-=9.8*rdt;p.x+=d.vx*rdt;p.y+=d.vy*rdt;p.z+=d.vz*rdt;d.bd.rotation.x+=d.sp*rdt;if(p.y<=d.gy){p.y=d.gy;d.fly=false;d.bd.rotation.x=0;}}
    else if(d.age<d.flop){const k=1-d.age/d.flop,s=Math.sin(d.age*11+d.ph);p.y=d.gy+Math.abs(s)*(d.kind==='big'?.05:.1)*k;d.bd.rotation.z=s*.35*k;}
    if(d.kind!=='big'&&!d.fly&&Math.abs(pe.v)>4){const dx=p.x-PL.x,dz=p.z-PL.z;if(dx*dx+dz*dz<1.7*1.7){d.fly=true;d.vy=R(3,6)+Math.abs(pe.v)*.04;d.vx=PL.vx*.55+R(-2,2);d.vz=PL.vz*.55+R(-2,2);d.sp=R(-12,12);if((d.kind==='weed'||d.kind==='squid'||d.kind==='octo')&&!MAR.stk&&Math.random()<.25)marStick(d);}}
    if(!d.fly&&d.i!=null&&d.kind!=='big'){const n=Nn[d.i],tg=T[d.i],tv=2.1*Math.sin(t*.42+d.ph*.15)+.5*Math.sin(t*1.1+d.ph),al=.7*Math.sin(t*.3+1),e=edgeAt[d.i]-.4;p.x+=(n.x*tv+tg.x*al)*rdt;p.z+=(n.z*tv+tg.z*al)*rdt;d.bd.rotation.y+=tv*.25*rdt;const l=(p.x-P[d.i].x)*n.x+(p.z-P[d.i].z)*n.z;if(Math.abs(l)>e){const c=(l>0?e:-e)-l;p.x+=n.x*c;p.z+=n.z*c;}}   /* the water ebbs and flows, dragging the fish and skeletons about the road */
    if(d.age>d.life){const s=Math.max(0,1-(d.age-d.life)/3);d.g.scale.setScalar(s);if(s<=0){d.on=false;d.g.visible=false;if(d.o)d.o.x=1e9;}}}
  for(const W of MAR.whs||[])if(W.st)marWhaleTick(W,rdt,pe);
  // the cows: heads down grazing, now and then a look up (at a passing car, often) or a slow step or two
  for(const c of MAR.cows){c.tm-=rdt;
    if(c.tm<=0){if(c.st==='graze'){const r=Math.random();if(r<.45){c.st='step';c.tm=R(1.4,2.8);const dh=Math.hypot(c.x-c.x0,c.z-c.z0)>5?Math.atan2(c.x0-c.x,c.z0-c.z):c.h+R(-.8,.8);c.dh=Math.atan2(Math.sin(dh-c.h),Math.cos(dh-c.h))/c.tm;}
        else if(r<.75){c.st='look';c.tm=R(2,4.5);c.yw=R(-.6,.6);if(AC&&Math.random()<.35){const dx=c.x-PL.x,dz=c.z-PL.z;if(dx*dx+dz*dz<70*70){const t0=AC.currentTime;tone('sawtooth',R(120,150),t0,1.3,.05,master,{to:R(90,105)});}}}else c.tm=R(3,8);}
      else{c.st='graze';c.tm=R(5,13);}}
    const tg=c.st==='graze'?1.2:c.st==='step'?.8:-.08;c.th+=(tg-c.th)*Math.min(1,rdt*(c.st==='look'?2.6:1.3));
    c.nk.rotation.x=c.th+(c.st==='graze'?Math.sin(t*5+c.ph)*.05:0);c.nk.rotation.y+=((c.st==='look'?c.yw:0)-c.nk.rotation.y)*Math.min(1,rdt*2);
    let lg=0;if(c.st==='step'){c.h+=c.dh*rdt;c.x+=Math.sin(c.h)*.5*rdt;c.z+=Math.cos(c.h)*.5*rdt;lg=Math.sin(t*5.5+c.ph)*.32;}
    c.legs[0].rotation.x=c.legs[3].rotation.x=lg;c.legs[1].rotation.x=c.legs[2].rotation.x=-lg;
    c.tl.rotation.z=Math.sin(t*1.7+c.ph)*.3+(Math.sin(t*.37+c.ph)>.75?Math.sin(t*9)*.45:0);c.g.position.set(c.x,c.y,c.z);c.g.rotation.y=c.h;}}
// the whale skeletons: each rides in on a wave, slides across onto the road (leaving the other lane clear) and settles with a thump; a minute or two later it is gone.
// Drive into one and it breaks apart: ribs, vertebrae, skull and jaw fly up, tumble and clatter down on the road with a bony tinkling, weed flung about; the car barely slows, never a crash
function marWhale(W,w,pe,dd){const i=wrapI(Math.floor(w.s0/SEG)),ed=w.ed,sd=dd<90?(pe.lat>0?-1:1):(Math.random()<.5?-1:1);
  for(const o of W.bd.children){o.position.copy(o.userData.p0);o.quaternion.copy(o.userData.q0);o.userData.v=null;}   // put the bones back together for this pass
  Object.assign(W,{armed:0,st:1,t:0,cd:0,s:w.s0+R(-6,6)*W.sc,l0:-(ed+5*W.sc),l1:sd*(RW+XW[i]-2.6*W.sc),life:R(70,110),rot:yaw(i)+(Math.random()<.5?Math.PI:0)});W.g.scale.setScalar(W.sc);W.g.visible=true;}
function sfxBones(k){if(!AC)return;const t=AC.currentTime;   // a bony tinkling and clattering: many short high clicks and rattles, a few clunks
  for(let q=0;q<36;q++){const t1=t+Math.pow(Math.random(),1.6)*1.5,f=R(1400,4400);tone(Math.random()<.5?'triangle':'sine',f,t1,R(.03,.07),R(.03,.08)*k,master,{to:f*R(.7,.95)});}
  for(let q=0;q<12;q++)hit(t+Math.random()*1.3,R(.03,.07),R(.12,.25)*k,R(2500,6000),'bandpass',master);
  for(let q=0;q<4;q++){const t1=t+Math.random()*.8;tone('sine',R(120,200),t1,.1,.35*k,master,{to:70});hit(t1,.06,.25*k,700,'lowpass',master);}}
function marWhaleBreak(W){const g=W.g,V=W.V,cl=g.worldToLocal(new THREE.Vector3(PL.x,g.position.y,PL.z)),cv=g.worldToLocal(new THREE.Vector3(PL.x+PL.vx,g.position.y,PL.z+PL.vz)).sub(cl);
  W.st=4;W.t=0;for(const o of W.os)o.x=1e9;PL.vx*=.97;PL.vz*=.97;sfxBones(1);sfxThump(.5);G.shake=Math.max(G.shake,.25);
  for(const o of W.bd.children){const p=o.position,dx=p.x-cl.x,dz=p.z-cl.z,dl=Math.hypot(dx,dz)||1,kk=Math.max(0,1-dl/9),sp=R(1.5,5)*kk+R(.2,1);   // the nearer the car, the harder it flies
    o.userData.v={x:dx/dl*sp+cv.x*R(.15,.4)*kk,y:R(.5,2.5)+R(3,8)*kk,z:dz/dl*sp+cv.z*R(.15,.4)*kk,w:new THREE.Vector3(R(-1,1),R(-1,1),R(-1,1)).normalize(),ws:R(3,12)*(kk+.2),gd:0};}
  for(let k=0;k<10;k++){g.localToWorld(V.set(cl.x+R(-2,2),.5,cl.z+R(-2,2)));puff(V,R(-2,2),R(1,3),R(-2,2),.5,R(2,3),R(.6,1),.5,0xd8d2bc);}}
function marWhaleTick(W,rdt,pe){const g=W.g,V=W.V||(W.V=new THREE.Vector3());W.t+=rdt;W.cd-=rdt;const t=W.t;
  if(W.st===1){const q=clamp(t/1.5,0,1),e=1-(1-q)*(1-q);at(W.s,lerp(W.l0,W.l1,e),lerp(1,0,e)+.15*Math.sin(t*6)*(1-q),g.position);g.rotation.set(0,W.rot+.25*(1-e),.08*Math.sin(t*5)*(1-q));
    if(q>=1){W.st=2;W.t=0;g.rotation.set(0,W.rot,0);const d=Math.hypot(g.position.x-PL.x,g.position.z-PL.z);if(d<250){sfxThump(1);sfxCrunch(.5);}if(d<70)G.shake=Math.max(G.shake,.45*(1-d/70));
      for(let k=0;k<22;k++){g.localToWorld(V.set(R(-3,3),.3,R(-7,7)));puff(V,R(-2,2),R(1,4),R(-2,2),1.5,R(3,6),R(1,2),.6,k%2?0xe8eef0:0xb8ae98);}}}   // the thump as it settles: spray and sand
  else if(W.st===2){if(t>W.life){W.st=3;W.t=0;}}
  else if(W.st===4){const gr=9.8/W.sc;   // broken: the pieces fly, tumble, bounce and come to rest lying flat on the road
    for(const o of W.bd.children){const v=o.userData.v;if(!v)continue;const p=o.position;
      if(v.y!==0||p.y>.09){v.y-=gr*rdt;p.x+=v.x*rdt;p.y+=v.y*rdt;p.z+=v.z*rdt;if(!v.gd)o.rotateOnAxis(v.w,v.ws*rdt);
        if(p.y<.08){p.y=.08;v.gd=1;if(Math.abs(v.y)>1.2){v.y=-v.y*.35;v.x*=.55;v.z*=.55;}else{v.y=0;v.x=v.z=0;}}}
      if(v.gd)o.quaternion.slerp(o.userData.qf,clamp(rdt*5,0,1));}
    if(t>W.life*.6){W.st=3;W.t=0;}}
  else{for(const o of W.os)o.x=1e9;const s=Math.max(0,1-t/3);g.scale.setScalar(s*W.sc);if(s<=0){W.st=0;g.visible=false;for(const o of W.os)o.x=1e9;return;}}
  if(W.st>=3)return;g.updateMatrixWorld();for(const o of W.os){g.localToWorld(V.set(0,0,o.lz));o.x=V.x;o.z=V.z;}
  if(Math.hypot(PL.vx,PL.vz)>2)for(const o of W.os){const dx=PL.x-o.x,dz=PL.z-o.z;if(dx*dx+dz*dz<(o.r+1.5)*(o.r+1.5)){marWhaleBreak(W);break;}}}
// something off the Marina stuck on the windscreen (seaweed, a squid, an octopus): it flaps there until the car is out on the Golden Gate, then the wind tears it off
function marStick(d){d.fly=false;d.stk=1;d.on=true;d.age=0;MAR.stk=d;hero.add(d.g);d.g.position.set(R(-.25,.25),.92,.6);d.g.rotation.set(-.7,R(-.6,.6),0);d.g.scale.setScalar(1.2);d.g.visible=true;MAR.go=Z.gg0+Math.round(R(-60,140)/SEG);}
function marStuck(d,rdt,pe){const p=d.g.position;
  if(d.stk===1){d.bd.rotation.z=Math.sin(MAR.t*23+d.ph)*.14*Math.min(1,Math.abs(pe.v)/25);
    if(PL.idx>=MAR.go&&PL.idx<Z.gg1&&Math.abs(pe.v)>12){d.g.getWorldPosition(p);MAR.g.add(d.g);d.stk=2;d.age=0;d.vx=PL.vx*.45+R(-2,2);d.vy=R(3,6);d.vz=PL.vz*.45+R(-2,2);d.sp=R(-14,14);}return;}
  d.age+=rdt;d.vy-=5*rdt;p.x+=d.vx*rdt;p.y+=d.vy*rdt;p.z+=d.vz*rdt;d.bd.rotation.x+=d.sp*rdt;d.g.rotation.y+=rdt*3;d.g.scale.setScalar(1.2*Math.max(0,1-d.age/3));
  if(d.age>3){d.stk=0;d.on=false;d.g.visible=false;d.g.scale.setScalar(1);MAR.stk=null;}}
// clouds rolling in off the Pacific across the Golden Gate: soft banks that drift over the deck and the towers, now and then right through the car
const GGC=[];
if(DRIVE){const ct=canvas(256,128,(g,w,h)=>{for(let k=0;k<90;k++){const r=12+Math.random()*26,x=r+4+Math.random()*(w-2*r-8),y=h/2+(Math.random()-.5)*(h-2*r-8)*(1-Math.abs(x/w-.5)),gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.2)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,2*r,2*r);}});
  for(let k=0;k<44;k++){const m=new THREE.SpriteMaterial({map:ct,color:0xe2e6ea,transparent:true,depthWrite:false,opacity:0,fog:false}),sp=new THREE.Sprite(m);sp.visible=false;scene.add(sp);
    GGC.push({sp,m,i:Math.round(Z.gg0+(k+Math.random())/44*(Z.gg1-Z.gg0)),lat:R(-320,320),y:R(-12,50),v:R(6,13),w:R(80,200)});}}
function ggCloudTick(rdt){if(!DRIVE||!GGC.length)return;const fc=GGC[0].m.color.copy(scene.fog.color).lerp(new THREE.Color(1,1,1),.3),on=PL.idx>Z.gg0-Math.round(700/SEG)&&PL.idx<Z.gg1+Math.round(300/SEG);
  for(const c of GGC){c.sp.visible=on;if(!on)continue;c.lat-=c.v*rdt;if(c.lat<-320){c.lat=320;c.y=R(-12,50);}
    off(c.i,c.lat,c.y,c.sp.position);c.sp.scale.set(c.w,c.w*.5,1);c.m.color.copy(fc);c.m.opacity=.9*(1-sst(Math.abs(c.lat),220,320));}}
// Alameda scenery tick: caterpillar crawls and waves, wildebeest/deer/rabbits wander their stretch, dust is kicked up behind the plough team. Nothing allocates per frame.
const _al=[new THREE.Vector3(),new THREE.Vector3()],_alM=new THREE.Matrix4();
function almTick(rdt){const t=tmNow();ALM.u.value=t;const c=ALM.cat;if(c){for(let k=0;k<9;k++){const s=c.cs[k],lift=k>5?(k-5)*.55*(1+Math.sin(t*3)*.25):0;s.position.set((k-4)*1.55+Math.sin(t*.5)*2,20.4+Math.max(0,Math.sin(t*2.4-k*.7))*.5+lift,0);}c.arm.rotation.z=-.4+Math.sin(t*7)*.6;}
  const pi=PL.idx;
  for(const a of ALM.an){const near=Math.abs(a.i-pi)<320;a.g.visible=near;if(!near)continue;
    a.i+=a.dir*a.sp*rdt/SEG;if(a.i>a.hi){a.i=a.hi;a.dir=-1;}if(a.i<a.lo){a.i=a.lo;a.dir=1;}
    const i0=Math.floor(a.i),f=a.i-i0,A=_al[0],B=_al[1];off(i0,a.lat,0,A);A.y=groundAt(A.x,A.z);off(i0+1,a.lat,0,B);B.y=groundAt(B.x,B.z);a.g.position.copy(A).lerp(B,f);a.g.rotation.y=yaw(i0)+(a.dir>0?0:Math.PI);
    const sw=Math.sin(t*a.sp*5+a.ph);for(let k=0;k<4;k++)a.legs[k].rotation.x=(k%3?-1:1)*sw*.5;a.hd.rotation.x=Math.sin(t*1.3+a.ph)*.25;
    if(a.kind==='w'&&ALM.dust&&Math.random()<rdt*14){const p=ALM.dust.p[ALM.dn=(ALM.dn+1)%80],sy=Math.sin(a.g.rotation.y),cy=Math.cos(a.g.rotation.y);p.x=a.g.position.x-sy*2.5+R(-.8,.8);p.z=a.g.position.z-cy*2.5+R(-.8,.8);p.y=a.g.position.y+.3;p.l=1.6;p.vx=R(-.4,.4);p.vz=R(-.4,.4);}}
  const D=ALM.dust;if(D){for(let k=0;k<80;k++){const p=D.p[k];if(p.l<=0){if(p.y>-90){p.y=-99;_alM.makeScale(0,0,0);D.m.setMatrixAt(k,_alM);}continue;}p.l-=rdt;p.x+=p.vx*rdt;p.z+=p.vz*rdt;p.y+=rdt*1.1;const s=.5+(1.6-p.l)*1.1;_alM.makeScale(s,s*.7,s);_alM.setPosition(p.x,p.y,p.z);D.m.setMatrixAt(k,_alM);}D.m.instanceMatrix.needsUpdate=true;}}
function extrasTick(rdt){const pe=ents.find(e=>e.player);if(!pe)return;const m_=x=>Math.round(x/SEG);
  trafficTick(rdt,pe);logTick(rdt,pe);oilTick(rdt);
  // fires that keep burning: the ruins before the bridge, the wrecks on it, the refinery flare
  NOGY=1;for(const f of BURN){const d2=(f.x-camera.position.x)**2+(f.z-camera.position.z)**2;if(d2>800*800)continue;const k=d2<300*300?1:.4;
    if(Math.random()<rdt*(f.flare?14:8)*k)flame(V.set(f.x+R(-1.4,1.4)*f.s,f.y+R(0,1.2)*f.s,f.z+R(-1.4,1.4)*f.s),R(-.5,.5),R(2,5),R(-.5,.5),R(1,2.2)*f.s,R(2.5,5)*f.s,R(.5,1),Math.random()<.5?0xffa53a:0xff5a1a);
    if(!f.flare&&Math.random()<rdt*3.5*k)puff(V.set(f.x+R(-1,1),f.y+2*f.s,f.z+R(-1,1)),R(.6,2),R(4,7),R(-.5,.5),3*f.s,R(16,30)*f.s,R(6,10),.62,0x121010);}NOGY=0;
  // the eyes: they look about, and blink
  // they look about and blink; when you drive up to and past a board its eyes roll down onto you; every so often they all turn angry for a few seconds
  {const E_=EYES;E_.t-=rdt;E_.at-=rdt;if(E_.at<=0){E_.ang^=1;E_.at=E_.ang?R(3,5):R(6,10);}
    if(E_.t<=0){if(E_.seq&&E_.seq.length){E_.blink=E_.seq.shift();E_.t=.07;}else if(Math.random()<.45){E_.seq=[3,4,4,3,-1];E_.t=0;}else{E_.look=Math.random()*3|0;E_.t=R(1.2,3.5);}}
    for(const b of E_.bd){const d=wdiff(b.s-pe.s);let k=E_.blink>=0?E_.blink:d<140&&d>-35?(d<25?(b.sd>0?5:6):7):E_.look;k+=E_.ang?8:0;
      if(k!==b.k){b.k=k;b.mm.map=b.mm.emissiveMap=E_.tex[k];b.mm.emissive.setHex(E_.ang?0xffb4a8:0xffffff);}}}
  // the cable cars on Hyde Street, bells going: one climbs ahead of you in the right-hand track, one comes down the left. Each sits on its wheels: the height is the road under the front and back trucks, the tilt the line between them.
  {const inCity=PL.idx>=Z.b1&&PL.idx<Z.gg0,lo=(Z.hyde+m_(70))*SEG,hi=(Z.marina-m_(70))*SEG;for(const c of CABLE){if(inCity&&!c.act&&PL.idx<Z.hyde){c.act=true;c.s=c.dir>0?lo:hi;}if(!inCity&&c.act){c.act=false;c.g.visible=false;for(const o of c.obs)o.x=1e9;}
    if(c.act){c.g.visible=true;const near=Math.abs(wdiff(c.s-pe.s));if(c.dir>0?c.s<hi:c.s>lo)c.s+=5*c.dir*rdt;const i=wrapI(Math.floor(c.s/SEG)),yf=at(c.s+3*c.dir,c.lat,0,V).y,yb=at(c.s-3*c.dir,c.lat,0,V).y;
      at(c.s,c.lat,0,c.g.position).y=(yf+yb)/2+.05;c.g.rotation.set(-Math.atan2(yf-yb,6),yaw(i)+(c.dir<0?Math.PI:0),0);
      c.obs.forEach((o,k)=>{at(c.s+(k-1)*3,c.lat,0,V);o.x=V.x;o.z=V.z;});c.bell-=rdt;if(c.bell<=0&&near<90){c.bell=R(2.5,4.5);sfxBell();}}}}
  if(SHIP){SHIP.position.z=-3300-((performance.now()/1000*3.5)%1500);SHIP.position.y=Math.sin(performance.now()/2600)*.15;}   // the bulk carrier crosses the bay off the port at walking pace, then starts again out of sight to the south
  // hawks swoop across the road in the redwoods
  {const S_=SWOOP,inF=zoneArr[PL.idx]===7;DA.sw=(DA.sw??4)-rdt;if(!S_.f&&inF&&DA.sw<=0&&!PL.crash){const sd=Math.random()<.5?-1:1,s0=pe.s+30+Math.max(pe.v,10)*1.4;S_.f={t:0,dur:2.8,a:at(s0+30,sd*40,40),b:at(s0,0,2.8),c:at(s0-10,-sd*45,34)};S_.visible=true;sfxScreech();DA.sw=R(7,14);}
    if(S_.f){const F=S_.f;F.t+=rdt;const u=F.t/F.dur;if(u>=1||!inF){S_.f=null;S_.visible=false;}else{const a=F.a,b=F.b,c=F.c,p=(1-u)*(1-u),q2=2*u*(1-u),r=u*u;S_.position.set(a.x*p+b.x*q2+c.x*r,a.y*p+b.y*q2+c.y*r,a.z*p+b.z*q2+c.z*r);
      const dx=2*(1-u)*(b.x-a.x)+2*u*(c.x-b.x),dz=2*(1-u)*(b.z-a.z)+2*u*(c.z-b.z),dy=2*(1-u)*(b.y-a.y)+2*u*(c.y-b.y);S_.rotation.set(-Math.atan2(dy,Math.hypot(dx,dz))*.6,Math.atan2(dx,dz),0);
      S_.birds.forEach((bd,n)=>{const w=u<.4||u>.65?Math.sin(tmNow()*14+n)*.6:-.35;bd.w[0].rotation.z=w;bd.w[1].rotation.z=-w;});}}}
  // the train beside I-880
  {const T_=TRAIN,a=(Z.tu1+m_(270))*SEG,b=(Z.detour-m_(20))*SEG,inP=PL.idx>Z.tu1&&PL.idx<Z.b0;T_.g.visible=inP;if(inP){T_.s+=24*rdt;if(T_.s<a||T_.s>b)T_.s=a+(Math.random()<.5?0:R(0,300));
    T_.g.cars.forEach((c,k)=>{const s=T_.s-k*25.5;c.visible=s>a;if(!c.visible)return;const i=wrapI(Math.floor(s/SEG));at(s,60,0,c.position);c.position.y=0;c.rotation.y=yaw(i);});}}
  // the detour: take the exit lane on the right and the road brings you round to Richmond
  if(DOME.i>=0&&!PL.crash&&PL.safe<=0&&(PL.x-DOME.x)**2+(PL.z-DOME.z)**2<4.6*4.6&&Math.hypot(PL.vx,PL.vz)>4){DOME.hit=1;crashPlayer(14,false);DOME.hit=0;const w=hero.wreck;if(w){w.free=1;w.y=H[PL.idx];w.vy=15;w.vx*=.9;w.vz*=.9;w.wr=R(-3,3);}}   // hit the dome: flung up, then the wreck falls and crashes
  {const i=PL.idx;if(PORTAL.c&&PL.idx>PORTAL.i-300&&PL.idx<PORTAL.i+40){PORTAL.t+=rdt;if(PORTAL.t>.06){PORTAL.t=0;const c=PORTAL.c,g=c.getContext('2d'),w=c.width,ph=tmNow()*2.2;g.fillStyle='#061a3a';g.fillRect(0,0,w,w);for(let k=0;k<9;k++){g.strokeStyle=k%2?'rgba(210,240,255,.9)':'rgba(60,150,255,.8)';g.lineWidth=5+k%3*2;g.beginPath();for(let r=3;r<w*.62;r+=3){const an=r*.09-ph+k*.7,x=w/2+Math.cos(an)*r*(1-k*.015),y=w/2+Math.sin(an)*r*(1-k*.015);r===3?g.moveTo(x,y):g.lineTo(x,y);}g.stroke();}const rg=g.createRadialGradient(w/2,w/2,2,w/2,w/2,w*.5);rg.addColorStop(0,'rgba(255,255,255,1)');rg.addColorStop(.35,'rgba(150,210,255,.35)');rg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=rg;g.fillRect(0,0,w,w);PORTAL.tex.needsUpdate=true;}}
  {const RL=PORTAL.rail;   // on the exit ramp the car is carried down the lane on rails (steering locked) and drawn into the ring
    if(!RL&&!FADE.go&&!PL.crash&&DETR.a>=0&&G.state==='race'&&PL.idx>=DETR.a+8&&PL.idx<=DETR.a+150&&pe.lat<-(RW+XW[i]+2.5))PORTAL.rail={f:PL.idx,v:Math.max(Math.hypot(PL.vx,PL.vz),20)};
    else if(RL&&(PL.crash||FADE.go===2))PORTAL.rail=null;
    else if(RL){RL.v+=(22-RL.v)*Math.min(1,rdt);RL.f+=RL.v*rdt/SEG;const pf=ff=>{const j=Math.floor(ff),w=ff-j,u=(ff-DETR.a)/240,lt=-(RW+XW[j])-4.2-150*u*u;return[lerp(P[j].x,P[j+1].x,w)+lerp(Nn[j].x,Nn[j+1].x,w)*lt,lerp(P[j].z,P[j+1].z,w)+lerp(Nn[j].z,Nn[j+1].z,w)*lt,u];},a0=pf(RL.f),a1=pf(RL.f+1),j=Math.floor(RL.f);
      PL.x=a0[0];PL.z=a0[1];PL.h=G.camH=Math.atan2(a1[0]-a0[0],a1[1]-a0[1]);PL.vx=Math.sin(PL.h)*RL.v;PL.vz=Math.cos(PL.h)*RL.v;PL.idx=j;PL.cy=PL.gy=H[j]*(1-sst(a0[2],.08,.6));PL.air=0;PL.vy=0;
      if(!FADE.go&&RL.f>=PORTAL.i-2){FADE.go=1;FADE.t=0;$('fade').style.background='#d8f0ff';say('DETOUR','BERKELEY · RICHMOND',2.5);}}}
    if(FADE.go){FADE.t+=rdt;FADE.k=clamp((FADE.t-.75)/.3,0,1);warpDraw(FADE.go===1?FADE.t/1.05:-(FADE.t-1.05)/.9);if(FADE.t>1.05&&FADE.go===1){FADE.go=2;PORTAL.rail=null;const j=PL.idx=wrapI(Z.rb1+m_(30)),sp=Math.max(pe.v,16);pe.s=j*SEG;pe.lat=0;PL.x=P[j].x;PL.z=P[j].z;PL.h=G.camH=yaw(j);PL.vx=Math.sin(PL.h)*sp;PL.vz=Math.cos(PL.h)*sp;PL.cy=PL.gy=H[j];PL.air=0;PL.vy=0;PL.steer=0;resetVehicle(VS,hero.M.dyn,sp);first=true;say('RICHMOND','THE DETOUR BROUGHT YOU ROUND · I-80 SOUTH TO HOME',3);}
      if(FADE.go===2){FADE.k=clamp(1-(FADE.t-1.05)/.8,0,1);if(FADE.k<=0){warpDraw(null);FADE.go=null;$('fade').style.background='';}}}
    $('fade').style.opacity=FADE.k.toFixed(3);}}
// Sunny weather is a heatwave: the tyres slowly melt (a little less grip, black smoke off the wheels) and there are wildfires burning in the country round about, more of them in the city.
const FIRES=[];
{const n=DRIVE?52:22;for(let k=0;k<n;k++){const i=Math.floor(NS*(k+.5)/n),sd=k%2?1:-1,city=DRIVE&&zoneArr[i]===5;if(DRIVE&&(zoneArr[i]===4||zoneArr[i]===2))continue;const p=off(i,sd*(city?R(26,60):R(70,170)),0);FIRES.push({x:p.x,y:p.y,z:p.z,s:city?1:R(1.5,3)});}
  if(DRIVE)for(let k=0;k<10;k++){const i=Z.b1+30+k*46,p=off(i,(k%2?1:-1)*R(24,48),0);FIRES.push({x:p.x,y:p.y,z:p.z,s:1.2});}}
function heatTick(dt,pe){const hot=G.weather==='sun';
  PL.melt=clamp((PL.melt||0)+(hot?dt*(.002+Math.abs(pe.v)*.00013+PL.slip*.002):-dt*.05),0,1);
  if(!hot){PL.meltSaid=0;return;}
  if(PL.melt>.35&&!PL.meltSaid){PL.meltSaid=1;say('THE TYRES ARE MELTING','46 DEGREES IN THE SHADE - LESS GRIP',3.2);}
  NOGY=1;
  for(const f of FIRES){const d2=(f.x-PL.x)**2+(f.z-PL.z)**2;if(d2>560*560)continue;
    if(Math.random()<dt*7)flame(V.set(f.x+R(-4,4)*f.s,f.y+R(.5,3)*f.s,f.z+R(-4,4)*f.s),R(-1,1),R(3,7),R(-1,1),R(2,4)*f.s,R(5,9)*f.s,R(.6,1.3),Math.random()<.5?0xffa53a:0xff5a1a);
    if(Math.random()<dt*2.2)puff(V.set(f.x+R(-3,3),f.y+6*f.s,f.z+R(-3,3)),R(1,3),R(4,8),R(-1,1),6*f.s,R(22,40)*f.s,R(7,11),.5,0x2a2622);}
  NOGY=0;
  if(PL.melt>.3&&Math.abs(pe.v)>12&&!PL.crash&&Math.random()<dt*14*PL.melt){const fx=Math.sin(PL.h),fz=Math.cos(PL.h),s=Math.random()<.5?-1:1;puff(V.set(PL.x+fz*s*.8-fx*1.4,.2,PL.z-fx*s*.8-fz*1.4),PL.vx*.3,R(.3,1),PL.vz*.3,.3,1.3,R(.5,1),.5,0x1a1816);}}
// San Francisco: a second earthquake, in the city. Pieces of the buildings come down onto the road ahead and stay there; steer round them.
const CQ={st:0,t:0,rub:[]};
// cracks that open across the road in an earthquake (a pool of decals, laid where needed and cleared with the debris)
let crackM=null;const CRACKS=[];
function crackRoad(s,lat){if(!crackM)crackM=new THREE.MeshBasicMaterial({map:canvas(256,256,(g,w,h)=>{g.clearRect(0,0,w,h);g.strokeStyle='rgba(16,15,14,.92)';g.lineCap='round';
    const br=(x,y,a,len,wd)=>{if(len<8||wd<.6)return;g.lineWidth=wd;g.beginPath();g.moveTo(x,y);let px=x,py=y;for(let k=0;k<6;k++){a+=R(-.5,.5);px+=Math.cos(a)*len/6;py+=Math.sin(a)*len/6;g.lineTo(px,py);if(Math.random()<.3)br(px,py,a+R(-1.2,1.2),len*.45,wd*.6);}g.stroke();};
    br(10,128,0,240,5);br(128,128,1.4,110,3);}),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-6});
  const m=new THREE.Mesh(new THREE.PlaneGeometry(R(5,9),R(5,9)).rotateX(-Math.PI/2),crackM);at(s,lat,.05,m.position);m.rotation.y=R(0,6.3);scene.add(m);CRACKS.push(m);}
function clearCracks(){for(const m of CRACKS){scene.remove(m);m.geometry.dispose();}CRACKS.length=0;}
function cityQuakeTick(rdt){const i=PL.idx,a=Z.b1+70;
  // San Francisco: the quake hits as you come off the bridge. The road cracks open, and for twenty seconds bits of the buildings either side come down:
  // mostly small stuff (bricks, glass, lumps of concrete) that lands at the kerbs and in the lanes, now and then a bigger piece; there is always a way through
  const pe=ents.find(e=>e.player),drop=(ahead,n)=>{for(let k=0;k<n;k++){const s=pe.s+ahead+R(-20,20),sd=Math.random()<.5?-1:1,j=wrapI(Math.floor(s/SEG)),w=RW+XW[j],from=sd*(w+R(6,14)),r=Math.random(),
      kind=r<.15?'slab':r<.5?'chunk':r<.8?'brick':'glass',h=R(14,34),tF=Math.sqrt(2*h/(kind==='glass'?9:20)),to=sd*R(w*.45,w+2.5);   // most of it lands on the outer lanes and the pavement
      spawnDeb(s,from,h,kind,R(0,.6),false,(from-to)/tF,kind==='chunk'?R(.35,.6):kind==='slab'?.5:1);if(kind==='brick')for(let q=0;q<3;q++)spawnDeb(s+R(-2,2),from,h+R(-2,2),'brick',R(0,.6),false,(from-to)/tF);
      if(kind==='slab')for(let q=0;q<3;q++)spawnDeb(s+R(-3,3),from,h+R(0,3),'glass',R(0,.8),false,(from-to)/Math.sqrt(2*h/9));}};
  if(CQ.st===0){if(i>a&&i<a+40&&!PL.crash){CQ.st=1;CQ.t=0;CQ.nx=0;G.qd=1;say('EARTHQUAKE !','THE STREET IS CRACKING UP - WATCH FOR FALLING DEBRIS',5);sfxQuake();
      for(let k=0;k<14;k++)crackRoad(pe.s+30+k*R(18,30),R(-RW,RW));for(let k=0;k<6;k++)drop(70+k*45,1);}return;}
  CQ.t+=rdt;if(CQ.t<7)G.shake=Math.max(G.shake,.6*(1-CQ.t/7)+.12);
  if(CQ.t<20&&!PL.crash){CQ.nx-=rdt;if(CQ.nx<=0){CQ.nx=R(1.1,2.4);drop(Math.max(50,pe.v*2.4)+R(0,80),1);if(Math.random()<.35)crackRoad(pe.s+R(60,140),R(-RW,RW));}}
  if(CQ.t>12&&CQ.t<12.2&&!CQ.af){CQ.af=1;say('AFTERSHOCK !','',2);sfxQuake();G.shake=.7;}
  if(zoneOf(i)!=='city'&&!PL.crash){clearDeb();clearCracks();CQ.st=0;CQ.af=0;}}
// ---- Marin extras (free drive): deer and rabbits crossing, the gentle rolling quake's falling branches and toppling trees, the San Quentin prisoners, gulls over the bay
function marinTick(rdt){if(!DRIVE||!CLF)return;const pe=ents.find(e=>e.player);if(!pe)return;const i=PL.idx;
  critTick(rdt,pe,i>Z.gg1+Math.round(150/SEG)&&i<Z.rb0-Math.round(60/SEG)&&!PL.crash);mqTick(rdt,pe);prisTick(rdt);gullTick();}
// deer and rabbits: now and then one, or a few together, bound across the road ahead. Hit one and it is bounced into the air, lands on its feet and runs off (never hurt, no crash)
const CRIT={l:[],cd:6,V:new THREE.Vector3(),W:new THREE.Vector3()};
function critTick(rdt,pe,on){const K=CRIT;
  if(!K.l.length){const br=std({color:0x8a5a34,roughness:1}),lt=std({color:0xe2d4b8,roughness:1}),dk=std({color:0x2a1d14,roughness:1}),gr=std({color:0x8a7a66,roughness:1}),wh=std({color:0xf2efe6,roughness:1});
    const Sp=(p,r,m,sx,sy,sz,x,y,z)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(r,8,6),m);o.scale.set(sx,sy,sz);o.position.set(x,y,z);p.add(o);return o;},Bx=(p,w,h,d,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);p.add(o);return o;};
    for(let n=0;n<11;n++){const deer=n<5,g=new THREE.Group(),b=new THREE.Group();g.add(b);
      if(deer){Sp(b,1,br,.3,.34,.75,0,1.05,0);Sp(b,.17,lt,1,1,.5,0,1.08,-.72);const nk=Bx(b,.15,.55,.18,br,0,1.4,.58);nk.rotation.x=.5;Sp(b,.13,br,1,1,1.6,0,1.68,.8);Sp(b,.045,dk,1,1,1,0,1.66,1.01);
        for(const x of[-.1,.1])Sp(b,.07,br,.5,1.4,.3,x,1.84,.72);
        if(n%2===0)for(const x of[-1,1]){const a=Bx(b,.03,.36,.03,lt,x*.1,1.98,.72);a.rotation.z=x*.4;const a2=Bx(b,.03,.18,.03,lt,x*.17,2.1,.78);a2.rotation.x=.6;}   // a buck: small antlers
        for(const[x,z]of[[-.14,.45],[.14,.45],[-.14,-.45],[.14,-.45]])Bx(b,.07,.8,.07,br,x,.4,z);}
      else{Sp(b,1,gr,.16,.15,.25,0,.18,0);Sp(b,.1,gr,1,1,1.1,0,.28,.2);for(const x of[-.04,.04]){const e=Sp(b,.04,gr,.4,1.7,.3,x,.44,.16);e.rotation.x=-.3;}Sp(b,.06,wh,1,1,1,0,.22,-.25);}   // a rabbit: long ears, white scut
      g.visible=false;scene.add(g);K.l.push({g,b,deer,st:0,s:0,lat:0,tg:0,mv:0,t:0,y:0,air:null});}}
  if(on){K.cd-=rdt;if(K.cd<=0){K.cd=R(5,11);const deer=Math.random()<.5,free=K.l.filter(o=>!o.st&&o.deer===deer),n=Math.min(free.length,1+(Math.random()*(deer?3:4)|0));
      const s0=pe.s+Math.max(55,Math.abs(pe.v)*3.2)+R(0,40),sd=Math.random()<.5?-1:1,w=RW+XW[wrapI(Math.floor(s0/SEG))];
      for(let k=0;k<n;k++){const o=free[k];o.st=1;o.t=-k*R(.3,.7);o.s=s0+R(-4,4);o.lat=sd*(w+R(5,9));o.tg=-sd*(w+14);o.mv=deer?R(7,9.5):R(4,5.5);o.y=0;o.air=null;o.g.rotation.set(0,0,0);o.g.visible=true;}}}
  for(const o of K.l){if(!o.st)continue;o.t+=rdt;const ds=wdiff(o.s-pe.s);
    if(ds<-40||ds>340||(!on&&ds<0)){o.st=0;o.g.visible=false;continue;}
    if(o.air){const a=o.air;a.vy-=18*rdt;o.y+=a.vy*rdt;o.s+=a.vs*rdt;o.lat+=a.vl*rdt;o.g.rotation.x+=a.sx*rdt;o.g.rotation.z+=a.sz*rdt;
      if(o.y<=0){o.y=0;o.air=null;o.g.rotation.x=o.g.rotation.z=0;o.tg=(Math.sign(o.lat)||1)*(RW+XW[wrapI(Math.floor(o.s/SEG))]+14);o.mv*=1.2;}   // lands on its feet and runs off
      at(o.s,o.lat,o.y,K.V);o.g.position.copy(K.V);continue;}
    {const cx=o.g.position.x-PL.x,cz=o.g.position.z-PL.z,vv=Math.abs(pe.v),r=o.deer?2.6:2;if(o.t>0&&vv>2&&!PL.crash&&cx*cx+cz*cz<r*r){o.y=0;o.air={vy:clamp(3+vv*.1,4,9),vs:pe.v*.5+R(1,3),vl:(Math.sign(o.lat-pe.lat)||1)*R(2,4),sx:R(-8,8),sz:R(-7,7)};sfxBoing(o.deer?.6:.4);G.shake=Math.max(G.shake,.1);continue;}}   // bounced off, never hurt
    const d=o.tg-o.lat;if(o.t>0){if(Math.abs(d)<.3){o.st=0;o.g.visible=false;continue;}o.lat+=Math.sign(d)*Math.min(Math.abs(d),o.mv*rdt);}
    const f=o.deer?7:11,hp=o.t>0?Math.abs(Math.sin(o.t*f)):0;at(o.s,o.lat,hp*(o.deer?.35:.25),K.V);o.g.position.copy(K.V);at(o.s,o.lat+(Math.sign(d)||1),0,K.W);o.g.rotation.y=Math.atan2(K.W.x-K.V.x,K.W.z-K.V.z);o.b.rotation.x=o.t>0?Math.cos(o.t*f)*.15:0;}}
// the Marin quake is a gentle rolling one: the road heaves softly in a long slow wave, branches drop onto the road, and a tree or two topples across the side of it.
// Touching a fallen tree is only a crunch and a jolt; the crack in the road (fqTick) opens into a hole you can drop into but can steer around
const MQ={tr:[],br:[],done:0,hc:0,A:new THREE.Vector3(),B:new THREE.Vector3(),U:new THREE.Vector3(0,1,0)};
function mqClear(){for(const o of[...MQ.tr,...MQ.br]){scene.remove(o.g);o.g.traverse(m=>m.geometry&&m.geometry.dispose());}MQ.tr.length=MQ.br.length=0;MQ.done=0;}
function mqTick(rdt,pe){const q=FQ.list.find(q=>q.nm==='MARIN');if(!q)return;
  if(q.st!==1){if(MQ.tr.length||MQ.br.length||MQ.done)mqClear();return;}
  const t=q.t,env=sst(t,0,2.5)*(1-sst(t,11,15)),ph=pe.s/180-t*.8;G.heave=(G.heave||0)+env*.32*Math.sin(ph*6.283);G.roll=(G.roll||0)+env*.022*Math.sin(ph*6.283+1.2);
  if(!MQ.mat)MQ.mat=[std({color:0x6e3a24,roughness:1}),std({color:0x24402a,roughness:1})];
  if(t>2&&!MQ.done){MQ.done=1;const n=1+(Math.random()<.6?1:0);for(let k=0;k<n;k++){const s=pe.s+Math.max(90,Math.abs(pe.v)*3.5)+k*R(40,80),i=wrapI(Math.floor(s/SEG)),sd=k?-MQ.tr[0].sd:(Math.random()<.5?-1:1),w=RW+XW[i];
      const g=new THREE.Group(),L=R(26,34),tr=new THREE.Mesh(cyl(.45,.9,L,8),MQ.mat[0]);tr.position.y=L/2;g.add(tr);for(let j=0;j<3;j++){const c=new THREE.Mesh(new THREE.ConeGeometry(3.4-j*.8,7,8),MQ.mat[1]);c.position.y=L*.55+j*4.5;g.add(c);}
      g.traverse(o=>o.castShadow=true);at(s,sd*(w+5.5),0,g.position);scene.add(g);
      const dir=new THREE.Vector3().addScaledVector(Nn[i],-sd*.38).addScaledVector(T[i],.92);dir.y=0;dir.normalize();   // it falls forward and in over the edge of the road, leaving the other side clear
      MQ.tr.push({g,sd,L,dir,ax:new THREE.Vector3().crossVectors(MQ.U,dir).normalize(),t:-R(0,1.5),a:0});}}
  for(const o of MQ.tr){o.t+=rdt;if(o.t<0)continue;const u=Math.min(1,o.t/2.4);o.a=1.42*u*u;o.g.quaternion.setFromAxisAngle(o.ax,o.a);
    if(u>=1&&!o.down){o.down=1;G.shake=Math.max(G.shake,.35);sfxCrunch(.6);NOGY=1;for(let k=0;k<14;k++)puff(V.copy(o.g.position).addScaledVector(o.dir,R(4,o.L)),R(-2,2),R(1,3),R(-2,2),1,R(3,6),R(1.4,2.6),.5,0x8a8070);NOGY=0;}
    if(o.a>.9&&MQ.hc<=0&&!PL.crash){const p=o.g.position,dx=PL.x-p.x,dz=PL.z-p.z,u2=clamp(dx*o.dir.x+dz*o.dir.z,0,Math.sin(o.a)*o.L),ex=dx-o.dir.x*u2,ez=dz-o.dir.z*u2;
      if(ex*ex+ez*ez<1.9*1.9){MQ.hc=1;sfxCrunch(.8);G.shake=Math.max(G.shake,.5);PL.vx*=.7;PL.vz*=.7;}}}   // a crunch and a jolt, never a crash
  MQ.hc-=rdt;
  if(t>2.5&&t<11){MQ.nb=(MQ.nb||0)-rdt;if(MQ.nb<=0&&MQ.br.length<18){MQ.nb=R(.25,.6);const s=pe.s+R(25,Math.max(60,Math.abs(pe.v)*3)),i=wrapI(Math.floor(s/SEG)),w=RW+XW[i];
      const g=new THREE.Group(),l=R(1.4,3.2);g.add(new THREE.Mesh(new THREE.BoxGeometry(.14,.14,l),MQ.mat[0]));const c=new THREE.Mesh(new THREE.ConeGeometry(.6,l*.7,6),MQ.mat[1]);c.rotation.x=Math.PI/2;c.position.z=l*.2;g.add(c);
      at(s,R(-w-3,w+3),R(16,26),g.position);g.rotation.set(R(0,6),R(0,6),0);scene.add(g);MQ.br.push({g,vy:0,gy:at(s,0,0,MQ.B).y,wx:R(-3,3),wz:R(-3,3)});}}
  for(const b of MQ.br){if(b.gy==null)continue;b.vy-=14*rdt;b.g.position.y+=b.vy*rdt;b.g.rotation.x+=b.wx*rdt;b.g.rotation.z+=b.wz*rdt;if(b.g.position.y<b.gy+.12){b.g.position.y=b.gy+.12;b.g.rotation.x=b.g.rotation.z=0;b.gy=null;}}}   // branches drop and lie on the road
// Marin forest earthquake: a rotten tree trunk beside the road topples over towards it, and out of the hollow end crawls a giant centipede (two thirds of a car long, dark
// red-brown and black, segmented, its many legs rippling, antennae waving). It scuttles across the road and off into the trees. Drive over it and it squashes flat with a
// "boing" and springs back, then scuttles on. Never a crash, no slowdown (CENT, centTick).
const CENT={st:0,g:null,V:new THREE.Vector3(),U:new THREE.Vector3(0,1,0)};
function centMk(){const C=CENT,g=new THREE.Group(),b=new THREE.Group();g.add(b);const sg=new THREE.SphereGeometry(1,12,8),M=[std({color:0x5a1e10,roughness:.45}),std({color:0x1a0d08,roughness:.4}),std({color:0xb0602a,roughness:.5})],lg=cyl(.012,.02,1,4).translate(0,-.5,0);
  C.segs=[];C.legs=[];const N=17;
  for(let n=0;n<N;n++){const z=1.35-n*.165,s=new THREE.Group();s.position.z=z;b.add(s);const w=n===0?.13:n>N-3?.09:.15;
    const o=new THREE.Mesh(sg,M[n%2]);o.scale.set(w,.065,.1);o.position.y=.11;o.castShadow=true;s.add(o);   // a flat plated segment
    if(n>0)for(const sd of[-1,1]){const p=new THREE.Group();p.position.set(sd*w*.85,.1,0);s.add(p);const a=new THREE.Mesh(lg,M[2]);a.scale.set(1,.2,1);a.rotation.z=sd*1.15;p.add(a);const f=new THREE.Mesh(lg,M[2]);f.scale.set(1,.14,1);f.position.set(sd*.18,-.08,0);f.rotation.z=sd*.25;p.add(f);C.legs.push({g:p,sd,n});}   // a pair of legs on every segment
    C.segs.push({g:s,z});}
  const hd=C.segs[0].g;for(const sd of[-1,1]){const an=new THREE.Mesh(lg,M[1]);an.scale.set(1,.55,1);an.position.set(sd*.05,.13,.08);an.rotation.set(-1.3,0,sd*.5);hd.add(an);(C.ant||(C.ant=[])).push(an);   // antennae
    const fc=new THREE.Mesh(lg,M[1]);fc.scale.set(1.4,.12,1.4);fc.position.set(sd*.06,.08,.1);fc.rotation.set(-1.4,0,-sd*.6);hd.add(fc);}   // the pincer jaws
  g.visible=false;scene.add(g);C.g=g;C.b=b;
  const tk=new THREE.Group(),wd=std({color:0x5c4c3c,roughness:1}),ms=std({color:0x4a5a2a,roughness:1});const t=new THREE.Mesh(cyl(.8,.95,5,10).translate(0,2.5,0),wd);t.castShadow=true;tk.add(t);   // the rotten trunk, mossy, hollow at the top
  for(let k=0;k<7;k++){const m=new THREE.Mesh(sg,ms);m.scale.set(R(.4,.7),R(.2,.5),.25);const a=R(0,6.28);m.position.set(Math.cos(a)*.85,R(.5,4.5),Math.sin(a)*.85);m.rotation.y=-a;tk.add(m);}
  const h=new THREE.Mesh(new THREE.CircleGeometry(.62,14).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x0a0604}));h.position.y=5.01;tk.add(h);
  tk.visible=false;scene.add(tk);C.tk=tk;}
function centTick(rdt){const C=CENT,pe=ents.find(e=>e.player);if(!DRIVE||!pe||!FQ.list)return;const q=FQ.list.find(q=>q.nm==='MARIN');if(!q)return;
  if(q.st!==1){if(C.st){C.st=0;C.g.visible=C.tk.visible=false;}return;}
  if(!C.g)centMk();
  if(!C.st){if(q.t<2.3)return;const s=wrapS(pe.s+Math.max(110,Math.abs(pe.v)*4.5)),i=wrapI(Math.floor(s/SEG)),sd=Math.random()<.5?-1:1,w=RW+XW[i];   // the trunk stands beside the road ahead
    Object.assign(C,{st:1,t:0,s,sd,w,lat:sd*(w+.6),sq:0,ph:0});at(s,sd*(w+6.2),0,C.tk.position);C.dir=new THREE.Vector3().addScaledVector(Nn[i],-sd);C.dir.y=0;C.dir.normalize();C.ax=new THREE.Vector3().crossVectors(C.U,C.dir).normalize();C.tk.quaternion.identity();C.tk.visible=true;C.g.visible=false;}
  C.t+=rdt;const ds=wdiff(C.s-pe.s);
  if(C.st===1){const u=Math.min(1,C.t/2);C.tk.quaternion.setFromAxisAngle(C.ax,1.5*u*u);if(u>=1){C.st=2;sfxCrunch(.6);G.shake=Math.max(G.shake,.3);NOGY=1;for(let k=0;k<10;k++)puff(V.copy(C.tk.position).addScaledVector(C.dir,R(1,5)),R(-1.5,1.5),R(.5,2),R(-1.5,1.5),1,R(2,4),R(1,2),.5,0x7a6a58);NOGY=0;}}   // it topples towards the road
  else if(C.st===2){if(ds<Math.max(40,Math.abs(pe.v)*2.6)+12||C.t>9){C.st=3;C.t=0;C.g.visible=true;sfxHiss();}}   // out of the hole when the car is coming
  else if(C.st===3){const k=C.sq>0?.4:1;C.lat-=C.sd*3.4*k*rdt;C.ph+=rdt*14*k;if(Math.abs(C.lat)>C.w+7&&Math.sign(C.lat)!==C.sd||ds<-80){C.st=4;C.g.visible=false;}}
  if(C.st===3){const i=wrapI(Math.floor(C.s/SEG));at(C.s,C.lat,0,C.V);C.g.position.copy(C.V);C.g.rotation.y=yaw(i)-C.sd*Math.PI/2;const ph=C.ph;
    for(const sg of C.segs){sg.g.position.x=Math.sin(ph*.35-sg.z*3)*.06;sg.g.rotation.y=Math.cos(ph*.35-sg.z*3)*.15;}   // a gentle side-to-side sway down the body
    for(const L of C.legs){const q2=ph-L.n*.75;L.g.rotation.y=Math.sin(q2)*.5;L.g.rotation.z=L.sd*Math.max(0,Math.cos(q2))*.25;}   // the legs ripple down each side in waves
    for(const a of C.ant)a.rotation.y=Math.sin(C.t*5+a.position.x*30)*.3;
    if(C.sq>0){C.sq-=rdt;const e=1-C.sq/.9;C.b.scale.set(1+.4*(1-e),.15+.85*(1-Math.exp(-6*e)*Math.cos(14*e)),1);}else C.b.scale.set(1,1,1);   // squashed flat, then it springs back
    if(C.sq<=0){const dx=C.V.x-PL.x,dz=C.V.z-PL.z,ch=Math.sin(PL.h),cc=Math.cos(PL.h),al=dx*ch+dz*cc,ac=dx*cc-dz*ch;
      if(Math.abs(al)<2.4&&Math.abs(ac)<1.9&&Math.abs(pe.v)>2&&!PL.crash){C.sq=.9;sfxBoing(1);G.shake=Math.max(G.shake,.25);say('BOING !','',1.2);}}}}
// the quake's hole: drop into it and the car goes down burning, then the usual reset
function holeFall(pe){const i=PL.idx;crashPlayer(Math.abs(pe.v)*.3,false);const w=hero.wreck;if(!w)return;w.free=1;w.y=H[i];w.vy=0;w.vx*=.25;w.vz*=.25;w.wr=R(-2,2);w.fire=R(1.6,2.2);
  PL.crash.cam=1;camP.set(PL.x+Nn[i].x*14-T[i].x*16,H[i]+12,PL.z+Nn[i].z*14-T[i].z*16);say('INTO THE CRACK','No. '+LIV().num+' - McQUEEN',3);}
// San Quentin: ~30 prisoners in stripes (instanced) pour out onto the road and wave both arms to flag you down. Harmless: nothing collides, you drive straight through them
const PRIS={l:[],on:0,V:new THREE.Vector3(),W:new THREE.Vector3(),Y:new THREE.Vector3(0,1,0),X:new THREE.Vector3(1,0,0),P:new THREE.Vector3(),S1:new THREE.Vector3(1,1,1),Q:new THREE.Quaternion(),QY:new THREE.Quaternion(),F:new THREE.Matrix4(),L:new THREE.Matrix4(),M:new THREE.Matrix4(),N:30};
function prisPut(im,k,x,y,z,rx,sc){const K=PRIS;K.P.set(x,y,z);K.Q.setFromAxisAngle(K.X,rx);K.L.compose(K.P,K.Q,sc||K.S1);K.M.multiplyMatrices(K.F,K.L);im.setMatrixAt(k,K.M);}
function prisTick(rdt){const K=PRIS,N=K.N,a=SQX.a||Z.sq+Math.round(260/SEG),near=PL.idx>a-Math.round(900/SEG)&&PL.idx<a+Math.round(200/SEG);searchTick(rdt,near);
  if(!K.im){const st=std({map:canvas(32,64,(g,w,h)=>{for(let y=0;y<h;y+=16){g.fillStyle='#f0ece0';g.fillRect(0,y,w,8);g.fillStyle='#1a1a1a';g.fillRect(0,y+8,w,8);}}),roughness:1}),sk=std({color:0xc89a78,roughness:1}),wd=std({color:0x5a4026,roughness:1}),ir=std({color:0x55585c,roughness:.6,metalness:.5});
    const mk=(g,m,n)=>{const o=new THREE.InstancedMesh(g,m,n);o.frustumCulled=false;o.count=0;scene.add(o);return o;};
    // body, head, legs, arms, tool handles, then the tool heads: hammer, pickaxe, shovel blade
    K.im=[mk(new THREE.BoxGeometry(.5,.7,.3),st,N),mk(new THREE.SphereGeometry(.15,8,6),sk,N),mk(new THREE.BoxGeometry(.18,.8,.2).translate(0,-.4,0),st,N*2),mk(new THREE.BoxGeometry(.13,.6,.13).translate(0,-.28,0),st,N*2),
      mk(new THREE.BoxGeometry(.06,.9,.06).translate(0,.3,0),wd,N),mk(new THREE.BoxGeometry(.14,.14,.32),ir,N),mk(new THREE.BoxGeometry(.07,.07,.86),ir,N),mk(new THREE.BoxGeometry(.26,.34,.03).translate(0,.17,0),ir,N)];
    for(let n=0;n<N;n++)K.l.push({s:0,lat:0,t:0,mv:0,ph:0,st:0,dl:0,ts:0,tl2:0,ry:0,tl:n%5});}   // tl: 0 bare hands, 1 shovel, 2 hammer, 3 stick, 4 pickaxe
  if(!near||G.state!=='race'){if(K.on){K.on=0;for(const m of K.im)m.count=0;}return;}
  const sh=SQX.s!==undefined?SQX.s:a*SEG,hl=SQX.lat!==undefined?SQX.lat:-(RW+XW[a]+26),pe=ents.find(e=>e.player);
  if(!K.on){K.on=1;K.go=0;for(let n=0;n<N;n++){const o=K.l[n];o.st=0;o.s=sh+R(-12,12);o.lat=hl-R(2,14);o.t=R(0,3);o.mv=R(3.8,5.6);o.ph=R(0,6.3);o.ts=sh+R(-55,55);o.tl2=-(RW+XW[wrapI(Math.floor(o.ts/SEG))]+R(.9,2.6));o.dl=n*.3+R(0,.25);o.ry=0;}}   // they wait in the yard behind the fence...
  if(!K.go&&pe&&wdiff(sh-pe.s)<330)K.go=1;   // ...and break out through the hole, one after another, as the car comes; then run for the road and stop at its edge
  let nt=0;const nh=[0,0,0];
  for(let n=0;n<N;n++){const o=K.l[n];o.t+=rdt;if(o.st===0&&K.go){o.dl-=rdt;if(o.dl<=0)o.st=1;}
    const tgS=o.st===1||o.st===2?sh:o.ts,tgL=o.st===1?hl-1.2:o.st===2?hl+1.6:o.tl2;let run=false;
    if(o.st>=1&&o.st<=3){const ds=tgS-o.s,dl=tgL-o.lat,d=Math.hypot(ds,dl);if(d<.15)o.st++;else{const k=Math.min(d,o.mv*rdt)/d;o.s+=ds*k;o.lat=Math.min(o.lat+dl*k,-(RW+XW[wrapI(Math.floor(o.s/SEG))]+.5));run=true;at(o.s,o.lat,0,K.V);at(o.s+ds/d,o.lat+dl/d,0,K.W);o.ry=Math.atan2(K.W.x-K.V.x,K.W.z-K.V.z);}}
    const sw=Math.sin(o.t*10),stand=!run;at(o.s,o.lat,run?Math.abs(sw)*.08:0,K.V);
    if(stand){K.W.set(PL.x,0,PL.z);o.ry=Math.atan2(K.W.x-K.V.x,K.W.z-K.V.z);}
    K.QY.setFromAxisAngle(K.Y,o.ry);K.F.compose(K.V,K.QY,K.S1);
    const wave=stand&&o.st===4,by=wave?Math.abs(Math.sin(o.t*7))*.05:0,rl=run?sw*.7:0,idle=stand&&!wave?Math.sin(o.t*1.3+o.ph)*.15:0;
    prisPut(K.im[0],n,0,1.15+by,0,0);prisPut(K.im[1],n,0,1.68+by,0,0);
    prisPut(K.im[2],n*2,-.12,.8+by,0,rl);prisPut(K.im[2],n*2+1,.12,.8+by,0,-rl);
    let rA=0;for(let k=0;k<2;k++){const ax=wave?-2.7+Math.sin(o.t*14+k*1.7)*.35:(k?1:-1)*rl*-.9+idle;if(k)rA=ax;prisPut(K.im[3],n*2+k,(k?1:-1)*.32,1.45+by,0,ax);}
    if(o.tl){const ta=.9+.35*rA,hy=1.45+by-.56*Math.cos(rA),hz=-.56*Math.sin(rA);prisPut(K.im[4],nt++,.32,hy,hz,ta);   // the tool in the right hand: brandished overhead once they are at the road
      const ty=hy+.72*Math.cos(ta),tz=hz+.72*Math.sin(ta);if(o.tl===2)prisPut(K.im[5],nh[0]++,.32,ty,tz,ta);else if(o.tl===4)prisPut(K.im[6],nh[1]++,.32,ty,tz,ta);else if(o.tl===1)prisPut(K.im[7],nh[2]++,.32,ty,tz,ta);}}
  K.im[0].count=K.im[1].count=N;K.im[2].count=K.im[3].count=N*2;K.im[4].count=nt;K.im[5].count=nh[0];K.im[6].count=nh[1];K.im[7].count=nh[2];for(const m of K.im)m.instanceMatrix.needsUpdate=true;}
// the watchtower searchlight: sweeps back and forth across the yard, the hole and the road edge; a pale beam you can see by day, bright at dusk and at night
function searchTick(rdt,near){const S=SQX;if(!S.sp)return;const on=near&&G.state==='race';S.beam.visible=S.pool.visible=on;S.sp.intensity=on?1.5+6*(1-dayK):0;if(!on)return;S.t+=rdt;if(S.beam.parent!==scene){S.beam.removeFromParent();S.pool.removeFromParent();scene.add(S.beam,S.pool);}   /* (the static merge after the build takes loose meshes out of the scene) */
  const u=Math.sin(S.t*.55),v=Math.sin(S.t*.31+1);at(S.s+v*48,lerp(S.lat-24,S.lat+24,.5+.5*u),0,S.tg.position);S.tg.updateMatrixWorld();
  const d=S.lp.distanceTo(S.tg.position),r=d*.17;S.beam.scale.set(r,r,d);S.beam.lookAt(S.tg.position);S.beam.material.opacity=.24+.2*(1-dayK);S.beam.material.blending=dayK<.5?THREE.AdditiveBlending:THREE.NormalBlending;
  S.pool.position.copy(S.tg.position);S.pool.position.y+=.08;S.pool.scale.set(r,r,1);S.pool.material.opacity=.26+.35*(1-dayK);}
// leaking toxic barrels: drive through the glowing ooze and the car is slimed green (fading off over ~10 s); it slithers a little while in the slick. No crash.
function toxTick(rdt){const K=TOX;if(!DRIVE||!K.l.length||!hero)return;const pe=ents.find(e=>e.player);if(!pe)return;const t=tmNow();if(K.mm)K.mm[1].opacity=.24+.12*Math.sin(t*2.3);
  if(!K.V){K.V=new THREE.Vector3();K.G=new THREE.Color(0x5cff2a);K.G2=new THREE.Color(0x2cff10);}
  if(G.state==='race'&&!PL.crash)for(const o of K.l){if(Math.abs(wdiff(pe.s-o.s))<o.rs&&Math.abs(pe.lat-o.lat)<o.rl){if(K.slime<9.6){if(K.slime<=0)say('TOXIC OOZE!','Slimed green',2.2);sfxSquelch();}K.slime=10;
      const sp=Math.hypot(PL.vx,PL.vz);if(sp>3){PL.vx*=1-.5*rdt;PL.vz*=1-.5*rdt;PL.h+=Math.sin(t*9)*.22*rdt;if(Math.random()<rdt*25)puff(K.V.set(PL.x+R(-1,1),PL.gy+.2,PL.z+R(-1,1)),PL.vx*.2+R(-2,2),R(1,3),PL.vz*.2+R(-2,2),.8,R(2,4),R(.5,1),.75,0x7dff2e);}}}
  if(K.slime>0){if(K.car!==hero){K.car=hero;K.mats=[];hero.traverse(o=>{if(!o.isMesh||!o.material||Array.isArray(o.material)||!o.material.color||o.material.transparent)return;if(!o.userData.tox){o.material=o.material.clone();o.userData.tox=1;}K.mats.push([o.material,o.material.color.clone(),o.material.emissive?o.material.emissive.clone():null]);});}   // the car gets its own copies, so nothing else turns green
    K.slime-=rdt;const k=clamp(K.slime/4,0,1)*.8;for(const[m,c0,e0]of K.mats){m.color.copy(c0).lerp(K.G,k);if(e0)m.emissive.copy(e0).lerp(K.G2,k*.45);}
    if(K.slime<=0){for(const[m,c0,e0]of K.mats){m.color.copy(c0);if(e0)m.emissive.copy(e0);}K.car=null;}}}
function sfxSquelch(){if(!AC)return;const t=AC.currentTime;tone('sine',190,t,.28,.45,master,{to:55});hit(t,.35,.5,700,'lowpass',master);hit(t+.08,.25,.25,1800,'bandpass',master);}
// a giant mosquito, as big as a car: as you leave the Marin redwoods it swoops out of the trees, dives low across the road just ahead of the car with a whining drone,
// circles the car once and flies off over the bay. Harmless (nothing to hit), once per pass.
function mosqBuild(M=MOSQ){const g=new THREE.Group(),dk=std({color:0x1d1b19,roughness:.55,metalness:.15}),eye=std({color:0x2a0c08,roughness:.25,metalness:.3}),V1=new THREE.Vector3(),V2=new THREE.Vector3(),UP=new THREE.Vector3(0,1,0);
  const seg=(a,b,r,mm)=>{const L=a.distanceTo(b),c=new THREE.Mesh(cyl(r,r*.8,L,6),mm);c.position.copy(a).add(b).multiplyScalar(.5);c.quaternion.setFromUnitVectors(UP,V1.copy(b).sub(a).normalize());g.add(c);return c;};
  const S=(r,sx,sy,sz,x,y,z,mm)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(r,14,10),mm);o.scale.set(sx,sy,sz);o.position.set(x,y,z);g.add(o);return o;};
  const ab=canvas(256,128,(c,w,h)=>{c.fillStyle='#c4161c';c.fillRect(0,0,w,h);c.fillStyle='#fbf8f2';for(let y=8;y<h;y+=16)for(let x=(y/16&1)*9+4;x<w;x+=18){c.beginPath();c.arc(x,y,3.2,0,7);c.fill();}}),hd=canvas(128,64,(c,w,h)=>{c.fillStyle='#3f9a2c';c.fillRect(0,0,w,h);c.fillStyle='#0b0b0a';for(let k=0;k<260;k++){c.beginPath();c.arc(Math.random()*w,Math.random()*h,R(.6,1.4),0,7);c.fill();}});   // owner: a red abdomen with white dots, a green head with tiny black dots
  S(.9,1,.9,1.1,0,0,0,dk);S(.45,1,1,1,0,-.1,1.15,std({map:hd,roughness:.5}));S(.3,1,1,1,-.26,0,1.3,eye);S(.3,1,1,1,.26,0,1.3,eye);
  const abd=S(1,.55,.5,2.3,0,-.25,-2.6,std({map:ab,roughness:.5}));abd.rotation.x=-.12;
  seg(V1.set(0,-.2,1.5).clone(),V2.set(0,-.9,4.1).clone(),.05,dk);   // the long proboscis
  for(const s of[-1,1]){const a0=new THREE.Vector3(s*.15,.15,1.5),a1=new THREE.Vector3(s*.55,.75,2.5);seg(a0,a1,.03,dk);for(let k=1;k<9;k++){const p=a0.clone().lerp(a1,k/9);for(const d of[-1,1])seg(p,p.clone().add(V2.set(d*.22,.12,-.05)),.008,dk);}}   // feathery antennae
  for(let k=0;k<3;k++)for(const s of[-1,1]){const z=.5-k*.5,hip=new THREE.Vector3(s*.4,-.45,z),knee=new THREE.Vector3(s*1.7,.5,z+(k-1)*.9),ft=new THREE.Vector3(s*2.3,-2.8,z+(k-1)*1.6-.8);seg(hip,knee,.06,dk);seg(knee,ft,.035,dk);}   // six long thin legs
  const wt=canvas(256,96,(c,w,h)=>{c.clearRect(0,0,w,h);c.fillStyle='rgba(225,232,240,.16)';c.beginPath();c.moveTo(0,h*.5);c.quadraticCurveTo(w*.5,-h*.15,w,h*.45);c.quadraticCurveTo(w*.5,h*1.05,0,h*.5);c.fill();c.strokeStyle='rgba(20,18,16,.95)';c.lineWidth=3;c.stroke();c.clip();   /* veins stay inside the outline */
    c.strokeStyle='rgba(30,28,26,.85)';c.lineWidth=2;for(let k=0;k<7;k++){c.beginPath();c.moveTo(0,h*.5);c.quadraticCurveTo(w*.5,h*(.18+k*.1),w*(.7+k*.04),h*(.2+k*.09));c.stroke();}c.lineWidth=1;for(let k=0;k<14;k++){const x=w*(.15+k*.06);c.beginPath();c.moveTo(x,h*.25);c.lineTo(x+8,h*.75);c.stroke();}
    });   // a clear membrane: only the dark outline and the veins show
  const wm=new THREE.MeshBasicMaterial({map:wt,transparent:true,side:THREE.DoubleSide,depthWrite:false});M.w=[];
  for(const s of[-1,1]){const pv=new THREE.Group();pv.position.set(s*.3,.65,.1);pv.rotation.y=s*.4;const wg=new THREE.Mesh(new THREE.PlaneGeometry(4,1.4).translate(2,0,0).rotateX(-Math.PI/2),wm);wg.scale.x=s;pv.add(wg);g.add(pv);M.w.push([pv,s]);}
  g.scale.setScalar(1.1);g.visible=false;scene.add(g);M.g=g;M.p=new THREE.Vector3();M.q=new THREE.Vector3();M.V=new THREE.Vector3();}
function mosqStart(t0){const M=MOSQ,i=PL.idx;if(!M.g)mosqBuild();M.on=1;M.armed=0;M.t=t0||0;M.got=0;M.ta=0;M.lift=null;M.g.scale.setScalar(1.1);
  M.bay=Terrain.landAt(...(at(i*SEG,250,0,M.V),[M.V.x,M.V.z]))<.2?1:-1;M.from=-M.bay;say('BZZZZZZZ!','',1.6);mosqSnd(1);}
function mosqTick(rdt){const M=MOSQ;if(!DRIVE||!CLF)return;const pe=ents.find(e=>e.player);if(!pe)return;const ex=Z.sq-Math.round(610/SEG),i=PL.idx;
  if(i<ex-Math.round(300/SEG)||i>Z.rb0)M.armed=1;   // ready again for the next pass
  if(!M.on&&M.armed&&G.state==='race'&&i>=ex-Math.round(40/SEG)&&i<ex+Math.round(40/SEG))mosqStart(0);
  if(!M.on)return;if(G.state!=='race'){if(M.lift){M.lift.force=1;mosqCarry(0,pe);}M.on=0;M.g.visible=false;mosqSnd(0);return;}
  M.t+=rdt;const t=M.t,fr=M.from,hold=M.lift&&!M.lift.drop;let s,la,y;M.q.copy(M.g.position);
  if(hold){M.p.set(PL.x,PL.cy+3.4,PL.z);M.g.position.copy(M.p);M.g.rotation.set(Math.sin(t*5)*.06,PL.h+Math.sin(t*3.1)*.06,Math.sin(t*6.3)*.08);}   // hanging on to the car, legs round it
  else{if(t<2.4){const k=t/2.4;s=pe.s+100-82*k;la=fr*(38-50*k);y=26-23.4*k*(2-k);}   // out of the trees and down across the road just in front of the car
    else if(!M.got){const e=sst(t,2.4,3.3);s=pe.s+18*(1-e);la=lerp(fr*-12,pe.lat,e);y=lerp(2.6,PL.cy-PL.gy+3.4,e);   // then round onto the car itself
      if(PL.crash){M.got=1;M.ta=0;M.s0=s;M.la0=la;M.y0=y;}else if(e>=1){M.got=1;mosqGrab(pe);}}
    else{M.ta+=rdt;const k=Math.min(1,M.ta/7),e=k*k*(3-2*k),s1=SQX.s!==undefined?SQX.s:(Z.sq+Math.round(260/SEG))*SEG,l1=SQX.lat!==undefined?SQX.lat:-40;   // he lets go and flies off to San Quentin, climbing and shrinking away
      s=lerp(M.s0,s1,e);la=lerp(M.la0,l1,e);y=M.y0+130*k*k;M.g.scale.setScalar(1.1*(1-.93*k));}
    if(s!==undefined){at(s,la,y,M.p);M.g.position.copy(M.p);if(M.q.distanceToSquared(M.p)>1e-4&&t>.05){M.V.copy(M.p).multiplyScalar(2).sub(M.q);M.g.lookAt(M.V);M.g.rotateZ(Math.sin(t*1.7)*.25);}}}
  M.g.visible=true;for(const[pv,sg]of M.w)pv.rotation.z=sg*(.25+.55*Math.sin(t*(hold?62:48)));
  if(M.snd){const d=M.p.distanceTo(camera.position),k=clamp(1-d/220,0,1),ct=AC.currentTime,L=hold?M.lift:null;M.snd.g.gain.setTargetAtTime(L?.95:.55*k*k+.02,ct,.05);const vr=M.pd!==undefined?(d-M.pd)/Math.max(rdt,.001):0;M.pd=d;const f=L?1.15+.1*(L.wr||0):clamp(1-vr/260,.75,1.3);M.snd.o1.frequency.setTargetAtTime(520*f,ct,.05);M.snd.o2.frequency.setTargetAtTime(527*f,ct,.05);}   // a loud straining buzz while he holds the car
  if(M.got&&!hold&&M.ta>7){M.on=0;M.g.visible=false;mosqSnd(0);}}
// he grips the car and hauls it 30-38 m up over the road for about 2.6 s, holds it a moment, then lets go (tapping the throttle or steering twice makes him let go early). The car falls, hits the road with a thump and dust and bounces forward in shrinking hops, keeping its speed, then drives on; carried along the road and always landing on it, upright, pointing the same way; no crashing meanwhile or for a second after
function mosqGrab(pe){let dh=PL.h-yaw(PL.idx);dh=Math.atan2(Math.sin(dh),Math.cos(dh));const lk=CLF&&PL.idx>=CLF[0]+15&&PL.idx<CLF[1]-30?1:0;MOSQ.lift={lake:lk,s0:pe.s,lat0:pe.lat,t:0,v:clamp(pe.v,8,40),lat:pe.lat,dh:clamp(dh,-.35,.35),H:R(30,38),h:0,vh:0,b:0,wb:0,taps:0,pr:1,drop:0,wr:0};if(lk)MOSQ.lift.v=Math.min(MOSQ.lift.v,12);
  PL.safe=Math.max(PL.safe,1.5);endSkid();G.shake=Math.max(G.shake,.6);sfxThump(.5);say('THE MOSQUITO HAS YOU !','tap the throttle or steer to make him let go',2.2);}
function mosqCarry(dt,pe){const L=MOSQ.lift,M=MOSQ;L.t+=dt;PL.safe=Math.max(PL.safe,1.5);
  const[st,thr]=readInput(true),on=thr>.5||Math.abs(st)>.5;if(on&&!L.pr&&!L.drop){L.taps++;L.wr=1;G.shake=Math.max(G.shake,.5);}L.pr=on;L.wr=Math.max(0,L.wr-dt*3);
  if(!L.drop&&(L.taps>=2||L.t>3.9||L.force)){L.drop=L.t;L.vh=0;M.ta=0;M.s0=pe.s;M.la0=pe.lat;M.y0=L.h+3.4;say(L.taps>=2?'HE LETS GO !':'DROPPED !','',1.4);}
  if(L.drop&&L.lake&&!L.force&&Math.abs(L.lat)>16){M.lift=null;lakeStart({src:"mosq",x:PL.x,y:PL.cy,z:PL.z,vx:PL.vx*.3,vz:PL.vz*.3,vy:0,rs:L.s0});return true;}   // out over the lake: he lets go and the car drops into it
  if(!L.drop)L.h=L.H*sst(L.t,0,2.6)+Math.sin(L.t*1.7)*.5*sst(L.t,.5,1.5);   // up high, swaying, then held there a moment
  else{L.vh-=14*dt;L.h+=L.vh*dt;   // falling free
    if(L.h<=0){L.h=0;const imp=-L.vh;sfxThump(clamp(imp/18,.5,1.3));G.shake=Math.max(G.shake,clamp(imp/22,.5,1.4));L.wb=clamp(imp/30,.2,1);
      for(let j=0;j<14;j++){at(pe.s,L.lat+R(-1.6,1.6),.3,V);puff(V,R(-4,4),R(.5,2.5),R(-4,4),R(.8,1.4),R(3,5.5),R(1,1.8),.5*clamp(imp/20,.4,1),0xb59a78);}
      if(L.b<3&&imp>4&&!L.force){L.b++;L.vh=imp*.42;L.v=Math.min(Math.max(L.v*1.06,16),45);}else L.land=1;}}   // bounce on forward, each hop smaller
  const k=L.drop?Math.max(0,1-(L.t-L.drop)/.6):clamp(L.t/.5,0,1);L.wb=Math.max(0,L.wb-dt*1.6);
  if(!L.drop)L.v*=Math.exp(-.15*dt);pe.s=wrapS(pe.s+L.v*dt);pe.dist+=L.v*dt;const i=PL.idx=wrapI(Math.round(pe.s/SEG)),ed=Math.max(0,edgeAt[i]-1.3);if(L.lake&&!L.drop){const i0=PL.idx;L.lat=lerp(L.lat0,13+H[i0]*.3+30,sst(L.t,.5,3.3));}else L.lat=lerp(L.lat,clamp(L.lat,-ed,ed),clamp(dt*4,0,1));pe.lat=L.lat;   /* over the Marin lake he carries the car out over the water */ 
  at(pe.s,L.lat,0,V);PL.x=V.x;PL.z=V.z;GY=PL.gy=V.y;PL.cy=PL.gy+L.h+Math.sin(L.t*7)*.12*k;PL.air=0;PL.vy=0;PL.slope=0;
  L.dh*=Math.exp(-1.5*dt);PL.h=yaw(i)+L.dh+Math.sin(L.t*2.3)*.05*k;PL.vx=Math.sin(PL.h)*L.v;PL.vz=Math.cos(PL.h)*L.v;pe.v=L.v;
  hero.position.set(PL.x,PL.cy,PL.z);hero.rotation.set(Math.sin(L.t*4.1)*.07*k+.22*clamp(L.h/30,0,1)+Math.sin(L.t*17)*.06*L.wb,PL.h,(Math.sin(L.t*5.7)*.1+Math.sin(L.t*31)*.1*L.wr)*k+Math.sin(L.t*13)*.04*L.wb);G.shake=Math.max(G.shake,.3*k);   // nose tipped down while high, so you look down at the road
  for(const w of hero.wheels)w.rotation.y+=w.userData.dir*L.v*dt/.33;
  if(L.land||L.force){PL.cy=PL.gy;hero.position.y=PL.cy;PL.h=yaw(i)+L.dh;PL.vx=Math.sin(PL.h)*L.v;PL.vz=Math.cos(PL.h)*L.v;resetVehicle(VS,hero.M.dyn,L.v);VS.x=PL.x;VS.z=PL.z;VS.h=PL.h;PL.safe=Math.max(PL.safe,1.2);M.lift=null;}
  return true;}
function mosqSnd(on){const M=MOSQ;if(!AC)return;if(!on){if(M.snd){const ct=AC.currentTime;M.snd.g.gain.setTargetAtTime(0,ct,.1);const s=M.snd;setTimeout(()=>{try{s.o1.stop();s.o2.stop();s.l.stop();}catch(e){}},600);M.snd=null;}return;}if(M.snd)return;
  const o1=AC.createOscillator(),o2=AC.createOscillator(),l=AC.createOscillator(),lg=AC.createGain(),bp=AC.createBiquadFilter(),g=AC.createGain();o1.type=o2.type='sawtooth';o1.frequency.value=520;o2.frequency.value=527;l.frequency.value=31;lg.gain.value=26;l.connect(lg);lg.connect(o1.frequency);lg.connect(o2.frequency);   // two detuned saws, warbled at wingbeat rate
  bp.type='bandpass';bp.frequency.value=1100;bp.Q.value=1.4;g.gain.value=0;o1.connect(bp);o2.connect(bp);bp.connect(g);g.connect(master);o1.start();o2.start();l.start();M.snd={o1,o2,l,g};M.pd=undefined;}
// THE BEETLE: a giant beetle-horned monster, some 100 m tall (the bridge decks stand 67-70 m over the water). As you drive onto each of the three bridges he rises slowly out of the bay beside it, streaming water,
// in a ring of waves, with a deep roar; swings his great hooked claw down onto the deck two or three times (the deck jumps, the car is knocked sideways and must
// be caught, never a crash), then sinks back under. Once per bridge per pass. Grey helmet hood with a curved horn, white bulb eyes on stalks, a silver mouth,
// a yellow-green ribbed chest, grey plated scaly limbs, red-brown claw tips.
function beetleBuild(B=BTL){const g=new THREE.Group(),UP=new THREE.Vector3(0,1,0),V1=new THREE.Vector3(),M4=new THREE.Matrix4(),Q=new THREE.Quaternion(),S1=new THREE.Vector3(),v3=(x,y,z)=>new THREE.Vector3(x,y,z);
  const gry=std({color:0x80858a,roughness:.72,flatShading:true}),gdk=std({color:0x5b5f64,roughness:.8,flatShading:true}),hoodM=std({color:0x878b90,roughness:.6,side:THREE.DoubleSide}),grn=std({color:0xb4b238,roughness:.5}),rib=std({color:0x77781c,roughness:.6}),
    red=std({color:0x6e2a20,roughness:.45}),wht=std({color:0xf6f4ec,roughness:.25,emissive:0x2a2a28}),sil=std({color:0x8e9399,metalness:.85,roughness:.3}),blk=std({color:0x1c1d20,roughness:.6});
  const sph=(p,r,sx,sy,sz,x,y,z,m,ws=12,hs=9)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(r,ws,hs),m);o.scale.set(sx,sy,sz);o.position.set(x,y,z);p.add(o);return o;};
  const seg=(p,a,b,r0,r1,m,n=8)=>{const c=new THREE.Mesh(cyl(r1,r0,a.distanceTo(b),n),m);c.position.copy(a).add(b).multiplyScalar(.5);c.quaternion.setFromUnitVectors(UP,V1.copy(b).sub(a).normalize());p.add(c);return c;};
  const scG=new THREE.ConeGeometry(.24,.55,4);   // one overlapping scale: a little four-sided spike lying on the limb, its tip hanging down towards the hand or foot
  const scales=(p,L)=>{const im=new THREE.InstancedMesh(scG,gry,L.length);L.forEach(([pos,dir],k)=>{Q.setFromUnitVectors(UP,dir);S1.set(1,1,1);M4.compose(pos,Q,S1);im.setMatrixAt(k,M4);});p.add(im);};
  const limb=(L,a,b,r,rings,per)=>{const ax=b.clone().sub(a).normalize(),t1=new THREE.Vector3().crossVectors(ax,Math.abs(ax.y)<.9?UP:v3(1,0,0)).normalize(),t2=new THREE.Vector3().crossVectors(ax,t1);
    for(let k=0;k<rings;k++){const u=(k+.5)/rings;for(let j=0;j<per;j++){const th=(j+(k%2)*.5)/per*Math.PI*2,n=t1.clone().multiplyScalar(Math.cos(th)).addScaledVector(t2,Math.sin(th));L.push([a.clone().lerp(b,u).addScaledVector(n,r),ax.clone().addScaledVector(n,.55).normalize()]);}}};
  // legs, planted wide and bent: scaly thighs and shins, knee plates, clawed feet with red-brown toes
  B.LG=[];for(const sx of[-1,1]){const hip=v3(sx*.62,3,0),kn=v3(sx*.8,1.65,.32),an=v3(sx*.72,.42,0),LP=new THREE.Group(),q=new THREE.Group(),LG=[];LP.position.copy(hip);q.position.copy(hip).negate();LP.add(q);g.add(LP);B.LG.push(LP);   // each leg hangs from a pivot at the hip, so it can step
    seg(q,hip,kn,.6,.5,gdk);seg(q,kn,an,.5,.4,gdk);sph(q,.5,1,.9,1,kn.x,kn.y,kn.z+.08,gry,8,6);limb(LG,hip,kn,.56,3,7);limb(LG,kn,an,.47,3,6);
    LP.ft=sph(q,.46,1.05,.5,1.5,an.x,.25,.22,gdk,10,6);for(const tx of[-.26,0,.26])seg(q,v3(an.x+tx,.22,.78),v3(an.x+tx*1.35,.04,1.2),.14,.02,red,5);scales(q,LG);}
  sph(g,.95,1.15,.62,.85,0,3.1,0,gdk,10,7);   // the hips
  // the hunched trunk: a plated grey back, the ribbed yellow-green chest and belly in front
  const T=new THREE.Group();T.position.set(0,3.15,0);T.rotation.x=.38;g.add(T);B.T=T;
  sph(T,1.25,1.12,1.45,.85,0,1.55,-.22,gry,12,9);sph(T,1.2,.98,1.38,.72,0,1.5,.12,grn,16,12);
  for(let k=0;k<6;k++){const y=.5+k*.36,rx=1.16*Math.sqrt(Math.max(.05,1-((y-1.5)/1.66)**2)),tr=new THREE.Mesh(new THREE.TorusGeometry(rx,.05,4,16,Math.PI*.8),rib);tr.position.set(0,y,.12);tr.rotation.set(Math.PI/2,0,Math.PI*.1);tr.scale.set(1,.74,1);T.add(tr);}
  {const gv=new THREE.Mesh(new THREE.BoxGeometry(.07,2.1,.1),rib);gv.position.set(0,1.45,.98);gv.rotation.x=.05;T.add(gv);}   // the groove down the middle
  const SH=[];for(const sx of[-1,1]){sph(T,.62,1.1,.85,1,sx*1.3,2.58,-.05,gry,10,7);limb(SH,v3(sx*1.05,3.05,-.05),v3(sx*1.55,2.2,-.05),.5,2,7);}scales(T,SH);   // plated shoulders
  // the head: a helmet hood with its rim jutting out over the face, a curved horn, bulb eyes on stalks, a dark silver mouth
  const H=new THREE.Group();H.position.set(0,3.05,.55);H.rotation.x=-.32;T.add(H);B.H=H;
  const hood=new THREE.Mesh(new THREE.SphereGeometry(1.2,16,10,0,Math.PI*2,0,Math.PI*.56),hoodM);hood.scale.set(1.12,.85,1.3);hood.rotation.x=.38;H.add(hood);
  sph(H,.58,1.15,.8,.9,0,-.38,.55,sil,12,8);sph(H,.42,1,.55,.6,0,-.62,.78,blk,10,6);
  for(let k=0;k<5;k++){const tt=new THREE.Mesh(new THREE.ConeGeometry(.06,.2,4),wht);tt.position.set((k-2)*.15,-.42,1.08-Math.abs(k-2)*.05);tt.rotation.x=Math.PI;H.add(tt);}
  for(let k=0;k<3;k++){const bx=new THREE.Mesh(new THREE.BoxGeometry(.75-k*.12,.04,.06),blk);bx.position.set(0,-.2-k*.13,1.02-k*.03);H.add(bx);}   // the grille of the mouth
  for(const sx of[-1,1]){const a=v3(sx*.42,0,1.1),b=v3(sx*.6,.42,1.32);seg(H,a,b,.07,.05,gdk,5);sph(H,.17,1,1,1,b.x,b.y,b.z,wht,10,7);}
  {const hn=new THREE.Mesh(new THREE.TorusGeometry(.78,.17,6,12,Math.PI*.5),gry);hn.position.set(0,.95,.48);hn.rotation.set(0,-Math.PI/2,Math.PI/2);H.add(hn);
    const tip=new THREE.Mesh(new THREE.ConeGeometry(.17,.5,6),gry);tip.position.set(0,1.73,.64);tip.rotation.x=Math.PI/2*.85;H.add(tip);}
  // the claw arm: scaly upper arm and a heavy forearm ending in a great hooked pincer; it pivots at the shoulder, hanging along -y
  const A=new THREE.Group();A.position.set(-1.38,2.55,.05);T.add(A);B.A=A;const e1=v3(0,-1.8,0),e2=v3(0,-3.2,0),AL=[];
  seg(A,v3(0,0,0),e1,.38,.34,gdk);sph(A,.42,1,1,1,0,-1.8,0,gry,8,6);seg(A,e1,e2,.36,.5,gdk);limb(AL,v3(0,-.4,0),e1,.37,3,6);limb(AL,e1,e2,.45,3,7);scales(A,AL);
  sph(A,.55,1,.8,.9,0,-3.35,0,gry,10,7);
  {const big=new THREE.Mesh(new THREE.TorusGeometry(.78,.3,7,14,Math.PI*1.4),gry);big.position.set(0,-4.1,0);big.rotation.z=Math.PI/2;A.add(big);   // the hook: down and curling back up
    const tp=new THREE.Mesh(new THREE.ConeGeometry(.3,.6,7),gry);tp.position.set(.72,-3.55,0);tp.rotation.z=-.5;A.add(tp);
    const sm=new THREE.Mesh(new THREE.TorusGeometry(.45,.19,6,10,Math.PI*.8),gdk);sm.position.set(.35,-4.15,0);sm.rotation.z=-Math.PI*.9;A.add(sm);}   // and the lower jaw of the pincer
  B.armL=5;   // shoulder to the bottom of the hook, in model units
  // the other arm: hanging forward, bent, a clawed hand with red-brown fingertips
  const A2=new THREE.Group();A2.position.set(1.38,2.55,.05);A2.rotation.set(-.55,0,.32);T.add(A2);B.A2=A2;const f1=v3(0,-1.7,0),f2=v3(0,-2.6,.95),A2L=[];
  seg(A2,v3(0,0,0),f1,.36,.32,gdk);sph(A2,.38,1,1,1,f1.x,f1.y,f1.z,gry,8,6);seg(A2,f1,f2,.33,.28,gdk);limb(A2L,v3(0,-.4,0),f1,.35,3,6);limb(A2L,f1,f2,.32,2,6);scales(A2,A2L);
  sph(A2,.34,1,.8,1.1,f2.x,f2.y-.1,f2.z+.15,gdk,8,6);
  for(let k=0;k<4;k++){const a=v3(-.24+k*.16,f2.y-.15,f2.z+.35),m=v3(-.32+k*.21,f2.y-.5,f2.z+.7),tp=v3(-.33+k*.22,f2.y-.95,f2.z+.72);seg(A2,a,m,.08,.07,gdk,5);seg(A2,m,tp,.07,.015,red,5);}
  B.sc=13.5;g.scale.setScalar(B.sc);g.visible=false;scene.add(g);B.g=g;B.V=new THREE.Vector3();B.W=new THREE.Vector3();B.tg=new THREE.Vector3();B.Q=new THREE.Quaternion();B.v1=new THREE.Vector3();B.v3=new THREE.Vector3();
  B.qr=new THREE.Quaternion().setFromUnitVectors(v3(0,-1,0),v3(-.75,.55,.38).normalize());B.qw=new THREE.Quaternion().setFromUnitVectors(v3(0,-1,0),v3(-.35,.88,-.32).normalize());B.qs=new THREE.Quaternion();A.quaternion.copy(B.qr);
  B.rings=[0,1].map(()=>{const m=new THREE.Mesh(new THREE.RingGeometry(.86,1,48).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xeef4f6,transparent:true,opacity:0,depthWrite:false}));m.visible=false;scene.add(m);return m;});}
function beetleStart(k,big){const B=BTL,pe=ents.find(e=>e.player);if(!pe)return;if(!B.g)beetleBuild();B.on=1;B.armed[k]=0;B.k=k;B.t=0;B.big=big?1:0;B.lead=big?120:170;B.s=pe.s+B.lead;B.n=big?1:Math.random()<.5?2:3;B.hj=-1;B.sj=-1;B.st=null;B.pa=0;B.roar=0;
  let sd=Math.random()<.5?-1:1;at(pe.s+150,sd*60,0,B.V);if(Terrain.landAt(B.V.x,B.V.z)>=.2)sd=-sd;B.sd=sd;B.rt=[0,1.6];sfxBigSplash();G.shake=Math.max(G.shake,.4);}
function beetleOff(){const B=BTL;B.on=0;if(B.g){B.g.visible=false;for(const r of B.rings)r.visible=false;}}
function beetleTick(rdt){const B=BTL;if(!DRIVE||!Z.rb1)return;const pe=ents.find(e=>e.player);if(!pe)return;beetleShake(rdt);const i=PL.idx,m_=x=>Math.round(x/SEG);
  const BR=[['bb',Z.b0,Z.b1],['gg',Z.gg0,Z.gg1],['rb',Z.rb0,Z.rb1]];for(const[k,a,b]of BR)if(i<a-m_(400)||i>b)B.armed[k]=1;   // ready again for the next pass
  if(!B.on&&G.state==='race'&&!PL.crash&&zoneArr[i]===4&&!SAFEZ()){const br=BR.find(([k,a,b])=>B.armed[k]&&i>=a&&i<Math.min(b,a+m_(160)));if(br)beetleStart(br[0]);}
  if(!B.on)return;if(G.state!=='race'){beetleOff();return;}
  B.t+=rdt;const t=B.t,V=B.V,g=B.g;
  if(B.st==null&&(zoneArr[i]!==4||PL.crash))B.st=t;   // off the bridge (or wrecked): he goes back under
  if(B.st==null){B.lead=lerp(B.lead,B.big?70:90,clamp(rdt*.4,0,1));B.s=lerp(B.s,pe.s+B.lead,clamp(rdt*1.5,0,1));}   // he wades along beside you, a little ahead
  const t7=B.big?4.5:7,rise=B.st==null?sst(t,0,t7-.5):1-sst(t-B.st,0,5),bob=Math.sin(t*1.6)*.8;   // coming back for the big blow, he surges up faster
  at(B.s,B.sd*60,0,V);const n=Nn[wrapI(Math.floor(B.s/SEG))];g.position.set(V.x,BTL.wat-112+109*rise+bob,V.z);g.rotation.set(0,Math.atan2(-B.sd*n.x,-B.sd*n.z),Math.sin(t*.8)*.04);
  B.T.rotation.x=.38+Math.sin(t*1.3)*.03;B.H.rotation.y=Math.sin(t*.6)*.12;B.A2.rotation.x=-.55+Math.sin(t*1.1)*.12;g.visible=true;g.updateMatrixWorld(true);
  // the claw: wind up high, then slam down onto the deck
  let striking=false;if(B.st==null&&t>=t7){const u0=t-t7,j=Math.floor(u0/2.6);
    if(j>=B.n)B.st=t;else{const u=u0-j*2.6,A=B.A;striking=true;
      if(u<1.1)A.quaternion.slerpQuaternions(B.qr,B.qw,sst(u,0,1.1));
      else{if(B.sj!==j){B.sj=j;at(pe.s+(B.big?Math.max(34,pe.v*.9+24):Math.max(22,pe.v*.9+12)),B.sd*6.5,.3,B.tg);}if(u<1.9){B.T.getWorldQuaternion(B.Q).invert();A.getWorldPosition(B.W);const d=B.W.distanceTo(B.tg);B.W.subVectors(B.tg,B.W).normalize().applyQuaternion(B.Q);B.qs.setFromUnitVectors(B.v1.set(0,-1,0),B.W);B.ak=clamp(d/(B.armL*B.sc),.75,1.5);}
        const k=u<1.45?((u-1.1)/.35)**2:u<1.9?1:1-sst(u,1.9,2.6);
        if(u<1.45)A.quaternion.slerpQuaternions(B.qw,B.qs,k);else if(u<1.9)A.quaternion.copy(B.qs);else A.quaternion.slerpQuaternions(B.qr,B.qs,k);
        A.scale.setScalar(lerp(1,B.ak,u<1.45?k:u<1.9?1:k));
        if(u>=1.45&&B.hj!==j){B.hj=j;(B.big?beetleBigHit:beetleHit)(B.tg);}}}}
  if(!striking){B.A.quaternion.slerp(B.qr,clamp(rdt*2,0,1));B.A.scale.setScalar(lerp(B.A.scale.x,1,clamp(rdt*3,0,1)));}
  // water: spray at the waterline and white water streaming off him while he rises and sinks; a ring of waves
  const top=g.position.y+7.5*B.sc,cd=camera.position.distanceTo(g.position),wet=B.st==null?t<t7+1.5:t-B.st<5.5;
  if(wet&&cd<1100){B.pa+=rdt*34;NOGY=1;while(B.pa>=1){B.pa--;const a=R(0,6.283),r=R(12,30);
      puff(V.set(g.position.x+Math.cos(a)*r,BTL.wat+.5,g.position.z+Math.sin(a)*r),Math.cos(a)*R(2,6),R(6,18),Math.sin(a)*R(2,6),R(4,8),R(12,22),R(1.5,2.6),.7,0xeef2f4);
      if(top>BTL.wat+8&&Math.random()<.6)puff(V.set(g.position.x+R(-13,13),R(BTL.wat+4,top-8),g.position.z+R(-10,10)),R(-1,1),R(-16,-7),R(-1,1),R(2,4),R(5,9),R(1,1.8),.55,0xdfe8ee);}NOGY=0;}
  if(B.st!=null&&!B.rs){B.rs=1;B.rt=[t,t+1.4];}
  B.rings.forEach((m,k)=>{const u=(t-B.rt[k])/4.5;m.visible=u>=0&&u<1;if(m.visible){m.position.set(g.position.x,BTL.wat+.4,g.position.z);m.scale.setScalar(30+170*u);m.material.opacity=.65*(1-u);}});
  if(!B.roar&&t>2.6){B.roar=1;sfxBeetleRoar(clamp(260/(cd+60),.35,1));say('THE BEETLE !',B.big?'HE COMES BACK ROUND':'RISING FROM THE BAY',2.2);}
  if(B.st!=null&&t-B.st>5.3){beetleOff();B.rs=0;if(B.k==="bb"&&!PL.crash&&!B.big)B.ub={n:2,cd:R(2,3.5)};B.big=0;}}   // on the Bay Bridge he comes back unseen: his head bumps the underside of the deck
function beetleShake(rdt){const B=BTL;   // after a hit: the bridge shakes (a drop, then a decaying sway, the towers rocking), and the car weaves for a couple of seconds
  if(B.ub){const i=PL.idx;if(G.state!=="race"||PL.crash||B.on||i<Z.b0||i>Z.b1)B.ub=null;else if((B.ub.cd-=rdt)<=0){beetleUnder();B.ub.cd=R(3,4.5);if(--B.ub.n<=0){B.ub=null;B.bigCd=R(1.5,2.5);}}}
  if(B.bigCd>0){const i=PL.idx;if(G.state!=="race"||PL.crash||B.on||i<Z.b0||i>Z.b1)B.bigCd=0;else if((B.bigCd-=rdt)<=0){B.bigCd=0;beetleStart("bb",1);}}   // after the second thud he comes back round for one huge blow
  if(B.pb){B.pbT+=rdt;if(PL.crash||B.pbT>4)B.pb=0;else if(!PL.air&&B.pbT>.3){B.pb=0;PL.air=1;PL.vy=R(4.5,5.5);PL.safe=Math.max(PL.safe,2);}}   // the car bounces once more off the deck
  if(B.bsA>0){B.bsT+=rdt;const t=B.bsT,a=B.bsA*Math.exp(-t*1.5),L=B.br[B.k]||[],n=B.bn;
    if(a<.012||t>(B.bsA>1.2?4.5:3)){for(const[o,p,rz]of L){o.position.copy(p);o.rotation.z=rz;}B.bsA=0;}
    else{const sx=a*1.6*Math.sin(t*13.8),sy=a*(1.0*Math.sin(t*19.5+1)+(B.bup?1.8:-1.4)*Math.exp(-t*9)),tz=a*.012*Math.sin(t*9.4);for(const[o,p,rz]of L){o.position.set(p.x+n.x*sx,p.y+sy,p.z+n.z*sx);if(o.isGroup)o.rotation.z=rz+tz;}G.shake=Math.max(G.shake,a*1.4);}}
  if(B.wv>0){B.wt+=rdt;const t=B.wt;if(t>2.1||PL.crash||zoneArr[PL.idx]!==4){B.wv=0;return;}
    const o=Math.sin(t*Math.PI*2*1.35)*Math.exp(-t*1.0)*B.wsd*B.wv,n=Nn[PL.idx];VS.r+=o*1.6*rdt;PL.vx+=n.x*o*9*rdt;PL.vz+=n.z*o*9*rdt;PL.safe=Math.max(PL.safe,1.2);}}
function beetleUnder(){const B=BTL,pe=ents.find(e=>e.player);if(!pe)return;   // a thud from below: the deck jolts up, shakes briefly, the car weaves a little; he stays out of sight, only the water swirls by a pier
  B.bsA=.6;B.bsT=0;B.bup=1;B.bn=Nn[PL.idx];G.shake=Math.max(G.shake,1.3);B.wv=.45;B.wt=0;B.wsd=Math.random()<.5?-1:1;PL.safe=Math.max(PL.safe,2.5);sfxUnderThud();say("THUD !","SOMETHING UNDER THE BRIDGE",1.6);
  const sd=Math.random()<.5?-1:1,v=new THREE.Vector3(),c=at(pe.s+R(15,35),sd*R(14,24),0).clone();NOGY=1;for(let q=0;q<26;q++){const a=R(0,6.283),r=R(1,7);puff(v.set(c.x+Math.cos(a)*r,B.wat+.3,c.z+Math.sin(a)*r),-Math.sin(a)*R(2,4),R(1,4),Math.cos(a)*R(2,4),R(1,2),R(3,6),R(1.5,2.8),.6,0xeef2f4);}NOGY=0;}
function sfxUnderThud(){if(!AC)return;const t=AC.currentTime;tone("sine",42,t,1.1,1.3,master,{to:24,h:.15});hit(t,.9,1.1,110,"lowpass",master);hit(t+.05,.5,.4,60,"lowpass",master);}
function beetleHit(p){const d=camera.position.distanceTo(p),near=clamp(140/(d+40),.3,1);G.shake=Math.max(G.shake,1.6*near);PL.bump=Math.max(PL.bump||0,1.3*near);sfxBeetleHit(near);
  NOGY=1;for(let q=0;q<26;q++){const a=R(0,6.283),sp=R(2,9);puff(BTL.v3.set(p.x+R(-3,3),p.y+.5,p.z+R(-3,3)),Math.cos(a)*sp,R(3,12),Math.sin(a)*sp,R(1.5,3),R(6,11),R(1.2,2.2),.6,0x9a958e);}
  for(let q=0;q<24;q++)spark(BTL.v3.set(p.x,p.y+.4,p.z),R(-12,12),R(3,12),R(-12,12));NOGY=0;
  if(zoneArr[PL.idx]===4&&!SAFEZ()&&!PL.crash&&near>.3){const n=Nn[PL.idx],k=-BTL.sd*R(2.5,3.5)*near;PL.vx+=n.x*k;PL.vz+=n.z*k;VS.r+=R(.12,.22)*(Math.random()<.5?-1:1)*near;PL.safe=Math.max(PL.safe,2.5);BTL.wv=near;BTL.wt=0;BTL.wsd=-BTL.sd;}   // knocked sideways, then the car snakes left and right: fight it (the rail holds, never a crash)
  BTL.bsA=1;BTL.bsT=0;BTL.bup=0;BTL.bn=Nn[PL.idx];G.shake=Math.max(G.shake,2.2*near);   // the whole bridge jolts down and sways: rails, underside, piers, trusses, towers and cables
  const cr=beetleCrush(p);say('THE BEETLE STRIKES !',cr?'HE CRUSHES THE TRAFFIC':'CATCH THE SWERVE',1.8);}
function beetleBigHit(p){const B=BTL;G.shake=Math.max(G.shake,3.6);PL.bump=Math.max(PL.bump||0,2);LT.flash=1;sfxBeetleSlam();   // the one huge blow: a boom and crunch, a flash, the bridge heaves, and every vehicle nearby is thrown into the air
  NOGY=1;for(let q=0;q<60;q++){const a=R(0,6.283),sp=R(3,16);puff(B.v3.set(p.x+R(-5,5),p.y+.5,p.z+R(-5,5)),Math.cos(a)*sp,R(4,20),Math.sin(a)*sp,R(2,4.5),R(9,18),R(1.4,2.8),.65,0x9a958e);}
  for(let q=0;q<70;q++)spark(B.v3.set(p.x+R(-2,2),p.y+.4,p.z+R(-2,2)),R(-20,20),R(4,22),R(-20,20));NOGY=0;
  B.bsA=1.6;B.bsT=0;B.bup=0;B.bn=Nn[PL.idx];
  if(zoneArr[PL.idx]===4&&!PL.crash){const d=Math.hypot(PL.x-p.x,PL.z-p.z),k=clamp(1-d/120,.35,1);PL.air=1;PL.vy=Math.max(PL.vy||0,8+4*k);PL.safe=Math.max(PL.safe,4);B.pb=1;B.pbT=0;B.wv=.5;B.wt=0;B.wsd=-B.sd;}   // the player's car is flung up and bounces (the landing never wrecks it)
  for(const t of TRAF){if(!t.act||t.fall||t.cr||!t.g.visible)continue;const d=Math.hypot(t.g.position.x-p.x,t.g.position.z-p.z);if(d>150)continue;const k=clamp(1-d/150,.3,1);
    t.jp={y:0,vy:(5+7*k)*R(.85,1.1),b:Math.random()<.5?1:2,rx:R(-.18,.18)*k,rz:R(-.25,.25)*k,ry:R(-.3,.3)*k};}
  say('CRASH !','THE WHOLE BRIDGE JUMPS',2.2);}
function beetleJump(t,dt){const J=t.jp;J.vy-=24*dt;J.y+=J.vy*dt;   // a vehicle thrown up by the big blow: it flies, lands, bounces once or twice, then drives on
  if(J.y<=0){J.y=0;if(J.b>0&&J.vy<-3){J.b--;J.vy*=-.38;J.rx*=-.5;J.rz*=-.5;J.ry*=.5;const q=t.g.position;NOGY=1;for(let k=0;k<6;k++)puff(V.set(q.x+R(-1.5,1.5),q.y+.2,q.z+R(-1.5,1.5)),R(-2,2),R(.5,2),R(-2,2),R(.6,1.2),R(2,4),R(.8,1.4),.5,0x9a958e);NOGY=0;if((q.x-PL.x)**2+(q.z-PL.z)**2<3600)sfxThump(.5);}else{t.jp=null;return;}}
  const f=clamp(J.y/1.5,0,1);t.g.position.y+=J.y;t.g.rotation.x+=J.rx*f;t.g.rotation.z+=J.rz*f;t.g.rotation.y+=J.ry*f;}
function sfxBeetleSlam(){if(!AC)return;const t=AC.currentTime;sfxBeetleHit(1);tone('sine',34,t,2.6,2,master,{to:14,h:.25});hit(t,2.2,1.8,140,'lowpass',master);hit(t+.04,.6,.9,1600,'bandpass',master);sfxCrunch(1.6);setTimeout(()=>{sfxCrunch(1.1);sfxScrape(.8);},140);setTimeout(()=>sfxCrunch(.7),330);}
function beetleCrush(p){let n=0;   // any traffic under the claw is flattened into a crumpled wreck (a tanker goes up); never the player's car
  for(const t of TRAF){if(!t.act||t.fall||t.cr||!t.g.visible)continue;const dx=t.g.position.x-p.x,dz=t.g.position.z-p.z;if(dx*dx+dz*dz>20*20)continue;n++;
    if(t.kind==='tanker'){tankerBoom(t);continue;}
    t.cr={t:0,y:t.g.position.y};t.v=0;t.dead=t.stop=1;t.sk=0;t.kv=0;t.wob=0;t.ob.x=1e9;t.g.rotation.z+=R(-.18,.18);t.g.rotation.x+=R(-.1,.1);for(const wh of t.g.wh)wh.visible=Math.random()<.5;
    const q=t.g.position;NOGY=1;for(let k=0;k<18;k++)spark(V.set(q.x,q.y+.8,q.z),R(-9,9),R(2,10),R(-9,9));for(let k=0;k<10;k++){const a=R(0,6.283),sp=R(2,7);puff(V.set(q.x,q.y+.6,q.z),Math.cos(a)*sp,R(3,9),Math.sin(a)*sp,R(.3,.7),R(1.5,3),R(.8,1.6),.9,k%2?0x2a2a2c:0x6a6a6e);}NOGY=0;}
  if(n){sfxCrunch(1.3);setTimeout(()=>sfxCrunch(.8),120);sfxScrape(.7);}return n;}
// THE ONE-EYED MONSTER: on I-880 north, out to the LEFT among the rail yard and the port (some 300-370 m off the road, so he stands high over the freeway barrier),
// a giant one-eyed monster about 70 m tall stomps about. A wide flat dark head-and-body with one huge white eye, two horns with a little eye at the foot of each,
// a bumpy rim, long arms hanging down to clawed hands, short thick legs on clawed feet. Every heavy step thuds, shakes the ground and throws up dust; the big eye
// looks around and follows your car as you go by. He never touches the road. Once you are past him he turns up again further ahead (EYEM, eyeMonTick; __test.eyeMon()).
const EYEM={g:null,on:0,s:0,lat:330,h:0,ph:0,t:0,n:-1,said:0};
function eyeMonBuild(M=EYEM){const g=new THREE.Group(),UP=new THREE.Vector3(0,1,0),V1=new THREE.Vector3(),v3=(x,y,z)=>new THREE.Vector3(x,y,z);
  const skin=std({color:0x3e362e,roughness:.85,flatShading:true}),dk=std({color:0x28221c,roughness:.9,flatShading:true}),lt=std({color:0x5e5244,roughness:.8,flatShading:true}),
    wht=std({color:0xf4f2ea,roughness:.2,emissive:0x3a3a36}),blk=std({color:0x0b0a09,roughness:.3}),cl=std({color:0x1a1612,roughness:.5});
  const sph=(p,r,sx,sy,sz,x,y,z,m,ws=12,hs=9)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(r,ws,hs),m);o.scale.set(sx,sy,sz);o.position.set(x,y,z);p.add(o);return o;};
  const seg=(p,a,b,r0,r1,m,n=8)=>{const c=new THREE.Mesh(cyl(r1,r0,a.distanceTo(b),n),m);c.position.copy(a).add(b).multiplyScalar(.5);c.quaternion.setFromUnitVectors(UP,V1.copy(b).sub(a).normalize());p.add(c);return c;};
  // legs: short and thick, pivoting at the hip, on broad clawed feet
  M.L=[-1,1].map(sx=>{const L=new THREE.Group();L.position.set(sx*.72,2.5,0);g.add(L);const kn=v3(0,-1.25,.18),an=v3(0,-2.15,0);
    seg(L,v3(0,0,0),kn,.55,.5,skin);sph(L,.5,1,.9,1,kn.x,kn.y,kn.z,dk,8,6);seg(L,kn,an,.5,.44,skin);
    for(let k=0;k<4;k++)sph(L,.13,1,1,1,sx*.2*(k%2?1:-1),-.4-k*.42,.45-Math.abs(k-1.5)*.05,lt,6,5);   // warts down the front
    L.ft=sph(L,.55,1.05,.42,1.35,0,-2.3,.2,dk,10,6);for(const tx of[-.32,0,.32]){const c=new THREE.Mesh(new THREE.ConeGeometry(.12,.45,5),cl);c.position.set(tx,-2.36,.95);c.rotation.x=Math.PI/2;L.add(c);}
    return L;});
  sph(g,.95,1.15,.95,.9,0,3.05,0,skin,12,8);   // the short trunk under the head
  // the head-body: a wide flat dome with a bumpy rim, the great eye in the front, two horns with little eyes at their feet; it turns to look (U)
  const U=new THREE.Group();U.position.set(0,3.4,0);g.add(U);M.U=U;
  sph(U,1,1.95,.9,1.3,0,.95,0,skin,18,12);sph(U,1,1.75,.55,1.15,0,1.45,-.05,dk,16,10);
  {const rim=new THREE.Mesh(new THREE.TorusGeometry(1.88,.2,6,28),dk);rim.rotation.x=Math.PI/2;rim.scale.set(1,.68,1);rim.position.y=.9;U.add(rim);}
  for(let k=0;k<26;k++){const a=k/26*Math.PI*2;sph(U,R(.12,.2),1,1,1,Math.cos(a)*1.8,1.05+R(0,.12),Math.sin(a)*1.22,lt,6,5);}   // the bumps round the rim
  for(let k=0;k<14;k++){const a=R(0,Math.PI*2),r=R(.3,1.3);sph(U,R(.1,.16),1,1,1,Math.cos(a)*r,1.62+R(-.05,.08)-r*.1,Math.sin(a)*r*.7-.1,lt,6,5);}   // and over the crown
  const E=new THREE.Group();E.position.set(0,.95,1.08);U.add(E);M.E=E;
  sph(E,.74,1,1,.6,0,0,0,wht,20,14);sph(E,.36,1,1,.45,0,0,.4,blk,16,10);
  {const lid=new THREE.Mesh(new THREE.TorusGeometry(.76,.16,8,24),dk);lid.position.set(0,.97,1.2);lid.scale.set(1.08,1,1);U.add(lid);}
  sph(U,.5,2.1,.35,.6,0,1.78,.82,dk,10,6);   // the heavy brow over the eye
  for(const sx of[-1,1]){const h=new THREE.Mesh(new THREE.ConeGeometry(.3,1.25,7),skin);h.position.set(sx*1.32,1.95,.15);h.rotation.set(-.1,0,-sx*.45);U.add(h);
    for(let k=0;k<3;k++)sph(U,.08,1,1,1,sx*(1.2+k*.13),1.65+k*.3,.38,lt,5,4);
    sph(U,.15,1,1,1,sx*1.02,1.5,.82,wht,10,8);sph(U,.07,1,1,1,sx*1.04,1.5,.95,blk,8,6);}   // the little eye at the foot of each horn
  // the arms: hanging long from under the rim, swinging as he walks, ending in clawed hands
  M.A=[-1,1].map(sx=>{const A=new THREE.Group();A.position.set(sx*1.5,.45,0);U.add(A);const el=v3(sx*.2,-1.5,.15),wr=v3(sx*.32,-2.85,.3);
    seg(A,v3(0,0,0),el,.32,.28,skin);sph(A,.3,1,1,1,el.x,el.y,el.z,dk,8,6);seg(A,el,wr,.28,.24,skin);sph(A,.3,1,1.1,.9,wr.x,wr.y-.1,wr.z,dk,8,6);
    for(let k=0;k<3;k++){const a=v3(wr.x+(k-1)*.14,wr.y-.3,wr.z+.05),b=v3(wr.x+(k-1)*.22,wr.y-.85,wr.z+.25);seg(A,a,b,.09,.02,cl,5);}
    A.rotation.z=sx*.12;return A;});
  M.sc=12;g.scale.setScalar(M.sc);g.visible=false;scene.add(g);M.g=g;M.V=new THREE.Vector3();M.W=new THREE.Vector3();M.F=new THREE.Vector3();}
function eyeMonPlace(ahead){const M=EYEM,pe=ents.find(e=>e.player);if(!pe)return;if(!M.g)eyeMonBuild();M.on=1;M.s=pe.s+ahead;M.lat=R(300,360);M.dir=Math.random()<.6?Math.PI:0;M.h=M.dir;M.t=0;M.n=-1;}
function sfxEyeStomp(k){if(!AC)return;const t=AC.currentTime;tone('sine',50,t,1,1.3*k,master,{to:22});hit(t,.8,1.1*k,150,'lowpass',master);hit(t,.15,.3*k,700,'lowpass',master);}
function eyeMonTick(rdt){const M=EYEM;if(!DRIVE||!Z.toll)return;const pe=ents.find(e=>e.player);if(!pe)return;const i=PL.idx,m_=x=>Math.round(x/SEG);
  const zone=G.state==='race'&&i>Z.tu1+m_(100)&&i<Z.toll-m_(60);
  if(!zone){if(M.on){M.on=0;M.g.visible=false;}if(i<Z.tu1||i>Z.toll)M.said=0;return;}
  if(!M.on)eyeMonPlace(R(850,950));
  else if(pe.s-M.s>260&&pe.s+900<Z.toll*SEG)eyeMonPlace(R(850,950));   // gone by: he turns up again further ahead, out in the fog
  M.t+=rdt;const t=M.t,g=M.g,sc=M.sc;
  // walking: slow heavy strides, mostly along the road, wandering in and out a little but never nearer than ~280 m
  M.ph+=rdt*2.3;const sg=Math.cos(M.dir),hT=M.dir+sg*(Math.sin(t*.23)*.5+clamp((330-M.lat)/60,-1,1)*.6);M.h+=clamp(hT-M.h,-1,1)*rdt*.6;
  const v=6.5*(.6+.4*Math.abs(Math.sin(M.ph)));M.s+=Math.cos(M.h)*v*rdt;M.lat=Math.max(280,M.lat+Math.sin(M.h)*v*rdt);
  const V=M.V;at(M.s,M.lat,0,V);const j=wrapI(Math.floor(M.s/SEG)),n=Nn[j],a=P[j],b=P[wrapI(j+1)],tl=Math.hypot(b.x-a.x,b.z-a.z)||1,tx=(b.x-a.x)/tl,tz=(b.z-a.z)/tl;
  const dx=tx*Math.cos(M.h)+n.x*Math.sin(M.h),dz=tz*Math.cos(M.h)+n.z*Math.sin(M.h),gy=groundAt(V.x,V.z);
  g.position.set(V.x,gy-sc*.18*Math.abs(Math.cos(M.ph)),V.z);g.rotation.set(0,Math.atan2(dx,dz),Math.sin(M.ph)*.06);
  M.L.forEach((L,k)=>{const q=M.ph+k*Math.PI;L.rotation.x=-Math.sin(q)*.38;L.position.y=2.5+Math.max(0,Math.cos(q))*.45;});
  M.A.forEach((A,k)=>{A.rotation.x=Math.sin(M.ph+k*Math.PI)*.3;});
  // the eye: it looks about, and when you come near it turns and follows the car
  g.visible=true;g.updateMatrixWorld(true);const cam=camera.position,W=M.W.copy(cam);g.worldToLocal(W);const cd=cam.distanceTo(g.position);
  const near=cd<800,hy=near?clamp(Math.atan2(W.x,W.z),-1.3,1.3):Math.sin(t*.45)*.9,U=M.U;U.rotation.y+=(hy-U.rotation.y)*clamp(rdt*1.6,0,1);U.rotation.z=Math.sin(M.ph)*-.05;
  const ey=near?clamp(Math.atan2(W.x,W.z)-U.rotation.y,-.4,.4):Math.sin(t*1.3)*.3,ep=near?clamp(Math.atan2(4.35*sc-W.y*sc,Math.hypot(W.x,W.z)*sc)*.9,-.2,.5):.15+Math.sin(t*.9)*.1;
  M.E.rotation.y+=(ey-M.E.rotation.y)*clamp(rdt*4,0,1);M.E.rotation.x+=(ep-M.E.rotation.x)*clamp(rdt*4,0,1);
  if(!M.said&&cd<700){M.said=1;say('THE EYE !','STOMPING THROUGH THE RAIL YARD',2.2);}
  // a footfall each time a foot comes down: a deep thud, the ground shakes, dust flies
  const st=Math.floor((M.ph-Math.PI/2)/Math.PI);if(st!==M.n){const first=M.n<0;M.n=st;if(!first){const L=M.L[((st%2)+2)%2],F=L.ft.getWorldPosition(M.F),k=clamp(260/(cd+60),.12,1);
      sfxEyeStomp(k);G.shake=Math.max(G.shake,.55*k);
      if(cd<1000){NOGY=1;for(let q=0;q<16;q++){const a=R(0,6.283),sp=R(5,12);puff(V.set(F.x+Math.cos(a)*R(2,8),F.y+.5,F.z+Math.sin(a)*R(2,8)),Math.cos(a)*sp,R(2,7),Math.sin(a)*sp,R(4,7),R(14,26),R(1.6,2.8),.6,0x9a8c74);}NOGY=0;}}}}
// THE DADDY BEETLE: on Shane Drive in Richmond, far off across the open land (some 300 m from the road), the daddy of the beetle in the bay: the same beetle, half as big again
// (some 150 m tall) and a little darker and older. He stomps slowly about, swaying, arms swinging; every heavy footfall is a deep thud that shakes the ground and kicks up a
// big cloud of dust. His head turns to watch your car, and now and then he roars. He never comes near the road. Once you are past him he turns up again further ahead (DADB, dadBeetleTick; __test.dadBeetle()).
const DADB={g:null,on:0,s:0,lat:-360,sd:-1,h:0,ph:0,t:0,n:-1,said:0,rc:6};
function dadBeetleBuild(){const D=DADB;beetleBuild(D);const mm=new Map();D.g.traverse(o=>{if(o.material){let m=mm.get(o.material);if(!m){m=o.material.clone();m.color.multiplyScalar(.75);m.fog=false;m.userData.c0=m.color.clone();m.userData.e0=m.emissive.clone();mm.set(o.material,m);}o.material=m;}});D.mats=[...mm.values()];   // his own gentler haze (below), so he still looms through rain and fog
  for(const r of D.rings)scene.remove(r);D.sc=20;D.g.scale.setScalar(D.sc);D.ar=D.A.rotation.clone();D.F=new THREE.Vector3();}
function dadBeetlePlace(ahead){const D=DADB,pe=ents.find(e=>e.player);if(!pe)return;if(!D.g)dadBeetleBuild();D.on=1;D.s=pe.s+ahead;const an=sd=>{at(D.s,sd*350,0,D.V);return Math.abs(Math.atan2(Math.sin(Math.atan2(D.V.x-PL.x,D.V.z-PL.z)-PL.h),Math.cos(Math.atan2(D.V.x-PL.x,D.V.z-PL.z)-PL.h)));};D.sd=an(-1)<an(1)?-1:1;D.lat=D.sd*R(300,330);   // on whichever side the road ahead bends towards, so he stands out in front of you
  D.dir=Math.random()<.6?Math.PI:0;D.h=D.dir;D.t=0;D.n=-1;D.rc=R(5,9);}
function dadBeetleTick(rdt){const D=DADB;if(!DRIVE||!Z.shane)return;const pe=ents.find(e=>e.player);if(!pe)return;const i=PL.idx,m_=x=>Math.round(x/SEG);
  const zone=G.state==='race'&&i>Z.shane-m_(260)&&i<Z.refinery+m_(60);
  dadStackTick(rdt);
  if(!zone){if(D.on){D.on=0;D.g.visible=false;}if(i<Z.rb1||i>Z.i80){D.said=0;dadStackReset();}return;}
  if(!D.on)dadBeetlePlace(R(560,640));
  else if(pe.s-D.s>150&&pe.s+500<Z.refinery*SEG)dadBeetlePlace(R(560,640));   // gone by: he turns up again further ahead
  D.t+=rdt;const t=D.t,g=D.g,sc=D.sc,sd=D.sd;
  // walking: slow, heavy strides, mostly along the road, wandering in and out a little but never nearer than 290 m
  D.ph+=rdt*1.5;const hT=D.dir+Math.cos(D.dir)*(Math.sin(t*.2)*.5+clamp((315-sd*D.lat)/50,-1,1)*.6);D.h+=clamp(hT-D.h,-1,1)*rdt*.5;
  const v=6*(.5+.5*Math.abs(Math.sin(D.ph)));D.s+=Math.cos(D.h)*v*rdt;D.lat=sd*Math.max(290,sd*D.lat+Math.sin(D.h)*v*rdt);
  const V=D.V;at(D.s,D.lat,0,V);const j=wrapI(Math.floor(D.s/SEG)),n=Nn[j],a=P[j],b=P[wrapI(j+1)],tl=Math.hypot(b.x-a.x,b.z-a.z)||1,tx=(b.x-a.x)/tl,tz=(b.z-a.z)/tl;
  const dx=tx*Math.cos(D.h)+n.x*sd*Math.sin(D.h),dz=tz*Math.cos(D.h)+n.z*sd*Math.sin(D.h),gh=(x,z)=>Math.max(groundAt(x,z),Terrain.heightAt(x,z)),gy=gh(V.x,V.z);   // the real land out there (the hills), not just the road's
  g.position.set(V.x,gy-sc*2.75*(1-Math.cos(.32*Math.sin(D.ph)))-.5,V.z);   // he dips as his legs swing, so the planted foot stays on the ground
  g.rotation.set(0,Math.atan2(dx,dz),Math.sin(D.ph)*.05);
  D.LG.forEach((L,k)=>{const q=D.ph+k*Math.PI;L.rotation.x=-Math.sin(q)*.32;L.position.y=3+Math.max(0,Math.cos(q))*.4;});
  D.T.rotation.x=.38+Math.sin(D.ph*2)*.04;D.T.rotation.z=Math.sin(D.ph)*.06;
  D.A.rotation.set(D.ar.x+Math.sin(D.ph)*.25,D.ar.y,D.ar.z);D.A2.rotation.set(-.55+Math.sin(D.ph+Math.PI)*.25,0,.32);
  // the head turns to watch your car
  g.visible=true;g.updateMatrixWorld(true);const cam=camera.position,W=D.W.copy(cam);g.worldToLocal(W);const cd=cam.distanceTo(g.position);
  {const f=scene.fog,hz=f&&f.far?clamp((cd-f.near)/(Math.max(f.far,1500)-f.near),0,.8):0;for(const m of D.mats){m.color.copy(m.userData.c0).multiplyScalar(1-hz);m.emissive.copy(m.userData.e0);if(f)m.emissive.lerp(f.color,hz);}}   // faded into the haze with distance, but never quite gone
  const hy=cd<900?clamp(Math.atan2(W.x,W.z),-1.1,1.1):Math.sin(t*.4)*.6;D.H.rotation.y+=(hy-D.H.rotation.y)*clamp(rdt*1.4,0,1);D.H.rotation.x=-.32+Math.sin(D.ph*2)*.04;
  if(!D.said&&cd<900){D.said=1;D.rc=R(1,2);say('THE DADDY BEETLE !','STOMPING ACROSS RICHMOND',2.4);}
  if((D.rc-=rdt)<=0){D.rc=R(9,16);sfxBeetleRoar(clamp(300/(cd+60),.25,.9));}   // now and then a deep roar
  // a footfall each time a foot comes down: a deep thud, the ground shakes, a big cloud of dust
  const st=Math.floor((D.ph-Math.PI/2)/Math.PI);if(st!==D.n){const first=D.n<0;D.n=st;if(!first){const L=D.LG[((st%2)+2)%2],F=L.ft.getWorldPosition(D.F),k=clamp(420/(cd+60),.15,1),fy=gh(F.x,F.z);
      sfxEyeStomp(Math.min(1,k*1.2));G.shake=Math.max(G.shake,1.1*k);PL.bump=Math.max(PL.bump||0,.3*k);   // the ground shakes hard, the car jolts (never a crash)
      if(cd<1400){NOGY=1;for(let q=0;q<34;q++){const a=R(0,6.283),sp=R(8,20);puff(V.set(F.x+Math.cos(a)*R(3,14),fy+1,F.z+Math.sin(a)*R(3,14)),Math.cos(a)*sp,R(3,12),Math.sin(a)*sp,R(10,16),R(40,70),R(2.5,4.5),.65,0x9a8c74);}
        for(let q=0;q<12;q++)puff(V.set(F.x+R(-10,10),fy+R(4,20),F.z+R(-10,10)),R(-3,3),R(12,28),R(-3,3),R(12,20),R(50,90),R(3.5,5.5),.5,0xa89a80);NOGY=0;}   // and a tall column of dust boils up
      for(const s of DSTK)if(!s.st&&i>s.i-m_(650)&&i<s.i+m_(100)){s.n=(s.n||0)+1;s.kick=Math.min(.06,s.kick+.02);}}}}   // each stomp rocks the refinery stacks a little more
// the refinery stacks near the end of Shane Drive: rocked harder by each of the daddy beetle's stomps, then (one, a few stomps later the other) they topple away
// from the road onto the houses beyond, breaking into sections as they hit, with a crash, dust and debris; the houses are crushed flat. Put back for the next pass.
function dadStackTick(rdt){for(const[j,s]of DSTK.entries()){s.t+=rdt;
    if(s.st===0){s.kick*=Math.exp(-.8*rdt);if((s.n||0)>=5+j*3){s.st=1;s.th=Math.max(.04,s.kick);s.w=.05;sfxCrunch(.7);}else{s.g.quaternion.setFromAxisAngle(s.ax,s.kick*Math.sin(s.t*2.4+j));continue;}}
    if(s.st===1){s.w+=1.5*9.8/s.h*Math.sin(s.th)*rdt;s.th+=s.w*rdt;
      if(!s.said){if(!DSTK.some(o=>o.said))say('THE STACKS ARE COMING DOWN !','',2.2);s.said=1;}
      if(s.th>=Math.PI/2-.03){s.th=Math.PI/2-.03;s.st=2;s.t=0;dadStackHit(s);}s.g.quaternion.setFromAxisAngle(s.ax,s.th);continue;}
    if(s.st===2){const k=sst(s.t,0,.5);s.secs.forEach((m,q)=>{const b=s.br[q];m.position.set(b.x*k,s.h/6+q*s.h/3+q*2.2*k,0);m.rotation.set(b.rx*k,0,b.rz*k);});   // the sections break apart and settle
      s.hs.forEach((hh,q)=>{const u=sst(s.t,q*.12,.5+q*.12);hh.scale.y=1-.78*u;hh.rotation.z=(q?.06:-.05)*u;});}}}
function dadStackHit(s){const p=s.g.position,cd=camera.position.distanceTo(p),k=clamp(260/(cd+60),.15,1);sfxCrunch(1.3);sfxEyeStomp(k);setTimeout(()=>sfxCrunch(.9),160);setTimeout(()=>sfxScrape(.8),300);G.shake=Math.max(G.shake,.9*k);
  NOGY=1;for(let q=0;q<46;q++){const u=R(.1,1.05),x=p.x+s.d.x*s.h*u+R(-6,6),z=p.z+s.d.z*s.h*u+R(-6,6),y=groundAt(x,z);puff(V.set(x,y+R(2,14),z),R(-6,6),R(6,20),R(-6,6),R(10,16),R(40,70),R(3.5,6),.7,q%3?0x8a8070:0x4a4642);}
  for(let q=0;q<30;q++){const u=R(.2,1),x=p.x+s.d.x*s.h*u,z=p.z+s.d.z*s.h*u;spark(V.set(x,groundAt(x,z)+2,z),R(-10,10),R(4,14),R(-10,10));}NOGY=0;}
function dadStackReset(){for(const s of DSTK){if(!s.st&&!s.n)continue;s.st=0;s.n=0;s.t=0;s.th=0;s.w=0;s.kick=0;s.said=0;s.g.quaternion.identity();
  s.secs.forEach((m,q)=>{m.position.set(0,s.h/6+q*s.h/3,0);m.rotation.set(0,0,0);});s.hs.forEach(hh=>{hh.scale.y=1;hh.rotation.z=0;});}}
// Bigfoot in the Marin redwoods, from the owner's toy: about 13 m tall (three cars), shaggy warm reddish-brown fur, tan bearded face, long arms, big feet. Once per pass
// he steps out from between the trees right to the edge of the road just ahead, on your side, raises both fists and bangs them down on the car as you go by (a thump,
// a jolt of shake: no crash, no slowing), chases after you for a few seconds (thudding feet, a roar), then gives up: throws his arms up and beats his chest (BIGF, bigfootTick; __test.bigfoot()).
const BIGF={g:null,st:0,armed:1,at:0,s:0,sd:1,lat:14,t:0,t2:0,ph:0,n:-1,said:0,h:0,lean:0,V:new THREE.Vector3(),F:new THREE.Vector3()};
function bigfootBuild(B=BIGF){const g=new THREE.Group(),bd=new THREE.Group(),UP=new THREE.Vector3(0,1,0),V1=new THREE.Vector3(),v3=(x,y,z)=>new THREE.Vector3(x,y,z);g.add(bd);B.bd=bd;
  const fur=std({color:0xa8643a,emissive:0x3a1a0a,roughness:1,flatShading:true}),dk=std({color:0x7e4626,emissive:0x2a1206,roughness:1,flatShading:true}),lt=std({color:0xc8885a,emissive:0x40200e,roughness:1,flatShading:true}),   // warm reddish-brown, so he stands out against the dark redwoods
    skin=std({color:0xd0a078,emissive:0x2a1a10,roughness:.8}),wht=std({color:0xf2eee4,emissive:0x555550,roughness:.3}),blk=std({color:0x0a0806,roughness:.3});
  const sph=(p,r,sx,sy,sz,x,y,z,m,ws=10,hs=8)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(r,ws,hs),m);o.scale.set(sx,sy,sz);o.position.set(x,y,z);p.add(o);return o;};
  const seg=(p,a,b,r0,r1,m,n=8)=>{const c=new THREE.Mesh(cyl(r1,r0,a.distanceTo(b),n),m);c.position.copy(a).add(b).multiplyScalar(.5);c.quaternion.setFromUnitVectors(UP,V1.copy(b).sub(a).normalize());p.add(c);return c;};
  const tg=new THREE.ConeGeometry(.075,.26,4),tuft=(p,x,y,z,ox,oz)=>{const c=new THREE.Mesh(tg,Math.random()<.5?fur:(Math.random()<.5?dk:lt));c.position.set(x,y,z);c.rotation.set(Math.PI+oz*.5+R(-.2,.2),0,-ox*.5+R(-.2,.2));p.add(c);};   // shaggy tufts hanging off him
  // legs: thick, pivoting at the hip, on huge flat feet
  B.L=[-1,1].map(sx=>{const L=new THREE.Group();L.position.set(sx*.2,1.05,0);bd.add(L);const kn=v3(0,-.5,.06),an=v3(0,-.95,0);
    seg(L,v3(0,0,0),kn,.21,.17,fur);sph(L,.17,1,1,1,kn.x,kn.y,kn.z,fur,8,6);seg(L,kn,an,.17,.12,fur);
    L.ft=sph(L,.17,1.05,.42,1.9,0,-.99,.13,dk,10,6);for(let k=0;k<4;k++)sph(L,.045,1,.8,1.2,sx*(-.09+k*.06),-1.02,.44,dk,6,4);
    for(let k=0;k<10;k++){const a=R(0,6.283),y=R(-.85,-.05);tuft(L,Math.cos(a)*.19,y,Math.sin(a)*.18,Math.cos(a),Math.sin(a));}
    return L;});
  // body: a big barrel chest and shoulders, all fur
  sph(bd,.5,1,1.25,.8,0,1.5,0,fur,12,10);sph(bd,.42,1,.8,.75,0,1.72,.08,lt,10,8);
  for(const sx of[-1,1])sph(bd,.22,1,1,1,sx*.4,1.95,0,fur,8,6);
  for(let k=0;k<44;k++){const a=R(0,6.283),y=R(.95,2),r=.5*Math.sqrt(Math.max(.15,1-Math.pow((y-1.5)/.62,2)));tuft(bd,Math.cos(a)*r,y,Math.sin(a)*r*.8,Math.cos(a),Math.sin(a));}
  // head: a hood of hair round a tan face with white eyes, a heavy brow and a long beard down the chest, as on the toy
  const H=new THREE.Group();H.position.set(0,2.22,.06);bd.add(H);B.H=H;
  sph(H,.27,1,1.15,1,0,.05,-.03,fur,12,10);sph(H,.19,.85,1,.5,0,.03,.17,skin,12,10);
  sph(H,.05,1.3,.8,1,0,.0,.27,skin,8,6);   // the nose
  {const br=new THREE.Mesh(new THREE.BoxGeometry(.3,.05,.07),dk);br.position.set(0,.13,.24);H.add(br);}
  for(const sx of[-1,1]){sph(H,.042,1,1,.7,sx*.075,.08,.24,wht,8,6);sph(H,.022,1,1,.6,sx*.075,.08,.27,blk,6,4);}
  {const bdc=new THREE.Mesh(new THREE.ConeGeometry(.19,.5,8),lt);bdc.rotation.x=Math.PI;bdc.position.set(0,-.24,.17);H.add(bdc);}
  for(let k=0;k<12;k++){const a=R(Math.PI*.6,Math.PI*2.4),r=.27;tuft(H,Math.sin(a)*r,R(-.15,.25),Math.cos(a)*r-.02,Math.sin(a),Math.cos(a));}
  // arms: very long, from the shoulders down past the knees, big hands
  B.A=[-1,1].map(sx=>{const A=new THREE.Group();A.position.set(sx*.5,1.98,0);bd.add(A);const el=v3(sx*.05,-.65,0),wr=v3(sx*.07,-1.3,.05);
    seg(A,v3(0,0,0),el,.14,.12,fur);sph(A,.12,1,1,1,el.x,el.y,el.z,fur,8,6);seg(A,el,wr,.12,.09,fur);sph(A,.12,.9,1.4,.7,wr.x,wr.y-.12,wr.z,dk,8,6);
    for(let k=0;k<3;k++)seg(A,v3(wr.x+(k-1)*.05,wr.y-.22,wr.z+.03),v3(wr.x+(k-1)*.06,wr.y-.38,wr.z+.06),.03,.022,dk,5);
    for(let k=0;k<12;k++){const a=R(0,6.283),y=R(-1.2,-.05);tuft(A,Math.cos(a)*.13+sx*.04,y,Math.sin(a)*.13,Math.cos(a),Math.sin(a));}
    A.rotation.z=sx*.08;return A;});
  B.sc=5.1;g.scale.setScalar(B.sc);g.visible=false;scene.add(g);B.g=g;}
function bigfootStart(){const B=BIGF,pe=ents.find(e=>e.player);if(!pe)return;if(!B.g)bigfootBuild();B.st=1;B.t=B.t2=0;B.armed=0;
  {const j=PL.idx,q=(PL.x-P[j].x)*Nn[j].x+(PL.z-P[j].z)*Nn[j].z;B.sd=Math.abs(q)>.5?Math.sign(q):(Math.random()<.5?-1:1);}   // on the side of the road the car is on
  B.s=pe.s+clamp(Math.abs(pe.v)*3,70,260);B.lat=16;B.n=-1;B.ph=0;B.lean=0;B.said=0;B.h=null;B.bang=0;}
function sfxBigStomp(k){if(!AC)return;const t=AC.currentTime;tone('sine',62,t,.5,1.1*k,master,{to:30});hit(t,.4,.8*k,180,'lowpass',master);}
function sfxBigfootRoar(k){if(!AC)return;const t=AC.currentTime;for(const[f,v]of[[96,.55],[142,.3],[64,.5]])tone('sawtooth',f*R(.95,1.05),t,2,v*k,master,{to:f*.68,a:.15,h:.55,lp:650,q:2});
  hit(t,1.9,.55*k,480,'bandpass',master);hit(t+.1,1.5,.3*k,1300,'bandpass',master);}
function bigfootTick(rdt){const B=BIGF;if(!DRIVE||!Z.sq)return;const pe=ents.find(e=>e.player);if(!pe)return;const i=PL.idx,m_=x=>Math.round(x/SEG);
  if(i<Z.gg1||i>Z.sq){B.armed=1;B.at=0;}
  if(B.st===0){if(B.g)B.g.visible=false;if(B.armed&&G.state==='race'&&i>Z.gg1+m_(180)&&i<Z.sq-m_(800)){if(!B.at)B.at=Math.min(Z.gg1+m_(R(250,700)),Z.sq-m_(900));if(i>=B.at)bigfootStart();}return;}
  B.t+=rdt;B.t2+=rdt;const g=B.g,ds=B.s-pe.s,cd=camera.position.distanceTo(g.position),kd=clamp(70/(cd+25),.08,1);
  let run=0,lean=0,face=0;const A=[[0,B.A[0].rotation.z],[0,B.A[1].rotation.z]];   // per arm target [x,z]
  if(B.st===1){   // stepping out from between the trees, right to the edge of the road
    B.lat=Math.max(.6,B.lat-rdt*8);run=B.lat>.6?.5:0;
    if(!B.said&&cd<300){B.said=1;say('BIGFOOT !','OUT OF THE REDWOODS',2.2);}
    if(ds<Math.max(22,Math.abs(pe.v)*.8)){B.st=2;B.t2=0;}else if(B.t>30||ds<-80){B.st=4;B.t2=0;}}
  if(B.st===2){   // both fists up, then BANG: he hammers them down on the car as it goes by (a thump and a jolt; the car is not touched in the game)
    lean=.25;B.lat=Math.max(.2,B.lat-rdt*3);
    if(!B.bang){for(let k=0;k<2;k++){const sx=k?1:-1;A[k]=[-2.9,-sx*.15];}
      if(ds<4||B.t2>1.6){B.bang=1;B.tb=B.t2;sfxThump(1.6);sfxBigStomp(.7);G.shake=Math.max(G.shake,.9);}}
    else{const d=B.t2-B.tb;lean=.55;for(let k=0;k<2;k++){const sx=k?1:-1;A[k]=[d<.22||(d>.3&&d<.5)?-.55:-1.9,-sx*.2];}
      if(B.bang===1&&d>.3){B.bang=2;sfxThump(1.1);G.shake=Math.max(G.shake,.6);}
      if(d>1){B.st=3;B.t2=0;sfxBigfootRoar(clamp(kd*1.6,.3,1));}}}
  if(B.st===3){   // the chase: pounds along the edge of the road after you
    run=1;face=1;lean=.25;B.s+=15*rdt;if(B.s>pe.s-12)B.s=Math.max(B.s-15*rdt,pe.s-12);B.lat=Math.min(2.5,B.lat+rdt);
    for(let k=0;k<2;k++){const sx=k?1:-1;A[k]=[Math.sin(B.ph+k*Math.PI)*.9-.3,sx*.15];}
    if(B.t2>4.2||ds<-260){B.st=4;B.t2=0;sfxBigfootRoar(clamp(kd*1.8,.25,.9));}}
  if(B.st===4){   // gives up: throws his arms in the air, then beats his chest
    const tt=B.t2;if(tt<1.7){const u=.5+.5*Math.sin(tt*5);for(let k=0;k<2;k++){const sx=k?1:-1;A[k]=[-2.6-u*.3,sx*(.35+u*.2)];}}
    else if(tt<4){for(let k=0;k<2;k++){const sx=k?1:-1,bt=Math.sin(tt*13+k*Math.PI);A[k]=[-1.15-.15*bt,-sx*(.55+.25*Math.max(0,bt))];}
      const nb=Math.floor(tt*13/Math.PI);if(nb!==B.nb){B.nb=nb;sfxThump(clamp(kd*2,.15,1));}}
    else B.st=5;}
  if(B.st===5&&(ds<-700||i>Z.sq||i<Z.gg1)){B.st=0;g.visible=false;return;}
  // place him at the edge of the road, feet on it (road height there), turning towards the car (or along the road while chasing)
  const j=wrapI(Math.floor(B.s/SEG)),w=RW+XW[j],V=at(B.s,B.sd*(w+B.lat),0,B.V);
  const a=P[j],b=P[wrapI(j+1)],hT=face?Math.atan2(b.x-a.x,b.z-a.z):Math.atan2(PL.x-V.x,PL.z-V.z);if(B.h==null)B.h=hT;
  let dh=hT-B.h;dh=Math.atan2(Math.sin(dh),Math.cos(dh));B.h+=dh*clamp(rdt*5,0,1);
  B.ph+=rdt*(run?(run>.6?8.5:4):0);if(!run)B.ph+=(Math.round(B.ph/Math.PI)*Math.PI-B.ph)*clamp(rdt*6,0,1);
  const bob=run?Math.abs(Math.sin(B.ph))*.04*B.sc:0;g.position.set(V.x,V.y+bob,V.z);g.rotation.set(0,B.h,0);g.visible=true;
  B.lean+=(lean-B.lean)*clamp(rdt*6,0,1);B.bd.rotation.x=B.lean;B.H.rotation.x=-B.lean*.6;
  B.L.forEach((L,k)=>{L.rotation.x=-Math.sin(B.ph+k*Math.PI)*(run?.7*run:0);});
  B.A.forEach((Ar,k)=>{const sx=k?1:-1,tx=B.st===1&&run?Math.sin(B.ph+k*Math.PI)*.5:A[k][0],tz=B.st===1||B.st===5?sx*.08:A[k][1];Ar.rotation.x+=(tx-Ar.rotation.x)*clamp(rdt*9,0,1);Ar.rotation.z+=(tz-Ar.rotation.z)*clamp(rdt*9,0,1);});
  // a heavy footfall each time a foot comes down: a thud, a small shake, a puff of dust
  const st=Math.floor(B.ph/Math.PI);if(st!==B.n){const first=B.n<0;B.n=st;if(!first&&run){sfxBigStomp(kd);G.shake=Math.max(G.shake,.3*kd);
    if(cd<300){const F=B.L[((st%2)+2)%2].ft.getWorldPosition(B.F);NOGY=1;for(let q=0;q<6;q++){const a2=R(0,6.283),sp=R(2,5);puff(V.set(F.x+Math.cos(a2),F.y+.3,F.z+Math.sin(a2)),Math.cos(a2)*sp,R(1,3),Math.sin(a2)*sp,1,R(3,6),R(1.2,2),.5,0x6e5e48);}NOGY=0;}}}}
// The Golden Gate: as the road turns onto the bridge, the one-eyed monster rises out of the bay on the right, just ahead, hung with seaweed, water pouring off him,
// with a deep wet bellow. As you come off the far end he comes up out of the water again, waves goodbye with a big slow arm, and sinks. Once per pass each;
// He also rises out of the bay on the LEFT beside the last stretch of the Richmond-San Rafael bridge (spot 2).
// On I-80 South (spot 3) he rises out of the stormy sea among the tankers on the RIGHT, wades in towards the freeway (stopping well short of it), leans over
// and peers down at the road, head tilting, the big eye following the car, with a low questioning rumble; he turns to watch you go and sinks back.
// he stays out in the water and never touches the car (BAYM, seaMonTick; __test.seaMon(0|1|2|3)).
const BAYM={g:null,on:0,a0:1,a1:1,a2:1,a3:1,t:0};
function sfxCurious(k){if(!AC)return;const t=AC.currentTime;   // a low, rising "hmmm?": deep and throaty, lifting at the end like a question
  tone('sawtooth',46,t,1.9,.3*k,master,{to:74,a:.35,h:.75,lp:240});tone('sine',38,t,1.9,.45*k,master,{to:62,a:.35,h:.75});tone('triangle',92,t+.15,1.7,.16*k,master,{to:150,a:.3,h:.7});}
function sfxSeaBellow(k){if(!AC)return;const t=AC.currentTime;
  hit(t,6,.9*k,420,'lowpass',master);hit(t+.4,5,.35*k,1900,'bandpass',master);   // the water rushing off him
  const o=AC.createOscillator(),o2=AC.createOscillator(),f=AC.createBiquadFilter(),g=AC.createGain(),l=AC.createOscillator(),lg=AC.createGain(),t0=t+1.2,t1=t0+5.5;
  o.type='sawtooth';o2.type='triangle';o.frequency.setValueAtTime(64,t0);o.frequency.exponentialRampToValueAtTime(36,t1);o2.frequency.setValueAtTime(97,t0);o2.frequency.exponentialRampToValueAtTime(52,t1);
  f.type='lowpass';f.frequency.value=240;f.Q.value=8;l.frequency.value=6.5;lg.gain.value=150;l.connect(lg);lg.connect(f.frequency);   // a gurgling, throaty filter wobble: a wet groan, not a roar
  g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(1.2*k,t0+1.3);g.gain.setValueAtTime(1.2*k,t1-1.6);g.gain.linearRampToValueAtTime(0,t1);
  o.connect(f);o2.connect(f);f.connect(g);g.connect(master);for(const x of[o,o2,l]){x.start(t0);x.stop(t1+.1);}
  for(let i=0;i<16;i++){const tt=t+R(.6,6),fr=R(80,200);tone('sine',fr,tt,.14,.35*k,master,{to:fr*2.6,a:.01,h:.3});}}   // big bubbles bursting through it
function seaMonStart(bye){const M=BAYM,pe=ents.find(e=>e.player);if(!pe)return;bye=bye===3?3:bye===2?2:bye?1:0;
  if(!M.g){eyeMonBuild(M);const wm=[0x1f3a1c,0x2e4a1e,0x3b3a1a].map(c=>std({color:c,roughness:.6,side:THREE.DoubleSide}));M.weed=[];
    const strand=(par,x,y,z,L)=>{const p=new THREE.Group();p.position.set(x,y,z);const o=new THREE.Mesh(new THREE.BoxGeometry(R(.05,.12),L,.02).translate(0,-L/2,0),wm[Math.random()*3|0]);p.add(o);par.add(p);M.weed.push({p,ph:R(0,6.3),a:R(.08,.2)});};
    for(let k=0;k<44;k++){const a=k/44*Math.PI*2+R(-.05,.05);strand(M.U,Math.cos(a)*1.9,.95,Math.sin(a)*1.25,R(.5,1.7));}   // hanging off the rim of the head
    for(let k=0;k<12;k++){const a=R(0,6.3),r=R(.3,1.3);strand(M.U,Math.cos(a)*r,1.7-r*.1,Math.sin(a)*r*.7,R(.3,.9));}   // draped over the crown
    for(const A of M.A)for(let k=0;k<6;k++)strand(A,R(-.3,.3),R(-2.6,-.2),R(-.1,.3),R(.4,1.1));
    M.g.rotation.order='YXZ';}   // (so the I-80 lean tips him forward towards where he faces)
  M.L.forEach(L=>L.rotation.x=0);M.U.rotation.z=0;
  const m_=x=>Math.round(x/SEG),s=(bye?Z.gg1-m_(60):Z.gg0+m_(100))*SEG,j=wrapI(Math.floor(s/SEG));   /* out in the water on the right of the bridge, beside it, ahead of the car */
  M.s=s;M.lat=bye?-(edgeAt[j]+95):edgeAt[j]+45;M.bye=bye;M.sc2=bye?20:12;M.wy=bye?-44.6:.5;
  if(bye===2){const sc=16,Ts=(Z.rb1+m_(10))*SEG,j2=wrapI(Z.rb1+m_(10)),T=M.T=at(Ts,edgeAt[j2]+5,0,new THREE.Vector3()),gy=M.wy-.2*sc;M.s=Ts;M.sc2=sc;M.ts=M.tp=null;M.hit=0;   /* coming off the Richmond-San Rafael bridge: he stands in the bay on the left, just short of the bridge end (the water is 45 m down there too), placed so one fist comes down on the ground beside the road where the bridge ends (T) */
    let a=-1.2,be=1e9;for(let q=-2;q<=-.3;q+=.005){const e=Math.abs(-3.2*Math.cos(q)-.3*Math.sin(q)-((T.y-gy)/sc-3.85));if(e<be){be=e;a=q;}}M.aHit=a;   // arm angle that puts the fist on the ground
    const zf=(-3.2*Math.sin(a)+.3*Math.cos(a))*sc,sd=1.82*sc,O=at(Ts,0,0,new THREE.Vector3()),Fw=at(Ts+4,0,0,new THREE.Vector3()).sub(O).normalize(),Lf=at(Ts,4,0,new THREE.Vector3()).sub(O).normalize();
    const f=Lf.clone().negate().setY(0).normalize(),xh=new THREE.Vector3(f.z,0,-f.x);let C=null;   // facing the road, about 60 m out, with the slamming arm on the side towards the end of the bridge (so he stands in the water short of it)
    for(const sx of[-1,1]){const c=T.clone().addScaledVector(f,-zf).addScaledVector(xh,-sx*sd);if(!C||c.clone().sub(T).dot(Fw)<C.clone().sub(T).dot(Fw)){C=c;M.sx=sx;}}M.C=C;M.ha=Math.atan2(f.x,f.z);}
  if(bye===3){const j3=wrapI(Z.i80+m_(600));M.s=j3*SEG;M.sc2=13;M.wy=.1;M.lat0=-(edgeAt[j3]+190);M.lat1=-(edgeAt[j3]+62);M.tp=null;M.rum=0;M.wph=0;}   /* I-80: out among the tankers, wading in to about 60 m off the freeway (which is up on its viaduct here); the stormy sea is at about .1 */
  M.g.scale.setScalar(M.sc2);M.on=1;if(bye===3)M.a3=0;else if(bye===2)M.a2=0;else if(bye)M.a1=0;else M.a0=0;M.t=0;M.said=0;M.snd=0;M.g.visible=true;}   /* the Golden Gate's water is 45 m down at the Marin end: he is bigger there, to be seen from the deck */
function seaMonTick(rdt){const M=BAYM;if(!DRIVE||!MAR.a)return;const i=PL.idx,m_=x=>Math.round(x/SEG),pe=ents.find(e=>e.player);if(!pe)return;
  if(i<Z.marina)M.a0=M.a1=M.a2=M.a3=1;   // ready again for the next pass
  if(!M.on){if(G.state==='race'&&i>Z.marina){const v=Math.abs(pe.v),d0=(Z.gg0+m_(100))*SEG-pe.s,d1=(Z.gg1-m_(60))*SEG-pe.s;   // started far enough ahead, for the speed, that he is up by the time you get there
      const d2=(Z.rb1+m_(10))*SEG-pe.s;if(M.a0&&d0<Math.max(280,v*7)&&d0>60)seaMonStart(0);else if(M.a1&&d1<Math.max(380,v*8.5)&&d1>120)seaMonStart(1);else if(M.a2&&d2<Math.max(330,v*7)&&d2>110)seaMonStart(2);
      else{const d3=(Z.i80+m_(600))*SEG-pe.s;if(M.a3&&d3<Math.max(520,v*10)&&d3>150)seaMonStart(3);}}return;}
  const bye=M.bye,R2=bye===2,R3=bye===3,sk=R2?(M.ts!=null?M.ts+3.6:M.tp!=null?M.tp:1e9):R3?(M.tp!=null?M.tp+2.5:1e9):0,T_=R2||R3?Math.min(sk+5.2,R3?55:60):bye?15:26;   // at Richmond he stays up until he has slammed the ground (or you have gone by), then sinks; on I-80 until you have gone by
  if(G.state!=='race'||M.t>T_||i<Z.marina||i>(R2?Z.rb1+m_(700):R3?Z.i80+m_(1500):Z.gg1+m_(800))){M.on=0;M.g.visible=false;return;}
  M.t+=rdt;const t=M.t,g=M.g,sc=M.sc2,WY=M.wy,V=M.V,rise=R2||R3?sst(t,0,R3?3.6:3.2)*(1-sst(t,sk,sk+5)):bye?sst(t,0,2.6)*(1-sst(t,10,15)):sst(t,0,5.5)*(1-sst(t,20,26));
  if(R2)V.copy(M.C);else at(M.s,R3?lerp(M.lat0,M.lat1,sst(t,1.5,8)):M.lat,0,V);   // (on I-80 he wades in from out among the tankers)
  g.position.set(V.x,WY-sc*7.2+rise*sc*(bye&&!R3?7:6)+Math.sin(t*.7)*.6,V.z);   // from right under the water up to the waist (the chest, at the Marin end; thigh-deep on I-80)
  const cam=camera.position;g.rotation.set(0,Math.atan2(cam.x-V.x,cam.z-V.z),Math.sin(t*.5)*.04);g.updateMatrixWorld(true);
  M.U.rotation.y=Math.sin(t*.4)*.25;M.E.rotation.x=.25+Math.sin(t*1.1)*.08;M.E.rotation.y=Math.sin(t*.6)*.25;
  const wv=bye===1?sst(t,1.8,3.2)*(1-sst(t,9,10.5)):0;   // goodbye: one arm up high, waving slowly from side to side
  M.A.forEach((A,k)=>{const sx=k?1:-1;if(k&&wv>0){A.rotation.x=-.35*wv;A.rotation.z=sx*(.12+wv*(2.25+.45*Math.sin((t-1.8)*2.2)));}
    else{A.rotation.x=-rise*(.9+.3*Math.sin(t*.8+k));A.rotation.z=sx*(.12+rise*.35);}});   // the arms come up dripping
  if(R2){const dT=wdiff(M.s-pe.s),v=Math.abs(pe.v);if(M.tp==null&&dT<-60)M.tp=t;
    if(M.ts==null&&t>3.4&&!PL.crash&&dT<Math.max(v,4)*1.3+6&&dT>-20)M.ts=t;   // as you come off the bridge: one arm goes up, and he slams his fist down beside the road just as you get there
    if(M.ts!=null){const u=t-M.ts,up=sst(u,0,.85),dn=u<.85?0:Math.min(1,((u-.85)/.28)**2),w=up*(1-sst(u,2.2,3.4)),A=M.A[M.sx>0?1:0];
      let dy=M.ha-g.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));g.rotation.y+=dy*w;M.U.rotation.y*=1-w;
      A.rotation.x=lerp(A.rotation.x,lerp(-2.9,M.aHit,dn),w);A.rotation.z=lerp(A.rotation.z,0,w);g.updateMatrixWorld(true);
      if(!M.hit&&u>=1.13){M.hit=1;const T=M.T;G.shake=Math.max(G.shake,1.5);sfxBoom();sfxCrunch(1.2);sfxBigStomp(1.2);say('BOOM !','THE EYE SLAMS THE GROUND',2);NOGY=1;
        for(let q=0;q<26;q++)puff(V.set(T.x+R(-5,5),T.y+.6,T.z+R(-5,5)),R(-9,9),R(2,10),R(-9,9),R(2,4),R(9,16),R(2,3.5),.6,0x8a7a62);   // a cloud of dust
        for(let q=0;q<20;q++)emit(smokeP,si++,V.set(T.x+R(-2,2),T.y+1,T.z+R(-2,2)),R(-8,8),R(8,17),R(-8,8),R(.5,1),R(.4,.8),R(1.2,2),.95,0x4a3e32,14,.2);NOGY=0;   // and rocks and clods flung up
        if(!PL.crash&&!MOSQ.lift&&Math.hypot(PL.x-T.x,PL.z-T.z)<110){PL.air=1;PL.vy=Math.max(PL.vy||0,7.5);PL.safe=Math.max(PL.safe,2.5);}}}}   // the jolt throws the car up a metre or so; it lands and drives on at the same speed
  if(R3){const W=M.W,dT=wdiff(M.s-pe.s);if(M.tp==null&&dT<-45)M.tp=t;   // I-80: wades in facing the freeway, then leans over it and peers down at the road, following the car and turning to watch it go
    at(M.s,0,0,W);const yR=Math.atan2(W.x-V.x,W.z-V.z),yC=Math.atan2(PL.x-V.x,PL.z-V.z),lk=sst(t,4.5,7.5)*rise,wd=sst(t,1.2,2.4)*(1-sst(t,7.2,8.4));
    let dy=yC-yR;dy=Math.atan2(Math.sin(dy),Math.cos(dy));dy=clamp(dy,-1.4,1.4);const hy=yR+dy*lk*.75;M.wph+=rdt*2.3*wd;
    g.rotation.set(lk*.36,hy,Math.sin(t*.5)*.04);
    let ey=yC-hy;ey=Math.atan2(Math.sin(ey),Math.cos(ey));M.U.rotation.y=lerp(Math.sin(t*.4)*.25,clamp(ey,-.6,.6),lk);M.U.rotation.z=(Math.sin(t*.85)*.26+Math.sin(t*2.1)*.06)*lk;   // the head tilting from side to side, curious
    M.E.rotation.x=.25+lk*.3+Math.sin(t*1.1)*.05;M.E.rotation.y=clamp(ey-M.U.rotation.y,-.35,.35);g.updateMatrixWorld(true);   // the big eye peering down, following the car
    M.L.forEach((L,k)=>{L.rotation.x=Math.sin(M.wph+k*Math.PI)*.5*wd;});   // wading strides
    M.A.forEach((A,k)=>{const sx=k?1:-1;A.rotation.x=-rise*.45+Math.sin(M.wph+k*Math.PI)*.4*wd-lk*(k?.5:.15);A.rotation.z=sx*(.12+rise*.2);});
    const cd=Math.hypot(PL.x-V.x,PL.z-V.z);if(M.rum===0&&lk>.15){M.rum=1;sfxCurious(clamp(500/(cd+150),.4,1));}else if(M.rum===1&&cd<150&&lk>.5){M.rum=2;sfxCurious(.9);}}   // a low questioning rumble, and again as you go by
  for(const w of M.weed)w.p.rotation.set(Math.sin(t*1.3+w.ph)*w.a,0,Math.sin(t*1.7+w.ph)*w.a*.7);
  if(!M.snd&&t>.1){M.snd=1;const d=cam.distanceTo(V);sfxSeaBellow(clamp(700/(d+200),.35,1)*(bye===1?.6:1));G.shake=Math.max(G.shake,bye===1?.1:.25);}
  if(!M.said&&t>(bye?2.2:2)){M.said=1;if(R3)say('OUT OF THE STORM !','THE EYE WADES IN FOR A CLOSER LOOK',2.4);else if(R2)say('OUT OF THE BAY !','THE EYE RISES BY THE RICHMOND BRIDGE',2.4);else if(bye)say('BYE BYE !','THE EYE WAVES GOODBYE',2.4);else say('OUT OF THE BAY !','THE EYE RISES BESIDE THE GOLDEN GATE',2.4);}
  const pour=(bye?(t<7?1:Math.max(0,1-(t-7)/3)):(t<16?1:Math.max(0,1-(t-16)/4)))*(rise>.05?1:0);if(pour>0){NOGY=1;const n=Math.round(rdt*60*pour*3);for(let q=0;q<n;q++){const a=R(0,6.283),P_=M.F.set(Math.cos(a)*1.9,.9,Math.sin(a)*1.25);M.U.localToWorld(P_);
      if(P_.y>WY+2)puff(V.set(P_.x,P_.y,P_.z),R(-1,1),-R(6,14),R(-1,1),R(2,4),R(5,9),R(1.4,2.4),.5,0xd4e2ea);}   // sheets of water pouring off the rim
    if(Math.random()<rdt*14*pour)puff(V.set(g.position.x+R(-25,25),WY+.5,g.position.z+R(-25,25)),R(-4,4),R(3,9),R(-4,4),R(4,8),R(14,24),R(1.5,2.8),.55,0xeef3f6);NOGY=0;}}   // and the sea churning round him
// San Francisco: a row of tall buildings on the LEFT as you come off the Bay Bridge. When the city quake hits they tilt, sag and crumble down in clouds of dust,
// always falling back away from the street (visual only: nothing reaches the road) (SFB, sfBldTick).
const SFB={l:null};
function sfBldTick(rdt){if(!DRIVE)return;const m_=x=>Math.round(x/SEG);
  if(!SFB.l){SFB.l=[];let n=0;for(let i=Z.b1+m_(45);i<Z.downtown-m_(25);i+=m_(R(34,46))){if(SFX.some(c=>Math.abs(i-c)<m_(16)))continue;
      const w=R(13,19),d=R(12,16),h=R(26,58),g=new THREE.Group(),b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),cityMats[n++%4]);b.position.set(0,h/2,-d/2);b.castShadow=true;g.add(b);
      const cap=new THREE.Mesh(new THREE.BoxGeometry(w+.6,.8,d+.6),std({color:0x8a8478,roughness:.9}));cap.position.set(0,h+.4,-d/2);g.add(cap);
      off(i,XW[i]+15.5+R(0,4),0,g.position);g.rotation.order='YXZ';g.rotation.y=Math.atan2(-Nn[i].x,-Nn[i].z);scene.add(g);   // local +z faces the street; it pivots on its front foot and falls backwards
      SFB.l.push({g,i,h,d,st:0,t:0,dl:0,y0:g.position.y,ta:R(.35,.75),sk:R(.35,.6),rz:R(-.12,.12)});}}
  const pe=ents.find(e=>e.player);if(!pe)return;
  if(CQ.st===0){for(const o of SFB.l)if(o.st){o.st=0;o.g.rotation.x=o.g.rotation.z=0;o.g.scale.y=1;o.g.position.y=o.y0;}return;}   // put back up for the next pass
  for(const o of SFB.l){const ds=o.i*SEG-pe.s;
    if(!o.st){if(ds<320&&ds>-200){o.st=1;o.t=0;o.dl=R(0,2.5);}continue;}
    if(o.st===2)continue;o.t+=rdt;const t=o.t-o.dl;if(t<0)continue;const k=sst(t,0,4.5);
    o.g.rotation.x=-o.ta*k*k;o.g.rotation.z=o.rz*k;o.g.scale.y=1-o.sk*k;o.g.position.y=o.y0-o.h*.12*k;   // tilts back, sags and sinks into its own rubble
    if(t<4.5){if(!o.snd&&Math.abs(ds)<400){o.snd=1;sfxCrunch(.9);setTimeout(()=>sfxCrunch(.6),350);G.shake=Math.max(G.shake,.3);}
      if(Math.random()<rdt*12){NOGY=1;const p=o.g.localToWorld(V.set(R(-8,8),R(0,o.h*(1-o.sk*k)),-o.d*R(.2,.8)));puff(p,R(-3,3),R(-2,2),R(-3,3),R(3,6),R(10,18),R(2,3.5),.6,0x9a948a);
        puff(o.g.localToWorld(V.set(R(-10,10),1,-o.d*R(0,1.2))),R(-6,6),R(2,6),R(-6,0),R(6,10),R(16,26),R(2.5,4),.65,0xa8a094);NOGY=0;}}   // dust pouring off it and rolling out at the base
    else{o.st=2;o.snd=0;}}}
// San Francisco: the Transamerica-style pyramid towers fall in the city quake. One after another each shudders, its tip snaps and drops, then it leans away from the road
// and sags into its own rubble with dust pouring off and rolling out at the base and a deep rumble (visual only: nothing reaches the road). Put back up for the next pass.
const PYQ=new THREE.Quaternion();
function sfPyrTick(rdt){if(!DRIVE||!SFP.length)return;const pe=ents.find(e=>e.player);if(!pe)return;
  if(!SFP[0].q0)for(const o of SFP){const g=o.g,c=off(o.i,0,0,new THREE.Vector3()),dx=g.position.x-c.x,dz=g.position.z-c.z,l=Math.hypot(dx,dz)||1;o.out=[dx/l,dz/l];
    o.ax=new THREE.Vector3(dz/l,0,-dx/l);o.q0=g.quaternion.clone();o.p0=g.position.clone();o.tip=g.userData.tip;o.tp0=o.tip.position.clone();o.tz0=o.tip.rotation.z;
    const wx=Math.cos(g.rotation.y),wz=-Math.sin(g.rotation.y);o.sx=Math.sign(wx*o.out[0]+wz*o.out[1])||1;o.ta=R(.38,.55);o.sk=R(.35,.5);}   // which way is "away from the road", in the tower's own frame too
  if(CQ.st===0){for(const o of SFP)if(o.st){o.st=0;o.snd=0;o.g.quaternion.copy(o.q0);o.g.position.copy(o.p0);o.g.scale.y=1;o.tip.position.copy(o.tp0);o.tip.rotation.z=o.tz0;}return;}
  for(const o of SFP){const ds=o.i*SEG-pe.s;
    if(!o.st){if(ds<560&&ds>-250){o.st=1;o.t=0;o.dl=R(0,3.5);}continue;}
    if(o.st===2)continue;o.t+=rdt;const t=o.t-o.dl;if(t<0)continue;const k=sst(t,1.4,7),kt=sst(t,.5,2.4),sh=t<1.8?.7*(1-t/1.8):0,near=Math.abs(ds)<650;
    PYQ.setFromAxisAngle(o.ax,o.ta*k*k);o.g.quaternion.copy(PYQ).multiply(o.q0);o.g.scale.y=1-o.sk*k;
    o.g.position.set(o.p0.x+R(-sh,sh),o.p0.y-o.h*.1*k,o.p0.z+R(-sh,sh));   // shudders, then leans back and sinks
    o.tip.rotation.z=o.tz0-o.sx*1.5*kt;o.tip.position.set(o.tp0.x+o.sx*o.r*.9*kt,o.tp0.y-o.h*.3*kt*kt,o.tp0.z);   // the tip snaps off and drops away behind
    if(near&&!o.snd&&t>.5){o.snd=1;sfxCrunch(.6);if(AC){const a=AC.currentTime+.9;hit(a,3.5,.9,90,'lowpass',master);tone('sine',36,a,3.5,.6,master,{to:24,a:.2,h:.6});}
      setTimeout(()=>sfxCrunch(1),1100);setTimeout(()=>sfxCrunch(.7),1700);setTimeout(()=>sfxCrunch(.5),2600);G.shake=Math.max(G.shake,.3);}
    if(t<8){if(Math.random()<rdt*16){NOGY=1;const p=o.g.localToWorld(V.set(R(-o.r,o.r)*.7,R(0,o.h*.8),R(-o.r,o.r)*.7));puff(p,R(-3,3),R(-3,1),R(-3,3),R(4,7),R(12,22),R(2.5,4),.6,0x9a948a);
        const a=R(-1.2,1.2),ox=o.out[0]*Math.cos(a)-o.out[1]*Math.sin(a),oz=o.out[0]*Math.sin(a)+o.out[1]*Math.cos(a),q=R(0,o.r*1.2);
        puff(V.set(o.p0.x+ox*q,o.p0.y+2,o.p0.z+oz*q),ox*R(4,9),R(1,5),oz*R(4,9),R(8,12),R(22,36),R(3,5),.7,0xa8a094);NOGY=0;}}   // dust pouring off it and rolling out at the base, away from the street
    else o.st=2;}}
// San Francisco, off the Bay Bridge: a giant terracotta figure (an ancient west-Mexican clay horn player, some 75 m tall) stands among the buildings on the right,
// well back from the road, blowing his long horn. In the city quake he shudders and cracks, his horn and an arm snap off, and he leans away from the road and
// slumps into a heap of broken terracotta in clouds of dust (CLAY, clayTick; visual only, nothing reaches the road). Stood back up for the next pass.
const CLAY={g:null,ch:[],nc:0};
function clayBuild(){const C=CLAY,m_=x=>Math.round(x/SEG),i=Z.b1+m_(560),g=new THREE.Group(),S=.7;C.i=i;
  const tc=canvas(256,256,(c,w,h)=>{c.fillStyle='#a8643f';c.fillRect(0,0,w,h);for(let k=0;k<1100;k++){const r=Math.random();c.fillStyle=r<.45?'rgba(220,204,186,.2)':r<.75?'rgba(124,66,40,.35)':'rgba(70,40,28,.22)';c.beginPath();c.arc(Math.random()*w,Math.random()*h,1+Math.random()*9,0,6.283);c.fill();}});
  const EM={emissive:0xffffff,emissiveIntensity:.32},clay=std({map:tc,emissiveMap:tc,...EM,roughness:.95}),clayD=std({map:tc,emissiveMap:tc,...EM,roughness:.95,side:THREE.DoubleSide}),dark=std({color:0x2e1a12,roughness:1}),
    crest=std({roughness:.95,map:canvas(256,256,(c,w,h)=>{c.drawImage(tc.image,0,0);c.strokeStyle='rgba(60,30,18,.75)';c.lineWidth=3;for(let k=0;k<56;k++){const a=k/56*6.283;c.beginPath();c.moveTo(128+Math.cos(a)*62,128+Math.sin(a)*62);c.lineTo(128+Math.cos(a)*122,128+Math.sin(a)*122);c.stroke();}
      c.lineWidth=5;c.beginPath();c.arc(128,128,124,0,6.283);c.stroke();})}),   // the sun-ray crest: incised radiating lines
    belly=std({roughness:.95,map:canvas(256,256,(c,w,h)=>{c.drawImage(tc.image,0,0);c.strokeStyle='rgba(60,30,18,.8)';c.lineWidth=3;for(const x of[40,88]){c.beginPath();c.moveTo(x,40);c.lineTo(x,216);c.stroke();}c.lineWidth=2;for(let y=46;y<214;y+=9){c.beginPath();c.moveTo(44,y);c.lineTo(84,y+4);c.stroke();}})});   // the incised belly panel
  for(const mm of[crest,belly]){mm.emissiveMap=mm.map;mm.emissive.set(0xffffff);mm.emissiveIntensity=.32;}   // a little self-glow so the terracotta reads in dull weather
  const SPH=new THREE.SphereGeometry(1,22,16),UP=new THREE.Vector3(0,1,0),
    P_=(geo,mt,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0)=>{const o=new THREE.Mesh(geo,mt);o.position.set(x*S,y*S,z*S);o.scale.set(sx*S,sy*S,sz*S);o.rotation.set(rx,ry,rz);o.castShadow=true;g.add(o);return o;},
    limb=(a,b,r0,r1,mt=clay)=>{const A=new THREE.Vector3(...a).multiplyScalar(S),Bv=new THREE.Vector3(...b).multiplyScalar(S),d=Bv.clone().sub(A),o=new THREE.Mesh(cyl(r1*S,r0*S,d.length(),14),mt);
      o.position.copy(A).add(Bv).multiplyScalar(.5);o.quaternion.setFromUnitVectors(UP,d.normalize());o.castShadow=true;g.add(o);return o;};
  for(const sx of[-1,1]){P_(SPH,clay,sx*10,3,4,8,4.5,11);for(let q=0;q<4;q++)P_(new THREE.ConeGeometry(1,1,8),clay,sx*10+(q-1.5)*3.8,2.2,14.5,1.7,4.5,1.7,Math.PI/2);   // stubby clawed toes
    limb([sx*10,4,1],[sx*11,38,0],8,9.5);P_(new THREE.TorusGeometry(1,.25,10,26),clay,sx*10.4,25,.6,9.4,9.4,9.4,Math.PI/2);   // short thick legs with a rolled band at the knee
    P_(SPH,clay,sx*22,72,0,8.5,8.5,8.5);P_(SPH,clay,sx*3.6,92,11.8,3.6,1,1.4);P_(new THREE.BoxGeometry(1,1,1),dark,sx*4.2,89.6,12.6,4.4,.7,1.2,0,0,sx*.12);}   // shoulders, brows and slit eyes
  P_(SPH,clay,0,40,0,22,11,15);P_(SPH,clay,0,57,0,25,27,17);P_(SPH,belly,0,48,13.6,6.5,14,3.6);   // the stocky body and its belly panel
  P_(new THREE.TorusGeometry(1,.13,10,30,Math.PI),clay,0,72,11,12,12,12,-.45,0,Math.PI);P_(SPH,clay,0,63.5,16.4,2.6,6,2);   // the U-shaped collar and its pendant
  P_(SPH,clay,0,78,2,9,6,9);P_(SPH,clay,0,88,3,11,11.5,10.5);P_(SPH,clay,0,86.5,13.6,1.8,2.6,2);   // neck, round head and nose
  P_(new THREE.CylinderGeometry(1,1,1,44),[clay,crest,clay],0,90,-3,18,2.5,18,Math.PI/2);P_(new THREE.ConeGeometry(1,1,10),clay,4,109,-3,3.5,9,3.5,0,0,-.3);   // the sun-ray crest and the pointed knob on top
  const M0=[0,83.5,13],E=[36,90,19],lp=(f)=>M0.map((v,j)=>v+(E[j]-v)*f),horn=[limb(M0,E,1.7,2.6)];   // the long horn, from his mouth out to his left (away from the road)
  {const d=new THREE.Vector3(E[0]-M0[0],E[1]-M0[1],E[2]-M0[2]).normalize(),b=new THREE.Mesh(new THREE.CylinderGeometry(7*S,2.6*S,7*S,20,1,true),clayD);b.position.set(...E).multiplyScalar(S).addScaledVector(d,3.5*S);b.quaternion.setFromUnitVectors(UP,d);g.add(b);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(7*S,.7*S,8,24),clay);rim.position.set(...E).multiplyScalar(S).addScaledVector(d,7*S);rim.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d);g.add(rim);horn.push(b,rim);}   // its flared bell
  const H1=lp(.62),H2=[-6,82.5,15.5],arm=[limb([22,72,0],[31,75,11],6.5,5.6),limb([31,75,11],H1,5.6,4.6),P_(SPH,clay,...H1,5,4.6,5)];   // both arms raised holding the horn
  const part=(ms,pv,fl)=>{const sg=new THREE.Group();sg.position.set(...pv).multiplyScalar(S);for(const o of ms){o.position.sub(sg.position);sg.add(o);}g.add(sg);return{g:sg,p0:sg.position.clone(),fl:fl*S};};
  C.parts=[part(horn,M0,4),part(arm,[22,72,0],7)];   // the horn and his left arm can snap off in the quake
  limb([-22,72,0],[-27,75,13],6.5,5.6);limb([-27,75,13],H2,5.6,4.6);P_(SPH,clay,...H2,5,4.6,5);
  const p=off(i,-(RW+XW[i]+72),0);p.y=groundAt(p.x,p.z)-1;g.position.copy(p);const tg=off(i-m_(260),0,0);tg.y=p.y;g.lookAt(tg);scene.add(g);C.g=g;C.y0=p.y+1;   // facing the traffic coming off the bridge
  for(let k=0;k<12;k++){const c=new THREE.Mesh(new THREE.DodecahedronGeometry(1),clay);c.scale.setScalar(R(1.2,2.6));c.visible=false;c.castShadow=true;scene.add(c);C.ch.push({m:c});}
  const c0=off(i,0,0),dx=p.x-c0.x,dz=p.z-c0.z,l=Math.hypot(dx,dz)||1;C.out=[dx/l,dz/l];C.ax=new THREE.Vector3(dz/l,0,-dx/l);C.q0=g.quaternion.clone();C.p0=g.position.clone();   // which way is away from the road
  C.rub=[];for(let k=0;k<11;k++){const a=R(-1.3,1.3),q=R(0,30),m=new THREE.Mesh(new THREE.DodecahedronGeometry(1),clay);m.position.set(p.x+(C.out[0]*Math.cos(a)-C.out[1]*Math.sin(a))*q,C.y0,p.z+(C.out[0]*Math.sin(a)+C.out[1]*Math.cos(a))*q);
    m.rotation.set(R(0,3),R(0,3),R(0,3));m.visible=false;m.castShadow=true;scene.add(m);C.rub.push({m,s:R(5,11),d:R(0,1.5)});}}   // the heap of broken terracotta he crumbles into
const CLQ=new THREE.Quaternion();
function clayCrack(v){if(!AC)return;const t=AC.currentTime;for(let k=0;k<5;k++)hit(t+k*R(.03,.09),.06,.45*v,R(3500,6000),'bandpass',master);hit(t,.25,.6*v,1400,'bandpass',master);}   // brittle pottery cracking
function clayTick(rdt){if(!DRIVE)return;const C=CLAY;if(!C.g)clayBuild();const pe=ents.find(e=>e.player);if(!pe)return;
  if(CQ.st===0){if(C.q){C.q=0;C.nc=0;C.snd=0;for(const c of C.ch)c.m.visible=false;for(const r of C.rub)r.m.visible=false;C.g.quaternion.copy(C.q0);C.g.position.copy(C.p0);C.g.scale.set(1,1,1);
      for(const o of C.parts){if(o.off)C.g.add(o.g);o.g.position.copy(o.p0);o.g.rotation.set(0,0,0);o.g.scale.set(1,1,1);o.off=0;}}return;}   // stood back up for the next pass
  const ds=C.i*SEG-pe.s;if(!C.q){if(ds<700&&ds>-300){C.q=1;C.t=0;}else return;}
  C.t+=rdt;const t=C.t,k=sst(t,2,8.5),sh=t<2.5?.5*(1-t/2.5):0,near=Math.abs(ds)<800,sp=()=>C.g.localToWorld(V.set(R(-24,24),R(20,100),R(-6,14)).multiplyScalar(.7));
  CLQ.setFromAxisAngle(C.ax,.55*k*k);C.g.quaternion.copy(CLQ).multiply(C.q0);C.g.scale.set(1+.25*k,1-.6*k,1+.25*k);C.g.position.set(C.p0.x+R(-sh,sh),C.p0.y-4*k,C.p0.z+R(-sh,sh));   // shudders, then leans away from the road and slumps
  for(const[n,o]of C.parts.entries()){if(t<1.3+n)continue;if(!o.off){o.off=1;scene.attach(o.g);const sp_=R(4,7);o.vy=R(1,3);o.vx=C.out[0]*sp_;o.vz=C.out[1]*sp_;if(near)clayCrack(1);}   // the horn snaps off, then his arm, and they drop away from the road
    const fl=C.y0+o.fl;if(o.g.position.y>fl){o.vy-=20*rdt;o.g.position.x+=o.vx*rdt;o.g.position.y+=o.vy*rdt;o.g.position.z+=o.vz*rdt;o.g.rotateOnWorldAxis(C.ax,rdt*1.3);
      if(o.g.position.y<=fl){o.g.position.y=fl;if(near){sfxCrunch(.7);clayCrack(.8);}NOGY=1;const w=o.g.getWorldPosition(V);for(let q=0;q<10;q++)puff(w,R(-5,5),R(1,4),R(-5,5),3,R(10,16),R(2,3),.6,0xa8907a);NOGY=0;}}}
  for(const r of C.rub){const s=r.s*sst(t,3+r.d,9+r.d);r.m.visible=s>.05;r.m.scale.set(s,s*.6,s);}   // the rubble heaps up at his feet
  if(near&&!C.snd&&t>.4){C.snd=1;clayCrack(1);if(AC){const a=AC.currentTime+1.8;hit(a,4,1,85,'lowpass',master);tone('sine',34,a,4,.6,master,{to:22,a:.2,h:.6});}
    setTimeout(()=>{sfxCrunch(1);clayCrack(1);},2600);setTimeout(()=>{sfxCrunch(.8);clayCrack(.7);},3800);setTimeout(()=>sfxCrunch(.6),5200);G.shake=Math.max(G.shake,.3);}
  if(t<10&&Math.random()<rdt*(t<8?16:4)){NOGY=1;puff(sp(),R(-3,3),R(-4,-1),R(-3,3),R(3,6),R(10,18),R(2.5,3.5),.55,0xb9a28a);
    const a=R(-1.2,1.2),ox=C.out[0]*Math.cos(a)-C.out[1]*Math.sin(a),oz=C.out[0]*Math.sin(a)+C.out[1]*Math.cos(a),q=R(0,20);if(t>2)puff(V.set(C.p0.x+ox*q,C.y0+2,C.p0.z+oz*q),ox*R(4,9),R(1,5),oz*R(4,9),R(8,12),R(22,34),R(3,5),.65,0xb0987e);NOGY=0;}   // dust pouring off him and rolling out at the base
  if(t<9&&C.nc<C.ch.length&&Math.random()<rdt*2.2){const c=C.ch[C.nc++];c.m.position.copy(sp());c.vx=R(-3,3);c.vz=R(-3,3);c.vy=R(0,2);c.down=0;c.m.visible=true;}   // and a chip or two breaks off
  for(const c of C.ch){if(!c.m.visible||c.down)continue;c.vy-=20*rdt;c.m.position.x+=c.vx*rdt;c.m.position.y+=c.vy*rdt;c.m.position.z+=c.vz*rdt;c.m.rotation.x+=rdt*3;c.m.rotation.z+=rdt*2;
    if(c.m.position.y<=C.y0+.8){c.m.position.y=C.y0+.8;c.down=1;NOGY=1;for(let q=0;q<5;q++)puff(c.m.position,R(-3,3),R(1,3),R(-3,3),2,R(6,10),R(1.5,2.5),.55,0xa8907a);NOGY=0;}}}
// Hyde St, on the way up: the giant mosquito flies across in front of the car and over the street. At the top of the hill he is back: he swoops at the car,
// then grabs one of the skaters rolling down ahead, carries him up a few metres and drops him; the kid lands on his board and skates on (HMQ, hydMosqTick; visual only).
const HMQ={g:null,on:0,armed:1,armed2:1,armed3:1,t:0};
function hmqBuzz(d){if(AC){const t=AC.currentTime;tone('sawtooth',460,t,d,.12,master,{to:610,a:.6,h:.6,lp:2200});tone('sawtooth',467,t,d,.1,master,{to:600,a:.6,h:.6,lp:2200});}}
function hydMosqTick(rdt){const M=HMQ;if(!DRIVE)return;const i=PL.idx,m_=x=>Math.round(x/SEG),pe=ents.find(e=>e.player);if(!pe)return;
  if(i<Z.hyde||i>Z.marina){M.armed=1;M.armed2=1;}if(i<Z.hyde-m_(40)||i>Z.gg0)M.armed3=1;
  if(M.on===2&&M.armed3&&HYI.mq&&HYI.st===2&&M.st===3&&!(M.kid.ay>0)){M.kid.held=0;M.on=0;}   /* the skater is down: off to the iguana */
  if(!M.on){if(M.armed&&G.state==='race'&&i>=Z.hyde+m_(110)&&i<Z.hyde+m_(200)){if(!M.g)mosqBuild(M);M.on=1;M.armed=0;M.t=0;M.sd=Math.random()<.5?-1:1;M.g.scale.setScalar(2.4);
      say('BZZZZZZZ!','',1.4);hmqBuzz(4.5);}
    else if(M.armed2&&G.state==='race'&&i>=Z.hyde+m_(340)&&i<Z.hyde+m_(430)){   // the top of the hill: the second pass
      let kid=null,best=1e9;for(const k of HYD.kids){if(k.up||!k.g.visible)continue;const d=k.s0+k.d-pe.s;if(d>15&&d<130&&Math.abs(d-35)<best){best=Math.abs(d-35);kid=k;}}
      if(kid){if(!M.g)mosqBuild(M);M.g.scale.setScalar(2.4);M.on=2;M.armed2=0;M.t=0;M.st=0;M.kid=kid;M.sd=Math.random()<.5?-1:1;at(pe.s+70,M.sd*30,22,M.g.position);M.T=M.T||new THREE.Vector3();
        say('BZZZZZZZ!','THE MOSQUITO IS BACK',1.6);hmqBuzz(9);}}
    else if(M.armed3&&HYI.on&&HYI.st===2&&HYI.mq&&G.state==='race'){if(!M.g)mosqBuild(M);M.on=3;M.armed3=0;M.t=0;M.st=0;M.g.scale.setScalar(3.4);M.T=M.T||new THREE.Vector3();HYI.wt=-60;at(pe.s+90,40,35,M.g.position);   // the bottom of the hill: the third pass, for the iguana
      say('BZZZZZZZ!','THE MOSQUITO WANTS THE IGUANA',1.8);hmqBuzz(10);}
    return;}
  if(M.on===2){hydMosq2(rdt,pe);return;}if(M.on===3){hydMosq3(rdt,pe);return;}
  M.t+=rdt;const t=M.t,k=t/5;if(k>=1||G.state!=='race'){M.on=0;M.g.visible=false;return;}
  M.q.copy(M.g.position);at(pe.s+75-8*t,M.sd*(45-90*k),12+6*Math.sin(k*Math.PI)+Math.sin(t*3)*.8,M.p);M.g.position.copy(M.p);
  if(t>.05&&M.q.distanceToSquared(M.p)>1e-4){M.V.copy(M.p).multiplyScalar(2).sub(M.q);M.g.lookAt(M.V);M.g.rotateZ(Math.sin(t*1.7)*.25);}
  M.g.visible=true;for(const[pv,sg]of M.w)pv.rotation.z=sg*(.25+.55*Math.sin(t*48));}
function hydMosq2(rdt,pe){const M=HMQ,k=M.kid,kp=k.g.position,T_=M.T;M.t+=rdt;const t=M.t;let sp=3;
  const done=()=>{M.on=0;M.g.visible=false;k.held=0;k.ay=0;k.vy=0;k.g.arms[0].rotation.z=-.9;k.g.arms[1].rotation.z=.9;};
  if(G.state!=='race'||t>12||PL.idx>Z.marina){done();return;}
  if(M.st===0){at(pe.s+8,0,3.4,T_);sp=3.5;if(t>1.7)M.st=1;}   // the swoop: straight at the car, just over the bonnet
  else if(M.st===1){T_.set(kp.x,kp.y+2.4,kp.z);sp=4.5;if(M.g.position.distanceTo(T_)<3||t>4.6){M.st=2;M.tg=t;k.held=1;k.vy=0;sfxThump(.4);}}   // then down the hill at one of the skaters
  else if(M.st===2){const u=t-M.tg;k.ay=7*sst(u,0,1.8);k.g.arms[0].rotation.z=-2.7;k.g.arms[1].rotation.z=2.7;T_.set(kp.x,kp.y+2.4,kp.z);   // grabs him and lifts him up
    if(u>2.4){M.st=3;M.tr=t;k.held=0;k.vy=0;}}
  else{at((k.s0+k.d)+50,M.sd*60,45,T_);sp=1.2;if(t-M.tr>3&&!(k.ay>0)){done();return;}}   // lets go and flies off
  if(!k.held&&k.ay>0){k.vy-=9.8*rdt;k.ay=Math.max(0,k.ay+k.vy*rdt);   // the drop: he lands on his board and skates on
    if(k.ay===0){k.vy=0;k.g.arms[0].rotation.z=-.9;k.g.arms[1].rotation.z=.9;sfxThump(.5);NOGY=1;for(let q=0;q<6;q++)puff(V.set(kp.x+R(-.5,.5),kp.y+.1,kp.z+R(-.5,.5)),R(-1.5,1.5),R(.3,1),R(-1.5,1.5),.3,1.2,R(.6,1),.4,0xa8a094);NOGY=0;}}
  M.q.copy(M.g.position);if(M.st===2)M.g.position.copy(T_);else M.g.position.lerp(T_,clamp(rdt*sp,0,1));
  if(M.q.distanceToSquared(M.g.position)>1e-4){M.V.copy(M.g.position).multiplyScalar(2).sub(M.q);M.g.lookAt(M.V);M.g.rotateZ(Math.sin(t*1.7)*.2);}
  M.g.visible=true;for(const[pv,sg]of M.w)pv.rotation.z=sg*(.25+.55*Math.sin(t*48));}
// the third pass, at the bottom of the hill: he swoops down on the giant iguana as it crosses toward the water, grabs it, hauls it up some 20 m (straining, buzzing loud),
// carries it out over the bay and lets go; it falls and splashes in (HYI st 3 held, st 4 falling). Visual only
function hydMosq3(rdt,pe){const M=HMQ,H_=HYI,k=H_.k,ip=k.g.position,T_=M.T,HG=11.5;M.t+=rdt;const t=M.t;let sp=2;
  const end=()=>{M.on=0;M.g.visible=false;M.g.scale.setScalar(2.4);if(H_.st===3){H_.st=4;H_.vy=0;H_.sp=0;}};
  if(G.state!=='race'||!H_.on||t>22){end();return;}
  M.q.copy(M.g.position);
  if(M.st===0){T_.set(ip.x,ip.y+HG,ip.z);sp=1.6+t*1.2;M.g.position.lerp(T_,clamp(rdt*sp,0,1));   // the swoop
    if(M.g.position.distanceTo(T_)<3||t>4.5){M.st=1;M.tg=t;H_.st=3;H_.mq=0;M.c0=M.g.position.clone();const dx=H_.D.x-ip.x,dz=H_.D.z-ip.z,dl=Math.hypot(dx,dz)||1;M.dx=dx/dl;M.dz=dz/dl;M.yw=Math.atan2(M.dx,M.dz);
      M.c1=M.c0.clone().add(new THREE.Vector3(M.dx*95,0,M.dz*95));sfxThump(.8);hmqBuzz(8);}}
  else if(M.st===1){const u=clamp((t-M.tg)/6,0,1);T_.lerpVectors(M.c0,M.c1,sst(u,0,1));T_.y=M.c0.y+20*sst(u,0,.55)+Math.sin(t*7)*.6;M.g.position.copy(T_);   // up and out over the bay, straining
    ip.set(T_.x,T_.y-HG+Math.sin(t*9)*.35,T_.z);k.g.rotation.set(Math.sin(t*2.3)*.18,M.yw+Math.sin(t*1.6)*.3,Math.sin(t*3.1)*.15);
    if(u>=1){M.st=2;M.tr=t;H_.st=4;H_.vy=0;H_.sp=0;}}   // lets go
  else{T_.set(M.c1.x+M.dx*80,M.c1.y+45,M.c1.z+M.dz*80);M.g.position.lerp(T_,clamp(rdt*.8,0,1));if(t-M.tr>4){end();return;}}   // and flies off
  if(M.q.distanceToSquared(M.g.position)>1e-4){M.V.copy(M.g.position).multiplyScalar(2).sub(M.q);M.g.lookAt(M.V);M.g.rotateZ(Math.sin(t*1.7)*.2);}
  M.g.visible=true;for(const[pv,sg]of M.w)pv.rotation.z=sg*(.25+.55*Math.sin(t*(M.st===1?60:48)));}
// Hyde St: at the start of the street a giant iguana (twice the Alameda one) bursts out of a building on the right and runs on up the street ahead of the car, keeping
// in clear view, feet on the road all the way over the hill and down; at the bottom it crosses the Marina and dives into the bay (HYI, hydIguTick; visual only, never touches the car).
const HYI={k:null,on:0,armed:1,V:new THREE.Vector3(),D:new THREE.Vector3()};
function hydIguTick(rdt){const H_=HYI;if(!DRIVE)return;const i=PL.idx,m_=x=>Math.round(x/SEG),pe=ents.find(e=>e.player);if(!pe)return;
  if(i<Z.hyde-m_(40)||i>Z.gg0)H_.armed=1;
  if(!H_.on){if(H_.armed&&G.state==='race'&&i>=Z.hyde-m_(30)&&i<Z.hyde+m_(80)){if(!H_.k){H_.k=bigIguMk();H_.k.g.scale.setScalar(9);H_.k.g.rotation.order='YXZ';}const k=H_.k,s=pe.s+55,j=wrapI(Math.floor(s/SEG));
      Object.assign(H_,{on:1,armed:0,t:0,st:0,s,lat:-(edgeAt[j]+7),ph:0,y:null,sp:0,vy:0,v:8,mq:0});k.b.rotation.set(0,0,0);k.g.visible=true;NOGY=1;off(j,-(edgeAt[j]+1),1,V);for(let q=0;q<16;q++)puff(V,R(-3,3),R(1,4),R(-3,3),3,9,R(1.2,2),.5,0x8a7e70);NOGY=0;sfxCrunch(.7);}return;}
  const k=H_.k,V_=H_.V;H_.t+=rdt;let v=0;
  if(G.state!=='race'||H_.t>150||i>Z.gg0){H_.on=0;k.g.visible=false;return;}
  if(H_.st<2){const ds=H_.s-pe.s;H_.v+=(clamp(Math.abs(pe.v)+(48-ds)*.9,3,Math.max(45,Math.abs(pe.v)+20))-H_.v)*clamp(rdt*4,0,1);v=H_.v;H_.s+=v*rdt;   // keeps some 40-50 m ahead of the car, in plain view
    const j=wrapI(Math.floor(H_.s/SEG)),to=-(edgeAt[j]-3.5);let yw=0;
    if(H_.st===0){H_.lat=Math.min(to,H_.lat+7*rdt);yw=-Math.PI/4;if(H_.lat>=to)H_.st=1;}   // out of the doorway and across onto the street
    else H_.lat=to;   // running up the street, over the top and down the hill
    at(H_.s,H_.lat,0,V_);const yb=at(H_.s-7,H_.lat,0,H_.D).y,yf=at(H_.s+7,H_.lat,0,H_.D).y;V_.y=Math.min(V_.y,(yb+yf)/2)-.1;k.g.position.copy(V_);   // feet on the road, body pitched with the slope
    k.g.rotation.set(-Math.atan((yf-yb)/14),yaw(j)+yw,0);
    if(j>=Z.marina-m_(8)){H_.st=2;const ja=wrapI(MAR.a+m_(25));off(ja,-(edgeAt[ja]+40),0,H_.D);H_.y0=k.g.position.y;H_.p0=k.g.position.clone();H_.L=Math.max(1,H_.p0.distanceTo(H_.D));H_.u=0;k.g.rotation.x=0;H_.mq=HMQ.armed3?1:0;H_.wt=0;H_.wy=H_.D.y+.55;}}
  else if(H_.st===3)v=45;   // held under the mosquito (hydMosq3 moves it): legs and tail flailing
  else if(H_.st===4){const p=k.g.position;v=30;H_.vy-=(H_.sp?2:9.8)*rdt;p.y+=H_.vy*rdt;k.g.rotation.x=Math.min(.7,k.g.rotation.x+rdt*.5);   // dropped: it falls into the bay, splashes and sinks
    if(!H_.sp&&p.y<=H_.wy){H_.sp=1;H_.vy=-2.5;if(Math.abs(p.x-PL.x)+Math.abs(p.z-PL.z)<700)sfxSplash();NOGY=1;for(let q=0;q<36;q++){const a=R(0,6.283),s2=R(2,10);puff(V.set(p.x,H_.wy+.3,p.z),Math.cos(a)*s2,R(6,16),Math.sin(a)*s2,1.5,R(4,8),R(1.4,2.6),.75,0xeef2f4);}NOGY=0;}
    if(H_.sp&&p.y<H_.wy-14){H_.on=0;k.g.visible=false;return;}}
  else{v=Math.max(12,H_.v);const p=k.g.position;   // across the bottom of the hill, over the sea wall and into the grey swell along the Marina
    if(H_.mq){H_.wt+=rdt;if(H_.wt>8)H_.mq=0;else if(H_.u>=.5)v=5;}   /* the mosquito is coming for it: it stops on the Marina road (and goes on alone if he never comes) */
    if(H_.u<1){H_.u=Math.min(H_.mq?.5:1,H_.u+v*rdt/H_.L);p.lerpVectors(H_.p0,H_.D,H_.u);p.y=lerp(H_.y0,H_.D.y+.6,H_.u);}
    else{H_.vy=(H_.vy||0)-3*rdt;p.y+=H_.vy*rdt;k.b.rotation.x=.4;
      if(!H_.sp){H_.sp=1;if(Math.abs(p.x-PL.x)+Math.abs(p.z-PL.z)<500)sfxSplash();NOGY=1;for(let q=0;q<24;q++){const a=R(0,6.283),sp=R(2,7);puff(V.set(p.x,H_.D.y+.8,p.z),Math.cos(a)*sp,R(4,12),Math.sin(a)*sp,1,R(3,6),R(1.2,2.2),.7,0xeef2f4);}NOGY=0;}
      if(p.y<H_.D.y-8){H_.on=0;k.g.visible=false;return;}}
    k.g.rotation.y=Math.atan2(H_.D.x-H_.p0.x,H_.D.z-H_.p0.z);}
  H_.ph+=rdt*v*1.3;const ph=H_.ph,K=3.2;for(const sg of k.segs){const z=sg.z,A=.04+.1*Math.max(0,.6-z)/1.9;sg.g.position.x=A*Math.sin(ph-K*z);sg.g.rotation.y=Math.atan(-A*K*Math.cos(ph-K*z));}
  for(const L of k.legs){const q=Math.sin(ph)*L.s*L.f;L.g.rotation.y=q*.55;L.g.rotation.z=L.s*Math.max(0,Math.cos(ph)*L.s*L.f)*.25;}}
// past San Quentin, on the way to the Richmond bridge: out on the water to the LEFT, a second beetle rises beside an oil tanker, raises both arms and brings his
// claw down mid-ship: a boom, a fireball and black smoke; the hull breaks in two, bow and stern tilt up into a V and slide under with smoke, bubbles and a
// spreading slick; then he sinks. Far off: it never touches the car. Once per pass.
function tnkBuild(){const K=TNK,hullM=std({color:0x2a2c30,roughness:.7}),redM=std({color:0x8a2a20,roughness:.8}),whM=std({color:0xe8e4da,roughness:.6}),dkM=std({color:0x5a3a2a,roughness:.8}),burnM=std({color:0x161412,roughness:.9});
  const half=sd=>{const g=new THREE.Group(),A=(geo,mm,px,py,pz)=>{const o=new THREE.Mesh(geo,mm);o.position.set(px,py,pz);g.add(o);return o;};
    A(new THREE.BoxGeometry(26,10,85),hullM,0,5,sd*42.5);A(new THREE.BoxGeometry(26.3,3.2,85.3),redM,0,.6,sd*42.5);A(new THREE.BoxGeometry(22,1,sd>0?75:75),dkM,0,10.4,sd*40);
    A(new THREE.BoxGeometry(26.6,10.4,3),burnM,0,5,sd*1.2);   // the torn, scorched break
    for(let k=0;k<3;k++)A(cyl(.4,.4,4,6),whM,0,12.5,sd*(12+k*22));
    if(sd>0){const bw=A(new THREE.ConeGeometry(13,24,4),hullM,0,5,97);bw.rotation.x=Math.PI/2;bw.rotation.y=Math.PI/4;bw.scale.set(1,1,.42);}
    else{A(new THREE.BoxGeometry(18,15,14),whM,0,17,-70);A(new THREE.BoxGeometry(24,2,16),whM,0,25,-70);A(cyl(2.5,2.8,10,10),redM,0,27,-80);}
    g.visible=false;scene.add(g);return g;};
  K.bow=half(1);K.stern=half(-1);K.b={};beetleBuild(K.b);K.C=new THREE.Vector3();K.u=new THREE.Vector3();K.v=new THREE.Vector3();
  K.slick=new THREE.Mesh(new THREE.RingGeometry(.55,1,48).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x0c0b0a,transparent:true,opacity:0,depthWrite:false}));K.slick.visible=false;scene.add(K.slick);}
function tnkStart(){const K=TNK,pe=ents.find(e=>e.player);if(!pe)return;if(!K.bow)tnkBuild();K.on=1;K.armed=0;K.t=0;K.hit=0;K.pa=0;K.roar=0;
  const s0=pe.s+900;let ok=null;for(const[ds,la]of[[0,330],[0,280],[80,400],[-80,300],[150,460],[0,250]]){at(s0+ds,la,0,K.v);if(Terrain.landAt(K.v.x,K.v.z)<.2&&Terrain.landAt(K.v.x+60,K.v.z)<.2&&Terrain.landAt(K.v.x-60,K.v.z)<.2&&Terrain.landAt(K.v.x,K.v.z+60)<.2&&Terrain.landAt(K.v.x,K.v.z-60)<.2){ok=[ds,la];break;}}
  if(!ok)ok=[0,330];at(s0+ok[0],ok[1],0,K.C);const i=wrapI(Math.round((s0+ok[0])/SEG));K.ry=yaw(i)+.45;K.u.set(Math.sin(K.ry),0,Math.cos(K.ry));
  // the beetle stands on the far side of the ship from the road, facing it
  const px=Math.cos(K.ry),pz=-Math.sin(K.ry),rx=P[i].x-K.C.x,rz=P[i].z-K.C.z,far=(px*rx+pz*rz)>0?-1:1;K.bp=[K.C.x+px*far*48,K.C.z+pz*far*48];K.byaw=Math.atan2(K.C.x-K.bp[0],K.C.z-K.bp[1]);
  for(const h of[K.bow,K.stern]){h.position.set(K.C.x,TNK.wat,K.C.z);h.rotation.set(0,K.ry,0);h.visible=true;}const b=K.b;b.A.quaternion.copy(b.qr);b.A.scale.setScalar(1);b.rt=[0,1.6];}
function tnkTick(rdt){const K=TNK;if(!DRIVE||!Z.rb0)return;const i=PL.idx,m_=x=>Math.round(x/SEG);
  sqFxTick(rdt);
  if(i<Z.sq||i>Z.rb1)K.armed=1;   // ready again for the next pass
  if(!K.on&&K.armed&&G.state==='race'&&i>=Z.sq+m_(150)&&i<Z.sq+m_(230))tnkStart();
  if(K.mc&&K.mc.on){if(G.state!=='race')tnkCloudOff();else tnkCloud(rdt);}   // the mushroom cloud outlives the ship
  if(!K.on)return;if(G.state!=='race'){tnkOff();return;}
  K.t+=rdt;const t=K.t,b=K.b,g=b.g,W=TNK.wat,V=K.v;
  // him: rise 0-6 s, both arms up 5-7.6, the claw slams at 8.1, then down again from 10.5
  const rise=sst(t,0,6)*(1-sst(t,10.5,16));g.position.set(K.bp[0],W-112+109*rise+Math.sin(t*1.6)*.8,K.bp[1]);g.rotation.set(0,K.byaw,Math.sin(t*.8)*.04);g.visible=rise>0;
  b.T.rotation.x=.38+Math.sin(t*1.3)*.03-.25*sst(t,5,7.4)*(1-sst(t,7.6,8.1));b.H.rotation.y=Math.sin(t*.6)*.1;b.A2.rotation.x=-.55-2.2*sst(t,5,7.4)*(1-sst(t,9,10.5));g.updateMatrixWorld(true);
  const A=b.A;if(t<7.6)A.quaternion.slerpQuaternions(b.qr,b.qw,sst(t,5,7.4));
  else if(t<10.5){V.set(K.C.x,W+10,K.C.z);b.T.getWorldQuaternion(b.Q).invert();A.getWorldPosition(b.W);const d=b.W.distanceTo(V);b.W.subVectors(V,b.W).normalize().applyQuaternion(b.Q);b.qs.setFromUnitVectors(b.v1.set(0,-1,0),b.W);
    const k=t<8.1?((t-7.6)/.5)**2:t<9.2?1:1-sst(t,9.2,10.5);A.quaternion.slerpQuaternions(t<9.2&&t<8.1?b.qw:b.qr,b.qs,t<8.1?k:k);A.scale.setScalar(lerp(1,clamp(d/(b.armL*b.sc),.75,1.5),k));}
  else{A.quaternion.slerp(b.qr,clamp(rdt*2,0,1));A.scale.setScalar(lerp(A.scale.x,1,clamp(rdt*3,0,1)));}
  const cd=camera.position.distanceTo(K.C);
  if(!K.roar&&t>3){K.roar=1;sfxBeetleRoar(clamp(300/(cd+60),.25,.7));}
  if(t>=8.1&&!K.hit){K.hit=1;tnkBoom(cd);}
  // the ship: whole until the hit, then broken - the halves tilt up into a V, drift apart and slide under
  const br=sst(t,8.1,11),sk=sst(t,10,17.5);
  for(const[h,sd]of[[K.bow,1],[K.stern,-1]]){h.rotation.set(-sd*(.42*br+.12*sk),K.ry,sd*.05*br);h.position.set(K.C.x+K.u.x*sd*(3+8*sk)*br,W-3*br-95*sk**1.6,K.C.z+K.u.z*sd*(3+8*sk)*br);h.visible=sk<.999;}
  // smoke, fire and bubbles at the break; the slick spreads
  if(K.hit&&t<18&&cd<2500){K.pa+=rdt*22;NOGY=1;while(K.pa>=1){K.pa--;const y=Math.max(W+1,W+8-40*sk);
      puff(V.set(K.C.x+R(-8,8),y,K.C.z+R(-8,8)),R(-2,2),R(8,16),R(-2,2),R(6,10),R(24,40),R(3,5),.7,0x141210);
      if(t<14&&Math.random()<.4)flame(V.set(K.C.x+R(-6,6),y+2,K.C.z+R(-6,6)),R(-3,3),R(5,12),R(-3,3),R(1.5,3),R(4,7),R(.6,1.2),0xff8a2a);
      if(sk>.05)puff(V.set(K.C.x+R(-30,30),W+.4,K.C.z+R(-30,30)),R(-1,1),R(2,5),R(-1,1),R(1,2),R(3,6),R(1.2,2.2),.6,0xeef2f4);}NOGY=0;}
  const su=clamp((t-8.1)/10,0,1);K.slick.visible=t>8.1;if(K.slick.visible){K.slick.position.set(K.C.x,W+.25,K.C.z);K.slick.scale.setScalar(12+150*su);K.slick.material.opacity=.55*(1-sst(t,16,20));}
  b.rings.forEach((m,k)=>{const u=(t-b.rt[k])/4.5;m.visible=u>=0&&u<1;if(m.visible){m.position.set(g.position.x,W+.4,g.position.z);m.scale.setScalar(30+170*u);m.material.opacity=.6*(1-u);}});
  if(t>=10.5&&b.rt[0]<10){b.rt=[10.5,12];}
  if(t>20)tnkOff();}
function tnkBoom(cd){const K=TNK,V=K.v,x=K.C.x,y=TNK.wat+11,z=K.C.z;NOGY=1;   // as tankerBoom, at sea and bigger
  for(let k=0;k<50;k++){const a=R(0,6.283),sp=R(4,20);puff(V.set(x+R(-6,6),y+2,z+R(-6,6)),Math.cos(a)*sp,R(8,30),Math.sin(a)*sp,R(5,9),R(18,34),R(1.2,2.4),.95,k%3?0xff7a1c:0xffd060);}
  for(let k=0;k<26;k++){const a=R(0,6.283),sp=R(1,8);puff(V.set(x,y+8,z),Math.cos(a)*sp,R(14,30),Math.sin(a)*sp,R(8,12),R(30,50),R(3,5.5),.8,0x151311);}
  for(let k=0;k<22;k++){const a=R(0,6.283),sp=R(8,22);flame(V.set(x,y+2,z),Math.cos(a)*sp,R(8,20),Math.sin(a)*sp,R(1.5,3),R(4,7),R(1,1.8),0xff8a2a);}NOGY=0;
  const near=clamp(500/(cd+100),.25,1);sfxMushroom(near);sfxThump(2*near);G.shake=Math.max(G.shake,1.1*near);$('flash').style.opacity=.75*near;say('THE BEETLE !','HE BREAKS A TANKER IN TWO',2.6);
  if(!K.mc)tnkCloudBuild();const M=K.mc;M.on=1;M.t=0;M.ld=0;M.pa=0;M.near=near;M.x=x;M.z=z;M.wd=R(0,6.283);for(const o of M.all)o.visible=false;}
// the fireball mushroom cloud: a few lumpy, unlit shells (fireball, dome, rolling ring, glowing underside, stem, base surge) plus a shockwave ring on the water
function tnkCloudBuild(){const lump=(geo,a)=>{const p=geo.attributes.position,nm=geo.attributes.normal,c=[];for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=Math.sin(x*3.7+y*1.3)*Math.sin(y*4.1-z*2.2)*Math.sin(z*3.3+x*2.9)+.5*Math.sin(x*7.9-z*6.1+y*5.3);
      p.setXYZ(i,x+nm.getX(i)*a*n,y+nm.getY(i)*a*n,z+nm.getZ(i)*a*n);const v=.68+.32*clamp(n*.8+.5,0,1);c.push(v,v,v);}geo.setAttribute('color',new THREE.Float32BufferAttribute(c,3));return geo;},
    mk=(geo,vc=true)=>{const o=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:vc,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));o.visible=false;o.frustumCulled=false;scene.add(o);return o;};
  const M=TNK.mc={on:0,t:0,c:new THREE.Color(),cs:[0xfff2a8,0xffa030,0xd8461a,0x6a2214,0x2c2826].map(h=>new THREE.Color(h))};
  M.fb=mk(lump(new THREE.SphereGeometry(1,28,18),.16));M.cap=mk(lump(new THREE.SphereGeometry(1,28,18),.15));
  M.roll=mk(lump(new THREE.TorusGeometry(1,.5,16,36).rotateX(Math.PI/2),.13));M.glow=mk(lump(new THREE.TorusGeometry(1,.42,12,30).rotateX(Math.PI/2),.12));
  M.stem=mk(lump(new THREE.CylinderGeometry(.7,1,1,18,8,true).translate(0,.5,0),.1));M.surge=mk(lump(new THREE.TorusGeometry(1,.35,10,36).rotateX(Math.PI/2),.2));
  M.shock=mk(new THREE.RingGeometry(.9,1,80).rotateX(-Math.PI/2),false);M.shock.material.color.setHex(0xfff4dc);M.surge.material.color.setHex(0xb8b2a8);
  M.all=[M.fb,M.cap,M.roll,M.glow,M.stem,M.surge,M.shock];}
function tnkHeat(m,k){const M=TNK.mc,s=M.cs,f=clamp(k,0,.999)*4,i=Math.floor(f);m.color.copy(s[i]).lerp(s[i+1],f-i);}   // hot yellow > orange > deep red > dark smoke as k goes 0 > 1
function tnkCloud(rdt){const M=TNK.mc,W=TNK.wat,V=TNK.v;M.t+=rdt;const u=M.t;if(u>44){tnkCloudOff();return;}
  const fo=1-sst(u,22,42),dr=Math.max(0,u-5)*1.3,x=M.x+Math.cos(M.wd)*dr,z=M.z+Math.sin(M.wd)*dr,   // fades and drifts off with the wind
    H=W+20+120*(1-Math.exp(-u/3.2))+.7*u,rc=14+42*sst(u,.3,9)+.6*u,rw=5+9*sst(u,.4,6)+.12*u;
  const fb=M.fb;fb.visible=u<11;if(fb.visible){fb.position.set(x,H,z);fb.scale.setScalar(Math.min(8+50*sst(u,0,.7),rc*.85));fb.rotation.y=u*.2;tnkHeat(fb.material,.12+.75*sst(u,1,10));fb.material.opacity=1-sst(u,8,11);}
  const cp=M.cap;cp.visible=u>.35;if(cp.visible){cp.position.set(x,H+rc*.12,z);cp.scale.set(rc,rc*.62,rc);cp.rotation.y=u*.05;tnkHeat(cp.material,sst(u,.4,9));cp.material.opacity=.95*sst(u,.35,.9)*fo;}
  const rl=M.roll;rl.visible=u>.5;if(rl.visible){rl.position.set(x,H-rc*.18,z);rl.scale.set(rc*.95,rc*.8,rc*.95);rl.rotation.y=-u*.08;tnkHeat(rl.material,sst(u,.6,10.5));rl.material.opacity=.95*sst(u,.5,1.1)*fo;}
  const gl=M.glow;gl.visible=u>.6&&u<26;if(gl.visible){gl.position.set(x,H-rc*.36,z);gl.scale.set(rc*.72,rc*.55,rc*.72);gl.rotation.y=u*.11;tnkHeat(gl.material,.12+.62*sst(u,2,18));gl.material.opacity=.9*sst(u,.6,1.2)*(1-sst(u,16,26));}   // the hot underside of the cap, glowing longest
  const st=M.stem;st.visible=u>.3&&u<30;if(st.visible){const top=H-rc*.3,ox=x-M.x,oz=z-M.z;st.position.set(M.x,W,M.z);st.scale.set(rw,Math.max(1,top-W),rw);st.rotation.set(oz/(top-W+1),u*.1,-ox/(top-W+1));tnkHeat(st.material,sst(u,.3,7));st.material.opacity=.9*sst(u,.3,.8)*(1-sst(u,14,30));}
  const sg=M.surge;sg.visible=u>.4&&u<26;if(sg.visible){const r=14+130*(1-Math.exp(-u/4));sg.position.set(M.x,W+r*.12,M.z);sg.scale.set(r,r*.45,r);sg.rotation.y=u*.06;sg.material.opacity=.55*sst(u,.4,1.8)*(1-sst(u,10,26));}   // the base surge rolling out over the water
  const sh=M.shock;sh.visible=u<3;if(sh.visible){sh.position.set(M.x,W+.6,M.z);sh.scale.setScalar(12+320*u);sh.material.opacity=.85*(1-u/3);}
  if(u<9){boom.position.set(x,Math.min(H,W+60),z);boom.distance=1500;boom.intensity=Math.max(boom.intensity,26000*(1-sst(u,0,8)));}else if(!M.ld){M.ld=1;boom.distance=140;}   // a strong orange light over the water and sky, dying away
  if(u<4)G.shake=Math.max(G.shake,.35*M.near*(1-u/4));
  if(u<18){M.pa=(M.pa||0)+rdt*16;NOGY=1;while(M.pa>=1){M.pa--;const a=R(0,6.283);tnkHeat({color:M.c},sst(u,.6,10.5));   // billows boiling off the rolling ring, and fire up the stem
      puff(V.set(x+Math.cos(a)*rc*R(.8,1.1),H-rc*R(.05,.35),z+Math.sin(a)*rc*R(.8,1.1)),Math.cos(a)*R(1,4),R(1,4),Math.sin(a)*R(1,4),rc*.35,rc*.7,R(3,5),.5*fo,M.c.getHex());
      if(u<7){const hh=R(0,H-rc*.3-W);flame(V.set(M.x+R(-rw,rw)*.5,W+hh,M.z+R(-rw,rw)*.5),R(-2,2),R(10,20),R(-2,2),rw*.8,rw*1.6,R(.8,1.4),0xff8a2a);}}NOGY=0;}}
function tnkCloudOff(){const M=TNK.mc;if(!M)return;M.on=0;for(const o of M.all)o.visible=false;if(!M.ld){M.ld=1;boom.distance=140;}}
// ---- San Quentin extras (free drive): fallout from the tanker's mushroom cloud drifting down on the road to the San Rafael bridge, faint sirens wailing at the prison, and police cars by the gate with their light bars flashing
const ASH={on:0,t:0},SIR={},POLX={l:null},PV=new THREE.Vector3();
function sqFxTick(rdt){ashTick(rdt);sirenTick(rdt);polTick(rdt);}
function ashBuild(){const mk=(n,c,sz,add)=>{const p=new Float32Array(n*3),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));
    const o=new THREE.Points(g,new THREE.PointsMaterial({map:glowTex,color:c,size:sz,transparent:true,depthWrite:false,opacity:add?1:.9,fog:false,vertexColors:!add,blending:add?THREE.AdditiveBlending:THREE.NormalBlending}));o.frustumCulled=false;o.visible=false;scene.add(o);
    const q=[],cp=camera.position,cl=[];for(let i=0;i<n;i++){q.push(Math.random());p[i*3]=cp.x+R(-20,20);p[i*3+1]=cp.y+R(-3,16);p[i*3+2]=cp.z+R(-20,20);const v=R(.28,.9);cl.push(v,v*.98,v*.95);}if(!add)g.setAttribute("color",new THREE.Float32BufferAttribute(cl,3));return{o,p,q,n,g};};   // ash in mixed greys, from pale to charcoal
  ASH.a=mk(900,0xffffff,.34,0);ASH.e=mk(120,0xff8a30,.24,1);}
function ashTick(rdt){const M=TNK.mc,i=PL.idx,m_=x=>Math.round(x/SEG);if(M&&M.on&&M.t<1&&!ASH.on){ASH.on=1;ASH.t=0;}if(!ASH.on)return;if(!ASH.a)ashBuild();
  ASH.t+=rdt;const t=ASH.t;if(t>110||i>Z.rb0+m_(80)||i<Z.sq-m_(200)||G.state!=='race'){ASH.on=0;ASH.a.o.visible=ASH.e.o.visible=false;return;}
  const k=sst(t,1,6)*(1-sst(t,70,110))*(1-sst(i,Z.rb0-m_(300),Z.rb0+m_(40)))*(G.tun<.5?1:0),tm=tmNow();   // thickens for a while, then thins out by the bridge
  camera.getWorldDirection(PV);const cx=camera.position.x+PV.x*10,cy=camera.position.y,cz=camera.position.z+PV.z*10;
  for(const[S,n,fall,sw]of[[ASH.a,Math.round(900*k),1.5,1.4],[ASH.e,Math.round(120*k*(1-sst(t,12,40))),.9,1]]){S.o.visible=n>0;if(!n)continue;S.g.setDrawRange(0,n);const p=S.p;
    for(let j=0;j<n;j++){const q=S.q[j],o=j*3;p[o+1]-=fall*(.7+q*.6)*rdt;p[o]+=(Math.sin(tm*.8+q*40)*sw+.6)*rdt;p[o+2]+=Math.cos(tm*.95+q*31)*sw*rdt;   // falling slowly and swirling
      let d=p[o]-cx;if(d>20)p[o]-=40;else if(d<-20)p[o]+=40;d=p[o+2]-cz;if(d>20)p[o+2]-=40;else if(d<-20)p[o+2]+=40;d=p[o+1]-cy;if(d<-4)p[o+1]+=20;else if(d>16)p[o+1]-=20;}
    S.g.attributes.position.needsUpdate=true;}
  ASH.e.o.material.opacity=.7+.3*Math.sin(tm*9);}
function sirenTick(rdt){if(!AC)return;const a=Z.sq+Math.round(260/SEG),i=PL.idx,m_=x=>Math.round(x/SEG);
  const v=(G.state==='race'&&!G.paused)?sst(i,a-m_(1100),a-m_(80))*(1-sst(i,a+m_(150),a+m_(750))):0;   // rising as you near the prison, fading after
  if(!SIR.o){if(v<=0)return;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=1300;SIR.g=AC.createGain();SIR.g.gain.value=0;f.connect(SIR.g);SIR.g.connect(master);
    SIR.o=[['sawtooth',.3],['triangle',.7]].map(([ty,vol])=>{const o=AC.createOscillator(),g=AC.createGain();o.type=ty;g.gain.value=vol;o.connect(g);g.connect(f);o.start();return o;});SIR.t=0;SIR.z=0;}
  SIR.t+=rdt;const t=SIR.t,ct=AC.currentTime;
  SIR.o[0].frequency.setTargetAtTime(620+320*(.5+.5*Math.sin(t*1.6)),ct,.06);SIR.o[1].frequency.setTargetAtTime(540+280*(.5+.5*Math.sin(t*1.15+2)),ct,.06);   // two sirens wailing up and down, out of step
  SIR.g.gain.setTargetAtTime(.045*v*(.7+.3*Math.sin(t*.45)),ct,.3);
  if(v<=0){SIR.z+=rdt;if(SIR.z>3){for(const o of SIR.o)o.stop();SIR.g.disconnect();SIR.o=null;}}else SIR.z=0;}
function polBuild(){const a=Z.sq+Math.round(260/SEG);POLX.l=[];const gm=[0xff2020,0x2050ff].map(c=>new THREE.SpriteMaterial({map:glowTex,color:c,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:0}));POLX.gm=gm;
  for(const[dm,off,ry]of[[-170,5,.9],[-70,8,-.7],[-25,6.5,2.5],[45,4.5,-1.3],[120,9,.35],[0,3,0]]){const v=TRAF.mkPol(),g=v.g;for(const[k,x]of[[0,-.33],[1,.33]]){const s=new THREE.Sprite(gm[k]);s.position.set(x,1.65,0);s.scale.setScalar(3.2);g.add(s);}
    g.visible=false;scene.add(g);const c={g,s:a*SEG+dm,off,ry,mv:ry===0&&dm===0,ob:{x:1e9,z:1e9,r:2.3,soft:1}};OBST.push(c.ob);POLX.l.push(c);}}   // parked at odd angles on the shoulder by the prison yard; the last one cruises slowly along it
function polTick(rdt){const a=Z.sq+Math.round(260/SEG),i=PL.idx,m_=x=>Math.round(x/SEG),near=G.state==='race'&&i>a-m_(1000)&&i<a+m_(600);
  if(!POLX.l){if(!near||!TRAF.mkPol)return;polBuild();}const tm=tmNow(),f=(tm*7|0)%2,gl=.3+.55*(1-clamp(wx.sunK,0,1));POLX.gm[0].opacity=f?gl:.03;POLX.gm[1].opacity=f?.03:gl;   // glows brighter in the dark
  for(const c of POLX.l){c.g.visible=near;if(!near){c.ob.x=1e9;continue;}let s=c.s,ry=c.ry;if(c.mv){const u=tm*.035;s=c.s+190*Math.sin(u);ry=Math.cos(u)<0?Math.PI:0;}   // the moving one drives up and back at a crawl
    const j=wrapI(Math.floor(s/SEG));at(s,-(RW+XW[j]+c.off),0,PV);c.g.position.copy(PV);c.g.rotation.y=yaw(j)+ry;c.ob.x=PV.x;c.ob.z=PV.z;}}
function tnkOff(){const K=TNK;K.on=0;if(!K.bow)return;K.bow.visible=K.stern.visible=K.slick.visible=false;K.b.g.visible=false;for(const r of K.b.rings)r.visible=false;}
function sfxBeetleRoar(k){if(!AC)return;const t=AC.currentTime,o=AC.createOscillator(),o2=AC.createOscillator(),f=AC.createBiquadFilter(),g=AC.createGain();o.type='sawtooth';o2.type='square';
  o.frequency.setValueAtTime(60,t);o.frequency.linearRampToValueAtTime(88,t+.8);o.frequency.exponentialRampToValueAtTime(36,t+3.4);o2.frequency.setValueAtTime(30,t);o2.frequency.exponentialRampToValueAtTime(21,t+3.4);
  f.type='lowpass';f.frequency.setValueAtTime(260,t);f.frequency.linearRampToValueAtTime(900,t+.7);f.frequency.exponentialRampToValueAtTime(150,t+3.4);f.Q.value=4;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.8*k,t+.5);g.gain.setValueAtTime(.8*k,t+2.2);g.gain.exponentialRampToValueAtTime(.001,t+3.6);
  o.connect(f);o2.connect(f);f.connect(g);g.connect(master);o.start(t);o2.start(t);o.stop(t+3.7);o2.stop(t+3.7);hit(t,3.2,.6*k,380,'lowpass',master);}
function sfxBeetleHit(k){if(!AC)return;const t=AC.currentTime;tone('sine',55,t,1.4,1.4*k,master,{to:22,h:.2});hit(t,1.2,1.4*k,180,'lowpass',master);hit(t,.3,.6*k,2400,'bandpass',master);sfxCrunch(k);}
// sign art: an invented federal corrections seal (navy and gold, a shield with a star and a key) and a running-prisoner pictogram (striped, with ball and chain)
function prisonSeal(c,x,y,r){c.save();c.translate(x,y);c.fillStyle='#1c2f5a';c.beginPath();c.arc(0,0,r,0,7);c.fill();c.strokeStyle='#d8b84a';c.lineWidth=Math.max(2,r*.06);c.beginPath();c.arc(0,0,r*.93,0,7);c.stroke();c.beginPath();c.arc(0,0,r*.64,0,7);c.stroke();
  c.fillStyle='#d8b84a';c.font='900 '+Math.max(7,r*.16|0)+'px Arial';c.textAlign='center';c.textBaseline='middle';const tx='FEDERAL BUREAU OF CORRECTIONAL CUSTODY ★ ';for(let k=0;k<tx.length;k++){c.save();c.rotate(k/tx.length*Math.PI*2);c.fillText(tx[k],0,-r*.79);c.restore();}
  c.beginPath();c.moveTo(0,-r*.5);c.lineTo(r*.4,-r*.36);c.lineTo(r*.34,r*.18);c.lineTo(0,r*.52);c.lineTo(-r*.34,r*.18);c.lineTo(-r*.4,-r*.36);c.closePath();c.fill();
  c.fillStyle='#1c2f5a';c.beginPath();for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,q=k%2?r*.08:r*.19;c.lineTo(Math.cos(a)*q,-r*.17+Math.sin(a)*q);}c.closePath();c.fill();
  c.beginPath();c.arc(0,r*.14,r*.07,0,7);c.fill();c.fillRect(-r*.025,r*.14,r*.05,r*.26);c.fillRect(0,r*.32,r*.09,r*.04);c.restore();}
function prisonRunner(c,x,y,s,col='#111'){c.save();c.translate(x,y);c.scale(s,s);c.strokeStyle=col;c.fillStyle=col;c.lineCap='round';c.lineJoin='round';c.lineWidth=12;
  c.beginPath();c.arc(16,-62,11,0,7);c.fill();c.beginPath();c.moveTo(9,-45);c.lineTo(-4,-8);c.stroke();
  c.beginPath();c.moveTo(-4,-8);c.lineTo(16,12);c.lineTo(8,42);c.moveTo(-4,-8);c.lineTo(-20,14);c.lineTo(-44,18);c.stroke();
  c.beginPath();c.moveTo(6,-38);c.lineTo(28,-22);c.lineTo(42,-34);c.moveTo(6,-38);c.lineTo(-14,-28);c.lineTo(-30,-42);c.stroke();
  c.strokeStyle='#f4f1e8';c.lineWidth=3;for(let k=0;k<3;k++){const u=.2+k*.27,px=9-13*u,py=-45+37*u;c.beginPath();c.moveTo(px-7,py+1);c.lineTo(px+7,py-1);c.stroke();}
  c.strokeStyle=col;c.lineWidth=3;c.beginPath();c.moveTo(8,42);c.lineTo(32,50);c.stroke();c.beginPath();c.arc(39,50,9,0,7);c.fill();c.restore();}
// propaganda poster for the Leader (invented): the four-eyed Leader in a sunburst, bold lettering
function leaderPoster(title,sub,bg,mask){return canvas(1024,460,(g,w,h)=>{g.fillStyle=bg;g.fillRect(0,0,w,h);const cx=250,cy=mask?215:250;g.save();g.translate(cx,cy);for(let k=0;k<20;k++){g.rotate(Math.PI/10);g.fillStyle=k%2?'#e0b23a':bg;g.globalAlpha=k%2?.55:1;g.beginPath();g.moveTo(0,0);g.lineTo(700,-110);g.lineTo(700,110);g.fill();}g.restore();g.globalAlpha=1;
  leaderAlien(g,cx,cy);leaderText(g,title,sub);});}
function leaderText(g,title,sub){g.fillStyle='rgba(0,0,0,.6)';g.fillRect(470,70,520,320);g.strokeStyle='#e0b23a';g.lineWidth=8;g.strokeRect(470,70,520,320);g.textAlign='center';g.textBaseline='middle';
  g.font='900 '+(title.length>12?84:120)+'px Impact,"Arial Black",Arial';g.fillStyle='#000';g.fillText(title,736,186,480);g.fillStyle='#f4ead2';g.fillText(title,730,180,480);g.font='700 38px Georgia,serif';g.fillStyle='#e0b23a';g.fillText(sub,730,320,480);}
// the Leader (from the owner's four-eyed alien toy): a wide, flat-topped tan head with big rounded ears out to the sides and two small horn-ears on top,
// four shiny black bead eyes in a curved row, a small wrinkled nose and mouth, a thin neck, a dark brown ribbed robe with a V-neck and big tan hands
function leaderAlien(g,cx,cy){const E=(x,y,rx,ry,c,r)=>{g.fillStyle=c;g.beginPath();g.ellipse(x,y,rx,ry,r||0,0,7);g.fill();},SK='#d9a07e',SD='#b07658',LN='rgba(105,58,38,.7)';
  g.save();g.translate(cx,cy);g.lineCap='round';
  g.fillStyle='#3b2419';g.beginPath();g.moveTo(-150,260);g.lineTo(-140,95);g.quadraticCurveTo(-130,52,-70,48);g.lineTo(70,48);g.quadraticCurveTo(130,52,140,95);g.lineTo(150,260);g.fill();   // the robe
  g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=3;for(let x=-120;x<=120;x+=12){g.beginPath();g.moveTo(x,80);g.lineTo(x*1.05,260);g.stroke();}   // its ribbing
  g.strokeStyle='rgba(0,0,0,.5)';g.lineWidth=4;for(const s of[-1,1]){g.beginPath();g.moveTo(s*100,70);g.quadraticCurveTo(s*96,150,s*112,200);g.stroke();}   // the sleeves against the body
  for(const s of[-1,1]){E(s*128,212,34,40,SK,s*.2);g.fillStyle=SK;for(let k=0;k<4;k++){g.beginPath();g.ellipse(s*(108+k*12),246,7,16,0,0,7);g.fill();}g.strokeStyle=LN;g.lineWidth=2;for(let k=0;k<3;k++){g.beginPath();g.arc(s*128,205+k*10,16,.3,2.8);g.stroke();}}   // big tan hands
  g.fillStyle=SK;g.beginPath();g.moveTo(-36,48);g.lineTo(36,48);g.lineTo(0,108);g.fill();g.fillRect(-17,0,34,52);   // thin neck and the V-neck
  g.strokeStyle=LN;g.lineWidth=2;for(let k=0;k<3;k++){g.beginPath();g.moveTo(-14,22+k*9);g.quadraticCurveTo(0,28+k*9,14,22+k*9);g.stroke();}
  for(const s of[-1,1]){E(s*118,-52,58,34,SK,-s*.28);E(s*122,-50,40,20,SD,-s*.28);g.fillStyle='#4a2a1e';for(let k=0;k<9;k++){const a=k*1.7;g.beginPath();g.arc(s*(150+Math.cos(a)*14),-62+Math.sin(a)*16,3.5,0,7);g.fill();}}   // big ears, dark speckles on the tips
  for(const s of[-1,1]){E(s*50,-118,17,24,SK,s*.3);E(s*50,-114,9,14,SD,s*.3);}   // the little horn-ears on top
  g.fillStyle=SK;g.beginPath();g.moveTo(-72,-112);g.lineTo(72,-112);g.quadraticCurveTo(98,-110,96,-60);g.quadraticCurveTo(92,-8,50,20);g.quadraticCurveTo(0,40,-50,20);g.quadraticCurveTo(-92,-8,-96,-60);g.quadraticCurveTo(-98,-110,-72,-112);g.fill();   // the wide, flat-topped head
  g.fillStyle='rgba(150,90,60,.35)';g.beginPath();g.ellipse(0,0,46,24,0,0,7);g.fill();   // shading round the muzzle
  g.strokeStyle=LN;g.lineWidth=2.5;for(const s of[-1,1]){g.beginPath();g.moveTo(s*30,-14);g.quadraticCurveTo(s*50,-4,s*48,14);g.stroke();g.beginPath();g.moveTo(s*62,-40);g.quadraticCurveTo(s*72,-30,s*70,-18);g.stroke();}g.beginPath();g.moveTo(-30,-96);g.quadraticCurveTo(0,-104,30,-96);g.stroke();   // wrinkles
  for(const[x,y,r]of[[-66,-64,14],[-23,-74,15],[23,-74,15],[66,-64,14]]){E(x,y+2,r+4,r+3,SD);E(x,y,r,r,'#0d0907');E(x-r*.35,y-r*.38,r*.28,r*.24,'rgba(255,255,255,.85)');}   // four shiny bead eyes
  E(0,-22,14,11,SD);E(-5,-19,3.5,3,'#3a1e14');E(5,-19,3.5,3,'#3a1e14');   // small nose
  g.strokeStyle='#5a2c1c';g.lineWidth=4;g.beginPath();g.moveTo(-20,6);g.quadraticCurveTo(0,14,20,6);g.stroke();   // and mouth
  g.restore();}
// gulls: a few loose flocks wheeling over the water below the cliff and off San Quentin
const GULL={im:null,b:[],M:new THREE.Matrix4(),Q:new THREE.Quaternion(),S:new THREE.Vector3(),V:new THREE.Vector3(),W:new THREE.Vector3(),E:new THREE.Euler()};
function gullTick(){const B=GULL,on=PL.idx>CLF[0]-200&&PL.idx<Z.rb0;
  if(!B.im){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array([0,0,.13, 0,0,-.12, -.38,.16,-.06, 0,0,.13, .38,.16,-.06, 0,0,-.12]),3));
    B.im=new THREE.InstancedMesh(g,new THREE.MeshBasicMaterial({color:0xf0efe8,side:THREE.DoubleSide}),36);B.im.frustumCulled=false;B.im.count=0;scene.add(B.im);
    B.c=[[(CLF[0]+CLF[1])/2,70,4],[CLF[1]+20,150,12],[Z.sq+Math.round(150/SEG),110,14]];for(let k=0;k<36;k++)B.b.push({f:k%3,r:R(6,28),ph:R(0,6.3),w:R(.25,.5)*(k%2?1:-1),h:R(-3,6)});}
  if(!on){B.im.count=0;return;}const tm=tmNow();
  for(let k=0;k<36;k++){const b=B.b[k],c=B.c[b.f],a=tm*b.w+b.ph,fy=y=>y-H[c[0]]+c[2]+22;
    at(c[0]*SEG+Math.cos(a)*b.r*2,c[1]+Math.sin(a)*b.r,fy(b.h+Math.sin(a*2)*1.5),B.V);at(c[0]*SEG+Math.cos(a+.05*Math.sign(b.w))*b.r*2,c[1]+Math.sin(a+.05*Math.sign(b.w))*b.r,fy(b.h),B.W);
    B.E.set(0,Math.atan2(B.W.x-B.V.x,B.W.z-B.V.z),Math.sin(a)*.3);B.Q.setFromEuler(B.E);const fl=Math.sin(tm*8+b.ph);B.S.set(2.2,fl*2.2,2.2);B.M.compose(B.V,B.Q,B.S);B.im.setMatrixAt(k,B.M);}
  B.im.count=36;B.im.instanceMatrix.needsUpdate=true;}
// ---- freeway earthquakes (free drive): one strong quake on each freeway stretch (I-880, I-80, the Marin freeway), once per drive, at a random point.
// A rumble that builds, the sky going dark, cracks running across the lanes ahead, then the road splits open in a jagged fissure across all but one lane.
// Traffic brakes and squeezes past in the open lane; hit the fissure and the car takes a hard jolt, or at speed it crashes. A short aftershock follows.
// Each quake keeps its own lists of the cracks and debris it lays (q.cr, q.deb), so clearing it never touches the Bay Bridge's or the city's.
function sfxRumble(){if(!AC)return;const t=AC.currentTime;tone('sine',30,t,7,.9,master,{to:44,a:4.5,h:.85});tone('triangle',52,t+.6,6,.3,master,{to:46,a:4,h:.85});for(let k=0;k<6;k++)hit(t+k*.85,1.7,.12+.13*k,70+k*12,'lowpass',master);}
if(DRIVE){FQ.list=[[Z.tu1,Z.detour,'I-880'],[Z.i80,Z.wt1,'I-80'],[Z.gg1,Z.sq,'MARIN']].map(([a,b,nm])=>({a,b,nm,st:0,t:0,ti:0,cr:[],deb:[],F:null}));fqArm();
  // lane lines on the approach to the toll plaza: dashes between the four lanes
  {const m_=x=>Math.round(x/SEG),a=Z.detour+m_(170),b=Z.toll+m_(110),n=(Math.ceil((b-a)/6)+1)*2,up=new THREE.Vector3(0,1,0),im=new THREE.InstancedMesh(new THREE.PlaneGeometry(.16,3.2).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xe6e2d2,transparent:true,opacity:.82,polygonOffset:true,polygonOffsetFactor:-3}),n);let k=0;
    for(let i=a;i<b&&k<n-1;i+=6)for(const sd of[-1,1]){at(i*SEG,sd*(RW+XW[i])*.5,.05,V);Q.setFromAxisAngle(up,yaw(i));M4.compose(V,Q,S.set(1,1,1));im.setMatrixAt(k++,M4);}im.count=k;im.frustumCulled=false;scene.add(im);FQ.lines=im;}}
function fqCrack(q,s,lat){crackRoad(s,lat);q.cr.push(CRACKS[CRACKS.length-1]);}
function fqDeb(q,s,lat,h,delay,sc,vy){spawnDeb(s,lat,h,'chunk',delay,false,0,sc);const d=DEB[DEB.length-1];d.vy=vy;q.deb.push(d);}
function fqClear(q){for(const m of q.cr){const k=CRACKS.indexOf(m);if(k>=0)CRACKS.splice(k,1);scene.remove(m);m.geometry.dispose();}q.cr.length=0;
  for(const d of q.deb){const k=DEB.indexOf(d);if(k>=0)DEB.splice(k,1);scene.remove(d.m);d.m.geometry.dispose();if(d.ob){const j=OBST.indexOf(d.ob);if(j>=0)OBST.splice(j,1);}}q.deb.length=0;
  const Fs=q.Fs||(q.F?[q.F]:[]);if(FQ.cm)for(const c of FQ.cm)if(Fs.includes(c.F)){c.t=0;c.o.visible=false;}
  for(const F of Fs)for(const o of F.parts){scene.remove(o);if(o.geometry!==FQ.slabG)o.geometry.dispose();}q.F=null;q.Fs=null;q.fe=0;}
function fqArm(){const m_=x=>Math.round(x/SEG);for(const q of FQ.list){fqClear(q);const lo=q.a+m_(250),hi=Math.max(lo,q.b-m_(900));q.ti=Math.round(lo+Math.random()*(hi-lo));q.st=0;q.t=0;}}   // a new drive: a new place for each quake
function fqAfterReset(){for(const q of FQ.list)if(q.st===1&&q.t>5){fqClear(q);q.st=2;}}
// the fissure: N points across the road from beyond the far edge to just short of the open lane, each with a jag (c, metres along the road) and a width;
// a black core inside a dark brown rim, and plates of broken asphalt tipped up along both lips
function fqFissure(q,s,sd,hole=0){const i=wrapI(Math.floor(s/SEG)),w=RW+XW[i],edge=-sd*(w+.8),tip=sd*(w*.5-.35),N=18,pts=[];let c=0;
  for(let j=0;j<N;j++){const u=j/(N-1);c=clamp((j%2?1:-1)*R(.8,2.2)+c*.3,-3,3);pts.push({lat:lerp(edge,tip,u),c,u,hw:R(1.5,2.3)*(hole?1.7:1)*Math.min(1,(1-u)*N/2.5+.06),h:0});}
  const strip=(col,po)=>{const g=new THREE.BufferGeometry(),idx=[];g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(N*6),3));for(let j=0;j<N-1;j++){const a=j*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}g.setIndex(idx);
    const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:col,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:po}));m.frustumCulled=false;scene.add(m);return m;};
  const rim=strip(0x2c2620,-5),core=strip(0x060505,-9),parts=[rim,core],slabs=[];
  if(!FQ.slabG){FQ.slabG=new THREE.BoxGeometry(1,.2,1);FQ.slabM=std({color:0x2c2d30,roughness:.95});}
  for(let j=0;j<N;j++)for(const side of[-1,1]){if(Math.random()<.08)continue;const o=new THREE.Mesh(FQ.slabG,FQ.slabM);o.scale.set(R(1,2),1.4,R(.8,1.5));o.castShadow=true;o.visible=false;scene.add(o);parts.push(o);slabs.push({o,j,side,tilt:R(.55,1.15),dl:R(-.4,.4),sp:R(0,6)});}
  return{s,sd,pts,rim,core,slabs,parts,kL:0,kW:0,wid:1,t0:q.t,prev:null,ch:0,lo:Math.min(edge,tip),hi:Math.max(edge,tip),free:sd*w*.75,edge,tip};}
function fqShape(F){const N=F.pts.length,rp=F.rim.geometry.attributes.position,cp=F.core.geometry.attributes.position;
  for(let j=0;j<N;j++){const p=F.pts[j],vis=clamp((F.kL-p.u)*6,0,1),h=p.hw*F.kW*vis*F.wid;p.h=h;
    for(const[e,sg]of[[0,1],[1,-1]]){at(F.s+p.c+sg*(h+.45*Math.min(1,h*4)),p.lat,.05,V);rp.setXYZ(j*2+e,V.x,V.y,V.z);at(F.s+p.c+sg*h*.72,p.lat,.06,V);cp.setXYZ(j*2+e,V.x,V.y,V.z);}}
  rp.needsUpdate=cp.needsUpdate=true;const i=wrapI(Math.floor(F.s/SEG)),yw=yaw(i);
  for(const b of F.slabs){const p=F.pts[b.j];b.o.visible=p.h>.06;if(!b.o.visible)continue;at(F.s+p.c+b.side*(p.h+.32),p.lat+b.dl,.08+b.tilt*.6*Math.min(1,p.h*2),b.o.position);b.o.rotation.set(-b.side*b.tilt*Math.min(1,p.h*2),yw+b.sp*.05,b.sp*.03,'YXZ');}}
// the lips crumbling: chunks of asphalt break off the edges, tip over, slide in and drop into the dark (a small reused pool)
function fqCrumble(F,n){if(!FQ.cm){FQ.cm=[];const dg=new THREE.DodecahedronGeometry(.45,0);for(let q=0;q<40;q++){const o=new THREE.Mesh(q%3?FQ.slabG:dg,FQ.slabM);o.castShadow=true;o.visible=false;scene.add(o);FQ.cm.push({o,t:0});}}
  for(let q=0;q<n;q++){const p=F.pts[Math.random()*F.pts.length|0];if(p.h<.12)continue;const c=FQ.cm.find(o=>o.t<=0);if(!c)return;const side=Math.random()<.5?-1:1;
    c.t=R(1.6,2.6);c.F=F;c.p=p;c.side=side;c.d=p.h+R(.15,.7);c.y=.1;c.vy=0;c.vd=-R(.5,1.4);c.rx=R(0,.2);c.w=R(1.2,3.5);c.dl=R(-.5,.5);c.o.scale.set(R(.4,1.1),R(.8,1.8),R(.4,1));c.o.visible=true;
    NOGY=1;puff(at(F.s+p.c+side*c.d,p.lat,.2,V),R(-1,1),R(1,3),R(-1,1),1,R(2,4),R(1,2),.5,0x9a9080);NOGY=0;}}
function fqCrumbleTick(rdt){if(!FQ.cm)return;for(const c of FQ.cm){if(c.t<=0)continue;c.t-=rdt;const F=c.F;
    if(c.d>c.p.h*.7){c.d+=c.vd*rdt;c.rx+=c.w*.5*rdt;c.y=.1;}else{c.vy-=12*rdt;c.y+=c.vy*rdt;c.d=Math.max(0,c.d+c.vd*.4*rdt);c.rx+=c.w*rdt;}   // tipping and sliding over the lip, then falling
    at(F.s+c.p.c+c.side*c.d,c.p.lat+c.dl,c.y,c.o.position);c.o.rotation.set(-c.side*c.rx,yaw(wrapI(Math.floor(F.s/SEG))),c.dl*.4,"YXZ");if(c.t<=0||c.y<-4){c.t=0;c.o.visible=false;}}}
// each step of the split: a jolt, a deep rumble, a burst of dust and chunks of road thrown up
function fqStep(q,F){G.shake=q.nm==='MARIN'?.45:1;const hole=q.nm==='I-80';sfxCrunch(1);if(AC){const t=AC.currentTime;tone('sine',32,t,1.6,.9,master,{to:24,a:.04,h:.4});hit(t,1.3,1.1,90,'lowpass',master);}
  fqCrumble(F,7);NOGY=1;for(let k=0;k<16;k++){const p=F.pts[Math.random()*F.pts.length|0];puff(at(F.s+p.c,p.lat,.3,V),R(-3,3),R(3,8),R(-3,3),1.2,R(4,8),R(1.6,3.2),.65,0x9a9080);}NOGY=0;
  if(!hole)for(let k=0;k<4;k++){const p=F.pts[Math.random()*F.pts.length*.8|0];fqDeb(q,F.s+p.c+R(-1.5,1.5),p.lat,R(.3,.9),0,R(.2,.4),R(5,11));}}
// The Golden Gate, once a drive: a rolling earthquake runs along the bridge. The bridge itself is baked into the static scenery, so the travelling wave is
// carried by the car (pushed side to side) and the view (rolling and heaving), with a deep rumble and the sky going dark.
const GGQ={st:0,t:0,sw:0};
function ggqTick(rdt){const q=GGQ,i=PL.idx;G.heave=0;if(!DRIVE)return;
  if(q.st===2&&i<Z.b1)q.st=0;   /* a new lap: armed again */
  if(q.st===0){if(G.state==='race'&&!PL.crash&&i>Z.gg0+(Z.gg1-Z.gg0)*.2&&i<Z.gg0+(Z.gg1-Z.gg0)*.6){q.st=1;q.t=0;q.sw=0;G.qd=1;sfxRumble();sfxQuake();say('EARTHQUAKE !','THE BRIDGE IS ROLLING - HOLD IT STEADY',5);}return;}
  if(q.st!==1)return;q.t+=rdt;const t=q.t,env=sst(t,0,2.5)*(1-sst(t,11,15));
  if(t>15||PL.crash||i<Z.gg0||i>Z.gg1+40){q.st=2;return;}
  const s=PL.idx*SEG,ph=s/230-t*.9;   /* a long, slow wave (about 230 m) rolling along the deck: a gentle twist, like the Bay Bridge's sway, not a jolt */
  G.roll=(G.roll||0)+env*.04*Math.sin(ph*6.283);G.heave=env*.3*Math.sin(ph*6.283+1.3);
  const lat=env*.6*Math.sin(ph*6.283+.6),d=lat-q.sw;q.sw=lat;const n=Nn[i];PL.x+=n.x*d;PL.z+=n.z*d;
  G.shake=Math.max(G.shake,.06+.1*env);if(t>6&&t<6.1&&!q.af){q.af=1;sfxQuake();}}
// Bridge quakes (Bay Bridge and Golden Gate): hanging cables snap. Each is a loose strand of its own (the bridge itself is baked into the scenery), hung from the main cable
// between the fixed ones: its deck end breaks free with a twang, whips and swings out over the water, and some break at the top as well and drop into the bay.
const SNAP={l:[],cd:0};
function sfxTwang(v){if(!AC)return;const t=AC.currentTime;tone('sawtooth',R(380,560),t,.7,.22*v,master,{to:R(70,110),a:.003,h:.2,lp:2600});hit(t,.12,.45*v,3200,'bandpass',master);}
function snapTick(rdt){const S=SNAP,pe=ents.find(e=>e.player);if(!pe||!BRH.length)return;
  if(!S.l.length){const M=std({color:0x767c81,roughness:.5,metalness:.6}),geo=new THREE.CylinderGeometry(.08,.08,1,5).translate(0,-.5,0);
    for(let k=0;k<48;k++){const g=new THREE.Group(),m=new THREE.Mesh(geo,M);g.add(m);g.visible=false;scene.add(g);S.l.push({g,m,st:0});}}
  const on=(QK&&QK.st===1&&QK.t>.4&&QK.t<9)||(GGQ.st===1&&GGQ.t>1&&GGQ.t<13);
  if(on){S.cd-=rdt;if(S.cd<=0){S.cd=QK&&QK.st===1?R(.06,.22):R(.2,.6);let i=0,br=null,bt=-1;for(let q=0;q<6;q++){const i2=wrapI(Math.floor((pe.s+R(18,130))/SEG)+3),b2=BRH.find(b=>i2>b.c0+4&&i2<b.c1-4);if(b2){const h2=b2.hgt(i2);if(h2>bt){bt=h2;i=i2;br=b2;}}}const k=S.l.find(o=>!o.st);   /* of several candidates the longest hanging cable is the one that goes */
    if(br&&k){const top=br.hgt(i),L=top-1.2;if(L>3){const sd=Math.random()<.5?-1:1;k.st=1;k.t=0;k.L=L;k.i=i;k.drop=Math.random()<(L>14?.6:.4);k.vy=0;k.a=0;k.w=sd*R(1.4,2.6);
      off(i,sd*(10.3+XW[i]),top,k.g.position);k.g.rotation.set(0,yaw(i),0);k.m.scale.set(1,L,1);k.m.rotation.set(0,0,0);k.g.visible=true;
      sfxTwang(clamp(50/(Math.abs(wdiff(i*SEG-pe.s))+15),.25,1));}}}}
  for(const k of S.l){if(!k.st)continue;k.t+=rdt;const t=k.t;
    k.w+=(-Math.sin(k.a)*9.8/Math.max(5,k.L)-k.w*.3)*rdt;k.a+=k.w*rdt;k.m.rotation.z=k.a+Math.sin(t*24)*.08*Math.exp(-t);   // a damped swing from the top, with a whip at first
    if(k.drop&&t>.8){k.vy-=20*rdt;k.g.position.y+=k.vy*rdt;k.m.rotation.x+=rdt*1.2;}
    if(t>10||k.g.position.y<-60||Math.abs(wdiff(k.i*SEG-pe.s))>450){k.st=0;k.g.visible=false;}}}
// An airliner for the airport by I-880: white, with a blue fin and two engines under the wings. Nose along +z.
function AIRmk(){const g=new THREE.Group(),bd=std({color:0xf2f2ee,roughness:.5,metalness:.2}),bl=std({color:0x2a4a8a,roughness:.5}),eg=std({color:0xb0b4b8,roughness:.4,metalness:.5});
  const bx=(sx,sy,sz,mm,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mm);o.position.set(x,y,z);g.add(o);return o;};
  const f=new THREE.Mesh(cyl(2,2,38,12),bd);f.rotation.x=Math.PI/2;f.position.y=4.2;g.add(f);
  const nose=new THREE.Mesh(new THREE.SphereGeometry(2,12,8),bd);nose.scale.set(1,1,1.8);nose.position.set(0,4.2,19);g.add(nose);
  const tail=new THREE.Mesh(new THREE.ConeGeometry(2,8,12),bd);tail.rotation.x=-Math.PI/2;tail.position.set(0,4.6,-23);g.add(tail);
  bx(36,.5,6,bd,0,3.6,1);bx(12,.4,3.5,bd,0,5,-22);bx(.5,8,5,bl,0,9,-22);
  for(const x of[-8,8]){const en=new THREE.Mesh(cyl(1.1,1.1,4,10),eg);en.rotation.x=Math.PI/2;en.position.set(x,2.4,3);g.add(en);}
  g.traverse(o=>{o.castShadow=true;});return g;}
// Now and then while you are on I-880 a plane rolls down the runway, lifts off and climbs away out over the bay.
function planesTick(rdt){const A=AIR;if(!A.A)return;const i=PL.idx,on=i>Z.tu1&&i<Z.detour+Math.round(200/SEG);
  if(!A.g){A.g=AIRmk();A.g.visible=false;A.g.rotation.order='YXZ';scene.add(A.g);A.D=A.B.clone().sub(A.A).normalize();}
  if(A.st===0){A.g.visible=false;if(!on)return;A.cd-=rdt;if(A.cd>0)return;A.st=1;A.t=0;A.cd=R(16,30);A.land=Math.random()<.45;A.g.visible=true;}
  A.t+=rdt;if(A.land){const t=A.t;let s,y=0,p=0;if(t<10){s=-600+60*t;y=-s*.08;p=-.06;}else{const u=Math.min(t-10,15);s=60*u-2*u*u;}A.g.position.copy(A.A).addScaledVector(A.D,s);A.g.position.y+=y;A.g.rotation.set(-p,A.ry,0);if(t>31)A.st=0;return;}   // landings: down the glide slope, touch down, brake
const t=A.t,acc=3.4,vR=68,tR=vR/acc;let s,y=0,p=0;
  if(t<tR)s=.5*acc*t*t;else{const u=t-tR;s=.5*acc*tR*tR+vR*u+.6*u*u;y=u*3.2+u*u*.35;p=Math.min(.2,u*.09);}
  A.g.position.copy(A.A).addScaledVector(A.D,s);A.g.position.y+=y;A.g.rotation.set(-p,A.ry,0);if(t>tR+50)A.st=0;}
// The steel mill's stacks and blast furnace belch black smoke while you are anywhere along I-880.
function craneTick(rdt){if(!CRN.length)return;const i=PL.idx;if(!(i>Z.tu1&&i<Z.detour))return;   // the port cranes slew a little now and then
  for(const c of CRN){if(c.a>0){c.a-=rdt;c.g.rotation.y=c.ry+Math.sin((1-Math.max(c.a,0)/c.d)*Math.PI)*c.k;}else{c.t-=rdt;if(c.t<=0){c.t=R(10,35);c.d=R(6,10);c.a=c.d;c.k=R(-.16,.16);}}}}
// Now and then a driver tosses a bottle, can, cup or paper bag out of the driver's-side window; it lands in the road, stays for a while and bumps the car if you drive over it (no crash).
function litterTick(rdt){if(!DRIVE||G.state!=='race')return;const L=LIT;
  if(!L.p){const gs=[new THREE.CylinderGeometry(.05,.05,.26,6),new THREE.CylinderGeometry(.06,.06,.12,6),new THREE.CylinderGeometry(.05,.04,.12,6),new THREE.BoxGeometry(.2,.2,.1)],cs=[0x2f7a3a,0xb8bcc0,0xf2f0e0,0xb89060];L.p=[];for(let k=0;k<30;k++){const m=new THREE.Mesh(gs[k%4],new THREE.MeshStandardMaterial({color:cs[k%4],roughness:.6}));m.visible=false;scene.add(m);L.p.push({m,st:0,vx:0,vy:0,vz:0,gy:0,life:0});}}
  L.t-=rdt;if(L.t<=0){L.t=R(2.5,5);const near=TRAF.filter(t=>t.act&&!t.fall&&(t.kind==='car'||t.kind==='pickup'||t.kind==='truck')&&(t.g.position.x-PL.x)**2+(t.g.position.z-PL.z)**2<150*150&&(t.g.position.x-PL.x)**2+(t.g.position.z-PL.z)**2>25*25),t=near[Math.random()*near.length|0],p=L.p.find(q=>q.st===0);
    if(t&&p){const h=t.g.rotation.y,fx=Math.sin(h),fz=Math.cos(h),lx=Math.cos(h),lz=-Math.sin(h),sp=Math.max(t.v||10,6);p.st=1;p.life=0;p.gy=t.g.position.y;p.m.visible=true;p.m.scale.setScalar(1);p.m.position.set(t.g.position.x+lx*1,p.gy+1.1,t.g.position.z+lz*1);p.vx=fx*sp*.85+lx*R(2,4);p.vz=fz*sp*.85+lz*R(2,4);p.vy=R(2,4);p.m.rotation.set(R(0,6),R(0,6),R(0,6));}}
  for(const p of L.p){if(p.st===0)continue;const m=p.m;if(p.st===1){p.vy-=18*rdt;m.position.x+=p.vx*rdt;m.position.y+=p.vy*rdt;m.position.z+=p.vz*rdt;m.rotation.x+=9*rdt;if(m.position.y<=p.gy+.06){m.position.y=p.gy+.06;p.st=2;p.life=0;m.rotation.set(Math.PI/2,R(0,6),0);}}
    else{p.life+=rdt;if(p.life>22)m.scale.setScalar(Math.max(0,1-(p.life-22)/3));if(p.life>25){p.st=0;m.visible=false;continue;}
      const dx=m.position.x-PL.x,dz=m.position.z-PL.z;if(dx*dx+dz*dz<1.5&&Math.hypot(PL.vx,PL.vz)>4&&!PL.crash&&!PL.air){PL.bump=Math.max(PL.bump||0,.7);G.shake=Math.max(G.shake,.25);PL.vx*=.985;PL.vz*=.985;sfxScrape(.3);p.st=1;p.vx=PL.vx*.6+R(-2,2);p.vz=PL.vz*.6+R(-2,2);p.vy=R(3,5);}}}}   // run over: a little bump, and it is kicked up
// An ominous flock of turkeys waits at the Richmond entrance, motionless and facing you; at about 45 m they all fly up and away (once per run).
const RTK={g:null,st:0,t:0};
function rtkTick(rdt){if(!DRIVE||!TK.length)return;const a=Z.richmond-Math.round(120/SEG);
  if(PL.idx<Z.rb1){if(RTK.st){RTK.st=0;if(RTK.g)for(const o of RTK.g)o.m.visible=false;}return;}
  if(RTK.st===0&&Math.abs(PL.idx-a)<Math.round(450/SEG)){if(!RTK.g){RTK.g=[];for(let k=0;k<12;k++){const m=TK[0].m.clone(true);scene.add(m);RTK.g.push({m,vx:0,vy:0,vz:0,x0:R(-6,6),l0:R(-7,7)});}}
    for(const o of RTK.g){at(a*SEG+o.x0,o.l0,0,o.m.position);o.m.rotation.set(0,yaw(a)+Math.PI,0);o.m.scale.setScalar(1.25);o.m.visible=true;const w=o.m.children;w[w.length-1].rotation.z=0;w[w.length-2].rotation.z=0;}RTK.st=1;RTK.t=0;}
  if(RTK.st===1){at(a*SEG,0,0,V);if((V.x-PL.x)**2+(V.z-PL.z)**2<45*45){RTK.st=2;RTK.t=0;for(const o of RTK.g){o.vy=R(7,12);o.vx=R(-5,5);o.vz=R(-5,5);}}}
  else if(RTK.st===2){RTK.t+=rdt;for(const o of RTK.g){if(!o.m.visible)continue;o.m.position.x+=o.vx*rdt;o.m.position.y+=o.vy*rdt;o.m.position.z+=o.vz*rdt;o.vy+=1.5*rdt;const w=o.m.children,fl=Math.sin(RTK.t*34+o.x0)*1.1;w[w.length-1].rotation.z=fl;w[w.length-2].rotation.z=-fl;if(RTK.t>5){o.m.visible=false;}else if(RTK.t>3.5)o.m.scale.setScalar(1.25*(1-(RTK.t-3.5)/1.5));}}}
// I-80: the far scenery across the bay follows the car slowly, tinted by the haze; shafts of sun when the storm breaks; and flocks of gulls and pelicans wheeling over the water,
// one every few seconds folding its wings and diving in with a splash, then bobbing up and flying back to the flock
function bayTick(rdt){const V0=BAYV;if(!V0||!DRIVE)return;const m_=x=>Math.round(x/SEG),i=PL.idx,on=i>Z.i80-m_(150)&&i<Z.wt1-m_(150),B=BAYB;V0.g.visible=on;
  if(!B.im){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array([0,0,.13, 0,0,-.12, -.38,.16,-.06, 0,0,.13, .38,.16,-.06, 0,0,-.12]),3));
    B.im=new THREE.InstancedMesh(g,new THREE.MeshBasicMaterial({color:0xf0efe8,side:THREE.DoubleSide}),30);B.pm=new THREE.InstancedMesh(g,new THREE.MeshBasicMaterial({color:0x6e655a,side:THREE.DoubleSide}),10);   // unlit like the gulls: a lit (Lambert) instanced mesh here blacked out most of the screen on I-80
    for(const o of[B.im,B.pm]){o.frustumCulled=false;o.count=0;scene.add(o);}B.M=new THREE.Matrix4();B.Q=new THREE.Quaternion();B.E=new THREE.Euler(0,0,0,'YXZ');B.S=new THREE.Vector3();B.P=new THREE.Vector3();
    for(let k=0;k<3;k++)B.c.push({i:-1e9,lat:0,y:30});for(let k=0;k<40;k++){const pel=k>=30;B.b.push({pel,k:pel?k-30:k,f:pel?2:k%2,r:pel?R(30,60):R(10,40),ph:R(0,6.3),w:(pel?R(.12,.2):R(.25,.5))*(k%3?1:-1),h:R(-4,6),st:0,t:0,x:0,y:0,z:0,x0:0,y0:0,z0:0,vx:0,vz:0,hd:0});}}
  if(!on){B.im.count=B.pm.count=0;return;}
  V0.g.position.set(0,0,PL.z*.9-550);const fc=scene.fog.color;for(const mm of V0.mats)mm.color.copy(fc).lerp(mm.userData.tint,mm.userData.k);
  const tm=tmNow(),br=(G.i8s||0)*sst(Math.sin(tm*.13),.05,.7)*dayK;for(const r of V0.rays){r.m.material.opacity=br*r.o*(.75+.25*Math.sin(tm*.7+r.ph));r.m.visible=r.m.material.opacity>.005;r.m.getWorldPosition(V);r.m.rotation.y=Math.atan2(camera.position.x-V.x,camera.position.z-V.z);}
  const pe=ents.find(e=>e.player);if(!pe)return;
  for(const c of B.c)if(wdiff(c.i*SEG-pe.s)<-60||wdiff(c.i*SEG-pe.s)>900){c.i=wrapI(i+m_(R(220,520)));c.lat=-(RW+XW[c.i]+R(70,280));c.y=R(24,46);}   // each flock waits out over the water ahead
  const sea=c=>c.i>STORM.a&&c.i<STORM.b,ctr=(c,o)=>o.set(P[c.i].x+Nn[c.i].x*c.lat,c.y,P[c.i].z+Nn[c.i].z*c.lat);
  B.cd-=rdt;if(B.cd<=0){B.cd=R(1.4,3.4);const cand=B.b.filter(b=>b.st===0&&sea(B.c[b.f]));const b=cand[Math.random()*cand.length|0];if(b){b.st=1;b.t=0;b.x0=b.x;b.y0=b.y;b.z0=b.z;b.T=b.pel?1.4:1.05;}}   // one of them dives
  let ni=0,np=0;
  for(const b of B.b){const c=B.c[b.f],a=tm*b.w+b.ph;ctr(c,V);let pitch=0,roll=0,fold=0;
    const cx=V.x+Math.cos(a)*b.r*(b.pel?2:1.4),cz=V.z+Math.sin(a)*b.r,cy=V.y+b.h+Math.sin(a*2)*1.5,hd=Math.atan2(-Math.sin(a)*b.w*(b.pel?2:1.4),Math.cos(a)*b.w);
    if(b.st===0){b.x=cx;b.y=cy;b.z=cz;b.hd=hd;roll=-Math.sign(b.w)*.35;}
    else if(b.st===1){b.t+=rdt/b.T;const u=Math.min(1,b.t);b.x=b.x0+Math.sin(b.hd)*u*30;b.z=b.z0+Math.cos(b.hd)*u*30;b.y=lerp(b.y0,.1,u*u);pitch=lerp(.3,1.35,u);fold=1;
      if(u>=1){b.st=2;b.t=0;const d2=(b.x-PL.x)**2+(b.z-PL.z)**2;if(d2<900*900){NOGY=1;for(let q=0;q<(b.pel?9:5);q++)puff(V.set(b.x+R(-1,1),.3,b.z+R(-1,1)),R(-2,2),R(3,b.pel?9:6),R(-2,2),.6,R(2,b.pel?5:3),R(.9,1.6),.75,0xeef2f4);NOGY=0;if(d2<160*160)sfxSplash();}}}   // in it goes, with a splash
    else if(b.st===2){b.t+=rdt;b.y=-2;if(b.t>1.5){b.st=3;b.t=0;b.x0=b.x;b.z0=b.z;}}   // under, then bobbing back up
    else{b.t+=rdt/2.6;const u=Math.min(1,b.t),e=u*u*(3-2*u);b.x=lerp(b.x0,cx,e);b.y=lerp(.2,cy,e);b.z=lerp(b.z0,cz,e);b.hd=Math.atan2(cx-b.x0,cz-b.z0);pitch=-.35*(1-u);if(u>=1)b.st=0;}   // and away, back up to the flock
    if(b.y<-1)continue;const fl=fold?.25:Math.sin(tm*(b.pel?4.5:8)+b.ph)*(b.pel?.5:1),sc=b.pel?4.2:2.2;
    B.E.set(pitch,b.hd,roll);B.Q.setFromEuler(B.E);B.S.set(sc*(fold?.45:1),fl*sc,sc*(fold?1.4:1));B.M.compose(B.P.set(b.x,b.y,b.z),B.Q,B.S);(b.pel?B.pm:B.im).setMatrixAt(b.pel?np++:ni++,B.M);}
  B.im.count=ni;B.pm.count=np;B.im.instanceMatrix.needsUpdate=B.pm.instanceMatrix.needsUpdate=true;}
function stormTick(rdt){if(!STORM.ships.length||PL.idx<STORM.a-Math.round(300/SEG)||PL.idx>STORM.b+Math.round(300/SEG))return;const t=tmNow();STORM.tex.offset.set(t*.02,t*.03);
  if(STORM.wv){const W=STORM.wv;W.l.forEach((w,k)=>{const p=(t*w.sp+w.ph)%1,lat=-(RW+XW[w.i]+28+(1-p)*460),h=(.6+1.6*Math.sin(p*Math.PI))*(.8+.4*Math.sin(t*1.7+k)),y=.1-h*.35;off(w.i,lat,0,V);V.y=y;Q.setFromEuler(E.set(0,yaw(w.i)+Math.sin(k)*.25,0));   // each swell rolls in, rears up and flattens out near the shore
    M4.compose(V,Q,S.set(2.2,h,w.L));W.bd.setMatrixAt(k,M4);V.y=y+h*.95;M4.compose(V,Q,S.set(1.2,.35,w.L*.9));W.cr.setMatrixAt(k,M4);});W.bd.instanceMatrix.needsUpdate=W.cr.instanceMatrix.needsUpdate=true;}
  for(const s of STORM.ships){const g=s.g;g.rotation.x=Math.sin(t*s.sp+s.ph)*s.am;g.rotation.z=Math.sin(t*s.sp*1.3+s.ph*2)*s.am*1.4;g.position.y=.1+Math.sin(t*s.sp*1.1+s.ph)*.5*(s.am*10);
    if(s.smoke&&Math.random()<rdt*3&&(g.position.x-PL.x)**2+(g.position.z-PL.z)**2<700*700){NOGY=1;puff(V.set(g.position.x,g.position.y+5,g.position.z),R(-.3,.3)+1,R(1.5,3),R(-.3,.3),.5,R(4,7),R(3,5),.5,0x3a3836);NOGY=0;}}}
function sfSmokeTick(rdt){if(!SFSM.length||Math.abs(PL.idx-Z.b1-Math.round(600/SEG))>Math.round(1100/SEG))return;for(const s of SFSM){s.t-=rdt;if(s.t>0)continue;s.t=R(.7,1.4);NOGY=1;puff(V.set(s.x,s.y,s.z),R(-.5,.5)+1.5,R(3,6),R(-.5,.5),4,R(14,24),R(5,8),.45,0x2a2622);NOGY=0;}}
function bbQuakeTick(rdt){if(!BBQ.length)return;const fq=FQ.list[0],on=!!(fq&&fq.st===1&&fq.t>2.5&&fq.t<14);
  if(fq&&fq.st===0){for(const b of BBQ){if(b.t>=0){b.t=-1;b.ang=0;b.w=0;b.g.rotation.z=0;b.g.position.y=0;}}return;}
  for(const b of BBQ){if(b.t<0){if(on&&Math.abs(PL.idx-b.i)<Math.round(900/SEG)){b.t=0;b.dl=R(0,3.5);}continue;}if(b.t>=0&&b.ang>=1.5)continue;b.t+=rdt;if(b.t<b.dl)continue;
    b.w+=rdt*(b.t-b.dl<.8?.9:3.2);b.ang=Math.min(1.5,b.ang+b.w*rdt);b.g.rotation.z=b.dir*b.ang;
    if(b.ang>=1.5){NOGY=1;for(let q=0;q<10;q++)puff(V.set(b.g.position.x+R(-5,5),.5,b.g.position.z+R(-5,5)),R(-2,2),R(1,4),R(-2,2),1.2,R(5,9),R(1.5,3),.55,0x9a9080);NOGY=0;sfxCrunch(.6);}}}
function millWorkers(rdt){const M=MILLC;if(M.i<0)return;const dx=PL.x-M.x,dz=PL.z-M.z;if(dx*dx+dz*dz>700*700){if(M.w)for(const w of M.w)w.p.visible=false;return;}
  if(!M.w){M.w=[];for(let k=0;k<12;k++){const p=mkPerson(R(.95,1.05));scene.add(p);M.w.push({p,lx:R(-170,100),lz:R(-100,100),tx:0,tz:0,t:0,ph:R(0,6)});}}
  const c=Math.cos(M.ry),s=Math.sin(M.ry);for(const w of M.w){w.t-=rdt;if(w.t<=0){w.t=R(6,14);w.tx=R(-180,110);w.tz=R(-110,110);}const ddx=w.tx-w.lx,ddz=w.tz-w.lz,d=Math.hypot(ddx,ddz);if(d>1){w.lx+=ddx/d*1.1*rdt;w.lz+=ddz/d*1.1*rdt;}w.ph+=rdt*6;
    w.p.position.set(M.x+w.lx*c+w.lz*s,M.y,M.z-w.lx*s+w.lz*c);w.p.rotation.y=M.ry+Math.atan2(ddx,ddz);w.p.visible=true;if(w.p.legs){w.p.legs[0].rotation.x=Math.sin(w.ph)*.5;w.p.legs[1].rotation.x=-Math.sin(w.ph)*.5;}}}
function millTick(rdt){if(!MILL.length||!millP)return;const i=PL.idx;if(!(i>Z.tu1&&i<Z.toll))return;millWorkers(rdt);const fq=FQ.list[0],qk=!!(fq&&fq.st===1&&fq.t>.5&&fq.t<12&&Math.abs(i-MILLC.i)<Math.round(900/SEG));
  for(const w of MILLC.tw){if(!w.s&&qk&&fq.t>w.d)w.s=1;if(w.s===1){w.u=Math.min(1,w.u+rdt/9);const a=1.45*w.u*w.u;w.g.quaternion.setFromAxisAngle(w.ax,a);if(w.me){w.me.x=w.x+w.dx*w.H*Math.sin(a);w.me.z=w.z+w.dz*w.H*Math.sin(a);w.me.y=w.H*Math.cos(a)+1;}if(w.u>=1){w.s=2;NOGY=1;puff(V.set(w.x+w.dx*w.H*.9,3,w.z+w.dz*w.H*.9),0,4,0,2,R(26,40),R(4,6),.7,0x2a2622);NOGY=0;}}}
  if(qk){MILLC.t-=rdt;if(MILLC.t<=0){MILLC.t=R(.12,.3);spawnDeb(MILLC.i*SEG+R(-130,130),-230+R(-70,70),R(25,70),Math.random()<.5?"slab":"chunk",0,false,0,R(1.4,2.4));NOGY=1;const s=MILL[Math.random()*MILL.length|0];if(s)puff(V.set(s.x+R(-20,20),R(8,30),s.z+R(-20,20)),R(-2,2),R(3,8),R(-2,2),2,R(18,34),R(3,5),.6,0x2a2622);NOGY=0;}}
  for(const s of MILL){s.t-=rdt;if(s.t>0)continue;s.t=R(.12,.26)/s.k/(qk?3:1);NOGY=1;emit(millP,mi++,V.set(s.x,s.y,s.z),R(-.8,.8)+2.6,R(5,8),R(-.8,.8),R(12,18)*s.k,R(60,100)*s.k,R(9,13),1,[0x121010,0x1c1916,0x26211d][Math.random()*3|0],-.25);NOGY=0;}}
// The refinery columns and flare stacks send up grey smoke, from the end of the bridge to the I-80 ramp.
function refTick(rdt){if(!REFS.length||!refP)return;const i=PL.idx;if(!(i>Z.rb1-Math.round(900/SEG)&&i<Z.i80+Math.round(300/SEG)))return;
  for(const s of REFS){s.t-=rdt;if(s.t>0)continue;s.t=R(.7,1.3)/s.k;NOGY=1;emit(refP,ri++,V.set(s.x,s.y,s.z),R(-.8,.8)+3,R(4,7),R(-.8,.8),R(10,14)*s.k,R(55,90)*s.k,R(10,14),1,[0x4a4846,0x5e5b57,0x777470][Math.random()*3|0],-.2);NOGY=0;}}
// People for the Alameda streets: a coat or shirt, trousers, a head, and two legs that can swing (g.legs). Materials are shared by colour.
// Pull into the supermarket car park and shoppers stream out of the doors carrying store-bought turkeys (a small pool of people, made on first visit).

function vanTick(rdt){if(!VANS.length)return;const a=Z.paru+Math.round(80/SEG),b=Z.central-Math.round(260/SEG);for(const v of VANS){v.s+=v.dir*v.v*rdt;if(v.s<a*SEG)v.s=b*SEG;else if(v.s>b*SEG)v.s=a*SEG;const i=wrapI(Math.round(v.s/SEG));at(v.s,v.lat,Math.abs(Math.sin(v.s*.9))*.03,v.g.position);v.g.rotation.y=yaw(i)+(v.dir<0?Math.PI:0);v.ob.x=v.g.position.x;v.ob.z=v.g.position.z;}}   // soft: the player is pushed aside, never run over
function shopTick(rdt){if(!SHOP.ic)return;const D=off(SHOP.ic,SHOP.F-6,0),near=(PL.x-D.x)**2+(PL.z-D.z)**2<55*55;
  if(!SHOP.list){if(!near)return;const tg=new THREE.SphereGeometry(.2,8,6),tmat=std({color:0xb8743c,roughness:.8});SHOP.list=[];for(let k=0;k<16;k++){const p=mkPerson(R(.9,1.05)),tk=new THREE.Mesh(tg,tmat);tk.scale.set(.9,.7,1.3);tk.position.set(.3,1,.2);p.add(tk);p.visible=false;p.lat=0;p.ii=0;scene.add(p);SHOP.list.push(p);}}
  SHOP.t-=rdt;if(near&&SHOP.t<=0){const p=SHOP.list.find(q=>!q.visible);if(p){SHOP.t=R(.35,.7);p.visible=true;p.lat=SHOP.F-5;p.ii=SHOP.ic+Math.round(R(-4,4));p.ph=R(0,6);}}
  for(const p of SHOP.list){if(!p.visible)continue;p.lat-=1.5*rdt;if(p.lat<14){p.visible=false;continue;}p.ph+=rdt*9;const i=wrapI(p.ii);off(i,p.lat,.13,p.position);const n=Nn[i];p.rotation.y=Math.atan2(-n.x,-n.z);p.legs[0].rotation.x=Math.sin(p.ph)*.55;p.legs[1].rotation.x=-Math.sin(p.ph)*.55;}}
function mkPerson(h=1){const g=new THREE.Group(),sk=pplM(SKINS[Math.random()*SKINS.length|0]),sh=pplM(SHIRTS[Math.random()*SHIRTS.length|0]),pt=pplM(PANTS[Math.random()*PANTS.length|0]);g.legs=[];
  const bd=new THREE.Mesh(new THREE.BoxGeometry(.46,.62,.26),sh);bd.position.y=1.18;g.add(bd);const hd=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),sk);hd.position.y=1.62;g.add(hd);
  for(const x of[-.26,.26]){const a=new THREE.Mesh(new THREE.BoxGeometry(.1,.56,.12),sh);a.position.set(x,1.16,0);g.add(a);}
  for(const x of[-.11,.11]){const p=new THREE.Group();p.position.set(x,.88,0);const l=new THREE.Mesh(new THREE.BoxGeometry(.16,.86,.18),pt);l.position.y=-.43;p.add(l);g.add(p);g.legs.push(p);}
  if(Math.random()<.25){const ht=new THREE.Mesh(cyl(.17,.17,.12,10),pplM(0x2a2622));ht.position.y=1.76;g.add(ht);}   // a hat now and then
  g.scale.setScalar(h);return g;}
// Pedestrians strolling along the Central Ave pavements, both ways; they step aside if the car comes up onto the pavement. Not solid.
const PEDS={l:[]};
function pedsTick(rdt){const P_=PEDS,pe=ents.find(e=>e.player);if(!pe)return;const a=Z.central+Math.round(20/SEG),b=Z.wilma-Math.round(20/SEG),on=PL.idx>Z.central-Math.round(150/SEG)&&PL.idx<Z.wilma+Math.round(40/SEG);
  if(!P_.l.length)for(let k=0;k<20;k++){const g=mkPerson(R(.92,1.06));g.visible=false;scene.add(g);P_.l.push({g,st:0,s:0,lat:0,sd:1,dir:1,v:1.3,t:0});}
  for(const p of P_.l){if(!on){if(p.st){p.st=0;p.g.visible=false;}continue;}
    if(!p.st||Math.abs(wdiff(p.s-pe.s))>260){const s=pe.s+R(-30,240),i=wrapI(Math.floor(s/SEG));if(i<a||i>b){p.st=0;p.g.visible=false;continue;}
      p.st=1;p.s=s;p.sd=Math.random()<.5?-1:1;p.dir=Math.random()<.5?-1:1;p.v=R(1.1,1.6);p.off=R(-.6,.9);p.t=R(0,6);p.g.visible=true;}
    const i=wrapI(Math.floor(p.s/SEG)),base=p.sd*(7.9+XW[i]+p.off),near=Math.abs(wdiff(p.s-pe.s))<6&&Math.abs(pe.lat-base)<3;p.lat+=((near?p.sd*(9.4+XW[i]):base)-p.lat)*clamp(rdt*(near?8:2),0,1);   // out of the way!
    p.s+=p.dir*p.v*rdt;p.t+=rdt*p.v*4.2;at(p.s,p.lat,.13,p.g.position);const ii=wrapI(Math.floor(p.s/SEG));p.g.rotation.y=yaw(ii)+(p.dir>0?0:Math.PI);
    const sw=Math.sin(p.t)*.5;p.g.legs[0].rotation.x=sw;p.g.legs[1].rotation.x=-sw;}}
// Lorries' exhaust stacks: thick black smoke from the stack top whenever a truck is near; the buggy driver's pipe sends up little puffs.
const EXH={t:0};
function exhaustTick(rdt){EXH.t-=rdt;if(EXH.t>0)return;EXH.t=.09;
  for(const t of TRAF){if(!t.act||t.fall||!t.g.ex||!t.g.visible)continue;const dx=t.g.position.x-PL.x,dz=t.g.position.z-PL.z;if(dx*dx+dz*dz>220*220)continue;t.g.localToWorld(V.copy(t.g.ex));
    if(t.kind==='buggy'){if(Math.random()<.25){NOGY=1;puff(V,R(-.2,.2),R(.4,.9),R(-.2,.2),.08,.5,R(1.2,2),.5,0xd8d4cc);NOGY=0;}continue;}
    NOGY=1;puff(V,R(-.4,.4),R(2.5,4.5),R(-.4,.4),.5,R(2.5,4),R(1.6,2.6),.75,[0x141210,0x1e1b18,0x2a2522][Math.random()*3|0]);NOGY=0;}}
function fqTick(rdt){if(!FQ.list.length)return;const pe=ents.find(e=>e.player);if(!pe)return;fqCrumbleTick(rdt);
  for(const q of FQ.list){
    if(q.st===0){if(G.state==='race'&&!PL.crash&&PL.idx>=q.ti&&PL.idx<q.ti+80){q.st=1;q.t=0;q.n=0;q.af=0;q.sd=Math.random()<.5?-1:1;q.fs=wrapS(pe.s+Math.max(280,pe.v*9));sfxRumble();say('EARTHQUAKE !','THE GROUND IS SHAKING - EASE OFF',4);}continue;}
    if(q.st!==1)continue;q.t+=rdt;const t=q.t,w=RW+XW[PL.idx];
    if(t<8)G.shake=Math.max(G.shake,(q.nm==='MARIN'?.3:1)*(.06+.72*sst(t,0,5)));G.qd=Math.max(G.qd||0,.45*sst(t,1,4.5));   // the shaking grows and the sky goes dark
    if(t>2.4&&t<5.6){q.n-=rdt;if(q.n<=0){q.n=.12;const u=(t-2.4)/3.2;fqCrack(q,lerp(pe.s+40,q.fs+20,u)+R(-14,14),R(-w,w));}}   // cracks run across the road ahead, out towards where it will split
    if(t>3.9&&t<5.4){q.m=(q.m||0)-rdt;if(q.m<=0){q.m=.07;const u=(t-3.9)/1.5,wf=RW+XW[wrapI(Math.floor(q.fs/SEG))];fqCrack(q,q.fs+R(-3,3),lerp(-q.sd*(wf+.5),q.sd*wf*.5,u)+R(-1,1));if(Math.random()<.4){NOGY=1;puff(at(q.fs,lerp(-q.sd*wf,q.sd*wf*.5,u),.2,V),R(-1,1),R(.5,2),R(-1,1),1,R(2,4),R(1,2),.4,0x9a9080);NOGY=0;}}}   // then a line of cracks races across the lanes where it will open, puffing dust
    if(t>=5.4&&!q.F){sfxQuake();sfxCrunch(1);G.shake=1;
      if(q.nm==='I-80'){q.Fs=[];let s=q.fs,sd=q.sd;for(let n=0;n<4;n++){const F=fqFissure(q,s,sd,1);F.t0+=n*.45;q.Fs.push(F);q.fe=s;s+=R(60,90);sd=-sd;}q.F=q.Fs[0];say('THE ROAD IS OPENING UP !','HOLES AHEAD - STEER ROUND THEM',4);}   // I-80: no boulders - the road opens into a string of holes, each across most of the lanes, on alternate sides
      else{q.F=fqFissure(q,q.fs,q.sd);q.Fs=[q.F];say('THE ROAD IS SPLITTING !','KEEP TO THE '+(q.sd>0?'LEFT':'RIGHT')+' LANE',4);}}
    for(const F of q.Fs||[]){const u=t-F.t0;F.kL=sst(u,0,1.4);{let kw=0;for(let n=0;n<4;n++)kw+=.25*sst(u,.15+n*1.1,.4+n*1.1);F.kW=kw;const ns=Math.min(4,Math.floor((u-.15)/1.1)+1);if(ns>(F.stp||0)){F.stp=ns;fqStep(q,F);}}   /* it opens in four violent steps */F.wid+=((q.af?1.25:1)-F.wid)*Math.min(1,rdt*1.5);fqShape(F);
      if(u<5&&Math.random()<rdt*40){const p=F.pts[Math.random()*F.pts.length|0];if(p.h>.05){NOGY=1;puff(at(F.s+p.c,p.lat,.3,V),R(-2,2),R(1.5,5),R(-2,2),1,R(3,6),R(1.4,3),.55,0x9a9080);NOGY=0;}}   // dust out of the split
      if(u<8&&Math.random()<rdt*(u<4.6?12:3))fqCrumble(F,1);   // the edges keep breaking away and falling in
      if(u>.3&&!F.ch&&q.nm!=='I-80'){F.ch=1;for(let k=0;k<8;k++){const p=F.pts[Math.random()*F.pts.length*.7|0];fqDeb(q,F.s+p.c+R(-1.5,1.5),p.lat,R(.4,1.2),R(0,1.4),R(.22,.4),R(4,9));}}   // chunks of road thrown up
      if(!PL.crash&&PL.safe<=0&&G.state==='race'){const f=(pe.lat-F.edge)/(F.tip-F.edge),p=f>=0&&f<=1?F.pts[Math.round(f*(F.pts.length-1))]:null,ds=p?wdiff(F.s+p.c-pe.s):null;
        if(p&&F.prev!=null&&F.prev>0&&ds<=0&&p.h>.15&&q.nm==='I-80'){if(p.h>.5){F.prev=null;startDive(-F.sd,1.2,PL.idx,{room:p.h*2});break;}}   /* into a hole: down through the road */
        else if(p&&F.prev!=null&&F.prev>0&&ds<=0&&p.h>.15){const v=pe.v;G.shake=1;sfxCrunch(1);NOGY=1;for(let k=0;k<12;k++)puff(V.set(PL.x+R(-1,1),P[PL.idx].y+.3,PL.z+R(-1,1)),R(-3,3),R(1,4),R(-3,3),1,R(3,6),R(1.2,2.4),.55,0x8a8070);NOGY=0;
          if(q.nm==='MARIN'){PL.air=1;PL.vy=Math.max(PL.vy||0,10);PL.vx*=.92;PL.vz*=.92;G.shake=1;sfxCrunch(1);say('BOING !','OVER THE CRACK',1.5);}else if(v>26)crashPlayer(v*.4,false);else{PL.vx*=.45;PL.vz*=.45;sfxScrape(1);}}   // over the fissure: a hard jolt, and at speed a crash
        F.prev=ds;}else F.prev=null;}
    if(t>12.5&&!q.af){q.af=1;sfxQuake();G.shake=Math.max(G.shake,.75);say('AFTERSHOCK !','',2);for(let k=0;k<4;k++)fqCrack(q,q.fs+R(-40,40),R(-w,w));}
    if(q.af&&t<14.5)G.shake=Math.max(G.shake,.4*(1-(t-12.5)/2));
    const past=wdiff(pe.s-(q.fe||q.fs));if(!PL.crash&&t>14.5&&(past>220||past<-1500)){fqClear(q);q.st=2;}}}   // gone once you are well past it
// hole: the road has opened under the car (the earthquake), {room: metres of gap left ahead}. The car then drops straight through, keeping only as much speed as keeps it inside the gap, instead of being thrown out over the side rail
function startDive(sd,vn,bi,hole){ohNo();{const e=ents.find(e=>e.player);if(e)e.v=0;}const n=Nn[bi],out=hole?vn:Math.max(vn,9),fs=Math.hypot(PL.vx,PL.vz)||1,kf=hole?Math.min(.75,Math.max(1,hole.room)/2.4/fs):.75;
  PL.crash={t:0,dive:1,ph:0,tt:0,sd,x:PL.x,z:PL.z,y:H[bi],vx:PL.vx*kf+n.x*sd*out,vz:PL.vz*kf+n.z*sd*out,vy:hole?0:5.5,idx:bi,dir:PL.x<2350?-1:1,hole:!!hole,rep:(startDive.n=(startDive.n||0)+1)>1};PL.vx=PL.vz=0;   // rep: a second or later fall this game plays only up to the octopus, then the car is back on the road where it went off
 
  V.set(PL.x,.8,PL.z);shed(V,PL.crash.vx,PL.crash.vz,8,0x7f868b);for(let i=0;i<40;i++)spark(V,PL.crash.vx*.5+R(-9,9),R(1,9),PL.crash.vz*.5+R(-9,9));sfxCrunch(1);if(AC&&master){master.gain.cancelScheduledValues(AC.currentTime);master.gain.setTargetAtTime(0,AC.currentTime+.35,.05);}G.shake=1;G.slow=.45;G.slowT=2.6;say(hole?'THE BRIDGE GAVE WAY':'OVER THE RAIL','',2.4);endSkid();
  if(hole)at(bi*SEG+Math.min(40,hole.room*.6),sd*2.5,16,PL.crash.cam=new THREE.Vector3());   // over the gap, looking back and down as the car drops through it
  else at(bi*SEG+24,-sd*4.5,3.2,PL.crash.cam=new THREE.Vector3());}
function diveTick(dt,pe){const D=PL.crash;if(D.lake)return lakeTick(dt,pe);D.tt+=dt;
  if(D.rep){let h=document.getElementById("skiph");if(!h){h=document.createElement("div");h.id="skiph";h.textContent="SPACE to skip";h.style.cssText="position:fixed;bottom:9%;left:50%;transform:translateX(-50%);color:#fff;font:700 15px Arial;letter-spacing:.2em;background:rgba(0,0,0,.5);padding:8px 16px;border-radius:6px;z-index:9;pointer-events:none";document.body.appendChild(h);}h.style.display="block";   // a repeat fall: Space skips the scene, back on the road where the car went off
    if(!keys.Space)D.rel=1;else if(D.rel&&D.tt>.5){D.skip=1;if(D.ph===0){D.ph=1;D.t1=D.tt-99;D.wx=D.x;D.wz=D.z;}}}
  if(D.ph===0){D.x+=D.vx*dt;D.z+=D.vz*dt;D.vy-=11*dt;D.y+=D.vy*dt;hero.position.set(D.x,D.y,D.z);hero.rotation.x=Math.min(1.25,hero.rotation.x+.45*dt);hero.rotation.z+=D.sd*.4*dt;   /* a slower fall, seen from the driver's seat */
    if(D.y<-45){D.ph=1;D.t1=D.tt;D.wx=D.x;D.wz=D.z;V.set(D.x,-44.6,D.z);for(let i=0;i<70;i++){const a=R(0,6.283),sp=R(2,11);puff(V,Math.cos(a)*sp,R(6,22),Math.sin(a)*sp,R(.8,1.6),R(4,8),R(1.2,2.6),.8,0xeef2f4);}sndRestore();sfxBigSplash();sfxThump(1.4);G.shake=.8;}return;}
  const u=D.tt-D.t1,S=9.2;   // S: the moment McQueen breaks the surface
  if(u<S){hero.position.y=Math.max(-61,hero.position.y-(u<1?5:1.9)*dt);hero.rotation.x+=(.3-hero.rotation.x)*Math.min(1,dt*1.2);hero.rotation.z+=(.22-hero.rotation.z)*Math.min(1,dt*1.2);   // the car sinks, slowly righting itself
    if(Math.random()<dt*16)puff(V.set(D.x+R(-1,1),hero.position.y+.8,D.z+R(-1.6,1.6)),R(-.3,.3),R(1.5,3.5),R(-.3,.3),.1,R(.25,.6),R(1.2,2.4),.7,0xeaf6f8);
    if(u>1.4&&Math.random()<dt*1.7)sfxBubble();}
  else hero.visible=false;
  if(u<1.7&&Math.random()<dt*20)puff(V.set(D.x+R(-1,1),-44.8,D.z+R(-1,1)),R(-.5,.5),R(.5,2),R(-.5,.5),.4,1.6,R(.6,1.2),.6,0xeef2f4);
  if(u>1.6&&!D.m1){D.m1=1;say('UNDER THE BAY','',2.4);}
  if(u>4&&!D.m2){D.m2=1;say('AN OCTOPUS TAKES THE CAR','',2.8);sfxThump(1.2);}
  if(u>S+.3&&!D.m3){D.m3=1;say('A MANATEE COMES TO GREET HIM','McQUEEN IS STILL SMOKING',2.4);}
  if(u>S+2.7&&!D.m4){D.m4=1;say('THE MANATEE STOPS FOR A PIPE','A MINUTE OF PEACE ON THE BAY',5.5);}
  if(u>S+4.4&&!D.m5){D.m5=1;say('"CAN I HAVE A LIGHT?"','',2.2);speak('Can I have a light?',.9,.8);}
  if(u>S+6.5&&!D.m6){D.m6=1;say('A TANKER !','COMING STRAIGHT AT THEM',2);sfxHorn();}
  if(u>S+6.5&&!D.hs){D.hs=1;G.shake=.35;}
  if(u>S+8.3&&!D.said){D.said=1;say('HOLD ON !','THE MANATEE MAKES A RUN FOR THE SHORE',3);}
  if(u>S+8.4){const F=D.F||[D.dir,0],sp=26*sst(u,S+8.4,S+9.1),px=-F[1],pz=F[0];D.wx+=F[0]*sp*dt;D.wz+=F[1]*sp*dt;   // it bolts, McQueen on its back
    if(Math.random()<dt*34){const s=Math.random()<.5?-1:1,o=R(.6,1.3);puff(V.set(D.wx+F[0]*R(1.8,3)+px*s*o,-44.9,D.wz+F[1]*R(1.8,3)+pz*s*o),px*s*R(2,5),R(1.5,3.5),pz*s*R(2,5),.25,R(.8,1.6),R(.5,.9),.6,0xeef2f4);}   // spray off the bow
    if(Math.random()<dt*14)puff(V.set(D.wx-F[0]*3.2+R(-.5,.5),-44.9,D.wz-F[1]*3.2+R(-.5,.5)),0,.5,0,.5,2,R(.8,1.4),.5,0xeef2f4);}   // and a wake behind
  if(u>(D.rep?4.6:S+12.3)||D.skip){{const h=document.getElementById("skiph");if(h)h.style.display="none";}const i=backOnRoad(pe,D.idx+Math.round(6/SEG));PL.vx=PL.vz=0;PL.steer=0;PL.crash=null;sndRestore();PL.safe=3;resetVehicle(VS,hero.M.dyn,0);clearCrack();fqAfterReset();first=true;G.uw=0;   // back on the road where the car went off (past the gap if it went through one), not back at the start of the bridge
    hero.visible=true;hero.position.set(PL.x,H[i],PL.z);hero.rotation.set(0,PL.h,0);mcq.rotation.set(0,0,0);manatee.visible=false;manatee.pipe.visible=false;SEA.g.visible=SEA.oc.visible=SEA.dome.visible=SEA.tk.visible=false;SEA.light.intensity=0;say('BACK ON DRY LAND','',2);}}
// iguanas swimming gracefully by in the dive scene (three, circling the car at a distance, tails swaying)
const UWI={l:[]};
function uwIguanas(D,u,tm,S){if(!UWI.l.length){const bm=std({color:0x7d8a68,roughness:.85}),dm=std({color:0x56633f,roughness:.9});
    for(let n=0;n<3;n++){const g=new THREE.Group(),b=new THREE.Group();g.add(b);const bx=(sx,sy,sz,mm,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mm);o.position.set(x,y,z);b.add(o);return o;};
      bx(.16,.1,.4,bm,0,0,0);bx(.11,.09,.15,bm,0,.02,.27);const tl=bx(.07,.06,.4,dm,0,-.02,-.4);for(let q=0;q<5;q++){const sp=bx(.025,.07,.04,dm,0,.09,.2-q*.1);sp.rotation.x=-.4;}
      for(const s of[-1,1])for(const z of[-.12,.14]){const l=bx(.04,.1,.05,dm,s*.11,-.05,z);l.rotation.z=s*1.1;}
      g.scale.setScalar(3.4);g.visible=false;scene.add(g);UWI.l.push({g,b,tl});}}
  const on=u>2&&u<S+4;UWI.l.forEach((k,n)=>{k.g.visible=on;if(!on)return;const a=tm*.22+n*2.1,r=9+n*3.5;k.g.position.set(D.wx+Math.cos(a)*r,-50-n*1.8+Math.sin(tm*.7+n)*1.2,D.wz+Math.sin(a)*r);k.g.rotation.y=Math.atan2(-Math.sin(a),Math.cos(a));k.b.rotation.y=Math.sin(tm*3+n)*.22;k.tl.rotation.y=Math.sin(tm*3+n)*.5;k.tl.position.x=Math.sin(tm*3+n)*.06;});}
function sndRestore(){if(AC&&master){master.gain.cancelScheduledValues(AC.currentTime);master.gain.setTargetAtTime(.85,AC.currentTime,.02);}}
function diveScene(tm){const D=PL.crash,S=9.2;if(D.lake)return lakeScene(tm);if(D.ph<1){manatee.visible=false;SEA.g.visible=SEA.oc.visible=false;G.uw=0;for(const k of UWI.l)k.g.visible=false;return;}
  if(!D.F){const j=wrapI(D.idx),t=T[j],n=Nn[j],l=Math.hypot(t.x,t.z)||1;const so=Math.sign((D.wx-P[j].x)*n.x+(D.wz-P[j].z)*n.z)||D.sd;D.Tg=[-t.x/l,-t.z/l];D.N=[n.x*so,n.z*so];{const fx=D.Tg[0]*.8+D.N[0]*.6,fz=D.Tg[1]*.8+D.N[1]*.6,fl=Math.hypot(fx,fz)||1;D.F=[fx/fl,fz/fl];}D.ox=D.wx;D.oz=D.wz;}   // F: the way the manatee runs (out across the open water, slanting away from the bridge and its piers); N: out from the bridge, where the tanker comes from
  const u=D.tt-D.t1,bob=Math.sin(tm*1.6)*.07,F=D.F,th=Math.atan2(F[0],F[1]);
  G.uw=sst(u,.9,1.5)*(1-sst(u,S-.5,S));SEA.g.visible=u<S+.5;if(SEA.g.visible)seaTick(tm,D);uwIguanas(D,u,tm,S);
  const oc=SEA.oc;oc.visible=u>3.2&&u<S;if(oc.visible){const k=sst(u,3.2,5.4);oc.position.copy(hero.position);oc.position.y-=(1-k)*9;oc.quaternion.copy(hero.quaternion);oc.arms.scale.set(2.4-1.4*k+Math.sin(tm*3)*.04,1+(1-k)*.25,1);}   // it comes up from below and its arms close round the car
  const lift=sst(u,S+8,S+8.5),q=sst(u,S,S+.9);mcq.visible=u>6.3&&u<S+6.3;   // from the tanker on we see through his eyes
  if(u<S){mcq.rotation.set(0,tm*.5,Math.sin(tm*1.3)*.15);mcq.position.set(D.wx-F[0]*.55,lerp(hero.position.y+.6,-46.6,sst(u,6.3,S)),D.wz-F[1]*.55);}   // he drifts up out of the car, upright, cigarette still going
  else{mcq.rotation.set(-Math.PI/2*q,th+Math.PI,0);mcq.position.set(D.wx-F[0]*.55,lerp(-46.6,-45.12+bob+lift*.82,q),D.wz-F[1]*.55);}                // then lies back on the surface
  const a=sst(u,S+.3,S+2.5),under=sst(u,S+7.6,S+8.2),visit=a*(1-under),mk=24*(1-a)+3.2*(1-under),run=sst(u,S+8.4,S+9.1);manatee.visible=u>S+.3;
  manatee.position.set(D.wx+F[0]*mk,-45.78+bob*.6*(1-run)+lift*.42+visit*.4+Math.sin(tm*9)*.06*run,D.wz+F[1]*mk);manatee.rotation.set(-.2*visit-.06*run,th+Math.PI*(1-under),Math.sin(tm*4.5)*.07*run);
  manatee.tail.rotation.x=Math.sin(tm*4)*.35*(1-visit*.7);manatee.fl[0].rotation.z=.5+Math.sin(tm*3)*.25;manatee.fl[1].rotation.z=-.5-Math.sin(tm*3)*.25;
  const pp=u>S+2.6&&u<S+7.4;manatee.pipe.visible=pp;if(pp&&Math.random()<.75){V.set(0,.2,.5);manatee.pipe.localToWorld(V);puff(V,R(-.3,.3),R(.6,1.5),R(-.3,.3),.25,R(1.3,2.6),R(2,3.4),.7,0xe8e8e4);}   // a great deal of pipe smoke
  {const tk=SEA.tk,t=u-S-6.3;tk.visible=t>0&&t<4.4;if(tk.visible){const d=230-45*t-6*t*t,N=D.N;   // the tanker bears straight down on them out of the open bay, heading in under the bridge
    tk.position.set(D.ox+N[0]*d-D.Tg[0]*16,-45,D.oz+N[1]*d-D.Tg[1]*16);tk.rotation.y=Math.atan2(N[1],-N[0]);
    if(Math.random()<.8){const bx=tk.position.x-N[0]*84,bz=tk.position.z-N[1]*84,px=-N[1],pz=N[0];for(const s of[-1,1])puff(V.set(bx+px*s*R(4,9),-44.6,bz+pz*s*R(4,9)),px*s*R(3,7),R(2,5),pz*s*R(3,7),1.2,R(4,7),R(1,1.8),.7,0xf2f6f8);}}}   // a bow wave curling off both sides
  if(u>.9&&u<S+.5){NOGY=1;const bb=(p,w)=>{V.set(p.x+R(-w,w),p.y+R(-.3,.9),p.z+R(-w,w));puff(V,R(-.25,.25),R(.5,1.3),R(-.25,.25),R(.04,.08),R(.08,.15),R(1.4,2.4),.6,0xcfeeff);};if(u<S-.5&&Math.random()<.4)bb(hero.position,1.9);if(u>6.3&&u<S+.3&&Math.random()<.3)bb(mcq.position,.5);NOGY=0;}}   // bubbles stream round the sinking car and rise with Steve (small, from the shared smoke pool)
// ---- the Marin lake (LAKE), below the cliff on the left where the redwoods end. Two ways in: crash hard through the timber rail along the cliff (it breaks, planks fly: LKR), or
// the giant mosquito carries the car out over the water and drops it. Splash, the driver's view under the murky green-brown water, then the camera pulls back: a giant fish with
// glowing red eyes (one and a half cars long) comes slowly out of the murk, and two marine iguanas swim up to the car, look it over and drift off. Back in the driver's seat
// the fish opens its mouth and swallows the car, everything goes dark, and you are back on the road (where the mosquito picked you up, or just before the broken rail, mended).
function lakeBuild(){const L=LAKE,g=new THREE.Group(),D2=THREE.DoubleSide,A=(geo,m,x,y,z,p=g)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);p.add(o);return o;},sg=new THREE.SphereGeometry(1,18,12);
  A(new THREE.CircleGeometry(80,32).rotateX(-Math.PI/2),std({color:0x3a3222,roughness:1}),0,-9,0);   // the muddy bottom
  A(new THREE.PlaneGeometry(240,240).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:0x8a9a52,transparent:true,opacity:.75}),0,-.05,0);   // the surface seen from below
  const wm=[std({color:0x3e4a22,roughness:.9,side:D2}),std({color:0x55502a,roughness:.9,side:D2})],rk=std({color:0x3c3a30,roughness:1});L.weed=[];
  for(let k=0;k<70;k++){const a=R(0,6.28),r=R(7,40),h=R(1.5,5),w=A(new THREE.BoxGeometry(.05,h,.25).translate(0,h/2,0),wm[k%2],Math.cos(a)*r,-9,Math.sin(a)*r);w.rotation.y=R(0,3);L.weed.push(w);}   // weed swaying up off the bottom
  for(let k=0;k<26;k++){const a=R(0,6.28),r=R(3,45),o=A(new THREE.DodecahedronGeometry(R(.6,2),0),rk,Math.cos(a)*r,-9,Math.sin(a)*r);o.rotation.set(R(0,3),R(0,3),R(0,3));}
  // the giant fish: about 6.5 m (a car and a half), dark olive-brown and mottled, pale belly, whiskers, glowing red eyes; its lower jaw drops open (F.jaw), the tail sweeps (F.tail)
  const F=new THREE.Group(),fm=std({color:0x4a4628,roughness:.65}),fb=std({color:0x8c8458,roughness:.7}),ff=std({color:0x35321c,roughness:.8,side:D2}),sp=std({color:0x2c2a16,roughness:.7}),red=new THREE.MeshBasicMaterial({color:0xff2a10,fog:false}),blk=new THREE.MeshBasicMaterial({color:0x080604,side:THREE.BackSide,fog:false});
  A(sg,fm,0,0,0,F).scale.set(1.05,1.2,3.1);A(sg,fb,0,-.45,.3,F).scale.set(.85,.7,2.6);for(let k=0;k<14;k++)A(sg,sp,R(-.6,.6),R(.3,.95),R(-2.4,2),F).scale.set(R(.15,.3),.06,R(.2,.4));   // body, belly, dark blotches
  A(sg,fm,0,.05,2.35,F).scale.set(1,.85,1.15);A(sg,blk,0,-.5,3.05,F).scale.set(.8,.5,.75);   // head; the dark inside of the mouth
  F.jaw=new THREE.Group();F.jaw.position.set(0,-.45,2.1);F.add(F.jaw);A(sg,fb,0,-.05,.85,F.jaw).scale.set(.95,.3,1.15);
  for(const s of[-1,1]){A(sg,red,s*.78,.32,2.85,F).scale.setScalar(.2);const b=A(cyl(.02,.04,1.6,5),fm,s*.6,-.35,3.4,F);b.rotation.set(1.2,0,s*.5);const fn=A(new THREE.BoxGeometry(1,.05,.6),ff,s*1.2,-.45,1.2,F);fn.rotation.z=s*.3;(F.pf||(F.pf=[])).push([fn,s]);}   // red eyes, whiskers, side fins
  A(new THREE.BoxGeometry(.07,.9,1.8),ff,0,1.25,.1,F).rotation.x=-.25;   // the fin on its back
  F.tail=new THREE.Group();F.tail.position.set(0,0,-2.9);F.add(F.tail);A(sg,fm,0,0,-.5,F.tail).scale.set(.55,.7,1.1);A(new THREE.BoxGeometry(.08,2.4,1.3),ff,0,0,-1.7,F.tail);
  F.traverse(o=>{if(o.isMesh)o.castShadow=false;});g.add(F);L.F=F;
  L.ig=[0,1].map(n=>{const k=bigIguMk(1);scene.remove(k.g);k.g.scale.setScalar(.95);k.g.rotation.order='YXZ';k.g.visible=true;g.add(k.g);return Object.assign(k,{n,px:0,pz:0});});   // two marine iguanas, half a car each
  g.visible=false;scene.add(g);L.g=g;}
function lakeStart(o){const L=LAKE,pe=ents.find(e=>e.player);if(!L.g)lakeBuild();if(pe)pe.v=0;L.n=(L.n||0)+1;const i=PL.idx;
  L.wy=P[i].y-H[i]+.35+bkY(i,11);   // the water line (the lake's surface follows the banking of the road above it)
  PL.crash={t:0,dive:1,lake:1,ph:0,tt:0,sd:1,x:o.x,y:o.y,z:o.z,vx:o.vx,vz:o.vz,vy:o.vy,idx:i,rs:o.rs,src:o.src,h:PL.h,rep:L.n>1};PL.vx=PL.vz=0;endSkid();G.shake=Math.max(G.shake,.6);
  if(o.src==='rail')say('THROUGH THE RAIL','AND OVER THE EDGE',2.2);}
function lakeTick(dt,pe){const D=PL.crash,L=LAKE;D.tt+=dt;if(D.rep&&D.tt>.6&&keys.Space)D.skip=1;
  if(D.ph===0){D.x+=D.vx*dt;D.z+=D.vz*dt;D.vy-=13*dt;D.y+=D.vy*dt;hero.position.set(D.x,D.y,D.z);hero.rotation.set(Math.min(1.05,hero.rotation.x+.5*dt),D.h,hero.rotation.z+.2*dt);   // falling, seen from the driver's seat
    if(D.y<L.wy-.3||D.skip){D.ph=1;D.t1=D.tt;D.wx=D.x;D.wz=D.z;NOGY=1;for(let k=0;k<60;k++){const a=R(0,6.283),sp=R(2,10);puff(V.set(D.x,L.wy+.2,D.z),Math.cos(a)*sp,R(5,18),Math.sin(a)*sp,R(.8,1.6),R(4,7),R(1.2,2.4),.8,0xc8d0a8);}NOGY=0;
      sfxBigSplash();sfxThump(1.2);G.shake=.8;say('INTO THE LAKE',D.rep?'SPACE to skip':'',2.2);}
    return;}
  const u=D.tt-D.t1;
  if(u<9.4){hero.position.y=Math.max(L.wy-8.85,hero.position.y-(u<1?3.2:1.1)*dt);hero.rotation.x+=(.22-hero.rotation.x)*Math.min(1,dt*1.3);hero.rotation.z+=(.08-hero.rotation.z)*Math.min(1,dt*1.3);   // sinking slowly, settling level
    if(u>1&&Math.random()<dt*1.4)sfxBubble();}
  else hero.visible=false;
  if(u>3.4&&!D.m1){D.m1=1;say('SOMETHING IN THE MURK','',2.2);sfxUnderThud();}
  if(u>5.6&&!D.m2){D.m2=1;sfxUnderThud();}
  if(u>8.75&&!D.m3){D.m3=1;sfxGulp();G.shake=.9;say('GULP !','',1.6);}
  L.fd||lakeFade(0);L.fd.style.opacity=clamp((u-8.9)/.5,0,1);   // dark inside the fish
  if(u>10.6||D.skip)lakeEnd(pe);}
function lakeEnd(pe){const D=PL.crash,L=LAKE,i=backOnRoad(pe,wrapI(Math.floor(D.rs/SEG)),pe.s);   // back on the road: where the mosquito picked the car up, or just before the broken rail
  PL.vx=PL.vz=0;PL.steer=0;PL.crash=null;sndRestore();PL.safe=3;resetVehicle(VS,hero.M.dyn,0);clearCrack();fqAfterReset();first=true;G.uw=0;G.uwCol=null;G.uwFar=0;G.uwLt=0;
  hero.visible=true;hero.position.set(PL.x,H[i],PL.z);hero.rotation.set(0,PL.h,0);GY=PL.gy=PL.cy=H[i];PL.air=0;PL.vy=0;L.g.visible=false;SEA.dome.visible=false;SEA.light.intensity=0;SEA.dome.material.color.setHex(0xffffff);
  lakeRailMend();L.fo=.9;say('BACK ON THE ROAD','',2);}
function lakeFade(){const d=document.createElement('div');d.style.cssText='position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:8';document.body.appendChild(d);LAKE.fd=d;}
function sfxGulp(){if(!AC)return;const t=AC.currentTime;tone('sine',120,t,.6,1.1,master,{to:38,h:.2});hit(t,.5,.9,260,'lowpass',master);tone('sine',70,t+.35,.5,.8,master,{to:30});hit(t+.4,.4,.5,180,'lowpass',master);}
function lakeScene(tm){const D=PL.crash,L=LAKE;if(D.ph<1){L.g.visible=false;G.uw=0;return;}
  const u=D.tt-D.t1,c=hero.position,h=D.h,fx=Math.sin(h),fz=Math.cos(h),sx=Math.cos(h),sz=-Math.sin(h),F=L.F;
  L.g.visible=true;L.g.position.set(D.wx,L.wy,D.wz);G.uw=sst(u,.1,.6);G.uwCol=L.col;G.uwFar=19;G.uwLt=70;SEA.dome.material.color.setHex(0x7a8448);mcq.visible=false;
  for(const w of L.weed)w.rotation.z=Math.sin(tm*.8+w.position.x)*.12;
  // the fish: out of the murk ahead and to one side, slowly up to the car; then it hangs there, opens its mouth wide, and lunges
  const a=sst(u,2.2,7.6),lun=sst(u,8.3,9.1),dd=lerp(lerp(34,7.5,a),3,lun),sd=lerp(12,0,a),wob=Math.sin(tm*.7)*1.2*(1-a);
  F.position.set(c.x-D.wx+fx*dd+sx*(sd+wob),c.y-L.wy+lerp(2.5,.55,a)+lun*.75,c.z-D.wz+fz*dd+sz*(sd+wob));
  F.rotation.set(0,Math.atan2(-(fx*dd+sx*sd)+sx*0,-(fz*dd+sz*sd)),0);
  const sw=1.6+lun*3;F.tail.rotation.y=Math.sin(tm*sw)*.35;F.rotation.y+=Math.sin(tm*sw+1.2)*.05;F.jaw.rotation.x=1.05*sst(u,7.7,8.4);for(const[fn,s]of F.pf)fn.rotation.z=s*(.3+Math.sin(tm*2.4)*.25);
  // two marine iguanas: they swim in close round the car, tails sculling, then drift away on their own
  for(const k of L.ig){const n=k.n,an=tm*(.45+n*.1)+n*Math.PI,r=u<6?lerp(10,2.6+n*.8,sst(u,.8,4.2)):lerp(2.6+n*.8,32,sst(u,6,10.5)),y=c.y-L.wy+(n?1.4:.5)+Math.sin(tm*.9+n)*.35;
    const x=c.x-D.wx+Math.cos(an)*r,z=c.z-D.wz+Math.sin(an)*r;k.g.position.set(x,y,z);const vx=x-k.px,vz=z-k.pz;if(vx*vx+vz*vz>1e-6)k.g.rotation.set(0,Math.atan2(vx,vz),0);k.px=x;k.pz=z;
    const ph=tm*4.5+n,K=3.2;for(const sg of k.segs){const zz=sg.z,A_=.05+.22*Math.max(0,.6-zz)/1.9;sg.g.position.x=A_*Math.sin(ph-K*zz);sg.g.rotation.y=Math.atan(-A_*K*Math.cos(ph-K*zz));}   // the tail sweeps side to side
    for(const lg of k.legs){lg.g.rotation.y=-lg.f*.2-.9*lg.s*(lg.f>0?.4:1);lg.g.rotation.z=lg.s*.3;}}   // legs tucked back along the body
  if(u<9&&Math.random()<.35){NOGY=1;V.set(c.x+R(-1.8,1.8),c.y+R(0,1),c.z+R(-1.8,1.8));puff(V,R(-.2,.2),R(.5,1.3),R(-.2,.2),R(.04,.08),R(.08,.15),R(1.4,2.4),.6,0xd6e2b0);NOGY=0;}}
function lakeCam(D,rdt,jx){const L=LAKE,u=D.ph<1?-1:D.tt-D.t1,c=hero.position;
  if(u<2.2||u>=7.4){V.set(-.24,.86,.12);hero.localToWorld(V);camera.position.copy(V);camera.position.x+=jx;camera.fov=lerp(camera.fov,74,.2);hero.canopy.visible=false;interior.visible=true;D.cp=0;   // the driver's view: the fall, the splash, under the water; at the end the fish fills the windscreen
    if(u>=7.4){V2.copy(L.F.position).add(L.g.position);V2.y+=.3;look.lerp(V2,.25);}else{look.set(-.24,.55,30);hero.localToWorld(look);}}
  else{const h=D.h,fx=Math.sin(h),fz=Math.cos(h),sx=Math.cos(h),sz=-Math.sin(h);if(!D.cp){D.cp=1;camP.copy(camera.position);}   // pulled back and out to the side: the car on the bottom, the fish coming
    V.set(c.x-sx*8-fx*3,c.y+2.2,c.z-sz*8-fz*3);camP.lerp(V,clamp(rdt*1.4,0,1));camera.position.copy(camP);camera.fov=lerp(camera.fov,58,.06);
    V2.copy(L.F.position).add(L.g.position).multiplyScalar(.3).addScaledVector(c,.7);V2.y+=.6;look.lerp(V2,.08);}}
function lakeCrash(sd,vn,bi,pe){lakeRailBreak(bi);const n=Nn[bi],out=Math.max(vn,8);   // through the timber rail and over the edge
  lakeStart({src:'rail',x:PL.x+n.x*sd*1.5,y:(PL.cy||H[bi])+.3,z:PL.z+n.z*sd*1.5,vx:PL.vx*.5+n.x*sd*out,vz:PL.vz*.5+n.z*sd*out,vy:3,rs:(bi-Math.round(30/SEG))*SEG});sfxCrunch(1);}
function lakeRailBreak(bi){const K=LKR;if(!K.im)return;const n=Nn[bi];for(let k=0;k<K.p.length;k++){const p=K.p[k];if(Math.abs(p.i-bi)>4||p.br)continue;p.br=1;K.im.setMatrixAt(k,K.Z0);K.po.setMatrixAt(k,K.Z0);   // the planks nearest the hit break off and fly
    for(let q=0;q<3;q++){let o=K.fly.find(f=>f.t<=0);if(!o){o={m:new THREE.Mesh(K.pg,K.mat),t:0};scene.add(o.m);K.fly.push(o);}off(p.i,9.2,.6,V);o.m.position.copy(V);o.m.visible=true;o.m.rotation.set(R(0,3),R(0,3),R(0,3));
      Object.assign(o,{t:5,vx:PL.vx*.4+n.x*R(5,11),vy:R(3,8),vz:PL.vz*.4+n.z*R(5,11),sp:R(-9,9)});}}
  K.im.instanceMatrix.needsUpdate=K.po.instanceMatrix.needsUpdate=true;if(AC){const t=AC.currentTime;hit(t,.3,.9,1600,'bandpass',master);hit(t+.04,.2,.6,900,'bandpass',master);}}
function lakeRailMend(){const K=LKR;if(!K.im)return;K.p.forEach((p,k)=>{if(!p.br)return;p.br=0;K.im.setMatrixAt(k,p.m);K.po.setMatrixAt(k,p.mp);});K.im.instanceMatrix.needsUpdate=K.po.instanceMatrix.needsUpdate=true;}
function lakeRailTick(rdt){const K=LKR,L=LAKE;for(const o of K.fly)if(o.t>0){o.t-=rdt;o.vy-=12*rdt;const p=o.m.position;p.x+=o.vx*rdt;p.y+=o.vy*rdt;p.z+=o.vz*rdt;o.m.rotation.x+=o.sp*rdt;o.m.rotation.z+=o.sp*.5*rdt;
    if(p.y<(L.wy||0)||o.t<=0){o.t=0;o.m.visible=false;}}
  if(L.fo>0){L.fo-=rdt;if(L.fd)L.fd.style.opacity=Math.max(0,L.fo/.9);}}
function sfxSplash(){if(!AC)return;const t=AC.currentTime;hit(t,1.4,1.2,900,'lowpass',master);hit(t,.6,.6,3500,'highpass',master);tone('sine',70,t,.5,.8,master,{to:30});}
function sfxBigSplash(){if(!AC)return;const t=AC.currentTime;   // a car hitting the water from a height: a deep slam, a roar of thrown water, then it all rains back down
  tone('sine',55,t,.9,1.4,master,{to:22,h:.25});tone('triangle',110,t,.35,.7,master,{to:40});hit(t,.18,1.6,1800,'lowpass',master);hit(t,2.6,1.4,700,'lowpass',master);hit(t+.03,1.4,.8,2400,'bandpass',master);hit(t+.05,.9,.7,4500,'highpass',master);
  for(let k=0;k<6;k++)hit(t+.5+k*.22,1.2,.35-k*.04,3000+k*300,'highpass',master);}
function sfxThump(k){if(!AC)return;const t=AC.currentTime;tone('sine',78,t,.11,.8*k,master,{to:42,h:.2});hit(t,.07,.3*k,1200,'bandpass',master);}
function sfxHorn(){if(!AC)return;const t=AC.currentTime,f=R(78,96);for(const[m,v]of[[1,.5],[1.26,.3],[2.01,.12]])tone('sawtooth',f*m,t,R(2.6,3.6),v,master,{a:.25,h:.85,lp:420,q:1});
  for(const[m,v]of[[1,.16],[1.26,.1]])tone('sawtooth',f*m,t+.55,3,v,master,{a:.3,h:.8,lp:300});}                       // long low blast, with a fainter echo off the water
function sfxGull(){if(!AC)return;let t=AC.currentTime;const n=2+(Math.random()*4|0),v=R(.05,.12);for(let i=0;i<n;i++){const f=R(1250,1650);tone('sawtooth',f,t,.26,v,master,{to:f*.62,a:.03,h:.3,lp:2100,ft:'bandpass',q:5});t+=R(.3,.42);}}
const KMAP={ArrowLeft:'ArrowLeft',ArrowRight:'ArrowRight',ArrowUp:'ArrowUp',ArrowDown:'ArrowDown',' ':'Space',Enter:'Enter',Left:'ArrowLeft',Right:'ArrowRight',Up:'ArrowUp',Down:'ArrowDown'};
const codeOf=e=>e.code||KMAP[e.key]||(e.key&&e.key.length===1?'Key'+e.key.toUpperCase():e.key);
// Home screen is two steps: first choose the track, then (on that track) the car, colours, weather and steering.
let HOME=!QS.get('go')&&!QS.has('auto'),trkSel=DRIVE?1:0;
function showHome(){$('title').classList.toggle('home',HOME);$('trk1').classList.toggle('on',HOME?trkSel===0:!DRIVE);$('trk2').classList.toggle('on',HOME?trkSel===1:DRIVE);
  for(const b of document.querySelectorAll('#jmp button'))b.classList.toggle('on',DRIVE&&b.dataset.j===JUMP);
  if(DRIVE)document.querySelector('#title h2').textContent=JUMP?'A FREE DRIVE FROM '+JUMPN[JUMP]+' TO 1611 SAN ANTONIO AVE':'A FREE DRIVE FROM 1611 SAN ANTONIO AVE AND HOME AGAIN';}
// from: where the Alameda drive starts ('' the house, or a jump point)
function pickTrack(drive,from=''){if(drive===DRIVE){if(drive)JUMP=from;HOME=false;showHome();return;}const q=new URLSearchParams();if(drive){q.set('mode','drive');if(from)q.set('from',from);}q.set('go','1');q.set('model',G.model);q.set('liv',G.liv);if(!drive)q.set('wx',G.weather);location.search=q.toString();}
$('trk1').onclick=()=>pickTrack(false);$('trk2').onclick=()=>pickTrack(true);for(const b of document.querySelectorAll('#jmp button,#bonus button'))b.onclick=()=>pickTrack(true,b.dataset.j);showHome();
const JKEY={Digit3:'bb',Numpad3:'bb',Digit4:'sf',Numpad4:'sf',Digit5:'gg',Numpad5:'gg',Digit6:'i80',Numpad6:'i80',Digit7:'i880',Numpad7:'i880',Digit8:'marin',Numpad8:'marin',KeyH:''};
if(!DRIVE&&(G.model==='sherp'||G.model==='p911'))G.model='k';   // the Sherp is for the Bay drive only: Le Mans keeps to the cars of the film's era
if(MODELS[G.model]&&MODELS[G.model].cls)MKEYS=CLASSICS;
function setSens(d){G.sens=clamp(Math.round((G.sens+d)*10)/10,.1,1);try{localStorage.setItem('vqh-sens',G.sens);}catch(e){}$('oSens').textContent=Math.round(G.sens*100)+'%';say('STEERING '+Math.round(G.sens*100)+'%','[ LESS SENSITIVE · MORE SENSITIVE ]',1.4);}
addEventListener('keydown',e=>{const c=codeOf(e);keys[c]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(c))e.preventDefault();if(e.repeat)return;
  initAudio();if(AC&&AC.state==='suspended')AC.resume();                                                    // any key wakes the sound, however the game was opened
  if(c==='Escape'&&G.state!=='title'&&G.state!=='intro'){if(window.speechSynthesis)speechSynthesis.cancel();const q=new URLSearchParams();if(DRIVE)q.set('mode','drive');q.set('model',G.model);q.set('liv',G.liv);if(!DRIVE)q.set('wx',G.weather);location.search=q.toString();return;}   // Esc: back to the title screen
  if(c==='BracketLeft'||e.key==='[')setSens(-.1);if(c==='BracketRight'||e.key===']')setSens(.1);
  if(G.state==='title'){
    if(HOME){if(c==='ArrowRight'||c==='ArrowLeft'||c==='ArrowUp'||c==='ArrowDown'){trkSel=1-trkSel;showHome();}if(c==='Enter'||c==='Space')pickTrack(trkSel===1);if(e.key==='1')pickTrack(false);if(e.key==='2')pickTrack(true);if(c in JKEY)pickTrack(true,JKEY[c]);return;}
    if(DRIVE&&c in JKEY&&c!=='KeyH'){JUMP=JKEY[c];showHome();return;}
    if(c==='Escape'||c==='Backspace'){HOME=true;trkSel=DRIVE?1:0;showHome();return;}
    if(c==='KeyV'){MKEYS=MKEYS===RACERS?CLASSICS:RACERS;G.model=MKEYS[0];G.liv=0;buildHero(G.model);setupGrid();refreshTitle();G.titleClose=7;}   // racing cars / classic cars
    if(c==='ArrowRight'||c==='ArrowLeft'){const i=MKEYS.indexOf(G.model);G.model=MKEYS[(i+(c==='ArrowRight'?1:MKEYS.length-1))%MKEYS.length];G.liv=0;buildHero(G.model);setupGrid();refreshTitle();G.titleClose=7;}
    if(c==='KeyD'||c==='KeyA'){{const n=LIVS[G.model].length;G.liv=(G.liv%n+(c==='KeyD'?1:n-1))%n;}buildHero(G.model);setupGrid();refreshTitle();G.titleClose=7;}
    if(c==='ArrowDown'||c==='ArrowUp'){const i=WKEYS.indexOf(G.weather);G.weather=WKEYS[(i+(c==='ArrowDown'?1:4))%5];refreshTitle();}
    if(c==='Enter'){if(DRIVE)startDrive();else startIntro();}
    if(c==='Digit1'||c==='Numpad1'||e.key==='1'){pickTrack(false);return;}if(c==='Digit2'||c==='Numpad2'||e.key==='2'){pickTrack(true);return;}
    if(c==='KeyF'){const q=new URLSearchParams();if(!DRIVE)q.set('mode','drive');q.set('go','1');q.set('model',G.model);q.set('liv',G.liv);q.set('wx',G.weather);location.search=q.toString();}   // switch between the race and the free drive
    return;}
  if(G.state==='intro'){if(c==='Enter'||c==='Space'||c==='Escape')G.t=INTRO.T;return;}   // skip the montage
  if(c==='Enter'&&G.state==='finish'&&$('res').style.display==='block')(DRIVE?startDrive:startRace)();
  if(c==='KeyC')G.cam=(G.cam+1)%4;
  if(c==='KeyT'){const i=WKEYS.indexOf(G.weather);G.weather=WKEYS[(i+1)%5];refreshTitle();say(WX[G.weather].name,WX[G.weather].d,2.4);announce(WXFR[G.weather]);}
  if(c==='KeyN'){ANN.on=!ANN.on;if(!ANN.on&&window.speechSynthesis)speechSynthesis.cancel();say(ANN.on?'ANNOUNCER ON':'ANNOUNCER OFF','',1);}
  if(c==='KeyM'){musicOn=!musicOn;say(musicOn?'MUSIC ON':'MUSIC OFF','',1);}
  if(RPICK.on&&DRIVE){const o=RADIO_OPTS.find(o=>o.k===c);if(o){radioPick(o);return;}}
  if(false&&c==='KeyY'&&DRIVE){radioOn=!radioOn;try{localStorage.setItem('vqh-radio',radioOn?'1':'0');}catch(e){}say(radioOn?'RADIO ON':'RADIO OFF',radioOn?'KCSM 91.1 · JAZZ':'',1.4);}
  if(c==='KeyP'&&G.state==='race'){G.paused=!G.paused;say(G.paused?'PAUSE':'',G.paused?'CIGARETTE BREAK · P TO RESUME':'',G.paused?1e9:.01);}
  if(c==='KeyR'&&G.state==='race'&&!PL.crash){const i=PL.idx;PL.x=P[i].x;PL.z=P[i].z;PL.h=G.camH=yaw(i);PL.vx=PL.vz=0;resetVehicle(VS,hero.M.dyn,0);}
  if(c==='KeyH'){G.aids=!G.aids;localStorage.setItem('vqh-aids',G.aids?'1':'0');say(G.aids?'DRIVER AIDS ON':'DRIVER AIDS OFF',G.aids?'ABS · TRACTION CONTROL · STEERING HELP':'NO ABS · NO TRACTION CONTROL · AS IN 1970',2.2);}});
addEventListener('keyup',e=>{keys[codeOf(e)]=false;});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});
addEventListener('pointerdown',()=>{window.focus();initAudio();if(AC&&AC.state==='suspended')AC.resume();});
addEventListener('resize',()=>{if(!innerWidth||!innerHeight)return;renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;grade.uniforms.res.value.set(innerWidth,innerHeight);});
const mapC=$('map').getContext('2d');let mb;{let a=1e9,b=-1e9,c=1e9,d=-1e9;for(const p of P){a=Math.min(a,p.x);b=Math.max(b,p.x);c=Math.min(c,p.z);d=Math.max(d,p.z);}const sc=130/Math.max(b-a,d-c);mb=p=>[10+(p.x-a)*sc,10+(p.z-c)*sc];}
function drawMap(){mapC.clearRect(0,0,150,150);mapC.strokeStyle='rgba(239,233,214,.75)';mapC.lineWidth=3;mapC.beginPath();for(let i=0;i<=NS;i+=6){const[x,y]=mb(P[i%NS]);i?mapC.lineTo(x,y):mapC.moveTo(x,y);}mapC.closePath();mapC.stroke();
  for(const e of ents){if(e.out>0&&!e.car.wreck)continue;const[x,y]=mb(e.car.position);mapC.fillStyle=e.player?'#e9a13a':e.car.wreck?'#ff5a3a':'#efe9d6';mapC.beginPath();mapC.arc(x,y,e.player?4.5:2.6,0,7);mapC.fill();}}
function hud(pe,hour){const st=standings();$('pos').textContent=DRIVE?placeOf(PL.idx)[1]:'P'+(st.indexOf(pe)+1);if(DRIVE)$('tr').textContent=(clamp(pe.dist,0,LEN)/1000).toFixed(1)+' / '+Math.round(LEN/1000)+' KM';   /* the free drive is one lap: distance round the bay instead of laps */
  else{$('lap').textContent=Math.min(LAPS,Math.max(1,Math.floor(Math.max(pe.dist,0)/LEN)+1))+' / '+LAPS;$('last').textContent=PL.last?fmt(PL.last):'–';$('best').textContent=PL.best?fmt(PL.best):'–';}
  const hh=Math.floor(hour),mm=Math.floor((hour-hh)*60);$('clk').textContent=(hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm;$('hr').textContent=DRIVE?'':'HOUR '+Math.min(24,Math.floor(clamp(pe.dist/(LAPS*LEN),0,1)*24)+1)+' OF 24';
  $('spd').textContent=Math.round(Math.abs(pe.v)*3.6);$('mph').textContent=Math.round(Math.abs(pe.v)*2.23694);$('gear').textContent=PL.gear<0?'R':PL.gear;$('rpmN').textContent=Math.round(PL.rpm/50)*50;$('rev').firstChild.style.width=clamp((PL.rpm-1000)/7400*100,0,100)+'%';
  $('steer').firstChild.style.left=clamp(50-PL.steer*50,0,100)+'%';$('pedT').style.height=PL.thr*100+'%';$('pedB').style.height=PL.brk*100+'%';
  $('warn').textContent=PL.warn&&!PL.crash?'FREINEZ · BRAKE':'';drawMap();}

/* ================= RUNNING START + INTRO MONTAGE ================= */
function runStart(k,rdt){runners.forEach((r,i)=>{const e=ents[i];if(!e){r.visible=false;return;}r.visible=k<1;const cp=e.car.position,j=wrapI(Math.floor(e.s/SEG));
    r.position.set(cp.x-Nn[j].x*(1-k)*11.5-T[j].x*(1-k)*3,0,cp.z-Nn[j].z*(1-k)*11.5-T[j].z*(1-k)*3);r.rotation.y=Math.atan2(Nn[j].x,Nn[j].z);
    const hop=clamp((k-.82)/.18,0,1);r.position.y=Math.sin(hop*Math.PI)*.8;r.scale.setScalar(1-hop*.5);   // the last stride is a vault over the sill into the seat
    const sw=Math.sin(G.t*17+i)*.9;r.legs[0].rotation.x=sw;r.legs[1].rotation.x=-sw;r.arms[0].rotation.x=-sw;r.arms[1].rotation.x=sw;
    if(k>=1&&Math.random()<rdt*9){const hy=e.car.rotation.y;puff(V.set(cp.x-Math.sin(hy)*2.4,.4,cp.z-Math.cos(hy)*2.4),R(-.6,.6),R(.4,1.4),R(-.6,.6),.6,3,R(1.2,2.2),.32,0xb9bcc4);}});}
// The opening: quick cuts between drivers' eyes, the clock and the cars, each shorter than the last, over a heartbeat, until four o'clock.
const cutC=$('cut'),cutG=cutC.getContext('2d');let INTRO=null;
function startIntro(){initAudio();if(AC&&AC.state==='suspended')AC.resume();window.focus();$('title').classList.add('hide');$('res').style.display='none';seed=7+Math.random()*1000|0;setupGrid();hero.visible=true;
  const order=['clock','eyes','car','eyes','wheel','crowd','eyes','tach','clock','car2','eyes','exh','flag','eyes','clock','wheel','eyes','car','tach','eyes','clock','car2','eyes','exh','eyes','clock','eyes','car','eyes','tach','eyes','clock','eyes','car2','eyes','clock'];
  const shots=[];let t=0,n=0;while(t<6.6){const d=Math.max(.08,.8*Math.pow(.9,n));shots.push({type:order[n%order.length],t0:t,d,v:n});t+=d;n++;}
  shots.push({type:'run',t0:t,d:2.6,v:0});t+=2.6;shots.push({type:'clock',t0:t,d:1.15,v:99});t+=1.15;
  INTRO={shots,T:t,i:-1};G.state='intro';G.t=0;}
function beginRace(){INTRO=null;cutC.style.display='none';for(const id of['tl','tr','br','lf','map','bl'])$(id).classList.remove('hide');runners.forEach(r=>{r.visible=false;});
  G.state='race';first=true;PL.lapStart=0;PL.rpm=1200;say('PARTEZ !','',1.2);sfxRoar();G.waveT=tm+5;announce("Et c'est parti pour les vingt-quatre heures !");}
function introTick(rdt){const I=INTRO;if(!I.hold)G.t+=rdt;if(G.t>=I.T){beginRace();return null;}
  let i=Math.max(I.i,0);while(i+1<I.shots.length&&I.shots[i+1].t0<=G.t)i++;const s=I.shots[i];
  if(i!==I.i){I.i=i;if(s.type==='clock'&&s.v!==99)sfxTick();}
  const quiet=I.T-1.15;if(G.t<quiet&&G.t>=(I.nb||0)){sfxHeart(1.9);I.nb=G.t+lerp(.9,.27,G.t/quiet);}   // a loud heartbeat that quickens, then stops dead: a second of silence before the engines
  const flat=s.type==='eyes'||s.type==='clock';cutC.style.display=flat?'block':'none';
  if(flat){const w=innerWidth,h=Math.round(innerHeight*.84);if(cutC.width!==w||cutC.height!==h){cutC.width=w;cutC.height=h;}
    if(s.type==='eyes')drawEyes(cutG,w,h,s.v,G.t);else drawClock(cutG,w,h,s.v,s.v===99?60:60-(I.T-G.t));}
  if(s.type==='run')runStart(clamp((G.t-s.t0)/(s.d-.15),0,1),rdt);
  return s;}
function introCam(s){const u=(G.t-s.t0)/s.d,L=(x,y,z,o)=>hero.localToWorld(o.set(x,y,z));let cock=false;
  switch(s.type){
    case'car':L(1.7-u*.3,.34,3.9,camera.position);L(0,.42,.9,look);camera.fov=30;break;
    case'car2':at(S0+16,2.2+u*.4,.55,camera.position);at(S0-34,RW-2.2,.5,look);camera.fov=11;break;
    case'wheel':L(2.3,.3,1.5-u*.25,camera.position);L(.9,.33,1.25,look);camera.fov=20;break;
    case'exh':L(-1.1,.32,-4.3,camera.position);L(0,.35,-2,look);camera.fov=26;if(Math.random()<.4){L(R(-.25,.25),.26,hero.M.zR-.3,V);puff(V,R(-.4,.4),R(.3,1),R(-.4,.4),.3,1.6,R(.8,1.5),.35,0xb9bcc4);}break;
    case'tach':cock=true;L(-.2,.86,-.02,camera.position);L(-.2,.66,.64,look);camera.fov=30;interior.needle.rotation.z=-Math.PI*.75+(.28+Math.abs(Math.sin(G.t*11))*.5)*Math.PI*1.5;break;
    case'flag':off(GS0+26,9.5,11,camera.position);off(GS0+26,14.2,12.9,look);camera.fov=13;break;
    case'crowd':at(S0-30+u*6,4,2.4,camera.position);off(START_I-2,17.5,3.2,look);camera.fov=15;break;
    case'run':at(S0+18,-6.5,2.6,camera.position);at(S0-30,2.5,.9,look);camera.fov=36;break;
    default:at(S0-96,8.6,6.2,camera.position);at(S0+30,1.5,.4,look);camera.fov=25;}   // eyes and clock are painted over the top
  hero.canopy.visible=!cock;interior.visible=cock;camera.position.y+=R(-1,1)*.0006*s.v;}
function drawEyes(g,w,h,v,t){const k=v%4,hel=['#10151f','#6e1512','#d9d4c4','#141414'][k],iris=['#3f7fc0','#6b4a2a','#3f7fc0','#5a7f6a'][k],zoom=(1.25+((v*37)%5)*.07)*w/1000;
  g.setTransform(1,0,0,1,0,0);g.fillStyle=hel;g.fillRect(0,0,w,h);g.translate(w/2+Math.sin(t*23+v)*3+((v%3)-1)*w*.03,h/2+Math.cos(t*19)*2);g.scale(zoom,zoom);
  const rr=(x,y,ww,hh,r,c)=>{g.fillStyle=c;g.beginPath();g.roundRect(x,y,ww,hh,r);g.fill();};
  rr(-470,-175,940,350,130,'#e7e3d8');rr(-340,-86,680,168,78,'#c79779');                       // balaclava, then the strip of face left showing
  const sh=g.createLinearGradient(0,-90,0,82);sh.addColorStop(0,'rgba(60,30,20,.55)');sh.addColorStop(.35,'rgba(60,30,20,0)');sh.addColorStop(1,'rgba(60,30,20,.3)');g.fillStyle=sh;g.beginPath();g.roundRect(-340,-86,680,168,78);g.fill();
  const open=(Math.sin(t*1.7+v*2.3)>.97?.12:.8),dx=Math.sin(t*2.3+v)*16+(Math.sin(t*7+v)>.9?24:0),dy=Math.sin(t*1.9)*4;
  for(const sx of[-1,1]){const cx=sx*168;g.save();g.beginPath();g.moveTo(cx-98,6);g.quadraticCurveTo(cx,-70*open,cx+98,6);g.quadraticCurveTo(cx,56*open,cx-98,6);g.closePath();g.fillStyle='#f1ede4';g.fill();g.clip();
    g.fillStyle=iris;g.beginPath();g.arc(cx+dx,dy,46,0,7);g.fill();g.strokeStyle='rgba(10,20,40,.6)';g.lineWidth=7;g.stroke();
    g.fillStyle='#070707';g.beginPath();g.arc(cx+dx,dy,19,0,7);g.fill();g.fillStyle='rgba(255,255,255,.85)';g.beginPath();g.arc(cx+dx-14,dy-15,7,0,7);g.fill();
    g.fillStyle='rgba(40,20,14,.35)';g.fillRect(cx-100,-70,200,34);g.restore();
    g.strokeStyle='#4a2c20';g.lineWidth=8;g.lineCap='round';g.beginPath();g.moveTo(cx-98,6);g.quadraticCurveTo(cx,-70*open,cx+98,6);g.stroke();
    g.strokeStyle='rgba(120,80,60,.6)';g.lineWidth=3;g.beginPath();g.moveTo(cx-90,26);g.quadraticCurveTo(cx,62,cx+92,24);g.stroke();
    g.strokeStyle='#7d5f3c';g.lineWidth=17;g.beginPath();g.moveTo(cx-sx*104,-66);g.quadraticCurveTo(cx,-88-(1-open)*4,cx+sx*100,-74);g.stroke();}
  g.fillStyle='rgba(90,50,35,.3)';g.beginPath();g.ellipse(0,20,30,70,0,0,7);g.fill();
  g.setTransform(1,0,0,1,0,0);const vg=g.createRadialGradient(w/2,h/2,h*.25,w/2,h/2,w*.62);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.6)');g.fillStyle=vg;g.fillRect(0,0,w,h);}
function drawClock(g,w,h,v,sec){g.setTransform(1,0,0,1,0,0);g.fillStyle='#16181a';g.fillRect(0,0,w,h);const z=(1+(v%5)*.16)*h/900;g.translate(w/2+((v%3)-1)*w*.05,h/2+((v%2)?-.04:.05)*h);g.scale(z,z);
  g.fillStyle='#2a2c2e';g.beginPath();g.arc(0,0,400,0,7);g.fill();g.fillStyle='#e9e4d2';g.beginPath();g.arc(0,0,370,0,7);g.fill();
  g.fillStyle='#141414';for(let i=0;i<60;i++){g.save();g.rotate(i/60*6.2832);g.fillRect(-(i%5?3:9),-350,i%5?6:18,i%5?26:64);g.restore();}
  g.font='900 78px Arial Black,Arial';g.textAlign='center';g.textBaseline='middle';[[12,0,-232],[3,236,4],[6,0,238],[9,-236,4]].forEach(([n,x,y])=>g.fillText(n,x,y));
  const hand=(a,len,wd,c)=>{g.save();g.rotate(a);g.fillStyle=c;g.fillRect(-wd/2,-len,wd,len+34);g.restore();},m=59+sec/60;
  hand((3+m/60)/12*6.2832,205,26,'#141414');hand(m/60*6.2832,318,16,'#141414');hand(Math.floor(sec)/60*6.2832,340,6,'#b8261c');
  g.fillStyle='#b8261c';g.beginPath();g.arc(0,0,20,0,7);g.fill();
  g.setTransform(1,0,0,1,0,0);const vg=g.createRadialGradient(w/2,h/2,h*.3,w/2,h/2,w*.65);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.55)');g.fillStyle=vg;g.fillRect(0,0,w,h);}
function sfxHeart(v){if(!AC)return;const t=AC.currentTime;tone('sine',66,t,.17,1.1*v,master,{to:34,h:.2});tone('sine',110,t,.07,.5*v,master,{to:60});hit(t,.06,.35*v,300,'lowpass',master);tone('sine',56,t+.18,.15,.8*v,master,{to:32,h:.2});hit(t+.18,.05,.22*v,260,'lowpass',master);}
function sfxRoar(){if(!AC)return;const t=AC.currentTime;hit(t,6.5,1.1,420,'lowpass',master);hit(t+.1,3.2,.5,1600,'bandpass',master);   // the whole grid firing up at once: a pack of engines, each a little apart, that pulls away and fades
  for(let i=0;i<18;i++){const d=Math.random()*.45,f=38+Math.random()*40,far=i>9,dur=(far?7.5:5.5)+Math.random()*1.5;tone(i%3?'sawtooth':'square',f,t+d,dur,far?.05:.075,master,{to:f*(2.4+Math.random()*1.2),a:.08+Math.random()*.2,h:.28,lp:far?700:1900,lpTo:far?260:500,det:(Math.random()-.5)*30});}}
function sfxCheer(){if(!AC)return;const t=AC.currentTime;hit(t,4.5,.5,1400,'bandpass',master);hit(t+.2,4,.35,2600,'bandpass',master);}
function sfxTick(){if(!AC)return;const t=AC.currentTime;tone('square',2100,t,.018,.14,master);hit(t,.02,.12,5000,'highpass',master);}

await BOOT.step('WARMING UP',.95);
/* ================= LOOP ================= */
buildHero(G.model);setupGrid();refreshTitle();
if(DRIVE){document.querySelector('#title h1').innerHTML='ALAMEDA<br>AROUND THE BAY';showHome();document.querySelector('#title .go').textContent='PRESS ENTER TO DRIVE';
  document.querySelector('#title .keys').innerHTML='ESC — BACK TO TRACK CHOICE<br>Paru St, the Posey Tube, the port, the Bay Bridge, Hyde St, the Golden Gate, the redwoods, Richmond, I-80 and home.';$('of').textContent='';}
if(QS.has('render')){$('title').classList.add('hide');}
if(QS.has('auto')){$('title').classList.add('hide');for(const id of['tl','tr','br','lf','map','bl'])$(id).classList.remove('hide');G.state='race';ents.forEach(e=>{if(!e.player)e.v=30;});PL.vx=Math.sin(PL.h)*40;PL.vz=Math.cos(PL.h)*40;resetVehicle(VS,hero.M.dyn,40);if(QS.has('drive'))keys.ArrowUp=true;}
// test hooks: step the sim, or let a simple autopilot drive (used to tune handling)
function autopilot(n){let crashes=0,was=false,off=0,vmax=0;const pe=ents.find(e=>e.player);
  for(let i=0;i<n;i++){const idx=PL.idx,lk=wrapI(idx+Math.round(clamp(Math.abs(pe.v)*.45,8,34)/SEG));
    const tx=P[lk].x+Nn[lk].x*line[lk]*.6-PL.x,tz=P[lk].z+Nn[lk].z*line[lk]*.6-PL.z;let dh=Math.atan2(tx,tz)-PL.h;dh=((dh+Math.PI*3)%(Math.PI*2))-Math.PI;
    G.autoSt=clamp(dh*5,-1,1);const lim=vcp[wrapI(idx+5)]*Math.sqrt(wx.grip*hero.M.grip*hero.M.dyn.gk)*.9;keys.ArrowUp=pe.v<lim;keys.ArrowDown=pe.v>lim+2;
    updateWeather(1/60);sim(1/60);if(PL.crash&&!was)crashes++;was=!!PL.crash;if(Math.abs(pe.lat)>edgeAt[PL.idx])off++;vmax=Math.max(vmax,pe.v);}
  for(const k in keys)keys[k]=false;G.autoSt=null;
  return{t:G.raceT.toFixed(0),crashes,offTrackSec:(off/60).toFixed(1),laps:PL.lapN,best:PL.best.toFixed(1),vmaxKmh:Math.round(vmax*3.6),pos:standings().indexOf(pe)+1,state:G.state};}
window.__test={buildHero:m=>buildHero(m),CENT,LAKE,LKR,lakeIn:()=>{const n=Nn[PL.idx];lakeRailBreak(PL.idx);lakeStart({src:"rail",x:PL.x,y:(PL.cy||H[PL.idx])+.3,z:PL.z,vx:n.x*10,vz:n.z*10,vy:3,rs:(PL.idx-15)*SEG});},BIGI,WIGU,CATP,FWI,fwIgu:()=>{const pe=ents.find(e=>e.player);fwIguStart(pe.s+60);},TUBI,RIGI,NUDG,nudge:()=>nudgeStart(),IGF,IGC,IGCL,igFam:()=>{IGF.cd=0;},rigiCross:()=>{RIGI.cd=0;},mosq:()=>mosqStart(2.3),PRIS,TOX,SQX,MOSQ,BEETLE:BTL,beetle:k=>beetleStart(k||"bb"),EYEM,eyeMon:(d)=>eyeMonPlace(d||300),DADB,dadBeetle:(d)=>dadBeetlePlace(d||450),DSTK,dadStacks:()=>DSTK.forEach((s,j)=>{s.n=5+j*3;}),BIGF,bigfoot:()=>bigfootStart(),BAYM,seaMon:b=>seaMonStart(b),SFB,HMQ,HYI,beetleCrush:p=>beetleCrush(p),TNK,tankerSmash:()=>tnkStart(),CRIT,MQ,GULL,CLF,LOGT,CROWS,BIRDS,SKUNK,TUMB,PENNY,SFX,SNAP,BRH,BK,TFL,MILL,AIR,GGQ,DUCK,DEB,CQ,FQ,CRACKS,fqArm,frame:()=>frame(true),Terrain,hills,VS,VE,VI,rst:u=>resetVehicle(VS,hero.M.dyn,u),dyn:()=>hero.M.dyn,vc,vcp,edgeAt,wallAt,G,PL,ents,keys,wx,wrecks,LT,ANN,struck,boltTo,intro:()=>INTRO,Z,NS,zoneOf,startDrive,startDive,EYES:()=>EYES,OILB,OILX,TRAF,BURN,QK,CABLE,H,SEG,P,scene,camera,THREE,kS,XW,
  jumpTo:k=>jumpTo(JUMPS[k]?JUMPS[k][0]:k),JUMPS,
  goto:i=>{i=wrapI(i);PL.idx=i;PL.x=P[i].x-Nn[i].x*3;PL.z=P[i].z-Nn[i].z*3;PL.h=G.camH=yaw(i);PL.vx=Math.sin(PL.h)*30;PL.vz=Math.cos(PL.h)*30;resetVehicle(VS,hero.M.dyn,30);ents.find(e=>e.player).s=i*SEG;first=true;},
  introAt:(type,n)=>{if(!INTRO)startIntro();const s=INTRO.shots.filter(x=>x.type===type)[n||0];G.t=s.t0+s.d*.4;INTRO.hold=1;return s;},step:n=>{for(let i=0;i<n;i++)sim(1/60);},autopilot,info:()=>renderer.info.render,
  level:()=>{if(!AC)return'no audio';if(!window.__an){window.__an=AC.createAnalyser();master.connect(window.__an);}const d=new Float32Array(2048);window.__an.getFloatTimeDomainData(d);let s=0,p=0;for(const v of d){s+=v*v;p=Math.max(p,Math.abs(v));}return{state:AC.state,rms:Math.sqrt(s/d.length).toFixed(4),peak:p.toFixed(3),step:stepN};}};
const clock=new THREE.Clock(),look=new THREE.Vector3(),camP=new THREE.Vector3();let tm=0,first=true;
function frame(manual){
  const rdt=Math.min(clock.getDelta(),.05);tm+=rdt;
  if(G.slowT>0){G.slowT-=rdt;if(G.slowT<=0)G.slow=1;}
  let dt=rdt*G.slow;if(G.paused||G.state==='title')dt=0;
  const pe=ents.find(e=>e.player);
  if(G.state==='count'){G.t+=rdt;const n=3-Math.floor(G.t);if(n!==G.count){G.count=n;if(n>0){say(''+n,'',1);sfxBeep(false);}else{say('PARTEZ !','',1.2);sfxBeep(true);sfxRoar();G.waveT=tm+5;G.state='race';first=true;announce("Et c'est parti pour les vingt-quatre heures !");}}placeAll(0);
    // drivers sprint across the road to their cars; engines fire and smoke as they arrive
    runStart(clamp(G.t/2.7,0,1),rdt);}
  else if(G.state!=='intro'&&runners[0].visible)runners.forEach(r=>{r.visible=false;});
  let shot=null;if(G.state==='intro')shot=introTick(rdt);
  if(G.state==='race'||G.state==='finish')sim(dt);
  if(QS.has('boom')&&G.raceT>1.5&&!G.boomed){G.boomed=1;PL.vx+=Nn[PL.idx].x*14;PL.vz+=Nn[PL.idx].z*14;crashPlayer(14,false);}
  if(G.msgT>0){G.msgT-=rdt;if(G.msgT<=0)$('msg').innerHTML='';}
  updateWeather(rdt);
  updateLightning(rdt);announcerTick(rdt,pe);if(DRIVE)driveTick(rdt);
  const hour=QS.has('t')?+QS.get('t'):DRIVE?(15.5+G.raceT/4200*24)%24:(()=>{const p=clamp(pe.dist/(LAPS*LEN),0,1);return (p<.5?16+p/.5*4.6:p<.74?20.6+(p-.5)/.24*8.6:29.2+(p-.74)/.26*10.8)%24;})();   // the three laps span the full 24 hours of light
  if(G.state==='finish')G.finT+=rdt;
  if(flagman){const near=wdiff(S0-pe.s),wave=G.state==='finish'||tm<(G.waveT||0)||G.state==='count'||(PL.lapN>=LAPS-1&&near<320&&near>-30);flagman.arm.rotation.z=wave?Math.sin(tm*9)*.75:lerp(flagman.arm.rotation.z,2.5,.1);flagman.flag.rotation.y=wave?Math.sin(tm*13)*.5:0;}
  // McQueen is out of the car, smoking, whenever he is not driving
  const w=hero.wreck,idle=G.state==='title'||(G.paused&&!w)||(G.state==='finish'&&G.stopT>.6&&!w),after=!!(PL.crash&&w&&PL.crash.t>2.4&&Math.hypot(w.vx,w.vz)<1.5&&w.y<=0);
  mcq.visible=idle||after;
  if(idle){V.set(-1.55,0,.35);hero.localToWorld(V);mcq.position.copy(V);mcq.rotation.y=hero.rotation.y-1.75;}
  else if(after){const i=w.idx;mcq.position.set(w.x-T[i].x*5-Nn[i].x*PL.crash.sd*2.5,0,w.z-T[i].z*5-Nn[i].z*PL.crash.sd*2.5);mcq.rotation.y=Math.atan2(w.x-mcq.position.x,w.z-mcq.position.z);}
  const diving=!!(PL.crash&&PL.crash.dive);if(diving)diveScene(tm);
  if(SEAM){if(SEAW===null){SEAW=0;scene.traverse(o=>{if(o.isMesh&&o.material===SEAM)SEAW=o;});}const rs=!(diving&&PL.crash.ph>=1);if(SEAW&&SEAW.receiveShadow!==rs)SEAW.receiveShadow=rs;}   // no shadows on the bay while down on the water in the dive scene: the bridge rails threw jagged, pixelly stripes across it
  updateMcq(tm,rdt);
  // cameras
  const sh=G.shake;G.shake*=Math.exp(-4*rdt);const jx=R(-1,1)*sh*.25,jy=R(-1,1)*sh*.25;
  const fx=Math.sin(PL.h),fz=Math.cos(PL.h),f=pe.v,cock=G.cam===1&&!idle&&!PL.crash;
  hero.canopy.visible=!cock;interior.visible=cock;mcq.visible=mcq.visible&&G.state!=='count';
  if(G.titleClose>0)G.titleClose-=rdt;
  const gridShot=G.state==='count'||(G.state==='title'&&G.titleClose<=0&&!QS.has('a')&&!DRIVE);
  if(shot&&G.state==='intro')introCam(shot);
  else if(gridShot){ // the 1970 start photograph: long lens, high behind the grid, looking down the pit straight
    at(S0-96+Math.sin(tm*.15)*2,8.6,6.2,camera.position);camera.fov=25;at(S0+30,1.5,.4,look);hero.canopy.visible=true;interior.visible=false;}
  else if(idle){const a=QS.has('a')?+QS.get('a'):G.state==='title'?-.85+Math.sin(tm*.12)*.55:-.85+tm*.2;camP.set(hero.position.x+Math.sin(hero.rotation.y+a)*8.8,1.15+Math.sin(tm*.2)*.2,hero.position.z+Math.cos(hero.rotation.y+a)*8.8);camera.position.copy(camP);camera.fov=27;look.copy(hero.position).setY(.75);V.set(G.state==='title'?-1.5:-.5,0,.6);look.add(V.applyAxisAngle(YAX,hero.rotation.y));}
  else if(diving&&PL.crash.lake)lakeCam(PL.crash,rdt,jx);
  else if(diving){const D=PL.crash;   // watch the fall from the deck, then come down to the water for the rescue
    if(D.ph<1||D.tt-D.t1<1.2){V.set(-.24,.86,.12);hero.localToWorld(V);camera.position.copy(V);camera.position.x+=jx;camera.fov=lerp(camera.fov,78,.2);look.set(-.24,.55,30);hero.localToWorld(look);hero.canopy.visible=false;interior.visible=true;}   // the driver's view, falling to the water and under it
    else if(D.tt-D.t1>1.2&&D.tt-D.t1<9.2){const u=D.tt-D.t1,a=u*.22+1,ty=u>6.3?mcq.position.y+.9:hero.position.y+1;V.set(D.wx+Math.cos(a)*10.5,ty+1.7,D.wz+Math.sin(a)*10.5);camP.lerp(V,D.camU?clamp(rdt*3,0,1):1);D.camU=1;camera.position.copy(camP);camera.fov=lerp(camera.fov,46,.1);look.lerp(V2.set(D.wx,ty,D.wz),.15);}   // under water, circling the car
    else if(D.tt-D.t1>=15.5){const u=D.tt-D.t1,bob=Math.sin(tm*1.6)*.07;interior.visible=false;   // McQueen's eyes: the tanker bearing down on him, then the run on the manatee's back
      if(u<17.6){camera.position.set(D.wx+jx,-43.5+bob+sst(u,17.1,17.6)*.3,D.wz);camera.fov=lerp(camera.fov,64,.15);V2.copy(SEA.tk.position).setY(-34);if(!D.camP){D.camP=1;look.copy(V2);}else look.lerp(V2,.2);}
      else{const m=manatee.position,F=D.F;camera.position.set(m.x-F[0]*.5+jx,m.y+2.2+Math.sin(tm*9)*.05,m.z-F[1]*.5);camera.fov=lerp(camera.fov,76,.1);look.lerp(V2.set(m.x+F[0]*30,m.y-.4,m.z+F[1]*30),.22);}}   // a whip-pan away from the bow and off they go
    else{if(!D.camS){const j=wrapI(D.idx),n=Nn[j],tg=T[j],dl=(D.wx-P[j].x)*n.x+(D.wz-P[j].z)*n.z,lat=D.sd*Math.max(Math.abs(dl)+9,12)-dl;   // on the surface: out to the side, clear of the bridge and its piers, a little ahead
        D.camS=[D.wx+n.x*lat+tg.x*5,D.wz+n.z*lat+tg.z*5];}
      V.set(D.camS[0],-43.3,D.camS[1]);camP.lerp(V,D.camW?clamp(rdt*2,0,1):1);D.camW=1;camera.position.copy(camP);camera.fov=lerp(camera.fov,30,.1);look.lerp(V2.set(D.wx,-44.7,D.wz),.2);}}
  else if(PL.crash){if(!PL.crash.cam){PL.crash.cam=1;at(PL.crash.s+55,-PL.crash.sd*5.5,1.6,camP);look.copy(hero.position);}camera.position.copy(camP);camera.position.x+=jx;camera.position.y+=jy;
    const d=camP.distanceTo(hero.position);camera.fov=lerp(camera.fov,clamp(2*Math.atan(6/d)*57.3,9,38),.08);look.lerp(V.copy(hero.position).setY(hero.position.y+.6),.2);}
  else if(G.state==='finish'&&G.finT<4.4&&!DRIVE){at(S0-15,-(RW-3.4),1.05,camera.position);camera.fov=lerp(camera.fov,34,.2);look.lerp(V.copy(hero.position).setY(.6),first?1:.25);}   // low by the line as the flag falls
  else if(G.cam===0){ // chase: the camera swings round a little behind the car, so you see it turn in
    let dh=((PL.h-G.camH+Math.PI*3)%(Math.PI*2))-Math.PI;G.camH+=dh*clamp(rdt*4.5,0,1);if(first)G.camH=PL.h;
    const gy=PL.cy||0,sl=PL.air?0:PL.slope||0,mq=MOSQ.lift?clamp((PL.cy-PL.gy)/12,0,1):0,cd=7.4+mq*4;camera.position.set(PL.x-Math.sin(G.camH)*cd+jx,(hero.M.camY||1.75)+gy-sl*7.4+jy+mq*4.5+Math.sin(tm*31)*.008*f/60,PL.z-Math.cos(G.camH)*cd);camera.fov=lerp(56,74,clamp(f/105,0,1));look.set(PL.x+fx*9,.85+gy+sl*9-mq*3.5,PL.z+fz*9);}   // carried up by the mosquito: back and above, looking down past the car at the road
  else if(G.cam===1){V.set(-.24,.86,.12);hero.localToWorld(V);camera.position.copy(V);camera.position.y+=jy+Math.sin(tm*37)*.004*f/60;camera.fov=74;look.set(-.24-PL.steer*3,.68,30);hero.localToWorld(look);
    interior.spin.rotation.z=PL.steer*1.5;const sw=(n,k)=>{n.rotation.z=-Math.PI*.75+clamp(k,0,1)*Math.PI*1.5;},D=interior.d,rv=PL.rpm/8400;
    sw(interior.needle,rv);sw(D.spd,Math.abs(f)*3.6/400);sw(D.temp,.42+rv*.3);sw(D.press,.25+rv*.55);sw(D.fuel,1-G.raceT/G.RACE*.9);sw(D.amp,.55+Math.sin(tm*3)*.01);interior.lamp.material.color.setHex(PL.warn?0xff2a12:0x330000);
    for(const s of interior.smoke){const u=s.userData;u.t+=rdt;if(u.t>u.L){u.t=0;u.L=R(4,6.5);u.sx=R(-1,1);u.sz=R(-1,1);}const k=u.t/u.L,sc=.03+k*.44;
      s.position.set(-.4+u.sx*k*.36+Math.sin(tm*.7+u.sz*6)*.04*k,.72+k*.2+Math.sin(k*3)*.03,.48-k*.42+u.sz*k*.1);s.scale.set(sc,sc,1);s.material.opacity=Math.sin(Math.min(1,k*1.2)*Math.PI)*.2;}}
  else if(G.cam===2){camera.position.set(PL.x+Math.sin(tm*.07)*34,52+(PL.gy||0),PL.z+Math.cos(tm*.07)*34);camera.fov=30;look.set(PL.x+fx*6,PL.gy||0,PL.z+fz*6);}
  else{if(G.tvS===null||wdiff(G.tvS-pe.s)<-22||wdiff(G.tvS-pe.s)>240){G.tvS=wrapS(pe.s+150+Math.random()*40);G.tvSide=Math.random()<.5?-1:1;}
    at(G.tvS,G.tvSide*8.4,1.4+((G.tvS*7)%3),camera.position);const dd=camera.position.distanceTo(hero.position);camera.fov=clamp(2*Math.atan(5.5/dd)*57.3,7,42);look.copy(hero.position).setY(hero.position.y+.6);look.x+=jx;}
  camera.updateProjectionMatrix();if(G.heave)camera.position.y+=G.heave;camera.lookAt(look);if(G.roll)camera.rotateZ(G.roll);first=false;
  if(rdt>0){camVel.copy(camera.position).sub(camPrev).divideScalar(rdt);if(camVel.length()>200)camVel.set(0,0,0);camPrev.copy(camera.position);}
  setTime(hour,tm);if(DRIVE){if(G.uw>0)underwater(G.uw);else if(SEA.dome.visible){SEA.dome.visible=false;SEA.light.intensity=0;}
    if(G.smk>.01&&G.tun>.2){const k=G.smk*G.tun;scene.fog.color.multiplyScalar(1-k*.93);scene.fog.near=lerp(scene.fog.near,1.5,k);scene.fog.far=lerp(scene.fog.far,26,k);}   // black smoke building up in the tube
    const fk=sst(PL.idx,Z.b0-250,Z.b0-70)*(1-sst(PL.idx,Z.b0+110,Z.b0+330))*sst(hour,6,8)*(1-sst(hour,17.5,19.5))*(1-G.brg*.7)*(PL.crash?0:1);$('flare').style.opacity=(fk*(.8+.1*Math.sin(tm*2.3))).toFixed(3);}   // low sun in your eyes on the climb to the bridge
  updatePrecip(rdt,tm);updateFx(dt>0?dt:(G.state==='title'||G.paused?rdt:0),rdt);
  if(DRIVE){const cp=camera.position;for(const o of CULL){const s=o.boundingSphere||o.geometry.boundingSphere,r=3000+s.radius;o.visible=cp.distanceToSquared(s.center)<r*r;}}   // scenery beyond 3 km is in the fog anyway
  sky.position.copy(camera.position);hills.position.copy(camera.position).setY(DRIVE?camera.position.y+93:95);
  if(DRIVE){Terrain.updatePanorama(camera.position.x,camera.position.z,Math.max(camera.position.y,1));Terrain.pump(camera.position.x,camera.position.z,3.5);}   // the horizon follows the car; the hills are raised a few tiles a frame, nearest first
  if(G.state!=='title')hud(pe,hour);
  updateAudio(PL.rpm,PL.thr,Math.abs(f),PL.slip);
  if(ferris)ferris.rotation.z+=rdt*.1;if(ferris)for(const g of gondolas)g.rotation.z=-ferris.rotation.z;
  grade.uniforms.time.value=tm;if(innerWidth>0&&innerHeight>0)composer.render();if(manual!==true)requestAnimationFrame(frame);
}
if(DRIVE){await BOOT.step("RAISING THE NEAREST HILLS",.96);Terrain.pump(P[START_I].x,P[START_I].z,400);Terrain.updatePanorama(P[START_I].x,P[START_I].z,2);}
await BOOT.step("COMPILING SHADERS",.97);
try{renderer.compile(scene,camera);}catch(e){}
frame();
await BOOT.finish();
// Oil tankers that blow up: every so often one of the tankers in view (anchored off the refinery by the Richmond-San Rafael Bridge, or out on the stormy sea along I-80)
// goes up in a huge fireball, a second and third blast after it, then burns on with a tall column of black smoke (a BURN fire that never goes out).
function oilTick(rdt){if(!DRIVE||G.state!=='race'||PL.crash)return;OILB.t-=rdt;
  if(OILB.t<=0){OILB.t=R(7,15);const c=OILX.filter(o=>!o.lit&&o.g.visible&&Math.hypot(o.g.position.x-PL.x,o.g.position.z-PL.z)<1600&&Math.hypot(o.g.position.x-PL.x,o.g.position.z-PL.z)>120);
    if(c.length){const o=c[Math.random()*c.length|0];o.lit=1;for(let k=0;k<3;k++)OILB.q.push({o,t:k*R(.5,.8)+k*.2,big:k===0});}}
  for(let k=OILB.q.length-1;k>=0;k--){const b=OILB.q[k];b.t-=rdt;if(b.t>0)continue;OILB.q.splice(k,1);const o=b.o,s=o.s*(b.big?1.4:1);
    o.g.updateMatrixWorld();const p=o.g.localToWorld(new THREE.Vector3(R(-2,2),o.y,R(-o.L/3,o.L/3))),d=Math.hypot(p.x-PL.x,p.z-PL.z);
    for(let q=0;q<46;q++){const a=R(0,6.283),sp=R(2,16)*s;puff(V.set(p.x,p.y+2,p.z),Math.cos(a)*sp,R(6,30)*s,Math.sin(a)*sp,R(4,8)*s,R(16,34)*s,R(1,2.2),.95,q%3?0xff7a1c:0xffd060);}   // the fireball
    for(let q=0;q<22;q++){const a=R(0,6.283),sp=R(1,7)*s;puff(V.set(p.x,p.y+6,p.z),Math.cos(a)*sp,R(10,26)*s,Math.sin(a)*sp,R(6,10)*s,R(24,44)*s,R(3,6),.75,0x151311);}   // and the black cloud over it
    BURN.push({x:p.x,y:p.y+1,z:p.z,s:3.2*s});
    const k2=clamp(1-d/1600,.15,1);G.shake=Math.max(G.shake,.55*k2);sfxThump(2.2*k2);sfxCrunch(k2);if(b.big&&d<1300)say('A TANKER BLOWS UP !','',2);}}
