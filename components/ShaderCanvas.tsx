'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uRipple;
  uniform vec3 uDark;
  uniform vec3 uMid1;
  uniform vec3 uMid2;
  uniform vec3 uLight;
  varying vec2 vUv;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(dot(hash2(i + vec2(0,0)), f - vec2(0,0)),
          dot(hash2(i + vec2(1,0)), f - vec2(1,0)), u.x),
      mix(dot(hash2(i + vec2(0,1)), f - vec2(0,1)),
          dot(hash2(i + vec2(1,1)), f - vec2(1,1)), u.x), u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p *= 2.0; p += vec2(3.1, 1.7);
      a *= 0.5;
    }
    return v;
  }

  float warp(vec2 p) {
    vec2 q = vec2(fbm(p + vec2(0.0, 0.0) + uTime * 0.05),
                  fbm(p + vec2(5.2, 1.3) + uTime * 0.04));
    vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2)),
                  fbm(p + 4.0 * q + vec2(8.3, 2.8)));
    return fbm(p + 4.0 * r);
  }

  void main() {
    vec2 p = vUv * 2.5;

    vec2 m = uMouse * 2.5;
    float d = length(p - m);
    p += uRipple * sin(d * 12.0 - uTime * 4.0) / (d * d + 0.3) * normalize(p - m + 0.001);

    float n = warp(p);
    float t = n * 0.5 + 0.5;

    vec3 col = mix(uDark, uMid1, smoothstep(0.0, 0.4, t));
    col      = mix(col,   uMid2, smoothstep(0.35, 0.65, t));
    col      = mix(col,   uLight, smoothstep(0.7, 0.95, t));

    gl_FragColor = vec4(col, 1.0);
  }
`;

const DEFAULT_ASCII = ' .\'`^",:;Il!i~+_-?][}{1)(|\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$wookyungmin';

const ASCII_PRESETS = {
  default: DEFAULT_ASCII,
  minimal: ' .:-=+*#%@',
  matrix: ' .,:;i1tfLCG08@',
  binary: ' 01',
  korean: ' ㆍㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ가나다라마바사아자차카타파하',
} as const;

type DensityPreset = 'clean' | 'balanced' | 'rough';
type PalettePreset = 'current' | 'mono' | 'neon';

const DENSITY_CONFIG: Record<DensityPreset, { charW: number; charH: number; contrast: number; cutoff: number }> = {
  clean: { charW: 11, charH: 16, contrast: 1.12, cutoff: 0.2 },
  balanced: { charW: 9, charH: 13, contrast: 1.0, cutoff: 0.08 },
  rough: { charW: 7, charH: 10, contrast: 0.9, cutoff: 0.02 },
};

const PALETTES: Record<PalettePreset, { dark: [number, number, number]; mid1: [number, number, number]; mid2: [number, number, number]; light: [number, number, number] }> = {
  current: {
    dark: [0.02, 0.02, 0.05],
    mid1: [0.35, 0.08, 0.55],
    mid2: [0.0, 0.75, 0.9],
    light: [0.95, 0.97, 1.0],
  },
  mono: {
    dark: [0.04, 0.04, 0.045],
    mid1: [0.2, 0.2, 0.22],
    mid2: [0.58, 0.58, 0.62],
    light: [0.92, 0.92, 0.95],
  },
  neon: {
    dark: [0.01, 0.01, 0.03],
    mid1: [0.95, 0.0, 0.75],
    mid2: [0.0, 0.95, 0.78],
    light: [0.95, 1.0, 0.95],
  },
};

