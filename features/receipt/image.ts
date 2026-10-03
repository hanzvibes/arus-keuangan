export type Crop = { x: number; y: number; width: number; height: number };
export async function decodeReceipt(file: Blob): Promise<ImageBitmap> {
  if (file.size > 15_000_000) throw Error("Foto maksimal 15 MB.");
  if (file.type === "application/pdf") throw Error("Gunakan foto JPEG, PNG, atau WebP.");
  try {
    const image = await createImageBitmap(file, { imageOrientation: "from-image" });
    if (image.width * image.height > 40_000_000) { image.close(); throw Error("Resolusi foto terlalu besar. Pilih foto lain."); }
    return image;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Resolusi")) throw error;
    throw Error("Foto tidak dapat dibuka. Gunakan JPEG, PNG, atau WebP.");
  }
}
export async function prepareReceiptImage(file: Blob, crop: Crop, rotation: number): Promise<{ blob: Blob; darkness: boolean; blurry: boolean; visualHash: string; width: number; height: number }> {
  const image = await decodeReceipt(file);
  try {
    const x = Math.max(0, Math.floor(crop.x * image.width)), y = Math.max(0, Math.floor(crop.y * image.height));
    const width = Math.max(1, Math.min(image.width - x, Math.floor(crop.width * image.width)));
    const height = Math.max(1, Math.min(image.height - y, Math.floor(crop.height * image.height)));
    const quarterTurn = ((rotation % 360) + 360) % 360;
    const scale = Math.min(1, 2500 / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = quarterTurn % 180 ? h : w; canvas.height = quarterTurn % 180 ? w : h;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw Error("Pemrosesan gambar tidak tersedia.");
    context.translate(canvas.width / 2, canvas.height / 2); context.rotate(quarterTurn * Math.PI / 180);
    context.drawImage(image, x, y, width, height, -w / 2, -h / 2, w, h);
    context.setTransform(1, 0, 0, 1, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    let brightness = 0, edgeScore = 0, edgeCount = 0;
    for (let i = 0; i < pixels.data.length; i += 4) {
      const grey = Math.round(.299 * pixels.data[i] + .587 * pixels.data[i + 1] + .114 * pixels.data[i + 2]);
      if ((i / 4) % canvas.width < canvas.width - 1) { const neighbor = Math.round(.299 * pixels.data[i + 4] + .587 * pixels.data[i + 5] + .114 * pixels.data[i + 6]); edgeScore += Math.abs(grey - neighbor); edgeCount++; }
      brightness += grey; const adjusted = Math.max(0, Math.min(255, (grey - 128) * 1.25 + 140));
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = adjusted;
    }
    context.putImageData(pixels, 0, 0);
    const sample = document.createElement("canvas"); sample.width = 8; sample.height = 8;
    const sampleContext = sample.getContext("2d");
    sampleContext?.drawImage(canvas, 0, 0, 8, 8);
    const data = sampleContext?.getImageData(0, 0, 8, 8).data;
    let bits = "";
    if (data) for (let i = 0; i < 64; i++) bits += data[i * 4] < 128 ? "1" : "0";
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(Error("Gagal menyiapkan foto.")), "image/png"));
    return { blob, darkness: brightness / (pixels.data.length / 4) < 65, blurry: edgeCount > 0 && edgeScore / edgeCount < 7, width: canvas.width, height: canvas.height, visualHash: Array.from({ length: 16 }, (_, index) => parseInt(bits.slice(index * 4, index * 4 + 4) || "0000", 2).toString(16)).join("") };
  } finally { image.close(); }
}
export async function hashReceiptImage(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
