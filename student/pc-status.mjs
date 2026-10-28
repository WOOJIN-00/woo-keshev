// 내 PC 상태(CPU·메모리·디스크) 측정과 직전 측정 대비 추이 비교.
// 제공 기능이 아니라 학생이 새로 만든 도구다. Node 내장 기능만 쓰고, 관리자 권한·외부 프로그램·네트워크를 쓰지 않는다.
// 실제로 잰 값은 [실제 측정], 설명용 값은 [예시]로 줄마다 따로 표시한다. 읽지 못한 값은 '확인 불가'와 이유를 보여 준다.
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const SCHEMA_VERSION = 1;
const GIB = 2 ** 30;
const CPU_WINDOW_MS = 1000;
const MAX_READ_BYTES = 4 * 1024 * 1024;
const DATA_FILE = 'samples.jsonl';

const ok = (fields) => ({ status: 'ok', ...fields });
const unavailable = (reason) => ({ status: 'unavailable', reason });
// 오류 메시지에는 경로가 들어갈 수 있으므로 코드나 이름만 쓴다.
const errName = (e) => (e && typeof e.code === 'string' ? e.code : (e && e.name) || 'UNKNOWN');
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

const realDeps = {
  cpus: () => os.cpus(),
  totalmem: () => os.totalmem(),
  freemem: () => os.freemem(),
  statfs: (p) => fs.statfsSync(p),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => new Date(),
};

// ---------- 측정 ----------

export async function measureCpu(deps) {
  try {
    const a = deps.cpus();
    await deps.sleep(CPU_WINDOW_MS);
    const b = deps.cpus();
    if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0) return unavailable('os.cpus()가 코어 정보를 주지 않았습니다');
    if (a.length !== b.length) return unavailable('측정 구간 중 논리 코어 수가 달라졌습니다');
    let total = 0;
    let idle = 0;
    for (let i = 0; i < a.length; i++) {
      const before = a[i] && a[i].times;
      const after = b[i] && b[i].times;
      if (!before || !after) return unavailable('코어별 시간 정보가 없습니다');
      for (const key of Object.keys(after)) {
        const d = after[key] - before[key];
        if (!isNum(d) || d < 0) return unavailable('CPU 시간 값이 올바르지 않습니다');
        total += d;
        if (key === 'idle') idle += d;
      }
    }
    if (total <= 0) return unavailable('측정 구간에서 CPU 시간이 늘지 않아 사용률을 계산할 수 없습니다');
    if (idle > total) return unavailable('유휴 시간이 전체 시간보다 커서 사용률을 계산할 수 없습니다');
    return ok({ percent: (1 - idle / total) * 100, windowMs: CPU_WINDOW_MS, logicalCores: a.length });
  } catch (e) {
    return unavailable(`CPU 값을 읽지 못했습니다(${errName(e)})`);
  }
}

export function measureMemory(deps) {
  try {
    const total = deps.totalmem();
    const free = deps.freemem();
    if (!isNum(total) || !isNum(free) || total <= 0 || free < 0 || free > total) return unavailable('운영체제가 준 메모리 값이 올바르지 않습니다');
    return ok({ totalBytes: total, freeBytes: free });
  } catch (e) {
    return unavailable(`메모리 값을 읽지 못했습니다(${errName(e)})`);
  }
}

export function measureDisk(deps, target) {
  try {
    if (typeof deps.statfs !== 'function') return unavailable('이 Node.js에는 디스크 정보를 읽는 기능(fs.statfsSync)이 없습니다');
    const root = path.parse(path.resolve(target)).root;
    const s = deps.statfs(root);
    const blockSize = Number(s && s.bsize);
    const blocks = Number(s && s.blocks);
    const available = Number(s && s.bavail);
    if (![blockSize, blocks, available].every(isNum) || blockSize <= 0 || blocks <= 0 || available < 0 || available > blocks) {
      return unavailable('운영체제가 준 디스크 값이 올바르지 않습니다');
    }
    return ok({ path: root, totalBytes: blocks * blockSize, freeBytes: available * blockSize });
  } catch (e) {
    return unavailable(`디스크 정보를 읽지 못했습니다(${errName(e)})`);
  }
}

