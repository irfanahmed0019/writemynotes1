import { X } from 'lucide-react';

type Props = {
  src: string;
  onClose: () => void;
};

export default function ImagePreview({ src, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-background/20 text-foreground flex items-center justify-center backdrop-blur-sm active:scale-95 transition-transform"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt="Preview"
        className="max-w-full max-h-[90vh] rounded-xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
