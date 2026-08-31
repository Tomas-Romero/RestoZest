# Impresión ESC/POS

La impresión vive **en el hub, nunca en el navegador**. WebUSB pide permisos por dispositivo, se rompe al recargar la página y no existe en iPad. El hub abre un socket TCP al puerto 9100 (impresoras de red) o el device USB, y expone un endpoint HTTP en la LAN. Cualquier dispositivo puede pedir una impresión sin saber nada de impresoras.

**Ruteo**

Cada ítem lleva `prep_station`. Una orden enviada se parte en N comandas: parrilla, cocina fría, barra. Solo se imprime lo que le toca a cada estación, y la reimpresión queda auditada.

**Cola persistida**

`print_jobs` en Postgres con estados `queued → printing → done | failed`. Si la térmica se queda sin papel a las 21:40, los trabajos esperan; nadie pierde una comanda.

**Documentos**

Comanda de cocina (grande, sin precios), pre-cuenta, ticket de cobro, ticket fiscal con CAE y QR de ARCA, cierre de caja (Z), y reportes del admin.

**Hardware**

Objetivo: Epson TM-T20III y clones chinos de 80 mm, que es lo que hay en los locales. Codepage `CP858` para acentos y «ñ». Guardar el ancho en `printers.width_chars` (42 u 48) y renderizar contra ese valor.

Fallback: si no hay hub, el POS genera un PDF de 80 mm de ancho y lo manda a imprimir por el sistema operativo. Feo, lento, pero destraba un local un martes a la noche.
