import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Environment, Lightformer, RoundedBox } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from '@react-three/postprocessing';
import { ThreeCanvas } from '@remotion/three';
import { continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import * as THREE from 'three';
import { BlendFunction } from 'postprocessing';
import { CUE, bar } from '../beats';
import { SUBJECTS } from '../data';
import { C } from '../theme';
import { METER_BASE, METER_HEIGHT, STATION, STRIP_GAP, TARGET_LEVEL, cameraAt, examScore, levelY, stageAt, stripState, stripX } from './layout';

const SEGMENTS = 34;
const SEGMENT_FILL = 0.74;
const STRIP_WIDTH = 0.96;
const STRIP_DEPTH = 0.34;

const hdr = (hex: string, gain: number) => new THREE.Color(hex).multiplyScalar(gain);

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const Rig: React.FC<{ frame: number }> = ({ frame }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    const c = cameraAt(frame);
    camera.fov = c.fov;
    camera.position.set(...c.pos);
    camera.lookAt(...c.look);
    camera.updateProjectionMatrix();
  }, [camera, frame]);
  return null;
};

/** Every meter segment, drawn exactly: each is split where a grade's level falls inside it. */
const Meters: React.FC<{ frame: number }> = ({ frame }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = SUBJECTS.length * SEGMENTS * 3;
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const { bright, beat, impact } = stageAt(frame);
    const signal = hdr(C.signal, (0.5 + bright * 0.62) * (1 + beat * 0.12 + impact * 0.5));
    const gain = hdr(C.gain, 1.45 + impact * 0.6);
    const off = new THREE.Color('#141a38').multiplyScalar(0.22 + bright * 0.95);
    const matrix = new THREE.Matrix4();
    const place = new THREE.Vector3();
    const size = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const pitch = METER_HEIGHT / SEGMENTS;
    let n = 0;
    SUBJECTS.forEach((_, i) => {
      const s = stripState(frame, i);
      for (let k = 0; k < SEGMENTS; k++) {
        const bottom = k * pitch;
        const top = bottom + pitch * SEGMENT_FILL;
        const rec = s.recorded * METER_HEIGHT;
        const proj = s.projected * METER_HEIGHT;
        const a = Math.min(top, Math.max(bottom, rec));
        const b = Math.min(top, Math.max(a, proj));
        const parts: [number, number, THREE.Color][] = [[bottom, a, signal], [a, b, gain], [b, top, off]];
        for (const [lo, hi, colour] of parts) {
          const h = hi - lo;
          const empty = h < 0.0005; // an empty part must draw nothing, or its faces still glow
          size.set(empty ? 0 : STRIP_WIDTH, empty ? 0 : h, empty ? 0 : STRIP_DEPTH);
          place.set(stripX(i), METER_BASE + lo + h / 2, 0);
          mesh.setMatrixAt(n, matrix.compose(place, quat, size));
          mesh.setColorAt(n, colour);
          n++;
        }
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [frame]);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
};

const TargetBars: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    {SUBJECTS.map((_, i) => {
      const glow = stripState(frame, i).target;
      if (glow <= 0) return null;
      return (
        <mesh key={i} position={[stripX(i), levelY(TARGET_LEVEL), STRIP_DEPTH / 2 + 0.03]}>
          <boxGeometry args={[STRIP_GAP * 0.98, 0.045, 0.05]} />
          <meshBasicMaterial toneMapped={false} color={hdr(C.valve, 0.5 + glow * 1.7)} />
        </mesh>
      );
    })}
  </>
);

const Hardware: React.FC<{ frame: number }> = ({ frame }) => {
  const width = STRIP_GAP * SUBJECTS.length + 0.7;
  const score = examScore(frame);
  return (
    <>
      {/* Back panel */}
      <RoundedBox args={[width, 6.5, 0.5]} radius={0.12} smoothness={4} position={[0, 3.25, -0.42]}>
        <meshPhysicalMaterial color="#10152e" metalness={0.85} roughness={0.34} clearcoat={0.7} />
      </RoundedBox>
      {/* Deck */}
      <RoundedBox args={[width + 0.5, 0.62, 3.5]} radius={0.14} smoothness={4} position={[0, 0.31, 1.1]}>
        <meshPhysicalMaterial color="#181e3f" metalness={0.8} roughness={0.3} clearcoat={0.8} />
      </RoundedBox>
      {/* Faders. Math's is the exam slider; the others hold still. */}
      {SUBJECTS.map((_, i) => {
        const travel = i === 0 ? (score - 40) / 10 : 0.62;
        return (
          <group key={i} position={[stripX(i), 0.64, 1.45]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.1, 0.03, 1.9]} />
              <meshStandardMaterial color="#04060f" roughness={0.6} />
            </mesh>
            <RoundedBox args={[0.62, 0.22, 0.3]} radius={0.05} smoothness={3} position={[0, 0.12, 0.8 - travel * 1.6]}>
              <meshPhysicalMaterial color={i === 0 && frame >= CUE.approach && frame < CUE.everywhere ? C.gain : '#cfd6ee'} metalness={0.9} roughness={0.22} />
            </RoundedBox>
          </group>
        );
      })}
    </>
  );
};

