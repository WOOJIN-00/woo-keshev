// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
const MODE_LABELS = {
  demo: '예제 자료 (실제 연결이 아님)',
  disconnected: '연결 없음',
  unknown: '확인 불가 (연결 상태를 확인할 수 없음)',
};
const DEVICE_LABELS = {
  compliant: '보안 기준 충족',
  noncompliant: '보안 기준 미충족',
  unknown: '확인 불가',
};
const SESSION_LABELS = {
  active: '활성',
  expired: '만료',
  revoked: '철회됨',
  unknown: '확인 불가',
};

function text(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

function labelOf(table, value) {
  return Object.hasOwn(table, value) ? table[value] : '확인 불가';
}

function rawOf(value) {
  return typeof value === 'string' && value ? value : '없음';
}

// 정상(compliant·active)이 아닌 값은 글자 앞에 경고 표시를 붙여 색 없이도 구분한다.
function statusText(table, value, okValue) {
  const prefix = value === okValue ? '정상' : '주의';
  return `[${prefix}] ${labelOf(table, value)} (${rawOf(value)})`;
}

function modeBox(resource) {
  const mode = resource && resource.mode;
  const label = Object.hasOwn(MODE_LABELS, mode) ? MODE_LABELS[mode] : null;
  return label ? text('p', `연결 모드: ${label}`, 'student-mode') : null;
}

function row(dt, dd) {
  const wrap = document.createElement('div');
  wrap.append(text('dt', dt), text('dd', dd));
  return wrap;
}

function section(title, resource, build) {
  const box = document.createElement('section');
  box.append(text('h3', title));
  const mode = modeBox(resource);
  if (mode) box.append(mode);
  if (!resource || resource.status === 'loading') {
    box.append(text('p', `${title}: 불러오는 중`, 'student-loading'));
  } else if (resource.status === 'error') {
    const message = resource.error && resource.error.message ? resource.error.message : '확인 불가';
    box.append(text('p', `연결 실패: ${message}`, 'student-error'));
    box.append(text('p', `${title} 값을 확인할 수 없습니다.`, 'student-error'));
  } else if (resource.status === 'ok' && resource.data != null) {
    box.append(build(resource.data));
  } else {
    box.append(text('p', `${title}: 확인 불가`, 'student-error'));
  }
  return box;
}

function buildMe(data) {
  const list = document.createElement('dl');
  const user = data.user || {};
  const device = data.device || {};
  const session = data.session || {};
  list.append(
    row('사용자', `${rawOf(user.label)} (ID: ${rawOf(user.id)})`),
    row('현재 기기', `${rawOf(device.label)} (ID: ${rawOf(device.id)})`),
    row('현재 기기 상태', statusText(DEVICE_LABELS, device.status, 'compliant')),
    row('현재 세션', `ID: ${rawOf(session.id)}`),
    row('현재 세션 상태', statusText(SESSION_LABELS, session.status, 'active')),
  );
  return list;
}

function buildDevices(data) {
  if (!Array.isArray(data)) return text('p', '기기 목록: 확인 불가', 'student-error');
  if (data.length === 0) return text('p', '등록된 기기가 없습니다.');
  const list = document.createElement('ul');
  for (const item of data) {
    list.append(text('li', `${rawOf(item && item.label)} (ID: ${rawOf(item && item.id)}) — ${statusText(DEVICE_LABELS, item && item.status, 'compliant')}`));
  }
  return list;
}

function buildSessions(data) {
  if (!Array.isArray(data)) return text('p', '세션 목록: 확인 불가', 'student-error');
  if (data.length === 0) return text('p', '세션이 없습니다.');
  const list = document.createElement('ul');
  for (const item of data) {
    list.append(text('li', `세션 ID: ${rawOf(item && item.id)} — ${statusText(SESSION_LABELS, item && item.status, 'active')}`));
  }
  return list;
}

function renderIdentity({ me, devices, sessions } = {}) {
  // 매번 새 DOM을 만들어 반환하므로 앱이 이전 사용자·기기·세션 표시를 통째로 교체한다.
  const root = document.createElement('div');
  root.className = 'student-identity';
  // 4일차: 핵심 3가지 패널을 이 칸의 맨 위에 둔다. 아래 기존 표시는 그대로다.
  root.append(
    buildPcDashboard(),
    buildPcPanel(),
    section('내 계정', me, buildMe),
    section('기기 목록', devices, buildDevices),
    section('세션 목록', sessions, buildSessions),
  );
  return root;
}

const DECISION_LABELS = {
  allow: '접근 허용 (정책상 허용이며 실제 앱 접속 성공을 보장하지 않음)',
  deny: '접근 거부',
  challenge: '추가 인증 또는 확인 필요 (이 앱이 확인 절차를 대신 수행하지 않음)',
  unknown: '판정 확인 불가 (허용되지 않음)',
};

function decisionBadge(decision) {
  if (decision === 'allow') return '[허용]';
  if (decision === 'deny') return '[거부]';
  if (decision === 'challenge') return '[추가 확인 필요]';
  return '[확인 불가]';
}

function renderDecision({ status, mode, data, error, appId } = {}) {
  const root = document.createElement('div');
  root.className = 'student-decision';
  const modeLabel = Object.hasOwn(MODE_LABELS, mode) ? MODE_LABELS[mode] : null;
  if (modeLabel) root.append(text('p', `연결 모드: ${modeLabel}`, 'student-mode'));

  if (status === 'idle' || status == null) {
    root.append(text('p', '앱을 골라 접속을 요청하세요. 아직 요청하지 않았으므로 판정이 없습니다.', 'student-idle'));
  } else if (status === 'loading') {
    root.append(text('p', `판정 확인 중${appId ? ` (앱: ${appId})` : ''}`, 'student-loading'));
  } else if (status === 'error') {
    const message = error && error.message ? error.message : '확인 불가';
    root.append(text('p', `[요청 실패] 요청 실패: ${message}`, 'student-error'));
    root.append(text('p', '이 결과는 접근 거부 판정이 아니며, 접근이 허용되었다는 뜻도 아닙니다. 판정을 받지 못했습니다.', 'student-error'));
  } else if (status === 'ok' && data && typeof data === 'object') {
    // 알려진 판정 코드가 아니면 허용처럼 읽히지 않도록 확인 불가로 처리한다.
    const known = Object.hasOwn(DECISION_LABELS, data.decision);
    const raw = known ? data.decision : 'unknown';
    root.append(text('p', `${decisionBadge(raw)} ${DECISION_LABELS[raw]} — 원래 값: ${raw}`, `student-decision-${raw}`));
    if (!known) root.append(text('p', `서버가 알 수 없는 판정 값을 반환했습니다: ${rawOf(data.decision)}`, 'student-error'));
    const list = document.createElement('dl');
    list.append(
      row('앱', rawOf(data.appId ?? appId)),
      row('판정 이유', rawOf(data.reason)),
      row('판정 시각', rawOf(data.checkedAt)),
    );
    root.append(list);
  } else {
    root.append(text('p', '[확인 불가] 판정 상태를 확인할 수 없습니다. 허용되지 않은 상태로 취급합니다.', 'student-error'));
  }
  return root;
}

const KIND_LABELS = { access: '접속 기록', xdr: 'XDR 경보' };
const ACCESS_LABELS = { allowed: '접속 허용됨', denied: '접속 거부됨', unknown: '확인 불가' };
const NO_APP = '__no_app__';
let filterSeq = 0;

function koreanTime(at) {
  const ms = Date.parse(at);
  if (!Number.isFinite(ms)) return '시각 확인 불가';
  return new Date(ms).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }) + ' (한국 시각)';
}

function accessText(value) {
  const prefix = value === 'allowed' ? '[허용]' : value === 'denied' ? '[거부]' : '[확인 불가]';
  return `${prefix} ${labelOf(ACCESS_LABELS, value)} (${rawOf(value)})`;
}

function appText(appId) {
  return typeof appId === 'string' && appId ? appId : '앱을 확인할 수 없음 (appId 없음)';
}

function textRows(title, items) {
  const box = document.createElement('div');
  box.append(text('h4', title));
  if (!Array.isArray(items) || items.length === 0) {
    box.append(text('p', `${title}: 없음`));
    return box;
  }
  const list = document.createElement('ul');
  for (const item of items) list.append(text('li', `${rawOf(item && item.id)}: ${rawOf(item && item.text)}`));
  box.append(list);
  return box;
}

function buildEventDetail(event) {
  const box = document.createElement('div');
  box.className = 'student-event-detail';
  box.setAttribute('data-student-event-detail', event.id);
  const state = event.state || {};
  box.append(text('h3', `${event.id} 상세`));
  const list = document.createElement('dl');
  list.append(
    row('사건 ID', rawOf(event.id)),
    row('앱', appText(event.appId)),
    row('접속 상태', accessText(state.access)),
    row('세션 상태', statusText(SESSION_LABELS, state.session, 'active')),
    row('기기 상태', statusText(DEVICE_LABELS, state.device, 'compliant')),
  );
  box.append(list, textRows('근거(evidence)', event.evidence), textRows('규칙(rules)', event.rules));
  // 연결되지 않은 조치는 요청을 보내지 않는 비활성 버튼과 안내 문구로만 알린다.
  const actions = Array.isArray(event.supportedActions) ? event.supportedActions.filter((a) => typeof a === 'string' && a) : [];
  if (actions.length > 0) {
    const actionBox = document.createElement('div');
    actionBox.append(text('h4', '조치(미지원)'));
    for (const action of actions) {
      const button = text('button', `${action} 미지원`);
      button.type = 'button';
      button.disabled = true;
      actionBox.append(button, text('p', `${action}: 아직 지원하지 않는 조치입니다. 조치 실행 연결은 준비 중이며, 어떤 요청도 보내지 않았습니다.`));
    }
    box.append(actionBox);
  }
  return box;
}

function filterBox(label, options) {
  const wrap = document.createElement('div');
  wrap.className = 'student-filter';
  const id = `student-filter-${++filterSeq}`;
  const labelEl = text('label', label);
  labelEl.setAttribute('for', id);
  const select = document.createElement('select');
  select.id = id;
  for (const [value, caption] of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = caption;
    select.append(option);
  }
  wrap.append(labelEl, select);
  return { wrap, select };
}

function renderEvents({ status, mode, data, error } = {}) {
  const root = document.createElement('div');
  root.className = 'student-events';
  const modeLabel = Object.hasOwn(MODE_LABELS, mode) ? MODE_LABELS[mode] : null;
  if (modeLabel) root.append(text('p', `연결 모드: ${modeLabel}`, 'student-mode'));

  if (status === 'loading') {
    root.append(text('p', '기록을 불러오는 중', 'student-loading'));
    return root;
  }
  if (status === 'error') {
    const message = error && error.message ? error.message : '확인 불가';
    const mismatch = error && (error.code === 'CONTRACT_MISMATCH' || error.code === 'ENGINE_RESULT_UNVERIFIED');
    // 이전 목록은 새 DOM에 넣지 않으므로 실패 뒤에도 옛 기록이 현재 결과처럼 남지 않는다.
    root.append(text('p', mismatch ? `확인 불가: ${message}` : `기록을 불러오지 못했습니다: ${message}`, 'student-error'));
    root.append(text('p', '이 화면은 기록이 없다는 뜻이 아닙니다. 이전 목록은 표시하지 않습니다.', 'student-error'));
    return root;
  }
  if (status !== 'ok' || !Array.isArray(data)) {
    root.append(text('p', '확인 불가: 기록 상태를 확인할 수 없습니다. 이전 목록은 표시하지 않습니다.', 'student-error'));
    return root;
  }

  root.append(text('p', '본인의 최근 보안 기록입니다(최대 40건). 모든 직원의 전체 이력이나 실시간 전체 위협 탐지가 아닙니다.', 'student-scope'));
  if (data.length === 0) {
    root.append(text('p', '표시할 기록이 없습니다.', 'student-empty'));
    return root;
  }

  // 원본 배열은 수정하지 않고 복사본을 at 기준 최신순으로 정렬한다.
  const events = [...data].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0) || String(a.id).localeCompare(String(b.id)));
  const appIds = [...new Set(events.map((e) => e.appId).filter((v) => typeof v === 'string' && v))];
  const kind = filterBox('기록 종류', [['all', '전체'], ...Object.entries(KIND_LABELS).map(([v, c]) => [v, `${c} (${v})`])]);
  const app = filterBox('업무 앱', [['all', '전체'], ...appIds.map((v) => [v, v]), ...(events.some((e) => !e.appId) ? [[NO_APP, '앱 확인 불가 (appId 없음)']] : [])]);
  const access = filterBox('접속 상태', [['all', '전체'], ...Object.entries(ACCESS_LABELS).map(([v, c]) => [v, `${c} (${v})`])]);
  const filters = document.createElement('div');
  filters.className = 'student-filters';
  filters.append(kind.wrap, app.wrap, access.wrap);

  const count = text('p', '', 'student-count');
  const list = document.createElement('ul');
  list.className = 'student-event-list';
  const detailBox = document.createElement('div');
  detailBox.className = 'student-detail-slot';
  let selectedId = null;

  function matches(e) {
    if (kind.select.value !== 'all' && e.kind !== kind.select.value) return false;
    if (app.select.value === NO_APP ? !!e.appId : app.select.value !== 'all' && e.appId !== app.select.value) return false;
    return access.select.value === 'all' || (e.state && e.state.access) === access.select.value;
  }

  function draw() {
    const shown = events.filter(matches);
    count.textContent = `${shown.length}건 표시 / 전체 ${events.length}건`;
    const items = shown.map((e) => {
      const li = document.createElement('li');
      li.setAttribute('data-student-event-id', e.id);
      li.append(
        text('span', `${rawOf(e.id)} · ${rawOf(e.at)} · ${koreanTime(e.at)} · ${labelOf(KIND_LABELS, e.kind)}(${rawOf(e.kind)}) · 앱: ${appText(e.appId)} · ${rawOf(e.summary)} `),
      );
      const button = text('button', `${e.id} 상세`);
      button.type = 'button';
      button.setAttribute('aria-expanded', String(e.id === selectedId));
      button.addEventListener('click', () => { selectedId = e.id; draw(); });
      li.append(button);
      return li;
    });
    if (shown.length === 0) {
      const none = document.createElement('li');
      none.textContent = '선택한 조건에 맞는 기록이 없습니다. 필터를 「전체」로 바꿔 보세요.';
      items.push(none);
    }
    list.replaceChildren(...items);
    const selected = shown.find((e) => e.id === selectedId);
    if (!selected) selectedId = null;
    detailBox.replaceChildren(...(selected ? [buildEventDetail(selected)] : []));
  }

  for (const f of [kind, app, access]) f.select.addEventListener('change', draw);
  draw();
  root.append(filters, count, list, detailBox);
  return root;
}

