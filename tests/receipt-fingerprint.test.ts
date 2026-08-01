import { describe, expect, it } from "vitest";
import {
  fingerprintBytes,
  fingerprintDataUrl,
  fingerprintReceiptData,
  isFingerprint,
} from "@/lib/receipt-fingerprint";

const pdfA = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 struk agustus").toString("base64")}`;
const pdfB = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 struk september").toString("base64")}`;

describe("fingerprintDataUrl", () => {
  it("berkas yang sama selalu menghasilkan sidik jari yang sama", () => {
    expect(fingerprintDataUrl(pdfA)).toBe(fingerprintDataUrl(pdfA));
  });

  it("berkas berbeda menghasilkan sidik jari berbeda", () => {
    expect(fingerprintDataUrl(pdfA)).not.toBe(fingerprintDataUrl(pdfB));
  });

  it("prefiks data URL tidak memengaruhi hasil", () => {
    const bare = pdfA.slice(pdfA.indexOf(",") + 1);
    expect(fingerprintDataUrl(bare)).toBe(fingerprintDataUrl(pdfA));
  });

  it("hasilnya berbentuk hex 64 karakter", () => {
    expect(isFingerprint(fingerprintDataUrl(pdfA))).toBe(true);
  });

  it("cocok dengan hash byte langsung", () => {
    const bytes = Buffer.from("%PDF-1.4 struk agustus");
    expect(fingerprintBytes(bytes)).toBe(fingerprintDataUrl(pdfA));
  });
});

describe("fingerprintReceiptData", () => {
  it("menangkap struk yang sama walau difoto ulang", () => {
    expect(fingerprintReceiptData("Lotte Grosir", "2026-08-01", 2215855)).toBe(
      fingerprintReceiptData("Lotte Grosir", "2026-08-01", 2215855)
    );
  });

  it("mengabaikan beda huruf besar/kecil dan spasi tepi", () => {
    expect(fingerprintReceiptData("  LOTTE GROSIR ", "2026-08-01", 2215855)).toBe(
      fingerprintReceiptData("Lotte Grosir", "2026-08-01", 2215855)
    );
  });

  it("total berbeda menghasilkan sidik jari berbeda", () => {
    expect(fingerprintReceiptData("Lotte Grosir", "2026-08-01", 2215855)).not.toBe(
      fingerprintReceiptData("Lotte Grosir", "2026-08-01", 2215856)
    );
  });

  it("tanggal berbeda menghasilkan sidik jari berbeda", () => {
    expect(fingerprintReceiptData("Lotte Grosir", "2026-08-01", 2215855)).not.toBe(
      fingerprintReceiptData("Lotte Grosir", "2026-09-01", 2215855)
    );
  });
});

describe("isFingerprint", () => {
  it("menolak bentuk yang tidak sah", () => {
    expect(isFingerprint("")).toBe(false);
    expect(isFingerprint("XYZ")).toBe(false);
    expect(isFingerprint("A".repeat(64))).toBe(false); // huruf besar
    expect(isFingerprint("a".repeat(63))).toBe(false);
    expect(isFingerprint(null)).toBe(false);
  });
});
