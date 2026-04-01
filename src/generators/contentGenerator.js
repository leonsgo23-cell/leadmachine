import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ timeout: 120000, maxRetries: 3 });

export async function generateContentPack(businessInfo) {
  const {
    niche,
    service,
    location,
    priceRange,
    targetAudience,
    tone,
    language,
    funnel,
    usp,
    competitors_insight,
  } = businessInfo;

  const funnelContext = funnel
    ? `\nВоронка продаж:\n- Осведомлённость: ${funnel.awareness}\n- Интерес: ${funnel.interest}\n- Желание: ${funnel.desire}\n- Действие: ${funnel.action}`
    : '';

  const uspContext = usp ? `\nГлавное преимущество (USP): ${usp}` : '';
  const competitorsContext = competitors_insight
    ? `\nЧто сработало у конкурентов: ${competitors_insight}`
    : '';

  const prompt = `Ты — эксперт по контент-маркетингу для малого бизнеса в ${location}.

Создай контент-пакет на 7 дней для бизнеса:
- Ниша: ${niche}
- Услуга: ${service}
- Ценовой диапазон: ${priceRange}
- Целевая аудитория: ${targetAudience}
- Тон общения: ${tone}
- Язык контента: ${language}${uspContext}${funnelContext}${competitorsContext}

Распредели 7 дней по этапам воронки: дни 1-2 на осведомлённость, дни 3-4 на интерес, дни 5-6 на желание, день 7 на действие/продажу.

ВАЖНО: Создай посты которые реально продают — не просто красивые слова, а такие которые вызывают желание купить/записаться прямо сейчас.

Создай для каждого из 7 дней посты для 5 платформ. Структура ответа строго в JSON:

{
  "week_overview": "Краткое описание стратегии на неделю",
  "days": [
    {
      "day": 1,
      "theme": "Тема дня",
      "instagram": {
        "caption": "Текст поста (эмодзи уместны, живой язык, крючок в первой строке)",
        "hashtags": ["хэштег1", "хэштег2"],
        "visual_idea": "Что снять/сфотографировать для этого поста",
        "story_idea": "Идея для сторис в этот день"
      },
      "tiktok": {
        "hook": "Первые 3 секунды видео — что говорим/показываем",
        "script": "Сценарий видео 30-60 секунд",
        "caption": "Подпись под видео",
        "hashtags": ["хэштег1", "хэштег2"]
      },
      "facebook": {
        "post": "Пост для Facebook (можно длиннее Instagram, дружелюбный тон, хорошо работают вопросы к аудитории)"
      },
      "youtube": {
        "video_idea": "Идея для YouTube видео (3-10 минут)",
        "title": "SEO-заголовок видео",
        "description": "Описание видео с ключевыми словами (первые 2 строки самые важные)"
      },
      "linkedin": {
        "caption": "Профессиональный пост (без лишних эмодзи, ценность и экспертиза)",
        "hashtags": ["хэштег1", "хэштег2"]
      },
      "telegram": {
        "message": "Сообщение для Telegram-канала (можно длиннее, разговорный стиль)"
      }
    }
  ],
  "cta_variations": [
    "5 разных призывов к действию для этой ниши"
  ],
  "bio_suggestions": {
    "instagram": "Текст для Bio в Instagram",
    "linkedin": "Заголовок профиля LinkedIn",
    "telegram": "Описание Telegram-канала"
  }
}

Отвечай ТОЛЬКО валидным JSON без markdown блоков.`;

  let raw = '';
  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
      raw += chunk.delta.text;
    }
  }

  const text = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(text);
}
