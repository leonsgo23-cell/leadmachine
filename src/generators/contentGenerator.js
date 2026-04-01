const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const MODEL = 'mistral-small-latest';

async function callMistral(prompt, schema, maxTokens = 4000) {
  const res = await fetch(MISTRAL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Ты эксперт по контент-маркетингу. Отвечай ТОЛЬКО валидным JSON строго по схеме: ${JSON.stringify(schema)}`,
        },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mistral API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Mistral не вернул контент');
  return JSON.parse(text);
}

function buildContext(b) {
  return `Бизнес: ${b.niche}
Услуга: ${b.service}
Локация: ${b.location}
Цены: ${b.priceRange}
Аудитория: ${b.targetAudience}
Тон: ${b.tone}
Язык: ${b.language}
USP: ${b.usp || '—'}
Инсайты конкурентов: ${b.competitors_insight || '—'}`;
}

const DAY_SCHEMA = {
  type: 'object',
  properties: {
    day: { type: 'number' },
    theme: { type: 'string', description: 'Тема дня' },
    instagram: {
      type: 'object',
      properties: {
        caption: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
        visual_idea: { type: 'string' },
        story_idea: { type: 'string' },
      },
    },
    tiktok: {
      type: 'object',
      properties: {
        hook: { type: 'string' },
        script: { type: 'string' },
        caption: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
    },
    linkedin: {
      type: 'object',
      properties: {
        caption: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
    },
    telegram: {
      type: 'object',
      properties: { message: { type: 'string' } },
    },
  },
};

const META_SCHEMA = {
  type: 'object',
  properties: {
    week_overview: { type: 'string' },
    cta_variations: { type: 'array', items: { type: 'string' } },
    bio_suggestions: {
      type: 'object',
      properties: {
        instagram: { type: 'string' },
        linkedin: { type: 'string' },
        telegram: { type: 'string' },
      },
    },
  },
};

const FUNNEL_STAGES = [
  { days: [1, 2], stage: 'осведомлённость', goal: 'показать результат, зацепить внимание, рассказать что это' },
  { days: [3, 4], stage: 'интерес', goal: 'объяснить как работает, развеять сомнения, показать процесс' },
  { days: [5, 6], stage: 'желание', goal: 'отзывы, до/после, социальное доказательство, срочность' },
  { days: [7], stage: 'действие', goal: 'прямой призыв купить/записаться, спецпредложение, финальный толчок' },
];

async function generateDay(dayNum, stage, goal, context) {
  const prompt = `${context}

День ${dayNum} | Этап воронки: ${stage} | Цель: ${goal}

Создай посты для Instagram, TikTok, LinkedIn и Telegram.
Язык: русский. Добавь 1-2 предложения на латышском в конце Instagram и Telegram постов.
Тексты должны реально продавать — живой язык, конкретная польза, желание действовать.`;

  return callMistral(prompt, DAY_SCHEMA, 3000);
}

async function generateMeta(b) {
  const prompt = `${buildContext(b)}

Создай стратегию контент-плана на неделю: общий обзор (2-3 предложения), 5 вариантов призывов к действию, и тексты для Bio/описаний профилей в Instagram, LinkedIn и Telegram.`;

  return callMistral(prompt, META_SCHEMA, 1500);
}

export async function generateContentPack(businessInfo, onProgress) {
  const context = buildContext(businessInfo);
  const days = [];
  const report = (msg) => onProgress && onProgress(msg);

  report('Генерирую стратегию недели...');
  const meta = await generateMeta(businessInfo);

  for (const { days: dayNums, stage, goal } of FUNNEL_STAGES) {
    for (const dayNum of dayNums) {
      report(`Генерирую день ${dayNum}/7 (${stage})...`);
      const day = await generateDay(dayNum, stage, goal, context);
      days.push(day);
    }
  }

  return { ...meta, days };
}
