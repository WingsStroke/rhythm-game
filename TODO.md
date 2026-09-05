# 📋 MASTER TO-DO & ROADMAP TÁCTICO — NEON PULSE
### Hoja de Ruta Viva y Backlog de Tareas hacia la Primera Versión Pública (v1.0)

> **Propósito de este documento:**
> Este archivo es el **tablero de control operativo y backlog vivo** del proyecto. A diferencia de `Informe.md` (que es el manifiesto filosófico, conceptual y arquitectural de alto nivel), este documento desglosa **cada tarea técnica, lógica pendiente, mejora de UX, funcionalidad del editor y meta futura** con granularidad táctica.
> 
> Debe mantenerse actualizado en cada iteración y conservarse versionado en el repositorio.

---

## 🧭 Convención de Estados y Prioridades

- `[x]` **Completado**: Implementado, probado y verificado en la rama principal.
- `[-]` **En Progreso / Siguiente**: Foco activo de trabajo o siguiente paso inmediato.
- `[ ]` **Pendiente**: Planificado para su respectiva fase o iteración.

### Niveles de Prioridad
- **🔴 P0 (Crítico / Bloqueante)**: Esencial para la estabilidad del juego, la arquitectura base o la experiencia esencial.
- **🟠 P1 (Alta)**: Funcionalidades nucleares requeridas antes del despliegue o beta pública.
- **🟡 P2 (Media)**: Mejoras de calidad de vida, herramientas del editor y pulido de interacción.
- **🟢 P3 (Deseable / Expansión)**: Características avanzadas, modos secundarios y mejoras cosméticas.

---

## 🏛️ 1. ESTADO ACTUAL: FASES COMPLETADAS (0 A 5)

- [x] **Fase 0 — Concepto y Arquitectura Base**
  - [x] Contratos desacoplados (`TimeSource`, `Transport`, `GameplayEventBus`).
  - [x] Sincronización Web Audio API como reloj maestro (`currentTime`) y PixiJS Ticker para rendering.
  - [x] Desacoplamiento estricto de identidad en `SceneGraph` (`uid` inmutable, `name` legible, `targetId` numérico).

- [x] **Fase 1 — Core Gameplay Engine**
  - [x] Detección precisa de pulsación y ventanas de tiempo (Perfect: ±45ms, Good: ±90ms, Miss: ±150ms).
  - [x] Sistema de puntuación base, racha de combo acumulativo y multiplicador dinámico (1x, 2x, 4x, 8x).
  - [x] Sintetizador procedural integrado (Kick, Snare, Hi-Hat, Bass, Lead) para juego con cero assets externos.
  - [x] 4 pads sonoros semánticos (`pad_0` a `pad_3`) y 4 comportamientos (`tap`, `hold`, `loop`, `trigger`).

- [x] **Fase 2 — Visual Engine y Reactividad**
  - [x] Grafo de escena jerárquico (`SceneGraph`) con transformaciones heredadas (posición, rotación, escala, opacidad).
  - [x] Modulación reactiva FFT en tiempo real (`AudioMapping`: `bass`, `mids`, `treble`, `ambient`).
  - [x] Animaciones interpoladas (`Animator`) y disparadores de eventos visuales (`TriggerDispatcher`).
  - [x] Shaders GLSL para aberración cromática RGB y bloom post-processing; emisor de partículas `ParticlePool`.

- [x] **Fase 3 — Level Editor Interno**
  - [x] Línea de tiempo multi-pista estilo DAW con snapping musical (1/1 a 1/16 y libre) y scroll sincronizado.
  - [x] Herramientas interactivas con atajos rápidos (V: Selección, B: Lápiz/Creación, E: Borrador).
  - [x] Pila de historial Undo/Redo (Ctrl+Z / Ctrl+Y) de hasta 50 estados.
  - [x] Modo de grabación en vivo (Live Recording) mediante pulsaciones sobre los pads.
  - [x] Scene Outliner e Inspector de Propiedades contextual con validación de color hex en vivo.

- [x] **Fase 4 — Player Standalone y Content Runtime**
  - [x] Reproductor independiente a resolución lógica fija 1920×1080 con letterboxing automático responsivo.
  - [x] Flujo de prueba continuo Editor ↔ Standalone Player mediante el botón `PLAYTEST`.
  - [x] Sistema de pausa inmediata vía tecla `Escape` con congelamiento de audio y modales interactivos.
  - [x] HUD de rendimiento en tiempo real (barra de progreso, tiempo restante, combo animado, precisión %).
  - [x] Pantalla de resultados (`ResultsModal`) con calificaciones (SS, S, A, B, C, D) y desglose de juicios.

