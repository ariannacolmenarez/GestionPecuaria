# Módulo Bovino — QA ronda 1

Fecha de la corrida: 13/11/2026 (fechas de prueba relativas a `todayISO()`, sin fechas fijas).
Alcance: verificación (no implementación) del módulo bovino de pantalla completa contra `docs/bovino/00-requerimientos.md`.
No se modificó código de la app; los scripts de prueba están en el scratchpad (`.../scratchpad/bovino/qa1/`).

## 1. Compilación y pruebas

| Verificación | Resultado |
|---|---|
| `npx tsc --noEmit -p .` | **0 errores** |
| `npx vite build --outDir C:/Users/SIST-A~1/AppData/Local/Temp/qa-build-bovino --emptyOutDir` | **OK** (11 s). Chunks propios: `BovinoModuleView` 69 kB, `ModoManga`, `CebaHub`, `BalanceBovino`, `ReproSheets`, etc. |
| QA dominio nuevo `qa1/qa-domain.ts` (esbuild + node) | **123 / 123 PASS** |
| QA migración legado `qa1/qa-legacy.ts` | **Detecta 1 defecto** (ver ISSUE-01) |
| Smoke Data Hub `smoke.ts` (recompilado sobre el código actual) | 80 / 80 PASS |
| Smoke UI Etapa A `ui-smoke.tsx` (recompilado) | 155 / 155 PASS |
| Smoke UI Etapa B `b/stageb-smoke.tsx` (recompilado) | 174 / 174 PASS |
| Finales de línea de archivos modificados | Todos siguen 100 % CRLF, igual que en HEAD (el aviso "LF will be replaced" de git es ruido de `core.autocrlf=true`). |

### 1.1 Flujo recorrido por `qa-domain.ts`
Roles: Administrador, Veterinario y Operador (actor distinto por acción).
Pasos: configuración con VES y tasa 40, potreros y lotes, alta por lote con compra por kg, compras de alimento, minerales, farmacia y pajuela, salidas, dos pesajes, ración, tratamiento, venta y leche bloqueadas, servicio IA, diagnóstico (FPP y fecha de secado), secado, parto con cría y calostro, 9 días de ordeño con caída, tanque con desglose, ventas (con override auditado), venta de leche en moneda local, gasto fijo 30/70, balance, liquidación y cierre, agenda, manga, tarea completada, KPIs y valorización. También normalización de documentos antiguos, granja vacía y búsqueda de NaN/Infinity en todo el estado y en cada cálculo (no apareció ninguno).

Valores comprobados:
- **GMD**: 1.0 kg/día verde, 0.417 amarillo, negativa roja; 60 días desde el pesaje anterior.
- **Dosis automática**: 330 kg × 0.02 = 6.6 ml.
- **FPP** = servicio + 283 días; **secado** = FPP − 60.
- **Caída de leche**: 40 % (12 L contra un promedio de 20 L).
- **Costos**:
  - Compra de ganado: US$ 1500 / VES 60 000, con la tasa guardada en el `FinancialMovement`.
  - Salida de alimento al lote de ceba: costo directo de US$ 600, sin un segundo egreso.
  - Sal al lote lechero: se carga a lechería.
- **Balance**:
  - Gasto fijo prorrateado 120 / 280.
  - Costo por litro y costo por kg calculados.
  - La liquidación incluye la compra (1500) y el alimento.

Casos inválidos (todos rechazados con el código esperado):

| Caso | Código |
|---|---|
| Arete duplicado: activo, con `#` o espacios, repetido en la lista, o igual al de un animal antiguo | `ARETE_DUPLICADO` |
| Novillo de 4500 kg, pesaje de 4500 kg, vaca con 350 L, dosis > 150 %, cría de 120 kg o parto repetido, farmacia vencida al darla de alta, cierre de lote con animales activos | `FUERA_DE_RANGO` (`needsConfirmation`) |
| Peso negativo, salida sin destino, salida con cantidad 0, unidad sin especificar, fecha futura, prorrateo > 100 %, salida a un lote cerrado | `VALIDACION` |
| Servicio a vaca preñada o seca, ordeño a vaca seca o a macho, secar una vaca ya seca, vender un animal ya vendido | `ESTADO_EXCLUYENTE` |
| Salida o tratamiento con producto vencido | `VENCIDO` |
| Salida o tratamiento mayor que el stock | `STOCK_INSUFICIENTE` |
| Venta con retiro sin motivo, con `confirm:true` o con un motivo de menos de 5 caracteres | `RETIRO_ACTIVO` |
| Permisos: el operario no da altas, no compra, no saca farmacia, no trata, no sirve, no vende leche y no borra pesajes ajenos; el veterinario no vende, no registra gastos y no cierra lotes | `SIN_PERMISO` |

