import React from 'react';

export interface PlayheadProps {
  currentTime: number;
  pixelsPerSecond: number;
}

export const Playhead = React.memo(function Playhead({ currentTime, pixelsPerSecond }: PlayheadProps) {
  return (
    <div
      className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none"
      style={{ left: currentTime * pixelsPerSecond }}
    >
      <div className="w-4 h-4 bg-red-500 rotate-45 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_10px_#ff0000]" />
    </div>
  );
});
