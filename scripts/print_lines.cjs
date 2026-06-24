const fs = require('fs');
const lines = fs.readFileSync('src/components/trader/TraderChat.tsx','utf8').split(/\r?\n/);
for(let i=990;i<=1005;i++){
  if(i-1 < lines.length) console.log((i)+": "+JSON.stringify(lines[i-1]));
}
