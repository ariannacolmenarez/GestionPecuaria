# Módulo Bovino — QA ronda 2

Fecha de la corrida: 13/11/2026. Todas las fechas de prueba son relativas a `todayISO()`; no hay fechas fijas.
Alcance: verificación sin implementar. Se revisan las correcciones de la ronda 1 y se vuelve a recorrer `00-requerimientos.md` contra el código (`git diff` y archivos nuevos en `web/src`).
No se tocó código de la app. Los scripts están en `C:/Users/SIST-A~1/AppData/Local/Temp/claude/f3a731086bae39dc/ae695200-6cb6-4323-8c2c-80a6b99d33b6/scratchpad/bovino/qa2/`.

## 1. Compilación y pruebas

| Verificación | Resultado |
|---|---|
| `npx tsc --noEmit -p .` | **0 errores** |
| `npx vite build --outDir C:/Users/SIST-A~1/AppData/Local/Temp/qa-build-bovino --emptyOutDir` | **OK** en 11 s (`BovinoModuleView` 72 kB) |
| QA ronda 2 `qa2/qa-r2-full.ts`: flujo completo, casos inválidos, simulación de reglas y migración | **136 / 140**. Las 4 fallas son defectos reales: ISSUE-R2-01, R2-03 y R2-06 |
| Prueba del equipo `r2/test-r2.ts` | 38 / 38 |
| Smoke UI Etapa A `ui-smoke.tsx` (recompilado) | 155 / 155 |
| Smoke Data Hub `smoke.ts` (recompilado) | **78 / 80** (ver ISSUE-R2-05) |
| Smoke UI Etapa B `b/stageb-smoke.tsx` (recompilado) | **172 / 174** (ver ISSUE-R2-05) |
| QA ronda 1 `qa1/qa-domain.ts` | 121 / 123. Las 2 fallas son esperadas: vende 100 L con 44 L producidos |
| Finales de línea | Los 10 archivos modificados siguen 100 % CRLF, igual que en HEAD |

### 1.1 Flujo de `qa-r2-full.ts`
Es el flujo de la ronda 1, con la venta de leche ajustada a la regla nueva, más un bloque nuevo de la ronda 2.

**Flujo completo.** Roles Administrador, Veterinario y Operador; moneda VES con tasa 40.
- **Alta y almacén:**
  - Potreros y lotes.
  - Alta por compra: US$ 1500 / VES 60 000, con la tasa guardada en el `FinancialMovement`.
  - Compras de alimento, farmacia, sal y pajuela.
- **Salidas:** el alimento va al lote de ceba con un costo directo de US$ 600 y sin un segundo egreso; la sal al lote lechero se carga a leche.
- **Ceba:**
  - Pesajes: GMD 1.0 verde, 0.417 amarillo y negativa roja, con 60 días entre pesajes.
  - Ración y proyección a faena.
- **Sanidad:** tratamiento con dosis automática (6.6 ml = 330 kg × 0.02). La venta queda bloqueada (`RETIRO_ACTIVO`) y la leche de la vaca tratada se descarta.
- **Reproducción:**
  - Servicio IA, que descuenta la pajuela.
  - Diagnóstico: FPP = servicio + 283 días; secado = FPP − 60.
  - Secado, parto con cría y calostro.
- **Leche:** ordeños con una caída del 40 % detectada y tanque con desglose.
- **Ventas:**
  - Venta en pie: US$ 775.
  - Venta con retiro: con override auditado.
  - Venta de leche: 100 L con 44 L vendibles se rechaza; 40 L a VES 20 da US$ 20.
- **Balance y cierre:**
  - Gasto fijo 30/70, prorrateado 120 / 280.
  - Balance ceba contra leche, costo por litro y por kg.
  - Liquidación y cierre del lote, con la compra de 1500 y el alimento incluidos.
- **Agenda y manga:** agenda, manga con dosis por peso, tarea completada.
- **Indicadores:** KPIs y valorizaciones.

**Casos inválidos.** Todos se rechazan con el código esperado:

| Caso | Código |
|---|---|
| Arete duplicado (activo, con `#` o espacio, en la lista, de un animal antiguo) | `ARETE_DUPLICADO` |
| 4500 kg, 350 L o dosis > 150 % sin confirmar | `FUERA_DE_RANGO` |
| Servicio a vaca preñada o seca, ordeño a vaca seca o a macho | `ESTADO_EXCLUYENTE` |
| Medicamento vencido en la salida o en el tratamiento | `VENCIDO` |
| Salida sin destino | `VALIDACION` |
| Salida o tratamiento mayor que el stock | `STOCK_INSUFICIENTE` |
| Venta con retiro sin motivo | `RETIRO_ACTIVO` |

