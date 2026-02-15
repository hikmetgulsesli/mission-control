// Pixel Office Canvas Rendering Engine
// Retro pixel art office visualization for 10 AI agents
// v2 — Activity system, state machine, Arya patrol, chat bubbles

const W = 1100;
const H = 720;

// ===== AGENT CONSTANTS =====

const AGENT_COLORS: Record<string, string> = {
  main:  '#ff6600',
  koda:  '#00ff41',
  kaan:  '#00ffff',
  atlas: '#4488ff',
  defne: '#ff44ff',
  sinan: '#ffaa00',
  elif:  '#44ff88',
  deniz: '#ff8844',
  onur:  '#8844ff',
  mert:  '#ff4488',
};

const AGENT_NAMES: Record<string, string> = {
  main: 'Arya', koda: 'Koda', kaan: 'Kaan', atlas: 'Atlas', defne: 'Defne',
  sinan: 'Sinan', elif: 'Elif', deniz: 'Deniz', onur: 'Onur', mert: 'Mert',
};

const DESK_ITEMS: Record<string, string> = {
  main: 'lobster', koda: 'robot', kaan: 'bolt', atlas: 'globe', defne: 'magnifier',
  sinan: 'shield', elif: 'laptop', deniz: 'pen', onur: 'gear', mert: 'palette',
};


const AGENT_ROLES: Record<string, string> = {
  main: 'CEO', koda: 'Lead Dev', kaan: 'Architect', atlas: 'Infra',
  defne: 'Research', sinan: 'QA', elif: 'Backend', deniz: 'Writer',
  onur: 'SRE', mert: 'Frontend',
};

const ROW0_AGENTS = ['koda', 'kaan', 'atlas', 'defne'];
const ROW1_AGENTS = ['sinan', 'elif', 'deniz', 'onur', 'mert'];
const ALL_AGENTS = ['main', ...ROW0_AGENTS, ...ROW1_AGENTS];

// ===== TYPES =====

type SpritePhase =
  | 'walking_to_desk'
  | 'sitting_working'
  | 'walking_to_activity'
  | 'performing_activity'
  | 'walking_to_handoff'
  | 'delivering_handoff'
  | 'arya_patrol';

type ActivityType =
  | 'ping_pong_player'
  | 'ping_pong_watcher'
  | 'coffee_run'
  | 'kitchen_eat'
  | 'couch_sit'
  | 'arcade_play'
  | 'read_book'
  | 'desk_browse'
  | 'water_cooler_chat'
  | 'conference_meeting';

interface CubiclePos {
  x: number; y: number; w: number; h: number;
  deskX: number; deskY: number;
  chairX: number; chairY: number;
}

interface AgentSprite {
  id: string;
  x: number; y: number;
  targetX: number; targetY: number;
  status: 'working' | 'idle';
  activity: string;
  phase: SpritePhase;
  currentActivity: ActivityType | null;
  activityTimer: number;
  subPhase: number;
  state: 'walking' | 'sitting' | 'standing';
  walkFrame: number;
  sitFrame: number;
  direction: number;
  handoffTarget: string | null;
  alertTimer: number;
}

interface ChatBubble {
  agentId: string;
  text: string;
  preview: string;
  done: boolean;
  fadeTimer: number;
}

interface BubbleBounds {
  x: number; y: number; w: number; h: number;
}

// ===== CUBICLE LAYOUT =====

function getCubiclePositions(): Record<string, CubiclePos> {
  const positions: Record<string, CubiclePos> = {};
  const cubW = 160;
  const cubH = 160;
  const startX = 10;

  const maxCols = Math.max(ROW0_AGENTS.length, ROW1_AGENTS.length);
  for (let i = 0; i < maxCols; i++) {
    const x = startX + i * cubW + i * 8;
    if (i < ROW0_AGENTS.length) {
      const r0y = 215;
      const agentR0 = ROW0_AGENTS[i];
      positions[agentR0] = {
        x, y: r0y, w: cubW, h: cubH,
        deskX: x + cubW / 2 - 25, deskY: r0y + 40,
        chairX: x + cubW / 2 - 8, chairY: r0y + 80,
      };
    }
    if (i < ROW1_AGENTS.length) {
      const r1y = 415;
      const agentR1 = ROW1_AGENTS[i];
      positions[agentR1] = {
        x, y: r1y, w: cubW, h: cubH,
        deskX: x + cubW / 2 - 25, deskY: r1y + 40,
        chairX: x + cubW / 2 - 8, chairY: r1y + 80,
      };
    }
  }
  return positions;
}

const CUBICLES = getCubiclePositions();

// ===== ACTIVITY SYSTEM =====

interface ActivityDef {
  type: ActivityType;
  capacity: number;
  positions: { x: number; y: number }[];
  durationRange: [number, number];
  basePriority: number;
}

const ACTIVITY_DEFS: ActivityDef[] = [
  { type: 'ping_pong_player',  capacity: 2, positions: [{ x: 920, y: 310 }, { x: 1020, y: 310 }], durationRange: [360, 600], basePriority: 5 },
  { type: 'ping_pong_watcher', capacity: 3, positions: [{ x: 930, y: 405 }, { x: 960, y: 405 }, { x: 990, y: 405 }], durationRange: [300, 540], basePriority: 0 },
  { type: 'coffee_run',        capacity: 2, positions: [{ x: 612, y: 20 }, { x: 630, y: 20 }], durationRange: [120, 180], basePriority: 3 },
  { type: 'kitchen_eat',       capacity: 2, positions: [{ x: 640, y: 120 }, { x: 690, y: 120 }], durationRange: [360, 600], basePriority: 5 },
  { type: 'couch_sit',         capacity: 3, positions: [{ x: 898, y: 25 }, { x: 948, y: 25 }, { x: 998, y: 25 }], durationRange: [360, 600], basePriority: 5 },
  { type: 'arcade_play',       capacity: 1, positions: [{ x: 915, y: 488 }], durationRange: [300, 480], basePriority: 4 },
  { type: 'read_book',         capacity: 2, positions: [{ x: 995, y: 490 }, { x: 1020, y: 490 }], durationRange: [360, 720], basePriority: 5 },
  { type: 'desk_browse',       capacity: 10, positions: [], durationRange: [600, 1800], basePriority: 15 },
  { type: 'water_cooler_chat', capacity: 3, positions: [{ x: 770, y: 108 }, { x: 790, y: 108 }, { x: 810, y: 108 }], durationRange: [300, 480], basePriority: 5 },
];

const ARYA_PATROL_WAYPOINTS = [
  { x: 410, y: 155 },
  { x: 200, y: 190 }, { x: 600, y: 190 },
  { x: 200, y: 390 }, { x: 600, y: 390 },
  { x: 960, y: 350 },
  { x: 700, y: 140 },
  { x: 410, y: 155 },
];

