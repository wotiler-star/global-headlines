const { chromium } = require("C:/Users/Administrator/node_modules/playwright");
(async()=>{
 const b=await chromium.launch({args:["--no-sandbox"]});const p=await b.newPage();
 for(const u of ["/zh/article/rss-orig-nope-2026-11n","/zh/article/rss-orig-ghost-2026-11m"]){
   const r=await p.goto("https://start"+"eday.com"+u,{waitUntil:"domcontentloaded",timeout:40000}).catch(()=>null);
   console.log(u,"->",r?r.status():"ERR");
 }
 await b.close();
})();
