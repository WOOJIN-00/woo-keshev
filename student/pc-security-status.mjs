// 이 PC의 네트워크 구성, 방화벽 설정, Windows 기록(System·Application)의 경고·오류 건수를 읽기만 해서 보여 주고,
// 앱의 SDP 연결 상태를 PC 조회와 따로 보여 준다. 학생이 새로 만든 도구이며 제공 기능이 아니다.
//
// 지키는 것
// - 읽기만 한다. 방화벽·보안 설정을 바꾸는 명령은 쓰지 않는다(허용 목록에 있는 읽기 명령만 실행하고 자체 검사한다).
// - 관리자 권한이 필요해 읽지 못하면 바꾸려 하지 않고 '확인 불가'와 이유를 보여 준다.
// - Windows 기록 건수는 침해나 공격 탐지 결과가 아니다. 화면에 항상 그렇게 적는다.
// - IP·MAC 주소, 무선 이름(SSID), 기록 메시지 본문은 읽어 표시하거나 저장하지 않는다. 어떤 값도 저장하지 않는다.
// - 공격이나 침투를 흉내 내는 시험, 외부로 접속하는 시험은 하지 않는다. 로컬 앱(127.0.0.1)의 진단 응답만 읽는다.
import http from 'node:http';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const REAL = '[실제 측정]';
const EXAMPLE = '[예시]';
const DEFAULT_HOURS = 24;
const MAX_EVENTS = 1000;
const POWERSHELL_TIMEOUT_MS = 20000;
const SDP_TIMEOUT_MS = 3000;
const DEFAULT_APP_PORT = 5189;

const SECRET_PATTERN = /(?:Bearer\s+\S+|sk-[A-Za-z0-9_-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
const safe = (value) => (typeof value === 'string' && !SECRET_PATTERN.test(value) ? value.slice(0, 200) : '[가림]');
const unavailable = (reason) => ({ status: 'unavailable', reason });

// ---------- 읽기 전용 PowerShell 명령 ----------

// 실행하는 명령은 아래 허용 목록의 읽기 명령뿐이다. 새 명령이 필요해도 여기를 고치지 않으면 실행되지 않는다.
const ALLOWED_CMDLETS = new Set(['Get-NetAdapter', 'Get-NetConnectionProfile', 'Get-NetFirewallProfile', 'Get-WinEvent', 'Get-Date', 'Select-Object', 'ConvertTo-Json']);

export function isReadOnlyScript(script) {
  if (typeof script !== 'string' || /netsh/i.test(script)) return false;
  const cmdlets = script.match(/\b[A-Za-z]+-[A-Za-z]+\b/g) ?? [];
  return cmdlets.every((name) => ALLOWED_CMDLETS.has(name));
}

export function buildScript(hours) {
  // 사용자가 준 값은 이 정수 하나뿐이다. 문자열을 명령에 끼워 넣지 않는다.
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) throw new RangeError('HOURS_OUT_OF_RANGE');
  return `$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$since=(Get-Date).AddHours(-${hours})
$r=[ordered]@{generatedAt=(Get-Date).ToUniversalTime().ToString('o');sinceIso=$since.ToUniversalTime().ToString('o')}
$r.elevated=([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
try{
$ad=@(Get-NetAdapter | Select-Object @{n='Name';e={"$($_.Name)"}},@{n='Status';e={"$($_.Status)"}},@{n='MediaType';e={"$($_.MediaType)"}},@{n='Virtual';e={[bool]$_.Virtual}},@{n='LinkSpeed';e={"$($_.LinkSpeed)"}})
$pr=@(Get-NetConnectionProfile | Select-Object @{n='NetworkCategory';e={"$($_.NetworkCategory)"}},@{n='IPv4Connectivity';e={"$($_.IPv4Connectivity)"}},@{n='IPv6Connectivity';e={"$($_.IPv6Connectivity)"}})
$r.network=@{ok=$true;adapters=$ad;profiles=$pr}
}catch{$r.network=@{ok=$false;error="$($_.FullyQualifiedErrorId)"}}
try{
$fw=@(Get-NetFirewallProfile | Select-Object @{n='Name';e={"$($_.Name)"}},@{n='Enabled';e={"$($_.Enabled)"}},@{n='In';e={"$($_.DefaultInboundAction)"}},@{n='Out';e={"$($_.DefaultOutboundAction)"}})
$r.firewall=@{ok=$true;profiles=$fw}
}catch{$r.firewall=@{ok=$false;error="$($_.FullyQualifiedErrorId)"}}
try{
$rows=@()
foreach($log in 'System','Application'){foreach($lv in 2,3){
$row=[ordered]@{log=$log;level=$lv;cnt=$null;error=$null}
try{$row.cnt=@(Get-WinEvent -FilterHashtable @{LogName=$log;Level=$lv;StartTime=$since} -MaxEvents ${MAX_EVENTS} -ErrorAction Stop).Count}
catch{if("$($_.FullyQualifiedErrorId)" -like 'NoMatchingEventsFound*'){$row.cnt=0}else{$row.error="$($_.FullyQualifiedErrorId)"}}
$rows+=[pscustomobject]$row}}
$r.events=@{ok=$true;entries=$rows}
}catch{$r.events=@{ok=$false;error="$($_.FullyQualifiedErrorId)"}}
$r | ConvertTo-Json -Depth 6 -Compress`;
}

const defaultRunPowerShell = (script, { timeoutMs = POWERSHELL_TIMEOUT_MS } = {}) => new Promise((resolve) => {
  if (!isReadOnlyScript(script)) { resolve({ ok: false, reason: '읽기 전용 검사를 통과하지 못한 명령이라 실행하지 않았습니다' }); return; }
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  execFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
    { windowsHide: true, timeout: timeoutMs, maxBuffer: 1024 * 1024, encoding: 'utf8' },
    (error, stdout) => {
      if (error) {
        const reason = error.code === 'ENOENT' ? 'powershell.exe를 찾을 수 없습니다'
          : error.killed ? `PowerShell이 ${timeoutMs / 1000}초 안에 끝나지 않았습니다`
            : `PowerShell 실행에 실패했습니다(${typeof error.code === 'string' || typeof error.code === 'number' ? error.code : 'UNKNOWN'})`;
        resolve({ ok: false, reason });
        return;
      }
      resolve({ ok: true, stdout });
    });
});

