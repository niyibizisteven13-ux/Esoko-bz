const fs = require('fs');
const path = 'src/components/trader/TraderChat.tsx';
const text = fs.readFileSync(path, 'utf8');
const re = /<(\/?)([A-Za-z0-9_.-]+)([^>]*)>/g;
const selfClosingTags = new Set(['input','img','br','hr','meta','link']);
const stack = [];
let m;
while((m=re.exec(text))){
  const closing = m[1] === '/';
  let tag = m[2];
  if(tag.startsWith('motion.')) tag = 'motion.div';
  const token = m[0];
  const selfClosing = /\/\s*>$/.test(token) || selfClosingTags.has(tag) || token.endsWith('/>');
  const idx = m.index;
  const line = text.slice(0, idx).split(/\r?\n/).length;
  if(closing){
    if(!stack.length || stack[stack.length-1].tag !== tag){
      console.log('Mismatch close', tag, 'line', line, 'expected', stack.length?stack[stack.length-1].tag:'<empty>');
      break;
    }
    stack.pop();
  } else if(!selfClosing){
    stack.push({tag,line});
  }
}
if(stack.length){
  console.log('Unclosed tags tail', stack.slice(-20));
} else {
  console.log('No unmatched tags');
}
