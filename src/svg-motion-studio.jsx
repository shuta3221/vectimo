import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";

// ============================================================
// Vectimo（ベクティモ） — 複数SVGをシーンとしてつなげて1本の動画に
// ============================================================

// (サンプルSVGは廃止)

const ANIM_TYPES = {
  none: { label: "なし" },
  fadeIn: { label: "フェードイン" },
  slideUp: { label: "スライド（下から）" },
  slideDown: { label: "スライド（上から）" },
  slideLeft: { label: "スライド（右から）" },
  slideRight: { label: "スライド（左から）" },
  zoomIn: { label: "ズームイン" },
  pop: { label: "ポップ（弾む）" },
  rotateIn: { label: "回転イン" },
  draw: { label: "線描画（ストローク）" },
  pathArc: { label: "軌道：弧を描いて着地" },
  pathArcUp: { label: "軌道：山なりに着地" },
  pathWave: { label: "軌道：波打ちながら" },
  pathZig: { label: "軌道：ジグザグ" },
  pathBounce: { label: "軌道：跳ねながら" },
  pathCircle: { label: "軌道：円を一周" },
  pathSpiral: { label: "軌道：らせん" },
  float: { label: "ふわふわ（ループ）" },
  pulse: { label: "脈打つ（ループ）" },
  spin: { label: "回転し続ける（ループ）" },
  panLeft: { label: "パン：右→左に流す" },
  panRight: { label: "パン：左→右に流す" },
  panUp: { label: "パン：下→上に流す" },
  panDown: { label: "パン：上→下に流す" },
  zoomSlow: { label: "徐々にズームアップ" },
  zoomOutSlow: { label: "徐々にズームアウト" },
  kenburns: { label: "パン＋ズーム（Ken Burns風）" },
  typewriter: { label: "1文字ずつ表示（タイプ）" },
  charFade: { label: "1文字ずつふわっと" },
  marker: { label: "マーカーが引かれる" },
  countUp: { label: "数字カウントアップ" },
  stamp: { label: "スタンプ（ドンと押す）" },
  shake: { label: "シェイク（ぷるぷる）" },
  blink: { label: "点滅" },
  heartbeat: { label: "ハートビート" },
};

const TEXT_TYPES = new Set(["typewriter", "charFade", "marker", "countUp"]);
const EMPH_TYPES = new Set(["stamp", "shake", "blink", "heartbeat"]);

const EXIT_TYPES = {
  none: "なし",
  fadeOut: "フェードアウト",
  slideOutUp: "スライドアウト（上へ）",
  slideOutDown: "スライドアウト（下へ）",
  slideOutLeft: "スライドアウト（左へ）",
  slideOutRight: "スライドアウト（右へ）",
  zoomOut: "ズームアウト",
};

const PAN_TYPES = new Set(["panLeft", "panRight", "panUp", "panDown"]);
const ZOOM_TYPES = new Set(["zoomSlow", "zoomOutSlow", "kenburns"]);
const LOOP_TYPES = new Set(["float", "pulse", "spin", "panLeft", "panRight", "panUp", "panDown", "shake", "blink", "heartbeat"]);
const isLoop = (s) => (s.loop === null || s.loop === undefined ? LOOP_TYPES.has(s.type) : s.loop);

const EASINGS = {
  "ease-out": "標準（ease-out）",
  "ease-in-out": "なめらか（ease-in-out）",
  "cubic-bezier(0.34,1.56,0.64,1)": "バウンス気味",
  "cubic-bezier(0.68,-0.55,0.27,1.55)": "びよん（elastic風）",
  linear: "一定速度（linear）",
  "ease-in": "加速（ease-in）",
};

const TRANSITIONS = {
  cut: "カット（切替のみ）",
  fade: "クロスフェード",
  slideLeft: "スライド（右→左）",
  slideRight: "スライド（左→右）",
  slideUp: "スライド（下→上）",
  slideDown: "スライド（上→下）",
  wipe: "ワイプ（左から）",
  zoom: "ズームフェード",
  rotate: "回転フェード",
  blur: "ぼかしフェード",
  glitch: "グリッチ",
  morph: "モーフ（にじみ変形）",
};

const FRAMES = {
  original: { label: "元のサイズ", dims: null },
  "1:1": { label: "1:1（1080×1080）", dims: [1080, 1080] },
  "9:16": { label: "9:16（1080×1920）", dims: [1080, 1920] },
  "16:9": { label: "16:9（1920×1080）", dims: [1920, 1080] },
};

const ALIGNS = {
  "xMidYMid": "中央",
  "xMidYMin": "上寄せ",
  "xMidYMax": "下寄せ",
  "xMinYMid": "左寄せ",
  "xMaxYMid": "右寄せ",
};

const PART_COLORS = ["#FFB84D", "#6EC6FF", "#8BE28B", "#FF8FA3", "#C9A6FF", "#5FD6C4", "#F2E86D", "#FF9E6E"];

const defaultSetting = () => ({
  type: "fadeIn", duration: 0.8, delay: 0, easing: "ease-out",
  distance: 60, scaleTo: 1.3, loop: null, clip: false, img: null,
  opacity: 1, // パーツの不透明度
  exit: null, // {type, duration}
});

const OV_FONTS = {
  gothic: { label: "ゴシック（標準）", css: "'Noto Sans JP','Hiragino Sans','Yu Gothic',sans-serif" },
  mincho: { label: "明朝", css: "'Noto Serif JP','Hiragino Mincho ProN','Yu Mincho',serif" },
  maru: { label: "丸ゴシック", css: "'M PLUS Rounded 1c','Hiragino Maru Gothic ProN','Yu Gothic',sans-serif" },
  hand: { label: "手書き風", css: "'Klee One','Yu Gothic',cursive" },
  impact: { label: "極太インパクト", css: "'Arial Black','Impact','Noto Sans JP',sans-serif" },
  mono: { label: "等幅", css: "'DM Mono','Courier New',monospace" },
  pop: { label: "ポップ体", css: "'HGP創英角ﾎﾟｯﾌﾟ体','HGPSoeiKakupoptai','Chalkboard SE','Comic Sans MS','Noto Sans JP',sans-serif" },
  kyokasho: { label: "教科書体", css: "'UD デジタル 教科書体 N-R','UD Digi Kyokasho N-R','YuKyokasho','Hiragino Mincho ProN',serif" },
  gyosho: { label: "行書体", css: "'HGS行書体','HGSGyoshotai','Hiragino Mincho ProN','Yu Mincho',cursive" },
  script: { label: "筆記体（欧文）", css: "'Segoe Script','Brush Script MT','Snell Roundhand',cursive" },
  serifEn: { label: "セリフ（欧文）", css: "Georgia,'Times New Roman','Noto Serif JP',serif" },
};

// シーン音声の取得（旧単一audio形式との互換）
function getSceneAudios(s) {
  if (!s) return [];
  if (s.audios) return s.audios;
  if (s.audio?.src) return [{ id: "a0", start: 0, end: s.audio.duration || 0, duration: s.audio.duration || 0, ...s.audio }];
  return [];
}

const defaultOverlay = () => ({
  text: "テロップを入力", x: 50, y: 86, size: 4.5, font: "gothic",
  color: "#FFFFFF", outline: "#000000", style: "outline", bandColor: "#000000",
  anim: "slideUp", duration: 0.6, delay: 0.3, exitFade: true,
});

const defaultImgSetting = () => ({
  type: "none", duration: 4, delay: 0, easing: "linear",
  distance: 60, scaleTo: 1.15, loop: null,
});

const SVGNS = "http://www.w3.org/2000/svg";

// Vectimo ロゴマーク（白→紫グラデのVMジグザグ）
// ===== 線画アイコンセット（lucideスタイル：24グリッド・線幅2・丸端） =====
const Icon = ({ name, size = 16, style }) => {
  const P = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" {...P} /><path d="M17 21v-8H7v8M7 3v5h8" {...P} /></>,
    folder: <path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2Z" {...P} />,
    csvOut: <><path d="M14 3v4a1 1 0 0 0 1 1h4" {...P} /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" {...P} /><path d="M9 13v4M15 13v4M9 15h6" {...P} /></>,
    csvIn: <><path d="M12 3v12m0 0 4-4m-4 4-4-4" {...P} /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" {...P} /></>,
    film: <><rect x="3" y="3" width="18" height="18" rx="2" {...P} /><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4" {...P} /></>,
    play: <path d="M6 4v16l14-8Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
    stop: <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" stroke="none" />,
    undo: <path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" {...P} />,
    redo: <path d="m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" {...P} />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" {...P} />,
    star: <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9Z" {...P} />,
    trash: <><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" {...P} /><path d="M10 11v6M14 11v6" {...P} /></>,
    layers: <path d="m12 2 9 5-9 5-9-5 9-5Z M3 12l9 5 9-5 M3 17l9 5 9-5" {...P} />,
    expand: <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" {...P} />,
    x: <path d="M18 6 6 18M6 6l12 12" {...P} />,
    pin: <path d="M12 17v5M9 3h6l-1 7 3 3H7l3-3-1-7Z" {...P} />,
    minus: <path d="M5 12h14" {...P} />,
    plus: <path d="M12 5v14M5 12h14" {...P} />,
    image: <><rect x="3" y="3" width="18" height="18" rx="2" {...P} /><circle cx="9" cy="9" r="1.6" fill="currentColor" stroke="none" /><path d="m21 15-5-5L5 21" {...P} /></>,
    audio: <path d="M11 5 6 9H3v6h3l5 4V5Z M16 9a4 4 0 0 1 0 6 M19 6a8 8 0 0 1 0 12" {...P} />,
    telop: <><rect x="3" y="5" width="18" height="14" rx="2" {...P} /><path d="M7 10h10M7 14h6" {...P} /></>,
    code: <path d="m8 8-4 4 4 4m8-8 4 4-4 4" {...P} />,
    copy: <><rect x="9" y="9" width="12" height="12" rx="2" {...P} /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" {...P} /></>,
    add: <path d="M12 5v14M5 12h14" {...P} />,
    dot: <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />,
    settings: <><circle cx="12" cy="12" r="3" {...P} /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H7a1.6 1.6 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" {...P} /></>,
    edit: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" {...P} />,
    music: <><path d="M9 18V5l12-2v13" {...P} /><circle cx="6" cy="18" r="3" {...P} /><circle cx="18" cy="16" r="3" {...P} /></>,
    mouse: <><rect x="6" y="3" width="12" height="18" rx="6" {...P} /><path d="M12 7v4" {...P} /></>,
    search: <><circle cx="11" cy="11" r="7" {...P} /><path d="m21 21-4.3-4.3" {...P} /></>,
    sparkle: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17l-1.9-5.1L4.5 10l5.6-1.4Z" {...P} />,
    video: <><path d="m22 8-6 4 6 4V8Z" {...P} /><rect x="2" y="6" width="14" height="12" rx="2" {...P} /></>,
    lightbulb: <><path d="M9 18h6M10 22h4" {...P} /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" {...P} /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "-0.15em", flexShrink: 0, ...style }} aria-hidden="true">
      {paths[name] || null}
    </svg>
  );
};

// ===== スターターテンプレート =====
const TPL_IMG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNsaGj4DwAFhAJ/2UcxsgAAAABJRU5ErkJggg==";
const D = (type, extra = {}) => ({ type, duration: 0.8, delay: 0, easing: "ease-out", distance: 60, scaleTo: 1.3, loop: null, clip: false, img: null, opacity: 1, exit: null, ...extra });
const TEMPLATES = [
  {
    id: "sale", name: "セール告知", desc: "帯＋大きな見出しの定番構成",
    make: () => ({
      frame: { ratio: "1:1", fit: "cover", align: "xMidYMid", bg: "#FFFFFF" },
      scenes: [
        {
          name: "セール告知", duration: 4.5, transition: { type: "fade", duration: 0.6 }, overlays: [],
          svgText: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080"><defs><linearGradient id="tplbg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2B2350"/><stop offset="1" stop-color="#171A22"/></linearGradient></defs><rect id="bg" width="1080" height="1080" fill="url(#tplbg1)"/><rect id="band" x="0" y="420" width="1080" height="240" fill="#8B7CFF"/><text id="title" x="540" y="575" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="150" fill="#FFFFFF">SALE</text><text id="sub" x="540" y="760" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="64" fill="#5FD6C4">最大50%OFF</text><text id="date" x="540" y="880" text-anchor="middle" font-family="sans-serif" font-size="40" fill="#C9CDD6">7/10（金）〜 7/20（月）</text><g data-shape="star" data-sid="tplstar1"><polygon points="900,180 927,255 1006,255 942,304 966,382 900,334 834,382 858,304 794,255 873,255" fill="#FFD166"/></g></svg>`,
          settings: { p0: D("none"), p1: D("slideLeft", { duration: 0.6 }), p2: D("pop", { delay: 0.4, duration: 0.7 }), p3: D("slideUp", { delay: 0.9 }), p4: D("fadeIn", { delay: 1.3 }), p5: D("stamp", { delay: 1.6, duration: 0.5 }) },
        },
        {
          name: "CTA", duration: 3.5, transition: { type: "slideLeft", duration: 0.5 }, overlays: [],
          svgText: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080"><rect id="bg" width="1080" height="1080" fill="#171A22"/><text id="t1" x="540" y="470" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="72" fill="#FFFFFF">今すぐチェック</text><g data-shape="roundRect" data-sid="tplbtn1"><rect x="340" y="560" width="400" height="110" rx="55" fill="#5FD6C4"/></g><text id="t2" x="540" y="632" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="44" fill="#14161C">詳しくはこちら</text></svg>`,
          settings: { p0: D("none"), p1: D("zoomIn", { duration: 0.6 }), p2: D("pop", { delay: 0.5 }), p3: D("fadeIn", { delay: 0.8 }) },
        },
      ],
    }),
  },
  {
    id: "product", name: "新商品紹介", desc: "写真を差し替えるだけの商品PR",
    make: () => ({
      frame: { ratio: "1:1", fit: "cover", align: "xMidYMid", bg: "#FFFFFF" },
      scenes: [
        {
          name: "商品紹介", duration: 5, transition: { type: "fade", duration: 0.6 }, overlays: [],
          svgText: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080"><rect id="bg" width="1080" height="1080" fill="#F4F1EC"/><image id="photo" href="${TPL_IMG}" x="120" y="120" width="840" height="560" preserveAspectRatio="xMidYMid slice"/><rect id="band" x="0" y="740" width="1080" height="200" fill="#14161C"/><text id="title" x="540" y="830" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="60" fill="#FFFFFF">新商品、登場。</text><text id="sub" x="540" y="905" text-anchor="middle" font-family="sans-serif" font-size="38" fill="#5FD6C4">商品名をここに入力</text></svg>`,
          settings: { p0: D("none"), p1: D("fadeIn", { duration: 1, clip: true, img: { type: "kenburns", duration: 6, scaleTo: 1.12, distance: 60, delay: 0, easing: "linear" } }), p2: D("slideUp", { delay: 0.6 }), p3: D("slideUp", { delay: 0.9 }), p4: D("fadeIn", { delay: 1.3 }) },
        },
      ],
    }),
  },
  {
    id: "memories", name: "思い出スライドショー", desc: "写真3枚＋テロップの雛形",
    make: () => {
      const photoScene = (n, telop) => ({
        name: `写真${n}`, duration: 4, transition: { type: "fade", duration: 0.8 },
        overlays: [{ text: telop, x: 50, y: 86, size: 4.5, font: "gothic", color: "#FFFFFF", outline: "#000000", style: "outline", anim: "fadeIn", duration: 0.8, delay: 0.5, exitFade: true }],
        svgText: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350"><rect id="bg" width="1080" height="1350" fill="#14161C"/><image id="photo" href="${TPL_IMG}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice"/></svg>`,
        settings: { p0: D("none"), p1: D("fadeIn", { duration: 1, clip: true, img: { type: n % 2 ? "kenburns" : "panLeft", duration: 5, scaleTo: 1.15, distance: 80, delay: 0, easing: "linear" } }) },
      });
      return {
        frame: { ratio: "9:16", fit: "cover", align: "xMidYMid", bg: "#000000" },
        scenes: [photoScene(1, "たいせつな思い出"), photoScene(2, "あの日の一枚"), photoScene(3, "これからもよろしく")],
      };
    },
  },
];

