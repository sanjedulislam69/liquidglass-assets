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
  const [includeContent, setIncludeContent] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [overlay, setOverlay] = useState<string>("");

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


  function drawGlass(canvas: HTMLCanvasElement, withContent: boolean) {
    const p = pad();
    canvas.width = w + p * 2;
    canvas.height = h + p * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const x = p;
    const y = p;
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

  useEffect(() => {
    if (!canvasRef.current) return;
    drawGlass(canvasRef.current, includeContent);
    const o = document.createElement("canvas");
    drawGlass(o, true);
    setOverlay(o.toDataURL("image/png"));
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
            <Row label="Tint">
              <input type="color" value={tint} onChange={(e) => setTint(e.target.value)} />
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

          <section className="rounded-md border p-3">
            <h2 className="mb-2 font-semibold">Preview background</h2>
            <input
              type="file"
              accept="image/*"
              className="text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadFile(f, setBgUrl);
              }}
            />
            <p className="mt-2 text-xs text-muted-foreground">Preview only — never exported.</p>
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

        <div className="space-y-6">
          <div>
            <h2 className="mb-2 font-semibold">Live preview (real blur + exported glass on top)</h2>
            <div
              className="relative flex min-h-[460px] items-center justify-center overflow-auto rounded-md border bg-[repeating-conic-gradient(#e5e5e5_0_25%,#ffffff_0_50%)] bg-[length:24px_24px] p-6"
              style={bgUrl ? { backgroundImage: `url(${bgUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              <div className="relative shrink-0" style={{ width: w + p * 2, height: h + p * 2 }}>
                <div
                  className="absolute"
                  style={{
                    left: p,
                    top: p,
                    width: w,
                    height: h,
                    borderRadius: radius,
                    backdropFilter: `blur(${blur}px) saturate(170%)`,
                  }}
                />
                {overlay && (
                  <img src={overlay} alt="Glass preview" className="absolute inset-0 h-full w-full" />
                )}
              </div>
            </div>
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
