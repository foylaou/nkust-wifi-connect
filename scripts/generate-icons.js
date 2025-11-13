import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function generateIcons() {
  const svgPath = join(projectRoot, 'assets/tray-icon.svg');
  const pngPath = join(projectRoot, 'assets/tray-icon.png');

  await sharp(svgPath)
    .resize(22, 22)
    .png()
    .toFile(pngPath);

  console.log('托盘图标生成成功！');
}

generateIcons().catch(console.error);