// measuredAt은 CPU 측정 구간이 끝난 직후, 메모리·디스크를 읽은 시각이다.
export async function measureSample(deps = realDeps, { diskTarget = process.cwd() } = {}) {
  const cpu = await measureCpu(deps);
  const measuredAt = deps.now().toISOString();
  return { version: SCHEMA_VERSION, source: 'measured', measuredAt, cpu, memory: measureMemory(deps), disk: measureDisk(deps, diskTarget) };
}

// ---------- 기록 읽기·쓰기 (프로젝트 밖) ----------

export function defaultDataDir(env = process.env) {
  return typeof env.LOCALAPPDATA === 'string' && env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'keshev-pc-status') : null;
}

function validMetric(m, fields) {
  if (!m || typeof m !== 'object') return false;
  if (m.status === 'unavailable') return typeof m.reason === 'string' && m.reason.length > 0;
  return m.status === 'ok' && fields.every(([key, type]) => (type === 'num' ? isNum(m[key]) : typeof m[key] === 'string'));
}

// 직접 측정해 저장한 기록만 받는다. 예시(example) 값은 기록으로 읽히지 않는다.
export function isSample(s) {
  return !!s && s.version === SCHEMA_VERSION && s.source === 'measured' && typeof s.measuredAt === 'string' && Number.isFinite(Date.parse(s.measuredAt))
    && validMetric(s.cpu, [['percent', 'num'], ['windowMs', 'num'], ['logicalCores', 'num']])
    && validMetric(s.memory, [['totalBytes', 'num'], ['freeBytes', 'num']])
    && validMetric(s.disk, [['path', 'str'], ['totalBytes', 'num'], ['freeBytes', 'num']]);
}

export function loadSamples(dir) {
  const file = path.join(dir, DATA_FILE);
  try {
    const size = fs.statSync(file).size;
    let raw;
    if (size > MAX_READ_BYTES) {
      const fd = fs.openSync(file, 'r');
      try {
        const buffer = Buffer.alloc(MAX_READ_BYTES);
        fs.readSync(fd, buffer, 0, MAX_READ_BYTES, size - MAX_READ_BYTES);
        raw = buffer.toString('utf8').split('\n').slice(1).join('\n'); // 잘린 첫 줄은 버린다
      } finally {
        fs.closeSync(fd);
      }
    } else {
      raw = fs.readFileSync(file, 'utf8');
    }
    const samples = [];
    let skipped = 0;
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (isSample(parsed)) samples.push(parsed);
        else skipped++;
      } catch {
        skipped++;
      }
    }
    return { samples, skipped, error: null };
  } catch (e) {
    if (e && e.code === 'ENOENT') return { samples: [], skipped: 0, error: null };
    return { samples: [], skipped: 0, error: `기록 파일을 읽지 못했습니다(${errName(e)})` };
  }
}

export function appendSample(dir, sample) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, DATA_FILE), JSON.stringify(sample) + '\n', 'utf8');
    return { saved: true, reason: null };
  } catch (e) {
    return { saved: false, reason: `기록을 저장하지 못했습니다(${errName(e)})` };
  }
}

// ---------- 추이 비교 ----------

const round = (value, digits) => Math.round(value * 10 ** digits);

function describe(sample, key) {
  const m = sample[key];
  return m.status === 'ok' ? null : m.reason;
}

function metricRows(sample) {
  const used = sample.memory.status === 'ok' ? sample.memory.totalBytes - sample.memory.freeBytes : null;
  return {
    cpu: { label: 'CPU 사용률', unit: '%p', digits: 1, value: sample.cpu.status === 'ok' ? sample.cpu.percent : null, shown: '%', reason: describe(sample, 'cpu') },
    memory: { label: '메모리 사용량(전체−여유)', unit: 'GiB', digits: 2, value: used === null ? null : used / GIB, shown: 'GiB', reason: describe(sample, 'memory') },
    disk: { label: '디스크 남은 공간', unit: 'GiB', digits: 2, value: sample.disk.status === 'ok' ? sample.disk.freeBytes / GIB : null, shown: 'GiB', reason: describe(sample, 'disk') },
  };
}

