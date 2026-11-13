# Módulo Bovino — Data Hub (modelo, persistencia, dominio y controlador)

Fuente de verdad de los requerimientos: `docs/bovino/00-requerimientos.md`.
Este documento describe la capa de datos que usa la UI del módulo bovino. **No hay pantallas nuevas en esta entrega**; la UI debe consumir exclusivamente `ctrl.bovinoActions`, `ctrl.bovinoHome`, `ctrl.bovinoIndex`, `ctrl.bovinoSelectors` y `ctrl.bovinoPermissions`.

| Archivo | Contenido |
|---|---|
| `web/src/models/bovinoModel.ts` | Tipos (animal, lote, potrero, eventos, finanzas, auditoría, configuración), etiquetas, `BOVINO_DEFAULT_CONFIG`, roles y permisos (`bovinoCan`). Re-exportado por `FarmModel.ts` y `types.ts`. |
| `web/src/models/bovinoCalc.ts` | Cálculos puros y selectores: índice derivado del hato, GMD, reproducción, retiros, leche, agenda, KPIs, valorización, balance por unidad, liquidación, modo manga. |
| `web/src/models/bovinoDomain.ts` | Acciones puras (`BovinoDomainFn`) con validaciones, topes, permisos y bitácora. `normalizeBovinoAnimal` para documentos antiguos. |
| `web/src/services/dbService.ts` | Colecciones `bovino_*`, claves de caché `*_v5_clean`, `FarmChanges` + `saveChanges` (altas y bajas), suscripciones, `getBovinoData`, migración local→nube. |
| `web/src/controllers/FarmController.ts` | Estado bovino, `dispatchBovino`, `bovinoActions`, `setCurrentUser`, selectores, contadores del Home, alertas. |

---

## 1. Principios

1. **Offline-first por eventos.** Cada hecho (pesaje, ordeño, servicio, diagnóstico, parto, tratamiento, salida/entrada de almacén, movimiento de potrero, baja) es un **documento propio** en `bovino_events` con `id`, `createdAt`, `createdBy`, `createdByName`. Dos teléfonos sin conexión crean documentos distintos: al sincronizar Firestore no pisa nada.
2. **Estado derivado.** Peso actual, GMD, lote y potrero actuales, estado reproductivo, retiros, categoría y estado (activo/vendido/muerto/descarte) se calculan en `buildBovinoIndex()` a partir de los eventos. Los campos `lotId`, `paddockId`, `status` del animal son una **caché** que el dominio mantiene; si hay conflicto, los eventos mandan.
3. **Sin arrays crecientes** dentro del animal (el historial es la consulta de eventos por `animalId`).
4. **Ediciones** con `updatedAt / updatedBy / updatedByName` (`Draft.edited`).
5. **Moneda dual** en todo registro con monto: `BovinoMoney { usd, local?, currency?, rate? }`. La tasa usada queda guardada en el documento.
6. **Sin datos de ejemplo.** `BOVINO_DEFAULT_CONFIG` contiene solo constantes técnicas editables (gestación 283 d, PEV 50 d, secado 60 d...). Precios de referencia y tasa arrancan en 0.

---

## 2. Modelo de datos (`models/bovinoModel.ts`)

### 2.1 Sello y moneda
- `BovinoStamp`: `createdAt, createdBy (uid), createdByName, updatedAt?, updatedBy?, updatedByName?` — presente en animal, lote, potrero, evento y registro financiero.
- `BovinoMoney { usd, local?, currency?, rate? }`.
- `BovinoMoneyInput { amount, in?: 'USD' | 'LOCAL', rate? }` — entrada desde la UI. `'LOCAL'` sin tasa (ni en el input ni en la configuración) devuelve error. Conversión: `toBovinoMoney(input, config)`.

### 2.2 Entidades
**`BovinoAnimal`** (colección histórica `bovino`)
`id, tag (arete/código corto, único entre ACTIVOS), name?, sex 'macho'|'hembra', birthDate?, estimatedAgeMonthsAtEntry?, entryDate, breed?, origin 'nacido'|'compra', entryWeightKg?, purchase? {money, supplier?, financeId?}, purpose 'ceba'|'leche'|'cria'|'reproductor', castrated?, initialCategory? (si no hay edad), priorCalvings?, priorLastCalvingDate? (vacas compradas), lotId? / paddockId? / status (caché), statusDate?, motherId?, fatherId?, fatherLabel?, notes?, legacy? (datos del registro antiguo)` + `BovinoStamp`.

**Categoría derivada** (`bovinoCategory`): `cria | levante | novilla | novillo (Novillo/Ceba) | vaca | toro`.
- Vaca: hembra con ≥1 parto (incluye `priorCalvings`).
- Cría: sin destete y edad < `weaningAgeDays` (240).
- Hembra: Levante hasta `levanteMaxDays` (540) o Novilla (o si ya fue servida).
- Macho: Toro si `purpose='reproductor'` y edad ≥ `bullMinAgeDays` (730); Novillo/Ceba si es de ceba, castrado o está en un lote de ceba (pasada la cría); si no, Levante.
- Sin edad conocida: `initialCategory` (o Vaca / Toro / Novillo por sexo y propósito).

**`BovinoLot`** (`bovino_lots`): `id, name, type 'ceba'|'leche'|'cria'|'levante'|'otro', paddockId? (caché), targetSaleWeightKg?, openedAt, closedAt?, status 'abierto'|'cerrado', liquidationId?, notes?`.