**Sin NaN ni Infinity** en el estado completo, el balance, la liquidación, la agenda, el resumen del Home, los KPIs, las valorizaciones y la granja vacía.

**Todos los eventos y registros financieros** tienen `id`, `createdAt`, `createdBy` y `createdByName`. El documento del animal no tiene arrays.

**Bloque de la ronda 2:**
- Simulación de `firestore.rules` sobre los documentos que produce cada acción, por rol (`collectBovinoChangedDocs`).
- Migración de documentos antiguos.
- Doble venta de leche.
- Venta con todo el ordeño en retiro, que se rechaza con 0 L vendibles.
- Textos de error.

---

## 2. Correcciones de la ronda 1

| Issue ronda 1 | Estado | Evidencia |
|---|---|---|
| ISSUE-01: fecha de ingreso de los animales antiguos | **PASS** | `normalizeBovinoAnimal` usa nacimiento, luego creación, luego edición y, si falta todo, una fecha estimada. `FarmController` (suscripción a `bovino`) guarda una sola vez el documento migrado (`isLegacyBovinoDoc` + `migratedBovinoRef`). Prueba: un pesaje de 260 kg da peso 260 y GMD > 0, y `entryDate` no cambia al releer. |
| ISSUE-02: fusión sin conexión | **PASS** (lectura de código) | `dbService.mergeUpsertOps`: los documentos existentes se escriben con `set(merge)` solo con los campos cambiados, `deleteField()` e `increment(delta)` para `warehouse.quantity`. `dispatchBovino` arma `previous`. No se ha probado contra Firestore real con dos clientes. |
| ISSUE-03: balance bovino visible para el operario fuera del módulo | **PASS** | `RubroPanels` muestra el aviso "Balance bovino no disponible". `HomeDashboard` usa `hideBovinoFinance` (totales, tendencia y `byRubro`). |
| ISSUE-04: venta de leche sin validar | **PARCIAL** | Se valida contra la producción vendible, pero queda un hueco: ver **ISSUE-R2-03**. |
| ISSUE-05: reglas abiertas | **PARCIAL** | Hay reglas por rol, pero bloquean la carga diaria del operario (**ISSUE-R2-01**) y el rol se puede autoasignar (**ISSUE-R2-02**). |
| ISSUE-06: minerales por lote y mes | **PASS** | `consumptionByLotMonth` y la pestaña de Reportes (prueba del equipo: 30 L / 12 kg por unidad). |
| ISSUE-07: pruebas manuales en navegador y APK | **ABIERTO** | Sigue sin probarse en el navegador ni en el APK (ISSUE-R2-08). |
| ISSUE-08: exportes en Android nativo | **ABIERTO** | Sin `@capacitor/filesystem` ni `@capacitor/share`. |
| ISSUE-09: eventos con fecha anterior al ingreso | **PASS** | `beforeEntry` (línea 318 del dominio) rechaza pesajes y ordeños anteriores al ingreso. |
| ISSUE-10: orden de `byChrono` | **PASS** | Desempata por tipo y luego por id (prueba: el secado va antes que el parto). |
| ISSUE-11: tareas completadas desde Alertas con `confirm:true` | **PASS** | Ya no se envía `confirm`. |
| ISSUE-12: `updatedAt` en eventos nuevos | **PASS** | En bovino se usa `upsertOps`/`mergeUpsertOps` con `{stamp:false}`. |

---

## 3. Requerimientos contra el código

Leyenda: **PASS** = implementado y verificado (prueba o lectura de código); **ISSUE** = ver la sección 4; **PARCIAL** = cubierto con una salvedad.

### Navegación (prioridad)
| Punto | Estado | Evidencia |
|---|---|---|
| Home › Bovino abre el módulo a pantalla completa | PASS | `App.tsx`: `onNavigateToBovino={() => nav.goBovino()}` → `mockupScreen 'bovino'`. `BovinoModalView` ya no se renderiza. |
| Los contadores del Home abren la lista filtrada | PASS | `onOpenBovinoCategory` → `goBovino({section:'hato', screen:{s:'animales', filtro:{category}}})`. |
| Subpantallas y Atrás: hoja → pila → raíz → Hato → Home | PASS | El Atrás de la cabecera y `useHardwareBackButton` usan el mismo `popRoute` (`bovino/routes.ts`). Primero se ejecuta `runTopBackHandler()` (hojas y manga). |
| La BottomNav global se oculta y BovinoNav la reemplaza | PASS | `{!avicolaLot && !inBovino && <BottomNavView…>}` |
| Almacén, Balance y Actividades del rubro bovino | PASS | Dentro del módulo, `openWarehouse` y `openBalance` llevan a Más › Almacén y Más › Balance, y Actividades lleva a la Agenda. Desde el Home, `RubroPanels` tiene "Abrir almacén bovino", "Ver balance ceba vs leche" (solo si puede ver costos) y abre la Agenda o "+ Actividad". |
| Alertas globales | PASS | `AlertsCenterModal`: "Ir al hato" → Agenda. |

