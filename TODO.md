# MASTER TO-DO & ROADMAP TACTICO — NEON PULSE
### Hoja de Ruta Viva y Backlog de Tareas hacia la Primera Version Publica (v1.0)

> **Proposito de este documento:**
> Este archivo es el **tablero de control operativo y backlog vivo** del proyecto. A diferencia de `Informe.md` (que es el manifiesto filosofico, conceptual y arquitectural de alto nivel), este documento desglosa **cada tarea tecnica, logica pendiente, mejora de UX, funcionalidad del editor y meta futura** con granularidad tactica.
> 
> Debe mantenerse actualizado en cada iteracion y conservarse versionado en el repositorio.

---

## Convencion de Estados y Prioridades

- `[x]` **Completado**: Implementado, probado y verificado en la rama principal.
- `[-]` **En Progreso / Siguiente**: Foco activo de trabajo o siguiente paso inmediato.
- `[ ]` **Pendiente**: Planificado para su respectiva fase o iteracion.

### Niveles de Prioridad
- **[P0 - Critico / Bloqueante]**: Esencial para la estabilidad del juego, la arquitectura base o la experiencia esencial.
- **[P1 - Alta]**: Funcionalidades nucleares requeridas antes del despliegue o beta publica.
- **[P2 - Media]**: Mejoras de calidad de vida, herramientas del editor y pulido de interaccion.
- **[P3 - Deseable / Expansion]**: Caracteristicas avanzadas, modos secundarios y mejoras cosmeticas.

---

## 1. Estado Actual: Fases Completadas (0 a 5)

- [x] **Fase 0 — Concepto y Arquitectura Base**
  - [x] Contratos desacoplados (`TimeSource`, `Transport`, `GameplayEventBus`).
  - [x] Sincronizacion Web Audio API como reloj maestro (`currentTime`) y PixiJS Ticker para rendering.
  - [x] Desacoplamiento estricto de identidad en `SceneGraph` (`uid` inmutable, `name` legible, `targetId` numerico).

- [x] **Fase 1 — Core Gameplay Engine**
  - [x] Deteccion precisa de pulsacion y ventanas de tiempo (Perfect: ±45ms, Good: ±90ms, Miss: ±150ms).
  - [x] Sistema de puntuacion base, racha de combo acumulativo y multiplicador dinamico (1x, 2x, 4x, 8x).
  - [x] Sintetizador procedural integrado (Kick, Snare, Hi-Hat, Bass, Lead) para juego con cero assets externos.
  - [x] 4 pads sonoros semanticos (`pad_0` a `pad_3`) y 4 comportamientos (`tap`, `hold`, `loop`, `trigger`).

- [x] **Fase 2 — Visual Engine y Reactividad**
  - [x] Grafo de escena jerarquico (`SceneGraph`) con transformaciones heredadas (posicion, rotacion, escala, opacidad).
  - [x] Modulacion reactiva FFT en tiempo real (`AudioMapping`: `bass`, `mids`, `treble`, `ambient`).
  - [x] Animaciones interpoladas (`Animator`) y disparadores de eventos visuales (`TriggerDispatcher`).
  - [x] Shaders GLSL para aberracion cromatica RGB y bloom post-processing; emisor de particulas `ParticlePool`.

- [x] **Fase 3 — Level Editor Interno**
  - [x] Linea de tiempo multi-pista estilo DAW con snapping musical (1/1 a 1/16 y libre) y scroll sincronizado.
  - [x] Herramientas interactivas con atajos rapidos (V: Seleccion, B: Lapiz/Creacion, E: Borrador).
  - [x] Pila de historial Undo/Redo (Ctrl+Z / Ctrl+Y) de hasta 50 estados.
  - [x] Modo de grabacion en vivo (Live Recording) mediante pulsaciones sobre los pads.
  - [x] Scene Outliner e Inspector de Propiedades contextual con validacion de color hex en vivo.

