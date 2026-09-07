/**
 * ImageStitchService — 多图垂直拼接与智能长截图服务
 * 将多次截取的题目（如上半部分表结构、下半部分具体题干）在前端 Canvas 垂直无缝拼接为一张高清长图。
 */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('图片加载失败，无法拼接: ' + err));
    img.src = src.startsWith('http') || src.startsWith('data:')
      ? src
      : `data:image/jpeg;base64,${src}`;
  });
}

export interface StitchOptions {
  maxWidth?: number;
  quality?: number;
  showDivider?: boolean;
}

/**
 * 垂直拼接多张 Base64 截图为单张高清长图
 * @param base64Images - Base64 图片数组（按先后顺序，从上到下）
 * @param options - 配置选项
 * @returns 拼接后的纯 Base64 字符串（JPEG 格式）
 */
export async function stitchImagesVertical(
  base64Images: string[],
  options: StitchOptions = {},
): Promise<string> {
  if (!base64Images || base64Images.length === 0) {
    throw new Error('拼接图片列表为空');
  }
  if (base64Images.length === 1) {
    return base64Images[0];
  }

  const { maxWidth = 1440, quality = 0.85, showDivider = true } = options;

  // 1. 并发加载所有图片
  const images = await Promise.all(base64Images.map(loadImage));

  // 2. 统一计算目标宽度（取最大宽度，且长边不超过 maxWidth）
  const maxOriginalWidth = Math.max(...images.map((img) => img.naturalWidth || img.width || 1200));
  const targetWidth = Math.min(maxOriginalWidth, maxWidth);

  // 3. 计算每张图等比缩放后的高度与分隔条高度
  const dividerHeight = showDivider ? 18 : 0;
  let totalHeight = 0;
  const scaledDimensions: { width: number; height: number }[] = [];

  images.forEach((img, index) => {
    const origW = img.naturalWidth || img.width || 1;
    const origH = img.naturalHeight || img.height || 1;
    const scale = targetWidth / origW;
    const h = Math.round(origH * scale);
    scaledDimensions.push({ width: targetWidth, height: h });
    totalHeight += h;
    if (showDivider && index < images.length - 1) {
      totalHeight += dividerHeight;
    }
  });

  // 4. 创建 Canvas
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('创建 Canvas 绘图上下文失败');
  }

  // 填充中性底色
  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, targetWidth, totalHeight);

  // 5. 依次绘制每一屏内容及衔接提示
  let currentY = 0;
  images.forEach((img, idx) => {
    const dim = scaledDimensions[idx];
    ctx.drawImage(img, 0, currentY, dim.width, dim.height);
    currentY += dim.height;

    // 若有下一张，绘制优雅的拼接分割线与提示标尺
    if (showDivider && idx < images.length - 1) {
      ctx.fillStyle = '#27272a';
      ctx.fillRect(0, currentY, targetWidth, dividerHeight);

      // 分割线装饰
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, currentY + dividerHeight / 2);
      ctx.lineTo(targetWidth, currentY + dividerHeight / 2);
      ctx.stroke();

      // 文字提示
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `▼ 向下滑动拼接区域（第 ${idx + 1} 屏 ➔ 第 ${idx + 2} 屏）▼`,
        targetWidth / 2,
        currentY + dividerHeight / 2,
      );

      currentY += dividerHeight;
    }
  });

  // 6. 导出为高画质高效 JPEG
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  // 返回不带 data:image/jpeg;base64, 前缀的纯 Base64
  return dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
}
