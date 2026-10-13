// Line-art body figures for the sizes step (D-026). Pure data, no React, so a preview script can draw the same paths.
// Each figure is split into named regions so one part can light up. The figure is faceless and neutral on purpose.
// Every outline is a smooth curve through a short list of points (x measured as distance from the middle line).

export type BodyRegion = "upper" | "waist" | "lower" | "feet";
export type FigureKind = "woman" | "man" | "kid";

export type FigureShape = {
  viewBox: { width: number; height: number };
  /** The head and neck. Never lights up. */
  head: string;
  regions: Record<BodyRegion, string>;
};

/** A point as [distance from the middle line, y]. */
type P = [number, number];

const CX = 100;
const r = (n: number) => Math.round(n * 10) / 10;
const abs = ([h, y]: P, side: 1 | -1 = 1): P => [CX - side * h, y];
const num = (p: P) => `${r(p[0])} ${r(p[1])}`;

/** Smooth open curve through the points (Catmull-Rom turned into cubic curves). Starts where the pen already is. */
function curve(pts: P[]): string {
  let out = "";
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)] as P;
    const p1 = pts[i] as P;
    const p2 = pts[i + 1] as P;
    const p3 = pts[Math.min(pts.length - 1, i + 2)] as P;
    const c1: P = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: P = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    out += `C${num(c1)} ${num(c2)} ${num(p2)} `;
  }
  return out;
}

/** Smooth closed loop through the points. */
function loop(pts: P[]): string {
  const n = pts.length;
  let out = `M${num(pts[0] as P)} `;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n] as P;
    const p1 = pts[i] as P;
    const p2 = pts[(i + 1) % n] as P;
    const p3 = pts[(i + 2) % n] as P;
    const c1: P = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: P = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    out += `C${num(c1)} ${num(c2)} ${num(p2)} `;
  }
  return `${out}Z`;
}

const toAbs = (pts: P[], side: 1 | -1) => pts.map((p) => abs(p, side));
const reversed = <T>(list: T[]) => [...list].reverse();

/** Left edge going down, straight across, the same edge mirrored going up, straight back to the start. */
function symmetric(left: P[]): string {
  const l = toAbs(left, 1);
  const rt = reversed(toAbs(left, -1));
  return `M${num(l[0] as P)} ${curve(l)}L${num(rt[0] as P)} ${curve(rt)}Z`;
}

type Spec = {
  height: number;
  head: { cy: number; rx: number; ry: number };
  neck: P[]; // left edge from the chin down to the neck base
  torso: P[]; // left edge from the neck base down to the waist
  arm: P[]; // closed loop of the left arm
  belt: P[]; // left edge of the band at the waist
  outerLeg: P[]; // from the band down to the ankle
  innerLeg: P[]; // from the inside ankle up to the crotch
  foot: P[]; // closed loop of the left foot
};

function build(s: Spec): FigureShape {
  const { cy, rx, ry } = s.head;
  const head =
    `M${r(CX - rx)} ${cy} A${rx} ${ry} 0 1 1 ${r(CX + rx)} ${cy} A${rx} ${ry} 0 1 1 ${r(CX - rx)} ${cy}Z ` +
    `M${num(abs(s.neck[0] as P))} ${curve(toAbs(s.neck, 1))}` +
    `L${num(abs(s.neck[s.neck.length - 1] as P, -1))} ${curve(reversed(toAbs(s.neck, -1)))}`;

  const arm = loop(toAbs(s.arm, 1));
  const armRight = loop(toAbs(s.arm, -1));

  const outerL = toAbs(s.outerLeg, 1);
  const innerL = toAbs(s.innerLeg, 1);
  const outerR = toAbs(s.outerLeg, -1);
  const innerR = toAbs(s.innerLeg, -1);
  const lower =
    `M${num(outerL[0] as P)} ${curve(outerL)}` +
    `L${num(innerL[0] as P)} ${curve(innerL)}` +
    `${curve(reversed(innerR))}` +
    `L${num(outerR[outerR.length - 1] as P)} ${curve(reversed(outerR))}Z`;

  return {
    viewBox: { width: 200, height: s.height },
    head,
    regions: {
      upper: `${symmetric(s.torso)} ${arm} ${armRight}`,
      waist: symmetric(s.belt),
      lower,
      feet: `${loop(toAbs(s.foot, 1))} ${loop(toAbs(s.foot, -1))}`,
    },
  };
}

