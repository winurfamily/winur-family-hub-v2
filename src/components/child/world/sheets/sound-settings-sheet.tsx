"use client";

import { useAudioStore } from "@/store/audio-store";
import { Switch } from "@/components/ui/switch";
import { SheetHeader } from "./sheet-ui";

interface Props {
  onClose: () => void;
}

export function SoundSettingsSheet({ onClose }: Props) {
  const { bgmVolume, sfxVolume, isMuted, setBgmVolume, setSfxVolume, toggleMute } = useAudioStore();

  return (
    <div>
      <SheetHeader title="🎵 Suara" onClose={onClose} />
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-2xl bg-[#F7F8FB] p-4">
          <span className="font-heading text-sm font-black text-[#1C1E26]">Musik &amp; Suara</span>
          <Switch checked={!isMuted} onCheckedChange={() => toggleMute()} />
        </div>

        <VolumeSlider
          label="🎶 Musik"
          value={bgmVolume}
          disabled={isMuted}
          onChange={setBgmVolume}
        />
        <VolumeSlider
          label="🔔 Efek Suara"
          value={sfxVolume}
          disabled={isMuted}
          onChange={setSfxVolume}
        />
      </div>
    </div>
  );
}

function VolumeSlider({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className={disabled ? "opacity-40" : ""}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-heading text-sm font-black text-[#1C1E26]">{label}</span>
        <span className="text-[12px] font-bold text-[#9AA0AE]">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#EEF1F6] accent-[#7C3AED]"
      />
    </div>
  );
}
