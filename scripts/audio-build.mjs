// Narration pipeline, the part around the owner's listening.
//
//   1. Anything dropped in audio-inbox/<folder>/<name>.<any audio format> is
//      moved into audio-src/ as the new master for that clip.
//   2. Every master is trimmed, levelled, and written to public/audio/ as mono MP3.
//   3. src/content/audio-manifest.json records what exists, with durations.
//
//   npm run audio            build what changed
//   npm run audio -- --all   rebuild everything

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const FOLDERS = ['letters', 'words', 'prompts', 'sfx'];
const AUDIO_EXT = new Set(['.wav', '.mp3', '.m4a', '.aif', '.aiff', '.flac', '.ogg', '.caf']);
const all = process.argv.includes('--all');

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-nostdin', ...args], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();

// 1. Take in new masters.
let taken = 0;
for (const folder of FOLDERS) {
  const inbox = join('audio-inbox', folder);
  if (!existsSync(inbox)) continue;
  for (const file of readdirSync(inbox)) {
    const ext = extname(file).toLowerCase();
    if (!AUDIO_EXT.has(ext)) continue;
    const name = slug(basename(file, extname(file)));
    mkdirSync(join('audio-src', folder), { recursive: true });
    for (const old of readdirSync(join('audio-src', folder))) {
      if (basename(old, extname(old)) === name) rmSync(join('audio-src', folder, old)); // replaced take
    }
    renameSync(join(inbox, file), join('audio-src', folder, name + ext));
    console.log(`took in ${folder}/${name}${ext}`);
    taken++;
  }
}

// 2. Build.
const TRIM = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.01';
const manifest = {};
let built = 0;
for (const folder of FOLDERS) {
  const dir = join('audio-src', folder);
  if (!existsSync(dir)) continue;
  mkdirSync(join('public/audio', folder), { recursive: true });
  for (const file of readdirSync(dir).sort()) {
    if (!AUDIO_EXT.has(extname(file).toLowerCase())) continue;
    const id = `${folder}/${basename(file, extname(file))}`;
    const src = join(dir, file);
    const out = join('public/audio', `${id}.mp3`);
    if (all || !existsSync(out) || statSync(out).mtimeMs < statSync(src).mtimeMs) {
      // Peak level first: loudness filters are unreliable on clips this short.
      const log = execFileSync('sh', ['-c', 'ffmpeg -hide_banner -nostdin -i "$1" -af volumedetect -f null - 2>&1', 'sh', src], { encoding: 'utf8' });
      const m = /max_volume: (-?[\d.]+) dB/.exec(log);
      if (!m) throw new Error(`cannot read ${src}`);
      const peak = parseFloat(m[1]);
      const gain = Math.min(20, -2 - peak);
      ff(['-y', '-i', src, '-ac', '1', '-ar', '44100',
        '-af', `${TRIM},areverse,${TRIM},areverse,volume=${gain.toFixed(2)}dB,afade=t=in:d=0.004`,
        '-codec:a', 'libmp3lame', '-b:a', '96k', out]);
      built++;
    }
    const seconds = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], { encoding: 'utf8' }));
    manifest[id] = Math.round(seconds * 1000) / 1000;
  }
}

// Drop built files whose master has gone.
for (const folder of FOLDERS) {
  const dir = join('public/audio', folder);
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir)) {
    if (!(`${folder}/${basename(file, '.mp3')}` in manifest)) rmSync(join(dir, file));
  }
}

writeFileSync('src/content/audio-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`${taken} taken in, ${built} built, ${Object.keys(manifest).length} clips in the manifest`);