// 앱 서버의 읽기 전용 경로도 이 실행기만 거친다. 허용 목록 검사를 통과하지 못하면 PowerShell을 띄우지 않는다.
export { defaultRunPowerShell as runReadOnlyPowerShell };

// ---------- 앱의 SDP 연결 상태 (PC 조회와 별개) ----------

const defaultHttpGetJson = (port, pathname) => new Promise((resolve) => {
  // 로컬 앱(127.0.0.1)만 읽는다. 다른 주소로는 접속하지 않는다.
  const req = http.request({ host: '127.0.0.1', port, path: pathname, method: 'GET', timeout: SDP_TIMEOUT_MS, headers: { accept: 'application/json' } }, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => { body += chunk; if (body.length > 65536) { req.destroy(); } });
    res.on('end', () => {
      try { resolve({ ok: true, status: res.statusCode, json: JSON.parse(body) }); } catch { resolve({ ok: false, reason: '응답을 해석할 수 없습니다(JSON 아님)' }); }
    });
  });
  req.on('timeout', () => { req.destroy(); resolve({ ok: false, reason: `${SDP_TIMEOUT_MS / 1000}초 안에 응답이 없습니다` }); });
  req.on('error', (e) => resolve({ ok: false, reason: e && e.code === 'ECONNREFUSED' ? `앱 서버가 응답하지 않습니다(포트 ${port}에 연결할 수 없음)` : `앱 서버에 접속하지 못했습니다(${(e && e.code) || 'UNKNOWN'})` }));
  req.end();
});

