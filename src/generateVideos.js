import 'dotenv/config';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { generateContentPack } from './generators/contentGenerator.js';
import { generateVideos } from './generators/videoGenerator.js';
import { artkit } from './businesses/artkit.js';
import { smartskula } from './businesses/smartskula.js';

const BUSINESSES = { artkit, smartskula };
const name = process.argv[2];
const testMode = process.argv.includes('--test'); // только день 1

if (!name || !BUSINESSES[name]) {
  console.log('\nИспользование: npm run videos:artkit [--test]\n');
  console.log('Доступные бизнесы:', Object.keys(BUSINESSES).join(', '));
  process.exit(1);
}

const business = BUSINESSES[name];
console.log(`\n🎬 LeadMachine — генерирую видео для: ${business.niche}`);
if (testMode) console.log('   (тест-режим: только день 1)\n');
else console.log('');

const spinner = ora('Загружаю контент-план...').start();

try {
  const jsonPath = path.resolve('output', `${name}_latest.json`);
  let contentPack;

  if (fs.existsSync(jsonPath)) {
    contentPack = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    spinner.succeed('Контент-план загружен из кэша');
  } else {
    spinner.text = 'Генерирую контент-план...';
    contentPack = await generateContentPack(business, (msg) => { spinner.text = msg; });
    fs.writeFileSync(jsonPath, JSON.stringify(contentPack, null, 2), 'utf-8');
    spinner.succeed('Контент-план готов');
  }

  spinner.start('Генерирую видео (Veo 3.0)...');
  const videos = await generateVideos(contentPack, name, (msg) => {
    spinner.text = msg;
  }, testMode);

  const ok = videos.filter(v => !v.error);
  const failed = videos.filter(v => v.error);

  spinner.succeed(`Готово! Создано ${ok.length} видео`);
  console.log(`\n📁 Сохранено в: output/videos/${name}/\n`);

  for (const v of ok) {
    console.log(`  ✅ День ${v.day}: ${v.theme}`);
    console.log(`     → ${v.filepath}`);
  }
  for (const v of failed) {
    console.log(`  ❌ День ${v.day}: ${v.error}`);
  }
  console.log('');
} catch (err) {
  spinner.fail('Ошибка');
  console.error(err.message);
  process.exit(1);
}