// 図形ボタン用のミニプレビューアイコン
const ShapeIcon = ({ shape, size = 20 }) => {
  const c = "#B9A5FF";
  const shapes = {
    rect: <rect x="3" y="6" width="18" height="12" rx="1.5" fill={c} />,
    roundRect: <rect x="3" y="6" width="18" height="12" rx="4" fill={c} />,
    circle: <circle cx="12" cy="12" r="8" fill={c} />,
    band: <rect x="1" y="9" width="22" height="6" fill={c} />,
    triangle: <polygon points="12,4 20,19 4,19" fill={c} />,
    star: <polygon points="12,3 14.2,9.2 20.8,9.2 15.5,13.3 17.5,19.8 12,15.8 6.5,19.8 8.5,13.3 3.2,9.2 9.8,9.2" fill={c} />,
    arrow: <polygon points="3,10 14,10 14,7 21,12 14,17 14,14 3,14" fill={c} />,
    bubble: <><rect x="3" y="4" width="18" height="12" rx="3" fill={c} /><polygon points="8,15 13,15 9,20" fill={c} /></>,
    text: <path d="M5 5h14M12 5v14M8 19h8" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{shapes[shape] || shapes.rect}</svg>;
};

const LogoMark = ({ size = 24 }) => (
  <svg className="vc-brand" width={size} height={size} viewBox="0 0 100 100" style={{ flexShrink: 0, display: "block" }} aria-label="Vectimo">
    <defs>
      <linearGradient id="vctm_lg" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#8B5CF6" />
      </linearGradient>
    </defs>
    <path d="M8 20 H26 L42 68 L54 44 L64 58 L80 20 H94 V94 H82 V46 L66 78 L54 62 L44 88 H34 Z"
      fill="url(#vctm_lg)" />
  </svg>
);

// Figma等の「rect + pattern塗り」画像を含めて、パーツ内の画像配置を解決する
// 戻り値: { place: 配置要素(rect/image), img: 実画像ノード, isPattern }
function findMediaPlacement(el, doc) {
  if (!el) return null;
  if (el.tagName === "image" || el.tagName === "foreignObject") return { place: el, img: el, isPattern: false };
  const direct = el.querySelector("image,foreignObject");
  if (direct) return { place: direct, img: direct, isPattern: false };
  const cands = [el, ...Array.from(el.querySelectorAll("rect,path,circle,ellipse,polygon"))];
  for (const c of cands) {
    const m = (c.getAttribute && (c.getAttribute("fill") || "").match(/url\(#(.+?)\)/)) || null;
    if (!m) continue;
    const pat = doc.querySelector(`[id="${m[1].replace(/"/g, '\\"')}"]`);
    if (!pat || pat.tagName !== "pattern") continue;
    let pimg = pat.querySelector("image");
    if (!pimg) {
      const use = pat.querySelector("use");
      const href = use && (use.getAttribute("href") || use.getAttributeNS("http://www.w3.org/1999/xlink", "href"));
      if (href) {
        const t = doc.querySelector(`[id="${href.slice(1).replace(/"/g, '\\"')}"]`);
        if (t && t.tagName === "image") pimg = t;
      }
    }
    if (pimg) return { place: c, img: pimg, isPattern: true };
  }
  return null;
}

// パーツ全体の実描画範囲をルート座標系で計測（選択ハイライト用）
const partBoxCache = new Map();
function measurePartBBox(svgText, uid) {
  const key = "part:" + svgText.length + ":" + uid + ":" + svgText.slice(0, 80);
  if (partBoxCache.has(key)) return partBoxCache.get(key);
  let result = null;
  try {
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;left:-99999px;top:0;width:800px;visibility:hidden";
    host.innerHTML = svgText;
    document.body.appendChild(host);
    const svgEl = host.querySelector("svg");
    let children = Array.from(svgEl.children).filter((el) => !["defs", "style", "title", "desc", "metadata"].includes(el.tagName));
    if (children.length === 1 && children[0].tagName === "g") children = Array.from(children[0].children).filter((el) => !["defs", "style", "title", "desc"].includes(el.tagName));
    const el = children[+uid.slice(1)];
    if (el && typeof el.getBBox === "function") {
      const b = el.getBBox();
      let pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]];
      try {
        const m = svgEl.getScreenCTM().inverse().multiply(el.getScreenCTM());
        pts = pts.map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
      } catch (e) { /* 変換行列が取れない場合はローカル座標のまま */ }
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const x = Math.min(...xs), y = Math.min(...ys);
      result = { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    document.body.removeChild(host);
  } catch (e) { /* jsdom等では非表示 */ }
  if (partBoxCache.size > 200) partBoxCache.clear();
  partBoxCache.set(key, result);
  return result;
}

// 画像の実描画位置を計測（transform属性付きのSVG書き出しにも対応）
const bboxCache = new Map();
function measureImageBBox(svgText, uid) {
  const key = svgText.length + ":" + uid + ":" + svgText.slice(0, 80);
  if (bboxCache.has(key)) return bboxCache.get(key);
  let result = null;
  try {
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;left:-99999px;top:0;width:800px;visibility:hidden";
    host.innerHTML = svgText;
    document.body.appendChild(host);
    const svgEl = host.querySelector("svg");
    let children = Array.from(svgEl.children).filter((el) => !["defs", "style", "title", "desc", "metadata"].includes(el.tagName));
    if (children.length === 1 && children[0].tagName === "g") children = Array.from(children[0].children).filter((el) => !["defs", "style", "title", "desc"].includes(el.tagName));
    const el = children[+uid.slice(1)];
    const mp = el && findMediaPlacement(el, svgEl);
    const img = mp && mp.place;
    if (img && typeof img.getBBox === "function") {
      const b = img.getBBox(); // 自身のtransform適用前のローカル座標
      result = { x: b.x, y: b.y, w: b.width, h: b.height, transform: img.getAttribute("transform") || "" };
    }
    document.body.removeChild(host);
  } catch (e) { /* jsdom等では属性ベースへフォールバック */ }
  if (!result) {
    const r = getImageRect(svgText, uid);
    result = r ? { x: r.x, y: r.y, w: r.w, h: r.h, transform: "" } : null;
  }
  if (bboxCache.size > 200) bboxCache.clear();
  bboxCache.set(key, result);
  return result;
}

// アニメーションプリセット（シーンのパーツ構成から自動割当）
const PRESETS = {
  shimen: { label: "紙面風（写真ズーム＋順次スライド）" },
  pop: { label: "ポップ（弾んで登場）" },
  cinema: { label: "シネマ（ゆったりフェード＋退場）" },
  minimal: { label: "ミニマル（さっとフェード）" },
  dynamic: { label: "ダイナミック（ズーム＆スライド交互）" },
  typo: { label: "タイプ演出（文字を1字ずつ）" },
  stampy: { label: "ハンコ・ポップ（スタンプ強調）" },
  slideshow: { label: "スライドショー（流れるカット）" },
};

function applyPresetToScene(scene, key) {
  const parsed = parseSvg(scene.svgText);
  if (parsed.error) return scene;
  const settings = {};
  let textIdx = 0;
  parsed.parts.forEach((p, i) => {
    const base = { ...defaultSetting(), img: null, exit: null };
    const isBg = i === 0;
    if (key === "shimen") {
      if (p.hasImage) Object.assign(base, { type: "fadeIn", duration: 0.9, delay: 0.2, img: { ...defaultImgSetting(), type: "zoomSlow", duration: 8, scaleTo: 1.12 } });
      else if (isBg) Object.assign(base, { type: "fadeIn", duration: 0.6, delay: 0 });
      else { Object.assign(base, { type: "slideUp", duration: 0.7, delay: 0.5 + textIdx * 0.25, distance: 40 }); textIdx++; }
    } else if (key === "pop") {
      Object.assign(base, { type: isBg ? "fadeIn" : "pop", duration: isBg ? 0.5 : 0.6, delay: i * 0.15, easing: "cubic-bezier(0.34,1.56,0.64,1)" });
      if (p.hasImage) base.img = { ...defaultImgSetting(), type: "zoomSlow", duration: 8, scaleTo: 1.1 };
    } else if (key === "cinema") {
      Object.assign(base, { type: "fadeIn", duration: 1.4, delay: i * 0.35, easing: "ease-in-out" });
      if (p.hasImage) base.img = { ...defaultImgSetting(), type: "kenburns", duration: 10, scaleTo: 1.18, distance: 80 };
      base.exit = { type: "fadeOut", duration: 0.7 };
    } else if (key === "dynamic") {
      if (p.hasImage) Object.assign(base, { type: "zoomIn", duration: 0.7, delay: i * 0.15, easing: "cubic-bezier(0.34,1.56,0.64,1)", img: { ...defaultImgSetting(), type: "zoomSlow", duration: 7, scaleTo: 1.15 } });
      else if (isBg) Object.assign(base, { type: "fadeIn", duration: 0.4, delay: 0 });
      else { Object.assign(base, { type: textIdx % 2 === 0 ? "slideLeft" : "slideRight", duration: 0.6, delay: 0.4 + textIdx * 0.2, distance: 90, exit: { type: textIdx % 2 === 0 ? "slideOutLeft" : "slideOutRight", duration: 0.5 } }); textIdx++; }
    } else if (key === "typo") {
      if (p.hasImage) Object.assign(base, { type: "fadeIn", duration: 1, delay: 0.2, img: { ...defaultImgSetting(), type: "kenburns", duration: 9, scaleTo: 1.15, distance: 70 } });
      else if (isBg) Object.assign(base, { type: "fadeIn", duration: 0.5, delay: 0 });
      else if (p.hasText) { Object.assign(base, { type: "typewriter", duration: Math.min(2.5, 0.8 + textIdx * 0.2), delay: 0.5 + textIdx * 0.6 }); textIdx++; }
      else Object.assign(base, { type: "fadeIn", duration: 0.6, delay: 0.4 });
    } else if (key === "stampy") {
      if (p.hasImage) Object.assign(base, { type: "fadeIn", duration: 0.6, delay: 0.1, img: { ...defaultImgSetting(), type: "pulse", duration: 2.4, loop: true } });
      else if (isBg) Object.assign(base, { type: "fadeIn", duration: 0.4, delay: 0 });
      else { Object.assign(base, { type: "stamp", duration: 0.55, delay: 0.4 + textIdx * 0.3, easing: "ease-out" }); textIdx++; }
    } else if (key === "slideshow") {
      if (p.hasImage) Object.assign(base, { type: "slideLeft", duration: 0.8, delay: 0.1, distance: 200, clip: true, img: { ...defaultImgSetting(), type: "panLeft", duration: 10, distance: 40 }, exit: { type: "slideOutLeft", duration: 0.6 } });
      else if (isBg) Object.assign(base, { type: "none" });
      else { Object.assign(base, { type: "slideUp", duration: 0.6, delay: 0.5 + textIdx * 0.2, distance: 50, exit: { type: "fadeOut", duration: 0.5 } }); textIdx++; }
    } else {
      Object.assign(base, { type: "fadeIn", duration: 0.6, delay: i * 0.12 });
    }
    settings[`p${i}`] = base;
  });
  const dur = Math.max(3, +(animEnd(settings) + 2).toFixed(1));
  return { ...scene, settings, duration: dur };
}

let sceneSeq = 0;
const newSceneId = () => `sc_${++sceneSeq}_${Date.now()}`;

// ---------- SVG parsing ----------
function getPartsChildren(root) {
  let children = Array.from(root.children).filter((el) => !["defs", "style", "title", "desc", "metadata"].includes(el.tagName));
  if (children.length === 1 && children[0].tagName === "g") {
    children = Array.from(children[0].children).filter((el) => !["defs", "style", "title", "desc"].includes(el.tagName));
  }
  return children;
}

function parseSvg(svgText) {
  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    if (doc.querySelector("parsererror")) return { error: "SVGの解析に失敗しました。コードを確認してください。" };
    const root = doc.querySelector("svg");
    if (!root) return { error: "<svg>タグが見つかりません。" };
    const children = getPartsChildren(root);
    const parts = children.map((el, i) => {
      const name = el.getAttribute("id") || el.getAttribute("aria-label") || `${el.tagName}${el.textContent && el.tagName === "text" ? `「${el.textContent.slice(0, 8)}」` : ""} #${i + 1}`;
      const hasImage = !!findMediaPlacement(el, doc);
      const hasText = el.tagName === "text" || !!el.querySelector("text");
      return { uid: `p${i}`, name, tag: el.tagName, hasImage, hasText };
    });
    return { doc, root, children, parts };
  } catch (e) {
    return { error: "SVGの解析中にエラーが発生しました。" };
  }
}

function initSettings(svgText) {
  const parsed = parseSvg(svgText);
  if (parsed.error) return {};
  const settings = {};
  parsed.parts.forEach((p, i) => {
    settings[p.uid] = { ...defaultSetting(), delay: +(i * 0.25).toFixed(2) };
  });
  return settings;
}

function animEnd(settings) {
  let t = 0;
  Object.values(settings || {}).forEach((s) => {
    if (s.type === "none" || isLoop(s)) return;
    t = Math.max(t, s.delay + s.duration);
  });
  return t;
}

// ---------- keyframes ----------
// パスアニメ（軌道）：進行度t(0..1)→相対オフセット{x,y}。amp=振幅(px)。到達点は原点(0,0)。
function pathOffset(kind, t, amp) {
  // 多くはtが進むほど原点(0,0)に近づく＝最後は正しい位置に収まる
  switch (kind) {
    case "pathArc": { // 弧を描いて着地（下から放物線）
      const x = -amp * (1 - t);
      const y = -amp * 1.2 * Math.sin(Math.PI * t) - 0 * t;
      return { x, y: y + amp * 0 * 0 - amp * 0 };
    }
    case "pathArcUp": { // 上に弧を描いて着地
      const x = amp * (1 - t);
      const y = -amp * 1.4 * Math.sin(Math.PI * t);
      return { x, y };
    }
    case "pathWave": { // 横に進みながら波打つ
      const x = -amp * (1 - t);
      const y = amp * 0.5 * Math.sin(t * Math.PI * 3);
      return { x, y };
    }
    case "pathZig": { // ジグザグ（着地は原点）
      const x = -amp * (1 - t);
      const seg = t * 4;
      const y = amp * 0.5 * (Math.abs((seg % 2) - 1) * 2 - 1) * (1 - t);
      return { x, y };
    }
    case "pathCircle": { // 円を一周して戻る（着地は原点）
      const a = t * Math.PI * 2 - Math.PI / 2;
      return { x: amp * Math.cos(a), y: amp * Math.sin(a) + amp };
    }
    case "pathSpiral": { // らせんで中心へ
      const a = t * Math.PI * 4;
      const r = amp * (1 - t);
      return { x: r * Math.cos(a), y: r * Math.sin(a) };
    }
    case "pathBounce": { // 横移動＋バウンド着地
      const x = -amp * (1 - t);
      const b = Math.abs(Math.sin(t * Math.PI * 2)) * (1 - t);
      return { x, y: -amp * b };
    }
    default: return { x: 0, y: 0 };
  }
}
const PATH_TYPES = new Set(["pathArc", "pathArcUp", "pathWave", "pathZig", "pathCircle", "pathSpiral", "pathBounce"]);

// 軌道アニメのkeyframesを複数点で生成
function pathKeyframes(k, kind, amp, T, steps = 24) {
  let out = `@keyframes ${k}{`;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const { x, y } = pathOffset(kind, t, amp);
    const op = kind === "pathCircle" || kind === "pathSpiral" ? 1 : Math.min(1, t * 3);
    out += `${(t * 100).toFixed(1)}%{opacity:${op.toFixed(2)};transform:${T(`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`)}}`;
  }
  return out + "}";
}

function keyframesCss(uid, s, origin = null) {
  const d = s.distance;
  const k = `kf_${uid}`;
  // origin指定時はtransformを「原点へ移動→変形→戻す」で包み、環境差の出るtransform-boxに依存しない
  const T = (tf) => (origin ? `translate(${origin.cx}px,${origin.cy}px) ${tf} translate(${-origin.cx}px,${-origin.cy}px)` : tf);
  switch (s.type) {
    case "fadeIn": return `@keyframes ${k}{from{opacity:0}to{opacity:1}}`;
    case "slideUp": return `@keyframes ${k}{from{opacity:0;transform:${T(`translateY(${d}px)`)}}to{opacity:1;transform:${T("translateY(0)")}}}`;
    case "slideDown": return `@keyframes ${k}{from{opacity:0;transform:${T(`translateY(-${d}px)`)}}to{opacity:1;transform:${T("translateY(0)")}}}`;
    case "slideLeft": return `@keyframes ${k}{from{opacity:0;transform:${T(`translateX(${d}px)`)}}to{opacity:1;transform:${T("translateX(0)")}}}`;
    case "slideRight": return `@keyframes ${k}{from{opacity:0;transform:${T(`translateX(-${d}px)`)}}to{opacity:1;transform:${T("translateX(0)")}}}`;
    case "zoomIn": return `@keyframes ${k}{from{opacity:0;transform:${T("scale(0)")}}to{opacity:1;transform:${T("scale(1)")}}}`;
    case "pop": return `@keyframes ${k}{0%{opacity:0;transform:${T("scale(0)")}}70%{opacity:1;transform:${T("scale(1.15)")}}100%{opacity:1;transform:${T("scale(1)")}}}`;
    case "rotateIn": return `@keyframes ${k}{from{opacity:0;transform:${T("rotate(-120deg) scale(.5)")}}to{opacity:1;transform:${T("rotate(0) scale(1)")}}}`;
    case "draw": return `@keyframes ${k}{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}`;
    case "pathArc": case "pathArcUp": case "pathWave": case "pathZig": case "pathCircle": case "pathSpiral": case "pathBounce":
      return pathKeyframes(k, s.type, Math.max(20, d), T);
    case "float": return `@keyframes ${k}{0%,100%{transform:${T("translateY(0)")}}50%{transform:${T(`translateY(-${Math.max(4, d / 4)}px)`)}}}`;
    case "pulse": return `@keyframes ${k}{0%,100%{transform:${T("scale(1)")}}50%{transform:${T("scale(1.08)")}}}`;
    case "spin": return `@keyframes ${k}{from{transform:${T("rotate(0)")}}to{transform:${T("rotate(360deg)")}}}`;
    case "panLeft": return `@keyframes ${k}{from{transform:${T(`translateX(${d}px)`)}}to{transform:${T(`translateX(${-d}px)`)}}}`;
    case "panRight": return `@keyframes ${k}{from{transform:${T(`translateX(${-d}px)`)}}to{transform:${T(`translateX(${d}px)`)}}}`;
    case "panUp": return `@keyframes ${k}{from{transform:${T(`translateY(${d}px)`)}}to{transform:${T(`translateY(${-d}px)`)}}}`;
    case "panDown": return `@keyframes ${k}{from{transform:${T(`translateY(-${d}px)`)}}to{transform:${T(`translateY(${d}px)`)}}}`;
    case "zoomSlow": return `@keyframes ${k}{from{transform:${T("scale(1)")}}to{transform:${T(`scale(${s.scaleTo})`)}}}`;
    case "zoomOutSlow": return `@keyframes ${k}{from{transform:${T(`scale(${s.scaleTo})`)}}to{transform:${T("scale(1)")}}}`;
    case "kenburns": return `@keyframes ${k}{from{transform:${T("scale(1) translate(0,0)")}}to{transform:${T(`scale(${s.scaleTo}) translate(-${Math.round(d / 3)}px,-${Math.round(d / 6)}px)`)}}}`;
    case "stamp": return `@keyframes ${k}{0%{opacity:0;transform:${T("scale(3) rotate(-12deg)")}}60%{opacity:1;transform:${T("scale(.92) rotate(2deg)")}}100%{opacity:1;transform:${T("scale(1) rotate(0)")}}}`;
    case "shake": { const a = Math.max(2, d / 12); return `@keyframes ${k}{0%,100%{transform:${T("translateX(0)")}}20%{transform:${T(`translateX(-${a}px)`)}}40%{transform:${T(`translateX(${a}px)`)}}60%{transform:${T(`translateX(-${a * 0.7}px)`)}}80%{transform:${T(`translateX(${a * 0.7}px)`)}}}`; }
    case "blink": return `@keyframes ${k}{0%,45%{opacity:1}50%,95%{opacity:0.15}100%{opacity:1}}`;
    case "heartbeat": return `@keyframes ${k}{0%,100%{transform:${T("scale(1)")}}25%{transform:${T("scale(1.12)")}}40%{transform:${T("scale(1)")}}60%{transform:${T("scale(1.08)")}}75%{transform:${T("scale(1)")}}}`;
    case "typewriter": case "charFade": case "countUp": return `@keyframes ${k}{from{opacity:0}to{opacity:1}}`;
    default: return "";
  }
}

function exitKeyframesCss(uid, ex, d, origin = null) {
  const k = `kfx_${uid}`;
  const T = (tf) => (origin ? `translate(${origin.cx}px,${origin.cy}px) ${tf} translate(${-origin.cx}px,${-origin.cy}px)` : tf);
  switch (ex.type) {
    case "fadeOut": return `@keyframes ${k}{from{opacity:1}to{opacity:0}}`;
    case "slideOutUp": return `@keyframes ${k}{from{opacity:1;transform:${T("translateY(0)")}}to{opacity:0;transform:${T(`translateY(-${d}px)`)}}}`;
    case "slideOutDown": return `@keyframes ${k}{from{opacity:1;transform:${T("translateY(0)")}}to{opacity:0;transform:${T(`translateY(${d}px)`)}}}`;
    case "slideOutLeft": return `@keyframes ${k}{from{opacity:1;transform:${T("translateX(0)")}}to{opacity:0;transform:${T(`translateX(-${d}px)`)}}}`;
    case "slideOutRight": return `@keyframes ${k}{from{opacity:1;transform:${T("translateX(0)")}}to{opacity:0;transform:${T(`translateX(${d}px)`)}}}`;
    case "zoomOut": return `@keyframes ${k}{from{opacity:1;transform:${T("scale(1)")}}to{opacity:0;transform:${T("scale(0)")}}}`;
    default: return "";
  }
}

let __buildSeq = 0;
function buildAnimatedSvg(svgText, settings, { forExport = false, staticMode = false, frame = null, snapshotT = null, videos = null, visibleRange = null, sceneDuration = null, highlightUid = null, overlays = null, livePlay = false } = {}) {
  const srcText = svgText;
  const tk = ++__buildSeq; // ビルド一意トークン：複数SVG同時表示時のCSS/クリップ混線を防ぐ
  const cls = (id) => `anim${tk}-${id}`;
  const kfn = (id) => `${tk}_${id}`;
  const parsed = parseSvg(svgText);
  if (parsed.error) return "";
  const doc = parsed.doc;
  const root = parsed.root;
  const children = parsed.children;

  let css = "";
  const viewBox = (root.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
  const hasVB = viewBox.length === 4 && viewBox.every((n) => !isNaN(n));
  let defs = root.querySelector("defs");

  children.forEach((el, i) => {
    const uid = `p${i}`;
    const s = settings[uid];

    // 表示範囲フィルタ（MP4合成用）
    if (visibleRange && (i < visibleRange[0] || i >= visibleRange[1])) {
      el.setAttribute("display", "none");
      return;
    }

    // 動画差し替え：<image> → <foreignObject><video>（トリム・トリミング反映）
    if (videos && videos[uid]) {
      const v = videos[uid];
      const mpV = findMediaPlacement(el, doc);
      const img = mpV && mpV.place;
      if (img) {
        const bb = measureImageBBox(srcText, uid) || { x: 0, y: 0, w: 400, h: 300, transform: "" };
        const fo = doc.createElementNS(SVGNS, "foreignObject");
        fo.setAttribute("x", bb.x); fo.setAttribute("y", bb.y);
        fo.setAttribute("width", bb.w); fo.setAttribute("height", bb.h);
        if (bb.transform) fo.setAttribute("transform", bb.transform);
        const div = doc.createElementNS(XHTML, "div");
        div.setAttribute("style", "position:relative;width:100%;height:100%;overflow:hidden");
        const vid = doc.createElementNS(XHTML, "video");
        vid.setAttribute("src", v.src);
        vid.setAttribute("autoplay", ""); vid.setAttribute("muted", ""); vid.setAttribute("loop", ""); vid.setAttribute("playsinline", "");
        vid.setAttribute("data-vstart", v.start || 0);
        if (v.end > (v.start || 0)) vid.setAttribute("data-vend", v.end);
        if (v.speed && v.speed !== 1) vid.setAttribute("data-vspeed", v.speed);
        const nx = v.nx || 0, ny = v.ny || 0, cs = v.cscale || 1;
        if (v.vw && v.vh) {
          // 実寸配置：横動画でも見せたい範囲を正確に再現
          const cov = Math.max(bb.w / v.vw, bb.h / v.vh) * cs;
          const elW = v.vw * cov, elH = v.vh * cov;
          const left = bb.w / 2 - elW / 2 + nx * bb.w;
          const top = bb.h / 2 - elH / 2 + ny * bb.h;
          vid.setAttribute("style", `position:absolute;left:${left.toFixed(1)}px;top:${top.toFixed(1)}px;width:${elW.toFixed(1)}px;height:${elH.toFixed(1)}px;display:block`);
        } else {
          vid.setAttribute("style", "width:100%;height:100%;object-fit:cover;display:block");
        }
        div.appendChild(vid);
        fo.appendChild(div);
        img.parentNode.replaceChild(fo, img);
      }
    }

    el.setAttribute("data-part", uid);
    // transform属性を持つ要素はCSSアニメで属性transformが上書きされるためラッパーgに適用
    let animEl = el;
    if (el.getAttribute("transform")) {
      const w0 = doc.createElementNS(SVGNS, "g");
      el.parentNode.insertBefore(w0, el); w0.appendChild(el);
      animEl = w0;
    }
    animEl.setAttribute("class", ((animEl.getAttribute("class") || "") + ` ${cls(uid)}`).trim());
    // パーツの不透明度（1未満のときだけ外側ラッパーgに適用。アニメのopacityと乗算される）
    if (s && typeof s.opacity === "number" && s.opacity < 1) {
      const wo = doc.createElementNS(SVGNS, "g");
      animEl.parentNode.insertBefore(wo, animEl); wo.appendChild(animEl);
      wo.setAttribute("style", `opacity:${Math.max(0, Math.min(1, s.opacity))}`);
    }
    const mpInner = findMediaPlacement(el, doc);
    const inner = mpInner ? mpInner.place : null;
    let innerAnimEl = inner;
    if (inner && inner !== el) {
      if (inner.getAttribute("transform")) {
        const w1 = doc.createElementNS(SVGNS, "g");
        inner.parentNode.insertBefore(w1, inner); w1.appendChild(inner);
        innerAnimEl = w1;
      }
      innerAnimEl.setAttribute("class", ((innerAnimEl.getAttribute("class") || "") + ` ${cls(uid + "i")}`).trim());
    }
    if (!s || staticMode) return;

    const imgAnim = s.img && s.img.type !== "none" && inner ? s.img : null;

    // 画像アニメ：画像自身の枠でクリップ（実測位置・transform属性対応）
    let imgBB = null;
    if (imgAnim) {
      if (!defs) { defs = doc.createElementNS(SVGNS, "defs"); root.insertBefore(defs, root.firstChild); }
      const clipId = `clipi${tk}_${uid}`;
      imgBB = measureImageBBox(srcText, uid);
      if (!doc.getElementById(clipId) && imgBB) {
        const cp = doc.createElementNS(SVGNS, "clipPath"); cp.setAttribute("id", clipId);
        const r = doc.createElementNS(SVGNS, "rect");
        r.setAttribute("x", imgBB.x); r.setAttribute("y", imgBB.y);
        r.setAttribute("width", imgBB.w); r.setAttribute("height", imgBB.h);
        if (imgBB.transform) r.setAttribute("transform", imgBB.transform);
        cp.appendChild(r); defs.appendChild(cp);
      }
      const w = doc.createElementNS(SVGNS, "g");
      w.setAttribute("clip-path", `url(#${clipId})`);
      innerAnimEl.parentNode.insertBefore(w, innerAnimEl); w.appendChild(innerAnimEl);
    }

    // パーツアニメ：画面全体クリップ
    if (s.clip && hasVB) {
      if (!defs) { defs = doc.createElementNS(SVGNS, "defs"); root.insertBefore(defs, root.firstChild); }
      const clipId = `clip${tk}_${uid}`;
      if (!doc.getElementById(clipId)) {
        const cp = doc.createElementNS(SVGNS, "clipPath"); cp.setAttribute("id", clipId);
        const r = doc.createElementNS(SVGNS, "rect");
        r.setAttribute("x", viewBox[0]); r.setAttribute("y", viewBox[1]);
        r.setAttribute("width", viewBox[2]); r.setAttribute("height", viewBox[3]);
        cp.appendChild(r); defs.appendChild(cp);
      }
      const wrapper = doc.createElementNS(SVGNS, "g");
      wrapper.setAttribute("clip-path", `url(#${clipId})`);
      animEl.parentNode.insertBefore(wrapper, animEl); wrapper.appendChild(animEl);
    }

    const paused = snapshotT === null || livePlay ? "" : " paused";
    const shiftD = (dl) => (snapshotT === null ? dl : dl - snapshotT);
    // 実測原点（変形の中心）：環境差のあるfill-box計算に頼らず数値で焼き込む
    const partOrigin = (() => {
      const b = measurePartBBox(srcText, uid);
      return b ? { cx: +(b.x + b.w / 2).toFixed(2), cy: +(b.y + b.h / 2).toFixed(2) } : null;
    })();
    const originRule = (o) => (o ? "" : "transform-box:fill-box;transform-origin:center;");
    const emitCss = (id, a, origin) => {
      const loop = isLoop(a);
      css += keyframesCss(kfn(id), a, origin);
      css += `.${cls(id)}{animation:kf_${kfn(id)} ${a.duration}s ${a.easing} ${shiftD(a.delay)}s ${loop ? "infinite" : "1"} both${paused};${originRule(origin)}}`;
    };
    // 登場＋退場を1つのanimationプロパティに合成
    const emitPartCss = (a) => {
      const anims = [];
      if (a.type !== "none" && !TEXT_TYPES.has(a.type)) {
        css += keyframesCss(kfn(uid), a, partOrigin);
        anims.push(`kf_${kfn(uid)} ${a.duration}s ${a.easing} ${shiftD(a.delay)}s ${isLoop(a) ? "infinite" : "1"} both${paused ? " paused" : ""}`);
      }
      if (a.exit && a.exit.type !== "none" && sceneDuration) {
        const exDur = a.exit.duration || 0.6;
        const exDelay = Math.max(0, sceneDuration - exDur);
        css += exitKeyframesCss(kfn(uid), a.exit, a.distance || 60, partOrigin);
        anims.push(`kfx_${kfn(uid)} ${exDur}s ease-in ${shiftD(exDelay)}s 1 forwards${paused ? " paused" : ""}`);
      }
      if (anims.length) css += `.${cls(uid)}{animation:${anims.join(",")};${originRule(partOrigin)}}`;
    };

    // ---- テキスト系の特殊処理 ----
    if (s.type === "typewriter" || s.type === "charFade") {
      const texts = el.tagName === "text" ? [el] : Array.from(el.querySelectorAll("text"));
      const units = [];
      texts.forEach((tx) => {
        const leafs = tx.children.length ? Array.from(tx.querySelectorAll("tspan")).filter((t) => !t.children.length) : [tx];
        leafs.forEach((leaf) => {
          const str = leaf.textContent;
          leaf.textContent = "";
          for (const ch of str) {
            const sp = doc.createElementNS(SVGNS, "tspan");
            sp.textContent = ch;
            leaf.appendChild(sp);
            units.push(sp);
          }
        });
      });
      const n = Math.max(1, units.length);
      const per = s.type === "typewriter" ? 0.02 : Math.min(0.5, s.duration / 2);
      const spread = Math.max(0.01, s.duration - per);
      css += `@keyframes kf_${kfn(uid)}c{from{opacity:0}to{opacity:1}}`;
      units.forEach((sp, idx) => {
        const dl = shiftD(s.delay + (idx / n) * spread);
        const tf = s.type === "typewriter" ? "steps(1,end)" : s.easing;
        sp.setAttribute("style", `animation:kf_${kfn(uid)}c ${per}s ${tf} ${dl}s 1 both${paused}`);
      });
      emitPartCss({ ...s, type: "none" }); // 退場だけ適用
    } else if (s.type === "marker") {
      const bb = (() => {
        try {
          const host = document.createElement("div");
          host.style.cssText = "position:absolute;left:-99999px;visibility:hidden";
          host.innerHTML = srcText;
          document.body.appendChild(host);
          const svgEl = host.querySelector("svg");
          let ch = Array.from(svgEl.children).filter((x) => !["defs", "style", "title", "desc", "metadata"].includes(x.tagName));
          if (ch.length === 1 && ch[0].tagName === "g") ch = Array.from(ch[0].children).filter((x) => !["defs", "style", "title", "desc"].includes(x.tagName));
          const t = ch[i] && (ch[i].tagName === "text" ? ch[i] : ch[i].querySelector("text"));
          const b = t && t.getBBox();
          document.body.removeChild(host);
          return b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null;
        } catch (e) { return null; }
      })();
      if (bb) {
        const r = doc.createElementNS(SVGNS, "rect");
        r.setAttribute("x", bb.x - 4); r.setAttribute("y", bb.y + bb.h * 0.5);
        r.setAttribute("width", bb.w + 8); r.setAttribute("height", bb.h * 0.55);
        r.setAttribute("fill", "#FFE066"); r.setAttribute("opacity", "0.65");
        r.setAttribute("class", cls(uid + "m"));
        el.parentNode.insertBefore(r, el);
        const mo = { cx: +(bb.x - 4).toFixed(2), cy: +(bb.y + bb.h * 0.5 + bb.h * 0.275).toFixed(2) };
        css += `@keyframes kf_${kfn(uid)}m{from{transform:translate(${mo.cx}px,${mo.cy}px) scaleX(0) translate(${-mo.cx}px,${-mo.cy}px)}to{transform:translate(${mo.cx}px,${mo.cy}px) scaleX(1) translate(${-mo.cx}px,${-mo.cy}px)}}`;
        css += `.${cls(uid + "m")}{animation:kf_${kfn(uid)}m ${s.duration}s ${s.easing} ${shiftD(s.delay)}s 1 both${paused};}`;
      }
      emitPartCss({ ...s, type: "none" });
    } else if (s.type === "countUp") {
      const tx = el.tagName === "text" ? el : el.querySelector("text");
      if (tx) {
        const m = tx.textContent.match(/([\d,]+(?:\.\d+)?)/);
        if (m) {
          const target = parseFloat(m[1].replace(/,/g, ""));
          const hasComma = m[1].includes(",");
          const fmt = (v) => (hasComma ? Math.round(v).toLocaleString() : String(Math.round(v)));
          if (snapshotT !== null) {
            const raw = Math.min(1, Math.max(0, (snapshotT - s.delay) / s.duration));
            const p = 1 - Math.pow(1 - raw, 2);
            tx.textContent = tx.textContent.replace(m[1], fmt(target * p));
          } else if (!staticMode) {
            tx.setAttribute("data-countup-target", target);
            tx.setAttribute("data-countup-delay", s.delay);
            tx.setAttribute("data-countup-duration", s.duration);
            tx.setAttribute("data-countup-comma", hasComma ? "1" : "0");
            tx.setAttribute("data-countup-text", tx.textContent);
            tx.setAttribute("data-countup-num", m[1]);
          }
        }
      }
      emitPartCss({ ...s, type: "none" });
    } else {
      if (s.type === "draw") { el.setAttribute("pathLength", "1"); el.setAttribute("stroke-dasharray", "1"); }
      emitPartCss(s);
    }
    if (imgAnim) {
      const bb2 = imgBB || measureImageBBox(srcText, uid);
      const imgOrigin = bb2 && !bb2.transform ? { cx: +(bb2.x + bb2.w / 2).toFixed(2), cy: +(bb2.y + bb2.h / 2).toFixed(2) } : null;
      if (PAN_TYPES.has(imgAnim.type)) {
        // パン：移動距離ぶん自動拡大して枠の隙間を隠す
        const horiz = imgAnim.type === "panLeft" || imgAnim.type === "panRight";
        const base = bb2 ? (horiz ? bb2.w : bb2.h) : 400;
        const k = Math.min(3, 1 + (2 * imgAnim.distance) / Math.max(1, base)).toFixed(4);
        const d = imgAnim.distance;
        const T = (tf) => (imgOrigin ? `translate(${imgOrigin.cx}px,${imgOrigin.cy}px) ${tf} translate(${-imgOrigin.cx}px,${-imgOrigin.cy}px)` : tf);
        const [f, to] = {
          panLeft: [`translateX(${d}px) scale(${k})`, `translateX(${-d}px) scale(${k})`],
          panRight: [`translateX(${-d}px) scale(${k})`, `translateX(${d}px) scale(${k})`],
          panUp: [`translateY(${d}px) scale(${k})`, `translateY(${-d}px) scale(${k})`],
          panDown: [`translateY(${-d}px) scale(${k})`, `translateY(${d}px) scale(${k})`],
        }[imgAnim.type];
        css += `@keyframes kf_${kfn(uid)}i{from{transform:${T(f)}}to{transform:${T(to)}}}`;
        const loop2 = isLoop(imgAnim);
        const delay2 = snapshotT === null ? imgAnim.delay : imgAnim.delay - snapshotT;
        const paused2 = snapshotT === null ? "" : " paused";
        css += `.${cls(uid + "i")}{animation:kf_${kfn(uid)}i ${imgAnim.duration}s ${imgAnim.easing} ${delay2}s ${loop2 ? "infinite" : "1"} both${paused2};${imgOrigin ? "" : "transform-box:fill-box;transform-origin:center;"}}`;
      } else {
        emitCss(`${uid}i`, imgAnim, imgOrigin);
      }
    }
  });

  // 選択パーツのハイライト枠（プレビュー専用・書き出しには含まれない）
  if (highlightUid && !forExport) {
    const hb = measurePartBBox(srcText, highlightUid);
    if (hb) {
      const vbw = hasVB ? viewBox[2] : 800;
      const sw = Math.max(1.5, vbw / 380);
      const pad = sw * 2;
      const r = doc.createElementNS(SVGNS, "rect");
      r.setAttribute("x", hb.x - pad); r.setAttribute("y", hb.y - pad);
      r.setAttribute("width", hb.w + pad * 2); r.setAttribute("height", hb.h + pad * 2);
      r.setAttribute("fill", "none");
      r.setAttribute("stroke", "#8B7CFF");
      r.setAttribute("stroke-width", sw);
      r.setAttribute("stroke-dasharray", `${sw * 4} ${sw * 3}`);
      r.setAttribute("rx", sw * 2);
      r.setAttribute("pointer-events", "none");
      r.setAttribute("class", "sel-highlight");
      const r2 = r.cloneNode();
      r2.setAttribute("stroke", "#FFFFFF");
      r2.setAttribute("stroke-width", sw * 2.2);
      r2.setAttribute("stroke-dasharray", "none");
      r2.setAttribute("opacity", "0.35");
      r2.removeAttribute("class");
      root.appendChild(r2);
      root.appendChild(r);
      css += `@keyframes selAnts{to{stroke-dashoffset:-${sw * 14}}}
.sel-highlight{animation:selAnts 0.8s linear infinite;}`;
    }
  }

  if (forExport && !root.getAttribute("xmlns")) root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (forExport && hasVB && (!root.getAttribute("width") || !root.getAttribute("height"))) {
    root.setAttribute("width", viewBox[2]);
    root.setAttribute("height", viewBox[3]);
  }

  // フレームラップ（DOMベース）：指定アスペクト比の外枠に収める
  const fr = frame && FRAMES[frame.ratio]?.dims ? frame : null;
  let finalRoot = root;
  let outVB = hasVB ? viewBox : [0, 0, 800, 600];
  if (fr) {
    const [W, H] = FRAMES[fr.ratio].dims;
    root.setAttribute("width", W);
    root.setAttribute("height", H);
    root.setAttribute("preserveAspectRatio", `${fr.align || "xMidYMid"} ${fr.fit === "contain" ? "meet" : "slice"}`);
    root.removeAttribute("x"); root.removeAttribute("y");
    const outer = doc.createElementNS(SVGNS, "svg");
    outer.setAttribute("xmlns", SVGNS);
    outer.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    outer.setAttribute("viewBox", `0 0 ${W} ${H}`);
    outer.setAttribute("width", W); outer.setAttribute("height", H);
    const bg = doc.createElementNS(SVGNS, "rect");
    bg.setAttribute("width", W); bg.setAttribute("height", H);
    bg.setAttribute("fill", fr.bg || "#FFFFFF");
    outer.appendChild(bg);
    outer.appendChild(root);
    finalRoot = outer;
    outVB = [0, 0, W, H];
  }

  // テロップ（最終出力座標系に描画）
  const includeOverlays = !visibleRange;
  if (overlays && overlays.length && includeOverlays) {
    overlays.forEach((o, oi) => {
      const fs = outVB[3] * (o.size / 100);
      const vx = outVB[0] + outVB[2] * (o.x / 100);
      const vy = outVB[1] + outVB[3] * (o.y / 100);
      const g = doc.createElementNS(SVGNS, "g");
      g.setAttribute("data-ov", oi);
      g.setAttribute("transform", `translate(${vx},${vy})`);
      const gInner = doc.createElementNS(SVGNS, "g");
      gInner.setAttribute("class", cls(`ov${oi}`));
      g.appendChild(gInner);
      if (o.style === "band") {
        const bw = o.text.length * fs * 1.05 + fs * 1.2;
        const band = doc.createElementNS(SVGNS, "rect");
        band.setAttribute("x", -bw / 2); band.setAttribute("y", -fs * 0.85);
        band.setAttribute("width", bw); band.setAttribute("height", fs * 1.7);
        band.setAttribute("rx", fs * 0.15);
        band.setAttribute("fill", o.bandColor || "#000000");
        band.setAttribute("opacity", "0.75");
        gInner.appendChild(band);
      }
      const tx = doc.createElementNS(SVGNS, "text");
      tx.setAttribute("x", 0); tx.setAttribute("y", 0);
      tx.setAttribute("text-anchor", "middle");
      tx.setAttribute("dominant-baseline", "central");
      tx.setAttribute("font-size", fs);
      tx.setAttribute("font-weight", "700");
      tx.setAttribute("font-family", (OV_FONTS[o.font] || OV_FONTS.gothic).css);
      tx.setAttribute("fill", o.color || "#FFFFFF");
      if (o.style !== "band") {
        tx.setAttribute("stroke", o.outline || "#000000");
        tx.setAttribute("stroke-width", Math.max(1, fs / 9));
        tx.setAttribute("paint-order", "stroke");
        tx.setAttribute("stroke-linejoin", "round");
      }
      tx.textContent = o.text;
      gInner.appendChild(tx);
      finalRoot.appendChild(g);

      if (!staticMode) {
        const pausedO = snapshotT === null || livePlay ? "" : " paused";
        const shiftO = (dl) => (snapshotT === null ? dl : dl - snapshotT);
        const anims = [];
        const ovOrigin = { cx: 0, cy: 0 }; // テロップ内容は原点中心に配置済み
        if (o.anim && o.anim !== "none") {
          const pseudo = { type: o.anim, duration: o.duration || 0.6, delay: o.delay || 0, easing: "ease-out", distance: fs * 1.2, scaleTo: 1.2, loop: false };
          css += keyframesCss(kfn(`ov${oi}`), pseudo, ovOrigin);
          anims.push(`kf_${kfn(`ov${oi}`)} ${pseudo.duration}s ease-out ${shiftO(pseudo.delay)}s 1 both${pausedO ? " paused" : ""}`);
        }
        if (o.exitFade && sceneDuration) {
          const exD = 0.5;
          css += exitKeyframesCss(kfn(`ov${oi}`), { type: "fadeOut" }, 40, ovOrigin);
          anims.push(`kfx_${kfn(`ov${oi}`)} ${exD}s ease-in ${shiftO(Math.max(0, sceneDuration - exD))}s 1 forwards${pausedO ? " paused" : ""}`);
        }
        if (anims.length) css += `.${cls(`ov${oi}`)}{animation:${anims.join(",")};}`;
      }
    });
  }

  if (css) {
    const styleEl = doc.createElementNS(SVGNS, "style");
    styleEl.textContent = css;
    root.insertBefore(styleEl, root.firstChild);
  }
  return new XMLSerializer().serializeToString(finalRoot);
}

function movePartLayer(svgText, uid, dir) {
  // dir: +1 = 前面へ（文書順で後ろへ）, -1 = 背面へ
  const parsed = parseSvg(svgText);
  if (parsed.error) return { svgText, swapped: null };
  const i = +uid.slice(1);
  const j = i + dir;
  const children = parsed.children;
  if (j < 0 || j >= children.length) return { svgText, swapped: null };
  const a = children[i], b = children[j];
  const parent = a.parentNode;
  if (dir > 0) parent.insertBefore(b, a);       // bを前に = aが後ろ（前面）へ
  else parent.insertBefore(a, b);               // aを前に = aが背面へ
  if (!parsed.root.getAttribute("xmlns")) parsed.root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return { svgText: new XMLSerializer().serializeToString(parsed.root), swapped: [i, j] };
}

function getImageRect(svgText, uid) {
  const parsed = parseSvg(svgText);
  if (parsed.error) return null;
  const el = parsed.children[+uid.slice(1)];
  if (!el) return null;
  const mp = findMediaPlacement(el, parsed.doc);
  if (!mp) return null;
  const p = mp.place;
  return { x: +p.getAttribute("x") || 0, y: +p.getAttribute("y") || 0, w: +p.getAttribute("width") || 400, h: +p.getAttribute("height") || 300 };
}

function getImageBox(svgText, uid) {
  const r = getImageRect(svgText, uid);
  return r ? { w: r.w, h: r.h } : null;
}

// ---------- CSV（入稿テンプレ） ----------
function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function parseCsvText(text) {
  const s = text.replace(/^\uFEFF/, "");
  // 区切り文字の自動判定（Excelの保存形式によりタブ/セミコロンの場合がある）
  const firstLine = s.split(/[\r\n]/)[0] || "";
  const delim = firstLine.includes("\t") ? "\t" : firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

// ファイルをテキストとして読む（UTF-8 → 失敗時Shift_JISフォールバック）
function readCsvFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => {
      const buf = r.result;
      try {
        resolve(new TextDecoder("utf-8", { fatal: true }).decode(buf));
      } catch (e) {
        try { resolve(new TextDecoder("shift_jis").decode(buf)); }
        catch (e2) { resolve(new TextDecoder("utf-8").decode(buf)); }
      }
    };
    r.readAsArrayBuffer(file);
  });
}

// シーン内で最も大きい画像パーツ（メイン写真とみなす）を返す
function largestImagePartUid(svgText) {
  const parsed = parseSvg(svgText);
  if (parsed.error) return null;
  let best = null, bestArea = 0;
  parsed.parts.forEach((p) => {
    if (!p.hasImage) return;
    const r = getImageRect(svgText, p.uid);
    if (r && r.w * r.h > bestArea) { bestArea = r.w * r.h; best = p.uid; }
  });
  return best;
}

// 画像を枠にカバーで焼き込み（中央トリミング）
function bakeCoverImage(dataUrl, box) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1.5, 2400 / Math.max(box.w, box.h));
      const W = Math.round(box.w * k), H = Math.round(box.h * k);
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      const cov = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const dw = img.naturalWidth * cov, dh = img.naturalHeight * cov;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// パーツ内のテキスト単位（行/tspan）を列挙
function getPartTextUnits(svgText, uid) {
  const parsed = parseSvg(svgText);
  if (parsed.error) return [];
  const el = parsed.children[+uid.slice(1)];
  if (!el) return [];
  const texts = el.tagName === "text" ? [el] : Array.from(el.querySelectorAll("text"));
  const units = [];
  texts.forEach((tx, ti) => {
    const leafs = tx.children.length ? Array.from(tx.querySelectorAll("tspan")).filter((t) => !t.children.length) : [tx];
    leafs.forEach((leaf) => units.push(leaf.textContent));
  });
  return units;
}

