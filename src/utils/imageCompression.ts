export async function compressImage(base64Image: string, maxSizeInBytes: number): Promise<{ compressedImage: string; quality: number }> {
  const img = new Image();
  img.src = `data:image/png;base64,${base64Image}`;
  
  await new Promise(resolve => img.onload = resolve);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  let quality = 1.0;
  let compressedBase64 = base64Image;

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  while (compressedBase64.length * 0.75 > maxSizeInBytes && quality > 0.1) {
    compressedBase64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
    quality -= 0.05;
  }

  return { compressedImage: compressedBase64, quality };
}