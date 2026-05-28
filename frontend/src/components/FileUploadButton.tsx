import React, { useRef } from 'react';
import { FileUp } from 'lucide-react';
import { useI18n } from '../i18n';

interface Props {
  onFileSelect: (base64: string) => void;
  onError?: (message: string) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

const FileUploadButton: React.FC<Props> = ({ onFileSelect, onError }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      onError?.(t('fileTooLargeDetail'));
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    try {
      const base64 = await readFileAsBase64(file);
      onFileSelect(base64);
    } catch {
      onError?.(t('fileReadError'));
    }

    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="relative flex-shrink-0">
      <input ref={fileRef} type="file" onChange={handleFile} className="hidden" />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex h-11 w-11 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 hover:text-turtle-800"
        title={t('sendFile')}
        aria-label={t('sendFile')}
      >
        <FileUp className="h-5 w-5" />
      </button>
    </div>
  );
};

export default FileUploadButton;