- [x] **Fase 5 — Content Pipeline y Gestión de Assets**
  - [x] `SongRegistry` activo con almacenamiento en memoria RAM de `AudioBuffer` decodificados.
  - [x] Reutilización instantánea de buffers (0ms de overhead) al cambiar de dificultad o reiniciar pistas.
  - [x] Validador profundo de esquemas y sanitizador de niveles (`LevelValidator`).
  - [x] Soporte multi-dificultad nativo (`LevelPackage`: Easy, Normal, Hard) compartiendo la misma pista.
  - [x] Generación de beatmaps adaptados por dificultad con escalas de ventanas de tiempo proporcionales.
  - [x] Frontend de inicio actualizado con selector de dificultad, monitor de RAM y alerta de errores de validación JSON.

---

## ⚡ 2. LÓGICA DE GAMEPLAY Y REGLAS PENDIENTES

Cuestiones lógicas del gameplay y del motor que han quedado en segundo plano y requieren atención:

- [ ] **🟠 P1 — Detección y Bonificación de `PerformancePhrase`**
  - El contrato `PerformancePhrase` ya existe en `types.ts`, pero `GameplayEngine.ts` aún no rastrea si una frase musical se completó sin fallos.
  - *Acción:* Emitir `PHRASE_COMPLETED` en `GameplayEventBus` al clavar una secuencia de notas, otorgando un bono sustancial de puntaje y un flash visual especial en el HUD.

- [ ] **🟠 P1 — Lógica de Ticks Intermedios para Notas Sostenidas (`Hold Ticks`)**
  - Actualmente, un evento `hold` verifica inicio y final, pero no recompensa mantener la presión frame a frame.
  - *Acción:* Generar micro-ticks rítmicos cada 1/8 o 1/16 de compás durante la duración del hold que sumen puntos continuos y alimenten la racha de combo.

- [ ] **🔴 P0 — Asistente Interactivo de Calibración de Latencia (Audio/Visual Offset Wizard)**
  - Jugadores con auriculares Bluetooth o monitores de diferente tasa de refresco experimentan desfases de entre 20ms y 150ms.
  - *Acción:* Crear una pantalla de calibración accesible desde Settings con un metrónomo sonoro interactivo donde el usuario presione una tecla al ritmo durante 8 compases para calcular automáticamente el `audioOffset` y `visualOffset` local.

- [ ] **🟠 P1 — Remapeo Dinámico de Controles (Keybinding Remapper)**
  - Las teclas están actualmente fijas a A/S/D/F.
  - *Acción:* Implementar selector interactivo de bindings (e.g. D/F/J/K, teclado numérico o flechas) guardado en `localStorage`.

- [ ] **🟡 P2 — Modificadores de Juego (Gameplay Modifiers)**
  - Permitir a los jugadores personalizar el desafío antes de iniciar:
    - *Velocidad:* 0.75x, 1.0x, 1.25x, 1.5x, 2.0x (modificando BPM o audio rate).
    - *Modo Auto:* Bot que reproduce la canción en automático para previsualización.
    - *Modo Espejo (Mirror):* Invierte el mapeo de pads (`pad_0` ↔ `pad_3`, `pad_1` ↔ `pad_2`).
    - *Modo Fade In / Sudden:* Las notas aparecen o desaparecen a mitad de camino.

- [ ] **🟡 P2 — Barra de Vida / Energía Opcional (Life Bar / Gauge)**
  - Modo estricto donde los fallos (`miss`) drenan una barra de energía y un 0% provoca Game Over, diferenciado del modo práctica actual.

- [ ] **🟡 P2 — Scoring Avanzado y Persistencia Local de Récords**
  - Guardar las mejores puntuaciones, precisiones y rangos (SS/S/A...) en `localStorage` indexados por `levelId + difficulty`.
  - Mostrar badge de "Nuevo Récord" en la pantalla de resultados.

---

## 🎛️ 3. PENDIENTES DEL EDITOR DE NIVELES (HERRAMIENTAS Y WORKFLOW)

Herramientas avanzadas del editor necesarias para acelerar y facilitar la creación de beatmaps complejos:

- [ ] **🟠 P1 — Visualización de la Forma de Onda de Audio (Audio Waveform Display)**
  - Dibujar la gráfica de la onda de audio directamente de fondo en la línea de tiempo.
  - Permite al creador alinear visualmente los golpes de batería y transientes acústicos con el snapping de la rejilla.

- [ ] **🟠 P1 — Selección Múltiple y Marquesina en Timeline**
  - Poder arrastrar un cuadro de selección para seleccionar decenas de notas y triggers a la vez.
  - Soporte para mover bloques enteros de notas hacia adelante o atrás en el tiempo.

- [ ] **🟠 P1 — Copiar, Cortar y Pegar Bloques de Notas (Ctrl+C, Ctrl+X, Ctrl+V)**
  - Copiar compases completos y pegarlos en la posición actual del cabezal de reproducción con un clic.

- [ ] **🟡 P2 — Zoom Horizontal y Vertical en Timeline**
  - Atajos `Ctrl + Rueda del ratón` o slider visual para acercar compases en pasajes rápidos (1/16, 1/32) o alejar para ver la canción completa.

- [ ] **🟡 P2 — Guardado Automático en `localStorage` (Auto-Save Recovery)**
  - Guardar el estado del nivel cada 30 segundos en el almacenamiento local para que, si el usuario cierra el navegador por error, no pierda su trabajo.

- [ ] **🟡 P2 — Duplicación Rápida con Arrastre (Alt + Drag / Ctrl+D)**
  - Clonar una nota o trigger seleccionado simplemente manteniéndolo presionado mientras se arrastra.

- [ ] **🟢 P3 — Pistas de Automatización de BPM y Cambios de Compás**
  - Soporte para canciones con cambios de tempo (tempo ramps) o firmas de compás variables (3/4, 6/8).

---

## 🚀 4. FASE 6 — OPTIMIZACIÓN Y PULIDO DE MOTOR (SIGUIENTE FASE INMEDIATA)

Foco en rendimiento sostenido a 60+ FPS, estabilidad térmica y ergonomía:

- [ ] **🔴 P0 — Object Pooling Intensivo en PixiJS**
  - Reutilizar instancias de `Graphics`, `Container` y `Sprite` para notas que caen, flashes de pads y partículas en lugar de instanciar y destruir objetos por frame.
  - Eliminar picos de recolección de basura (Garbage Collection stutter).

- [ ] **🟠 P1 — Perfiles de Calidad Gráfica Adaptativa**
  - Selector en ajustes: *Baja, Media, Alta, Ultra*.
  - Opciones para conmutar shaders pesados (Bloom, Aberración RGB), densidad de partículas y antialiasing para garantizar 60 FPS en laptops modestas o navegadores móviles.

- [ ] **🟠 P1 — Web Worker para Procesamiento Asíncrono**
  - Mover la validación de archivos JSON pesados, cálculo de formas de onda y parsing de niveles a un Web Worker separado para que la UI nunca se congele.

- [ ] **🟡 P2 — Auditoría de Fugas de Memoria (Memory Leak Prevention)**
  - Profiling de listeners de eventos en la transición repetida entre Editor ↔ Standalone Player.
  - Confirmar que `AudioTransport`, `PixiJS Application` y `AudioContext` liberen el 100% de memoria al cambiar de pantalla.

---

## 📦 5. PIPELINE DE CONTENIDO Y EMPAQUETADO AVANZADO

- [ ] **🟠 P1 — Formato de Archivo Unificado `.rhythm` / `.zip`**
  - Empaquetador que comprima: `level.json` + `audio.mp3` + `cover.png` + `background.png` en un solo archivo descargable y cargable con drag & drop directo en la ventana del navegador.

- [ ] **🟡 P2 — Importador de Formatos Estándar (`.osu` osu!mania, `.sm` StepMania)**
  - Conversor automático que lea archivos de beatmaps comunitarios de 4 teclas (`4K`) y los traduzca automáticamente a `LevelData` nativo de Neon Pulse.

- [ ] **🟢 P3 — Generador Asistido de Beatmaps por Detección de Transientes (Onset Detection)**
  - Analizar cualquier canción subida por el usuario mediante FFT en el cliente, detectar los transientes de percusión y generar una propuesta inicial de notas en Easy/Normal/Hard para editar sobre ella.

---

## 🌐 6. FASE 7 — INFRAESTRUCTURA ONLINE Y BACKEND (HACIA LA PRIMERA BETA)

