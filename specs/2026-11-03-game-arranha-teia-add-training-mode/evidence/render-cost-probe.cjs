const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.addInitScript(()=>{window.__gpu={draws:0,resizes:0,frames:0};for(const name of ['clear','drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const original=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(name==='clear')window.__gpu.frames++;else window.__gpu.draws++;return original.apply(this,args)}};const d=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,'width');Object.defineProperty(HTMLCanvasElement.prototype,'width',{...d,set(v){if(this.classList.contains('swing-scene'))window.__gpu.resizes++;d.set.call(this,v)}})});
 await page.goto((process.env.SWING_URL || 'http://127.0.0.1:5180/swing.html?mode=training'));await page.getByTestId('swing-stage').waitFor();await page.waitForTimeout(2000);
 const measure=await page.evaluate(async()=>{window.__gpu={draws:0,resizes:0,frames:0};await new Promise(r=>setTimeout(r,2000));return {...window.__gpu,fit:getComputedStyle(document.querySelector('video')).objectFit}});
 console.log(JSON.stringify(measure));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