**`BovinoPaddock`** (`bovino_paddocks`): `id, name, areaHa?, capacityHeads?, status 'disponible'|'ocupado'|'descanso'|'mantenimiento' (solo 'mantenimiento' es manual; el resto se deriva), restDays?, grass?, notes?`.

### 2.3 Eventos (`bovino_events`, discriminados por `kind`)
Base: `id, kind, date (YYYY-MM-DD), animalId?, lotId?, groupId? (acción masiva), confirmedOutOfRange?, notes?` + sello.

| kind | Campos propios |
|---|---|
| `movimiento` | `scope 'lote'|'animal', fromPaddockId?, toPaddockId?, fromLotId?, toLotId?, heads?` (ocupación de pasto) |
| `pesaje` | `weightKg, method?, heads?, lotAverage?` (individual o promedio de lote) |
| `racion` | `feedName, kg, days?` (forraje propio, sin almacén ni costo) |
| `salida` | `itemId, itemName, category, quantity, unit, kgEquivalent?, unitCost, cost (BovinoMoney), destination {type 'lote'|'animal'|'potrero'|'unidad'|'sanidad', lotId?, animalId?, paddockId?, unit, label}, movementId?, sourceEventId?, mfgLot?` |
| `entrada` | `itemId, itemName, category, quantity, unit, unitCost, total, supplier?, invoice?, mfgLot?, expirationDate?, movementId?` |
| `ordeno` | `shift 'manana'|'tarde'|'unico', liters, tank?, tankEventId? (desglose), discarded?, discardReason?` |
| `servicio` | `method 'monta'|'ia'|'iatf', bullId?, semenItemId?, sireLabel?, technician?, stockOutId?` |
| `diagnostico` | `method 'palpacion'|'ecografia', result 'preñada'|'vacia'|'dudosa', serviceId?, gestationDays?, expectedCalvingDate?` |
| `parto` | `difficulty 'normal'|'asistido'|'cesarea'|'aborto', calves [{animalId?, tag?, sex, weightKg?, alive}], parity?` |
| `calostro` | `hoursAfterBirth, liters?, method?` |
| `secado` | `treatment?` |
| `destete` | `weightKg?` |
| `tratamiento` | `purpose 'preventivo'|'curativo', itemId, productName, pharmacyType?, dose, doseUnit, route?, mfgLot?, diagnosis?, symptoms?, withdrawalMeatDays, withdrawalMilkDays, meatWithdrawalUntil?, milkWithdrawalUntil? (último día bloqueado, inclusive), effectiveness?, weightKgForDose?, stockOutId?, taskId?, cost?` |
| `baja` | `exitType 'venta'|'muerte'|'descarte', cause?, weightKg?, financeId?, withdrawalOverride? {reason, by, byName, at}` |
| `observacion` | `title` |

### 2.4 Finanzas (`bovino_finance`, por `kind`)
- `ingreso` (`BovinoIncome`): `type 'leche'|'ganado_pie'|'ganado_canal'|'cria'|'descarte'|'otro', unit, liters?, kg?, unitPrice?, heads?, animalIds?, lotId?, buyer?, money, movementId?`.
- `gasto` (`BovinoExpense`): `nature 'fijo'|'directo', category (nomina, cercas, electricidad, fletes, combustible, veterinario, mantenimiento, compra_ganado, arriendo, impuestos, otros), concept, unit, cebaPct?, prorateMethod?, lotId?, animalId?, supplier?, money, movementId?`.
- `liquidacion` (`BovinoLiquidation`): `lotId, lotName, snapshot: BovinoLotLiquidation, money (= utilidad)`.

Cada ingreso/gasto crea además un `FinancialMovement` (colección compartida `movements`) con `rubro: 'bovino'`, `businessUnit`, `amountLocal`, `localCurrency`, `exchangeRate`, `sourceId`, `createdBy*`. Así el **Balance global y `finances.byRubro 'Bovina'`** siguen funcionando con los movimientos.

### 2.5 Auditoría (`bovino_audit`)
`BovinoAuditEntry { id, at, uid, name, role, action 'crear'|'editar'|'eliminar'|'autorizar', entity, entityId, summary, data? }`.
Se escribe en: salidas y entradas de almacén, alta/edición/eliminación de insumos, muertes, descartes, ventas (y `autorizar` si se vende con retiro), cada movimiento financiero, eliminaciones de eventos y finanzas, liquidaciones, cambios de configuración, cancelación de tareas, alta/edición de animales, eliminación de lotes/potreros.

### 2.6 Configuración (`bovino_config/default`)
`BovinoConfig`: `localCurrency, exchangeRate, exchangeRateDate, pevDays (50), gestationDays (283), dryOffDaysBeforeCalving (60), diagnosisDaysAfterService (45), calvingAlertDays (15), weaningAgeDays (240), levanteMaxDays (540), bullMinAgeDays (730), minServiceAgeDays (450), gmdGreenKg (0.6), gmdYellowKg (0.3), targetSaleWeightKg (450), weighIntervalDays (30), milkDropPct (30), maxWeightKgByCategory {cria 300, levante 450, novilla 650, novillo 800, vaca 900, toro 1300}, maxLitersPerMilking (40), maxLitersPerCowDay (60), maxGmdKg (2.5), prorateCebaPct (50), prorateMethod 'config'|'cabezas', referencePricePerKgUsd por categoría (0), sanitaryPlan [BovinoSanitaryPlanItem]`.
Plan base editable: aftosa, brucelosis, clostridial, rabia (inactivo), desparasitación, vitaminas ADE (inactivo). `resolveBovinoConfig(raw)` completa campos faltantes.

