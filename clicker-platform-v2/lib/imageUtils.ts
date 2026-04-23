/**
 * Resizes an image to fit within maxWidth (preserving aspect ratio) and
 * converts it to WebP. If the image is already smaller than maxWidth, only
 * format conversion is applied — no upscaling.
 */
export const resizeAndConvert = (file: File, maxWidth: number, quality = 0.8): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
            const scale = img.width > maxWidth ? maxWidth / img.width : 1;
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('Canvas context not available')); return; }
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('WebP conversion failed'));
            }, 'image/webp', quality);
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = URL.createObjectURL(file);
    });
};

/**
 * Converts a File to WebP without resizing. Kept for backward compatibility
 * with other upload forms that don't need the gallery thumbnail pipeline.
 */
export const convertToWebP = async (file: File, quality = 0.8): Promise<Blob> => {
    if (file.type === 'image/webp') return file;
    return resizeAndConvert(file, Infinity, quality);
};

/**
 * Validates file size and type.
 */
export const validateImageFile = (file: File, maxSizeMB = 10): string | null => {
    if (file.size > maxSizeMB * 1024 * 1024) {
        return `File size must be less than ${maxSizeMB}MB`;
    }
    if (!file.type.startsWith('image/')) {
        return 'File must be an image';
    }
    return null;
};
