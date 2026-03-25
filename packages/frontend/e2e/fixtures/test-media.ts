import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Tiny deterministic media fixtures for E2E upload tests.
 * Committed to git — not generated at runtime.
 *
 * Sizes: PNG ~69B, MP3 ~1.2KB, MP4 ~152B
 */
export const TEST_MEDIA = {
  image: path.join(__dirname, 'media/test-image.png'),
  audio: path.join(__dirname, 'media/test-audio.mp3'),
  video: path.join(__dirname, 'media/test-video.mp4'),
} as const;
