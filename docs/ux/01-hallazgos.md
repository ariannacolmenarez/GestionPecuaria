# Revisión UX/UI de toda la app — hallazgos (16/11/2026)

Base: reglas del skill ui-ux-pro-max (`C:\Users\Sist-AColmenarez\.claude\skills\ui-ux-pro-max\references\quick-reference.md` y `pro-rules.md`).
Usuarios: personal de campo, al sol, con guantes, poca experiencia con tecnología. Rutas relativas a `web/src/`.

Pedido de la usuaria (aprobado): aplicar las 4 fases, **cuidar el espacio para ver la información en el módulo porcino**, **facilitar la app para cualquier usuario**, **quitar las funcionalidades que están de más**. Rama `mejoras-ux` (no main).

## Fase 1 — Base común (componentes compartidos)
- Textos: nada de `text-[9px]`/`[10px]`/`[11px]` en información → `text-xs` mínimo; secundarios `text-slate-600` mínimo (nunca slate-400/500 sobre blanco). Conteos: porcino ~344 casos <12px y 83 slate-400; avícola 62 `[10px]`, 50 `[11px]`, 91 slate-500; Home/shell muchos `[10px]/[11px] text-slate-500`, `text-emerald-200/80` sobre verde.
- Táctil: botones ≥44px (`min-h-11`), en bovino 48px (`h-12`); gap ≥8px. X de cierre `w-11 h-11` + `aria-label="Cerrar"`.
- `components/mockup/avicola/shared.tsx` (lo reexporta `bovino/ui.tsx:24-28`):
  - BottomSheet (233-274): prop `dirty` → no cerrar por fondo/Atrás sin confirmar; prop `error` en el pie encima del botón; subtítulo `text-xs text-slate-600`; X `w-12 h-12`. Avícola debería usar `sol` por defecto (hoy 0 usos de `contrast=` en avícola).
  - FormSheet (173-230): `error` en el pie + scrollIntoView/focus del primer inválido; X `w-12 h-12`; foco `ring-slate-900` en cabecera amber; subtítulo cabecera `text-sky-100` sobre sky-600 (113, 215) → `text-white font-semibold`.
  - ConfirmDialog (277-328): mensaje `text-sm text-slate-700`, botones `h-12 text-base`.
  - FieldRow (348-367): hint `text-xs text-slate-600`; error `text-xs font-semibold text-rose-700` con id + aria-describedby; `htmlFor` automático con useId.
  - NumberInput (369-388): `text-base`, `aria-invalid`, `enterKeyHint="done"`, borde inválido `border-2 border-rose-500`. TextInput `text-base`.
  - ChipGroup (444-491): md=`h-11`, lg=`h-12`, `gap-2.5`, prop `ariaLabel`, inactivo `border-slate-300`.
  - Toggle (526) hint xs slate-600, switch `w-12 h-7`. StageProgressBar (568) etiquetas xs, futuras opacity-40. StatStrip (584), KpiTile (702,710), BalanceCard (628-651): etiquetas `text-xs text-slate-600`.
  - SubTabs (724): scroll horizontal esconde pestañas (Sanidad fuera de pantalla en 360px) → `grid grid-cols-N`, icono sobre texto, `h-14 text-xs`, sin overflow; badge `text-xs`.
  - SegmentedTabs (761): inactiva `text-slate-700`. BackLink (774) `h-11`. EmptyState icono slate-500. Stepper: `aria-live`, input `w-20`.
  - ErrorBox (330-334): `text-sm font-semibold text-rose-900 border-2 border-rose-300`.
