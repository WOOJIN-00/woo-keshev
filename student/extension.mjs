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

export function createStudentView() {
  return {
    renderIdentity,
    renderDecision() { return '학생 구현 대기: 서버의 판정과 이유를 연결하세요.'; },
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
