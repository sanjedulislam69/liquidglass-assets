import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Liquid Glass Maker — Custom Glass PNG Generator" },
      {
        name: "description",
        content:
          "Create Apple-style liquid glass panels with edge glow, rim light and bevel refraction, then export a transparent PNG.",
      },
      { property: "og:title", content: "Liquid Glass Maker" },
      {
        property: "og:description",
        content:
          "Design a liquid glass shape with glow and edge light at any size and export it as a transparent PNG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Content = "none" | "text" | "image";
type Preset = "regular" | "clear" | "frosted";

function Index() {
  // shape
  const [w, setW] = useState(760);
  const [h, setH] = useState(260);
  const [radius, setRadius] = useState(130);

  // body
  const [opacity, setOpacity] = useState(14);
  const [tint, setTint] = useState("#ffffff");
  const [blur, setBlur] = useState(18);
  const [frost, setFrost] = useState(10);

  // edge / bevel
  const [bevel, setBevel] = useState(26);
  const [bevelStrength, setBevelStrength] = useState(75);
  const [rimLight, setRimLight] = useState(85);
  const [rimAngle, setRimAngle] = useState(315);
  const [borderWidth, setBorderWidth] = useState(1.5);
  const [borderOpacity, setBorderOpacity] = useState(60);

  // glow
  const [glow, setGlow] = useState(45);
  const [glowSize, setGlowSize] = useState(40);
  const [glowColor, setGlowColor] = useState("#ffffff");
  const [glowBloom, setGlowBloom] = useState(55);

  // corner / edge hotspot glow
  const [cornerGlow, setCornerGlow] = useState(80);
  const [cornerSpread, setCornerSpread] = useState(45);
  const [cornerColor, setCornerColor] = useState("#ffffff");

  // 3D depth / refraction
  const [depth, setDepth] = useState(60);
  const [caustic, setCaustic] = useState(45);
  const [droplet, setDroplet] = useState(false);

  // pre-made Apple-style presets
  const [simple, setSimple] = useState(false);
  const [preset, setPreset] = useState<Preset>("regular");


  // shadow
  const [shadow, setShadow] = useState(true);
  const [shadowBlur, setShadowBlur] = useState(40);
  const [shadowOpacity, setShadowOpacity] = useState(28);

  // specular
  const [sheen, setSheen] = useState(35);
  const [streak, setStreak] = useState(30);

  const [content, setContent] = useState<Content>("text");
  const [text, setText] = useState("Liquid Glass");
  const [fontSize, setFontSize] = useState(72);
  const [textColor, setTextColor] = useState("#ffffff");
  const [fontFamily, setFontFamily] = useState("Helvetica");
  const [bold, setBold] = useState(false);

  const [contentImg, setContentImg] = useState<HTMLImageElement | null>(null);
  const [imgScale, setImgScale] = useState(70);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [bgSize, setBgSize] = useState<{ w: number; h: number }>({ w: 1920, h: 1080 });
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [stageW, setStageW] = useState(900);
  const [includeContent, setIncludeContent] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const hex = (c: string, a: number) => {
    const n = parseInt(c.replace("#", ""), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };

  const pad = () =>
    Math.max(
      shadow ? shadowBlur * 2 : 0,
      glow > 0 ? glowSize * 2.2 : 0,
      cornerGlow > 0 ? cornerSpread * 3 : 0,
      8,
    );

  // two opposite hotspot points on the rim, driven by the light angle
  function hotspots(x: number, y: number) {
    const rad = (rimAngle * Math.PI) / 180;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const ux = Math.cos(rad);
    const uy = Math.sin(rad);
    // project onto rounded-rect boundary
    const t = Math.min(
      Math.abs(ux) > 1e-6 ? Math.abs(w / 2 / ux) : Infinity,
      Math.abs(uy) > 1e-6 ? Math.abs(h / 2 / uy) : Infinity,
    );
    const ax = cx + ux * t * 0.94;
    const ay = cy + uy * t * 0.94;
    const bx = cx - ux * t * 0.94;
    const by = cy - uy * t * 0.94;
    return [
      { x: ax, y: ay, k: 1 },
      { x: bx, y: by, k: 0.72 },
    ];
  }


  // ---------------------------------------------------------------
  // Real Apple-style liquid glass (preset mode): almost fully clear
  // body + a thick refracting 3D edge with a bright/dark/bright
  // profile and directional light on two opposite corners.
  // ---------------------------------------------------------------
  function drawApple(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const r = Math.min(w, h) / 2;
    const path = new Path2D();
    path.roundRect(x, y, w, h, r);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const clear = preset === "clear";
    const frosted = preset === "frosted";
    const thick = Math.max(8, Math.min(w, h) * (frosted ? 0.2 : clear ? 0.14 : 0.17));

    // directional axis (light from top-left, bounce bottom-right)
    const rad = (315 * Math.PI) / 180;
    const len = Math.max(w, h) / 2;
    const axis = (a0: number, aMid: number, a1: number) => {
      const g2 = ctx.createLinearGradient(
        cx - Math.cos(rad) * len,
        cy - Math.sin(rad) * len,
        cx + Math.cos(rad) * len,
        cy + Math.sin(rad) * len,
      );
      g2.addColorStop(0, `rgba(255,255,255,${a0})`);
      g2.addColorStop(0.42, `rgba(255,255,255,${aMid})`);
      g2.addColorStop(0.58, `rgba(255,255,255,${aMid})`);
      g2.addColorStop(1, `rgba(255,255,255,${a1})`);
      return g2;
    };

    // soft contact shadow
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,0.22)`;
    ctx.shadowBlur = Math.max(24, Math.min(w, h) * 0.28);
    ctx.shadowOffsetY = Math.max(8, Math.min(w, h) * 0.09);
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fill(path);
    ctx.globalCompositeOperation = "destination-out";
    ctx.fill(path);
    ctx.restore();

    ctx.save();
    ctx.clip(path);

    // body: barely-there tint, clearer in the middle
    const bodyA = frosted ? 0.16 : clear ? 0.03 : 0.07;
    const bg = ctx.createLinearGradient(x, y, x, y + h);
    bg.addColorStop(0, hex(tint, bodyA * 1.5));
    bg.addColorStop(0.5, hex(tint, bodyA * 0.5));
    bg.addColorStop(1, hex(tint, bodyA * 1.1));
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);

    if (frosted) {
      const n = Math.floor((w * h) / 1400);
      ctx.globalAlpha = 0.05;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? "#ffffff" : "#000000";
        ctx.fillRect(x + Math.random() * w, y + Math.random() * h, 1.2, 1.2);
      }
      ctx.globalAlpha = 1;
    }

    // thick refracting edge: bright rim -> dark dip -> soft inner bounce
    const steps = Math.max(24, Math.round(thick * 2));
    for (let i = 0; i < steps; i++) {
      const u = i / (steps - 1);
      const inset = u * thick;
      const bright =
        Math.exp(-Math.pow((u - 0.04) / 0.1, 2)) * 0.75 +
        Math.exp(-Math.pow((u - 0.6) / 0.3, 2)) * 0.14;
      const dark = Math.exp(-Math.pow((u - 0.26) / 0.13, 2)) * 0.26;
      const rp = new Path2D();
      rp.roundRect(
        x + inset,
        y + inset,
        Math.max(1, w - inset * 2),
        Math.max(1, h - inset * 2),
        Math.max(0, r - inset),
      );
      ctx.lineWidth = thick / steps + 1.2;
      if (dark > 0.004) {
        ctx.strokeStyle = `rgba(0,0,0,${dark})`;
        ctx.stroke(rp);
      }
      if (bright > 0.004) {
        ctx.strokeStyle = axis(bright, bright * 0.22, bright * 0.85);
        ctx.stroke(rp);
      }
    }

    // gentle top sheen and bottom refracted bounce
    const sh = ctx.createLinearGradient(x, y, x, y + h * 0.5);
    sh.addColorStop(0, `rgba(255,255,255,${clear ? 0.14 : 0.18})`);
    sh.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sh;
    ctx.fillRect(x, y, w, h * 0.5);

    const bh = Math.min(h * 0.35, thick * 1.6);
    const bo = ctx.createLinearGradient(x, y + h, x, y + h - bh);
    bo.addColorStop(0, "rgba(255,255,255,0.22)");
    bo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = bo;
    ctx.fillRect(x, y + h - bh, w, bh);

    // crisp outer hairline, brightest on the two lit corners
    ctx.lineWidth = 2;
    ctx.strokeStyle = axis(0.95, 0.3, 0.8);
    ctx.stroke(path);
    ctx.restore();
  }

  function drawGlass(canvas: HTMLCanvasElement, withContent: boolean) {
    const p = pad();
    canvas.width = w + p * 2;
    canvas.height = h + p * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const x = p;
    const y = p;
    if (simple) {
      drawApple(ctx, x, y);
      return;
    }
    const r = Math.min(radius, w / 2, h / 2);
    const path = new Path2D();
    path.roundRect(x, y, w, h, r);


    // outer glow (layered bloom around the whole rim)
    if (glow > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const layers = 4;
      for (let i = layers; i >= 1; i--) {
        ctx.shadowColor = hex(glowColor, (glow / 100) * (0.34 / i) * (0.5 + glowBloom / 100));
        ctx.shadowBlur = glowSize * i * (0.5 + glowBloom / 100);
        ctx.strokeStyle = hex(glowColor, 0.001);
        ctx.lineWidth = 2;
        ctx.stroke(path);
      }
      ctx.restore();
    }

    // corner / edge hotspot glow (light catching two opposite edges)
    if (cornerGlow > 0) {
      const k = cornerGlow / 100;
      const rad0 = Math.max(24, cornerSpread * 2.4);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const s of hotspots(x, y)) {
        const rg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad0);
        rg.addColorStop(0, hex(cornerColor, 0.85 * k * s.k));
        rg.addColorStop(0.25, hex(cornerColor, 0.4 * k * s.k));
        rg.addColorStop(0.6, hex(cornerColor, 0.12 * k * s.k));
        rg.addColorStop(1, hex(cornerColor, 0));
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(s.x, s.y, rad0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // hot bright arc riding the edge itself
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const s of hotspots(x, y)) {
        const rg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad0 * 0.9);
        rg.addColorStop(0, hex(cornerColor, k * s.k));
        rg.addColorStop(0.45, hex(cornerColor, 0.28 * k * s.k));
        rg.addColorStop(1, hex(cornerColor, 0));
        ctx.strokeStyle = rg;
        ctx.lineWidth = Math.max(2, bevel * 0.5);
        ctx.stroke(path);
      }
      ctx.restore();
    }


    // drop shadow
    if (shadow) {
      ctx.save();
      ctx.shadowColor = `rgba(0,0,0,${shadowOpacity / 100})`;
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetY = shadowBlur / 2.5;
      ctx.fillStyle = "rgba(0,0,0,0.9)";
      ctx.globalCompositeOperation = "source-over";
      ctx.fill(path);
      ctx.globalCompositeOperation = "destination-out";
      ctx.fill(path);
      ctx.restore();
    }

    // body
    ctx.save();
    ctx.clip(path);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, hex(tint, (opacity / 100) * 1.4));
    g.addColorStop(0.55, hex(tint, (opacity / 100) * 0.55));
    g.addColorStop(1, hex(tint, (opacity / 100) * 1.15));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    // frost noise
    if (frost > 0) {
      const n = Math.floor((w * h) / 900) * (frost / 10);
      ctx.globalAlpha = 0.04 * (frost / 10);
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? "#ffffff" : "#000000";
        ctx.fillRect(x + Math.random() * w, y + Math.random() * h, 1.2, 1.2);
      }
      ctx.globalAlpha = 1;
    }

    // 3D depth: light pools at the top edge, body darkens toward the bottom
    if (depth > 0) {
      const k = depth / 100;
      const dg = ctx.createLinearGradient(x, y, x, y + h);
      dg.addColorStop(0, `rgba(0,0,0,0)`);
      dg.addColorStop(0.55, `rgba(0,0,0,${0.06 * k})`);
      dg.addColorStop(1, `rgba(0,0,0,${0.22 * k})`);
      ctx.fillStyle = dg;
      ctx.fillRect(x, y, w, h);
      // refracted light band just inside the top edge
      const tb = ctx.createLinearGradient(x, y, x, y + Math.min(h * 0.3, bevel * 2.2 + 24));
      tb.addColorStop(0, hex("#ffffff", 0.32 * k));
      tb.addColorStop(1, hex("#ffffff", 0));
      ctx.fillStyle = tb;
      ctx.fillRect(x, y, w, Math.min(h * 0.3, bevel * 2.2 + 24));
    }

    // caustic: bright refracted band hugging the bottom inside edge
    if (caustic > 0) {
      const k = caustic / 100;
      const ch = Math.min(h * 0.42, bevel * 1.6 + 34);
      const cg = ctx.createLinearGradient(x, y + h, x, y + h - ch);
      cg.addColorStop(0, hex("#ffffff", 0.5 * k));
      cg.addColorStop(0.4, hex("#ffffff", 0.16 * k));
      cg.addColorStop(1, hex("#ffffff", 0));
      ctx.fillStyle = cg;
      ctx.fillRect(x, y + h - ch, w, ch);
    }

    // 3D droplet: convex water-drop lens look
    if (droplet) {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const R = Math.max(w, h) * 0.85;
      // domed bulge highlight, pooled slightly above center
      const bg2 = ctx.createRadialGradient(cx, y + h * 0.3, 0, cx, y + h * 0.3, R);
      bg2.addColorStop(0, "rgba(255,255,255,0.34)");
      bg2.addColorStop(0.3, "rgba(255,255,255,0.10)");
      bg2.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = bg2;
      ctx.fillRect(x, y, w, h);
      // meniscus: rim darkens toward the edges like a water drop
      const eg2 = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.18, cx, cy, R);
      eg2.addColorStop(0, "rgba(0,0,0,0)");
      eg2.addColorStop(0.65, "rgba(0,0,0,0.06)");
      eg2.addColorStop(1, "rgba(0,0,0,0.30)");
      ctx.fillStyle = eg2;
      ctx.fillRect(x, y, w, h);
      // bright refracted crescent along the bottom rim
      const cc2 = ctx.createRadialGradient(cx, y + h, 0, cx, y + h, Math.min(w, h) * 0.95);
      cc2.addColorStop(0, "rgba(255,255,255,0.55)");
      cc2.addColorStop(0.25, "rgba(255,255,255,0.14)");
      cc2.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = cc2;
      ctx.fillRect(x, y, w, h);
    }

    // top sheen
    if (sheen > 0) {
      const s = ctx.createLinearGradient(x, y, x, y + h * 0.55);
      s.addColorStop(0, hex("#ffffff", sheen / 100));
      s.addColorStop(1, hex("#ffffff", 0));
      ctx.fillStyle = s;
      ctx.fillRect(x, y, w, h * 0.55);
    }

    // diagonal specular streak
    if (streak > 0) {
      ctx.save();
      ctx.translate(x + w * 0.3, y);
      ctx.rotate((-18 * Math.PI) / 180);
      const sg = ctx.createLinearGradient(0, 0, w * 0.35, 0);
      sg.addColorStop(0, hex("#ffffff", 0));
      sg.addColorStop(0.5, hex("#ffffff", (streak / 100) * 0.5));
      sg.addColorStop(1, hex("#ffffff", 0));
      ctx.fillStyle = sg;
      ctx.fillRect(0, -h, w * 0.35, h * 3);
      ctx.restore();
    }

    // inner bevel (refracting edge): bright inner ring fading inward
    if (bevel > 0 && bevelStrength > 0) {
      const k = bevelStrength / 100;
      const steps = Math.max(6, Math.round(bevel));
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const inset = t * bevel;
        const a = Math.pow(1 - t, 2.2) * 0.55 * k;
        const rp = new Path2D();
        rp.roundRect(x + inset, y + inset, w - inset * 2, h - inset * 2, Math.max(0, r - inset));
        ctx.strokeStyle = hex("#ffffff", a);
        ctx.lineWidth = bevel / steps + 1;
        ctx.stroke(rp);
      }
      // inner dark contact shadow just inside the rim for thickness
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const inset = bevel * 0.35 + t * bevel * 0.9;
        const a = Math.pow(1 - t, 2.5) * 0.16 * k;
        const rp = new Path2D();
        rp.roundRect(x + inset, y + inset, w - inset * 2, h - inset * 2, Math.max(0, r - inset));
        ctx.strokeStyle = `rgba(0,0,0,${a})`;
        ctx.lineWidth = bevel / steps + 1;
        ctx.stroke(rp);
      }
    }
    ctx.restore();

    // rim light (directional bright edge)
    if (rimLight > 0) {
      const rad = (rimAngle * Math.PI) / 180;
      const cx = x + w / 2;
      const cy = y + h / 2;
      const len = Math.max(w, h) / 2;
      const rg = ctx.createLinearGradient(
        cx - Math.cos(rad) * len,
        cy - Math.sin(rad) * len,
        cx + Math.cos(rad) * len,
        cy + Math.sin(rad) * len,
      );
      const k = rimLight / 100;
      rg.addColorStop(0, hex("#ffffff", k));
      rg.addColorStop(0.35, hex("#ffffff", k * 0.15));
      rg.addColorStop(0.65, hex("#ffffff", k * 0.15));
      rg.addColorStop(1, hex("#ffffff", k * 0.9));
      ctx.save();
      ctx.clip(path);
      ctx.strokeStyle = rg;
      ctx.lineWidth = Math.max(2, bevel * 0.28) * 2;
      ctx.stroke(path);
      ctx.restore();
    }

    // hairline border
    if (borderWidth > 0) {
      ctx.save();
      ctx.clip(path);
      ctx.strokeStyle = hex("#ffffff", borderOpacity / 100);
      ctx.lineWidth = borderWidth * 2;
      ctx.stroke(path);
      ctx.restore();
    }

    if (!withContent) return;

    ctx.save();
    ctx.clip(path);
    if (content === "text" && text) {
      ctx.fillStyle = textColor;
      ctx.font = `${bold ? "bold " : ""}${fontSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x + w / 2, y + h / 2);
    } else if (content === "image" && contentImg) {
      const s = Math.min(
        (w * (imgScale / 100)) / contentImg.width,
        (h * (imgScale / 100)) / contentImg.height,
      );
      const iw = contentImg.width * s;
      const ih = contentImg.height * s;
      ctx.drawImage(contentImg, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    }
    ctx.restore();
  }

  const sigRef = useRef("");
  useEffect(() => {
    const sig = JSON.stringify([
      w, h, radius, opacity, tint, blur, frost, bevel, bevelStrength,
      rimLight, rimAngle, borderWidth, borderOpacity, glow, glowSize,
      glowColor, glowBloom, cornerGlow, cornerSpread, cornerColor,
      depth, caustic, droplet, shadow, shadowBlur, shadowOpacity, sheen, streak,
      content, text, fontSize, textColor, fontFamily, bold, contentImg,
      imgScale, includeContent,
    ]);
    if (sig === sigRef.current) return;
    sigRef.current = sig;
    const raf = requestAnimationFrame(() => {
      if (!canvasRef.current) return;
      drawGlass(canvasRef.current, includeContent);
      const liveCanvas = liveCanvasRef.current;
      const liveContext = liveCanvas?.getContext("2d");
      if (!liveCanvas || !liveContext) return;
      liveCanvas.width = canvasRef.current.width;
      liveCanvas.height = canvasRef.current.height;
      liveContext.drawImage(canvasRef.current, 0, 0);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  function exportPng() {
    const c = document.createElement("canvas");
    drawGlass(c, includeContent);
    const a = document.createElement("a");
    a.download = "liquid-glass.png";
    a.href = c.toDataURL("image/png");
    a.click();
  }

  function loadFile(file: File, cb: (url: string) => void) {
    const reader = new FileReader();
    reader.onload = () => cb(reader.result as string);
    reader.readAsDataURL(file);
  }

  // Apple-style tuned presets: restrained specular, thin bright hairline,
  // soft wide shadow, gentle inner bevel — no heavy glow.
  function applyApplePreset(v: Preset) {
    setRadius(Math.round(Math.min(w, h) * 0.45));
    setRimAngle(300);
    setBevel(Math.max(14, Math.round(Math.min(w, h) * 0.09)));
    setBevelStrength(62);
    setRimLight(58);
    setBorderWidth(1);
    setBorderOpacity(46);
    setGlow(10);
    setGlowSize(20);
    setGlowColor("#ffffff");
    setGlowBloom(22);
    setCornerGlow(34);
    setCornerSpread(24);
    setCornerColor("#ffffff");
    setDepth(34);
    setCaustic(20);
    setDroplet(false);
    setShadow(true);
    setShadowBlur(46);
    setShadowOpacity(20);
    setStreak(10);
    setContent("none");
    if (v === "clear") {
      setOpacity(8);
      setBlur(14);
      setFrost(2);
      setSheen(26);
    } else if (v === "frosted") {
      setOpacity(22);
      setBlur(34);
      setFrost(13);
      setSheen(18);
    } else {
      setOpacity(13);
      setBlur(22);
      setFrost(5);
      setSheen(22);
    }
  }

  // in preset mode the corner radius always follows the size (Apple capsule feel)
  useEffect(() => {
    if (simple) setRadius(Math.round(Math.min(w, h) * 0.45));
  }, [simple, w, h]);

  // measure the stage column so the background can be fit to it
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageW(el.clientWidth));
    ro.observe(el);
    setStageW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const MAX_STAGE_H = 620;
  const scale = Math.min(Math.max(stageW - 20, 200) / bgSize.w, MAX_STAGE_H / bgSize.h, 1);
  const dispW = bgSize.w * scale;
  const dispH = bgSize.h * scale;
  const glassPos = pos ?? { x: (bgSize.w - w) / 2, y: (bgSize.h - h) / 2 };

  function onDragStart(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      dx: e.clientX / scale - glassPos.x,
      dy: e.clientY / scale - glassPos.y,
    };
  }
  function onDragMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    setPos({ x: e.clientX / scale - d.dx, y: e.clientY / scale - d.dy });
  }
  function onDragEnd() {
    dragRef.current = null;
  }

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center gap-2 py-1">
      <span className="w-36 shrink-0 text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );

  const p = pad();

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <h1 className="mb-1 text-2xl font-bold">Liquid Glass Maker</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Real glass edges: bevel refraction, rim light, outer glow. Export transparent PNG.
      </p>

      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <section className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Pre-made Apple glass</h2>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={simple}
                  onChange={(e) => {
                    setSimple(e.target.checked);
                    if (e.target.checked) applyApplePreset(preset);
                  }}
                />
                Preset mode
              </label>
            </div>
            <Row label="Preset">
              <select
                value={preset}
                onChange={(e) => {
                  const v = e.target.value as Preset;
                  setPreset(v);
                  applyApplePreset(v);
                }}
                className="rounded border bg-background px-2 py-1 text-sm"
              >
                <option value="regular">Regular (Apple)</option>
                <option value="clear">Clear</option>
                <option value="frosted">Frosted</option>
              </select>
            </Row>
            <Row label={`Width ${w}px`}>
              <input type="range" min={50} max={1920} value={w} onChange={(e) => setW(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Height ${h}px`}>
              <input type="range" min={40} max={1080} value={h} onChange={(e) => setH(+e.target.value)} className="w-full" />
            </Row>
            <Row label="Glass color">
              <input type="color" value={tint} onChange={(e) => setTint(e.target.value)} />
            </Row>
            <button
              onClick={() => applyApplePreset(preset)}
              className="mt-2 w-full rounded border px-3 py-1.5 text-xs"
            >
              Load preset
            </button>
            <p className="mt-2 text-xs text-muted-foreground">
              Preset mode hides all advanced controls — set size and color, then export.
            </p>
          </section>

          {!simple && (
          <>
          <section className="rounded-md border p-3">
            <h2 className="mb-2 font-semibold">Shape</h2>
            <Row label={`Width ${w}px`}>
              <input type="range" min={50} max={1920} value={w} onChange={(e) => setW(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Height ${h}px`}>
              <input type="range" min={40} max={1080} value={h} onChange={(e) => setH(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Radius ${radius}`}>
              <input type="range" min={0} max={540} value={radius} onChange={(e) => setRadius(+e.target.value)} className="w-full" />
            </Row>
          </section>

          <section className="rounded-md border p-3">
            <h2 className="mb-2 font-semibold">Glass body</h2>
            <Row label={`Fill ${opacity}%`}>
              <input type="range" min={0} max={60} value={opacity} onChange={(e) => setOpacity(+e.target.value)} className="w-full" />
            </Row>
            <Row label="Glass color">
              <input type="color" value={tint} onChange={(e) => setTint(e.target.value)} />
            </Row>
            <Row label="3D droplet">
              <input type="checkbox" checked={droplet} onChange={(e) => setDroplet(e.target.checked)} />
            </Row>
            <Row label={`Preview blur ${blur}`}>
              <input type="range" min={0} max={60} value={blur} onChange={(e) => setBlur(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Frost ${frost}`}>
              <input type="range" min={0} max={30} value={frost} onChange={(e) => setFrost(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Top sheen ${sheen}%`}>
              <input type="range" min={0} max={100} value={sheen} onChange={(e) => setSheen(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Streak ${streak}%`}>
              <input type="range" min={0} max={100} value={streak} onChange={(e) => setStreak(+e.target.value)} className="w-full" />
            </Row>
          </section>

          <section className="rounded-md border p-3">
            <h2 className="mb-2 font-semibold">Edge & thickness</h2>
            <Row label={`Bevel ${bevel}px`}>
              <input type="range" min={0} max={80} value={bevel} onChange={(e) => setBevel(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Bevel power ${bevelStrength}%`}>
              <input type="range" min={0} max={100} value={bevelStrength} onChange={(e) => setBevelStrength(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Rim light ${rimLight}%`}>
              <input type="range" min={0} max={100} value={rimLight} onChange={(e) => setRimLight(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Light angle ${rimAngle}°`}>
              <input type="range" min={0} max={360} value={rimAngle} onChange={(e) => setRimAngle(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Hairline ${borderWidth}px`}>
              <input type="range" min={0} max={8} step={0.5} value={borderWidth} onChange={(e) => setBorderWidth(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Hairline op ${borderOpacity}%`}>
              <input type="range" min={0} max={100} value={borderOpacity} onChange={(e) => setBorderOpacity(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`3D depth ${depth}%`}>
              <input type="range" min={0} max={100} value={depth} onChange={(e) => setDepth(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Caustic ${caustic}%`}>
              <input type="range" min={0} max={100} value={caustic} onChange={(e) => setCaustic(+e.target.value)} className="w-full" />
            </Row>
          </section>

          <section className="rounded-md border p-3">
            <h2 className="mb-2 font-semibold">Glow & shadow</h2>
            <Row label={`Glow ${glow}%`}>
              <input type="range" min={0} max={100} value={glow} onChange={(e) => setGlow(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Glow size ${glowSize}`}>
              <input type="range" min={0} max={120} value={glowSize} onChange={(e) => setGlowSize(+e.target.value)} className="w-full" />
            </Row>
            <Row label="Glow color">
              <input type="color" value={glowColor} onChange={(e) => setGlowColor(e.target.value)} />
            </Row>
            <Row label={`Bloom ${glowBloom}%`}>
              <input type="range" min={0} max={100} value={glowBloom} onChange={(e) => setGlowBloom(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Edge glow ${cornerGlow}%`}>
              <input type="range" min={0} max={100} value={cornerGlow} onChange={(e) => setCornerGlow(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Edge spread ${cornerSpread}`}>
              <input type="range" min={0} max={120} value={cornerSpread} onChange={(e) => setCornerSpread(+e.target.value)} className="w-full" />
            </Row>
            <Row label="Edge glow color">
              <input type="color" value={cornerColor} onChange={(e) => setCornerColor(e.target.value)} />
            </Row>
            <Row label="Drop shadow">
              <input type="checkbox" checked={shadow} onChange={(e) => setShadow(e.target.checked)} />
            </Row>
            {shadow && (
              <>
                <Row label={`Shadow blur ${shadowBlur}`}>
                  <input type="range" min={0} max={120} value={shadowBlur} onChange={(e) => setShadowBlur(+e.target.value)} className="w-full" />
                </Row>
                <Row label={`Shadow op ${shadowOpacity}%`}>
                  <input type="range" min={0} max={100} value={shadowOpacity} onChange={(e) => setShadowOpacity(+e.target.value)} className="w-full" />
                </Row>
              </>
            )}
          </section>

          <section className="rounded-md border p-3">
            <h2 className="mb-2 font-semibold">Content</h2>
            <Row label="Type">
              <select
                value={content}
                onChange={(e) => setContent(e.target.value as Content)}
                className="rounded border bg-background px-2 py-1 text-sm"
              >
                <option value="none">None</option>
                <option value="text">Text</option>
                <option value="image">Image</option>
              </select>
            </Row>
            {content === "text" && (
              <>
                <Row label="Text">
                  <input value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded border bg-background px-2 py-1 text-sm" />
                </Row>
                <Row label={`Font size ${fontSize}`}>
                  <input type="range" min={8} max={240} value={fontSize} onChange={(e) => setFontSize(+e.target.value)} className="w-full" />
                </Row>
                <Row label="Font">
                  <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="rounded border bg-background px-2 py-1 text-sm">
                    {["Helvetica", "Arial", "Georgia", "Impact", "Courier New", "Verdana", "Trebuchet MS"].map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </Row>
                <Row label="Color">
                  <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
                </Row>
                <Row label="Bold">
                  <input type="checkbox" checked={bold} onChange={(e) => setBold(e.target.checked)} />
                </Row>
                <button
                  onClick={() => {
                    const c = document.createElement("canvas").getContext("2d");
                    if (!c) return;
                    c.font = `${bold ? "bold " : ""}${fontSize}px ${fontFamily}`;
                    const m = c.measureText(text);
                    setW(Math.round(m.width + fontSize * 1.6));
                    setH(Math.round(fontSize * 2.6));
                  }}
                  className="mt-2 w-full rounded border px-3 py-1.5 text-xs"
                >
                  Fit glass to text
                </button>
              </>
            )}
            {content === "image" && (
              <>
                <Row label="Image file">
                  <input
                    type="file"
                    accept="image/*"
                    className="text-xs"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        loadFile(f, (url) => {
                          const img = new Image();
                          img.onload = () => setContentImg(img);
                          img.src = url;
                        });
                    }}
                  />
                </Row>
                <Row label={`Scale ${imgScale}%`}>
                  <input type="range" min={10} max={100} value={imgScale} onChange={(e) => setImgScale(+e.target.value)} className="w-full" />
                </Row>
              </>
            )}
          </section>
          </>
          )}

          <section className="rounded-md border p-3">
            <h2 className="mb-2 font-semibold">Preview background (video frame)</h2>
            <input
              type="file"
              accept="image/*"
              className="text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                loadFile(f, (url) => {
                  const img = new Image();
                  img.onload = () => {
                    setBgSize({ w: img.naturalWidth, h: img.naturalHeight });
                    setPos(null);
                    setBgUrl(url);
                  };
                  img.src = url;
                });
              }}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Preview only — never exported. Drag the glass on the frame to place it.
            </p>
          </section>

          <section className="rounded-md border p-3">
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeContent} onChange={(e) => setIncludeContent(e.target.checked)} />
              Include text/image in exported PNG
            </label>
            <button onClick={exportPng} className="w-full rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Export transparent PNG
            </button>
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <div ref={stageRef}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Scene preview</h2>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {bgSize.w}×{bgSize.h} · {Math.round(scale * 100)}%
                </span>
                <button className="rounded border px-2 py-1" onClick={() => setPos(null)}>
                  Center glass
                </button>
              </div>
            </div>
            <div className="flex justify-center rounded-md border bg-[repeating-conic-gradient(#e5e5e5_0_25%,#ffffff_0_50%)] bg-[length:24px_24px] p-2">
              <div
                className="relative overflow-hidden"
                style={{
                  width: dispW,
                  height: dispH,
                  backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
                  backgroundSize: "100% 100%",
                  backgroundColor: bgUrl ? undefined : "#111",
                }}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragEnd}
              >
                <div
                  className="absolute cursor-move touch-none"
                  style={{
                    left: (glassPos.x - p) * scale,
                    top: (glassPos.y - p) * scale,
                    width: (w + p * 2) * scale,
                    height: (h + p * 2) * scale,
                  }}
                  onPointerDown={onDragStart}
                >
                  <div
                    className="pointer-events-none absolute"
                    style={{
                      left: p * scale,
                      top: p * scale,
                      width: w * scale,
                      height: h * scale,
                      borderRadius: radius * scale,
                      backdropFilter: `blur(${blur * scale}px) saturate(170%)`,
                    }}
                  />
                  <canvas
                    ref={liveCanvasRef}
                    aria-label="Glass preview"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  />
                </div>
              </div>
            </div>
            {!bgUrl && (
              <p className="mt-2 text-xs text-muted-foreground">
                Upload a frame from your video on the left to preview the glass on it.
              </p>
            )}
          </div>

          <div>
            <h2 className="mb-2 font-semibold">Exported PNG preview (transparent)</h2>
            <div className="overflow-auto rounded-md border bg-[repeating-conic-gradient(#e5e5e5_0_25%,#ffffff_0_50%)] bg-[length:24px_24px] p-4">
              <canvas ref={canvasRef} className="max-w-full" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
