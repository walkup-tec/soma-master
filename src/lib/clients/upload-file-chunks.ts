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

/**
 * Envia as partes do arquivo em paralelo (com limite de concorrência).
 * As partes são independentes no servidor, então a ordem de chegada não importa.
 */
export async function readFileInChunksParallel(
  file: File,
  chunkSize: number,
  concurrency: number,
  onChunk: (chunkIndex: number, totalChunks: number, base64: string) => Promise<void>,
): Promise<void> {
  const totalChunks = Math.ceil(file.size / chunkSize);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < totalChunks) {
      const index = nextIndex;
      nextIndex += 1;
      const start = index * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const base64 = await blobToBase64(file.slice(start, end));
      if (!base64) {
        throw new Error(`Parte ${index + 1} do arquivo ficou vazia durante o envio.`);
      }
      await onChunk(index, totalChunks, base64);
    }
  }

  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, totalChunks)) },
    () => worker(),
  );
  await Promise.all(workers);
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