- [x] **Fase 4 — Player Standalone y Content Runtime**
  - [x] Reproductor independiente a resolucion logica fija 1920x1080 con letterboxing automatico responsivo.
  - [x] Flujo de prueba continuo Editor <-> Standalone Player mediante el boton `PLAYTEST`.
  - [x] Sistema de pausa inmediata via tecla `Escape` con congelamiento de audio y modales interactivos.
  - [x] HUD de rendimiento en tiempo real (barra de progreso, tiempo restante, combo animado, precision %).
  - [x] Pantalla de resultados (`ResultsModal`) con calificaciones (SS, S, A, B, C, D) y desglose de juicios.

- [x] **Fase 5 — Content Pipeline y Gestion de Assets**
  - [x] `SongRegistry` activo con almacenamiento en memoria RAM de `AudioBuffer` decodificados.
  - [x] Reutilizacion instantanea de buffers (0ms de overhead) al cambiar de dificultad o reiniciar pistas.
  - [x] Validador profundo de esquemas y sanitizador de niveles (`LevelValidator`).
  - [x] Soporte multi-dificultad nativo (`LevelPackage`: Easy, Normal, Hard) compartiendo la misma pista.
  - [x] Generacion de beatmaps adaptados por dificultad con escalas de ventanas de tiempo proporcionales.
  - [x] Frontend de inicio actualizado con selector de dificultad, monitor de RAM y alerta de errores de validacion JSON.

---

## 2. Logica de Gameplay y Reglas Pendientes

Cuestiones logicas del gameplay y del motor que han quedado en segundo plano y requieren atencion:

- [ ] **[P1] Deteccion y Bonificacion de PerformancePhrase**
  - El contrato `PerformancePhrase` ya existe en `types.ts`, pero `GameplayEngine.ts` aun no rastrea si una frase musical se completo sin fallos.
  - *Accion:* Emitir `PHRASE_COMPLETED` en `GameplayEventBus` al clavar una secuencia de notas, otorgando un bono sustancial de puntaje y un flash visual especial en el HUD.

- [ ] **[P1] Logica de Ticks Intermedios para Notas Sostenidas (Hold Ticks)**
  - Actualmente, un evento `hold` verifica inicio y final, pero no recompensa mantener la presion frame a frame.
  - *Accion:* Generar micro-ticks ritmicos cada 1/8 o 1/16 de compas durante la duracion del hold que sumen puntos continuos y alimenten la racha de combo.

- [ ] **[P3] Asistente Interactivo de Calibracion de Latencia (Audio/Visual Offset Wizard)**
  - Jugadores con auriculares Bluetooth o monitores de diferente tasa de refresco experimentan desfases de entre 20ms y 150ms.
  - *Accion:* Crear una pantalla de calibracion accesible desde Settings con un metronomo sonoro interactivo donde el usuario presione una tecla al ritmo durante 8 compases para calcular automaticamente el `audioOffset` y `visualOffset` local.

- [x] **[P1] Remapeo Dinamico de Controles (Keybinding Remapper)**
  - Las teclas físicas del jugador están completamente desacopladas de la configuración del nivel (`Keybindings.ts`).
  - Mapeo dinámico y persistente en `localStorage` (`wings_stroke_keybindings`) con soporte para teclas no alfabéticas (Espacio, Flechas, Dígitos, etc.), modal interactivo global en el Menú Principal (`KeybindingsModal`), resolución automática de colisiones con intercambio (swap) y visualización desacoplada de solo lectura en el editor (`SongPadsModal`).

- [ ] **[P2] Modificadores de Juego (Gameplay Modifiers)**
  - Permitir a los jugadores personalizar el desafio antes de iniciar:
    - *Velocidad:* 0.75x, 1.0x, 1.25x, 1.5x, 2.0x (modificando BPM o audio rate).
    - *Modo Auto:* Bot que reproduce la cancion en automatico para previsualizacion.
    - *Modo Espejo (Mirror):* Invierte el mapeo de pads (`pad_0` <-> `pad_3`, `pad_1` <-> `pad_2`).
    - *Modo Fade In / Sudden:* Las notas aparecen o desaparecen a mitad de camino.

