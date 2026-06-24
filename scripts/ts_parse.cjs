const fs = require('fs');
const ts = require('typescript');
const path = 'src/components/trader/TraderChat.tsx';
const text = fs.readFileSync(path, 'utf8');
const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const diags = sf.parseDiagnostics;
console.log('parseDiagnostics', diags.length);
diags.forEach(d=>{
  const { line, character } = sf.getLineAndCharacterOfPosition(d.start || 0);
  const msg = typeof d.messageText === 'string' ? d.messageText : d.messageText.messageText;
  console.log('---');
  console.log(d.code, msg, 'line', line+1, 'char', character+1);
  const lines = text.split(/\r?\n/);
  const start = Math.max(0, line-10);
  const end = Math.min(lines.length-1, line+10);
  for(let i=start;i<=end;i++){
    const prefix = (i+1===line+1)? '>>' : '  ';
    console.log(prefix, (i+1)+': '+lines[i]);
  }
});
