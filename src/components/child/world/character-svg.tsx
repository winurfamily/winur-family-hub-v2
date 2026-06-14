"use client";

/**
 * Karakter SVG full-body + layer kostum untuk Dunia Anak.
 * Daffa (Minecraft, bowl-cut, kaos krem henley, cargo olive) — konsisten ref.
 * Dio (Tayo, rambut pendek, kaos biru muda, celana navy) — sistem sama, tema beda.
 * Idle = hanya kedip. Mulut gerak saat .talking. Mata tutup saat .sleeping.
 */

import { DAFFA_COS, DIO_COS, type CostumeKey } from "./costume";

export type { CostumeKey } from "./costume";
export { DAFFA_COS, DIO_COS, costumeKeyFrom } from "./costume";

interface CharacterSvgProps {
  kind: "daffa" | "dio";
  costume: CostumeKey;
}

export function CharacterSvg({ kind, costume }: CharacterSvgProps) {
  const map = kind === "daffa" ? DAFFA_COS : DIO_COS;
  const c = map[costume] ?? map.default;
  const skin = "#F2C396";

  return (
    <svg className="charsvg" viewBox="0 0 200 268">
      {/* LEGS */}
      <g>
        <path d="M64 168 L136 168 L140 226 L108 226 L101 190 L94 226 L60 226Z" fill={c.pants} />
        <rect x="58" y="186" width="14" height="20" rx="3" fill={c.pock} />
        <rect x="128" y="186" width="14" height="20" rx="3" fill={c.pock} />
        <rect x="62" y="218" width="36" height="9" rx="3" fill={c.cuff} />
        <rect x="102" y="218" width="36" height="9" rx="3" fill={c.cuff} />
        <path d="M58 234 Q60 226 78 228 L94 230 Q96 244 88 248 L62 248 Q56 244 58 234Z" fill={c.shoe} />
        <path d="M58 241 L94 241 L94 248 L62 248 Q57 246 58 241Z" fill="#fff" />
        <path d="M104 234 Q106 226 124 228 L140 230 Q142 244 134 248 L108 248 Q102 244 104 234Z" fill={c.shoe} />
        <path d="M104 241 L140 241 L140 248 L108 248 Q103 246 104 241Z" fill="#fff" />
      </g>
      {/* ARM L */}
      <path d="M58 128 Q44 148 48 168" stroke={c.slv} strokeWidth="19" fill="none" strokeLinecap="round" />
      <circle cx="48" cy="172" r="9" fill={skin} />
      {/* SHIRT */}
      <path d="M58 118 Q100 104 142 118 L148 176 Q100 188 52 176Z" fill={c.shirt} />
      {c.col && <path d="M96 112 L100 124 L104 112" stroke="#E0DBC8" strokeWidth="3" fill="none" />}
      {c.col && <rect x="116" y="132" width="20" height="22" rx="3" fill="none" stroke="#E0DBC8" strokeWidth="2.5" />}

      {/* COSTUME KITS (Daffa only) */}
      {kind === "daffa" && c.kit === "kitPol" && (
        <g>
          <path d="M58 118 Q100 106 142 118 L146 176 Q100 186 54 176Z" fill="#2E4A7A" />
          <rect x="94" y="116" width="12" height="58" fill="#1F3355" />
          <circle cx="78" cy="140" r="7" fill="#FFD24D" />
          <circle cx="100" cy="132" r="3" fill="#FFD24D" />
          <circle cx="100" cy="146" r="3" fill="#FFD24D" />
          <rect x="56" y="160" width="88" height="11" rx="3" fill="#1A2C4A" />
          <rect x="92" y="160" width="16" height="11" fill="#C9A24A" />
        </g>
      )}
      {kind === "daffa" && c.kit === "kitTentara" && (
        <g>
          <path d="M58 118 Q100 106 142 118 L146 176 Q100 186 54 176Z" fill="#4A5730" />
          <path d="M70 120 L88 120 L84 176 L74 176Z" fill="#3A4526" />
          <path d="M112 120 L130 120 L126 176 L116 176Z" fill="#3A4526" />
          <rect x="56" y="158" width="88" height="11" rx="3" fill="#2E3520" />
          <rect x="92" y="158" width="16" height="11" fill="#6B7A45" />
          <rect x="120" y="128" width="14" height="10" fill="#6B7A45" />
        </g>
      )}
      {kind === "daffa" && c.kit === "kitBoboi" && (
        <g>
          <path d="M58 118 Q100 106 142 118 L146 176 Q100 186 54 176Z" fill="#FF7B30" />
          <path d="M58 118 L54 176 Q70 182 78 178 L82 120Z" fill="#2E3A4D" />
          <path d="M142 118 L146 176 Q130 182 122 178 L118 120Z" fill="#2E3A4D" />
          <path d="M96 130 L108 130 L101 144 L110 144 L94 162 L99 148 L92 148Z" fill="#FFD24D" />
        </g>
      )}
      {kind === "daffa" && c.kit === "kitSteve" && (
        <g>
          <rect x="60" y="118" width="80" height="60" fill="#16A085" />
          <rect x="60" y="118" width="80" height="14" fill="#1ABFA0" />
          <rect x="70" y="158" width="60" height="20" fill="#4A6FA5" />
          <rect x="88" y="134" width="24" height="20" fill="#12806A" />
        </g>
      )}
      {kind === "daffa" && c.kit === "kitRobot" && (
        <g>
          <path d="M58 118 Q100 106 142 118 L146 176 Q100 186 54 176Z" fill="#9AA8BE" />
          <rect x="74" y="128" width="52" height="34" rx="6" fill="#6E7A8E" />
          <circle cx="88" cy="142" r="5" fill="#FF4757" />
          <circle cx="112" cy="142" r="5" fill="#4DD0E1" />
          <rect x="80" y="154" width="40" height="5" fill="#4DD0E1" />
        </g>
      )}
      {kind === "daffa" && c.kit === "kitAstro" && (
        <g>
          <path d="M56 118 Q100 104 144 118 L150 178 Q100 190 50 178Z" fill="#F2F4F8" />
          <rect x="82" y="132" width="36" height="26" rx="6" fill="#3E6FB0" />
          <circle cx="92" cy="142" r="3.5" fill="#FF7B54" />
          <circle cx="104" cy="142" r="3.5" fill="#6BCB77" />
          <rect x="86" y="150" width="28" height="4" fill="#FFD24D" />
        </g>
      )}
      {kind === "daffa" && c.kit === "kitPirate" && (
        <g>
          <path d="M58 118 Q100 106 142 118 L146 176 Q100 186 54 176Z" fill="#5E3A1E" />
          <path d="M88 116 L100 150 L112 116Z" fill="#EAE0D0" />
          <rect x="56" y="158" width="88" height="12" rx="2" fill="#2A1E14" />
          <rect x="92" y="158" width="16" height="12" fill="#C9A24A" />
          <circle cx="100" cy="134" r="6" fill="#EAE0D0" />
        </g>
      )}

      {/* ARM R */}
      <g className="w-armR">
        <path d="M142 128 Q156 148 152 168" stroke={c.slv} strokeWidth="19" fill="none" strokeLinecap="round" />
        <circle cx="152" cy="172" r="9" fill={skin} />
      </g>

      {/* HEAD */}
      <circle cx="100" cy="66" r="54" fill={skin} />
      <circle cx="48" cy="72" r="9" fill={skin} />
      <circle cx="152" cy="72" r="9" fill={skin} />

      {kind === "daffa" ? (
        <g>
          {/* Bowl-cut hitam poni rata */}
          <path d="M48 70 Q44 10 100 8 Q156 10 152 70 Q152 56 148 50 L52 50 Q48 56 48 70Z" fill="#1F1A17" />
          <path d="M52 50 L148 50 Q150 44 146 38 Q100 22 54 38 Q50 44 52 50Z" fill="#1F1A17" />
          <path d="M52 50 Q56 46 64 47 L74 50 L86 47 L100 50 L114 47 L126 50 L136 47 Q144 46 148 50 L148 58 Q100 50 52 58Z" fill="#1F1A17" />
          <path d="M48 70 Q47 58 52 52 L56 64 Q52 68 48 70Z" fill="#15110F" />
          <path d="M152 70 Q153 58 148 52 L144 64 Q148 68 152 70Z" fill="#15110F" />
        </g>
      ) : (
        <g>
          {/* Rambut pendek balita */}
          <path d="M50 66 Q46 16 100 12 Q154 16 150 66 Q150 50 142 44 Q100 30 58 44 Q50 50 50 66Z" fill="#1F1A17" />
          <path d="M58 44 Q100 30 142 44 L140 54 Q100 42 60 54Z" fill="#15110F" />
        </g>
      )}

      <path d="M72 64 Q81 61 90 64" stroke="#2E2620" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M110 64 Q119 61 128 64" stroke="#2E2620" strokeWidth="3.5" fill="none" strokeLinecap="round" />

      {/* Eyes open */}
      <g className="w-eye">
        <ellipse cx="80" cy="78" rx="8.5" ry="10" fill="#241D18" />
        <circle cx="83" cy="74.5" r="2.6" fill="#fff" />
      </g>
      <g className="w-eye" style={{ animationDelay: ".07s" }}>
        <ellipse cx="120" cy="78" rx="8.5" ry="10" fill="#241D18" />
        <circle cx="123" cy="74.5" r="2.6" fill="#fff" />
      </g>
      {/* Eyes closed (sleep) */}
      <path className="w-eye-closed" d="M72 78 Q80 83 88 78" stroke="#241D18" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path className="w-eye-closed" d="M112 78 Q120 83 128 78" stroke="#241D18" strokeWidth="3" fill="none" strokeLinecap="round" />

      <path d="M98 90 Q100 94 102 90" stroke="#D9A06B" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path className="w-mouth-closed" d="M92 102 Q100 107 108 102" stroke="#8A5A3B" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <ellipse className="w-mouth-open" cx="100" cy="104" rx="8" ry="6" fill="#8A4A3B" />
      <ellipse cx="66" cy="92" rx="7" ry="4.5" fill="#F0A878" opacity=".5" />
      <ellipse cx="134" cy="92" rx="7" ry="4.5" fill="#F0A878" opacity=".5" />

      {/* HATS (Daffa only) */}
      {kind === "daffa" && c.hat === "capPol" && (
        <g>
          <path d="M46 52 Q44 18 100 14 Q156 18 154 52 L142 46 Q100 32 58 46Z" fill="#1F3355" />
          <path d="M58 46 Q100 32 142 46 L148 56 Q100 42 52 56Z" fill="#2E4A7A" />
          <rect x="88" y="24" width="24" height="14" rx="4" fill="#FFD24D" />
        </g>
      )}
      {kind === "daffa" && c.hat === "capTentara" && (
        <g>
          <path d="M48 50 Q46 22 100 18 Q154 22 152 50 L140 44 Q100 30 60 44Z" fill="#4A5730" />
          <rect x="88" y="28" width="24" height="12" rx="3" fill="#6B7A45" />
        </g>
      )}
      {kind === "daffa" && c.hat === "capBoboi" && (
        <g>
          <path d="M46 50 Q44 18 100 14 Q156 18 154 50 L142 44 Q100 30 58 44Z" fill="#FF7B30" />
          <path d="M44 50 Q100 36 156 50 L150 60 Q100 46 50 60Z" fill="#E8641F" />
          <rect x="90" y="22" width="20" height="12" rx="3" fill="#FFD24D" />
        </g>
      )}
      {kind === "daffa" && c.hat === "hatSteve" && (
        <g>
          <rect x="50" y="18" width="100" height="44" fill="#6B4A2E" />
          <rect x="50" y="18" width="100" height="14" fill="#7E5836" />
        </g>
      )}
      {kind === "daffa" && c.hat === "helmRobot" && (
        <g>
          <rect x="52" y="20" width="96" height="44" rx="10" fill="#9AA8BE" />
          <rect x="62" y="34" width="76" height="18" rx="6" fill="#2E3A4D" />
          <circle cx="80" cy="43" r="4" fill="#4DD0E1" />
          <circle cx="120" cy="43" r="4" fill="#4DD0E1" />
        </g>
      )}
      {kind === "daffa" && c.hat === "helmAstro" && (
        <g>
          <path d="M46 52 Q44 14 100 10 Q156 14 154 52 L142 46 Q100 30 58 46Z" fill="#F2F4F8" />
          <path d="M44 54 Q100 38 156 54 L152 64 Q100 48 48 64Z" fill="#C5CBD8" />
          <circle cx="148" cy="32" r="7" fill="#FF7B54" />
        </g>
      )}
      {kind === "daffa" && c.hat === "hatPirate" && (
        <g>
          <path d="M40 48 Q100 18 160 48 Q150 30 100 28 Q50 30 40 48Z" fill="#2E2620" />
          <path d="M40 48 Q100 40 160 48 L156 58 Q100 50 44 58Z" fill="#1C1815" />
          <circle cx="100" cy="40" r="6" fill="#FFD24D" />
        </g>
      )}
    </svg>
  );
}