- [ ] **[P2] Barra de Vida / Energia Opcional (Life Bar / Gauge)**
  - Modo estricto donde los fallos (`miss`) drenan una barra de energia y un 0% provoca Game Over, diferenciado del modo practica actual.

- [ ] **[P2] Scoring Avanzado y Persistencia Local de Records**
  - Guardar las mejores puntuaciones, precisiones y rangos (SS/S/A...) en `localStorage` indexados por `levelId + difficulty`.
  - Mostrar badge de "Nuevo Record" en la pantalla de resultados.

---

## 3. Pendientes del Editor de Niveles: Bloque de Edicion por Lotes (Siguiente Paso Inmediato)

Suite de herramientas de productividad y edicion por lotes requerida para desbloquear la creacion ergonomica de beatmaps reales:

- [x] **[P0] Visualizacion de la Forma de Onda de Audio (Audio Waveform Display)**
  - Dibujar la grafica de la onda de audio directamente de fondo en la linea de tiempo.
  - Permite al creador alinear visualmente los golpes de bateria y transientes acusticos con el snapping de la rejilla.

- [x] **[P0] Selector de Playback Speed**
  - Input numerico estilizado (0.25x a 4.0x) para desacelerar o acelerar la reproduccion durante el mapeo de precision sin cortes de audio.

- [x] **[P0] Bloque de Edicion por Lotes y Productividad (Batch Editing Suite)**
  - [x] **1. Seleccion Multiple y Marquesina (Drag-to-Select):**
    - Migrar el estado en `EditorApp.tsx` y componentes de IDs unicos a conjuntos (`selectedEventIds: Set<string>` y `selectedTriggerIds: Set<string>`).
    - Rectangulo de seleccion elastico translucido en `Timeline.tsx` activado con herramienta de seleccion (V) sobre areas libres, interceptando notas y triggers mediante AABB.
    - Modificadores de teclado: `Ctrl + Clic` (conmutar seleccion individual de elemento) y `Shift + Clic` (seleccion continua de rango temporal).
    - Desplazamiento simultaneo de todo el lote seleccionado cuantizado a la rejilla al arrastrar cualquier elemento del grupo.
  - [x] **2. Portapapeles y Duplicacion (Clipboard Engine):**
    - Copiar, cortar y pegar (`Ctrl+C`, `Ctrl+X`, `Ctrl+V`): Almacenamiento en memoria con distancias temporales relativas al evento mas temprano; pegado cuantizado estampado en el cabezal de reproduccion (`currentTime`).
    - Duplicacion rapida (`Ctrl+D` / `Alt + Arrastre`): Clonacion instantanea del bloque seleccionado colocada inmediatamente a continuacion.
    - Borrado colectivo (`Supr` / `Backspace`): Eliminacion atomica de todo el lote seleccionado en una sola transaccion de historial (`useEditorHistory` / `Ctrl+Z`).
  - [x] **3. Zoom Horizontal Interactivo con Pivote (Dynamic pixelsPerSecond):**
    - Control interactivo mediante atajo `Ctrl + Rueda del raton` en la linea de tiempo y deslizador continuo en barra de herramientas.
    - Rango operativo expandido: desde escala macro (~40 px/s para vision panoramica de la cancion completa) hasta escala quirurgica (~350 px/s para microtransientes en 1/16 y 1/32).
    - Zoom anclado al cabezal de reproduccion (playhead): Conservacion automatica de la posicion en pantalla del cursor al escalar con rueda, botones de zoom (+ / -), slider de escala o atajos de teclado (`Ctrl + =` / `Ctrl + -`), evitando la perdida de contexto visual.

- [ ] **[P3] Guardado Automatico en localStorage (Auto-Save Recovery)**
  - Guardar el estado del nivel cada 30 segundos en el almacenamiento local para prevenir perdida accidental de trabajo.

- [ ] **[P4] Pistas de Automatizacion de BPM y Cambios de Compas**
  - Soporte para canciones con cambios de tempo (tempo ramps) o firmas de compas variables (3/4, 6/8).

---

## 4. Fase 6 — Optimizacion y Pulido de Motor (En Progreso)

