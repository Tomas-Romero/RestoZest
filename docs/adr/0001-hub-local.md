# ADR 0001 — Hub local en el salón como fuente de verdad durante el servicio

**Fecha:** 2026-08-31
**Estado:** aceptada

## Contexto

El sistema tiene que seguir operando con internet caído. La respuesta habitual
—PWA con IndexedDB en cada dispositivo— resuelve el caso "una tablet perdió señal"
pero no el que realmente rompe un restaurante: internet caído durante 40 minutos con
seis dispositivos que necesitan ver las mismas mesas. Un mozo que anota offline en su
tablet no le sirve al cajero ni a la cocina si nadie más ve esa orden.

## Decisión

Una mini-PC (o Raspberry Pi 5) en el local corre Postgres, la misma API que la nube
con `ROLE=hub`, un servidor WebSocket y la cola de impresión. Durante el servicio, el
hub es la fuente de verdad de órdenes, pagos y stock; la nube es dueña del catálogo,
los usuarios y los comprobantes fiscales, y consolida para reportes y backup.

Los dispositivos hablan primero con el hub por LAN y con la nube solo como respaldo.
IndexedDB queda como segunda red de contención (nivel L2), no como mecanismo principal.

## Consecuencias

**A favor.** El servicio completo sobrevive a un corte de WAN: cargar, cocinar,
imprimir y cobrar en efectivo siguen funcionando con latencia de LAN. Al haber un
único dueño de escritura por entidad, no hacen falta CRDTs ni merges de tres vías,
y el dispositivo solo necesita una cola de salida en lugar de un motor de replicación.

**En contra.** Cada venta suma hardware (USD ~180 con UPS), instalación y una
superficie de soporte nueva. Hay que mantener imágenes versionadas, un canal de
actualización y un runbook de "hub muerto". Un local sin hub queda limitado al
nivel L2.

**Se revisa si.** La fricción comercial del hardware resulta mayor a la esperada, o
aparece un motor de sync (PowerSync u otro) que cubra el caso multi-dispositivo sin
servidor local. Reevaluar en la Fase 10.
