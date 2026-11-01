const fs = require('fs');
const path = require('path');

const root = __dirname;
const core = fs.readFileSync(path.join(root, 'src', 'core.js'), 'utf8');

const out = core.replace(/^[ \t]*\/\/ @include (.+)[ \t]*$/gm, (_, rel) => {
  const file = path.join(root, rel.trim());
  const body = fs.readFileSync(file, 'utf8').replace(/\s+$/, '');

  return body
    .split('\n')
    .map(line => (line ? `  ${line}` : ''))
    .join('\n');
});

if (out.includes('// @include ')) {
  throw new Error('Unresolved @include');
}

fs.writeFileSync(path.join(root, 'clean-ads.user.js'), out.endsWith('\n') ? out : `${out}\n`);