// 표시한 자릿수를 기준으로 증가·감소·변화 없음만 말한다. 정상·위험 같은 판정은 하지 않는다.
export function compareSamples(prev, curr) {
  const elapsedMs = Date.parse(curr.measuredAt) - Date.parse(prev.measuredAt);
  if (!(elapsedMs > 0)) return { comparable: false, reason: '두 측정의 시각 순서를 확인할 수 없어 비교하지 않습니다', elapsedMs: null, rows: [] };
  const before = metricRows(prev);
  const after = metricRows(curr);
  const rows = Object.keys(before).map((key) => {
    const b = before[key];
    const a = after[key];
    const base = { label: b.label, unit: b.unit, shown: b.shown, digits: b.digits };
    if (b.value === null || a.value === null) {
      const parts = [];
      if (b.value === null) parts.push(`이전: ${b.reason}`);
      if (a.value === null) parts.push(`현재: ${a.reason}`);
      return { ...base, comparable: false, reason: parts.join(' / ') };
    }
    if (key === 'disk' && prev.disk.path !== curr.disk.path) {
      return { ...base, comparable: false, reason: `디스크 경로가 달라 비교할 수 없습니다(이전 ${prev.disk.path}, 현재 ${curr.disk.path})` };
    }
    const rb = round(b.value, b.digits);
    const ra = round(a.value, a.digits);
    const delta = (ra - rb) / 10 ** b.digits;
    return { ...base, comparable: true, before: rb / 10 ** b.digits, after: ra / 10 ** b.digits, delta, direction: delta > 0 ? '증가' : delta < 0 ? '감소' : '변화 없음(표시 자릿수 기준)' };
  });
  return { comparable: true, reason: null, elapsedMs, rows };
}

// ---------- 표시 ----------

const fmtGiB = (bytes) => (bytes / GIB).toFixed(2);
const fmtKst = (iso) => `${new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })} (한국 시각)`;
const sign = (n, digits) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n).toFixed(digits);