const TIMEOUT_CODES = ['TIMEOUT', 'REQUEST_TIMEOUT', 'ENGINE_TIMEOUT'];
const SECRET_PATTERN = /(?:Bearer\s+\S+|sk-[A-Za-z0-9_-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_ -]?key|authorization|password|secret|비밀번호|토큰)\s*[:=]\s*\S+)/i;
const RETRY_GUIDE = '다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요. 자동으로 다시 요청하지 않습니다.';

// 진단 값은 허용 목록의 필드만 문자열로 옮기고, 비밀처럼 보이는 값은 가린다.
function safeValue(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '없음';
  const s = String(value);
  return SECRET_PATTERN.test(s) ? '[가림]' : s.slice(0, 200);
}

function diagnosticsFields(data) {
  const d = data && typeof data === 'object' ? data : {};
  const engine = d.engine && typeof d.engine === 'object' ? d.engine : {};
  return [
    ['requestId', safeValue(d.requestId)],
    ['component', safeValue(d.component)],
    ['version', safeValue(d.version)],
    ['checkedAt', safeValue(d.checkedAt)],
    ['engine.mode', safeValue(engine.mode)],
    ['engine.code', safeValue(engine.code)],
  ];
}

function failureBox(title, error) {
  const code = error && typeof error.code === 'string' ? error.code : '';
  const message = error && error.message ? error.message : '확인 불가';
  const box = document.createElement('div');
  box.append(text('p', `${TIMEOUT_CODES.includes(code) ? '[시간 초과] ' : ''}${title} 불러오기 실패 (불러오지 못했습니다): ${message}`, 'student-error'));
  box.append(text('p', RETRY_GUIDE, 'student-retry'));
  return box;
}

function statusSection(title, resource, emptyText, build) {
  const box = document.createElement('section');
  box.append(text('h3', title));
  const modeLabel = resource && Object.hasOwn(MODE_LABELS, resource.mode) ? MODE_LABELS[resource.mode] : null;
  if (modeLabel) box.append(text('p', `연결 모드: ${modeLabel}`, 'student-mode'));
  if (!resource || resource.status === 'loading' || resource.status === 'idle') {
    box.append(text('p', `${title}: 불러오는 중`, 'student-loading'));
  } else if (resource.status === 'error') {
    box.append(failureBox(title, resource.error));
  } else if (resource.status === 'ok' && Array.isArray(resource.data)) {
    box.append(resource.data.length === 0 ? text('p', emptyText, 'student-empty') : build(resource.data));
  } else {
    box.append(text('p', `${title}: 확인 불가`, 'student-error'));
  }
  return box;
}

function diagnosticsSection(diagnostics) {
  const box = document.createElement('section');
  box.append(text('h3', '진단 정보'));
  let fields = null;
  if (!diagnostics || diagnostics.status === 'idle') {
    box.append(text('p', '진단 정보를 아직 불러오지 않았습니다. 아래 제공 화면의 도움정보 불러오기를 직접 누르세요.', 'student-empty'));
  } else if (diagnostics.status === 'loading') {
    box.append(text('p', '진단 정보: 불러오는 중', 'student-loading'));
  } else if (diagnostics.status === 'error') {
    box.append(failureBox('진단 정보', diagnostics.error));
  } else if (diagnostics.status === 'ok') {
    fields = diagnosticsFields(diagnostics.data);
    const list = document.createElement('dl');
    for (const [name, value] of fields) list.append(row(name, value));
    box.append(list);
  } else {
    box.append(text('p', '진단 정보: 확인 불가', 'student-error'));
  }

  const copy = text('button', '도움정보 복사');
  copy.type = 'button';
  const result = text('p', '이 정보는 도움을 요청할 때 쓰도록 복사하는 것입니다. 누를 때만 복사하며 어디에도 전송하지 않습니다.', 'student-copy-status');
  copy.addEventListener('click', async () => {
    if (!fields) { result.textContent = '복사할 진단 정보가 없습니다. 진단 정보를 먼저 불러오세요.'; return; }
    const body = fields.map(([name, value]) => `${name}: ${value}`).join('\n');
    try {
      await navigator.clipboard.writeText(body);
      result.textContent = '진단 정보 6개 항목을 클립보드에 복사했습니다.';
    } catch {
      result.textContent = '자동 복사를 사용할 수 없습니다. 위 진단 정보를 직접 선택해 복사하세요.';
    }
  });
  box.append(copy, result);
  return box;
}

function renderStatus({ devices, sessions, notifications, diagnostics, mode } = {}) {
  const root = document.createElement('div');
  root.className = 'student-status';
  const modeLabel = Object.hasOwn(MODE_LABELS, mode) ? MODE_LABELS[mode] : null;
  if (modeLabel) root.append(text('p', `전체 연결 모드: ${modeLabel}`, 'student-mode'));

  root.append(statusSection('기기', devices, '등록된 기기가 없습니다.', (list) => {
    const ul = document.createElement('ul');
    for (const d of list) ul.append(text('li', `${rawOf(d && d.label)} (ID: ${rawOf(d && d.id)}) — ${statusText(DEVICE_LABELS, d && d.status, 'compliant')}`));
    return ul;
  }));
  root.append(statusSection('세션', sessions, '현재 연결이 없습니다.', (list) => {
    const wrap = document.createElement('div');
    const ul = document.createElement('ul');
    for (const s of list) ul.append(text('li', `세션 ID: ${rawOf(s && s.id)} — ${statusText(SESSION_LABELS, s && s.status, 'active')}`));
    wrap.append(ul, text('p', '현재 검증된 연결 한 개만 표시합니다. 과거 세션 전체 목록이 아닙니다.', 'student-scope'));
    return wrap;
  }));

  const noteBox = document.createElement('section');
  noteBox.append(text('h3', '알림'));
  if (!Array.isArray(notifications)) {
    noteBox.append(text('p', '알림: 확인 불가', 'student-error'));
  } else if (notifications.length === 0) {
    noteBox.append(text('p', '주의할 알림이 없습니다.', 'student-empty'));
  } else {
    const ul = document.createElement('ul');
    for (const n of notifications) ul.append(text('li', `자료: ${rawOf(n && n.resource)} · 코드: ${rawOf(n && n.code)} · ${rawOf(n && n.message)}`));
    noteBox.append(ul);
  }
  root.append(noteBox, diagnosticsSection(diagnostics));
  return root;
}

const AI_AUTHORIZATION_LABELS = {
  test: '시험 연결 점검(test) — 시험용 연결의 모델 응답만 확인했습니다. 실제 앱 권한 확인이 아닙니다.',
  verified: '앱 권한 확인 후 점검(verified) — 점검 시각 기준으로 앱 권한과 모델 응답을 확인했습니다.',
};
const AI_MANUAL_RETRY = '자동으로 다시 점검하지 않습니다. 다시 점검하려면 「현재 API 연결 점검」 버튼을 직접 누르세요.';
const AI_NOT_EXPLAINED = '연결만 점검했으며 사건 설명은 아직 실행하지 않았습니다. 사건 설명은 보안 기록에서 따로 요청하고 확인합니다.';
// 제공 화면이 걸러 준 code를 원인별로 나눈다. 목록에 없는 code는 확인 불가로 취급한다.
const AI_ERROR_GROUPS = [
  { label: '권한 준비 중', codes: ['ON_AI_PROVISIONING_PENDING'], guide: '학생 계정과 앱 이용 권한은 운영 측에서 발급합니다. 학생 설정 오류가 아닙니다. 담당자에게 계정 연결과 앱 권한 확인을 요청하세요.' },
  { label: '인증 실패', codes: ['WB_CLCO_AUTH_REQUIRED'], guide: '보호 현황에서 계정 연결을 다시 확인하고, 계속 실패하면 담당자에게 확인하세요. Workbench 열쇠나 원본 열쇠를 복사해 붙이지 마세요.' },
  { label: '접근 제한', codes: ['WB_CLCO_ACCESS_BLOCKED'], guide: '계정 연결을 다시 확인하고, 담당자에게 앱 이용 권한을 확인하세요.' },
  { label: '사용량·이용 한도 초과', codes: ['WB_CLCO_COHORT_BUDGET_EXHAUSTED', 'WB_CLCO_LIMIT_REACHED'], guide: '반 사용량 또는 이용 한도에 도달했습니다. 담당자에게 확인하세요.' },
  { label: '이용 시간 아님', codes: ['WB_CLCO_SESSION_CLOSED'], guide: '현재는 AI 이용 시간이 아닙니다. 이용 시간을 확인하세요.' },
  { label: '요청 제한·시간 초과·네트워크', codes: ['WB_CLCO_RATE_LIMITED', 'WB_CLCO_TIMEOUT', 'REQUEST_TIMEOUT', 'ENGINE_TIMEOUT', 'TIMEOUT', 'NETWORK_ERROR'], guide: '일시적인 문제일 수 있습니다. 잠시 뒤 직접 다시 점검하세요.' },
  { label: '점검 취소', tag: '[취소됨]', codes: ['CANCELLED', 'WB_CLCO_CANCELLED', 'REQUEST_CANCELLED'], guide: '점검을 취소했습니다. 이전 점검 결과는 현재 결과가 아닙니다.' },
  { label: '사용 가능한 모델 없음', codes: ['ON_AI_MODEL_LIST_EMPTY', 'MODEL_NOT_CONFIGURED'], guide: '현재 앱 권한으로 쓸 수 있는 모델이 없습니다. 담당자에게 모델 허용 설정 확인을 요청하세요.' },
];
const AI_UNVERIFIED_GROUP = { label: '확인 불가', guide: '연결 상태나 권한을 확인할 수 없습니다. 담당자에게 계정 연결과 앱 권한 확인을 요청하세요.' };

function safeCode(code) {
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : 'UNKNOWN';
}

function aiErrorGroup(code) {
  return AI_ERROR_GROUPS.find((g) => g.codes.includes(code)) || AI_UNVERIFIED_GROUP;
}

function renderAiConnection({ status, mode, data, error, checkedAt } = {}) {
  // 매번 새 DOM을 반환하므로 재점검 성공·계정 변경(idle) 뒤 이전 결과나 오류 안내가 남지 않는다.
  const root = document.createElement('div');
  root.className = 'student-ai-connection';
  const modeLabel = Object.hasOwn(MODE_LABELS, mode) ? MODE_LABELS[mode] : null;
  if (modeLabel) root.append(text('p', `연결 모드: ${modeLabel}`, 'student-mode'));

  if (status === 'idle' || status == null) {
    root.append(text('p', '[점검 전] AI 연결 점검 전 — 아직 점검 결과가 없습니다.', 'student-idle'));
    root.append(text('p', '자동으로 점검하지 않습니다. 점검하려면 「현재 API 연결 점검」 버튼을 직접 누르세요.', 'student-retry'));
  } else if (status === 'loading') {
    root.append(text('p', '[점검 중] AI 연결 점검 중 — 모델 응답을 기다리고 있습니다. 취소하면 늦게 도착한 응답은 표시하지 않습니다.', 'student-loading'));
  } else if (status === 'error') {
    const code = safeCode(error && error.code);
    const group = aiErrorGroup(code);
    root.append(text('p', `${group.tag || '[점검 실패]'} ${group.label} — 이 결과는 연결 성공이 아닙니다.`, 'student-error'));
    const list = document.createElement('dl');
    list.append(row('오류 코드', code), row('안내', safeValue(error && error.message)), row('조치', group.guide));
    root.append(list, text('p', AI_MANUAL_RETRY, 'student-retry'));
  } else if (status === 'ok' && data && data.transportChecked === true && Object.hasOwn(AI_AUTHORIZATION_LABELS, data.audienceAuthorization) && Number.isInteger(data.modelCount)) {
    root.append(text('p', `[모델 응답 확인] ${AI_AUTHORIZATION_LABELS[data.audienceAuthorization]}`, `student-ai-${data.audienceAuthorization}`));
    const list = document.createElement('dl');
    list.append(
      row('응답 모델 수(modelCount)', String(data.modelCount)),
      row('점검 시각(checkedAt)', `${rawOf(checkedAt)} · ${koreanTime(checkedAt)}`),
      row('사건 설명', '실행하지 않음'),
    );
    root.append(list, text('p', AI_NOT_EXPLAINED, 'student-scope'), text('p', AI_MANUAL_RETRY, 'student-retry'));
  } else {
    root.append(text('p', `[확인 불가] ${AI_UNVERIFIED_GROUP.guide}`, 'student-error'));
    root.append(text('p', AI_MANUAL_RETRY, 'student-retry'));
  }
  return root;
}