### 1. Inventario y almacén
| Punto | Estado | Evidencia |
|---|---|---|
| Submódulos Alimentos, Minerales, Farmacia y Otros; compras; stock crítico | PASS | `AlmacenBovino.tsx`, `addBovinoItem`/`purchaseBovinoItem`, `isItemCritical` en la agenda. |
| Minerales por lote y mes | PASS | `consumptionByLotMonth`. |
| Farmacia con lote del fabricante y vencimiento obligatorios; uso de vencidos bloqueado | PASS | `VALIDACION` sin lote ni vencimiento. `VENCIDO` en la salida y en el tratamiento. |
| Trazabilidad de salidas: destino obligatorio y costo directo | PASS | La salida sin destino da `VALIDACION`. Las salidas cargan US$ 600 a ceba y la sal a leche. |

### 2. Gestión de animales
| Punto | Estado | Evidencia |
|---|---|---|
| Alta individual o por lote con arete, fechas, sexo, raza, procedencia y potrero | PASS | `AltaGanado.tsx`, `registerBovinoAnimals`. |
| Mover lotes o animales con fecha (ocupación) | PASS | `MoverSheet`, evento `movimiento`. |
| Historial individual | PASS | `AnimalTimeline.tsx`. |

### 3. Ceba
| Punto | Estado | Evidencia |
|---|---|---|
| Pesajes con días desde el anterior; GMD con colores | PASS | 1.0 verde, 0.417 amarillo, negativa roja; 60 días. |
| Raciones y conversión alimenticia; proyección a faena | PASS | `registerRation`, `buildLotView.feedConversion` y `projectedSaleDate`. |

### 4. Lechería y reproducción
| Punto | Estado | Evidencia |
|---|---|---|
| Ordeño por vaca o por tanque, curva de lactancia y caídas | PASS | Caída del 40 % detectada; la curva tiene días en leche finitos. |
| Servicios con toro o pajuela; diagnóstico; FPP y secado a 60 días | PASS | Verificados. |
| Estados excluyentes (preñada o seca) | PASS | `ESTADO_EXCLUYENTE`. |
| Crías: nacimiento, calostro y destete | PARCIAL | El dominio y la UI funcionan. El **operario no puede guardarlos en la nube** (ISSUE-R2-01). |

### 5. Sanidad
| Punto | Estado | Evidencia |
|---|---|---|
| El tratamiento descuenta farmacia; los retiros bloquean venta y leche | PASS | `RETIRO_ACTIVO`; `saleList` y `milkShippingList`. La leche en retiro no es vendible: con todo el ordeño en retiro quedan 0 L vendibles. |
| Venta de leche limitada a la leche apta | PARCIAL | ISSUE-R2-03 |
| Historial clínico | PASS | `SanidadHub`, `updateTreatmentOutcome`. |

### 6. KPIs y 7. Balance
| Punto | Estado | Evidencia |
|---|---|---|
| KPIs de ceba, leche y reproducción; valorizaciones | PASS | Sin NaN, también con la granja vacía. |
| Ceba separada de leche y cría; costos directos automáticos; prorrateo; utilidad; liquidación; costo por litro y por kg; flujo de caja | PASS | Ver 1.1. |
| Ingresos manuales de crías y descarte | PARCIAL | ISSUE-R2-07 |

### Puntos de campo y técnicos
| Punto | Estado | Evidencia |
|---|---|---|
| Modo manga (arete, acción del día, dosis por peso); lista de trabajo diaria | PASS | `mangaLookup`, `bovinoAgenda`. "Registrar" en la Agenda no descuenta dos veces (prueba del equipo). |
| Eventos como documentos independientes con `createdBy`; fusión por campo | PASS | Ver la sección 2. |
| Topes con confirmación y estados excluyentes | PASS | Ver 1.1. |
| Moneda dual | PASS | VES 60 000 con tasa 40 guardada. |
| Roles en el cliente: el operario no ve costos ni balances | PASS | `permsForRole`/`bovinoCan`; Home y `RubroPanels` ocultan lo bovino. |
| Roles en el servidor (`firestore.rules`) | **ISSUE** | ISSUE-R2-01 y R2-02. |
| Bitácora | PASS | `bovino_audit`, solo de creación. |
| Exportación y respaldo | PARCIAL | Android nativo: ISSUE-08 de la ronda 1. |
| UI de campo (contraste, 48 px, teclado numérico) | PASS (lectura) | Sigue sin probarse en un dispositivo. Los textos de error muestran fechas ISO (ISSUE-R2-06). |