const ConsoleModel: React.FC<{ frame: number }> = ({ frame }) => (
  <group>
    <Hardware frame={frame} />
    <Meters frame={frame} />
    <TargetBars frame={frame} />
  </group>
);

const Floor: React.FC<{ x?: number }> = ({ x = 0 }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0, 0]}>
    <planeGeometry args={[400, 200]} />
    <meshStandardMaterial color="#05081a" metalness={0.5} roughness={0.42} transparent opacity={0.86} />
  </mesh>
);

/** A flat signal line, stirring only on the pulse. */
const SignalLine: React.FC<{ frame: number }> = ({ frame }) => {
  let amp = 0;
  for (const p of [bar(0), bar(0, 2), bar(1), bar(1, 2)]) if (frame >= p) amp = Math.max(amp, Math.exp(-(frame - p) / 9));
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 260; i++) {
      const x = (i / 260 - 0.5) * 30;
      const d = x / 1.2;
      points.push(new THREE.Vector3(x, 1.9 + amp * 0.62 * Math.exp(-d * d) * Math.cos(d * 3.4), 2.6));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 520, 0.016 + amp * 0.012, 8, false);
  }, [amp]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial toneMapped={false} color={hdr(C.signal, 0.55 + amp * 2)} />
    </mesh>
  );
};

const Dust: React.FC<{ frame: number; centre: number }> = ({ frame, centre }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 260;
  const seeds = useMemo(() => {
    const r = rng(11);
    return Array.from({ length: count }, () => ({ x: (r() - 0.5) * 40, y: r() * 12, z: r() * 16 - 8, speed: 0.008 + r() * 0.02, phase: r() * 6.3, size: 0.012 + r() * 0.03, violet: r() > 0.62 }));
  }, []);
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 6, 6), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const { bright, beat } = stageAt(frame);
    const matrix = new THREE.Matrix4();
    seeds.forEach((s, i) => {
      const y = (s.y + frame * s.speed) % 12;
      const scale = s.size * (1 + beat * 0.5);
      matrix.makeScale(scale, scale, scale);
      matrix.setPosition(centre + s.x + Math.sin(frame * 0.012 + s.phase) * 0.5, y, s.z);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, hdr(s.violet ? C.gain : C.signal, 0.25 + bright * (1.2 + beat * 0.8)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [frame, seeds, centre]);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshBasicMaterial toneMapped={false} transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} />
    </instancedMesh>
  );
};

