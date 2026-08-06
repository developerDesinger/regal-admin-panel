const {chromium}=require('playwright-core');
const fs=require('fs'), path=require('path');
const DL='C:\Users\ALISHB~1\AppData\Local\Temp\claude\c--Users-Alishba-Ch-Documents-flutterProjects-regal-admin-panel\904429d2-2e9c-4165-b32c-363e283206cb\scratchpad\dl';
fs.mkdirSync(DL,{recursive:true});
(async()=>{
  const browser=await chromium.launch({channel:'msedge'});
  const ctx=await browser.newContext({viewport:{width:1440,height:960},acceptDownloads:true});
  const page=await ctx.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message.slice(0,140)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,140));});
  await page.goto('http://localhost:4173/',{waitUntil:'networkidle'});
  if(await page.locator('#email').count()){ await page.fill('#email','ana@regal.app'); await page.fill('#password','pw123456'); await page.click('button[type=submit]'); await page.waitForTimeout(1800);}

  const grab=async(label,fn)=>{
    const [dl]=await Promise.all([page.waitForEvent('download',{timeout:15000}), fn()]);
    const name=dl.suggestedFilename();
    const p=path.join(DL,name); await dl.saveAs(p);
    const txt=fs.readFileSync(p,'utf8');
    const lines=txt.trim().split(/\r?\n/);
    console.log(`${label}: ${name} | ${lines.length-1} data rows | ${Math.round(txt.length/1024)}KB`);
    return {txt,lines};
  };

  // Events page export
  await page.goto('http://localhost:4173/events',{waitUntil:'networkidle'}); await page.waitForTimeout(900);
  const ev=await grab('events CSV',async()=>{
    await page.locator('button:has-text("Export")').first().click(); await page.waitForTimeout(400);
    await page.locator('[role=menuitem]:has-text("Download CSV")').click();
  });
  console.log('  header:', ev.lines[0].slice(0,90));
  console.log('  money is decimal string:', /,"?\d+\.\d{2}"?,/.test(ev.lines[1]) || ev.lines[1].includes('.00'));
  console.log('  has Currency column:', ev.lines[0].includes('Currency'));

  // Contributions JSON
  await page.goto('http://localhost:4173/contributions',{waitUntil:'networkidle'}); await page.waitForTimeout(900);
  const cj=await grab('contributions JSON',async()=>{
    await page.locator('button:has-text("Export")').first().click(); await page.waitForTimeout(400);
    await page.locator('[role=menuitem]:has-text("Download JSON")').click();
  });
  const parsed=JSON.parse(cj.txt);
  console.log('  valid JSON array:', Array.isArray(parsed), '| first amount:', parsed[0]?.amount, '| currency:', parsed[0]?.currency);

  // Exports screen: generate then download
  await page.goto('http://localhost:4173/exports',{waitUntil:'networkidle'}); await page.waitForTimeout(900);
  await page.locator('button:has-text("Generate export")').click();
  await page.waitForTimeout(3000);
  const readyCount=await page.locator('button:has-text("Download")').count();
  console.log('ready jobs with Download button:', readyCount);
  await grab('exports-screen CSV',async()=>{ await page.locator('button:has-text("Download")').first().click(); });

  // Chart CSV from dashboard
  await page.goto('http://localhost:4173/',{waitUntil:'networkidle'}); await page.waitForTimeout(1500);
  await grab('chart CSV',async()=>{
    await page.locator('button[aria-label*="chart options"]').first().click(); await page.waitForTimeout(400);
    await page.locator('[role=menuitem]:has-text("Download CSV")').click();
  });
  // Chart PNG
  await page.waitForTimeout(600);
  await grab('chart PNG',async()=>{
    await page.locator('button[aria-label*="chart options"]').first().click(); await page.waitForTimeout(400);
    await page.locator('[role=menuitem]:has-text("Download PNG")').click();
  });

  console.log('errors:', errors.length, [...new Set(errors)].slice(0,4).join(' | '));
  await browser.close();
})();