- Toast (App.tsx:607-619): siempre verde con icono Info, 3,5 s, sin cerrar, text-xs, `top-16` tapa el encabezado → variante `tone` (error `bg-rose-700`, aviso `bg-amber-600`, éxito `bg-emerald-700`), `text-sm`, X `w-11 h-11`, `aria-live="assertive"` en errores, en nativo abajo (`bottom-20`). Detectar tono por el mensaje (contiene "Error", "⚠", "no se pudo", "rechaz", "sin permiso" → error) o mejor con parámetro.
- Encabezado de modal único: hoy 6 variantes (cerrar w-12 RubroPanels:120, w-10 RubroPanels:198/300, Members:131, Settings:47, p-1.5 Alerts:146, Warehouse:512, sin padding Warehouse:983/1171/1366). Crear `ModalHeader` (bg-slate-900, icono de rubro, título 16px, subtítulo `text-xs text-slate-300`, cerrar `w-11 h-11` + aria-label).
- Inputs base porcino: 46 inputs/selects <44px → clase compartida `w-full min-h-11 px-3 text-base rounded-xl border border-slate-300`. 52 `type="number"` con solo 4 `inputMode` → `inputMode="decimal"` (kg, $, ml) / `"numeric"` (conteos).
- Focus: casi ningún `focus-visible:ring` → añadir en botón base.
- Emojis como iconos → lucide (porcino TabAtajos:134,146, UnifiedSale ~289/306, MenuPorcino:418; Avícola Sanidad.tsx:102-104; PhoneNotificationBanner:244,276; HomeDashboard:176; AlertsCenterModal:246,250).
- Color por rubro igual en todas partes: porcino rose-600, avícola amber-400 + texto slate-900, bovino **sky-700** (sky-600 + blanco ≈4.0:1 falla; usado en bovino ui.tsx:42,532,567,895, BovinoNav.tsx:45).

## Fase 2 — Navegación y estado
- **Atrás de Android**: ningún modal porcino registra `pushBackHandler` (avícola: shared.tsx:161; bovino: routes.ts). Con un parto o venta a medio llenar, App.tsx:306-308 hace `setMockupScreen('home')` y se pierde todo. Igual WarehouseModal y diálogos internos (Consumir 860, Comprar 1165, Nuevo ítem 983, Eliminar 1366), AddSanitaryActivityModal y SanitaryProcedureModal en Actividades (RubroPanels:329-352), invitación en MembersModal. Usar `useEscape`/`FormSheet` de avicola/shared.tsx:151-191 (pila + confirmación con datos) y simplificar la cadena de ifs App.tsx:289-294.
- **Bovino back-stack**: `navigate(screen, section)` (BovinoModule.tsx:88-91, routes.ts:96-98) pierde la pila: Hato › Pesaje rápido/Registrar ordeño (HatoHome.tsx:181-191), ficha › Ordeño/Servicio/Diagnóstico/Parto/Venta (AnimalFicha.tsx:56-61), Pesar en selección múltiple (AnimalList.tsx:238), Llevar a la manga (AgendaDia.tsx:89) → apilar (`pushRoute`) o `returnTo`.
- **Bovino estado de lista**: `key={screenKey}` (BovinoModule.tsx:145,192) remonta AnimalList y pierde búsqueda/filtros/orden/scroll/“ver 50 más” (AnimalList.tsx:41-52) → guardar en la ruta y scrollTop por screenKey.
- **Bovino FAB** no flota (`absolute` dentro del scroll, ui.tsx:846) → portal fuera del scroll (`#phone-overlay-root`, como BottomBarPortal).
- **Barra inferior** (App.tsx:168-240, BottomNav.tsx:135): "Balance" y "Actividades" se comportan distinto por rubro; dentro de avícola/bovino queda marcado "Granja"; "Alertas" nunca activa; estado activo solo por color → copiar BovinoNav.tsx:33-50 (h-14, grid-cols-5, icono w-6, `text-xs font-bold`, pastilla activa, badge `text-[12px]` + sr-only, safe-area). Regla única: Almacén/Balance/Actividades abren siempre la misma clase de pantalla (el modal por rubro de RubroPanels, preseleccionado en el rubro actual).
- **Indicador de conexión falso**: GranjaHeader.tsx:55-58 siempre "En línea / Sincronizado con Firebase" → props `online` + escrituras pendientes: ámbar "Sin señal · se guarda en el teléfono" / verde "Todo guardado". Banner offline App.tsx:397 `text-sm font-bold`.
- **"Sincronizar con la base de datos"** (SettingsModalView.tsx:98-108, FarmController.ts:1239) llama restoreSampleData y dice "Datos sincronizados" sin sincronizar → QUITAR (la sincronización es automática).
- GranjaHeader:40,66 Volver y Configuración ~32px, Configuración sin aria-label → `w-11 h-11`.
- GranjaHeader:74-105 barra "Miembros" ocupa una fila en todas las pantallas; "Ver todos" 11px → solo en Home o avatar `w-11 h-11` en el encabezado.
- Alertas: "Ver calendario sanitario" (App.tsx:549-552) siempre va a porcino → `setActivities({rubro})` según la tarea. Tarjetas de insumo crítico no tocables ni muestran rubro; "Abrir almacén" siempre porcino (AlertsCenterModal:383-430) → botón que abre el almacén de su rubro. Chip "Vencida" igual que "Pendiente" (240-246) → vencida `bg-rose-100 text-rose-800`; "Registro en Bitácora ✓" solo si completada (336-340). X y completar sin aria-label (144-149, 290-304). Título "Centro de Alertas del Teléfono" → "Alertas de hoy".
- RubroPanels:91-96: en Almacén desde Home, la pestaña "Bovino" saca al módulo sin aviso → mostrar la tarjeta "Abrir almacén bovino" (ya existe 109-142).
- Carga perezosa con `fallback={null}` (App.tsx:47, RubroPanels:145) → spinner "Cargando…".
- PhoneNotificationBanner:250-263: X ~22px, contenido `<div onClick>`, tapa el encabezado, dice "para Hoy" aunque incluya vencidas.

