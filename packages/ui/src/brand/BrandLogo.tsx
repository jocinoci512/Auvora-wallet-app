'use client';

import type { CSSProperties, ReactElement } from 'react';

export type BrandLogoVariant = 'primary' | 'reverse' | 'monochrome' | 'symbol';

const SRC: Record<BrandLogoVariant, string> = {
  primary: '/brand/Auvora_Primary.svg',
  reverse: '/brand/Auvora_Reverse.svg',
  monochrome: '/brand/Auvora_Monochrome.svg',
  symbol: '/brand/Auvora_Symbol.svg',
};

export function BrandLogo({
  variant = 'primary',
  alt = 'Auvora Wallet',
  height = 32,
  className,
  style,
}: {
  variant?: BrandLogoVariant;
  alt?: string;
  /** Display height in CSS pixels; width scales with intrinsic aspect. */
  height?: number;
  className?: string;
  style?: CSSProperties;
}): ReactElement {
  const isSymbol = variant === 'symbol';
  return (
    // Static brand SVGs from /public/brand — img is intentional for SVG + theme swap.
    <img
      src={SRC[variant]}
      alt={alt}
      height={height}
      width={isSymbol ? height : undefined}
      className={className}
      style={{
        height,
        width: isSymbol ? height : 'auto',
        // Do not set display here — auth shells toggle light/dark logos via CSS
        // (.as__logo--light / --dark). Inline display:block would override those rules.
        objectFit: 'contain',
        ...style,
      }}
      decoding="async"
    />
  );
}