const woman: Spec = {
  height: 432,
  head: { cy: 30, rx: 13, ry: 17 },
  neck: [
    [6, 45],
    [6.5, 56],
    [8, 66],
  ],
  torso: [
    [8, 66],
    [22, 69],
    [35, 73],
    [39, 79],
    [37, 90],
    [31, 106],
    [28, 124],
    [25, 142],
    [22, 152],
  ],
  arm: [
    [38, 76],
    [43, 92],
    [46, 118],
    [49, 146],
    [52, 176],
    [54, 204],
    [56, 222],
    [57, 236],
    [54, 243],
    [51, 238],
    [49, 222],
    [47, 204],
    [44, 178],
    [40, 150],
    [35, 124],
    [33, 104],
    [35, 88],
  ],
  belt: [
    [22, 152],
    [24, 160],
    [27, 168],
  ],
  outerLeg: [
    [27, 168],
    [33, 184],
    [35, 204],
    [32, 240],
    [28, 282],
    [25, 318],
    [24, 340],
    [19, 368],
    [12, 392],
  ],
  innerLeg: [
    [3, 392],
    [8, 366],
    [9, 340],
    [6, 306],
    [3, 270],
    [1.5, 246],
    [0, 230],
  ],
  foot: [
    [12, 395],
    [3, 395],
    [3, 410],
    [6, 424],
    [14, 428],
    [20, 424],
    [18, 410],
  ],
};

const man: Spec = {
  height: 432,
  head: { cy: 30, rx: 14, ry: 17 },
  neck: [
    [8, 45],
    [8.5, 56],
    [10, 66],
  ],
  torso: [
    [10, 66],
    [26, 69],
    [42, 73],
    [47, 80],
    [45, 92],
    [39, 108],
    [35, 126],
    [31, 144],
    [30, 154],
  ],
  arm: [
    [46, 77],
    [52, 94],
    [55, 120],
    [57, 148],
    [59, 178],
    [60, 206],
    [61, 224],
    [62, 238],
    [58, 246],
    [54, 240],
    [53, 224],
    [51, 206],
    [49, 178],
    [47, 150],
    [44, 124],
    [41, 106],
    [43, 90],
  ],
  belt: [
    [30, 154],
    [31, 162],
    [32, 170],
  ],
  outerLeg: [
    [32, 170],
    [35, 186],
    [35, 206],
    [33, 242],
    [29, 282],
    [26, 318],
    [25, 340],
    [20, 368],
    [14, 392],
  ],
  innerLeg: [
    [3, 392],
    [6, 366],
    [7, 340],
    [5, 306],
    [3, 270],
    [1.5, 246],
    [0, 232],
  ],
  foot: [
    [14, 395],
    [3, 395],
    [3, 410],
    [6, 424],
    [15, 428],
    [22, 424],
    [20, 410],
  ],
};

const kid: Spec = {
  height: 366,
  head: { cy: 42, rx: 22, ry: 24 },
  neck: [
    [7, 64],
    [7.5, 72],
    [9, 80],
  ],
  torso: [
    [9, 80],
    [20, 83],
    [29, 87],
    [32, 93],
    [30, 103],
    [26, 118],
    [25, 138],
    [24, 156],
    [23, 160],
  ],
  arm: [
    [31, 91],
    [35, 104],
    [37, 124],
    [39, 148],
    [41, 172],
    [42, 192],
    [43, 204],
    [41, 212],
    [38, 207],
    [36, 192],
    [34, 172],
    [31, 148],
    [28, 128],
    [27, 110],
    [28, 99],
  ],
  belt: [
    [23, 160],
    [24, 167],
    [25, 174],
  ],
  outerLeg: [
    [25, 174],
    [27, 188],
    [26, 206],
    [24, 232],
    [21, 258],
    [19, 280],
    [19, 296],
    [15, 316],
    [12, 330],
  ],
  innerLeg: [
    [3, 330],
    [5, 316],
    [6, 296],
    [4, 270],
    [2, 244],
    [0, 214],
  ],
  foot: [
    [12, 333],
    [3, 333],
    [3, 344],
    [6, 354],
    [14, 357],
    [19, 352],
    [17, 342],
  ],
};

export const FIGURES: Record<FigureKind, FigureShape> = {
  woman: build(woman),
  man: build(man),
  kid: build(kid),
};

/** Which parts light up for each step. Dresses and kids' sizes use the whole body from the shoulders to the ankles. */
export type Highlight = BodyRegion | "body";
export const LIT: Record<Highlight, BodyRegion[]> = {
  upper: ["upper"],
  waist: ["waist"],
  lower: ["lower"],
  feet: ["feet"],
  body: ["upper", "waist", "lower"],
};