### 2.7 Almacén bovino (extensión compatible de `WarehouseItem`)
Insumos con `rubro: 'bovino'` y campos opcionales nuevos: `bovinoCategory 'alimentos'|'minerales'|'farmacia'|'otros'`, `pharmacyType 'vacuna'|'desparasitante'|'antibiotico'|'hormona'|'vitamina'|'material'|'pajuela'|'otro'`, `storage` (bodega/silo), `mfgLot`, `expirationDate`, `withdrawalMeatDays`, `withdrawalMilkDays`, `dosePerKg`, `dosePerHead`, `doseUnit`, `kgPerUnit`, `createdBy*`.
La categoría genérica se mantiene (`farmacia → 'medicinas'`, alimentos/minerales → `'alimentos'`) para que el `WarehouseModal` y `itemMatchesRubro(i,'bovino')` sigan funcionando.
**Farmacia**: `mfgLot` y `expirationDate` obligatorios; una compra con otro lote del fabricante crea una fila nueva (mismo nombre, otro lote/vencimiento). Un insumo vencido no puede usarse (`VENCIDO`).

### 2.8 Otros cambios de tipos
- `FarmSummary.counts.bovino`: se mantienen `padrotes | becerros | vacas` (compatibilidad del Home) y se agregan opcionales `crias, levante, novillas, novillos, vacasParidas, toros, enOrdeno, total`. Mapeo de compatibilidad: `padrotes = toros`, `becerros = crías + levante + novillos`, `vacas = vacas + novillas`.
- `SanitaryTask`: opcionales `planItemId, animalIds, treatmentEventIds, createdBy*`.
- `FinancialMovement`: opcionales `businessUnit, amountLocal, localCurrency, exchangeRate, sourceId, createdAt, createdBy, createdByName`.
- El tipo antiguo se renombró a `LegacyBovinoAnimal` (lo usan `BovinoModal` y `BovinoController` antiguos). `BovinoAnimal` es ahora el modelo nuevo.

---

## 3. Colecciones Firestore y caché (`dbService.ts`)

Todo bajo `farms/{FARM_ID}/`:

| Colección | Clave local | Contenido |
|---|---|---|
| `bovino` (histórica) | `pecuario_local_bovino_v5_clean` | Animales (antiguos se normalizan al leer) |
| `bovino_lots` | `pecuario_local_bovino_lots_v5_clean` | Lotes |
| `bovino_paddocks` | `pecuario_local_bovino_paddocks_v5_clean` | Potreros |
| `bovino_events` | `pecuario_local_bovino_events_v5_clean` | Eventos (un documento por hecho) |
| `bovino_finance` | `pecuario_local_bovino_finance_v5_clean` | Ingresos, gastos, liquidaciones |
| `bovino_audit` | `pecuario_local_bovino_audit_v5_clean` | Bitácora |
| `bovino_config` (`default`) | `pecuario_local_bovino_config_v5_clean` | Configuración |
| `tasks`, `movements`, `warehouse` | (compartidas) | Tareas `targetRubro:'bovino'`, movimientos `rubro:'bovino'`, insumos `rubro:'bovino'` |

`FarmChanges` agrega `bovinoAnimals, bovinoLots, bovinoPaddocks, bovinoEvents, bovinoFinance, bovinoAudit, bovinoConfig` y los borrados `deletedBovinoAnimals, deletedBovinoLots, deletedBovinoPaddocks, deletedBovinoEvents, deletedBovinoFinance` (+ los compartidos `deletedTasks, deletedMovements, deletedWarehouseItems`). `saveChanges` los escribe en un único `writeBatch` (troceado en 450) y fusiona la caché local.

Nuevos métodos: `subscribeBovinoLots / Paddocks / Events / Finance / Audit / Config`, `saveBovinoConfig`, `getBovinoData()` (carga única para respaldo/exportación). `subscribeBovinoHerd` entrega documentos crudos: el controlador aplica `normalizeBovinoAnimal`. `migrateLocalToCloud` incluye las colecciones nuevas.

**Normalización de documentos antiguos** (`normalizeBovinoAnimal`): `type 'padrote'` → macho/toro/reproductor; `'becerro'` → macho/cría (o levante si "destete")/ceba; `'novilla'` → hembra/novilla; `'vaca_lactante' | 'vaca_seca'` → hembra/vaca/leche con 1 parto previo (lactando o seca según el tipo); `weight → entryWeightKg`; `status 'Descarte' → 'descarte'`; el texto `paddock` pasa a `notes`; todo lo original queda en `legacy`. No se reescribe el documento hasta que una acción lo modifique.

---

## 4. Contrato del dominio (`models/bovinoDomain.ts`)

```ts
type BovinoDomainFn<I> = (state: BovinoState, input: I) => BovinoDomainResult;
interface BovinoState extends BovinoData { tasks; movements; warehouseItems; config: BovinoConfig; actor: BovinoActor }
type BovinoDomainResult =
  | { ok: true; state; changed; deleted; configChanged?; message; meta? }
  | { ok: false; error: string; code?: BovinoErrorCode; needsConfirmation?: boolean; warnings?: string[] };
```