// AI 설명은 해석일 뿐이다. 근거·규칙·현재 상태는 선택한 기록(event)의 값을 그대로 보여 주고,
// 기록에 없는 근거 ID는 맞춰 만들지 않고 설명을 쓸 수 없다고 알린다.
const STATE_KEYS = [['access', '접속'], ['session', '세션'], ['device', '기기']];
const EXPLANATION_REASONS = {
  ON_AI_INVALID_OUTPUT: '근거 부족: AI 응답의 근거·조치·형식이 이 기록과 맞지 않아 설명을 쓸 수 없습니다. 이미 실행했다고 답한 설명도 쓸 수 없습니다.',
  ON_AI_INVALID_INPUT: '근거 부족: 설명에 필요한 사건 근거·규칙을 확인할 수 없습니다.',
  SUBJECT_SCOPE_UNVERIFIED: '현재 로그인과 사건·프로젝트의 연결을 확인할 수 없습니다.',
};
const RECORD_KEPT = '기록은 그대로입니다. 업무 앱 판정과 보안 기록은 계속 사용할 수 있으며, 이 실패는 과제 실패가 아닙니다. 다시 요청하려면 보안 기록에서 「AI 설명 요청」 버튼을 직접 누르세요.';

function secretSafe(value) {
  return typeof value === 'string' && !SECRET_PATTERN.test(value) ? value : '[가림]';
}

function explanationFailure(label, code, reason, eventId) {
  const box = document.createElement('div');
  box.append(text('p', `${label}${eventId ? ` (사건 ID: ${eventId})` : ''}`, 'student-error'));
  const list = document.createElement('dl');
  list.append(row('오류 코드', code), row('이유', reason));
  box.append(list, text('p', RECORD_KEPT, 'student-retry'));
  return box;
}

function idTextList(items) {
  const list = document.createElement('ul');
  for (const item of items) list.append(text('li', `${rawOf(item.id)} — ${secretSafe(item.text)}`));
  return list;
}

// 선택한 기록과 맞지 않는 설명은 null 이유와 함께 거절한다. 없는 근거 ID는 만들어 맞추지 않는다.
function explanationProblem(event, x) {
  if (!x || typeof x !== 'object') return 'AI 설명 내용이 없습니다.';
  if (x.executed !== false) return '조치를 이미 실행했다고 답했거나 실행 여부를 확인할 수 없는 설명은 쓸 수 없습니다.';
  if (x.requiresHumanConfirmation !== true) return '사람 확인이 필요하다는 표시가 없는 설명은 쓸 수 없습니다.';
  if (typeof x.summary !== 'string' || !x.summary.trim()) return 'AI 요약이 비어 있습니다.';
  const known = new Set(event.evidence.map((e) => e.id));
  const refs = (ids) => Array.isArray(ids) && ids.length > 0 && ids.every((id) => known.has(id));
  if (!refs(x.evidenceIds)) return '근거가 맞지 않음: 인용한 근거 ID가 이 기록의 근거(evidence)에 없습니다.';
  if (!Array.isArray(x.proposals)) return '조치 제안 형식을 확인할 수 없습니다.';
  for (const p of x.proposals) {
    if (!p || typeof p.action !== 'string' || typeof p.reason !== 'string' || !refs(p.evidenceIds)) {
      return '근거가 맞지 않음: 조치 제안의 근거 ID가 이 기록의 근거(evidence)에 없습니다.';
    }
  }
  return null;
}

function buildExplanation(event, x, checkedAt) {
  const box = document.createElement('div');
  box.append(text('p', '[설명 수신] AI 설명(참고용) — 사실 판단은 아래 근거 글과 연동 시스템이 알려 준 상태를 기준으로 하세요.', 'student-explanation-ok'));
  const head = document.createElement('dl');
  head.append(row('사건 ID', event.id), row('AI 요약(참고용)', secretSafe(x.summary)), row('설명 시각', `${rawOf(checkedAt)} · ${koreanTime(checkedAt)}`));
  box.append(head);

  const evidenceById = new Map(event.evidence.map((e) => [e.id, e]));
  box.append(text('h4', '인용한 근거'));
  box.append(idTextList(x.evidenceIds.map((id) => evidenceById.get(id))));
  box.append(text('h4', '규칙(rules)'));
  box.append(event.rules.length === 0 ? text('p', '규칙: 없음') : idTextList(event.rules));

  box.append(text('h4', '확인 불가 상태'));
  const unknown = STATE_KEYS.filter(([key]) => event.state && event.state[key] === 'unknown');
  if (unknown.length === 0) {
    box.append(text('p', '없음'));
  } else {
    const list = document.createElement('ul');
    for (const [, name] of unknown) list.append(text('li', `${name}: 확인 불가(unknown)`));
    box.append(list, text('p', '확인 불가(unknown)는 정상이나 안전이 아닙니다. 연동 시스템이 현재 상태를 알려 주지 않은 것입니다.', 'student-scope'));
  }

  box.append(text('h4', '조치 제안'));
  if (x.proposals.length === 0) {
    const none = event.supportedActions.length === 0
      ? '연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상).'
      : 'AI가 이 기록에 맞는 조치를 제안하지 않았습니다.';
    box.append(text('p', none));
  } else {
    const list = document.createElement('ul');
    for (const p of x.proposals) {
      list.append(text('li', `${rawOf(p.action)} — 이유: ${secretSafe(p.reason)} (근거 ${p.evidenceIds.join(', ')}) — 사람 확인이 필요하며 실행되지 않았습니다.`));
    }
    box.append(list);
  }
  box.append(text('p', '이 설명과 제안만으로 보안 조치는 실행되지 않습니다.', 'student-scope'));
  return box;
}

function renderExplanation({ event, explanation, checkedAt } = {}) {
  // 매번 새 DOM을 반환하므로 다른 기록 선택·새로고침·실패 뒤 이전 설명과 성공 속성이 남지 않는다.
  const root = document.createElement('div');
  root.className = 'student-explanation';
  const status = explanation && explanation.status;
  const modeLabel = explanation && Object.hasOwn(MODE_LABELS, explanation.mode) ? MODE_LABELS[explanation.mode] : null;
  if (modeLabel) root.append(text('p', `연결 모드: ${modeLabel}`, 'student-mode'));
  const eventId = event && typeof event.id === 'string' && event.id ? event.id : null;
  const usable = eventId && Array.isArray(event.evidence) && Array.isArray(event.rules) && Array.isArray(event.supportedActions);

  if (status === 'error') {
    // event가 null이어도 안전한 code·message와 실패 이유를 먼저 보여 준다.
    const code = safeCode(explanation.error && explanation.error.code);
    const reason = EXPLANATION_REASONS[code] || aiErrorGroup(code).guide.replace('다시 점검하세요', '다시 요청하세요');
    root.append(explanationFailure('[설명 실패] AI 설명 실패', code, `${reason} (안내: ${safeValue(explanation.error && explanation.error.message)})`, eventId));
  } else if (status === 'loading') {
    root.append(text('p', `[설명 요청 중] AI 사건 설명 요청 중${eventId ? ` (사건 ID: ${eventId})` : ''}`, 'student-loading'));
  } else if (!usable) {
    root.append(text('p', '[기록 선택 필요] 보안 기록에서 기록을 먼저 고르세요.', 'student-idle'));
  } else if (status === 'idle' || status == null) {
    root.append(text('p', `[요청 전] 사건 ${eventId}의 AI 설명을 아직 요청하지 않았습니다. 보안 기록에서 「AI 설명 요청」 버튼을 직접 누르세요.`, 'student-idle'));
  } else if (status === 'ok') {
    const problem = explanationProblem(event, explanation.data);
    if (problem) {
      // 근거 불일치 등은 내용을 보여 주지 않고 성공 표식도 붙이지 않는다.
      root.append(explanationFailure('[설명 사용 불가] AI 설명을 쓸 수 없습니다', 'ON_AI_INVALID_OUTPUT', problem, eventId));
    } else {
      root.setAttribute('data-student-explanation-event', eventId);
      root.append(buildExplanation(event, explanation.data, checkedAt));
    }
  } else {
    root.append(text('p', '[확인 불가] AI 설명 결과를 확인할 수 없습니다. 기록은 그대로입니다.', 'student-error'));
  }
  return root;
}

// 이 함수는 조치를 실행하거나 요청하지 않는다. 사람 확인·집행·재조회는 제공 화면의 버튼이 하고,
// 여기서는 받은 상태만 다시 그린다. 서버 접수(ACK)는 효과가 아니므로 효과 확인은 관측값으로만 판단한다.
const ACTION_HEADLINES = {
  idle: '[미실행] 아직 미실행(idle) — 조치가 준비되지도 전달되지도 않았습니다.',
  prepared: '[준비됨] 준비됨·미실행(prepared) — 사람 확인 전이며 서버에 전달하지 않았습니다.',
  executing: '[전달 중] 서버에 전달 중(executing) — 결과가 아직 확인되지 않았습니다.',
  pending: '[접수·처리 중] 서버 접수·처리 중(pending) — 서버가 요청을 받았다는 응답(ACK)은 효과 적용이 아니며, 결과가 아직 확인되지 않았습니다.',
  denied: '[거절] 연동 시스템이 거절함(denied) — 조치가 적용되지 않았습니다.',
  failed: '[실패] 연동 시스템 처리 실패(failed) — 효과가 확인되지 않았습니다.',
  unknown: '[결과 불명] 결과 불명(unknown) — 성공으로도, 효과 없음으로도 판단할 수 없습니다.',
  expired: '[기한 지남] 확인 기한 지남(expired) — 이번 준비로는 집행할 수 없습니다.',
  error: '[요청 처리 안 됨] 요청이 처리되지 않음(error)',
};
const ACTION_GUIDES = {
  idle: '조치 준비 버튼이 보이지 않는다면, 연동 시스템이 지원하는 조치가 없어(supportedActions 비어 있음) 실제 처리 경로가 열리지 않은 것이며 정상입니다. 이 화면에는 버튼이 없습니다.',
  prepared: '아래 사건·대상·확인 기한을 읽은 뒤, 집행하려면 제공 화면의 「대상과 조치를 확인했으며 집행합니다」 버튼을 직접 누르세요.',
  unknown: '이미 전달된 조치의 효과가 없다고 판단하지 마세요. 제공 화면의 「원천 결과만 재조회」 버튼을 직접 눌러 결과만 다시 조회하세요. 자동으로 다시 조회하지 않습니다.',
  expired: '확인 기한이 지났습니다. 기록의 AI 제안에서 「조치 준비」를 다시 눌러 대상을 새로 확인하세요.',
  pending: '결과는 제공 화면의 「원천 결과만 재조회」 버튼을 직접 눌러 조회하세요. 자동으로 다시 조회하지 않습니다.',
};
const ACTION_BOUND_STATUSES = ['prepared', 'executing', 'pending', 'succeeded', 'denied', 'failed', 'unknown'];

function presentRow(list, name, value) {
  if (typeof value === 'number' && Number.isFinite(value)) value = String(value);
  if (typeof value === 'string' && value) list.append(row(name, secretSafe(value)));
}

