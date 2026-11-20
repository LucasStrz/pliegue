import { test, expect } from '@playwright/test';
test('exports native detail and dimensions after restoring a reduced preview', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/'); const button = page.getByRole('button', { name: 'Exportar imagen' }); await expect(button).toBeEnabled();
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 1200;
    const ctx = canvas.getContext('2d')!;
    for (let x = 0; x < canvas.width; x++) { ctx.fillStyle = x % 2 ? '#000' : '#fff'; ctx.fillRect(x, 0, 1, canvas.height); }
    return canvas.toDataURL();
  });
  await page.locator('input[type=file]').setInputFiles({ name: 'native.png', mimeType: 'image/png', buffer: Buffer.from(image.split(',')[1], 'base64') });
  await expect(button).toBeEnabled();
  expect(await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height])).toEqual([1800, 1200]);
  await page.getByRole('spinbutton', { name: 'Intensidad: valor exacto', exact: true }).fill('0');
  await expect(page.getByText('Guardado en este navegador')).toHaveText('Guardado en este navegador');
  await page.reload(); await expect(button).toBeEnabled();
  const fs = await import('node:fs');
  const [pngDownload] = await Promise.all([page.waitForEvent('download'), button.click()]);
  const png = fs.readFileSync((await pngDownload.path())!);
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([3600, 2400]);
  const detail = await page.evaluate(async base64 => {
    const blob = await fetch('data:image/png;base64,' + base64).then(r => r.blob());
    const bitmap = await createImageBitmap(blob), canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 1; const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 20, 200, 1, 0, 0, 200, 1); bitmap.close();
    const data = ctx.getImageData(0, 0, 200, 1).data; let min = 255, max = 0;
    for (let i = 80; i < data.length - 80; i += 4) { min = Math.min(min, data[i]); max = Math.max(max, data[i]); }
    return { min, max };
  }, png.toString('base64'));
  expect(detail.min).toBeLessThan(80); expect(detail.max).toBeGreaterThan(175);
  await page.getByLabel('Formato de exportación').selectOption('jpeg');
  const [jpgDownload] = await Promise.all([page.waitForEvent('download'), button.click()]);
  const jpg = fs.readFileSync((await jpgDownload.path())!);
  expect(await page.evaluate(async base64 => { const blob = await fetch('data:image/jpeg;base64,' + base64).then(r => r.blob()); const img = await createImageBitmap(blob); const size = [img.width, img.height]; img.close(); return size; }, jpg.toString('base64'))).toEqual([3600, 2400]);
});
test('starts with the supplied default image and Entrelazado preset', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Exportar imagen' })).toBeEnabled();
  await expect(page.getByLabel('Preajuste', { exact: true })).toHaveValue('Entrelazado');
  await expect(page.getByRole('spinbutton', { name: 'Grosor de las tiras: valor exacto' })).toHaveValue('8');
  await expect(page.getByRole('spinbutton', { name: 'Repeticiones: valor exacto' })).toHaveValue('2');
  await expect(page.getByRole('button', { name: 'Eliminar imagen seleccionada', exact: true })).toHaveCount(0);
  await page.getByRole('switch', { name: 'Ver resultado' }).uncheck();
  await expect.poll(() => page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height])).toEqual([480, 640]);
});
test('deletes the selected upload, keeps other images and returns to the demo', async ({ page }) => {
  await page.goto('/'); const exportButton = page.getByRole('button', { name: 'Exportar imagen' }); await expect(exportButton).toBeEnabled();
  const original = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  const fixture = Buffer.from(original.split(',')[1], 'base64');
  await page.locator('input[type=file]').setInputFiles([{ name: 'uno.png', mimeType: 'image/png', buffer: fixture }, { name: 'dos.png', mimeType: 'image/png', buffer: fixture }]);
  await expect(page.getByRole('button', { name: 'Seleccionar dos.png' })).toHaveAttribute('aria-pressed', 'true');
  const remove = page.getByRole('button', { name: 'Eliminar imagen seleccionada', exact: true });
  await remove.click();
  await expect(page.getByRole('button', { name: 'Seleccionar dos.png' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Seleccionar uno.png' })).toHaveAttribute('aria-pressed', 'true');
  await expect(remove).toBeEnabled(); await remove.click();
  await expect(remove).toHaveCount(0); await expect(exportButton).toBeEnabled();
  expect(await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).toBe(original);
  await page.reload(); await expect(exportButton).toBeEnabled();
  expect(await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).toBe(original);
});
test('deletes a sole restored upload and persists the fallback demo', async ({ page }) => {
  await page.goto('/'); const exportButton = page.getByRole('button', { name: 'Exportar imagen' }); await expect(exportButton).toBeEnabled();
  const fixture = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.locator('input[type=file]').setInputFiles({ name: 'guardada.png', mimeType: 'image/png', buffer: Buffer.from(fixture.split(',')[1], 'base64') });
  await expect(exportButton).toBeEnabled(); await expect(page.getByText('Guardado en este navegador')).toHaveText('Guardado en este navegador');
  await page.reload(); await expect(exportButton).toBeEnabled();
  await page.getByRole('button', { name: 'Eliminar imagen seleccionada', exact: true }).click();
  await expect(exportButton).toBeEnabled();
  await page.reload(); await expect(exportButton).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Eliminar imagen seleccionada', exact: true })).toHaveCount(0);
  expect(await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).toBe(fixture);
});
test('places the image on the left, controls on the right and comparison below', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
  await expect(page.getByRole('button', { name: 'Exportar imagen' })).toBeEnabled();
  const preview = await page.getByRole('region', { name: 'Vista previa de imagen' }).boundingBox();
  const controls = await page.getByRole('complementary', { name: 'Parámetros del filtro' }).boundingBox();
  const canvas = await page.locator('canvas').boundingBox();
  const comparison = await page.getByRole('group', { name: 'Comparar antes y después' }).boundingBox();
  expect(preview!.x + preview!.width).toBeLessThan(controls!.x);
  expect(comparison!.y).toBeGreaterThanOrEqual(canvas!.y + canvas!.height);
  await expect(page.getByLabel('Giro', { exact: true })).toHaveValue('ccw');
  await expect(page.getByRole('button', { name: 'Mover lienzo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Acercar' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Activar espejo 2 por 2' })).toHaveCount(0);
  await page.screenshot({ path: `outputs/editor-${testInfo.project.name}.png`, fullPage: true });
});
test('edits, compares, saves and exports a real image', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  const downloadButton = page.getByRole('button', { name: 'Exportar imagen' });
  await expect(downloadButton).toBeEnabled();
  const original = await page.locator('canvas').screenshot();
  await page.getByRole('spinbutton', { name: 'Grosor de las tiras: valor exacto' }).fill('29');
  await expect(page.getByRole('slider', { name: 'Grosor de las tiras', exact: true })).toHaveValue('29');
  await expect(downloadButton).toBeEnabled();
  expect((await page.locator('canvas').screenshot()).equals(original)).toBe(false);
  await page.getByRole('switch', { name: 'Ver resultado' }).uncheck();
  await expect(page.getByRole('img', { name: 'Imagen original', exact: true })).toBeVisible();
  await page.getByRole('switch', { name: 'Ver resultado' }).check();
  await expect(page.getByText('Guardado en este navegador')).toHaveText('Guardado en este navegador');
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Grosor de las tiras: valor exacto' })).toHaveValue('29');
  await expect(downloadButton).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent('download'), downloadButton.click()]);
  expect(download.suggestedFilename()).toMatch(/-pliegue\.png$/);
  expect(await download.failure()).toBeNull();
  expect(errors).toEqual([]);
});
test('imports multiple files and updates the active source', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Exportar imagen' })).toBeEnabled();
  const sourceUrl = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL('image/png'));
  const fixture = Buffer.from(sourceUrl!.split(',')[1], 'base64');
  await page.locator('input[type=file]').setInputFiles([{ name: 'uno.png', mimeType: 'image/png', buffer: fixture }, { name: 'dos.png', mimeType: 'image/png', buffer: fixture }]);
  await expect(page.getByRole('button', { name: 'Seleccionar dos.png' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Seleccionar uno.png' }).click();
  await expect(page.getByRole('button', { name: 'Seleccionar uno.png' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Exportar imagen' })).toBeEnabled();
});
test('migrates the old rotation default and preserves later choices', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Exportar imagen' })).toBeEnabled();
  await expect(page.getByText('Guardado en este navegador')).toHaveText('Guardado en este navegador');
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('pliegue', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite'), store = tx.objectStore('projects'), request = store.get('latest');
      request.onsuccess = () => { const saved = request.result; delete saved.uiVersion; saved.params.clockwise = true; saved.params.stripWidth = 17; store.put(saved, 'latest'); };
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    }); db.close();
  });
  await page.reload();
  await expect(page.getByLabel('Giro', { exact: true })).toHaveValue('ccw');
  await expect(page.getByRole('spinbutton', { name: 'Grosor de las tiras: valor exacto' })).toHaveValue('17');
  await page.getByLabel('Giro', { exact: true }).selectOption('cw');
  await expect(page.getByText('Guardado en este navegador')).toHaveText('Guardado en este navegador');
  await page.reload(); await expect(page.getByLabel('Giro', { exact: true })).toHaveValue('cw');
});
test('edits quadrant rotation, blur, saturation and tile rotation, then restores and exports', async ({ page }) => {
  await page.goto('/');
  const exportButton = page.getByRole('button', { name: 'Exportar imagen' });
  await expect(exportButton).toBeEnabled();
  const initial = await page.locator('canvas').screenshot();
  await page.getByLabel('Giro cuadrante 1', { exact: true }).selectOption('90');
  await expect(exportButton).toBeEnabled();
  expect((await page.locator('canvas').screenshot()).equals(initial)).toBe(false);
  await page.getByLabel('Blur', { exact: true }).selectOption('box');
  await page.getByRole('spinbutton', { name: 'Intensidad blur: valor exacto' }).fill('4');
  await expect(exportButton).toBeEnabled();
  const box = await page.locator('canvas').screenshot();
  await page.getByLabel('Blur', { exact: true }).selectOption('gaussian');
  await expect(exportButton).toBeEnabled();
  expect((await page.locator('canvas').screenshot()).equals(box)).toBe(false);
  await page.getByRole('spinbutton', { name: 'Saturación: valor exacto' }).fill('0');
  await expect(exportButton).toBeEnabled();
  expect(await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < pixels.length; i += 400) if (pixels[i] !== pixels[i + 1] || pixels[i] !== pixels[i + 2]) return false;
    return true;
  })).toBe(true);
  await page.getByLabel('Giro de baldosas', { exact: true }).selectOption('90');
  await expect(exportButton).toBeEnabled();
  await expect.poll(() => page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height])).toEqual([960, 1280]);
  await expect(page.getByText('Guardado en este navegador')).toHaveText('Guardado en este navegador');
  await page.reload(); await expect(exportButton).toBeEnabled();
  await expect(page.getByLabel('Giro cuadrante 1', { exact: true })).toHaveValue('90');
  await expect(page.getByLabel('Blur', { exact: true })).toHaveValue('gaussian');
  await expect(page.getByRole('spinbutton', { name: 'Intensidad blur: valor exacto' })).toHaveValue('4');
  await expect(page.getByRole('spinbutton', { name: 'Saturación: valor exacto' })).toHaveValue('0');
  await expect(page.getByLabel('Giro de baldosas', { exact: true })).toHaveValue('90');
  const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
  const fs = await import('node:fs'); const png = fs.readFileSync((await download.path())!);
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([960, 1280]);
  await page.getByRole('button', { name: 'Restablecer parámetros' }).click();
  await expect(page.getByLabel('Giro cuadrante 1', { exact: true })).toHaveValue('0');
  await expect(page.getByLabel('Blur', { exact: true })).toHaveValue('none');
  await expect(page.getByRole('spinbutton', { name: 'Saturación: valor exacto' })).toHaveValue('100');
});
test('runs the GPU pixel shader with CPU parity', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Exportar imagen' })).toBeEnabled();
  const result = await page.evaluate(async () => {
    const modulePath = '/src/engine/smoothing.ts'; const shader = await import(modulePath);
    const data = new Uint8ClampedArray(Array.from({ length: 35 }, (_, i) => {
      const x = i % 5, y = Math.floor(i / 5); return x + y < 5 ? [20, 40, 130, 128] : [240, 190, 30, 255];
    }).flat());
    const source = { width: 5, height: 7, data };
    const cpu = shader.smoothPixelsCpu(source, 85), gpu = shader.smoothPixelsGpu(source, 85);
    if (!gpu) return { backend: 'cpu', difference: 0, changed: cpu.data.some((v: number, i: number) => v !== data[i]) };
    let difference = 0; for (let i = 0; i < data.length; i++) difference = Math.max(difference, Math.abs(cpu.data[i] - gpu.data[i]));
    return { backend: 'webgl2', difference, changed: gpu.data.some((v: number, i: number) => v !== data[i]) };
  });
  console.log('Pixel smooth backend:', result.backend);
  expect(result.changed).toBe(true); expect(result.difference).toBeLessThanOrEqual(1);
});
test('temporarily disables shader controls and ignores previously saved activation', async ({ page }) => {
  await page.goto('/'); const exportButton = page.getByRole('button', { name: 'Exportar imagen' }); await expect(exportButton).toBeEnabled();
  const before = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await expect(page.getByLabel('Shader', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Suavizado', exact: true })).toHaveCount(0);
  await expect(page.getByText('Guardado en este navegador')).toHaveText('Guardado en este navegador');
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('pliegue', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite'), store = tx.objectStore('projects'), request = store.get('latest');
      request.onsuccess = () => { const saved = request.result; saved.params.smoothing = true; saved.params.smoothingStrength = 100; store.put(saved, 'latest'); };
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    }); db.close();
  });
  await page.reload(); await expect(exportButton).toBeEnabled();
  await expect(page.getByLabel('Shader', { exact: true })).toHaveCount(0);
  expect(await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).toBe(before);
  const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]); expect(await download.failure()).toBeNull();
});
test('works without workers, validates exact input and fits mobile', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'Worker', { value: undefined }); Object.defineProperty(window, 'OffscreenCanvas', { value: undefined }); });
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await expect(page.getByRole('button', { name: 'Exportar imagen' })).toBeEnabled();
  const field = page.getByRole('spinbutton', { name: 'Repeticiones: valor exacto' });
  await field.fill('99'); await field.press('Tab'); await expect(field).toHaveValue('12');
  await expect(page.getByRole('button', { name: 'Exportar imagen' })).toBeEnabled();
  await page.getByRole('button', { name: 'Restablecer parámetros' }).click(); await expect(field).toHaveValue('2');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
