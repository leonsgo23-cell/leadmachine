import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';

const IMAGEN_MODEL = 'imagen-4.0-generate-001';

const BRAND = {
  burgundy: '#b00d22',
  purple: '#8473ef',
  cream: '#fef7f1',
  dark: '#1e1245',
  white: '#ffffff',
};

// Промпты фото — только фотореализм, один гаджет если есть
const ATMOSPHERE_PROMPTS = [
  // 1. Подготовка к вечеру
  `Award-winning lifestyle photography, Canon 5D, real photo. Cozy European apartment evening,
   woman setting up a large wooden tabletop easel on a dining table,
   50x60cm canvas on easel facing her, paint tubes and short brushes beside it,
   glass of red wine nearby, warm candlelight, soft lamp glow,
   flowers in vase, canvas much larger than wine glass,
   photorealistic, no illustration, no text`,

  // 2. Планшет — смотрит видеоурок, рисует
  `Award-winning lifestyle photography, Canon 5D, real photo. Happy European woman
   painting on large 50x60cm canvas on wooden tabletop easel,
   only one tablet propped beside easel showing painting video tutorial,
   she looks at tablet and paints, short brushes, colorful palette, glass of red wine,
   warm cozy home interior, bright joyful mood,
   photorealistic, no illustration, no text`,

  // 3. Процесс рисования
  `Award-winning lifestyle photography, Canon 5D, real photo. European woman
   painting on large 50x60cm canvas on tabletop easel, holding short brush,
   happy concentrated expression, colorful palette, wine glass nearby,
   bright home with white walls and plants, afternoon light, paint on fingers,
   photorealistic, no illustration, no text`,

  // 4. Смотрит видеоурок на телевизоре
  `Award-winning lifestyle photography, Canon 5D, real photo. European woman
   at dining table with large 50x60cm canvas on wooden easel,
   only one TV on wall in background showing painting tutorial,
   she paints following the lesson, wine glass on table, short brushes, cozy warm home,
   photorealistic, no illustration, no text`,

  // 5. Натюрморт — стол с принадлежностями
  `Award-winning product lifestyle photography, Canon 5D, real photo.
   Neatly arranged art supplies on wooden table: large 50x60cm canvas on tabletop easel,
   acrylic paint tubes by color, short brushes in small jar, palette,
   glass of red wine, candle, flowers, canvas much bigger than wine glass,
   warm light, photorealistic, no illustration, no text`,

  // 6. Подруги рисуют вместе
  `Award-winning lifestyle photography, Canon 5D, real photo.
   Two happy European women at kitchen table painting together,
   large 50x60cm canvases on tabletop easels, wine glasses, short brushes,
   colorful paints, cheerful bright apartment, Friday evening vibe, warm light,
   photorealistic, no illustration, no text`,

  // 7. Картина на стене
  `Award-winning interior lifestyle photography, Canon 5D, real photo.
   Bright European living room, large colorful floral painting 50x60 on white wall,
   woman admiring it with smile, wine glass in hand, plants, warm lighting,
   photorealistic, no illustration, no text`,

  // 8. Готовая картина — пейзаж
  `Award-winning still life photography, Canon 5D, real photo.
   Beautiful finished acrylic landscape painting on large 50x60 canvas on tabletop easel,
   vibrant autumn colors, candle and wine glass beside it, bright European home,
   photorealistic, no illustration, no text`,

  // 9. Смартфон — видеоурок рядом
  `Award-winning lifestyle photography, Canon 5D, real photo. European woman
   sitting at table with large 50x60cm canvas on easel,
   only one smartphone propped against paint jar showing painting tutorial video,
   she follows lesson with short brush in hand, wine glass nearby, warm evening light,
   photorealistic, no illustration, no text`,

  // 10. Стол готов — начинаем
  `Award-winning lifestyle photography, Canon 5D, real photo.
   Cozy European apartment, table set for creative evening: wine bottle, two glasses,
   large wooden tabletop easel with 50x60 blank canvas, paint tubes, short brushes,
   candle, flowers, canvas dominates composition,
   photorealistic, no illustration, no text`,
];