**Códigos de error** (`code`): `VALIDACION`, `NO_ENCONTRADO`, `SIN_PERMISO`, `FUERA_DE_RANGO` (con `needsConfirmation: true`), `ARETE_DUPLICADO`, `ESTADO_EXCLUYENTE`, `RETIRO_ACTIVO` (con `needsConfirmation: true`), `VENCIDO`, `STOCK_INSUFICIENTE`.

**Flags de confirmación**
- Valores fuera de rango lógico → `{ ok:false, code:'FUERA_DE_RANGO', needsConfirmation:true, warnings:[...] }`. La UI muestra `warnings` y reintenta **la misma acción con `confirm: true`**; el documento queda con `confirmedOutOfRange: true`.
- Venta con retiro de carne activo → `{ code:'RETIRO_ACTIVO', needsConfirmation:true, warnings }`. `confirm` NO basta: hay que reenviar con `overrideWithdrawalReason` (≥ 5 caracteres). Queda en `baja.withdrawalOverride` y en la bitácora (`action:'autorizar'`).
- Patrón TypeScript del proyecto: usar `'error' in res` / `res.ok === false` y castear a `BovinoDomainError` para leer `needsConfirmation`.

**Topes** (de la configuración): peso > `maxWeightKgByCategory[categoría]`; GMD > `maxGmdKg` o pérdida > 1.5 kg/día respecto al pesaje anterior; litros por ordeño > `maxLitersPerMilking`; litros vaca/día > `maxLitersPerCowDay`; ordeño duplicado del mismo turno; tanque > vacas en ordeño × tope; desglose del tanque que no cuadra (±5 %); potrero en mantenimiento o sobre su capacidad; servicio antes del PEV, a novilla sin edad mínima o < 18 días del anterior; parto sin preñez confirmada, > 30 días antes de la FPP o < 240 días del parto anterior; cría > 80 kg; destete < 90 días; secado sin preñez o > 15 días antes de lo sugerido; dosis > 150 % de la calculada por peso; registrar farmacia ya vencida; cierre de lote con animales activos.

**Estados excluyentes**: servicio a vaca **preñada** o **seca** → `ESTADO_EXCLUYENTE`; ordeño de vaca seca o de macho; secar una vaca seca/no lactante; destetar dos veces; cualquier acción sobre un animal no activo; cambiar el sexo con historial reproductivo.

### 4.1 Permisos por rol
`bovinoRoleOf(role)`: Operador/Trabajador → **operario**; Veterinario → **encargado**; Administrador → **propietario**.

| Permiso | operario | encargado | propietario |
|---|:-:|:-:|:-:|
| `carga_diaria` (ordeño, pesaje, parto/nacimiento, calostro, destete, ración, salida de alimentos/minerales, observación) | ✔ | ✔ | ✔ |
| `manejo` (alta/edición/movimiento de animales, lotes, potreros, reproducción, sanidad, farmacia, compras de almacén, muertes y descartes, tareas) | | ✔ | ✔ |
| `ver_costos` (la UI oculta costos, precios y balances) | | | ✔ |
| `administrar` (ventas, ingresos, gastos, cierre/liquidación, configuración, eliminar insumos/lotes/potreros/finanzas, editar costo unitario, eliminar eventos ajenos) | | | ✔ |

Sin permiso → `{ ok:false, code:'SIN_PERMISO' }`. El operario puede borrar **sus propios** registros de carga diaria del mismo día; el resto de eliminaciones es de administrador.

### 4.2 Acciones (`ctrl.bovinoActions.*`)
Todas aceptan fechas `YYYY-MM-DD` (por defecto hoy; nunca futuras) y devuelven `BovinoDomainResult`.

