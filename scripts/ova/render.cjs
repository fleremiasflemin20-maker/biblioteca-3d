const { chromium } = require('playwright')
const [,, cfgFile, outFile, w, h] = process.argv
;(async () => {
  const cfg = JSON.parse(require('fs').readFileSync(cfgFile,'utf8')); if (w) { cfg.w=+w; cfg.h=+h }
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] })
  const p = await b.newPage({ viewport: { width: 960, height: 540 } })
  p.on('console', m => console.log('console:', m.text()))
  await p.goto('http://localhost:8765/escena.html#' + encodeURIComponent(JSON.stringify(cfg)))
  await p.waitForFunction(() => document.title.startsWith('LISTO') || document.title.startsWith('ERROR'), null, { timeout: 300000 })
  console.log(await p.title())
  const data = await p.evaluate(() => document.getElementById('out').toDataURL('image/png'))
  require('fs').writeFileSync(outFile, Buffer.from(data.split(',')[1], 'base64'))
  await b.close()
})()
