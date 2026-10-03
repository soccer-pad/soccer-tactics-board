// ===== 전자 축구작전판 =====

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

// ---- 정식 규격 축구장 (FIFA 권장: 길이 105m x 폭 68m) ----
const SCALE = 8; // px per meter
const PITCH = {
  len: 105, wid: 68,
  penaltyDepth: 16.5, penaltyWidth: 40.32,
  goalAreaDepth: 5.5, goalAreaWidth: 18.32,
  penaltySpot: 11, centerCircle: 9.15,
  cornerArc: 0.9144, goalWidth: 7.32,
};

// 필드 크기/좌표는 '정규 축구장(가로)' / '하프 코트(세로)' 모드에 따라 달라지므로
// const가 아니라 setFieldGeometry()로 다시 계산되는 변수로 둔다.
let W, H, fieldW, fieldH, field, fieldCenterX, fieldCenterY;

function pitchGeometry(mode) {
  const fw = mode === 'half' ? PITCH.wid * SCALE : PITCH.len * SCALE;
  const fh = mode === 'half' ? (PITCH.len / 2) * SCALE : PITCH.wid * SCALE;
  return {
    fieldW: fw, fieldH: fh, W: fw + 100, H: fh + 100,
    field: { left: 50, top: 50, right: 50 + fw, bottom: 50 + fh },
  };
}

function setFieldGeometry() {
  const g = pitchGeometry(state && state.pitchMode === 'half' ? 'half' : 'full');
  fieldW = g.fieldW;
  fieldH = g.fieldH;
  W = g.W;
  H = g.H;
  field = g.field;
  fieldCenterX = (field.left + field.right) / 2;
  fieldCenterY = (field.top + field.bottom) / 2;
  // 실제 픽셀 수는 화면 해상도/확대에 맞춰 더 크게 잡는다 (선명하게). 그리기는 항상 W x H 좌표로.
  canvas.width = Math.round(W * backingScale);
  canvas.height = Math.round(H * backingScale);
}

let backingScale = 1;

const boxDepthPx = PITCH.penaltyDepth * SCALE;
const boxWidthPx = PITCH.penaltyWidth * SCALE;
const smallBoxDepthPx = PITCH.goalAreaDepth * SCALE;
const smallBoxWidthPx = PITCH.goalAreaWidth * SCALE;
const penaltySpotPx = PITCH.penaltySpot * SCALE;
const centerCirclePx = PITCH.centerCircle * SCALE;
const cornerArcPx = PITCH.cornerArc * SCALE;
const goalWidthPx = PITCH.goalWidth * SCALE;
const penaltyArcHalfAngle = Math.acos((boxDepthPx - penaltySpotPx) / centerCirclePx);

const GOAL_BASE_W = 54, GOAL_BASE_H = 28;
const PLAYER_R = 13;
const EQUIP_R = { ball: 12, marker: 12, cone: 14, mannequin: 17, pole: 10, goal: Math.hypot(GOAL_BASE_W, GOAL_BASE_H) / 2 + 4 };
const GRID_SIZE = 20;

const TEAM_PALETTE = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa', '#fb8c00', '#00acc1', '#d81b60'];
const EQUIP_PALETTE = ['#ffffff', '#fdd835', '#fb8c00', '#e53935', '#212121'];
const LINE_PALETTE = ['#ffeb3b', '#ffffff', '#e53935', '#212121'];
const MAX_TEAMS = TEAM_PALETTE.length;

const EQUIP_TYPES = [
  { type: 'ball', label: '⚽ 축구공' },
  { type: 'marker', label: '🔶 마커' },
  { type: 'cone', label: '🔺 콘' },
  { type: 'mannequin', label: '🧍 더미 마네킹' },
  { type: 'pole', label: '🟨 폴' },
  { type: 'goal', label: '🥅 골대' },
];

// ---- 포메이션 정의 ----
const FORMATIONS = {
  442: [
    [0.05, 0.5],
    [0.22, 0.15], [0.22, 0.38], [0.22, 0.62], [0.22, 0.85],
    [0.5, 0.15], [0.5, 0.38], [0.5, 0.62], [0.5, 0.85],
    [0.78, 0.35], [0.78, 0.65],
  ],
  433: [
    [0.05, 0.5],
    [0.22, 0.15], [0.22, 0.38], [0.22, 0.62], [0.22, 0.85],
    [0.48, 0.25], [0.48, 0.5], [0.48, 0.75],
    [0.78, 0.2], [0.78, 0.5], [0.78, 0.8],
  ],
  352: [
    [0.05, 0.5],
    [0.22, 0.25], [0.22, 0.5], [0.22, 0.75],
    [0.5, 0.1], [0.5, 0.3], [0.5, 0.5], [0.5, 0.7], [0.5, 0.9],
    [0.8, 0.35], [0.8, 0.65],
  ],
  4231: [
    [0.05, 0.5],
    [0.2, 0.15], [0.2, 0.38], [0.2, 0.62], [0.2, 0.85],
    [0.4, 0.35], [0.4, 0.65],
    [0.62, 0.2], [0.62, 0.5], [0.62, 0.8],
    [0.85, 0.5],
  ],
  532: [
    [0.05, 0.5],
    [0.18, 0.1], [0.18, 0.3], [0.18, 0.5], [0.18, 0.7], [0.18, 0.9],
    [0.5, 0.25], [0.5, 0.5], [0.5, 0.75],
    [0.8, 0.35], [0.8, 0.65],
  ],
};
const FORMATION_LABELS = { 442: '4-4-2', 433: '4-3-3', 352: '3-5-2', 4231: '4-2-3-1', 532: '5-3-2' };
const FORMATION_KEYS = Object.keys(FORMATIONS);

const MAX_PLAYERS = 40;

// ---- id / 배치 위치 ----
let idCounter = 0;
function nextId() { return 'id' + (idCounter++); }

let cascadeCounter = 0;
function cascadePos() {
  const i = cascadeCounter++;
  const angle = i * 0.9;
  const radius = 20 + (i % 8) * 14;
  return {
    x: clamp(fieldCenterX + Math.cos(angle) * radius, field.left + 20, field.right - 20),
    y: clamp(fieldCenterY + Math.sin(angle) * radius, field.top + 20, field.bottom - 20),
  };
}

// 포메이션의 i번째 자리 좌표 (현재 상태와 무관한 순수 계산 — 공유 링크 압축에도 사용)
function formationSlotPos(key, i, side, pitchMode, halfGoalPos) {
  const pos = FORMATIONS[key] && FORMATIONS[key][i];
  if (!pos) return null;
  const [relX, relY] = pos;
  const g = pitchGeometry(pitchMode);
  const f = g.field;
  if (pitchMode === 'half') {
    // relX: 0=골라인, 1=하프라인 (세로축) / relY: 0=왼쪽 터치라인, 1=오른쪽 터치라인 (가로축)
    const goalY = halfGoalPos === 'bottom' ? f.bottom : f.top;
    const halfwayY = halfGoalPos === 'bottom' ? f.top : f.bottom;
    return { x: f.left + relY * g.fieldW, y: goalY + (halfwayY - goalY) * relX };
  }
  return {
    x: side === 'L' ? f.left + relX * (g.fieldW / 2) : f.right - relX * (g.fieldW / 2),
    y: f.top + relY * g.fieldH,
  };
}