| Acción | Input principal | Permiso | Validaciones / efectos | `meta` |
|---|---|---|---|---|
| `createPaddock` | `{name, areaHa?, capacityHeads?, restDays?, grass?, status?}` | manejo | nombre único | `paddockId` |
| `updatePaddock` | `{paddockId, patch}` | manejo | | |
| `deletePaddock` | `{paddockId}` | administrar | sin historial de ocupación | |
| `createLot` | `{name, type, paddockId?, targetSaleWeightKg?, openedAt?}` | manejo | nombre único entre abiertos; crea evento de ocupación | `lotId` |
| `updateLot` | `{lotId, patch}` | manejo | | |
| `deleteLot` | `{lotId}` | administrar | solo si nunca tuvo animales/registros | |
| `closeLot` | `{lotId, date?, includeIndirect?, confirm?}` | administrar | confirma si quedan animales; lote de ceba → documento `liquidacion` | `liquidationId, liquidation` |
| `registerAnimals` | `{animals:[{tag, sex, birthDate?, estimatedAgeMonths?, weightKg?, breed?, purpose?, initialCategory?, castrated?, motherId?, fatherId?, priorCalvings?, priorLastCalvingDate?, price?}], origin, entryDate?, lotId?, paddockId?, purpose?, breed?, supplier?, pricing? {mode 'por_kg'|'por_cabeza'|'total', price}, confirm?}` | manejo | arete obligatorio y único (lista y activos), tope de peso; compra → gasto `compra_ganado` directo por unidad + egreso dual; movimiento inicial a lote/potrero | `animalIds` |
| `updateAnimal` | `{animalId, patch}` | manejo | arete único | |
| `moveAnimals` | `{animalIds, toPaddockId?, toLotId? (null = sacar del lote), date?, confirm?}` | manejo | capacidad/mantenimiento con confirmación; si cambia de lote sin potrero toma el del lote | `moved` |
| `moveLot` | `{lotId, toPaddockId, date?, confirm?}` | manejo | mueve el lote completo (todos sus animales heredan el potrero) | `eventId` |
| `registerWeighings` | `{items:[{animalId, weightKg}], date?, method?, confirm?}` (lista rápida) | carga_diaria | topes de peso y GMD | `results[{animalId, tag, weightKg, prevKg, days, gmdKg, color}], avgGmdKg` |
| `registerLotWeighing` | `{lotId, avgWeightKg, heads?, date?, confirm?}` | carga_diaria | pesaje promedio de lote | |
| `registerRation` | `{lotId, feedName, kg, days?, date?}` | carga_diaria | forraje sin almacén (cuenta para conversión, sin costo) | |
| `addItem` | `{name, bovinoCategory, pharmacyType?, unit, quantity, unitPrice, minAlertThreshold?, storage?, supplier?, invoice?, mfgLot?, expirationDate?, withdrawalMeatDays?, withdrawalMilkDays?, dosePerKg?, dosePerHead?, doseUnit?, kgPerUnit?, registerPurchase? (def. true), date?, confirm?}` | manejo | farmacia: lote y vencimiento obligatorios; vencido → confirmación; compra → evento `entrada` + egreso dual | `itemId` |
| `purchaseItem` | `{itemId, quantity, unitPrice, supplier?, invoice?, mfgLot?, expirationDate?, date?, confirm?}` | manejo | costo promedio ponderado; otro lote del fabricante → fila nueva; regulariza stock inicial sin egreso | `itemId` |
| `updateItem` | `{itemId, patch (incl. unitCostUsd)}` | manejo (costo: administrar) | | |
| `deleteItem` | `{itemId, reason?}` | administrar | bitácora | |
| `stockOut` | `{itemId, quantity, destination {type 'lote'|'animal'|'potrero'|'unidad'|'sanidad', lotId?, animalId?, paddockId?, unit?}, date?}` | carga_diaria (alimentos/minerales) / manejo (farmacia, otros) | destino obligatorio; vencido bloqueado; stock suficiente; costo directo de la unidad; egreso solo si el insumo no se llevó a gasto al comprarlo | `eventId, costUsd, unit` |
| `registerMilkings` | `{shift, items:[{animalId, liters}], date?, confirm?}` | carga_diaria | hembra, no seca; topes; vaca con retiro de leche → `discarded:true` | `totalLiters, discardedLiters` |
| `registerTankMilking` | `{shift, liters, breakdown?, date?, confirm?}` | carga_diaria | desglose opcional por vaca (no suma doble) | `eventId, discardedLiters` |
| `registerService` | `{animalId, method, bullId?, semenItemId?, sireLabel?, technician?, date?, confirm?}` | manejo | **rechaza preñada/seca**; pajuela descuenta 1 unidad (costo lechería) | `eventId, diagnosisDate` |
| `registerDiagnosis` | `{animalId, method, result, gestationDays?, date?}` | manejo | preñada sin servicio exige `gestationDays`; calcula FPP | `fpp, dryOffDate` |
| `registerCalving` | `{motherId, difficulty, calves:[{tag?, name?, sex, weightKg?, alive}], calvesLotId?, date?, confirm?}` | carga_diaria | crea las crías vivas (madre/padre, arete automático `madre-<parto><A,B>` si falta) | `calfIds, pevDate` |
| `registerColostrum` | `{animalId, hoursAfterBirth, liters?, method?, date?}` | carga_diaria | solo crías | |
| `registerDryOff` | `{animalId, treatment?, date?, confirm?}` | manejo | debe estar lactando | |
| `registerWeaning` | `{items:[{animalId, weightKg?}], toLotId?, date?, confirm?}` | carga_diaria | | |
| `applyTreatment` | `{animalIds? | lotId, itemId, dose? (por animal; omitida = dosis automática), route?, purpose, diagnosis?, symptoms?, date?, taskId?, confirm?}` | manejo | farmacia no vencida, stock total; un evento por animal; retiro carne/leche desde el insumo; salida única por lote o una por animal | `eventIds, totalQty, costUsd` |
| `updateTreatmentOutcome` | `{eventId, effectiveness}` | manejo | historial clínico | |
| `addTask` | `{title, date, lotId? | animalIds?, itemId?, dose?, procedure?, activityKind?, planItemId?}` | manejo | `SanitaryTask` `targetRubro:'bovino'` con `loteId` / `animalId(s)` | `taskId` |
| `scheduleSanitaryPlan` | `{planItemIds, lotId? | animalIds?, startDate}` | manejo | tareas desde el plan base | `taskIds` |
| `completeTask` | `{taskId, itemId?, dose?, route?, date?, confirm?}` | manejo | aplica el tratamiento (descuenta farmacia) y reprograma si `everyDays > 0` | `eventIds, nextTaskId` |
| `reopenTask` / `cancelTask` | `{taskId}` / `{taskId, reason?}` | manejo | reabrir exige borrar antes las aplicaciones | |
| `registerDeath` | `{animalId, cause, weightKg?, date?}` | manejo | bitácora; cancela tareas del animal | `eventId` |
| `registerDiscard` | `{animalId, cause, date?}` | manejo | bitácora | `eventId` |
| `registerAnimalSale` | `{animalIds, mode 'pie'|'canal', weights?, carcassKg?, pricePerKg? | total?, buyer?, incomeType?, overrideWithdrawalReason?, date?, confirm?}` | administrar | **retiro de carne activo → `RETIRO_ACTIVO`** salvo override; ingreso por unidad (proporcional a kg); bajas + bitácora | `totalUsd, kg, financeIds` |
| `registerMilkSale` | `{liters, pricePerLiter, buyer?, date?}` | administrar | ingreso lechería | `financeId, totalUsd` |
| `registerIncome` | `{type, unit, amount, liters?, kg?, heads?, lotId?, buyer?, date?}` | administrar | | `financeId` |
| `registerExpense` | `{nature 'fijo'|'directo', category, concept, amount, unit?, prorateMethod? 'config'|'cabezas'|'manual', cebaPct?, lotId?, animalId?, supplier?, date?}` | administrar | fijo → unidad general con % ceba guardado | `financeId, cebaPct` |
| `deleteFinance` | `{financeId, reason}` | administrar | borra el movimiento; venta → revierte las bajas; liquidación → reabre el lote | |
| `addNote` | `{animalId? | lotId?, title, notes?, date?}` | carga_diaria | | |
| `deleteEvent` | `{eventId, reason}` | administrar (o el autor, carga diaria del día) | revierte: stock, egresos, crías sin historial, bajas sin venta, caché de lote/potrero | |
| `updateConfig` | `{patch}` | administrar | rangos (gestación 260-300, PEV 20-120, verde > amarillo, prorrateo 0-100, moneda si hay tasa) | |
| `notify(msg)` | | | toast | |