---

## 2. Requerimientos contra el código

Leyenda: **PASS** = implementado y verificado (prueba o lectura de código); **ISSUE** = ver la sección 3; **PARCIAL** = cubierto con una salvedad.

### Navegación (prioridad)
| Punto | Estado | Evidencia |
|---|---|---|
| Home › Bovino abre el módulo a pantalla completa (`mockupScreen 'bovino'`), sin el modal viejo | PASS | `App.tsx`: `onNavigateToBovino={() => nav.goBovino()}`. `BovinoModalView` ya no se renderiza y `showBovinoModal` se eliminó del flujo. |
| Subpantallas y Atrás (cabecera y botón físico de Android) con el mismo orden: hoja → pila → raíz de la sección → Hato → Home | PASS | `popRoute` (`bovino/routes.ts`) se usa en `onBack` y en `useHardwareBackButton`. Las hojas registran `pushBackHandler` (`useEscape`, a través de `avicola/shared`). La manga usa `useEscape(requestExit)` y la multiselección registra su propio handler. |
| BottomNav global oculta dentro del módulo y reemplazada por BovinoNav | PASS | `App.tsx`: `{!avicolaLot && !inBovino && <BottomNavView…>}` |
| Almacén, Balance y Actividades del rubro bovino | PASS | `openWarehouse`/`openBalance` con `currentRubro==='bovino'` llevan a Más › Almacén y Más › Balance. Actividades abre la Agenda. En `RubroPanels` el almacén bovino abre el módulo, el balance muestra "Ver balance ceba vs leche" (admin) y las tareas o "+ Actividad" abren la Agenda. |
| Alertas globales | PASS | `AlertsCenterModal`: "Ir al hato ›" en las tareas con `targetRubro==='bovino'`. |
| Título del GranjaHeader por pantalla | PASS | `screenTitle` muestra "Ganado Bovino", el nombre del lote, "Vaca #402", etc. |

### 1. Inventario y almacén
| Punto | Estado | Evidencia |
|---|---|---|
| Submódulos Alimentos, Minerales, Farmacia y Otros; compras en sacos, kg o volumen | PASS | `AlmacenBovino.tsx`, `InsumoForm.tsx`, `addBovinoItem`/`purchaseBovinoItem` (costo promedio ponderado; un lote de fabricante nuevo crea otra fila). |
| Stock por bodega o silo | PARCIAL | Campo `storage` visible en la ficha y en el kardex; no hay filtro ni total por bodega. |
| Alerta de stock crítico | PASS | `isItemCritical` alimenta la agenda (`stock_critico`) y el Hato. |
| Minerales: auditar kg por lote al mes (ceba contra lechería) | **ISSUE-06** | Solo el kardex por insumo, con el destino en cada fila. No hay un comparativo por lote y por mes. |
| Farmacia: lote del fabricante y vencimiento obligatorios | PASS | `validateItemFields` (prueba "farmacia sin lote/vencimiento"). |
| Uso de medicamentos vencidos bloqueado | PASS | `applyStockOut` y `treatmentCore` devuelven `VENCIDO`. La agenda muestra "Vencido: …". |
| Trazabilidad de salidas: destino obligatorio y costo real | PASS | `resolveDestination` admite lote, animal, potrero, unidad y sanidad. El evento `salida` guarda `destination.unit` y el costo dual. |

