# Reglas del Proyecto: rhythm-game

## Servidor de Desarrollo

- **NUNCA ejecutes `npm run dev`** ni ningún comando equivalente para levantar el servidor de desarrollo.
- Dejar que el usuario inicie el servidor local por su cuenta.
- Puedes ejecutar otros comandos como `npm run build`, `npm run typecheck`, etc. si es necesario para verificar el proyecto.

## Git: Push Automático Después de Cada Actualización

- Después de **cada conjunto de cambios** realizados al proyecto (edición de archivos, creación de nuevos archivos, etc.), debes hacer un `git push` automático al repositorio remoto.
- El repositorio remoto es: `https://github.com/WingsStroke/rhythm-game`
- El mensaje del commit debe estar **en español**, ser descriptivo y resumir los cambios realizados.
- Secuencia de comandos a ejecutar después de cada actualización:
  ```
  git add -A
  git commit -m "<mensaje en español>"
  git push
  ```
- Si no hay cambios que commitear (`nothing to commit`), no es necesario hacer push.

## Idioma de Commits

- Los mensajes de commit deben estar siempre en **español**.
- Deben ser concisos pero descriptivos del cambio realizado.
- Ejemplos de formato:
  - `feat: Añade sistema de AudioModulator para suavizado asimétrico de bandas`
  - `refactor: Restructura VisualEngine con jerarquía de capas por zIndex`
  - `fix: Corrige delay en la reanudación del timeline al pausar`