## Fase 3 — Tareas del día al frente
### Porcino (además: CUIDAR EL ESPACIO PARA VER LA INFORMACIÓN)
- TabAtajos.tsx:62-107: no tiene Monta/Parto/Mortalidad; "Almacén" y "Compras" abren el mismo modal (69, 76) → tarjetas Monta, Parto, Destete, Mortalidad, Venta, Tareas de hoy; quitar duplicado; Atajos primera pestaña (porcino/shared.ts:8-14). Hoy Monta = Porcinos › Verracos › "Registrar Monta" (HerdCategoryViewModal.tsx:254-260).
- TabSanitario.tsx:91-100 botón "✓ Completar"/"Reabrir" `text-[9px] px-2 py-0.5` (~18px), Reabrir sin confirmar → `min-h-11 px-4 text-sm font-bold`, ancho completo bajo la tarjeta. Vista por defecto calendario (118) → "Listado: hoy y vencidas". Flechas del mes `p-1` (254-270) → `p-2.5`.
- MenuPorcino.tsx:368 pestañas `px-3 py-1.5 text-xs` (~28px) con scroll horizontal que esconde "Alimentación" → `min-h-11`, todas visibles (grid/flex-1), sin scroll.
- TabRebano.tsx:108-130 botones Censo/Matadero/Destete `px-2.5 py-1` → `min-h-11 text-sm`; "Destete" desactivado explica el motivo solo con title → texto visible. 264-275 chips de filtro `text-[10px] py-1` → `min-h-10 px-3 text-xs`. 195-197, 288-296 `<div onClick>` → `<button>`. 253-335 sin buscador por arete → input de búsqueda. 170,178-179 jerga "GDP", "LNV", "4g / 2l".
- HerdCategoryViewModal.tsx:254-311 botones `px-2.5 py-1.5 text-xs` → `min-h-11 text-sm`; Mortalidad por camada (~515) `py-1 text-[11px]`.
- Formularios: inputs `py-1/py-1.5 text-xs` (~28-32px) (FarrowingModal.tsx:271-337, WeaningProratingModal.tsx:228-236 `w-16 py-1` con valor 0 que hay que borrar → `value={v||''}`). Error único al final (FarrowingModal:423, PigletMortalityModal:247, WeaningProratingModal:641, UnifiedSaleSlaughterModal:674, AddSanitaryActivityModal, herd/AddPigsForm.tsx:174) → error por campo. Footer de Guardar dentro del scroll (FarrowingModal:210-446) → pie fijo `shrink-0 border-t`. Radios nativos (FarrowingModal:356-380) → segmentados `min-h-11 flex-1`. Switch 36×20 (BoarMatingAndNewModal:318-327) → fila entera tocable. Corral a mano (WeaningProrating:478,522,547; AddPigsForm:129) → select/datalist de corrales usados. Éxito solo "Cerrar" (Farrowing:187-193, Mortalidad, Monta) → "Registrar otro" + "Ver camada".
- Papelera sin confirmar `text-slate-400` ~26px (BatchProductionConfigModal:574-581, FeedingPlanConfigModal:478-484) → `min-w-11 min-h-11 text-rose-600` + confirmar.
- Modelo a seguir: PigletMortalityModal (select de causa, input `py-2 text-base`).
### Avícola
- AvicolaModule.tsx:64,74 abre el lote en 'ventas' → lotes activos en 'control'. Sub-pestaña por defecto Alimentación (65); bajas en Control › Mortalidad; el alimento dado solo se registra en Gestión › Bodega "Usar" (TabGestion.tsx:440) → tarjeta "Registro de hoy" arriba de TabControl con Bajas, Alimento dado, Pesaje (`h-16 text-base`); "Registrar alimento dado" en AlimentacionPanel reutilizando ConsumoSheet.
- AvicolaHome.tsx:230-264 dos tarjetas "Configurar" (uso una vez por ciclo) empujan "Mis Lotes" fuera → mover debajo de la lista o a menú ⋮. AvicolaHome:133 "Eliminar" pegado a "Finalizar lote" → separador.
- Táctil: TabVentas.tsx:174-186 Abonar/Pagada/Entregar `h-10 text-xs` → `h-12 text-sm`; Sanidad.tsx:159-181 Completar a ancho completo `h-12`; "Recalcular" enlace en hint 10px (TabFinanzas:311,547; TabVentas:426) → botón; PlanEditor LoteForms.tsx:135-157 checkbox w-5 y ± `gap-1` → li tocable, gap-2; TabGestion:383 "+" solo icono → "+ Insumo".
- Formularios: LoteForms.tsx:367-384 Editar lote solo con placeholder → etiquetas visibles; 340-341 error arriba; ChipGroups sin título (TabControl:308,312; TabGestion:543,555); 7 NumberInput sin id; Sanidad:302 placeholder parece valor.
- Confirmación: "Marcar pagada"/"Entregar" (TabVentas:179,184) instantáneos; "Eliminar cobro" (564-569) sin confirmar; EditLoteDialog descarta al tocar fondo/Atrás (LoteForms:355,358); BottomSheet con formulario pierde datos al tocar fondo (TabGestion:536, TabControl:282,593, TabVentas:599).
- Consistencia/jerga: "Sacrificados" (TabControl:89, TabGestion:101,144) vs "Entregados" (TabVentas:81) → "Entregados". "Viabilidad", "Margen", "Conversión alimenticia", "imputados", "egreso", "Abonar" (TabGestion:295-302,450,575; TabVentas:175) → lenguaje llano.
- Funcionalidad de más: "Nuevo ingreso" tipo Pollo con cantidad (TabFinanzas:506,519) es una segunda forma de vender → quitar el campo Pollos / redirigir a Ventas. LoteDetail.tsx:58 chip de pestaña activa repite la barra → quitar. Filtros escondidos tras "Filtrar" (TabFinanzas:125,405) → chips siempre visibles. Stepper de pollos vendidos desde 0 de 1 en 1 (TabVentas:404) → chip "Todos (n)".
- Gráfico de peso (TabControl:245-252): sin leyenda, línea ideal #cbd5e1, ejes 9px → leyenda, ideal #64748b, ejes 11-12px. Calendario Sanidad (346-376) "D{n}" 9px y puntos por color → contador numérico / inicial del lote.
- LoteDetail.tsx:98 barra inferior 11px slate-300; :61 aviso finalizado 11px.
### Bovino
- HatoHome.tsx:177-195 accesos rápidos en el bloque 5 → subirlos a la posición 2, `Tile min-h-20`.
- CebaHub.tsx:30,39-41,262 pesaje rápido abre el primer lote alfabético → LotPickerSheet si hay >1 lote de ceba.
- LecheHub.tsx:203-208 "Registrar ordeño" al final y duplicado con FAB → `h-14` bajo ChipFilter, quitar el FAB.
- AnimalFicha.tsx:51-61,109-124: 8 mosaicos y 4 deshabilitados "Lo registra el encargado" para el operario → no mostrar los no permitidos; deshabilitar solo los que tienen motivo (retiro/preñada).
- AnimalList.tsx:142 "Buscar arete o nombre" con teclado numérico → `allowLetters` o placeholder "Buscar arete". 141-174 cabecera fija ~200px → fijar solo el buscador.
- AgendaDia.tsx:111-120 sin acción por grupo → "Pesar los 15" (PesajeRapido animalIds). :19 abrir en 'vencidas' si hay.
- Táctil <48px: SubHeader.tsx:91 "Tasa" h-8; ui.tsx:636 USD/local h-10; HatoHome:75; AnimalFicha:179; AnimalList:292 h-9; ConfigBovina:349,389; ui.tsx:566 ChipFilter, kit.tsx:343 DataToggle, ModoManga:363 h-11 → h-12. Chip "#tag ✕" quita el animal con un toque (TratamientoSheet:214, NuevaActividadSheet:79, LoteDetail:225) → X separada w-12.
- BottomSheet por fondo pierde datos (MoverSheet:90, SanidadHub:143, AnimalTimeline:81, BalanceBovino:284). ModoManga:257-261 salir con peso escrito sin preguntar; ModoManga:249 dos toasts por animal. PesajeSheet:43 autoFocus en el peso.
- eventText.tsx:61 "FPP aaaa-mm-dd" → `Parto probable ${fd(...)}`. Jerga: "Servir / IATF" (AgendaItemRow:14), "FPP" (AnimalFicha:47), "PEV" (154), "DEL" (CurvaLactancia:63-64), "Kardex" (Kardex.tsx:89), "GMD ceba" (HatoHome:203).
- InsumoForm.tsx:161-172 chips de unidad de dosis en 1/3 de ancho → fila propia. kit.tsx:244-328 fontSize 12 en viewBox 320 → 13. ui.tsx:469 switch apagado slate-400 → slate-500 + borde. OrdenoRapido:289 valor por defecto como placeholder.
- Bien: bovino ya confirma borrados, usa inputMode, manga con teclas de 64px, sin text-[10/11px].
### Home y shell
- HomeDashboard.tsx:310-317, 375-382, 438-445 tres estilos para entrar a cada rubro → `h-11 px-3.5 rounded-xl text-sm font-bold` color sólido del rubro, texto "Entrar". 321-342 mosaicos porcinos `<div onClick>` → `<button>`. 226-232 "Ver balance detallado" icono 28px → `min-h-11` con texto. 186 "tareas sanitarias para hoy" cuenta otras → "actividades para hoy"; 162 bienvenida sin bovino. Textos 307,326,330,435,468-472,487,527,532 → `text-xs text-slate-700`. La tarjeta bovina (359-421) ya cumple: modelo.
- WarehouseModal.tsx:795-840 acciones por insumo ~26px con papelera de 22px pegada a "Comprar" → `min-h-11 gap-2`, Eliminar separado (`ml-auto w-11 h-11`) o en menú ⋯. 533-575 pestañas `py-2` → `min-h-11`.
- MembersModal:228-233 cambio de rol inmediato → confirmar. Cerrar sesión (Members:311, Settings:87-93) sin confirmar → confirmar y avisar si hay datos sin subir.
- SettingsModalView.tsx:42-45 único modal con encabezado blanco y sin role="dialog"; etiquetas `text-[10px] text-slate-400` → ModalHeader + `text-xs text-slate-600`.
- AlertsCenterModal.tsx:200-206 botón demo "Probar Push" visible → QUITAR fuera del modo navegador (o quitar).
- AuthGate.tsx bien resuelto; ver contraseña a `w-11 h-11` (281), ayuda línea 252 a `text-xs`.

## Fase 4 — Confirmaciones y lenguaje
- Porcino UnifiedSaleSlaughterModal.tsx:690-695 "Asentar Venta & Liquidación" sin resumen → paso "Revisar" (animales, kg, $/kg, total, comprador) + "Confirmar venta" `bg-emerald-700 min-h-12`. Jerga "Canal", "faenado", "Prorrateo", "Asentar" → "Venta a matadero", "Destete", "Guardar venta".
- Avícola: confirmar "Marcar pagada", "Entregar", "Eliminar cobro" o "Deshacer" en el toast.
- Alertas: completar tarea con un toque → "Hecho" `min-h-11` o abrir SanitaryProcedureModal; "Deshacer".
- Cambiar siglas por palabras (ver listas por módulo).
