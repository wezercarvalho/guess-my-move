// Browser integration on the built app. No physical camera or recorded landmarks.
import assert from 'node:assert/strict'
import { createServer, request as proxyRequest } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
if (!process.env.GMM_PLAYWRIGHT_PATH) throw new Error('Defina GMM_PLAYWRIGHT_PATH para a instalação externa de Playwright.')
const { chromium } = createRequire(import.meta.url)(process.env.GMM_PLAYWRIGHT_PATH)
const root=resolve(import.meta.dirname,'../../..'), publicRoot=resolve(root,'apps/web/dist')
let apiOrigin,app,browser
const frontend=createServer(async(req,res)=>{
    if((req.url??'').startsWith('/socket.io/')||(req.url??'').startsWith('/api/')){
        const upstream=proxyRequest(new URL(req.url,apiOrigin),{method:req.method,headers:req.headers},incoming=>{res.writeHead(incoming.statusCode,incoming.headers);incoming.pipe(res)})
        upstream.on('error',()=>res.writeHead(502).end());req.pipe(upstream);return
    }
    try {
        const file=resolve(publicRoot,decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html')
        if(!file.startsWith(publicRoot+sep)){res.writeHead(404).end();return}
        const body=await readFile(file)
        res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.woff2':'font/woff2'})[extname(file)]??'application/octet-stream'});res.end(body)
    }catch{res.writeHead(404).end()}
})
frontend.on('upgrade',(req,socket,head)=>{
    const upstream=proxyRequest(new URL(req.url,apiOrigin),{headers:req.headers})
    upstream.on('upgrade',(response,remote,remoteHead)=>{
        socket.write(`HTTP/1.1 101 Switching Protocols\r\n${Object.entries(response.headers).map(([k,v])=>`${k}: ${v}`).join('\r\n')}\r\n\r\n`)
        if(head.length)remote.write(head);if(remoteHead.length)socket.write(remoteHead)
        remote.on('error',()=>socket.destroy());socket.on('error',()=>remote.destroy())
        socket.pipe(remote).pipe(socket)
    });upstream.on('error',()=>socket.destroy());upstream.end()
})
const errors=[]
try{
    await new Promise(resolve=>frontend.listen(0,'127.0.0.1',resolve))
    const origin=`http://127.0.0.1:${frontend.address().port}`
    process.env.ALLOWED_ORIGINS=origin;process.env.OBSERVE_ENABLED='false'
    const {createServerApp}=await import(pathToFileURL(resolve(root,'apps/server/dist/app.setup.js')).href)
    app=await createServerApp({logger:false});await app.listen(0,'127.0.0.1');apiOrigin=`http://127.0.0.1:${app.getHttpServer().address().port}`
    browser=await chromium.launch({headless:true,...(process.env.GMM_CHROMIUM_PATH?{executablePath:process.env.GMM_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']})
    const context=await browser.newContext({viewport:{width:1280,height:720},permissions:['camera']})
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
    await page.goto(`${origin}/swing.html?mode=training&delegate=CPU`)
    await page.getByLabel('Controles',{exact:true}).waitFor()
    await page.waitForFunction(()=>!document.querySelector('[data-testid="game-status"]')?.textContent?.includes('Carregando'))
    await page.keyboard.press('Space');await page.waitForTimeout(300)
    assert.match(await page.getByTestId('web-counter').textContent(),/Teias: 0/)
    assert.equal(await page.getByRole('checkbox',{name:/Controle ocular/}).isChecked(),false)
    assert.equal(await page.getByRole('checkbox',{name:/Controle ocular/}).isDisabled(),true)
    await page.getByLabel('Controles',{exact:true}).selectOption('keyboard')
    await page.getByRole('button',{name:'Iniciar com teclado',exact:true}).click()
    assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'CANVAS')
    await page.keyboard.down('Space');await page.waitForFunction(()=>document.querySelector('[data-testid="web-counter"]')?.textContent==='Teias: 1');await page.keyboard.up('Space')
    assert.match(await page.getByTestId('web-counter').textContent(),/Teias: 1/)
    await page.getByRole('button',{name:'Voltar ao início',exact:true}).click()
    assert.equal(await page.getByRole('button',{name:'Iniciar com teclado',exact:true}).count(),1)
    const checkCalibrationLayout = async () => {
    for(const viewport of [{width:1280,height:720},{width:1920,height:1080},{width:640,height:360}]){
        await page.setViewportSize(viewport)
        await page.getByTestId('swing-stage').scrollIntoViewIfNeeded()
        const geometry = await page.evaluate(() => {
            const stage=document.querySelector('[data-testid="swing-stage"]').getBoundingClientRect()
            const center=document.querySelector('.swing-calibration-center').getBoundingClientRect()
            const cue=document.querySelector('.swing-calibration-cue').getBoundingClientRect()
            const camera=document.querySelector('.swing-preparation-surface .camera-panel').getBoundingClientRect()
            return {viewport:[innerWidth,innerHeight],stage:stage.toJSON(),cue:cue.toJSON(),camera:camera.toJSON(),dx: Math.abs(center.x+center.width/2-stage.x-stage.width/2),dy:Math.abs(center.y+center.height/2-stage.y-stage.height/2),inside:cue.x>=stage.x && cue.right<=stage.right && camera.bottom<=stage.bottom,overlap:cue.bottom>camera.top}
        })
        assert.ok(geometry.dx<2 && geometry.dy<2,JSON.stringify(geometry))
        assert.equal(geometry.inside,true)
        assert.equal(geometry.overlap,false,JSON.stringify(geometry))
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true)
    }
    }
    await checkCalibrationLayout()
    await page.setViewportSize({width:1280,height:720})
    if(process.env.GMM_SCREENSHOT_PATH)await page.screenshot({path:process.env.GMM_SCREENSHOT_PATH,fullPage:true})
    await page.getByLabel('Controles',{exact:true}).selectOption('face')
    await page.getByRole('button',{name:'Ativar câmera',exact:true}).click()
    await page.getByRole('button',{name:'Parar câmera',exact:true}).waitFor()
    assert.equal(await page.getByTestId('swing-stage').getByTestId('camera-preview').count(),1)
    await page.waitForFunction(()=>!document.body.textContent.includes('Carregando reconhecimento'),null,{timeout:60000})
    assert.equal(await page.getByRole('button',{name:'Tentar detectores novamente'}).count(),0)
    await checkCalibrationLayout()
    await page.setViewportSize({width:1280,height:720})

    assert.match(await page.getByTestId('web-counter').textContent(),/Teias: 0/)
    await page.getByRole('button',{name:'Parar câmera',exact:true}).click()
    const other=await context.newPage();other.on('pageerror',e=>errors.push(e.message))
    for(const [p,name] of [[page,'Pessoa A'],[other,'Pessoa B']]){
        await p.goto(`${origin}/swing.html`)
        await p.getByRole('button',{name:'Cooperativo online',exact:true}).click()
        await p.getByLabel('Seu apelido').fill(name)
    }
    await page.getByRole('button',{name:'Criar sala',exact:true}).click()
    const heading=page.getByRole('heading',{name:/Sala [A-Z0-9]{6}/})
    await heading.waitFor();const code=(await heading.textContent()).match(/Sala ([A-Z0-9]{6})/)[1]
    await other.getByLabel('Código da sala').fill(code);await other.getByRole('button',{name:'Entrar na sala',exact:true}).click()
    for(const p of [page,other])await p.getByLabel('Controles',{exact:true}).waitFor()
    const video=await page.getByTestId('camera-preview').elementHandle()
    await page.getByLabel('Controles',{exact:true}).selectOption('keyboard');await page.getByRole('button',{name:'Iniciar com teclado',exact:true}).click()
    await page.waitForFunction(()=>document.querySelector('.swing-online-feedback__players')?.textContent?.includes('pronto'))
    assert.match(await page.locator('.swing-online-feedback__status').textContent(),/duas pessoas/)
    await other.getByLabel('Controles',{exact:true}).selectOption('keyboard');await other.getByRole('button',{name:'Iniciar com teclado',exact:true}).click()
    await page.waitForFunction(()=>document.querySelector('.swing-online-feedback__status')?.textContent?.includes('Coletem juntos'))
    assert.equal(await video.evaluate(el=>el.isConnected),true)
    assert.deepEqual(errors,[])
    const report={result:'PASS',browser:browser.version(),scenarios:['local input gate','keyboard explicit start','restart confirmation','ocular off by default','responsive widths and centered city calibration without overlap','real MediaPipe assets with synthetic camera/no face','cooperative two-client readiness','persistent camera element lobby to playing'],limitations:['no physical camera or ocular accuracy measurement','software WebGL','loopback only']}
    if(process.argv[2])await writeFile(resolve(process.argv[2]),JSON.stringify(report,null,2)+'\n')
    console.log(JSON.stringify(report));await context.close()
}catch(error){
    console.error('Browser errors:',errors)
    for(const context of browser?.contexts()??[])for(const page of context.pages())console.error('Visible page:',(await page.locator('body').innerText()).slice(0,2000))
    throw error
}finally{await browser?.close();await app?.close();frontend.closeAllConnections();await new Promise(resolve=>frontend.close(resolve))}
