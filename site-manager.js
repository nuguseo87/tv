const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const root = __dirname;
const jsonPath = path.join(root, "mirror-sites.json");
const port = 8788;

function readSites() {
  try {
    return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch {
    return { updatedAt: new Date().toISOString(), sites: [] };
  }
}

function normalize(input) {
  const sites = Array.isArray(input.sites) ? input.sites.slice(0, 5) : [];
  return {
    updatedAt: new Date().toISOString(),
    sites: sites.map((site, index) => ({
      rank: index + 1,
      name: String(site.name || "").trim() || `사이트 ${index + 1}`,
      url: String(site.url || "").trim(),
      note: String(site.note || "").trim()
    })).filter(site => /^https?:\/\//i.test(site.url))
  };
}

function runGit(args) {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd: root }, (error, stdout, stderr) => {
      if (error) reject(new Error((stderr || stdout || error.message).trim()));
      else resolve((stdout || stderr || "").trim());
    });
  });
}

async function saveAndPush(payload) {
  const data = normalize(payload);
  if (data.sites.length === 0) throw new Error("http:// 또는 https:// 주소가 최소 1개 필요합니다.");
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + "\n");
  await runGit(["add", "mirror-sites.json"]);
  const status = await runGit(["status", "--short", "mirror-sites.json"]);
  if (!status) return { ok: true, message: "변경사항 없음", data };
  await runGit(["commit", "-m", `Update mirror sites ${data.updatedAt.slice(0, 10)}`]);
  await runGit(["push"]);
  return { ok: true, message: "전송 완료", data };
}