export function interpretSdp(response) {
  if (!response || response.ok !== true) return unavailable(response && response.reason ? response.reason : '앱 서버 응답을 확인할 수 없습니다');
  const engine = response.json && response.json.ok === true && response.json.data && response.json.data.engine;
  if (response.status !== 200 || !engine || typeof engine.mode !== 'string' || typeof engine.code !== 'string') {
    return unavailable('앱의 진단 응답 형식이 예상과 다릅니다(DIAGNOSTICS_INVALID)');
  }
  if (engine.mode === 'disconnected') return { status: 'disconnected', code: safe(engine.code) };
  if (engine.mode === 'demo') return { status: 'demo', code: safe(engine.code) };
  if (engine.mode === 'connected') return { status: 'configured', code: safe(engine.code) };
  return unavailable(`알 수 없는 엔진 상태입니다(${safe(engine.mode)})`);
}

export async function collectSdp({ port = DEFAULT_APP_PORT, get = defaultHttpGetJson } = {}) {
  try { return interpretSdp(await get(port, '/api/diagnostics')); } catch { return unavailable('앱 상태를 읽는 중 오류가 났습니다'); }
}

// ---------- PC 조회 ----------

const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const ACCESS_HINT = /UnauthorizedAccess|AccessDenied|ACCESS_DENIED|Access is denied|SecurityException|PermissionDenied/i;

export function parsePc(stdout) {
  let raw;
  try { raw = JSON.parse(stdout); } catch { return null; }
  if (!raw || typeof raw !== 'object' || typeof raw.generatedAt !== 'string' || !Number.isFinite(Date.parse(raw.generatedAt))) return null;
  const section = (s, build) => (s && s.ok === true ? build(s) : unavailable(`읽지 못했습니다(${safe(s && s.error) || 'UNKNOWN'})`));
  return {
    measuredAt: raw.generatedAt,
    sinceIso: typeof raw.sinceIso === 'string' ? raw.sinceIso : null,
    elevated: raw.elevated === true ? true : raw.elevated === false ? false : null,
    network: section(raw.network, (s) => ({ status: 'ok', adapters: asArray(s.adapters), profiles: asArray(s.profiles) })),
    firewall: section(raw.firewall, (s) => ({ status: 'ok', profiles: asArray(s.profiles) })),
    events: section(raw.events, (s) => ({ status: 'ok', entries: asArray(s.entries) })),
  };
}

export async function collectPc({ hours = DEFAULT_HOURS, run = defaultRunPowerShell, timeoutMs = POWERSHELL_TIMEOUT_MS } = {}) {
  let result;
  try { result = await run(buildScript(hours), { timeoutMs }); } catch { result = { ok: false, reason: 'PowerShell을 실행하는 중 오류가 났습니다' }; }
  if (!result || result.ok !== true) {
    const why = result && result.reason ? result.reason : 'PowerShell 결과를 받지 못했습니다';
    return { measuredAt: null, sinceIso: null, elevated: null, network: unavailable(why), firewall: unavailable(why), events: unavailable(why) };
  }
  const parsed = parsePc(result.stdout);
  if (!parsed) {
    const why = 'PowerShell 결과를 해석할 수 없습니다(JSON 아님)';
    return { measuredAt: null, sinceIso: null, elevated: null, network: unavailable(why), firewall: unavailable(why), events: unavailable(why) };
  }
  return parsed;
}

// ---------- 표시 ----------

const fmtKst = (iso) => `${new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })} (한국 시각)`;

function adapterKind(mediaType) {
  if (mediaType === '802.3') return '유선(이더넷)';
  if (/802\.11/.test(mediaType)) return '무선';
  return `종류 확인 불가(MediaType=${safe(mediaType)})`;
}
const ADAPTER_STATUS = { Up: '연결됨', Disconnected: '끊김', Disabled: '사용 안 함', NotPresent: '장치 없음' };
const CATEGORY = { Public: '공용 네트워크', Private: '개인 네트워크', DomainAuthenticated: '도메인 인증됨' };
const CONNECTIVITY = { Internet: '인터넷 연결', LocalNetwork: '로컬 네트워크만', NoTraffic: '트래픽 없음', Disconnected: '연결 안 됨' };
const ENABLED = { True: '켜짐', False: '꺼짐', NotConfigured: '설정 안 됨(정책으로 지정되지 않음)' };
const ACTION = { Allow: '허용', Block: '차단', NotConfigured: '정책으로 지정되지 않음' };
const word = (table, value) => (Object.hasOwn(table, value) ? `${table[value]}(${value})` : `확인 불가(${safe(value)})`);

