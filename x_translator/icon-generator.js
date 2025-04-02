const { createCanvas } = require('canvas');
const fs = require('fs');

function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // 背景圆圈
  ctx.fillStyle = '#1DA1F2'; // Twitter蓝色
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2 - 2, 0, Math.PI * 2);
  ctx.fill();
  
  // 内圈(给一点3D效果)
  ctx.fillStyle = '#0c85d0';
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2 - size/10, 0, Math.PI * 2);
  ctx.fill();
  
  // T字母(翻译的首字母)
  ctx.fillStyle = 'white';
  ctx.font = `bold ${Math.floor(size*0.5)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('T', size/2, size/2 - size*0.05);
  
  // 翻译箭头指示符
  const arrowSize = size * 0.15;
  ctx.strokeStyle = 'white';
  ctx.lineWidth = Math.max(1, size * 0.06);
  
  // 绘制小箭头
  ctx.beginPath();
  ctx.moveTo(size/2 - arrowSize, size/2 + arrowSize*1.2);
  ctx.lineTo(size/2 + arrowSize, size/2 + arrowSize*1.2);
  ctx.stroke();
  
  // 箭头尖
  ctx.beginPath();
  ctx.moveTo(size/2 + arrowSize, size/2 + arrowSize*1.2);
  ctx.lineTo(size/2 + arrowSize*0.6, size/2 + arrowSize*0.8);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(size/2 + arrowSize, size/2 + arrowSize*1.2);
  ctx.lineTo(size/2 + arrowSize*0.6, size/2 + arrowSize*1.6);
  ctx.stroke();
  
  // 保存文件
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`icons/icon${size}.png`, buffer);
  
  console.log(`创建了 ${size}x${size} 图标`);
}

// 确保icons目录存在
if (!fs.existsSync('icons')) {
  fs.mkdirSync('icons');
  console.log('创建了icons目录');
}

// 生成不同尺寸的图标
console.log('开始生成图标...');
createIcon(16);
createIcon(48);
createIcon(128);
console.log('图标生成完成!'); 