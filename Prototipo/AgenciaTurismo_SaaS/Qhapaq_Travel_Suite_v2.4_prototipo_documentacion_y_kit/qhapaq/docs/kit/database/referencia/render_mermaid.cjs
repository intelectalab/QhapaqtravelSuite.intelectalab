// Renderiza archivos Mermaid (.mmd) a SVG con Chromium headless (Playwright) y mermaid.min.js local.
// Uso: node render_mermaid.cjs <carpeta> <nombre1> [<nombre2> …]   (lee <carpeta>/<nombre>.mmd, escribe <carpeta>/<nombre>.svg)
// Variables: PLAYWRIGHT_MODULE (ruta al paquete playwright), CHROMIUM_PATH (ejecutable), MERMAID_JS (mermaid.min.js v10+).
// Con --check solo valida la sintaxis (no escribe archivos): node render_mermaid.cjs --check archivo.json
//   (archivo.json = {"id": "código mermaid", …}); imprime los ids con error.
const fs = require('fs');
const path = require('path');

function firstExisting(list) { return list.find((p) => p && fs.existsSync(p)); }
const ROOT = path.resolve(__dirname, '../../..'); // carpeta del proyecto (contiene node_modules/ si se instaló ahí)
const pwPath = firstExisting([process.env.PLAYWRIGHT_MODULE, path.join(ROOT, 'node_modules/playwright'), path.join(ROOT, '../node_modules/playwright')]) || 'playwright';
const { chromium } = require(pwPath);
const mermaidJs = firstExisting([process.env.MERMAID_JS, path.join(ROOT, 'node_modules/mermaid/dist/mermaid.min.js'),
  path.join(ROOT, '../node_modules/mermaid/dist/mermaid.min.js'), '/tmp/mk/node_modules/mermaid/dist/mermaid.min.js']);
if (!mermaidJs) { console.error('No se encontró mermaid.min.js. Instale: npm i mermaid@10 (o defina MERMAID_JS).'); process.exit(2); }
const chromePath = firstExisting([process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell']);

(async () => {
  const args = process.argv.slice(2);
  const browser = await chromium.launch(chromePath ? { executablePath: chromePath } : {});
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ path: mermaidJs });
  await page.evaluate(() => mermaid.initialize({
    startOnLoad: false, theme: 'base', maxTextSize: 2000000, maxEdges: 5000, securityLevel: 'strict',
    fontFamily: '"Plus Jakarta Sans", system-ui, "Segoe UI", Roboto, sans-serif',
    er: { useMaxWidth: false, layoutDirection: 'TB', minEntityWidth: 80 },
    flowchart: { useMaxWidth: false, htmlLabels: true },
    state: { useMaxWidth: false },
    themeVariables: {
      primaryColor: '#EAF3FC', primaryBorderColor: '#0A3A73', primaryTextColor: '#15202E', lineColor: '#4A5568',
      secondaryColor: '#F7F9FC', tertiaryColor: '#FFFFFF', fontSize: '13px',
      attributeBackgroundColorOdd: '#FFFFFF', attributeBackgroundColorEven: '#F4F7FB',
    },
  }));
  const render = (id, code) => page.evaluate(async (a) => {
    try { return { svg: (await mermaid.render(a.id, a.code)).svg.replace(/<br>/g, '<br/>') }; } catch (e) { return { error: String(e && e.message || e) }; }
  }, { id, code });
  let failed = 0;
  if (args[0] === '--check') {
    const items = JSON.parse(fs.readFileSync(args[1], 'utf8'));
    let i = 0;
    for (const [key, code] of Object.entries(items)) {
      const r = await render('c' + (i++), code);
      if (r.error) { failed++; console.log('ERROR ' + key + ': ' + r.error.split('\n').slice(0, 3).join(' ')); }
    }
    console.log(`Mermaid: ${Object.keys(items).length - failed}/${Object.keys(items).length} diagramas válidos`);
  } else {
    const [dir, ...names] = args;
    for (const [i, n] of names.entries()) {
      const code = fs.readFileSync(path.join(dir, n + '.mmd'), 'utf8');
      const r = await render('d' + i, code);
      if (r.error) { failed++; console.log('ERROR ' + n + ': ' + r.error); continue; }
      fs.writeFileSync(path.join(dir, n + '.svg'), r.svg);
      console.log(`svg  ${n}.svg  ${(r.svg.length / 1024).toFixed(0)} KB`);
    }
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
