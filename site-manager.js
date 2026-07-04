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
*{box-sizing:border-box}body{margin:0;background:#07090d;color:#f2f5f8;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:980px;margin:0 auto;padding:28px}h1{font-size:34px;margin:0 0 8px}.sub{color:#9ca8b8;margin:0 0 22px}.row{display:grid;grid-template-columns:70px 180px 1fr 180px;gap:10px;align-items:center;margin-bottom:10px}.rank{color:#55d6be;font-weight:800;font-size:20px}.card{background:#121720;border:1px solid #263244;border-radius:8px;padding:18px}input{width:100%;border:0;border-radius:8px;padding:14px;font-size:16px}button{border:0;border-radius:8px;background:#55d6be;color:#03080c;font-weight:900;font-size:20px;padding:16px 22px;cursor:pointer}.actions{display:flex;gap:12px;align-items:center;margin-top:18px}.status{color:#9ca8b8}.ok{color:#55d6be}.err{color:#ff6f6f}@media(max-width:760px){.row{grid-template-columns:1fr}.rank{margin-top:12px}}
</style>
</head>
<body><main>
<h1>Nuguseo Mirror Sites</h1>
<p class="sub">1위부터 5위까지 이름과 주소를 붙여넣고 전송하면 Google TV 앱의 원격 JSON 목록이 갱신됩니다.</p>
<section class="card" id="form"></section>
<div class="actions"><button id="send">전송</button><button id="reload" type="button">다시 불러오기</button><span id="status" class="status"></span></div>
</main>
<script>
const form=document.getElementById('form'),statusEl=document.getElementById('status');
function row(site={},i){return '<div class="row"><div class="rank">'+(i+1)+'위</div><input placeholder="사이트명" value="'+esc(site.name||'')+'"><input placeholder="https://..." value="'+esc(site.url||'')+'"><input placeholder="메모" value="'+esc(site.note||'')+'"></div>'}
function esc(v){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function setStatus(text,cls='status'){statusEl.className=cls;statusEl.textContent=text}
async function load(){setStatus('불러오는 중...');const data=await fetch('/api/sites').then(r=>r.json());const sites=data.sites||[];while(sites.length<5)sites.push({});form.innerHTML=sites.slice(0,5).map(row).join('');setStatus('준비 완료 · '+(data.updatedAt||''),'ok')}
async function save(){const rows=[...form.querySelectorAll('.row')];const sites=rows.map((r,i)=>{const v=[...r.querySelectorAll('input')].map(x=>x.value);return{rank:i+1,name:v[0],url:v[1],note:v[2]}});setStatus('전송 중...');const res=await fetch('/api/sites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sites})});const data=await res.json();if(!res.ok)throw new Error(data.error||'전송 실패');setStatus(data.message+' · TV에서 목록 새로고침을 누르세요.','ok')}
document.getElementById('send').onclick=()=>save().catch(e=>setStatus(e.message,'err'));
document.getElementById('reload').onclick=()=>load().catch(e=>setStatus(e.message,'err'));
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
  console.log(`Nuguseo site manager: http://localhost:${port}`);
});