const CONFERENCE_SEATS = [
  { x: 95, y: 55 }, { x: 175, y: 55 }, { x: 95, y: 110 },
];
const ARYA_CONF_SEAT = { x: 210, y: 75 };

class ActivityManager {
  private occupants: Map<ActivityType, Set<string>> = new Map();

  constructor() {
    for (const d of ACTIVITY_DEFS) {
      this.occupants.set(d.type, new Set());
    }
    this.occupants.set('conference_meeting', new Set());
  }

  getOccupantCount(type: ActivityType): number {
    return this.occupants.get(type)?.size || 0;
  }

  getOccupants(type: ActivityType): Set<string> {
    return this.occupants.get(type) || new Set();
  }

  occupy(type: ActivityType, agentId: string): void {
    this.occupants.get(type)?.add(agentId);
  }

  vacate(type: ActivityType, agentId: string): void {
    this.occupants.get(type)?.delete(agentId);
  }

  private getDuration(type: ActivityType): number {
    const def = ACTIVITY_DEFS.find(d => d.type === type);
    if (!def) return 300;
    const [min, max] = def.durationRange;
    return Math.floor(Math.random() * (max - min)) + min;
  }

  private getNextPosition(type: ActivityType): { x: number; y: number } | null {
    const def = ACTIVITY_DEFS.find(d => d.type === type);
    if (!def || type === 'desk_browse') return null;
    const count = this.getOccupantCount(type);
    if (count >= def.capacity) return null;
    return def.positions[count] || def.positions[0];
  }

  pickActivity(agentId: string): { type: ActivityType; position: { x: number; y: number }; duration: number } | null {
    const weights: { type: ActivityType; weight: number }[] = [];

    for (const def of ACTIVITY_DEFS) {
      if (def.type === 'desk_browse') {
        weights.push({ type: 'desk_browse', weight: def.basePriority });
        continue;
      }
      const occ = this.getOccupantCount(def.type);
      if (occ >= def.capacity) continue;

      let weight = def.basePriority;

      if (def.type === 'ping_pong_player' && occ === 1) weight += 10;
      if (def.type === 'ping_pong_watcher') {
        if (this.getOccupantCount('ping_pong_player') < 2) continue;
        weight = 6;
      }
      if (def.type === 'water_cooler_chat' && occ === 1) weight += 4;
      if (def.type === 'read_book' && agentId === 'defne') weight += 3;

      if (weight > 0) weights.push({ type: def.type, weight });
    }

    if (weights.length === 0) return null;

    const total = weights.reduce((s, w) => s + w.weight, 0);
    let rand = Math.random() * total;

    for (const w of weights) {
      rand -= w.weight;
      if (rand <= 0) {
        let position: { x: number; y: number };
        if (w.type === 'desk_browse') {
          if (agentId === 'main') {
            position = { x: 410, y: 105 };
          } else {
            const c = CUBICLES[agentId];
            position = { x: c.chairX, y: c.chairY - 30 };
          }
        } else {
          const pos = this.getNextPosition(w.type);
          if (!pos) return null;
          position = pos;
        }
        return { type: w.type, position, duration: this.getDuration(w.type) };
      }
    }
    return null;
  }
}

// ===== DRAWING HELPERS =====

function drawRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawPixelBorder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, thickness = 2) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, thickness);
  ctx.fillRect(x, y + h - thickness, w, thickness);
  ctx.fillRect(x, y, thickness, h);
  ctx.fillRect(x + w - thickness, y, thickness, h);
}

function drawPixelText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size = 10) {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  ctx.textAlign = 'start';
}

// ===== STATIC SCENE =====

function drawFloor(ctx: CanvasRenderingContext2D) {
  drawRect(ctx, 0, 0, W, H, '#1a1a2e');
  ctx.fillStyle = '#1e1e35';
  for (let ty = 0; ty < H; ty += 24) {
    for (let tx = 0; tx < W; tx += 24) {
      if ((tx + ty) % 48 === 0) ctx.fillRect(tx, ty, 22, 22);
    }
  }
}

function drawConferenceRoom(ctx: CanvasRenderingContext2D) {
  drawRect(ctx, 0, 0, 280, 180, '#16213e');
  drawPixelBorder(ctx, 0, 0, 280, 180, '#334466', 3);
  drawRect(ctx, 60, 50, 160, 80, '#5c3d2e');
  drawPixelBorder(ctx, 60, 50, 160, 80, '#7a5540', 2);
  const chairColor = '#333355';
  drawRect(ctx, 90, 38, 20, 12, chairColor);
  drawRect(ctx, 170, 38, 20, 12, chairColor);
  drawRect(ctx, 90, 130, 20, 12, chairColor);
  drawRect(ctx, 170, 130, 20, 12, chairColor);
  drawRect(ctx, 48, 70, 12, 20, chairColor);
  drawRect(ctx, 48, 100, 12, 20, chairColor);
  drawRect(ctx, 220, 70, 12, 20, chairColor);
  drawRect(ctx, 220, 100, 12, 20, chairColor);
  drawRect(ctx, 80, 6, 120, 30, '#e8e8e8');
  drawPixelBorder(ctx, 80, 6, 120, 30, '#999999', 2);
  drawPixelText(ctx, 'Hikmet & Hakan', 140, 82, '#aa8866', 11);
  drawPixelText(ctx, 'SeTRoX Inc.', 140, 98, '#aa8866', 10);
  drawPixelText(ctx, 'CONFERENCE', 140, 170, '#556677', 9);
}

function drawBossOffice(ctx: CanvasRenderingContext2D) {
  drawRect(ctx, 280, 0, 280, 180, '#1a1535');
  drawPixelBorder(ctx, 280, 0, 280, 180, '#442266', 3);
  drawRect(ctx, 340, 60, 160, 70, '#6b3a2a');
  drawPixelBorder(ctx, 340, 60, 160, 70, '#8a5540', 2);
  drawRect(ctx, 400, 135, 40, 25, '#442266');
  drawPixelBorder(ctx, 400, 135, 40, 25, '#663399', 2);
  drawRect(ctx, 400, 50, 40, 30, '#111122');
  drawPixelBorder(ctx, 400, 50, 40, 30, '#333355', 2);
  drawRect(ctx, 405, 55, 30, 20, '#0044aa');
  drawRect(ctx, 350, 65, 14, 14, '#ff6600');
  drawRect(ctx, 354, 61, 6, 4, '#ff6600');
  drawRect(ctx, 390, 100, 60, 14, '#222244');
  drawPixelText(ctx, 'ARYA - CEO', 420, 111, '#ff6600', 8);
  drawPixelText(ctx, 'BOSS OFFICE', 420, 170, '#556677', 9);
}

