# Documento de visión y dirección del proyecto

## 1. Descripción general

Este proyecto consiste en el desarrollo de un videojuego de ritmo 2D para navegador, centrado en la interacción con una serie de plataformas o “Launchpads” que representan diferentes funciones sonoras dentro de una composición musical.

La idea parte de una reinterpretación del género de juegos musicales basados en sincronización, combinando conceptos conocidos de títulos como Piano Tiles, OSU!mania o Guitar Hero con una filosofía visual y de creación de contenido inspirada especialmente en la libertad de efectos y eventos que caracteriza a los niveles avanzados de Geometry Dash.

Sin embargo, el objetivo no es crear un clon de ninguno de estos juegos. La intención es construir una experiencia propia, cuya identidad se encuentre principalmente en tres elementos:

1. La interacción mediante Launchpads.
2. La sincronización precisa entre música, gameplay y efectos visuales.
3. Un sistema visual y de creación de niveles suficientemente flexible como para permitir experiencias audiovisuales altamente personalizadas.

El proyecto debe entenderse, por tanto, no simplemente como “un juego de notas que caen”, sino como el desarrollo progresivo de un pequeño motor de ritmo y presentación audiovisual capaz de ejecutar niveles definidos mediante datos.

El prototipo actual constituye la primera validación de esta idea. Su función no es representar el producto final, sino demostrar que las bases técnicas y jugables son viables. Actualmente el repositorio ya está organizado alrededor de un núcleo de engine separado de la interfaz, con módulos específicos para audio, entrada, gameplay, visualización y datos de niveles.

## 2. Filosofía del proyecto

La filosofía principal del proyecto es que la música debe sentirse, no solamente escucharse.

El jugador no debería limitarse a reaccionar ante elementos gráficos; debe percibir una relación directa entre la música, sus acciones y el comportamiento visual del escenario.

Cada pulsación debe producir una respuesta inmediata y coherente. Del mismo modo, el entorno debe ser capaz de reaccionar a los acontecimientos musicales: golpes de batería, cambios de intensidad, secciones de una canción, transiciones, combinaciones de notas o acciones realizadas por el jugador.

Esto conduce a una segunda idea fundamental: los sistemas deben estar diseñados para trabajar en conjunto.

El audio no debe ser un elemento independiente del gameplay. El gameplay no debe estar desconectado de las animaciones. Las animaciones no deben depender de valores escritos directamente en el código de una escena concreta.

La arquitectura debe permitir que una misma señal pueda atravesar diferentes sistemas.

Por ejemplo:

una canción aumenta su intensidad → aumenta la energía de las frecuencias graves → cambia una señal de audio → esa señal afecta el brillo de determinados objetos → los objetos incrementan su escala o intensidad → se generan partículas → el escenario cambia de apariencia.

Esta filosofía conduce hacia un sistema donde la música puede controlar visualmente el nivel y donde el diseñador tiene capacidad para decidir qué señales provocan qué efectos.

## 3. Prioridades fundamentales

Cuando exista un conflicto entre características del proyecto, las prioridades serán las siguientes:

**Gameplay > sincronización > legibilidad > efectos visuales.**

La espectacularidad visual nunca debe perjudicar la jugabilidad.

Un efecto que produzca una escena impresionante pero dificulte identificar una nota, genere retraso perceptible, reduzca la precisión de las pulsaciones o provoque una caída importante de rendimiento debe considerarse un efecto mal implementado.

La calidad del proyecto no se medirá por la cantidad de efectos utilizados, sino por la capacidad de integrarlos sin comprometer la experiencia principal.

El rendimiento también forma parte del diseño. El objetivo es que el juego pueda ejecutarse de forma fluida a 60 FPS como mínimo y pueda aprovechar tasas de refresco superiores cuando el hardware y el navegador lo permitan.

## 4. Concepto de gameplay

La experiencia básica consiste en observar notas que se desplazan hacia una zona de interacción asociada a un conjunto de Launchpads.

El jugador debe pulsar el Launchpad correspondiente en el momento adecuado.

Cada pad representa una función o identidad sonora, no una nota musical o una altura determinada.

Por ejemplo, un nivel podría utilizar cuatro pads configurados como:

* Kick
* Drums
* Bass
* Melody

Otro nivel podría definir:

* Kick
* Snare
* Synth
* Vocal

La identidad de los pads pertenece al nivel y no al código del juego.

Esto es importante porque un pad no representa necesariamente una frecuencia o una nota musical. Representa una función dentro de la composición o del diseño del nivel.

Por esa razón, un mismo pad puede utilizarse para diferentes sonidos o muestras según el contenido de la canción.

El prototipo inicial utiliza cuatro pads, pero el engine no debe considerarlos una limitación permanente. El sistema está concebido para poder trabajar posteriormente con diferentes cantidades de pads según el nivel.

## 5. Diferencia frente a los juegos de piano tradicionales

La propuesta busca alejarse de la lógica de “cada tecla representa una nota distinta”.

En un sistema tradicional, la dificultad puede surgir de la necesidad de distinguir numerosas posiciones individuales y asociarlas con notas musicales específicas.

Aquí el foco está en la relación:

**función sonora → pad → momento de interacción.**

Esto permite que un jugador pueda desarrollar una memoria visual y musical relacionada con funciones de la canción.

Además, abre posibilidades para diseñar niveles donde la dificultad no dependa solamente de la velocidad de aparición de las notas, sino también de la estructura musical, los patrones, la anticipación y la distribución de responsabilidades entre diferentes pads.

## 6. Sistema de sincronización

La sincronización es uno de los componentes más importantes de todo el proyecto.

El tiempo musical no debe depender del número de frames renderizados por segundo.

El prototipo actual ya adopta esta filosofía: el renderizado utiliza el ticker de PixiJS, pero las referencias temporales del juego se basan en `AudioContext.currentTime`. De esta manera, el cálculo del gameplay y la detección de impactos no dependen directamente del frame rate.

Este principio debe mantenerse durante toda la evolución del proyecto.

La arquitectura conceptual es:

**Audio Clock → Timing Engine → Gameplay / Visuals / Events**

El navegador puede renderizar a 60, 120 o 144 FPS, pero la posición lógica de una nota debe derivarse del tiempo musical real.

Esto es fundamental porque en un juego de ritmo unos pocos milisegundos pueden afectar la percepción de precisión.

## 7. Arquitectura general

El proyecto debe evolucionar hacia una arquitectura modular basada en diferentes subsistemas.

La estructura conceptual prevista es:

**Rhythm Engine**

* Audio Engine
* Timing Engine
* Beatmap System
* Input System
* Gameplay Engine
* Visual Engine
* Score System
* Content System

El prototipo actual ya representa parte de esta separación mediante `AudioEngine`, `InputManager`, `GameplayEngine`, `VisualEngine` y el sistema de datos de niveles. La clase `Game` funciona como orquestador principal entre estos módulos.

El objetivo no es crear una arquitectura excesivamente compleja. La modularidad debe existir porque resuelve problemas reales de evolución y mantenimiento, no por razones puramente académicas.

## 8. Tecnologías principales

La tecnología prevista para la primera etapa del proyecto es:

**TypeScript**

Será el lenguaje principal del engine. Su tipado ayudará a mantener consistencia entre los sistemas de gameplay, audio, niveles y herramientas de creación.

**Vite**

Será utilizado como sistema de desarrollo y construcción del proyecto web.

**PixiJS**

Será la principal tecnología de renderizado 2D.

PixiJS resulta apropiado porque permite construir una escena 2D acelerada por GPU y ofrece una abstracción útil sobre WebGL, manteniendo suficiente control para implementar un sistema visual personalizado.

El prototipo actual utiliza PixiJS 8.20.1.

**Web Audio API**

Será el núcleo del sistema de audio y del reloj temporal.

También permitirá utilizar análisis de frecuencia en tiempo real mediante `AnalyserNode` y FFT.

El prototipo actual ya cuenta con análisis de bandas de frecuencia para graves, medios, agudos y amplitud.

**GLSL / shaders**

Los efectos visuales avanzados podrán utilizar shaders para distorsión, separación RGB, ondas, ruido, glow y otras transformaciones.

**React**

React puede utilizarse para interfaces tradicionales como menús, configuración, pantallas de resultados y eventualmente herramientas de edición.

