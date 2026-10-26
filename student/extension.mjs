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
  root.append(
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

export function createStudentView() {
  return {
    renderIdentity,
    renderDecision,
    renderEvents,
    renderStatus,
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection,
    renderExplanation,
    renderAction,
  };
}
