const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../src/components/trader/TraderChat.tsx');
const text = fs.readFileSync(filePath, 'utf8');
const re = /<\s*(\/?)\s*([A-Za-z0-9_.-]+)([^>]*?)>/g;
const ignored = new Set(['input','img','br','hr','meta','link','source','path','rect','circle','line','polyline','polygon','ellipse']);
const stack = [];
let match;
while ((match = re.exec(text))) {
  const closing = match[1] === '/';
  const tag = match[2].startsWith('motion.') ? 'motion.div' : match[2];
  const token = match[0];
  const selfClosing = /\/\s*>$/.test(token) || ignored.has(tag);
  const line = text.slice(0, match.index).split(/\r?\n/).length;
  if (closing) {
    if (!stack.length || stack[stack.length - 1].tag !== tag) {
      console.log('Mismatch close', tag, 'line', line, 'stack top', stack[stack.length - 1]);
      process.exit(0);
    }
    stack.pop();
  } else if (!selfClosing) {
    stack.push({ tag, line });
  }
}
if (stack.length) {
  console.log('Unclosed tags tail', stack.slice(-20));
} else {
  console.log('No unmatched tags detected');
}