function networkLines(tag, network) {
  if (network.status !== 'ok') return [`${tag} 네트워크 구성: 확인 불가 — 이유: ${network.reason}`];
  const adapters = network.adapters;
  const up = (a) => a.Status === 'Up';
  const physUp = adapters.filter((a) => up(a) && a.Virtual !== true);
  const count = (re) => physUp.filter((a) => re.test(a.MediaType)).length;
  const wired = physUp.filter((a) => a.MediaType === '802.3').length;
  const wireless = count(/802\.11/);
  const other = physUp.length - wired - wireless;
  const virtUp = adapters.filter((a) => up(a) && a.Virtual === true).length;
  const lines = [
    `${tag} 네트워크 구성: 어댑터 ${adapters.length}개 읽음 — 물리 어댑터 연결됨: 유선 ${wired}개 · 무선 ${wireless}개 · 종류 확인 불가 ${other}개 / 가상 어댑터 연결됨: ${virtUp}개`,
  ];
  for (const a of adapters) {
    lines.push(`${tag}   · ${safe(a.Name)} — ${adapterKind(a.MediaType)} · ${a.Virtual === true ? '가상' : '물리'} · ${word(ADAPTER_STATUS, a.Status)} · 링크 속도 ${safe(a.LinkSpeed)}`);
  }
  if (network.profiles.length === 0) lines.push(`${tag} 연결 범주: 연결 프로필 없음(연결된 네트워크가 없을 수 있음)`);
  for (const p of network.profiles) {
    lines.push(`${tag} 연결 범주: ${word(CATEGORY, p.NetworkCategory)} · IPv4 ${word(CONNECTIVITY, p.IPv4Connectivity)} · IPv6 ${word(CONNECTIVITY, p.IPv6Connectivity)}`);
  }
  lines.push(`${tag} 참고: IP·MAC 주소와 무선 이름(SSID)은 읽거나 표시하지 않습니다. 연결성은 Windows가 판단한 값이며 이 도구가 외부로 접속해 시험하지 않았습니다.`);
  return lines;
}

function firewallLines(tag, firewall) {
  if (firewall.status !== 'ok') return [`${tag} 방화벽 설정: 확인 불가 — 이유: ${firewall.reason}`];
  if (firewall.profiles.length === 0) return [`${tag} 방화벽 설정: 읽은 프로필이 없습니다(확인 불가)`];
  const summary = firewall.profiles.map((p) => `${safe(p.Name)} ${word(ENABLED, p.Enabled).split('(')[0]}`).join(' · ');
  const lines = [`${tag} 방화벽 설정: ${summary} · 읽기만 함(바꾸지 않음)`];
  for (const p of firewall.profiles) {
    lines.push(`${tag}   · ${safe(p.Name)}: ${word(ENABLED, p.Enabled)} · 기본 인바운드 ${word(ACTION, p.In)} · 기본 아웃바운드 ${word(ACTION, p.Out)}`);
  }
  lines.push(`${tag} 참고: '정책으로 지정되지 않음'은 실제로 적용되는 기본 동작을 알려 주는 값이 아닙니다.`);
  return lines;
}

function countText(entry) {
  const name = entry.level === 2 ? '오류' : '경고';
  if (typeof entry.cnt === 'number') return entry.cnt >= MAX_EVENTS ? `${name} ${MAX_EVENTS}건 이상(조회 상한)` : `${name} ${entry.cnt}건`;
  const hint = ACCESS_HINT.test(String(entry.error)) ? ' — 관리자 권한이 필요한 항목일 수 있어 바꾸려 하지 않았습니다' : '';
  return `${name} 확인 불가(이유: ${safe(entry.error)}${hint})`;
}

