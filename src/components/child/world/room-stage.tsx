"use client";

import { useEffect, useRef } from "react";
import type { HotspotAction, RoomTheme } from "./theme-config";

interface RoomStageProps {
  theme: RoomTheme;
  isNight: boolean;
  taskBadge?: number;
  onHotspot: (action: HotspotAction) => void;
}

/**
 * Background kamar berbasis gambar (siang/malam crossfade) + hotspot transparan.
 * IKUTI PERSIS Docs/ROOM_DAFFA_FINAL.html — satu-satunya objek di atas background
 * adalah avatar/pet/celengan (dirender oleh ChildWorld).
 */
export function RoomStage({ theme, isNight, taskBadge, onHotspot }: RoomStageProps) {
  const backRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const currentUrl = useRef<string | null>(null);

  useEffect(() => {
    const url = isNight ? theme.nightImage : theme.dayImage;
    const back = backRef.current;
    const front = frontRef.current;
    if (!back || !front) return;

    if (currentUrl.current === null) {
      back.style.backgroundImage = `url('${url}')`;
      front.style.backgroundImage = `url('${url}')`;
      front.style.opacity = "0";
      currentUrl.current = url;
      return;
    }
    if (currentUrl.current === url) return;

    front.style.backgroundImage = `url('${url}')`;
    front.style.opacity = "1";
    currentUrl.current = url;
    const t = setTimeout(() => {
      back.style.backgroundImage = `url('${url}')`;
      front.style.opacity = "0";
    }, 620);
    return () => clearTimeout(t);
  }, [theme, isNight]);

  return (
    <>
      <div ref={backRef} className="bg bgBack" />
      <div ref={frontRef} className="bg bgFront" />
      <div className="amb" style={{ background: isNight ? "rgba(15,25,60,.18)" : "transparent" }} />

      {theme.hotspots.map((h) => (
        <div
          key={h.id}
          className="hotspot"
          style={{ left: `${h.left}%`, top: `${h.top}%`, width: `${h.width}%`, height: `${h.height}%` }}
          onClick={(e) => {
            e.stopPropagation();
            onHotspot(h.action);
          }}
        >
          <span className="hlabel">{h.label}</span>
        </div>
      ))}

      {!!taskBadge && (
        <div className="notif" style={{ left: `${theme.notifPosition.left}%`, top: `${theme.notifPosition.top}%` }}>
          <svg className="glow" width="34" height="34" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" fill="#FFD93D" />
            <text x="20" y="27" textAnchor="middle" fontSize="20" fontWeight="900" fill="#B8860B">
              !
            </text>
          </svg>
        </div>
      )}
    </>
  );
}
