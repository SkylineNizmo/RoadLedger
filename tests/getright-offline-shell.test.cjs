'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('offline shell includes every local external script in index.html',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 const scripts=[...html.matchAll(/<script\s+src="([^"]+)"\s*>/g)].map(x=>x[1]);
 const shell=sw.match(/const FILES=\[([^;]+)\];/s);
 assert.ok(shell,'static shell manifest exists');
 const assets=[...shell[1].matchAll(/'\.\/([^']+)'/g)].map(x=>x[1]);
 for(const script of scripts){assert.ok(assets.includes(script),'offline shell missing '+script);assert.ok(fs.existsSync(path.join(root,script)),'script missing from repository '+script)}
});
test('voice assistant remains disconnected from the production page',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.doesNotMatch(html,/<script[^>]+src="getright-voice-foundation\.js"/);
});
