import fs from 'fs';
import path from 'path';

const VEO_MODEL = 'veo-3.0-generate-001';
const POLL_INTERVAL_MS = 15000; // 15 sec
const MAX_WAIT_MS = 300000;     // 5 min per video

// 7 видео-сценариев для Art Online — один на каждый день воронки
const VIDEO_SCENARIOS = [
  // День 1 — TOFU — Эмоция/желание
  `Cinematic lifestyle video, handheld breathing camera, warm golden evening light.
   A European woman in her 30s arranges art supplies on a wooden dining table —
   canvas on tabletop easel, paint tubes, short brushes, glass of red wine nearby, candle flickering.
   She smiles softly, picks up a brush, and makes the first stroke on the blank canvas.
   Cozy apartment, plants in background, warm lamp glow.
   Natural fluid movement, real skin texture, no CGI, photorealistic.
   Aspect ratio 9:16, vertical video.`,

  // День 2 — TOFU — Боль/вопрос
  `Cinematic lifestyle video, slow dolly-in camera move.
   Close-up of unopened art supply bag on a shelf, dust on it, soft focus background.
   Camera slowly pushes in, then cuts to the same woman opening a new art kit box with excitement,
   pulling out brushes and paint tubes, laying them on the table.
   Warm home interior, natural daylight, genuine happy expression.
   Natural fluid movement, photorealistic, no CGI.
   Aspect ratio 9:16, vertical video.`,

  // День 3 — MOFU — Результат/трансформация
  `Cinematic lifestyle video, smooth camera pan.
   European woman holding a finished colorful painting on canvas, smiling proudly at it.
   Camera pans from her face to the painting and back.
   She walks to the wall and hangs it, steps back, admires it with a glass of wine in hand.
   Bright cozy apartment, warm afternoon light, flowers on windowsill.
   Natural fluid movement, photorealistic, no CGI.
   Aspect ratio 9:16, vertical video.`,

  // День 4 — MOFU — Процесс / 3 шага
  `Cinematic lifestyle video, handheld camera with natural breathing.
   Time-lapse style: woman sits at table with blank canvas, opens paint tubes one by one,
   follows video tutorial on tablet propped beside easel,
   makes confident brush strokes, canvas fills with color.
   Final frame: she leans back with wine glass, finished painting behind her.
   Warm home, candlelight, cozy evening atmosphere.
   Natural fluid movement, photorealistic, no CGI.
   Aspect ratio 9:16, vertical video.`,

  // День 5 — TOFU — За кулисами / вирусный
  `Cinematic behind-the-scenes video, handheld casual camera.
   Two European women friends sitting at kitchen table painting together,
   laughing, showing each other their canvases, clinking wine glasses.
   One makes a funny mistake and laughs, the other helps fix it with a brush.
   Bright cheerful apartment, Friday evening energy, flowers on table.
   Natural spontaneous movement, genuine laughter, photorealistic.
   Aspect ratio 9:16, vertical video.`,

  // День 6 — MOFU — FOMO / страх
  `Cinematic moody lifestyle video, slow push-in camera.
   Empty art supply bag on shelf, calendar on wall showing days passing.
   Cut to: same woman one month later, finally opening the art kit, smiling.
   Camera follows her hands unpacking brushes and canvas with anticipation.
   Warm evening light, candle, glass of wine ready on the table.
   Contemplative to joyful mood shift, natural movement, photorealistic.
   Aspect ratio 9:16, vertical video.`,

  // День 7 — BOFU — Прямой оффер
  `Cinematic product lifestyle video, smooth camera moves.
   Art kit box being unboxed on a wooden table: canvas, paint tubes by color,
   short brushes, instruction card — each item placed neatly.
   Woman's hands arrange everything, then she holds finished painting up to camera with a big smile.
   Text overlay space left at top and bottom. Bright clean light, warm home.
   Natural fluid movement, photorealistic, no CGI.
   Aspect ratio 9:16, vertical video.`,
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