function page() {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nuguseo Site Manager</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#07090d;color:#f2f5f8;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1120px;margin:0 auto;padding:28px}h1{font-size:34px;margin:0 0 8px}.sub{color:#9ca8b8;margin:0 0 22px;line-height:1.5}.grid{display:grid;grid-template-columns:1fr 1.35fr;gap:16px}.card{background:#121720;border:1px solid #263244;border-radius:8px;padding:18px}.card h2{font-size:18px;margin:0 0 12px;color:#55d6be}.row{display:grid;grid-template-columns:56px 170px 1fr 150px;gap:10px;align-items:center;margin-bottom:10px}.rank{color:#55d6be;font-weight:900;font-size:18px}input,textarea{width:100%;border:1px solid #263244;border-radius:8px;padding:13px;font-size:15px;background:#f8fafc;color:#0b1118}textarea{min-height:220px;resize:vertical;line-height:1.5}button{border:0;border-radius:8px;background:#55d6be;color:#03080c;font-weight:900;font-size:17px;padding:14px 18px;cursor:pointer}button.secondary{background:#263244;color:#f2f5f8}button.warn{background:#ffc75f}.actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px}.status{color:#9ca8b8;line-height:1.45}.ok{color:#55d6be}.err{color:#ff6f6f}.tips{margin:0;padding-left:18px;color:#9ca8b8;line-height:1.7}.links{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.links a{color:#55d6be;text-decoration:none;border:1px solid #263244;border-radius:8px;padding:10px 12px}.pill{display:inline-block;color:#9ca8b8;border:1px solid #263244;border-radius:999px;padding:7px 10px;margin:0 6px 6px 0;font-size:13px}.invalid input{border-color:#ff6f6f;background:#fff3f3}@media(max-width:900px){.grid{grid-template-columns:1fr}.row{grid-template-columns:1fr}.rank{margin-top:12px}}
</style>
</head>
<body><main>
<h1>Nuguseo Mirror Sites</h1>
<p class="sub">가장 편한 방식은 왼쪽 큰 칸에 5줄을 붙여넣고 <b>자동 채우기</b>를 누른 뒤 <b>전송</b>하는 것입니다. 전송 후 TV 앱에서는 <b>목록 새로고침</b>만 누르면 됩니다.</p>
<div class="grid">
<section class="card">
<h2>빠른 붙여넣기</h2>
<textarea id="bulk" placeholder="예시:
1. 사이트명 https://example.com
2. 다른사이트 - https://example.org
3. 이름, https://example.net"></textarea>
<div class="actions">
<button id="fill" type="button">자동 채우기</button>
<button id="paste" class="secondary" type="button">클립보드 붙여넣기</button>
<button id="clear" class="secondary" type="button">비우기</button>
</div>
<ul class="tips">
<li>한 줄에 이름과 주소가 있으면 됩니다.</li>
<li><span class="pill">사이트명 https://주소</span><span class="pill">1. 사이트명 - https://주소</span> 둘 다 됩니다.</li>
<li>주소만 붙여넣으면 이름은 자동으로 사이트 1, 사이트 2처럼 채웁니다.</li>
</ul>
<div class="links">
<a href="https://nuguseo87.github.io/tv/mirror-sites.json" target="_blank">공개 JSON 보기</a>
<a href="https://nuguseo87.github.io/tv/a.apk" target="_blank">APK 링크</a>
</div>
</section>
<section class="card">
<h2>현재 1~5위</h2>
<div id="form"></div>
<div class="actions">
<button id="send">전송</button>
<button id="reload" class="secondary" type="button">다시 불러오기</button>
<button id="copy" class="secondary" type="button">목록 복사</button>
<span id="status" class="status"></span>
</div>
</section>
</div>
</main>
<script>
const form=document.getElementById('form'),statusEl=document.getElementById('status');
const bulk=document.getElementById('bulk');
function row(site={},i){return '<div class="row"><div class="rank">'+(i+1)+'위</div><input data-k="name" placeholder="사이트명" value="'+esc(site.name||'')+'"><input data-k="url" placeholder="https://..." value="'+esc(site.url||'')+'"><input data-k="note" placeholder="메모" value="'+esc(site.note||'')+'"></div>'}
function esc(v){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function setStatus(text,cls='status'){statusEl.className=cls;statusEl.textContent=text}
function getRows(){return [...form.querySelectorAll('.row')]}
function getSites(){return getRows().map((r,i)=>({rank:i+1,name:r.querySelector('[data-k=name]').value,url:r.querySelector('[data-k=url]').value,note:r.querySelector('[data-k=note]').value}))}
function setSites(sites){while(sites.length<5)sites.push({});form.innerHTML=sites.slice(0,5).map(row).join('');form.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>{validate();localStorage.setItem('nuguseo-sites-draft',JSON.stringify(getSites()))}));validate()}
function validate(){getRows().forEach(r=>{const url=r.querySelector('[data-k=url]').value.trim();r.classList.toggle('invalid',!!url&&!/^https?:\\/\\//i.test(url))})}
function parseBulk(text){return text.split(/\\n+/).map(x=>x.trim()).filter(Boolean).slice(0,5).map((line,i)=>{const url=(line.match(/https?:\\/\\/\\S+/i)||[''])[0].replace(/[),.]+$/,'');let name=line.replace(/^\\s*\\d+\\s*[.)-]?\\s*/,'').replace(url,'').replace(/[-,|]+\\s*$/,'').trim();return{rank:i+1,name:name||'사이트 '+(i+1),url,note:''}})}
async function load(){setStatus('불러오는 중...');const data=await fetch('/api/sites').then(r=>r.json());let sites=data.sites||[];const draft=localStorage.getItem('nuguseo-sites-draft');if(draft&&!sites.some(s=>s.name&&s.name.startsWith('목록 준비 중'))){localStorage.removeItem('nuguseo-sites-draft')}setSites(sites);setStatus('준비 완료 · '+(data.updatedAt||''),'ok')}
async function save(){validate();const sites=getSites();if(!sites.some(s=>/^https?:\\/\\//i.test(s.url.trim())))throw new Error('http:// 또는 https:// 주소가 최소 1개 필요합니다.');setStatus('전송 중...');const res=await fetch('/api/sites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sites})});const data=await res.json();if(!res.ok)throw new Error(data.error||'전송 실패');localStorage.removeItem('nuguseo-sites-draft');setSites(data.data.sites||sites);setStatus(data.message+' · TV에서 목록 새로고침을 누르세요.','ok')}
function fillFromBulk(){const parsed=parseBulk(bulk.value);if(!parsed.length)throw new Error('붙여넣은 줄에서 주소를 찾지 못했습니다.');setSites(parsed);setStatus('자동 채우기 완료 · 전송을 누르면 반영됩니다.','ok')}
function copyList(){const text=getSites().map(s=>s.name+' '+s.url).join('\\n');navigator.clipboard.writeText(text).then(()=>setStatus('목록을 클립보드에 복사했습니다.','ok')).catch(()=>setStatus(text,'status'))}
document.getElementById('fill').onclick=()=>{try{fillFromBulk()}catch(e){setStatus(e.message,'err')}};
document.getElementById('paste').onclick=async()=>{try{bulk.value=await navigator.clipboard.readText();fillFromBulk()}catch(e){setStatus('브라우저가 클립보드 접근을 막았습니다. 직접 붙여넣어 주세요.','err')}};
document.getElementById('clear').onclick=()=>{bulk.value='';setSites([{}, {}, {}, {}, {}]);setStatus('입력칸을 비웠습니다.','status')};
document.getElementById('copy').onclick=copyList;
document.getElementById('send').onclick=()=>save().catch(e=>setStatus(e.message,'err'));
document.getElementById('reload').onclick=()=>load().catch(e=>setStatus(e.message,'err'));
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter')save().catch(err=>setStatus(err.message,'err'))});
load().catch(e=>setStatus(e.message,'err'));
</script></body></html>`;
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page());
    return;
  }
  if (req.method === "GET" && req.url === "/api/sites") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(readSites()));
    return;
  }
  if (req.method === "POST" && req.url === "/api/sites") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const result = await saveAndPush(JSON.parse(body || "{}"));
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: error.message }));
      }
    });
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

server.listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log(`Nuguseo site manager: ${url}`);
  execFile("open", [url], () => {});
});