/** The drop: sparks burst from Math's target line, a beam crosses the stage, a shockwave crosses the floor. */
const DropBurst: React.FC<{ frame: number }> = ({ frame }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 520;
  const seeds = useMemo(() => {
    const r = rng(29);
    return Array.from({ length: count }, () => {
      const angle = r() * Math.PI * 2;
      const speed = 0.05 + r() * 0.24;
      return { vx: Math.cos(angle) * speed, vy: Math.abs(Math.sin(angle)) * speed * 1.2 + 0.02, vz: (r() - 0.25) * 0.18, size: 0.014 + r() * 0.035, life: 26 + r() * 46, amber: r() > 0.3 };
    });
  }, []);
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 6, 6), []);
  const since = frame - CUE.drop;
  const y = levelY(TARGET_LEVEL);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    seeds.forEach((s, i) => {
      const t = Math.max(0, since);
      const fade = Math.max(0, 1 - t / s.life);
      const scale = since < 0 ? 0 : s.size * fade;
      matrix.makeScale(scale, scale, scale);
      matrix.setPosition(stripX(0) + s.vx * t, y + s.vy * t - 0.0016 * t * t, 0.3 + s.vz * t);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, hdr(s.amber ? C.valve : C.gainStrong, 3.2));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [since, seeds, y]);
  const beam = Math.max(0, Math.exp(-Math.max(0, since) / 14));
  const reach = 1 - Math.pow(1 - Math.min(1, Math.max(0, since) / 12), 3);
  const wave = Math.min(1, Math.max(0, since) / 44);
  return (
    <>
      <instancedMesh ref={ref} args={[geometry, undefined, count]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
      {since >= 0 && beam > 0.02 ? (
        <mesh position={[stripX(0) + 22 * reach - 8 * reach, y, 0.3]}>
          <boxGeometry args={[60 * reach + 0.5, 0.04 + beam * 0.05, 0.04 + beam * 0.05]} />
          <meshBasicMaterial toneMapped={false} color={hdr(C.valve, 1 + beam * 5)} />
        </mesh>
      ) : null}
      {since >= 0 && wave < 1 ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[stripX(0), 0.03, 1]} scale={1 + wave * 36}>
          <ringGeometry args={[0.92, 1, 96]} />
          <meshBasicMaterial toneMapped={false} color={hdr(C.valve, 2.4)} transparent opacity={(1 - wave) * 0.75} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ) : null}
    </>
  );
};

/* ───────── Devices ───────── */

type Screens = { wide: THREE.Texture | null; tall: THREE.Texture | null; browser: THREE.Texture | null };

/** Loaded at the top of the scene, so a draw always follows, and the frame is only released after it. */
const useScreens = (): Screens => {
  const [screens, setScreens] = useState<Screens>({ wide: null, tall: null, browser: null });
  const [handle] = useState(() => delayRender('Loading device screens'));
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const load = (file: string) => new Promise<THREE.Texture>((resolve, reject) => loader.load(staticFile(file), (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 16;
      resolve(t);
    }, undefined, reject));
    void Promise.all([load('app/screen-wide.png'), load('app/screen-tall.png'), load('app/screen-browser.png')]).then(([wide, tall, browser]) => setScreens({ wide, tall, browser }));
  }, []);
  useEffect(() => {
    if (!screens.wide) return;
    const id = requestAnimationFrame(() => continueRender(handle));
    return () => cancelAnimationFrame(id);
  }, [screens, handle]);
  return screens;
};

const shell = '#4a5390';
const Slab: React.FC<{ w: number; h: number; depth: number; bezel: number; radius: number; texture: THREE.Texture | null; colour?: string; rim?: string }> = ({ w, h, depth, bezel, radius, texture, colour = shell, rim = C.signal }) => (
  <group>
    {/* Backlight, so the device reads as an object against the dark stage. */}
    <mesh position={[0, 0, -depth / 2 - 0.03]}>
      <planeGeometry args={[w + 0.16, h + 0.16]} />
      <meshBasicMaterial toneMapped={false} color={hdr(rim, 1.5)} />
    </mesh>
    <RoundedBox args={[w, h, depth]} radius={radius} smoothness={5}>
      <meshPhysicalMaterial color={colour} metalness={0.92} roughness={0.26} clearcoat={1} clearcoatRoughness={0.2} />
    </RoundedBox>
    <mesh position={[0, 0, depth / 2 + 0.004]}>
      <planeGeometry args={[w - bezel * 2, h - bezel * 2]} />
      <meshBasicMaterial key={texture ? texture.uuid : 'none'} map={texture ?? undefined} toneMapped={false} color={new THREE.Color(0.82, 0.82, 0.82)} />
    </mesh>
  </group>
);

