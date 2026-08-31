---
description: Criterios de UI para las apps que se usan durante el servicio
paths:
  - apps/pos/**
  - apps/waiter/**
  - apps/kds/**
---

# Al construir UI operativa (POS, mozos, KDS)

Estas apps las usa gente apurada, con las manos ocupadas, en un salón ruidoso.
No son dashboards.

- **Velocidad antes que estética.** Sin animaciones de entrada, sin skeletons
  decorativos. Optimistic UI en todo: la acción se ve aplicada al instante y el
  outbox se encarga del resto.
- **Targets táctiles de 48 px mínimo** en mozos. El POS se opera con teclado:
  todo el flujo de cobro tiene que ser posible sin mouse, y los atajos se muestran
  en pantalla.
- **El KDS se lee a dos metros.** Tipografía grande, sin scroll horizontal,
  contraste alto. Pensado para pantalla fija, no para ventana redimensionable.
- **El estado nunca se comunica solo por color.** Siempre color + texto o ícono:
  hay cocineros daltónicos y pantallas con los colores destruidos.
- **Barra de nivel de conexión (L0/L1/L2) siempre visible**, con texto explícito.
- **Un botón que no se puede usar está deshabilitado y explica por qué.** Nunca
  dejes que alguien complete un flujo para fallar al final.
- **Auto-logout de 90 segundos** en la app de mozos: la tablet pasa de mano en mano.
- Sin `localStorage` para datos operativos: todo va por la capa de repositorio
  (Dexie + outbox). `localStorage` solo para preferencias de UI.
