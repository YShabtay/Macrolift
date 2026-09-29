const MAX_IMAGE_DIMENSION = 900;
const JPEG_QUALITY = 0.8;

/** Downscales and re-encodes an image file to a compressed JPEG data URL, capped at MAX_IMAGE_DIMENSION on the longer side. */
export function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('קריאת הקובץ נכשלה'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('קובץ התמונה לא תקין'));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          if (width >= height) {
            height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
            width = MAX_IMAGE_DIMENSION;
          } else {
            width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
            height = MAX_IMAGE_DIMENSION;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('הדפדפן לא תומך בעיבוד תמונה'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Splits a `data:<mime>;base64,<data>` URL into its raw base64 payload and MIME type, ready for Gemini's inlineData. */
export function dataUrlToBase64(dataUrl: string): { base64: string; mimeType: string } {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*);base64/);
  return { base64: base64 ?? '', mimeType: mimeMatch?.[1] ?? 'image/jpeg' };
}