No debe convertirse en el motor del gameplay ni utilizarse para gestionar cada frame del juego.

**HTML/CSS**

Se reservarán principalmente para UI, menús, HUD y elementos de interfaz que no requieran formar parte del pipeline gráfico principal.

## 9. Sistema de entrada

El sistema de entrada debe mantenerse abstraído.

El engine no debería conocer directamente que el jugador pulsó la tecla “A”.

Debería recibir algo conceptualmente equivalente a:

**Pad 0 → pressed**

El prototipo actual ya implementa esta idea mediante `InputManager`: las teclas físicas se convierten en eventos identificados por `PadId`, permitiendo que posteriormente otras fuentes como touch o gamepad utilicen el mismo sistema.

Esta decisión permitirá soportar progresivamente:

* teclado
* mouse
* touch
* gamepad
* posibles dispositivos físicos

sin modificar el núcleo del gameplay.

## 10. Modelo de datos de los niveles

Los niveles deben ser tratados como datos y no como escenas codificadas manualmente.

La idea fundamental es:

**El nivel describe QUÉ debe ocurrir.
El engine decide CÓMO representarlo.**

Actualmente `LevelData` ya separa información de la canción, pads, notas, metadatos y ventanas de timing. El sistema también utiliza identificadores genéricos de pads y tipos de nota extensibles.

En una versión futura, un beatmap podrá evolucionar hacia algo conceptualmente similar a:

```text
metadata
song
pads
timing
notes
objects
groups
triggers
animations
audioMappings
```

Esto permitirá que un nivel no sea solamente una secuencia de notas, sino una composición audiovisual completa.

## 11. Canción y nivel

La canción y el nivel deben considerarse conceptos diferentes.

Una canción contiene principalmente:

* audio
* título
* artista
* BPM
* duración
* información de origen
* información de licencia

El nivel contiene:

* notas
* dificultad
* distribución de pads
* timings
* eventos visuales
* objetos
* animaciones
* triggers
* configuración audiovisual

Una misma canción podría tener varios niveles diferentes.

Esto también permitirá que una misma pista sea interpretada con distintas dificultades, estilos visuales o patrones.

## 12. Sistema de notas

Una nota debe representar una interacción concreta del jugador.

La información mínima esperada incluye:

* timestamp
* pad objetivo
* tipo de nota
* duración cuando sea necesario
* metadatos extensibles

El prototipo actual contempla notas `tap` y `hold`, dejando abierta la incorporación posterior de otros tipos.

Entre los tipos futuros podrían existir:

* Tap
* Hold
* Release
* Special
* Multi
* Long
* Pattern

No es necesario implementar todos desde el comienzo.

## 13. Sistema de puntuación y precisión

El juego debe evaluar la diferencia entre:

**momento de pulsación - momento esperado.**

El resultado se clasifica mediante ventanas de timing.

El prototipo actual utiliza:

* Perfect
* Good
* Miss

y mantiene información de puntuación, combo, combo máximo y cantidades de impactos de cada categoría.

A futuro el sistema puede evolucionar para soportar:

* diferentes sistemas de puntuación
* multiplicadores
* precisión porcentual
* estadísticas detalladas
* rankings
* modificaciones según dificultad

## 14. Dificultad

El BPM de la canción no define por sí mismo la dificultad.

Dos niveles con el mismo BPM pueden presentar dificultades completamente diferentes.

La dificultad debe considerar variables como:

* densidad de notas
* velocidad
* cambios frecuentes de pad
* patrones
* sincronización
* anticipación
* notas simultáneas
* complejidad visual
* duración de secuencias
* exigencia de diferentes funciones musicales

Esto permitirá desarrollar dificultades reales en lugar de utilizar solamente un multiplicador de velocidad.

## 15. Visual Engine

La parte visual es uno de los elementos centrales que pueden diferenciar al proyecto.

La intención es construir un sistema de visualización data-driven capaz de representar un escenario dinámico y reactivo.

El prototipo actual ya posee diferentes capas visuales para fondo, notas, partículas, pads y efectos, además de sistemas de reacción basados en FFT.

A largo plazo, el Visual Engine deberá evolucionar hacia un sistema compuesto por:

**Scene Graph
Object System
Group System
Animation System
Trigger System
Particle System
Shader System
Audio Modulation
Post Processing**

La finalidad es que los niveles puedan controlar estos elementos sin que cada comportamiento deba programarse manualmente.

## 16. Objetos visuales

El motor deberá soportar progresivamente diferentes tipos de objetos:

* Sprite
* Rectangle
* Circle
* Polygon
* Line
* Text
* Pad
* ParticleEmitter
* CustomObject

Los objetos deberán compartir propiedades comunes como:

* posición
* rotación
* escala
* opacidad
* color
* visibilidad

Posteriormente podrán incorporarse propiedades adicionales como:

* intensidad
* blur
* glow
* parámetros de shader
* distorsión
* profundidad lógica
* blend mode

## 17. Grupos y jerarquías

Los objetos deben poder pertenecer a grupos.

Esto permite aplicar una transformación a muchos elementos simultáneamente.

Por ejemplo:

un grupo puede contener veinte objetos;

el nivel puede mover el grupo completo;

posteriormente puede rotarlo;

después modificar su escala;

y finalmente cambiar su opacidad.

Esto evita la necesidad de controlar cada objeto individualmente y permite construir estructuras visuales complejas de forma relativamente sencilla.

La idea está inspirada conceptualmente en los sistemas de objetos y triggers de editores de niveles avanzados, pero la implementación será propia.

## 18. Animaciones

Las propiedades visuales deberán ser animables mediante keyframes.

Conceptualmente:

```text
tiempo 0.0 → escala 1.0
tiempo 0.5 → escala 1.3
tiempo 1.0 → escala 1.0
```

El motor interpolará los valores utilizando funciones de easing.

Inicialmente puede bastar con:

* Linear
* Ease In
* Ease Out
* Ease In Out

El sistema puede ampliarse cuando las necesidades reales del editor lo justifiquen.

## 19. Sistema de triggers

Los triggers constituirán uno de los pilares del futuro sistema de creación de niveles.

La arquitectura conceptual será:

**TRIGGER → ACTION → TARGET → PROPERTY / EFFECT**

Un trigger determina cuándo ocurre algo.

Una acción determina qué sucede.

Un target determina a qué objeto o grupo se aplica.

La propiedad o efecto determina qué aspecto cambia.

## 20. Tipos de eventos

Es importante separar los eventos musicales de los eventos de gameplay.

### Eventos musicales

* tiempo absoluto
* beat
* compás
* sección
* entrada de una parte musical
* cambio de intensidad

### Eventos de gameplay

* pad hit
* perfect
* good
* miss
* combo
* combo break
* finalización del nivel

Ambos tipos podrán desencadenar efectos visuales.

Por ejemplo:

```text
Beat → pulso del fondo

Perfect → explosión de partículas

Combo x20 → cambio temporal de iluminación

Sección musical → cambio de paleta

Miss → distorsión breve
```

## 21. Audio-reactividad

Uno de los sistemas visuales más importantes será la relación directa con el audio.

La Web Audio API permite analizar el sonido en tiempo real mediante FFT.

A partir de ese análisis se pueden obtener señales como:

* bass
* mids
* treble
* amplitude
* waveform
* espectro de frecuencias

El prototipo actual ya expone estas bandas y aplica suavizado para evitar cambios visuales excesivamente bruscos.

En el futuro estas señales podrán controlar:

* brillo
* escala
* posición
* partículas
* glow
* color
* shaders
* intensidad de efectos
* deformaciones
* fondos
* postprocesado

Para evitar que cada sistema interprete directamente la señal de audio, será conveniente introducir posteriormente una capa de **Audio Modulation** que permita suavizar, escalar, limitar y transformar señales antes de utilizarlas.

## 22. Shaders y efectos

Los shaders permitirán construir efectos visuales de mayor calidad manteniendo buena eficiencia cuando se utilicen adecuadamente.

Entre los efectos previstos se encuentran:

* Glow
* Bloom
* RGB Split
* Distortion
* Wave
* Noise
* Blur
* Chromatic effects
* Audio reactive effects

Los shaders inicialmente se podrán desarrollar en GLSL.