function drawKitchen(ctx: CanvasRenderingContext2D) {
  drawRect(ctx, 560, 0, 290, 180, '#1a2420');
  drawPixelBorder(ctx, 560, 0, 290, 180, '#336644', 3);
  drawRect(ctx, 580, 10, 250, 40, '#555544');
  drawPixelBorder(ctx, 580, 10, 250, 40, '#777766', 2);
  drawRect(ctx, 790, 10, 30, 60, '#8899aa');
  drawPixelBorder(ctx, 790, 10, 30, 60, '#aabbcc', 2);
  drawRect(ctx, 810, 30, 4, 20, '#667788');
  drawRect(ctx, 600, 14, 24, 30, '#443322');
  drawRect(ctx, 608, 10, 8, 6, '#665544');
  drawRect(ctx, 604, 38, 16, 4, '#332211');
  drawRect(ctx, 620, 90, 100, 50, '#5c4a3a');
  drawPixelBorder(ctx, 620, 90, 100, 50, '#7a6650', 2);
  drawRect(ctx, 640, 145, 16, 16, '#333355');
  drawRect(ctx, 690, 145, 16, 16, '#333355');
  drawRect(ctx, 640, 74, 16, 16, '#333355');
  drawRect(ctx, 690, 74, 16, 16, '#333355');
  drawPixelText(ctx, 'KITCHEN', 700, 170, '#556677', 9);
}

function drawLounge(ctx: CanvasRenderingContext2D) {
  drawRect(ctx, 850, 0, 250, 720, '#1a1a28');
  drawPixelBorder(ctx, 850, 0, 250, 720, '#334455', 3);
  drawRect(ctx, 880, 40, 190, 50, '#553344');
  drawPixelBorder(ctx, 880, 40, 190, 50, '#774466', 2);
  drawRect(ctx, 888, 48, 40, 34, '#664455');
  drawRect(ctx, 938, 48, 40, 34, '#664455');
  drawRect(ctx, 988, 48, 40, 34, '#664455');
  drawRect(ctx, 880, 40, 8, 50, '#663355');
  drawRect(ctx, 1062, 40, 8, 50, '#663355');
  drawRect(ctx, 920, 110, 110, 40, '#5c3d2e');
  drawPixelBorder(ctx, 920, 110, 110, 40, '#7a5540', 2);
  drawRect(ctx, 890, 180, 50, 40, '#335566');
  ctx.fillStyle = '#446677';
  ctx.beginPath();
  ctx.arc(915, 190, 20, 0, Math.PI, true);
  ctx.fill();
  drawRect(ctx, 880, 280, 190, 110, '#226644');
  drawPixelBorder(ctx, 880, 280, 190, 110, '#33aa66', 2);
  drawRect(ctx, 973, 280, 4, 110, '#ffffff');
  drawPixelText(ctx, 'PONG', 975, 340, '#44cc77', 9);
  drawRect(ctx, 900, 440, 50, 80, '#222244');
  drawPixelBorder(ctx, 900, 440, 50, 80, '#444466', 2);
  drawRect(ctx, 908, 448, 34, 24, '#003300');
  drawRect(ctx, 910, 450, 30, 20, '#004400');
  drawPixelText(ctx, 'PLAY', 925, 465, '#00ff00', 8);
  drawRect(ctx, 980, 440, 80, 100, '#5c3d2e');
  drawPixelBorder(ctx, 980, 440, 80, 100, '#7a5540', 2);
  const bookColors = ['#cc3333', '#3333cc', '#33cc33', '#cccc33', '#cc33cc'];
  for (let i = 0; i < 5; i++) {
    drawRect(ctx, 986 + i * 14, 448, 10, 30, bookColors[i]);
    drawRect(ctx, 986 + i * 14, 488, 10, 25, bookColors[(i + 2) % 5]);
    drawRect(ctx, 986 + i * 14, 520, 10, 14, bookColors[(i + 4) % 5]);
  }
  drawRect(ctx, 1030, 580, 20, 30, '#553322');
  drawRect(ctx, 1025, 560, 30, 24, '#228833');
  drawRect(ctx, 1030, 548, 20, 16, '#33aa44');
  drawPixelText(ctx, 'LOUNGE', 975, 710, '#556677', 9);
}

function drawCorridors(ctx: CanvasRenderingContext2D) {
  drawRect(ctx, 0, 180, 850, 35, '#151525');
  ctx.fillStyle = '#222240';
  for (let cx = 0; cx < 850; cx += 40) ctx.fillRect(cx, 195, 20, 4);
  drawRect(ctx, 0, 375, 850, 40, '#151525');
  ctx.fillStyle = '#222240';
  for (let cx = 0; cx < 850; cx += 40) ctx.fillRect(cx, 393, 20, 4);
  drawRect(ctx, 0, 575, 850, 30, '#151525');
  ctx.fillStyle = '#222240';
  for (let cx = 0; cx < 850; cx += 40) ctx.fillRect(cx, 588, 20, 4);
}

function drawCubicle(ctx: CanvasRenderingContext2D, agentId: string) {
  const c = CUBICLES[agentId];
  if (!c) return;
  const color = AGENT_COLORS[agentId] || '#666666';
  ctx.fillStyle = '#2a2a44';
  ctx.fillRect(c.x, c.y, c.w, 3);
  ctx.fillRect(c.x, c.y, 3, c.h);
  ctx.fillRect(c.x + c.w - 3, c.y, 3, c.h);
  drawRect(ctx, c.x + 3, c.y + 3, c.w - 6, c.h - 3, '#181830');
  drawRect(ctx, c.deskX, c.deskY, 50, 28, '#4a3528');
  drawPixelBorder(ctx, c.deskX, c.deskY, 50, 28, '#6a5548', 2);
  drawRect(ctx, c.deskX + 15, c.deskY - 10, 20, 14, '#111122');
  drawPixelBorder(ctx, c.deskX + 15, c.deskY - 10, 20, 14, '#333355', 1);
  drawRect(ctx, c.deskX + 17, c.deskY - 8, 16, 10, '#003366');
  drawRect(ctx, c.deskX + 23, c.deskY + 4, 4, 4, '#333355');
  drawRect(ctx, c.deskX + 12, c.deskY + 18, 26, 6, '#222233');
  drawRect(ctx, c.chairX, c.chairY, 16, 16, '#333355');
  drawPixelBorder(ctx, c.chairX, c.chairY, 16, 16, '#444466', 1);
  drawRect(ctx, c.chairX + 2, c.chairY - 6, 12, 8, '#333355');
  drawDeskItem(ctx, agentId, c.deskX + 3, c.deskY + 4);
  const nameY = c.y + c.h - 28;
  drawRect(ctx, c.x + c.w / 2 - 38, nameY, 76, 24, '#111122');
  drawPixelBorder(ctx, c.x + c.w / 2 - 38, nameY, 76, 24, color + '44', 1);
  drawPixelText(ctx, AGENT_NAMES[agentId] || agentId, c.x + c.w / 2, nameY + 10, color, 9);
  drawPixelText(ctx, AGENT_ROLES[agentId] || '', c.x + c.w / 2, nameY + 21, '#778899', 7);
}

