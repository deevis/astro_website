import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const storyboard = await fs.readFile(path.join(root, 'scripts/cloward-piven/visual-storyboard.html'), 'utf8');
const figures = [...storyboard.matchAll(/<figure\b[\s\S]*?<\/figure>/g)].map(([markup]) => ({
  kind: markup.match(/id="([^"]+)"/)[1],
  markup: markup.replace(/<(\/?)(h[23])\b/g, (_, end, tag) => `<${end}h${Number(tag[1]) + 1}`),
}));
if (figures.length !== 8) throw new Error(`Expected eight figures; found ${figures.length}`);
const component = `---\ninterface Props { kind: ${figures.map(f => `'${f.kind}'`).join(' | ')}; }\nconst { kind } = Astro.props;\n---\n\n` + figures.map(f => `{kind === '${f.kind}' && (\n${f.markup}\n)}\n`).join('\n');
await fs.mkdir(path.join(root, 'src/components/cloward-piven'), { recursive: true });
await fs.writeFile(path.join(root, 'src/components/cloward-piven/ArticleFigure.astro'), component);

const css = postcss.parse(storyboard.match(/<style>([\s\S]*?)<\/style>/)[1]);
const ignored = /^(?:\*|html|body|main|h1|footer|\.intro|\.nav(?:\s|$)|\.placement)/;
css.walkRules(rule => {
  const selectors = rule.selectors.filter(s => !ignored.test(s.trim())).map(selector => {
    if (selector === ':root') return '.cp-story';
    selector = selector.replace(/\bh([23])\b/g, (_, level) => `h${Number(level) + 1}`);
    return /^[:a-z]/i.test(selector) ? `.cp-story .figure ${selector}` : `.cp-story ${selector}`;
  });
  if (!selectors.length) rule.remove();
  else rule.selectors = selectors;
});
const integration = `
/* Article prose and the shared article shell keep the approved full width. */
.cp-story > :is(p,ul,ol,h2,h3,blockquote,hr) { max-width:100%; margin-left:0; margin-right:0; }
.cp-story > p, .cp-story > ul, .cp-story > ol { font-size:clamp(1rem,1.4vw,1.125rem); line-height:1.85; }
.cp-story > h2 { font:700 clamp(1.35rem,2.4vw,1.8rem)/1.3 system-ui,sans-serif; margin-top:3.4rem; margin-bottom:1.2rem; scroll-margin-top:7rem; }
.cp-story > h3 { font:650 1.25rem/1.4 system-ui,sans-serif; margin:2rem 0 1rem; }
.cp-story .figure { margin:2.7rem 0 3rem; color:var(--ink); font:17px/1.6 system-ui,sans-serif; scroll-margin-top:7rem; }
.cp-story .figure :is(h3,h4,strong,th,td,summary) { color:var(--ink); }
.cp-story .figure h3 { font-weight:500; }
.cp-story .figure h4 { font-weight:650; }
.cp-story .figure .takeaway strong, .cp-story .figure .total strong { color:var(--gold); }
.cp-story .figure li { margin:0; }
.cp-story .figure ol { padding-inline-start:0; }
.cp-story .figure .axis { margin-top:5px; }
.cp-story .figure th, .cp-story .figure td { font-size:13px; }
.cp-story .cp-art-note { font-size:.75rem; color:#758496; margin-top:-.65rem; margin-bottom:1.8rem; }
.cp-story .cp-deck { font-size:clamp(1.18rem,2.1vw,1.45rem); line-height:1.6; }
.cp-story .cp-takeaway { padding:1.1rem 1.4rem; border-left:3px solid #c3954e; background:rgba(162,127,68,.08); font-size:1.15rem; line-height:1.7; margin:2rem 0; }
.cp-story .cp-takeaway p { margin:0; }
.cp-story .cp-jump { display:flex; flex-wrap:wrap; gap:.5rem 1.2rem; margin:1.6rem 0 2.2rem; font-size:.82rem; line-height:1.5; }
.cp-story .cp-method { border-top:1px solid #75849655; margin-top:3rem; padding-top:1.5rem; font-size:.87rem; line-height:1.7; }
.cp-story .cp-method p { font-size:inherit; }
@media(max-width:540px){.cp-story .figure{padding:20px;margin:2.2rem 0}.cp-story .figure h3{font-size:1.75rem}.cp-story .figure .label{font-size:13px}}
`;
await fs.writeFile(path.join(root, 'src/styles/cloward-piven.css'), '/* Generated from the approved visual storyboard by scripts/cloward-piven/build-figures.mjs. */\n' + css.toString() + integration);
console.log(`Created ArticleFigure.astro and scoped CSS for ${figures.length} figures.`);
