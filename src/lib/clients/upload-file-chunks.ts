function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Falha ao ler parte do arquivo."));
        return;
      }
      const commaIndex = result.indexOf(",");
      if (commaIndex < 0) {
        reject(new Error("Falha ao codificar parte do arquivo."));
        return;
      }
      resolve(result.slice(commaIndex + 1));
    };
    reader.onerror = () => reject(new Error("Falha ao ler parte do arquivo."));
    reader.readAsDataURL(blob);
  });
}

export async function readFileInChunks(
  file: File,
  chunkSize: number,
  onChunk: (chunkIndex: number, totalChunks: number, base64: string) => Promise<void>,
): Promise<void> {
  const totalChunks = Math.ceil(file.size / chunkSize);
  for (let index = 0; index < totalChunks; index += 1) {
    const start = index * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const slice = file.slice(start, end);
    const base64 = await blobToBase64(slice);
    if (!base64) {
      throw new Error(`Parte ${index + 1} do arquivo ficou vazia durante o envio.`);
    }
    await onChunk(index, totalChunks, base64);
  }
}