Foco en rendimiento sostenido a 60+ FPS, estabilidad termica y ergonomia:

- [x] **[P0] Object Pooling Intensivo en PixiJS (NotePool & Offset de Cancion)**
  - Pre-asignacion estatica de notas (`NotePool` con 150 instancias iniciales en neutral white geometry y reuso via `.tint`).
  - Eliminacion total de `new Graphics()` y `gfx.destroy()` por frame; recoleccion de basura minimizada (0 GC stutter en beatmaps densos de ~1,000 notas).
  - Busqueda binaria O(log N) / ventana deslizante en `VisualEngine` aprovechando el orden cronologico de eventos.
  - Unificacion matematica del offset de cancion (`songTime = audioTime - offset`) en `VisualEngine` y `GameplayEngine`.
  - Calibrador interactivo de offset en milisegundos con botones de paso (±1ms, ±10ms) en `SongPadsModal`.

- [x] **[P0] Pre-programacion de Audio Lead-In (Cero Microtirones de FPS)**
  - Pre-programacion por hardware en Web Audio API (`bufferSource.start(scheduledStart, offset)`) calculando `scheduledStart = ctx.currentTime + (leadIn / playbackSpeed)`.
  - Eliminacion del microtirón de fotogramas al cruzar `t = 0`: reloj temporal continuo con valores negativos (`-leadIn` hasta `0.0s`) sin re-instanciaciones en el hilo principal ni esperas sincrónicas.
  - Desplazamiento visual proporcional en la Timeline (`songOrigin = leadIn + offset`), regla temporal y forma de onda (`WaveformCanvas`), dejando la zona inicial de silencio preparatorio.

- [x] **[P1] Fades de Audio y Curvas Visuales Estilo Premiere Pro / CapCut**
  - Curvas Bézier acusticas con curvatura logaritmica natural de percepcion auditiva humana en `Timeline.tsx`.
  - Mascaras de atenuacion oscura con trama diagonal vectorial (`#fadeHatchIn`, `#fadeHatchOut`) delimitando con claridad la zona enmudecida sobre la forma de onda.
  - Badges flotantes con efecto glassmorphic (`backdrop-blur-md`), bordes luminosos neón (cian para Fade In, rosa magenta para Fade Out) y marcadores circulares de anclaje (*fade handle pips*).
  - Rampas lineales y continuas de ganancia Web Audio integradas en `AudioEngine` y preservadas tras pausas y scrubbing.

- [x] **[P1] Despeje de Interfaz del Editor (UI Declutter & Settings Modal)**
  - Reemplazo de botones fijos en la cabecera por boton de configuracion (engranaje sin titulo) en la esquina superior derecha.
  - Menu flotante desplegable con animacion escalonada / cascada (staggered delay).
  - Reubicacion de PLAYTEST en el menu de ajustes (con atajo global F5 / Ctrl+Enter).
  - Nuevo modal centralizado `SongPadsModal` para configuracion de pista (metadata, BPM, duracion, offset, lead-in, fade in/out) y matriz de pads (color, atajo de teclado, canal de audio, rol semantico).
  - Limpieza de la barra lateral izquierda (`EditorSidebarLeft`), dedicada al 100% al `SceneOutliner`.

- [x] **[P0] Centralizacion de Conversiones Temporales (timeUtils.ts)**
  - Módulo matemático unificado para `audioTimeToSongTime`, `songTimeToAudioTime`, `timelineTimeToSongTime`, `songTimeToTimelineX` y `timelineXToSongTime`.
  - Erradicación de fórmulas manuales duplicadas entre GameplayEngine, VisualEngine, Timeline y useEditorEngine.

- [x] **[P0] Estabilidad de Identidad en NotePool (event.id)**
  - Migración de la clave de almacenamiento interno de instancias de objetos a `event.id: string`, garantizando persistencia estable del pool ante clones, undo/redo y re-renders.

- [x] **[P1] Auto-Guardado y Recuperacion de Sesion (useAutoSave.ts)**
  - Persistencia debounced (1200ms) de borradores en `localStorage` (`wings_stroke_editor_draft`).
  - Banner superior glassmórfico de recuperación ante recargas accidentales con opciones de Restaurar y Descartar.

