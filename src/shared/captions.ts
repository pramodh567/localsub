import type { SubtitleCue } from './types';

export function mergeOverlap(previous: string, next: string): string {
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  const left = normalize(previous).split(' ');
  const right = normalize(next).split(' ');
  const max = Math.min(left.length, right.length);
  for (let size = max; size > 0; size--) {
    if (left.slice(-size).join(' ') === right.slice(0, size).join(' ')) {
      return next.trim().split(/\s+/).slice(size).join(' ');
    }
  }
  return next.trim();
}

export function formatSrtTimestamp(milliseconds: number): string {
  const total = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1_000);
  const millis = total % 1_000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

export function toSrt(cues: SubtitleCue[]): string {
  return cues.filter((cue) => !cue.provisional && cue.text.trim()).map((cue, index) =>
    `${index + 1}\n${formatSrtTimestamp(cue.startMs)} --> ${formatSrtTimestamp(cue.endMs)}\n${cue.text.trim()}`
  ).join('\n\n') + (cues.length ? '\n' : '');
}