const Phone: React.FC<{ texture: THREE.Texture | null; colour?: string }> = ({ texture, colour }) => (
  <Slab w={2.5} h={4.9} depth={0.2} bezel={0.11} radius={0.09} texture={texture} colour={colour} rim={C.signal} />
);
const Tablet: React.FC<{ texture: THREE.Texture | null; colour?: string }> = ({ texture, colour }) => (
  <Slab w={6} h={3.8} depth={0.2} bezel={0.16} radius={0.09} texture={texture} colour={colour} rim={C.gain} />
);
const Monitor: React.FC<{ texture: THREE.Texture | null }> = ({ texture }) => (
  <group>
    <Slab w={8.4} h={5.2} depth={0.26} bezel={0.16} radius={0.1} texture={texture} colour="#3a4170" rim={C.gain} />
    <mesh position={[0, -3.25, -0.1]}>
      <boxGeometry args={[0.7, 1.4, 0.14]} />
      <meshStandardMaterial color="#2a3158" metalness={0.9} roughness={0.3} />
    </mesh>
    <RoundedBox args={[3.2, 0.12, 1.5]} radius={0.05} smoothness={3} position={[0, -3.92, 0.1]}>
      <meshStandardMaterial color="#2a3158" metalness={0.9} roughness={0.3} />
    </RoundedBox>
  </group>
);
const Laptop: React.FC<{ texture: THREE.Texture | null }> = ({ texture }) => (
  <group>
    <group position={[0, 2.5, -1.6]} rotation={[-0.14, 0, 0]}>
      <Slab w={8} h={5} depth={0.14} bezel={0.16} radius={0.06} texture={texture} colour="#4a5390" rim={C.signal} />
    </group>
    <RoundedBox args={[8, 0.16, 3.2]} radius={0.07} smoothness={3} position={[0, -0.05, 0]}>
      <meshPhysicalMaterial color="#59629f" metalness={0.8} roughness={0.32} />
    </RoundedBox>
  </group>
);

const ease = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

const Placed: React.FC<{ frame: number; arrive: number; home: [number, number, number]; slot: [number, number, number]; slotScale: number; yaw: number; children: React.ReactNode }> = ({ frame, arrive, home, slot, slotScale, yaw, children }) => {
  const entry = ease((frame - arrive) / 16);
  const gather = ease((frame - CUE.sync) / 18);
  const spin = (1 - entry) * 1.1 + Math.sin((frame - arrive) * 0.02) * 0.05;
  const pos = home.map((v, i) => v + (slot[i] - v) * gather) as [number, number, number];
  pos[1] += (1 - entry) * -1.6;
  return (
    <group position={pos} rotation={[0, (yaw + spin) * (1 - gather), 0]} scale={(0.8 + entry * 0.2) * (1 + (slotScale - 1) * gather)}>
      {children}
    </group>
  );
};

const SyncLinks: React.FC<{ frame: number; slots: [number, number, number][] }> = ({ frame, slots }) => {
  const since = frame - CUE.sync;
  const y = -1.4;
  const left = slots[0][0];
  const right = slots[slots.length - 1][0];
  return (
    <group visible={since > 10}>
      <mesh position={[(left + right) / 2, y, 1]}>
        <boxGeometry args={[right - left + 8, 0.03, 0.03]} />
        <meshBasicMaterial toneMapped={false} color={hdr(C.signal, 1.4)} />
      </mesh>
      {[0, 1, 2, 3, 4].map((n) => (
        <mesh key={n} position={[left - 4 + (right - left + 8) * (((since / 54 + n / 5) % 1)), y, 1]}>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshBasicMaterial toneMapped={false} color={hdr(C.signal, 4)} />
        </mesh>
      ))}
    </group>
  );
};

const Devices: React.FC<{ frame: number; screens: Screens }> = ({ frame, screens }) => {
  const { wide, tall, browser } = screens;
  const c = STATION.syncCentre;
  const slot = (x: number, y: number, z: number): [number, number, number] => [c + x, y, z];
  const slots = [slot(-11, 2, 0), slot(-7.3, 2, 2), slot(-1.5, 2.8, -2), slot(4, 2, 2), slot(7.5, 2, 0), slot(14, 0.2, 0)];
  return (
    <group>
      <Placed frame={frame} arrive={CUE.android} home={[STATION.android - 0.6, 3.2, 0]} slot={slots[0]} slotScale={1} yaw={0.2}><Tablet texture={wide} /></Placed>
      <Placed frame={frame} arrive={CUE.android} home={[STATION.android + 1.7, 3, 1.4]} slot={slots[1]} slotScale={1} yaw={0.1}><Phone texture={tall} /></Placed>
      <Placed frame={frame} arrive={CUE.windows} home={[STATION.windows - 0.4, 3.9, 0]} slot={slots[2]} slotScale={0.95} yaw={-0.14}><group scale={0.85}><Monitor texture={wide} /></group></Placed>
      <Placed frame={frame} arrive={CUE.apple} home={[STATION.apple - 0.9, 3, 1.3]} slot={slots[3]} slotScale={1} yaw={0.12}><Phone texture={tall} colour="#6a74b3" /></Placed>
      <Placed frame={frame} arrive={CUE.apple} home={[STATION.apple + 1, 3.2, -0.8]} slot={slots[4]} slotScale={1} yaw={-0.16}><Tablet texture={wide} colour="#6a74b3" /></Placed>
      <Placed frame={frame} arrive={CUE.browser} home={[STATION.browser - 0.2, 1.1, 0]} slot={slots[5]} slotScale={1} yaw={-0.16}><group scale={0.85}><Laptop texture={browser} /></group></Placed>
      <SyncLinks frame={frame} slots={slots} />
    </group>
  );
};

