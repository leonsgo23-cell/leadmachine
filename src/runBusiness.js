import 'dotenv/config';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { generateContentPack } from './generators/contentGenerator.js';
import { artkit } from './businesses/artkit.js';
import { smartskula } from './businesses/smartskula.js';

const BUSINESSES = { artkit, smartskula };

// Выбор бизнеса через аргумент: node src/runBusiness.js artkit
const name = process.argv[2];

if (!name || !BUSINESSES[name]) {
  console.log('\nИспользование:');
  console.log('  npm run artkit');
  console.log('  npm run smartskula\n');
  console.log('Доступные бизнесы:', Object.keys(BUSINESSES).join(', '));
  process.exit(1);
}

const business = BUSINESSES[name];

console.log(`\n🚀 LeadMachine — генерирую контент для: ${business.niche}\n`);

function saveMarkdown(data, businessInfo, businessName) {
  const filename = `${new Date().toISOString().slice(0, 10)}_${businessName}.md`;
  const outputDir = path.resolve('output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  const filepath = path.join(outputDir, filename);

  let md = `# Контент-план: ${businessInfo.service}\n`;
  md += `_Создан: ${new Date().toLocaleString('ru-RU')}_\n\n`;
  md += `---\n\n`;
  // week_overview may come as string or object depending on LLM response
  const weekOverview = typeof data.week_overview === 'object' && data.week_overview !== null
    ? Object.entries(data.week_overview).map(([k, v]) => `**${k}:** ${v}`).join('\n')
    : (data.week_overview || '');
  const weekMessage = data.week_message ? `**Главное послание:** ${data.week_message}\n\n` : '';
  md += `## Стратегия недели\n${weekMessage}${weekOverview}\n\n`;

  if (data.objections_handled?.length) {
    md += `### Возражения аудитории — как план их закрывает\n`;
    for (const obj of data.objections_handled) md += `- ${obj}\n`;
    md += '\n';
  }
  md += `---\n\n`;

  for (const day of data.days) {
    md += `## День ${day.day} — ${day.theme}\n`;
    md += `> ${day.funnel_stage || ''} | ${day.pillar || ''}\n\n`;
    if (day.hook) md += `**Хук дня:** ${day.hook}\n`;
    if (day.core_emotion) md += `**Эмоция:** ${day.core_emotion}\n`;
    md += '\n';

    md += `### Instagram\n`;
    md += `**Пост:**\n${day.instagram.caption}\n\n`;
    md += `**Хэштеги:** ${(day.instagram.hashtags || []).map(h => `#${h.replace(/^#/, '')}`).join(' ')}\n\n`;
    md += `**Что снять:** ${day.instagram.visual_idea}\n\n`;
    md += `**Сторис:** ${day.instagram.story_idea}\n\n`;

    md += `### TikTok\n`;
    md += `**Крючок (первые 3 сек):** ${day.tiktok.hook}\n\n`;
    md += `**Сценарий:**\n${day.tiktok.script}\n\n`;
    md += `**Подпись:** ${day.tiktok.caption}\n\n`;
    md += `**Хэштеги:** ${(day.tiktok.hashtags || []).map(h => `#${h.replace(/^#/, '')}`).join(' ')}\n\n`;

    md += `### LinkedIn\n`;
    md += `${day.linkedin.caption}\n\n`;
    md += `**Хэштеги:** ${(day.linkedin.hashtags || []).map(h => `#${h.replace(/^#/, '')}`).join(' ')}\n\n`;

    md += `### Telegram\n`;
    md += `${day.telegram.message}\n\n`;

    if (day.carousel_concept) {
      const c = day.carousel_concept;
      md += `### Карусель (слайды)\n`;
      if (c.hook_slide) md += `**Слайд 1 (хук):** ${c.hook_slide}\n`;
      if (c.pain_slide) md += `**Слайд 2 (боль):** ${c.pain_slide}\n`;
      if (c.solution_slide) md += `**Слайд 3 (решение):** ${c.solution_slide}\n`;
      if (c.proof_slide) md += `**Слайд 4 (доказательство):** ${c.proof_slide}\n`;
      if (c.cta_slide) md += `**Слайд 5 (CTA):** ${c.cta_slide}\n`;
      md += '\n';
    }

    md += `---\n\n`;
  }

  md += `## Призывы к действию (CTA)\n`;
  for (const cta of (data.cta_variations || [])) md += `- ${cta}\n`;
  md += `\n`;

  const bio = data.bio_suggestions || {};
  md += `## Bio / Описания профилей\n\n`;
  md += `**Instagram Bio:**\n${bio.instagram || ''}\n\n`;
  md += `**LinkedIn заголовок:**\n${bio.linkedin || ''}\n\n`;
  md += `**Telegram описание:**\n${bio.telegram || ''}\n`;

  fs.writeFileSync(filepath, md, 'utf-8');
  return filepath;
}

const spinner = ora('Запускаю генератор...').start();

try {
  const contentPack = await generateContentPack(business, (msg) => {
    spinner.text = msg;
  });
  spinner.succeed('Контент-план готов!');

  // Кэшируем JSON для generateImages.js
  const jsonPath = path.resolve('output', `${name}_latest.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(contentPack, null, 2), 'utf-8');

  const filepath = saveMarkdown(contentPack, business, name);
  console.log(`\n✅ Файл сохранён: ${filepath}`);
  console.log('\n📋 Стратегия недели:');
  console.log(contentPack.week_overview);
  console.log('\n📌 Темы по дням:');
  for (const day of contentPack.days) {
    console.log(`  День ${day.day}: ${day.theme}`);
  }
  console.log('\n');
} catch (err) {
  spinner.fail('Ошибка генерации');
  console.error(err.message);
  process.exit(1);
}