---

## 5. Cálculos y selectores exportados (`models/bovinoCalc.ts`)

- **Índice**: `buildBovinoIndex(data, config, today) → BovinoIndex { views: Map<id, BovinoAnimalView>, list, active, eventsByAnimal, eventsByLot, lotsById, paddocksById, byTag }`.
  `BovinoAnimalView`: `tag, label ('#402 Lucero'), status, active, exitDate, sex, ageDays, ageMonths, category, categoryLabel, purpose, unit ('ceba'|'leche'|'general'), lotId, lotJoinDate, lotHistory, paddockId, paddockSince, weights[], weightKg, weightDate, prevWeightKg, gmdKg (último intervalo), gmdColor, gmdLifetimeKg, daysSinceWeigh, weighOverdue, weaned, colostrum, repro, withdrawal, lastMilkLiters`.
- **Categoría / edad**: `bovinoCategory`, `effectiveBirthDate`, `normalizeTag`, `isTagAvailable`.
- **GMD**: `gmdColorOf(gmd, cfg)` → `'verde'|'amarillo'|'rojo'|'sin_dato'`; por lote en `buildLotView`.
- **Lote**: `buildLotView(lot, data, idx)` → cabezas, potrero y días de ocupación, peso promedio, GMD promedio y color, GMD por pesajes promedio, **proyección de faena** (`daysToTarget`, `projectedSaleDate`), alimento kg, kg producidos, **conversión alimenticia**, costo directo, pesajes atrasados, animales en retiro. `lotPaddock`, `lotMembers`, `lotKgProduced`, `projectSaleDate(view, kg, today)`.
- **Potreros**: `buildPaddockViews` (cabezas, días de ocupación o descanso, estado derivado, carga/ha, sobrecapacidad), `paddockOccupancyHistory(paddockId, data, today)`.
- **Reproducción**: `reproInfoOf` → `state 'vacia'|'servida'|'preñada'|'seca'|'parida'|'lactando'|'no_aplica'` (excluyentes), `pregnant, lactating, dried, parity, lastCalvingDate, daysSinceCalving, pevDate, pevReached, lastServiceDate, servicesSinceCalving, pendingDiagnosis, diagnosisDueDate, conceptionDate, fpp (= servicio + gestación), dryOffDate (= FPP − secado), daysOpen, calvingIntervals, iepDays`.
- **Retiros**: `withdrawalOf(events, today)` → `meatUntil, milkUntil, meatActive, milkActive, meatDaysLeft, milkDaysLeft, products`; `withdrawalUntil(date, days)` (último día bloqueado = fecha + días − 1). `saleList(idx)` y `milkShippingList(idx)` separan permitidos / bloqueados.
- **Leche**: `dailyMilkProduction(events, date)` (tanque + individuales sin desglose, menos descartes), `milkSeries`, `milkLitersInRange`, `cowDailyLiters`, `lactationCurve(view, events)` (DEL, litros/día), `detectMilkDrop(daily, pct)` (último día vs promedio de los 7 días previos), `milkDropAlerts(idx)`.
- **Almacén**: `bovinoWarehouseItems`, `itemBovinoCategory`, `isItemExpired`, `daysToExpiry`, `isItemCritical`, `criticalBovinoItems`, `kgOfQuantity`, **`autoDose(item, weightKg)`** (peso × dosis/kg redondeado a 0.1, o dosis por cabeza), `bovinoInventoryValuation`.
- **KPIs**: `cebaKpis(data, idx, from?, to?)` (GMD promedio y color, alimento kg, kg producidos, kg alimento / kg producido, costo por animal, próximos a venta ≤ 30 días, pesajes atrasados); `dairyKpis` (en ordeño, secas, preñadas, servidas, vacías, **tasa de preñez**, tasa de concepción, **días abiertos**, **IEP**, producción diaria, **litros/vaca/día**, litros descartados).
- **Valorización**: `herdValuation(idx)` (cabezas × peso promedio × precio de referencia por categoría), `bovinoInventoryValuation(items)`.
- **Balance**: `bovinoUnitBalance(data, idx, from, to)` → por unidad (`ceba`, `leche`): `incomeUsd, directCostUsd, feedCostUsd, healthCostUsd, otherStockCostUsd, directExpensesUsd, indirectCostUsd, totalCostUsd, grossProfitUsd (ingresos − directos), netProfitUsd, marginPct`; `generalCostUsd`, totales, `litersProduced`, **`costPerLiterUsd`**, `kgProducedCeba`, **`costPerKgUsd`**. Criterio devengado: las **compras** de almacén son inventario (flujo de caja); el costo entra a la unidad con la **salida** (costo directo automático). Gastos fijos y salidas a destino "general" se prorratean con su `cebaPct` (o el de la configuración / por cabezas: `headsCebaPct`).
- **Caja**: `bovinoMonthCashFlow(movements, today)` (ingresos/egresos bovinos del mes a la fecha y proyección lineal a fin de mes).
- **Liquidación**: `lotLiquidation(data, idx, lotId, {closeDate?, includeIndirect?})` → `headsIn/Sold/Dead/Active, kgIn, kgOut, kgProduced, purchaseCostUsd, feedCostUsd, healthCostUsd, otherDirectCostUsd, indirectCostUsd, totalCostUsd, incomeUsd, profitUsd, marginPct, roiPct, costPerKgProducedUsd, feedKg, feedConversion, avgDailyGainKg`.
- **Agenda del día**: `bovinoAgenda(data, idx, tasks, items)` → `BovinoAgendaItem { id, kind, priority 'alta'|'media'|'baja', date, overdue, title, detail, animalId?, lotId?, taskId?, itemId?, manga }` con `kind`: `palpar` ("Vaca #402: palpar hoy"), `secar`, `pev` (cumple PEV / lista para IATF), `parto` (FPP en ≤ 15 días), `retiro_fin` ("Lote 3: cumple retiro de Ivermectina mañana", agrupado por lote si aplica a todo el lote), `pesaje_atrasado`, `destete`, `calostro`, `caida_leche`, `tarea` (SanitaryTask bovina de hoy/atrasada), `stock_critico`, `vencimiento`. `bovinoAgendaAlertCount(agenda)`.
- **Modo manga**: `mangaLookup(tag, data, idx, tasks, items, agenda?)` → `{ view, actions:[{agenda, task?, item?, dose (autoDose por el último peso)}], suggestWeighing }`.
- **Home**: `bovinoHomeSummary(...)` → `{ counts, agenda, alertsCount, lots (vistas de lotes abiertos), paddocks, ceba, dairy, cashFlow, inventory, herdValue, criticalItems }`; `bovinoHerdCounts(idx)`; `animalTimeline(animalId, idx)` (historial individual, más reciente primero).
- **Moneda**: `toBovinoMoney`, `scaleMoney`, `sumMoney`, `formatMoney` ("US$ 12.50 · VES 500.00").