export default function ShaderCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [density, setDensity] = useState<DensityPreset>('balanced');
  const [palette, setPalette] = useState<PalettePreset>('current');
  const [perfMode, setPerfMode] = useState(false);
  const [asciiChars, setAsciiChars] = useState(DEFAULT_ASCII);
  const [showControls, setShowControls] = useState(true);

  const paletteColors = useMemo(() => PALETTES[palette], [palette]);

  const applyAsciiPreset = (preset: keyof typeof ASCII_PRESETS) => {
    setAsciiChars(ASCII_PRESETS[preset]);
    wakeControls();
  };

  const wakeControls = () => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 5000);
  };

  useEffect(() => {
    const saved = localStorage.getItem('wooo_ascii_chars');
    if (saved && saved.length >= 2) setAsciiChars(saved);

    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const narrow = window.matchMedia('(max-width: 768px)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPerfMode(coarse || narrow || reduced);

    wakeControls();

    const onMove = () => wakeControls();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchstart', onMove, { passive: true });
    window.addEventListener('keydown', onMove);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchstart', onMove);
      window.removeEventListener('keydown', onMove);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('wooo_ascii_chars', asciiChars);
  }, [asciiChars]);

  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyPosition = document.body.style.position;
    const prevBodyWidth = document.body.style.width;
    const prevBodyHeight = document.body.style.height;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100dvh';

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.position = prevBodyPosition;
      document.body.style.width = prevBodyWidth;
      document.body.style.height = prevBodyHeight;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const baseConf = DENSITY_CONFIG[density];
    const conf = perfMode
      ? { ...baseConf, contrast: baseConf.contrast * 0.75, cutoff: Math.min(baseConf.cutoff, 0.03) }
      : baseConf;
    const perfScale = perfMode ? 0.72 : 1;
    const fps = perfMode ? 24 : 60;
    const chars = asciiChars.length >= 2 ? asciiChars : DEFAULT_ASCII;

    let W = window.innerWidth;
    let H = window.innerHeight;
    let cols = Math.max(1, Math.floor((W / conf.charW) * perfScale));
    let rows = Math.max(1, Math.floor((H / conf.charH) * perfScale));

    const glRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    glRenderer.setSize(cols, rows);
    glRenderer.domElement.style.display = 'none';
    document.body.appendChild(glRenderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uRipple: { value: perfMode ? 0.04 : 0.08 },
        uDark: { value: new THREE.Vector3(...paletteColors.dark) },
        uMid1: { value: new THREE.Vector3(...paletteColors.mid1) },
        uMid2: { value: new THREE.Vector3(...paletteColors.mid2) },
        uLight: { value: new THREE.Vector3(...paletteColors.light) },
      },
    });
    scene.add(new THREE.Mesh(geometry, material));

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = W;
    canvas.height = H;

    let pixelBuf = new Uint8Array(cols * rows * 4);
    const startTime = Date.now();
    let animId = 0;
    let lastFrameAt = 0;

    const draw = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      material.uniforms.uTime.value = elapsed;
      material.uniforms.uMouse.value.set(mouseRef.current.x, 1.0 - mouseRef.current.y);

      glRenderer.render(scene, camera);
      const gl = glRenderer.getContext();
      gl.readPixels(0, 0, cols, rows, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuf);

      ctx.fillStyle = '#06060f';
      ctx.fillRect(0, 0, W, H);
      ctx.font = `${Math.max(8, conf.charH - 1)}px "Courier New", monospace`;
      ctx.textBaseline = 'top';

      const xStep = W / cols;
      const yStep = H / rows;

      for (let row = 0; row < rows; row++) {
        const flipped = rows - 1 - row;
        for (let col = 0; col < cols; col++) {
          const i = (flipped * cols + col) * 4;
          const r = pixelBuf[i], g = pixelBuf[i + 1], b = pixelBuf[i + 2];
          let brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          brightness = Math.min(1, Math.max(0, Math.pow(brightness, conf.contrast)));

          if (brightness < conf.cutoff) continue;

          const ci = Math.floor(brightness * (chars.length - 1));
          const ch = chars[ci];
          if (ch === ' ') continue;

          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillText(ch, col * xStep, row * yStep);
        }
      }
    };

    const animate = (ts: number) => {
      if (ts - lastFrameAt >= 1000 / fps) {
        draw();
        lastFrameAt = ts;
      }
      animId = requestAnimationFrame(animate);
    };

    const onMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX / W, y: e.clientY / H };
    };

    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      mouseRef.current = { x: t.clientX / W, y: t.clientY / H };
    };

    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      cols = Math.max(1, Math.floor((W / conf.charW) * perfScale));
      rows = Math.max(1, Math.floor((H / conf.charH) * perfScale));
      canvas.width = W;
      canvas.height = H;
      glRenderer.setSize(cols, rows);
      pixelBuf = new Uint8Array(cols * rows * 4);
    };

    window.addEventListener('mousemove', onMouse);
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('resize', onResize);
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('resize', onResize);
      glRenderer.dispose();
      material.dispose();
      geometry.dispose();
      if (glRenderer.domElement.parentNode) {
        glRenderer.domElement.parentNode.removeChild(glRenderer.domElement);
      }
    };
  }, [density, paletteColors, perfMode, asciiChars]);

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 h-[100dvh] w-screen" style={{ background: '#06060f' }} />

      <div
        onMouseEnter={wakeControls}
        onMouseMove={wakeControls}
        onTouchStart={wakeControls}
        className={`fixed right-4 top-4 z-40 rounded-md border border-white/10 bg-black/25 px-2 py-1 backdrop-blur-sm transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="flex items-center gap-2">
          <select
            aria-label="ascii density"
            value={density}
            onChange={(e) => setDensity(e.target.value as DensityPreset)}
            className="bg-transparent text-[11px] text-white/75 outline-none"
          >
            <option value="clean">clean</option>
            <option value="balanced">balanced</option>
            <option value="rough">rough</option>
          </select>

          <select
            aria-label="color palette"
            value={palette}
            onChange={(e) => setPalette(e.target.value as PalettePreset)}
            className="bg-transparent text-[11px] text-white/75 outline-none"
          >
            <option value="current">current</option>
            <option value="mono">mono</option>
            <option value="neon">neon</option>
          </select>

          <span className="text-[10px] text-white/45">{perfMode ? 'mobile eco on' : 'full'}</span>
        </div>

        <input
          aria-label="ascii characters"
          value={asciiChars}
          onChange={(e) => setAsciiChars(e.target.value || DEFAULT_ASCII)}
          className="mt-1 w-[220px] bg-transparent text-[10px] text-white/70 outline-none placeholder:text-white/35"
          placeholder="ascii chars (customizable)"
        />

        <div className="mt-1 flex flex-wrap gap-1">
          {(Object.keys(ASCII_PRESETS) as Array<keyof typeof ASCII_PRESETS>).map((name) => {
            const active = asciiChars === ASCII_PRESETS[name];
            return (
              <button
                key={name}
                type="button"
                onClick={() => applyAsciiPreset(name)}
                className={`rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] transition-colors ${active ? 'border-white/45 text-white/90' : 'border-white/20 text-white/55 hover:border-white/35 hover:text-white/85'}`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
