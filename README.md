# Pliegue

Laboratorio de collage digital construido con React, TypeScript, Vite, Canvas API y Zustand. Interfaz mínima inspirada en la web antigua: imagen sin marco, comparación debajo y controles nativos al costado. Las imágenes se procesan localmente: no hay subidas, analítica ni servicios externos en el editor.

## Desarrollo

```sh
npm install
npm run dev
```

Abre la URL que indica Vite. Para producción: `npm run build`; para inspeccionar el resultado: `npm run preview`.

## El filtro

1. Espejo lateral y vertical opcional, para crear una cuadrícula 2×2.
2. División en tiras verticales del grosor seleccionado. Se toma la primera, la última, la segunda, la penúltima, etc. Cada tira gira 90° y se apila de arriba abajo. La tira final parcial conserva sus dimensiones; ningún píxel se elimina.
3. Repetición del paso anterior sobre la imagen resultante. Una pasada intercambia ancho y alto; dos recuperan las dimensiones iniciales.
4. Mezcla con la imagen previa al reordenamiento y ajuste de contraste.

Los controles permiten elegir grosor, repeticiones, extremo inicial, dirección del giro, intensidad y contraste. El giro predeterminado es antihorario. Hay comparación antes/después, preajustes, importación múltiple y exportación PNG/JPG. Las imágenes importadas se seleccionan individualmente: esta primera versión no incorpora composición multicapa.

## Arquitectura

- `src/engine`: algoritmos puros sobre RGBA y Web Worker.
- `src/hooks/useProcessor.ts`: procesamiento asíncrono con descarte de resultados antiguos y alternativa en el hilo principal si no hay Worker.
- `src/components`: imagen Canvas y control sincronizado slider/número.
- `src/store.ts`: parámetros con Zustand.
- `src/lib`: lectura/exportación de imágenes y persistencia IndexedDB.

El procesamiento trabaja directamente con ImageData y no necesita OffscreenCanvas. Canvas se utiliza para decodificar y exportar. Esto conserva compatibilidad con Chromium y Firefox y con entornos sin OffscreenCanvas.

Para mantener la respuesta interactiva, la imagen de trabajo se ajusta a 900 px en su lado mayor antes del espejo (hasta 1800 px después). La exportación usa esta resolución, sin prometer resolución nativa del archivo original. Se admiten archivos de hasta 30 MB, un máximo de 12 imágenes en la sesión y se guarda automáticamente **el último proyecto activo**, no la biblioteca completa. IndexedDB depende del almacenamiento disponible del navegador; un fallo se indica al pie. Las animaciones GIF se importan como una imagen fija.

La demostración incluida es un estudio abstracto vectorial creado para la aplicación. La referencia adjunta del usuario no se distribuye con el sitio.

La auditoría de dependencias de producción no presenta alertas. npm todavía informa alertas en herramientas de desarrollo relacionadas con picomatch; no forman parte del sitio estático publicado. Vitest se actualizó para resolver las alertas críticas originales. Ejecuta el servidor de desarrollo solo en la interfaz local configurada.

## Verificación

```sh
npm test
npm run build
npx playwright install chromium firefox
npm run test:e2e
```

Vitest comprueba la reflexión de ambos ejes, el orden exacto de las tiras, los giros, los grosores no divisibles, la conservación de RGBA y la mezcla. Playwright comprueba edición, comparación, restauración, descarga, importación múltiple, fallback sin Worker y diseño móvil en Chromium y Firefox.
