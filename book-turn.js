/* Shared, local page-turn renderer. Both faces are textured on a flexible mesh. */
window.turnBook=async function({book,front,back,forward,url,prepare,finish,edge}){
 let canvas; try{
 const images=await Promise.all([front,back].map(async p=>{if(!p)return null;const im=new Image();im.src=url(p);await im.decode();return im;}));
 const w=book.clientWidth/2,h=book.clientHeight,dpr=Math.min(devicePixelRatio||1,2),pad=h*.24;
 canvas=document.createElement('canvas');canvas.width=Math.ceil(2*w*dpr);canvas.height=Math.ceil((h+2*pad)*dpr);
 Object.assign(canvas.style,{position:'absolute',left:'0',top:`${-pad/h*100}%`,width:'100%',height:`${(h+2*pad)/h*100}%`,zIndex:8,pointerEvents:'none'});
 const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);book.append(canvas);book.classList.add('moving');
 const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:edge?1500:1100;
 const sign=forward?1:-1,N=120;
 function draw(t){const angle=Math.PI*t, wave=Math.sin(angle);ctx.clearRect(0,0,2*w,h+2*pad);
 const pts=[{x:w,z:0}];for(let j=0;j<N;j++){const u=(j+.5)/N,a=angle+(edge?.06:.95)*wave*(2*u-0.65);const p=pts[j];pts.push({x:p.x+sign*w/N*Math.cos(a),z:p.z+w/N*Math.sin(a)});}
 const project=p=>{const s=1/(1-p.z/(w*5));return {x:w+(p.x-w)*s,y:pad+h*(1-s)/2,h:h*s,z:p.z};};
 const pp=pts.map(project),tip=pp[N].x;
 const shadow=ctx.createLinearGradient(Math.min(w,tip)-w*.16,0,Math.max(w,tip)+w*.16,0);shadow.addColorStop(0,'transparent');shadow.addColorStop(.5,`rgba(0,0,0,${.42*wave})`);shadow.addColorStop(1,'transparent');ctx.fillStyle=shadow;ctx.fillRect(Math.min(w,tip)-w*.16,pad,Math.abs(tip-w)+w*.32,h);
 const strips=Array.from({length:N},(_,j)=>j).sort((a,b)=>pp[a].z+pp[a+1].z-pp[b].z-pp[b+1].z);
 for(const j of strips){const a=pp[j],b=pp[j+1],face=sign*(b.x-a.x)>=0,im=images[face?0:1];if(!im)continue;const x=Math.min(a.x,b.x),width=Math.abs(b.x-a.x)+.65,y=(a.y+b.y)/2,hh=(a.h+b.h)/2,u=(forward===face?j:N-1-j)/N;
 ctx.drawImage(im,u*im.width,0,im.width/N,im.height,x,y,width,hh);
 const light=Math.cos(angle+(edge?.06:.95)*wave*(2*j/N-.65));ctx.fillStyle=`rgba(0,0,0,${wave*(.08+.26*(1-Math.abs(light)))})`;ctx.fillRect(x,y,width,hh);ctx.fillStyle=`rgba(255,255,255,${wave*.12*Math.max(0,light)})`;ctx.fillRect(x,y,width,hh);}
 if(edge&&wave>.01){ctx.strokeStyle=`rgba(210,200,185,${wave*.7})`;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(tip,pp[N].y);ctx.lineTo(tip,pp[N].y+pp[N].h);ctx.stroke();}}
 draw(0);prepare();await new Promise(resolve=>{let start;function tick(now){start??=now;const r=duration?Math.min(1,(now-start)/duration):1;draw(r*r*(3-2*r));if(r<1)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});
 }catch(e){console.warn('Page animation fallback',e);}finally{if(canvas)canvas.remove();book.classList.remove('moving');finish();}
};