function formationToPlayers(key, side) {
  return FORMATIONS[key].map((_, i) => {
    const { x, y } = formationSlotPos(key, i, side, state.pitchMode, state.halfGoalPos);
    return { id: nextId(), num: String(i + 1), x, y };
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---- 상태 ----
let state;
let equipSelectedColor = { ball: '#ffffff', marker: '#fdd835', cone: '#fb8c00', mannequin: '#212121', pole: '#fdd835', goal: '#ffffff' };
let selectedLineColor = LINE_PALETTE[0];
let selectedEquipId = null;

function initState() {
  idCounter = 0;
  cascadeCounter = 0;
  state = {
    teams: [], equipment: [], arrows: [], texts: [],
    zones: { lengthZones: 0, widthZones: 0 }, showGrid: false,
    pitchMode: 'full', halfGoalPos: 'bottom',
  };
}

function ensureStateDefaults() {
  if (!state.zones) state.zones = { lengthZones: 0, widthZones: 0 };
  if (!state.texts) state.texts = [];
  if (typeof state.showGrid !== 'boolean') state.showGrid = false;
  if (state.pitchMode !== 'full' && state.pitchMode !== 'half') state.pitchMode = 'full';
  if (state.halfGoalPos !== 'top' && state.halfGoalPos !== 'bottom') state.halfGoalPos = 'bottom';
  state.teams.forEach(t => { if (!t.id) t.id = nextId(); });
}

let mode = 'move'; // 'move' | 'draw' | 'erase'
let dragTarget = null;
let dragLine = null; // { index, lastX, lastY } - 이동 모드에서 선을 잡고 옮기는 중
let dragIsTouch = false;
let currentDraw = null;
let history = [];
let isPointerDown = false;

// 터치(손가락)는 마우스보다 부정확하고, 손가락에 아이템이 가려지는 문제가 있어
// 잡을 때 판정 범위를 넓히고, 드래그 중엔 손가락 위쪽으로 살짝 띄워서 보여준다.
const TOUCH_HIT_TOLERANCE = 18;
const TOUCH_DRAG_LIFT = 32;

// ---- 색상 유틸 ----
function shadeColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) + Math.round(255 * percent);
  let g = ((num >> 8) & 0xff) + Math.round(255 * percent);
  let b = (num & 0xff) + Math.round(255 * percent);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function drawShadow(cx, cy, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fill();
}

function roundRectPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- 격자 스냅 ----
function snapVal(v) { return Math.round(v / GRID_SIZE) * GRID_SIZE; }
function maybeSnap(x, y) {
  return state.showGrid ? { x: snapVal(x), y: snapVal(y) } : { x, y };
}

// ---- 대상 검색 ----
function equipRadius(e) {
  return EQUIP_R[e.type] * (e.scale || 1);
}

function allTargets() {
  const arr = [];
  state.teams.forEach((team, ti) => {
    team.players.forEach(p => arr.push({ ref: p, kind: 'player', teamIndex: ti, r: playerRadius(p) }));
  });
  state.equipment.forEach(e => arr.push({ ref: e, kind: 'equipment', type: e.type, r: equipRadius(e) }));
  state.texts.forEach(t => arr.push({ ref: t, kind: 'text', r: Math.max(16, (t._w || 30) / 2 + 6) }));
  return arr;
}

function findTargetAt(x, y, tolerance = 4) {
  const all = allTargets();
  for (let i = all.length - 1; i >= 0; i--) {
    const t = all[i];
    const d = Math.hypot(t.ref.x - x, t.ref.y - y);
    if (d <= t.r + tolerance) return t;
  }
  return null;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function findArrowIndexAt(x, y, tolerance = 7) {
  for (let i = state.arrows.length - 1; i >= 0; i--) {
    const pts = state.arrows[i].points;
    for (let j = 0; j < pts.length - 1; j++) {
      if (distToSegment(x, y, pts[j].x, pts[j].y, pts[j + 1].x, pts[j + 1].y) <= tolerance) return i;
    }
  }
  return -1;
}

function findTeam(id) {
  return state.teams.find(t => t.id === id);
}

// ---- 필드 그리기 ----
function drawField() {
  if (state.pitchMode === 'half') drawHalfField();
  else drawFullField();
}

// 잔디는 CSS(.stage)가 그리고, 캔버스는 투명하게 두고 라인/선수만 그린다.
// (이미지로 저장할 때만 paintGrass로 잔디를 따로 깔아준다)
const GRASS_COLOR = '#2e7d32';

function paintGrass(c, w, h) {
  c.fillStyle = GRASS_COLOR;
  c.fillRect(0, 0, w, h);
  const stripeW = 72;
  for (let x = 0, i = 0; x < w; x += stripeW, i++) {
    c.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.035)';
    c.fillRect(x, 0, stripeW, h);
  }
}

function drawPitchBase() {
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 2.2;
  ctx.strokeRect(field.left, field.top, fieldW, fieldH);
}

function drawFullField() {
  drawPitchBase();

  ctx.beginPath();
  ctx.moveTo(fieldCenterX, field.top);
  ctx.lineTo(fieldCenterX, field.bottom);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(fieldCenterX, fieldCenterY, centerCirclePx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(fieldCenterX, fieldCenterY, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  ctx.strokeRect(field.left, fieldCenterY - boxWidthPx / 2, boxDepthPx, boxWidthPx);
  ctx.strokeRect(field.left, fieldCenterY - smallBoxWidthPx / 2, smallBoxDepthPx, smallBoxWidthPx);
  ctx.beginPath();
  ctx.arc(field.left + penaltySpotPx, fieldCenterY, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(field.left + penaltySpotPx, fieldCenterY, centerCirclePx, -penaltyArcHalfAngle, penaltyArcHalfAngle);
  ctx.stroke();

  ctx.strokeRect(field.right - boxDepthPx, fieldCenterY - boxWidthPx / 2, boxDepthPx, boxWidthPx);
  ctx.strokeRect(field.right - smallBoxDepthPx, fieldCenterY - smallBoxWidthPx / 2, smallBoxDepthPx, smallBoxWidthPx);
  ctx.beginPath();
  ctx.arc(field.right - penaltySpotPx, fieldCenterY, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(field.right - penaltySpotPx, fieldCenterY, centerCirclePx, Math.PI - penaltyArcHalfAngle, Math.PI + penaltyArcHalfAngle);
  ctx.stroke();

  [[field.left, field.top, 0, 0.5], [field.right, field.top, 0.5, 1], [field.left, field.bottom, -0.5, 0], [field.right, field.bottom, 1, 1.5]].forEach(([cx, cy, a0, a1]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, cornerArcPx, a0 * Math.PI, a1 * Math.PI);
    ctx.stroke();
  });

  drawGoalMouth(field.left, fieldCenterY, -1);
  drawGoalMouth(field.right, fieldCenterY, 1);
}

// 하프 코트 (세로 방향, 골대가 위 또는 아래)
function drawHalfField() {
  drawPitchBase();

  const goalIsBottom = state.halfGoalPos !== 'top';
  const goalY = goalIsBottom ? field.bottom : field.top;
  const halfwayY = goalIsBottom ? field.top : field.bottom;
  const cx = fieldCenterX;

  // 하프라인 + 센터서클 절반 (골대 쪽으로 볼록하게)
  ctx.beginPath();
  ctx.moveTo(field.left, halfwayY);
  ctx.lineTo(field.right, halfwayY);
  ctx.stroke();
  ctx.beginPath();
  if (goalIsBottom) ctx.arc(cx, halfwayY, centerCirclePx, 0, Math.PI);
  else ctx.arc(cx, halfwayY, centerCirclePx, Math.PI, Math.PI * 2);
  ctx.stroke();

  // 페널티 박스 / 골 에어리어
  const boxRectY = goalIsBottom ? goalY - boxDepthPx : goalY;
  ctx.strokeRect(cx - boxWidthPx / 2, boxRectY, boxWidthPx, boxDepthPx);
  const smallBoxRectY = goalIsBottom ? goalY - smallBoxDepthPx : goalY;
  ctx.strokeRect(cx - smallBoxWidthPx / 2, smallBoxRectY, smallBoxWidthPx, smallBoxDepthPx);

  // 페널티 스팟 + 아크
  const spotY = goalIsBottom ? goalY - penaltySpotPx : goalY + penaltySpotPx;
  ctx.beginPath();
  ctx.arc(cx, spotY, 2.5, 0, Math.PI * 2);
  ctx.fill();
  const arcCenterAngle = goalIsBottom ? -Math.PI / 2 : Math.PI / 2;
  ctx.beginPath();
  ctx.arc(cx, spotY, centerCirclePx, arcCenterAngle - penaltyArcHalfAngle, arcCenterAngle + penaltyArcHalfAngle);
  ctx.stroke();

  // 골라인 쪽 코너 아크 2개만
  const allCorners = [[field.left, field.top, 0, 0.5], [field.right, field.top, 0.5, 1], [field.left, field.bottom, -0.5, 0], [field.right, field.bottom, 1, 1.5]];
  allCorners.filter(([, cy2]) => cy2 === goalY).forEach(([cx2, cy2, a0, a1]) => {
    ctx.beginPath();
    ctx.arc(cx2, cy2, cornerArcPx, a0 * Math.PI, a1 * Math.PI);
    ctx.stroke();
  });

  drawGoalMouthHorizontal(goalY, cx, goalIsBottom ? 1 : -1);
}

const GOAL_DEPTH = 18;

function drawGoalNet(x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x, y, w, h);
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  const step = 4;
  for (let d = -h; d < w + h; d += step) {
    ctx.moveTo(x + d, y);
    ctx.lineTo(x + d + h, y + h);
    ctx.moveTo(x + d + h, y);
    ctx.lineTo(x + d, y + h);
  }
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawGoalMouth(lineX, cy, dir) {
  const half = goalWidthPx / 2;
  drawGoalNet(dir > 0 ? lineX : lineX - GOAL_DEPTH, cy - half, GOAL_DEPTH, half * 2);
}

function drawGoalMouthHorizontal(lineY, cx, dir) {
  const half = goalWidthPx / 2;
  drawGoalNet(cx - half, dir > 0 ? lineY : lineY - GOAL_DEPTH, half * 2, GOAL_DEPTH);
}

function drawGrid() {
  if (!state.showGrid) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  for (let x = field.left; x <= field.right; x += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, field.top);
    ctx.lineTo(x, field.bottom);
    ctx.stroke();
  }
  for (let y = field.top; y <= field.bottom; y += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(field.left, y);
    ctx.lineTo(field.right, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

// lengthZones = 공격-미들-수비 (골대 방향 축), widthZones = 왼쪽-중앙-오른쪽 (터치라인 방향 축)
// 정규 축구장(가로)에서는 lengthZones가 x축, widthZones가 y축을 나누지만
// 하프 코트(세로)에서는 실제 골대 방향이 y축이 되므로 반대로 나눠야 한다.
function drawZones() {
  const { lengthZones, widthZones } = state.zones;
  if (!lengthZones && !widthZones) return;

  const isHalf = state.pitchMode === 'half';

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,80,0.55)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 6]);
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';

  // ---- 공격-미들-수비 ----
  if (lengthZones >= 3) {
    const labels = lengthZones === 3 ? ['수비', '미들', '공격'] : Array.from({ length: lengthZones }, (_, i) => `구역${i + 1}`);
    if (!isHalf) {
      for (let i = 1; i < lengthZones; i++) {
        const lx = field.left + (fieldW * i) / lengthZones;
        ctx.beginPath();
        ctx.moveTo(lx, field.top);
        ctx.lineTo(lx, field.bottom);
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let i = 0; i < lengthZones; i++) {
        const cx = field.left + (fieldW * (i + 0.5)) / lengthZones;
        ctx.fillText(labels[i], cx, field.top + 6);
      }
    } else {
      const goalIsBottom = state.halfGoalPos !== 'top';
      for (let i = 1; i < lengthZones; i++) {
        const ly = field.top + (fieldH * i) / lengthZones;
        ctx.beginPath();
        ctx.moveTo(field.left, ly);
        ctx.lineTo(field.right, ly);
        ctx.stroke();
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < lengthZones; i++) {
        const labelIdx = goalIsBottom ? (lengthZones - 1 - i) : i;
        const cy = field.top + (fieldH * (i + 0.5)) / lengthZones;
        ctx.fillText(labels[labelIdx], field.left + 6, cy);
      }
    }
  }

  // ---- 왼쪽-중앙-오른쪽 ----
  if (widthZones >= 3) {
    const labels = widthZones === 3 ? ['왼쪽', '중앙', '오른쪽'] : Array.from({ length: widthZones }, (_, i) => `구역${i + 1}`);
    if (!isHalf) {
      for (let i = 1; i < widthZones; i++) {
        const ly = field.top + (fieldH * i) / widthZones;
        ctx.beginPath();
        ctx.moveTo(field.left, ly);
        ctx.lineTo(field.right, ly);
        ctx.stroke();
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < widthZones; i++) {
        const cy = field.top + (fieldH * (i + 0.5)) / widthZones;
        ctx.fillText(labels[i], field.left + 6, cy);
      }
    } else {
      for (let i = 1; i < widthZones; i++) {
        const lx = field.left + (fieldW * i) / widthZones;
        ctx.beginPath();
        ctx.moveTo(lx, field.top);
        ctx.lineTo(lx, field.bottom);
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let i = 0; i < widthZones; i++) {
        const cx = field.left + (fieldW * (i + 0.5)) / widthZones;
        ctx.fillText(labels[i], cx, field.top + 6);
      }
    }
  }

  ctx.setLineDash([]);
  ctx.restore();
}

function drawLine(arrow, highlighted) {
  const pts = arrow.points;
  if (pts.length < 2) return;
  if (highlighted) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.95)';
    ctx.shadowBlur = 12;
    drawLine(arrow, false);
    ctx.restore();
    return;
  }
  ctx.strokeStyle = arrow.color;
  ctx.fillStyle = arrow.color;
  ctx.lineWidth = 3;
  ctx.setLineDash(arrow.type === 'dashed' || arrow.type === 'freehand-dashed' ? [10, 8] : []);
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.setLineDash([]);

  if (arrow.hasArrow === false) return;

  const p1 = pts[pts.length - 2];
  const p2 = pts[pts.length - 1];
  const headLen = 12;
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  ctx.beginPath();
  ctx.moveTo(p2.x, p2.y);
  ctx.lineTo(p2.x - headLen * Math.cos(angle - Math.PI / 6), p2.y - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(p2.x - headLen * Math.cos(angle + Math.PI / 6), p2.y - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

const VEST_COLORS = {
  yellow: 'rgba(255,235,59,0.55)',
  red: 'rgba(229,57,53,0.55)',
  orange: 'rgba(251,140,0,0.55)',
  blue: 'rgba(30,136,229,0.55)',
};

function playerRadius(p) {
  return PLAYER_R * (p.scale || 1);
}

function drawPlayer(p, color, crestImg) {
  const r = playerRadius(p);
  drawShadow(p.x, p.y + r * 0.75, r * 0.9, r * 0.35);

  if (crestImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(crestImg, p.x - r, p.y - r, r * 2, r * 2);
    ctx.restore();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const grad = ctx.createRadialGradient(p.x - 4, p.y - 4, 2, p.x, p.y, r);
    grad.addColorStop(0, shadeColor(color, 0.35));
    grad.addColorStop(1, shadeColor(color, -0.15));
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }

  if (p.vest && VEST_COLORS[p.vest]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = VEST_COLORS[p.vest];
    ctx.fill();
  }

  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2.5;
  ctx.font = `bold ${Math.round(11 * (p.scale || 1))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(p.num, p.x, p.y);
  ctx.fillText(p.num, p.x, p.y);
}

// ---- 팀 마크 이미지 ----
const teamCrestImages = {};
function getTeamCrestImage(team) {
  if (!team.crest) return null;
  const cached = teamCrestImages[team.id];
  if (cached && cached.src === team.crest) return cached.loaded ? cached.img : null;
  const img = new Image();
  const entry = { img, src: team.crest, loaded: false };
  teamCrestImages[team.id] = entry;
  img.onload = () => { entry.loaded = true; render(); };
  img.src = team.crest;
  return null;
}

function drawRegularPolygon(cx, cy, radius, sides, rotation) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const ang = rotation + (i * 2 * Math.PI) / sides;
    const px = cx + radius * Math.cos(ang);
    const py = cy + radius * Math.sin(ang);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function colorLuminance(hex) {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// 전형적인 축구공 디자인: 흰/검정 오각형 패턴 + 입체감 있는 구형 음영
function drawBallShape(x, y, color) {
  const r = EQUIP_R.ball - 2;
  drawShadow(x, y + r * 0.8, r * 0.9, r * 0.3);

  const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.12, x, y, r * 1.1);
  grad.addColorStop(0, shadeColor(color, 0.55));
  grad.addColorStop(0.55, color);
  grad.addColorStop(1, shadeColor(color, -0.4));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.stroke();

  const isLight = colorLuminance(color) > 0.5;
  const patternColor = isLight ? 'rgba(20,20,20,0.92)' : 'rgba(245,245,245,0.92)';

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = patternColor;

  const pentR = r * 0.42;
  drawRegularPolygon(x, y, pentR, 5, -Math.PI / 2);

  for (let i = 0; i < 5; i++) {
    const edgeAng = -Math.PI / 2 + Math.PI / 5 + (i * 2 * Math.PI) / 5;
    const dist = pentR * 1.62;
    const px = x + Math.cos(edgeAng) * dist;
    const py = y + Math.sin(edgeAng) * dist;
    drawRegularPolygon(px, py, pentR * 0.94, 5, edgeAng + Math.PI / 2);
  }
  ctx.restore();
}

function drawMarkerShape(x, y, color) {
  drawShadow(x, y + 3, 11, 3.5);
  const grad = ctx.createLinearGradient(x, y - 4, x, y + 4);
  grad.addColorStop(0, shadeColor(color, 0.35));
  grad.addColorStop(1, shadeColor(color, -0.2));
  ctx.beginPath();
  ctx.ellipse(x, y, 10, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y - 1, 6.5, 1.8, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawConeShape(x, y, color) {
  const topY = y - 11, baseY = y + 9, baseW = 9, topW = 2;
  drawShadow(x, baseY + 1, baseW + 2, 3.2);
  const grad = ctx.createLinearGradient(x - baseW, y, x + baseW, y);
  grad.addColorStop(0, shadeColor(color, -0.25));
  grad.addColorStop(0.5, shadeColor(color, 0.25));
  grad.addColorStop(1, shadeColor(color, -0.25));
  ctx.beginPath();
  ctx.moveTo(x - topW, topY);
  ctx.lineTo(x + topW, topY);
  ctx.lineTo(x + baseW, baseY);
  ctx.lineTo(x - baseW, baseY);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const stripeY = topY + (baseY - topY) * 0.55;
  const stripeHalfW = topW + (baseW - topW) * 0.45;
  ctx.fillRect(x - stripeHalfW, stripeY - 2, stripeHalfW * 2, 3.5);

  ctx.beginPath();
  ctx.ellipse(x, baseY, baseW, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = shadeColor(color, -0.3);
  ctx.fill();
}

function drawMannequinShape(x, y, color) {
  drawShadow(x, y + 16, 12, 4);
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 10, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#222';
  ctx.fill();

  const grad = ctx.createLinearGradient(x - 7, y, x + 7, y);
  grad.addColorStop(0, shadeColor(color, -0.2));
  grad.addColorStop(0.5, shadeColor(color, 0.25));
  grad.addColorStop(1, shadeColor(color, -0.2));
  roundRectPath(x - 7, y - 6, 14, 20, 5);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.stroke();

  ctx.strokeStyle = shadeColor(color, -0.15);
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 7, y - 2); ctx.lineTo(x - 12, y + 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 7, y - 2); ctx.lineTo(x + 12, y + 8); ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y - 12, 6, 0, Math.PI * 2);
  ctx.fillStyle = shadeColor(color, 0.15);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.stroke();
}

function drawPoleShape(x, y, color) {
  drawShadow(x, y + 15, 7, 3);
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 6, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#333';
  ctx.fill();

  const grad = ctx.createLinearGradient(x - 2, y, x + 2, y);
  grad.addColorStop(0, shadeColor(color, -0.3));
  grad.addColorStop(0.5, shadeColor(color, 0.35));
  grad.addColorStop(1, shadeColor(color, -0.3));
  ctx.fillStyle = grad;
  ctx.fillRect(x - 2, y - 18, 4, 32);
  ctx.lineWidth = 0.75;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.strokeRect(x - 2, y - 18, 4, 32);

  ctx.beginPath();
  ctx.arc(x, y - 18, 3, 0, Math.PI * 2);
  ctx.fillStyle = shadeColor(color, 0.4);
  ctx.fill();
}

function drawGoalShape(x, y, color, w, h) {
  ctx.save();
  ctx.translate(x, y);

  drawShadow(0, h / 2 + 3, w / 2 + 4, 5);

  ctx.save();
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let i = -h; i < w; i += 7) {
    ctx.beginPath();
    ctx.moveTo(-w / 2 + i, -h / 2);
    ctx.lineTo(-w / 2 + i + h, h / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w / 2 + i + h, -h / 2);
    ctx.lineTo(-w / 2 + i, h / 2);
    ctx.stroke();
  }
  ctx.restore();

  const postGrad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  postGrad.addColorStop(0, shadeColor(color, 0.5));
  postGrad.addColorStop(0.5, color);
  postGrad.addColorStop(1, shadeColor(color, -0.3));
  ctx.strokeStyle = postGrad;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.strokeRect(-w / 2, -h / 2, w, h);

  ctx.restore();
}

function drawEquipmentItem(e) {
  const s = e.scale || 1;
  const rot = e.rot || 0;
  ctx.save();
  if (s !== 1 || rot) {
    ctx.translate(e.x, e.y);
    if (rot) ctx.rotate(rot);
    if (s !== 1) ctx.scale(s, s);
    ctx.translate(-e.x, -e.y);
  }
  if (e.type === 'ball') drawBallShape(e.x, e.y, e.color);
  else if (e.type === 'marker') drawMarkerShape(e.x, e.y, e.color);
  else if (e.type === 'cone') drawConeShape(e.x, e.y, e.color);
  else if (e.type === 'mannequin') drawMannequinShape(e.x, e.y, e.color);
  else if (e.type === 'pole') drawPoleShape(e.x, e.y, e.color);
  else if (e.type === 'goal') drawGoalShape(e.x, e.y, e.color, GOAL_BASE_W, GOAL_BASE_H);
  ctx.restore();
}

function drawSelectionOutline(e) {
  const s = e.scale || 1;
  ctx.save();
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  if (e.type === 'goal') {
    ctx.translate(e.x, e.y);
    ctx.rotate(e.rot || 0);
    const w = GOAL_BASE_W * s, h = GOAL_BASE_H * s;
    ctx.strokeRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
  } else {
    ctx.beginPath();
    ctx.arc(e.x, e.y, equipRadius(e) + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function drawText(t) {
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  t._w = ctx.measureText(t.text).width;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(t.text, t.x, t.y);
  ctx.fillStyle = '#fff';
  ctx.fillText(t.text, t.x, t.y);
}

function render() {
  ctx.setTransform(backingScale, 0, 0, backingScale, 0, 0);
  drawField();
  drawGrid();
  drawZones();
  state.arrows.forEach((a, i) => drawLine(a, dragLine && dragLine.index === i));
  if (currentDraw) drawLine(currentDraw);
  state.equipment.forEach(e => drawEquipmentItem(e));
  if (selectedEquipId) {
    const sel = state.equipment.find(e => e.id === selectedEquipId);
    if (sel) drawSelectionOutline(sel);
  }
  state.teams.forEach(team => {
    const crestImg = getTeamCrestImage(team);
    team.players.forEach(p => drawPlayer(p, team.color, crestImg));
  });
  state.texts.forEach(t => drawText(t));
}

// ---- 좌표 변환 ----
// 휴대폰을 세로로 든 상태에서는 화면 전체(.rotate-wrap)를 CSS로 90도 돌려서 가로처럼 보여준다.
// 이때 터치 좌표(clientX/Y)는 '돌아가기 전' 화면 기준이라 x/y가 뒤바뀌어 들어오므로
// 캔버스 좌표로 바꿀 때 회전을 되돌려서 계산해야 한다. (CSS의 media query와 같은 조건)
const rotatedMQ = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
function isRotated() { return rotatedMQ.matches; }

// rotate(90deg) translateY(-100%) 기준: 화면 (sx, sy) -> 회전 전 로컬 (sy, 폭 - sx)
function clientToCanvas(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  if (isRotated()) {
    return {
      x: (clientY - rect.top) / rect.height * W,
      y: (rect.right - clientX) / rect.width * H,
    };
  }
  return {
    x: (clientX - rect.left) / rect.width * W,
    y: (clientY - rect.top) / rect.height * H,
  };
}

// 화면에서 손가락이 움직인 양(dx, dy)을 회전 전 방향 기준으로 바꾼다 (스크롤/이미지 자르기용)
function screenDeltaToLocal(dx, dy) {
  return isRotated() ? { dx: dy, dy: -dx } : { dx, dy };
}

function getPos(evt) {
  const { clientX, clientY } = getClientXY(evt);
  return clientToCanvas(clientX, clientY);
}

function getClientXY(evt) {
  const t = evt.touches && evt.touches[0] ? evt.touches[0]
    : (evt.changedTouches && evt.changedTouches[0] ? evt.changedTouches[0] : evt);
  return { clientX: t.clientX, clientY: t.clientY };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ---- 하단 시트 (탭 전환 + 열고 닫기) ----
const bottomSheet = document.getElementById('bottomSheet');
let bottomSheetOpen = false;

let currentSheetTab = null;

function openSheet(name) {
  currentSheetTab = name;
  document.querySelectorAll('.rail-btn[data-tab], .sheet-nav-btn[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
  bottomSheet.classList.add('open');
  bottomSheetOpen = true;
}

function closeSheet() {
  currentSheetTab = null;
  document.querySelectorAll('.rail-btn[data-tab]').forEach(b => b.classList.remove('active'));
  bottomSheet.classList.remove('open');
  bottomSheetOpen = false;
}

document.querySelectorAll('.sheet-nav-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => openSheet(btn.dataset.tab));
});

document.getElementById('sheetGrabber').addEventListener('click', closeSheet);
document.getElementById('sheetCloseBtn').addEventListener('click', closeSheet);

// ---- 직접 그리는 선택 메뉴 ----
// 휴대폰 기본 선택창(<select>)은 CSS로 돌린 화면을 따라오지 않고 세로로 떠버리므로,
// <select>는 숨겨두고(값/이벤트는 그대로 사용) 앱 안에서 메뉴를 그린다.
const selectMenu = document.getElementById('selectMenu');
const rotateWrapEl = document.getElementById('rotateWrap');
let openSelect = null;

const CARET_SVG = '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';

function selectLabel(sel) {
  const opt = sel.options[sel.selectedIndex];
  return opt ? opt.textContent : '';
}

function enhanceSelects(root) {
  root.querySelectorAll('select:not(.native-hidden)').forEach(sel => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cselect-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.innerHTML = `<span class="cselect-label"></span>${CARET_SVG}`;
    btn._select = sel;
    sel._cbtn = btn;
    sel.classList.add('native-hidden');
    sel.after(btn);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (openSelect === sel) closeSelectMenu();
      else openSelectMenu(sel);
    });
    refreshSelectButton(sel);
  });
}

function refreshSelectButton(sel) {
  if (sel._cbtn) sel._cbtn.querySelector('.cselect-label').textContent = selectLabel(sel);
}

function refreshCustomSelects() {
  document.querySelectorAll('select.native-hidden').forEach(refreshSelectButton);
}

// 요소의 화면 위치를 회전 전(rotate-wrap 안쪽) 좌표로 바꾼다
function rectInWrap(el) {
  const r = el.getBoundingClientRect();
  const wr = rotateWrapEl.getBoundingClientRect();
  if (isRotated()) {
    return { left: r.top - wr.top, top: wr.right - r.right, width: r.height, height: r.width };
  }
  return { left: r.left - wr.left, top: r.top - wr.top, width: r.width, height: r.height };
}

function openSelectMenu(sel) {
  closeSelectMenu();
  openSelect = sel;
  sel._cbtn.classList.add('open');
  selectMenu.innerHTML = [...sel.options]
    .filter(o => !o.hidden && !o.disabled)
    .map(o => `<button type="button" role="option" data-value="${escapeHtml(o.value)}" class="${o.value === sel.value ? 'selected' : ''}">${escapeHtml(o.textContent)}</button>`)
    .join('');
  selectMenu.classList.add('open');

  const b = rectInWrap(sel._cbtn);
  const wrapW = rotateWrapEl.clientWidth, wrapH = rotateWrapEl.clientHeight;
  selectMenu.style.minWidth = b.width + 'px';
  const menuW = selectMenu.offsetWidth;
  const menuH = selectMenu.offsetHeight;
  const left = Math.min(Math.max(8, b.left), wrapW - menuW - 8);
  let top = b.top + b.height + 6;
  if (top + menuH > wrapH - 8) top = Math.max(8, b.top - menuH - 6);
  selectMenu.style.left = left + 'px';
  selectMenu.style.top = top + 'px';
}

function closeSelectMenu() {
  if (openSelect && openSelect._cbtn) openSelect._cbtn.classList.remove('open');
  openSelect = null;
  selectMenu.classList.remove('open');
}

selectMenu.addEventListener('click', (e) => {
  const item = e.target.closest('[data-value]');
  if (!item || !openSelect) return;
  const sel = openSelect;
  closeSelectMenu();
  if (sel.value !== item.dataset.value) {
    sel.value = item.dataset.value;
    refreshSelectButton(sel);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
});

document.addEventListener('pointerdown', (e) => {
  if (!openSelect) return;
  if (selectMenu.contains(e.target) || (openSelect._cbtn && openSelect._cbtn.contains(e.target))) return;
  closeSelectMenu();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSelectMenu(); });

// 다른 곳에서 특정 탭을 열어야 할 때 쓰는 함수 (예: 저장 불러오기 후 팀 탭 유지 등)
function switchTab(name) {
  openSheet(name);
}

document.querySelectorAll('.rail-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (bottomSheetOpen && btn.classList.contains('active')) {
      closeSheet();
    } else {
      openSheet(btn.dataset.tab);
    }
  });
});

// ---- 상단 바 (실행취소/다시실행/공유/저장/설정) ----
document.getElementById('undoTopBtn').addEventListener('click', undo);
document.getElementById('redoTopBtn').addEventListener('click', redo);
document.getElementById('saveTopBtn').addEventListener('click', () => openSheet('save'));
document.getElementById('settingsTopBtn').addEventListener('click', () => openSheet('option'));
document.getElementById('shareTopBtn').addEventListener('click', () => {
  openSheet('save');
  document.getElementById('makeShareLinkBtn').click();
});

// 상단 포메이션 알약: 선택된 팀(없으면 새 팀)에 바로 배치
const topFormationSelect = document.getElementById('topFormationSelect');
topFormationSelect.innerHTML = '<option value="" disabled selected hidden>포메이션</option>' +
  FORMATION_KEYS.map(k => `<option value="${k}">${FORMATION_LABELS[k]}</option>`).join('');
topFormationSelect.addEventListener('change', () => {
  const key = topFormationSelect.value;
  if (!key) return;
  if (state.teams.length === 0) addTeam();
  const team = findTeam(selectedTeamId) || state.teams[0];
  applyFormationToTeam(team.id, key);
});

// ---- 잠깐 떴다 사라지는 안내 ----
const toastEl = document.getElementById('toast');
let toastTimer = null;
function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
}

// 지우개 모드: 켜둔 상태에서 선수/용품/텍스트/선을 터치(또는 문지르기)하면 지워진다
document.getElementById('railEraseBtn').addEventListener('click', () => {
  if (mode === 'erase') {
    mode = 'move';
  } else {
    mode = 'erase';
    showToast('지울 것을 터치하세요 · 문지르면 여러 개 지워져요');
  }
  refreshModeButtons();
});

// ---- 오른쪽 떠 있는 버튼: 풀코트/하프코트, 격자 ----
const courtToggleBtn = document.getElementById('courtToggleBtn');
const courtToggleLabel = document.getElementById('courtToggleLabel');
const gridQuickBtn = document.getElementById('gridQuickBtn');

function syncQuickButtons() {
  if (state.pitchMode === 'half') {
    courtToggleLabel.textContent = state.halfGoalPos === 'top' ? '하프 ▲' : '하프 ▼';
  } else {
    courtToggleLabel.textContent = '풀';
  }
  courtToggleBtn.classList.toggle('active', state.pitchMode === 'half');
  courtToggleBtn.title = '누를 때마다: 풀코트 → 하프(골대 아래) → 하프(골대 위)';
  gridQuickBtn.classList.toggle('active', !!state.showGrid);
}

// 풀코트 → 하프(골대 아래) → 하프(골대 위) → 풀코트 순서로 바뀐다
courtToggleBtn.addEventListener('click', () => {
  if (state.pitchMode === 'full') changePitchMode('half', 'bottom');
  else if (state.halfGoalPos === 'bottom') changePitchMode('half', 'top');
  else changePitchMode('full', state.halfGoalPos);
  syncPitchModeUI();
  syncQuickButtons();
  showToast(state.pitchMode === 'full' ? '풀코트' : (state.halfGoalPos === 'top' ? '하프코트 · 골대 위' : '하프코트 · 골대 아래'));
});

gridQuickBtn.addEventListener('click', () => {
  document.getElementById('gridToggleBtn').click();
});

// ---- 왼쪽 레일의 이동/그리기 모드 바로가기 ----
document.getElementById('railMoveBtn').addEventListener('click', () => {
  if (mode !== 'move') { mode = 'move'; refreshModeButtons(); }
});
document.getElementById('railDrawBtn').addEventListener('click', () => {
  if (mode !== 'draw') { mode = 'draw'; refreshModeButtons(); }
});

// ---- 삭제 공통 로직 (더블클릭 / 길게 누르기 / 삭제 영역 드롭에서 공용) ----
function deleteTarget(t) {
  if (t.kind === 'player') {
    const team = state.teams[t.teamIndex];
    team.players = team.players.filter(p => p.id !== t.ref.id);
    renderTeamsPanel();
  } else if (t.kind === 'equipment') {
    if (selectedEquipId === t.ref.id) { selectedEquipId = null; updateEquipControlsVisibility(); }
    state.equipment = state.equipment.filter(e => e.id !== t.ref.id);
  } else if (t.kind === 'text') {
    state.texts = state.texts.filter(x2 => x2.id !== t.ref.id);
    renderTextList();
  }
}

function deleteAt(x, y, tolerance = 4) {
  const t = findTargetAt(x, y, tolerance);
  if (t) {
    deleteTarget(t);
    render();
    return true;
  }
  const ai = findArrowIndexAt(x, y, tolerance + 6);
  if (ai >= 0) {
    state.arrows.splice(ai, 1);
    render();
    return true;
  }
  return false;
}

// ---- 삭제 영역 (드래그해서 끌어다 놓으면 삭제) ----
const trashZone = document.getElementById('trashZone');

function pointInRect(px, py, rect) {
  return px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom;
}

function isOverTrash(clientX, clientY) {
  if (!trashZone.classList.contains('active')) return false;
  return pointInRect(clientX, clientY, trashZone.getBoundingClientRect());
}

// ---- 길게 누르기 (터치에서 더블클릭 대신 삭제) ----
let longPressTimer = null;
let longPressStart = null;

function cancelLongPress() {
  clearTimeout(longPressTimer);
  longPressTimer = null;
  longPressStart = null;
}

// ---- 포인터 이벤트 ----
function onDown(evt) {
  evt.preventDefault();
  const { x, y } = getPos(evt);
  isPointerDown = true;
  dragIsTouch = !!evt.touches;

  if (mode === 'erase') {
    eraseAt(x, y);
    return;
  }

  if (mode === 'move') {
    dragTarget = findTargetAt(x, y, dragIsTouch ? TOUCH_HIT_TOLERANCE : 4);
    if (dragTarget && dragTarget.kind === 'equipment') {
      selectedEquipId = dragTarget.ref.id;
    } else {
      selectedEquipId = null;
    }
    updateEquipControlsVisibility();

    // 선수/용품/텍스트가 없으면 선을 잡아서 통째로 옮길 수 있다
    dragLine = null;
    if (!dragTarget) {
      const ai = findArrowIndexAt(x, y, dragIsTouch ? 16 : 8);
      if (ai >= 0) dragLine = { index: ai, lastX: x, lastY: y };
    }

    if (dragTarget || dragLine) {
      trashZone.classList.add('active');
    }

    if (evt.touches) {
      const { clientX, clientY } = getClientXY(evt);
      longPressStart = { clientX, clientY, x, y };
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        if (!longPressStart) return;
        const deleted = deleteAt(longPressStart.x, longPressStart.y, TOUCH_HIT_TOLERANCE);
        if (deleted) {
          dragTarget = null;
          dragLine = null;
          isPointerDown = false;
          trashZone.classList.remove('active', 'hover');
          render();
          checkpoint();
        }
        longPressStart = null;
      }, 550);
    }

    render();
  } else {
    const type = selectedLineType;
    const isFreehand = type === 'freehand' || type === 'freehand-dashed';
    const hasArrow = selectedLineArrow === 'arrow';
    const p0 = maybeSnap(x, y);
    currentDraw = isFreehand
      ? { type, color: selectedLineColor, hasArrow, points: [{ x, y }] }
      : { type, color: selectedLineColor, hasArrow, points: [p0, p0] };
  }
}

function eraseAt(x, y) {
  deleteAt(x, y, dragIsTouch ? TOUCH_HIT_TOLERANCE : 6);
}

function onMove(evt) {
  if (!isPointerDown) return;
  evt.preventDefault();
  const { x, y } = getPos(evt);

  if (mode === 'erase') {
    eraseAt(x, y);
    return;
  }

  if (longPressStart) {
    const { clientX, clientY } = getClientXY(evt);
    if (Math.hypot(clientX - longPressStart.clientX, clientY - longPressStart.clientY) > 8) {
      cancelLongPress();
    }
  }

  if (mode === 'move' && dragTarget) {
    const { clientX, clientY } = getClientXY(evt);
    trashZone.classList.toggle('hover', isOverTrash(clientX, clientY));

    const lift = dragIsTouch ? TOUCH_DRAG_LIFT : 0;
    const snapped = maybeSnap(clamp(x, 10, W - 10), clamp(y - lift, 10, H - 10));
    dragTarget.ref.x = snapped.x;
    dragTarget.ref.y = snapped.y;
    render();
  } else if (mode === 'move' && dragLine) {
    const { clientX, clientY } = getClientXY(evt);
    trashZone.classList.toggle('hover', isOverTrash(clientX, clientY));
    const arrow = state.arrows[dragLine.index];
    if (arrow) {
      const dx = x - dragLine.lastX, dy = y - dragLine.lastY;
      arrow.points.forEach(p => { p.x += dx; p.y += dy; });
      dragLine.lastX = x;
      dragLine.lastY = y;
      render();
    }
  } else if (mode === 'draw' && currentDraw) {
    if (currentDraw.type === 'freehand' || currentDraw.type === 'freehand-dashed') {
      const last = currentDraw.points[currentDraw.points.length - 1];
      if (Math.hypot(x - last.x, y - last.y) > 4) currentDraw.points.push({ x, y });
    } else {
      currentDraw.points[1] = maybeSnap(x, y);
    }
    render();
  }
}

function onUp(evt) {
  if (!isPointerDown) return;
  isPointerDown = false;
  cancelLongPress();

  if (mode === 'move' && (dragTarget || dragLine)) {
    const { clientX, clientY } = getClientXY(evt);
    if (isOverTrash(clientX, clientY)) {
      if (dragTarget) deleteTarget(dragTarget);
      else state.arrows.splice(dragLine.index, 1);
    }
  }
  dragLine = null;
  trashZone.classList.remove('active', 'hover');

  if (mode === 'draw' && currentDraw) {
    let valid;
    if (currentDraw.type === 'freehand' || currentDraw.type === 'freehand-dashed') {
      valid = currentDraw.points.length >= 2;
    } else {
      const [p1, p2] = currentDraw.points;
      valid = Math.hypot(p2.x - p1.x, p2.y - p1.y) > 10;
    }
    if (valid) {
      state.arrows.push(currentDraw);
    }
    currentDraw = null;
  }
  dragTarget = null;
  render();
  checkpoint();
}

// ---- 확대/축소 (버튼 + 핀치 줌) ----
const boardWrap = document.getElementById('boardWrap');
const zoomLabel = document.getElementById('zoomLabel');
const ZOOM_MIN = 1, ZOOM_MAX = 5;
let zoomLevel = 1;
let pinchState = null;
const stageEl = document.querySelector('.stage');

// 확대 1배 = 남는 공간을 꽉 채우는 크기. 확대는 이 크기를 기준으로 부드럽게 커진다.
function fittedCanvasSize() {
  const cw = boardWrap.clientWidth, ch = boardWrap.clientHeight;
  if (cw < 20 || ch < 20) return { w: W, h: H };
  const s = Math.min(cw / W, ch / H);
  return { w: Math.floor(W * s), h: Math.floor(H * s) };
}

// 화면에 보이는 크기 x 기기 해상도만큼 캔버스 픽셀을 늘려 선이 흐려지지 않게 한다 (메모리 때문에 최대 3배)
function updateBackingScale(cssScale) {
  const k = Math.min(3, Math.max(1, (window.devicePixelRatio || 1) * cssScale));
  const next = Math.round(k * 4) / 4;
  if (next === backingScale) return;
  backingScale = next;
  canvas.width = Math.round(W * backingScale);
  canvas.height = Math.round(H * backingScale);
  render();
}

function applyZoomStyle() {
  const fit = fittedCanvasSize();
  canvas.style.maxWidth = 'none';
  canvas.style.maxHeight = 'none';
  canvas.style.width = (fit.w * zoomLevel) + 'px';
  canvas.style.height = (fit.h * zoomLevel) + 'px';
  updateBackingScale(fit.w * zoomLevel / W);
  zoomLabel.textContent = Math.round(zoomLevel * 100) + '%';
}

// boardWrap 기준(회전 전) 좌표. 화면이 90도 돌아가 있으면 되돌려서 계산한다.
function clientToWrapLocal(clientX, clientY) {
  const r = boardWrap.getBoundingClientRect();
  return isRotated()
    ? { x: clientY - r.top, y: r.right - clientX }
    : { x: clientX - r.left, y: clientY - r.top };
}

// focal(boardWrap 화면 안의 한 점) 아래에 있던 필드 지점이 확대 후에도 그 자리에 있도록 확대한다.
function canvasFractionAt(focal) {
  return {
    u: (boardWrap.scrollLeft + focal.x - canvas.offsetLeft) / canvas.offsetWidth,
    v: (boardWrap.scrollTop + focal.y - canvas.offsetTop) / canvas.offsetHeight,
  };
}

function keepFractionAt(frac, focal) {
  boardWrap.scrollLeft = canvas.offsetLeft + frac.u * canvas.offsetWidth - focal.x;
  boardWrap.scrollTop = canvas.offsetTop + frac.v * canvas.offsetHeight - focal.y;
}

function setZoom(z, focal) {
  const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  const f = focal || { x: boardWrap.clientWidth / 2, y: boardWrap.clientHeight / 2 };
  const frac = canvasFractionAt(f);
  zoomLevel = next;
  applyZoomStyle();
  keepFractionAt(frac, f);
}

if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(() => applyZoomStyle()).observe(boardWrap);
} else {
  window.addEventListener('resize', () => applyZoomStyle());
}

// 오른쪽 +/− 버튼: 한 번 누르면 한 단계, 누르고 있으면 계속 부드럽게 확대/축소
function bindHoldZoom(btn, direction) {
  let raf = null, holdTimer = null, lastT = 0;
  const step = (t) => {
    const dt = lastT ? (t - lastT) / 1000 : 0;
    lastT = t;
    setZoom(zoomLevel * Math.exp(direction * 0.9 * dt));
    raf = requestAnimationFrame(step);
  };
  const stop = () => {
    clearTimeout(holdTimer);
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    lastT = 0;
  };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    setZoom(zoomLevel * (direction > 0 ? 1.25 : 0.8));
    holdTimer = setTimeout(() => { raf = requestAnimationFrame(step); }, 280);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
}

bindHoldZoom(document.getElementById('zoomInBtn'), 1);
bindHoldZoom(document.getElementById('zoomOutBtn'), -1);
document.getElementById('zoomResetBtn').addEventListener('click', () => {
  setZoom(1);
  boardWrap.scrollLeft = 0;
  boardWrap.scrollTop = 0;
});

// 트랙패드 두 손가락 확대(ctrl+휠)도 마우스 위치 기준으로 확대
boardWrap.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  setZoom(zoomLevel * Math.exp(-e.deltaY * 0.01), clientToWrapLocal(e.clientX, e.clientY));
}, { passive: false });

function touchDist(t1, t2) { return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY); }
function touchMid(t1, t2) { return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 }; }

// 두 손가락은 필드 밖 잔디에서도 확대/이동할 수 있게 stage 전체에서 받는다.
function handleTouchStart(evt) {
  if (evt.touches.length === 2) {
    evt.preventDefault();
    isPointerDown = false;
    dragTarget = null;
    dragLine = null;
    currentDraw = null;
    cancelLongPress();
    trashZone.classList.remove('active', 'hover');
    const mid = touchMid(evt.touches[0], evt.touches[1]);
    const focal = clientToWrapLocal(mid.x, mid.y);
    pinchState = {
      startDist: touchDist(evt.touches[0], evt.touches[1]),
      startZoom: zoomLevel,
      frac: canvasFractionAt(focal),
    };
    render();
    return;
  }
  if (evt.touches.length === 1 && evt.target === canvas) onDown(evt);
}

function handleTouchMove(evt) {
  if (evt.touches.length === 2 && pinchState) {
    evt.preventDefault();
    const dist = touchDist(evt.touches[0], evt.touches[1]);
    const mid = touchMid(evt.touches[0], evt.touches[1]);
    const focal = clientToWrapLocal(mid.x, mid.y);
    zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchState.startZoom * (dist / pinchState.startDist)));
    applyZoomStyle();
    keepFractionAt(pinchState.frac, focal);
    return;
  }
  if (evt.target === canvas || isPointerDown) onMove(evt);
}

function handleTouchEnd(evt) {
  if (evt.touches.length < 2) pinchState = null;
  onUp(evt);
}

canvas.addEventListener('mousedown', onDown);
canvas.addEventListener('mousemove', onMove);
window.addEventListener('mouseup', onUp);
stageEl.addEventListener('touchstart', handleTouchStart, { passive: false });
stageEl.addEventListener('touchmove', handleTouchMove, { passive: false });
window.addEventListener('touchend', handleTouchEnd);
window.addEventListener('touchcancel', handleTouchEnd);

canvas.addEventListener('dblclick', (evt) => {
  if (mode !== 'move') return;
  const { x, y } = getPos(evt);
  deleteAt(x, y);
  checkpoint();
});

// ---- 아이템 배치 공통 로직 (데스크톱 드래그 앤 드롭 + 모바일 터치 드래그 공용) ----
function placeItemAt(data, x, y) {
  const snapped = maybeSnap(clamp(x, 10, W - 10), clamp(y, 10, H - 10));
  if (data.kind === 'player') {
    if (totalPlayers() >= MAX_PLAYERS) {
      alert('선수는 최대 ' + MAX_PLAYERS + '명까지 배치할 수 있어요.');
      return;
    }
    const team = findTeam(data.teamId);
    if (!team) return;
    team.players.push({ id: nextId(), num: String(team.players.length + 1), x: snapped.x, y: snapped.y });
    renderTeamsPanel();
  } else if (data.kind === 'equipment') {
    const item = { id: nextId(), type: data.type, color: equipSelectedColor[data.type], x: snapped.x, y: snapped.y, rot: 0 };
    state.equipment.push(item);
  }
  render();
  checkpoint();
}

// ---- 팔레트 -> 필드 드래그 앤 드롭 (데스크톱, 마우스) ----
canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  const raw = e.dataTransfer.getData('text/plain');
  if (!raw) return;
  let data;
  try { data = JSON.parse(raw); } catch (err) { return; }
  const { x, y } = getPos(e);
  placeItemAt(data, x, y);
});

// ---- 팔레트 -> 필드 터치 드래그 (아이패드/휴대폰) ----
let touchDragData = null;
let ghostEl = null;

function moveGhost(clientX, clientY) {
  if (!ghostEl) return;
  ghostEl.style.left = clientX + 'px';
  ghostEl.style.top = clientY + 'px';
}

function startTouchDrag(payload, label, touch) {
  touchDragData = payload;
  ghostEl = document.createElement('div');
  ghostEl.className = 'touch-ghost';
  ghostEl.textContent = label;
  document.body.appendChild(ghostEl);
  moveGhost(touch.clientX, touch.clientY);
}

function endTouchDrag(touch) {
  if (!touchDragData) return;
  const rect = canvas.getBoundingClientRect();
  const { clientX, clientY } = touch;
  if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
    const { x, y } = clientToCanvas(clientX, clientY);
    placeItemAt(touchDragData, x, y);
  }
  if (ghostEl) { ghostEl.remove(); ghostEl = null; }
  touchDragData = null;
}

document.addEventListener('touchmove', (e) => {
  if (!touchDragData) return;
  e.preventDefault();
  moveGhost(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

document.addEventListener('touchend', (e) => {
  if (!touchDragData) return;
  endTouchDrag(e.changedTouches[0]);
});
document.addEventListener('touchcancel', () => {
  if (ghostEl) { ghostEl.remove(); ghostEl = null; }
  touchDragData = null;
});

// ---- 되돌리기 / 다시실행 (작전판 전체 상태 기준) ----
// 사용자 동작이 한 번 끝날 때마다(클릭, 값 변경, 드래그 종료 등) checkpoint()가 불리고,
// 직전에 저장해둔 상태와 달라졌으면 그 직전 상태를 history에 쌓는다.
const HISTORY_LIMIT = 60;
let redoStack = [];
let lastCommitted = null;

function snapshotState() {
  return JSON.stringify(state);
}

function checkpoint() {
  const now = snapshotState();
  if (lastCommitted === null || now === lastCommitted) {
    lastCommitted = now;
    return;
  }
  history.push(lastCommitted);
  if (history.length > HISTORY_LIMIT) history.shift();
  redoStack = [];
  lastCommitted = now;
  updateUndoButtons();
}

function resetHistory() {
  history = [];
  redoStack = [];
  lastCommitted = snapshotState();
  updateUndoButtons();
}

function restoreSnapshot(snap) {
  const prevMode = state.pitchMode;
  state = JSON.parse(snap);
  ensureStateDefaults();
  if (state.pitchMode !== prevMode) {
    setFieldGeometry();
    setZoom(1);
  }
  if (selectedEquipId && !state.equipment.some(e => e.id === selectedEquipId)) selectedEquipId = null;
  idCounter = Math.max(idCounter, Date.now());
  dragTarget = null;
  dragLine = null;
  currentDraw = null;
  renderTeamsPanel();
  renderTextList();
  syncZoneSelects();
  updateEquipControlsVisibility();
  render();
}

function undo() {
  checkpoint();
  if (history.length === 0) return;
  redoStack.push(lastCommitted);
  restoreSnapshot(history.pop());
  lastCommitted = snapshotState();
  updateUndoButtons();
}

function redo() {
  checkpoint();
  if (redoStack.length === 0) return;
  history.push(lastCommitted);
  restoreSnapshot(redoStack.pop());
  lastCommitted = snapshotState();
  updateUndoButtons();
}

function updateUndoButtons() {
  document.getElementById('undoTopBtn').disabled = history.length === 0;
  document.getElementById('redoTopBtn').disabled = redoStack.length === 0;
}

// 패널/버튼 조작이 끝난 뒤(각 버튼의 처리 다음에) 한 번씩 변경 여부를 기록한다.
document.addEventListener('click', () => checkpoint());
document.addEventListener('change', () => checkpoint());

// ---- 팀 패널 ----
const teamsPanel = document.getElementById('teamsPanel');
const totalCountEl = document.getElementById('totalCount');

const VEST_UI_COLORS = [
  { key: 'yellow', css: '#fdd835' },
  { key: 'red', css: '#e53935' },
  { key: 'orange', css: '#fb8c00' },
  { key: 'blue', css: '#1e88e5' },
];

const teamTabsEl = document.getElementById('teamTabs');
const matchBadgesEl = document.getElementById('matchBadges');
let selectedTeamId = null;

function teamName(index) {
  if (index === 0) return '우리팀';
  if (index === 1) return '상대팀';
  return '팀' + (index + 1);
}

function readableTextOn(hex) {
  return colorLuminance(hex) > 0.62 ? '#111' : '#fff';
}

const SHIELD_PATH = 'M17 2.5l12.5 4.2v9.6c0 8.4-5.4 14.4-12.5 18.2C9.9 30.7 4.5 24.7 4.5 16.3V6.7z';

function badgeHtml(team, index) {
  if (!team) {
    return `<button class="team-badge ghost" data-badge="add" title="팀 추가">
      <svg viewBox="0 0 34 38"><path d="${SHIELD_PATH}"/></svg>
    </button>`;
  }
  if (team.crest) {
    return `<button class="team-badge" data-badge="${team.id}" title="${teamName(index)}">
      <span class="crest-img" style="background-image:url('${team.crest}')"></span>
    </button>`;
  }
  return `<button class="team-badge" data-badge="${team.id}" title="${teamName(index)}">
    <svg viewBox="0 0 34 38"><path d="${SHIELD_PATH}" fill="${team.color}" stroke="rgba(255,255,255,0.85)" stroke-width="1.6"/>
    <path d="M17 9v18M10 14h14" stroke="${readableTextOn(team.color)}" stroke-opacity="0.35" stroke-width="1.6" stroke-linecap="round"/></svg>
  </button>`;
}

function renderMatchBadges() {
  const [a, b] = state.teams;
  matchBadgesEl.innerHTML = `${badgeHtml(a, 0)}<span class="match-vs">VS</span>${badgeHtml(b, 1)}`;
}

function renderTeamTabs() {
  teamTabsEl.innerHTML = state.teams.map((team, i) => {
    const dotStyle = team.crest ? `background-image:url('${team.crest}')` : `background:${team.color}`;
    return `<button class="team-tab${team.id === selectedTeamId ? ' active' : ''}" data-team-tab="${team.id}">
      <span class="team-dot" style="${dotStyle}"></span>${teamName(i)}<span class="team-tab-count">${team.players.length}</span>
    </button>`;
  }).join('');
  teamTabsEl.style.display = state.teams.length ? 'flex' : 'none';
}

function renderTeamsPanel() {
  renderTeamsPanelInner();
  enhanceSelects(teamsPanel);
  refreshSelectButton(topFormationSelect);
}

function renderTeamsPanelInner() {
  if (openSelect && teamsPanel.contains(openSelect)) closeSelectMenu();
  if (!findTeam(selectedTeamId)) selectedTeamId = state.teams.length ? state.teams[0].id : null;
  renderTeamTabs();
  renderMatchBadges();
  totalCountEl.textContent = totalPlayers();

  const index = state.teams.findIndex(t => t.id === selectedTeamId);
  const team = state.teams[index];
  if (!team) {
    topFormationSelect.value = '';
    teamsPanel.innerHTML = `<div class="card"><p class="empty-msg">아직 팀이 없어요. 오른쪽 위 "팀 추가"를 누르거나, 상단의 포메이션을 고르면 바로 선수가 배치돼요.</p></div>`;
    return;
  }

  const textColor = readableTextOn(team.color);
  const swatches = TEAM_PALETTE.map(c =>
    `<button class="swatch${c === team.color ? ' selected' : ''}" style="background:${c}" data-color="${c}" title="팀 색상"></button>`
  ).join('');
  const currentFormation = team.formation || '433';
  const formOptions = FORMATION_KEYS.map(k => `<option value="${k}"${k === currentFormation ? ' selected' : ''}>${FORMATION_LABELS[k]}</option>`).join('');
  topFormationSelect.value = team.formation || '';
  const playerRows = team.players.map(p => {
    const vestSwatches = `<button class="vest-swatch none-swatch${!p.vest ? ' selected' : ''}" data-vest="" title="조끼 없음">–</button>` +
      VEST_UI_COLORS.map(v => `<button class="vest-swatch${p.vest === v.key ? ' selected' : ''}" style="background:${v.css}" data-vest="${v.key}" title="조끼"></button>`).join('');
    return `<div class="player-chip" data-player="${p.id}">
      <span class="player-badge" style="background:${team.color};color:${textColor}">${escapeHtml(p.num)}</span>
      <input type="text" class="player-label-input" value="${escapeHtml(p.num)}" maxlength="3" aria-label="등번호 또는 이름" />
      <div class="vest-swatch-row"><span class="vest-label">조끼</span>${vestSwatches}</div>
      <div class="size-stepper">
        <button data-action="playerSmaller" title="작게">−</button>
        <button data-action="playerBigger" title="크게">+</button>
      </div>
      <button class="icon-mini" data-action="delPlayer" title="이 선수 삭제">×</button>
    </div>`;
  }).join('');

  teamsPanel.innerHTML = `<div class="team-row" data-team="${team.id}">
    <div class="card">
      <div class="card-title">선수 목록 <span class="card-sub">${team.players.length}명 · 번호 칸을 눌러 이름/번호 수정</span></div>
      ${team.players.length
        ? `<div class="player-list">${playerRows}</div>`
        : '<p class="empty-msg">선수가 없어요. 오른쪽에서 포메이션 "배치"를 누르거나 "+ 선수"로 추가하세요.</p>'}
    </div>
    <div class="card">
      <div class="card-title">선수 배치</div>
      <div class="row-actions wrap">
        <div class="drag-handle player-handle" draggable="true" style="background:${team.color};color:${textColor}">끌어서 놓기</div>
        <button data-action="addPlayer" class="small-btn">+ 선수</button>
        <button data-action="removePlayer" class="small-btn">− 선수</button>
      </div>
      <div class="row-actions">
        <select data-role="formationSelect">${formOptions}</select>
        <button data-action="applyFormation" class="small-btn accent">배치</button>
      </div>
      <div class="card-title">팀 색상</div>
      <div class="swatch-row" data-role="teamColor">${swatches}</div>
      <div class="card-title">팀 마크</div>
      <div class="crest-row">
        <div class="crest-preview${team.crest ? ' has-crest' : ''}" style="${team.crest ? `background-image:url('${team.crest}')` : ''}"></div>
        <button class="small-btn" data-action="uploadCrest">사진 선택</button>
        ${team.crest ? '<button class="small-btn ghost" data-action="removeCrest">제거</button>' : ''}
        <input type="file" accept="image/*" class="crest-file-input" style="display:none" />
      </div>
      <div class="row-actions">
        <button data-action="delTeam" class="small-btn danger">${teamName(index)} 삭제</button>
      </div>
    </div>
  </div>`;
}

teamTabsEl.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-team-tab]');
  if (!tab) return;
  selectedTeamId = tab.dataset.teamTab;
  renderTeamsPanel();
});

matchBadgesEl.addEventListener('click', (e) => {
  const badge = e.target.closest('[data-badge]');
  if (!badge) return;
  if (badge.dataset.badge === 'add') addTeam();
  else selectedTeamId = badge.dataset.badge;
  renderTeamsPanel();
  openSheet('team');
});

function totalPlayers() {
  return state.teams.reduce((s, t) => s + t.players.length, 0);
}

function addPlayerToTeam(id) {
  if (totalPlayers() >= MAX_PLAYERS) {
    alert('선수는 최대 ' + MAX_PLAYERS + '명까지 배치할 수 있어요.');
    return;
  }
  const team = findTeam(id);
  const pos = cascadePos();
  team.players.push({ id: nextId(), num: String(team.players.length + 1), x: pos.x, y: pos.y });
  renderTeamsPanel();
  render();
}

function handleCrestFile(teamId, file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => openCropper(teamId, img);
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

// ---- 팀 마크 사진 자르기 (카카오톡 프로필처럼 드래그/확대) ----
let cropperState = null; // { teamId, img, baseScale, zoom, panX, panY }
let cropDrag = null;
const cropModal = document.getElementById('cropModal');
const cropCanvas = document.getElementById('cropCanvas');
const cropCtx = cropCanvas.getContext('2d');
const cropZoomSlider = document.getElementById('cropZoomSlider');

function openCropper(teamId, img) {
  const CS = cropCanvas.width;
  const baseScale = Math.max(CS / img.width, CS / img.height);
  cropperState = { teamId, img, baseScale, zoom: 1, panX: 0, panY: 0 };
  cropZoomSlider.value = 100;
  cropModal.style.display = 'flex';
  drawCropPreview();
}

function closeCropper() {
  cropModal.style.display = 'none';
  cropperState = null;
  cropDrag = null;
}

function drawCropPreview() {
  if (!cropperState) return;
  const CS = cropCanvas.width;
  const { img, baseScale, zoom, panX, panY } = cropperState;
  const scale = baseScale * zoom;
  const dw = img.width * scale, dh = img.height * scale;

  cropCtx.fillStyle = '#111';
  cropCtx.fillRect(0, 0, CS, CS);
  cropCtx.drawImage(img, CS / 2 - dw / 2 + panX, CS / 2 - dh / 2 + panY, dw, dh);

  cropCtx.save();
  cropCtx.beginPath();
  cropCtx.rect(0, 0, CS, CS);
  cropCtx.arc(CS / 2, CS / 2, CS / 2 - 4, 0, Math.PI * 2, true);
  cropCtx.fillStyle = 'rgba(0,0,0,0.6)';
  cropCtx.fill('evenodd');
  cropCtx.restore();

  cropCtx.beginPath();
  cropCtx.arc(CS / 2, CS / 2, CS / 2 - 4, 0, Math.PI * 2);
  cropCtx.strokeStyle = '#fff';
  cropCtx.lineWidth = 2;
  cropCtx.stroke();
}

function cropDragStart(evt) {
  if (!cropperState) return;
  evt.preventDefault();
  const { clientX, clientY } = getClientXY(evt);
  cropDrag = { x: clientX, y: clientY, panX: cropperState.panX, panY: cropperState.panY };
}

function cropDragMove(evt) {
  if (!cropDrag || !cropperState) return;
  evt.preventDefault();
  const { clientX, clientY } = getClientXY(evt);
  const d = screenDeltaToLocal(clientX - cropDrag.x, clientY - cropDrag.y);
  const cropRect = cropCanvas.getBoundingClientRect();
  const cssToCanvas = cropCanvas.width / (isRotated() ? cropRect.height : cropRect.width);
  cropperState.panX = cropDrag.panX + d.dx * cssToCanvas;
  cropperState.panY = cropDrag.panY + d.dy * cssToCanvas;
  drawCropPreview();
}

function cropDragEnd() {
  cropDrag = null;
}

cropCanvas.addEventListener('mousedown', cropDragStart);
window.addEventListener('mousemove', cropDragMove);
window.addEventListener('mouseup', cropDragEnd);
cropCanvas.addEventListener('touchstart', cropDragStart, { passive: false });
cropCanvas.addEventListener('touchmove', cropDragMove, { passive: false });
window.addEventListener('touchend', cropDragEnd);
window.addEventListener('touchcancel', cropDragEnd);

cropZoomSlider.addEventListener('input', (e) => {
  if (!cropperState) return;
  cropperState.zoom = e.target.value / 100;
  drawCropPreview();
});

document.getElementById('cropCancelBtn').addEventListener('click', closeCropper);

document.getElementById('cropConfirmBtn').addEventListener('click', () => {
  if (!cropperState) return;
  const CS = cropCanvas.width;
  const OUT = 128;
  const ratio = OUT / CS;
  const { img, baseScale, zoom, panX, panY, teamId } = cropperState;
  const scale = baseScale * zoom * ratio;
  const dw = img.width * scale, dh = img.height * scale;

  const out = document.createElement('canvas');
  out.width = OUT;
  out.height = OUT;
  const octx = out.getContext('2d');
  octx.save();
  octx.beginPath();
  octx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2);
  octx.clip();
  octx.drawImage(img, OUT / 2 - dw / 2 + panX * ratio, OUT / 2 - dh / 2 + panY * ratio, dw, dh);
  octx.restore();

  const team = findTeam(teamId);
  if (team) {
    team.crest = out.toDataURL('image/png');
    delete teamCrestImages[teamId];
    renderTeamsPanel();
    render();
  }
  closeCropper();
});

function removePlayerFromTeam(id) {
  const team = findTeam(id);
  if (team.players.length === 0) return;
  team.players.pop();
  renderTeamsPanel();
  render();
}

function applyFormationToTeam(id, key) {
  const idx = state.teams.findIndex(t => t.id === id);
  const side = idx % 2 === 0 ? 'L' : 'R';
  state.teams[idx].players = formationToPlayers(key, side);
  state.teams[idx].formation = key;
  renderTeamsPanel();
  render();
}

function addTeam() {
  if (state.teams.length >= MAX_TEAMS) {
    alert('팀은 최대 ' + MAX_TEAMS + '개까지 만들 수 있어요.');
    return;
  }
  const used = state.teams.map(t => t.color);
  const color = TEAM_PALETTE.find(c => !used.includes(c)) || TEAM_PALETTE[state.teams.length % TEAM_PALETTE.length];
  const team = { id: nextId(), color, players: [] };
  state.teams.push(team);
  selectedTeamId = team.id;
  renderTeamsPanel();
  render();
}

function removeTeam(id) {
  const team = findTeam(id);
  if (team && team.players.length > 0 && !confirm(`이 팀에 선수 ${team.players.length}명이 있어요. 팀을 삭제할까요?`)) return;
  state.teams = state.teams.filter(t => t.id !== id);
  renderTeamsPanel();
  render();
}

document.getElementById('addTeamBtn').addEventListener('click', addTeam);

teamsPanel.addEventListener('click', (e) => {
  const row = e.target.closest('.team-row');
  if (!row) return;
  const id = row.dataset.team;

  const swatch = e.target.closest('.swatch');
  if (swatch) {
    findTeam(id).color = swatch.dataset.color;
    renderTeamsPanel();
    render();
    return;
  }

  const vest = e.target.closest('.vest-swatch');
  if (vest) {
    const chip = vest.closest('.player-chip');
    const team = findTeam(id);
    const player = team && team.players.find(p => p.id === chip.dataset.player);
    if (player) {
      player.vest = vest.dataset.vest || null;
      renderTeamsPanel();
      render();
    }
    return;
  }

  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  if (action === 'addPlayer') addPlayerToTeam(id);
  else if (action === 'removePlayer') removePlayerFromTeam(id);
  else if (action === 'delTeam') removeTeam(id);
  else if (action === 'applyFormation') {
    const sel = row.querySelector('[data-role="formationSelect"]');
    applyFormationToTeam(id, sel.value);
  } else if (action === 'delPlayer') {
    const chip = e.target.closest('.player-chip');
    const team = findTeam(id);
    if (team) {
      team.players = team.players.filter(p => p.id !== chip.dataset.player);
      renderTeamsPanel();
      render();
    }
  } else if (action === 'playerSmaller' || action === 'playerBigger') {
    const chip = e.target.closest('.player-chip');
    const team = findTeam(id);
    const player = team && team.players.find(p => p.id === chip.dataset.player);
    if (player) {
      const factor = action === 'playerBigger' ? 1.15 : 0.87;
      player.scale = Math.max(0.5, Math.min(2.2, (player.scale || 1) * factor));
      render();
    }
  } else if (action === 'uploadCrest') {
    row.querySelector('.crest-file-input').click();
  } else if (action === 'removeCrest') {
    const team = findTeam(id);
    if (team) {
      team.crest = null;
      delete teamCrestImages[id];
      renderTeamsPanel();
      render();
    }
  }
});

teamsPanel.addEventListener('change', (e) => {
  if (!e.target.classList.contains('crest-file-input')) return;
  const row = e.target.closest('.team-row');
  handleCrestFile(row.dataset.team, e.target.files[0]);
});

teamsPanel.addEventListener('input', (e) => {
  if (!e.target.classList.contains('player-label-input')) return;
  const row = e.target.closest('.team-row');
  const chip = e.target.closest('.player-chip');
  const team = findTeam(row.dataset.team);
  const player = team && team.players.find(p => p.id === chip.dataset.player);
  if (player) {
    player.num = e.target.value;
    chip.querySelector('.player-badge').textContent = e.target.value;
    render();
  }
});

teamsPanel.addEventListener('dragstart', (e) => {
  if (!e.target.classList.contains('player-handle')) return;
  const id = e.target.closest('.team-row').dataset.team;
  e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'player', teamId: id }));
  e.dataTransfer.effectAllowed = 'copy';
});

teamsPanel.addEventListener('touchstart', (e) => {
  const handle = e.target.closest('.player-handle');
  if (!handle) return;
  e.preventDefault();
  const id = handle.closest('.team-row').dataset.team;
  startTouchDrag({ kind: 'player', teamId: id }, '선수', e.touches[0]);
}, { passive: false });

// ---- 용품 패널 ----
const equipmentPanel = document.getElementById('equipmentPanel');
const equipControls = document.getElementById('equipControls');
const equipControlsTitle = document.getElementById('equipControlsTitle');
const equipRotateGroup = document.getElementById('equipRotateGroup');
const equipRotateSlider = document.getElementById('equipRotateSlider');
const equipRotateLabel = document.getElementById('equipRotateLabel');
const ROTATABLE_EQUIP_TYPES = EQUIP_TYPES.map(t => t.type);

function renderEquipmentPanel() {
  equipmentPanel.innerHTML = EQUIP_TYPES.map(et => {
    const swatches = EQUIP_PALETTE.map(c =>
      `<button class="swatch${c === equipSelectedColor[et.type] ? ' selected' : ''}" style="background:${c}" data-color="${c}"></button>`
    ).join('');
    return `<div class="equip-row" data-type="${et.type}">
      <div class="equip-title"><span class="equip-handle" draggable="true">${et.label}</span></div>
      <div class="swatch-row" data-role="equipColor">${swatches}</div>
      <div class="row-actions">
        <button data-action="addEquip" class="small-btn">+ 추가</button>
      </div>
    </div>`;
  }).join('');
}

function addEquipment(type) {
  const pos = cascadePos();
  const item = { id: nextId(), type, color: equipSelectedColor[type], x: pos.x, y: pos.y, rot: 0 };
  state.equipment.push(item);
  render();
}

equipmentPanel.addEventListener('click', (e) => {
  const row = e.target.closest('.equip-row');
  if (!row) return;
  const type = row.dataset.type;

  if (e.target.matches('.swatch')) {
    equipSelectedColor[type] = e.target.dataset.color;
    renderEquipmentPanel();
    return;
  }
  if (e.target.dataset.action === 'addEquip') addEquipment(type);
});

equipmentPanel.addEventListener('dragstart', (e) => {
  if (!e.target.classList.contains('equip-handle')) return;
  const type = e.target.closest('.equip-row').dataset.type;
  e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'equipment', type }));
  e.dataTransfer.effectAllowed = 'copy';
});

equipmentPanel.addEventListener('touchstart', (e) => {
  const handle = e.target.closest('.equip-handle');
  if (!handle) return;
  e.preventDefault();
  const row = handle.closest('.equip-row');
  const type = row.dataset.type;
  const label = EQUIP_TYPES.find(t => t.type === type).label;
  startTouchDrag({ kind: 'equipment', type }, label, e.touches[0]);
}, { passive: false });

function updateEquipControlsVisibility() {
  const item = selectedEquipId && state.equipment.find(e => e.id === selectedEquipId);
  if (!item) {
    equipControls.style.display = 'none';
    return;
  }
  equipControls.style.display = 'flex';
  const rotatable = ROTATABLE_EQUIP_TYPES.includes(item.type);
  const label = EQUIP_TYPES.find(t => t.type === item.type).label.replace(/^\S+\s/, '');
  equipControlsTitle.textContent = `선택된 ${label} — 크기${rotatable ? ' / 방향' : ''}`;
  equipRotateGroup.style.display = rotatable ? 'flex' : 'none';
  if (rotatable) {
    const deg = Math.round(((item.rot || 0) * 180 / Math.PI + 360) % 360);
    equipRotateSlider.value = deg;
    equipRotateLabel.textContent = deg;
  }
}

function setSelectedEquipRotationDeg(deg) {
  const item = state.equipment.find(e => e.id === selectedEquipId);
  if (!item) return;
  const norm = ((deg % 360) + 360) % 360;
  item.rot = norm * Math.PI / 180;
  equipRotateSlider.value = norm;
  equipRotateLabel.textContent = norm;
  render();
}

document.getElementById('equipSmaller').addEventListener('click', () => {
  const item = state.equipment.find(e => e.id === selectedEquipId);
  if (!item) return;
  item.scale = Math.max(0.4, (item.scale || 1) * 0.85);
  render();
});
document.getElementById('equipBigger').addEventListener('click', () => {
  const item = state.equipment.find(e => e.id === selectedEquipId);
  if (!item) return;
  item.scale = Math.min(3, (item.scale || 1) * 1.18);
  render();
});
equipRotateSlider.addEventListener('input', (e) => {
  setSelectedEquipRotationDeg(parseInt(e.target.value, 10));
});
document.getElementById('equipRotateMinus').addEventListener('click', () => {
  const item = state.equipment.find(e => e.id === selectedEquipId);
  if (!item) return;
  setSelectedEquipRotationDeg(Math.round((item.rot || 0) * 180 / Math.PI) - 15);
});
document.getElementById('equipRotatePlus').addEventListener('click', () => {
  const item = state.equipment.find(e => e.id === selectedEquipId);
  if (!item) return;
  setSelectedEquipRotationDeg(Math.round((item.rot || 0) * 180 / Math.PI) + 15);
});
document.getElementById('equipDeselect').addEventListener('click', () => {
  selectedEquipId = null;
  updateEquipControlsVisibility();
  render();
});

// ---- 선 모양(방향선/일반 선) / 선 종류 / 선 색상 패널 ----
let selectedLineArrow = 'arrow';
const lineArrowPanel = document.getElementById('lineArrowPanel');

lineArrowPanel.addEventListener('click', (e) => {
  if (!e.target.classList.contains('line-arrow-btn')) return;
  selectedLineArrow = e.target.dataset.value;
  lineArrowPanel.querySelectorAll('.line-arrow-btn').forEach(b => b.classList.toggle('active', b === e.target));
});

let selectedLineType = 'solid';
const lineTypePanel = document.getElementById('lineTypePanel');
const lineColorPanel = document.getElementById('lineColorPanel');

lineTypePanel.addEventListener('click', (e) => {
  if (!e.target.classList.contains('line-type-btn')) return;
  selectedLineType = e.target.dataset.value;
  lineTypePanel.querySelectorAll('.line-type-btn').forEach(b => b.classList.toggle('active', b === e.target));
});

function renderLineColorPanel() {
  lineColorPanel.innerHTML = LINE_PALETTE.map(c =>
    `<button class="swatch${c === selectedLineColor ? ' selected' : ''}" style="background:${c}" data-color="${c}"></button>`
  ).join('');
}

lineColorPanel.addEventListener('click', (e) => {
  if (e.target.matches('.swatch')) {
    selectedLineColor = e.target.dataset.color;
    renderLineColorPanel();
  }
});

// ---- 격자 표시 ----
const gridToggleBtn = document.getElementById('gridToggleBtn');
gridToggleBtn.addEventListener('click', () => {
  state.showGrid = !state.showGrid;
  gridToggleBtn.classList.toggle('active', state.showGrid);
  syncQuickButtons();
  render();
});

// ---- 필드 모드 (정규 축구장 / 하프 코트) ----
const pitchModeSelect = document.getElementById('pitchModeSelect');
const halfGoalSelect = document.getElementById('halfGoalSelect');
const halfGoalGroup = document.getElementById('halfGoalGroup');

function rescalePositions(oldW, oldH, newW, newH) {
  if (oldW === newW && oldH === newH) return;
  const sx = newW / oldW, sy = newH / oldH;
  const scalePt = (p) => { p.x *= sx; p.y *= sy; };
  state.teams.forEach(t => t.players.forEach(scalePt));
  state.equipment.forEach(scalePt);
  state.texts.forEach(scalePt);
  state.arrows.forEach(a => a.points.forEach(scalePt));
}

function changePitchMode(mode, goalPos) {
  const oldW = W, oldH = H;
  state.pitchMode = mode;
  state.halfGoalPos = goalPos;
  setFieldGeometry();
  rescalePositions(oldW, oldH, W, H);
  halfGoalGroup.style.display = mode === 'half' ? 'flex' : 'none';
  setZoom(1);
  boardWrap.scrollLeft = 0;
  boardWrap.scrollTop = 0;
  syncQuickButtons();
  render();
}

function syncPitchModeUI() {
  pitchModeSelect.value = state.pitchMode;
  halfGoalSelect.value = state.halfGoalPos;
  halfGoalGroup.style.display = state.pitchMode === 'half' ? 'flex' : 'none';
  refreshCustomSelects();
}

pitchModeSelect.addEventListener('change', (e) => changePitchMode(e.target.value, state.halfGoalPos));
halfGoalSelect.addEventListener('change', (e) => changePitchMode(state.pitchMode, e.target.value));

// ---- 구역 표시 ----
const lengthZoneSelect = document.getElementById('lengthZoneSelect');
const widthZoneSelect = document.getElementById('widthZoneSelect');

function syncZoneSelects() {
  lengthZoneSelect.value = String(state.zones.lengthZones);
  widthZoneSelect.value = String(state.zones.widthZones);
  gridToggleBtn.classList.toggle('active', state.showGrid);
  syncPitchModeUI();
  syncQuickButtons();
  refreshCustomSelects();
}

lengthZoneSelect.addEventListener('change', (e) => {
  state.zones.lengthZones = parseInt(e.target.value, 10);
  render();
});
widthZoneSelect.addEventListener('change', (e) => {
  state.zones.widthZones = parseInt(e.target.value, 10);
  render();
});

// ---- 텍스트(설명) 패널 ----
const textInput = document.getElementById('textInput');
const textList = document.getElementById('textList');

function renderTextList() {
  if (state.texts.length === 0) {
    textList.innerHTML = '<p class="empty-msg">추가된 텍스트가 없습니다.</p>';
    return;
  }
  textList.innerHTML = state.texts.map(t => `<div class="text-item" data-id="${t.id}">
    <input type="text" value="${escapeHtml(t.text)}" data-role="editText" maxlength="20" />
    <button data-action="delText" class="small-btn">삭제</button>
  </div>`).join('');
}

document.getElementById('addTextBtn').addEventListener('click', () => {
  const val = textInput.value.trim();
  if (!val) return;
  const pos = cascadePos();
  state.texts.push({ id: nextId(), text: val, x: pos.x, y: pos.y });
  textInput.value = '';
  renderTextList();
  render();
});

textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('addTextBtn').click();
});

textList.addEventListener('input', (e) => {
  if (!e.target.matches('[data-role="editText"]')) return;
  const id = e.target.closest('.text-item').dataset.id;
  const t = state.texts.find(x => x.id === id);
  if (t) { t.text = e.target.value; render(); }
});

textList.addEventListener('click', (e) => {
  if (e.target.dataset.action !== 'delText') return;
  const id = e.target.closest('.text-item').dataset.id;
  state.texts = state.texts.filter(x => x.id !== id);
  renderTextList();
  render();
});

// ---- 하단 도구 ----
const hint = document.getElementById('hint');

function refreshModeButtons() {
  document.getElementById('railMoveBtn').classList.toggle('active', mode === 'move');
  document.getElementById('railDrawBtn').classList.toggle('active', mode === 'draw');
  document.getElementById('railEraseBtn').classList.toggle('active', mode === 'erase');
  canvas.classList.toggle('draw-cursor', mode === 'draw');
  canvas.classList.toggle('erase-cursor', mode === 'erase');
  hint.textContent = mode === 'move'
    ? '이동 모드: 드래그해서 옮기세요. 더블클릭(또는 길게 누르기)하거나 삭제 영역으로 끌면 삭제됩니다. 확대 중엔 손가락 두 개로 오므리거나 벌려서 확대/이동하세요.'
    : '그리기 모드: 드래그해서 선을 그리세요. 이동 모드에서 선을 더블클릭하면 삭제됩니다.';
}

document.getElementById('undoBtn').addEventListener('click', undo);

document.getElementById('clearArrowsBtn').addEventListener('click', () => {
  if (state.arrows.length === 0) return;
  state.arrows = [];
  render();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (!confirm('선수, 용품, 그림, 텍스트를 모두 초기 상태로 되돌릴까요?')) return;
  initState();
  setFieldGeometry();
  setZoom(1);
  boardWrap.scrollLeft = 0;
  boardWrap.scrollTop = 0;
  idCounter = Date.now();
  selectedEquipId = null;
  renderTeamsPanel();
  syncZoneSelects();
  renderTextList();
  updateEquipControlsVisibility();
  render();
});

document.getElementById('exportBtn').addEventListener('click', () => {
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d');
  paintGrass(octx, W, H);
  octx.drawImage(canvas, 0, 0, W, H);
  const link = document.createElement('a');
  link.download = `soccer-tactics-${Date.now()}.png`;
  link.href = out.toDataURL('image/png');
  link.click();
});

// ---- 저장 (여러 개 이름 붙여 저장) ----
const saveNameInput = document.getElementById('saveNameInput');
const savesList = document.getElementById('savesList');
const SAVES_KEY = 'soccerBoardSaves';

function loadSavesList() {
  try { return JSON.parse(localStorage.getItem(SAVES_KEY) || '[]'); } catch (e) { return []; }
}
function persistSavesList(list) {
  try { localStorage.setItem(SAVES_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
}

function renderSavesPanel() {
  const list = loadSavesList();
  if (list.length === 0) {
    savesList.innerHTML = '<p class="empty-msg">저장된 작전이 없습니다.</p>';
    return;
  }
  savesList.innerHTML = list.map(s => `<div class="save-item" data-id="${s.id}">
    <div>
      <div class="save-name">${escapeHtml(s.name)}</div>
      <div class="save-date">${new Date(s.savedAt).toLocaleString('ko-KR')}</div>
    </div>
    <div class="save-actions">
      <button data-action="loadSave" class="small-btn">불러오기</button>
      <button data-action="delSave" class="small-btn">삭제</button>
    </div>
  </div>`).join('');
}

document.getElementById('saveBoardBtn').addEventListener('click', () => {
  const name = saveNameInput.value.trim() || ('작전 ' + new Date().toLocaleString('ko-KR'));
  const list = loadSavesList();
  list.unshift({ id: nextId(), name, savedAt: Date.now(), data: state });
  persistSavesList(list);
  saveNameInput.value = '';
  renderSavesPanel();
});

savesList.addEventListener('click', (e) => {
  const row = e.target.closest('.save-item');
  if (!row) return;
  const id = row.dataset.id;
  const list = loadSavesList();
  const item = list.find(s => s.id === id);
  if (!item) return;

  if (e.target.dataset.action === 'loadSave') {
    state = item.data;
    ensureStateDefaults();
    setFieldGeometry();
    setZoom(1);
    boardWrap.scrollLeft = 0;
    boardWrap.scrollTop = 0;
    idCounter = Date.now();
    cascadeCounter = 0;
    selectedEquipId = null;
    renderTeamsPanel();
    syncZoneSelects();
    renderTextList();
    updateEquipControlsVisibility();
    render();
  } else if (e.target.dataset.action === 'delSave') {
    persistSavesList(list.filter(s => s.id !== id));
    renderSavesPanel();
  }
});

// ---- 공유 링크 (로그인 없이, 링크 하나로 지인에게 작전 전달) ----
// 링크를 짧게 만들기 위해: 팀 마크 사진은 빼고, 좌표는 정수로, 이름표 대신 배열로 줄인 뒤
// deflate로 압축해서 URL에 안전한 base64로 넣는다. (#z=압축본, #c=압축 불가 브라우저용)
function compactState(st) {
  const r = Math.round;
  const small = (n, d) => (n ? +n.toFixed(d) : 0);
  return {
    v: 2,
    m: st.pitchMode === 'half' ? (st.halfGoalPos === 'top' ? 'ht' : 'hb') : 'f',
    g: st.showGrid ? 1 : 0,
    z: [st.zones.lengthZones, st.zones.widthZones],
    t: st.teams.map(t => [t.color, t.formation || 0, t.players.map(p => [p.num, r(p.x), r(p.y), p.vest || 0, p.scale && p.scale !== 1 ? small(p.scale, 2) : 0])]),
    e: st.equipment.map(e => [e.type, e.color, r(e.x), r(e.y), small(e.rot, 3), e.scale && e.scale !== 1 ? small(e.scale, 2) : 0]),
    a: st.arrows.map(a => [a.type, a.color, a.hasArrow === false ? 0 : 1, a.points.flatMap(p => [r(p.x), r(p.y)])]),
    x: st.texts.map(t => [t.text, r(t.x), r(t.y)]),
  };
}

function expandState(c) {
  const pts = (flat) => {
    const out = [];
    for (let i = 0; i < flat.length; i += 2) out.push({ x: flat[i], y: flat[i + 1] });
    return out;
  };
  return {
    pitchMode: c.m === 'f' ? 'full' : 'half',
    halfGoalPos: c.m === 'ht' ? 'top' : 'bottom',
    showGrid: !!c.g,
    zones: { lengthZones: c.z[0] || 0, widthZones: c.z[1] || 0 },
    teams: c.t.map(([color, formation, players]) => ({
      id: nextId(), color, formation: formation || undefined,
      players: players.map(([num, x, y, vest, scale]) => {
        const p = { id: nextId(), num, x, y };
        if (vest) p.vest = vest;
        if (scale) p.scale = scale;
        return p;
      }),
    })),
    equipment: c.e.map(([type, color, x, y, rot, scale]) => {
      const e = { id: nextId(), type, color, x, y, rot: rot || 0 };
      if (scale) e.scale = scale;
      return e;
    }),
    arrows: c.a.map(([type, color, hasArrow, flat]) => ({ type, color, hasArrow: !!hasArrow, points: pts(flat) })),
    texts: c.x.map(([text, x, y]) => ({ id: nextId(), text, x, y })),
  };
}

function bytesToB64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const canCompress = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

async function deflateBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflateBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ---- 공유 링크 v3: 바이너리로 꽉 눌러 담기 ----
// 숫자는 가변 길이(작은 수는 1바이트), 색은 팔레트 번호, 포메이션 그대로인 선수는 '어긋난 양(대부분 0)'만,
// 선의 점들은 직전 점과의 차이만, 팀 마크는 아주 작은 WebP로 줄여서 넣는다.
const SHARE_VERSION = 3;
const LINE_TYPES = ['solid', 'dashed', 'freehand', 'freehand-dashed'];
const VEST_KEYS = ['yellow', 'red', 'orange', 'blue'];
const CREST_SHARE_PX = 20;

class ByteWriter {
  constructor() { this.buf = new Uint8Array(256); this.len = 0; }
  ensure(n) {
    if (this.len + n <= this.buf.length) return;
    const nb = new Uint8Array(Math.max(this.buf.length * 2, this.len + n));
    nb.set(this.buf);
    this.buf = nb;
  }
  byte(v) { this.ensure(1); this.buf[this.len++] = v & 255; }
  uvar(v) {
    v = Math.max(0, Math.round(v));
    while (v >= 128) { this.byte((v % 128) | 128); v = Math.floor(v / 128); }
    this.byte(v);
  }
  svar(v) { v = Math.round(v); this.uvar(v >= 0 ? v * 2 : -v * 2 - 1); }
  raw(arr) { this.ensure(arr.length); this.buf.set(arr, this.len); this.len += arr.length; }
  bytes(arr) { this.uvar(arr.length); this.raw(arr); }
  str(s) { this.bytes(new TextEncoder().encode(s || '')); }
  color(hex, palette) {
    const i = palette.indexOf(hex);
    if (i >= 0) { this.byte(i); return; }
    const n = parseInt(String(hex || '#000000').slice(1), 16) || 0;
    this.byte(255); this.byte(n >> 16); this.byte(n >> 8); this.byte(n);
  }
  result() { return this.buf.slice(0, this.len); }
}

class ByteReader {
  constructor(b) { this.b = b; this.i = 0; }
  byte() {
    if (this.i >= this.b.length) throw new Error('링크 데이터가 잘렸어요');
    return this.b[this.i++];
  }
  uvar() {
    let v = 0, m = 1, b;
    do { b = this.byte(); v += (b & 127) * m; m *= 128; } while (b & 128);
    return v;
  }
  svar() { const u = this.uvar(); return u % 2 ? -(u + 1) / 2 : u / 2; }
  rawN(n) {
    if (this.i + n > this.b.length) throw new Error('링크 데이터가 잘렸어요');
    const out = this.b.slice(this.i, this.i + n);
    this.i += n;
    return out;
  }
  bytes() { return this.rawN(this.uvar()); }
  str() { return new TextDecoder().decode(this.bytes()); }
  color(palette) {
    const i = this.byte();
    if (i !== 255) return palette[i] || palette[0];
    const r = this.byte(), g = this.byte(), b = this.byte();
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// 팀 마크를 20x20, 8색으로 줄여서 (색 목록 + 칸마다 색 번호) 담는다.
// 작은 그림에서는 WebP/JPEG보다 이 방식이 훨씬 짧다. (선수 동그라미 안에 그려지므로 이 크기로 충분)
const CREST_COLORS = 8;

function quantizePixels(px, k) {
  // 간단한 k-means: 픽셀 색들을 k개의 대표색으로 묶는다
  const n = px.length / 3;
  const cent = [];
  for (let i = 0; i < k; i++) {
    const j = Math.floor((i + 0.5) * n / k) * 3;
    cent.push([px[j], px[j + 1], px[j + 2]]);
  }
  const idx = new Uint8Array(n);
  for (let iter = 0; iter < 10; iter++) {
    const sum = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let p = 0; p < n; p++) {
      const r = px[p * 3], g = px[p * 3 + 1], b = px[p * 3 + 2];
      let best = 0, bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const dr = r - cent[c][0], dg = g - cent[c][1], db = b - cent[c][2];
        const d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
        if (d < bestD) { bestD = d; best = c; }
      }
      idx[p] = best;
      const s = sum[best];
      s[0] += r; s[1] += g; s[2] += b; s[3]++;
    }
    for (let c = 0; c < k; c++) {
      if (sum[c][3]) cent[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]];
    }
  }
  return { palette: cent.map(c => c.map(Math.round)), idx };
}

async function tinyCrest(dataUrl, bgColor) {
  const img = await loadImage(dataUrl);
  const N = CREST_SHARE_PX;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const cx = c.getContext('2d');
  cx.fillStyle = bgColor;
  cx.fillRect(0, 0, N, N);
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(img, 0, 0, N, N);
  const data = cx.getImageData(0, 0, N, N).data;
  const px = new Uint8Array(N * N * 3);
  for (let i = 0; i < N * N; i++) {
    px[i * 3] = data[i * 4]; px[i * 3 + 1] = data[i * 4 + 1]; px[i * 3 + 2] = data[i * 4 + 2];
  }
  const K = CREST_COLORS;
  const bits = Math.ceil(Math.log2(K));
  const { palette, idx } = quantizePixels(px, K);
  // [크기][색 개수][색 목록 K*3][칸마다 색 번호를 bits비트씩 이어 붙임]
  const out = new Uint8Array(2 + K * 3 + Math.ceil(N * N * bits / 8));
  out[0] = N;
  out[1] = K;
  palette.forEach((col, i) => { out[2 + i * 3] = col[0]; out[3 + i * 3] = col[1]; out[4 + i * 3] = col[2]; });
  const base = 2 + K * 3;
  for (let p = 0; p < N * N; p++) {
    for (let b = 0; b < bits; b++) {
      if (idx[p] & (1 << (bits - 1 - b))) {
        const bit = p * bits + b;
        out[base + (bit >> 3)] |= 128 >> (bit & 7);
      }
    }
  }
  return { type: 3, bytes: out };
}

function crestFromPalette(bytes) {
  const N = bytes[0], K = bytes[1];
  const bits = Math.ceil(Math.log2(K));
  const base = 2 + K * 3;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const cx = c.getContext('2d');
  const im = cx.createImageData(N, N);
  for (let p = 0; p < N * N; p++) {
    let ci = 0;
    for (let b = 0; b < bits; b++) {
      const bit = p * bits + b;
      ci = (ci << 1) | ((bytes[base + (bit >> 3)] >> (7 - (bit & 7))) & 1);
    }
    const col = Math.min(ci, K - 1);
    im.data[p * 4] = bytes[2 + col * 3];
    im.data[p * 4 + 1] = bytes[3 + col * 3];
    im.data[p * 4 + 2] = bytes[4 + col * 3];
    im.data[p * 4 + 3] = 255;
  }
  cx.putImageData(im, 0, 0);
  return c.toDataURL('image/png');
}

const CREST_MIME = { 1: 'image/webp', 2: 'image/jpeg' };

async function encodeShareBinary(st) {
  const w = new ByteWriter();
  w.byte(SHARE_VERSION);
  const pitchCode = st.pitchMode === 'half' ? (st.halfGoalPos === 'top' ? 2 : 1) : 0;
  w.byte(pitchCode | (st.showGrid ? 4 : 0));
  w.byte(((st.zones.lengthZones || 0) << 4) | (st.zones.widthZones || 0));

  w.uvar(st.teams.length);
  for (let ti = 0; ti < st.teams.length; ti++) {
    const t = st.teams[ti];
    w.color(t.color, TEAM_PALETTE);
    const fIdx = FORMATION_KEYS.indexOf(String(t.formation));
    w.byte(fIdx + 1);
    if (t.crest) {
      try {
        const c = await tinyCrest(t.crest, t.color);
        w.byte(c.type);
        w.bytes(c.bytes);
      } catch (e) {
        w.byte(0);
      }
    } else {
      w.byte(0);
    }
    const side = ti % 2 === 0 ? 'L' : 'R';
    w.uvar(t.players.length);
    t.players.forEach((p, i) => {
      // 등번호가 기본값(1, 2, 3...)이면 0만 적는다
      if (p.num === String(i + 1)) w.uvar(0);
      else { const e = new TextEncoder().encode(p.num || ''); w.uvar(e.length + 1); w.raw(e); }
      const slot = fIdx >= 0 ? formationSlotPos(t.formation, i, side, st.pitchMode, st.halfGoalPos) : null;
      if (slot) { w.svar(p.x - slot.x); w.svar(p.y - slot.y); } else { w.uvar(p.x); w.uvar(p.y); }
      const hasScale = p.scale && Math.abs(p.scale - 1) > 0.001;
      w.byte((VEST_KEYS.indexOf(p.vest) + 1) | (hasScale ? 8 : 0));
      if (hasScale) w.uvar(p.scale * 100);
    });
  }

  w.uvar(st.equipment.length);
  st.equipment.forEach(e => {
    const deg = Math.round(((e.rot || 0) * 180 / Math.PI % 360 + 360) % 360);
    const hasScale = e.scale && Math.abs(e.scale - 1) > 0.001;
    w.byte(Math.max(0, EQUIP_TYPES.findIndex(t => t.type === e.type)) | (deg ? 16 : 0) | (hasScale ? 32 : 0));
    w.color(e.color, EQUIP_PALETTE);
    w.uvar(e.x); w.uvar(e.y);
    if (deg) w.uvar(deg);
    if (hasScale) w.uvar(e.scale * 100);
  });

  w.uvar(st.arrows.length);
  st.arrows.forEach(a => {
    w.byte(Math.max(0, LINE_TYPES.indexOf(a.type)) | (a.hasArrow === false ? 0 : 4));
    w.color(a.color, LINE_PALETTE);
    w.uvar(a.points.length);
    let px = 0, py = 0;
    a.points.forEach((p, i) => {
      const x = Math.round(p.x), y = Math.round(p.y);
      if (i === 0) { w.svar(x); w.svar(y); } else { w.svar(x - px); w.svar(y - py); }
      px = x; py = y;
    });
  });

  w.uvar(st.texts.length);
  st.texts.forEach(t => { w.str(t.text); w.uvar(t.x); w.uvar(t.y); });
  return w.result();
}

function decodeShareBinary(bytes) {
  const r = new ByteReader(bytes);
  if (r.byte() !== SHARE_VERSION) throw new Error('알 수 없는 링크 버전');
  const flags = r.byte();
  const pitchCode = flags & 3;
  const pitchMode = pitchCode ? 'half' : 'full';
  const halfGoalPos = pitchCode === 2 ? 'top' : 'bottom';
  const zones = r.byte();
  const st = {
    pitchMode, halfGoalPos, showGrid: !!(flags & 4),
    zones: { lengthZones: zones >> 4, widthZones: zones & 15 },
    teams: [], equipment: [], arrows: [], texts: [],
  };

  const teamCount = r.uvar();
  for (let ti = 0; ti < teamCount; ti++) {
    const color = r.color(TEAM_PALETTE);
    const fIdx = r.byte() - 1;
    const formation = fIdx >= 0 ? FORMATION_KEYS[fIdx] : undefined;
    const crestType = r.byte();
    let crest = null;
    if (crestType === 3) {
      crest = crestFromPalette(r.bytes());
    } else if (crestType) {
      const b64 = bytesToB64url(r.bytes()).replace(/-/g, '+').replace(/_/g, '/');
      crest = `data:${CREST_MIME[crestType] || 'image/png'};base64,` + b64 + '==='.slice((b64.length + 3) % 4);
    }
    const side = ti % 2 === 0 ? 'L' : 'R';
    const players = [];
    const count = r.uvar();
    for (let i = 0; i < count; i++) {
      const lab = r.uvar();
      const num = lab === 0 ? String(i + 1) : new TextDecoder().decode(r.rawN(lab - 1));
      const slot = formation ? formationSlotPos(formation, i, side, pitchMode, halfGoalPos) : null;
      let x, y;
      if (slot) { x = slot.x + r.svar(); y = slot.y + r.svar(); } else { x = r.uvar(); y = r.uvar(); }
      const vb = r.byte();
      const p = { id: nextId(), num, x, y };
      if (vb & 7) p.vest = VEST_KEYS[(vb & 7) - 1];
      if (vb & 8) p.scale = r.uvar() / 100;
      players.push(p);
    }
    const team = { id: nextId(), color, players };
    if (formation) team.formation = formation;
    if (crest) team.crest = crest;
    st.teams.push(team);
  }

  const eqCount = r.uvar();
  for (let i = 0; i < eqCount; i++) {
    const b = r.byte();
    const type = (EQUIP_TYPES[b & 15] || EQUIP_TYPES[0]).type;
    const color = r.color(EQUIP_PALETTE);
    const e = { id: nextId(), type, color, x: r.uvar(), y: r.uvar(), rot: 0 };
    if (b & 16) e.rot = r.uvar() * Math.PI / 180;
    if (b & 32) e.scale = r.uvar() / 100;
    st.equipment.push(e);
  }

  const arCount = r.uvar();
  for (let i = 0; i < arCount; i++) {
    const b = r.byte();
    const color = r.color(LINE_PALETTE);
    const n = r.uvar();
    const points = [];
    let x = 0, y = 0;
    for (let j = 0; j < n; j++) {
      if (j === 0) { x = r.svar(); y = r.svar(); } else { x += r.svar(); y += r.svar(); }
      points.push({ x, y });
    }
    st.arrows.push({ type: LINE_TYPES[b & 3], color, hasArrow: !!(b & 4), points });
  }

  const txCount = r.uvar();
  for (let i = 0; i < txCount; i++) {
    const text = r.str();
    st.texts.push({ id: nextId(), text, x: r.uvar(), y: r.uvar() });
  }
  return st;
}

async function makeShareHash(st) {
  const raw = await encodeShareBinary(st);
  if (canCompress) {
    const zipped = await deflateBytes(raw);
    if (zipped.length < raw.length) return '#tz' + bytesToB64url(zipped);
  }
  return '#tr' + bytesToB64url(raw);
}

async function readShareHash(hash) {
  let m = hash.match(/^#t([zr])([A-Za-z0-9_-]+)$/);
  if (m) {
    let bytes = b64urlToBytes(m[2]);
    if (m[1] === 'z') bytes = await inflateBytes(bytes);
    return decodeShareBinary(bytes);
  }
  // 예전 방식 링크들도 계속 열리게
  m = hash.match(/^#([zcs])=(.+)$/);
  if (!m) return null;
  const [, kind, data] = m;
  if (kind === 's') return JSON.parse(decodeURIComponent(escape(atob(data))));
  let bytes = b64urlToBytes(data);
  if (kind === 'z') bytes = await inflateBytes(bytes);
  return expandState(JSON.parse(new TextDecoder().decode(bytes)));
}

const shareLinkRow = document.getElementById('shareLinkRow');
const shareLinkInput = document.getElementById('shareLinkInput');

document.getElementById('makeShareLinkBtn').addEventListener('click', async () => {
  let url;
  try {
    url = location.origin + location.pathname + await makeShareHash(state);
  } catch (e) {
    alert('링크를 만들지 못했습니다.');
    return;
  }
  shareLinkInput.value = url;
  shareLinkRow.style.display = 'flex';
});

document.getElementById('copyShareLinkBtn').addEventListener('click', () => {
  shareLinkInput.select();
  shareLinkInput.setSelectionRange(0, 999999);
  let copied = false;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareLinkInput.value).then(() => {}).catch(() => {});
    copied = true;
  } else {
    try { copied = document.execCommand('copy'); } catch (e) { copied = false; }
  }
  alert(copied ? '링크가 복사되었습니다! 카카오톡 등에 붙여넣기 하세요.' : '길게 눌러서 직접 복사해주세요.');
});

async function loadStateFromShareLinkIfPresent() {
  if (!/^#(t[zr]|[zcs]=)/.test(location.hash)) return;
  try {
    const loaded = await readShareHash(location.hash);
    if (!loaded) return;
    state = loaded;
    ensureStateDefaults();
    idCounter = Math.max(idCounter, Date.now());
    setFieldGeometry();
    setZoom(1);
    selectedEquipId = null;
    renderTeamsPanel();
    syncZoneSelects();
    renderTextList();
    updateEquipControlsVisibility();
    render();
    resetHistory();
    showToast('공유받은 작전을 불러왔어요');
  } catch (e) {
    console.warn('공유 링크를 불러오지 못했습니다.', e);
    showToast('공유 링크를 불러오지 못했어요');
  }
}

// ---- 초기화 ----
enhanceSelects(document);
initState();
setFieldGeometry();
applyZoomStyle();
refreshModeButtons();
renderTeamsPanel();
renderEquipmentPanel();
renderLineColorPanel();
syncZoneSelects();
renderTextList();
renderSavesPanel();
render();
resetHistory();
loadStateFromShareLinkIfPresent();