function fmtElapsed(ms) {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h ? `${h}시간 ` : ''}${h || m ? `${m}분 ` : ''}${s}초`;
}

// tag는 [실제 측정] 또는 [예시]. 줄마다 붙여 복사해도 실제 값과 예시 값이 섞이지 않게 한다.
export function renderSample(sample, tag) {
  const lines = [`${tag} 측정 시각: ${sample.measuredAt} (UTC) · ${fmtKst(sample.measuredAt)}`];
  const { cpu, memory, disk } = sample;
  lines.push(cpu.status === 'ok'
    ? `${tag} CPU 사용률: ${cpu.percent.toFixed(1)} % (${cpu.windowMs} ms 구간 평균, 논리 코어 ${cpu.logicalCores}개)`
    : `${tag} CPU 사용률: 확인 불가 — 이유: ${cpu.reason}`);
  if (memory.status === 'ok') {
    lines.push(`${tag} 메모리 전체: ${fmtGiB(memory.totalBytes)} GiB`);
    lines.push(`${tag} 메모리 여유: ${fmtGiB(memory.freeBytes)} GiB (운영체제가 보고한 값)`);
    lines.push(`${tag} 메모리 사용량: ${fmtGiB(memory.totalBytes - memory.freeBytes)} GiB (전체−여유로 계산한 값)`);
  } else {
    lines.push(`${tag} 메모리: 확인 불가 — 이유: ${memory.reason}`);
  }
  if (disk.status === 'ok') {
    lines.push(`${tag} 디스크 ${disk.path} 전체: ${fmtGiB(disk.totalBytes)} GiB`);
    lines.push(`${tag} 디스크 ${disk.path} 남은 공간: ${fmtGiB(disk.freeBytes)} GiB (일반 사용자 기준)`);
  } else {
    lines.push(`${tag} 디스크: 확인 불가 — 이유: ${disk.reason}`);
  }
  return lines;
}

export function renderComparison(prev, curr, tag) {
  const result = compareSamples(prev, curr);
  if (!result.comparable) return [`${tag} 추이 비교: 확인 불가 — 이유: ${result.reason}`];
  const lines = [
    `${tag} 추이 비교 — 이전 ${prev.measuredAt} → 현재 ${curr.measuredAt} (간격 ${fmtElapsed(result.elapsedMs)})`,
  ];
  for (const row of result.rows) {
    lines.push(row.comparable
      ? `${tag} ${row.label}: ${row.before.toFixed(row.digits)} → ${row.after.toFixed(row.digits)} ${row.shown} (${sign(row.delta, row.digits)} ${row.unit}, ${row.direction})`
      : `${tag} ${row.label}: 비교 불가 — 이유: ${row.reason}`);
  }
  lines.push(`${tag} 참고: 숫자 변화만 보여 주며 정상·위험을 판정하지 않습니다. CPU 사용률은 ${CPU_WINDOW_MS} ms 순간 구간 값이라 측정마다 크게 달라질 수 있습니다.`);
  return lines;
}

// ---------- 설명용 예시 값 (실제로 잰 값이 아님) ----------

export function exampleSamples() {
  const gib = (n) => n * GIB;
  const before = {
    version: SCHEMA_VERSION, source: 'example', measuredAt: '2000-01-01T00:00:00.000Z',
    cpu: ok({ percent: 41.7, windowMs: CPU_WINDOW_MS, logicalCores: 8 }),
    memory: ok({ totalBytes: gib(16), freeBytes: gib(8) }),
    disk: ok({ path: 'C:\\', totalBytes: gib(500), freeBytes: gib(200) }),
  };
  const after = {
    version: SCHEMA_VERSION, source: 'example', measuredAt: '2000-01-01T00:05:30.000Z',
    cpu: ok({ percent: 12.5, windowMs: CPU_WINDOW_MS, logicalCores: 8 }),
    memory: ok({ totalBytes: gib(16), freeBytes: gib(9.5) }),
    disk: unavailable('예시: 디스크 정보를 읽지 못한 경우를 보여 주기 위한 가짜 이유입니다'),
  };
  return { before, after };
}

// ---------- 모의 점검 (가짜 의존성으로 함수만 검사. 이 PC의 실제 값이 아님) ----------

async function selfTest() {
  const results = [];
  const check = (name, pass) => results.push({ name, pass: !!pass });
  const cpuTimes = (user, idle) => [{ times: { user, nice: 0, sys: 0, idle, irq: 0 } }];
  const depsFor = (over) => ({ cpus: () => cpuTimes(0, 0), totalmem: () => 16 * GIB, freemem: () => 8 * GIB, statfs: () => ({ bsize: 4096, blocks: 1000, bavail: 400 }), sleep: async () => {}, now: () => new Date('2026-01-01T00:00:00.000Z'), ...over });
  let step = 0;
  const seq = (a, b) => () => (step++ % 2 === 0 ? a : b);

  step = 0; const c1 = await measureCpu(depsFor({ cpus: seq(cpuTimes(0, 100), cpuTimes(50, 150)) }));
  check('CPU: 전체 100 중 유휴 50이면 50.0 %', c1.status === 'ok' && c1.percent === 50);
  check('CPU: 코어 정보가 없으면 확인 불가', (await measureCpu(depsFor({ cpus: () => [] }))).status === 'unavailable');
  check('CPU: 시간이 늘지 않으면 확인 불가', (await measureCpu(depsFor({ cpus: () => cpuTimes(5, 5) }))).status === 'unavailable');
  step = 0; check('CPU: 시간이 줄어들면 확인 불가', (await measureCpu(depsFor({ cpus: seq(cpuTimes(10, 10), cpuTimes(5, 5)) }))).status === 'unavailable');
  step = 0; check('CPU: 구간 중 코어 수가 바뀌면 확인 불가', (await measureCpu(depsFor({ cpus: seq(cpuTimes(0, 0), [...cpuTimes(1, 1), ...cpuTimes(1, 1)]) }))).status === 'unavailable');
  check('메모리: 여유가 전체보다 크면 확인 불가', measureMemory(depsFor({ freemem: () => 20 * GIB })).status === 'unavailable');
  check('메모리: 정상 값은 그대로', measureMemory(depsFor({})).status === 'ok');
  const thrown = measureDisk(depsFor({ statfs: () => { throw Object.assign(new Error('C:\\비밀경로'), { code: 'EPERM' }); } }), 'C:\\');
  check('디스크: 읽기 오류는 확인 불가이며 이유에 경로를 넣지 않음', thrown.status === 'unavailable' && thrown.reason.includes('EPERM') && !thrown.reason.includes('비밀경로'));
  check('디스크: 남은 블록이 전체보다 크면 확인 불가', measureDisk(depsFor({ statfs: () => ({ bsize: 4096, blocks: 10, bavail: 20 }) }), 'C:\\').status === 'unavailable');

  const mk = (at, cpu, free, diskFree, diskPath = 'C:\\') => ({ version: 1, source: 'measured', measuredAt: at,
    cpu: typeof cpu === 'number' ? ok({ percent: cpu, windowMs: 1000, logicalCores: 4 }) : unavailable(cpu),
    memory: ok({ totalBytes: 16 * GIB, freeBytes: free * GIB }),
    disk: typeof diskFree === 'number' ? ok({ path: diskPath, totalBytes: 100 * GIB, freeBytes: diskFree * GIB }) : unavailable(diskFree) });
  const up = compareSamples(mk('2026-01-01T00:00:00Z', 10, 8, 50), mk('2026-01-01T00:01:00Z', 30, 6, 50));
  check('비교: CPU 증가, 메모리 사용량 증가, 디스크 변화 없음', up.rows[0].direction === '증가' && up.rows[1].direction === '증가' && up.rows[2].direction.startsWith('변화 없음'));
  check('비교: CPU 변화량은 +20.0 %p', up.rows[0].delta === 20);
  check('비교: 표시 자릿수 아래 차이는 변화 없음', compareSamples(mk('2026-01-01T00:00:00Z', 10.01, 8, 50), mk('2026-01-01T00:01:00Z', 10.04, 8, 50)).rows[0].direction.startsWith('변화 없음'));
  check('비교: 시각이 거꾸로면 비교 불가', compareSamples(mk('2026-01-01T00:02:00Z', 1, 8, 50), mk('2026-01-01T00:01:00Z', 1, 8, 50)).comparable === false);
  const half = compareSamples(mk('2026-01-01T00:00:00Z', 'x 이유', 8, 50), mk('2026-01-01T00:01:00Z', 5, 8, 50));
  check('비교: 한쪽이 확인 불가면 그 항목만 비교 불가이며 이유를 보여 줌', half.rows[0].comparable === false && half.rows[0].reason.includes('이전: x 이유') && half.rows[1].comparable === true);
  check('비교: 디스크 경로가 다르면 비교 불가', compareSamples(mk('2026-01-01T00:00:00Z', 1, 8, 50, 'C:\\'), mk('2026-01-01T00:01:00Z', 1, 8, 50, 'D:\\')).rows[2].comparable === false);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keshev-pc-selftest-'));
  try {
    appendSample(dir, mk('2026-01-01T00:00:00Z', 10, 8, 50));
    fs.appendFileSync(path.join(dir, DATA_FILE), '깨진 줄\n{"version":1,"source":"example"}\n', 'utf8');
    appendSample(dir, mk('2026-01-01T00:01:00Z', 20, 8, 50));
    const loaded = loadSamples(dir);
    check('기록: 깨진 줄과 예시(example) 줄은 건너뛰고 측정 기록 2개만 읽음', loaded.samples.length === 2 && loaded.skipped === 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  check('기록: 존재하지 않는 폴더는 빈 목록(오류 아님)', (() => { const r = loadSamples(path.join(os.tmpdir(), 'keshev-없는-폴더-' + Date.now())); return r.samples.length === 0 && r.error === null; })());
  check('기록: LOCALAPPDATA가 없으면 기록 폴더 없음', defaultDataDir({}) === null);
  check('예시: 기록으로 읽히지 않음', !isSample(exampleSamples().before));

  console.log('[모의 점검] 가짜 값으로 함수만 검사한 결과이며 이 PC의 실제 측정값이 아닙니다.');
  for (const r of results) console.log(`[모의 점검] ${r.pass ? '통과' : '실패'} | ${r.name}`);
  const failed = results.filter((r) => !r.pass).length;
  console.log(`[모의 점검] 합계: 통과 ${results.length - failed}, 실패 ${failed}`);
  return failed === 0 ? 0 : 1;
}

// ---------- 명령줄 ----------

const USAGE = `사용법: node student/pc-status.mjs [명령] [옵션]
  (명령 없음) 또는 --measure   지금 측정하고, 직전 기록과 비교한 뒤 기록에 추가합니다.
  --compare                    측정하지 않고 저장된 마지막 두 측정을 비교합니다.
  --example                    설명용 예시 값을 보여 줍니다. 실제로 잰 값이 아니며 저장하지 않습니다.
  --self-test                  가짜 값으로 함수를 검사합니다(이 PC의 실제 값이 아님).
