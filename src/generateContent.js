import 'dotenv/config';
import inquirer from 'inquirer';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { generateContentPack } from './generators/contentGenerator.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function saveMarkdown(data, businessInfo) {
  const { niche, service, location } = businessInfo;
  const filename = `${formatDate()}_${slugify(niche)}_${slugify(service)}.md`;
  const outputDir = path.resolve('output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  const filepath = path.join(outputDir, filename);

  let md = `# Контент-план: ${service} | ${niche} | ${location}\n`;
  md += `_Создан: ${new Date().toLocaleString('ru-RU')}_\n\n`;
  md += `---\n\n`;
  md += `## Стратегия недели\n${data.week_overview}\n\n`;
  md += `---\n\n`;

  for (const day of data.days) {
    md += `## День ${day.day} — ${day.theme}\n\n`;

    md += `### Instagram\n`;
    md += `**Пост:**\n${day.instagram.caption}\n\n`;
    md += `**Хэштеги:** ${day.instagram.hashtags.map(h => `#${h.replace('#','')}`).join(' ')}\n\n`;
    md += `**Что снять:** ${day.instagram.visual_idea}\n\n`;
    md += `**Сторис:** ${day.instagram.story_idea}\n\n`;

    md += `### TikTok\n`;
    md += `**Крючок (первые 3 сек):** ${day.tiktok.hook}\n\n`;
    md += `**Сценарий:**\n${day.tiktok.script}\n\n`;
    md += `**Подпись:** ${day.tiktok.caption}\n\n`;
    md += `**Хэштеги:** ${day.tiktok.hashtags.map(h => `#${h.replace('#','')}`).join(' ')}\n\n`;

    md += `### LinkedIn\n`;
    md += `${day.linkedin.caption}\n\n`;
    md += `**Хэштеги:** ${day.linkedin.hashtags.map(h => `#${h.replace('#','')}`).join(' ')}\n\n`;

    md += `### Telegram\n`;
    md += `${day.telegram.message}\n\n`;

    md += `---\n\n`;
  }

  md += `## Призывы к действию (CTA)\n`;
  for (const cta of data.cta_variations) {
    md += `- ${cta}\n`;
  }
  md += `\n`;

  md += `## Bio / Описания профилей\n\n`;
  md += `**Instagram Bio:**\n${data.bio_suggestions.instagram}\n\n`;
  md += `**LinkedIn заголовок:**\n${data.bio_suggestions.linkedin}\n\n`;
  md += `**Telegram описание:**\n${data.bio_suggestions.telegram}\n`;

  fs.writeFileSync(filepath, md, 'utf-8');
  return filepath;
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('\n🚀 LeadMachine — Генератор контента\n');
console.log('Ответь на несколько вопросов и получи готовый контент-план на 7 дней\n');

const answers = await inquirer.prompt([
  {
    type: 'input',
    name: 'niche',
    message: 'Ниша (например: салон красоты, юридические услуги, химчистка):',
    validate: v => v.trim() ? true : 'Обязательное поле',
  },
  {
    type: 'input',
    name: 'service',
    message: 'Конкретная услуга (например: маникюр и педикюр, консультация юриста):',
    validate: v => v.trim() ? true : 'Обязательное поле',
  },
  {
    type: 'input',
    name: 'location',
    message: 'Город / регион (например: Рига, Латвия):',
    default: 'Рига, Латвия',
  },
  {
    type: 'input',
    name: 'priceRange',
    message: 'Ценовой диапазон (например: 25-50€ за маникюр):',
    validate: v => v.trim() ? true : 'Обязательное поле',
  },
  {
    type: 'input',
    name: 'targetAudience',
    message: 'Целевая аудитория (например: женщины 25-45, следят за собой, работающие):',
    validate: v => v.trim() ? true : 'Обязательное поле',
  },
  {
    type: 'list',
    name: 'tone',
    message: 'Тон общения:',
    choices: [
      { name: 'Дружелюбный и тёплый', value: 'дружелюбный и тёплый, как подруга которая рекомендует' },
      { name: 'Профессиональный и экспертный', value: 'профессиональный и экспертный, вызывает доверие' },
      { name: 'Живой и энергичный', value: 'живой и энергичный, с юмором и эмоциями' },
      { name: 'Минималистичный и деловой', value: 'минималистичный и деловой, без воды' },
    ],
  },
  {
    type: 'list',
    name: 'language',
    message: 'Язык контента:',
    choices: [
      { name: 'Латышский', value: 'латышский' },
      { name: 'Русский', value: 'русский' },
      { name: 'Английский', value: 'английский' },
      { name: 'Русский + Латышский (двуязычный)', value: 'двуязычный: основной текст на русском, дублирующий абзац на латышском' },
    ],
  },
]);

const spinner = ora('Генерирую контент-план на 7 дней...').start();

try {
  const contentPack = await generateContentPack(answers);
  spinner.succeed('Контент-план готов!');

  const filepath = saveMarkdown(contentPack, answers);

  console.log(`\n✅ Файл сохранён: ${filepath}`);
  console.log('\n📋 Стратегия недели:');
  console.log(contentPack.week_overview);
  console.log('\n📌 Темы по дням:');
  for (const day of contentPack.days) {
    console.log(`  День ${day.day}: ${day.theme}`);
  }
  console.log('\nОткрой файл чтобы увидеть все посты полностью.\n');
} catch (err) {
  spinner.fail('Ошибка генерации');
  console.error(err.message);
  process.exit(1);
}
