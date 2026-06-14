import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const IMAGE_SIZE = 512;
const BACKGROUND_WIDTH = 1280;
const BACKGROUND_HEIGHT = 720;
const STORAGE_BUCKET = "ai-assets";

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

async function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const { default: OpenAI } = await import("openai");
  return new OpenAI({ apiKey });
}

/**
 * Generate gambar via gpt-image-1 (1024x1024), resize ke 512px PNG, lalu upload
 * ke Supabase Storage bucket "ai-assets". Mengembalikan public URL, atau null
 * jika OPENAI_API_KEY belum diisi / terjadi error.
 */
export async function generateAndStoreImage(prompt: string, folder: string): Promise<string | null> {
  const client = await getOpenAIClient();
  if (!client) return null;

  try {
    const sharp = (await import("sharp")).default;

    const response = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      quality: "medium",
      n: 1,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) return null;

    const original = Buffer.from(b64, "base64");
    const resized = await sharp(original).resize(IMAGE_SIZE, IMAGE_SIZE).png({ quality: 80 }).toBuffer();

    const path = `${folder}/${crypto.randomUUID()}.png`;
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, resized, {
      contentType: "image/png",
      upsert: false,
    });

    if (error) {
      console.error("generateAndStoreImage upload error", error);
      return null;
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error("generateAndStoreImage error", err);
    return null;
  }
}

/**
 * Generate gambar background via gpt-image-1 (1536x1024), crop ke 1280x720 PNG,
 * lalu upload ke Supabase Storage bucket "ai-assets". Mengembalikan public URL,
 * atau null jika OPENAI_API_KEY belum diisi / terjadi error.
 */
export async function generateAndStoreBackground(prompt: string, folder: string): Promise<string | null> {
  const client = await getOpenAIClient();
  if (!client) return null;

  try {
    const sharp = (await import("sharp")).default;

    const response = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1536x1024",
      quality: "medium",
      n: 1,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) return null;

    const original = Buffer.from(b64, "base64");
    const resized = await sharp(original)
      .resize(BACKGROUND_WIDTH, BACKGROUND_HEIGHT, { fit: "cover" })
      .png({ quality: 80 })
      .toBuffer();

    const path = `${folder}/${crypto.randomUUID()}.png`;
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, resized, {
      contentType: "image/png",
      upsert: false,
    });

    if (error) {
      console.error("generateAndStoreBackground upload error", error);
      return null;
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error("generateAndStoreBackground error", err);
    return null;
  }
}

/**
 * Panggil GPT-4o dengan prompt teks dan minta respons JSON.
 * Mengembalikan object hasil parse, atau null jika API key kosong / error.
 */
export async function generateJSON<T>(systemPrompt: string, userPrompt: string): Promise<T | null> {
  const client = await getOpenAIClient();
  if (!client) return null;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error("generateJSON error", err);
    return null;
  }
}
