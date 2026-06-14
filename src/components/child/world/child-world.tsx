"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AvatarDisplay } from "@/components/shared/avatar-display";
import { SwitchProfileButton } from "@/components/shared/switch-profile-button";
import { markNotificationsRead } from "@/app/actions/notifications";
import { CharacterSvg, type CostumeKey } from "./character-svg";
import { RoomStage } from "./room-stage";
import type { HotspotAction, Position, RoomTheme } from "./theme-config";
import { FOOTPRINT, placeSafe } from "./collision";
import { audioManager } from "@/lib/audio/audio-manager";
import { speak, speakLine } from "@/lib/audio/voice";
import type { VoiceLine } from "@/lib/audio/types";
import { useAudioStore } from "@/store/audio-store";
import { TaskSheet } from "./sheets/task-sheet";
import { CelenganSheet } from "./sheets/celengan-sheet";
import { KostumSheet } from "./sheets/kostum-sheet";
import { InvestasiSheet } from "./sheets/investasi-sheet";
import { ShopSheet } from "./sheets/shop-sheet";
import { RiwayatSheet } from "./sheets/riwayat-sheet";
import { SoundSettingsSheet } from "./sheets/sound-settings-sheet";
import { TemaSheet } from "./sheets/tema-sheet";

type SheetKey = "task" | "kostum" | "investasi" | "shop" | "riwayat" | "celengan" | "sound" | "tema";

export interface ChildWorldProps {
  childId: string;
  kind: "daffa" | "dio";
  name: string;
  level: number;
  xp: number;
  xpNextLevel: number;
  saldo: number;
  point: number;
  avatarUrl: string | null;
  unreadCount: number;
  petUrl: string | null;
  petName: string | null;
  taskBadge: number;
  piggyBadge: number;
  initialCostume: CostumeKey;
  theme: RoomTheme;
  investmentProgress: number;
}

const CARRY_LIFT = 11;
const PIGGY_MIN = 9;
const PIGGY_MAX = 15;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function initIsNight(): boolean {
  const h = new Date().getHours();
  return h >= 18 || h < 5;
}

