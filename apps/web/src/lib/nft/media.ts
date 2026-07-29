export type MediaKind = 'image' | 'gif' | 'video' | 'animation' | 'audio' | 'model3d' | 'unknown';

export function detectMediaKind(input: {
  imageUrl?: string | null;
  videoUrl?: string | null;
  animationUrl?: string | null;
  audioUrl?: string | null;
  modelUrl?: string | null;
}): MediaKind {
  if (input.videoUrl) return 'video';
  if (input.audioUrl) return 'audio';
  if (input.modelUrl) return 'model3d';
  if (input.animationUrl) {
    const u = input.animationUrl.toLowerCase();
    if (u.endsWith('.gif')) return 'gif';
    return 'animation';
  }
  if (input.imageUrl) {
    const u = input.imageUrl.toLowerCase();
    if (u.endsWith('.gif')) return 'gif';
    return 'image';
  }
  return 'unknown';
}

export function mediaLabel(kind: MediaKind): string {
  switch (kind) {
    case 'gif':
      return 'Animated GIF';
    case 'video':
      return 'Video';
    case 'animation':
      return 'Animation';
    case 'audio':
      return 'Audio collectible';
    case 'model3d':
      return '3D model';
    case 'image':
      return 'Image';
    default:
      return 'Unsupported media';
  }
}
