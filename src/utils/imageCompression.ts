export async function compressImage(base64Image: string, maxSizeInBytes: number): Promise<{ compressedImage: string; quality: number }> {
  const img = new Image();
  img.src = `data:image/png;base64,${base64Image}`;
  
  await new Promise(resolve => img.onload = resolve);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  let quality = 1.0;
  let compressedBase64 = base64Image;
  let scale = 1;

  canvas.width = img.width;
  canvas.height = img.height;

  while (compressedBase64.length * 0.75 > maxSizeInBytes && quality > 0.1) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    compressedBase64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
    
    if (quality > 0.5) {
      quality -= 0.1;
    } else {
      quality -= 0.05;
    }
    
    if (quality < 0.1 && scale > 0.1) {
      scale -= 0.1;
      quality = 0.7;
    }
  }

  return { compressedImage: compressedBase64, quality };
}