function eventLines(tag, events, hours, sinceIso) {
  const notice = `${tag} 안내: 이 건수는 침해나 공격 탐지 결과가 아닙니다. 드라이버·서비스·앱의 일반적인 오류와 경고도 포함됩니다.`;
  if (events.status !== 'ok') return [`${tag} Windows 기록: 확인 불가 — 이유: ${events.reason}`, notice];
  const lines = [`${tag} Windows 기록(최근 ${hours}시간${sinceIso ? `, ${sinceIso} 이후` : ''}, 항목당 최대 ${MAX_EVENTS}건 조회):`];
  for (const log of ['System', 'Application']) {
    const entries = events.entries.filter((e) => e.log === log).sort((a, b) => a.level - b.level);
    lines.push(`${tag}   · ${log}: ${entries.length === 0 ? '확인 불가(읽은 항목 없음)' : entries.map(countText).join(' · ')}`);
  }
  lines.push(notice);
  return lines;
}

export function renderPc(pc, tag, hours) {
  const lines = [`${tag} ===== PC 조회 (이 PC의 Windows에서 읽은 값) =====`];
  lines.push(pc.measuredAt ? `${tag} 측정 시각: ${pc.measuredAt} (UTC) · ${fmtKst(pc.measuredAt)}` : `${tag} 측정 시각: 확인 불가(PC 조회를 하지 못함)`);
  if (pc.elevated === true) lines.push(`${tag} 실행 권한: 관리자 권한 — 일반 권한에서는 읽을 수 없는 항목도 읽혔을 수 있습니다. 일반 권한 창에서 실행하는 것을 권장합니다(읽기만 함).`);
  else if (pc.elevated === false) lines.push(`${tag} 실행 권한: 일반 권한(관리자 권한이 필요한 항목은 확인 불가로 표시)`);
  else lines.push(`${tag} 실행 권한: 확인 불가`);
  lines.push(...networkLines(tag, pc.network), ...firewallLines(tag, pc.firewall), ...eventLines(tag, pc.events, hours, pc.sinceIso));
  return lines;
}

export function renderSdp(sdp, tag) {
  const lines = [`${tag} ===== 앱의 SDP 연결 상태 (PC 조회와 별개) =====`];
  if (sdp.status === 'disconnected') lines.push(`${tag} SDP 미연결 — 앱의 진단 응답이 연결 없음(${sdp.code})을 알려 줍니다.`);
  else if (sdp.status === 'demo') lines.push(`${tag} 예제 모드 — 실제 SDP가 아닙니다(${sdp.code}).`);
  else if (sdp.status === 'configured') lines.push(`${tag} SDP 연결 설정됨(${sdp.code}) — 연결 설정이 켜졌다는 뜻이며 실제 SDP 응답이 성공했다는 확인이 아닙니다.`);
  else lines.push(`${tag} SDP 연결 상태: 확인 불가 — 이유: ${sdp.reason}. 확인 불가는 '미연결'이 아닙니다.`);
  lines.push(`${tag} 위 두 구역은 서로 다른 것을 확인한 결과이며 합치지 않습니다. PC 조회가 성공했어도 SDP가 연결된 것은 아니고, SDP가 연결되지 않았어도 PC 조회 결과는 그대로입니다.`);
  return lines;
}

// ---------- 설명용 예시 값 (실제로 잰 값이 아님) ----------

export function examplePc() {
  return {
    measuredAt: '2000-01-01T00:00:00.000Z', sinceIso: '1999-12-31T00:00:00.000Z', elevated: false,
    network: { status: 'ok', adapters: [{ Name: '예시 이더넷', Status: 'Up', MediaType: '802.3', Virtual: false, LinkSpeed: '1 Gbps' }], profiles: [{ NetworkCategory: 'Private', IPv4Connectivity: 'Internet', IPv6Connectivity: 'NoTraffic' }] },
    firewall: { status: 'ok', profiles: ['Domain', 'Private', 'Public'].map((Name) => ({ Name, Enabled: 'True', In: 'Block', Out: 'Allow' })) },
    events: { status: 'ok', entries: [
      { log: 'System', level: 2, cnt: 0, error: null }, { log: 'System', level: 3, cnt: 3, error: null },
      { log: 'Application', level: 2, cnt: 0, error: null }, { log: 'Application', level: 3, cnt: null, error: '예시: UnauthorizedAccess' },
    ] },
  };
}

// ---------- 모의 점검 (가짜 의존성으로 함수만 검사. 이 PC의 실제 값이 아님) ----------

