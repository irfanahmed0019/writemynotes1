import Compressor from 'compressorjs';

export function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    new Compressor(file, {
      quality: 0.8,
      maxWidth: 1200,
      success: resolve,
      error: reject,
    });
  });
}
