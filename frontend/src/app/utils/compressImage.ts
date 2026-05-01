/**
 * Comprime uma imagem no browser antes do upload.
 * - Redimensiona para máximo 600×800 px (portrait ideal para dating apps)
 * - Converte para WebP
 * - Reduz qualidade iterativamente até atingir targetKB
 * - Fallback seguro: se algo falhar, retorna o File original
 */
export async function compressImage(
  file: File,
  maxW = 600,
  maxH = 800,
  targetKB = 120,
): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Calcular dimensões mantendo aspect ratio
      let { width, height } = img;
      const ratio = Math.min(maxW / width, maxH / height, 1); // nunca ampliar
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }

      // Fundo branco para imagens com transparência (PNG → WebP)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Tenta qualidades decrescentes até caber em targetKB
      const qualities = [0.88, 0.80, 0.72, 0.64, 0.55, 0.45];
      let idx = 0;

      const attempt = () => {
        const q = qualities[idx];
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            if (blob.size <= targetKB * 1024 || idx >= qualities.length - 1) {
              const outName = file.name.replace(/\.[^.]+$/, "") + ".webp";
              resolve(new File([blob], outName, { type: "image/webp" }));
            } else {
              idx++;
              attempt();
            }
          },
          "image/webp",
          q,
        );
      };
      attempt();
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}