async function selfTest() {
  const results = [];
  const check = (name, pass) => results.push({ name, pass: !!pass });
  const throws = (fn) => { try { fn(); return false; } catch { return true; } };

  const script = buildScript(24);
  check('명령: 실제로 실행할 명령이 읽기 전용 검사를 통과', isReadOnlyScript(script));
  check('명령: 방화벽을 바꾸는 명령(Set-NetFirewallProfile)은 거절', !isReadOnlyScript(script + '\nSet-NetFirewallProfile -Enabled False'));
  check('명령: netsh 명령은 거절', !isReadOnlyScript('netsh advfirewall set allprofiles state off'));
  check('명령: 읽기처럼 보이는 다른 명령(Invoke-Expression)도 거절', !isReadOnlyScript(script + '\nInvoke-Expression "x"'));
  check('명령: IP·MAC·SSID를 읽는 명령이 없음', !/IPAddress|MacAddress|Get-NetIPAddress|SSID|Message/.test(script));
  check('명령: 시간 범위는 1~168 정수만(1.5, 0, 169, 문자열 거절)', throws(() => buildScript(1.5)) && throws(() => buildScript(0)) && throws(() => buildScript(169)) && throws(() => buildScript('24; Remove-Item x')));
  const rejectedA = await defaultRunPowerShell('Set-NetFirewallProfile -Enabled False');
  const rejectedB = await defaultRunPowerShell('Get-NetAdapter; Remove-Item C:\\x');
  check('실행기: 변경 명령은 PowerShell을 띄우기 전에 거절(공개된 실행기에서도 동일)', rejectedA.ok === false && rejectedB.ok === false && rejectedA.reason.includes('읽기 전용 검사'));
  let seenOptions = null;
  await collectPc({ hours: 24, timeoutMs: 8000, run: async (script, options) => { seenOptions = options; return { ok: false, reason: 'x' }; } });
  check('옵션: 대기 시간(timeoutMs)이 실행기에 그대로 전달됨', seenOptions && seenOptions.timeoutMs === 8000);

  const adapters = [
    { Name: '물리 유선', Status: 'Up', MediaType: '802.3', Virtual: false, LinkSpeed: '1 Gbps', MacAddress: '00-11-22-33-44-55', IPv4Address: '192.0.2.10' },
    { Name: '가상 연결', Status: 'Up', MediaType: '802.3', Virtual: true, LinkSpeed: '1 Gbps' },
    { Name: '무선', Status: 'Disconnected', MediaType: 'Native 802.11', Virtual: false, LinkSpeed: '0 bps' },
    { Name: '이상한 장치', Status: 'Up', MediaType: 'Foo', Virtual: false, LinkSpeed: '10 Mbps' },
  ];
  const pcOk = { measuredAt: '2026-01-01T00:00:00.000Z', sinceIso: '2025-12-31T00:00:00.000Z', elevated: false,
    network: { status: 'ok', adapters, profiles: [{ NetworkCategory: 'Public', IPv4Connectivity: 'Internet', IPv6Connectivity: 'NoTraffic' }] },
    firewall: { status: 'ok', profiles: [{ Name: 'Domain', Enabled: 'True', In: 'NotConfigured', Out: 'NotConfigured' }, { Name: 'Public', Enabled: 'False', In: 'Block', Out: 'Allow' }] },
    events: { status: 'ok', entries: [{ log: 'System', level: 2, cnt: 1000, error: null }, { log: 'System', level: 3, cnt: 0, error: null }, { log: 'Application', level: 2, cnt: null, error: 'System.UnauthorizedAccessException,X' }, { log: 'Application', level: 3, cnt: null, error: 'Other.Failure' }] } };
  const text = renderPc(pcOk, REAL, 24).join('\n');
  check('네트워크: 물리 유선 1·무선 0·종류 미상 1, 가상 연결됨 1로 나눠 요약', text.includes('유선 1개 · 무선 0개 · 종류 확인 불가 1개 / 가상 어댑터 연결됨: 1개'));
  check('네트워크: 알 수 없는 종류는 유선·무선으로 단정하지 않음', text.includes('종류 확인 불가(MediaType=Foo)'));
  check('네트워크: 주소(IP·MAC)가 출력에 없음', !text.includes('00-11-22') && !text.includes('192.0.2'));
  check('방화벽: NotConfigured는 정책으로 지정되지 않음으로 설명하고 꺼짐도 그대로 표시', text.includes('정책으로 지정되지 않음') && text.includes('Public 꺼짐') && text.includes('읽기만 함'));
  check('기록: 1000건은 이상으로, 권한 오류는 힌트와 함께 확인 불가로, 다른 오류는 힌트 없이', text.includes('오류 1000건 이상(조회 상한)') && text.includes('관리자 권한이 필요한 항목일 수 있어') && /Other\.Failure\)/.test(text));
  check('기록: 침해·공격 탐지 결과가 아니라는 안내가 항상 있음', text.includes('침해나 공격 탐지 결과가 아닙니다'));
  check('표시: PC 조회 구역에 SDP 문구가 섞이지 않음', !renderPc(pcOk, REAL, 24).join('\n').includes('SDP'));

  const noPs = await collectPc({ hours: 24, run: async () => ({ ok: false, reason: 'powershell.exe를 찾을 수 없습니다' }) });
  const noPsText = renderPc(noPs, REAL, 24).join('\n');
  check('실패: PowerShell을 못 쓰면 세 영역 모두 확인 불가와 이유, 안내 문구 유지', noPs.network.status === 'unavailable' && noPs.firewall.status === 'unavailable' && noPs.events.status === 'unavailable' && noPsText.includes('powershell.exe를 찾을 수 없습니다') && noPsText.includes('침해나 공격 탐지 결과가 아닙니다'));
  check('실패: 해석할 수 없는 결과도 확인 불가', (await collectPc({ hours: 24, run: async () => ({ ok: true, stdout: '깨진 출력' }) })).network.status === 'unavailable');
  check('실패: run이 예외를 던져도 확인 불가', (await collectPc({ hours: 24, run: async () => { throw new Error('boom'); } })).events.status === 'unavailable');
  const partial = parsePc(JSON.stringify({ generatedAt: '2026-01-01T00:00:00.000Z', sinceIso: '2025-12-31T00:00:00.000Z', elevated: true, network: { ok: false, error: 'AccessDenied,X' }, firewall: { ok: true, profiles: { Name: 'Domain', Enabled: 'True', In: 'Block', Out: 'Allow' } }, events: { ok: true, entries: [] } }));
  check('부분 실패: 네트워크만 실패해도 방화벽(단일 객체)은 읽히고 관리자 권한 경고가 나옴', partial.network.status === 'unavailable' && partial.firewall.status === 'ok' && partial.firewall.profiles.length === 1 && renderPc(partial, REAL, 24).join('\n').includes('관리자 권한 —'));

  const sdpOf = (status, json) => interpretSdp({ ok: true, status, json });
  const diag = (mode, code) => ({ ok: true, data: { engine: { mode, code } } });
  check('SDP: disconnected는 SDP 미연결', sdpOf(200, diag('disconnected', 'ENGINE_NOT_CONNECTED')).status === 'disconnected' && renderSdp(sdpOf(200, diag('disconnected', 'ENGINE_NOT_CONNECTED')), REAL).join('\n').includes('SDP 미연결'));
  check('SDP: demo는 예제 모드(실제 SDP 아님)', renderSdp(sdpOf(200, diag('demo', 'DEMO_ONLY')), REAL).join('\n').includes('실제 SDP가 아닙니다'));
  check('SDP: connected는 설정됨일 뿐 성공 확인이 아님', renderSdp(sdpOf(200, diag('connected', 'ADAPTER_CONFIGURED')), REAL).join('\n').includes('실제 SDP 응답이 성공했다는 확인이 아닙니다'));
  const refused = await collectSdp({ port: 5999, get: async () => ({ ok: false, reason: '앱 서버가 응답하지 않습니다(포트 5999에 연결할 수 없음)' }) });
  check('SDP: 앱이 꺼져 있으면 확인 불가이며 미연결로 쓰지 않음', refused.status === 'unavailable' && !renderSdp(refused, REAL).join('\n').includes('SDP 미연결 —'));
  check('SDP: 형식이 다르거나 200이 아니면 확인 불가', sdpOf(500, diag('disconnected', 'X')).status === 'unavailable' && sdpOf(200, { ok: true, data: {} }).status === 'unavailable');
  check('SDP: 알 수 없는 모드는 확인 불가', sdpOf(200, diag('weird', 'X')).status === 'unavailable');
  check('독립: PC 조회가 모두 실패해도 SDP 구역은 따로 판정됨', noPs.network.status === 'unavailable' && sdpOf(200, diag('disconnected', 'ENGINE_NOT_CONNECTED')).status === 'disconnected');

  const ex = renderPc(examplePc(), EXAMPLE, 24).concat(renderSdp({ status: 'disconnected', code: 'ENGINE_NOT_CONNECTED' }, EXAMPLE));
  check('예시: 모든 줄이 [예시]로 시작', ex.every((l) => l.startsWith(EXAMPLE)));

  console.log('[모의 점검] 가짜 값으로 함수만 검사한 결과이며 이 PC의 실제 조회 결과가 아닙니다.');
  for (const r of results) console.log(`[모의 점검] ${r.pass ? '통과' : '실패'} | ${r.name}`);
  const failed = results.filter((r) => !r.pass).length;
  console.log(`[모의 점검] 합계: 통과 ${results.length - failed}, 실패 ${failed}`);
  return failed === 0 ? 0 : 1;
}

