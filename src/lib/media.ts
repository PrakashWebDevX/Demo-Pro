export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

/** Returns an English error message (translate with tr) or null when valid. */
export function validateImages(files: File[], alreadySelected: number): string | null {
  if (alreadySelected + files.length > MAX_IMAGES) return "You can add up to 5 photos.";
  for (const f of files) {
    const typeOk = IMAGE_TYPES.includes(f.type) || (!f.type && IMAGE_EXT.test(f.name));
    if (!typeOk || !IMAGE_EXT.test(f.name)) return "Only JPG, JPEG, PNG or WEBP images are allowed.";
    if (f.size > MAX_IMAGE_BYTES) return "Each photo must be 5 MB or smaller.";
  }
  return null;
}

export function validateVideo(file: File): string | null {
  const typeOk = VIDEO_TYPES.includes(file.type) || (!file.type && VIDEO_EXT.test(file.name));
  if (!typeOk || !VIDEO_EXT.test(file.name)) return "Only MP4, MOV or WEBM videos are allowed.";
  if (file.size > MAX_VIDEO_BYTES) return "The video must be 20 MB or smaller.";
  return null;
}

export function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