- [x] **[P1] Asignacion Explicita de Triggers en Grabacion y Timeline**
  - Eliminación de la asignación ciega implícita a `triggers[0]`.
  - Soporte de eventos trigger sin asignar con distintivo visual ámbar `UNASSIGNED` y selección explícita.

- [x] **[P2] Congelacion Formal de Semantica LOOP**
  - Congelación de ampliaciones de código para `loop` hasta contar con validación y especificación de diseño de gameplay en pistas reales.

- [ ] **[P1] Perfiles de Calidad Grafica Adaptativa**
  - Selector en ajustes: *Baja, Media, Alta, Ultra*.
  - Opciones para conmutar shaders pesados (Bloom, Aberracion RGB), densidad de particulas y antialiasing para garantizar 60 FPS en laptops modestas o navegadores moviles.

- [ ] **[P1] Web Worker para Procesamiento Asincrono**
  - Mover la validacion de archivos JSON pesados, calculo de formas de onda y parsing de niveles a un Web Worker separado para que la UI nunca se congele.

- [ ] **[P2] Auditoria de Fugas de Memoria (Memory Leak Prevention)**
  - Profiling de listeners de eventos en la transicion repetida entre Editor <-> Standalone Player.
  - Confirmar que `AudioTransport`, `PixiJS Application` y `AudioContext` liberen el 100% de memoria al cambiar de pantalla.

---

## 5. Fase 6B — Consolidacion de Autoria Visual (Beta del Editor)

- [x] **[P0] Fase 6B.1 — Nucleo de Autoria Visual y Bounding Box (Completado)**
  - [x] **Overlay Indicador (Bounding Box) en Canvas:**
    - [x] Contenedor de herramientas `editorOverlayContainer` (zIndex 99) desacoplado del runtime del juego.
    - [x] Caja delimitadora con linea discontinua cian `#00e5ff` adaptada al bounding box global del nodo seleccionado.
    - [x] Cuatro anclas en esquinas (`corner anchors`) y punto pivote central para referencia espacial.
    - [x] Actualizacion por frame y sincronizacion bidireccional via `setSelectedNode(nodeId)`.
  - [x] **Modelo de Capas Escenicas y Salvaguarda de Legibilidad:**
    - [x] Sistema de 2 capas escenicas fijas: `sceneBackgroundLayer` (zIndex 2) y `sceneForegroundLayer` (zIndex 22).
    - [x] Salvaguarda de legibilidad en `LevelValidator`: restriccion forzada de opacidad (`alpha <= 0.35`) y blendMode (`add` o `screen`) para elementos en primer plano (`sceneFront`).
  - [x] **Vida Util Temporal (`SceneNodeLifespan`):**
    - [x] Extension del esquema de `SceneNodeData` con `lifespan` (`startTime`, `duration`, `fadeInMs`, `fadeOutMs`).
    - [x] Evaluacion y modulacion de opacidad/visibilidad temporal en cada frame en `VisualEngine`.
  - [x] **Pista de Timeline para Objetos Visuales:**
    - [x] Carril dedicado `SCENE OBJECTS & LIFESPAN` en `Timeline.tsx` con bloques horizontales de duracion.
    - [x] Insignias de capa (`BACK` verde esmeralda / `FRONT` cian) y rampas visuales de fade in/out.
    - [x] Arrastre interactivo en la linea de tiempo: mover tiempo de inicio (`startTime`) y redimensionar duracion (`duration`).
  - [x] **Inspector de Propiedades y Outliner:**
    - [x] Selector de capa (`Background` / `Foreground`) y toggle/campos numericos de lifespan en `EditorPropertiesPanel`.
    - [x] Limitacion interactiva de opacidad a 0.35 y filtrado de modos de fusion en modo primer plano.
    - [x] Insignias de capa integradas en la lista del `SceneOutliner`.