// パーツ内のn番目のテキスト単位を書き換えてSVGを再生成
function setPartTextUnit(svgText, uid, unitIndex, value) {
  const parsed = parseSvg(svgText);
  if (parsed.error) return svgText;
  const el = parsed.children[+uid.slice(1)];
  if (!el) return svgText;
  const texts = el.tagName === "text" ? [el] : Array.from(el.querySelectorAll("text"));
  const leafs = [];
  texts.forEach((tx) => {
    const ls = tx.children.length ? Array.from(tx.querySelectorAll("tspan")).filter((t) => !t.children.length) : [tx];
    ls.forEach((l) => leafs.push(l));
  });
  if (!leafs[unitIndex]) return svgText;
  leafs[unitIndex].textContent = value;
  if (!parsed.root.getAttribute("xmlns")) parsed.root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(parsed.root);
}

// テキスト編集フィールド（確定時のみコミット＝履歴が汚れない）
function TextEditField({ initial, onCommit }) {
  const [val, setVal] = useState(initial);
  useEffect(() => setVal(initial), [initial]);
  const commit = () => { if (val !== initial) onCommit(val); };
  return (
    <input type="text" value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
      style={{ width: "100%", background: "#14161C", color: "#EDEEF2", border: "1px solid #333A4A", borderRadius: 6, padding: "7px 9px", fontSize: 13 }} />
  );
}

function replaceImageInPart(svgText, uid, dataUrl) {
  const parsed = parseSvg(svgText);
  if (parsed.error) return svgText;
  const idx = +uid.slice(1);
  const el = parsed.children[idx];
  if (!el) return svgText;
  const mp = findMediaPlacement(el, parsed.doc);
  if (!mp) return svgText;
  let img = mp.img;
  if (mp.isPattern) {
    // Figmaのパターン塗りrect → 通常の<image>要素に変換（以後は標準機能がすべて使える）
    const p = mp.place;
    const ni = parsed.doc.createElementNS(SVGNS, "image");
    ["x", "y", "width", "height"].forEach((a) => ni.setAttribute(a, p.getAttribute(a) || 0));
    if (p.getAttribute("transform")) ni.setAttribute("transform", p.getAttribute("transform"));
    ni.setAttribute("preserveAspectRatio", "xMidYMid slice");
    p.parentNode.replaceChild(ni, p);
    img = ni;
  }
  img.setAttribute("href", dataUrl);
  img.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", dataUrl);
  if (!parsed.root.getAttribute("xmlns")) parsed.root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(parsed.root);
}

// ---------- スライダー＋数値入力 ----------
function NumSlider({ label, value, min, max, step, unit, onChange }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>
        {label}
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="number" value={value} min={min} max={max} step={step}
            onChange={(e) => { const v = +e.target.value; if (!isNaN(v)) onChange(Math.max(min, v)); }}
            style={styles.numInput} />
          <b style={{ ...styles.mono, fontSize: 11 }}>{unit}</b>
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={Math.min(value, max)} onChange={(e) => onChange(+e.target.value)} />
    </label>
  );
}

// ---------- 動画のトリム区間ループ（プレビュー用） ----------
function hookVideoLoops(container) {
  if (!container) return;
  container.querySelectorAll("video[data-vstart]").forEach((v) => {
    if (v._hooked) return;
    v._hooked = true;
    const start = +v.dataset.vstart || 0;
    const speed = +v.dataset.vspeed || 1;
    v.playbackRate = speed;
    v.addEventListener("loadedmetadata", () => { v.playbackRate = speed; });
    const getEnd = () => (+v.dataset.vend > start ? +v.dataset.vend : v.duration || 1e9);
    const toStart = () => { try { v.currentTime = start; } catch (e) {} };
    if (v.readyState >= 1) toStart(); else v.addEventListener("loadedmetadata", toStart);
    v.addEventListener("timeupdate", () => {
      if (v.currentTime >= getEnd() - 0.05 || v.currentTime < start - 0.1) { toStart(); v.play().catch(() => {}); }
    });
  });
}

// ---------- 音声波形（音ハメ用タイムライン表示） ----------
const waveCache = new Map();
function getWaveform(src, width = 800, height = 24, color = "#7EE0D0") {
  if (waveCache.has(src)) return waveCache.get(src);
  const p = (async () => {
    const buf = await (await fetch(src)).arrayBuffer();
    const ACtx = window.AudioContext || window.webkitAudioContext;
    const actx = new ACtx();
    const ab = await actx.decodeAudioData(buf);
    actx.close?.();
    const ch = ab.getChannelData(0);
    const c = document.createElement("canvas"); c.width = width; c.height = height;
    const g = c.getContext("2d"); g.fillStyle = color;
    const step = Math.max(1, Math.floor(ch.length / width));
    for (let x = 0; x < width; x++) {
      let m = 0;
      for (let i = x * step; i < (x + 1) * step; i += 24) m = Math.max(m, Math.abs(ch[i] || 0));
      const h = Math.max(1, m * height);
      g.fillRect(x, (height - h) / 2, 1, h);
    }
    return { url: c.toDataURL(), duration: ab.duration };
  })();
  waveCache.set(src, p);
  return p;
}

function AudioTrackRow({ label, src, tlMax, mode, sceneStart = 0, delay = 0, speed = 1, start = 0, end = 0, onDragDelay, onSelect }) {
  const [wave, setWave] = useState(null);
  useEffect(() => { let ok = true; getWaveform(src).then((w) => ok && setWave(w)).catch(() => {}); return () => { ok = false; }; }, [src]);
  const trackRef = useRef(null);
  const st = useRef(null);
  let segs = [];
  if (wave) {
    if (mode === "bgm") {
      const off = -(sceneStart % wave.duration);
      for (let o = off; o < tlMax; o += wave.duration) segs.push({ l: (o / tlMax) * 100, w: (wave.duration / tlMax) * 100 });
    } else {
      const clip = end > start ? end - start : Math.max(0.05, wave.duration - start);
      segs = [{ l: (delay / tlMax) * 100, w: ((clip / (speed || 1)) / tlMax) * 100 }];
    }
  }
  const down = (e) => {
    if (mode !== "scene" || !onDragDelay) return;
    e.stopPropagation();
    const tr = trackRef.current.getBoundingClientRect();
    st.current = { sx: e.clientX, d0: delay, pxs: tr.width / tlMax, el: e.currentTarget };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const mv = (e) => { const d = st.current; if (!d) return; d.nd = Math.max(0, d.d0 + (e.clientX - d.sx) / d.pxs); d.el.style.left = `${(d.nd / tlMax) * 100}%`; };
  const up = () => { const d = st.current; st.current = null; if (d && d.nd != null) onDragDelay(+d.nd.toFixed(2)); };
  return (
    <div style={styles.tlRow}>
      <span style={{ ...styles.tlName, color: "#8B7CFF", cursor: onSelect ? "pointer" : "default" }} onClick={(e) => { if (onSelect) { e.stopPropagation(); onSelect(); } }}>{label}</span>
      <div ref={trackRef} style={{ ...styles.tlTrack, height: 22, background: "#12151C" }}>
        {wave && segs.map((s, i) => (
          <div key={i}
            onPointerDown={i === 0 ? down : undefined} onPointerMove={mv} onPointerUp={up} onClick={(e) => e.stopPropagation()}
            style={{ position: "absolute", top: 1, bottom: 1, left: `${s.l}%`, width: `${Math.max(s.w, 1)}%`, backgroundImage: `url(${wave.url})`, backgroundSize: "100% 100%", borderRadius: 3, cursor: mode === "scene" ? "grab" : "default" }} />
        ))}
        {!wave && <span style={{ position: "absolute", left: 8, top: 3, fontSize: 10, color: "#5C6373" }}>波形を解析中…</span>}
      </div>
    </div>
  );
}

// ---------- タイムラインのミニサムネイル ----------
const partThumbCache = new Map();
function PartThumb({ svgText, uid }) {
  const key = svgText.length + ":" + uid + ":" + svgText.slice(0, 40);
  const [url, setUrl] = useState(() => partThumbCache.get(key) || null);
  useEffect(() => {
    if (partThumbCache.has(key)) { setUrl(partThumbCache.get(key)); return; }
    let ok = true;
    (async () => {
      try {
        const bb = measurePartBBox(svgText, uid);
        if (!bb || bb.w < 1 || bb.h < 1) return;
        const pad = Math.max(bb.w, bb.h) * 0.05;
        const vb = `${bb.x - pad} ${bb.y - pad} ${bb.w + pad * 2} ${bb.h + pad * 2}`;
        let s2 = svgText.replace(/<svg([^>]*?)>/, (m, a) => {
          let attrs = a.replace(/\sviewBox="[^"]*"/, "").replace(/\s(width|height)="[^"]*"/g, "");
          if (!/xmlns=/.test(attrs)) attrs += ` xmlns="${SVGNS}"`;
          return `<svg${attrs} viewBox="${vb}" width="68" height="44" preserveAspectRatio="xMidYMid meet">`;
        });
        const blob = new Blob([s2], { type: "image/svg+xml;charset=utf-8" });
        const u = URL.createObjectURL(blob);
        const img = new Image(); img.src = u; await img.decode();
        const c = document.createElement("canvas"); c.width = 68; c.height = 44;
        const g = c.getContext("2d"); g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 68, 44); g.drawImage(img, 0, 0, 68, 44);
        URL.revokeObjectURL(u);
        const du = c.toDataURL();
        if (partThumbCache.size > 300) partThumbCache.clear();
        partThumbCache.set(key, du);
        if (ok) setUrl(du);
      } catch (e) { /* 描画不可はプレースホルダのまま */ }
    })();
    return () => { ok = false; };
  }, [key]);
  return <span style={{ width: 34, height: 22, flexShrink: 0, borderRadius: 3, background: "#1D2129", backgroundImage: url ? `url(${url})` : undefined, backgroundSize: "cover", backgroundPosition: "center", border: "1px solid #333A4A" }} />;
}

// ---------- タイムラインバー（ドラッグ移動＋右端リサイズ） ----------
function TlBar({ left, width, color, loop, title, resizable, tlMax, onCommit, onSelect }) {
  const ref = useRef(null);
  const st = useRef(null);
  const down = (e) => {
    e.stopPropagation();
    onSelect && onSelect();
    const bar = ref.current;
    const tr = bar.parentElement.getBoundingClientRect();
    const br = bar.getBoundingClientRect();
    const mode = resizable && e.clientX > br.right - 9 ? "resize" : "move";
    st.current = { mode, sx: e.clientX, pxs: tr.width / tlMax, l0: (br.left - tr.left) / tr.width * 100, w0: br.width / tr.width * 100, moved: false };
    bar.setPointerCapture(e.pointerId);
  };
  const mv = (e) => {
    const d = st.current; if (!d) return;
    const dx = e.clientX - d.sx;
    if (Math.abs(dx) > 2) d.moved = true;
    const dPct = (dx / d.pxs / tlMax) * 100;
    const bar = ref.current;
    if (d.mode === "move") { d.nl = Math.max(0, Math.min(98, d.l0 + dPct)); bar.style.left = d.nl + "%"; }
    else { d.nw = Math.max(1, d.w0 + dPct); bar.style.width = d.nw + "%"; }
  };
  const up = () => {
    const d = st.current; st.current = null;
    if (!d || !d.moved) return;
    if (d.mode === "move" && d.nl != null) onCommit({ delay: +((d.nl / 100) * tlMax).toFixed(2) });
    if (d.mode === "resize" && d.nw != null) onCommit({ duration: Math.max(0.05, +((d.nw / 100) * tlMax).toFixed(2)) });
  };
  return (
    <div ref={ref} onPointerDown={down} onPointerMove={mv} onPointerUp={up} onClick={(e) => e.stopPropagation()}
      style={{ ...styles.tlBar, left: `${Math.min(left, 98)}%`, width: loop ? `${100 - Math.min(left, 98)}%` : `${Math.max(width, 1.5)}%`, background: color, cursor: "grab" }}
      title={title}>
      {resizable && <span style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 9, cursor: "ew-resize", borderRight: "2px solid #FFFFFF66", borderRadius: "0 3px 3px 0" }} />}
    </div>
  );
}

// ---------- パーツの位置移動（プレビュードラッグ用） ----------
function movePartPosition(svgText, uid, dx, dy) {
  const parsed = parseSvg(svgText);
  if (parsed.error) return svgText;
  const el = parsed.children[+uid.slice(1)];
  if (!el) return svgText;
  const t = el.getAttribute("transform") || "";
  el.setAttribute("transform", `translate(${dx.toFixed(1)} ${dy.toFixed(1)})${t ? " " + t : ""}`);
  if (!parsed.root.getAttribute("xmlns")) parsed.root.setAttribute("xmlns", SVGNS);
  return new XMLSerializer().serializeToString(parsed.root);
}

// 図形1個ぶんの内側要素を生成（geom={cx,cy,vx,vy,vw,vh,u,s} を与える）
function shapeInnerSvg(shape, color, geom) {
  const { cx, cy, vx, vw, vh, u, s } = geom;
  const f = (x) => (+x).toFixed(1);
  switch (shape) {
    case "rect": return `<rect x="${f(cx - s)}" y="${f(cy - s * 0.7)}" width="${f(s * 2)}" height="${f(s * 1.4)}" rx="${f(u * 0.02)}" fill="${color}"/>`;
    case "roundRect": return `<rect x="${f(cx - s)}" y="${f(cy - s * 0.7)}" width="${f(s * 2)}" height="${f(s * 1.4)}" rx="${f(u * 0.06)}" fill="${color}"/>`;
    case "circle": return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(s)}" fill="${color}"/>`;
    case "band": return `<rect x="${f(vx)}" y="${f(cy - vh * 0.09)}" width="${f(vw)}" height="${f(vh * 0.18)}" fill="${color}"/>`;
    case "triangle": return `<polygon points="${f(cx)},${f(cy - s)} ${f(cx + s)},${f(cy + s)} ${f(cx - s)},${f(cy + s)}" fill="${color}"/>`;
    case "star": {
      const pts = [];
      for (let i = 0; i < 10; i++) { const r = i % 2 === 0 ? s : s * 0.42; const a = -Math.PI / 2 + i * Math.PI / 5; pts.push(`${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`); }
      return `<polygon points="${pts.join(" ")}" fill="${color}"/>`;
    }
    case "arrow": {
      const w = s * 1.6, h = s * 0.5;
      return `<polygon points="${f(cx - w)},${f(cy - h / 2)} ${f(cx + w * 0.3)},${f(cy - h / 2)} ${f(cx + w * 0.3)},${f(cy - h)} ${f(cx + w)},${f(cy)} ${f(cx + w * 0.3)},${f(cy + h)} ${f(cx + w * 0.3)},${f(cy + h / 2)} ${f(cx - w)},${f(cy + h / 2)}" fill="${color}"/>`;
    }
    case "bubble": {
      const bw = s * 2, bh = s * 1.3;
      return `<rect x="${f(cx - bw / 2)}" y="${f(cy - bh / 2)}" width="${f(bw)}" height="${f(bh)}" rx="${f(u * 0.05)}" fill="${color}"/>` +
        `<polygon points="${f(cx - s * 0.2)},${f(cy + bh / 2 - 2)} ${f(cx + s * 0.3)},${f(cy + bh / 2 - 2)} ${f(cx)},${f(cy + bh / 2 + s * 0.5)}" fill="${color}"/>`;
    }
    case "text": return `<text x="${f(cx)}" y="${f(cy)}" text-anchor="middle" dominant-baseline="middle" font-family="'Noto Sans JP','Hiragino Sans','Yu Gothic',sans-serif" font-weight="bold" font-size="${f(u * 0.09)}" fill="${color}">テキスト</text>`;
    default: return `<rect x="${f(cx - s)}" y="${f(cy - s)}" width="${f(s * 2)}" height="${f(s * 2)}" fill="${color}"/>`;
  }
}

