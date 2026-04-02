import fs from 'fs';
import path from 'path';

const VEO_MODEL = 'veo-3.0-generate-001';
const POLL_INTERVAL_MS = 15000; // 15 sec
const MAX_WAIT_MS = 300000;     // 5 min per video

// 7 видео-сценариев для Art Online — один на каждый день воронки
// Правила: одна сцена уже готова, одно действие, никаких cuts/then/transitions
const VIDEO_SCENARIOS = [
  // День 1 — TOFU — Эмоция/желание
  `Cinematic lifestyle video, slow gentle dolly-in camera move, single continuous shot.
   A European woman with dark hair in her 30s sits at a wooden dining table in a cozy apartment.
   Already in front of her: a small wooden tabletop easel holding a white stretched rectangular canvas facing her,
   several short-handled paint brushes laid on the table, acrylic paint tubes in a row, a palette with colors,
   a glass of red wine to her right, a lit candle, small flowers in a vase.
   Warm orange lamp light glows behind her, evening atmosphere.
   She dips one brush into paint on the palette and makes a single slow confident stroke on the canvas, then smiles softly.
   Camera moves slowly forward toward her face. No cuts. Photorealistic, no CGI, no morphing.`,

  // День 2 — TOFU — Образование / боль
  `Cinematic lifestyle video, slow push-in camera, single continuous shot.
   Close-up of a woman's hands on a wooden table.
   On the table: an open art kit box, acrylic paint tubes already laid out in a neat row by color,
   short-handled brushes placed beside them, a white stretched canvas on a small wooden tabletop easel facing camera.
   Her hands pick up one paint brush, hold it up, examine it with curiosity and a small smile.
   Warm natural morning light from a window. Cozy home interior, plants in soft focus background.
   No cuts, no objects appearing from outside the frame. Photorealistic, no CGI.`,

  // День 3 — MOFU — Результат
  `Cinematic lifestyle video, slow pan from left to right, single continuous shot.
   A European woman in her 30s stands in a bright living room holding a finished colorful acrylic painting
   on a white stretched canvas — rectangular, landscape with flowers and warm colors.
   She holds the canvas with both hands at chest level, facing camera, smiling proudly.
   Behind her: white wall with warm lamp, plants, cozy apartment.
   A glass of red wine stands on a small table beside her.
   She slowly turns the painting slightly to show it to camera. No cuts. Photorealistic, no CGI.`,

  // День 4 — MOFU — Процесс
  `Cinematic lifestyle video, handheld camera with gentle breathing, single continuous shot.
   A European woman sits at a wooden table painting on a white stretched canvas on a small tabletop easel.
   The canvas already has some colorful brush strokes on it.
   To her left: a tablet propped against a small box showing a painting video tutorial, screen clearly visible.
   On the table: short-handled brushes, paint palette with mixed colors, paint tubes, glass of red wine.
   She looks at the tablet screen, then back at canvas, and adds one deliberate brush stroke.
   Warm candlelight, cozy evening. No cuts, camera gently breathes. Photorealistic, no CGI.`,

  // День 5 — TOFU — За кулисами
  `Cinematic lifestyle video, static wide shot with slight handheld shake, single continuous shot.
   Two European women in their 30s sit across from each other at a large kitchen table.
   Each has a white stretched canvas on a small wooden tabletop easel in front of her, facing herself.
   Paint palettes, short brushes, paint tubes on the table between them, two glasses of white wine.
   Both are painting and talking, one laughs at something and shows her canvas to the other.
   The other leans forward laughing too. Bright cheerful apartment, daylight from window.
   No cuts, no transitions. Photorealistic, genuine expressions, no CGI.`,

  // День 6 — MOFU — FOMO
  `Cinematic lifestyle video, slow dolly-in toward table, single continuous shot.
   A wooden dining table set for a creative evening in a warm cozy apartment.
   On the table: a small wooden tabletop easel with a white stretched canvas,
   paint tubes arranged by color in a neat row, short brushes in a glass jar,
   a glass of red wine, a lit candle, small white flowers.
   No person in frame — the table is ready and waiting, inviting.
   Warm golden evening light, plants in soft focus background.
   Camera slowly moves forward toward the canvas. No cuts. Photorealistic, cinematic, no CGI.`,

  // День 7 — BOFU — Прямой оффер
  `Cinematic lifestyle video, slow tilt-up camera move, single continuous shot.
   A wooden table with a finished colorful acrylic painting on a white stretched canvas,
   canvas leaning against the wall facing camera, flowers and warm colors clearly visible on it.
   In front of the painting on the table: a glass of red wine, a lit candle, short paint brushes.
   A European woman in her 30s stands beside the table, one hand resting on the table edge,
   smiling and looking at the painting with satisfaction.
   Camera starts at table level and slowly tilts up to show her face and the painting together.
   Bright warm apartment light. No cuts. Photorealistic, no CGI.`,
];