La arquitectura debe evitar asumir desde el principio que todo tendrá que ejecutarse mediante una tecnología concreta. La posibilidad de incorporar WebGPU posteriormente debe mantenerse abierta, pero no constituye un requisito de la primera versión.

## 23. Postprocesamiento

El pipeline visual podrá evolucionar hacia una estructura semejante a:

```text
Scene
   ↓
Render
   ↓
Brightness extraction
   ↓
Blur
   ↓
Bloom
   ↓
Composite
   ↓
RGB / Distortion
   ↓
Screen
```

No todos los efectos tienen que aplicarse a toda la escena.

Una de las reglas de optimización será utilizar efectos locales cuando sea posible, evitando procesar innecesariamente el frame completo.

## 24. Feedback de los Launchpads

Los pads deben proporcionar retroalimentación audiovisual inmediata.

Cuando el jugador pulsa un pad correctamente, pueden ocurrir simultáneamente:

* cambio de escala
* aumento de brillo
* glow
* partículas
* flash
* animación
* feedback sonoro

Esto refuerza la sensación de conexión entre la acción física y la música.

El feedback debe ocurrir inmediatamente después del input y estar desacoplado del sistema visual mediante eventos del gameplay.

## 25. Editor de niveles

Inicialmente no se contempla publicar un editor para usuarios.

Sin embargo, un editor interno para el equipo sí es una herramienta importante y deberá desarrollarse relativamente temprano.

Esto permitirá crear contenido real para probar el engine.

El editor debería evolucionar para permitir:

* cargar una canción
* reproducir y pausar
* visualizar una timeline
* colocar notas
* seleccionar pads
* ajustar BPM
* configurar offset
* usar snapping
* modificar timing
* crear eventos
* crear objetos visuales
* crear grupos
* editar triggers
* previsualizar el nivel
* exportar el beatmap

## 26. Flujo previsto de creación de niveles

Un método especialmente útil para la autoría será la grabación de inputs reales.

Mientras escucha una canción, el diseñador podría tocar los pads mediante teclado:

```text
A → Pad 0
S → Pad 1
D → Pad 2
F → Pad 3
```

El editor registraría el timestamp de cada acción y generaría automáticamente las notas correspondientes.

Después podría aplicarse cuantización como herramienta de corrección.

Las subdivisiones pueden incluir:

* 1/1
* 1/2
* 1/4
* 1/8
* 1/16
* 1/32

La cuantización no debe sustituir completamente el control manual, porque ciertas composiciones requieren timings deliberadamente fuera de la rejilla.

## 27. Contenido y música

La música será un componente crítico del proyecto porque constituye simultáneamente el contenido y la referencia temporal del gameplay.

Las canciones deberán mantener información sobre:

* autor
* título
* origen
* licencia
* permisos
* duración
* BPM

No debe asumirse que una canción publicada en Internet puede utilizarse libremente.

Si se utilizan fuentes como Newgrounds u otras plataformas, cada pista deberá ser evaluada individualmente respecto a sus condiciones de uso.

Esto será especialmente importante si en el futuro el proyecto incorpora publicación pública de niveles.

## 28. Rendimiento

El rendimiento debe considerarse desde el comienzo, pero optimizando únicamente cuando exista una razón técnica.

No se pretende construir una arquitectura compleja de optimización prematura.

Las áreas principales serán:

* batching
* cantidad de objetos
* partículas
* creación y destrucción de objetos
* garbage collection
* shaders
* postprocesamiento
* texturas
* resolución interna
* frecuencia de actualización
* uso de CPU
* uso de GPU

Será preferible reutilizar objetos y partículas mediante pools cuando exista evidencia de que las asignaciones frecuentes están afectando al rendimiento.

## 29. Calidad gráfica adaptativa

El juego deberá poder adaptar la calidad visual según el hardware.

Se pueden contemplar niveles:

* Low
* Medium
* High
* Ultra
* Auto

Las variables ajustables pueden incluir:

* cantidad de partículas
* calidad de bloom
* resolución interna
* complejidad de shaders
* número de efectos simultáneos
* postprocesamiento

La reducción de calidad nunca debe afectar:

* timing
* gameplay
* detección de impactos
* legibilidad de notas
* respuesta de los inputs

## 30. Compatibilidad

