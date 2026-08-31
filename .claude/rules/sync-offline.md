---
description: Semántica de sincronización, outbox e idempotencia
paths:
  - packages/sync/**
  - apps/hub/**
  - packages/domain/src/events/**
---

# Al tocar sincronización, outbox o eventos

Referencia completa: `docs/plan/04-offline-first.md`. Leelo entero antes de modificar algo acá.

## Las tres reglas de oro

1. Toda escritura es un evento inmutable con UUIDv7 generado en el cliente.
   Reenviarlo es gratis: el receptor lo deduplica por PK y devuelve 200, no error.
2. Cada entidad tiene un único dueño de escritura. Nunca introduzcas un flujo
   bidireccional sobre la misma entidad.
3. Nada que requiera un número único global se genera offline: CAE, número de
   comprobante, cobro con tarjeta o QR. Se encolan con estado `pending`.

## Outbox

- Flush **secuencial por `lamport`**. Un evento fallado bloquea los siguientes de la
  **misma orden**, no de todas.
- Backoff exponencial 1s → 60s, sin límite de intentos.
- Se persiste **antes** de mostrar éxito en la UI. Optimistic UI sí, pero después
  del write a disco.
- Solo se borra del outbox con confirmación explícita del servidor. Ante la duda,
  reenviar: duplicar un envío es gratis, perder una venta no.

## Orden determinístico

El desempate de replay es siempre `(lamport, device_id)`. Nunca uses `occurred_at`
para ordenar: es la hora del dispositivo y puede mentir.

## Niveles de degradación

Toda acción nueva de la UI tiene que pasar por `canDo(action, level)` y declarar
explícitamente qué pasa en L1 y en L2. Si no sabés qué corresponde, preguntá antes
de implementar — no lo dejes habilitado "por las dudas".

## Conflictos irresolubles

No se descartan nunca. Van a `sync_incidents` y aparecen en el panel de admin
para que una persona decida.

## Definición de terminado

Ninguna tarea de esta área está lista si el test de caos de `e2e/chaos.spec.ts`
no pasa. Si tu cambio lo rompe, arreglá el cambio, no el test.