async function generateWithImagen(prompt, retries = 3) {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict?key=${key}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: prompt.replace(/\n\s+/g, ' ').trim() }],
        parameters: { sampleCount: 1, aspectRatio: '1:1' },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const b64 = data.predictions?.[0]?.bytesBase64Encoded;
      if (b64) return Buffer.from(b64, 'base64');
    }
    const err = await res.text();
    if (attempt === retries) throw new Error(`Imagen API error ${res.status}: ${err.slice(0, 200)}`);
    await new Promise(r => setTimeout(r, 5000 * attempt));
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, currentY);
      line = word + ' ';
      currentY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, currentY);
  return currentY + lineHeight;
}

async function createSlide(options) {
  const { title, subtitle, body, cta, slideNum, total, bgImageBuffer } = options;
  const SIZE = 1080;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  if (bgImageBuffer) {
    try {
      const img = await loadImage(bgImageBuffer);
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      // Лёгкий светлый оверлей сверху для текста — не тёмный!
      const overlay = ctx.createLinearGradient(0, 0, 0, SIZE * 0.55);
      overlay.addColorStop(0, 'rgba(255,255,255,0.82)');
      overlay.addColorStop(1, 'rgba(255,255,255,0.0)');
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, SIZE, SIZE);
    } catch {
      ctx.fillStyle = BRAND.cream;
      ctx.fillRect(0, 0, SIZE, SIZE);
    }
  } else {
    // Без фото — светлый кремовый фон
    ctx.fillStyle = BRAND.cream;
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Едва заметный акцент в углу
    const accent = ctx.createRadialGradient(SIZE, 0, 0, SIZE, 0, SIZE * 0.6);
    accent.addColorStop(0, `${BRAND.purple}22`);
    accent.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // Акцентная полоска слева — тонкая, бордо
  ctx.fillStyle = BRAND.burgundy;
  ctx.fillRect(60, 80, 5, 220);

  // Номер слайда
  const textColor = bgImageBuffer ? BRAND.dark : BRAND.dark;
  ctx.fillStyle = `${BRAND.burgundy}99`;
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`${slideNum} / ${total}`, 80, 70);

  let y = 130;

  if (title) {
    ctx.fillStyle = textColor;
    ctx.font = `bold 64px sans-serif`;
    y = wrapText(ctx, title, 80, y, SIZE - 160, 78);
    y += 8;
  }

  if (subtitle) {
    ctx.fillStyle = BRAND.burgundy;
    ctx.font = 'bold 38px sans-serif';
    y = wrapText(ctx, subtitle, 80, y, SIZE - 160, 50);
    y += 8;
  }

  if (body) {
    ctx.fillStyle = `${BRAND.dark}cc`;
    ctx.font = '32px sans-serif';
    y = wrapText(ctx, body, 80, y, SIZE - 160, 44);
  }

  if (cta) {
    const ctaY = SIZE - 150;
    ctx.fillStyle = BRAND.burgundy;
    ctx.beginPath();
    ctx.roundRect(80, ctaY, 520, 66, 33);
    ctx.fill();
    ctx.fillStyle = BRAND.white;
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(cta, 110, ctaY + 43);
  }

  // Нижняя полоска бренда — светлая
  ctx.fillStyle = `${BRAND.cream}f0`;
  ctx.fillRect(0, SIZE - 60, SIZE, 60);
  ctx.fillStyle = BRAND.burgundy;
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Art', 60, SIZE - 18);
  ctx.fillStyle = BRAND.purple;
  ctx.fillText('&', 97, SIZE - 18);
  ctx.fillStyle = BRAND.dark;
  ctx.fillText('Wine', 118, SIZE - 18);
  ctx.fillStyle = `${BRAND.dark}88`;
  ctx.font = '20px sans-serif';
  ctx.fillText('• artonline.lv', 176, SIZE - 18);

  return canvas.toBuffer('image/jpeg', { quality: 0.95 });
}

