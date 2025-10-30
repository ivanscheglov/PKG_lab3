
const upload = document.getElementById('upload');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let originalImage = null; // ImageData
let imgWidth = 0, imgHeight = 0;

const localBtn = document.getElementById('local');
const adaptiveBtn = document.getElementById('adaptive');
const linearBtn = document.getElementById('linear');
const invertBtn = document.getElementById('invert');
const resetBtn = document.getElementById('reset');
const downloadBtn = document.getElementById('download');

const localRadiusInput = document.getElementById('localRadius');
const localRadiusVal = document.getElementById('localRadiusVal');
const adaptiveSInput = document.getElementById('adaptiveS');
const adaptiveSVal = document.getElementById('adaptiveSVal');
const adaptiveKInput = document.getElementById('adaptiveK');
const adaptiveKVal = document.getElementById('adaptiveKVal');

localRadiusInput.oninput = () => localRadiusVal.textContent = localRadiusInput.value;
adaptiveSInput.oninput = () => adaptiveSVal.textContent = adaptiveSInput.value;
adaptiveKInput.oninput = () => adaptiveKVal.textContent = (adaptiveKInput.value/100).toFixed(2);

upload.addEventListener('change', e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      imgWidth = img.width;
      imgHeight = img.height;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(imgWidth * ratio);
      canvas.height = Math.round(imgHeight * ratio);
      canvas.style.width = imgWidth + 'px';
      canvas.style.height = imgHeight + 'px';
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.drawImage(img, 0, 0, imgWidth, imgHeight);
      originalImage = ctx.getImageData(0,0,imgWidth,imgHeight); 
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

resetBtn.onclick = () => {
  if (!originalImage) return alert('Сначала загрузите изображение');
  canvas.width = originalImage.width;
  canvas.height = originalImage.height;
  ctx.putImageData(originalImage, 0, 0);
};

invertBtn.onclick = () => {
  if (!originalImage) return alert('Сначала загрузите изображение');
  const imgData = ctx.getImageData(0,0,canvas.width,canvas.height);
  const d = imgData.data;
  for (let i=0;i<d.length;i+=4){
    d[i] = 255 - d[i];
    d[i+1] = 255 - d[i+1];
    d[i+2] = 255 - d[i+2];
  }
  ctx.putImageData(imgData, 0, 0);
};

linearBtn.onclick = () => {
  if (!originalImage) return alert('Сначала загрузите изображение');
  const imgData = ctx.getImageData(0,0,canvas.width,canvas.height);
  const d = imgData.data;
  let min = 255, max = 0;
  for (let i=0;i<d.length;i+=4){
    const g = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = (max - min) || 1;
  for (let i=0;i<d.length;i+=4){
    let val = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
    val = ((val - min) / range) * 255;
    val = Math.max(0, Math.min(255, val));
    d[i] = d[i+1] = d[i+2] = val;
  }
  ctx.putImageData(imgData, 0, 0);
};

function buildGrayArray(imgData, w, h){
  const d = imgData.data;
  const gray = new Float64Array(w*h);
  for (let y=0;y<h;y++){
    for (let x=0;x<w;x++){
      const i = (y*w + x)*4;
      gray[y*w + x] = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
    }
  }
  return gray;
}

function buildIntegralImages(gray, w, h){
  const integral = new Float64Array((w+1)*(h+1)); 
  const integralSq = new Float64Array((w+1)*(h+1));
  // integral indexing: (y*(w+1) + x)
  for (let y=1;y<=h;y++){
    let rowSum = 0, rowSumSq = 0;
    for (let x=1;x<=w;x++){
      const val = gray[(y-1)*w + (x-1)];
      rowSum += val;
      rowSumSq += val*val;
      const idx = y*(w+1) + x;
      integral[idx] = integral[idx - (w+1)] + rowSum;
      integralSq[idx] = integralSq[idx - (w+1)] + rowSumSq;
    }
  }
  return {integral, integralSq};
}

function rectSum(integral, w, x1, y1, x2, y2){
  const W = w+1;
  const A = y1*W + x1;
  const B = y1*W + x2+1;
  const C = (y2+1)*W + x1;
  const D = (y2+1)*W + x2+1;
  return integral[D] - integral[B] - integral[C] + integral[A];
}

localBtn.onclick = () => {
  if (!originalImage) return alert('Сначала загрузите изображение');
  const radius = parseInt(localRadiusInput.value, 10);
  const imgData = ctx.getImageData(0,0,canvas.width,canvas.height);
  const w = canvas.width, h = canvas.height;
  const gray = buildGrayArray(imgData, w, h);
  const {integral} = buildIntegralImages(gray, w, h);
  const d = imgData.data;
  for (let y=0;y<h;y++){
    const y1 = Math.max(0, y - radius);
    const y2 = Math.min(h-1, y + radius);
    for (let x=0;x<w;x++){
      const x1 = Math.max(0, x - radius);
      const x2 = Math.min(w-1, x + radius);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum = rectSum(integral, w, x1, y1, x2, y2);
      const mean = sum / count;
      const idx = (y*w + x)*4;
      const v = (gray[y*w + x] < mean) ? 0 : 255;
      d[idx] = d[idx+1] = d[idx+2] = v;
    }
  }
  ctx.putImageData(imgData, 0, 0);
};

adaptiveBtn.onclick = () => {
  if (!originalImage) return alert('Сначала загрузите изображение');
  const S = parseInt(adaptiveSInput.value, 10);
  const kVal = parseInt(adaptiveKInput.value, 10)/100.0; // slider 0..100 -> 0..1
  const R = 128; // dynamic range, common default
  const imgData = ctx.getImageData(0,0,canvas.width,canvas.height);
  const w = canvas.width, h = canvas.height;
  const gray = buildGrayArray(imgData, w, h);
  const {integral, integralSq} = buildIntegralImages(gray, w, h);
  const d = imgData.data;

  for (let y=0;y<h;y++){
    const y1Clamp = Math.max(0, y - S);
    const y2Clamp = Math.min(h-1, y + S);
    for (let x=0;x<w;x++){
      const x1Clamp = Math.max(0, x - S);
      const x2Clamp = Math.min(w-1, x + S);
      const count = (x2Clamp - x1Clamp + 1) * (y2Clamp - y1Clamp + 1);
      const sum = rectSum(integral, w, x1Clamp, y1Clamp, x2Clamp, y2Clamp);
      const sumSq = rectSum(integralSq, w, x1Clamp, y1Clamp, x2Clamp, y2Clamp);
      const mean = sum / count;
      const variance = Math.max(0, sumSq / count - mean*mean);
      const std = Math.sqrt(variance);
      const T = mean * (1 + kVal * ((std / R) - 1));
      const idx = (y*w + x)*4;
      const v = (gray[y*w + x] < T) ? 0 : 255;
      d[idx] = d[idx+1] = d[idx+2] = v;
    }
  }
  ctx.putImageData(imgData, 0, 0);
};

downloadBtn.onclick = () => {
  if (!originalImage) return alert('Сначала загрузите изображение');
  // create a temporary canvas with displayed size
  const tmp = document.createElement('canvas');
  tmp.width = imgWidth;
  tmp.height = imgHeight;
  const tmpCtx = tmp.getContext('2d');
  // draw current (note: current canvas might be scaled for DPR)
  tmpCtx.drawImage(canvas, 0, 0, tmp.width, tmp.height);
  const a = document.createElement('a');
  a.href = tmp.toDataURL('image/png');
  a.download = 'result.png';
  a.click();
};