El proyecto tendrá como objetivo principal el escritorio.

La segunda plataforma será el móvil, especialmente en orientación horizontal.

La lógica de juego debe mantenerse independiente del tamaño físico de la pantalla mediante una resolución lógica interna.

Una referencia posible sería:

**1920 × 1080**

El renderer adapta esa escena al viewport real.

Esto permitirá que un mismo nivel se represente en diferentes tamaños sin alterar su lógica temporal.

## 31. Uso de React

React tiene un papel complementario.

Puede encargarse de:

* menú principal
* configuración
* selección de niveles
* pantallas de resultados
* información
* editor de niveles
* futuras funciones sociales

Pero el gameplay debe permanecer dentro del engine.

El frame loop no debería depender del ciclo de renderizado de React.

La separación ideal es:

**React → interfaz**

**PixiJS → mundo del juego**

**Engine → lógica y tiempo**

## 32. Web Workers

Los Web Workers podrán utilizarse cuando exista trabajo que realmente pueda aislarse del hilo principal.

Ejemplos:

* análisis pesado de beatmaps
* procesamiento de datos
* validación
* preparación de contenido
* cálculos complejos

No se pretende trasladar toda la lógica del proyecto a Workers.

La regla será utilizar concurrencia solamente cuando reduzca una carga real sobre el hilo principal.

## 33. WebAssembly y Rust

Rust/WebAssembly no es una necesidad inicial.

Aunque Rust puede utilizarse posteriormente para determinadas tareas de procesamiento intensivo, introducirlo desde el comienzo añadiría complejidad innecesaria.

Debe considerarse solamente si el profiling demuestra que existe un cuello de botella que justifique cambiar de tecnología.

Algunas tareas candidatas futuras podrían ser:

* procesamiento masivo de beatmaps
* validación compleja
* algoritmos especializados
* cálculos de simulación

La tecnología debe responder a necesidades reales y no convertirse en una meta por sí misma.

## 34. Estructura conceptual del proyecto completo

La visión a largo plazo puede resumirse así:

```text
                   RHYTHM GAME
                        │
          ┌─────────────┴─────────────┐
          │                           │
     Game Runtime                  Tools
          │                           │
   ┌──────┼──────┐             Level Editor
   │      │      │                    │
 Audio Gameplay Visual               │
   │      │      │                    │
   └──────┼──────┘                    │
          │                           │
       Beatmap ◄──────────────────────┘
          │
     Content System
          │
   ┌──────┼───────────────┐
   │      │               │
 Songs  Levels        Visual Data
          │
      Online Layer
          │
   ┌──────┼───────────────┐
   │      │               │
Accounts Cloud        Leaderboards
          │
       Multiplayer
```

Este esquema representa una dirección de arquitectura, no significa que todos esos sistemas deban desarrollarse simultáneamente.

## 35. Evolución online

En una etapa futura podrá incorporarse una infraestructura de backend.

Una arquitectura inicial razonable podría estar basada en:

* Node.js
* TypeScript
* Fastify o framework equivalente
* PostgreSQL
* Object Storage
* CDN

No se considera necesario comenzar con microservicios.

Una API futura podría incluir operaciones conceptualmente similares a:

```text
GET  /levels
GET  /levels/:id
POST /scores
GET  /leaderboard
```

El contenido pesado, especialmente audio, debería mantenerse fuera de la base de datos.

## 36. Cuentas y progreso

El sistema de cuentas debe abstraerse mediante una capa de servicios.

Inicialmente puede utilizarse almacenamiento local o identidad anónima.

Más adelante puede introducirse autenticación remota.

Esto permitirá que el gameplay no dependa directamente de un proveedor concreto de autenticación.

## 37. Contenido generado por usuarios

Una de las posibilidades más importantes a largo plazo es permitir que otras personas creen y publiquen niveles.

Esto convertiría el proyecto de un juego cerrado en una plataforma de contenido.

Pero ese sistema requerirá problemas adicionales que no existen en el prototipo:

* validación
* almacenamiento remoto
* versionado
* seguridad
* moderación
* derechos de autor
* metadatos
* publicación
* reportes
* descubrimiento de contenido

Por eso la publicación pública se considera una etapa posterior.

