# Arquitectura: tres anillos

Cada anillo tiene un rol distinto y, sobre todo, **un conjunto de datos del que es dueño**. Ninguna entidad se escribe desde dos anillos a la vez: esa sola regla elimina la mayoría de los conflictos de sincronización antes de que existan.

Anillo 3  
Nube

**API + Postgres** — catálogo · usuarios · reportes

**Worker fiscal** — WSAA / WSFEv1 → CAE

**Webhooks MP** — QR · Point · Checkout

**Menú público** — Next.js · SSG · QR de mesa

▼ catálogo, precios, usuarios, config  ·  ▲ eventos de órdenes, pagos, stock, cierres de caja

Anillo 2  
Hub local

**Postgres + API** — fuente de verdad del servicio

**WebSocket LAN** — tiempo real sin internet

**Cola de impresión** — ESC/POS · USB y :9100

**Outbox** — reenvío a la nube

▼ snapshot del catálogo + estado de mesas  ·  ▲ mutaciones idempotentes

Anillo 1  
Dispositivos

**Mozos** — PWA · tablet/celular

**POS / Caja** — PWA · teclado + lector

**KDS Cocina** — PWA · pantalla fija

**Admin** — PWA · nube o LAN

**Hardware del hub**

Mini-PC x86 (N100, 8 GB RAM, SSD) o Raspberry Pi 5. Debian + Docker Compose. UPS chico obligatorio: el hub no puede apagarse en un corte de luz de 30 segundos.

**Red**

Router propio del hub o VLAN dedicada. El hub anuncia `restozest.local` por mDNS y tiene IP fija de respaldo. Los dispositivos prueban LAN primero, nube después.

**Costo por local**

Mini-PC USD 120–180 + UPS USD 60 + impresoras. Es CAPEX del cliente, se amortiza en un mes de suscripción y es tu principal diferencial frente a competencia 100% cloud.

### Quién es dueño de qué

| Dominio                                     | Dueño de escritura             | Dirección de sync             | Conflicto posible                          |
|---------------------------------------------|--------------------------------|-------------------------------|--------------------------------------------|
| Catálogo, precios, combos, usuarios, config | Nube                           | Nube → hub → dispositivo      | No (el hub es read-only)                   |
| Órdenes, ítems, estados de cocina           | Hub                            | Hub → nube                    | No (log de eventos append-only)            |
| Pagos y sesiones de caja                    | Hub                            | Hub → nube                    | No (idempotencia por UUID)                 |
| Stock                                       | Hub (consumo) / Nube (compras) | Bidireccional por movimientos | No (deltas conmutativos, nunca `SET qty=`) |
| Comprobantes fiscales                       | Nube exclusivamente            | Nube → hub (solo estado)      | No                                         |
| Órdenes de delivery web                     | Nube                           | Nube → hub                    | No                                         |

Sin filas bidireccionales sobre la misma entidad, no hace falta CRDT ni merge de tres vías. El costo de esa simplicidad es una regla de disciplina que hay que sostener en cada feature nueva.
