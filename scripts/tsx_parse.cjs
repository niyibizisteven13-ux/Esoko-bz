const fs = require('fs');
const ts = require('typescript');
const text = fs.readFileSync('src/components/trader/TraderChat.tsx', 'utf8');
const sf = ts.createSourceFile('TraderChat.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
console.log('parseDiagnostics', sf.parseDiagnostics.length);
sf.parseDiagnostics.forEach((d) => {
  const { line, character } = sf.getLineAndCharacterOfPosition(d.start || 0);
  const msg = typeof d.messageText === 'string' ? d.messageText : d.messageText.messageText;
  console.log(d.code, msg, 'line', line + 1, 'char', character + 1);
});
