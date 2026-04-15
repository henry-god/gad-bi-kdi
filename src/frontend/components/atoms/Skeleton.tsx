import React from 'react';

interface Props {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const RADIUS: Record<NonNullable<Props['rounded']>, string> = {
  sm: 'rounded',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

export function Skeleton({ className = '', width, height, rounded = 'md' }: Props) {
  const style: React.CSSProperties = {};
  if (width !== undefined) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height !== undefined) style.height = typeof height === 'number' ? `${height}px` : height;
  return (
    <div
      className={`bg-kgd-elevated/60 animate-pulse motion-reduce:animate-none ${RADIUS[rounded]} ${className}`}
      style={style}
      aria-hidden
    />
  );
}

export default Skeleton;
