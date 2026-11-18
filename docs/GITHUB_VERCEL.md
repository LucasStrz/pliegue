# Publicación en GitHub y Vercel

## Publicación actual

- Web pública de producción: [pliegue-two.vercel.app](https://pliegue-two.vercel.app).
- Repositorio privado: [LucasStrz/pliegue](https://github.com/LucasStrz/pliegue).
- Proyecto de Vercel: `pliegue`, en el equipo `lucasss-projects-d5c2a67b`.
- Código desplegado: commit `8f32a1249a977371d38398ed007ad251154108cf`.
- Publicación inicial realizada mediante los archivos de ese commit, con Node 22, instalación `npm ci` y compilación `npm run build`.
- La integración automática con GitHub **no está vinculada**: Vercel devolvió `repo_not_found` al intentar acceder al repositorio privado nuevo. El código sí está subido a GitHub y la web sí está desplegada y accesible sin autenticación. Para habilitar despliegues por cada push, se debe autorizar este repositorio en la integración GitHub de Vercel y conectarlo al proyecto existente, sin crear otro proyecto.

El código y la documentación posteriores pueden avanzar en GitHub sin modificar este despliegue hasta que se publique una nueva versión o se habilite esa integración automática.

## Estado de preparación

El proyecto está preparado como aplicación estática Vite. `npm run build` genera `dist/` y el Worker de procesamiento. `vercel.json` declara el framework, la instalación reproducible con `npm ci`, el comando de compilación y el directorio de salida.

La preparación local no crea por sí sola un repositorio ni un proyecto de Vercel. Esas operaciones requieren acceso autenticado a las cuentas de destino.

## Archivos que deben versionarse

El repositorio debe contener `src/`, `public/`, `docs/`, `e2e/`, `index.html`, los archivos de configuración, `package.json` y `package-lock.json`. La fotografía de demostración se incluye en `public/entrelazado.jpg`; por ello formará parte de la web compartida. Las fotografías importadas por visitantes permanecen en su navegador.

No se deben subir `node_modules/`, `dist/`, capturas, trazas, credenciales ni archivos `.env`. `.gitignore` excluye esos datos, y `.vercelignore` también excluye los resultados temporales y la configuración específica del alojamiento anterior durante despliegues con la CLI de Vercel.

`.openai/hosting.json` identifica el alojamiento anterior. No contiene credenciales y no es necesario para ejecutar el proyecto en Vercel. Conviene conservarlo en este checkout para mantener su vínculo con Sites. No debe reemplazarse ni reutilizarse como identidad de Vercel.

## GitHub

1. Conectar la cuenta de GitHub que será propietaria del repositorio.
2. Crear un repositorio nuevo, por ejemplo `pliegue`, sin sobrescribir repositorios existentes.
3. Subir el estado completo y verificado del proyecto a su rama principal.
4. Comprobar que el repositorio contiene la documentación, la foto de demostración y el lockfile.

El código puede permanecer en un repositorio privado y la web desplegada puede ser pública. Compartir la web no exige publicar el código fuente. La aplicación no necesita secretos ni variables de entorno para funcionar.

## Vercel

Importar el repositorio desde la cuenta y el equipo de Vercel elegidos. Si la raíz del repositorio es esta carpeta de proyecto, utilizar estos valores:

| Configuración | Valor |
| --- | --- |
| Framework | Vite |
| Root Directory | Raíz del repositorio |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Variables de entorno | Ninguna requerida |

Si se sube la carpeta contenedora `appfiltros` como raíz del repositorio, Root Directory debe ser `pliegue`. La configuración de este proyecto corresponde a publicar directamente su propia carpeta como raíz.

Para un enlace que pueda abrir cualquier persona, el despliegue de producción debe ser accesible sin autenticación de Vercel. Esto se debe verificar con una sesión sin iniciar y con una imagen importada de prueba. Un despliegue completado pero protegido por inicio de sesión no cumple ese objetivo.

Una vez conectado GitHub, los cambios enviados a la rama de producción pueden generar nuevos despliegues mediante la integración de Vercel. La configuración definitiva y la URL deben confirmarse en la cuenta de destino; no se deben inventar enlaces antes de que exista un despliegue satisfactorio.

## Verificación antes y después

```sh
npm ci
npm test
npm run build
```

Después de publicar:

- Abrir la URL de producción sin iniciar sesión.
- Confirmar que se carga la foto inicial con Entrelazado.
- Importar una imagen y modificar sus parámetros.
- Verificar que el Worker carga desde el dominio de Vercel.
- Exportar PNG/JPG y eliminar una imagen importada.
- Confirmar que el shader sigue temporalmente deshabilitado.

Los proyectos guardados en IndexedDB pertenecen al origen de cada sitio. Los datos guardados en el dominio anterior no se trasladan automáticamente al nuevo dominio de Vercel.

## Referencias

- [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Configuración estática de Vercel](https://vercel.com/docs/project-configuration/vercel-json)