async function startVideoGeneration(prompt) {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${VEO_MODEL}:predictLongRunning?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: prompt.replace(/\n\s+/g, ' ').trim() }],
      parameters: { aspectRatio: '9:16', sampleCount: 1 },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Veo API error ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  if (!data.name) throw new Error('Veo не вернул operation name');
  return data.name; // e.g. "models/veo-3.0-generate-001/operations/abc123"
}

async function pollVideoOperation(operationName) {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${key}`;
  const start = Date.now();

  while (Date.now() - start < MAX_WAIT_MS) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Poll error ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    if (data.done) {
      if (data.error) throw new Error(`Veo operation failed: ${JSON.stringify(data.error)}`);
      const samples = data.response?.generateVideoResponse?.generatedSamples;
      if (!samples?.length) throw new Error('Veo не вернул видео в ответе: ' + JSON.stringify(data.response).slice(0, 200));
      return samples[0].video; // { uri } or { bytesBase64Encoded }
    }
  }
  throw new Error('Veo timeout: операция заняла больше 5 минут');
}

async function generateVideo(prompt, outputPath) {
  const operationName = await startVideoGeneration(prompt);
  const video = await pollVideoOperation(operationName);

  if (video.bytesBase64Encoded) {
    const buf = Buffer.from(video.bytesBase64Encoded, 'base64');
    fs.writeFileSync(outputPath, buf);
  } else if (video.uri) {
    // Если вернул URI — скачиваем
    const key = process.env.GEMINI_API_KEY;
    const res = await fetch(`${video.uri}&key=${key}`);
    if (!res.ok) throw new Error(`Failed to download video from URI: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outputPath, buf);
  } else {
    throw new Error('Veo вернул неизвестный формат: ' + JSON.stringify(video).slice(0, 200));
  }

  return outputPath;
}

export async function generateVideos(contentPack, businessName, onProgress, testMode = false) {
  const report = (msg) => onProgress && onProgress(msg);
  const videoDir = path.resolve('output', 'videos', businessName);
  if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

  const days = testMode ? contentPack.days.slice(0, 1) : contentPack.days;
  const results = [];

  for (const day of days) {
    const dayIdx = day.day - 1;
    const prompt = VIDEO_SCENARIOS[dayIdx % VIDEO_SCENARIOS.length];
    const outputPath = path.join(videoDir, `day_${day.day}.mp4`);

    report(`День ${day.day}/7 — запускаю генерацию видео (Veo 3.0)...`);
    try {
      await generateVideo(prompt, outputPath);
      report(`День ${day.day}/7 — видео готово ✓`);
      results.push({ day: day.day, theme: day.theme, filepath: outputPath });
    } catch (err) {
      report(`День ${day.day}/7 — ошибка: ${err.message}`);
      results.push({ day: day.day, theme: day.theme, error: err.message });
    }
  }

  return results;
}
