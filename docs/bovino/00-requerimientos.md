# Módulo Bovino — Requerimientos (entregados por la usuaria, 13/11/2026)

Se accede desde la opción **Bovinos** del Home de la granja (pantalla completa, como el módulo avícola).
Pantallas de referencia (estructura a mejorar, diseño a adaptar al de la app):
`C:\Users\Sist-AColmenarez\Desktop\PC-Arianna\GestionPecuaria\Imagenes modulo bovino` (16 capturas).

## 1. Módulo de Inventario y Almacén (Insumos y Logística)
Pulmón financiero y operativo que abastece tanto a la ceba como a la lechería. Controla todo lo que entra, se almacena y se gasta en la finca.
- **Alimentos y Concentrados:** registro de compras de materia prima o alimento balanceado (sacos, toneladas, volumen). Control de stock actual por bodega o silo. Alertas automáticas de inventario crítico cuando el stock baja del umbral de seguridad.
- **Minerales y Sales:** control de consumo de sales mineralizadas por lote y potrero. Permite auditar cuántos kilos consume un lote de engorde al mes vs. el lote de vacas lecheras.
- **Farmacia y Biológicos:** inventario de vacunas, desparasitantes, antibióticos, hormonas y jeringas/material quirúrgico.
  - Control de lotes y vencimiento: registro obligatorio del número de lote del fabricante y fecha de caducidad. El sistema bloquea el uso de medicamentos vencidos.
- **Otros insumos (combustible, herramientas, repuestos):** combustible para tractores/bombas de agua y herramientas de mantenimiento general.
- **Trazabilidad de salidas (asignación a costos):** cada salida exige indicar a qué se destinó (ej. "5 sacos de alimento al Lote de Ceba 2" o "2 frascos de oxitetraciclina a Sanidad"), para calcular el costo real por kg producido o litro ordeñado.

## 2. Gestión de Animales (núcleo base)
- **Alta y registro individual:** número de arete visual (o código corto), fecha de nacimiento o ingreso, sexo, raza predominante y procedencia.
- **Lotes y potreros:** crear y modificar agrupaciones. Mover un lote completo o animales individuales de un potrero a otro con un par de clics, registrando la fecha del movimiento para calcular el tiempo de ocupación del pasto.
- **Historial individual:** línea de tiempo del animal desde su nacimiento o compra hasta su estado actual (pesajes, servicios, tratamientos, partos).

## 3. Engorde y Ceba (carne)
Objetivo: maximizar la ganancia de peso y controlar el costo de alimentación por kilo ganado, sin básculas electrónicas.
- **Pesajes manuales (por lote o individual):** el operario anota arete y peso; el sistema calcula los días desde el último pesaje.
- **GMD automática:** GMD = (Peso actual − Peso anterior) / Días. Colores: verde = óptima, amarillo = baja, rojo = pérdida o estancamiento.
- **Consumo de alimento (raciones):** kilos de alimento/suplemento entregados al lote de ceba por día; cruzado con el almacén calcula la conversión alimenticia estimada del lote.
- **Proyección de salida a faena:** fecha estimada en que el lote alcanza el peso de venta ideal según su GMD histórica.

## 4. Lechería y Reproducción (cría)
- **Registro diario de ordeño:** lista rápida con el volumen de cada vaca (o total del tanque, con opción de desglose por vaca). Grafica la curva de lactancia y detecta caídas drásticas.
- **Ciclo reproductivo (estados dinámicos):**
  - Servicios (monta natural o IA, con el toro o la pajuela del inventario).
  - Diagnósticos de gestación (palpación/ecografía), programados y registrados.
  - Cálculo automático de la Fecha Probable de Parto (FPP) y la Fecha de Secado (60 días antes del parto).
- **Alertas reproductivas / Agenda del día:** vacas que cumplen su período de espera voluntario, vacas listas para secado, animales para sincronización o IATF.
- **Crías y recría:** nacimiento de terneros, peso al destete y suministro de calostro en las primeras horas de vida.