---

## 6. Controlador (`FarmController.ts`)

**Usuario actual**: `ctrl.setCurrentUser({ uid, name, role })`. `App.tsx` (FarmApp) ya lo alimenta desde `session.member` en un `useEffect`. `dispatchBovino` inyecta ese actor en el estado del dominio (`state.actor`) → `createdBy`, `createdByName`, permisos y bitácora. Sin sesión se usa `BOVINO_SYSTEM_ACTOR` (Administrador "Sistema").

**Estado expuesto**: `bovinoHerd` (animales normalizados), `bovinoLots`, `bovinoPaddocks`, `bovinoEvents`, `bovinoFinance`, `bovinoAudit`, `bovinoConfig`, `bovinoData`, `bovinoIndex`, `bovinoHome`, `bovinoAgenda`, `bovinoAlertsCount`, `currentUser`, `selectedBovinoLotId`, `selectedBovinoLot`, `selectedBovinoAnimalId`.

**Permisos para la UI**: `ctrl.bovinoPermissions = { role, farmRole, can(perm), cargaDiaria, manejo, verCostos, administrar }` (ocultar costos/balances al operario).

**Selectores bajo demanda**: `ctrl.bovinoSelectors.lotView(lotId)`, `.animal(id)`, `.timeline(id)`, `.lactationCurve(id)`, `.balance(from, to)`, `.liquidationPreview(lotId, includeIndirect?)`, `.manga(tag)`, `.milkShippingList()`, `.saleList()`, `.paddockHistory(paddockId)`.

**Despacho**: `dispatchBovino(fn, input, { silent?, toastErrors? })` aplica la función pura sobre el estado más reciente (refs), actualiza el estado React y persiste solo lo cambiado con `collectBovinoChangedDocs` → `dbService.saveChanges`. Los errores con `needsConfirmation` nunca se muestran como toast (la vista pide confirmación). El éxito muestra `result.message` como toast salvo `silent`.

**Navegación**: `MockupScreen` incluye `'bovino'`; `openBovino()`, `openBovinoLot(lotId|null)`, `openBovinoAnimal(animalId|null)`, `setSelectedBovinoLotId`, `setSelectedBovinoAnimalId`.

