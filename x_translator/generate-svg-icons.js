const fs = require('fs');

// 创建SVG图标的函数
function createSvgIcon(size) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <!-- 背景圆圈 -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="#1DA1F2" />
  
  <!-- 内圈 -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - size/10}" fill="#0c85d0" />
  
  <!-- T字母 -->
  <text x="${size/2}" y="${size/2}" 
        font-family="Arial, sans-serif" 
        font-size="${Math.floor(size*0.5)}" 
        font-weight="bold" 
        fill="white" 
        text-anchor="middle" 
        dominant-baseline="middle">T</text>
  
  <!-- 翻译箭头 -->
  <g stroke="white" stroke-width="${Math.max(1, size * 0.06)}">
    <!-- 横线 -->
    <line x1="${size/2 - size*0.15}" y1="${size/2 + size*0.18}" 
          x2="${size/2 + size*0.15}" y2="${size/2 + size*0.18}" />
    
    <!-- 箭头尖 -->
    <line x1="${size/2 + size*0.15}" y1="${size/2 + size*0.18}" 
          x2="${size/2 + size*0.09}" y2="${size/2 + size*0.12}" />
    <line x1="${size/2 + size*0.15}" y1="${size/2 + size*0.18}" 
          x2="${size/2 + size*0.09}" y2="${size/2 + size*0.24}" />
  </g>
</svg>`;
}

// 确保icons目录存在
if (!fs.existsSync('icons')) {
  fs.mkdirSync('icons');
  console.log('创建了icons目录');
}

// 生成不同尺寸的图标
const sizes = [16, 48, 128];
sizes.forEach(size => {
  const svgContent = createSvgIcon(size);
  fs.writeFileSync(`icons/icon${size}.svg`, svgContent);
  console.log(`创建了 ${size}x${size} SVG图标`);
});

console.log('SVG图标生成完成!'); 