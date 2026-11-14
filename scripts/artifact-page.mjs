// Zet dist-artifact/index.html om naar de vorm die een claude.ai-Artifact verwacht: enkel de pagina-inhoud
// (titel, stijlen, scripts, root-element). Het Artifact-platform voegt zelf doctype, <head> met charset/viewport
// en een kleine reset toe. Schrijft ook artifact-files.json: de lijst van mee te publiceren bestanden.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const dir = 'dist-artifact';
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const head = html.match(/<head>([\s\S]*)<\/head>/)?.[1] ?? '';
const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? '';

const keep = [
  ...head.matchAll(/<style>[\s\S]*?<\/style>/g),
  ...head.matchAll(/<script>[\s\S]*?<\/script>/g),
  ...head.matchAll(/<script type="module"[^>]*><\/script>/g),
  ...head.matchAll(/<link rel="(?:modulepreload|stylesheet)"[^>]*>/g),
].map((m) => m[0]);

const page = [
  '<title>B Netwerk</title>',
  '<link rel="icon" type="image/svg+xml" href="./favicon.svg">',
  // Het Artifact-skelet zet de veilige marges (notch, home-indicator) al op :root; de app mag ze bovenaan niet
  // nog eens toepassen. Vaste balken onderaan (navigatie) tellen ze wel zelf mee.
  '<script>document.documentElement.classList.add("artifact-mode")</script>',
  ...keep,
  body.trim(),
].join('\n');

writeFileSync(join(dir, 'page.html'), page + '\n');

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(relative(dir, p).replaceAll('\\', '/'));
  }
};
walk(dir);
const publish = files.filter((f) => f !== 'index.html' && f !== 'page.html' && f !== 'artifact-files.json').sort();
writeFileSync(join(dir, 'artifact-files.json'), JSON.stringify(publish, null, 2));
console.log(`page.html (${page.length} tekens) + ${publish.length} bestanden klaar voor publicatie.`);