function drawDeskItem(ctx: CanvasRenderingContext2D, agentId: string, x: number, y: number) {
  const item = DESK_ITEMS[agentId];
  switch (item) {
    case 'lobster':
      ctx.fillStyle = '#ff4400';
      ctx.fillRect(x, y + 2, 10, 6); ctx.fillRect(x + 2, y, 2, 2); ctx.fillRect(x + 6, y, 2, 2);
      ctx.fillRect(x - 2, y + 3, 3, 2); ctx.fillRect(x + 9, y + 3, 3, 2); break;
    case 'robot':
      ctx.fillStyle = '#00cc33';
      ctx.fillRect(x + 2, y, 8, 8); ctx.fillRect(x + 4, y + 2, 2, 2); ctx.fillRect(x + 7, y + 2, 2, 2);
      ctx.fillRect(x + 3, y + 5, 6, 2); ctx.fillRect(x, y + 3, 2, 4); ctx.fillRect(x + 10, y + 3, 2, 4); break;
    case 'bolt':
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(x + 6, y, 4, 3); ctx.fillRect(x + 3, y + 3, 6, 3); ctx.fillRect(x + 2, y + 6, 4, 3); break;
    case 'globe':
      ctx.fillStyle = '#4488ff'; ctx.fillRect(x + 2, y, 8, 10);
      ctx.fillStyle = '#33cc55'; ctx.fillRect(x + 3, y + 2, 3, 3); ctx.fillRect(x + 7, y + 5, 2, 3); break;
    case 'magnifier':
      ctx.fillStyle = '#ff44ff'; ctx.fillRect(x + 2, y, 6, 6);
      ctx.fillStyle = '#cc22cc'; ctx.fillRect(x + 4, y + 2, 2, 2); ctx.fillRect(x + 6, y + 6, 2, 4); break;
    case 'shield':
      ctx.fillStyle = '#ffaa00'; ctx.fillRect(x + 2, y, 8, 10);
      ctx.fillStyle = '#cc8800'; ctx.fillRect(x + 4, y + 2, 4, 4); break;
    case 'laptop':
      ctx.fillStyle = '#44ff88'; ctx.fillRect(x, y + 4, 12, 6); ctx.fillRect(x + 1, y, 10, 5);
      ctx.fillStyle = '#228844'; ctx.fillRect(x + 2, y + 1, 8, 3); break;
    case 'pen':
      ctx.fillStyle = '#ff8844'; ctx.fillRect(x + 4, y, 3, 10);
      ctx.fillStyle = '#cc6622'; ctx.fillRect(x + 5, y + 8, 1, 3); break;
    case 'gear':
      ctx.fillStyle = '#8844ff'; ctx.fillRect(x + 2, y + 2, 8, 8);
      ctx.fillStyle = '#6622cc'; ctx.fillRect(x + 4, y + 4, 4, 4);
      ctx.fillRect(x + 4, y, 4, 2); ctx.fillRect(x + 4, y + 10, 4, 2);
      ctx.fillRect(x, y + 4, 2, 4); ctx.fillRect(x + 10, y + 4, 2, 4); break;
    case 'palette':
      ctx.fillStyle = '#ff4488'; ctx.fillRect(x + 1, y + 1, 10, 8);
      ctx.fillStyle = '#ff0000'; ctx.fillRect(x + 2, y + 3, 3, 3);
      ctx.fillStyle = '#0000ff'; ctx.fillRect(x + 6, y + 2, 3, 3);
      ctx.fillStyle = '#ffff00'; ctx.fillRect(x + 4, y + 6, 3, 2); break;
  }
}

