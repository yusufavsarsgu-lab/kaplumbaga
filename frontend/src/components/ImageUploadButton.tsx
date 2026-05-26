import React, { useRef } from 'react';
import { ImagePlus } from 'lucide-react';
import { useI18n } from '../i18n';

interface Props {
  onImageSelect: (base64: string) => void;
  onError?: (message: string) => void;
}

const MAX_IMAGE_SIZE = 3 * 1024 * 1024;

const ImageUploadButton: React.FC<Props> = ({ onImageSelect, onError }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
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

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImageSelect(reader.result);
      }
    };
    reader.onerror = () => onError?.(t('imageReadError'));
    reader.readAsDataURL(file);

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
