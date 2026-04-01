import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ timeout: 120000, maxRetries: 2 });

const DAY_SCHEMA = {
  type: 'object',
  properties: {
    day: { type: 'number' },
    theme: { type: 'string' },
    instagram: {
      type: 'object',
      properties: {
        caption: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
        visual_idea: { type: 'string' },
        story_idea: { type: 'string' },
      },
      required: ['caption', 'hashtags', 'visual_idea', 'story_idea'],
    },
    tiktok: {
      type: 'object',
      properties: {
        hook: { type: 'string' },
        script: { type: 'string' },
        caption: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
      required: ['hook', 'script', 'caption', 'hashtags'],
    },
    linkedin: {
      type: 'object',
      properties: {
        caption: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
      required: ['caption', 'hashtags'],
    },
    telegram: {
      type: 'object',
      properties: { message: { type: 'string' } },
      required: ['message'],
    },
  },
  required: ['day', 'theme', 'instagram', 'tiktok', 'linkedin', 'telegram'],
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
      required: ['instagram', 'linkedin', 'telegram'],
    },
  },
  required: ['week_overview', 'cta_variations', 'bio_suggestions'],
};

async function callClaude(prompt, schema, maxTokens = 4000) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    tools: [{ name: 'output', description: 'Structured output', input_schema: schema }],
    tool_choice: { type: 'tool', name: 'output' },
    messages: [{ role: 'user', content: prompt }],
  });
  const tool = response.content.find(b => b.type === 'tool_use');
  if (!tool) throw new Error('Модель не вернула tool_use');
  return tool.input;
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

const FUNNEL_STAGES = [
  { days: [1, 2], stage: 'осведомлённость', goal: 'показать результат, зацепить внимание, рассказать что это' },
  { days: [3, 4], stage: 'интерес', goal: 'объяснить как работает, развеять сомнения, показать процесс' },
  { days: [5, 6], stage: 'желание', goal: 'отзывы, до/после, социальное доказательство, срочность' },
  { days: [7], stage: 'действие', goal: 'прямой призыв купить/записаться, спецпредложение, финальный толчок' },
];

async function generateDay(dayNum, stage, goal, context) {
  const prompt = `Ты — эксперт по контент-маркетингу. Создай контент для одного дня в социальных сетях.

${context}

День ${dayNum} | Этап воронки: ${stage} | Цель: ${goal}

Создай посты для Instagram, TikTok, LinkedIn и Telegram.
Язык: русский. Если бизнес двуязычный — добавь 1-2 предложения на латышском в конце Instagram и Telegram постов.
Тексты должны реально продавать — живой язык, конкретная польза, желание действовать.`;

  return callClaude(prompt, DAY_SCHEMA, 3000);
}

async function generateMeta(b) {
  const context = buildContext(b);
  const prompt = `Ты — эксперт по контент-маркетингу.

${context}

Создай стратегию контент-плана на неделю: общий обзор, 5 вариантов призывов к действию, и тексты для Bio/описаний профилей.`;

  return callClaude(prompt, META_SCHEMA, 1500);
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