async function buildCarousel(day, photos) {
  const caption = day.instagram?.caption || '';
  const benefits = caption.split('\n')
    .filter(l => l.trim().match(/^✅/))
    .map(l => l.replace('✅', '').trim())
    .slice(0, 3);

  // Каждый слайд получает своё уникальное фото
  const slides = [
    {
      title: day.theme,
      subtitle: 'Листай →',
      body: null,
      cta: null,
      bgImageBuffer: photos[0],
    },
    {
      title: 'Хотела рисовать, но казалось — не для меня?',
      subtitle: null,
      body: 'Нет времени на курсы. Страшно, что не получится. Непонятно с чего начать.',
      cta: null,
      bgImageBuffer: null,
    },
    {
      title: 'Мы решили это.',
      subtitle: null,
      body: benefits.join('  •  ') || 'Всё необходимое в наборе. Видеоурок с художником. Результат за 2 часа.',
      cta: null,
      bgImageBuffer: photos[1] || photos[0],
    },
    {
      title: 'Готовая картина за 2 часа',
      subtitle: 'С нуля. Без навыков.',
      body: '9 лет студия  •  20 000+ участников  •  4.9★ Google',
      cta: null,
      bgImageBuffer: photos[2] || null,
    },
    {
      title: 'Попробуй сегодня',
      subtitle: null,
      body: 'Набор с видеоуроком от €40. Доставка по всей Латвии.',
      cta: '→ Выбрать картину',
      bgImageBuffer: photos[3] || photos[0],
    },
  ];

  const buffers = [];
  for (let i = 0; i < slides.length; i++) {
    const buf = await createSlide({ ...slides[i], slideNum: i + 1, total: slides.length });
    buffers.push(buf);
  }
  return buffers;
}

export async function generateImages(contentPack, businessName, _ctx, onProgress, testMode = false) {
  const report = (msg) => onProgress && onProgress(msg);
  const imgDir = path.resolve('output', 'images', businessName);
  const carouselDir = path.resolve('output', 'carousels', businessName);
  if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
  if (!fs.existsSync(carouselDir)) fs.mkdirSync(carouselDir, { recursive: true });

  const days = testMode ? contentPack.days.slice(0, 1) : contentPack.days;
  const results = [];

  for (const day of days) {
    const dayIdx = day.day - 1;
    // Главное фото дня — атмосферный промпт под этот день
    const mainPrompt = ATMOSPHERE_PROMPTS[dayIdx % ATMOSPHERE_PROMPTS.length];

    report(`День ${day.day} — фото 1/4 (Imagen 4.0)...`);
    const photo1 = await generateWithImagen(mainPrompt);
    fs.writeFileSync(path.join(imgDir, `day_${day.day}.jpg`), photo1);

    // Ещё 3 фото для слайдов карусели — разные атмосферные сцены
    report(`День ${day.day} — фото 2/4...`);
    const photo2 = await generateWithImagen(ATMOSPHERE_PROMPTS[(dayIdx + 2) % ATMOSPHERE_PROMPTS.length]);

    report(`День ${day.day} — фото 3/4...`);
    const photo3 = await generateWithImagen(ATMOSPHERE_PROMPTS[(dayIdx + 4) % ATMOSPHERE_PROMPTS.length]);

    report(`День ${day.day} — фото 4/4...`);
    const photo4 = await generateWithImagen(ATMOSPHERE_PROMPTS[(dayIdx + 1) % ATMOSPHERE_PROMPTS.length]);

    // Карусель с 4 разными фото
    report(`День ${day.day} — карусель...`);
    const slides = await buildCarousel(day, [photo1, photo2, photo3, photo4]);
    const dayCarouselDir = path.join(carouselDir, `day_${day.day}`);
    if (!fs.existsSync(dayCarouselDir)) fs.mkdirSync(dayCarouselDir);
    slides.forEach((buf, i) => {
      fs.writeFileSync(path.join(dayCarouselDir, `slide_${i + 1}.jpg`), buf);
    });

    results.push({
      day: day.day,
      theme: day.theme,
      filepath: path.join('output', 'images', businessName, `day_${day.day}.jpg`),
      carousel: path.join('output', 'carousels', businessName, `day_${day.day}`),
    });
  }

  return results;
}
