# Pliegue

Laboratorio de collage digital construido con React, TypeScript, Vite, Canvas API y Zustand. Interfaz mínima inspirada en la web antigua: imagen sin marco, comparación debajo y controles nativos al costado. Las imágenes se procesan localmente: no hay subidas, analítica ni servicios externos en el editor.

## Documentación detallada

Consulta [Funcionamiento completo del programa](docs/FUNCIONAMIENTO.md): mapa de archivos, flujo de datos, controles, algoritmos, Worker, persistencia, exportación, pruebas, publicación y límites.

**Pixel smooth está temporalmente deshabilitado.** Sus controles están ocultos y el motor omite el efecto incluso en proyectos que lo tenían activado. El código se conserva; el interruptor y los pasos de reactivación se documentan en la guía.

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
7. Etapa **Pixel smooth omitida temporalmente**. Se conserva su implementación de suavizado de esquinas con GLSL/WebGL2 y alternativa CPU; `PIXEL_SMOOTH_ENABLED = false` impide ejecutarla y oculta sus controles.
8. Blur opcional Box o Gaussian con intensidad 0–30 px. Gaussian aproxima la distribución con tres box de varianza ajustada.
9. La intensidad mezcla **siempre con la imagen original, sin espejo ni efectos**, ajustada proporcionalmente al lienzo de salida, con margen transparente cuando las proporciones difieren. 0 % = original, 100 % = resultado de todos los efectos. El ajuste a otro tamaño usa interpolación bilineal y la mezcla conserva correctamente la transparencia. PNG conserva estos márgenes; JPG los rellena de blanco.

Los controles permiten elegir grosor, repeticiones, extremo inicial, dirección del giro, intensidad, contraste, rotaciones, saturación y desenfoque. El giro de las tiras predeterminado es antihorario. Hay comparación antes/después, preajustes, importación múltiple y exportación PNG/JPG. Las imágenes importadas se seleccionan individualmente: esta primera versión no incorpora composición multicapa.

## Arquitectura

- `src/engine`: algoritmos puros sobre RGBA y Web Worker.
- `src/hooks/useProcessor.ts`: procesamiento asíncrono con descarte de resultados antiguos y alternativa en el hilo principal si no hay Worker.
- `src/components`: imagen Canvas y control sincronizado slider/número.
- `src/store.ts`: parámetros con Zustand.
- `src/lib`: lectura/exportación de imágenes y persistencia IndexedDB.

El procesamiento activo trabaja directamente con ImageData. La implementación de Pixel smooth, actualmente inactiva, puede usar OffscreenCanvas y WebGL2 o su alternativa CPU. Canvas se utiliza para decodificar y exportar. El editor funciona en Chromium y Firefox y no requiere OffscreenCanvas.

Para mantener la respuesta interactiva, la imagen de trabajo se ajusta a 900 px en su lado mayor antes del espejo (hasta 1800 px después, más el relleno necesario para completar baldosas). La exportación usa esta resolución, sin prometer resolución nativa del archivo original. Se admiten archivos de hasta 30 MiB, un máximo de 12 imágenes en la sesión y se guarda automáticamente **el último proyecto activo**, no la biblioteca completa. IndexedDB depende del almacenamiento disponible del navegador; los fallos actualizan el estado accesible de guardado, actualmente oculto visualmente. Las animaciones GIF se importan como una imagen fija.

La demostración inicial es la fotografía adjunta por el usuario, incluida en `public/entrelazado.jpg`, con el preajuste Entrelazado. Las imágenes importadas pueden retirarse mediante «Eliminar imagen seleccionada». Se selecciona otra imagen disponible o se vuelve a la demostración, y se actualiza el último proyecto guardado. Esto no elimina archivos del disco del usuario.

Para revisar alertas actuales de dependencias, ejecuta `npm audit` y `npm audit --omit=dev`; el resultado depende del lockfile y de los avisos vigentes del registro. Ejecuta el servidor de desarrollo solo en la interfaz local configurada.

## Verificación

```sh
npm test
npm run build
npx playwright install chromium firefox
npm run test:e2e
```

Vitest comprueba la reflexión de ambos ejes, el orden exacto de las tiras, los giros, los grosores no divisibles, la conservación de RGBA y la mezcla. Playwright comprueba edición, comparación, restauración, descarga, importación múltiple, fallback sin Worker y diseño móvil en Chromium y Firefox.