옵션:
  --data-dir <경로>            기록 폴더. 기본은 %LOCALAPPDATA%\\keshev-pc-status
  --disk <경로>                디스크를 읽을 경로. 기본은 현재 폴더가 있는 드라이브`;

function parseArgs(argv) {
  const out = { command: 'measure', dataDir: undefined, disk: undefined };
  const commands = { '--measure': 'measure', '--compare': 'compare', '--example': 'example', '--self-test': 'self-test', '--help': 'help', '-h': 'help' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (Object.hasOwn(commands, arg)) out.command = commands[arg];
    else if ((arg === '--data-dir' || arg === '--disk') && typeof argv[i + 1] === 'string' && !argv[i + 1].startsWith('--')) out[arg === '--data-dir' ? 'dataDir' : 'disk'] = argv[++i];
    else return null;
  }
  return out;
}

function recordsDir(args) {
  return args.dataDir !== undefined ? path.resolve(args.dataDir) : defaultDataDir();
}

export async function main(argv = process.argv.slice(2), deps = realDeps) {
  const args = parseArgs(argv);
  if (!args) { console.error(USAGE); return 2; }
  if (args.command === 'help') { console.log(USAGE); return 0; }
  if (args.command === 'self-test') return selfTest();
  const print = (lines) => { for (const line of lines) console.log(line); };

  if (args.command === 'example') {
    const { before, after } = exampleSamples();
    console.log('[예시] 아래 값은 설명용 예시이며 이 PC에서 실제로 잰 값이 아닙니다. 저장하지 않습니다.');
    print(renderSample(before, '[예시]'));
    print(renderSample(after, '[예시]'));
    print(renderComparison(before, after, '[예시]'));
    return 0;
  }

  const dir = recordsDir(args);
  const loaded = dir ? loadSamples(dir) : { samples: [], skipped: 0, error: 'LOCALAPPDATA가 없어 기록 폴더를 정할 수 없습니다. --data-dir로 폴더를 지정하세요' };
  if (loaded.error) console.log(`[실제 측정] 기록 확인 불가 — 이유: ${loaded.error}`);
  if (loaded.skipped > 0) console.log(`[실제 측정] 읽을 수 없는 기록 ${loaded.skipped}줄은 건너뛰었습니다.`);

  if (args.command === 'compare') {
    if (loaded.samples.length < 2) {
      console.log(`[실제 측정] 비교하려면 저장된 측정이 2개 이상 필요합니다(현재 ${loaded.samples.length}개). 먼저 측정을 두 번 하세요.`);
      return 0;
    }
    const prev = loaded.samples[loaded.samples.length - 2];
    const curr = loaded.samples[loaded.samples.length - 1];
    print(renderComparison(prev, curr, '[실제 측정]'));
    return 0;
  }

  const sample = await measureSample(deps, { diskTarget: args.disk ?? process.cwd() });
  print(renderSample(sample, '[실제 측정]'));
  const prev = loaded.samples.length > 0 ? loaded.samples[loaded.samples.length - 1] : null;
  if (prev) print(renderComparison(prev, sample, '[실제 측정]'));
  else console.log('[실제 측정] 추이 비교: 이전 측정 기록이 없어 비교하지 않습니다(처음 측정). 한 번 더 측정하면 비교합니다.');

  if (!dir) {
    console.log('[실제 측정] 이번 측정은 저장하지 않았습니다 — 이유: 기록 폴더를 정할 수 없음');
  } else {
    const saved = appendSample(dir, sample);
    console.log(saved.saved
      ? `[실제 측정] 이번 측정을 기록에 추가했습니다: ${path.join(dir, DATA_FILE)}`
      : `[실제 측정] 이번 측정은 저장하지 않았습니다 — 이유: ${saved.reason}`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then((code) => { process.exitCode = code; });
}
