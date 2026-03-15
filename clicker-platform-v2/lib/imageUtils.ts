/**
 * Converts a File object to a WebP Blob using client-side canvas.
 * @param file The input file (image)
 * @param quality Quality of the WebP image (0 to 1)
 * @returns Promise resolving to a WebP Blob
 */
export const convertToWebP = async (file: File, quality: number = 0.8): Promise<Blob> => {
    if (file.type === 'image/webp') {
        return file;
    }
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context not available'));
                return;
            }
            ctx.drawImage(img, 0, 0);
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
 * Validates file size and type.
 * @param file The file to validate
 * @param maxSizeMB Maximum size in MB
 * @returns Error string or null if valid
 */
export const validateImageFile = (file: File, maxSizeMB: number = 5): string | null => {
    if (file.size > maxSizeMB * 1024 * 1024) {
        return `File size must be less than ${maxSizeMB}MB`;
    }
    if (!file.type.startsWith('image/')) {
        return 'File must be an image';
    }
    return null;
};