### Integración y regresiones
| Punto | Estado | Evidencia |
|---|---|---|
| Migración de los bovinos existentes | PASS | Padrote → toro, Becerro → cría, vaca lactante → en ordeño. Conteo compatible con el Home `{padrotes, becerros, vacas}` y sin NaN. |
| Tarjeta bovina del Home con datos reales | PASS | `bovinoHerdCounts`/`bovinoHomeSummary`. |
| Porcino y avícola | PASS | tsc y build sin errores. `mergeUpsertOps` sin `previous` escribe el documento completo, igual que antes. El back handler avícola no cambió. |
| Login | PASS | `views/auth` sin cambios. `setCurrentUser` recibe la sesión. |
| Actividades, Almacén y Balance de porcino y avícola | PASS | Las ramas no bovinas de `RubroPanels` no cambiaron. |
| Granja vacía | PASS | `emptyBovinoState`: Home, balance y KPIs sin NaN. `resetFarm` limpia el estado bovino. |
| Sin fechas fijas ni datos de ejemplo | PASS | No hay literales `20xx-` en `bovino/`, `models/bovino*` ni `views/bovino`. |

---

## 4. Issues

| ID | Severidad | Área | Archivo | Descripción | Cómo reproducir |
|---|---|---|---|---|---|
| ISSUE-R2-01 | **alto** | integracion | `firestore.rules` (`bovDailyKind`, `match /bovino_events`) | La lista de carga diaria del operario permite `pesaje`, `ordeno`, `racion`, `calostro`, `observacion` y `salida`. Faltan `parto`, `destete` y `movimiento`. El dominio permite al operario `registerCalving` (requerimiento "nacimientos"), que crea `parto` más un `movimiento` por cría (`bovinoDomain.ts`, `registerCalving`), y `registerWeaning`, que crea `destete` y `movimiento`. `saveChanges` envía todo en un `writeBatch`, así que el servidor rechaza el lote completo (crías y bitácora incluidas). El cambio se ve en el teléfono y luego desaparece con la siguiente instantánea; `subscribeAll` sobrescribe además el `localStorage`. El toast de `FarmController.dispatchBovino` dice "se sincronizarán al recuperar conexión", lo cual es falso. | `qa2/qa-r2-full.ts`: parto como Operador → denegado: `create bovino_events/parto`, `create bovino_events/movimiento`. Destete como Operador → denegado: `movimiento`, `destete`. En la app: desplegar las reglas, entrar como Operador → Repro › Parto → guardar. |
| ISSUE-R2-02 | medio | integracion | `firestore.rules` (catch-all `match /{col}/{allChildren=**}`); `web/src/services/authService.ts` (setDoc sobre `members/{uid}`) | Todas las reglas bovinas se basan en `members/{uid}.role`, pero la colección `members` cae en el catch-all `allow read, write: if col != 'bovino'…`, que no pide `request.auth`. Cualquier cliente puede escribir su propio documento de miembro con `role: 'Administrador'` y saltarse los permisos (`bovino_finance`, cierres, configuración). | Con la SDK, un usuario Operador hace `setDoc(farms/{id}/members/{suUid}, {role:'Administrador'})` → lo permite el catch-all → lee `bovino_finance`. |
| ISSUE-R2-03 | medio | datos | `web/src/models/bovinoDomain.ts` (`registerMilkSale`, línea ~2463) | El tope duro (`hardCap = prodDay + prodPrev - soldDay`) no resta lo ya vendido **ayer**. Si la leche de ayer se vendió completa y hoy no hay ordeño, se puede volver a vender con `confirm:true`, y la UI lo ofrece con "¿Incluye leche del día anterior?". El ingreso de leche queda contado dos veces. | Ordeño de 20 L ayer → `registerMilkSale({date: ayer, liters:20})` → hoy `registerMilkSale({liters:20, confirm:true})` → **ACEPTADA** (`qa-r2-full.ts`, "DOBLE VENTA"). |
| ISSUE-R2-04 | bajo | ux | `web/src/controllers/FarmController.ts` (`dispatchBovino`, `.catch` de `saveChanges`) | Cualquier error al guardar, incluido `permission-denied`, se muestra como "Cambios guardados localmente; se sincronizarán al recuperar conexión". Con las reglas por rol el cambio **no** se va a sincronizar: debería decir que fue rechazado por permisos. | Ver ISSUE-R2-01. |
| ISSUE-R2-05 | bajo | integracion | Pruebas del equipo en el scratchpad: `smoke.ts` (Data Hub) y `b/stageb-smoke.tsx` | Además de `qa1/qa-domain.ts`, las pruebas del Data Hub (78/80) y de la Etapa B (172/174) también fallan. Venden 100 L de leche con 62 y 31 L vendibles, y la regla nueva lo rechaza. El informe del equipo solo mencionaba qa1. Hay que actualizar esas pruebas para que la regresión vuelva a quedar en verde. | Recompilar y correr `smoke.ts` y `b/stageb-smoke.tsx`. |
| ISSUE-R2-06 | bajo | ux | `web/src/models/bovinoDomain.ts` (líneas 323, 341, 1159, 1230, 1360, 1486, 1723, 1756, 1875, 1879, 1948, 2132, 2157, 2468, 2469) | Los mensajes del dominio que ve el usuario (toasts y `ErrorBox`) muestran fechas ISO: "Parto probable 2027-08-23", "VENCIDO (2026-11-08)", "No hay ordeño vendible registrado el 2026-11-13…". La corrección UX 2 solo cubrió la Agenda, la manga, la línea de tiempo y los exportes. | `registerMilkSale` con la granja vacía → "…registrado el 2026-11-13…". |
| ISSUE-R2-07 | bajo | funcional | `web/src/components/mockup/bovino/finanzas/IngresoGastoSheets.tsx` (`OtroIngresoSheet`, tipos Descarte y Crías); `bovinoDomain.registerBovinoIncome` | "Otro ingreso" con tipo Descarte o Crías registra dinero sin animales. No revisa el retiro de carne (`RETIRO_ACTIVO`) y los animales siguen activos en el hato. Es un atajo para vender un descarte en retiro sin la advertencia crítica del requerimiento. | Balance › Ingreso › Otro ingreso › Descarte → se guarda sin verificar retiros. |
| ISSUE-R2-08 | medio | ux | Todo `web/src/components/mockup/bovino/` | Sigue sin probarse en un navegador ni en Capacitor. Pendiente: teclado de la manga, Enter en el pesaje y el ordeño rápidos, Atrás de Android con hojas y con la manga, contraste al sol, y los controles nuevos (Registrar, Confirmar baja, Todos (n), Descarte/Terneros). | Probar en el MobileDeviceFrame y en el APK. |
| ISSUE-R2-09 | bajo | datos | `firestore.rules` (`bovino_audit`: `allow delete: if false`); `web/src/services/dbService.ts` (`clearAllData`) | "Dejar la granja en blanco" recorre `COL`, que incluye `bovino_audit`. El borrado se rechaza (solo se registra un aviso en consola) y la bitácora vieja vuelve a aparecer con la siguiente instantánea, aunque el estado local se vació. Puede ser intencional (bitácora inmutable), pero hay que decidirlo y avisarlo en la UI. | Configuración › borrar datos con las reglas desplegadas → la bitácora bovina reaparece. |

## 5. Pendientes que siguen abiertos (declarados por el equipo y confirmados)
- Desplegar `firestore.rules` y probarlas en el emulador. Antes hay que corregir ISSUE-R2-01 y R2-02.
- `movements` y `warehouse` siguen abiertos a cualquier miembro: los montos bovinos y los costos unitarios se pueden leer directamente.
- La escritura con merge más `increment()` no se ha probado con dos clientes sin conexión. Caso límite: si un cliente borra un insumo y otro, sin conexión, incrementa su stock, el documento revive solo con `quantity`. Además, `set(merge)` combina los mapas anidados en profundidad: una subclave que se quite de un objeto anidado no se borra.
- Exportes en Android nativo (`exportar/share.ts`) sin plugins de Capacitor.
- Decisiones que la usuaria debe confirmar (no son defectos):
  - El Veterinario no ve el balance, pero sí el costo de insumos (`verCostosInsumos`).
  - La configuración solo la cambia el Administrador.
  - La venta con retiro necesita un motivo de al menos 5 caracteres.
  - Una compra cuenta como inventario y el costo se carga con la salida.