function renderAction({ status, event, actionId, target, receipt, observation, message, confirmationExpiresAt, error } = {}) {
  // 매번 새 DOM을 반환하므로 새 입력이 오면 이전 대상·요청·결과와 data-* 속성이 남지 않는다.
  const root = document.createElement('div');
  root.className = 'student-action';
  const eventId = event && typeof event.id === 'string' && event.id ? event.id : null;
  const rcpt = receipt && typeof receipt === 'object' ? receipt : null;
  const requestId = rcpt && typeof rcpt.requestId === 'string' && rcpt.requestId ? rcpt.requestId : null;
  const tgt = target && typeof target === 'object' ? target : null;

  // 받은 영수증이 현재 사건·조치와 다르면 현재 조치의 결과로 쓰지 않는다.
  const mismatch = !!rcpt && ((typeof rcpt.eventId === 'string' && rcpt.eventId !== eventId) || (typeof rcpt.actionId === 'string' && rcpt.actionId !== actionId));
  const effectConfirmed = status === 'succeeded' && !mismatch && !!rcpt && typeof rcpt.receiptId === 'string' && !!rcpt.receiptId
    && !!observation && typeof observation === 'object' && observation.effectApplied === true && typeof observation.observedAt === 'string' && !!observation.observedAt;

  let shown = Object.hasOwn(ACTION_HEADLINES, status) || status === 'succeeded' || status === 'loading' ? status : 'invalid';
  if (shown === 'succeeded' && !effectConfirmed) shown = 'unknown';
  if (mismatch && shown !== 'idle' && shown !== 'error' && shown !== 'expired') shown = 'unknown';

  let headline;
  if (shown === 'succeeded') headline = '[효과 확인] 효과 확인(succeeded) — 연동 시스템이 효과 적용을 관측했습니다.';
  else if (shown === 'loading') headline = rcpt ? '[조회 중] 결과 조회 중(loading) — 연동 시스템 결과를 다시 확인하고 있으며 결과가 아직 확인되지 않았습니다.' : '[준비 중] 조치 준비 중(loading) — 미실행이며 서버에 전달하지 않았습니다.';
  else if (shown === 'invalid') headline = '[확인 불가] 조치 상태를 확인할 수 없습니다. 성공으로 보지 마세요.';
  else headline = ACTION_HEADLINES[shown];
  const lead = text('p', headline, shown === 'succeeded' ? 'student-action-observed' : shown === 'error' || shown === 'failed' || shown === 'denied' || shown === 'invalid' ? 'student-error' : 'student-action-status');
  root.append(lead);

  if (mismatch && shown === 'unknown' && status !== 'unknown') {
    root.append(text('p', '받은 결과의 사건 ID 또는 조치가 현재 화면의 사건·조치와 맞지 않아 현재 조치의 결과로 쓰지 않았습니다.', 'student-error'));
  } else if (status === 'succeeded' && shown === 'unknown') {
    root.append(text('p', '서버가 succeeded를 보고했지만 observation.effectApplied: true 관측과 영수증 ID가 확인되지 않아 효과 확인으로 표시하지 않습니다.', 'student-error'));
  }

  const list = document.createElement('dl');
  if (shown !== 'invalid') {
    presentRow(list, '사건 ID', eventId);
    if (event && Array.isArray(event.evidence)) {
      presentRow(list, '근거 ID', event.evidence.map((e) => (e && typeof e.id === 'string' ? e.id : '')).filter(Boolean).join(', '));
    }
    presentRow(list, '조치(actionId)', typeof actionId === 'string' ? actionId : null);
    presentRow(list, '실제 대상(target.id)', tgt && tgt.id);
    presentRow(list, '대상 세대(generation)', tgt && tgt.generation);
    presentRow(list, '요청 ID(requestId)', requestId);
    if (rcpt && !mismatch) {
      presentRow(list, '영수증 ID(receiptId)', rcpt.receiptId);
      presentRow(list, '버전(version)', rcpt.version);
      if (rcpt.replayed === true) presentRow(list, '재응답(replayed)', 'true — 이미 접수된 요청에 대한 응답이며 새 요청이 아닙니다.');
    }
    if (shown === 'prepared' || shown === 'executing' || shown === 'expired') presentRow(list, '사람 확인 기한', confirmationExpiresAt);
    if (shown === 'succeeded') {
      presentRow(list, '관측 시각(observedAt)', `${observation.observedAt} · ${koreanTime(observation.observedAt)}`);
      presentRow(list, '실제 효과(effectApplied)', 'effectApplied: true');
    }
  }
  if (list.children.length > 0) root.append(list);

  if (shown === 'error' || shown === 'expired') {
    const code = safeCode(error && error.code);
    if (error) {
      const errList = document.createElement('dl');
      errList.append(row('오류 코드', code), row('안내', safeValue(error.message)));
      root.append(errList);
    }
  }
  if ((shown === 'denied' || shown === 'failed' || shown === 'idle') && typeof message === 'string' && message) {
    root.append(text('p', `안내: ${secretSafe(message)}`));
  }
  if (ACTION_GUIDES[shown]) root.append(text('p', ACTION_GUIDES[shown], 'student-retry'));
  root.append(text('p', '이 화면은 조치를 실행하지 않고 상태만 보여 줍니다. 「조치 화면 취소」는 화면을 닫는 것이며 이미 서버에 전달된 조치의 효과를 되돌리지 않습니다.', 'student-scope'));

  // 현재 사건·요청에 묶인 상태에서만 표식을 붙인다. 표식만으로 효과가 확인됐다는 뜻은 아니다.
  if (eventId && requestId && !mismatch && ACTION_BOUND_STATUSES.includes(shown)) {
    root.setAttribute('data-student-action-event', eventId);
    root.setAttribute('data-student-action-request', requestId);
  }
  return root;
}

// OSV는 알려진 취약점 데이터베이스다. 조회 결과가 없다는 것이 안전하다는 뜻은 아니므로,
// 조회 실패·미조회·확인 불가를 "취약점 없음"으로 바꾸지 않고 이미 받은 취약점 ID는 지우지 않는다.
const VULN_SCAN_LABELS = {
  complete: '모두 조회(complete) — 승인된 공개 패키지를 모두 조회했습니다.',
  partial: '일부 조회 실패(partial) — 일부 패키지의 조회가 확인되지 않았습니다. 그 패키지는 취약점 없음이 아닙니다.',
  not_checked: '아직 조회 안 함(not_checked) — 승인된 공개 조회 대상이 없어 조회하지 않았습니다. 취약점 없음이 아닙니다.',
  not_configured: '조회 준비 미완료(not_configured) — 조회 대상 프로젝트 설정이 필요합니다. 설정은 운영자가 준비하며 취약점 없음이 아닙니다.',
  unverifiable: 'lock 파일 확인 불가(unverifiable) — 설치된 패키지 목록을 확인할 수 없어 조회하지 않았습니다. 취약점 없음이 아닙니다.',
};
const VULN_PACKAGE_LABELS = {
  known_vulnerabilities: '알려진 항목 있음(known_vulnerabilities)',
  none_found: '알려진 항목 없음(none_found) — 조회 범위·조회 시점 기준이며 안전 보장이 아닙니다.',
  unverifiable: '조회 확인 불가(unverifiable) — 취약점 없음이 아닙니다.',
};
const VULN_ERROR_GUIDES = {
  CANCELLED: '패키지 조회를 취소했습니다. 이전 결과는 현재 확인 결과가 아닙니다.',
  REQUEST_CANCELLED: '패키지 조회를 취소했습니다. 이전 결과는 현재 확인 결과가 아닙니다.',
  TIMEOUT: '조회 응답이 늦어 중단했습니다. 잠시 뒤 직접 다시 조회하세요.',
  REQUEST_TIMEOUT: '조회 응답이 늦어 중단했습니다. 잠시 뒤 직접 다시 조회하세요.',
  SERVICE_UNAVAILABLE: '조회를 지금 처리할 수 없습니다. 잠시 뒤 직접 다시 조회하세요.',
  CONTRACT_MISMATCH: '응답 형식을 확인할 수 없어 결과를 표시하지 않습니다.',
};
const VULN_RETRY = '자동으로 다시 조회하지 않습니다. 제공 화면의 「설치 패키지 조회」 버튼을 직접 누르세요.';
const VULN_CAVEAT = 'OSV는 알려진 취약점 데이터베이스입니다. 조회 결과가 없다는 사실만으로 패키지나 앱 전체가 안전하다고 보장할 수 없습니다.';
// 범위 표기(^1.2.0, ~1.2, >=1, *, x)는 설치 버전이 아니므로 정확한 버전으로 표시하지 않는다.
const EXACT_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function vulnTime(value) {
  return typeof value === 'string' && value ? `${secretSafe(value)} · ${koreanTime(value)}` : '없음';
}

function vulnHeader(value) {
  const cell = text('th', value);
  cell.setAttribute('scope', 'col');
  return cell;
}

function findingCell(pkg) {
  const cell = document.createElement('td');
  const findings = Array.isArray(pkg.vulnerabilities) ? pkg.vulnerabilities : [];
  if (findings.length > 0) {
    const list = document.createElement('ul');
    for (const f of findings) list.append(text('li', `${secretSafe(f && f.id)} · 수정 시각(modified): ${vulnTime(f && f.modified)}`));
    cell.append(list);
    // 확인 불가 패키지의 받은 ID는 지우지 않고, 전체 조회는 확인되지 않았음을 함께 알린다.
    if (pkg.status === 'unverifiable') cell.append(text('p', '일부 확인 · 전체 조회 확인 불가 — 위 항목은 받은 것만이며 이것이 전부라고 볼 수 없습니다.'));
  } else if (pkg.status === 'unverifiable') {
    cell.textContent = '받은 항목 없음 · 조회 확인 불가(취약점 없음이 아님)';
  } else if (pkg.status === 'none_found') {
    cell.textContent = '알려진 항목 없음(조회 범위 기준)';
  } else {
    cell.textContent = '항목 확인 불가';
  }
  return cell;
}

function packageRow(pkg) {
  const tr = document.createElement('tr');
  const name = pkg && typeof pkg.name === 'string' ? pkg.name : '';
  const exact = pkg && typeof pkg.version === 'string' && EXACT_VERSION.test(pkg.version);
  const known = pkg && Object.hasOwn(VULN_PACKAGE_LABELS, pkg.status);
  if (name && exact) {
    tr.setAttribute('data-student-package-name', name);
    tr.setAttribute('data-student-package-version', pkg.version);
  }
  tr.append(
    text('td', secretSafe(name)),
    text('td', exact ? pkg.version : '버전 확인 불가(정확한 설치 버전이 아님)'),
    text('td', known ? VULN_PACKAGE_LABELS[pkg.status] : '조회 확인 불가'),
  );
  tr.append(findingCell(known ? pkg : { ...pkg, status: 'unverifiable' }));
  tr.append(text('td', pkg && pkg.source ? secretSafe(pkg.source) : '없음'), text('td', vulnTime(pkg && pkg.checkedAt)));
  return tr;
}

function packageTable(packages) {
  const table = document.createElement('table');
  const head = document.createElement('tr');
  for (const label of ['패키지', '설치 버전(package-lock.json)', '조회 상태', '알려진 취약점 id · 수정 시각', '출처', '패키지 조회 시각']) head.append(vulnHeader(label));
  const thead = document.createElement('thead');
  thead.append(head);
  const tbody = document.createElement('tbody');
  for (const pkg of packages) tbody.append(packageRow(pkg));
  table.append(thead, tbody);
  return table;
}

function renderVulnerabilities({ status, mode, data, error } = {}) {
  // 매번 새 DOM을 반환하므로 조회 중·오류·취소·다시 조회 뒤에 이전 표가 현재 결과처럼 남지 않는다.
  const root = document.createElement('div');
  root.className = 'student-vulnerabilities';
  const modeLabel = Object.hasOwn(MODE_LABELS, mode) ? MODE_LABELS[mode] : null;
  if (modeLabel) root.append(text('p', `연결 모드: ${modeLabel}`, 'student-mode'));

  if (status === 'idle' || status == null) {
    root.append(text('p', '[조회 전] 조회 전 — 아직 설치 패키지를 조회하지 않았습니다. 제공 화면의 「설치 패키지 조회」 버튼을 직접 누르세요.', 'student-idle'));
  } else if (status === 'loading') {
    root.append(text('p', '[조회 중] 조회 중 — 이전 결과는 표시하지 않습니다. 필요하면 제공 화면의 「패키지 조회 취소」를 누르세요.', 'student-loading'));
  } else if (status === 'error') {
    const code = safeCode(error && error.code);
    root.append(text('p', `[조회 실패] 조회 실패: ${safeValue(error && error.message)}`, 'student-error'));
    const list = document.createElement('dl');
    list.append(row('오류 코드', code));
    if (Object.hasOwn(VULN_ERROR_GUIDES, code)) list.append(row('안내', VULN_ERROR_GUIDES[code]));
    root.append(list, text('p', '이 결과는 취약점 없음이 아니며, 이전 조회 결과를 현재 결과로 보지 않습니다.', 'student-error'), text('p', VULN_RETRY, 'student-retry'));
  } else if (status === 'ok' && data && typeof data === 'object' && Object.hasOwn(VULN_SCAN_LABELS, data.status)) {
    root.append(text('p', `[${data.status}] ${VULN_SCAN_LABELS[data.status]}`, data.status === 'complete' ? 'student-ok' : 'student-error'));
    const list = document.createElement('dl');
    // 잠금 파일 값은 서버가 보낸 경우에만 보여 준다. 없는 값을 만들어 채우지 않는다.
    if (data.code) list.append(row('코드', secretSafe(data.code)));
    if (data.lockfileVersion != null) list.append(row('잠금 파일 버전(lockfileVersion)', String(data.lockfileVersion)));
    if (data.lockfileHash) list.append(row('잠금 파일 해시(lockfileHash)', secretSafe(data.lockfileHash)));
    if (data.excluded && Number.isInteger(data.excluded.count)) list.append(row('조회 제외', `${data.excluded.count}건 (승인되지 않았거나 지원하지 않아 조회하지 않음)`));
    list.append(row('조회 시각(checkedAt)', vulnTime(data.checkedAt)));
    root.append(list);
    const packages = Array.isArray(data.packages) ? data.packages : [];
    if (packages.length > 0) {
      const count = (s) => packages.filter((p) => p && p.status === s).length;
      root.append(text('p', `패키지 ${packages.length}개 · 알려진 항목 있음 ${count('known_vulnerabilities')}개 · 알려진 항목 없음 ${count('none_found')}개 · 조회 확인 불가 ${count('unverifiable')}개`, 'student-count'));
      root.append(packageTable(packages));
    } else if (data.status === 'complete') {
      root.append(text('p', '표시할 패키지 조회 결과가 없습니다. 이것은 취약점이 없다는 뜻이 아닙니다.', 'student-empty'));
    }
    root.append(text('p', VULN_CAVEAT, 'student-scope'), text('p', VULN_RETRY, 'student-retry'));
  } else {
    root.append(text('p', '[확인 불가] 조회 결과를 확인할 수 없어 표시하지 않습니다. 취약점 없음이 아닙니다.', 'student-error'), text('p', VULN_RETRY, 'student-retry'));
  }
  return root;
}

// ---------- 4일차: 핵심 3가지 패널 — PC 상태 실측 · 네트워크·방화벽·Windows 기록 · 다시 조회와 오류 안내 ----------
// 브라우저는 PC를 직접 읽을 수 없어 앱 서버의 GET /api/pc-snapshot을 읽는다. 이 경로는 제공 서버(src/server.mjs)를
// 고쳐야 열리는데 안내 규칙에 따라 제출 버전에서는 서버를 고치지 않아 연결하지 않았다(ceda9c2에는 있었음). 그래서 404면
// 값을 짐작하거나 예시로 채우지 않고 '확인 불가'와 이유, 다음에 할 일을 보여 준다. 자동으로 조회하지 않고 버튼을 누를 때만 조회한다. 화면에는 예시 값을 두지 않는다.
const PC_TAG = '[실제 측정]';
const PC_TIMEOUT_MS = 12000;
const PC_ACCESS_HINT = /UnauthorizedAccess|AccessDenied|ACCESS_DENIED|Access is denied|SecurityException|PermissionDenied/i;
const PC_ADAPTER_STATUS = { Up: '연결됨', Disconnected: '끊김', Disabled: '사용 안 함', NotPresent: '장치 없음' };
const PC_CATEGORY = { Public: '공용 네트워크', Private: '개인 네트워크', DomainAuthenticated: '도메인 인증됨' };
const PC_CONNECTIVITY = { Internet: '인터넷 연결', LocalNetwork: '로컬 네트워크만', NoTraffic: '트래픽 없음', Disconnected: '연결 안 됨' };
const PC_ENABLED = { True: '켜짐', False: '꺼짐', NotConfigured: '설정 안 됨' };
const pcState = { phase: 'idle', outcome: null, sample: null, pc: null, sdp: null, failures: [], finishedAt: null, refocus: false, currentEntry: null, reasons: null, count: 0 };
let pcRerender = null;

