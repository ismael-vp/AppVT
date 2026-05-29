import { useState, useEffect, useCallback } from 'react';

export function useImageUpload() {
  const [imageInput, setImageInput] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // --- EFECTO: Gestor de Memoria para la previsualización de imágenes (Fix Blob Leak) ---
  useEffect(() => {
    if (!imageInput) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(imageInput);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [imageInput]);

  const handleImageSelection = useCallback((file: File | null) => {
    if (!file) {
      setImageInput(null);
      return;
    }
    
    if (!file.type.startsWith('image/')) return;
    
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    img.onload = () => {
      // Revocar inmediatamente tras cargar — el useEffect creará su propio objectUrl para el preview
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1200;
      const MAX_HEIGHT = 1200;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height *= MAX_WIDTH / width));
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width *= MAX_HEIGHT / height));
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (blob) {
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          setImageInput(compressedFile);
        } else {
          setImageInput(file);
        }
      }, 'image/jpeg', 0.85);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setImageInput(file);
    };
  }, []);

  return {
    imageInput,
    previewUrl,
    handleImageSelection,
    setImageInput, // In case we need to clear it directly
  };
}