### 2. Gestión de animales
| Punto | Estado | Evidencia |
|---|---|---|
| Alta individual o por lote: arete, nacimiento o ingreso, sexo, raza, procedencia, potrero | PASS | `AltaGanado.tsx` y `registerBovinoAnimals`. Arete validado en vivo. |
| Lotes y potreros; mover un lote o animales en dos toques con fecha (ocupación) | PASS | `MoverSheet`, `moveBovinoLot`/`moveBovinoAnimals` (evento `movimiento` con fecha), `paddockOccupancyHistory`. |
| Historial individual (línea de tiempo) | PASS | `AnimalTimeline.tsx` y `animalTimeline()`. |
| Pesaje anterior a la fecha de ingreso | **ISSUE-09** | Se acepta sin aviso. |

### 3. Ceba
| Punto | Estado | Evidencia |
|---|---|---|
| Pesajes manuales por lote o individuales, con días desde el último | PASS | `registerWeighings` / `registerLotWeighing`; `PesajeRapido.tsx` pasa de arete en arete con Enter. |
| GMD automática con colores verde, amarillo y rojo | PASS | `gmdColorOf` (prueba: 1.0 verde, 0.417 amarillo, negativa roja). |
| Raciones y conversión alimenticia | PASS | `RacionSheet` y `registerRation`; `buildLotView.feedConversion` = 9.38 en la prueba. |
| Proyección a faena | PASS | `projectedSaleDate` calculada. |

### 4. Lechería y reproducción
| Punto | Estado | Evidencia |
|---|---|---|
| Ordeño por vaca o total del tanque con desglose; curva de lactancia; detección de caídas | PASS | `OrdenoRapido.tsx`, `CurvaLactancia.tsx`, `detectMilkDrop` (40 %). |
| Servicios (monta o IA) con toro o pajuela del inventario | PASS | `registerService` descuenta la pajuela y carga el costo a lechería. |
| Diagnósticos de gestación programados y registrados | PASS | `registerPregnancyDiagnosis` y la agenda `palpar`. |
| FPP y fecha de secado (60 días) | PASS | Verificado. |
| Agenda: PEV, secado, IATF | PASS | Agenda `pev` ("Lista para servicio / IATF") y `secar`. |
| Crías: nacimiento, calostro, destete | PASS | `registerCalving` crea las crías; `registerColostrum`, `registerWeaning`. |

### 5. Sanidad
| Punto | Estado | Evidencia |
|---|---|---|
| El tratamiento descuenta farmacia (animal, lista o lote) | PASS | `treatmentCore`; dosis automática por peso. |
| Retiros en carne y leche bloquean la venta y el envío de leche | PASS | `RETIRO_ACTIVO`; `saleList` y `milkShippingList` (bloqueados); la leche se marca `discarded`. |
| Venta de leche limitada a la leche apta | **ISSUE-04** | `registerMilkSale` no valida los litros disponibles. |
| Historial clínico (diagnóstico, síntomas, efectividad) | PASS | `TratamientoSheet` y `SanidadHub` (Evaluar → `updateTreatmentOutcome`). |

### 6. KPIs
| Punto | Estado | Evidencia |
|---|---|---|
| Ceba: GMD promedio, alimento por kg, costo por animal, próximos a venta | PASS | `cebaKpis` y `ReportesKpi.tsx`. |
| Leche y reproducción: tasa de preñez, días abiertos, IEP, litros por día y por vaca | PASS | `dairyKpis` (prueba: preñez 50 %, días abiertos 63, IEP 199, 12 L/vaca/día). |
| Valorización del almacén y del hato por categoría | PASS | `bovinoInventoryValuation`, `herdValuation` (sin NaN, también con la granja vacía). |

### 7. Balance
| Punto | Estado | Evidencia |
|---|---|---|
| Ceba separada de lechería y cría | PASS | `bovinoUnitBalance` y `BalanceBovino.tsx` (solo admin). |
| Ingresos manuales (leche, en pie o canal, crías o descarte) | PASS | `registerAnimalSale` / `registerMilkSale` / `registerIncome`. |
| Costos directos automáticos por salida | PASS | Ceba: alimento 600 y compra 1500 como directos. Lechería: sal 20 y farmacia. |
| Gastos fijos prorrateados | PASS | Prorrateo 30/70, por configuración o por cabezas. |
| Utilidad bruta y neta por rango | PASS | Calculadas. |
| Liquidación y cierre de lotes | PASS | `closeBovinoLot` guarda la liquidación con compra, alimento, sanidad e indirectos. |
| Costo por litro, costo por kg, flujo de caja del mes | PASS | `bovinoMonthCashFlow`. |

