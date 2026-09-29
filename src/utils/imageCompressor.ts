const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.82;

/**
 * Downscales and re-encodes an image file to a compressed JPEG data URL, capped at
 * MAX_DIMENSION (1200px) on the longer side at quality 0.82 - tuned to keep enough visible
 * detail (muscle definition, body outline) for the Gemini AI progress review, while landing
 * around 150-250KB per photo instead of multi-megabyte camera originals.
 *
 * Relies on the browser's own image decoder, so it transparently supports whatever the
 * browser can decode (JPEG/PNG/WebP everywhere, plus HEIC on browsers with native support
 * such as Safari) and rejects clearly when a format can't be decoded at all.
 */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('קריאת הקובץ נכשלה'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('פורמט התמונה אינו נתמך בדפדפן זה'));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width >= height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
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

        try {
          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        } catch {
          reject(new Error('דחיסת התמונה נכשלה'));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