const pcList = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const pcNum = (v) => typeof v === 'number' && Number.isFinite(v);
const pcGiB = (bytes) => (bytes / 2 ** 30).toFixed(2);
const pcMapped = (table, value) => (Object.hasOwn(table, value) ? `${table[value]}(${value})` : `확인 불가(${safeValue(value)})`);
const pcKst = (iso) => `${secretSafe(iso)} (UTC) · ${koreanTime(iso)}`;

async function pcFetchJson(path) {
  if (typeof fetch !== 'function') return { ok: false, kind: 'network' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PC_TIMEOUT_MS);
  try {
    const response = await fetch(path, { method: 'GET', cache: 'no-store', headers: { accept: 'application/json' }, signal: controller.signal });
    let json = null;
    try { json = await response.json(); } catch { json = null; }
    return { ok: true, status: response.status, json };
  } catch {
    return { ok: false, kind: controller.signal.aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

function pcNext(kind) {
  if (kind === 'unsupported') return '이 앱의 PC 읽기 경로(/api/pc-snapshot)는 제공 서버를 고쳐야 열립니다. 안내 규칙에 따라 서버를 고치지 않아 연결하지 않았습니다. PowerShell에서 node student\\pc-status.mjs 와 node student\\pc-security-status.mjs 로 같은 항목을 확인할 수 있습니다.';
  if (kind === 'host') return '주소창이 http://127.0.0.1:포트/ 또는 http://localhost:포트/ 인지 확인한 뒤 「다시 조회」를 누르세요.';
  if (kind === 'timeout' || kind === 'network') return '앱 서버가 켜져 있는지 확인한 뒤 「다시 조회」를 누르세요.';
  if (kind === 'denied') return '관리자 권한이 필요한 항목일 수 있습니다. 바꾸려 하지 않았으니 담당자에게 확인하세요.';
  return '잠시 뒤 「다시 조회」를 누르세요. 계속되면 PowerShell에서 node student\\pc-security-status.mjs 로 같은 항목을 확인하세요.';
}

// 서버 경로 응답을 해석한다. 실패하면 { kind, reason }, 성공하면 { data }.
function pcInterpretRoute(res) {
  if (!res.ok) return { kind: res.kind, reason: res.kind === 'timeout' ? `${PC_TIMEOUT_MS / 1000}초 안에 응답이 없습니다` : '앱 서버에 연결하지 못했습니다' };
  const json = res.json && typeof res.json === 'object' ? res.json : null;
  const code = json && json.error && typeof json.error.code === 'string' ? json.error.code : null;
  if (res.status === 404 || res.status === 501 || code === 'PC_SNAPSHOT_UNSUPPORTED') return { kind: 'unsupported', reason: `제공 서버를 고치지 않아 PC 읽기 경로를 연결하지 않았습니다(HTTP ${res.status})` };
  if (res.status === 403) return { kind: 'host', reason: `앱 서버가 이 주소에서 온 요청을 거절했습니다(${safeCode(code)})` };
  if (res.status !== 200 || !json || json.ok !== true) return { kind: 'service', reason: `앱 서버가 조회를 처리하지 못했습니다(HTTP ${res.status}, ${safeCode(code)})` };
  const data = json.data;
  const metric = (m) => !!m && typeof m === 'object' && (m.status === 'ok' || m.status === 'unavailable');
  const valid = !!data && !!data.sample && !!data.pc
    && ['cpu', 'memory', 'disk'].every((k) => metric(data.sample[k])) && ['network', 'firewall', 'events'].every((k) => metric(data.pc[k]));
  return valid ? { data } : { kind: 'service', reason: '앱 서버 응답의 형식이 예상과 달라 표시하지 않습니다' };
}

function pcInterpretSdp(res) {
  if (!res.ok) return { state: 'unavailable', reason: res.kind === 'timeout' ? `${PC_TIMEOUT_MS / 1000}초 안에 응답이 없습니다` : '앱 서버에 연결하지 못했습니다' };
  const engine = res.status === 200 && res.json && res.json.ok === true && res.json.data && res.json.data.engine;
  if (!engine || typeof engine.mode !== 'string' || typeof engine.code !== 'string') return { state: 'unavailable', reason: `앱의 진단 응답 형식이 예상과 다릅니다(HTTP ${res.status})` };
  if (engine.mode === 'disconnected') return { state: 'disconnected', code: safeValue(engine.code) };
  if (engine.mode === 'demo') return { state: 'demo', code: safeValue(engine.code) };
  if (engine.mode === 'connected') return { state: 'configured', code: safeValue(engine.code) };
  return { state: 'unavailable', reason: `알 수 없는 엔진 상태입니다(${safeValue(engine.mode)})` };
}

function pcCollectFailures(route, sdp) {
  const out = [];
  if (route.kind) {
    out.push({ item: 'PC 상태 실측(CPU·메모리·디스크)', reason: route.reason, next: pcNext(route.kind) });
    out.push({ item: '네트워크·방화벽·Windows 기록', reason: route.reason, next: pcNext(route.kind) });
  } else {
    const { sample, pc } = route.data;
    const nextFor = (reason) => pcNext(PC_ACCESS_HINT.test(String(reason)) ? 'denied' : 'tool');
    for (const [m, label] of [[sample.cpu, 'CPU 사용률'], [sample.memory, '메모리'], [sample.disk, '디스크'], [pc.network, '네트워크 구성'], [pc.firewall, '방화벽 설정'], [pc.events, 'Windows 기록 건수']]) {
      if (m.status === 'unavailable') out.push({ item: label, reason: safeValue(m.reason), next: nextFor(m.reason) });
    }
    if (pc.events.status === 'ok') {
      for (const e of pcList(pc.events.entries)) {
        if (e && !pcNum(e.cnt) && e.error) out.push({ item: `Windows 기록 ${safeValue(e.log)} ${e.level === 2 ? '오류' : '경고'} 건수`, reason: safeValue(e.error), next: nextFor(e.error) });
      }
    }
  }
  if (sdp.state === 'unavailable') out.push({ item: '앱의 SDP 연결 상태', reason: sdp.reason, next: pcNext('network') });
  return out;
}

async function startPcLookup() {
  if (pcState.phase === 'loading') return; // 조회 중에 다시 눌러도 요청은 한 번만 나간다
  Object.assign(pcState, { phase: 'loading', outcome: null, sample: null, pc: null, sdp: null, failures: [], currentEntry: null, reasons: null });
  pcHistory.flash = null;
  if (pcRerender) pcRerender();
  let route;
  let sdp;
  try {
    [route, sdp] = await Promise.all([pcFetchJson('/api/pc-snapshot').then(pcInterpretRoute), pcFetchJson('/api/diagnostics').then(pcInterpretSdp)]);
  } catch {
    route = { kind: 'service', reason: '조회 결과를 처리하는 중 오류가 났습니다' };
    sdp = { state: 'unavailable', reason: '조회 결과를 처리하는 중 오류가 났습니다' };
  }
  const failures = pcCollectFailures(route, sdp);
  const finishedAt = new Date().toISOString();
  const outcome = route.kind ? 'failed' : failures.length > 0 ? 'partial' : 'ok';
  // 기록의 결과는 PC 조회 항목만 따진다(SDP 상태를 못 읽은 것은 PC 값의 결과가 아니다).
  const pcOutcome = route.kind ? 'failed' : failures.some((f) => f.item !== PC_SDP_ITEM) ? 'partial' : 'ok';
  pcLoadHistory();
  const entry = pcEntryFrom(route, pcOutcome, finishedAt);
  pcHistory.entries.push(entry);
  if (pcHistory.entries.length > PC_HISTORY_MAX) pcHistory.entries.splice(0, pcHistory.entries.length - PC_HISTORY_MAX);
  pcSaveHistory();
  Object.assign(pcState, {
    phase: 'done', finishedAt, sdp, failures, outcome, currentEntry: entry, reasons: pcReasons(route), count: pcState.count + 1,
    sample: route.data ? route.data.sample : null, pc: route.data ? route.data.pc : null,
  });
  if (pcRerender) pcRerender();
}

function pcButton() {
  const busy = pcState.phase === 'loading';
  const button = text('button', busy ? '조회 중…' : pcState.phase === 'idle' ? 'PC 상태 조회' : '다시 조회', 'btn');
  button.type = 'button';
  button.setAttribute('data-student-pc-refresh', '');
  if (busy) { button.setAttribute('aria-disabled', 'true'); button.setAttribute('aria-busy', 'true'); }
  button.addEventListener('click', () => { pcState.refocus = true; startPcLookup(); });
  return button;
}

function buildPcMeasured(sample) {
  const box = document.createElement('section');
  box.append(text('h4', '① PC 상태 실측 (CPU·메모리·디스크)'));
  const list = document.createElement('ul');
  const { cpu, memory, disk } = sample;
  const hidden = '확인 불가 — 아래 「조회하지 못한 항목」 참고';
  list.append(text('li', cpu.status === 'ok' && pcNum(cpu.percent)
    ? `${PC_TAG} CPU 사용률: ${cpu.percent.toFixed(1)} % (${safeValue(cpu.windowMs)} ms 구간 평균, 논리 코어 ${safeValue(cpu.logicalCores)}개)` : `${PC_TAG} CPU 사용률: ${hidden}`));
  list.append(text('li', memory.status === 'ok' && pcNum(memory.totalBytes) && pcNum(memory.freeBytes)
    ? `${PC_TAG} 메모리: 전체 ${pcGiB(memory.totalBytes)} GiB · 여유 ${pcGiB(memory.freeBytes)} GiB · 사용량 ${pcGiB(memory.totalBytes - memory.freeBytes)} GiB(전체−여유로 계산)` : `${PC_TAG} 메모리: ${hidden}`));
  list.append(text('li', disk.status === 'ok' && pcNum(disk.totalBytes) && pcNum(disk.freeBytes)
    ? `${PC_TAG} 디스크 ${safeValue(disk.path)}: 전체 ${pcGiB(disk.totalBytes)} GiB · 남은 공간 ${pcGiB(disk.freeBytes)} GiB` : `${PC_TAG} 디스크: ${hidden}`));
  box.append(list, text('p', `${PC_TAG} 측정 시각: ${sample.measuredAt ? pcKst(sample.measuredAt) : '확인 불가'}`));
  return box;
}

function buildPcSystem(pc) {
  const box = document.createElement('section');
  box.append(text('h4', '② 네트워크·방화벽·Windows 기록 (읽기만 함)'));
  const list = document.createElement('ul');
  const hidden = '확인 불가 — 아래 「조회하지 못한 항목」 참고';
  if (pc.network.status === 'ok') {
    const adapters = pcList(pc.network.adapters);
    const physUp = adapters.filter((a) => a && a.Status === 'Up' && a.Virtual !== true);
    const wired = physUp.filter((a) => a.MediaType === '802.3').length;
    const wireless = physUp.filter((a) => /802\.11/.test(String(a.MediaType))).length;
    const virtUp = adapters.filter((a) => a && a.Status === 'Up' && a.Virtual === true).length;
    list.append(text('li', `${PC_TAG} 네트워크: 어댑터 ${adapters.length}개 읽음 — 물리 어댑터 연결됨: 유선 ${wired}개 · 무선 ${wireless}개 · 종류 확인 불가 ${physUp.length - wired - wireless}개 / 가상 어댑터 연결됨 ${virtUp}개`));
    const profiles = pcList(pc.network.profiles);
    if (profiles.length === 0) list.append(text('li', `${PC_TAG} 연결 범주: 연결 프로필 없음(연결된 네트워크가 없을 수 있음)`));
    for (const p of profiles) list.append(text('li', `${PC_TAG} 연결 범주: ${pcMapped(PC_CATEGORY, p && p.NetworkCategory)} · IPv4 ${pcMapped(PC_CONNECTIVITY, p && p.IPv4Connectivity)} · IPv6 ${pcMapped(PC_CONNECTIVITY, p && p.IPv6Connectivity)}`));
    list.append(text('li', `${PC_TAG} 참고: IP·MAC 주소와 무선 이름(SSID)은 읽거나 표시하지 않습니다. 연결성은 Windows가 판단한 값입니다.`));
  } else {
    list.append(text('li', `${PC_TAG} 네트워크: ${hidden}`));
  }
  if (pc.firewall.status === 'ok') {
    const profiles = pcList(pc.firewall.profiles);
    list.append(text('li', profiles.length === 0 ? `${PC_TAG} 방화벽 설정: 읽은 프로필이 없습니다(확인 불가)`
      : `${PC_TAG} 방화벽 설정: ${profiles.map((p) => `${safeValue(p && p.Name)} ${Object.hasOwn(PC_ENABLED, p && p.Enabled) ? PC_ENABLED[p.Enabled] : '확인 불가'}`).join(' · ')} · 읽기만 함(바꾸지 않음)`));
    if (profiles.some((p) => p && (p.In === 'NotConfigured' || p.Out === 'NotConfigured'))) list.append(text('li', `${PC_TAG} 참고: 기본 동작이 '설정 안 됨(NotConfigured)'이면 정책으로 지정되지 않았다는 뜻이며 실제 적용되는 기본 동작을 알려 주는 값이 아닙니다.`));
  } else {
    list.append(text('li', `${PC_TAG} 방화벽 설정: ${hidden}`));
  }
  if (pc.events.status === 'ok') {
    const countText = (e) => {
      const name = e.level === 2 ? '오류' : '경고';
      return pcNum(e.cnt) ? (e.cnt >= 1000 ? `${name} 1000건 이상(조회 상한)` : `${name} ${e.cnt}건`) : `${name} 확인 불가`;
    };
    for (const log of ['System', 'Application']) {
      const entries = pcList(pc.events.entries).filter((e) => e && e.log === log).sort((a, b) => a.level - b.level);
      list.append(text('li', `${PC_TAG} Windows 기록 ${log}(최근 24시간): ${entries.length === 0 ? '확인 불가(읽은 항목 없음)' : entries.map(countText).join(' · ')}`));
    }
  } else {
    list.append(text('li', `${PC_TAG} Windows 기록: ${hidden}`));
  }
  box.append(list, text('p', '안내: Windows 경고·오류 건수는 침해나 공격 탐지 결과가 아닙니다. 드라이버·서비스·앱의 일반적인 오류와 경고도 포함됩니다.', 'student-scope'));
  return box;
}

function buildPcSdp(sdp) {
  const box = document.createElement('section');
  box.append(text('h4', '앱의 SDP 연결 상태 (PC 조회와 별개)'));
  let line;
  if (sdp.state === 'disconnected') line = `SDP 미연결 — 앱의 진단 응답이 연결 없음(${sdp.code})을 알려 줍니다.`;
  else if (sdp.state === 'demo') line = `예제 모드 — 실제 SDP가 아닙니다(${sdp.code}).`;
  else if (sdp.state === 'configured') line = `SDP 연결 설정됨(${sdp.code}) — 연결 설정이 켜졌다는 뜻이며 실제 SDP 응답이 성공했다는 확인이 아닙니다.`;
  else line = `SDP 연결 상태: 확인 불가 — 아래 「조회하지 못한 항목」 참고. 확인 불가는 '미연결'이 아닙니다.`;
  box.append(text('p', `${PC_TAG} ${line}`), text('p', '위 PC 조회 결과와 SDP 상태는 서로 다른 것을 확인한 결과이며 합치지 않습니다.', 'student-scope'));
  return box;
}

function buildPcFailures(failures) {
  const box = document.createElement('section');
  box.className = 'student-error';
  box.append(text('h4', '조회하지 못한 항목과 다음에 할 일'));
  const list = document.createElement('ul');
  for (const f of failures) list.append(text('li', `${f.item} — 이유: ${f.reason} / 다음에 할 일: ${f.next}`));
  box.append(list, text('p', '위 항목은 값을 알 수 없는 상태입니다. 예시 값이나 이전 결과로 대신 채우지 않았습니다.'));
  return box;
}

function buildPcPanel() {
  const panel = document.createElement('section');
  panel.className = 'student-pc-panel';
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-labelledby', 'student-pc-panel-title');
  const title = text('h3', '핵심 3가지: ① 내 PC 상태 · ② 네트워크·방화벽·기록 · ③ 다시 조회와 오류 안내');
  title.id = 'student-pc-panel-title';
  panel.append(title, text('p', '이 칸에는 이 PC에서 실제로 읽은 값만 나옵니다. 조회에 실패하면 예시 값이나 이전 결과 대신 실패한 항목과 다음에 할 일을 보여 줍니다.', 'student-scope'));
  panel.append(text('p', '조회는 위쪽 관제 대시보드의 「PC 상태 조회」 버튼으로 합니다. 자동으로 조회하지 않습니다.', 'student-scope'));
  if (pcState.phase === 'done') {
    if (pcState.sample) panel.append(buildPcMeasured(pcState.sample));
    if (pcState.pc) panel.append(buildPcSystem(pcState.pc));
    if (pcState.sdp) panel.append(buildPcSdp(pcState.sdp));
    if (pcState.failures.length > 0) panel.append(buildPcFailures(pcState.failures));
  }
  // 다시 그려도 키보드 초점이 사라지지 않게, 버튼에 초점이 있었거나 방금 눌렀다면 새 버튼으로 되돌린다.
  const active = document.activeElement && typeof document.activeElement.hasAttribute === 'function' ? document.activeElement : null;
  const focusAttr = (active && ['data-student-pc-clear', 'data-student-pc-refresh'].find((a) => active.hasAttribute(a)))
    || (pcState.refocus ? 'data-student-pc-refresh' : null);
  if (focusAttr) {
    pcState.refocus = false;
    queueMicrotask(() => {
      const target = typeof document.querySelector === 'function' ? document.querySelector(`[${focusAttr}]`) : null;
      if (target && typeof target.focus === 'function') target.focus();
    });
  }
  return panel;
}

// ---------- 관제 대시보드 틀: 상태 카드 4개 · CPU 막대 그래프 · 네트워크·Windows 기록 한 줄 요약 ----------
// 카드는 이번 방문에서 조회한 결과만 보여 준다(저장된 옛 값을 현재 값처럼 보이지 않게). 조회 기록은 이 브라우저의
// localStorage에 보관하며 주소(포트)별로 따로 저장된다. 좋고 나쁨을 판정하지 않고 숫자와 변화 방향만 보여 준다.
const PC_HISTORY_KEY = 'keshev-pc-dashboard-v1';
const PC_HISTORY_MAX = 10;
const PC_SDP_ITEM = '앱의 SDP 연결 상태';
const PC_FW_VALUES = ['True', 'False', 'NotConfigured'];
const pcHistory = { entries: [], loaded: false, storage: 'local', notice: null, flash: null };

function pcStore() {
  try { return typeof globalThis.localStorage === 'object' && globalThis.localStorage ? globalThis.localStorage : null; } catch { return null; }
}

const pcNullOrNum = (v, min, max) => v === null || (pcNum(v) && v >= min && v <= max);

function pcValidEntry(e) {
  if (!e || typeof e !== 'object' || e.v !== 1) return false;
  if (typeof e.at !== 'string' || !Number.isFinite(Date.parse(e.at)) || !['ok', 'partial', 'failed'].includes(e.outcome)) return false;
  if (!pcNullOrNum(e.cpu, 0, 100)) return false;
  for (const k of ['memTotal', 'memFree', 'diskTotal', 'diskFree']) if (!pcNullOrNum(e[k], 0, 2 ** 60)) return false;
  if (e.memTotal !== null && e.memFree !== null && e.memFree > e.memTotal) return false;
  if (e.diskTotal !== null && e.diskFree !== null && e.diskFree > e.diskTotal) return false;
  if (!(e.diskPath === null || (typeof e.diskPath === 'string' && e.diskPath.length <= 16))) return false;
  return e.fw === null || (Array.isArray(e.fw) && e.fw.length <= 6
    && e.fw.every((p) => Array.isArray(p) && p.length === 2 && typeof p[0] === 'string' && p[0].length <= 20 && PC_FW_VALUES.includes(p[1])));
}

function pcLoadHistory() {
  if (pcHistory.loaded) return;
  pcHistory.loaded = true;
  const store = pcStore();
  if (!store) {
    pcHistory.storage = 'memory';
    pcHistory.notice = '이 브라우저에서는 기록을 저장할 수 없어(localStorage를 쓸 수 없음) 이번 방문 동안만 보관합니다.';
    return;
  }
  try {
    const raw = store.getItem(PC_HISTORY_KEY);
    if (raw === null || raw === undefined) return;
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    const valid = list.filter(pcValidEntry);
    pcHistory.entries = valid.slice(-PC_HISTORY_MAX);
    if (!Array.isArray(parsed) || valid.length !== list.length) pcHistory.notice = '저장된 기록 중 읽을 수 없는 항목은 버렸습니다.';
  } catch {
    pcHistory.entries = [];
    pcHistory.notice = '저장된 기록을 읽지 못해(형식 오류) 비웠습니다.';
  }
}

function pcSaveHistory() {
  const store = pcStore();
  if (!store) {
    pcHistory.storage = 'memory';
    pcHistory.notice = '이 브라우저에서는 기록을 저장할 수 없어(localStorage를 쓸 수 없음) 이번 방문 동안만 보관합니다.';
    return;
  }
  try {
    store.setItem(PC_HISTORY_KEY, JSON.stringify(pcHistory.entries));
    pcHistory.storage = 'local';
  } catch (e) {
    pcHistory.storage = 'memory';
    pcHistory.notice = `기록을 저장하지 못해(${safeValue(e && e.name)}) 이번 방문 동안만 보관합니다.`;
  }
}

function pcClearHistory() {
  pcLoadHistory();
  if (pcHistory.entries.length === 0) return;
  pcHistory.entries = [];
  const store = pcStore();
  try {
    if (store) store.removeItem(PC_HISTORY_KEY);
    pcHistory.flash = '이 브라우저에 저장된 PC 조회 기록을 지웠습니다.';
  } catch (e) {
    pcHistory.flash = `저장된 기록을 지우지 못했습니다(${safeValue(e && e.name)}). 화면에서는 비웠지만 다음에 다시 보일 수 있습니다.`;
  }
}

// 읽은 값만 담는다. 읽지 못한 값은 null이며 예시 값으로 채우지 않는다.
function pcEntryFrom(route, outcome, finishedAt) {
  const entry = { v: 1, at: finishedAt, outcome: 'failed', cpu: null, memTotal: null, memFree: null, diskTotal: null, diskFree: null, diskPath: null, fw: null };
  if (!route.data) return entry;
  const { sample, pc } = route.data;
  const clean = (n, lo, hi) => (pcNum(n) && n >= lo && n <= hi ? n : null);
  if (typeof sample.measuredAt === 'string' && Number.isFinite(Date.parse(sample.measuredAt))) entry.at = sample.measuredAt;
  if (sample.cpu.status === 'ok') entry.cpu = clean(sample.cpu.percent, 0, 100);
  if (sample.memory.status === 'ok') {
    const total = clean(sample.memory.totalBytes, 0, 2 ** 60);
    const free = clean(sample.memory.freeBytes, 0, 2 ** 60);
    if (total !== null && free !== null && free <= total) { entry.memTotal = total; entry.memFree = free; }
  }
  if (sample.disk.status === 'ok') {
    const total = clean(sample.disk.totalBytes, 0, 2 ** 60);
    const free = clean(sample.disk.freeBytes, 0, 2 ** 60);
    if (total !== null && free !== null && free <= total) {
      entry.diskTotal = total; entry.diskFree = free;
      entry.diskPath = typeof sample.disk.path === 'string' && sample.disk.path.length <= 16 ? sample.disk.path : null;
    }
  }
  if (pc.firewall.status === 'ok') {
    const fw = pcList(pc.firewall.profiles)
      .filter((p) => p && typeof p.Name === 'string' && p.Name.length <= 20 && PC_FW_VALUES.includes(p.Enabled)).map((p) => [p.Name, p.Enabled]).slice(0, 6);
    entry.fw = fw.length > 0 ? fw : null;
  }
  const complete = [entry.cpu, entry.memTotal, entry.diskTotal, entry.fw].every((v) => v !== null);
  entry.outcome = outcome === 'ok' && !complete ? 'partial' : outcome;
  return entry;
}

function pcReasons(route) {
  if (route.kind) return { cpu: route.reason, memory: route.reason, disk: route.reason, firewall: route.reason };
  const { sample, pc } = route.data;
  const why = (m) => (m.status === 'unavailable' ? safeValue(m.reason) : null);
  return { cpu: why(sample.cpu), memory: why(sample.memory), disk: why(sample.disk), firewall: why(pc.firewall) };
}

// ----- 직전 조회 대비 변화 -----

const pcRoundTo = (v, digits) => Math.round(v * 10 ** digits);
const pcFwState = (value) => (Object.hasOwn(PC_ENABLED, value) ? PC_ENABLED[value] : '확인 불가');

// 표시한 자릿수를 기준으로 증가·감소·변화 없음만 말한다.
export function pcChangeRows(prev, curr) {
  const gib = (bytes) => (bytes === null ? null : bytes / 2 ** 30);
  const defs = [
    { label: 'CPU 사용률', unit: '%p', shown: '%', digits: 1, get: (e) => e.cpu },
    { label: '메모리 사용량(전체−여유)', unit: 'GiB', shown: 'GiB', digits: 2, get: (e) => (e.memTotal !== null && e.memFree !== null ? gib(e.memTotal - e.memFree) : null) },
    { label: '디스크 남은 공간', unit: 'GiB', shown: 'GiB', digits: 2, get: (e) => gib(e.diskFree), samePath: true },
  ];
  const rows = defs.map((d) => {
    const a = d.get(prev);
    const b = d.get(curr);
    if (a === null || b === null) {
      return { label: d.label, comparable: false, reason: `${a === null ? '이전 조회에서 값을 읽지 못했습니다' : ''}${a === null && b === null ? ' / ' : ''}${b === null ? '이번 조회에서 값을 읽지 못했습니다' : ''}` };
    }
    if (d.samePath && prev.diskPath !== curr.diskPath) {
      return { label: d.label, comparable: false, reason: `디스크 경로가 달라 비교할 수 없습니다(이전 ${safeValue(prev.diskPath)}, 현재 ${safeValue(curr.diskPath)})` };
    }
    const ra = pcRoundTo(a, d.digits);
    const rb = pcRoundTo(b, d.digits);
    const delta = (rb - ra) / 10 ** d.digits;
    return {
      label: d.label, comparable: true, shown: d.shown, unit: d.unit, digits: d.digits,
      before: ra / 10 ** d.digits, after: rb / 10 ** d.digits, delta,
      direction: delta > 0 ? '증가' : delta < 0 ? '감소' : '변화 없음(표시 자릿수 기준)',
    };
  });
  if (prev.fw === null || curr.fw === null) {
    rows.push({ label: '방화벽 켜짐 여부', comparable: false, reason: `${prev.fw === null ? '이전 조회에서 값을 읽지 못했습니다' : ''}${prev.fw === null && curr.fw === null ? ' / ' : ''}${curr.fw === null ? '이번 조회에서 값을 읽지 못했습니다' : ''}` });
  } else {
    const names = [...new Set([...curr.fw.map((p) => p[0]), ...prev.fw.map((p) => p[0])])];
    const find = (list, name) => { const hit = list.find((p) => p[0] === name); return hit ? pcFwState(hit[1]) : '없음'; };
    const parts = names.map((n) => ({ name: n, before: find(prev.fw, n), after: find(curr.fw, n) }));
    const changed = parts.filter((p) => p.before !== p.after);
    rows.push({
      label: '방화벽 켜짐 여부', comparable: true, firewall: true,
      beforeText: parts.map((p) => `${p.name} ${p.before}`).join(' · '), afterText: parts.map((p) => `${p.name} ${p.after}`).join(' · '),
      changeText: changed.length === 0 ? '없음' : changed.map((p) => `${p.name} ${p.before}→${p.after}`).join(' · '),
      direction: changed.length === 0 ? '변화 없음' : '바뀜(판정 아님)',
    });
  }
  return rows;
}

// ----- 화면 틀: 전용 스타일시트 · 시각 · 상태 줄 · 카드 · 막대 그래프 · 한 줄 요약 · 접는 「자세히」 -----
// 스타일은 이 앱의 보안 정책(style-src 'self')이 허용하는 '새 스타일시트'(adoptedStyleSheets) 한 개로만 넣는다.
// <style> 요소와 인라인 style 속성은 막히므로 쓰지 않는다. 막대 높이도 인라인 style 대신 5% 단위 클래스(kd-h0~kd-h20)로
// 정한다. 스타일시트를 넣지 못해도 내용(숫자)과 동작은 그대로이고 모양만 단순해진다.
const KD_BAR_STEPS = 20; // 막대 높이는 5% 단위로 반올림해 그린다(정확한 값은 막대 아래 숫자)
const KD_CSS = `
.student-pc-dashboard{container-type:inline-size;container-name:kd;display:grid;gap:14px;min-width:0;margin:0 0 16px;font-size:.875rem;line-height:1.45}
.student-pc-dashboard *{min-width:0;overflow-wrap:anywhere}
.student-pc-dashboard h3,.student-pc-dashboard h4,.student-pc-dashboard p,.student-pc-dashboard ul{margin:0}
.student-pc-dashboard ul{padding:0;list-style:none}
.kd-title{font-size:1.05rem}
.kd-tag{font-size:.7rem;font-weight:400;color:var(--muted)}
.kd-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
.kd-status strong{margin-right:2px}
.kd-cards{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}
@container kd (min-width:380px){.kd-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
.student-pc-dashboard .kd-card{margin:0;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius)}
.kd-card-title{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 6px;margin-bottom:4px;font-size:.8rem;font-weight:600;color:var(--muted)}
.kd-value{font-size:1.6rem;line-height:1.2;font-weight:700;font-variant-numeric:tabular-nums}
.kd-value-text{font-size:1.05rem;line-height:1.35}
.kd-nowrap{white-space:nowrap}
.kd-empty{color:var(--muted)}
.kd-unit{font-size:.8rem;font-weight:400;color:var(--muted)}
.kd-sub{margin-top:2px;font-size:.8rem;color:var(--muted)}
.kd-time{margin-top:6px;font-size:.75rem;color:var(--muted)}
.kd-note{font-size:.8rem;color:var(--muted)}
.kd-section{display:grid;gap:6px}
.kd-section>h4{font-size:.95rem}
.kd-range{font-size:.8rem;color:var(--muted)}
.kd-bars{display:flex;align-items:flex-end;gap:3px}
.kd-bars>li{flex:1 1 0;display:flex;flex-direction:column;align-items:center;gap:3px}
.kd-bar-col{display:flex;align-items:flex-end;width:100%;height:72px;border-bottom:1px solid var(--border)}
.kd-bar-fill{display:block;width:100%;background:var(--text);border-radius:2px 2px 0 0}
.kd-bar-val{font-size:.68rem;line-height:1.2;font-variant-numeric:tabular-nums}
.kd-bars>li:last-child .kd-bar-val{font-weight:700}
.kd-change{font-weight:600;font-variant-numeric:tabular-nums}
.kd-line{font-variant-numeric:tabular-nums}
.kd-controls{display:flex;flex-wrap:wrap;gap:8px}
.kd-details{font-size:.8rem;color:var(--muted)}
.kd-details summary{cursor:pointer;font-weight:600;color:var(--text)}
.kd-details-body{display:grid;gap:10px;margin-top:8px}
.kd-details-body h5{margin:0;font-size:.8rem;color:var(--text)}
.kd-details ul{margin-top:4px;display:grid;gap:4px}
${Array.from({ length: KD_BAR_STEPS + 1 }, (_, i) => `.kd-h${i}{height:${i === 0 ? '2px' : `${i * 5}%`}}`).join('\n')}
`;
let kdDetailsOpen = false;

// 새 스타일시트를 문서에 한 번만 붙인다. 지원하지 않거나 막히면 false를 돌려주고 조용히 넘어간다.
function kdEnsureStyles() {
  try {
    if (typeof CSSStyleSheet !== 'function' || !document || !('adoptedStyleSheets' in document)) return false;
    if (document.__keshevDashboardSheet) return true;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(KD_CSS);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    document.__keshevDashboardSheet = true;
    return true;
  } catch {
    return false;
  }
}

function kdEl(tag, className, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (children.length > 0) node.append(...children);
  return node;
}

const kdHasIntl = typeof Intl === 'object' && Intl && typeof Intl.DateTimeFormat === 'function';
const kdTimeFormat = kdHasIntl
  ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : null;
const kdClockFormat = kdHasIntl
  ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : null;

function kdPart(format, iso, ...types) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms) || !format) return null;
  const parts = format.formatToParts(new Date(ms));
  return types.map((type) => { const part = parts.find((p) => p.type === type); return part ? part.value : ''; });
}