// ---------- 명령줄 ----------

const USAGE = `사용법: node student/pc-security-status.mjs [명령] [옵션]
  (명령 없음) 또는 --measure   네트워크·방화벽·Windows 기록(System·Application) 건수를 읽고, 앱의 SDP 연결 상태를 따로 보여 줍니다.
  --example                    설명용 예시 값을 보여 줍니다. 실제로 잰 값이 아닙니다.
  --self-test                  가짜 값으로 함수를 검사합니다(이 PC의 실제 값이 아님).
옵션:
  --hours <1~168>              Windows 기록을 볼 시간 범위(기본 ${DEFAULT_HOURS}시간)
  --app-port <1024~65535>      앱 서버 포트(기본 ${DEFAULT_APP_PORT}). SDP 연결 상태를 읽는 로컬 앱 주소입니다.
읽기만 하며 방화벽·보안 설정을 바꾸지 않고, 어떤 값도 저장하지 않습니다.`;

function parseArgs(argv) {
  const out = { command: 'measure', hours: DEFAULT_HOURS, port: DEFAULT_APP_PORT };
  const commands = { '--measure': 'measure', '--example': 'example', '--self-test': 'self-test', '--help': 'help', '-h': 'help' };
  const intArg = (value, min, max) => (/^\d{1,5}$/.test(value ?? '') && Number(value) >= min && Number(value) <= max ? Number(value) : null);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (Object.hasOwn(commands, arg)) out.command = commands[arg];
    else if (arg === '--hours') { const v = intArg(argv[++i], 1, 168); if (v === null) return null; out.hours = v; }
    else if (arg === '--app-port') { const v = intArg(argv[++i], 1024, 65535); if (v === null) return null; out.port = v; }
    else return null;
  }
  return out;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args) { console.error(USAGE); return 2; }
  if (args.command === 'help') { console.log(USAGE); return 0; }
  if (args.command === 'self-test') return selfTest();
  const print = (lines) => { for (const line of lines) console.log(line); };
  if (args.command === 'example') {
    console.log(`${EXAMPLE} 아래 값은 설명용 예시이며 이 PC에서 실제로 잰 값이 아닙니다.`);
    print(renderPc(examplePc(), EXAMPLE, DEFAULT_HOURS));
    print(renderSdp({ status: 'disconnected', code: 'ENGINE_NOT_CONNECTED' }, EXAMPLE));
    return 0;
  }
  const [pc, sdp] = await Promise.all([collectPc({ hours: args.hours }), collectSdp({ port: args.port })]);
  print(renderPc(pc, REAL, args.hours));
  print(renderSdp(sdp, REAL));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then((code) => { process.exitCode = code; });
}