/* ───────── Stage ───────── */

const Lights: React.FC<{ frame: number; x: number }> = ({ frame, x }) => {
  const { bright, beat, impact } = stageAt(frame);
  return (
    <>
      <ambientLight intensity={0.12 + bright * 0.34} />
      <directionalLight position={[x - 6, 12, 10]} intensity={0.3 + bright * 1.8} color="#c8d6ff" />
      <pointLight position={[x - 9, 3, 6]} color={C.signal} intensity={(10 + beat * 18) * bright + impact * 40} distance={40} />
      <pointLight position={[x + 9, 5, 6]} color={C.gain} intensity={(12 + beat * 16) * bright + impact * 40} distance={40} />
      <pointLight position={[x, 9, 3]} color={C.valve} intensity={impact * 60} distance={40} />
    </>
  );
};

const Effects: React.FC<{ frame: number }> = ({ frame }) => {
  const bloom = useRef<{ intensity: number } | null>(null);
  const { impact } = stageAt(frame);
  useLayoutEffect(() => {
    if (bloom.current) bloom.current.intensity = 0.72 + impact * 1.4;
  }, [impact]);
  const shift = 0.0003 + impact * 0.0032;
  const offset = useMemo(() => new THREE.Vector2(shift, shift * 0.6), [shift]);
  return (
    <EffectComposer multisampling={4}>
      <Bloom ref={bloom as never} mipmapBlur luminanceThreshold={0.62} luminanceSmoothing={0.22} intensity={0.8} radius={0.74} />
      <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={offset} radialModulation={false} modulationOffset={0} />
      <Vignette eskil={false} offset={0.22} darkness={0.72} />
    </EffectComposer>
  );
};

/** Remotion renders on demand, so the composer needs an explicit draw after every frame's updates. */
const Advance: React.FC = () => {
  const { advance } = useThree();
  useEffect(() => {
    advance(performance.now());
  });
  return null;
};

/** One continuous 3D stage, behind every scene. */
export const World: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const screens = useScreens();
  const onDevices = frame >= CUE.everywhere && frame < CUE.close;
  const centre = onDevices ? cameraAt(frame).look[0] : 0;
  return (
    <ThreeCanvas width={width} height={height} camera={{ fov: 38, near: 0.1, far: 300, position: [0, 3, 12] }} gl={{ antialias: false, preserveDrawingBuffer: true }} style={{ position: 'absolute', inset: 0 }}>
      <color attach="background" args={[C.bgDeep]} />
      <fog attach="fog" args={[C.bgDeep, 18, 70]} />
      <Rig frame={frame} />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.4} color="#8fa6ff" position={[0, 7, 6]} scale={[14, 3, 1]} />
        <Lightformer form="rect" intensity={1.6} color={C.signal} position={[-10, 3, 4]} rotation={[0, Math.PI / 2, 0]} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1.6} color={C.gain} position={[10, 3, 4]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 3, 1]} />
      </Environment>
      <Lights frame={frame} x={centre} />
      <Dust frame={frame} centre={centre} />
      {onDevices ? (
        <Devices frame={frame} screens={screens} />
      ) : (
        <>
          {frame < CUE.signal ? <SignalLine frame={frame} /> : null}
          {/* A mirrored copy under the semi-transparent floor is the reflection. */}
          <group scale={[1, -1, 1]}><ConsoleModel frame={frame} /></group>
          <ConsoleModel frame={frame} />
          {frame >= CUE.drop && frame < CUE.everywhere ? <DropBurst frame={frame} /> : null}
        </>
      )}
      <Floor x={centre} />
      <Effects frame={frame} />
      <Advance />
    </ThreeCanvas>
  );
};

