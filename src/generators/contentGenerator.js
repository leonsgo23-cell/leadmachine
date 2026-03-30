import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function generateContentPack(businessInfo) {
  const {
    niche,
    service,
    location,
    priceRange,
    targetAudience,
    tone,
    language,
  } = businessInfo;

  const prompt = `Ты — эксперт по контент-маркетингу для малого бизнеса в ${location}.

Создай контент-пакет на 7 дней для бизнеса:
- Ниша: ${niche}
- Услуга: ${service}
- Ценовой диапазон: ${priceRange}
- Целевая аудитория: ${targetAudience}
- Тон общения: ${tone}
- Язык контента: ${language}

ВАЖНО: Создай посты которые реально продают — не просто красивые слова, а такие которые вызывают желание записаться/купить прямо сейчас.

Создай для каждого из 7 дней посты для 4 платформ. Структура ответа строго в JSON:

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

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  return JSON.parse(text);
}