## 38. Multiplayer futuro

El multijugador no forma parte de la primera versión.

Se contemplan dos conceptos diferentes.

### Modo cooperativo simple

Dos jugadores participan en una misma canción.

Cada uno interpreta una parte diferente de la composición.

Por ejemplo:

**Jugador 1 → batería**

**Jugador 2 → melodía**

Cada jugador tendría conceptualmente su propio Launchpad y un conjunto de notas diferente, pero ambos estarían sincronizados con la misma canción.

### Modo Mashup

El modo Mashup no consiste en reproducir dos canciones independientes.

Existe **una única pista final**, construida a partir de dos o más canciones o composiciones integradas en un Mashup.

Ambos jugadores escuchan exactamente ese mismo resultado final.

La diferencia es que cada jugador dispone de su propio Launchpad y recibe una parte diferente de la interpretación.

Por ejemplo:

**Mashup final**

→ Jugador 1 interpreta determinados elementos
→ Jugador 2 interpreta otros elementos

Esto permite representar una composición mucho más compleja sin convertir un único Launchpad en una superficie excesivamente grande o difícil de manejar.

La implementación exacta del sistema Mashup se definirá posteriormente cuando exista suficiente experiencia con el sistema de niveles y gameplay.

## 39. Modelo de input futuro para multiplayer

La abstracción del input permitirá evolucionar desde:

```text
PadInput
```

hacia algo conceptualmente parecido a:

```text
PlayerInput
{
    timestamp
    playerId
    padId
    action
}
```

Esto permitiría mantener el mismo núcleo de gameplay y ampliar la experiencia hacia varios participantes.

## 40. Roadmap y Taxonomía Unificada de Fases

El proyecto evoluciona por fases estandarizadas, coordinadas directamente con la documentación técnica oficial (`DOCUMENTATION.md`):

### Fase 0 — Concepto y Arquitectura Base *(Completada)*
* Diseño fundamental y contratos de tiempo
* Viabilidad de Web Audio API y renderizado PixiJS
* Desacoplamiento de subsistemas mediante buses de eventos

### Fase 1 — Core Gameplay Engine *(Completada)*
* Detección precisa de pulsación y ventanas de tiempo (Perfect, Good, Miss)
* Sistema de puntuación, multiplicador dinámico y racha de combo
* Sintetizador procedural y fallback automático de audio
* 4 pads semánticos y comportamientos (tap, hold, loop, trigger)

### Fase 2 — Visual Engine y Reactividad *(Completada)*
* Grafo de escena jerárquico (`SceneGraph`) con primitivas geométricas
* Reactividad por bandas de frecuencia FFT (`AudioMapping`: bass, mids, treble, ambient)
* Sistema de animación interpolada (`Animator`) y disparadores temporizados (`TriggerDispatcher`)
* Shaders GLSL (aberración RGB, bloom post-processing) y sistema de partículas

### Fase 3 — Editor Interno *(Completada)*
* Línea de tiempo multi-pista estilo DAW con snapping musical (1/1 a 1/16 y free)
* Herramientas interactivas (V: Selección, B: Lápiz/Dibujo, E: Borrador)
* Scene Outliner, inspector contextual de propiedades y atajos de teclado
* Pila de historial Undo/Redo (Ctrl+Z / Ctrl+Y) y grabación en vivo

### Fase 4 — Player Standalone y Content Runtime *(Completada)*
* Reproductor independiente a resolución lógica fija 1920×1080 con letterboxing automático
* Flujo de prueba continuo Editor ↔ Juego real (`Playtest`)
* Sistema de pausa inmediata vía tecla Escape con modales completos
* HUD de rendimiento en tiempo real (barra de progreso, multiplicador animado, precisión %)
* Pantalla de resultados con calificaciones (SS a D) y desglose de juicios

### Fase 5 — Content Pipeline y Gestión de Assets *(Siguiente Fase)*
* Integración activa de `SongRegistry` con `AudioEngine` y `AudioTransport`
* Caching de buffers de audio decodificados en memoria (`AudioBuffer`) para evitar duplicaciones
* Vinculación de múltiples dificultades (Easy, Normal, Hard) compartiendo una misma canción
* Empaquetado, validación de esquemas y preloading de niveles

