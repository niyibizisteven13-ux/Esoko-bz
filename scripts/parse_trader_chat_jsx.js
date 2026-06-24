const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../src/components/trader/TraderChat.tsx');
const text = fs.readFileSync(filePath, 'utf8');
const lines = text.split('\n');
const re = /<\/?([A-Za-z0-9_.-]+)([^>]*)>/g;
const stack = [];
let match;
while ((match = re.exec(text))) {
  const token = match[0];
  const tag = match[1].startsWith('motion.') ? 'motion.div' : match[1];
  const closing = token.startsWith('</');
  const selfClosing = /\/\s*>$/.test(token) || tag === 'input' || tag === 'img' || tag === 'br' || tag === 'hr' || tag === 'meta';
  const line = text.slice(0, match.index).split('\n').length;
  if (closing) {
    if (!stack.length || stack[stack.length - 1].tag !== tag) {
      console.log('Mismatch close', tag, 'line', line, 'stack top', stack[stack.length - 1]);
      break;
    }
    stack.pop();
  } else if (!selfClosing) {
    stack.push({ tag, line });
  }
}
if (stack.length) {
  console.log('Unclosed tags tail:');
  console.log(stack.slice(-10));
} else {
  console.log('No unmatched tags found');
}
