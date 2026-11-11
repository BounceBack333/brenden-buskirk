/**
 * Audio kit dev page. Nobody can listen in CI, so this measures instead: each sound is rendered
 * through an OfflineAudioContext and analysed (duration to silence, peak, RMS, spectral centroid).
 */
import { createAudioKit } from '../src/audio';
import type { MusicMode, SfxName } from '../src/kit/contracts';

const SFX: SfxName[] = ['ui_tap', 'ui_back', 'ui_confirm', 'ui_toggle', 'countdown', 'go', 'swap', 'launch', 'umbrella_open', 'umbrella_close',
  'umbrella_spent', 'boing', 'balloon_bump', 'balloon_pop', 'ring', 'rim', 'catch', 'catch_perfect', 'miss_splat', 'dive', 'skid', 'footstep',
  'score_tick', 'star', 'fanfare', 'whoops'];

interface Row { name: string; ms: number; peak: number; rms: number; centroid: number; nan: boolean; tailDb: number }

function analyse(name: string, buf: AudioBuffer): Row {
  const d = buf.getChannelData(0);
  const r = buf.numberOfChannels > 1 ? buf.getChannelData(1) : d;
  let peak = 0, sum = 0, nan = false, last = 0;
  const thr = Math.pow(10, -50 / 20);
  for (let i = 0; i < d.length; i++) {
    const v = (d[i]! + r[i]!) / 2;
    if (!Number.isFinite(v)) nan = true;
    const a = Math.max(Math.abs(d[i]!), Math.abs(r[i]!));
    if (a > peak) peak = a;
    if (a > thr) last = i;
    sum += v * v;
  }
  // crude spectral centroid from zero crossings of the loud part
  let zc = 0;
  for (let i = 1; i <= last; i++) if ((d[i - 1]! < 0) !== (d[i]! < 0)) zc++;
  const centroid = last > 0 ? (zc / 2) / (last / buf.sampleRate) : 0;
  let tail = 0;
  const from = Math.max(0, d.length - Math.floor(buf.sampleRate * 0.2));
  for (let i = from; i < d.length; i++) tail = Math.max(tail, Math.abs(d[i]!));
  return { name, ms: Math.round((last / buf.sampleRate) * 1000), peak: +peak.toFixed(3), rms: +Math.sqrt(sum / Math.max(1, last)).toFixed(4), centroid: Math.round(centroid), nan, tailDb: tail > 0 ? Math.round(20 * Math.log10(tail)) : -120 };
}

async function render(seconds: number, fn: (kit: ReturnType<typeof createAudioKit>) => void): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.floor(44100 * seconds), 44100);
  const kit = createAudioKit({ context: ctx });
  kit.setVolumes({ master: 1, sfx: 1, music: 1 });
  fn(kit);
  return ctx.startRendering();
}

async function measure(): Promise<{ rows: Row[]; problems: string[] }> {
  const rows: Row[] = [];
  for (const name of SFX) {
    for (const intensity of [0.3, 1]) {
      rows.push(analyse(`${name}@${intensity}`, await render(2.5, (k) => k.play(name, { intensity }))));
    }
  }
  rows.push(analyse('tension 0→1', await render(2.5, (k) => { k.setTension(0.1); window.setTimeout(() => undefined, 0); k.setTension(1); })));
  rows.push(analyse('wind 1', await render(2.5, (k) => k.setWind(1))));
  rows.push(analyse('flutter 1', await render(2.5, (k) => k.setFlutter(1))));
  for (const mode of ['menu', 'play', 'tense', 'win'] as MusicMode[]) rows.push(analyse(`music:${mode}`, await render(8, (k) => k.music(mode))));
  rows.push(analyse('pile-up x10', await render(2.5, (k) => { for (const n of ['launch', 'catch_perfect', 'boing', 'ring', 'balloon_pop', 'fanfare', 'miss_splat', 'rim', 'umbrella_open', 'star'] as SfxName[]) k.play(n); })));
  rows.push(analyse('spam footstep x200', await render(2.5, (k) => { for (let i = 0; i < 200; i++) k.play('footstep'); })));
  const problems: string[] = [];
  for (const r of rows) {
    if (r.nan) problems.push(`${r.name}: NaN in output`);
    if (r.rms < 0.003) problems.push(`${r.name}: silent (rms ${r.rms})`);
    if (r.peak > 0.98) problems.push(`${r.name}: clipping risk (peak ${r.peak})`);
    const oneShot = !r.name.startsWith('music') && !/tension|wind|flutter/.test(r.name);
    if (oneShot && r.tailDb > -50) problems.push(`${r.name}: does not end (tail ${r.tailDb} dB)`);
  }
  return { rows, problems };
}

declare global { interface Window { __measure?: typeof measure; __ready?: boolean } }
window.__measure = measure;

const live = createAudioKit();
const holder = document.getElementById('buttons')!;
for (const name of SFX) {
  const b = document.createElement('button');
  b.textContent = name;
  b.onclick = () => { void live.unlock().then(() => live.play(name)); };
  holder.append(b);
}
for (const mode of ['menu', 'play', 'tense', 'win', 'off'] as MusicMode[]) {
  const b = document.createElement('button');
  b.textContent = `music:${mode}`;
  b.onclick = () => { void live.unlock().then(() => live.music(mode)); };
  holder.append(b);
}
window.__ready = true;