**Integración global**:
- `summary.counts.bovino = bovinoHerdCounts(bovinoIndex)` (compatibilidad Home + categorías nuevas).
- `summary.finances.byRubro 'Bovina'` se deriva de los `FinancialMovement` con `rubro:'bovino'` (compras, gastos, ingresos, consumos sin egreso previo).
- Tareas sanitarias bovinas = `SanitaryTask` con `targetRubro:'bovino'` (+ `loteId`, `animalId`/`animalIds`): aparecen en alertas globales y en la pestaña Bovino del `ActivitiesPanel`. `handleCompleteTask` / `handleToggleTaskStatus` las enrutan a `completeBovinoTask` / `reopenBovinoTask`.
- `totalNotifications` suma `bovinoAlertsCount` (agenda relevante sin contar tareas ni stock, que ya se cuentan aparte).
- Legados: `handleAddNewBovino` y `handleRecordMilking` (modal antiguo) ahora usan el dominio nuevo; `handleUpdateBovino` queda deprecado.

---

## 7. Prueba de humo

`scratchpad/bovino/smoke.ts` (esbuild + node): **80 verificaciones, PASS**. Recorre: configuración de moneda dual → potreros y lotes → alta por lote con compra por kg (gasto y egreso dual) → arete duplicado y peso 4500 kg (confirmación) → mover lote y animal (ocupación de potrero) → compras de alimento y farmacia (farmacia vencida bloqueada) → salida de alimento al lote (costo directo ceba, sin doble egreso) → pesajes con GMD verde/rojo y proyección/conversión del lote → tratamiento por lote con dosis automática y retiro (venta bloqueada, lista de leche bloqueada) → servicio IA con pajuela, diagnóstico preñada, FPP y secado, servicio a preñada rechazado → parto con cría y calostro → ordeños, leche descartada por retiro y caída del 40 % → venta de leche en moneda local y venta de animales con override auditado → gasto fijo prorrateado → balance ceba vs lechería, costo/litro, costo/kg, utilidad → liquidación y cierre del lote → agenda (palpar, caída, retiro termina, vencidos) y modo manga → plan sanitario y tarea completada con reprogramación → KPIs, valorización y contadores → normalización de un documento antiguo → eliminación con bitácora → documentos a persistir con `createdBy`.

---

## 8. Pendiente para la capa de UI

1. Construir `components/mockup/bovino/` (BovinoModule pantalla completa, acento sky) consumiendo este contrato.
2. `App.tsx`: `onNavigateToBovino={ctrl.openBovino}` y render de `mockupScreen === 'bovino'`; manejar el botón Atrás de Android para `'bovino'`; retirar `BovinoModal` / `showBovinoModal` cuando el módulo exista (hoy se mantiene para no dejar la opción vacía).
3. `HomeDashboard`: mostrar Crías / Levante / Novillas / Vacas / Toros con los campos nuevos de `counts.bovino`.
4. Almacén bovino: el `WarehouseModal` genérico no exige destino, lote del fabricante ni vencimiento; el almacén del módulo debe usar `bovinoActions.addItem / purchaseItem / stockOut`.
5. Exportación PDF/CSV y respaldo: `dbService.getBovinoData()` entrega todo el módulo; falta la generación de archivos en la UI.
6. Reglas de Firestore (hoy abiertas) para las colecciones `bovino_*`.

## 9. Cambios de la ronda 3 (QA/UX)

- **Reglas (`firestore.rules`)**: el operario puede crear eventos `parto` y `destete`, y el `movimiento` que los acompaña (`scope: 'animal'`, `notes` 'Nacimiento' o 'Destete'). `members`, `invitations` y `access` ya no caen en el catch-all: nadie puede darse un rol a sí mismo (primer Administrador una sola vez con el marcador `access/owner`, el resto solo con invitación pendiente a su correo y con ese rol; roles, bajas e invitaciones = Administrador). `authService.resolveAccess` crea el marcador en lote con el primer Administrador y lo crea al entrar un Administrador de una granja anterior.
- **Compras sin costo**: `BovinoAnimal.purchasePending` (compra sin precio, p. ej. ingresada por el encargado; `RegisterBovinoAnimalsInput.transfer` = traslado, no queda pendiente). `setBovinoPurchaseCost` (`ctrl.bovinoActions.setPurchaseCost`, solo Administrador) carga el costo (total / por kg / por cabeza), crea el gasto `compra_ganado` por unidad y lote con la fecha de ingreso. Selectores: `isPurchaseCostPending`, `pendingPurchaseGroups(idx, lotId?)` (alertas del propietario y aviso en la liquidación).
- **Venta de leche**: el tope arrastra al día siguiente solo lo NO vendido de la producción propia del día anterior (la leche de ayer vendida ayer no se vende dos veces) y rechaza una venta que deje sin respaldo la ya registrada el día siguiente.
- **Ingresos**: `registerBovinoIncome` rechaza los tipos de venta de animales (`ganado_pie`, `ganado_canal`, `cria`, `descarte`): van por `registerAnimalSale` (elige animales, revisa retiros).
- **Servicio**: `BovinoServiceMethod` incluye `'te'` (transferencia de embriones; embrión del almacén `pharmacyType: 'embrion'` o texto embrión / donante). IATF queda como opción de la inseminación en la UI.
- **Mensajes**: las fechas de los mensajes del dominio se muestran legibles ('13 Nov', con año si no es el actual).
- **Borrado de la granja**: `clearAllData` no borra `bovino_audit` (bitácora inmutable por reglas) y le agrega una entrada con quién borró los datos.