// "10/28 16:09" 형식(한국 시각). 전체 시각은 요소의 title로 제공한다.
function kdShortTime(iso) {
  const p = kdPart(kdTimeFormat, iso, 'month', 'day', 'hour', 'minute');
  return p ? `${p[0]}/${p[1]} ${p[2]}:${p[3]}` : '시각 확인 불가';
}

// "14:02" 형식(한국 시각).
function kdClock(iso) {
  const p = kdPart(kdClockFormat, iso, 'hour', 'minute');
  return p ? `${p[0]}:${p[1]}` : '시각 확인 불가';
}

function kdTimeNode(label, iso) {
  const node = text('time', label);
  if (Number.isFinite(Date.parse(iso))) { node.setAttribute('datetime', iso); node.setAttribute('title', koreanTime(iso)); }
  return node;
}
const kdTimeEl = (iso) => kdTimeNode(kdShortTime(iso), iso);

// ----- 버튼 옆 상태 한 줄: "14:02 다시 조회 성공" -----

const KD_RESULT_WORD = { ok: '성공', partial: '일부 확인 불가', failed: '실패' };

function kdStatus() {
  const line = kdEl('p', 'kd-status');
  line.setAttribute('role', 'status');
  if (pcState.phase === 'loading') {
    line.append(text('strong', '조회 중…'));
  } else if (pcState.phase === 'done' && pcState.currentEntry) {
    // 카드·그래프와 같은 시각을 쓴다. 이번 방문의 두 번째 조회부터 「다시 조회」라고 적는다.
    line.append(kdTimeNode(kdClock(pcState.currentEntry.at), pcState.currentEntry.at), text('span', ` ${pcState.count > 1 ? '다시 조회' : '조회'} ${KD_RESULT_WORD[pcState.outcome]}`));
  } else {
    line.append(text('strong', '조회 전'));
    const last = pcHistory.entries[pcHistory.entries.length - 1];
    if (last) line.append(text('span', ' · 저장된 마지막 조회 '), kdTimeEl(last.at));
  }
  return line;
}