// SVGテキストからviewBox幾何を取得
function svgGeom(svgText) {
  let vx = 0, vy = 0, vw = 0, vh = 0;
  const mVB = svgText.match(/viewBox\s*=\s*["']([-\d.\s,]+)["']/i);
  if (mVB) { const n = mVB[1].trim().split(/[\s,]+/).map(Number); if (n.length === 4 && n.every((x) => !isNaN(x))) [vx, vy, vw, vh] = n; }
  if (!vw || !vh) {
    const mW = svgText.match(/\bwidth\s*=\s*["']?([\d.]+)/i), mH = svgText.match(/\bheight\s*=\s*["']?([\d.]+)/i);
    vw = mW ? +mW[1] : 1080; vh = mH ? +mH[1] : 1080;
  }
  const u = Math.min(vw, vh);
  return { vx, vy, vw, vh, cx: vx + vw / 2, cy: vy + vh / 2, u, s: u * 0.28 };
}

// 図形パーツにグラデーション塗りを適用（linearGradient を defs に追加し fill=url(#id) に）
function setShapeGradient(svgText, uid, c1, c2, angleDeg) {
  const parsed = parseSvg(svgText);
  if (parsed.error) return svgText;
  const el = parsed.children[+uid.slice(1)];
  if (!el || !el.getAttribute) return svgText;
  const sid = el.getAttribute("data-sid");
  if (!sid) return svgText;
  const gid = `grad_${sid}`;
  // 角度→x1,y1,x2,y2（objectBoundingBox基準）
  const a = (angleDeg % 360) * Math.PI / 180;
  const x1 = (0.5 - Math.cos(a) / 2).toFixed(4), y1 = (0.5 - Math.sin(a) / 2).toFixed(4);
  const x2 = (0.5 + Math.cos(a) / 2).toFixed(4), y2 = (0.5 + Math.sin(a) / 2).toFixed(4);
  const gradDef = `<linearGradient id="${gid}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;

  let out = svgText;
  // 既存の同IDグラデーションがあれば置換、なければdefsに追加（defsがなければ作る）
  const existRe = new RegExp(`<linearGradient id="${gid}"[\\s\\S]*?</linearGradient>`);
  if (existRe.test(out)) {
    out = out.replace(existRe, gradDef);
  } else if (/<defs[^>]*>/.test(out)) {
    out = out.replace(/(<defs[^>]*>)/, `$1${gradDef}`);
  } else {
    // defsをsvg開始直後に挿入
    out = out.replace(/(<svg[^>]*>)/, `$1<defs>${gradDef}</defs>`);
  }
  // 対象図形のfillを url(#gid) に
  const openRe = new RegExp(`(<g[^>]*data-sid="${sid}"[^>]*>)`);
  const m = openRe.exec(out);
  if (!m) return out;
  const innerStart = m.index + m[1].length;
  const closeIdx = out.indexOf("</g>", innerStart);
  if (closeIdx < 0) return out;
  const block = out.slice(innerStart, closeIdx).replace(/fill="[^"]*"/g, `fill="url(#${gid})"`);
  return out.slice(0, innerStart) + block + out.slice(closeIdx);
}

// 既存の図形パーツ（data-sid）の種類を変更。位置transform・色は保ったまま中身だけ差し替える。
function changeShapeType(svgText, uid, newShape) {
  const parsed = parseSvg(svgText);
  if (parsed.error) return svgText;
  const el = parsed.children[+uid.slice(1)];
  if (!el || !el.getAttribute) return svgText;
  const sid = el.getAttribute("data-sid");
  if (!sid) return svgText;
  // 現在の色を拾う
  const cur = el.querySelector("[fill]");
  const color = (cur && cur.getAttribute("fill")) || "#8B7CFF";
  const geom = svgGeom(svgText);
  const newInner = shapeInnerSvg(newShape, color, geom);
  // data-sidのgブロックの中身を差し替え、data-shape属性も更新
  const openRe = new RegExp(`(<g[^>]*data-sid=["']${sid}["'][^>]*>)`);
  const m = openRe.exec(svgText);
  if (!m) return svgText;
  let openTag = m[1].replace(/data-shape=["'][^"']*["']/, `data-shape="${newShape}"`);
  const innerStart = m.index + m[1].length;
  const closeIdx = svgText.indexOf("</g>", innerStart);
  if (closeIdx < 0) return svgText;
  return svgText.slice(0, m.index) + openTag + newInner + svgText.slice(closeIdx);
}

// 図形パーツをシーンSVGの末尾（最前面）に追加。元のSVG文字列は壊さず、</svg>直前に文字列で挿入する。
function addShapeToSvg(svgText, shape, color) {
  const geom = svgGeom(svgText);
  const inner = shapeInnerSvg(shape, color, geom);
  const sid = `shape${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const g = `<g data-shape="${shape}" data-sid="${sid}">${inner}</g>`;
  // パーツ認識（getPartsChildren）と整合させる：トップレベルの子が単一の<g>ラッパーなら、その閉じ</g>の直前に入れる。
  // それ以外は </svg> の直前に入れる。
  const parsed = parseSvg(svgText);
  let useWrapper = false;
  if (!parsed.error) {
    const topEls = Array.from(parsed.root.children).filter((el) => !["defs", "style", "title", "desc", "metadata"].includes(el.tagName));
    useWrapper = topEls.length === 1 && topEls[0].tagName === "g";
  }
  if (useWrapper) {
    // 最後の </g> の直前（＝ラッパーgの閉じ）に挿入
    const idx = svgText.lastIndexOf("</g>");
    if (idx >= 0) return svgText.slice(0, idx) + g + svgText.slice(idx);
  }
  const idx = svgText.lastIndexOf("</svg>");
  if (idx < 0) return svgText;
  return svgText.slice(0, idx) + g + svgText.slice(idx);
}

// blob:/data: いずれのURLもdataURLに変換（保存埋め込み用）。失敗時は空を返す。
async function urlToDataUrl(url) {
  if (!url) return "";
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => resolve("");
      r.readAsDataURL(blob);
    });
  } catch (e) { return ""; }
}

// 画像(dataURL)を1枚だけ含むSVGテキストに包む。画像1枚がパーツ p0 になる。
function imageToSceneSvg(dataUrl, w, h) {
  const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h));
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><g id="photo"><image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" xlink:href="${dataUrl}"/></g></svg>`;
}

// 画像ファイル→{dataUrl,w,h}
function readImageFile(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onerror = () => resolve({ dataUrl: "", w: 1080, h: 1080 });
    r.onload = () => {
      const dataUrl = String(r.result);
      let done = false;
      const finish = (w, h) => { if (done) return; done = true; resolve({ dataUrl, w: w || 1080, h: h || 1080 }); };
      const img = new Image();
      img.onload = () => finish(img.naturalWidth, img.naturalHeight);
      img.onerror = () => finish(1080, 1080);
      img.src = dataUrl;
      // onloadが来ない環境向けの保険（寸法は既定値で続行）
      setTimeout(() => finish(img.naturalWidth, img.naturalHeight), 1500);
    };
    r.readAsDataURL(file);
  });
}

// パーツ（トップレベル子要素）を削除。settings側の除去・uid振り直しは呼び出し側で行う。
function removePartFromSvg(svgText, uid) {
  const parsed = parseSvg(svgText);
  if (parsed.error) return svgText;
  const el = parsed.children[+uid.slice(1)];
  if (!el) return svgText;
  el.parentNode.removeChild(el);
  if (!parsed.root.getAttribute("xmlns")) parsed.root.setAttribute("xmlns", SVGNS);
  return new XMLSerializer().serializeToString(parsed.root);
}

// 図形パーツの塗り色を変更（data-shape の g 内の図形要素すべてに適用）
function setShapeColor(svgText, uid, color) {
  // 図形パーツ（data-shape/data-sid付きのg）を文字列で特定し、中のfillだけ置換して元SVGを壊さない
  const parsed = parseSvg(svgText);
  if (parsed.error) return svgText;
  const el = parsed.children[+uid.slice(1)];
  if (!el || !el.getAttribute) return svgText;
  const sid = el.getAttribute("data-sid");
  if (!sid) return svgText; // 図形以外は対象外
  // <g ... data-sid="sid" ...> から対応する </g> までを取り出してfillを置換
  const openRe = new RegExp(`<g[^>]*data-sid=["']${sid}["'][^>]*>`);
  const m = openRe.exec(svgText);
  if (!m) return svgText;
  const startIdx = m.index;
  const innerStart = startIdx + m[0].length;
  const closeIdx = svgText.indexOf("</g>", innerStart);
  if (closeIdx < 0) return svgText;
  const block = svgText.slice(innerStart, closeIdx);
  const newBlock = block.replace(/fill="[^"]*"/g, `fill="${color}"`);
  return svgText.slice(0, innerStart) + newBlock + svgText.slice(closeIdx);
}

// パーツを中心基準で拡大縮小（transformにscaleを前置き合成）
function scalePartAt(svgText, uid, factor) {
  const parsed = parseSvg(svgText);
  if (parsed.error) return svgText;
  const el = parsed.children[+uid.slice(1)];
  if (!el) return svgText;
  let bb = measurePartBBox(svgText, uid);
  if (!bb) {
    // getBBox非対応環境向けフォールバック：矩形/画像の座標属性から中心を推定
    const box = el.tagName === "rect" || el.tagName === "image" ? el : el.querySelector("rect,image");
    if (box) bb = { x: +box.getAttribute("x") || 0, y: +box.getAttribute("y") || 0, w: +box.getAttribute("width") || 0, h: +box.getAttribute("height") || 0 };
  }
  if (!bb || (!bb.w && !bb.h)) return svgText;
  const cx = +(bb.x + bb.w / 2).toFixed(2), cy = +(bb.y + bb.h / 2).toFixed(2);
  const t = el.getAttribute("transform") || "";
  // 中心を原点に移動→scale→戻す、を既存transformの前に合成
  el.setAttribute("transform", `translate(${cx} ${cy}) scale(${factor.toFixed(4)}) translate(${-cx} ${-cy})${t ? " " + t : ""}`);
  if (!parsed.root.getAttribute("xmlns")) parsed.root.setAttribute("xmlns", SVGNS);
  return new XMLSerializer().serializeToString(parsed.root);
}

// ---------- 数字カウントアップのライブ再生 ----------
function hookCountUps(container) {
  if (!container) return;
  container.querySelectorAll("[data-countup-target]").forEach((tx) => {
    if (tx._counting) return;
    tx._counting = true;
    const target = +tx.dataset.countupTarget;
    const delay = +tx.dataset.countupDelay * 1000;
    const dur = +tx.dataset.countupDuration * 1000;
    const comma = tx.dataset.countupComma === "1";
    const tmpl = tx.dataset.countupText;
    const numStr = tx.dataset.countupNum;
    const fmt = (v) => (comma ? Math.round(v).toLocaleString() : String(Math.round(v)));
    const t0 = performance.now();
    tx.textContent = tmpl.replace(numStr, fmt(0));
    const tick = () => {
      if (!tx.isConnected) return;
      const raw = Math.min(1, Math.max(0, (performance.now() - t0 - delay) / dur));
      const p = 1 - Math.pow(1 - raw, 2);
      tx.textContent = tmpl.replace(numStr, fmt(target * p));
      if (raw < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function hookMedia(container) { hookVideoLoops(container); hookCountUps(container); }

// ---------- アニメ状態の数値評価（動画パーツのMP4合成用） ----------
function easeVal(easing, p) {
  switch (easing) {
    case "linear": return p;
    case "ease-in": return p * p;
    case "ease-in-out": return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    case "cubic-bezier(0.34,1.56,0.64,1)": { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); }
    default: return 1 - Math.pow(1 - p, 2); // ease-out近似
  }
}

function evalExit(exit, t, sceneDur, distance) {
  const st = { opacity: 1, tx: 0, ty: 0, scale: 1 };
  if (!exit || exit.type === "none" || !sceneDur) return st;
  const dur = exit.duration || 0.6;
  const delay = Math.max(0, sceneDur - dur);
  const raw = Math.min(1, Math.max(0, (t - delay) / dur));
  if (raw <= 0) return st;
  const p = raw * raw; // ease-in
  const d = distance || 60;
  switch (exit.type) {
    case "fadeOut": st.opacity = 1 - p; break;
    case "slideOutUp": st.ty = -d * p; st.opacity = 1 - p; break;
    case "slideOutDown": st.ty = d * p; st.opacity = 1 - p; break;
    case "slideOutLeft": st.tx = -d * p; st.opacity = 1 - p; break;
    case "slideOutRight": st.tx = d * p; st.opacity = 1 - p; break;
    case "zoomOut": st.scale = 1 - p; st.opacity = 1 - p; break;
    default: break;
  }
  return st;
}

function evalAnim(s, t) {
  const st = { opacity: 1, tx: 0, ty: 0, scale: 1, rot: 0 };
  if (!s || !s.type || s.type === "none" || s.type === "draw") return st;
  const loop = isLoop(s);
  let raw = (t - s.delay) / s.duration;
  if (loop) raw = raw < 0 ? 0 : raw % 1;
  else raw = Math.min(1, Math.max(0, raw));
  const p = easeVal(s.easing, raw);
  const d = s.distance, sc = s.scaleTo;
  switch (s.type) {
    case "fadeIn": st.opacity = p; break;
    case "slideUp": st.ty = d * (1 - p); st.opacity = p; break;
    case "slideDown": st.ty = -d * (1 - p); st.opacity = p; break;
    case "slideLeft": st.tx = d * (1 - p); st.opacity = p; break;
    case "slideRight": st.tx = -d * (1 - p); st.opacity = p; break;
    case "zoomIn": st.scale = p; st.opacity = p; break;
    case "pop": st.opacity = Math.min(1, raw / 0.7); st.scale = raw < 0.7 ? 1.15 * (raw / 0.7) : 1.15 - 0.15 * ((raw - 0.7) / 0.3); break;
    case "rotateIn": st.rot = -120 * (1 - p); st.scale = 0.5 + 0.5 * p; st.opacity = p; break;
    case "float": st.ty = -Math.max(4, d / 4) * Math.sin(Math.PI * raw); break;
    case "pulse": st.scale = 1 + 0.08 * Math.sin(Math.PI * raw); break;
    case "spin": st.rot = 360 * raw; break;
    case "panLeft": st.tx = d * (1 - 2 * raw); break;
    case "panRight": st.tx = -d * (1 - 2 * raw); break;
    case "panUp": st.ty = d * (1 - 2 * raw); break;
    case "panDown": st.ty = -d * (1 - 2 * raw); break;
    case "zoomSlow": st.scale = 1 + (sc - 1) * p; break;
    case "zoomOutSlow": st.scale = sc - (sc - 1) * p; break;
    case "kenburns": st.scale = 1 + (sc - 1) * p; st.tx = -(d / 3) * p; st.ty = -(d / 6) * p; break;
    default: break;
  }
  return st;
}

// ---------- 画像トリミングモーダル ----------
function ImageCropModal({ dataUrl, box, onApply, onClose }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [imgDim, setImgDim] = useState(null);
  const dragRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgDim({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = dataUrl;
  }, [dataUrl]);

  const PREVIEW_W = Math.min(360, box.w);
  const previewH = PREVIEW_W * (box.h / box.w);

  const onPointerDown = (e) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    setPos({ x: dragRef.current.ox + (e.clientX - dragRef.current.sx), y: dragRef.current.oy + (e.clientY - dragRef.current.sy) });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const apply = () => {
    if (!imgDim) return;
    // 出力解像度（SVG単位の1.5倍で焼き込み、上限2400px）
    const k = Math.min(1.5, 2400 / Math.max(box.w, box.h));
    const W = Math.round(box.w * k), H = Math.round(box.h * k);
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H);
    // cover基準スケール × ユーザースケール、位置はプレビューpx→出力pxに換算
    const base = Math.max(W / imgDim.w, H / imgDim.h) * scale;
    const dw = imgDim.w * base, dh = imgDim.h * base;
    const ratio = W / PREVIEW_W;
    const dx = (W - dw) / 2 + pos.x * ratio;
    const dy = (H - dh) / 2 + pos.y * ratio;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, dx, dy, dw, dh);
      onApply(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.src = dataUrl;
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000B0", zIndex: 70, display: "grid", placeItems: "center" }}>
      <div className="vc-modal" style={{ background: "#1D2129", border: "1px solid #333A4A", borderRadius: 14, padding: 20, width: 440, maxWidth: "94vw", color: "#EDEEF2" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>画像のトリミング</div>
        <p style={{ fontSize: 11.5, color: "#9AA0AE", margin: "0 0 12px", lineHeight: 1.7 }}>ドラッグで位置調整、スライダーで拡大縮小。枠（{box.w}×{box.h}）に収まる部分が使われます。</p>
        <div ref={boxRef}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          style={{ width: PREVIEW_W, height: previewH, margin: "0 auto 12px", overflow: "hidden", borderRadius: 8, border: "2px solid #8B7CFF", cursor: "grab", touchAction: "none", position: "relative", background: "#fff" }}>
          {imgDim && (
            <img src={dataUrl} alt="" draggable={false} style={{
              position: "absolute", left: "50%", top: "50%",
              width: Math.max(PREVIEW_W / imgDim.w, previewH / imgDim.h) * imgDim.w * scale,
              height: "auto",
              transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
              userSelect: "none", pointerEvents: "none",
            }} />
          )}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#9AA0AE", marginBottom: 14 }}>
          拡大縮小
          <input type="range" min="0.5" max="3" step="0.02" value={scale} onChange={(e) => setScale(+e.target.value)} style={{ flex: 1 }} />
          <b style={{ fontFamily: "'DM Mono',monospace", color: "#8B7CFF", width: 44 }}>×{scale.toFixed(2)}</b>
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={apply} style={{ flex: 1, background: "#8B7CFF", color: "#14161C", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>この範囲で適用</button>
          <button className="btn" onClick={onClose} style={{ background: "#14161C", color: "#C9CDD6", border: "1px solid #333A4A", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontSize: 13 }}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}

// ---------- 動画設定モーダル（尺・トリミング） ----------
function VideoEditModal({ video, box, onApply, onClose }) {
  const [start, setStart] = useState(video.start || 0);
  const [end, setEnd] = useState(video.end || 0);
  const [scale, setScale] = useState(video.cscale || 1);
  const [speed, setSpeed] = useState(video.speed || 1);
  const [pos, setPos] = useState({ nx: video.nx || 0, ny: video.ny || 0 });
  const [dur, setDur] = useState(video.duration || 0);
  const vidRef = useRef(null);
  const dragRef = useRef(null);

  const PREVIEW_W = Math.min(360, box.w);
  const previewH = PREVIEW_W * (box.h / box.w);

  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    const onMeta = () => { setDur(v.duration); setVdim({ w: v.videoWidth, h: v.videoHeight }); if (!end) setEnd(+v.duration.toFixed(1)); v.currentTime = start; };
    v.addEventListener("loadedmetadata", onMeta);
    if (v.readyState >= 1) onMeta();
    const onTime = () => {
      const e = end > start ? end : v.duration;
      if (v.currentTime >= e - 0.05 || v.currentTime < start - 0.1) { v.currentTime = start; v.play().catch(() => {}); }
    };
    v.addEventListener("timeupdate", onTime);
    return () => { v.removeEventListener("loadedmetadata", onMeta); v.removeEventListener("timeupdate", onTime); };
  }, [start, end]);

  const [vdim, setVdim] = useState(video.vw ? { w: video.vw, h: video.vh } : null);
  const onPointerDown = (e) => { dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.nx, oy: pos.ny }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    setPos({ nx: dragRef.current.ox + (e.clientX - dragRef.current.sx) / PREVIEW_W, ny: dragRef.current.oy + (e.clientY - dragRef.current.sy) / previewH });
  };
  const onPointerUp = () => { dragRef.current = null; };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000B0", zIndex: 70, display: "grid", placeItems: "center" }}>
      <div className="vc-modal" style={{ background: "#1D2129", border: "1px solid #333A4A", borderRadius: 14, padding: 20, width: 460, maxWidth: "94vw", color: "#EDEEF2" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>動画の設定</div>
        <p style={{ fontSize: 11.5, color: "#9AA0AE", margin: "0 0 12px", lineHeight: 1.7 }}>
          ドラッグで位置調整、スライダーで拡大縮小。使用する尺（開始/終了）も指定できます。
          {dur > 0 && <>　元動画：{dur.toFixed(1)}秒</>}
        </p>
        <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          style={{ width: PREVIEW_W, height: previewH, margin: "0 auto 12px", overflow: "hidden", borderRadius: 8, border: "2px solid #8B7CFF", cursor: "grab", touchAction: "none", position: "relative", background: "#000" }}>
          {vdim && (() => {
            const cov = Math.max(PREVIEW_W / vdim.w, previewH / vdim.h) * scale;
            const elW = vdim.w * cov, elH = vdim.h * cov;
            return (
              <video ref={vidRef} src={video.src} autoPlay muted loop playsInline
                style={{
                  position: "absolute",
                  width: elW, height: elH,
                  left: PREVIEW_W / 2 - elW / 2 + pos.nx * PREVIEW_W,
                  top: previewH / 2 - elH / 2 + pos.ny * previewH,
                  pointerEvents: "none", maxWidth: "none",
                }} />
            );
          })()}
          {!vdim && <video ref={vidRef} src={video.src} autoPlay muted loop playsInline style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#9AA0AE", marginBottom: 10 }}>
          拡大縮小
          <input type="range" min="0.5" max="3" step="0.02" value={scale} onChange={(e) => setScale(+e.target.value)} style={{ flex: 1 }} />
          <b style={{ fontFamily: "'DM Mono',monospace", color: "#8B7CFF", width: 44 }}>×{scale.toFixed(2)}</b>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#9AA0AE", marginBottom: 10 }}>
          再生速度
          <input type="range" min="0.25" max="3" step="0.05" value={speed} onChange={(e) => { setSpeed(+e.target.value); if (vidRef.current) vidRef.current.playbackRate = +e.target.value; }} style={{ flex: 1 }} />
          <b style={{ fontFamily: "'DM Mono',monospace", color: "#5FD6C4", width: 44 }}>×{speed.toFixed(2)}</b>
        </label>
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <label style={{ flex: 1, fontSize: 12, color: "#9AA0AE", display: "flex", flexDirection: "column", gap: 4 }}>
            使用開始（秒）
            <input type="number" min="0" max={Math.max(0, (end || dur) - 0.1)} step="0.1" value={start}
              onChange={(e) => setStart(Math.max(0, +e.target.value || 0))}
              style={{ background: "#14161C", color: "#EDEEF2", border: "1px solid #333A4A", borderRadius: 6, padding: "6px 8px", fontSize: 13, fontFamily: "'DM Mono',monospace" }} />
          </label>
          <label style={{ flex: 1, fontSize: 12, color: "#9AA0AE", display: "flex", flexDirection: "column", gap: 4 }}>
            使用終了（秒）
            <input type="number" min={start + 0.1} max={dur || 999} step="0.1" value={end}
              onChange={(e) => setEnd(+e.target.value || 0)}
              style={{ background: "#14161C", color: "#EDEEF2", border: "1px solid #333A4A", borderRadius: 6, padding: "6px 8px", fontSize: 13, fontFamily: "'DM Mono',monospace" }} />
          </label>
        </div>
        <p style={{ fontSize: 11, color: "#9AA0AE", margin: "0 0 12px" }}>使用尺：{Math.max(0, (end || dur) - start).toFixed(1)}秒（シーンが長い場合はこの範囲をループ）</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => onApply({ ...video, start, end: end > start ? end : dur, nx: pos.nx, ny: pos.ny, cscale: scale, speed, duration: dur, vw: vdim?.w, vh: vdim?.h })}
            style={{ flex: 1, background: "#8B7CFF", color: "#14161C", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>適用</button>
          <button className="btn" onClick={onClose} style={{ background: "#14161C", color: "#C9CDD6", border: "1px solid #333A4A", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontSize: 13 }}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}

// ---------- 音声のミックスとエンコード（MP4用） ----------
async function decodeAudio(ctx, src) {
  const buf = await (await fetch(src)).arrayBuffer();
  return await ctx.decodeAudioData(buf);
}

// BGM＋シーン音声をOfflineAudioContextで1本にミックス
async function renderAudioMix({ bgm, scenes, total }) {
  const SR = 48000;
  const octx = new OfflineAudioContext(2, Math.ceil(total * SR), SR);
  let hasAny = false;
  if (bgm?.src) {
    try {
      const buf = await decodeAudio(octx, bgm.src);
      const s = octx.createBufferSource();
      s.buffer = buf; s.loop = bgm.loop !== false;
      const g = octx.createGain();
      const vol = bgm.volume ?? 0.6;
      const fi = Math.min(bgm.fadeIn || 0, total / 2), fo = Math.min(bgm.fadeOut || 0, total / 2);
      g.gain.setValueAtTime(fi > 0 ? 0.0001 : vol, 0);
      if (fi > 0) g.gain.linearRampToValueAtTime(vol, fi);
      if (fo > 0) { g.gain.setValueAtTime(vol, total - fo); g.gain.linearRampToValueAtTime(0.0001, total); }
      s.connect(g); g.connect(octx.destination);
      s.start(0);
      hasAny = true;
    } catch (e) { /* BGMデコード失敗はスキップ */ }
  }
  let acc = 0;
  for (const sc of scenes) {
    const dur = Math.max(0.3, sc.duration);
    for (const au of getSceneAudios(sc)) {
      try {
        const buf = await decodeAudio(octx, au.src);
        const s = octx.createBufferSource();
        s.buffer = buf;
        s.playbackRate.value = au.speed || 1;
        const g = octx.createGain();
        g.gain.value = au.volume ?? 1;
        s.connect(g); g.connect(octx.destination);
        const off = au.start || 0;
        const clip = au.end > off ? au.end - off : Math.max(0.05, buf.duration - off);
        s.start(Math.min(total - 0.01, acc + (au.delay || 0)), off, clip);
        hasAny = true;
      } catch (e) { /* スキップ */ }
    }
    acc += dur;
  }
  if (!hasAny) return null;
  return await octx.startRendering();
}

// ミックス済みAudioBufferをAudioEncoderでエンコードしmuxerへ
async function encodeAudioToMuxer(muxer, mixed, codec) {
  const SR = mixed.sampleRate, CH = mixed.numberOfChannels;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => { throw e; },
  });
  encoder.configure({ codec, sampleRate: SR, numberOfChannels: CH, bitrate: 128000 });
  const FRAMES = 1024;
  const chans = [];
  for (let c = 0; c < CH; c++) chans.push(mixed.getChannelData(c));
  for (let off = 0; off < mixed.length; off += FRAMES) {
    const n = Math.min(FRAMES, mixed.length - off);
    const data = new Float32Array(n * CH);
    for (let c = 0; c < CH; c++) data.set(chans[c].subarray(off, off + n), c * n);
    const ad = new AudioData({ format: "f32-planar", sampleRate: SR, numberOfFrames: n, numberOfChannels: CH, timestamp: Math.round(off / SR * 1e6), data });
    encoder.encode(ad);
    ad.close();
    if (encoder.encodeQueueSize > 16) await new Promise((r) => setTimeout(r, 10));
  }
  await encoder.flush();
}

// ---------- MP4書き出し ----------
function sceneDims(scenes, frame) {
  const fd = FRAMES[frame.ratio]?.dims;
  if (fd) return fd;
  const p = parseSvg(scenes[0].svgText);
  const vb = p.root ? (p.root.getAttribute("viewBox") || "0 0 1280 720").split(/[\s,]+/).map(Number) : [0, 0, 1280, 720];
  const even = (n) => Math.round(n / 2) * 2;
  return [even(vb[2]), even(vb[3])];
}

async function svgToImage(svgStr) {
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

function drawTransitionFrame(ctx, W, H, prevImg, currImg, trans, p) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  if (prevImg) ctx.drawImage(prevImg, 0, 0, W, H);
  if (!currImg) return;
  ctx.save();
  let clip = null;
  switch (trans?.type) {
    case "fade": ctx.globalAlpha = p; break;
    case "zoom": {
      ctx.globalAlpha = p;
      const sc = 1.08 - 0.08 * p;
      ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2);
      break;
    }
    case "slideLeft": ctx.translate(W * (1 - p), 0); break;
    case "slideRight": ctx.translate(-W * (1 - p), 0); break;
    case "slideUp": ctx.translate(0, H * (1 - p)); break;
    case "slideDown": ctx.translate(0, -H * (1 - p)); break;
    case "wipe": clip = () => { ctx.beginPath(); ctx.rect(0, 0, W * p, H); ctx.clip(); }; break;
    case "rotate": {
      ctx.globalAlpha = p;
      const sc = 1.1 - 0.1 * p, ang = (-6 + 6 * p) * Math.PI / 180;
      ctx.translate(W / 2, H / 2); ctx.rotate(ang); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2);
      break;
    }
    case "blur": { ctx.globalAlpha = p; ctx.filter = `blur(${((1 - p) * 20).toFixed(1)}px)`; break; }
    case "glitch": {
      ctx.globalAlpha = Math.min(1, p * 1.3);
      const jitter = (1 - p) * 10;
      ctx.translate((Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter * 0.4);
      break;
    }
    case "morph": {
      ctx.globalAlpha = Math.min(1, p * 1.6);
      ctx.filter = `blur(${((1 - p) * 14).toFixed(1)}px)`;
      const zm = 1.05 - 0.05 * p;
      ctx.translate(W / 2, H / 2); ctx.scale(zm, zm); ctx.translate(-W / 2, -H / 2);
      break;
    }
    default: break;
  }
  if (clip) clip();
  ctx.drawImage(currImg, 0, 0, W, H);
  ctx.restore();
}

async function renderMp4({ scenes, frame, fps, bgm, onProgress, isCancelled }) {
  const [W, H] = sceneDims(scenes, frame);
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // タイムライン：各シーンの開始時刻
  const starts = [];
  let acc = 0;
  scenes.forEach((s) => { starts.push(acc); acc += Math.max(0.3, s.duration); });
  const total = acc;
  const totalFrames = Math.ceil(total * fps);

  const useWebCodecs = typeof VideoEncoder !== "undefined" && typeof window.Mp4Muxer !== "undefined";
  let muxer, encoder, recorder, recChunks = [], recMime = "";

  if (useWebCodecs) {
    const candidates = ["avc1.640028", "avc1.42E028", "avc1.4D0028"];
    let codec = null;
    for (const c of candidates) {
      try {
        const s = await VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, bitrate: 8_000_000, framerate: fps });
        if (s.supported) { codec = c; break; }
      } catch (e) { /* try next */ }
    }
    if (!codec) throw new Error("この環境ではH.264エンコードが利用できません。Chrome/Edgeでお試しください。");
    // 音声トラックの要否とコーデックを事前判定
    const wantAudio = !!(bgm?.src || scenes.some((s) => getSceneAudios(s).length));
    let audioCodec = null;
    if (wantAudio && typeof AudioEncoder !== "undefined") {
      for (const c of ["mp4a.40.2", "opus"]) {
        try { const r = await AudioEncoder.isConfigSupported({ codec: c, sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 }); if (r.supported) { audioCodec = c; break; } } catch (e) {}
      }
    }
    muxer = new window.Mp4Muxer.Muxer({
      target: new window.Mp4Muxer.ArrayBufferTarget(),
      video: { codec: "avc", width: W, height: H },
      ...(audioCodec ? { audio: { codec: audioCodec === "opus" ? "opus" : "aac", sampleRate: 48000, numberOfChannels: 2 } } : {}),
      fastStart: "in-memory",
    });
    renderMp4._audioCodec = audioCodec;
    encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { throw e; },
    });
    encoder.configure({ codec, width: W, height: H, bitrate: 8_000_000, framerate: fps });
  } else {
    // フォールバック：MediaRecorderでリアルタイム録画（WebM等）
    const stream = canvas.captureStream(fps);
    const mimes = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
    recMime = mimes.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
    if (!recMime) throw new Error("この環境では動画書き出しが利用できません。Chrome/Edgeでお試しください。");
    recorder = new MediaRecorder(stream, { mimeType: recMime, videoBitsPerSecond: 8_000_000 });
    recorder.ondataavailable = (e) => { if (e.data.size) recChunks.push(e.data); };
    recorder.start(200);
  }

  const snapshotAt = (sceneIdx, t, visibleRange = null) => buildAnimatedSvg(scenes[sceneIdx].svgText, scenes[sceneIdx].settings, { forExport: true, frame, snapshotT: t, visibleRange, sceneDuration: Math.max(0.3, scenes[sceneIdx].duration), overlays: scenes[sceneIdx].overlays });

  // フレーム内での配置矩形（preserveAspectRatioの再現）を計算
  const innerPlacement = (sceneIdx) => {
    const p = parseSvg(scenes[sceneIdx].svgText);
    const vb = (p.root.getAttribute("viewBox") || `0 0 ${W} ${H}`).split(/[\s,]+/).map(Number);
    const fd = FRAMES[frame.ratio]?.dims;
    if (!fd) return { sc: W / vb[2], ox: -vb[0] * (W / vb[2]), oy: -vb[1] * (W / vb[2]), vb };
    const cover = frame.fit !== "contain";
    const sc = cover ? Math.max(W / vb[2], H / vb[3]) : Math.min(W / vb[2], H / vb[3]);
    const cw = vb[2] * sc, ch = vb[3] * sc;
    const ax = frame.align?.includes("xMin") ? 0 : frame.align?.includes("xMax") ? 1 : 0.5;
    const ay = frame.align?.includes("YMin") ? 0 : frame.align?.includes("YMax") ? 1 : 0.5;
    return { sc, ox: (W - cw) * ax - vb[0] * sc, oy: (H - ch) * ay - vb[1] * sc, vb };
  };

  // 各シーンの動画パーツ準備（hidden video要素）
  const videoEls = scenes.map((s) => {
    const map = {};
    Object.entries(s.videoParts || {}).forEach(([uid, v]) => {
      const el = document.createElement("video");
      el.src = v.src; el.muted = true; el.preload = "auto";
      map[uid] = { el, cfg: v, box: getImageRect(s.svgText, uid) };
    });
    return map;
  });
  await Promise.all(scenes.flatMap((s, i) => Object.values(videoEls[i]).map((v) => new Promise((res) => {
    if (v.el.readyState >= 1) return res();
    v.el.onloadedmetadata = () => res();
    v.el.onerror = () => res();
  }))));

  const seekVideo = (v, cfg, t) => new Promise((res) => {
    const s0 = cfg.start || 0;
    const e0 = cfg.end > s0 ? Math.min(cfg.end, v.duration || cfg.end) : (v.duration || s0 + 1);
    const span = Math.max(0.05, e0 - s0);
    const target = s0 + ((t * (cfg.speed || 1)) % span);
    if (Math.abs(v.currentTime - target) < 1 / (fps * 2)) return res();
    const on = () => { v.removeEventListener("seeked", on); res(); };
    v.addEventListener("seeked", on);
    v.currentTime = target;
    setTimeout(res, 400); // フェイルセーフ
  });

  const drawSceneFrame = async (sceneIdx, t, effect) => {
    const vmap = videoEls[sceneIdx];
    const uids = Object.keys(vmap).map((u) => +u.slice(1)).sort((a, b) => a - b);
    const applyEffect = (fn) => {
      ctx.save();
      if (effect) {
        const ep = effect.p;
        switch (effect.trans.type) {
          case "fade": ctx.globalAlpha = ep; break;
          case "morph": {
            ctx.globalAlpha = Math.min(1, ep * 1.6);
            ctx.filter = `blur(${((1 - ep) * 14).toFixed(1)}px)`;
            const zm = 1.05 - 0.05 * ep;
            ctx.translate(W / 2, H / 2); ctx.scale(zm, zm); ctx.translate(-W / 2, -H / 2);
            break;
          }
          case "zoom": { ctx.globalAlpha = ep; const z = 1.08 - 0.08 * ep; ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2); break; }
          case "rotate": { ctx.globalAlpha = ep; const z = 1.1 - 0.1 * ep, a = (-6 + 6 * ep) * Math.PI / 180; ctx.translate(W / 2, H / 2); ctx.rotate(a); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2); break; }
          case "blur": { ctx.globalAlpha = ep; ctx.filter = `blur(${((1 - ep) * 20).toFixed(1)}px)`; break; }
          case "glitch": { ctx.globalAlpha = Math.min(1, ep * 1.3); const j = (1 - ep) * 10; ctx.translate((Math.random() - 0.5) * j, (Math.random() - 0.5) * j * 0.4); break; }
          case "slideLeft": ctx.translate(W * (1 - ep), 0); break;
          case "slideRight": ctx.translate(-W * (1 - ep), 0); break;
          case "slideUp": ctx.translate(0, H * (1 - ep)); break;
          case "slideDown": ctx.translate(0, -H * (1 - ep)); break;
          case "wipe": ctx.beginPath(); ctx.rect(0, 0, W * ep, H); ctx.clip(); break;
          default: break;
        }
      }
      return fn().finally(() => ctx.restore());
    };

    return applyEffect(async () => {
      if (uids.length === 0) {
        const img = await svgToImage(snapshotAt(sceneIdx, t));
        ctx.drawImage(img, 0, 0, W, H);
        return;
      }
      const place = innerPlacement(sceneIdx);
      const total = parseSvg(scenes[sceneIdx].svgText).children.length;
      const bounds = [0, ...uids, total];
      for (let k = 0; k < uids.length + 1; k++) {
        const from = k === 0 ? 0 : uids[k - 1] + 1;
        const to = k === uids.length ? total : uids[k];
        if (to > from) {
          const img = await svgToImage(snapshotAt(sceneIdx, t, [from, to]));
          ctx.drawImage(img, 0, 0, W, H);
        }
        if (k < uids.length) {
          const uid = `p${uids[k]}`;
          const v = vmap[uid];
          if (v.box && v.el.readyState >= 2) {
            await seekVideo(v.el, v.cfg, t);
            const setting = scenes[sceneIdx].settings[uid] || {};
            const stPart = evalAnim(setting, t);
            const stImg = evalAnim(setting.img, t);
            const stExit = evalExit(setting.exit, t, Math.max(0.3, scenes[sceneIdx].duration), setting.distance);
            const bx = place.ox + (v.box.x + stPart.tx) * place.sc, by = place.oy + (v.box.y + stPart.ty) * place.sc;
            const bw = v.box.w * place.sc, bh = v.box.h * place.sc;
            ctx.save();
            ctx.globalAlpha *= stPart.opacity * stImg.opacity * stExit.opacity;
            ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
            const nx = v.cfg.nx || 0, ny = v.cfg.ny || 0, cs = v.cfg.cscale || 1;
            // パン補正：移動距離ぶん自動拡大（プレビューCSSと同じ計算）
            let panK = 1;
            const ia = setting.img;
            if (ia && PAN_TYPES.has(ia.type)) {
              const horiz = ia.type === "panLeft" || ia.type === "panRight";
              panK = Math.min(3, 1 + (2 * ia.distance) / Math.max(1, horiz ? v.box.w : v.box.h));
            }
            const cx = bx + bw / 2 + (stImg.tx + stExit.tx) * place.sc + nx * bw;
            const cy = by + bh / 2 + (stImg.ty + stExit.ty) * place.sc + ny * bh;
            ctx.translate(cx, cy);
            const totalScale = stPart.scale * stImg.scale * stExit.scale * cs * panK;
            ctx.scale(totalScale, totalScale);
            ctx.rotate((stPart.rot + stImg.rot) * Math.PI / 180);
            const vw = v.el.videoWidth || 16, vh = v.el.videoHeight || 9;
            const cov = Math.max(bw / vw, bh / vh); // cscaleはctx.scaleで適用済み
            ctx.drawImage(v.el, -vw * cov / 2, -vh * cov / 2, vw * cov, vh * cov);
            ctx.restore();
          }
        }
      }
    });
  };

  // 直前フレームの画像キャッシュ（トランジション用に前シーンも保持）
  for (let n = 0; n < totalFrames; n++) {
    if (isCancelled()) break;
    const T = n / fps;
    let i = starts.findIndex((s, idx) => T >= s && T < s + Math.max(0.3, scenes[idx].duration));
    if (i === -1) i = scenes.length - 1;
    const t = T - starts[i];
    const trans = i > 0 ? scenes[i - 1].transition : null;
    const inTrans = trans && trans.type !== "cut" && trans.duration > 0 && t < trans.duration;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    if (inTrans) {
      const prevDur = Math.max(0.3, scenes[i - 1].duration);
      await drawSceneFrame(i - 1, prevDur + t, null);
      const p = Math.min(1, t / trans.duration);
      await drawSceneFrame(i, t, { trans, p });
    } else {
      await drawSceneFrame(i, t, null);
    }

    if (useWebCodecs) {
      const vf = new VideoFrame(canvas, { timestamp: Math.round(n * 1e6 / fps), duration: Math.round(1e6 / fps) });
      encoder.encode(vf, { keyFrame: n % (fps * 2) === 0 });
      vf.close();
      if (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 20));
    } else {
      // リアルタイム録画：実時間ペースで待つ
      await new Promise((r) => setTimeout(r, 1000 / fps));
    }
    onProgress((n + 1) / totalFrames, "映像フレームを生成中", { frame: n + 1, totalFrames });
  }

  if (useWebCodecs) {
    await encoder.flush();
    // 音声合成
    if (renderMp4._audioCodec && !isCancelled()) {
      try {
        onProgress(0.98, "音声を合成中", { frame: totalFrames, totalFrames });
        const mixed = await renderAudioMix({ bgm, scenes, total });
        if (mixed) await encodeAudioToMuxer(muxer, mixed, renderMp4._audioCodec);
      } catch (e) { /* 音声失敗時は映像のみで続行 */ }
    }
    onProgress(1, "ファイルを書き出し中", { frame: totalFrames, totalFrames });
    muxer.finalize();
    return { blob: new Blob([muxer.target.buffer], { type: "video/mp4" }), ext: "mp4" };
  } else {
    await new Promise((r) => setTimeout(r, 300));
    recorder.stop();
    await new Promise((r) => { recorder.onstop = r; });
    const ext = recMime.includes("mp4") ? "mp4" : "webm";
    return { blob: new Blob(recChunks, { type: recMime }), ext };
  }
}

// 全シーンの画像・動画を一括アップロード→手動割当するモーダル
function BulkMediaModal({ scenes, onApply, onClose }) {
  // 割当先の候補（全シーンの画像パーツ）
  const targets = useMemo(() => {
    const list = [];
    scenes.forEach((sc, si) => {
      const parsed = parseSvg(sc.svgText);
      if (parsed.error) return;
      parsed.parts.forEach((p) => {
        if (!p.hasImage) return;
        list.push({ key: `${sc.id}::${p.uid}`, sceneId: sc.id, label: `シーン${si + 1}「${sc.name}」 ／ ${p.name}`, uid: p.uid });
      });
    });
    return list;
  }, [scenes]);
  const [files, setFiles] = useState([]); // {id, file, url, kind, name, targetKey}
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const addFiles = (fl) => {
    const all = Array.from(fl);
    const bad = all.filter((f) => !/^(image|video)\//.test(f.type));
    if (bad.length) window.alert(`画像・動画ではないためスキップしました：\n${bad.map((f) => f.name).join("\n")}`);
    const arr = all.filter((f) => /^(image|video)\//.test(f.type));
    setFiles((prev) => [...prev, ...arr.map((f, i) => ({
      id: `${Date.now()}_${i}`, file: f, url: URL.createObjectURL(f),
      kind: f.type.startsWith("video") ? "video" : "image", name: f.name, targetKey: "",
    }))]);
  };
  const apply = async () => {
    const assigned = files.filter((f) => f.targetKey);
    if (!assigned.length) return;
    setBusy(true);
    try {
      // シーンごとの変更をまとめる
      const bySceneSvg = new Map(); // sceneId -> svgText
      const bySceneVid = new Map(); // sceneId -> videoParts patch
      for (const f of assigned) {
        const [sceneId, uid] = f.targetKey.split("::");
        const sc = scenes.find((s) => s.id === sceneId);
        if (!sc) continue;
        const baseSvg = bySceneSvg.get(sceneId) ?? sc.svgText;
        if (f.kind === "image") {
          const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f.file); });
          const box = getImageBox(baseSvg, uid) || { w: 800, h: 600 };
          const baked = await bakeCoverImage(dataUrl, box);
          bySceneSvg.set(sceneId, replaceImageInPart(baseSvg, uid, baked));
        } else {
          const meta = await new Promise((res) => {
            const v = document.createElement("video");
            v.preload = "metadata"; v.muted = true; v.src = f.url;
            v.onloadedmetadata = () => res({ vw: v.videoWidth, vh: v.videoHeight, duration: v.duration || 5 });
            v.onerror = () => res({ vw: 1920, vh: 1080, duration: 5 });
          });
          const cur = bySceneVid.get(sceneId) || {};
          cur[uid] = { src: f.url, name: f.name, start: 0, end: meta.duration, nx: 0, ny: 0, cscale: 1, speed: 1, vw: meta.vw, vh: meta.vh, duration: meta.duration };
          bySceneVid.set(sceneId, cur);
        }
      }
      onApply(bySceneSvg, bySceneVid, assigned.length);
      onClose();
    } finally { setBusy(false); }
  };
  return (
    <div style={styles.modalBg} onClick={onClose}>
      <div className="vc-modal" style={{ ...styles.modal, width: 620, maxHeight: "84vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.selName}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon name="layers" size={16} />メディア一括割当（全シーン）</span></div>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          style={{ border: "2px dashed #4A4380", borderRadius: 10, padding: "24px 16px", textAlign: "center", color: "#9AA0AE", fontSize: 13, cursor: "pointer", margin: "12px 0", background: "#1A1D26" }}>
          ここに画像・動画ファイルをドラッグ＆ドロップ<br />
          <span style={{ fontSize: 11.5, color: "#5C6373" }}>またはクリックしてファイルを選択（複数OK）</span>
        </div>
        <input ref={inputRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        {files.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {files.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#1D2129", borderRadius: 8, padding: "8px 10px" }}>
                {f.kind === "image"
                  ? <img src={f.url} alt="" style={{ width: 52, height: 36, objectFit: "cover", borderRadius: 5, flexShrink: 0 }} />
                  : <video src={f.url} muted style={{ width: 52, height: 36, objectFit: "cover", borderRadius: 5, flexShrink: 0 }} />}
                <span style={{ fontSize: 11.5, color: "#C9CDD6", width: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name={f.kind === "video" ? "video" : "image"} size={12} />{f.name}</span></span>
                <select style={{ ...styles.select, flex: 1, fontSize: 12 }} value={f.targetKey}
                  onChange={(e) => setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, targetKey: e.target.value } : x)))}>
                  <option value="">— 割当先を選択 —</option>
                  {targets.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <button className="btn" style={{ ...styles.miniBtn, color: "#FF8FA3" }} onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}><Icon name="x" size={13} /></button>
              </div>
            ))}
          </div>
        )}
        {targets.length === 0 && <p style={{ ...styles.hint, color: "#FFB37C" }}>画像パーツを含むシーンがありません。</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn" style={styles.ghostBtn} onClick={onClose}>キャンセル</button>
          <button className="btn" style={{ ...styles.primaryBtn, opacity: files.some((f) => f.targetKey) && !busy ? 1 : 0.45 }} disabled={!files.some((f) => f.targetKey) || busy} onClick={apply}>
            {busy ? "適用中…" : `✔ ${files.filter((f) => f.targetKey).length}件を適用`}
          </button>
        </div>
        <p style={{ ...styles.hint, marginTop: 10 }}>画像は枠に合わせて中央トリミングで焼き込み、動画は各パーツの「尺・位置」からあとで調整できます。適用はCtrl+Zで一括で戻せます。</p>
      </div>
    </div>
  );
}

function Mp4ExportModal({ scenes, frame, bgm, onFrame, onClose }) {
  const [fps, setFps] = useState(30);
  const EXPORT_PRESETS = [
    { label: "Reels / TikTok", sub: "9:16・30fps", ratio: "9:16", fps: 30 },
    { label: "フィード（正方形）", sub: "1:1・30fps", ratio: "1:1", fps: 30 },
    { label: "YouTube / 横型", sub: "16:9・30fps", ratio: "16:9", fps: 30 },
    { label: "元のサイズ", sub: "24fps・軽量", ratio: "original", fps: 24 },
  ];
  const [state, setState] = useState("idle"); // idle | rendering | done | error
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [detail, setDetail] = useState(null); // {frame,totalFrames}
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const cancelRef = useRef(false);
  const startTimeRef = useRef(0);
  const [dims] = useState(() => sceneDims(scenes, frame));
  const total = scenes.reduce((a, s) => a + Math.max(0.3, s.duration), 0);
  const webCodecsOk = typeof VideoEncoder !== "undefined" && typeof window.Mp4Muxer !== "undefined";

  const start = async () => {
    cancelRef.current = false;
    setState("rendering"); setProgress(0); setPhase("準備中"); setDetail(null); setElapsed(0); setError("");
    startTimeRef.current = performance.now();
    const timer = setInterval(() => setElapsed((performance.now() - startTimeRef.current) / 1000), 200);
    try {
      const { blob, ext } = await renderMp4({ scenes, frame, fps, bgm,
        onProgress: (p, ph, d) => { setProgress(p); if (ph) setPhase(ph); if (d) setDetail(d); },
        isCancelled: () => cancelRef.current });
      clearInterval(timer);
      if (cancelRef.current) { setState("idle"); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `svg-motion-video.${ext}`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setState("done");
    } catch (e) {
      clearInterval(timer);
      setError(e.message || String(e));
      setState("error");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000B0", zIndex: 60, display: "grid", placeItems: "center" }}>
      <div className="vc-modal" style={{ background: "#1D2129", border: "1px solid #333A4A", borderRadius: 14, padding: 24, width: 420, maxWidth: "92vw", color: "#EDEEF2" }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>MP4書き出し</div>
        <p style={{ fontSize: 12, color: "#9AA0AE", margin: "0 0 16px", lineHeight: 1.7 }}>
          {dims[0]}×{dims[1]} ・ 全{total.toFixed(1)}秒 ・ 全シーン＋トランジションを1本にエンコードします。
          {(bgm?.src || scenes.some((s) => s.audio?.src)) ? " 🎵 音声トラック付き（BGM/シーン音声を合成）。" : ""}
          {!webCodecsOk && "（この環境では高速エンコードが使えないため、リアルタイム録画方式になります）"}
        </p>
        {state === "idle" || state === "error" ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: "#9AA0AE", marginBottom: 6 }}>用途プリセット（比率とfpsをまとめて設定）</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {EXPORT_PRESETS.map((p) => (
                  <button key={p.label} className="btn"
                    style={{ background: frame.ratio === p.ratio && fps === p.fps ? "#2B2350" : "#14161C", color: "#EDEEF2", border: frame.ratio === p.ratio && fps === p.fps ? "1.5px solid #8B7CFF" : "1px solid #333A4A", borderRadius: 8, padding: "8px 10px", cursor: "pointer", textAlign: "left" }}
                    onClick={() => { setFps(p.fps); onFrame && onFrame((f) => ({ ...f, ratio: p.ratio })); }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>{p.label}</div>
                    <div style={{ fontSize: 10.5, color: "#9AA0AE" }}>{p.sub}</div>
                  </button>
                ))}
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, marginBottom: 16 }}>
              フレームレート
              <select value={fps} onChange={(e) => setFps(+e.target.value)}
                style={{ background: "#14161C", color: "#EDEEF2", border: "1px solid #333A4A", borderRadius: 8, padding: "6px 10px", fontSize: 13 }}>
                <option value={24}>24 fps</option>
                <option value={30}>30 fps</option>
              </select>
            </label>
            {state === "error" && <p style={{ fontSize: 12, color: "#FFB3C0", margin: "0 0 12px" }}>{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={start} style={{ flex: 1, background: "#8B7CFF", color: "#14161C", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>書き出し開始</button>
              <button className="btn" onClick={onClose} style={{ background: "#14161C", color: "#C9CDD6", border: "1px solid #333A4A", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontSize: 13 }}>閉じる</button>
            </div>
          </>
        ) : state === "rendering" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ fontSize: 26, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: "#EDEEF2" }}>{(progress * 100).toFixed(0)}<span style={{ fontSize: 14, color: "#9AA0AE" }}>%</span></span>
              <span style={{ fontSize: 12, color: "#5FD6C4" }}>{phase || "レンダリング中"}…</span>
            </div>
            <div style={{ height: 10, background: "#14161C", borderRadius: 5, overflow: "hidden", marginBottom: 10 }}>
              <div style={{ height: "100%", width: `${(progress * 100).toFixed(1)}%`, background: "linear-gradient(90deg,#8B7CFF,#5FD6C4)", transition: "width .2s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#9AA0AE", fontFamily: "'DM Mono',monospace", marginBottom: 14 }}>
              <span>{detail ? `フレーム ${detail.frame} / ${detail.totalFrames}` : "\u00A0"}</span>
              <span>経過 {elapsed.toFixed(0)}s{progress > 0.02 && progress < 1 ? ` ／ 残り約 ${Math.max(0, elapsed / progress - elapsed).toFixed(0)}s` : ""}</span>
            </div>
            <button className="btn" onClick={() => { cancelRef.current = true; setState("idle"); }} style={{ background: "#14161C", color: "#C9CDD6", border: "1px solid #333A4A", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, width: "100%" }}>キャンセル</button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "#8BE28B", margin: "0 0 14px" }}>✔ 書き出し完了。ダウンロードが始まりました。</p>
            <button className="btn" onClick={onClose} style={{ background: "#8B7CFF", color: "#14161C", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>閉じる</button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- 全再生プレイヤー ----------
function SequencePlayer({ scenes, bgm, frame, onClose }) {
  const [layers, setLayers] = useState([]);
  const [info, setInfo] = useState({ idx: 0, done: false });
  const [token, setToken] = useState(0);
  const [headT, setHeadT] = useState(0);
  const seekFnRef = useRef(null);
  const clockRef = useRef({ base: 0, running: false });
  const starts = useMemo(() => { const st = []; let acc = 0; scenes.forEach((s) => { st.push(acc); acc += Math.max(0.3, s.duration); }); return { st, total: acc }; }, [scenes]);
  const total = starts.total;

  // Escで閉じる
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const timers = [];
    let sceneAudios = [];
    let bgmA = null;
    setLayers([]);
    setInfo({ idx: 0, done: false });
    const clearTimers = () => timers.splice(0).forEach(clearTimeout);
    const stopSceneAudios = () => sceneAudios.splice(0).forEach((a) => { try { a.pause(); } catch (e) {} });
    if (bgm?.src) {
      bgmA = new Audio(bgm.src);
      bgmA.volume = bgm.volume ?? 0.6; bgmA.loop = bgm.loop !== false;
    }
    const scheduleScene = (i, local) => {
      if (cancelled) return;
      if (i >= scenes.length) {
        setInfo((v) => ({ ...v, done: true }));
        clockRef.current.running = false;
        stopSceneAudios();
        if (bgmA) { try { bgmA.pause(); } catch (e) {} }
        return;
      }
      const sc = scenes[i];
      const dur = Math.max(0.3, sc.duration);
      setInfo({ idx: i, done: false });
      const svg = local > 0.02
        ? buildAnimatedSvg(sc.svgText, sc.settings, { forExport: true, frame, videos: sc.videoParts, sceneDuration: dur, overlays: sc.overlays, snapshotT: local, livePlay: true })
        : sc.playSvg;
      const trans = i === 0 || local > 0.02 ? { type: "cut", duration: 0 } : scenes[i - 1].transition;
      const key = `${token}_${i}_${local.toFixed(2)}_${Date.now() % 1e5}`;
      setLayers((ls) => [...ls.slice(-1), { key, svg, trans }]);
      timers.push(setTimeout(() => { if (!cancelled) setLayers((ls) => ls.filter((l) => l.key === key)); }, (trans.duration || 0) * 1000 + 60));
      // シーン音声（途中シークにも対応）
      getSceneAudios(sc).forEach((au) => {
        const a = new Audio(au.src);
        a.volume = au.volume ?? 1;
        a.playbackRate = au.speed || 1;
        try { a.preservesPitch = false; } catch (e) {}
        sceneAudios.push(a);
        const off = au.start || 0;
        const end = au.end > off ? au.end : null;
        const lead = (au.delay || 0) - local; // シーン内再生位置から見た開始まで
        if (lead >= 0) {
          timers.push(setTimeout(() => { if (cancelled) return; try { a.currentTime = off; } catch (e) {} a.play().catch(() => {}); }, lead * 1000));
          if (end) timers.push(setTimeout(() => { try { a.pause(); } catch (e) {} }, (lead + (end - off) / (au.speed || 1)) * 1000));
        } else {
          const pos = off + (-lead) * (au.speed || 1); // 既に再生が進んでいる位置
          if (end === null || pos < end) {
            try { a.currentTime = pos; } catch (e) {}
            a.play().catch(() => {});
            if (end) timers.push(setTimeout(() => { try { a.pause(); } catch (e) {} }, ((end - pos) / (au.speed || 1)) * 1000));
          }
        }
      });
      timers.push(setTimeout(() => scheduleScene(i + 1, 0), (dur - local) * 1000));
    };
    const startFrom = (t0) => {
      clearTimers();
      stopSceneAudios();
      t0 = Math.max(0, Math.min(total - 0.05, t0));
      clockRef.current = { base: performance.now() - t0 * 1000, running: true };
      setHeadT(t0);
      let i = scenes.length - 1;
      for (let k = 0; k < scenes.length; k++) { if (t0 < starts.st[k] + Math.max(0.3, scenes[k].duration)) { i = k; break; } }
      if (bgmA) {
        try { if (bgmA.duration && isFinite(bgmA.duration)) bgmA.currentTime = t0 % bgmA.duration; else bgmA.currentTime = t0; } catch (e) {}
        bgmA.play().catch(() => {});
      }
      scheduleScene(i, t0 - starts.st[i]);
    };
    seekFnRef.current = startFrom;
    startFrom(0);
    return () => { cancelled = true; clearTimers(); stopSceneAudios(); if (bgmA) { try { bgmA.pause(); } catch (e) {} } };
  }, [token, scenes]);

  // 再生ヘッド表示
  useEffect(() => {
    let raf;
    const tick = () => {
      const c = clockRef.current;
      if (c.running) setHeadT(Math.min(total, (performance.now() - c.base) / 1000));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total]);

  const transStyle = (trans) => {
    if (!trans || trans.type === "cut" || !trans.duration) return {};
    const map = {
      fade: "seqFade", slideLeft: "seqSlideL", slideRight: "seqSlideR", slideUp: "seqSlideU", slideDown: "seqSlideD",
      wipe: "seqWipe", zoom: "seqZoom", rotate: "seqRotate", blur: "seqBlur", glitch: "seqGlitch", morph: "seqMorph",
    };
    const easing = trans.type === "glitch" ? "steps(6)" : "ease";
    return { animation: `${map[trans.type] || "seqFade"} ${trans.duration}s ${easing} both` };
  };

  return (
    <div className="vc-overlay" style={{ position: "fixed", inset: 0, background: "#000000E6", zIndex: 50, display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes seqFade{from{opacity:0}to{opacity:1}}
        @keyframes seqSlideL{from{transform:translateX(100%)}to{transform:translateX(0)}}
        @keyframes seqSlideR{from{transform:translateX(-100%)}to{transform:translateX(0)}}
        @keyframes seqSlideU{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes seqSlideD{from{transform:translateY(-100%)}to{transform:translateY(0)}}
        @keyframes seqWipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
        @keyframes seqZoom{from{opacity:0;transform:scale(1.08)}to{opacity:1;transform:scale(1)}}
        @keyframes seqRotate{from{opacity:0;transform:rotate(-6deg) scale(1.1)}to{opacity:1;transform:rotate(0) scale(1)}}
        @keyframes seqBlur{from{opacity:0;filter:blur(20px)}to{opacity:1;filter:blur(0)}}
        @keyframes seqGlitch{0%{opacity:0;transform:translate(-8px,3px);filter:hue-rotate(90deg)}20%{opacity:.7;transform:translate(6px,-2px)}40%{transform:translate(-4px,1px);filter:hue-rotate(-40deg)}60%{opacity:1;transform:translate(3px,0)}80%{transform:translate(-2px,0);filter:none}100%{opacity:1;transform:translate(0,0)}}
        @keyframes seqMorph{from{opacity:0;filter:blur(16px) saturate(1.3);transform:scale(1.05)}60%{opacity:1}to{opacity:1;filter:blur(0) saturate(1);transform:scale(1)}}
        .seqLayer svg{width:100%;height:100%;display:block}
        input.seqSeek{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:3px;background:linear-gradient(90deg,#8B7CFF var(--p),#2A2F40 var(--p));cursor:pointer}
        input.seqSeek::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#FFFFFF;box-shadow:0 1px 6px #0009;cursor:grab}
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px", color: "#EDEEF2" }}>
        <span style={{ fontSize: 13, fontFamily: "'DM Mono',monospace" }}>
          {info.done ? "✔ 再生完了" : `シーン ${info.idx + 1} / ${scenes.length}　${scenes[info.idx]?.name || ""}`}
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11.5, color: "#5C6373" }}>Escで閉じる</span>
          <button className="btn" onClick={() => setToken((t) => t + 1)} style={{ background: "#5FD6C4", color: "#14161C", border: "none", borderRadius: 8, padding: "7px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="play" size={14} />最初から</span></button>
          <button className="btn" onClick={onClose} style={{ background: "#1D2129", color: "#C9CDD6", border: "1px solid #333A4A", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontSize: 13 }}>閉じる</button>
        </div>
      </div>
      <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 16, minHeight: 0 }}>
        <div style={{ position: "relative", height: "100%", aspectRatio: scenes[0]?.aspect || "9/16", maxWidth: "100%", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 16px 60px #000" }}>
          {layers.map((l) => (
            <div key={l.key} ref={(el) => el && hookMedia(el)} className="seqLayer" style={{ position: "absolute", inset: 0, ...transStyle(l.trans) }} dangerouslySetInnerHTML={{ __html: l.svg }} />
          ))}
        </div>
      </div>
      {/* シークバー（再生中もドラッグで移動可能） */}
      <div style={{ padding: "2px 18px 14px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12, color: "#9AA0AE", fontFamily: "'DM Mono',monospace", width: 92, textAlign: "right" }}>{headT.toFixed(1)}s / {total.toFixed(1)}s</span>
        <input type="range" className="seqSeek" min={0} max={total} step={0.05} value={Math.min(headT, total)}
          style={{ flex: 1, "--p": `${(Math.min(headT, total) / total) * 100}%` }}
          onChange={(e) => seekFnRef.current && seekFnRef.current(+e.target.value)} />
        <div style={{ display: "flex", gap: 3, width: 130 }}>
          {scenes.map((s, i) => (
            <div key={i} style={{ flex: s.duration, height: 5, borderRadius: 3, background: i < info.idx || info.done ? "#8B7CFF" : i === info.idx ? "#5FD6C4" : "#2A2F40" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
export default function SvgMotionStudio() {
  const S = styles;
  const [scenes, setScenes] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [inputOpen, setInputOpen] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [seqOpen, setSeqOpen] = useState(false);
  const [mp4Open, setMp4Open] = useState(false);
  const [cropData, setCropData] = useState(null); // {dataUrl, box}
  const [videoEdit, setVideoEdit] = useState(null); // {uid, box, video}
  const [seekT, setSeekT] = useState(null); // タイムラインシーク位置（null=ライブ再生）
  const [liveT, setLiveT] = useState(0);
  const [presetKey, setPresetKey] = useState("shimen");
  const [bgm, setBgm] = useState(null); // {src, name, volume, loop, fadeIn, fadeOut}
  const bgmFileRef = useRef(null);
  const audioFileRef = useRef(null);
  const liveAudioRef = useRef([]); // 再生中のAudio要素
  const [audioOpen, setAudioOpen] = useState(false);
  const ovDragRef = useRef(null);
  const partDragRef = useRef(null);
  const clickGuardRef = useRef(false);
  const [pvModal, setPvModal] = useState(false);
  const scaleAccumRef = useRef(1);
  const scaleTimerRef = useRef(null);
  const [animClip, setAnimClip] = useState(null); // コピーした動き設定
  const [customPresets, setCustomPresets] = useState([]); // [{id,name,anim}]
  const [fileMenu, setFileMenu] = useState(false);
  const [lightMode, setLightMode] = useState(() => { try { return window.localStorage?.getItem("vectimo_theme") === "light"; } catch (e) { return false; } });
  useEffect(() => {
    try { window.localStorage?.setItem("vectimo_theme", lightMode ? "light" : "dark"); } catch (e) {}
    document.documentElement.classList.toggle("vc-light", lightMode);
  }, [lightMode]);
  const [mobileNotice, setMobileNotice] = useState(() => { try { return window.innerWidth < 700; } catch (e) { return false; } });
  const [hintsDone, setHintsDone] = useState(false); // 操作ヒントを閉じたか（プロジェクトに保存）
  const wheelBoundRef = useRef(new WeakSet());
  const [pvZoom, setPvZoom] = useState("fit"); // 'fit' | 0.5 | 1 | 2
  const [tlZoom, setTlZoom] = useState(1); // タイムライン拡大率 1〜6
  const [bulkOpen, setBulkOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const csvRef = useRef(null);
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const projRef = useRef(null);
  const dragSceneRef = useRef(null);
  const [frame, setFrame] = useState({ ratio: "original", fit: "cover", align: "xMidYMid", bg: "#FFFFFF" });
  const fileRef = useRef(null);
  const imgRef = useRef(null);
  const vidRef = useRef(null);

  const setScenesH = useCallback((updater) => {
    setScenes((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (next !== prev) {
        undoRef.current.push(prev);
        if (undoRef.current.length > 50) undoRef.current.shift();
        redoRef.current = [];
      }
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    if (!undoRef.current.length) return;
    setScenes((cur) => { redoRef.current.push(cur); return undoRef.current.pop(); });
  }, []);
  const redo = useCallback(() => {
    if (!redoRef.current.length) return;
    setScenes((cur) => { undoRef.current.push(cur); return redoRef.current.pop(); });
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
      else if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z") || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y")) { e.preventDefault(); redo(); }
      else if ((e.key === "Delete" || e.key === "Backspace")) {
        // 入力欄・テキスト編集中は無視
        const t = e.target;
        const tag = (t.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || t.isContentEditable) return;
        if (selectedRef.current && selectedRef.current.startsWith("p")) { e.preventDefault(); deletePartRef.current(selectedRef.current); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const scene = scenes.find((s) => s.id === activeId) || scenes[0];
  const parsed = useMemo(() => (scene ? parseSvg(scene.svgText) : { error: "シーンがありません" }), [scene?.svgText]);
  const settings = scene?.settings || {};

  useEffect(() => {
    if (!parsed.parts) return;
    const isOv = selected?.startsWith("ov") && (scene?.overlays || [])[+selected.slice(2)];
    const isAu = selected?.startsWith("au") && getSceneAudios(scene)[+selected.slice(2)];
    if (!isOv && !isAu && !parsed.parts.some((p) => p.uid === selected)) setSelected(parsed.parts[0]?.uid ?? null);
  }, [activeId, parsed]);

  const updateScene = useCallback((id, patch) => setScenesH((sc) => sc.map((s) => (s.id === id ? { ...s, ...patch } : s))), []);
  const [newShapeColor, setNewShapeColor] = useState("#8B7CFF");
  const [shapePanelOpen, setShapePanelOpen] = useState(false);
  const [gradMode, setGradMode] = useState(false);
  const [gradC1, setGradC1] = useState("#8B7CFF");
  const [gradC2, setGradC2] = useState("#5FD6C4");
  const [gradAngle, setGradAngle] = useState(45);
  const applyGrad = (uid, c1, c2, ang) => { const id = scene.id; setScenesH((sc) => sc.map((s) => (s.id === id ? { ...s, svgText: setShapeGradient(s.svgText, uid, c1, c2, ang) } : s))); };
  const deletePartRef = useRef(() => {});
  const deletePart = (uid) => {
    if (!scene || !uid || !uid.startsWith("p")) return;
    const idx = +uid.slice(1);
    const newText = removePartFromSvg(scene.svgText, uid);
    if (newText === scene.svgText) return;
    // settings/videoParts を新インデックスで振り直し（削除位置以降を1つ前へ）
    const oldSettings = scene.settings || {};
    const oldVideos = scene.videoParts || {};
    const ns = {}, nv = {};
    Object.keys(oldSettings).forEach((k) => {
      if (!k.startsWith("p")) { ns[k] = oldSettings[k]; return; }
      const i = +k.slice(1);
      if (i === idx) return; // 削除対象
      const ni = i > idx ? i - 1 : i;
      ns[`p${ni}`] = oldSettings[k];
    });
    Object.keys(oldVideos).forEach((k) => {
      const i = +k.slice(1);
      if (i === idx) return;
      nv[`p${i > idx ? i - 1 : i}`] = oldVideos[k];
    });
    setScenesH((sc) => sc.map((s) => (s.id === scene.id ? { ...s, svgText: newText, settings: ns, videoParts: nv } : s)));
    setSelected(null);
    showToast("パーツを削除しました（Ctrl+Zで戻せます）");
  };
  deletePartRef.current = deletePart;

  // --- タブ/ウィンドウを閉じる前の確認（作業中のみ） ---
  useEffect(() => {
    if (!scenes.length) return;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [scenes.length > 0]);

  // --- 自動保存（ブラウザ内に作業を保持。閉じても復元できる） ---
  const AUTOSAVE_KEY = "vectimo_autosave_v1";
  const [hasAutosave, setHasAutosave] = useState(false);
  useEffect(() => {
    try { setHasAutosave(!!window.localStorage?.getItem(AUTOSAVE_KEY)); } catch (e) {}
  }, []);
  useEffect(() => {
    if (!scenes.length) return;
    const t = setTimeout(() => {
      try {
        const data = {
          version: 3, frame, customPresets, hintsDone, savedAt: Date.now(),
          bgm: bgm && bgm.src?.startsWith("data:") ? bgm : null,
          scenes: scenes.map((s) => ({ name: s.name, svgText: s.svgText, settings: s.settings, duration: s.duration, transition: s.transition, overlays: s.overlays || [], isImage: !!s.isImage,
            audios: (getSceneAudios(s) || []).filter((a) => a.src?.startsWith("data:")),
            videoParts: Object.fromEntries(Object.entries(s.videoParts || {}).filter(([, v]) => v.src?.startsWith("data:"))) })),
        };
        const json = JSON.stringify(data);
        if (json.length < 4_500_000) { window.localStorage?.setItem(AUTOSAVE_KEY, json); setHasAutosave(true); }
      } catch (e) { /* 容量超過などは黙ってスキップ */ }
    }, 1500);
    return () => clearTimeout(t);
  }, [scenes, frame, customPresets, hintsDone, bgm]);
  const restoreAutosave = () => {
    try {
      const raw = window.localStorage?.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const loaded = data.scenes.map((s) => ({ id: newSceneId(), videoParts: s.videoParts || {}, audios: s.audios || [], ...s }));
      setScenesH(loaded);
      if (data.frame) setFrame(data.frame);
      if (Array.isArray(data.customPresets)) setCustomPresets(data.customPresets);
      if (typeof data.hintsDone === "boolean") setHintsDone(data.hintsDone);
      if (data.bgm) setBgm(data.bgm);
      setActiveId(loaded[0].id);
      const when = data.savedAt ? new Date(data.savedAt).toLocaleString("ja-JP") : "";
      showToast(`✔ 前回の作業を復元しました${when ? `（${when} 保存）` : ""}`);
    } catch (e) { showToast("復元に失敗しました"); }
  };

  const loadTemplate = (tpl) => {
    const data = tpl.make();
    const loaded = data.scenes.map((s) => ({ id: newSceneId(), overlays: [], videoParts: {}, audios: [], ...s }));
    setScenesH(loaded);
    if (data.frame) setFrame(data.frame);
    setActiveId(loaded[0].id);
    setSelected(null);
    showToast(`✔ テンプレート「${tpl.name}」を読み込みました。文字や写真を差し替えて使ってください`);
  };

  const addShape = (shape) => {
    if (!scene) { showToast("先に素材を追加してください"); return; }
    const newText = addShapeToSvg(scene.svgText, shape, newShapeColor);
    const parsedNew = parseSvg(newText);
    const newUid = `p${parsedNew.children.length - 1}`; // 末尾に追加された図形
    const ns = { ...scene.settings, [newUid]: { ...defaultSetting(), type: shape === "text" ? "fadeIn" : "pop", duration: shape === "text" ? 0.8 : 0.6, delay: 0 } };
    setScenesH((sc) => sc.map((s) => (s.id === scene.id ? { ...s, svgText: newText, settings: ns } : s)));
    setSelected(newUid);
    showToast("図形を追加しました（プレビューでドラッグ移動・サイズ変更できます）");
  };
  const update = useCallback((uid, patch) => {
    updateScene(scene.id, { settings: { ...scene.settings, [uid]: { ...scene.settings[uid], ...patch } } });
  }, [scene, updateScene]);

  // 動き設定のうち「アニメの性質」だけを抜き出す（位置やクリップ等は除く）
  const ANIM_KEYS = ["type", "duration", "delay", "easing", "distance", "scaleTo", "loop", "exit", "img", "opacity"];
  const pickAnim = (s) => { const o = {}; ANIM_KEYS.forEach((k) => { if (s && s[k] !== undefined) o[k] = JSON.parse(JSON.stringify(s[k])); }); return o; };
  // コピーした/プリセットの動きを対象パーツへ適用
  const applyAnimTo = (uid, anim) => {
    updateScene(scene.id, { settings: { ...scene.settings, [uid]: { ...scene.settings[uid], ...pickAnim(anim) } } });
    setSelected(uid);
  };
  const copyAnim = (uid) => { setAnimClip(pickAnim(scene.settings[uid])); showToast("📋 この動きをコピーしました。別パーツで右クリック→貼り付け"); };
  const saveCustomPreset = (uid) => {
    const name = window.prompt("カスタムプリセットの名前を入力", `マイ動き ${customPresets.length + 1}`);
    if (!name) return;
    setCustomPresets((p) => [...p, { id: `cp${Date.now()}`, name, anim: pickAnim(scene.settings[uid]) }]);
    showToast(`⭐ 「${name}」を保存しました（右クリックメニューやプリセット欄から使えます）`);
  };

  const sceneAnimEnd = animEnd(settings);
  const previewSvg = useMemo(
    () => (scene ? buildAnimatedSvg(scene.svgText, settings, { staticMode: !playing && seekT === null, frame, videos: scene.videoParts, sceneDuration: scene.duration, snapshotT: seekT, highlightUid: selected?.startsWith("p") ? selected : null, overlays: scene.overlays }) : ""),
    [scene?.svgText, settings, playing, playKey, frame, scene?.videoParts, scene?.duration, seekT, selected, scene?.overlays]
  );

  // wheelリスナー内から最新のselected/sceneを参照するためのref
  const liveRef = useRef({});
  liveRef.current = { selected, sceneId: scene?.id };
  const selectedRef = useRef(null);
  selectedRef.current = selected;

  const attachWheelZoom = (el) => {
    if (wheelBoundRef.current.has(el)) return;
    wheelBoundRef.current.add(el);
    el.addEventListener("wheel", (e) => {
      const { selected: sel, sceneId } = liveRef.current;
      if (!e.ctrlKey || !sel || !sel.startsWith("p")) return;
      e.preventDefault(); // 非passiveなので有効
      const factor = e.deltaY < 0 ? 1.06 : 1 / 1.06;
      const node = el.querySelector(`[data-part="${sel}"]`);
      if (node && node.getBBox) {
        const nr = node.getBBox();
        const cx = nr.x + nr.width / 2, cy = nr.y + nr.height / 2;
        const prev = node.getAttribute("transform") || "";
        node.setAttribute("transform", `translate(${cx} ${cy}) scale(${factor}) translate(${-cx} ${-cy}) ${prev}`);
      }
      scaleAccumRef.current *= factor;
      clearTimeout(scaleTimerRef.current);
      scaleTimerRef.current = setTimeout(() => {
        const f = scaleAccumRef.current;
        scaleAccumRef.current = 1;
        setScenesH((sc) => sc.map((s) => (s.id === sceneId ? { ...s, svgText: scalePartAt(s.svgText, sel, f) } : s)));
      }, 200);
    }, { passive: false });
  };

  const stopLiveAudio = () => { liveAudioRef.current.forEach((a) => { try { a.pause(); } catch (e) {} }); liveAudioRef.current = []; };

  const playSceneAudio = (sc) => {
    getSceneAudios(sc).forEach((au) => {
      const a = new Audio(au.src);
      a.volume = au.volume ?? 1;
      a.playbackRate = au.speed || 1;
      try { a.preservesPitch = false; } catch (e) {}
      liveAudioRef.current.push(a);
      setTimeout(() => {
        if ((au.start || 0) > 0) { try { a.currentTime = au.start; } catch (e) {} }
        a.play().catch(() => {});
      }, (au.delay || 0) * 1000);
      const off = au.start || 0;
      if (au.end > off) setTimeout(() => { try { a.pause(); } catch (e) {} }, ((au.delay || 0) + (au.end - off) / (au.speed || 1)) * 1000);
    });
  };

  // シーンへ音声ファイルを追加（複数可・非音声はアラート）
  const addSceneAudios = (files) => {
    if (!scene) return;
    const all = Array.from(files || []);
    const bad = all.filter((f) => !f.type.startsWith("audio/"));
    if (bad.length) window.alert(`音声ファイルではないためスキップしました：\n${bad.map((f) => f.name).join("\n")}`);
    const good = all.filter((f) => f.type.startsWith("audio/"));
    if (!good.length) return;
    const prevLen = getSceneAudios(scene).length;
    Promise.all(good.map((f) => new Promise((res) => {
      const url = URL.createObjectURL(f);
      const a = new Audio(); a.preload = "metadata"; a.src = url;
      const fin = (d) => res({ id: `au${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, src: url, name: f.name, volume: 1, delay: 0, speed: 1, start: 0, end: +(d || 0).toFixed(2), duration: +(d || 0).toFixed(2) });
      a.onloadedmetadata = () => fin(a.duration);
      a.onerror = () => fin(0);
    }))).then((items) => {
      const sceneId = scene.id;
      setScenesH((sc) => sc.map((s) => (s.id === sceneId ? { ...s, audios: [...getSceneAudios(s), ...items], audio: null } : s)));
      setSelected(`au${prevLen}`);
      showToast(`🎙 音声を${items.length}件追加しました（左の一覧から選んで調整できます）`);
    });
  };

  // プレビュー本体（通常位置と拡大モーダルで共用）
  const previewBoxEl = scene && !parsed.error ? (
      <div key={`${activeId}_${playKey}`} ref={(el) => { if (el) { hookMedia(el); attachWheelZoom(el); } }}
        className={`previewBox ${pvZoom === "fit" ? "pv-fit" : "pv-zoom"}`}
        style={{ ...S.previewInner, cursor: "pointer", "--pvw": pvZoom === "fit" ? undefined : `${Math.round(560 * pvZoom)}px`, maxHeight: pvZoom === "fit" ? "100%" : "none", margin: pvZoom === "fit" ? undefined : "auto" }}
        onPointerDown={(e) => {
          let node = e.target;
          while (node && node !== e.currentTarget) {
            if (node.getAttribute && node.hasAttribute?.("data-ov")) {
              const oi = +node.getAttribute("data-ov");
              const svgEl = e.currentTarget.querySelector("svg");
              const vb = (svgEl.getAttribute("viewBox") || "0 0 100 100").split(/[\s,]+/).map(Number);
              const rect = svgEl.getBoundingClientRect();
              const o = (scene.overlays || [])[oi];
              if (!o) return;
              ovDragRef.current = { node, oi, sx: e.clientX, sy: e.clientY, ox: o.x, oy: o.y, vb, rect, moved: false, nx: o.x, ny: o.y };
              setSelected(`ov${oi}`);
              e.currentTarget.setPointerCapture(e.pointerId);
              e.preventDefault();
              return;
            }
            node = node.parentNode;
          }
          // パーツ（イラスト・写真等）のドラッグ移動
          node = e.target;
          while (node && node !== e.currentTarget) {
            const dp = node.getAttribute?.("data-part");
            if (dp) {
              const svgOwner = node.ownerSVGElement || e.currentTarget.querySelector("svg");
              const ctm = svgOwner?.getScreenCTM?.();
              if (!ctm) return;
              const nr = node.getBoundingClientRect();
              const br = svgOwner.getBoundingClientRect();
              partDragRef.current = {
                uid: dp, sx: e.clientX, sy: e.clientY, a: ctm.a || 1, d: ctm.d || 1, moved: false, dxU: 0, dyU: 0,
                c0x: nr.left + nr.width / 2, c0y: nr.top + nr.height / 2, box: br,
                wrapEl: e.currentTarget.parentElement,
              };
              setSelected(dp); // ポインタキャプチャでclickが飛ばないため、選択はここで行う
              e.currentTarget.setPointerCapture(e.pointerId);
              return;
            }
            node = node.parentNode;
          }
        }}
        onPointerMove={(e) => {
          const pd = partDragRef.current;
          if (pd) {
            let dx = e.clientX - pd.sx, dy = e.clientY - pd.sy;
            if (!pd.moved && Math.hypot(dx, dy) < 4) return; // 誤操作防止のしきい値
            pd.moved = true;
            // 中心スナップ：パーツ中心が画面中心線に近づいたら吸着してガイドを表示
            const boxCx = pd.box.left + pd.box.width / 2;
            const boxCy = pd.box.top + pd.box.height / 2;
            const SNAP = 7;
            const nearV = Math.abs(pd.c0x + dx - boxCx) < SNAP;
            const nearH = Math.abs(pd.c0y + dy - boxCy) < SNAP;
            if (nearV) dx = boxCx - pd.c0x;
            if (nearH) dy = boxCy - pd.c0y;
            const wrap = pd.wrapEl;
            if (wrap) {
              const wr = wrap.getBoundingClientRect();
              const vg = wrap.querySelector(".pv-vguide"), hg = wrap.querySelector(".pv-hguide");
              if (vg) Object.assign(vg.style, nearV
                ? { display: "block", left: `${boxCx - wr.left}px`, top: `${pd.box.top - wr.top}px`, height: `${pd.box.height}px` }
                : { display: "none" });
              if (hg) Object.assign(hg.style, nearH
                ? { display: "block", top: `${boxCy - wr.top}px`, left: `${pd.box.left - wr.left}px`, width: `${pd.box.width}px` }
                : { display: "none" });
            }
            pd.dxU = dx / pd.a;
            pd.dyU = dy / pd.d;
            const node = e.currentTarget.querySelector(`[data-part="${pd.uid}"]`);
            if (node) {
              if (pd.orig === undefined) pd.orig = node.getAttribute("transform") || "";
              node.setAttribute("transform", `translate(${pd.dxU} ${pd.dyU})${pd.orig ? " " + pd.orig : ""}`);
            }
            return;
          }
          const d = ovDragRef.current;
          if (!d) return;
          d.moved = true;
          d.nx = Math.min(100, Math.max(0, d.ox + ((e.clientX - d.sx) / d.rect.width) * 100));
          d.ny = Math.min(100, Math.max(0, d.oy + ((e.clientY - d.sy) / d.rect.height) * 100));
          const vx = d.vb[0] + d.vb[2] * (d.nx / 100);
          const vy = d.vb[1] + d.vb[3] * (d.ny / 100);
          // 再レンダリングでDOMが差し替わるため、対象要素は毎回取り直す
          const node = e.currentTarget.querySelector(`[data-ov="${d.oi}"]`);
          if (node) node.setAttribute("transform", `translate(${vx},${vy})`);
        }}
        onPointerUp={() => {
          document.querySelectorAll(".pv-vguide,.pv-hguide").forEach((g) => { g.style.display = "none"; });
          const pd = partDragRef.current;
          if (pd) {
            partDragRef.current = null;
            if (pd.moved) {
              clickGuardRef.current = true; // 直後のクリック選択を抑止
              const sceneId = scene.id, uid = pd.uid, dx = pd.dxU, dy = pd.dyU;
              setScenesH((sc) => sc.map((s) => (s.id === sceneId ? { ...s, svgText: movePartPosition(s.svgText, uid, dx, dy) } : s)));
            }
            return;
          }
          const d = ovDragRef.current;
          ovDragRef.current = null;
          if (d && d.moved) {
            const sceneId = scene.id, oi = d.oi, nx = +d.nx.toFixed(1), ny = +d.ny.toFixed(1);
            setScenesH((sc) => sc.map((s) => (s.id === sceneId ? { ...s, overlays: (s.overlays || []).map((o, i) => (i === oi ? { ...o, x: nx, y: ny } : o)) } : s)));
          }
        }}
        onClick={(e) => {
          if (clickGuardRef.current) { clickGuardRef.current = false; return; } // ドラッグ直後は選択しない
          let node = e.target;
          while (node && node !== e.currentTarget) {
            if (node.hasAttribute?.("data-ov")) return; // テロップはpointerdownで選択済み
            const dp = node.getAttribute?.("data-part");
            if (dp) { setSelected(dp); return; }
            node = node.parentNode;
          }
        }}
        dangerouslySetInnerHTML={{ __html: previewSvg }} />
  ) : null;



  const replay = () => {
    setSeekT(null); setPlaying(true); setPlayKey((k) => k + 1);
    stopLiveAudio();
    playSceneAudio(scene);
  };
  useEffect(() => () => stopLiveAudio(), []);
  useEffect(() => {
    if (!pvModal) return;
    const onKey = (e) => { if (e.key === "Escape") setPvModal(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pvModal]);

  // 再生ヘッド：再生中の現在位置を追従
  useEffect(() => {
    if (!playing || seekT !== null || !scene) return;
    const cap = Math.max(animEnd(settings), scene.duration || 0, 0.5);
    const t0 = performance.now();
    let raf;
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      setLiveT(Math.min(t, cap));
      if (t < cap) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, playKey, seekT, activeId]);

  // ---------- シーン操作 ----------
  const addScenesFromFiles = (files) => {
    const isSvg = (f) => f.name.toLowerCase().endsWith(".svg") || f.type === "image/svg+xml";
    const isImg = (f) => /^image\/(png|jpeg|jpg|webp|gif)$/.test(f.type) || /\.(png|jpe?g|webp|gif)$/i.test(f.name);
    const list = Array.from(files).filter((f) => isSvg(f) || isImg(f));
    const bad = Array.from(files).filter((f) => !isSvg(f) && !isImg(f));
    if (bad.length) window.alert(`対応していないファイルをスキップしました：\n${bad.map((f) => f.name).join("\n")}\n（SVG・PNG・JPG・WebPに対応）`);
    if (!list.length) return;
    list.sort((a, b) => a.name.localeCompare(b.name, "ja", { numeric: true }));
    Promise.all(list.map((f) => new Promise((res) => {
      if (isSvg(f)) {
        const r = new FileReader();
        r.onload = () => res({ name: f.name.replace(/\.svg$/i, ""), text: String(r.result), kind: "svg" });
        r.onerror = () => res(null);
        r.readAsText(f);
      } else {
        readImageFile(f).then(({ dataUrl, w, h }) => res({ name: f.name.replace(/\.[^.]+$/, ""), text: imageToSceneSvg(dataUrl, w, h), kind: "image" }))
          .catch(() => res(null));
      }
    }))).then((results) => {
      const added = results.filter(Boolean).map((r) => {
        const settings = initSettings(r.text);
        // 画像シーンは、写真1枚にゆっくりズーム(Ken Burns)を初期適用してそれらしく
        if (r.kind === "image" && settings.p0) {
          settings.p0 = { ...settings.p0, type: "fadeIn", duration: 0.8, delay: 0, img: { ...defaultImgSetting(), type: "kenburns", duration: 6, scaleTo: 1.12, distance: 60 } };
        }
        return {
          id: newSceneId(), name: r.name, svgText: r.text, settings,
          duration: r.kind === "image" ? 4 : Math.max(3, +(animEnd(settings) + 1.5).toFixed(1)),
          transition: { type: "fade", duration: 0.6 },
          isImage: r.kind === "image",
        };
      });
      setScenesH((sc) => [...sc, ...added]);
      if (added[0]) setActiveId(added[0].id);
    });
  };

  const moveScene = (id, dir) => setScenesH((sc) => {
    const i = sc.findIndex((s) => s.id === id);
    const j = i + dir;
    if (j < 0 || j >= sc.length) return sc;
    const next = [...sc];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const removeScene = (id) => setScenesH((sc) => {
    const next = sc.filter((s) => s.id !== id);
    if (id === activeId && next[0]) setActiveId(next[0].id);
    return next;
  });
  const duplicateScene = (id) => setScenesH((sc) => {
    const i = sc.findIndex((s) => s.id === id);
    const copy = { ...sc[i], id: newSceneId(), name: sc[i].name + " コピー", settings: JSON.parse(JSON.stringify(sc[i].settings)) };
    return [...sc.slice(0, i + 1), copy, ...sc.slice(i + 1)];
  });

  // ---------- 書き出し ----------
  const download = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };
  const buildPlayScenes = () => scenes.map((s) => {
    const p = parseSvg(s.svgText);
    const vb = p.root ? (p.root.getAttribute("viewBox") || "0 0 16 9").split(/[\s,]+/).map(Number) : [0, 0, 16, 9];
    const fd = FRAMES[frame.ratio]?.dims;
    return { ...s, playSvg: buildAnimatedSvg(s.svgText, s.settings, { forExport: true, frame, videos: s.videoParts, sceneDuration: s.duration, overlays: s.overlays }), aspect: fd ? `${fd[0]}/${fd[1]}` : `${vb[2]}/${vb[3]}` };
  });
  const exportSvg = () => download(buildAnimatedSvg(scene.svgText, settings, { forExport: true, frame, sceneDuration: scene.duration, overlays: scene.overlays }), `${scene.name || "animated"}.svg`, "image/svg+xml");

  const onImgReplace = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const box = getImageBox(scene.svgText, selected) || { w: 800, h: 600 };
      setCropData({ dataUrl: String(r.result), box });
    };
    r.readAsDataURL(f);
    e.target.value = "";
  };

  const applyCrop = (bakedDataUrl) => {
    const vp = { ...(scene.videoParts || {}) };
    delete vp[selected]; // 画像に戻したら動画は解除
    updateScene(scene.id, { svgText: replaceImageInPart(scene.svgText, selected, bakedDataUrl), videoParts: vp });
    setCropData(null);
  };

  const onVideoReplace = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const src = URL.createObjectURL(f);
    const box = getImageBox(scene.svgText, selected) || { w: 800, h: 600 };
    setVideoEdit({ uid: selected, box, video: { src, name: f.name, start: 0, end: 0, nx: 0, ny: 0, cscale: 1 } });
    e.target.value = "";
  };

  const openVideoEdit = () => {
    const v = scene.videoParts?.[selected];
    if (!v) return;
    const box = getImageBox(scene.svgText, selected) || { w: 800, h: 600 };
    setVideoEdit({ uid: selected, box, video: v });
  };

  const applyVideoEdit = (cfg) => {
    updateScene(scene.id, { videoParts: { ...(scene.videoParts || {}), [videoEdit.uid]: cfg } });
    setVideoEdit(null);
  };

  const moveLayer = (dir) => {
    const { svgText, swapped } = movePartLayer(scene.svgText, selected, dir);
    if (!swapped) return;
    const [i, j] = swapped;
    const s = { ...scene.settings };
    [s[`p${i}`], s[`p${j}`]] = [s[`p${j}`], s[`p${i}`]];
    const vp = { ...(scene.videoParts || {}) };
    [vp[`p${i}`], vp[`p${j}`]] = [vp[`p${j}`], vp[`p${i}`]];
    Object.keys(vp).forEach((k) => { if (!vp[k]) delete vp[k]; });
    updateScene(scene.id, { svgText, settings: s, videoParts: vp });
    setSelected(`p${j}`);
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 5000); };

  // 入稿テンプレCSV：現在のプロジェクト構成からテキスト項目を抽出
  const exportCsvTemplate = () => {
    const header = ["シーン番号", "シーン名", "パーツID", "パーツ名", "行", "現在のテキスト", "新しいテキスト"];
    const rows = [header];
    scenes.forEach((sc, si) => {
      const parsed = parseSvg(sc.svgText);
      if (parsed.error) return;
      parsed.parts.forEach((p) => {
        if (!p.hasText) return;
        getPartTextUnits(sc.svgText, p.uid).forEach((u, ui) => {
          rows.push([si + 1, sc.name, p.uid, p.name, ui + 1, u, ""]);
        });
      });
    });
    if (rows.length === 1) { showToast("テキストパーツが見つかりません"); return; }
    const csv = "\uFEFF" + rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
    download(csv, `入稿テンプレ-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8");
    showToast(`📋 テンプレを書き出しました（${rows.length - 1}項目）。「新しいテキスト」列に記入してアップしてください。`);
  };

  // 入稿CSV取り込み：新しいテキスト列が記入された行だけ反映
  const importCsv = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const text = await readCsvFile(f);
      const allRows = parseCsvText(text);
      // ヘッダー行を先頭5行から検索（前置きコメント行にも耐性）
      const norm = (v) => String(v || "").replace(/\s|"/g, "").trim();
      let hi = -1;
      for (let i = 0; i < Math.min(5, allRows.length); i++) {
        if (allRows[i].some((c) => norm(c) === "新しいテキスト")) { hi = i; break; }
      }
      if (hi < 0) { showToast("⚠ ヘッダー行（「新しいテキスト」列）が見つかりません。テンプレの列構成のまま保存してください。文字化けする場合はExcelで「CSV UTF-8」形式で保存してください。"); return; }
      const header = allRows[hi];
      const col = (name) => header.findIndex((h) => norm(h) === name);
      const ci = { scene: col("シーン番号"), uid: col("パーツID"), line: col("行"), cur: col("現在のテキスト"), val: col("新しいテキスト") };
      if (ci.scene < 0 || ci.uid < 0 || ci.line < 0) { showToast("⚠ 「シーン番号」「パーツID」「行」の列が見つかりません。テンプレの列を削除・改名せずに保存してください。"); return; }
      const rows = allRows.slice(hi + 1);
      // 全角数字→半角
      const toNum = (v) => parseInt(String(v || "").replace(/[０-９]/g, (d) => "０１２３４５６７８９".indexOf(d)).trim(), 10);
      const updates = new Map();
      let applied = 0, mismatch = 0, filled = 0, outOfRange = 0;
      rows.forEach((row) => {
        const val = (row[ci.val] ?? "").trim();
        if (!val) return;
        filled++;
        const si = toNum(row[ci.scene]) - 1;
        const uid = norm(row[ci.uid]);
        const ui = toNum(row[ci.line]) - 1;
        if (!(si >= 0 && si < scenes.length) || !/^p\d+$/.test(uid) || !(ui >= 0)) { outOfRange++; return; }
        const base = updates.has(si) ? updates.get(si) : scenes[si].svgText;
        const current = getPartTextUnits(base, uid)[ui];
        if (current === undefined) { outOfRange++; return; }
        if (ci.cur >= 0 && row[ci.cur] !== undefined && row[ci.cur] !== "" && row[ci.cur] !== current) mismatch++;
        updates.set(si, setPartTextUnit(base, uid, ui, val));
        applied++;
      });
      if (!filled) { showToast(`⚠ ${rows.length}行を確認しましたが「新しいテキスト」列がすべて空でした。記入したファイルを保存し直して、そのファイルをアップしてください。`); return; }
      if (!applied) { showToast(`⚠ 記入${filled}行が見つかりましたが、シーン番号・パーツIDが現在のプロジェクトと一致しません（${outOfRange}行）。テンプレ書き出し後にシーンを並べ替え・削除していないか確認してください。`); return; }
      setScenesH((sc) => sc.map((s, i) => (updates.has(i) ? { ...s, svgText: updates.get(i) } : s)));
      showToast(`✔ ${applied}項目を反映しました${outOfRange ? `／${outOfRange}行は対象不一致でスキップ` : ""}${mismatch ? `／${mismatch}項目は元テキスト不一致の可能性` : ""}`);
    } catch (err) {
      showToast("⚠ CSVを読み込めませんでした：" + (err.message || err));
    }
  };

  const saveProject = async (embedMedia = false) => {
    let bgmOut = bgm;
    let scenesOut = scenes.map((s) => ({ name: s.name, svgText: s.svgText, settings: s.settings, duration: s.duration, transition: s.transition, overlays: s.overlays || [], isImage: !!s.isImage, audios: getSceneAudios(s), videoParts: s.videoParts || {} }));
    if (embedMedia) {
      showToast("素材を埋め込んで保存を準備中…");
      // BGM
      if (bgm?.src) bgmOut = { ...bgm, src: await urlToDataUrl(bgm.src) };
      // 各シーンの音声・動画src
      scenesOut = await Promise.all(scenesOut.map(async (s) => {
        const audios = await Promise.all((s.audios || []).map(async (a) => ({ ...a, src: await urlToDataUrl(a.src) })));
        const vp = {};
        for (const [uid, v] of Object.entries(s.videoParts || {})) vp[uid] = { ...v, src: await urlToDataUrl(v.src) };
        return { ...s, audios, videoParts: vp };
      }));
    }
    const data = {
      version: 3,
      frame,
      customPresets, hintsDone,
      bgm: embedMedia ? bgmOut : (bgm ? { ...bgm, src: bgm.src?.startsWith("data:") ? bgm.src : "" } : null),
      embedded: embedMedia,
      scenes: scenesOut.map((s) => embedMedia ? s : ({ ...s, audios: (s.audios || []).map((a) => ({ ...a, src: a.src?.startsWith("data:") ? a.src : "" })), videoParts: Object.fromEntries(Object.entries(s.videoParts || {}).map(([k, v]) => [k, { ...v, src: v.src?.startsWith("data:") ? v.src : "" }])) })),
    };
    download(JSON.stringify(data), `vectimo-project-${new Date().toISOString().slice(0, 10)}${embedMedia ? "-full" : ""}.json`, "application/json");
    if (embedMedia) showToast("✔ 素材を埋め込んで保存しました（1ファイルで復元できます）");
  };

  const loadProject = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(String(r.result));
        if (!data.scenes?.length) throw new Error("no scenes");
        const loaded = data.scenes.map((s) => {
          // 埋め込み音声・動画（dataURL）のみ復元。空srcのものは除外/無効化。
          const audios = (s.audios || []).filter((a) => a.src && a.src.startsWith("data:"));
          const videoParts = Object.fromEntries(Object.entries(s.videoParts || {}).filter(([, v]) => v.src && v.src.startsWith("data:")));
          return { id: newSceneId(), name: s.name, svgText: s.svgText, settings: s.settings || initSettings(s.svgText), duration: s.duration || 3, transition: s.transition || { type: "fade", duration: 0.6 }, overlays: s.overlays || [], isImage: !!s.isImage, audios, videoParts };
        });
        if (Array.isArray(data.customPresets)) setCustomPresets(data.customPresets);
        if (typeof data.hintsDone === "boolean") setHintsDone(data.hintsDone);
        setScenesH(loaded);
        if (data.frame) setFrame(data.frame);
        if (data.bgm && data.bgm.src && data.bgm.src.startsWith("data:")) setBgm(data.bgm);
        setActiveId(loaded[0].id);
        // 素材が抜けている場合の注意（軽量保存を読んだ場合）
        const missing = !data.embedded && (data.scenes.some((s) => (s.audios || []).some((a) => !a.src || !a.src.startsWith("data:")) || Object.values(s.videoParts || {}).some((v) => !v.src || !v.src.startsWith("data:"))) || (data.bgm && data.bgm.name));
        if (missing) showToast("読み込みました。音声・動画は軽量保存では引き継がれないため、必要なら再設定してください（素材込み保存なら1ファイルで復元できます）");
      } catch (err) {
        alert("プロジェクトファイルを読み込めませんでした。");
      }
    };
    r.readAsText(f);
    e.target.value = "";
  };

  const applyPreset = (all) => {
    setScenesH((sc) => sc.map((s) => (all || s.id === scene.id ? applyPresetToScene(s, presetKey) : s)));
  };

  const totalVideo = scenes.reduce((a, s) => a + Math.max(0.3, s.duration), 0);
  const sel = selected && settings[selected] ? settings[selected] : null;
  const selPart = parsed.parts?.find((p) => p.uid === selected);
  const tlMax = Math.max(sceneAnimEnd, scene?.duration || 0, 0.5);
  const sceneStart = useMemo(() => {
    const idx = scenes.findIndex((s) => s.id === activeId);
    return scenes.slice(0, Math.max(0, idx)).reduce((a, s) => a + Math.max(0.3, s.duration), 0);
  }, [scenes, activeId]);
  const headT = seekT !== null ? seekT : liveT;

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Noto+Sans+JP:wght@700&family=Noto+Serif+JP:wght@700&family=M+PLUS+Rounded+1c:wght@700&family=Klee+One:wght@600&display=swap');
        *{box-sizing:border-box} ::selection{background:#8B7CFF55}
        input,select,button,textarea{font-family:inherit}
        input[type=range]{accent-color:#8B7CFF}
        /* --- マイクロインタラクション：滑らかな状態遷移 --- */
        .btn{transition:filter .15s ease, background-color .15s ease, border-color .15s ease, transform .1s ease, box-shadow .15s ease}
        .btn:hover{filter:brightness(1.15)}
        .btn:active{transform:translateY(1px) scale(0.98)}
        .partRow{transition:background-color .15s ease, border-color .15s ease}
        .partRow:hover{background:#262B38 !important}
        .btn:focus-visible,select:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #8B7CFF;outline-offset:2px}
        select,input,textarea{transition:border-color .15s ease, box-shadow .15s ease}
        select:hover,input:hover,textarea:hover{border-color:#4A5266}
        input:focus,select:focus,textarea:focus{border-color:#8B7CFF;box-shadow:0 0 0 3px #8B7CFF22}
        .sceneCard{transition:border-color .18s ease, transform .18s ease, box-shadow .18s ease}
        .sceneCard:hover{border-color:#8B7CFF88 !important;transform:translateY(-2px);box-shadow:0 6px 20px #0006}
        .sceneCard svg{width:100%;height:auto;display:block}
        .ctxItem{display:block;width:100%;text-align:left;background:none;border:none;color:#EDEEF2;font-size:13px;padding:7px 10px;border-radius:6px;cursor:pointer;font-family:inherit;transition:background-color .12s ease}
        .ctxItem:hover:not(:disabled){background:#2A2F40}
        .ctxItem:disabled{cursor:default}
        /* トースト・メニュー・モーダルの出入り */
        @keyframes vcToastIn{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
        @keyframes vcMenuIn{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes vcFadeIn{from{opacity:0}to{opacity:1}}
        @keyframes vcModalIn{from{opacity:0;transform:scale(.97) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .vc-toast{animation:vcToastIn .28s cubic-bezier(.2,.9,.3,1.2) both}
        .vc-menu{animation:vcMenuIn .16s ease both;transform-origin:top}
        .vc-overlay{animation:vcFadeIn .18s ease both}
        .vc-modal{animation:vcModalIn .24s cubic-bezier(.2,.8,.3,1) both}
        /* 選択パーツのハイライトを呼吸させる */
        @keyframes vcSelPulse{0%,100%{opacity:.55}50%{opacity:1}}
        /* アニメ・ホバープレビュー（小さな四角で動きを再現） */
        .animChip{position:relative;overflow:hidden;cursor:pointer;user-select:none}
        .animChip .apreview{position:absolute;inset:0;display:grid;place-items:center;background:#14161C;opacity:0;pointer-events:none;transition:opacity .12s}
        .animChip:hover .apreview{opacity:1}
        .animChip .adot{width:16px;height:12px;border-radius:2px;background:linear-gradient(135deg,#8B7CFF,#5FD6C4)}
        .animChip:hover .adot{animation:var(--akf) 1.1s ease infinite}
        @keyframes apFade{0%{opacity:0}50%,100%{opacity:1}}
        @keyframes apSlideUp{0%{transform:translateY(10px);opacity:0}50%,100%{transform:translateY(0);opacity:1}}
        @keyframes apSlideDown{0%{transform:translateY(-10px);opacity:0}50%,100%{transform:translateY(0);opacity:1}}
        @keyframes apSlideLeft{0%{transform:translateX(12px);opacity:0}50%,100%{transform:translateX(0);opacity:1}}
        @keyframes apSlideRight{0%{transform:translateX(-12px);opacity:0}50%,100%{transform:translateX(0);opacity:1}}
        @keyframes apZoom{0%{transform:scale(.4);opacity:0}50%,100%{transform:scale(1);opacity:1}}
        @keyframes apPop{0%{transform:scale(0)}60%{transform:scale(1.25)}80%{transform:scale(.92)}100%{transform:scale(1)}}
        @keyframes apRotate{0%{transform:rotate(-180deg) scale(.5);opacity:0}60%,100%{transform:rotate(0) scale(1);opacity:1}}
        @keyframes apFloat{0%,100%{transform:translateY(-3px)}50%{transform:translateY(3px)}}
        @keyframes apPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}
        @keyframes apSpin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
        @keyframes apShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
        @keyframes apBlink{0%,49%,100%{opacity:1}50%,99%{opacity:.15}}
        @keyframes apHeart{0%,100%{transform:scale(1)}15%{transform:scale(1.3)}30%{transform:scale(1)}45%{transform:scale(1.2)}}
        @keyframes apStamp{0%{transform:scale(2.2);opacity:0}55%{transform:scale(.9);opacity:1}70%{transform:scale(1.05)}100%{transform:scale(1)}}
        @keyframes apPan{0%{transform:translateX(-6px) scale(1.2)}100%{transform:translateX(6px) scale(1.2)}}
        @keyframes apPathArc{0%{transform:translate(-8px,0)}50%{transform:translate(-2px,-8px)}100%{transform:translate(0,0)}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important;transition-duration:.001ms !important}}
        /* --- 簡易ライトモード：UIを反転し、実際の色が必要な要素だけ再反転 --- */
        html.vc-light body{filter:invert(1) hue-rotate(180deg);background:#EAEAF0}
        html.vc-light .previewBox, html.vc-light .previewBox *,
        html.vc-light .sceneCard svg,
        html.vc-light img, html.vc-light video,
        html.vc-light input[type=color],
        html.vc-light .vc-brand, html.vc-light .vc-truecolor,
        html.vc-light .apreview .adot{filter:invert(1) hue-rotate(180deg)}
        html.vc-light .previewBox *{filter:none}
        html.vc-light ::selection{background:#8B7CFF55}
        /* --- レスポンシブ（900px未満：3カラムを縦積みにして閲覧可能に） --- */
        @media (max-width: 900px){
          .vc-main{display:flex !important;flex-direction:column !important;overflow-y:auto !important}
          .vc-main > *{width:100% !important;max-width:100% !important;border-left:none !important;border-right:none !important;border-bottom:1px solid #262B38}
          .col-scroll{max-height:none !important;overflow:visible !important}
          body, #root > div{height:auto !important;min-height:100vh;overflow:auto !important}
          header{position:sticky;top:0;z-index:20;background:#14161C}
        }
        .col-scroll{overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none}
        .col-scroll::-webkit-scrollbar{display:none}
        .hbar-noscroll::-webkit-scrollbar{display:none}
        .pv-scroll{overflow:auto;scrollbar-width:none;-ms-overflow-style:none}
        .pv-scroll::-webkit-scrollbar{display:none}
        .previewBox{display:grid;place-items:center}
        .previewBox.pv-fit svg{width:auto;height:auto;max-width:100%;max-height:100%;display:block}
        .pv-modal .previewBox{max-height:100%}
        .pv-modal .previewBox svg{max-height:calc(100vh - 110px) !important;max-width:calc(100vw - 60px) !important}

        .previewBox.pv-zoom svg{width:var(--pvw);height:auto;max-width:none;max-height:none;display:block}
        @media (prefers-reduced-motion: reduce){ svg *{animation-duration:0.01s !important} }
      `}</style>

      {/* Header */}
      <header style={S.header}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <LogoMark size={26} />
            <span style={S.logo}>Vectimo</span>
            <span style={{ fontSize: 10.5, color: "#5C6373", letterSpacing: "0.06em", marginTop: 4 }}>SVG MOTION STUDIO</span>
          </span>
          <span style={S.sub}>複数SVG → 1本の動画</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ display: "flex", gap: 2 }}>
            <button className="btn" style={S.iconBtn} onClick={undo} title="元に戻す（Ctrl+Z）"><Icon name="undo" size={16} /></button>
            <button className="btn" style={S.iconBtn} onClick={redo} title="やり直す（Ctrl+Shift+Z）"><Icon name="redo" size={16} /></button>
            <button className="btn" style={S.iconBtn} onClick={() => setLightMode((v) => !v)} title={lightMode ? "ダークモードに切替" : "ライトモードに切替"}>{lightMode ? "🌙" : "☀"}</button>
          </span>
          <span style={{ position: "relative" }}>
            <button className="btn" style={S.ghostBtn} onClick={() => setFileMenu((v) => !v)}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="menu" />メニュー ▾</span></button>
            {fileMenu && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 30 }} onClick={() => setFileMenu(false)} />
                <div className="vc-menu" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 31, background: "#1D2129", border: "1px solid #333A4A", borderRadius: 10, padding: 6, minWidth: 200, boxShadow: "0 12px 40px #000A" }}>
                  <div style={S.menuLabel}>プロジェクト</div>
                  <button className="ctxItem" onClick={() => { saveProject(false); setFileMenu(false); }}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon name="save" />プロジェクトを保存（軽量）</span></button>
                  <button className="ctxItem" onClick={() => { saveProject(true); setFileMenu(false); }}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon name="save" />素材ごと保存（1ファイル完結）</span></button>
                  <button className="ctxItem" onClick={() => { projRef.current?.click(); setFileMenu(false); }}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon name="folder" />プロジェクトを開く</span></button>
                  <div style={{ borderTop: "1px solid #262B38", margin: "5px 0" }} />
                  <div style={S.menuLabel}>CSV入稿</div>
                  <button className="ctxItem" onClick={() => { exportCsvTemplate(); setFileMenu(false); }}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon name="csvOut" />CSVテンプレを書き出し</span></button>
                  <button className="ctxItem" onClick={() => { csvRef.current?.click(); setFileMenu(false); }}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon name="csvIn" />CSVを取り込み</span></button>
                  <div style={{ borderTop: "1px solid #262B38", margin: "5px 0" }} />
                  <div style={S.menuLabel}>この他</div>
                  <button className="ctxItem" onClick={() => { setInputOpen((v) => !v); setFileMenu(false); }}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon name="code" />SVGコードを編集</span></button>
                  <button className="ctxItem" onClick={() => { exportSvg(); setFileMenu(false); }}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon name="image" />このシーンをSVG書き出し</span></button>
                  <button className="ctxItem" onClick={() => { setHintsDone(false); setFileMenu(false); }}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon name="lightbulb" size={14} />操作ヒントを再表示</span></button>
                  <a className="ctxItem" href="vectimo-guide.html" target="_blank" rel="noopener" style={{ textDecoration: "none" }} onClick={() => setFileMenu(false)}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon name="folder" size={14} />使い方ガイドを開く</span></a>
                </div>
              </>
            )}
          </span>
          <input ref={projRef} type="file" accept=".json" style={{ display: "none" }} onChange={loadProject} />
          <input ref={csvRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={importCsv} />
          <button className="btn" style={S.primaryBtn} onClick={() => setSeqOpen(true)}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="play" />全再生（{totalVideo.toFixed(1)}s）</span></button>
          <button className="btn" style={S.exportBtn} onClick={() => setMp4Open(true)}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="film" />MP4書き出し</span></button>
        </div>
      </header>

      {/* フレーム設定 */}
      <div style={S.frameBar}>
        <span style={S.frameLabel}>出力サイズ</span>
        {Object.entries(FRAMES).map(([k, v]) => (
          <button key={k} className="btn" onClick={() => setFrame((f) => ({ ...f, ratio: k }))}
            style={{ ...S.frameBtn, ...(frame.ratio === k ? S.frameBtnActive : {}) }}>{v.label}</button>
        ))}
        {frame.ratio !== "original" && (
          <>
            <span style={{ ...S.frameLabel, marginLeft: 10 }}>収め方</span>
            <select style={S.transSelect} value={frame.fit} onChange={(e) => setFrame((f) => ({ ...f, fit: e.target.value }))}>
              <option value="cover">切り抜き（カバー）</option>
              <option value="contain">全体表示（余白）</option>
            </select>
            <select style={S.transSelect} value={frame.align} onChange={(e) => setFrame((f) => ({ ...f, align: e.target.value }))} title="位置">
              {Object.entries(ALIGNS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {frame.fit === "contain" && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#9AA0AE" }}>
                余白色
                <input type="color" value={frame.bg} onChange={(e) => setFrame((f) => ({ ...f, bg: e.target.value }))}
                  style={{ width: 26, height: 22, border: "1px solid #333A4A", borderRadius: 5, background: "#1D2129", padding: 1, cursor: "pointer" }} />
              </label>
            )}
          </>
        )}
      </div>

      {/* 音声バー（BGMはここに音声ファイルをドロップでも設定可能） */}
      <div style={S.frameBar}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const all = Array.from(e.dataTransfer.files || []);
          const f = all.find((x) => x.type.startsWith("audio/"));
          const bad = all.filter((x) => !x.type.startsWith("audio/"));
          if (bad.length) window.alert(`音声ファイルではないためスキップしました：\n${bad.map((x) => x.name).join("\n")}`);
          if (f) setBgm({ src: URL.createObjectURL(f), name: f.name, volume: 0.6, loop: true, fadeIn: 1, fadeOut: 1.5 });
        }}>
        <span style={S.frameLabel}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="music" size={13} />BGM（動画全体）</span></span>
        {bgm ? (
          <>
            <span style={{ fontSize: 11.5, color: "#C9CDD6", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bgm.name}</span>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#9AA0AE" }}>
              音量<input type="range" min="0" max="1" step="0.05" value={bgm.volume} onChange={(e) => setBgm({ ...bgm, volume: +e.target.value })} style={{ width: 70 }} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#9AA0AE" }}>
              フェードイン<input type="number" min="0" max="10" step="0.5" value={bgm.fadeIn} onChange={(e) => setBgm({ ...bgm, fadeIn: Math.max(0, +e.target.value || 0) })} style={S.numInput} />s
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#9AA0AE" }}>
              アウト<input type="number" min="0" max="10" step="0.5" value={bgm.fadeOut} onChange={(e) => setBgm({ ...bgm, fadeOut: Math.max(0, +e.target.value || 0) })} style={S.numInput} />s
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#9AA0AE", cursor: "pointer" }}>
              <input type="checkbox" checked={bgm.loop !== false} onChange={(e) => setBgm({ ...bgm, loop: e.target.checked })} />ループ
            </label>
            <button className="btn" style={{ ...S.frameBtn, color: "#FF8FA3" }} onClick={() => setBgm(null)}><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="x" size={12} />解除</span></button>
          </>
        ) : (
          <button className="btn" style={S.frameBtn} onClick={() => bgmFileRef.current?.click()}>＋ BGMを選択</button>
        )}
        <input ref={bgmFileRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={(e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (f) setBgm({ src: URL.createObjectURL(f), name: f.name, volume: 0.6, loop: true, fadeIn: 1, fadeOut: 1.5 });
        }} />

        <span style={{ fontSize: 11.5, color: "#5C6373", marginLeft: 14 }}>シーン音声は左のパーツ一覧の下部から追加できます（複数可・このバーに音声をドロップするとBGMに設定）</span>
        <input ref={audioFileRef} type="file" accept="audio/*" multiple style={{ display: "none" }} onChange={(e) => { addSceneAudios(e.target.files); e.target.value = ""; }} />
      </div>

      {/* シーンストリップ（SVGをドロップで追加） */}
      <div className="hbar-noscroll" style={S.sceneStrip}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const all = Array.from(e.dataTransfer.files || []);
          const ok = (f) => f.type === "image/svg+xml" || /\.(svg|png|jpe?g|webp|gif)$/i.test(f.name) || /^image\//.test(f.type);
          const good = all.filter(ok);
          if (good.length) addScenesFromFiles(good);
          else if (all.length) window.alert(`対応していないファイルです：\n${all.map((f) => f.name).join("\n")}\n（SVG・PNG・JPG・WebPに対応）`);
        }}>
        {scenes.map((s, i) => {
          const active = s.id === activeId;
          const thumb = getSceneThumb(s.svgText);
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div className="sceneCard" onClick={() => setActiveId(s.id)}
                draggable
                onDragStart={(e) => { dragSceneRef.current = s.id; e.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromId = dragSceneRef.current;
                  if (!fromId || fromId === s.id) return;
                  setScenesH((sc) => {
                    const from = sc.findIndex((x) => x.id === fromId);
                    const to = sc.findIndex((x) => x.id === s.id);
                    if (from < 0 || to < 0) return sc;
                    const next = [...sc];
                    const [moved] = next.splice(from, 1);
                    next.splice(to, 0, moved);
                    return next;
                  });
                  dragSceneRef.current = null;
                }}
                style={{ ...S.sceneCard, borderColor: active ? "#8B7CFF" : "#333A4A", boxShadow: active ? "0 0 0 1px #8B7CFF" : "none" }}>
                <div style={S.sceneThumb} dangerouslySetInnerHTML={{ __html: thumb }} />
                <div style={S.sceneCardBody}>
                  <div style={S.sceneName} title={s.name}>{i + 1}. {s.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input type="number" min="0.5" step="0.5" value={s.duration}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateScene(s.id, { duration: Math.max(0.3, +e.target.value || 0.3) })}
                      style={S.durInput} aria-label="シーンの長さ（秒）" />
                    <span style={{ fontSize: 10, color: "#9AA0AE" }}>秒</span>
                  </div>
                </div>
                <div style={S.sceneOps} onClick={(e) => e.stopPropagation()}>
                  <button className="btn" style={S.miniBtn} onClick={() => moveScene(s.id, -1)} title="左へ">◀</button>
                  <button className="btn" style={S.miniBtn} onClick={() => moveScene(s.id, 1)} title="右へ">▶</button>
                  <button className="btn" style={S.miniBtn} onClick={() => duplicateScene(s.id)} title="複製">⧉</button>
                  <button className="btn" style={{ ...S.miniBtn, color: "#FF8FA3", display: "inline-flex", alignItems: "center" }} onClick={() => removeScene(s.id)} title="削除"><Icon name="x" size={12} /></button>
                </div>
              </div>
              {i < scenes.length - 1 && (
                <select
                  value={s.transition.type}
                  onChange={(e) => updateScene(s.id, { transition: { ...s.transition, type: e.target.value, duration: e.target.value === "cut" ? 0 : (s.transition.duration || 0.6) } })}
                  style={S.transSelect} title="次のシーンへのトランジション">
                  {Object.entries(TRANSITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              )}
            </div>
          );
        })}
        <button className="btn" style={S.addSceneBtn} onClick={() => fileRef.current?.click()}>＋ 素材を追加<br /><span style={{ fontSize: 10, fontWeight: 400 }}>（SVG・画像／複数OK）</span></button>
        <button className="btn" style={{ ...S.miniBtn, color: "#FF8FA3", fontSize: 12, padding: "8px 10px", flexShrink: 0, border: "1px solid #7A3B4A", borderRadius: 8 }}
          onClick={() => {
            if (!window.confirm(`全${scenes.length}シーンを削除します。よろしいですか？（Ctrl+Zで戻せます）`)) return;
            setScenesH([]);
            setActiveId(null);
            setSelected(null);
          }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="trash" size={13} />全シーン削除</span></button>
        <button className="btn" style={{ ...S.miniBtn, color: "#5FD6C4", fontSize: 12, padding: "8px 10px", flexShrink: 0, border: "1px solid #2E5B54", borderRadius: 8 }}
          onClick={() => setBulkOpen(true)}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="layers" size={13} />メディア一括割当</span></button>

        <input ref={fileRef} type="file" accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp,image/gif" multiple style={{ display: "none" }} onChange={(e) => { addScenesFromFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {/* SVGコード編集 */}
      {inputOpen && scene && (
        <div style={S.inputPanel}>
          <textarea style={S.textarea} value={scene.svgText} spellCheck={false} aria-label="SVGコード"
            onChange={(e) => {
              const text = e.target.value;
              const p = parseSvg(text);
              const nextSettings = {};
              if (p.parts) p.parts.forEach((pt, i) => { nextSettings[pt.uid] = scene.settings[pt.uid] || { ...defaultSetting(), delay: +(i * 0.25).toFixed(2) }; });
              updateScene(scene.id, { svgText: text, settings: nextSettings });
            }} />
          <p style={S.hint}>編集中のシーン：{scene.name}。レイヤーにid名を付けるとパーツ名として表示されます。</p>
        </div>
      )}

      {scenes.length === 0 ? (
        <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 40, textAlign: "center" }}>
          <div>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}><LogoMark size={52} /></div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>SVGを追加して始めましょう</div>
            <p style={{ fontSize: 13, color: "#9AA0AE", lineHeight: 1.8, marginBottom: 20 }}>
              「＋ 素材を追加」から <b>SVG・写真（PNG/JPG）</b> を1枚または複数読み込むと、<br />シーンとして並べてアニメーション動画を作れます。<br />写真はズームやパンで動かして、思い出のスライドショーにも。<br />保存したプロジェクト（JSON）は「☰ メニュー → プロジェクトを開く」から読み込めます。<br /><a href="vectimo-guide.html" target="_blank" rel="noopener" style={{ color: "#8B7CFF" }}>使い方ガイドを見る →</a>
              {hasAutosave && (
                <div style={{ marginTop: 18 }}>
                  <button className="btn" onClick={restoreAutosave}
                    style={{ background: "linear-gradient(100deg,#2B2350,#1D2129)", border: "1.5px solid #8B7CFF", borderRadius: 10, padding: "11px 22px", cursor: "pointer", color: "#EDEEF2", fontWeight: 700, fontSize: 13.5 }}>
                    前回の作業を復元する
                  </button>
                  <div style={{ fontSize: 10.5, color: "#5C6373", marginTop: 6 }}>作業内容はこのブラウザに自動保存されています</div>
                </div>
              )}
              <div style={{ marginTop: 22 }}>
                <div style={{ fontSize: 12.5, color: "#9AA0AE", marginBottom: 10 }}>— または、テンプレートから始める —</div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  {TEMPLATES.map((t) => (
                    <button key={t.id} className="btn" onClick={() => loadTemplate(t)}
                      style={{ background: "#1D2129", border: "1px solid #333A4A", borderRadius: 10, padding: "12px 16px", cursor: "pointer", color: "#EDEEF2", textAlign: "left", width: 190 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: "#9AA0AE", lineHeight: 1.5 }}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </p>
            <button className="btn" style={S.primaryBtn} onClick={() => fileRef.current?.click()}>＋ 素材を追加</button>
          </div>
        </div>
      ) : parsed.error ? (
        <div style={S.errorBox}>{parsed.error}</div>
      ) : (
        <div className="vc-main" style={S.main}>
          {/* Parts list */}
          <aside style={S.leftPanel}>
            <div style={S.panelTitle}>パーツ（{parsed.parts.length}）<span style={{ fontWeight: 400, letterSpacing: 0 }}>　下ほど前面</span></div>
            <div className="col-scroll" style={{ flex: 1 }}>
              {parsed.parts.map((p, i) => {
                const s = settings[p.uid];
                const active = selected === p.uid;
                return (
                  <div key={p.uid} className="partRow" onClick={() => setSelected(p.uid)}
                    ref={(el) => { if (el && selected === p.uid && el.scrollIntoView) { try { el.scrollIntoView({ block: "nearest" }); } catch (e) {} } }}
                    style={{ ...S.partRow, background: active ? "#2A2F40" : "transparent", borderLeft: `3px solid ${active ? PART_COLORS[i % 8] : "transparent"}` }}>
                    <span style={{ ...S.partDot, background: PART_COLORS[i % 8] }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.partName}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{p.hasImage && <Icon name="image" size={12} style={{ color: "#8B7CFF" }} />}{p.name}</span></div>
                      <div style={S.partMeta}>{s ? ANIM_TYPES[s.type].label : ""}{s && s.type !== "none" ? ` ・ ${s.duration}s` : ""}</div>
                    </div>
                  </div>
                );
              })}
              <button className="partRow" onClick={() => setShapePanelOpen((v) => !v)}
                style={{ ...S.panelTitle, borderTop: "1px solid #262B38", marginTop: 6, width: "100%", background: "none", border: "none", borderTop: "1px solid #262B38", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: 700 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="add" size={13} />図形・テキストを追加</span>
                <span style={{ fontSize: 11, color: "#9AA0AE", transform: shapePanelOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
              </button>
              {shapePanelOpen && (
                <div className="vc-overlay" style={{ padding: "0 16px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11.5, color: "#9AA0AE" }}>色</span>
                    <input type="color" value={newShapeColor} onChange={(e) => setNewShapeColor(e.target.value)} style={{ width: 30, height: 24, border: "1px solid #333A4A", borderRadius: 6, background: "#1D2129", padding: 1, cursor: "pointer" }} />
                    <span style={{ fontSize: 10.5, color: "#5C6373" }}>追加後にドラッグ・サイズ変更・種類変更できます</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                    {[["text", "文字"], ["rect", "四角"], ["roundRect", "角丸"], ["circle", "丸"], ["band", "帯"], ["triangle", "三角"], ["star", "星"], ["arrow", "矢印"], ["bubble", "吹き出し"]].map(([k, label]) => (
                      <button key={k} className="btn" style={{ ...S.ghostBtn, padding: "8px 4px", fontSize: 10.5, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }} onClick={() => addShape(k)}>
                        <ShapeIcon shape={k} size={18} />{label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ ...S.panelTitle, borderTop: "1px solid #262B38", marginTop: 6 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="telop" size={13} />テロップ（{(scene.overlays || []).length}）</span></div>
              {(scene.overlays || []).map((o, oi) => {
                const active = selected === `ov${oi}`;
                return (
                  <div key={`ov${oi}`} className="partRow" onClick={() => setSelected(`ov${oi}`)}
                    style={{ ...S.partRow, background: active ? "#2A2F40" : "transparent", borderLeft: `3px solid ${active ? "#5FD6C4" : "transparent"}` }}>
                    <span style={{ ...S.partDot, background: "#5FD6C4", borderRadius: "50%" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.partName}>{o.text || "(空)"}</div>
                      <div style={S.partMeta}>{o.anim !== "none" ? ANIM_TYPES[o.anim]?.label : "アニメなし"}</div>
                    </div>
                  </div>
                );
              })}
              <button className="btn" style={{ ...S.ghostBtn, margin: "8px 12px", display: "block", width: "calc(100% - 24px)", fontSize: 12 }}
                onClick={() => {
                  const next = [...(scene.overlays || []), defaultOverlay()];
                  updateScene(scene.id, { overlays: next });
                  setSelected(`ov${next.length - 1}`);
                }}>＋ テロップを追加</button>
              <div style={{ ...S.panelTitle, borderTop: "1px solid #262B38", marginTop: 6 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="audio" size={13} />音声（{getSceneAudios(scene).length}）</span></div>
              {getSceneAudios(scene).map((au, ai) => {
                const active = selected === `au${ai}`;
                return (
                  <div key={au.id || ai} className="partRow" onClick={() => setSelected(`au${ai}`)}
                    style={{ ...S.partRow, background: active ? "#2A2F40" : "transparent", borderLeft: `3px solid ${active ? "#F2B84B" : "transparent"}` }}>
                    <span style={{ ...S.partDot, background: "#F2B84B", borderRadius: "50%" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.partName}>{au.name}</div>
                      <div style={S.partMeta}>{(au.delay || 0).toFixed(1)}s〜 ／ ×{au.speed || 1} ／ {(au.start || 0).toFixed(1)}-{(au.end || au.duration || 0).toFixed(1)}s</div>
                    </div>
                  </div>
                );
              })}
              <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addSceneAudios(e.dataTransfer.files); }}>
                <button className="btn" style={{ ...S.ghostBtn, margin: "8px 12px", display: "block", width: "calc(100% - 24px)", fontSize: 12 }}
                  onClick={() => audioFileRef.current?.click()}>＋ 音声を追加（ここにドロップ可）</button>
              </div>
            </div>
          </aside>

          {/* Center */}
          <section className="col-scroll" style={S.center}>
            {!hintsDone && scene && (
              <div className="vc-overlay" style={{ margin: "12px 16px 0", background: "linear-gradient(100deg,#1E1B33,#171A22)", border: "1px solid #3B3566", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ display: "inline-flex", color: "#B9A5FF" }}><Icon name="lightbulb" size={18} /></span>
                <div style={{ flex: 1, fontSize: 12.5, color: "#C9CDD6", lineHeight: 1.85 }}>
                  <b style={{ color: "#EDEEF2" }}>知っておくと便利な操作</b>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 16px", marginTop: 3 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="mouse" size={12} />パーツを<b>ドラッグで移動</b></span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="search" size={12} /><b>Ctrl＋ホイール</b>／ピンチで拡大縮小</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="copy" size={12} />パーツを選択して<b>右パネル</b>から動きのコピー・保存</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="settings" size={12} />タイムラインのバーは<b>ドラッグで移動・右端で伸縮</b></span>
                    <span>⤢ プレビュー右上で<b>拡大編集</b></span>
                  </div>
                </div>
                <button className="btn" style={{ ...S.ghostBtn, padding: "5px 10px", fontSize: 11.5, flexShrink: 0 }} onClick={() => setHintsDone(true)}>閉じる</button>
              </div>
            )}
            <div className={pvZoom === "fit" ? "" : "pv-scroll"} style={{ ...S.previewWrap, position: "relative" }}>
              <div className="pv-vguide" style={{ display: "none", position: "absolute", width: 0, borderLeft: "1.5px dashed #FF5C7A", zIndex: 5, pointerEvents: "none" }} />
              <div className="pv-hguide" style={{ display: "none", position: "absolute", height: 0, borderTop: "1.5px dashed #FF5C7A", zIndex: 5, pointerEvents: "none" }} />
              {!pvModal && scene && (
                <button className="btn" title="拡大して編集（大きい画面で位置・サイズを調整）"
                  style={{ position: "absolute", top: 10, right: 10, zIndex: 6, background: "#1D2129DD", color: "#C9CDD6", border: "1px solid #333A4A", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 14 }}
                  onClick={() => setPvModal(true)}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="expand" size={14} />拡大</span></button>
              )}
              {!pvModal && selected?.startsWith("p") && (
                <div style={{ position: "absolute", left: 10, bottom: 10, zIndex: 6, background: "#14161CCC", color: "#9AA0AE", border: "1px solid #333A4A", borderRadius: 8, padding: "5px 10px", fontSize: 10.5, pointerEvents: "none", lineHeight: 1.5, backdropFilter: "blur(4px)" }}>
                  ドラッグで移動 ・ Ctrl+ホイールで拡大縮小 ・ 右クリックで動きをコピー
                </div>
              )}
{!pvModal && previewBoxEl}
            </div>
            <div style={S.controls}>
              <button className="btn" style={S.playBtn} onClick={replay}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="play" />シーン再生</span></button>
              <button className="btn" style={S.ghostBtn} onClick={() => { setPlaying(false); setSeekT(null); stopLiveAudio(); }}>⏹ 静止表示</button>
              <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {[["fit", "フィット"], [0.5, "50%"], [1, "100%"], [2, "200%"]].map(([v, l]) => (
                  <button key={l} className="btn"
                    style={{ ...S.frameBtn, ...(pvZoom === v ? S.frameBtnActive : {}), padding: "4px 8px", fontSize: 11 }}
                    onClick={() => setPvZoom(v)}>{l}</button>
                ))}
              </span>
              <select style={{ ...S.select, padding: "6px 8px", fontSize: 12 }} value={presetKey} onChange={(e) => setPresetKey(e.target.value)}>
                {Object.entries(PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button className="btn" style={{ ...S.ghostBtn, fontSize: 12 }} onClick={() => applyPreset(false)}>このシーンに適用</button>
              <button className="btn" style={{ ...S.ghostBtn, fontSize: 12 }} onClick={() => applyPreset(true)}>全シーンに適用</button>
              <span style={S.durLabel}>{seekT !== null ? `⏸ ${seekT.toFixed(2)}s` : `登場：${sceneAnimEnd.toFixed(2)}s`} ／ シーン長：<b style={{ color: "#EDEEF2" }}>{scene.duration}s</b></span>
            </div>

            {/* Timeline */}
            <div style={{ ...S.timeline, position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={S.panelTitle}>タイムライン（このシーン）　<span style={{ fontWeight: 400, color: "#5C6373" }}>バーをドラッグで移動／右端で伸縮・空きをクリックでジャンプ</span></div>
                <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "0 14px", fontSize: 13, color: "#9AA0AE", userSelect: "none" }}>
                  <Icon name="minus" size={14} style={{ color: "#9AA0AE" }} /><input type="range" min="1" max="6" step="0.5" value={tlZoom} onChange={(e) => setTlZoom(+e.target.value)} style={{ width: 110 }} title="タイムライン拡大" /><Icon name="plus" size={14} style={{ color: "#9AA0AE" }} />
                </span>
              </div>
              <div className="pv-scroll" style={{ overflow: "auto", maxHeight: 240 }}>
                <div style={{ width: `${tlZoom * 100}%`, minWidth: "100%", position: "relative", paddingBottom: 4 }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const trackLeft = rect.left + 150, trackW = rect.width - 162;
                    const frac = (e.clientX - trackLeft) / trackW;
                    if (frac >= 0 && frac <= 1) { setPlaying(true); setSeekT(+(frac * tlMax).toFixed(2)); }
                  }}>
                  <div style={{ position: "absolute", top: 18, bottom: 0, left: `calc(150px + (100% - 162px) * ${Math.min(1, headT / tlMax)})`, width: 2, background: "#FF5C7A", zIndex: 2, pointerEvents: "none" }} />
                  <div style={{ position: "relative", padding: "3px 0 2px", height: 16 }}>
                    {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                      <span key={f} style={{ ...S.tick, left: `calc(150px + (100% - 162px) * ${f})` }}>{(tlMax * f).toFixed(1)}s</span>
                    ))}
                  </div>
                  {bgm?.src && <AudioTrackRow label="BGM" src={bgm.src} tlMax={tlMax} mode="bgm" sceneStart={sceneStart} />}
                  {getSceneAudios(scene).map((au, ai) => (
                    <AudioTrackRow key={au.id || ai} label={`${(au.name || "音声").slice(0, 9)}`} src={au.src} tlMax={tlMax} mode="scene"
                      delay={au.delay || 0} speed={au.speed || 1} start={au.start || 0} end={au.end || 0}
                      onSelect={() => setSelected(`au${ai}`)}
                      onDragDelay={(nd) => {
                        const next = getSceneAudios(scene).map((x, j) => (j === ai ? { ...x, delay: nd } : x));
                        updateScene(scene.id, { audios: next, audio: null });
                      }} />
                  ))}
                  {(scene.overlays || []).map((o, oi) => {
                    const left = ((o.delay || 0) / tlMax) * 100;
                    const width = o.anim === "none" ? 0 : (Math.min(o.duration || 0.6, tlMax) / tlMax) * 100;
                    return (
                      <div key={`tlov${oi}`} style={{ ...S.tlRow, background: selected === `ov${oi}` ? "#232838" : "transparent", borderRadius: 6 }} onClick={(e) => { e.stopPropagation(); setSelected(`ov${oi}`); }}>
                        <span style={{ ...S.tlName, color: selected === `ov${oi}` ? "#EDEEF2" : "#5FD6C4" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="telop" size={11} />{o.text.slice(0, 7)}</span></span>
                        <div style={S.tlTrack}>
                          {o.anim !== "none" && (
                            <TlBar left={left} width={width} color="#5FD6C4" loop={false} resizable tlMax={tlMax}
                              title={`${(o.delay || 0)}s → ${((o.delay || 0) + (o.duration || 0.6)).toFixed(2)}s`}
                              onSelect={() => setSelected(`ov${oi}`)}
                              onCommit={(patch) => {
                                const next = scene.overlays.map((x, j) => (j === oi ? { ...x, ...patch } : x));
                                updateScene(scene.id, { overlays: next });
                              }} />
                          )}
                          {o.exitFade && (
                            <div style={{ ...S.tlBar, left: `${Math.max(0, ((tlMax - 0.5) / tlMax) * 100)}%`, width: `${(0.5 / tlMax) * 100}%`, background: "repeating-linear-gradient(45deg,#5FD6C4,#5FD6C4 4px,#5FD6C466 4px,#5FD6C466 8px)", pointerEvents: "none" }}
                              title="退場フェード" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {parsed.parts.map((p, i) => {
                    const s = settings[p.uid];
                    if (!s) return null;
                    const loop = isLoop(s);
                    const left = (s.delay / tlMax) * 100;
                    const width = s.type === "none" ? 0 : (Math.min(s.duration, tlMax) / tlMax) * 100;
                    return (
                      <div key={p.uid} style={{ ...S.tlRow, background: selected === p.uid ? "#232838" : "transparent", borderRadius: 6 }} onClick={(e) => { e.stopPropagation(); setSelected(p.uid); }}>
                        <span style={{ ...S.tlName, color: selected === p.uid ? "#EDEEF2" : "#9AA0AE" }}>
                          <PartThumb svgText={scene.svgText} uid={p.uid} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                        </span>
                        <div style={S.tlTrack}>
                          {s.type !== "none" && (
                            <TlBar left={left} width={width} loop={loop} resizable={!loop} tlMax={tlMax}
                              color={loop ? `repeating-linear-gradient(45deg, ${PART_COLORS[i % 8]}, ${PART_COLORS[i % 8]} 6px, ${PART_COLORS[i % 8]}66 6px, ${PART_COLORS[i % 8]}66 12px)` : PART_COLORS[i % 8]}
                              title={loop ? "ループ（ドラッグで開始位置）" : `${s.delay}s → ${(s.delay + s.duration).toFixed(2)}s`}
                              onSelect={() => setSelected(p.uid)}
                              onCommit={(patch) => update(p.uid, patch)} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Settings */}
          <aside className="col-scroll" style={S.rightPanel}>
            <div style={S.panelTitle}>アニメーション設定</div>
            {selected?.startsWith("au") && getSceneAudios(scene)[+selected.slice(2)] ? (() => {
              const ai = +selected.slice(2);
              const au = getSceneAudios(scene)[ai];
              const upAu = (patch) => {
                const next = getSceneAudios(scene).map((x, j) => (j === ai ? { ...x, ...patch } : x));
                updateScene(scene.id, { audios: next, audio: null });
              };
              const durMax = au.duration || Math.max(au.end || 0, 30);
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={S.selName}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="audio" size={15} />{au.name}</span></div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#9AA0AE" }}>
                    音量<input type="range" min="0" max="1" step="0.05" value={au.volume ?? 1} onChange={(e) => upAu({ volume: +e.target.value })} style={{ flex: 1 }} />
                    <b style={{ fontFamily: "'DM Mono',monospace", color: "#8B7CFF", width: 38 }}>{Math.round((au.volume ?? 1) * 100)}%</b>
                  </label>
                  <NumSlider label="開始タイミング（シーン内の遅延）" value={au.delay || 0} min={0} max={Math.max(10, tlMax)} step={0.05} unit="s" onChange={(v) => upAu({ delay: v })} />
                  <NumSlider label="再生速度" value={au.speed || 1} min={0.5} max={2} step={0.05} unit="×" onChange={(v) => upAu({ speed: v })} />
                  <NumSlider label="使用開始位置（ファイル内）" value={au.start || 0} min={0} max={durMax} step={0.05} unit="s" onChange={(v) => upAu({ start: Math.min(v, (au.end || durMax) - 0.05) })} />
                  <NumSlider label="使用終了位置（ファイル内）" value={au.end || durMax} min={0} max={durMax} step={0.05} unit="s" onChange={(v) => upAu({ end: Math.max(v, (au.start || 0) + 0.05) })} />
                  <p style={S.hint}>ファイル長：{(au.duration || 0).toFixed(2)}s ／ 実際に鳴る長さ：{(((au.end || durMax) - (au.start || 0)) / (au.speed || 1)).toFixed(2)}s（速度反映）</p>
                  <button className="btn" style={{ ...S.ghostBtn, color: "#FF8FA3" }} onClick={() => {
                    updateScene(scene.id, { audios: getSceneAudios(scene).filter((_, j) => j !== ai), audio: null });
                    setSelected(parsed.parts[0]?.uid ?? null);
                  }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="trash" size={13} />この音声を削除</span></button>
                  <button className="btn" style={S.primaryBtn} onClick={replay}>▶ この設定で再生</button>
                </div>
              );
            })() : selected?.startsWith("ov") && (scene.overlays || [])[+selected.slice(2)] ? (() => {
              const oi = +selected.slice(2);
              const ov = scene.overlays[oi];
              const upOv = (patch) => {
                const next = scene.overlays.map((o, i) => (i === oi ? { ...o, ...patch } : o));
                updateScene(scene.id, { overlays: next });
              };
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={S.selName}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="telop" size={15} />テロップ {oi + 1}</span></div>
                  <label style={S.field}>
                    <span style={S.label}>テキスト</span>
                    <TextEditField initial={ov.text} onCommit={(v) => upOv({ text: v })} />
                  </label>
                  <p style={S.hint}>プレビュー上のテロップをドラッグして位置を動かせます。</p>
                  <NumSlider label="サイズ（画面高さ比）" value={ov.size} min={1.5} max={15} step={0.1} unit="%" onChange={(v) => upOv({ size: v })} />
                  <NumSlider label="横位置" value={ov.x} min={0} max={100} step={0.5} unit="%" onChange={(v) => upOv({ x: v })} />
                  <NumSlider label="縦位置" value={ov.y} min={0} max={100} step={0.5} unit="%" onChange={(v) => upOv({ y: v })} />
                  <label style={S.field}>
                    <span style={S.label}>フォント</span>
                    <select style={S.select} value={ov.font || "gothic"} onChange={(e) => upOv({ font: e.target.value })}>
                      {Object.entries(OV_FONTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </label>
                  <label style={S.field}>
                    <span style={S.label}>スタイル</span>
                    <select style={S.select} value={ov.style} onChange={(e) => upOv({ style: e.target.value })}>
                      <option value="outline">縁取り文字</option>
                      <option value="band">帯付き（座布団）</option>
                    </select>
                  </label>
                  <div style={{ display: "flex", gap: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9AA0AE" }}>
                      文字色<input type="color" value={ov.color} onChange={(e) => upOv({ color: e.target.value })} style={{ width: 28, height: 24, border: "1px solid #333A4A", borderRadius: 5, background: "#1D2129", padding: 1, cursor: "pointer" }} />
                    </label>
                    {ov.style === "band" ? (
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9AA0AE" }}>
                        帯色<input type="color" value={ov.bandColor} onChange={(e) => upOv({ bandColor: e.target.value })} style={{ width: 28, height: 24, border: "1px solid #333A4A", borderRadius: 5, background: "#1D2129", padding: 1, cursor: "pointer" }} />
                      </label>
                    ) : (
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9AA0AE" }}>
                        縁色<input type="color" value={ov.outline} onChange={(e) => upOv({ outline: e.target.value })} style={{ width: 28, height: 24, border: "1px solid #333A4A", borderRadius: 5, background: "#1D2129", padding: 1, cursor: "pointer" }} />
                      </label>
                    )}
                  </div>
                  <label style={S.field}>
                    <span style={S.label}>登場アニメ</span>
                    <select style={S.select} value={ov.anim} onChange={(e) => upOv({ anim: e.target.value })}>
                      {["none", "fadeIn", "slideUp", "slideDown", "pop", "zoomIn"].map((k) => <option key={k} value={k}>{k === "none" ? "なし" : ANIM_TYPES[k].label}</option>)}
                    </select>
                  </label>
                  {ov.anim !== "none" && (
                    <>
                      <NumSlider label="時間" value={ov.duration} min={0.1} max={3} step={0.05} unit="s" onChange={(v) => upOv({ duration: v })} />
                      <NumSlider label="開始タイミング" value={ov.delay} min={0} max={10} step={0.05} unit="s" onChange={(v) => upOv({ delay: v })} />
                    </>
                  )}
                  <label style={S.checkRow}>
                    <input type="checkbox" checked={!!ov.exitFade} onChange={(e) => upOv({ exitFade: e.target.checked })} />
                    <span>シーン終了時にフェードアウト</span>
                  </label>
                  <button className="btn" style={{ ...S.ghostBtn, color: "#FF8FA3" }} onClick={() => {
                    updateScene(scene.id, { overlays: scene.overlays.filter((_, i) => i !== oi) });
                    setSelected(parsed.parts[0]?.uid ?? null);
                  }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="trash" size={13} />このテロップを削除</span></button>
                  <button className="btn" style={S.primaryBtn} onClick={replay}>▶ この設定で再生</button>
                </div>
              );
            })() : sel && selPart ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={S.selName}>{selPart.name}</div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11.5, color: "#9AA0AE" }}>レイヤー順</span>
                  <button className="btn" style={{ ...S.ghostBtn, flex: 1, padding: "6px 8px", fontSize: 12 }} onClick={() => moveLayer(-1)}>▼ 背面へ</button>
                  <button className="btn" style={{ ...S.ghostBtn, flex: 1, padding: "6px 8px", fontSize: 12 }} onClick={() => moveLayer(1)}>▲ 前面へ</button>
                </div>
                <button className="btn" style={{ ...S.ghostBtn, color: "#FF8FA3", padding: "7px 8px", fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }} onClick={() => deletePart(selected)} title="このパーツを削除（Delete）"><Icon name="trash" size={13} />このパーツを削除</button>

                {(() => {
                  const pc = parseSvg(scene.svgText).children[+selected.slice(1)];
                  const isShape = pc && pc.hasAttribute && pc.hasAttribute("data-shape");
                  if (!isShape) return null;
                  const cur = (() => { const t = pc.querySelector("[fill]") || pc; return t.getAttribute && t.getAttribute("fill") || "#8B7CFF"; })();
                  const curShape = pc.getAttribute("data-shape");
                  return (
                    <>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                          <span style={{ fontSize: 11.5, color: "#9AA0AE", marginRight: 2 }}>塗り</span>
                          <button className="btn" style={{ ...S.ghostBtn, padding: "4px 10px", fontSize: 11, border: !gradMode ? "1.5px solid #8B7CFF" : "1px solid #333A4A" }} onClick={() => setGradMode(false)}>単色</button>
                          <button className="btn" style={{ ...S.ghostBtn, padding: "4px 10px", fontSize: 11, border: gradMode ? "1.5px solid #8B7CFF" : "1px solid #333A4A" }} onClick={() => { setGradMode(true); applyGrad(selected, gradC1, gradC2, gradAngle); }}>グラデ</button>
                        </div>
                        {!gradMode ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11.5, color: "#9AA0AE" }}>色</span>
                            <input type="color" defaultValue={/^#[0-9a-fA-F]{6}$/.test(cur) ? cur : "#8B7CFF"} onChange={(e) => { const id = scene.id, uid = selected, col = e.target.value; setScenesH((sc) => sc.map((s) => (s.id === id ? { ...s, svgText: setShapeColor(s.svgText, uid, col) } : s))); }}
                              style={{ width: 34, height: 26, border: "1px solid #333A4A", borderRadius: 6, background: "#1D2129", padding: 1, cursor: "pointer" }} />
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 11, color: "#9AA0AE" }}>2色</span>
                              <input type="color" value={gradC1} onChange={(e) => { setGradC1(e.target.value); applyGrad(selected, e.target.value, gradC2, gradAngle); }} style={{ width: 30, height: 24, border: "1px solid #333A4A", borderRadius: 6, background: "#1D2129", padding: 1, cursor: "pointer" }} />
                              <input type="color" value={gradC2} onChange={(e) => { setGradC2(e.target.value); applyGrad(selected, gradC1, e.target.value, gradAngle); }} style={{ width: 30, height: 24, border: "1px solid #333A4A", borderRadius: 6, background: "#1D2129", padding: 1, cursor: "pointer" }} />
                              <div className="vc-truecolor" style={{ flex: 1, height: 24, borderRadius: 6, border: "1px solid #333A4A", background: `linear-gradient(${gradAngle + 90}deg, ${gradC1}, ${gradC2})` }} />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 11, color: "#9AA0AE", width: 30 }}>角度</span>
                              <input type="range" min="0" max="360" step="15" value={gradAngle} onChange={(e) => { const a = +e.target.value; setGradAngle(a); applyGrad(selected, gradC1, gradC2, a); }} style={{ flex: 1 }} />
                              <span style={{ fontSize: 10.5, color: "#C9CDD6", width: 34, textAlign: "right", fontFamily: "'DM Mono',monospace" }}>{gradAngle}°</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <span style={{ fontSize: 11.5, color: "#9AA0AE", display: "block", marginBottom: 4 }}>図形の種類（クリックで変更）</span>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
                          {[["rect", "四角"], ["roundRect", "角丸"], ["circle", "丸"], ["band", "帯"], ["triangle", "三角"], ["star", "星"], ["arrow", "矢印"], ["bubble", "吹出"]].map(([k, label]) => (
                            <button key={k} className="btn" title={label}
                              style={{ ...S.ghostBtn, padding: "6px 2px", fontSize: 9.5, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, border: curShape === k ? "1.5px solid #8B7CFF" : "1px solid #333A4A" }}
                              onClick={() => { const id = scene.id, uid = selected; setScenesH((sc) => sc.map((s) => (s.id === id ? { ...s, svgText: changeShapeType(s.svgText, uid, k) } : s))); }}>
                              <ShapeIcon shape={k} size={16} />{label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11.5, color: "#9AA0AE" }}>サイズ・位置</span>
                  <button className="btn" style={{ ...S.ghostBtn, flex: 1, padding: "6px 8px", fontSize: 13 }} title="縮小" onClick={() => { const id = scene.id, uid = selected; setScenesH((sc) => sc.map((s) => (s.id === id ? { ...s, svgText: scalePartAt(s.svgText, uid, 1 / 1.1) } : s))); }}><Icon name="minus" size={14} /></button>
                  <button className="btn" style={{ ...S.ghostBtn, flex: 1, padding: "6px 8px", fontSize: 13 }} title="拡大" onClick={() => { const id = scene.id, uid = selected; setScenesH((sc) => sc.map((s) => (s.id === id ? { ...s, svgText: scalePartAt(s.svgText, uid, 1.1) } : s))); }}><Icon name="plus" size={14} /></button>
                </div>
                <p style={{ ...S.hint, marginTop: -6 }}>プレビュー上でドラッグ移動、<b>Ctrl＋ホイール</b>（トラックパッドはピンチ）でも拡大縮小できます。</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11.5, color: "#9AA0AE", width: 52 }}>透過率</span>
                  <input type="range" min="0" max="1" step="0.05" value={sel.opacity ?? 1} onChange={(e) => update(selected, { opacity: +e.target.value })} style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: "#C9CDD6", width: 34, textAlign: "right", fontFamily: "'DM Mono',monospace" }}>{Math.round((sel.opacity ?? 1) * 100)}%</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="btn" style={{ ...S.ghostBtn, flex: 1, minWidth: 90, padding: "6px 8px", fontSize: 12 }} onClick={() => copyAnim(selected)}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="copy" size={13} />動きをコピー</span></button>
                  <button className="btn" style={{ ...S.ghostBtn, flex: 1, minWidth: 90, padding: "6px 8px", fontSize: 12, opacity: animClip ? 1 : 0.4 }} disabled={!animClip} onClick={() => { applyAnimTo(selected, animClip); showToast("✔ 動きを貼り付けました"); }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="pin" size={13} />貼り付け</span></button>
                  <button className="btn" style={{ ...S.ghostBtn, flex: 1, minWidth: 90, padding: "6px 8px", fontSize: 12 }} onClick={() => saveCustomPreset(selected)}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="star" size={13} />保存</span></button>
                </div>
                {customPresets.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 11, color: "#9AA0AE" }}>保存した動き（クリックで適用）</span>
                    {customPresets.map((cp) => (
                      <div key={cp.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button className="btn" style={{ ...S.ghostBtn, flex: 1, padding: "6px 10px", fontSize: 12, textAlign: "left" }}
                          onClick={() => { applyAnimTo(selected, cp.anim); showToast(`✔ 「${cp.name}」を適用しました`); }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="star" size={12} />{cp.name}</span>
                        </button>
                        <button className="btn" style={{ ...S.ghostBtn, padding: "6px 8px", color: "#FF8FA3" }} title="削除"
                          onClick={() => setCustomPresets((p) => p.filter((x) => x.id !== cp.id))}><Icon name="x" size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <p style={{ ...S.hint, marginTop: -4 }}>「コピー」した動きは別パーツを選んで「貼り付け」。「保存」した動きは上の一覧から他パーツにも適用できます。</p>

                {selPart.hasText && (() => {
                  const units = getPartTextUnits(scene.svgText, selected);
                  if (!units.length) return null;
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: 11.5, color: "#9AA0AE", display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="edit" size={12} />テキスト編集（Enterまたはフォーカスを外すと反映）</span>
                      {units.map((u, ui) => (
                        <TextEditField key={`${selected}_${ui}_${u}`} initial={u}
                          onCommit={(v) => updateScene(scene.id, { svgText: setPartTextUnit(scene.svgText, selected, ui, v) })} />
                      ))}
                    </div>
                  );
                })()}

                {selPart.hasImage && (
                  <>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn" style={{ ...S.ghostBtn, flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }} onClick={() => imgRef.current?.click()}><Icon name="image" size={13} />画像差し替え</button>
                      <button className="btn" style={{ ...S.ghostBtn, flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }} onClick={() => vidRef.current?.click()}><Icon name="video" size={13} />動画差し替え</button>
                    </div>
                    <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onImgReplace} />
                    <input ref={vidRef} type="file" accept="video/*" style={{ display: "none" }} onChange={onVideoReplace} />
                    {scene.videoParts?.[selected] && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <p style={{ ...S.hint, flex: 1, margin: 0, display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="video" size={12} />{scene.videoParts[selected].name}</p>
                        <button className="btn" style={{ ...S.ghostBtn, padding: "5px 10px", fontSize: 12 }} onClick={openVideoEdit}><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="settings" size={12} />尺・位置</span></button>
                      </div>
                    )}
                  </>
                )}

                <label style={S.field}>
                  <span style={S.label}>動きの種類</span>
                  <select style={S.select} value={sel.type} onChange={(e) => {
                    const t = e.target.value;
                    update(selected, { type: t, loop: null, ...(PAN_TYPES.has(t) || ZOOM_TYPES.has(t) ? { easing: "linear", duration: Math.max(sel.duration, 3) } : {}) });
                  }}>
                    <optgroup label="登場（1回）">
                      {Object.entries(ANIM_TYPES).filter(([k]) => !LOOP_TYPES.has(k) && !PAN_TYPES.has(k) && !ZOOM_TYPES.has(k) && !PATH_TYPES.has(k) && !["typewriter", "charFade", "marker", "countUp", "stamp", "shake", "blink", "heartbeat"].includes(k)).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </optgroup>
                    <optgroup label="テキスト向け">
                      {["typewriter", "charFade", "marker", "countUp"].map((k) => <option key={k} value={k}>{ANIM_TYPES[k].label}</option>)}
                    </optgroup>
                    <optgroup label="強調">
                      {["stamp", "shake", "blink", "heartbeat"].map((k) => <option key={k} value={k}>{ANIM_TYPES[k].label}</option>)}
                    </optgroup>
                    <optgroup label="軌道（パスに沿って動く）">
                      {["pathArc", "pathArcUp", "pathWave", "pathZig", "pathBounce", "pathCircle", "pathSpiral"].map((k) => <option key={k} value={k}>{ANIM_TYPES[k].label}</option>)}
                    </optgroup>
                    <optgroup label="パン・ズーム（写真向き）">
                      {Object.entries(ANIM_TYPES).filter(([k]) => PAN_TYPES.has(k) || ZOOM_TYPES.has(k)).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </optgroup>
                    <optgroup label="ループ">
                      {["float", "pulse", "spin"].map((k) => <option key={k} value={k}>{ANIM_TYPES[k].label}</option>)}
                    </optgroup>
                  </select>
                  {(() => {
                    const AP = { fadeIn: "apFade", slideUp: "apSlideUp", slideDown: "apSlideDown", slideLeft: "apSlideLeft", slideRight: "apSlideRight", zoomIn: "apZoom", pop: "apPop", rotateIn: "apRotate", draw: "apFade", float: "apFloat", pulse: "apPulse", spin: "apSpin", shake: "apShake", blink: "apBlink", heartbeat: "apHeart", stamp: "apStamp", panLeft: "apPan", panRight: "apPan", panUp: "apPan", panDown: "apPan", zoomSlow: "apZoom", zoomOut: "apZoom", kenburns: "apPan", typewriter: "apFade", charFade: "apFade", marker: "apSlideRight", countUp: "apFade", pathArc: "apPathArc", pathArcUp: "apPathArc", pathWave: "apSlideLeft", pathZig: "apShake", pathBounce: "apPop", pathCircle: "apSpin", pathSpiral: "apSpin" };
                    const quick = ["fadeIn", "slideUp", "slideLeft", "zoomIn", "pop", "rotateIn", "float", "pulse", "spin", "shake", "heartbeat", "stamp"];
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 4, marginTop: 6 }}>
                        {quick.map((k) => (
                          <div key={k} className="animChip" title={`${ANIM_TYPES[k]?.label || k}（ホバーで動き確認・クリックで適用）`}
                            style={{ height: 34, borderRadius: 6, border: sel.type === k ? "1.5px solid #8B7CFF" : "1px solid #333A4A", background: "#1D2129", "--akf": AP[k] || "apFade" }}
                            onClick={() => update(selected, { type: k, loop: null })}>
                            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 8.5, color: "#9AA0AE", textAlign: "center", lineHeight: 1.1, padding: 2 }}>{(ANIM_TYPES[k]?.label || k).slice(0, 5)}</div>
                            <div className="apreview"><div className="adot" /></div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <p style={{ ...S.hint, marginTop: 4 }}>上のマスにマウスを乗せると動きを確認できます（クリックで適用）。全種類はプルダウンから選べます。</p>
                </label>
                {TEXT_TYPES.has(sel.type) && !selPart.tag.match(/^(text|g)$/) && <p style={S.hint}>テキスト系アニメはテキストを含むパーツで効果があります。</p>}
                {sel.type === "countUp" && <p style={S.hint}>パーツ内の数字（例：50、1,200）を0からカウントアップします。</p>}

                <NumSlider label="時間（スピード）" value={sel.duration} min={0.1} max={10} step={0.05} unit="s" onChange={(v) => update(selected, { duration: v })} />
                <NumSlider label="開始タイミング（遅延）" value={sel.delay} min={0} max={8} step={0.05} unit="s" onChange={(v) => update(selected, { delay: v })} />

                <label style={S.field}>
                  <span style={S.label}>イージング</span>
                  <select style={S.select} value={sel.easing} onChange={(e) => update(selected, { easing: e.target.value })}>
                    {Object.entries(EASINGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>

                {(sel.type.startsWith("slide") || sel.type === "float" || PAN_TYPES.has(sel.type) || sel.type === "kenburns") && (
                  <label style={S.field}>
                    <span style={S.label}>移動距離<b style={S.mono}>{sel.distance}px</b></span>
                    <input type="range" min="10" max="800" step="5" value={sel.distance} onChange={(e) => update(selected, { distance: +e.target.value })} />
                  </label>
                )}

                {ZOOM_TYPES.has(sel.type) && (
                  <label style={S.field}>
                    <span style={S.label}>ズーム倍率<b style={S.mono}>×{sel.scaleTo.toFixed(2)}</b></span>
                    <input type="range" min="1.05" max="2.5" step="0.05" value={sel.scaleTo} onChange={(e) => update(selected, { scaleTo: +e.target.value })} />
                  </label>
                )}

                <label style={S.checkRow}>
                  <input type="checkbox" checked={isLoop(sel)} onChange={(e) => update(selected, { loop: e.target.checked })} />
                  <span>繰り返し再生（ループ）</span>
                </label>

                <label style={S.checkRow}>
                  <input type="checkbox" checked={!!sel.clip} onChange={(e) => update(selected, { clip: e.target.checked })} />
                  <span>画面の枠内でクリップ（はみ出しを隠す）</span>
                </label>
                {PAN_TYPES.has(sel.type) && !sel.clip && <p style={S.hint}>パンで枠外にはみ出す場合は「枠内でクリップ」をオンに。</p>}
                {sel.type === "draw" && <p style={S.hint}>線描画はstroke（線）を持つ要素で効果があります。</p>}

                {(() => {
                  const ex = sel.exit || { type: "none", duration: 0.6 };
                  return (
                    <>
                      <div style={S.sectionHead}>退場アニメーション（シーン終了に合わせて自動実行）</div>
                      <label style={S.field}>
                        <span style={S.label}>退場の種類</span>
                        <select style={S.select} value={ex.type} onChange={(e) => update(selected, { exit: e.target.value === "none" ? null : { ...ex, type: e.target.value } })}>
                          {Object.entries(EXIT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </label>
                      {ex.type !== "none" && (
                        <NumSlider label="退場にかける時間" value={ex.duration} min={0.1} max={3} step={0.05} unit="s" onChange={(v) => update(selected, { exit: { ...ex, duration: v } })} />
                      )}
                    </>
                  );
                })()}

                {selPart.hasImage && (() => {
                  const ia = sel.img || defaultImgSetting();
                  const upImg = (patch) => update(selected, { img: { ...ia, ...patch } });
                  return (
                    <>
                      <div style={S.sectionHead}>画像のアニメーション（画像の枠内・パーツとは独立）</div>
                      <label style={S.field}>
                        <span style={S.label}>動きの種類</span>
                        <select style={S.select} value={ia.type} onChange={(e) => {
                          const t = e.target.value;
                          upImg({ type: t, ...(PAN_TYPES.has(t) || ZOOM_TYPES.has(t) ? { easing: "linear", duration: Math.max(ia.duration, 3) } : {}) });
                        }}>
                          <option value="none">なし</option>
                          <optgroup label="パン・ズーム">
                            {Object.entries(ANIM_TYPES).filter(([k]) => PAN_TYPES.has(k) || ZOOM_TYPES.has(k)).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </optgroup>
                          <optgroup label="その他">
                            {["fadeIn", "slideUp", "slideDown", "slideLeft", "slideRight", "zoomIn", "float", "pulse"].map((k) => <option key={k} value={k}>{ANIM_TYPES[k].label}</option>)}
                          </optgroup>
                        </select>
                      </label>
                      {ia.type !== "none" && (
                        <>
                          <NumSlider label="画像の時間（スピード）" value={ia.duration} min={0.1} max={20} step={0.1} unit="s" onChange={(v) => upImg({ duration: v })} />
                          <NumSlider label="画像の開始タイミング" value={ia.delay} min={0} max={10} step={0.05} unit="s" onChange={(v) => upImg({ delay: v })} />
                          {(ia.type.startsWith("slide") || ia.type === "float" || PAN_TYPES.has(ia.type) || ia.type === "kenburns") && (
                            <NumSlider label="画像の移動距離" value={ia.distance} min={10} max={800} step={5} unit="px" onChange={(v) => upImg({ distance: v })} />
                          )}
                          {ZOOM_TYPES.has(ia.type) && (
                            <NumSlider label="画像のズーム倍率" value={ia.scaleTo} min={1.05} max={2.5} step={0.05} unit="×" onChange={(v) => upImg({ scaleTo: v })} />
                          )}
                          <label style={S.checkRow}>
                            <input type="checkbox" checked={isLoop(ia)} onChange={(e) => upImg({ loop: e.target.checked })} />
                            <span>画像アニメを繰り返し再生</span>
                          </label>
                          <p style={S.hint}>画像は自動的に元の枠内でクリップされます。パン系は移動距離に応じて自動でズーム補正され、枠の隙間から背面が見えることはありません。</p>
                        </>
                      )}
                    </>
                  );
                })()}

                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button className="btn" style={{ ...S.ghostBtn, flex: 1 }} onClick={() => update(selected, defaultSetting())}>リセット</button>
                  <button className="btn" style={{ ...S.ghostBtn, flex: 1 }} onClick={() => {
                    updateScene(scene.id, { settings: Object.fromEntries(Object.keys(settings).map((k) => [k, { ...settings[selected] }])) });
                  }}>全パーツに適用</button>
                </div>
                <button className="btn" style={S.primaryBtn} onClick={replay}>▶ この設定で再生</button>
              </div>
            ) : (
              <p style={S.hint}>左のリストからパーツを選んでください。</p>
            )}
          </aside>
        </div>
      )}

      {pvModal && (
        <div className="vc-overlay" style={{ position: "fixed", inset: 0, background: "#000000E8", zIndex: 45, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px" }}>
            <span style={{ fontSize: 13, color: "#C9CDD6", fontFamily: "'DM Mono',monospace" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}></span>拡大編集 — {scene?.name}</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11.5, color: "#5C6373" }}>クリックで選択／ドラッグで移動／Escで閉じる</span>
              <button className="btn" style={S.primaryBtn} onClick={replay}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="play" size={14} />シーン再生</span></button>
              <button className="btn" style={S.ghostBtn} onClick={() => { setPlaying(false); setSeekT(null); stopLiveAudio(); }}>⏹</button>
              <button className="btn" style={{ ...S.ghostBtn, fontSize: 15, padding: "6px 12px" }} onClick={() => setPvModal(false)}><Icon name="x" size={16} /></button>
            </div>
          </div>
          <div className="pv-modal" style={{ flex: 1, minHeight: 0, display: "grid", placeItems: "center", padding: "0 20px 20px", position: "relative" }}>
            <div className="pv-vguide" style={{ display: "none", position: "absolute", width: 0, borderLeft: "1.5px dashed #FF5C7A", zIndex: 5, pointerEvents: "none" }} />
            <div className="pv-hguide" style={{ display: "none", position: "absolute", height: 0, borderTop: "1.5px dashed #FF5C7A", zIndex: 5, pointerEvents: "none" }} />
            {previewBoxEl}
          </div>
        </div>
      )}
      {seqOpen && <SequencePlayer scenes={buildPlayScenes()} bgm={bgm} frame={frame} onClose={() => setSeqOpen(false)} />}
      {mp4Open && <Mp4ExportModal scenes={scenes} frame={frame} bgm={bgm} onFrame={setFrame} onClose={() => setMp4Open(false)} />}
      {bulkOpen && (
        <BulkMediaModal scenes={scenes} onClose={() => setBulkOpen(false)}
          onApply={(bySceneSvg, bySceneVid, count) => {
            setScenesH((sc) => sc.map((s) => {
              const patch = {};
              if (bySceneSvg.has(s.id)) patch.svgText = bySceneSvg.get(s.id);
              if (bySceneVid.has(s.id)) patch.videoParts = { ...(s.videoParts || {}), ...bySceneVid.get(s.id) };
              return Object.keys(patch).length ? { ...s, ...patch } : s;
            }));
            showToast(`✔ ${count}件のメディアを割り当てました（Ctrl+Zで戻せます）`);
          }} />
      )}
      {cropData && <ImageCropModal dataUrl={cropData.dataUrl} box={cropData.box} onApply={applyCrop} onClose={() => setCropData(null)} />}
      {videoEdit && <VideoEditModal video={videoEdit.video} box={videoEdit.box} onApply={applyVideoEdit} onClose={() => setVideoEdit(null)} />}
      <footer style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 18, padding: "5px 12px", borderTop: "1px solid #262B38", background: "#14161C", fontSize: 10.5, color: "#5C6373" }}>
        <span>© Vectimo</span>
        <a href="./" style={{ color: "#9AA0AE", textDecoration: "none" }}>トップ</a>
        <a href="vectimo-guide.html" target="_blank" rel="noopener" style={{ color: "#9AA0AE", textDecoration: "none" }}>使い方ガイド</a>
        <a href="vectimo-terms.html" target="_blank" rel="noopener" style={{ color: "#9AA0AE", textDecoration: "none" }}>利用規約</a>
        <a href="vectimo-privacy.html" target="_blank" rel="noopener" style={{ color: "#9AA0AE", textDecoration: "none" }}>プライバシーポリシー</a>
      </footer>
      {mobileNotice && (
        <div className="vc-toast" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 90, background: "#2B2350", borderBottom: "1px solid #8B7CFF66", color: "#EDEEF2", padding: "10px 14px", fontSize: 12.5, display: "flex", alignItems: "center", gap: 10, lineHeight: 1.5 }}>
          <span style={{ flex: 1 }}>Vectimoは編集操作が多いため、<b>パソコンでのご利用をおすすめします</b>。スマホでは閲覧・簡単な確認向けです。</span>
          <button className="btn" onClick={() => setMobileNotice(false)} style={{ background: "none", border: "1px solid #8B7CFF88", borderRadius: 6, color: "#EDEEF2", padding: "4px 10px", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>閉じる</button>
        </div>
      )}
      {toast && (
        <div className="vc-toast" style={{ position: "fixed", bottom: 20, left: "50%", background: "#1D2129", border: "1px solid #5FD6C4", color: "#EDEEF2", padding: "10px 20px", borderRadius: 10, fontSize: 13, zIndex: 80, boxShadow: "0 8px 30px #00000088", maxWidth: "90vw" }}>{toast}</div>
      )}
    </div>
  );
}

// サムネイル（静止SVG）簡易キャッシュ
const thumbCache = new Map();
function getSceneThumb(svgText) {
  if (thumbCache.has(svgText)) return thumbCache.get(svgText);
  const t = buildAnimatedSvg(svgText, {}, { staticMode: true });
  if (thumbCache.size > 60) thumbCache.clear();
  thumbCache.set(svgText, t);
  return t;
}

// ---------- styles ----------
// ===== デザイントークン（角丸・余白の統一。色は既存のまま） =====
// 角丸：sm=6（小要素/入力）, md=10（ボタン/カード）, lg=14（モーダル/大パネル）
const R = { sm: 6, md: 10, lg: 14 };
// 余白：8の倍数を基本リズムに
const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };

const styles = {
  app: { height: "100vh", overflow: "hidden", background: "#14161C", color: "#EDEEF2", fontFamily: "'Zen Kaku Gothic New','Hiragino Sans',sans-serif", display: "flex", flexDirection: "column" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: SP.sm, padding: "12px 20px", borderBottom: "1px solid #262B38" },
  iconBtn: { padding: "8px 12px", borderRadius: R.md, border: "1px solid #333A4A", background: "#1D2129", color: "#C9CDD6", fontSize: 15, cursor: "pointer", lineHeight: 1 },
  menuLabel: { fontSize: 10.5, color: "#5C6373", padding: "4px 12px 4px", letterSpacing: "0.04em" },
  logo: { fontSize: 19, fontWeight: 700, letterSpacing: "0.02em", fontFamily: "'DM Mono',monospace", background: "linear-gradient(95deg,#FFFFFF 20%,#B9A5FF 85%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  exportBtn: { padding: "8px 16px", borderRadius: R.md, border: "none", fontSize: 13, fontWeight: 700, color: "#FFFFFF", cursor: "pointer", background: "linear-gradient(100deg,#7C6CF0 0%,#9D6DF0 55%,#E86CB8 120%)", boxShadow: "0 2px 14px #8B7CFF33" },
  sub: { fontSize: 12, color: "#9AA0AE" },
  ghostBtn: { background: "#1D2129", color: "#C9CDD6", border: "1px solid #333A4A", borderRadius: R.md, padding: "8px 16px", fontSize: 13, cursor: "pointer" },
  primaryBtn: { background: "#8B7CFF", color: "#14161C", border: "none", borderRadius: R.md, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  playBtn: { background: "#5FD6C4", color: "#14161C", border: "none", borderRadius: R.md, padding: "8px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  sceneStrip: { display: "flex", alignItems: "center", gap: SP.sm, padding: "12px 16px", borderBottom: "1px solid #262B38", overflowX: "auto", background: "#171A22", scrollbarWidth: "none", msOverflowStyle: "none" },
  frameBar: { display: "flex", alignItems: "center", gap: SP.sm, padding: "8px 16px", borderBottom: "1px solid #262B38", flexWrap: "wrap", background: "#14161C" },
  frameLabel: { fontSize: 11, letterSpacing: "0.08em", color: "#9AA0AE", fontWeight: 700, marginRight: 2 },
  frameBtn: { background: "#1D2129", color: "#9AA0AE", border: "1px solid #333A4A", borderRadius: R.sm, padding: "6px 12px", fontSize: 11.5, cursor: "pointer" },
  frameBtnActive: { background: "#8B7CFF22", color: "#C9BFFF", border: "1px solid #8B7CFF" },
  sceneCard: { position: "relative", width: 96, background: "#1D2129", border: "1px solid #333A4A", borderRadius: R.md, cursor: "pointer", flexShrink: 0, overflow: "hidden" },
  sceneThumb: { background: "#fff", lineHeight: 0, maxHeight: 90, overflow: "hidden" },
  sceneCardBody: { padding: "6px 8px" },
  sceneName: { fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 },
  durInput: { width: 44, background: "#14161C", color: "#EDEEF2", border: "1px solid #333A4A", borderRadius: R.sm, padding: "3px 5px", fontSize: 11, fontFamily: "'DM Mono',monospace" },
  sceneOps: { display: "flex", justifyContent: "space-between", padding: "0 4px 4px" },
  miniBtn: { background: "transparent", color: "#9AA0AE", border: "none", fontSize: 11, cursor: "pointer", padding: 2 },
  transSelect: { background: "#1D2129", color: "#9AA0AE", border: "1px solid #333A4A", borderRadius: R.sm, fontSize: 10.5, padding: "4px 4px", maxWidth: 92, flexShrink: 0 },
  addSceneBtn: { background: "transparent", color: "#8B7CFF", border: "2px dashed #8B7CFF66", borderRadius: R.md, padding: "16px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0, lineHeight: 1.5 },
  inputPanel: { padding: "12px 20px", borderBottom: "1px solid #262B38" },
  textarea: { width: "100%", height: 110, background: "#0F1116", color: "#C9CDD6", border: "1px solid #333A4A", borderRadius: R.md, padding: SP.md, fontFamily: "'DM Mono',monospace", fontSize: 12, resize: "vertical" },
  hint: { fontSize: 11.5, color: "#9AA0AE", lineHeight: 1.7, margin: "6px 0 0" },
  errorBox: { margin: SP.xl, padding: SP.lg, background: "#3A1D24", border: "1px solid #7A3B4A", borderRadius: R.md, color: "#FFB3C0", fontSize: 13 },
  main: { display: "grid", gridTemplateColumns: "210px minmax(0,1fr) 280px", flex: 1, minHeight: 0, overflow: "hidden" },
  leftPanel: { borderRight: "1px solid #262B38", display: "flex", flexDirection: "column", minHeight: 0 },
  rightPanel: { borderLeft: "1px solid #262B38", padding: "16px 16px", overflowY: "auto", minHeight: 0, width: 280, boxSizing: "border-box" },
  panelTitle: { fontSize: 11, letterSpacing: "0.12em", color: "#9AA0AE", padding: "16px 16px 8px", fontWeight: 700 },
  partRow: { display: "flex", alignItems: "center", gap: SP.md, padding: "8px 16px", cursor: "pointer" },
  partDot: { width: 10, height: 10, borderRadius: R.sm, flexShrink: 0 },
  partName: { fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  partMeta: { fontSize: 11, color: "#9AA0AE", fontFamily: "'DM Mono',monospace" },
  center: { display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflowY: "auto" },
  previewWrap: { display: "grid", placeItems: "center", padding: SP.lg, height: "clamp(280px, calc(100vh - 497px), 1100px)", background: "radial-gradient(ellipse at center, #1A1E28 0%, #14161C 75%)" },
  previewInner: { maxWidth: "100%", background: "#fff", borderRadius: R.md, overflow: "hidden", boxShadow: "0 12px 40px #00000066", lineHeight: 0 },
  controls: { display: "flex", alignItems: "center", gap: SP.md, padding: "12px 20px", borderTop: "1px solid #262B38", flexWrap: "wrap" },
  durLabel: { fontSize: 12, color: "#9AA0AE", marginLeft: "auto", fontFamily: "'DM Mono',monospace" },
  timeline: { borderTop: "1px solid #262B38", paddingBottom: 10 },
  tick: { position: "absolute", fontSize: 10, color: "#5C6373", fontFamily: "'DM Mono',monospace", transform: "translateX(-50%)" },
  tlRow: { display: "flex", alignItems: "center", gap: SP.md, padding: "4px 20px", cursor: "pointer" },
  tlName: { width: 138, fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0, display: "flex", alignItems: "center", gap: 6 },
  tlTrack: { position: "relative", flex: 1, height: 14, background: "#1D2129", borderRadius: R.sm, overflow: "hidden" },
  tlBar: { position: "absolute", top: 2, bottom: 2, borderRadius: R.sm, minWidth: 4 },
  selName: { fontSize: 15, fontWeight: 700, paddingBottom: 4, borderBottom: "1px solid #262B38" },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, color: "#9AA0AE", display: "flex", justifyContent: "space-between" },
  mono: { fontFamily: "'DM Mono',monospace", color: "#8B7CFF" },
  select: { background: "#1D2129", color: "#EDEEF2", border: "1px solid #333A4A", borderRadius: R.md, padding: "8px 12px", fontSize: 13 },
  checkRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#C9CDD6", cursor: "pointer" },
  numInput: { width: 62, background: "#14161C", color: "#EDEEF2", border: "1px solid #333A4A", borderRadius: R.sm, padding: "4px 6px", fontSize: 12, fontFamily: "'DM Mono',monospace" },
  sectionHead: { fontSize: 11, letterSpacing: "0.1em", color: "#5FD6C4", fontWeight: 700, borderTop: "1px solid #262B38", paddingTop: 12, marginTop: 2 },
};