- [x] **[P1] Fase 6B.2 — Transformacion Interactiva y Modulacion Dinamica**
  - [x] Arrastre interactivo en canvas (`TransformGizmo`): mover por posicion X/Y arrastrando la caja y redimensionar/escalar mediante 8 tiradores con Oriented Bounding Box (OBB) en objetos rotados.
  - [x] Multi-seleccion de nodos escenicos en outliner y canvas con caja delimitadora combinada (AABB).
  - [ ] Snapping opcional a la cuadricula espacial (e.g. 16px, 32px, centros de pantalla).

---

## 6. Pipeline de Contenido y Empaquetado Avanzado

- [ ] **[P1] Formato de Archivo Unificado .rhythm / .zip**
  - Empaquetador que comprima: `level.json` + `audio.mp3` + `cover.png` + `background.png` en un solo archivo descargable y cargable con drag & drop directo en la ventana del navegador.

- [ ] **[P2] Generador Asistido de Beatmaps por Deteccion de Transientes (Onset Detection)**
  - Analizar cualquier cancion subida por el usuario mediante FFT en el cliente, detectar los transientes de percusion y generar una propuesta inicial de notas en Easy/Normal/Hard para editar sobre ella.

---

## 7. Fase 7 — Infraestructura Online y Backend (Hacia la Primera Beta)

- [ ] **[P1] Base de Datos y Autenticacion con Supabase**
  - Inicio de sesion con correo o proveedores OAuth (Discord / Google).
  - Tabla de perfiles de jugador: avatar, nivel de experiencia, puntuacion total acumulada.

- [ ] **[P2] Tablas de Clasificacion Globales (Global & Difficulty Leaderboards)**
  - Registro del Top 50 mundial por cancion y por dificultad (Easy, Normal, Hard).
  - Envio seguro de puntajes con verificacion basica de integridad (hash/checksum del replay para evitar trampas).

- [ ] **[P3] Guardado en la Nube de Niveles Propios (Cloud Saves)**
  - Guardar y sincronizar beatmaps creados en el editor en la nube del usuario para continuar editando desde cualquier equipo.

---

## 8. Fase 8 — Multijugador, Repeticiones y Comunidad

- [ ] **[P1] Sistema de Repeticiones (Replay System)**
  - Grabar la lista de entradas del jugador (`time`, `padId`, `action`) durante una partida.
  - Permitir guardar el replay junto al puntaje y reproducir la partida exacta desde la pantalla de resultados o leaderboards.

- [ ] **[P3] Modo Collab en Tiempo Real**
  - Dos jugadores interpretan la misma canción en simultaneo con WebSockets / WebRTC.

- [ ] **[P3] Modo Mashup Cooperativo**
  - Dos jugadores con Launchpads independientes interpretan secciones complementarias (e.g. Jugador 1: Percusion/Bajos; Jugador 2: Melodias/Sintetizadores) sobre una pista combinada.

- [ ] **[P4] Navegador y Catalogo Comunitario (Community Song Hub)**
  - Explorador dentro del juego para buscar, escuchar fragmentos, descargar y votar canciones creadas por la comunidad.

---

## 9. Banco de Ideas Creativas (Equipo y Antigravity)

Ideas y conceptos complementarios para evaluar durante el desarrollo:

1. **Rutas Visuales y Laseres de Carril (Lane Lasers)**:
   - Lineas de luz que se proyectan desde los pads hacia el centro de la pantalla al compas de la musica, reaccionando a los bombos con pulsos de neon.
2. **Efectos de Particulas Tematicas**:
   - Selector de estilo de particulas al acertar notas (Chispas electricas, Polvo estelar neon, Anillos de distorsion sonica).
3. **Modo Practica con Repeticion de Compases (A-B Loop Practice Mode)**:
   - En el editor o antes de jugar, marcar un punto A y un punto B para practicar una seccion dificil en bucle infinito con velocidad graduable.
4. **Retroalimentacion Haptica (Gamepad & Mobile Vibration)**:
   - Soporte para la Vibration API del navegador en telefonos y gamepads (vibracion sutil y punchy al acertar `Perfect` o clavar un bombo).
