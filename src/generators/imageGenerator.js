import fs from 'fs';
import path from 'path';

const WIDTH = 1080;
const HEIGHT = 1080;

// Переводим русское описание в английский промпт для лучшего качества
async function translateToPrompt(visualIdea, businessContext) {
  // Используем Mistral для перевода описания в качественный промпт
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content: 'Translate the visual description into a short English image generation prompt (max 50 words). Focus on visual elements only. Style: photorealistic, warm, professional social media photo.',
        },
        {
          role: 'user',
          content: `Business: ${businessContext}\nVisual idea: ${visualIdea}`,
        },
      ],
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || visualIdea;
}

async function downloadImage(prompt, filepath) {
  const encoded = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 9999);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=${WIDTH}&height=${HEIGHT}&seed=${seed}&model=flux&nologo=true`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filepath, buffer);
  return filepath;
}

export async function generateImages(contentPack, businessName, businessContext, onProgress) {
  const report = (msg) => onProgress && onProgress(msg);
  const outputDir = path.resolve('output', 'images', businessName);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const results = [];

  for (const day of contentPack.days) {
    const visualIdea = day.instagram?.visual_idea;
    if (!visualIdea) continue;

    report(`Генерирую фото для дня ${day.day}/7...`);

    const englishPrompt = await translateToPrompt(visualIdea, businessContext);
    const filepath = path.join(outputDir, `day_${day.day}.jpg`);

    await downloadImage(englishPrompt, filepath);
    results.push({ day: day.day, theme: day.theme, filepath, prompt: englishPrompt });
  }

  return results;
}