function drawStatusLED(ctx: CanvasRenderingContext2D, agentId: string, status: 'working' | 'idle', frame: number) {
  const c = CUBICLES[agentId];
  if (!c) return;
  const ledX = c.x + c.w - 14;
  const ledY = c.y + 8;
  if (status === 'working') {
    const pulse = Math.sin(frame * 0.1) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(0, 255, 65, ${pulse})`;
    ctx.fillRect(ledX, ledY, 8, 8);
    ctx.fillStyle = `rgba(0, 255, 65, ${pulse * 0.3})`;
    ctx.fillRect(ledX - 2, ledY - 2, 12, 12);
  } else {
    ctx.fillStyle = '#665500';
    ctx.fillRect(ledX, ledY, 8, 8);
  }
}

// ===== CHARACTER DRAWING =====

function drawCharacter(ctx: CanvasRenderingContext2D, sprite: AgentSprite, frame: number) {
  const color = AGENT_COLORS[sprite.id] || '#888888';
  let x = Math.round(sprite.x);
  let y = Math.round(sprite.y);

  // Ping pong player sway
  if (sprite.currentActivity === 'ping_pong_player' && sprite.phase === 'performing_activity') {
    x += Math.round(Math.sin(frame * 0.12) * 2);
  }

  if (sprite.state === 'sitting') {
    drawSittingCharacter(ctx, x, y, color, sprite, frame);
  } else {
    drawStandingCharacter(ctx, x, y, color, sprite, frame);
  }
}

function drawSittingCharacter(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, sprite: AgentSprite, frame: number) {
  ctx.fillStyle = '#ffcc99';
  ctx.fillRect(x + 4, y - 16, 12, 12);
  ctx.fillStyle = color;
  ctx.fillRect(x + 3, y - 18, 14, 5);
  ctx.fillStyle = '#111111';
  ctx.fillRect(x + 6, y - 12, 2, 2);
  ctx.fillRect(x + 12, y - 12, 2, 2);
  ctx.fillStyle = color;
  ctx.fillRect(x + 3, y - 4, 14, 12);

  // Typing animation only for actual work or arcade
  const isTyping =
    (sprite.status === 'working' && sprite.phase === 'sitting_working') ||
    sprite.currentActivity === 'arcade_play';

  ctx.fillStyle = '#ffcc99';
  if (isTyping) {
    const t = frame % 8 < 4 ? 0 : 2;
    ctx.fillRect(x - 2, y - 2 + t, 5, 4);
    ctx.fillRect(x + 17, y - 2 - t, 5, 4);
  } else {
    ctx.fillRect(x - 2, y - 2, 5, 4);
    ctx.fillRect(x + 17, y - 2, 5, 4);
  }

  ctx.fillStyle = '#334466';
  ctx.fillRect(x + 4, y + 8, 5, 6);
  ctx.fillRect(x + 11, y + 8, 5, 6);
}

function drawStandingCharacter(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, sprite: AgentSprite, frame: number) {
  const isWalking = sprite.state === 'walking';
  const walkCycle = isWalking ? Math.floor(frame / 6) % 4 : 0;

  ctx.fillStyle = '#ffcc99';
  ctx.fillRect(x + 4, y, 12, 12);
  ctx.fillStyle = color;
  ctx.fillRect(x + 3, y - 2, 14, 5);
  ctx.fillStyle = '#111111';
  if (sprite.direction > 0) {
    ctx.fillRect(x + 8, y + 4, 2, 2);
    ctx.fillRect(x + 13, y + 4, 2, 2);
  } else {
    ctx.fillRect(x + 5, y + 4, 2, 2);
    ctx.fillRect(x + 10, y + 4, 2, 2);
  }

  ctx.fillStyle = color;
  ctx.fillRect(x + 3, y + 12, 14, 14);

  ctx.fillStyle = '#ffcc99';
  if (isWalking) {
    const armSwing = walkCycle < 2 ? -3 : 3;
    ctx.fillRect(x - 2, y + 14 + armSwing, 5, 10);
    ctx.fillRect(x + 17, y + 14 - armSwing, 5, 10);
  } else {
    ctx.fillRect(x - 2, y + 14, 5, 10);
    ctx.fillRect(x + 17, y + 14, 5, 10);
  }

  ctx.fillStyle = '#334466';
  if (isWalking) {
    const legSwing = walkCycle < 2 ? 3 : -3;
    ctx.fillRect(x + 4, y + 26 + legSwing, 5, 12);
    ctx.fillRect(x + 11, y + 26 - legSwing, 5, 12);
  } else {
    ctx.fillRect(x + 4, y + 26, 5, 12);
    ctx.fillRect(x + 11, y + 26, 5, 12);
  }

  ctx.fillStyle = '#222233';
  if (isWalking) {
    const legSwing = walkCycle < 2 ? 3 : -3;
    ctx.fillRect(x + 3, y + 36 + legSwing, 7, 4);
    ctx.fillRect(x + 10, y + 36 - legSwing, 7, 4);
  } else {
    ctx.fillRect(x + 3, y + 36, 7, 4);
    ctx.fillRect(x + 10, y + 36, 7, 4);
  }
}

// ===== MAIN ENGINE =====

export interface OfficeAgentState {
  id: string;
  status: 'working' | 'idle';
  activity: string;
}

export class PixelOfficeEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private offscreen: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private sprites: Map<string, AgentSprite> = new Map();
  private frame = 0;
  private animId = 0;
  private sceneDrawn = false;
  private activityManager = new ActivityManager();

  // Ping pong ball
  private pongBall = { x: 970, y: 325, vx: 3 };

  // Arya patrol state
  private aryaPatrol = {
    waypointIndex: 0,
    pauseTimer: 0,
    cooldown: 1800 + Math.floor(Math.random() * 600),
    meetingTriggered: false,
  };

  // Meeting state
  private meeting = {
    active: false,
    participants: [] as string[],
    timer: 0,
  };

  // Chat bubbles
  private chatBubbles: Map<string, ChatBubble> = new Map();
  private bubbleBounds: Map<string, BubbleBounds> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;

    this.offscreen = document.createElement('canvas');
    this.offscreen.width = W;
    this.offscreen.height = H;
    this.offCtx = this.offscreen.getContext('2d')!;
    this.offCtx.imageSmoothingEnabled = false;

    for (const id of ALL_AGENTS) {
      const c = CUBICLES[id];
      const startX = id === 'main' ? 410 : c.chairX;
      const startY = id === 'main' ? 105 : c.chairY - 30;
      this.sprites.set(id, {
        id,
        x: startX, y: startY,
        targetX: startX, targetY: startY,
        status: 'idle',
        activity: '',
        phase: 'sitting_working',
        currentActivity: null,
        activityTimer: Math.floor(Math.random() * 300) + 300,
        subPhase: 0,
        state: 'sitting',
        walkFrame: 0,
        sitFrame: 0,
        direction: 1,
        handoffTarget: null,
        alertTimer: 0,
      });
    }
  }

  drawScene() {
    const ctx = this.offCtx;
    drawFloor(ctx);
    drawCorridors(ctx);
    drawConferenceRoom(ctx);
    drawBossOffice(ctx);
    drawKitchen(ctx);
    drawLounge(ctx);
    for (const id of ALL_AGENTS) drawCubicle(ctx, id);
    this.sceneDrawn = true;
  }

  updateAgentStates(agents: OfficeAgentState[]) {
    for (const a of agents) {
      const sprite = this.sprites.get(a.id);
      if (!sprite) continue;

      const prevStatus = sprite.status;
      sprite.status = a.status;
      sprite.activity = a.activity;

      if (prevStatus !== a.status) {
        if (a.status === 'working') {
          // Cancel activity, go to desk
          if (sprite.currentActivity) {
            this.activityManager.vacate(sprite.currentActivity, sprite.id);
            sprite.currentActivity = null;
          }
          sprite.subPhase = 0;
          sprite.phase = 'walking_to_desk';
          this.setDeskTarget(sprite);
        } else {
          // Became idle — brief cooldown then pick activity
          sprite.activityTimer = 600 + Math.floor(Math.random() * 600);
          // Stay at desk if already there
          if (sprite.phase === 'sitting_working') {
            // keep sitting, will pick activity when timer expires
          } else {
            sprite.phase = 'walking_to_desk';
            this.setDeskTarget(sprite);
          }
        }
      }
    }
  }

  triggerHandoff(fromId: string, toId: string) {
    const sprite = this.sprites.get(fromId);
    if (!sprite) return;
    if (sprite.phase === 'arya_patrol') return;

    if (sprite.currentActivity) {
      this.activityManager.vacate(sprite.currentActivity, sprite.id);
      sprite.currentActivity = null;
    }
    sprite.subPhase = 0;
    sprite.handoffTarget = toId;
    sprite.phase = 'walking_to_handoff';

    if (toId === 'main') {
      sprite.targetX = 440;
      sprite.targetY = 130;
    } else {
      const c = CUBICLES[toId];
      sprite.targetX = c.chairX + 20;
      sprite.targetY = c.chairY - 10;
    }
  }

  updateChatBubble(agentId: string, text: string, done: boolean) {
    const preview = text.length > 60 ? text.slice(0, 57) + '...' : text;
    this.chatBubbles.set(agentId, {
      agentId, text, preview, done,
      fadeTimer: done ? 300 : 0,
    });
  }

  getChatBubbleAt(x: number, y: number): ChatBubble | null {
    for (const [id, bounds] of this.bubbleBounds) {
      if (x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h) {
        return this.chatBubbles.get(id) || null;
      }
    }
    return null;
  }

  // --- Movement helper ---

  private walkTowards(sprite: AgentSprite, tx: number, ty: number, speed = 1.2): boolean {
    const dx = tx - sprite.x;
    const dy = ty - sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 3) {
      sprite.x = tx;
      sprite.y = ty;
      return true;
    }
    sprite.x += (dx / dist) * speed;
    sprite.y += (dy / dist) * speed;
    sprite.direction = dx > 0 ? 1 : -1;
    sprite.walkFrame++;
    sprite.state = 'walking';
    return false;
  }

  private setDeskTarget(sprite: AgentSprite) {
    if (sprite.id === 'main') {
      sprite.targetX = 410;
      sprite.targetY = 105;
    } else {
      const c = CUBICLES[sprite.id];
      sprite.targetX = c.chairX;
      sprite.targetY = c.chairY - 30;
    }
  }

  // --- State machine ---

  private updateSprite(sprite: AgentSprite) {
    // Arya patrol trigger (only when sitting at desk and working)
    if (sprite.id === 'main' && sprite.phase === 'sitting_working' && sprite.status === 'working') {
      this.aryaPatrol.cooldown--;
      if (this.aryaPatrol.cooldown <= 0) {
        if (Math.random() < 0.3) {
          sprite.phase = 'arya_patrol';
          this.aryaPatrol.waypointIndex = 0;
          this.aryaPatrol.pauseTimer = 0;
          this.aryaPatrol.meetingTriggered = false;
        }
        this.aryaPatrol.cooldown = 1800 + Math.floor(Math.random() * 600);
      }
    }

    switch (sprite.phase) {
      case 'walking_to_desk':
        if (this.walkTowards(sprite, sprite.targetX, sprite.targetY, 1.5)) {
          sprite.phase = 'sitting_working';
          sprite.state = 'sitting';
          sprite.sitFrame = 0;
          if (sprite.status === 'idle') {
            sprite.activityTimer = 600 + Math.floor(Math.random() * 600);
          }
        }
        break;

      case 'sitting_working':
        sprite.state = 'sitting';
        sprite.sitFrame++;
        if (sprite.status === 'idle' && sprite.id !== 'main') {
          sprite.activityTimer--;
          if (sprite.activityTimer <= 0) {
            this.pickAndStartActivity(sprite);
          }
        }
        break;

      case 'walking_to_activity':
        if (this.walkTowards(sprite, sprite.targetX, sprite.targetY, 1.0)) {
          sprite.phase = 'performing_activity';
          sprite.subPhase = 0;
          this.activityManager.occupy(sprite.currentActivity!, sprite.id);
          this.setActivityVisualState(sprite);
        }
        break;

      case 'performing_activity':
        this.performActivity(sprite);
        break;

      case 'walking_to_handoff':
        if (this.walkTowards(sprite, sprite.targetX, sprite.targetY, 1.3)) {
          sprite.phase = 'delivering_handoff';
          sprite.activityTimer = 90;
          sprite.state = 'standing';
        }
        break;

      case 'delivering_handoff':
        sprite.state = 'standing';
        sprite.activityTimer--;
        if (sprite.activityTimer <= 0) {
          sprite.handoffTarget = null;
          if (sprite.status === 'working') {
            sprite.phase = 'walking_to_desk';
            this.setDeskTarget(sprite);
          } else {
            sprite.activityTimer = 300;
            sprite.phase = 'walking_to_desk';
            this.setDeskTarget(sprite);
          }
        }
        break;

      case 'arya_patrol':
        this.updateAryaPatrol(sprite);
        break;
    }
  }

  private pickAndStartActivity(sprite: AgentSprite) {
    const act = this.activityManager.pickActivity(sprite.id);
    if (!act) return;

    sprite.currentActivity = act.type;
    sprite.activityTimer = act.duration;
    sprite.subPhase = 0;

    if (act.type === 'desk_browse') {
      // Stay at desk (or return to desk)
      this.setDeskTarget(sprite);
      const dx = sprite.targetX - sprite.x;
      const dy = sprite.targetY - sprite.y;
      if (Math.sqrt(dx * dx + dy * dy) < 5) {
        sprite.phase = 'performing_activity';
        this.activityManager.occupy(act.type, sprite.id);
        sprite.state = 'sitting';
      } else {
        sprite.phase = 'walking_to_activity';
        sprite.targetX = act.position.x;
        sprite.targetY = act.position.y;
      }
    } else {
      sprite.targetX = act.position.x;
      sprite.targetY = act.position.y;
      sprite.phase = 'walking_to_activity';
    }
  }

  private setActivityVisualState(sprite: AgentSprite) {
    switch (sprite.currentActivity) {
      case 'couch_sit':
      case 'kitchen_eat':
      case 'arcade_play':
      case 'desk_browse':
      case 'conference_meeting':
        sprite.state = 'sitting';
        break;
      default:
        sprite.state = 'standing';
        break;
    }
  }

  private performActivity(sprite: AgentSprite) {
    if (!sprite.currentActivity) return;

    // Multi-phase: coffee run
    if (sprite.currentActivity === 'coffee_run') {
      this.updateCoffeeRun(sprite);
      return;
    }

    // Standard activities
    this.setActivityVisualState(sprite);
    sprite.sitFrame++;
    sprite.activityTimer--;

    if (sprite.activityTimer <= 0) {
      this.finishActivity(sprite);
    }
  }

  private updateCoffeeRun(sprite: AgentSprite) {
    if (sprite.subPhase === 0) {
      // Standing at coffee machine
      sprite.state = 'standing';
      sprite.activityTimer--;
      if (sprite.activityTimer <= 0) {
        sprite.subPhase = 1;
        sprite.targetX = 648;
        sprite.targetY = 120;
      }
    } else if (sprite.subPhase === 1) {
      // Walking to kitchen table
      if (this.walkTowards(sprite, sprite.targetX, sprite.targetY, 1.0)) {
        sprite.subPhase = 2;
        sprite.activityTimer = 180 + Math.floor(Math.random() * 120);
      }
    } else {
      // Sitting at table drinking
      sprite.state = 'sitting';
      sprite.sitFrame++;
      sprite.activityTimer--;
      if (sprite.activityTimer <= 0) {
        this.finishActivity(sprite);
      }
    }
  }

  private finishActivity(sprite: AgentSprite) {
    if (sprite.currentActivity) {
      this.activityManager.vacate(sprite.currentActivity, sprite.id);
    }
    sprite.currentActivity = null;
    sprite.subPhase = 0;
    sprite.phase = 'walking_to_desk';
    this.setDeskTarget(sprite);
  }

  // --- Arya patrol ---

  private updateAryaPatrol(sprite: AgentSprite) {
    const wp = ARYA_PATROL_WAYPOINTS[this.aryaPatrol.waypointIndex];
    if (!wp) {
      // Patrol complete
      sprite.phase = 'walking_to_desk';
      this.setDeskTarget(sprite);
      return;
    }

    if (this.aryaPatrol.pauseTimer > 0) {
      // Pausing at waypoint
      sprite.state = 'standing';
      this.aryaPatrol.pauseTimer--;

      // Alert nearby agents
      this.sprites.forEach(other => {
        if (other.id === 'main') return;
        const dx = sprite.x - other.x;
        const dy = sprite.y - other.y;
        if (Math.sqrt(dx * dx + dy * dy) < 120) {
          other.alertTimer = 60;
        }
      });

      // Meeting trigger (once per patrol, 15% chance at waypoint 3+)
      if (!this.aryaPatrol.meetingTriggered && this.aryaPatrol.waypointIndex >= 3 && Math.random() < 0.003) {
        this.startMeeting(sprite);
        this.aryaPatrol.meetingTriggered = true;
      }

      if (this.aryaPatrol.pauseTimer <= 0) {
        this.aryaPatrol.waypointIndex++;
      }
      return;
    }

    // Walk to next waypoint
    if (this.walkTowards(sprite, wp.x, wp.y, 1.2)) {
      this.aryaPatrol.pauseTimer = 60;
    }
  }

  private startMeeting(arya: AgentSprite) {
    // Pick 2-3 idle agents
    const idle: AgentSprite[] = [];
    this.sprites.forEach(s => {
      if (s.id !== 'main' && s.status === 'idle' && s.phase !== 'walking_to_handoff' && s.phase !== 'delivering_handoff') {
        idle.push(s);
      }
    });
    if (idle.length < 2) return;

    // Shuffle and pick 2-3
    const shuffled = idle.sort(() => Math.random() - 0.5);
    const count = Math.min(shuffled.length, Math.random() < 0.5 ? 2 : 3);
    const participants = shuffled.slice(0, count);

    this.meeting.active = true;
    this.meeting.participants = participants.map(p => p.id);
    const duration = 300 + Math.floor(Math.random() * 180);
    this.meeting.timer = duration;

    // Send participants to conference room
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      if (p.currentActivity) {
        this.activityManager.vacate(p.currentActivity, p.id);
      }
      p.currentActivity = 'conference_meeting';
      p.targetX = CONFERENCE_SEATS[i].x;
      p.targetY = CONFERENCE_SEATS[i].y;
      p.activityTimer = duration;
      p.subPhase = 0;
      p.phase = 'walking_to_activity';
    }

    // Arya goes to conference room too
    arya.phase = 'walking_to_activity';
    arya.currentActivity = 'conference_meeting';
    arya.targetX = ARYA_CONF_SEAT.x;
    arya.targetY = ARYA_CONF_SEAT.y;
    arya.activityTimer = duration;
    arya.subPhase = 0;
  }

  // --- Rendering overlays ---

  private renderOverlays() {
    const ctx = this.ctx;

    // Ping pong ball
    if (this.activityManager.getOccupantCount('ping_pong_player') === 2) {
      this.pongBall.x += this.pongBall.vx;
      if (this.pongBall.x <= 895 || this.pongBall.x >= 1055) {
        this.pongBall.vx = -this.pongBall.vx;
      }
      const by = 325 + Math.sin(this.frame * 0.15) * 12;
      drawRect(ctx, Math.round(this.pongBall.x), Math.round(by), 4, 4, '#ffffff');
    }

    // Arcade screen glow
    if (this.activityManager.getOccupantCount('arcade_play') > 0) {
      const colors = ['#003300', '#005500', '#002200', '#004400'];
      drawRect(ctx, 910, 450, 30, 20, colors[Math.floor(this.frame / 10) % colors.length]);
    }

    // Per-sprite overlays
    this.sprites.forEach(sprite => {
      const x = Math.round(sprite.x);
      const y = Math.round(sprite.y);

      // Coffee cup (during coffee_run, subPhase 0-1 = carrying)
      if (sprite.currentActivity === 'coffee_run') {
        const handX = sprite.state === 'walking' ? x + 19 : x + 18;
        const handY = sprite.state === 'sitting' ? y - 1 : y + 16;
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(handX, handY, 5, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(handX + 1, handY - 2, 3, 2);
      }

      // Book icon (read_book)
      if (sprite.currentActivity === 'read_book' && sprite.phase === 'performing_activity') {
        ctx.fillStyle = '#cc3333';
        ctx.fillRect(x + 17, y + 16, 6, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 19, y + 18, 2, 4);
      }

      // Plate icon (kitchen_eat)
      if (sprite.currentActivity === 'kitchen_eat' && sprite.phase === 'performing_activity') {
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(x - 6, y + 6, 12, 3);
        ctx.fillStyle = '#ff8844';
        ctx.fillRect(x - 4, y + 3, 8, 3);
      }

      // Handoff document
      if (sprite.phase === 'walking_to_handoff' || sprite.phase === 'delivering_handoff') {
        const dx = sprite.state === 'walking' ? x + 19 : x + 18;
        const dy = sprite.state === 'walking' ? y + 14 : y - 1;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(dx, dy, 8, 10);
        ctx.fillStyle = '#888888';
        ctx.fillRect(dx + 2, dy + 2, 4, 1);
        ctx.fillRect(dx + 2, dy + 4, 4, 1);
        ctx.fillRect(dx + 2, dy + 6, 3, 1);
      }

      // Alert icon (Arya patrol nearby)
      if (sprite.alertTimer > 0) {
        const alpha = sprite.alertTimer > 30 ? 1 : sprite.alertTimer / 30;
        ctx.fillStyle = `rgba(255, 68, 68, ${alpha})`;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', x + 10, y - 24);
        ctx.textAlign = 'start';
        sprite.alertTimer--;
      }
    });

    // Water cooler speech bubble
    const wcOccupants = Array.from(this.activityManager.getOccupants('water_cooler_chat'));
    if (wcOccupants.length > 1) {
      const speakerIdx = Math.floor(this.frame / 90) % wcOccupants.length;
      const speaker = this.sprites.get(wcOccupants[speakerIdx]);
      if (speaker) {
        const sx = Math.round(speaker.x);
        const sy = Math.round(speaker.y);
        ctx.fillStyle = '#000000';
        ctx.fillRect(sx + 1, sy - 10, 20, 14);
        drawPixelBorder(ctx, sx + 1, sy - 10, 20, 14, '#ffffff', 1);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('...', sx + 11, sy + 1);
        ctx.textAlign = 'start';
        // Tail
        ctx.fillStyle = '#000000';
        ctx.fillRect(sx + 8, sy + 4, 4, 3);
      }
    }
  }

  // --- Chat bubble rendering ---

  private renderChatBubbles() {
    const ctx = this.ctx;
    this.bubbleBounds.clear();

    this.chatBubbles.forEach((bubble, agentId) => {
      const sprite = this.sprites.get(agentId);
      if (!sprite) return;

      // Only show when agent is at their desk (sitting working)
      if (sprite.phase !== 'sitting_working' && sprite.phase !== 'walking_to_desk') return;

      const color = AGENT_COLORS[agentId] || '#888888';
      const c = CUBICLES[agentId];
      let bx: number, by: number;
      if (agentId === 'main') {
        bx = 420; by = 45;
      } else {
        bx = c.x + c.w / 2;
        by = c.y - 5;
      }

      const text = bubble.preview;
      const tw = Math.min(text.length * 5 + 16, 320);
      const th = 18;
      const rx = bx - tw / 2;
      const ry = by - th;

      // Fade alpha
      let alpha = 1;
      if (bubble.done && bubble.fadeTimer < 60) {
        alpha = bubble.fadeTimer / 60;
      }

      // Background
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#000000';
      ctx.fillRect(rx, ry, tw, th);
      drawPixelBorder(ctx, rx, ry, tw, th, color, 1);

      // Tail
      ctx.fillStyle = '#000000';
      ctx.fillRect(bx - 3, by, 6, 4);

      // Text (blink during streaming)
      const showText = bubble.done || this.frame % 20 < 14;
      if (showText) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(text, bx, by - 5);
        ctx.textAlign = 'start';
      }

      // Typing dots during delta
      if (!bubble.done) {
        const dotPhase = Math.floor(this.frame / 8) % 4;
        ctx.fillStyle = color;
        ctx.fillRect(rx + tw - 14, ry + 6, 3, 3);
        if (dotPhase >= 1) ctx.fillRect(rx + tw - 10, ry + 6, 3, 3);
        if (dotPhase >= 2) ctx.fillRect(rx + tw - 6, ry + 6, 3, 3);
      }

      ctx.globalAlpha = 1;

      // Store bounds for click detection
      this.bubbleBounds.set(agentId, { x: rx, y: ry, w: tw, h: th + 4 });

      // Update fade timer
      if (bubble.done) {
        bubble.fadeTimer--;
        if (bubble.fadeTimer <= 0) {
          this.chatBubbles.delete(agentId);
          this.bubbleBounds.delete(agentId);
        }
      }
    });
  }

  // --- Meeting update ---

  private updateMeeting() {
    if (!this.meeting.active) return;

    this.meeting.timer--;
    if (this.meeting.timer <= 0) {
      // End meeting
      this.meeting.active = false;
      for (const pid of this.meeting.participants) {
        const p = this.sprites.get(pid);
        if (p && p.currentActivity === 'conference_meeting') {
          this.activityManager.vacate('conference_meeting', pid);
          p.currentActivity = null;
          p.phase = 'walking_to_desk';
          this.setDeskTarget(p);
          p.activityTimer = 60 + Math.floor(Math.random() * 60);
        }
      }
      // Arya returns to Boss Office
      const arya = this.sprites.get('main');
      if (arya && arya.currentActivity === 'conference_meeting') {
        this.activityManager.vacate('conference_meeting', 'main');
        arya.currentActivity = null;
        arya.phase = 'walking_to_desk';
        this.setDeskTarget(arya);
      }
      this.meeting.participants = [];
    }
  }

  // --- Main render loop ---

  private renderFrame = () => {
    if (!this.sceneDrawn) this.drawScene();

    // Draw static background
    this.ctx.drawImage(this.offscreen, 0, 0);

    // Update meeting
    this.updateMeeting();

    // Update and draw all sprites
    this.sprites.forEach(sprite => {
      this.updateSprite(sprite);
      drawCharacter(this.ctx, sprite, this.frame);
    });

    // Status LEDs
    this.sprites.forEach(sprite => {
      drawStatusLED(this.ctx, sprite.id, sprite.status, this.frame);
    });

    // Activity tooltips (only for working agents at desk)
    this.sprites.forEach(sprite => {
      if (sprite.status === 'working' && sprite.phase === 'sitting_working' && sprite.activity) {
        let tooltipX: number, tooltipY: number;
        if (sprite.id === 'main') {
          tooltipX = 420; tooltipY = 60;
        } else {
          const c = CUBICLES[sprite.id];
          tooltipX = c.x + c.w / 2;
          tooltipY = c.y - 8;
        }
        const text = sprite.activity;
        const tw = text.length * 5 + 10;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(tooltipX - tw / 2, tooltipY - 12, tw, 14);
        drawPixelText(this.ctx, text, tooltipX, tooltipY, AGENT_COLORS[sprite.id] || '#ffffff', 8);
      }
    });

    // Overlays (ping pong ball, items, alerts)
    this.renderOverlays();

    // Chat bubbles (on top of everything)
    this.renderChatBubbles();

    // Clock
    const now = new Date();
    const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    drawRect(this.ctx, W - 80, H - 30, 70, 22, '#111122');
    drawPixelBorder(this.ctx, W - 80, H - 30, 70, 22, '#333355', 1);
    drawPixelText(this.ctx, timeStr, W - 45, H - 13, '#00ff41', 11);

    // Title
    drawPixelText(this.ctx, 'PIXEL OFFICE', 80, H - 13, '#334455', 10);

    // Agent count badge
    let workingCount = 0;
    this.sprites.forEach(s => { if (s.status === 'working') workingCount++; });
    const badgeText = `${workingCount}/10 ACTIVE`;
    drawRect(this.ctx, 140, H - 26, 80, 16, '#112211');
    drawPixelText(this.ctx, badgeText, 180, H - 13, '#00ff41', 9);

    this.frame++;
    this.animId = requestAnimationFrame(this.renderFrame);
  };

  start() {
    this.renderFrame();
  }

  stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = 0;
    }
  }

  destroy() {
    this.stop();
    this.sprites.clear();
  }
}