5. **Modo Zen / Modo Auto-Visualizer**:
   - Un modo sin HUD ni juicios donde la cancion suena, las notas se tocan solas y la pantalla se convierte en un visualizador musical interactivo para relajarse o proyectar en fiestas.

---

## 10. Registro de Decisiones de Diseno Vigentes

1. **Idioma de la Experiencia (Language Standard):**
   - Frontend del usuario (menus, botones, HUD, modales, alertas): **100% Ingles nativo**.
   - Comunicacion de equipo, roadmap, `Informe.md`, `TODO.md` y mensajes de commit de git: **100% Espanol**.
   - Documentacion tecnica del codigo y contratos JSDoc: **100% Ingles**.
2. **Politica Estricta de No-Emojis (No-Emoji Standard):**
   - Queda estrictamente prohibido el uso de emojis en cualquier archivo del proyecto (codigo, documentacion, tareas, UI o mensajes de commit). El formato debe ser sobrio, profesional y limpio.
3. **Arquitectura de Identidades:**
   - `uid`: Clave interna inmutable y unica de cada nodo escenico.
   - `name`: Nombre descriptivo legible por humanos en el outliner.
   - `targetId`: Identificador numerico para agrupacion de triggers y FX visuales.
4. **Sincronizacion:**
   - La fuente unica de tiempo es el reloj de audio (`AudioContext.currentTime`). Ningun calculo de gameplay se basa en el numero de frames de renderizado.
5. **Politica de Git:**
   - Cada conjunto de cambios funcionales debe confirmarse en git inmediatamente tras verificar `npx tsc -b`.
   - `git push` y `npm run dev` nunca deben ejecutarse mediante agentes automatizados; son controlados por el propietario del repositorio.

## 11. Visualizadores de Espectro de Audio (Audio Spectrum & Decorative Vectors)
- [x] **Procesamiento y Balistica Espectral:**
  - [x] Agrupar datos FFT del `spectrumAnalyser` (512-fft) en bandas logaritmicas (8 a 64 bandas) cubriendo sub-graves, medios y agudos en escala musical.
  - [x] Sincronizacion dinamica de frecuencia de muestreo del hardware (`sampleRate` 44.1kHz / 48kHz).
  - [x] Integrar balistica asimetrica configurable (attack rapido con decay exponencial suave) y factor de ganancia.
- [x] **Integracion en SceneGraph como `SceneNode`:**
  - [x] Tipo de nodo declarativo (`'audioSpectrum'`) configurable desde `level.visual.nodes`.
  - [x] Renderizado en capas decorativas respetando la jerarquia estricta de capas (`zIndex`).
  - [x] Soporte para transformaciones nativas heredadas (posicion X/Y, rotacion, escala, opacidad) y OBB en el editor.
- [x] **Renderizado Eficiente en PixiJS (WebGL):**
  - [x] Modo barras: Renderizado vectorial agrupado mediante `PIXI.Graphics` con batching automatico por hardware de PixiJS v8. (Migracion opcional a `SimpleMesh` documentada para resoluciones masivas de 128+ bandas).
  - [x] Modo curva / onda y modo radial circular decorativo.
  - [x] Configuracion de modos de fusion y paleta de color.
- [x] **Control por Triggers y Editor:**
  - [x] Exponer propiedades en `EditorPropertiesPanel` (numero de bandas, modo, ancho, alto, gap, color, attack, decay, gain).
  - [x] Indice cacheado en `SceneGraph` (`spectrumNodes`) y captura FFT unica por fotograma en `VisualEngine`.
  - [x] Enrutamiento en serie en Web Audio (`masterGain -> spectrumAnalyser -> analyser -> destination`) para garantizar el procesamiento continuo por el AudioDestinationNode.
  - [x] Sincronizacion reactiva entre `AudioTransport.audioEngine` y `VisualEngine` en todas las etapas del editor y runtime standalone.
  - [x] Omision del bin 0 (DC offset) y decaimiento fluido hacia curva de reposo estetica.
  - [x] Estandarizacion del `EditorSetupWizard` con inicializacion de linea de tiempo limpia (`events: []`).
