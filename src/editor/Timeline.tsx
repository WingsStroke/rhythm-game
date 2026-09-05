import { useRef, useEffect } from 'react';
import type { LevelData, PadId } from '../engine/types';

interface TimelineProps {
  level: LevelData;
  currentTime: number;
  onSeek?: (time: number) => void;
  onAddEvent: (time: number, padId: PadId) => void;
  onRemoveEvent: (id: string) => void;
}

const SECONDS_PER_PIXEL = 0.01; // Zoom level

export function Timeline({ level, currentTime, onSeek, onAddEvent, onRemoveEvent }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isAutoScrolling = useRef(false);

  // Auto-scroll timeline to follow playhead
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const playheadX = currentTime / SECONDS_PER_PIXEL;
    
    // Auto-scroll logic: keep playhead in view
    const leftBound = container.scrollLeft;
    const rightBound = leftBound + container.clientWidth;
    
    if (playheadX > rightBound - 100) {
      container.scrollLeft = playheadX - container.clientWidth + 100;
      isAutoScrolling.current = true;
    } else if (playheadX < leftBound) {
      container.scrollLeft = Math.max(0, playheadX - 100);
      isAutoScrolling.current = true;
    }
  }, [currentTime]);

  // Generate grid lines based on BPM
  const beatDuration = 60 / level.timing.bpm; // seconds per beat
  const totalDuration = level.song.duration || 120;
  const totalBeats = Math.floor(totalDuration / beatDuration);
  
  const widthPx = totalDuration / SECONDS_PER_PIXEL;

  const handleTrackClick = (e: React.MouseEvent, padId: PadId) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + containerRef.current.scrollLeft;
    
    const clickedTime = clickX * SECONDS_PER_PIXEL;
    
    // Snapping logic (snap to nearest 1/4th beat)
    const snapInterval = beatDuration / 4;
    const snappedTime = Math.round(clickedTime / snapInterval) * snapInterval;
    
    onAddEvent(snappedTime, padId);
  };

  const handleSeek = (e: React.MouseEvent) => {
    if (!containerRef.current || !onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left + containerRef.current.scrollLeft;
    const clickedTime = clickX * SECONDS_PER_PIXEL;
    onSeek(Math.max(0, clickedTime));
  };

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {/* Time Ruler */}
      <div 
        className="h-8 border-b border-white/10 bg-black/40 relative overflow-hidden flex-shrink-0 cursor-crosshair"
        onClick={handleSeek}
      >
         {/* Ruler markings */}
         <div className="absolute top-0 left-0 h-full flex items-end text-[10px] text-white/40" style={{ width: widthPx }}>
            {Array.from({ length: totalBeats }).map((_, i) => (
               <div 
                  key={i} 
                  className="absolute bottom-0 border-l border-white/20 h-2" 
                  style={{ left: (i * beatDuration) / SECONDS_PER_PIXEL }} 
                >
                  <span className="absolute -top-4 -left-1">{i % 4 === 0 ? i/4 + 1 : ''}</span>
               </div>
            ))}
         </div>
      </div>

      {/* Tracks Area */}
      <div ref={containerRef} className="flex-1 overflow-auto relative">
        <div style={{ width: widthPx, height: level.pads.length * 60 + 20 }} className="relative bg-[#0b0b12]">
          
          {/* Vertical Beat Grid Lines */}
          {Array.from({ length: totalBeats * 4 }).map((_, i) => {
             const time = i * (beatDuration / 4);
             const isBeat = i % 4 === 0;
             return (
               <div 
                 key={i}
                 className={`absolute top-0 bottom-0 border-l ${isBeat ? 'border-white/10' : 'border-white/5'}`}
                 style={{ left: time / SECONDS_PER_PIXEL }}
               />
             );
          })}

          {/* Pad Tracks */}
          <div className="flex flex-col gap-1 py-2 relative z-10">
            {level.pads.map(pad => (
              <div 
                key={pad.id} 
                className="h-12 bg-white/5 border-y border-white/10 relative hover:bg-white/10 transition-colors cursor-pointer"
                onClick={(e) => handleTrackClick(e, pad.id)}
              >
                {/* Track Label */}
                <div className="sticky left-0 w-24 h-full bg-black/60 border-r border-white/10 flex items-center px-2 z-20 backdrop-blur-sm pointer-events-none">
                  <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: pad.color }} />
                  <span className="text-xs font-mono">{pad.label}</span>
                </div>

                {/* Events */}
                {level.events.filter(e => e.padId === pad.id).map((event) => {
                  const x = event.targetTime / SECONDS_PER_PIXEL;
                  
                  return (
                    <div
                      key={event.id}
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-8 rounded-sm hover:scale-125 transition-transform z-30"
                      style={{ 
                        left: x - 6, 
                        backgroundColor: pad.color, 
                        boxShadow: `0 0 10px ${pad.color}80` 
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveEvent(event.id);
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Playhead */}
          <div 
            className="absolute top-0 bottom-0 w-px bg-red-500 z-40 pointer-events-none"
            style={{ left: currentTime / SECONDS_PER_PIXEL }}
          >
            <div className="w-3 h-3 bg-red-500 rotate-45 -translate-x-1/2 -translate-y-1/2" />
          </div>

        </div>
      </div>
    </div>
  );
}