export function ChildWorld(props: ChildWorldProps) {
  const { childId, kind, name, level, xp, xpNextLevel, saldo, point, avatarUrl, unreadCount, petUrl, taskBadge, piggyBadge, theme, investmentProgress } =
    props;
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const vpRef = useRef<HTMLDivElement>(null);

  const personal = kind === "daffa" ? "#4CAF50" : "#7C3AED";
  const xpPct = xpNextLevel > 0 ? clamp(Math.round((xp / xpNextLevel) * 100), 0, 100) : 0;
  const isMuted = useAudioStore((s) => s.isMuted);
  const devModeAvailable = process.env.NODE_ENV !== "production";

  const [stage, setStage] = useState<{ w: number; h: number; left: number; top: number } | null>(null);
  const [devOutline, setDevOutline] = useState(false);

  const [pos, setPos] = useState<Position>(theme.defaultPosition.avatar);
  const [petPos, setPetPos] = useState<Position>(theme.defaultPosition.pet);
  const [piggyPos, setPiggyPos] = useState<Position>(theme.defaultPosition.piggy);
  const [costume, setCostume] = useState<CostumeKey>(props.initialCostume);
  const [isNight, setIsNight] = useState(false);
  const [talking, setTalking] = useState(false);
  const [waving, setWaving] = useState(false);
  const [bubble, setBubble] = useState<{ text: string; show: boolean }>({ text: "", show: false });
  const [carrying, setCarrying] = useState<"pet" | "piggy" | null>(null);
  const [choice, setChoice] = useState<{ target: "pet" | "piggy" } | null>(null);
  const [activeSheet, setActiveSheet] = useState<SheetKey | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [piggyCelebrate, setPiggyCelebrate] = useState(false);
  const seqRef = useRef(0);
  const tWave = useRef<ReturnType<typeof setTimeout>>();
  const tBubble = useRef<ReturnType<typeof setTimeout>>();
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setIsNight(initIsNight());
    void useAudioStore.getState().hydrateFromServer();
    audioManager.crossfadeBGM(kind === "daffa" ? "daffa_room" : "dio_room");
    return () => audioManager.stopBGM();
  }, [kind]);

  // Fullscreen cover-scale (Docs/FIX_KAMAR_ANAK.md poin 1): `.stage` dihitung
  // sebesar imgW/imgH tema yang di-cover ke viewport (scale = max(vw/imgW, vh/imgH))
  // lalu dipusatkan. Background + hotspot + objek (persen relatif .stage) ikut
  // ter-crop bersama, jadi tetap presisi di rasio layar apa pun (iPad 4:3, Android 16:10).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const recalc = () => {
      const vw = root.clientWidth;
      const vh = root.clientHeight;
      if (!vw || !vh) return;
      const scale = Math.max(vw / theme.imgW, vh / theme.imgH);
      const w = theme.imgW * scale;
      const h = theme.imgH * scale;
      setStage({ w, h, left: (vw - w) / 2, top: (vh - h) / 2 });
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(root);
    return () => ro.disconnect();
  }, [theme.imgW, theme.imgH]);

  // Lock orientasi landscape — best-effort via Screen Orientation API.
  // Fallback utama tetap CSS `.rotate-overlay` (@media orientation:portrait).
  useEffect(() => {
    const orientation = screen.orientation as unknown as {
      lock?: (orientation: string) => Promise<void>;
      unlock?: () => void;
    };
    orientation?.lock?.("landscape").catch(() => {});
    return () => orientation?.unlock?.();
  }, []);

  // Ganti tema → relayout avatar/pet/celengan ke posisi default tema baru.
  useEffect(() => {
    setPos(theme.defaultPosition.avatar);
    setPetPos(theme.defaultPosition.pet);
    setPiggyPos(theme.defaultPosition.piggy);
    setCarrying(null);
    setChoice(null);
  }, [theme.key, theme.defaultPosition.avatar, theme.defaultPosition.pet, theme.defaultPosition.piggy]);

  const showBubble = useCallback((text: string) => {
    setBubble({ text, show: true });
    clearTimeout(tBubble.current);
    tBubble.current = setTimeout(() => setBubble((b) => ({ ...b, show: false })), 1800);
  }, []);

  // Progress investasi 100% → celengan glow + perayaan singkat.
  useEffect(() => {
    if (investmentProgress < 100) return;
    audioManager.playSFX("level_up");
    showBubble("🎉 Target tercapai!");
    setPiggyCelebrate(true);
    const t = setTimeout(() => setPiggyCelebrate(false), 2000);
    return () => clearTimeout(t);
  }, [investmentProgress, showBubble]);

  const speakOnly = useCallback(
    (text: string, line?: VoiceLine) => {
      setTalking(true);
      if (line) void speakLine(line, text, kind, () => setTalking(false));
      else void speak(text, kind, () => setTalking(false));
    },
    [kind]
  );

  const say = useCallback(
    (text: string, line?: VoiceLine) => {
      showBubble(text);
      speakOnly(text, line);
    },
    [showBubble, speakOnly]
  );

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setTimeout(() => setActiveSheet(null), 320);
  }, []);

  const openSheet = useCallback((key: SheetKey) => {
    audioManager.playSFX("pop");
    setChoice(null);
    setActiveSheet(key);
    requestAnimationFrame(() => setSheetOpen(true));
  }, []);

  const onChanged = useCallback(() => router.refresh(), [router]);

  const walkTo = useCallback(
    (x: number, b: number) => {
      const wb = theme.walkable;
      setPos({ x: clamp(x, wb.xMin, wb.xMax), b: clamp(b, wb.bMin, wb.bMax) });
    },
    [theme]
  );

  const onFloorClick = (e: React.MouseEvent) => {
    audioManager.unlockAudio();
    const target = e.target as HTMLElement;
    if (target.closest("button")) return; // objek/karakter/dock punya handler sendiri
    setChoice(null);
    if (activeSheet) {
      closeSheet();
      return;
    }
    const r = vpRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((e.clientX - r.left) / r.width) * 100;
    const b = ((r.bottom - e.clientY) / r.height) * 100;
    walkTo(x, b);
  };

  const charTap = () => {
    audioManager.unlockAudio();
    setWaving(true);
    clearTimeout(tWave.current);
    tWave.current = setTimeout(() => setWaving(false), 1700);
    const SEQ: { text: string; line: VoiceLine }[] = [
      { text: "Halo!", line: "halo" },
      { text: `Aku ${name}!`, line: "aku" },
      { text: "Ayo belajar!", line: "belajar" },
      { text: "Ayo bermain!", line: "bermain" },
      { text: "Ayo istirahat!", line: "istirahat" },
      { text: "Keren!", line: "keren" },
    ];
    const item = SEQ[seqRef.current % SEQ.length];
    seqRef.current += 1;
    audioManager.playSFX("pop");
    say(item.text, item.line);
  };

  const onHotspot = (action: HotspotAction) => {
    audioManager.unlockAudio();
    setChoice(null);
    if (action === "daynight") {
      setIsNight((n) => !n);
      audioManager.playSFX("pop");
      return;
    }
    openSheet(action);
  };

  const onCarryClick = (target: "pet" | "piggy", e: React.MouseEvent) => {
    e.stopPropagation();
    if (carrying === target) {
      const dropped = placeSafe(pos.x, pos.b, FOOTPRINT[target], theme);
      if (target === "pet") setPetPos(dropped);
      else setPiggyPos(dropped);
      setCarrying(null);
      audioManager.playSFX("pop");
      return;
    }
    if (carrying) return;
    setChoice({ target });
    audioManager.playSFX("pop");
  };

  const choiceTake = () => {
    if (choice) setCarrying(choice.target);
    setChoice(null);
    audioManager.playSFX("pop");
  };

  const choiceBark = () => {
    setChoice(null);
    audioManager.playSFX("bark");
    showBubble("Guk guk! 🐾");
  };

  const openFromChoice = (key: SheetKey) => {
    setChoice(null);
    openSheet(key);
  };

  const onBell = () => {
    openSheet("riwayat");
    if (unreadCount > 0) void markNotificationsRead(childId).then(onChanged);
  };

  const startMic = () => {
    if (micActive) return;
    audioManager.unlockAudio();
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      showBubble("Mic tidak didukung di browser ini.");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "id-ID";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript?.trim();
      if (text) setTimeout(() => say(text), 500);
    };
    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "permission-denied") {
        showBubble("Izinkan mikrofon di pengaturan browser ya!");
      }
    };
    recognition.onend = () => {
      audioManager.unduckBGM();
      setMicActive(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setMicActive(true);
    audioManager.duckBGM(0.1);
    showBubble("🎙️ Bicara sekarang...");
    recognition.start();
  };

  const stopMic = () => {
    recognitionRef.current?.stop();
  };

  const renderedPetPos = carrying === "pet" ? { x: pos.x, b: pos.b + CARRY_LIFT } : petPos;
  const renderedPiggyPos = carrying === "piggy" ? { x: pos.x, b: pos.b + CARRY_LIFT } : piggyPos;
  const piggyWidth = PIGGY_MIN + (PIGGY_MAX - PIGGY_MIN) * (clamp(investmentProgress, 0, 100) / 100);
  const piggyMaxed = investmentProgress >= 100;

  return (
    <div ref={rootRef} className="world-root fixed inset-0 overflow-hidden bg-black">
      {/* STAGE cover-scale (Docs/FIX_KAMAR_ANAK.md poin 1) — background, hotspot,
          objek: semua koordinat % relatif .stage. HUD/hint/mic relatif viewport,
          di luar .stage (lihat akhir komponen). */}
      <div
        ref={vpRef}
        className={`stage ${devOutline ? "dev-outline" : ""}`}
        style={stage ? { width: stage.w, height: stage.h, left: stage.left, top: stage.top } : { width: "100%", height: "100%", left: 0, top: 0 }}
        onClick={onFloorClick}
      >
        <RoomStage theme={theme} isNight={isNight} taskBadge={taskBadge} onHotspot={onHotspot} />

        {/* PET (carry) */}
        <button
          type="button"
          className={`carry-item ${carrying === "pet" ? "carried" : ""}`}
          style={{ left: `${renderedPetPos.x}%`, bottom: `${renderedPetPos.b}%`, width: "6.5%" }}
          onClick={(e) => onCarryClick("pet", e)}
          aria-label="pet"
        >
          {petUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={petUrl} alt="pet" className="petsvg w-full" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,.16))" }} />
          ) : (
            <svg className="petsvg w-full" viewBox="0 0 100 80" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,.16))" }}>
              <ellipse cx="50" cy="52" rx="30" ry="22" fill="#C8C8C8" />
              <circle cx="50" cy="32" r="22" fill="#C8C8C8" />
              <path d="M32 18 L28 4 L42 12Z" fill="#A8A8A8" />
              <path d="M68 18 L72 4 L58 12Z" fill="#A8A8A8" />
              <ellipse cx="50" cy="42" rx="12" ry="9" fill="#EAEAEA" />
              <circle cx="42" cy="30" r="3.5" fill="#2E3A4D" />
              <circle cx="58" cy="30" r="3.5" fill="#2E3A4D" />
              <rect x="46" y="38" width="8" height="6" rx="2" fill="#2E2E2E" />
              <rect x="32" y="68" width="11" height="9" rx="3" fill="#A8A8A8" />
              <rect x="58" y="68" width="11" height="9" rx="3" fill="#A8A8A8" />
            </svg>
          )}
        </button>

        {/* CELENGAN (carry) — ukuran & glow merepresentasikan progress investasi */}
        <button
          type="button"
          className={`carry-item ${carrying === "piggy" ? "carried" : ""} ${piggyMaxed ? "piggy-glow" : ""} ${
            piggyCelebrate ? "piggy-celebrate" : ""
          }`}
          style={{ left: `${renderedPiggyPos.x}%`, bottom: `${renderedPiggyPos.b}%`, width: `${piggyWidth}%` }}
          onClick={(e) => onCarryClick("piggy", e)}
          aria-label="celengan"
        >
          {piggyBadge ? <span className="bdg">{piggyBadge}</span> : null}
          <svg viewBox="0 0 100 82" className="w-full" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,.16))" }}>
            <ellipse cx="50" cy="46" rx="40" ry="30" fill="#6BA8F5" />
            <circle cx="18" cy="38" r="12" fill="#6BA8F5" />
            <circle cx="14" cy="36" r="3.5" fill="#5590E0" />
            <rect x="38" y="12" width="20" height="6" rx="3" fill="#3E6FB0" />
            <circle cx="34" cy="38" r="3.5" fill="#1C2A40" />
            <ellipse cx="34" cy="50" rx="6" ry="3" fill="#F5A9C4" opacity=".6" />
            <rect x="26" y="72" width="11" height="7" rx="3.5" fill="#5590E0" />
            <rect x="62" y="72" width="11" height="7" rx="3.5" fill="#5590E0" />
            <circle cx="50" cy="22" r="7" fill="#FFD24D" />
          </svg>
        </button>

        {/* KARAKTER */}
        <button
          type="button"
          className={`char-wrap ${talking ? "talking" : ""} ${waving ? "wavin" : ""}`}
          style={{ left: `${pos.x}%`, bottom: `${pos.b}%`, width: "10.5%" }}
          onClick={(e) => {
            e.stopPropagation();
            charTap();
          }}
          aria-label={name}
        >
          <div className={`bubble ${bubble.show ? "show" : ""}`}>{bubble.text}</div>
          <CharacterSvg kind={kind} costume={costume} />
          <div className="csh" />
        </button>

        {/* POPUP pilihan — pet: Ambil/Aksi · celengan: Pindahkan/Saldo/Investasi */}
        {choice && (
          <>
            <div
              className="choice-backdrop"
              onClick={(e) => {
                e.stopPropagation();
                setChoice(null);
                audioManager.playSFX("pop");
              }}
            />
            <div className="choice" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="choice-x" onClick={() => setChoice(null)} aria-label="Tutup">
                ✕
              </button>
              <div className="choice-title">{choice.target === "pet" ? "🐾 Peliharaan" : "🐷 Celengan"}</div>
              <div className="choice-row">
                {choice.target === "pet" ? (
                  <>
                    <button style={{ background: "#FFE9CF", color: "#C9852E" }} onClick={choiceTake}>
                      <span className="text-2xl">✋</span>Ambil
                    </button>
                    <button style={{ background: "#E8F5E9", color: "#388E3C" }} onClick={choiceBark}>
                      <span className="text-2xl">🐾</span>Aksi
                    </button>
                  </>
                ) : (
                  <>
                    <button style={{ background: "#FFE9CF", color: "#C9852E" }} onClick={choiceTake}>
                      <span className="text-2xl">✋</span>Pindahkan
                    </button>
                    <button style={{ background: "#E8F5E9", color: "#388E3C" }} onClick={() => openFromChoice("celengan")}>
                      <span className="text-2xl">💰</span>Saldo
                    </button>
                    <button style={{ background: "#E3F2FD", color: "#1976D2" }} onClick={() => openFromChoice("investasi")}>
                      <span className="text-2xl">🌱</span>Investasi
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* BACKDROP + SHEET */}
        {activeSheet && (
          <div
            className="absolute inset-0 z-[35] transition-opacity"
            style={{ background: sheetOpen ? "rgba(0,0,0,.28)" : "rgba(0,0,0,0)" }}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeSheet();
            }}
          />
        )}
        {activeSheet && (
          <div className={`world-sheet ${sheetOpen ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
            {activeSheet === "task" && <TaskSheet childId={childId} onClose={closeSheet} onChanged={onChanged} />}
            {activeSheet === "celengan" && <CelenganSheet childId={childId} onClose={closeSheet} onChanged={onChanged} />}
            {activeSheet === "kostum" && (
              <KostumSheet childId={childId} onClose={closeSheet} onChanged={onChanged} onSelectCostume={setCostume} onSay={say} />
            )}
            {activeSheet === "investasi" && <InvestasiSheet childId={childId} onClose={closeSheet} onChanged={onChanged} />}
            {activeSheet === "shop" && <ShopSheet childId={childId} onClose={closeSheet} onChanged={onChanged} />}
            {activeSheet === "riwayat" && <RiwayatSheet childId={childId} onClose={closeSheet} />}
            {activeSheet === "sound" && <SoundSettingsSheet onClose={closeSheet} />}
            {activeSheet === "tema" && <TemaSheet childId={childId} onClose={closeSheet} onChanged={onChanged} />}
          </div>
        )}
      </div>

      {/* MIC ECHO */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          startMic();
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          stopMic();
        }}
        onPointerLeave={stopMic}
        className={`pointer-events-auto absolute z-[16] flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-[0_3px_8px_rgba(0,0,0,.15)] transition-colors ${
          micActive ? "animate-pulse bg-red-400" : "bg-white/90"
        }`}
        style={{ left: "max(12px, env(safe-area-inset-left))", bottom: "max(70px, env(safe-area-inset-bottom))" }}
        aria-label="Rekam suara"
      >
        🎙️
      </button>

      {/* HUD */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-[15] flex items-start justify-between gap-2 p-3 sm:p-4" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-white/90 py-1.5 pl-1.5 pr-4 shadow-[0_3px_8px_rgba(0,0,0,.15)]"
          >
            <AvatarDisplay src={avatarUrl} name={name} size={44} color={personal} className="!border-0" />
            <div className="leading-none">
              <div className="font-heading text-[16px] font-black text-[#1C1E26]">{name}</div>
              <span className="mt-1 inline-block rounded-full bg-[#E8F5E9] px-2.5 py-1 text-[11px] font-black" style={{ color: personal }}>
                ⭐ Lv.{level}
              </span>
            </div>
          </div>
          <Pill border={personal} onClick={() => openSheet("celengan")}>💵 {formatShort(saldo)}</Pill>
          <Pill border="#FFD93D" onClick={() => openSheet("shop")}>
            🪙 {point}
          </Pill>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => openSheet("sound")}
            className="pointer-events-auto rounded-full bg-white/90 px-3.5 py-2 text-[12px] font-black text-[#1C1E26] shadow-[0_3px_8px_rgba(0,0,0,.15)]"
            aria-label="Pengaturan suara"
          >
            {isMuted ? "🔇" : "🎵"}
          </button>
          <div
            className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-white/90 px-4 py-2.5 shadow-[0_3px_8px_rgba(0,0,0,.15)]"
            style={{ border: `2.5px solid ${"#7C3AED"}` }}
          >
            <span className="font-heading text-[15px] font-black text-[#1C1E26]">Lv.{level}</span>
            <span className="block h-[9px] w-[70px] overflow-hidden rounded-full bg-black/10">
              <span className="block h-full rounded-full" style={{ width: `${xpPct}%`, background: "linear-gradient(90deg,#4CAF50,#8BC34A)" }} />
            </span>
          </div>
          <button
            type="button"
            onClick={onBell}
            className="pointer-events-auto relative flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-lg shadow-[0_3px_8px_rgba(0,0,0,.15)]"
            aria-label="notifikasi"
          >
            🔔
            {unreadCount > 0 && <span className="bdg" style={{ top: -4, right: -4 }}>{unreadCount}</span>}
          </button>
          <SwitchProfileButton iconOnly className="pointer-events-auto !h-11 !w-11 !rounded-full" />
        </div>
      </div>

      {/* DEV TOGGLE — QA hotspot outline, disembunyikan di production (Docs/FIX_KAMAR_ANAK.md poin 3) */}
      {devModeAvailable && (
        <button type="button" className="devtoggle" onClick={() => setDevOutline((v) => !v)}>
          👁️ {devOutline ? "Sembunyikan" : "Lihat"} Hotspot
        </button>
      )}

      {/* ROTATE OVERLAY — minta landscape, CSS-only via @media (orientation: portrait) */}
      <div className="rotate-overlay">
        <div className="rotate-card">
          <span className="rotate-icon">🔄</span>
          Putar perangkat ke mode landscape ya!
        </div>
      </div>
    </div>
  );
}

function Pill({ children, border, onClick }: { children: React.ReactNode; border: string; onClick?: () => void }) {
  const className =
    "pointer-events-auto flex items-center gap-2 rounded-full bg-white/90 px-4 py-2.5 font-heading text-[14px] font-black text-[#1C1E26] shadow-[0_3px_8px_rgba(0,0,0,.15)]";
  const style = { border: `2.5px solid ${border}` };
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} style={style}>
        {children}
      </button>
    );
  }
  return (
    <span className={className} style={style}>
      {children}
    </span>
  );
}

function formatShort(n: number): string {
  if (n >= 1000000) return `Rp ${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}jt`;
  if (n >= 1000) return `Rp ${Math.round(n / 1000)}rb`;
  return `Rp ${n}`;
}
