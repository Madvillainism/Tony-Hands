# 🛹 Tony-Hands — Gesture-Controlled Tony Hawk's Pro Skater

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Hands-00C7B7?style=for-the-badge&logo=google&logoColor=white)](https://github.com/google-ai-edge/mediapipe)
[![OpenCV](https://img.shields.io/badge/OpenCV-v4-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)](https://opencv.org/)
[![RetroArch](https://img.shields.io/badge/RetroArch-PS1_Emulation-E01E3C?style=for-the-badge&logo=retroarch&logoColor=white)](https://www.retroarch.com/)

> **Tony-Hands** es un proyecto de ingeniería y sistema de control biométrico experimental que implementa visión artificial con **MediaPipe** para mapear gestos de manos en tiempo real como controles activos de un emulador **RetroArch**. Diseñado específicamente para dominar *Tony Hawk's Pro Skater*, traduce coordenadas espaciales deterministas en inputs directos de teclado o gamepad virtual.

🎨 **El Reto Técnico:** Jugar THPS requiere precisión absoluta y baja latencia. Este software resuelve mecánicas complejas como el movimiento, los giros y la física nativa del *Ollie* mediante el cálculo de distancias sobre los 21 puntos clave de la mano, esquivando la necesidad de modelos de Inteligencia Artificial pesados o latencia de red.

---

## 🎮 ¿Cómo se Controla el Skater? (Mapping Spec)

El sistema procesa de forma independiente la información espacial de ambas manos para separar la aceleración y los trucos del control de dirección:

### 🖐️ Mano Derecha: Aceleración y Ollie (Física Invertida)
En *Tony Hawk's Pro Skater*, el jugador se agacha para ganar velocidad al mantener presionado el botón de salto (`X`) y realiza el *Ollie* únicamente al **soltarlo**. El sistema replica este comportamiento de forma nativa:
* **Puño Cerrado (Hold `X`):** El bot emula la presión continua del botón. El skater se agacha y gana velocidad.
* **Mano Abierta (Release `X`):** El bot suelta el botón instantáneamente para activar el salto (*Ollie*).
* **Ecuación de Activación:**
    $$\Delta Y = y_{\text{wrist}} - y_{\text{index\_tip}}$$

### 🤚 Mano Izquierda: Dirección (Giro)
* **Neutral:** Mano centrada en su cuadrante.
* **Inclinación Izquierda (Left):** Desplazamiento del landmark de la muñeca a la izquierda de la zona muerta configurada.
* **Inclinación Derecha (Right):** Desplazamiento del landmark de la muñeca a la derecha de la zona muerta.

---

## ⚡ Características Principales

* **⚡ Control de Latencia Extremo (<33ms):** Procesamiento de imágenes optimizado en OpenCV con un formato de entrada reducido para asegurar frames por segundo (FPS) estables y evitar el retardo en la respuesta de los trucos.
* **🎯 Zonas Muertas Dinámicas (Deadzones):** Previene falsos positivos en el giro al mantener un área central de tolerancia para la mano izquierda.
* **⚙️ RetroArch Bridge:** El script inyecta eventos de control fluidos compatibles nativamente con la asignación de teclas e instancias del emulador RetroArch.

---

## 📂 Estructura de Especificaciones (SSD Layout)

El proyecto sigue una estructura de diseño y desarrollo modular estricta guiada por especificaciones:

```text
spec/
├── constitution/
│   ├── mision-vision.md      # Enfoque e impacto de la interfaz natural (NUI)
│   ├── tech-stack.md         # Bloqueo del entorno (Python, MediaPipe, pynput/vgamepad)
│   └── roadmap.md            # Planificación de fases (Visión -> Movimiento -> Ollie)
├── features/
│   ├── 001-vision-pipeline   # Captura y optimización de frames con OpenCV
│   ├── 002-skater-movement   # Algoritmo de giro y zonas muertas (Mano Izquierda)
│   └── 003-ollie-physics     # Máquina de estados de la física del salto (Mano Derecha)
├── CONTEXT.md                # Guardarraíles de latencia y estado global de la compilación
└── AGENTS.md                 # Asignación de tareas a los subagentes del entorno