## 5. Sanitario y Tratamientos (integrado al almacén)
- **Aplicación de tratamientos:** al registrar un medicamento aplicado a un animal o lote, se descuentan las unidades del almacén de farmacia.
- **Tiempos de retiro:** cada fármaco tiene días de retiro en carne y leche. El sistema bloquea al animal en las listas de venta o de envío de leche hasta que el contador llegue a cero.
- **Historial clínico preventivo y curativo:** diagnósticos, síntomas y efectividad del tratamiento.

## 6. Reportes y Tableros (KPIs)
- **Ceba:** GMD promedio del hato de engorde, consumo de alimento por kilo producido, costo de producción por animal, animales próximos a venta.
- **Lechería y reproducción:** tasa de preñez, días abiertos promedio, intervalo entre partos (IEP), producción diaria total y litros/vaca/día.
- **Valorización de inventario:** valor del alimento, minerales y fármacos en almacén, y proyección del valor del hato por categorías.

## 7. Balance Financiero (rentabilidad y utilidad)
Separar las finanzas de la **ceba** y de la **lechería/cría**.
- **Ingresos manuales:** venta de leche (litros × precio), venta de ganado en pie o canal (kg × precio), venta de crías o descarte.
- **Costos directos automáticos:** cada salida de alimento, minerales o medicamentos hacia un lote se convierte en dinero y se suma como gasto directo de esa unidad productiva.
- **Gastos fijos y generales:** nómina, cercas, electricidad, fletes; prorrateados entre ceba y lechería.
- **Utilidad bruta y neta:** Ingresos − Gastos = Utilidad, por rango de fechas.
- **Liquidación y cierre de lotes:** al vender un grupo de engorde, cruza costo de compra + todo lo consumido vs. el cheque de venta, con la rentabilidad del ciclo.
- **Indicadores:** costo por litro de leche, costo por kg de carne ganado y proyección simple de flujo de caja del mes.

## Puntos para la app (personal de campo)
1. **Captura en manga (modo rápido):** alto contraste, botones grandes. Se digita el número corto del arete y el sistema muestra solo la acción del día (ej. Pesaje + Desparasitación) con cálculo automático de dosis según el peso.
2. **Lista de trabajo diaria (to-do veterinario):** cada mañana, la lista de animales a apartar: "Vaca #402: palpar hoy", "Vaca #118: secar hoy", "Lote 3: cumple retiro de ivermectina mañana".

## Puntos críticos técnicos y operativos
1. **Offline-first:** trabajo 100% sin internet; sincronización automática al detectar conexión. Si dos personas editan sin internet, fusionar por marca de tiempo sin sobrescribir ni borrar información.
2. **UI/UX de campo:**
   - Alto contraste, modo sol: fondos claros y texto oscuro; nada de textos grises pequeños.
   - Botones grandes y separados; teclado numérico para pesos, litros y dosis.
   - Cero escritura innecesaria: selectores, opciones y listas (ej. elegir el fármaco de la farmacia).
   - Acciones masivas: "Lista rápida" para pasar de un arete al siguiente en una sola pantalla.
3. **Integridad de datos:**
   - Topes lógicos con confirmación (ej. novillo de 4500 kg, vaca con 350 L en un ordeño).
   - Estados excluyentes: no inseminar una vaca Preñada o Seca; advertencia crítica de bloqueo al vender un animal con retiro activo.
   - Moneda dual: costos e ingresos en moneda local y en moneda de referencia (USD) con tasa del día.
4. **Roles, permisos y auditoría:**
   - Operario / Ordeñador: solo formularios de carga diaria (leche, pesajes, nacimientos, consumo de alimento). No ve costos ni balances.
   - Veterinario / Encargado: reproducción, sanidad, movimientos de lotes e inventario de farmacia.
   - Propietario / Administrador: acceso total, edición de precios, cierre de lotes y balance financiero.
   - Bitácora: qué usuario creó, editó o eliminó un dato y a qué hora (salidas de almacén, muertes, movimientos financieros).
5. **Exportación y respaldos:** exportar balances, inventarios y listas de ganado en PDF (para imprimir o enviar por WhatsApp) y en Excel/CSV. Respaldo diario en la nube.
