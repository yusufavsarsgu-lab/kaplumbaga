import React, { useRef } from 'react';
import { ImagePlus } from 'lucide-react';
import { useI18n } from '../i18n';

interface Props {
  onImageSelect: (base64: string) => void;
  onError?: (message: string) => void;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_WIDTH = 1024;
const MAX_HEIGHT = 1024;
const JPEG_QUALITY = 0.75;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context failed'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };

    img.src = url;
  });
}

const ImageUploadButton: React.FC<Props> = ({ onImageSelect, onError }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onError?.(t('imageOnly'));
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      onError?.(t('fileTooLargeDetail'));
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    try {
      const compressed = await compressImage(file);
      onImageSelect(compressed);
    } catch {
      onError?.(t('imageReadError'));
    }

    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="relative flex-shrink-0">
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex h-11 w-11 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 hover:text-turtle-800"
        title={t('sendImage')}
        aria-label={t('sendImage')}
      >
        <ImagePlus className="h-5 w-5" />
      </button>
    </div>
  );
};

export default ImageUploadButton;