// ----- 상태 카드 4개 -----

function kdCardData(key) {
  const sample = pcState.sample;
  const pc = pcState.pc;
  if (key === 'cpu') {
    const m = sample && sample.cpu;
    return m && m.status === 'ok' && pcNum(m.percent) ? { value: `${m.percent.toFixed(1)} %`, note: '', at: sample.measuredAt } : null;
  }
  if (key === 'memory') {
    const m = sample && sample.memory;
    return m && m.status === 'ok' && pcNum(m.totalBytes) && pcNum(m.freeBytes) && m.totalBytes > 0 && m.freeBytes <= m.totalBytes
      ? { value: `${(((m.totalBytes - m.freeBytes) / m.totalBytes) * 100).toFixed(1)} %`, note: '사용(계산값)', at: sample.measuredAt } : null;
  }
  if (key === 'disk') {
    const m = sample && sample.disk;
    return m && m.status === 'ok' && pcNum(m.totalBytes) && pcNum(m.freeBytes) && m.freeBytes <= m.totalBytes
      ? { value: `${pcGiB(m.freeBytes)} GiB`, note: '남음', at: sample.measuredAt } : null;
  }
  const m = pc && pc.firewall;
  const list = m && m.status === 'ok' ? pcList(m.profiles).filter((p) => p && typeof p.Name === 'string' && Object.hasOwn(PC_ENABLED, p.Enabled)) : [];
  if (list.length === 0) return null;
  // 프로필이 둘 이상이고 모두 같은 켜짐/꺼짐일 때만 한 줄로 줄이고, 다르면 프로필별 글자로 보여 준다.
  const same = list.length >= 2 && (list[0].Enabled === 'True' || list[0].Enabled === 'False') && list.every((p) => p.Enabled === list[0].Enabled);
  return same
    ? { parts: [`모두 ${PC_ENABLED[list[0].Enabled]}`], sub: `프로필 ${list.length}개: ${list.map((p) => safeValue(p.Name)).join(' · ')}`, note: '읽기만 함', at: pc.measuredAt, long: true }
    : { parts: list.map((p) => `${safeValue(p.Name)} ${PC_ENABLED[p.Enabled]}`), note: '읽기만 함', at: pc.measuredAt, long: true }; // 프로필 이름과 상태는 줄바꿈 때 갈라지지 않게 따로 감싼다
}

function buildKdCards() {
  const list = kdEl('ul', 'kd-cards');
  list.setAttribute('role', 'list');
  list.setAttribute('aria-label', 'PC 상태 카드');
  let anyUnavailable = false;
  for (const [key, title] of [['cpu', 'CPU 사용률'], ['memory', '메모리'], ['disk', '디스크'], ['firewall', '방화벽']]) {
    const card = kdEl('li', 'card kd-card');
    card.setAttribute('role', 'listitem');
    const heading = kdEl('h4', 'kd-card-title', text('span', title));
    if (pcState.phase === 'idle') {
      card.append(heading, text('p', '조회 전', 'kd-value kd-empty'));
    } else if (pcState.phase === 'loading') {
      card.append(heading, text('p', '조회 중', 'kd-value kd-empty'));
    } else {
      const v = kdCardData(key);
      if (v) {
        heading.append(text('span', PC_TAG, 'kd-tag'));
        const value = kdEl('p', v.long ? 'kd-value kd-value-text' : 'kd-value');
        if (v.parts) v.parts.forEach((part, i) => { if (i > 0) value.append(text('span', ' · ')); value.append(text('span', part, 'kd-nowrap')); });
        else value.append(text('span', v.value));
        if (v.note) value.append(text('span', ` ${v.note}`, 'kd-unit'));
        card.append(heading, value);
        if (v.sub) card.append(text('p', v.sub, 'kd-sub'));
        card.append(kdEl('p', 'kd-time', kdTimeEl(v.at), text('span', ' 측정')));
      } else {
        anyUnavailable = true;
        const reason = pcState.reasons && pcState.reasons[key] ? pcState.reasons[key] : '값 형식을 확인할 수 없습니다';
        card.append(heading, text('p', '확인 불가', 'kd-value kd-empty'), text('p', reason, 'kd-sub'));
      }
    }
    list.append(card);
  }
  return { list, anyUnavailable };
}

// ----- 시간에 따른 변화: CPU 사용률 막대 그래프(저장된 기록에서 최근 최대 10개) -----

