# Pliegue

Laboratorio de collage digital construido con React, TypeScript, Vite, Canvas API y Zustand. Interfaz mínima inspirada en la web antigua: imagen sin marco, comparación debajo y controles nativos al costado. Las imágenes se procesan localmente: no hay subidas, analítica ni servicios externos en el editor.

## Desarrollo

```sh
npm install
npm run dev
```

Abre la URL que indica Vite. Para producción: `npm run build`; para inspeccionar el resultado: `npm run preview`.

## El filtro

1. Espejo lateral y vertical automático, para crear una cuadrícula 2×2. No hay interruptor de espejo.
2. Giro independiente de cada cuadrante en pasos de 90°, antes de cortar. Si la celda es rectangular, el contenido girado se ajusta sin deformarlo ni recortarlo; puede quedar margen transparente.
3. Se completan las dimensiones hasta el múltiplo siguiente de n (grosor de tiras), extendiendo solo los píxeles de borde inferior y derecho. Esto garantiza baldosas completas n×n. Se divide en tiras verticales de grosor n: se toma la primera, la última, la segunda, la penúltima, etc. Cada tira gira 90° y se apila de arriba abajo. Ningún píxel original se elimina.
4. Repetición del paso anterior sobre la imagen resultante. Una pasada intercambia ancho y alto; dos recuperan las dimensiones iniciales.
5. Giro de cada baldosa n×n del resultado en 0°, 90°, 180° o 270° en sentido horario. Las baldosas giran sobre su propio centro, conservando su posición dentro de la cuadrícula y las dimensiones del resultado. No hay rotación global de la imagen. El giro de cuadrantes iniciales y el de baldosas finales son controles independientes.
6. Saturación (0–200 %, 100 % neutro) y contraste.
7. Shader opcional **Pixel smooth** con intensidad 0–100 %. Interpolación original de esquinas inspirada en los filtros de emuladores (familia xBR/Scale2x), sin utilizar su código ni ser un port de xBR. Suaviza escalones diagonales conservando líneas rectas y puntos aislados. Utiliza GLSL en WebGL2 con OffscreenCanvas dentro del Worker, con alternativa CPU equivalente si no hay soporte GPU. Conserva dimensiones y procesa alfa premultiplicado. Referencia conceptual: [shaders de Libretro](https://github.com/libretro/common-shaders/tree/master/xbr).
8. Blur opcional Box o Gaussian con intensidad 0–30 px. Gaussian aproxima la distribución con tres box de varianza ajustada.
9. La intensidad mezcla **siempre con la imagen original, sin espejo ni efectos**, ajustada proporcionalmente al lienzo de salida, con margen transparente cuando las proporciones difieren. 0 % = original, 100 % = resultado de todos los efectos. El ajuste a otro tamaño usa interpolación bilineal y la mezcla conserva correctamente la transparencia. PNG conserva estos márgenes; JPG los rellena de blanco.

Los controles permiten elegir grosor, repeticiones, extremo inicial, dirección del giro, intensidad, contraste, rotaciones, saturación y desenfoque. El giro de las tiras predeterminado es antihorario. Hay comparación antes/después, preajustes, importación múltiple y exportación PNG/JPG. Las imágenes importadas se seleccionan individualmente: esta primera versión no incorpora composición multicapa.

## Arquitectura

- `src/engine`: algoritmos puros sobre RGBA y Web Worker.
- `src/hooks/useProcessor.ts`: procesamiento asíncrono con descarte de resultados antiguos y alternativa en el hilo principal si no hay Worker.
- `src/components`: imagen Canvas y control sincronizado slider/número.
- `src/store.ts`: parámetros con Zustand.
- `src/lib`: lectura/exportación de imágenes y persistencia IndexedDB.

El procesamiento trabaja directamente con ImageData. Pixel smooth usa OffscreenCanvas y WebGL2 cuando están disponibles, con alternativa CPU. Canvas se utiliza para decodificar y exportar. Esto conserva compatibilidad con Chromium y Firefox y con entornos sin OffscreenCanvas.

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
