import 'dotenv/config';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { generateContentPack } from './generators/contentGenerator.js';
import { generateImages } from './generators/imageGenerator.js';
import { artkit } from './businesses/artkit.js';
import { smartskula } from './businesses/smartskula.js';

const BUSINESSES = { artkit, smartskula };
const name = process.argv[2];

if (!name || !BUSINESSES[name]) {
  console.log('\nИспользование: npm run images:artkit\n');
  console.log('Доступные бизнесы:', Object.keys(BUSINESSES).join(', '));
  process.exit(1);
}

const business = BUSINESSES[name];
console.log(`\n🎨 LeadMachine — генерирую фото-контент для: ${business.niche}\n`);

const spinner = ora('Загружаю контент-план...').start();

try {
  // Читаем готовый JSON если есть, иначе генерируем заново
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

  spinner.start('Генерирую изображения...');
  const businessContext = `${business.niche}. ${business.usp}`;
  const images = await generateImages(contentPack, name, businessContext, (msg) => {
    spinner.text = msg;
  });

  spinner.succeed(`Готово! Создано ${images.length} изображений`);
  console.log(`\n📁 Сохранено в: output/images/${name}/\n`);
  for (const img of images) {
    console.log(`  День ${img.day}: ${img.theme}`);
    console.log(`    → ${img.filepath}`);
  }
  console.log('');
} catch (err) {
  spinner.fail('Ошибка');
  console.error(err.message);
  process.exit(1);
}
