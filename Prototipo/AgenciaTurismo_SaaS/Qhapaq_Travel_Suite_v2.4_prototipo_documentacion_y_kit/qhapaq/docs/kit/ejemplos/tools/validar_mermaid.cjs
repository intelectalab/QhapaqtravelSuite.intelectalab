// Renderiza (valida) cada bloque ```mermaid de kit-ia/GUIA-TECNICA.md y kit-ia/ejemplos/README.md con Chromium headless.
// Variables: PLAYWRIGHT (ruta del paquete playwright), CHROMIUM (ejecutable), MERMAID_JS (mermaid.min.js).
// Uso: node kit-ia/ejemplos/tools/validar_mermaid.cjs
const fs = require('fs');
const path = require('path');
const KIT = path.resolve(__dirname, '..', '..');
const PW = process.env.PLAYWRIGHT || [path.resolve(KIT, '..', 'node_modules', 'playwright'), path.resolve(KIT, '..', '..', 'node_modules', 'playwright')].find(p => fs.existsSync(p)) || 'playwright';
const { chromium } = require(PW);
const MERMAID = process.env.MERMAID_JS || '/tmp/mk/node_modules/mermaid/dist/mermaid.min.js';
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

(async () => {
  const files = [path.join(KIT, 'GUIA-TECNICA.md'), path.join(KIT, 'ejemplos', 'README.md')].filter((f) => fs.existsSync(f));
  const b = await chromium.launch(fs.existsSync(EXE) ? { executablePath: EXE } : {});
  const p = await b.newPage();
  await p.setContent('<html><body></body></html>');
  await p.addScriptTag({ path: MERMAID });
  await p.evaluate(() => mermaid.initialize({ startOnLoad: false }));
  let n = 0;
  let bad = 0;
  for (const f of files) {
    const md = fs.readFileSync(f, 'utf8');
    for (const m of md.matchAll(/```mermaid\n([\s\S]*?)```/g)) {
      n++;
      try {
        await p.evaluate(async (a) => (await mermaid.render(a.id, a.code)).svg, { code: m[1], id: 'd' + n });
      } catch (e) {
        bad++;
        console.error(`✗ ${path.basename(f)} diagrama ${n}: ${String(e).slice(0, 200)}`);
      }
    }
  }
  await b.close();
  console.log(`${bad ? 'ERROR' : 'OK '} Mermaid: ${n - bad}/${n} diagramas válidos`);
  process.exit(bad ? 1 : 0);
})();