### Puntos de campo
| Punto | Estado | Evidencia |
|---|---|---|
| Modo manga: arete, acción del día y dosis por peso | PASS | `mangaLookup` (prueba: tarea con dosis de 5 ml para 248 kg) y `ModoManga.tsx` (teclado propio, superposición). |
| Lista de trabajo diaria | PASS | `bovinoAgenda` y `AgendaDia.tsx` (Vencidas, Hoy, Mañana, Semana; "Lote X: cumple retiro … mañana"). |

### Puntos técnicos
| Punto | Estado | Evidencia |
|---|---|---|
| Hechos como documentos de evento independientes con `createdBy` | PASS | Todos los eventos y registros financieros tienen `id`, `createdAt`, `createdBy` y `createdByName` (verificado). El animal no tiene arrays crecientes. |
| Fusión sin conexión sin sobrescribir | **ISSUE-02** | El stock del almacén y los documentos de animal, lote y tarea se reescriben completos (`batch.set` sin merge). |
| UI de campo: alto contraste, botones grandes, teclado numérico | PASS (lectura) | Sin `text-[9-11px]` en `bovino/`; `BigNumberInput`/`AreteInput` con `inputMode`; botones `h-12`/`h-14`. **Nadie lo ha probado todavía en un navegador ni en un teléfono.** |
| Topes con confirmación y estados excluyentes | PASS | Ver la sección 1.1. |
| Moneda dual con la tasa del día guardada | PASS | `BovinoMoney {usd, local, currency, rate}` en cada registro y en `FinancialMovement` (`amountLocal`, `exchangeRate`). |
| Roles: el operario no ve costos ni balances **dentro del módulo** | PASS | `permsForRole`; `BalanceBovino` muestra `BlockedNotice`; los smoke tests de UI lo verifican por rol. |
| Roles: el operario no ve balances **fuera del módulo** | **ISSUE-03** | Balance global y Home. |
| Bitácora | PASS | `bovino_audit` registra salidas, entradas, muertes, ventas, autorizaciones, finanzas y borrados. Hay pantalla de bitácora para el admin. |
| Exportación PDF/CSV/WhatsApp y respaldo | PASS (con salvedad) | `ExportarScreen.tsx`. En Android nativo no hay plugin de archivos (ver ISSUE-08). |

### Integración y regresiones
| Punto | Estado | Evidencia |
|---|---|---|
| Migración de los bovinos existentes | **ISSUE-01** | Los tipos se normalizan bien ("Becerro" → cría; "Vaca Lactante" → vaca lactando, que puede ordeñarse; `vaca_seca` → seca; Padrote con Descarte → descarte), pero la fecha de ingreso se recalcula cada día. |
| Tarjeta bovina del Home con datos reales | PASS | Crías, Levante, Novillas, Vacas, Toros y Ceba salen de `bovinoHerdCounts`, más la leche de hoy y las tareas pendientes de hoy. Compatibilidad con padrotes, becerros y vacas. |
| Porcino y avícola | PASS | tsc y build sin errores. `appendMovement` solo lo usaba `BovinoModal`. El back handler del avícola no cambió. |
| Login | PASS | `views/auth/` sin cambios; la sesión llega a `setCurrentUser`. |
| Actividades, Almacén y Balance por rubro (porcino y avícola) | PASS | Las ramas no bovinas de `RubroPanels` no cambiaron (solo se agregó `rubro !== 'bovino'`). |
| Granja vacía no falla | PASS | `emptyBovinoState`: Home, balance y KPIs sin NaN. El Hato muestra el estado vacío "1. Crear potrero → 2. Ingresar ganado" (smoke UI). |
| Sin fechas fijas ni datos de ejemplo | PASS | No hay literales `20xx-` en `bovino/` ni en `models/bovino*`. `BOVINO_DEFAULT_CONFIG` solo trae constantes técnicas. |

