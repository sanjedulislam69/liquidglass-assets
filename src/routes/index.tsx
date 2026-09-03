import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Liquid Glass Maker — Custom Glass PNG Generator" },
      {
        name: "description",
        content:
          "Create Apple-style liquid glass panels at any size, preview text or images on top, and export a transparent PNG.",
      },
      { property: "og:title", content: "Liquid Glass Maker" },
      {
        property: "og:description",
        content:
          "Design a liquid glass shape at any size and export it as a transparent PNG for videos and thumbnails.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Content = "none" | "text" | "image";

function Index() {
  const [w, setW] = useState(700);
  const [h, setH] = useState(220);
  const [radius, setRadius] = useState(110);
  const [opacity, setOpacity] = useState(22);
  const [borderOpacity, setBorderOpacity] = useState(70);
  const [borderWidth, setBorderWidth] = useState(2);
  const [tint, setTint] = useState("#ffffff");
  const [blur, setBlur] = useState(14);
  const [shadow, setShadow] = useState(true);
  const [shadowBlur, setShadowBlur] = useState(30);
  const [shadowOpacity, setShadowOpacity] = useState(30);

  const [content, setContent] = useState<Content>("text");
  const [text, setText] = useState("Welcome to my channel");
  const [fontSize, setFontSize] = useState(56);
  const [textColor, setTextColor] = useState("#ffffff");
  const [fontFamily, setFontFamily] = useState("Arial");
  const [bold, setBold] = useState(true);

  const [contentImg, setContentImg] = useState<HTMLImageElement | null>(null);
  const [imgScale, setImgScale] = useState(80);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [includeContent, setIncludeContent] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const hex = (c: string, a: number) => {
    const n = parseInt(c.replace("#", ""), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };

  function draw(canvas: HTMLCanvasElement, forExport: boolean) {
    const pad = shadow ? shadowBlur * 2 : 0;
    canvas.width = w + pad * 2;
    canvas.height = h + pad * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const x = pad;
    const y = pad;
    const r = Math.min(radius, w / 2, h / 2);

    const path = new Path2D();
    path.roundRect(x, y, w, h, r);

    if (shadow) {
      ctx.save();
      ctx.shadowColor = `rgba(0,0,0,${shadowOpacity / 100})`;
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetY = shadowBlur / 3;
      ctx.fillStyle = "rgba(0,0,0,0.001)";
      ctx.fill(path);
      ctx.fillStyle = hex(tint, 0.001);
      ctx.fill(path);
      ctx.restore();
    }

    // glass body
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, hex(tint, (opacity / 100) * 1.25));
    g.addColorStop(0.5, hex(tint, (opacity / 100) * 0.7));
    g.addColorStop(1, hex(tint, (opacity / 100) * 1.05));
    ctx.fillStyle = g;
    ctx.fill(path);

    // top sheen
    ctx.save();
    ctx.clip(path);
    const sheen = ctx.createLinearGradient(x, y, x, y + h * 0.5);
    sheen.addColorStop(0, hex("#ffffff", 0.35));
    sheen.addColorStop(1, hex("#ffffff", 0));
    ctx.fillStyle = sheen;
    ctx.fillRect(x, y, w, h * 0.5);
    ctx.restore();

    // border
    if (borderWidth > 0) {
      const bg = ctx.createLinearGradient(x, y, x + w, y + h);
      bg.addColorStop(0, hex("#ffffff", borderOpacity / 100));
      bg.addColorStop(0.5, hex("#ffffff", (borderOpacity / 100) * 0.3));
      bg.addColorStop(1, hex("#ffffff", borderOpacity / 100));
      ctx.strokeStyle = bg;
      ctx.lineWidth = borderWidth;
      ctx.save();
      ctx.clip(path);
      ctx.lineWidth = borderWidth * 2;
      ctx.stroke(path);
      ctx.restore();
    }

    if (!includeContent && forExport) return;

    ctx.save();
    ctx.clip(path);
    if (content === "text" && text) {
      ctx.fillStyle = textColor;
      ctx.font = `${bold ? "bold " : ""}${fontSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x + w / 2, y + h / 2);
    } else if (content === "image" && contentImg) {
      const s = Math.min((w * (imgScale / 100)) / contentImg.width, (h * (imgScale / 100)) / contentImg.height);
      const iw = contentImg.width * s;
      const ih = contentImg.height * s;
      ctx.drawImage(contentImg, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    }
    ctx.restore();
  }

  useEffect(() => {
    if (canvasRef.current) draw(canvasRef.current, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  function exportPng() {
    const c = document.createElement("canvas");
    draw(c, true);
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
      <span className="w-32 shrink-0 text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <h1 className="mb-1 text-2xl font-bold">Liquid Glass Maker</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Size the glass, drop text or an image on it, export a transparent PNG.
      </p>

      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <section className="rounded-md border p-3">
            <h2 className="mb-2 font-semibold">Glass</h2>
            <Row label={`Width ${w}px`}>
              <input type="range" min={50} max={1920} value={w} onChange={(e) => setW(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Height ${h}px`}>
              <input type="range" min={40} max={1080} value={h} onChange={(e) => setH(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Radius ${radius}`}>
              <input type="range" min={0} max={540} value={radius} onChange={(e) => setRadius(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Fill ${opacity}%`}>
              <input type="range" min={0} max={80} value={opacity} onChange={(e) => setOpacity(+e.target.value)} className="w-full" />
            </Row>
            <Row label="Tint">
              <input type="color" value={tint} onChange={(e) => setTint(e.target.value)} />
            </Row>
            <Row label={`Border ${borderWidth}px`}>
              <input type="range" min={0} max={12} value={borderWidth} onChange={(e) => setBorderWidth(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Border op ${borderOpacity}%`}>
              <input type="range" min={0} max={100} value={borderOpacity} onChange={(e) => setBorderOpacity(+e.target.value)} className="w-full" />
            </Row>
            <Row label={`Preview blur ${blur}`}>
              <input type="range" min={0} max={40} value={blur} onChange={(e) => setBlur(+e.target.value)} className="w-full" />
            </Row>
            <Row label="Drop shadow">
              <input type="checkbox" checked={shadow} onChange={(e) => setShadow(e.target.checked)} />
            </Row>
            {shadow && (
              <>
                <Row label={`Shadow blur ${shadowBlur}`}>
                  <input type="range" min={0} max={100} value={shadowBlur} onChange={(e) => setShadowBlur(+e.target.value)} className="w-full" />
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
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full rounded border bg-background px-2 py-1 text-sm"
                  />
                </Row>
                <Row label={`Font size ${fontSize}`}>
                  <input type="range" min={8} max={200} value={fontSize} onChange={(e) => setFontSize(+e.target.value)} className="w-full" />
                </Row>
                <Row label="Font">
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="rounded border bg-background px-2 py-1 text-sm"
                  >
                    {["Arial", "Georgia", "Impact", "Courier New", "Verdana", "Trebuchet MS"].map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </Row>
                <Row label="Color">
                  <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
                </Row>
                <Row label="Bold">
                  <input type="checkbox" checked={bold} onChange={(e) => setBold(e.target.checked)} />
                </Row>
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
            <p className="mt-2 text-xs text-muted-foreground">Only for previewing; never exported.</p>
          </section>

          <section className="rounded-md border p-3">
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeContent} onChange={(e) => setIncludeContent(e.target.checked)} />
              Include text/image in exported PNG
            </label>
            <button
              onClick={exportPng}
              className="w-full rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Export transparent PNG
            </button>
          </section>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="mb-2 font-semibold">Live preview (real blur over background)</h2>
            <div
              className="relative flex min-h-[420px] items-center justify-center overflow-auto rounded-md border bg-[repeating-conic-gradient(#e5e5e5_0_25%,#ffffff_0_50%)] bg-[length:24px_24px] p-6"
              style={bgUrl ? { backgroundImage: `url(${bgUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              <div
                className="flex shrink-0 items-center justify-center overflow-hidden"
                style={{
                  width: w,
                  height: h,
                  borderRadius: radius,
                  backgroundColor: hex(tint, opacity / 100),
                  backdropFilter: `blur(${blur}px) saturate(160%)`,
                  border: `${borderWidth}px solid ${hex("#ffffff", borderOpacity / 100)}`,
                  boxShadow: shadow ? `0 ${shadowBlur / 3}px ${shadowBlur}px rgba(0,0,0,${shadowOpacity / 100})` : "none",
                }}
              >
                {content === "text" && (
                  <span
                    style={{
                      fontSize,
                      color: textColor,
                      fontFamily,
                      fontWeight: bold ? 700 : 400,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {text}
                  </span>
                )}
                {content === "image" && contentImg && (
                  <img src={contentImg.src} alt="Content" style={{ maxWidth: `${imgScale}%`, maxHeight: `${imgScale}%` }} />
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