- [ ] **🟠 P1 — Base de Datos y Autenticación con Supabase**
  - Inicio de sesión con correo o proveedores OAuth (Discord / Google).
  - Tabla de perfiles de jugador: avatar, nivel de experiencia, puntuación total acumulada.

- [ ] **🟠 P1 — Tablas de Clasificación Globales (Global & Difficulty Leaderboards)**
  - Registro del Top 50 mundial por canción y por dificultad (Easy, Normal, Hard).
  - Envío seguro de puntajes con verificación básica de integridad (hash/checksum del replay para evitar trampas).

- [ ] **🟡 P2 — Guardado en la Nube de Niveles Propios (Cloud Saves)**
  - Guardar y sincronizar beatmaps creados en el editor en la nube del usuario para continuar editando desde cualquier equipo.

---

## 👥 7. FASE 8 — MULTIJUGADOR, REPETICIONES Y COMUNIDAD

- [ ] **🟠 P1 — Sistema de Repeticiones (Replay System)**
  - Grabar la lista de entradas del jugador (`time`, `padId`, `action`) durante una partida.
  - Permitir guardar el replay junto al puntaje y reproducir la partida exacta desde la pantalla de resultados o leaderboards.

- [ ] **🟡 P2 — Modo Duelo 1v1 en Tiempo Real**
  - Dos jugadores compiten en simultáneo por WebSockets / WebRTC con la misma canción, viendo la barra de progreso y puntaje del rival en tiempo real.

- [ ] **🟡 P2 — Modo Mashup Cooperativo**
  - Dos jugadores con Launchpads independientes interpretan secciones complementarias (e.g. Jugador 1: Percusión/Bajos; Jugador 2: Melodías/Sintetizadores) sobre una pista combinada.

- [ ] **🟢 P3 — Navegador y Catálogo Comunitario (Community Song Hub)**
  - Explorador dentro del juego para buscar, escuchar fragmentos, descargar y votar canciones creadas por la comunidad.

---

## 🎨 8. BANCO DE IDEAS CREATIVAS (EQUIPO Y ANTIGRAVITY)

Ideas y conceptos complementarios para evaluar durante el desarrollo:

1. **Rutas Visuales y Láseres de Carril (Lane Lasers)**:
   - Líneas de luz que se proyectan desde los pads hacia el centro de la pantalla al compás de la música, reaccionando a los bombos con pulsos de neón.
2. **Efectos de Partículas Temáticas**:
   - Selector de estilo de partículas al acertar notas (Chispas eléctricas, Polvo estelar neón, Anillos de distorsión sónica).
3. **Modo Práctica con Repetición de Compases (A-B Loop Practice Mode)**:
   - En el editor o antes de jugar, marcar un punto A y un punto B para practicar una sección difícil en bucle infinito con velocidad graduable.
4. **Retroalimentación Háptica (Gamepad & Mobile Vibration)**:
   - Soporte para la Vibration API del navegador en teléfonos y gamepads (vibración sutil y punchy al acertar `Perfect` o clavar un bombo).
5. **Modo Zen / Modo Auto-Visualizer**:
   - Un modo sin HUD ni juicios donde la canción suena, las notas se tocan solas y la pantalla se convierte en un visualizador musical interactivo para relajarse o proyectar en fiestas.

---

## 📌 9. REGISTRO DE DECISIONES DE DISEÑO VIGENTES

1. **Idioma de la Experiencia (Language Standard):**
   - Frontend del usuario (menús, botones, HUD, modales, alertas): **100% Inglés nativo**.
   - Comunicación de equipo, roadmap, `Informe.md`, `TODO.md` y mensajes de commit de git: **100% Español**.
   - Documentación técnica del código y contratos JSDoc: **100% Inglés**.
2. **Arquitectura de Identidades:**
   - `uid`: Clave interna inmutable y única de cada nodo escénico.
   - `name`: Nombre descriptivo legible por humanos en el outliner.
   - `targetId`: Identificador numérico para agrupación de triggers y FX visuales.
3. **Sincronización:**
   - La fuente única de tiempo es el reloj de audio (`AudioContext.currentTime`). Ningún cálculo de gameplay se basa en el número de frames de renderizado.
4. **Política de Git:**
   - Cada conjunto de cambios funcionales debe confirmarse en git inmediatamente tras verificar `npx tsc -b`.
   - `git push` y `npm run dev` nunca deben ejecutarse mediante agentes automatizados; son controlados por el propietario del repositorio.