---

## 3. Issues

| ID | Severidad | Área | Archivo | Descripción | Cómo reproducir |
|---|---|---|---|---|---|
| ISSUE-01 | **alto** | datos | `web/src/models/bovinoDomain.ts` (`normalizeBovinoAnimal`, rama de legado) | Los documentos del modal antiguo no traen `birthDate`, `updatedAt` ni `createdAt` (ver `BovinoModal` en HEAD). La normalización usa `entryDate = today` **en cada lectura**, y `buildBovinoIndex` agrega el peso de ingreso (`entryWeightKg`) como un punto en esa fecha. Cualquier pesaje real queda tapado al día siguiente por el peso antiguo. Prueba: pesaje de 260 kg ayer, peso de ingreso 200 → peso actual 200 y GMD de **−60 kg/día (rojo)**. Además, las fechas de ingreso, ocupación y la línea de tiempo cambian a diario hasta que una acción reescriba el documento. | `qa1/qa-legacy.ts`: normalizar `{type:'Becerro', weight:200}`, `registerWeighings` con la fecha de ayer, volver a normalizar → `weightKg` 200, `gmdKg` −60. |
| ISSUE-02 | **alto** | datos | `web/src/services/dbService.ts` (`upsertOps` + `batch.set` sin merge); `web/src/models/bovinoDomain.ts` (`applyStockOut`, `purchaseBovinoItem`, `moveBovinoAnimals`, `updateBovinoAnimal`) | La fusión sin conexión no es segura para el **stock**. `quantity` del `WarehouseItem` se guarda como un valor absoluto calculado en cada teléfono. Si dos usuarios sin conexión sacan 10 y 5 unidades de 100, quedan 90 o 95 (gana la última escritura), mientras que los eventos `salida` sí suman 15. Lo mismo pasa con el documento del animal: `set` completo, así que un `updateAnimal` (nombre o raza) y un `moveAnimals` simultáneos se pisan. El requerimiento 1 de los puntos técnicos pide fusionar "sin sobrescribir". | Dos clientes sin conexión con el mismo insumo; cada uno hace `stockOut`; al sincronizar, `quantity` ≠ stock inicial − suma de las salidas. |
| ISSUE-03 | **alto** | funcional | `web/src/components/mockup/RubroPanels.tsx` (panel Balance), `web/src/components/mockup/HomeDashboard.tsx` (resumen financiero / `byRubro`), `web/src/App.tsx` (`openBalance` desde el Home) | El **operario ve el balance bovino** fuera del módulo. Desde el Home, la BottomNav global › Balance › Bovino muestra `TabBalance rubro="bovino"` con los ingresos y egresos del rubro. La tarjeta financiera del Home muestra la utilidad "Bovina". Solo el botón "Ver balance ceba vs leche" se oculta. El requerimiento dice: "Operario / Ordeñador: … No ve costos ni balances". | Iniciar sesión como Operador → Home → Balance → elegir Bovino. |
| ISSUE-04 | medio | datos | `web/src/models/bovinoDomain.ts` (`registerMilkSale`) | La venta de leche no valida los litros disponibles: no se compara con la producción apta del día ni descuenta la leche descartada por retiro. Se puede vender 100 000 L sin ordeños. La UI propone por defecto la leche apta (`OrdenoRapido`, `VentaLecheSheet`), pero el campo manual permite cualquier cifra. Esto debilita el bloqueo "envío de leche" del requerimiento 5. | `registerMilkSale({liters:100000, pricePerLiter:{amount:0.5}})` → OK (prueba `qa-domain`). |
| ISSUE-05 | medio | integracion | Reglas de Firestore (fuera de `web/src`) | Las colecciones `bovino_*` siguen con reglas abiertas. Los permisos por rol (incluido "el operario no ve costos") solo se aplican en el cliente: cualquier usuario autenticado puede leer `bovino_finance` y `movements` directamente. | Pendiente que ya declaró el equipo. |
| ISSUE-06 | medio | funcional | `web/src/components/mockup/bovino/reportes/ReportesKpi.tsx`, `almacen/Kardex.tsx` | Falta el **comparativo de minerales por lote y por mes** (requerimiento 1: "auditar cuántos kilos consume un lote de engorde al mes vs. el lote de vacas lecheras"). El dato existe (`salida.kgEquivalent` + `destination.lotId`), pero solo se ve fila por fila en el kardex. | Más › Reportes: no hay ninguna vista de kg de minerales por lote y mes. |
| ISSUE-07 | medio | ux | Todo `web/src/components/mockup/bovino/` | La UI no se ha probado en un navegador ni en Capacitor (solo tsc, build y SSR). Faltan pruebas manuales de: teclado de la manga, Enter en el pesaje y el ordeño rápidos, botón Atrás de Android con hojas abiertas y con la manga, y contraste al sol. | Probar en el MobileDeviceFrame y en el APK. |
| ISSUE-08 | bajo | integracion | `web/src/components/mockup/bovino/exportar/share.ts` | En Android nativo el PDF, el CSV y el respaldo JSON dependen de Web Share o `window.open`. Sin `@capacitor/filesystem` ni `@capacitor/share`, la descarga puede fallar en el WebView. | Exportar un PDF desde el APK. |
| ISSUE-09 | bajo | datos | `web/src/models/bovinoDomain.ts` (`registerWeighings`, `registerMilkings`, `applyTreatment`) | No se valida que la fecha del evento sea igual o posterior a `entryDate` o `birthDate` del animal: se aceptan pesajes u ordeños anteriores a su ingreso. Esto agrava ISSUE-01. | `qa-legacy.ts`: pesaje con la fecha de ayer para un animal con fecha de ingreso de hoy → OK. |
| ISSUE-10 | bajo | datos | `web/src/models/bovinoCalc.ts` (`byChrono`) | Dos eventos del mismo animal con igual `date` y `createdAt` (por ejemplo secado y parto guardados en el mismo milisegundo) no tienen un orden determinista. Lo reportó Dev B; se sugiere desempatar por `kind` o por `id`. | Muy improbable en uso normal. |
| ISSUE-11 | bajo | funcional | `web/src/controllers/FarmController.ts` (`handleCompleteTask`/`handleToggleTaskStatus` → `completeBovinoTask` con `confirm:true`) | Completar una tarea bovina desde el Centro de alertas o desde Actividades confirma en silencio los valores fuera de rango (por ejemplo una dosis > 150 %), sin el "Corregir / Sí, es correcto" del módulo. | Tarea bovina con dosis manual alta → completarla desde Alertas. |
| ISSUE-12 | bajo | datos | `web/src/services/dbService.ts` (`upsertOps`) | `upsertOps` sobrescribe `updatedAt` con la hora de guardado en **todos** los documentos, incluidos los eventos recién creados. El `updatedAt` del sello (`Draft.edited`) ya no distingue "editado" de "creado", y `updatedBy` puede quedar sin pareja. Es el mismo patrón que en el resto de la app. | Crear un pesaje → el documento en Firestore tiene `updatedAt` sin `updatedBy`. |

---

## 4. Decisiones a confirmar con la usuaria (no son defectos)
1. **Veterinario / Encargado sin montos** (`ver_costos` solo para el admin). El requerimiento no lo prohíbe; la especificación UX sí pedía que viera el costo de insumos y tratamientos. La UI sigue al dominio.
2. **Configuración solo del admin**: el veterinario ve los parámetros reproductivos y el plan sanitario en modo lectura.
3. **Muerte reportada por el operario** como observación "por confirmar"; Traslado y Robo se registran como `registerDiscard` con su causa.
4. **Venta con retiro**: hace falta un motivo de al menos 5 caracteres (queda `autorizar` en la bitácora).
5. **Compras = inventario**: el costo entra a la unidad con la salida; la salida solo genera egreso si el insumo no se cargó como gasto al comprarlo. El Balance global (`TabBalance` rubro bovino) muestra caja (compras) y el balance del módulo muestra devengado (salidas). Los dos números no coinciden por diseño.
6. El costo por litro usa los litros ordeñados, **incluidos los descartados por retiro** (`milkLitersInRange`).