### Fase 6 — Optimización y Pulido
* Object pooling intensivo para display objects y partículas
* Profiling de rendimiento en GPU/CPU y calidad adaptativa
* Garantía de estabilidad continua a 60+ FPS y pruebas de respuesta táctil

### Fase 7 — Infraestructura Online y Backend
* Cuentas de usuario y perfiles de progreso (Supabase)
* Guardado en la nube y repositorio de niveles remotos
* Tablas globales de clasificación (leaderboards) y eventos online

### Fase 8 — Multiplayer y Comunidad
* Duelo en tiempo real y cooperativo
* Modo Mashup multiplayer con dos Launchpads independientes
* Catálogo comunitario y navegador público de niveles

## 41. Qué no debe construirse todavía

Para evitar dispersión del equipo, determinados objetivos deben permanecer fuera del alcance inicial:

* cuentas
* backend completo
* rankings online
* multiplayer
* Mashup
* editor público
* sistema social
* microservicios
* Rust/WASM
* WebGPU como requisito
* sistemas de progresión complejos

Estas funcionalidades son parte de la visión futura, pero no forman parte del núcleo necesario para demostrar que el juego funciona.

## 42. Estado real del prototipo

El prototipo actual ya constituye una base significativa y no debe considerarse simplemente una maqueta visual.

El repositorio utiliza Vite, TypeScript, React, PixiJS y Supabase, y mantiene una separación explícita entre engine y UI.

El núcleo `Game` coordina audio, input, gameplay y visualización.

El `GameplayEngine` está separado del renderer y se encarga de notas pendientes, detección de impactos, judgement, score y combo.

El `InputManager` convierte entradas físicas en identificadores abstractos de pads.

El `VisualEngine` utiliza PixiJS y ya contempla capas diferenciadas, partículas, filtros y reacción a bandas de audio.

Además, el modelo de datos ya establece que un pad representa una función sonora y no una nota/pitch, y mantiene la estructura de niveles independiente del renderer.

Por lo tanto, la dirección recomendada no es descartar el prototipo, sino utilizarlo como punto de partida y determinar qué partes pueden evolucionar directamente hacia infraestructura del engine y qué partes necesitan refactorización.

## 43. Principios de desarrollo para el equipo

A medida que varias personas trabajen en el proyecto, será importante mantener algunas reglas.

Primero, el engine debe permanecer lo más independiente posible de la interfaz.

Segundo, el gameplay nunca debe depender de detalles visuales.

Tercero, los datos de un nivel no deben describir directamente cómo PixiJS debe dibujar un objeto.

Cuarto, las decisiones relacionadas con sincronización deben tomar como referencia el reloj de audio.

Quinto, las funcionalidades futuras deben poder añadirse mediante extensiones razonables, evitando reescribir continuamente el núcleo.

Sexto, la optimización debe basarse en mediciones y perfiles reales.

Séptimo, ninguna característica visual debe comprometer la legibilidad y precisión del gameplay.

## 44. Visión final

La meta final no es construir simplemente otro juego de ritmo.

La visión es desarrollar una plataforma de juego y creación de contenido donde la música, el gameplay y los efectos visuales estén profundamente conectados.

El jugador debe sentir que está interactuando directamente con la composición.

El creador de niveles debe tener herramientas suficientes para transformar una canción en una experiencia audiovisual completa.

Y el engine debe ser capaz de ejecutar esas experiencias de forma precisa y eficiente en un navegador.

En su evolución más madura, un nivel debería poder describirse casi como una composición:

```text
La canción determina el contexto musical.

Las notas determinan las acciones del jugador.

Los eventos determinan cuándo ocurren acontecimientos.

Los objetos forman el escenario.

Los grupos permiten controlar estructuras.

Las animaciones definen el movimiento.

Los triggers conectan acontecimientos con efectos.

El audio controla señales visuales.

Los shaders transforman la apariencia.

El renderer ejecuta todo esto de forma eficiente.
```

La idea central puede resumirse en una frase:

**El objetivo es convertir la música en una experiencia jugable y visual, no simplemente utilizar música como acompañamiento de un juego.**

El prototipo es solamente el primer paso de esa dirección.