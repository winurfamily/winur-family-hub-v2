interface WorldBackgroundProps {
  theme?: string | null;
  imageUrl?: string | null;
}

interface Star {
  top: string;
  left: string;
  size: number;
  opacity: number;
  delay: string;
}

const STARS: Star[] = [
  { top: "5%", left: "8%", size: 2, opacity: 0.8, delay: "0s" },
  { top: "9%", left: "22%", size: 1.5, opacity: 0.6, delay: "0.4s" },
  { top: "14%", left: "38%", size: 2.5, opacity: 0.9, delay: "0.8s" },
  { top: "7%", left: "55%", size: 1.5, opacity: 0.5, delay: "1.2s" },
  { top: "16%", left: "70%", size: 2, opacity: 0.7, delay: "1.6s" },
  { top: "6%", left: "85%", size: 1.5, opacity: 0.6, delay: "2s" },
  { top: "24%", left: "12%", size: 1.5, opacity: 0.5, delay: "0.6s" },
  { top: "28%", left: "48%", size: 2, opacity: 0.8, delay: "1s" },
  { top: "22%", left: "92%", size: 1.5, opacity: 0.6, delay: "1.4s" },
  { top: "34%", left: "28%", size: 1.5, opacity: 0.5, delay: "1.8s" },
  { top: "40%", left: "65%", size: 2.5, opacity: 0.9, delay: "2.2s" },
  { top: "38%", left: "5%", size: 1.5, opacity: 0.55, delay: "0.3s" },
  { top: "46%", left: "82%", size: 2, opacity: 0.7, delay: "0.9s" },
  { top: "52%", left: "18%", size: 1.5, opacity: 0.5, delay: "1.5s" },
  { top: "58%", left: "45%", size: 2, opacity: 0.75, delay: "2.4s" },
  { top: "62%", left: "72%", size: 1.5, opacity: 0.6, delay: "0.2s" },
  { top: "68%", left: "10%", size: 2, opacity: 0.65, delay: "1.1s" },
  { top: "74%", left: "58%", size: 1.5, opacity: 0.5, delay: "1.9s" },
  { top: "78%", left: "30%", size: 2.5, opacity: 0.85, delay: "0.7s" },
  { top: "84%", left: "88%", size: 1.5, opacity: 0.55, delay: "2.1s" },
  { top: "88%", left: "20%", size: 1.5, opacity: 0.5, delay: "1.3s" },
  { top: "92%", left: "62%", size: 2, opacity: 0.7, delay: "0.5s" },
  { top: "12%", left: "95%", size: 1.5, opacity: 0.5, delay: "2.3s" },
  { top: "96%", left: "42%", size: 1.5, opacity: 0.6, delay: "1.7s" },
];

/** Background dunia anak: dark navy "game world" dengan bintang berkedip + glow warna lembut. Gambar custom (jika ada) ditampilkan samar di atasnya. */
export function WorldBackground({ imageUrl }: WorldBackgroundProps) {
  return (
    <div className="bg-child-game fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Glow warna — kedalaman ala "game world" */}
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-[100px]" />
      <div className="absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-primary/10 blur-[120px]" />
      <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-secondary/10 blur-[110px]" />

      {/* Background custom (jika anak punya world image) — tampil samar di atas gradient navy */}
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15 mix-blend-overlay" />
      )}

      {/* Bintang berkedip */}
      {STARS.map((star, i) => (
        <span
          key={i}
          className="absolute animate-twinkle rounded-full bg-white"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
            animationDelay: star.delay,
          }}
        />
      ))}
    </div>
  );
}
