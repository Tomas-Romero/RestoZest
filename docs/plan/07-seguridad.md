# Seguridad, roles y backups

### Autenticación en dos planos

Este es el punto donde la mayoría de los planes se rompe: si el login depende de un servicio en la nube, un corte de internet deja al mozo afuera del sistema. Dos mecanismos distintos:

**Plano operativo — offline capable**

El dispositivo se enrola una vez y guarda un token de larga duración firmado por el hub. Cada empleado entra con un **PIN de 4–6 dígitos** validado contra el `pin_hash` (argon2id) replicado en el hub. Sesión corta con auto-logout de 90 segundos, porque la tablet pasa de mano en mano. Funciona sin internet y sin nube.

**Plano de gestión — online**

Dueño y admin entran con email + contraseña + 2FA opcional contra la nube. Es el único plano que puede cambiar precios, ver reportes de ganancias, gestionar usuarios y descargar backups. Nunca se puede hacer nada de esto desde el hub.

### Matriz de permisos

| Acción                            | Dueño | Admin | Cajero        | Mozo     | Cocina |
|-----------------------------------|-------|-------|---------------|----------|--------|
| Ver menú y cargar órdenes         | ✓     | ✓     | ✓             | ✓        | —      |
| Cambiar estado en cocina          | ✓     | ✓     | —             | ver      | ✓      |
| Anular ítem ya enviado            | ✓     | ✓     | ✓ con motivo  | solicita | —      |
| Aplicar descuento                 | ✓     | ✓     | hasta un tope | —        | —      |
| Cobrar y dividir cuenta           | ✓     | ✓     | ✓             | —        | —      |
| Abrir / cerrar caja               | ✓     | ✓     | ✓             | —        | —      |
| Modificar precios                 | ✓     | ✓     | —             | —        | —      |
| Ver reporte de ganancias y costos | ✓     | —     | —             | —        | —      |
| Gestionar usuarios y dispositivos | ✓     | ✓     | —             | —        | —      |

Los permisos se evalúan en el servidor (hub o nube) y además se usan para ocultar la UI. Esconder un botón no es seguridad, pero un cajero que ve el botón «ganancias» deshabilitado va a preguntar por qué.

### Backups

| Qué                        | Cada cuánto                | Dónde                             | Retención              |
|----------------------------|----------------------------|-----------------------------------|------------------------|
| Hub — snapshot lógico      | 15 min durante el servicio | SSD local + R2 cuando hay red     | 7 días                 |
| Hub — WAL archiving        | Continuo                   | SSD local                         | 48 h (RPO ≈ 0)         |
| Nube — PITR (pgBackRest)   | Continuo                   | Volumen del VPS                   | 7 días                 |
| Nube — full diario         | 04:00 ART                  | Cloudflare R2, cifrado            | 30 días + 12 mensuales |
| Export contable por tenant | Mensual                    | CSV/XLSX descargable por el dueño | Permanente             |

**Un backup no probado no es un backup**

Poné un cron mensual que restaure el último full en una base descartable, corra un `count(*)` sobre las tablas críticas y te avise por mail. Es media hora de trabajo una sola vez y es la diferencia entre tener backups y creer que los tenés.

Sumale un *runbook del hub muerto*: imagen Docker versionada, disco de repuesto, y el procedimiento escrito para que un local vuelva a operar en menos de 20 minutos. Ese documento es parte del producto que vendés, no un extra.
