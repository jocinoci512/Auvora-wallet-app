'use client';

import { EmptyState } from '@auvora/ui';
import { useState, type ReactElement, type SyntheticEvent } from 'react';
import { detectMediaKind, mediaLabel } from '../../lib/nft/media';

type Props = {
  imageUrl?: string | null;
  videoUrl?: string | null;
  animationUrl?: string | null;
  audioUrl?: string | null;
  modelUrl?: string | null;
  name: string;
  compact?: boolean;
};

const FALLBACK = '/nft-placeholder.svg';

function onImgError(e: SyntheticEvent<HTMLImageElement>): void {
  const img = e.currentTarget;
  if (img.src.endsWith(FALLBACK)) return;
  img.src = FALLBACK;
}

export function NftMediaViewer({
  imageUrl,
  videoUrl,
  animationUrl,
  audioUrl,
  modelUrl,
  name,
  compact = false,
}: Props): ReactElement {
  const kind = detectMediaKind({ imageUrl, videoUrl, animationUrl, audioUrl, modelUrl });
  const [videoBroken, setVideoBroken] = useState(false);

  if (kind === 'video' && videoUrl && !videoBroken) {
    return (
      <div className="nx-media" data-kind="video">
        <video
          src={videoUrl}
          controls
          playsInline
          preload="metadata"
          poster={imageUrl || undefined}
          onError={() => setVideoBroken(true)}
        />
      </div>
    );
  }

  if (kind === 'animation' && animationUrl) {
    return (
      <div className="nx-media" data-kind="animation">
        <iframe title={`${name} animation`} src={animationUrl} sandbox="" loading="lazy" />
      </div>
    );
  }

  if (kind === 'audio') {
    return (
      <div className="nx-media" data-kind="audio">
        <div className="nx-media__fallback">
          <p>{mediaLabel('audio')}</p>
          <p className="nx-meta">Preview placeholder — cover art below</p>
          <img
            src={imageUrl || FALLBACK}
            alt={name}
            loading="lazy"
            width={compact ? 120 : 240}
            height={compact ? 120 : 240}
            onError={onImgError}
          />
        </div>
      </div>
    );
  }

  if (kind === 'model3d') {
    return (
      <div className="nx-media" data-kind="model3d">
        <div className="nx-media__fallback">
          <EmptyState
            title="3D model"
            description="Interactive 3D preview will appear here when available."
          />
          <img
            src={imageUrl || FALLBACK}
            alt={name}
            loading="lazy"
            width={180}
            height={180}
            onError={onImgError}
          />
        </div>
      </div>
    );
  }

  if (kind === 'unknown' || (kind === 'video' && videoBroken)) {
    return (
      <div className="nx-media" data-kind="unknown">
        <div className="nx-media__fallback">
          <EmptyState
            title={videoBroken ? 'Video unavailable' : 'Unsupported media'}
            description={
              videoBroken
                ? 'This video could not be loaded. Showing a placeholder instead.'
                : 'This asset’s media format isn’t previewable yet.'
            }
          />
          {imageUrl ? <img src={imageUrl} alt={name} loading="lazy" onError={onImgError} /> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="nx-media" data-kind={kind}>
      <img
        src={imageUrl || animationUrl || FALLBACK}
        alt={name}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={onImgError}
      />
    </div>
  );
}
