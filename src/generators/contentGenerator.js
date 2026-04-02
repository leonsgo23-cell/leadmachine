const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const MODEL = 'mistral-small-latest';

async function callMistral(systemPrompt, userPrompt, schema, maxTokens = 4000) {
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
        { role: 'system', content: `${systemPrompt}\n\nОтвечай ТОЛЬКО валидным JSON строго по схеме: ${JSON.stringify(schema)}` },
        { role: 'user', content: userPrompt },
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

function buildBusinessContext(b) {
  const hero = b.hero || {};
  const jtbd = b.jtbd || {};
  return `
ПРОДУКТ: ${b.niche}
УСЛУГА: ${b.service}
ЛОКАЦИЯ: ${b.location}
ЦЕНЫ: ${b.priceRange}
USP: ${b.usp}
ЯЗЫК: ${b.language}
ТОН: ${b.tone}
КЛЮЧЕВОЕ СООБЩЕНИЕ: ${b.core_message || b.usp}

ГЕРОЙ (клиент):
- Портрет: ${hero.portrait || b.targetAudience}
- Мечта: ${hero.dream || ''}
- Страхи: ${(hero.fears || []).join('; ')}
- Боли: ${(hero.pains || []).join('; ')}
- Социальное желание: ${hero.social_desire || ''}

JOBS-TO-BE-DONE:
- Функциональный: ${jtbd.functional || ''}
- Эмоциональный: ${jtbd.emotional || ''}
- Социальный: ${jtbd.social || ''}

ЧТО СРАБОТАЛО У КОНКУРЕНТОВ: ${b.competitors_insight || ''}
  `.trim();
}

// 7-дневный план по фреймворкам
const WEEK_PLAN = [
  {
    day: 1,
    pillar: 'inspirational',
    funnel_stage: 'TOFU',
    storybrand: 'Герой и его мир — показываем жизнь клиента и его желание',
    hook_type: 'emotion',
    elf_trigger: 'Emotion',
    goal: 'Зацепить холодную аудиторию через желание и атмосферу. Без продаж.',
  },
  {
    day: 2,
    pillar: 'educational',
    funnel_stage: 'TOFU',
    storybrand: 'Проблема — внешняя (нет времени/навыков), внутренняя (страх не получится)',
    hook_type: 'question',
    elf_trigger: 'Logic',
    goal: 'Образовательный контент который резонирует с болями. Без продаж.',
  },
  {
    day: 3,
    pillar: 'inspirational',
    funnel_stage: 'MOFU',
    storybrand: 'Встреча с проводником — эмпатия + авторитет. Мы понимаем и умеем.',
    hook_type: 'result',
    elf_trigger: 'Emotion',
    goal: 'Кейс клиента или история трансформации. Показываем реальный результат.',
  },
  {
    day: 4,
    pillar: 'educational',
    funnel_stage: 'MOFU',
    storybrand: 'Простой план — объясняем как работает, 3 шага к результату',
    hook_type: 'curiosity',
    elf_trigger: 'Logic',
    goal: 'Развеять страхи и возражения. Объяснить как просто это на самом деле.',
  },
  {
    day: 5,
    pillar: 'entertainment',
    funnel_stage: 'TOFU',
    storybrand: 'Человеческое лицо бренда — за кулисами, живой момент',
    hook_type: 'curiosity',
    elf_trigger: 'Emotion',
    goal: 'Расширить охват, показать бренд живым. Развлекательный, вирусный потенциал.',
  },
  {
    day: 6,
    pillar: 'inspirational',
    funnel_stage: 'MOFU',
    storybrand: 'Избежание провала — что происходит если продолжать откладывать',
    hook_type: 'fear',
    elf_trigger: 'Fear',
    goal: 'FOMO. Время идёт, мечта откладывается. Подтолкнуть к решению.',
  },
  {
    day: 7,
    pillar: 'promotional',
    funnel_stage: 'BOFU',
    storybrand: 'Призыв к действию — трансформация доступна прямо сейчас',
    hook_type: 'offer',
    elf_trigger: 'Fear + Logic',
    goal: 'Прямая продажа. Цена, оффер, дедлайн, CTA. Один чёткий призыв.',
  },
];

const HOOK_EXAMPLES = {
  emotion: 'Открывается через желание/мечту: "Представь: пятница вечер, вино, свечи — и через 2 часа готовая картина на стене"',
  question: 'Вопрос который задевает боль: "Ты тоже покупала краски, которые до сих пор лежат нераспакованными?"',
  result: 'Конкретный результат: "Она никогда не рисовала. За один вечер вот что получилось"',
  curiosity: 'Разжигает любопытство: "Секрет почему 20 000 человек нарисовали картину за вечер без навыков"',
  fear: 'Страх потери: "Ещё один год пройдёт, а ты так и не попробовала то, о чём давно мечтала"',
  offer: 'Прямой оффер: "Набор для рисования + видеоурок за €40 — доставим в Ригу за 2 дня"',
};

async function generateDayContent(dayPlan, businessContext, language) {
  const systemPrompt = `Ты — эксперт по контент-маркетингу для соцсетей. Ты знаешь фреймворки StoryBrand, Hook-Story-Offer, TOFU/MOFU/BOFU, Jobs-to-be-done и ELF (Emotion-Logic-Fear).

Твоя задача: создавать контент который по-настоящему ПРОДАЁТ — через эмоцию, историю и правильный призыв к действию.

ПРАВИЛА:
1. Каждый пост = Сильный ХУУК (первые 2-3 слова останавливают скролл) + История/Ценность + CTA
2. НЕ начинай с названия бренда или "Мы предлагаем"
3. Говори языком клиента, не языком продавца
4. Клиент — герой истории, бренд — проводник
5. ${language}`;

  const userPrompt = `${businessContext}

ДЕНЬ ${dayPlan.day} из 7:
- Пиллар: ${dayPlan.pillar}
- Этап воронки: ${dayPlan.funnel_stage}
- StoryBrand этап: ${dayPlan.storybrand}
- Тип хука: ${dayPlan.hook_type} — ${HOOK_EXAMPLES[dayPlan.hook_type]}
- Психологический триггер: ${dayPlan.elf_trigger}
- Цель этого дня: ${dayPlan.goal}

Создай посты для Instagram, TikTok, LinkedIn и Telegram.
Для каждого адаптируй формат под платформу (Instagram — эмоциональный + хэштеги, TikTok — быстрый сценарий с хуком в 3 сек, LinkedIn — профессиональный угол, Telegram — разговорный).`;

  const schema = {
    type: 'object',
    properties: {
      day: { type: 'number' },
      theme: { type: 'string' },
      hook: { type: 'string', description: 'Главный хук дня — первые 2-3 слова которые останавливают скролл' },
      core_emotion: { type: 'string', description: 'Главная эмоция которую вызывает этот контент' },
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
          hook: { type: 'string', description: 'Первые 3 секунды — что говорим/показываем' },
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
      carousel_concept: {
        type: 'object',
        description: 'Концепция карусели для этого дня',
        properties: {
          hook_slide: { type: 'string', description: 'Текст первого слайда — хук' },
          pain_slide: { type: 'string', description: 'Боль или проблема клиента' },
          solution_slide: { type: 'string', description: 'Решение или инсайт' },
          proof_slide: { type: 'string', description: 'Доказательство — факт, результат, цифра' },
          cta_slide: { type: 'string', description: 'Призыв к действию' },
        },
      },
    },
  };

  return callMistral(systemPrompt, userPrompt, schema, 3500);
}

async function generateWeekStrategy(b) {
  const systemPrompt = `Ты — стратег контент-маркетинга. Создаёшь стратегию которая реально конвертирует подписчиков в покупателей.`;

  const userPrompt = `${buildBusinessContext(b)}

Создай стратегию контент-плана на неделю:
1. Главное послание недели (одна идея через 7 форматов — Правило 7 касаний)
2. Обзор логики воронки на неделю (как дни 1-7 ведут от холодной аудитории к покупке)
3. 5 сильных CTA для этого продукта
4. Тексты для Bio/описаний профилей
5. Самокритика: какие возражения могут быть у аудитории и как их закрывает этот план`;

  const schema = {
    type: 'object',
    properties: {
      week_message: { type: 'string', description: 'Главное послание недели' },
      week_overview: { type: 'string', description: 'Логика воронки: как 7 дней ведут к покупке' },
      cta_variations: { type: 'array', items: { type: 'string' } },
      objections_handled: { type: 'array', items: { type: 'string' }, description: 'Возражения которые закрывает этот план' },
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

  return callMistral(systemPrompt, userPrompt, schema, 2000);
}

export async function generateContentPack(businessInfo, onProgress) {
  const context = buildBusinessContext(businessInfo);
  const days = [];
  const report = (msg) => onProgress && onProgress(msg);

  report('Генерирую стратегию недели...');
  const strategy = await generateWeekStrategy(businessInfo);

  for (const dayPlan of WEEK_PLAN) {
    report(`День ${dayPlan.day}/7 — ${dayPlan.funnel_stage} (${dayPlan.elf_trigger})...`);
    const day = await generateDayContent(dayPlan, context, businessInfo.language);
    days.push({ ...day, funnel_stage: dayPlan.funnel_stage, pillar: dayPlan.pillar });
  }

  return { ...strategy, days };
}
