# Riesgos abiertos

| Riesgo                                                   | Impacto                   | Mitigación                                                                                                                                                                |
|----------------------------------------------------------|---------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| El hub agrega hardware, costo e instalación a cada venta | Alto — fricción comercial | Vender el hub como diferencial («funciona sin internet»), incluirlo en el precio del primer mes, y armar una imagen preconfigurada para que instalar sea enchufar y andar |
| Homologación de ARCA más lenta de lo previsto            | Medio — retrasa la Fase 7 | Arrancar el trámite durante la Fase 4. El sistema debe poder operar sin facturación fiscal hasta que esté                                                                 |
| Impresoras chinas con firmware ESC/POS incompleto        | Medio — soporte eterno    | Definir dos modelos soportados oficialmente y probar sobre esos. El resto, «mejor esfuerzo»                                                                               |
| Complejidad del offline consumiendo el cronograma        | Alto                      | Fase 5 con alcance cerrado y timebox. Si se pasa, se recorta L2 (modo restringido del dispositivo) y se queda solo con L1, que cubre el 90 % de los casos reales          |
| Deriva de datos entre nube y hub sin que nadie lo note   | Alto — silencioso         | Job nocturno de reconciliación que compara totales por local y día, y avisa ante cualquier diferencia                                                                     |
| Un solo desarrollador para un sistema con cinco apps     | Alto                      | Fases que terminan en algo vendible, para poder frenar en cualquier punto con un producto entero en la mano                                                               |

### Decisiones que conviene diferir

- **Motor de sync dedicado** (PowerSync). Reevaluar en Fase 10, solo si aparece un caso real de escritura masiva offline sin hub.
- **App nativa**. La PWA alcanza para mozos y KDS. Capacitor solo si necesitás lectura de NFC o impresión Bluetooth directa desde la tablet.
- **Integración con apps de delivery** (PedidosYa, Rappi). Fase 11+, y solo con demanda concreta de un cliente que ya te esté pagando.
- **Multi-sucursal con stock centralizado**. El esquema ya lo soporta con `venue_id`; la UI y los reportes consolidados pueden esperar.