function buildKdGraph() {
  const box = kdEl('section', 'kd-section', text('h4', 'CPU 사용률 변화(최근 조회 최대 10개)'));
  const plotted = pcHistory.entries.filter((e) => e.cpu !== null).slice(-PC_HISTORY_MAX);
  const skipped = pcHistory.entries.length - plotted.length;
  if (plotted.length < 2) {
    box.append(text('p', plotted.length === 1 ? '비교할 이전 조회가 없습니다. 한 번 더 조회하면 막대가 나옵니다.' : '비교할 이전 조회가 없습니다. 조회하면 이곳에 쌓입니다.', 'kd-note'));
  } else {
    const list = kdEl('ul', 'kd-bars');
    list.setAttribute('role', 'list');
    list.setAttribute('aria-label', 'CPU 사용률 막대 그래프(왼쪽이 오래된 조회, 오른쪽이 최근 조회)');
    for (const e of plotted) {
      const label = `${kdShortTime(e.at)} CPU ${e.cpu.toFixed(1)} %`;
      const step = Math.min(KD_BAR_STEPS, Math.max(0, Math.round(e.cpu / 5)));
      const fill = kdEl('span', `kd-bar-fill kd-h${step}`);
      const col = kdEl('span', 'kd-bar-col', fill);
      col.setAttribute('aria-hidden', 'true');
      const item = kdEl('li', '', col, text('span', e.cpu.toFixed(1), 'kd-bar-val'));
      item.setAttribute('role', 'listitem');
      item.setAttribute('title', label);
      item.setAttribute('aria-label', label);
      list.append(item);
    }
    box.append(list);
    box.append(kdEl('p', 'kd-range', text('span', '왼쪽 '), kdTimeEl(plotted[0].at), text('span', ' → 오른쪽 '), kdTimeEl(plotted[plotted.length - 1].at), text('span', ' (오래된 조회 → 최근 조회) · 숫자는 CPU 사용률(%)이고 막대 높이는 5% 단위로 반올림해 그렸습니다.')));
    const row = pcChangeRows(plotted[plotted.length - 2], plotted[plotted.length - 1])[0];
    if (row && row.comparable) {
      const arrow = row.delta > 0 ? '▲' : row.delta < 0 ? '▼' : '=';
      const sign = row.delta > 0 ? '+' : '−';
      box.append(text('p', row.delta === 0 ? '직전보다 = 변화 없음' : `직전보다 ${arrow} ${sign}${Math.abs(row.delta).toFixed(1)} %p ${row.delta > 0 ? '증가' : '감소'}`, 'kd-change'));
    }
  }
  if (skipped > 0) box.append(text('p', `CPU 값을 읽지 못한 조회 ${skipped}개는 그래프에서 뺐습니다.`, 'kd-note'));
  if (pcHistory.notice) box.append(text('p', pcHistory.notice, 'kd-note'));
  return box;
}

// ----- 네트워크·Windows 기록 한 줄 요약 · SDP 상태 -----

function kdNetworkText(pc) {
  if (pc.network.status !== 'ok') return '네트워크 확인 불가';
  const physUp = pcList(pc.network.adapters).filter((a) => a && a.Status === 'Up' && a.Virtual !== true).length;
  return `네트워크 물리 ${physUp}개 연결됨`;
}

// System·Application 두 기록의 합계. 한 칸이라도 읽지 못했으면 그 수준은 확인 불가로 쓴다(일부만 더하지 않는다).
function kdEventsText(pc) {
  if (pc.events.status !== 'ok') return 'Windows 기록 확인 불가';
  const entries = pcList(pc.events.entries).filter((e) => e && (e.level === 2 || e.level === 3));
  const total = (level) => {
    const part = entries.filter((e) => e.level === level);
    if (new Set(part.map((e) => e.log)).size < 2 || part.some((e) => !pcNum(e.cnt))) return '확인 불가';
    return `${part.reduce((sum, e) => sum + e.cnt, 0)}${part.some((e) => e.cnt >= 1000) ? ' 이상' : ''}`;
  };
  return `Windows 오류 ${total(2)}·경고 ${total(3)}(최근 24시간)`;
}

function kdSdpText() {
  const sdp = pcState.sdp;
  if (pcState.phase === 'idle') return 'SDP 상태: 조회 전';
  if (pcState.phase === 'loading' || !sdp) return 'SDP 상태: 조회 중';
  if (sdp.state === 'disconnected') return 'SDP 미연결';
  if (sdp.state === 'demo') return 'SDP 예제 모드(실제 SDP 아님)';
  if (sdp.state === 'configured') return 'SDP 연결 설정됨(설정이 켜졌다는 뜻이며 실제 응답 성공 확인은 아님)';
  return "SDP 상태 확인 불가('미연결'이 아닙니다)";
}

function buildKdSummary() {
  const box = kdEl('section', 'kd-section', text('h4', '네트워크·Windows 기록 요약'));
  let line;
  if (pcState.phase === 'idle') line = text('p', '조회 전', 'kd-line kd-empty');
  else if (pcState.phase === 'loading') line = text('p', '조회 중', 'kd-line kd-empty');
  else if (!pcState.pc) line = text('p', '네트워크·Windows 기록: 확인 불가(이유와 다음에 할 일은 아래 「핵심 3가지」 패널에 있습니다)', 'kd-line');
  else line = kdEl('p', 'kd-line', text('span', `${PC_TAG} `, 'kd-tag'), text('span', `${kdNetworkText(pcState.pc)} · ${kdEventsText(pcState.pc)}`));
  box.append(line, text('p', '이 건수는 침해나 공격 탐지 결과가 아닙니다.', 'kd-note'));
  const sdp = kdEl('p', 'kd-line');
  if (pcState.phase === 'done' && pcState.sdp && pcState.sdp.state !== 'unavailable') sdp.append(text('span', `${PC_TAG} `, 'kd-tag'));
  sdp.append(text('span', kdSdpText()));
  box.append(sdp);
  return box;
}

// ----- 접는 「자세히」: 어댑터별 · 방화벽 프로필별 · 기록 건수 상세 · 한계 · 기록 지우기 -----

const PC_FW_ACTION = { Allow: '허용', Block: '차단', NotConfigured: '설정 안 됨' };

function kdAdapterKind(a) {
  if (a.Virtual === true) return '가상';
  if (a.MediaType === '802.3') return '물리 유선';
  return /802\.11/.test(String(a.MediaType)) ? '물리 무선' : '물리 · 종류 확인 불가';
}

function kdDetailGroups() {
  const pc = pcState.pc;
  const groups = [];
  const none = (why) => [text('p', why, 'kd-note')];
  if (pcState.phase !== 'done') {
    const why = pcState.phase === 'loading' ? '조회 중입니다.' : '조회한 뒤에 나옵니다.';
    return [['어댑터별 상태', none(why)], ['방화벽 프로필별 설정', none(why)], ['Windows 기록 건수(최근 24시간)', none(why)]];
  }
  const failed = '확인 불가 — 이유와 다음에 할 일은 아래 「핵심 3가지」 패널에 있습니다.';
  const lines = (items) => { const ul = document.createElement('ul'); ul.setAttribute('role', 'list'); for (const t of items) { const li = text('li', t); li.setAttribute('role', 'listitem'); ul.append(li); } return [ul]; };

  if (!pc || pc.network.status !== 'ok') groups.push(['어댑터별 상태', none(failed)]);
  else {
    const adapters = pcList(pc.network.adapters).filter((a) => a && typeof a === 'object');
    const items = adapters.map((a) => `${safeValue(a.Name)} — ${Object.hasOwn(PC_ADAPTER_STATUS, a.Status) ? PC_ADAPTER_STATUS[a.Status] : '확인 불가'} · ${kdAdapterKind(a)}`);
    for (const p of pcList(pc.network.profiles)) items.push(`연결 범주: ${pcMapped(PC_CATEGORY, p && p.NetworkCategory)} · IPv4 ${pcMapped(PC_CONNECTIVITY, p && p.IPv4Connectivity)} · IPv6 ${pcMapped(PC_CONNECTIVITY, p && p.IPv6Connectivity)}`);
    items.push('IP·MAC 주소와 무선 이름(SSID)은 읽거나 표시하지 않습니다.');
    groups.push(['어댑터별 상태', lines(items)]);
  }

  if (!pc || pc.firewall.status !== 'ok') groups.push(['방화벽 프로필별 설정', none(failed)]);
  else {
    const profiles = pcList(pc.firewall.profiles).filter((p) => p && typeof p === 'object');
    const act = (v) => (Object.hasOwn(PC_FW_ACTION, v) ? PC_FW_ACTION[v] : '확인 불가');
    const items = profiles.map((p) => `${safeValue(p.Name)} ${Object.hasOwn(PC_ENABLED, p.Enabled) ? PC_ENABLED[p.Enabled] : '확인 불가'} · 들어오는 기본 동작 ${act(p.In)} · 나가는 기본 동작 ${act(p.Out)}`);
    if (items.length === 0) items.push('읽은 프로필이 없습니다(확인 불가).');
    if (profiles.some((p) => p.In === 'NotConfigured' || p.Out === 'NotConfigured')) items.push("기본 동작이 '설정 안 됨(NotConfigured)'이면 정책으로 지정되지 않았다는 뜻이며 실제 적용되는 기본 동작을 알려 주는 값이 아닙니다.");
    items.push('읽기만 하며 바꾸지 않습니다.');
    groups.push(['방화벽 프로필별 설정', lines(items)]);
  }

  if (!pc || pc.events.status !== 'ok') groups.push(['Windows 기록 건수(최근 24시간)', none(failed)]);
  else {
    const countText = (e) => {
      const name = e.level === 2 ? '오류' : '경고';
      return pcNum(e.cnt) ? (e.cnt >= 1000 ? `${name} 1000건 이상(조회 상한)` : `${name} ${e.cnt}건`) : `${name} 확인 불가`;
    };
    const items = ['System', 'Application'].map((log) => {
      const entries = pcList(pc.events.entries).filter((e) => e && e.log === log).sort((a, b) => a.level - b.level);
      return `${log}: ${entries.length === 0 ? '확인 불가(읽은 항목 없음)' : entries.map(countText).join(' · ')}`;
    });
    items.push('이 건수는 침해나 공격 탐지 결과가 아닙니다. 드라이버·서비스·앱의 일반적인 오류와 경고도 포함됩니다.');
    groups.push(['Windows 기록 건수(최근 24시간)', lines(items)]);
  }
  return groups;
}

function buildKdDetails() {
  const origin = typeof location === 'object' && location && typeof location.origin === 'string' && location.origin ? location.origin : '이 주소';
  const body = kdEl('div', 'kd-details-body');
  for (const [heading, nodes] of kdDetailGroups()) body.append(kdEl('div', '', text('h5', heading), ...nodes));
  const notes = [
    pcHistory.storage === 'local' ? `기록 보관: 이 브라우저의 localStorage(${safeValue(origin)}). 서버·파일·Git에는 저장되지 않습니다.` : '기록 보관: 이번 방문 동안만(메모리). 새로고침하면 사라집니다.',
    '이 제출 버전은 제공 서버를 고치지 않아 PC 값을 읽는 경로(/api/pc-snapshot)를 연결하지 않았습니다. 그래서 카드와 요약은 「확인 불가」로 나옵니다. 값은 PowerShell에서 node student\\pc-status.mjs 와 node student\\pc-security-status.mjs 로 확인할 수 있습니다.',
    ...(pcHistory.entries.filter((e) => e.cpu !== null).length >= 2 ? ['그래프의 막대는 이전 버전에서 저장된 기록입니다.'] : []),
    '기록은 주소·포트별로 따로 저장되어, 포트가 바뀌거나 다른 폴더의 앱을 켜면 안 보일 수 있습니다.',
    '그래프는 CPU 사용률만 그립니다. 메모리·디스크·방화벽의 이전 조회 값은 저장되지만 이 화면에는 표시하지 않습니다.',
    '저장 내용: 시각, 결과, CPU %, 메모리·디스크의 전체와 남은 바이트, 디스크 드라이브, 방화벽 켜짐 여부. IP·MAC 주소와 무선 이름, 기록 메시지는 저장하지 않습니다. 최대 10개이며 오래된 것부터 지웁니다.',
    `${PC_TAG}는 이 PC에서 읽은 값이라는 표시입니다. 화면에는 예시 값이 없고, 읽지 못한 값은 「확인 불가」로 표시합니다. 메모리 사용률은 전체에서 여유를 뺀 값으로 계산하고, CPU 사용률은 1초 구간의 순간 값이라 조회마다 크게 달라질 수 있습니다.`,
    '「기록 지우기」는 이 브라우저에 저장된 PC 조회 기록만 지웁니다. 서버·파일·Git에는 영향이 없습니다.',
  ];
  const list = document.createElement('ul');
  list.setAttribute('role', 'list');
  for (const line of notes) { const li = text('li', line); li.setAttribute('role', 'listitem'); list.append(li); }
  body.append(kdEl('div', '', text('h5', '보관 위치 · 한계 · 읽는 방식'), list));

  const clear = text('button', '기록 지우기', 'btn');
  clear.type = 'button';
  clear.setAttribute('data-student-pc-clear', '');
  if (pcHistory.entries.length === 0) clear.setAttribute('aria-disabled', 'true');
  clear.addEventListener('click', () => { pcClearHistory(); if (pcRerender) pcRerender(); });
  body.append(kdEl('div', 'kd-controls', clear));
  if (pcHistory.flash) body.append(text('p', pcHistory.flash, 'kd-note'));

  const details = kdEl('details', 'kd-details', text('summary', '자세히'), body);
  if (kdDetailsOpen) details.setAttribute('open', '');
  details.addEventListener('toggle', () => { kdDetailsOpen = details.hasAttribute('open'); });
  return details;
}

function buildPcDashboard() {
  pcLoadHistory();
  kdEnsureStyles();
  const box = document.createElement('section');
  box.className = 'student-pc-dashboard';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-labelledby', 'student-pc-dashboard-title');
  const title = text('h3', '관제 대시보드', 'kd-title');
  title.id = 'student-pc-dashboard-title';
  const cards = buildKdCards();
  box.append(title, kdEl('div', 'kd-bar', pcButton(), kdStatus()), cards.list);
  if (cards.anyUnavailable) box.append(text('p', '확인 불가 항목의 이유와 다음에 할 일은 아래 「핵심 3가지」 패널의 「조회하지 못한 항목과 다음에 할 일」에 있습니다.', 'kd-note'));
  box.append(buildKdGraph(), buildKdSummary(), buildKdDetails());
  return box;
}

export function createStudentView({ onChange } = {}) {
  pcRerender = typeof onChange === 'function' ? onChange : null;
  return {
    renderIdentity,
    renderDecision,
    renderEvents,
    renderStatus,
    renderVulnerabilities,
    renderAiConnection,
    renderExplanation,
    renderAction,
  };
}
