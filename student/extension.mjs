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

export function createStudentView() {
  return {
    renderIdentity,
    renderDecision,
    renderEvents,
    renderStatus,
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection,
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
