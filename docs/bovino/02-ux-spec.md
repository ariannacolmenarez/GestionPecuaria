# Módulo Bovino: especificación de UX/UI

Fuente de verdad funcional: `docs/bovino/00-requerimientos.md`. Este documento define **cómo se ve y cómo se usa**
el módulo (navegación, pantallas, componentes, textos, validaciones visibles y permisos por rol), y cómo se
reparte el trabajo de UI entre dos desarrolladores (Etapa A y Etapa B).

Las referencias a tipos, funciones o acciones de dominio (por ejemplo `bovinoActions.registrarPesaje`) son
**nombres de trabajo**. El dominio (`models/bovinoDomain.ts`) los fija; la UI se adapta a esos nombres sin
cambiar el comportamiento descrito aquí.

---

## 0. Resumen de decisiones

| Tema | Decisión |
|---|---|
| Entrada | Home de la granja, tarjeta "Gestión Bovina" → `mockupScreen = 'bovino'` (pantalla completa, como el avícola). Se deja de abrir `BovinoModal`. |
| Barras | **Una sola barra inferior.** Dentro del módulo la `BottomNav` global se oculta y la reemplaza `BovinoNav` (5 secciones). Nunca se apilan dos barras. |
| Secciones | **Hato** · **Agenda** · **Campo** · **Repro** · **Más** |
| Botones globales dentro del módulo | Actividades → sección **Agenda** (lista de trabajo bovina). Almacén → **Más › Almacén bovino** (pantalla del módulo con submódulos). Balance → **Más › Balance** (ceba vs leche/cría). Alertas → campana de la sub-cabecera del módulo. Granja → botón Atrás de la cabecera. |
| Acento | `sky` (bg-sky-600 / sky-100 / sky-700), coherente con el Home. Ingresos emerald, gastos rose, alertas amber. |
| Contraste | "Modo sol": fondo `bg-slate-50`/blanco, texto `text-slate-900`; secundario **mínimo** `text-xs text-slate-700`. Prohibido en bovino: `text-[10px]`, `text-[11px]`, `text-slate-400/500` para información. |
| Tamaño táctil | Botones y filas tocables ≥ 48 px (`h-12`), separación ≥ 8 px (`gap-2`). Acciones primarias `h-14`. Modo manga: teclas de 64 px o más. |
| Captura | Selectores y chips en lugar de texto libre; `inputMode="numeric"` para aretes y cantidades enteras, `inputMode="decimal"` para pesos, litros y dosis. |
| Eventos | Cada hecho (pesaje, ordeño, servicio, diagnóstico, parto, tratamiento, movimiento de potrero, salida de almacén, movimiento financiero) es un documento propio con `createdAt/createdBy/createdByName`. La UI nunca edita arrays del documento del animal. |
| Roles | Operario (Operador/Trabajador): carga diaria, **sin montos**. Encargado (Veterinario): repro, sanidad, lotes/potreros, farmacia. Propietario (Administrador): todo. |

---

## 1. Pantallas de referencia: qué aporta cada una

Las 16 capturas (carpeta `Imagenes modulo bovino`) son de otra app. Se toma su **estructura**; no se copian
colores, fotos, tipografías, el botón "Chatear con IA" ni los avisos "Conviértete en PRO".

| # | Archivo (WhatsApp Image 2026-11-13 at …) | Pantalla | Qué aporta | Cómo se mejora aquí |
|---|---|---|---|---|
| 1 | `1.46.50 PM` | **Hato** (Inicio): total de animales y 5 contadores Crías, Levante, Novillas, Vacas, Toros. Barra inferior Inicio / Operación / Reproducción / Seguimiento. | Contadores por categoría como primera lectura del hato. | Se agregan el contador **Ceba**, la agenda del día, las alertas (retiros, partos próximos, stock crítico) y los accesos rápidos. Cada contador abre la lista filtrada. |
| 2 | `1.46.51 PM` | **Operación de campo** (1/2): tarjetas Lotes, Potreros, Leche. | Hub de operación diaria con tarjetas grandes. | Sección **Campo** con mosaicos de 2 columnas, cada uno con su dato vivo (p. ej. "3 lotes · 128 animales"). Sin fotos. |
| 3 | `1.46.51 PM (1)` | **Operación de campo** (2/2): Pesos, Pastoreo (registrar cambio de potrero). | Pesajes y movimientos de potrero como acciones de campo. | Pesos pasa a **Ceba** (lista rápida + GMD). Pastoreo se integra en **Potreros › Mover** (dos toques). |
| 4 | `1.46.51 PM (2)` | **Reproducción** (1/3): Servicios, Palpaciones. | Servicios por monta o inseminación. Resultado de palpaciones. | **Repro** con contadores por estado (Vacías, Servidas, Preñadas, Secas) y agenda reproductiva. |
| 5 | `1.46.51 PM (3)` | **Reproducción** (2/3): Partos (por evento y sexo), Destetes. | Registro de partos y destetes. | Parto en un formulario con crías (sexo, peso, arete) y **calostro**. Destete con peso. |
| 6 | `1.46.51 PM (4)` | **Reproducción** (3/3): Secado. | Registro de vacas secadas. | Lista "Por secar" calculada (FPP − 60 d), con el tratamiento de secado tomado de la farmacia. |
| 7 | `1.46.51 PM (5)` | **Seguimiento** (1/2): Compras de animales, Salidas (ventas, traslados, muertes). | Entradas y salidas del hato. | Compras = **Alta por lote/por animal** con costo. Salidas = **Baja** (muerte, traslado, descarte) y **Venta**, con bloqueo por retiro. |
| 8 | `1.46.51 PM (6)` | **Seguimiento** (2/2): Sanidad (aplicaciones por fecha y producto). | Historial sanitario. | **Sanidad** conectada a la farmacia: descuenta stock, calcula la dosis por peso y abre el retiro. |
| 9 | `1.46.51 PM (7)` | **Lotes de animales**: estado vacío "Sin lotes creados" + "Crear lote" + FAB. | Patrón de estado vacío con CTA. | Igual patrón, con acento sky y texto que explica para qué sirve un lote. |
| 10 | `1.46.52 PM` | **Potreros**: filtro Todos/Disponibles/Ocupados; vacío "Sin potreros creados"; "Registrar potrero". | Estado de ocupación del potrero. | Se agrega el estado **En descanso** con días de descanso y el tiempo de ocupación. |
| 11 | `1.46.52 PM (1)` | **Producción de leche**: filtros Todos/Por lote/Por vaca y periodo Hoy/Semanal/Último mes/Rango; FAB +. | Filtros de leche por lote, vaca y periodo. | Ordeño rápido (por vaca o tanque con desglose), curva de lactancia y detección de caídas. |
| 12 | `1.46.52 PM (2)` | **Pesos**: filtros por fecha y por sexo; vacío "Sin registros de peso". | Historial de pesajes con filtros. | Lista rápida arete tras arete con GMD en colores; filtros por lote y categoría. |
| 13 | `1.46.52 PM (3)` | **Registro (ingreso de ganado)**: fecha, "Debes elegir el potrero…", selector **Por lote / Por animal**. | Alta con potrero obligatorio y dos modos. | Se conserva casi igual: fecha, potrero obligatorio, modo Por lote / Por animal, más lote destino, procedencia y costo (solo con permiso). |
| 14 | `1.46.52 PM (4)` | **Servicios**: filtros Todos/Por lote/Por vaca, fecha, tipo de monta (Natural, Inseminación, Transf. embriones); "Registrar servicio". | Filtro por tipo de servicio. | Se conservan los tres tipos. El toro sale del hato y la pajuela del almacén. Las vacas Preñadas o Secas quedan bloqueadas. |
| 15 | `1.46.52 PM (5)` | **Palpaciones**: filtros por fecha y por evento Preñadas/Vacías. | Resultado del diagnóstico. | Palpación o ecografía, con días de gestación, FPP y fecha de secado calculadas en pantalla. |
| 16 | `1.46.52 PM (6)` | **Partos**: filtros Hasta hoy/Último mes/Rango y evento Nacimientos/Abortos/Muertos; "Registrar parto". | Tipos de evento de parto. | Se conservan los tipos (Nacimiento, Aborto, Mortinato) y se agregan crías y calostro. |

**Problemas de la referencia que se corrigen:** texto blanco sobre fotos (bajo contraste al sol), filtros
oscuros pequeños, cuatro barras de navegación más un FAB que se solapa con el contenido, colores distintos por
pantalla (rojo, verde, morado) sin significado, ninguna captura masiva, ningún cálculo (GMD, FPP, retiros) y
ningún vínculo con el almacén ni con el balance.

---

## 2. Arquitectura de navegación

### 2.1 Estructura

```
Home de la granja
└── Módulo Bovino (mockupScreen 'bovino')
    ├── [Hato]    Inicio del hato ─┬─ Animales (lista) ── Ficha del animal (Resumen | Historial | Producción | Sanidad)
    │                              ├─ Alta de ganado (Por lote / Por animal)
    │                              └─ Botón MODO MANGA
    ├── [Agenda]  Lista de trabajo del día (+ Mañana, Esta semana, Vencidas) ── Calendario
    ├── [Campo]   Lotes ── Detalle de lote (Animales | Indicadores | Movimientos)
    │             Potreros ── Detalle de potrero / Mover
    │             Ceba (pesajes rápidos, raciones, GMD, proyección)
    │             Leche (ordeño rápido, curva de lactancia)
    │             Sanidad (aplicar tratamiento, retiros activos, historial clínico)
    │             Entradas y salidas (altas, bajas, ventas)
    ├── [Repro]   Estados reproductivos ── Servicios / Diagnósticos / Partos y crías / Destetes / Secado / Calendario repro
    └── [Más]     Almacén bovino (Alimentos | Minerales | Farmacia | Otros)
                  Balance (Todo | Ceba | Leche y cría) ── Liquidación de lote
                  Reportes y KPIs
                  Exportar y respaldo
                  Configuración bovina
                  Bitácora
                  Volver a la granja
```

### 2.2 Barra del módulo `BovinoNav`

- Ocupa el mismo lugar y la misma altura que la `BottomNav` global, que **no se renderiza** cuando
  `mockupScreen === 'bovino'`. Así siempre hay una sola barra.
- Contenedor: `nav#bovino-navigation-bar bg-white border-t border-slate-200 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] grid grid-cols-5 gap-1 shrink-0 select-none`.
- Botón: `h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-xs font-bold`.
  Activo: `bg-sky-600 text-white`. Inactivo: `text-slate-700 hover:bg-slate-100`. Enfoque: `focus-visible:ring-2 focus-visible:ring-sky-600`.
  Atributos: `role="tablist"` en el contenedor, `role="tab"` y `aria-selected` en cada botón.
- Íconos (lucide, `w-6 h-6`): Hato `Beef`, Agenda `CalendarCheck`, Campo `Fence` (alternativa: `Map`), Repro `HeartPulse`, Más `LayoutGrid`.
- Insignias (`absolute top-1 right-[22%] min-w-5 h-5 px-1 rounded-full text-[12px] font-black`):
  - Agenda: tareas de hoy más vencidas, en `bg-rose-600 text-white` si hay vencidas y en `bg-amber-500 text-slate-900` si no.
  - Repro: partos en los próximos 7 días más vacas por secar hoy, en `bg-amber-500 text-slate-900`.
  - Más: insumos críticos o vencidos del rubro bovino, en `bg-amber-500 text-slate-900`.
- Pantallas de formulario a pantalla completa (`FormSheet`), Modo manga y Ordeño o Pesaje rápido se montan en
  el portal `#phone-overlay-root` y cubren la barra. No hace falta ocultarla a mano.

### 2.3 Cabecera

- La cabecera global `GranjaHeader` se mantiene, con `showBack` activo. Su título cambia según la ruta:
  "Ganado Bovino" en el Hato, y en las demás el nombre de la pantalla ("Agenda de hoy", "Lote Ceba 2",
  "Vaca 402", "Almacén bovino"…).
- Sub-cabecera del módulo, solo en las 5 raíces de sección:
  `div.bg-white border-b border-slate-200 px-4 h-12 flex items-center gap-2 shrink-0`. Contiene, en este orden:
  - la fecha de hoy en `text-sm font-bold text-slate-900` ("vie 13 nov");
  - el chip de tasa del día (solo Admin y Vet), `text-xs font-bold px-2.5 h-8 rounded-full bg-slate-100 text-slate-800`
    con texto "Tasa 45,20", que abre Configuración › Tasa; se pinta en amber si la tasa no es de hoy;
  - el botón de la campana (`w-12 h-12`), que abre la hoja de alertas bovinas.

### 2.4 Ruta y botón Atrás

- La ruta vive en `usePhoneNavigation` (App.tsx) para que el Atrás de la cabecera y el botón físico de Android
  usen la misma lógica:
  ```ts
  type BovinoSection = 'hato' | 'agenda' | 'campo' | 'repro' | 'mas';
  type BovinoScreen =
    | { s: 'root' }
    | { s: 'animales'; filtro?: AnimalFiltro } | { s: 'animal'; id: string }
    | { s: 'lotes' } | { s: 'lote'; id: string } | { s: 'potreros' } | { s: 'potrero'; id: string }
    | { s: 'ceba'; loteId?: string } | { s: 'leche' } | { s: 'lactancia'; vacaId: string }
    | { s: 'sanidad' } | { s: 'movimientosHato' }
    | { s: 'servicios' } | { s: 'diagnosticos' } | { s: 'partos' } | { s: 'destetes' } | { s: 'secado' } | { s: 'calendarioRepro' }
    | { s: 'almacen'; sub?: 'alimentos' | 'minerales' | 'farmacia' | 'otros' } | { s: 'insumo'; id: string }
    | { s: 'balance' } | { s: 'liquidacion'; loteId: string } | { s: 'reportes' } | { s: 'exportar' }
    | { s: 'config' } | { s: 'bitacora' };
  interface BovinoRoute { section: BovinoSection; stack: BovinoScreen[] } // stack[0] = root
  ```
- Orden del Atrás (hardware y cabecera):
  1. hoja o diálogo abierto (pila `pushBackHandler`; ya lo cubre `runTopBackHandler`);
  2. `stack.length > 1`: se saca la última pantalla;
  3. sección distinta de `hato`: se va al Hato;
  4. Hato: se vuelve al Home de la granja.
- Cambiar de sección en `BovinoNav` reinicia esa sección en su raíz. La posición de scroll de la raíz se
  conserva si se puede.
- **Peticiones externas** (como `AvicolaFocusRequest`): `BovinoFocusRequest { nonce; section?; screen?; nuevoAlta?; abrirManga? }`,
  usadas por el Home de la granja, el centro de alertas y `RubroPanels`.

### 2.5 Integración con el resto de la app

| Punto | Comportamiento |
|---|---|
| `HomeDashboard` tarjeta bovina | Rediseño en sky: ícono `Beef` en `bg-sky-100 text-sky-700`, botón "Ver hato" en `bg-sky-600 text-white h-11`. 6 contadores (Crías, Levante, Novillas, Vacas, Toros, Ceba) en `grid-cols-3`. Debajo, dos datos: "Leche hoy: 312 L" (si hay ordeños) y "Pendientes hoy: 5". `onNavigateToBovino` llama a `nav.goBovino()`. |
| `BottomNav` global | No se renderiza en `mockupScreen === 'bovino'`. `activeScreen` no cambia. |
| `RubroPanels` › Actividades › pestaña Bovino | Lista solo lectura de las tareas bovinas. Tocar una tarea navega a `goBovino({ section: 'agenda' })`, como en el avícola. "Agregar" abre la Agenda del módulo. |
| `RubroPanels` › Almacén desde el Home con rubro Bovino | Muestra una tarjeta "El almacén bovino tiene submódulos (Alimentos, Minerales, Farmacia, Otros) y control de lotes y vencimientos" con el botón "Abrir almacén bovino", que lleva a `goBovino({ section:'mas', screen:{ s:'almacen' } })`. No se usa `WarehouseModal` para bovino. |
| `RubroPanels` › Balance desde el Home con rubro Bovino | Se mantiene `TabBalance rubro="bovino"` (resumen) y se agrega arriba el botón "Ver balance ceba vs leche", que lleva a `goBovino({ section:'mas', screen:{ s:'balance' } })`. Solo Admin. |
| Centro de alertas global | Las alertas bovinas (retiros por vencer, partos, stock crítico) tienen el botón "Ir al hato", que navega a la pantalla de origen. |
| `useHardwareBackButton` | Se agrega la rama `mockupScreen === 'bovino'` con el orden de §2.4. Se quita `showBovinoModal` cuando ya no se use. |

---

## 3. Sistema visual del módulo

### 3.1 Tokens (en `bovino/ui.tsx`)

```ts
export const B = {
  accent: 'bg-sky-600 text-white',             // primario
  accentHover: 'hover:bg-sky-700 active:bg-sky-800',
  soft: 'bg-sky-50 text-sky-800 border-sky-200',
  chip: 'bg-sky-100 text-sky-800',
  text: 'text-sky-700',
  ring: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-1',
  card: 'bg-white rounded-2xl border border-slate-200 shadow-xs',
  screen: 'bg-slate-50',
  label: 'text-sm font-bold text-slate-900',
  hint: 'text-xs text-slate-700',               // mínimo legible
  number: 'tabular-nums font-black text-slate-900',
};
export const FOCUS_B = B.ring;
```

Estados con significado fijo (chips `h-7 px-2.5 rounded-full text-xs font-bold`):

| Significado | Clase |
|---|---|
| OK, óptimo, ingreso | `bg-emerald-100 text-emerald-800` |
| Atención, bajo, por vencer, crítico | `bg-amber-100 text-amber-900` |
| Pérdida, vencido, bloqueado, gasto | `bg-rose-100 text-rose-800` |
| Retiro activo | `bg-rose-600 text-white` (siempre sólido: tiene que verse a distancia) |
| Información, estado reproductivo | `bg-sky-100 text-sky-800` |
| Neutro, inactivo, cerrado | `bg-slate-200 text-slate-800` |

Estados reproductivos: Vacía `bg-slate-200 text-slate-800` · Servida `bg-sky-100 text-sky-800` ·
Preñada `bg-emerald-100 text-emerald-800` · Seca `bg-amber-100 text-amber-900` · En ordeño `bg-sky-600 text-white`.

GMD: verde `bg-emerald-600 text-white` si GMD ≥ umbral óptimo; amarillo `bg-amber-400 text-slate-900` si está
entre el umbral de estancamiento y el óptimo; rojo `bg-rose-600 text-white` si está en o por debajo del
estancamiento o es negativa. Los umbrales se toman de Configuración. El color siempre va con el número y una
palabra ("Óptima", "Baja", "Pérdida"), nunca solo.

### 3.2 Tipografía

- Título de pantalla: `text-xl font-black text-slate-900`.
- Título de tarjeta: `text-base font-bold text-slate-900`.
- Cifra principal: `text-3xl font-black tabular-nums`. Cifra de tarjeta: `text-2xl font-black`.
- Arete: siempre `font-black tabular-nums`, `text-lg` en listas y `text-4xl` en la ficha. En manga, `text-6xl`.
- Mínimo absoluto: `text-xs` (12 px) en `text-slate-700`. El cuerpo es `text-sm`/`text-base`.

### 3.3 Componentes propios de bovino (`bovino/ui.tsx`)

Se reutilizan de `../avicola/shared`: `Overlay`, `useEscape`, `FormSheet` (con `tone="sky"`), `BottomSheet`
(con `iconClass="bg-sky-100 text-sky-700"`), `ConfirmDialog`, `ErrorBox`, `SegmentedTabs`, `Donut`, `parseNum`,
`shortDate`, `longDate`. Como `DatePill`, `NumberInput`, `ChipGroup` y `KpiTile` usan foco amber y textos de 10-11 px,
en bovino se usan las versiones de abajo. **No se modifica `avicola/shared.tsx`**, así el avícola no cambia.

| Componente | Especificación |
|---|---|
| `BigNumberInput` | `h-14 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 text-right text-2xl font-black tabular-nums text-slate-900` con sufijo de unidad (`kg`, `L`, `ml`) dentro en `text-base font-bold text-slate-700`. Si es inválido: `border-rose-500 bg-rose-50`. Props: `decimal`, `unit`, `max`, `onEnter` (pasa al siguiente campo). |
| `AreteInput` | Input de búsqueda por arete, `inputMode="numeric"`, `h-14 text-2xl font-black`, ícono `Search`. Botón "Borrar" de 48 px. Resultados en vivo: coincidencia exacta primero y luego "empieza por". Permite letras solo si la granja las usa (Configuración › "Aretes con letras"). |
| `DateField` | Como `DatePill`, pero `h-12`, ícono `CalendarDays` en `text-sky-700` y anillo sky. No acepta fechas futuras para eventos realizados (`max = todayISO()`). |
| `MoneyField` | Moneda dual. Muestra un selector `USD │ Bs` (código local de Configuración) como `SegmentedTabs` de `h-10`, un `BigNumberInput` y debajo la conversión: "≈ 1.130,00 Bs · tasa 45,20 del 13 nov" en `text-xs text-slate-700`. Guarda `montoUsd`, `montoLocal`, `moneda` y `tasa`. Sin tasa configurada, solo permite USD y muestra un aviso amber "Configura la tasa del día para registrar en Bs". **Nunca se renderiza para Operario.** |
| `Money` | Muestra un monto. Por defecto en USD con el equivalente local debajo. Para Operario devuelve `null`. |
| `ChipFilter` | Filtros de una sola fila con scroll horizontal, `h-11 px-4 rounded-full border-2 text-sm font-bold`. Activo: `bg-sky-600 border-sky-600 text-white`. Inactivo: `bg-white border-slate-300 text-slate-800`. Con contador opcional ("Vacas 42"). |
| `StatusChip` / `RetiroChip` | Chips de §3.1. `RetiroChip` muestra el texto "Retiro leche 3 d" o "Retiro carne 12 d" e incluye `aria-label` con la fecha de fin. |
| `GmdChip` | Valor ("0,82 kg/d") más palabra, con los colores de §3.1. |
| `AnimalRow` | Fila de 64 px: a la izquierda el arete grande; al centro el nombre o categoría y "Lote · Potrero" en `text-xs text-slate-700`; a la derecha los chips de estado (máximo 2 más "+n") y `ChevronRight`. Toda la fila es el botón. |
| `Tile` | Mosaico de hub: `min-h-28 rounded-2xl bg-white border-2 border-slate-200 p-4 text-left`, con ícono en un cuadro `w-12 h-12 rounded-xl bg-sky-100 text-sky-700`, título `text-base font-black` y dato vivo `text-sm text-slate-800`. Al presionar: `active:scale-[0.98] active:border-sky-500`. |
| `CounterTile` | Contador del hato: `rounded-2xl bg-white border-2 border-slate-200 h-20 flex flex-col items-center justify-center`, cifra `text-2xl font-black` y etiqueta `text-xs font-bold text-slate-800`. Es tocable y abre la lista filtrada. |
| `Fab` | `absolute bottom-4 right-4 h-14 pl-2 pr-5 rounded-full bg-sky-600 text-white font-bold shadow-lg`, con el círculo interior `bg-white text-sky-700`. Solo en listas, nunca en formularios. Se deja `pb-24` en el contenido para que no tape la última fila. |
| `Can` | Envoltorio de permisos: `<Can do="verCostos">…</Can>`. Usa `perms` del contexto (§4). |
| `SyncDot` | Punto amber de 8 px con el texto `sr-only` "Pendiente de subir" en los registros con escrituras pendientes (`metadata.hasPendingWrites`), si el controlador lo expone. Si no, no se muestra. |
| `EmptyBlock` | Estado vacío: ícono lucide en un círculo `w-16 h-16 bg-sky-50 text-sky-700`, título `text-base font-black text-slate-900`, explicación `text-sm text-slate-700` y CTA `h-12 px-6 rounded-2xl bg-sky-600 text-white font-bold`. Sin ilustraciones ni fotos. |
| `LimitConfirm` | `ConfirmDialog` para topes lógicos (§5.2). El botón de confirmar dice "Sí, es correcto" y el de cancelar "Corregir". |
| `BlockedNotice` | Bloque sólido `rounded-2xl bg-rose-50 border-2 border-rose-300 p-4`, con ícono `Ban` en `text-rose-700`, título `text-base font-black text-rose-900` y motivo y fecha de desbloqueo en `text-sm text-rose-900`. Se usa en estados excluyentes y retiros. |

### 3.4 Gráficos

Sin librerías: SVG propio como `Donut`. Línea de 2 px en `stroke-sky-600`, puntos de 6 px, ejes en `stroke-slate-300`
y etiquetas en `text-xs fill-slate-700`. Las caídas se marcan con un punto `fill-rose-600` y la anotación "−32 %".
Cada gráfico lleva al lado una **tabla equivalente** que se puede desplegar ("Ver datos"), para accesibilidad y
para leer con sol.

---

## 4. Roles y permisos

| Permiso (`perms.*`) | Operario (Operador, Trabajador) | Encargado (Veterinario) | Propietario (Administrador) |
|---|---|---|---|
| `verCostos` (montos, valorización, costo/kg, costo/L) | No | Sí, solo de insumos y tratamientos | Sí |
| `verBalance` (Balance, Liquidación, flujo de caja) | No | No | Sí |
| `cargaDiaria` (ordeño, pesaje, nacimiento, ración/consumo de alimento, calostro) | Sí | Sí | Sí |
| `altaAnimales` | Solo nacimientos (vía parto) | Sí | Sí |
| `moverLotes` (lotes, potreros, mover) | No (solo ve) | Sí | Sí |
| `reproduccion` (servicio, diagnóstico, secado, destete) | No (ve la agenda) | Sí | Sí |
| `sanidad` (aplicar tratamiento, evaluar) | No. Solo marca como hecho un tratamiento programado en manga si lo habilita Configuración. | Sí | Sí |
| `farmacia` (compras y entradas de farmacia, lotes y vencimiento) | No | Sí | Sí |
| `almacenSalidas` (salida con destino) | Solo alimento y minerales a su lote | Sí | Sí |
| `precios` (precio de leche, kg, compras, ajustes de inventario) | No | No | Sí |
| `ventas` y `cerrarLote` | No | No | Sí |
| `bajas` (muerte, descarte, traslado) | Puede reportar una muerte, que queda "Por confirmar" | Sí | Sí |
| `config` | No | Parámetros reproductivos y plan sanitario | Todo (moneda, tasa, topes, prorrateo, umbrales) |
| `bitacora` | No | No | Sí |
| `exportar` | Lista de ganado y ordeño, sin montos | Más inventario sin montos | Todo |

Reglas de UI:
- Lo que el rol no puede hacer **no se muestra**. No se ven botones deshabilitados con candado, salvo en la
  ficha del animal, donde una acción no permitida aparece en gris con el texto "Lo registra el encargado", para
  que el operario sepa a quién avisar.
- Para el Operario, `Money` y `MoneyField` no se renderizan. Las tarjetas que solo tienen montos (Balance,
  Valorización) se ocultan completas. En Más solo ve: Almacén (stock sin valores), Exportar (lista de ganado y
  ordeño) y Volver a la granja.
- Las ediciones y borrados siguen la regla "el autor o un rol superior": el Operario solo edita sus propios
  registros del día; después de 24 h solo los edita el Encargado o el Admin.

---

## 5. Patrones transversales

### 5.1 Formularios

- Se usa `FormSheet tone="sky"` a pantalla completa, con la pregunta grande arriba ("¿Cuánto pesó?") y el pie
  fijo con `PrimaryButton` de `h-14` a todo el ancho.
- Si hay datos escritos, `dirty` pide confirmación antes de descartarlos (ya implementado en `FormSheet`).
- Los errores se muestran junto al campo en `text-sm text-rose-700 font-semibold`, más un `ErrorBox` al pie con
  el error del dominio (`'error' in res`).
- Al guardar bien se muestra un toast con lo que pasó, que también funciona sin conexión: "Pesaje guardado ·
  #402 · 412 kg". Sin red, el banner global ya avisa y el toast agrega "Se subirá al volver la señal".
- Todos los formularios de evento tienen `DateField` con hoy por defecto y `max = hoy`.

### 5.2 Topes lógicos (confirmación, no bloqueo)

Los valores salen de Configuración. Los de abajo son valores por defecto **a confirmar** (ver Dudas).

| Dato | Pide confirmación si | Texto |
|---|---|---|
| Peso de un animal | > 1.200 kg, o < 15 kg en un animal que no es cría | "¿#402 pesa 4.500 kg? Es más de lo normal (máx. 1.200 kg)." |
| Cambio de peso desde el último pesaje | variación > 30 %, o GMD > 2,5 kg/d | "Subió 180 kg en 20 días (9 kg/d). ¿Está bien el peso?" |
| Litros por vaca en un ordeño | > 40 L | "¿350 L en un ordeño? Lo normal es menos de 40 L." |
| Litros del tanque | > (vacas en ordeño × 40) | similar |
| Peso al nacer | > 60 kg o < 15 kg | similar |
| Dosis calculada | > dosis máxima por animal del producto | "Dosis 45 ml supera el máximo de 30 ml por animal." |
| Cantidad de una salida de almacén | > 50 % del stock en una sola salida | "Vas a sacar 18 de 20 sacos." |
| Precio | ±50 % respecto al último precio registrado | "El precio es la mitad del último (0,45 $/L)." |

Se usa `LimitConfirm`: ícono amber, cifra destacada en `text-2xl font-black` y botones "Corregir" (secundario,
devuelve el foco al campo) y "Sí, es correcto" (primario). La confirmación queda registrada en el evento
(`confirmedOutlier: true`).

### 5.3 Estados excluyentes y bloqueos (no se pueden saltar)

| Caso | Dónde aparece | Comportamiento |
|---|---|---|
| Servir a una vaca Preñada o Seca | Selector de vaca en Servicio, Manga, Ficha | La vaca aparece en la lista con el chip de estado, atenuada (`opacity-60`) y con el texto "No se puede servir: preñada (FPP 12 mar)". No se puede seleccionar. Si se escribe el arete: `BlockedNotice`. |
| Servir antes del PEV | Servicio | **Advertencia** amber, no bloqueo: "Lleva 32 días posparto (PEV 45). ¿Servir de todas formas?" |
| Diagnóstico de una vaca sin servicio | Diagnóstico | Permite "Vacía" y bloquea "Preñada" sin servicio previo. Ofrece "Registrar el servicio primero". |
| Parto en una vaca no preñada | Parto | Advertencia: "No tiene preñez registrada". Permite registrar (puede venir de otra finca) con confirmación. |
| Ordeñar una vaca Seca | Ordeño | No aparece en la lista por vaca. En la búsqueda: "#118 está seca desde el 2 oct". |
| Leche con retiro activo | Ordeño | La fila se muestra en `bg-rose-50` con `RetiroChip`. Los litros se registran con destino **Descarte** o **Terneros** (selector) y no suman al tanque ni a la venta. |
| Vender un animal con retiro de carne | Venta, Liquidación, Salida a faena | `BlockedNotice` "#402 tiene retiro de carne hasta el 25 nov (Ivermectina 1 %). No se puede vender." El animal se excluye de la selección. En una liquidación por lote se lista quién bloquea y el botón "Liquidar sin estos animales". |
| Usar un medicamento vencido | Tratamiento, Salida de almacén | El lote del fabricante vencido aparece con el chip rose "Vencido" y no se puede elegir. Si todos están vencidos, se bloquea el producto: "Sin lotes vigentes". |
| Stock insuficiente | Tratamiento, Salida, Ración | Error: "Solo hay 120 ml de Oxitetraciclina (lote A123)". Ofrece usar otro lote o registrar una compra (si tiene permiso). |
| Arete duplicado | Alta | Bloqueo si existe un animal **activo** con el mismo arete: "El arete 402 ya es de Vaca Pinta (Lote Lechería 1)". |
| Animal dado de baja | Cualquier acción | Las fichas de animales vendidos o muertos son solo lectura, con la franja `bg-slate-800 text-white` "Vendido el 3 nov · solo lectura". |
| Lote liquidado | Lote | Solo lectura. No se puede mover ni agregar animales. |

### 5.4 Listas largas

- Cada lista lleva arriba un `AreteInput` fijo (`sticky top-0 bg-slate-50 z-10`) y debajo `ChipFilter`.
- Más de 100 filas: render incremental de 50 en 50 con un botón "Ver 50 más" de `h-12`. No se usa scroll infinito.
- Orden por defecto: arete ascendente (numérico). Opciones: últimos registrados, peso y GMD.

### 5.5 Sin conexión

- Todo funciona igual sin red. No hay pantallas "requiere conexión", salvo **Exportar › Compartir**, que avisa
  "Se compartirá cuando haya señal" si la acción lo necesita.
- La Bitácora y el historial muestran `createdByName` y la hora local del dispositivo.

---

## 6. Pantallas: Etapa A

### A1. Inicio del hato (sección Hato)

**Estructura** (scroll, `bg-slate-50 pb-6`):

1. **Tarjeta del hato**: `B.card p-4`.
   - Fila: ícono `Beef` en `w-12 h-12 rounded-xl bg-sky-600 text-white`, la cifra total en `text-4xl font-black`
     con la etiqueta "animales en la finca" (`text-sm font-bold text-slate-800`) y, a la derecha, el botón
     "+ Ingresar ganado" (`h-12 px-4 rounded-2xl bg-sky-600 text-white font-bold`; solo con `altaAnimales`).
   - Contadores en `grid grid-cols-3 gap-2 mt-3` con `CounterTile`: **Crías · Levante · Novillas · Vacas · Toros · Ceba**.
     Cada uno abre Animales filtrado por esa categoría.
   - Fila de estados (si hay vacas): "En ordeño 38 · Secas 6 · Preñadas 21 · Vacías 11", en chips tocables que
     abren Repro filtrado.
2. **Botón MODO MANGA**: `w-full h-16 rounded-2xl bg-slate-900 text-white text-lg font-black flex items-center justify-center gap-3`,
   con ícono `Zap` (o `ScanLine`) en `text-sky-300`. Debajo: "Pesajes y tratamientos animal por animal". Visible
   para todos los roles; el contenido se filtra por permisos.
3. **Hoy** (avance de la Agenda): hasta 5 ítems (`AgendaItemRow`, ver A9) y el enlace "Ver toda la agenda (12)"
   (`h-12 text-sky-700 font-bold`).
4. **Alertas**: tarjetas compactas, una por tipo y solo si hay:
   - "3 animales con retiro activo" (rose), que abre Sanidad › Retiros;
   - "2 insumos en stock crítico · 1 vencido" (amber), que abre Almacén;
   - "Caída de leche en 2 vacas" (amber), que abre Leche;
   - "Lote Ceba 1 listo para faena en 12 días" (sky), que abre Ceba.
5. **Accesos rápidos** (`grid grid-cols-2 gap-2`, `Tile` compactos de `min-h-20`): Registrar ordeño · Pesaje rápido ·
   Aplicar tratamiento · Mover lote. Se ocultan los que el rol no puede usar; el Operario ve Ordeño, Pesaje,
   Ración y Reportar nacimiento.
6. **Producción de hoy** (si hay datos): `StatStrip` sky con Leche hoy (L) · L/vaca · GMD ceba (kg/d) · Partos
   del mes.
7. **Solo Admin**: mini balance del mes "Utilidad del mes" con Ceba y Leche/cría, en `Money`, que abre Balance.

**Estado vacío** (granja sin animales): la tarjeta del hato con contadores en 0 y, debajo, un `EmptyBlock` con
ícono `Beef`, el título "Aún no hay ganado registrado" y el texto "Empieza creando tus potreros y luego ingresa
tus animales por lote o uno a uno.". CTA en dos pasos con número: "1. Crear potrero" (si no hay potreros) y
"2. Ingresar ganado" (deshabilitado con el texto "Primero crea un potrero" mientras no exista ninguno).

### A2. Animales (lista)

Se entra desde los contadores, desde Campo › Lotes › lote, o desde "Ver todos" del Hato.

- Arriba, fijo: `AreteInput` con el placeholder "Buscar arete o nombre".
- Filtros (`ChipFilter`, varias filas desplegables con "Filtros (2)"):
  - Categoría: Todas, Crías, Levante, Novillas, Vacas, Toros, Ceba.
  - Lote: selector de `BottomSheet` con la lista de lotes.
  - Potrero: selector.
  - Estado: En ordeño, Seca, Preñada, Vacía, Servida, Con retiro, En tratamiento.
  - Sexo: Hembras, Machos.
  - Situación: Activos (por defecto), Vendidos, Muertos, Todos.
- Resumen del filtro: "42 animales · peso prom. 385 kg" (el peso promedio solo si hay pesajes).
- Lista de `AnimalRow`. Al tocar una fila se abre la Ficha.
- **Acción masiva**: un toque largo, o el botón "Seleccionar", activa la selección múltiple (checkbox de 28 px por
  fila). Barra inferior contextual (la `BovinoNav` se reemplaza por `h-16 bg-slate-900 text-white`, una sola
  barra) con: Mover · Tratar · Pesar · Cambiar lote. Se muestra según los permisos.
- FAB "Ingresar ganado" (solo con `altaAnimales`).
- Vacío con filtros: "Ningún animal coincide con los filtros" y el botón "Quitar filtros".
- Vacío total: igual que el Hato vacío.

### A3. Alta de ganado (Por lote / Por animal)

`FormSheet tone="sky" title="Ingresar ganado"`. Sigue la referencia 13 con mejoras:

1. **Fecha de ingreso**: `DateField`.
2. **Potrero** (obligatorio): botón grande con borde punteado `h-16 border-2 border-dashed border-slate-400 rounded-2xl`
   con el texto "Toca para elegir potrero" e ícono `Map`. Abre un `BottomSheet` con potreros en tarjetas que
   muestran su estado (Ocupado por Lote X, En descanso N días, Disponible). Si no hay potreros: botón
   "Crear potrero" en línea (A6 abreviado).
3. **Lote destino** (opcional): selector con "Sin lote" o "+ Nuevo lote" en línea (nombre y propósito).
4. **Modo**: dos tarjetas grandes `h-32 rounded-2xl border-2` en `grid-cols-2`, **Por lote** (ícono `Users`) y
   **Por animal** (ícono `Beef`). Seleccionada: `border-sky-600 bg-sky-50 ring-2 ring-sky-200`.
5. **Procedencia**: chips Nacido en finca · Compra · Traslado desde otra finca.

**Por animal** (campos en orden):
- Arete (`AreteInput`, obligatorio, validación de único en vivo).
- Nombre (opcional, texto).
- Sexo: chips grandes Hembra / Macho.
- Edad: chips "Fecha exacta" o "Edad aproximada". Con fecha exacta: `DateField`. Con edad aproximada: `Stepper`
  de meses o años, y se guarda la fecha estimada marcada como "aprox.".
- Raza: selector con la lista de Configuración (Brahman, Gyr, Holstein, Pardo Suizo, Carora, Mestizo, Otra).
  "Otra" abre un campo de texto.
- Propósito: chips Lechería/Cría · Ceba · Reproductor. Junto con el sexo y la edad, define la categoría automática,
  que se muestra en vivo como "Se registrará como: **Novilla**" con la opción "Cambiar".
- Para hembras adultas: "¿Ya parió?" Sí/No y "Estado": Vacía / Preñada (pide la fecha aproximada de servicio o
  los meses de gestación y calcula la FPP) / En ordeño. Esto evita que una vaca comprada entre "Vacía" por defecto.
- Peso de ingreso (`BigNumberInput kg`, opcional; si se llena, crea el primer pesaje como evento).
- Madre (solo si nació en la finca): selector de vacas.
- Con `verCostos` y procedencia Compra: Costo de compra (`MoneyField`), como total o $/kg (chips).
- Pie: "Guardar y otro" (secundario, conserva fecha, potrero, lote, procedencia y raza) y "Guardar" (primario).

**Por lote**:
- Cantidad (`Stepper` más `BigNumberInput`; tope 1.000 con confirmación).
- Aretes: chips "Rango" (Desde ___ Hasta ___; calcula la cantidad y avisa si no coincide) · "Lista" (un campo por
  animal en lista rápida) · "Asignar después" (genera aretes provisionales "P-001…" marcados en amber
  "Arete pendiente").
- Sexo, Raza, Propósito, Edad aproximada: comunes al grupo.
- Peso: chips "Promedio del grupo" (un solo valor) o "Individual" (lista rápida arete por peso, el mismo patrón
  que B1).
- Con `verCostos`: costo total de la compra o $/kg × peso total, con el reparto por animal mostrado:
  "≈ 512,40 $ por animal".
- Resumen antes de guardar: tarjeta sky con "Se ingresarán 30 novillos de ceba · Potrero La Ceiba · Lote Ceba 3 ·
  peso prom. 220 kg · costo 15.372 $".
- Guardar crea N documentos de animal y N eventos de alta en un solo lote de escritura.

Validaciones visibles: arete duplicado (bloqueo, §5.3), fecha futura no permitida, potrero obligatorio ("Elige el
potrero"), topes de peso (§5.2), rango Desde ≤ Hasta.

### A4. Ficha del animal

Cabecera de la pantalla (debajo de `GranjaHeader`, que muestra "Vaca 402"):

- Tarjeta `B.card p-4`:
  - Arete `text-4xl font-black` y nombre `text-lg font-bold`.
  - Chips: categoría, sexo, estado reproductivo y productivo, `RetiroChip` (si aplica) y "Arete pendiente" (si aplica).
  - Datos en `grid grid-cols-2 gap-y-2 text-sm`: Edad "3 a 4 m" · Raza · Lote · Potrero (con días) ·
    Último peso "412 kg · hace 12 d" · GMD (chip). Para hembras: Partos 2 · Días en leche 145 · FPP.
  - Con `verCostos` (Admin): "Costo acumulado 742 $".
- **Acciones** (`grid grid-cols-3 gap-2`, botones `h-16 rounded-2xl bg-white border-2 border-slate-200 flex flex-col items-center justify-center text-xs font-bold`):
  Pesar · Tratar · Mover · Ordeño (vaca en leche) · Servicio · Diagnóstico · Parto (hembras) · Baja · Venta (Admin).
  Las acciones bloqueadas por estado se muestran deshabilitadas con el motivo debajo ("Preñada").
- **Pestañas** (`SegmentedTabs`, `h-12`): Resumen | Historial | Producción | Sanidad.
  - **Resumen**: estado actual explicado en frases ("Preñada de 180 días · Secar el 12 ene · Parto el 12 mar"),
    madre y crías (enlaces), últimos 3 eventos.
  - **Historial** (línea de tiempo): chips de filtro Todo · Pesajes · Repro · Sanidad · Movimientos · Leche.
    Eventos agrupados por mes (`sticky` "Noviembre 2026", `text-sm font-black`). Cada evento es una fila con un
    punto de color e ícono (pesaje `Scale` sky, servicio `Heart` sky, diagnóstico `Stethoscope` emerald/slate,
    parto `Baby` emerald, tratamiento `Syringe` rose, movimiento `ArrowRightLeft` slate, ordeño `Milk` sky,
    alta/baja `LogIn/LogOut` slate). El título va en `text-sm font-bold` ("Pesaje 412 kg · GMD 0,82"), y debajo
    "13 nov 7:42 · Juan Pérez" en `text-xs text-slate-700`, con "editado" si tiene `updatedAt`. Al tocar un
    evento se abre una hoja de detalle con Editar o Eliminar (según §4). Eliminar pide confirmación y deja una
    marca en la Bitácora. Va del más reciente al más antiguo y termina en "Nacimiento" o "Ingreso por compra".
  - **Producción**: si es de ceba, gráfico de pesos y tabla de pesajes con GMD por tramo. Si es vaca, la curva
    de la lactancia actual (enlace a B3) y una tabla de lactancias (inicio, días, total L, pico).
  - **Sanidad**: tratamientos con producto, dosis, fecha, fin de retiro, diagnóstico y efectividad (el botón
    "Evaluar" queda pendiente si falta).
- **Baja** (Encargado/Admin; el Operario solo reporta una muerte): `FormSheet` con el motivo en chips (Muerte ·
  Descarte · Traslado · Robo/Pérdida), fecha, causa (chips por motivo y "Otra") y nota. Con descarte por venta,
  pasa a Venta (B6). Confirmación `danger` con `requireText` = arete.

### A5. Lotes

**Lista** (Campo › Lotes):
- Filtro por propósito: Todos · Ceba · Lechería · Cría · Levante · Reproductores. Situación: Activos / Cerrados.
- Tarjeta de lote (`B.card p-4`, `min-h-28`): nombre `text-lg font-black`, chip de propósito, chip de **unidad
  productiva** (Ceba / Leche y cría; es la que decide a dónde van los costos), "32 animales · Potrero La Ceiba
  (18 d)". Para ceba: peso promedio y `GmdChip`, más "Faena est.: 15 ene". Para lechería: "L/día 312 · 26 en
  ordeño". Menú `⋮` de 48 px con Editar · Mover · Cerrar (ceba: Liquidar, solo Admin) · Eliminar (solo sin
  animales ni eventos).
- Vacío (referencia 9): `EmptyBlock` con ícono `Users`, el título "Sin lotes creados" y el texto "Agrupa tus
  animales para moverlos, pesarlos y llevar sus costos juntos.", CTA "Crear lote".
- FAB "Nuevo lote".

**Formulario de lote**: Nombre (sugerido: "Ceba 3"), Propósito (chips), Unidad productiva (por defecto según el
propósito: Ceba → Ceba; el resto → Leche y cría; editable), Potrero inicial, Peso objetivo de faena (solo ceba;
por defecto el de Configuración) y Notas.

**Detalle de lote**: cabecera con nombre, chips y `StatStrip` (Animales · Peso prom. · GMD · Días en potrero).
Pestañas Animales | Indicadores | Movimientos.
- *Animales*: lista de `AnimalRow`, botón "Agregar animales" (un selector con búsqueda y multiselección de
  animales de otros lotes) y "Sacar del lote".
- *Indicadores*: para ceba, el resumen de B1 (GMD, conversión, proyección). Para leche, el resumen de B3.
- *Movimientos*: historial de potreros del lote y salidas de almacén imputadas (con monto si `verCostos`).

### A6. Potreros

**Lista** (referencia 10, mejorada):
- Filtro: Todos · Disponibles · Ocupados · En descanso, con contadores.
- Tarjeta de potrero (`B.card p-4`): nombre `text-lg font-black`, área "12 ha", pasto (texto o selector) y estado:
  - **Ocupado**: chip `bg-sky-600 text-white` "Ocupado", "Lote Ceba 2 · 32 animales · 18 días". Barra de
    ocupación contra los días máximos de ocupación de Configuración o del potrero: verde hasta el 70 %, amber
    hasta el 100 % y rose después, con el texto "Pasado 3 días".
  - **En descanso**: chip amber "Descanso 12 / 30 d" y barra de progreso del descanso. Al completarse pasa a
    Disponible automáticamente (por cálculo).
  - **Disponible**: chip emerald "Disponible", "Descansó 34 días".
  - Botón "Mover aquí" (`h-12`, solo con `moverLotes`).
- Vacío: `EmptyBlock` con ícono `Map`, el título "Sin potreros creados", el texto "Crea tu primer potrero para
  organizar el pastoreo, la ocupación y el descanso." y CTA "Registrar potrero".
- **Formulario de potrero**: Nombre, Área (`decimal`, ha), Tipo de pasto (selector más Otro), Días de descanso
  objetivo (por defecto el de Configuración), Días máximos de ocupación y Capacidad (UA, opcional).
- **Detalle de potrero**: estado actual, historial de ocupaciones (lote, entrada, salida, días) y promedio de
  descanso.

**Mover (dos toques más confirmar)**:
- Desde un lote, con "Mover": `BottomSheet` "¿A qué potrero?" con potreros en tarjetas de 72 px, ordenados primero
  Disponibles, luego En descanso (marcados "Descanso incompleto 12/30 d") y al final Ocupados (marcados "Ya tiene
  Lote X, se juntarán"). Toque 1 = lote (ya elegido por el contexto); toque 2 = potrero; la confirmación final se
  hace en la misma hoja, en el pie: "Mover Lote Ceba 2 a La Ceiba hoy" con `DateField` compacto (hoy por defecto)
  y el botón "Mover".
- Desde un potrero, con "Mover aquí": "¿Qué lote entra?" con la lista de lotes y la misma confirmación.
- Animales sueltos: desde la selección múltiple de la lista, "Mover" pregunta "¿A lote o a potrero?" con dos
  tarjetas, y después la misma hoja.
- Un movimiento crea un **evento de movimiento** (lote, desde, hacia, fecha). El potrero de origen pasa a "En
  descanso" desde esa fecha.
- Advertencias (no bloquean): destino en descanso incompleto (amber) o destino ocupado (amber, "se juntarán dos
  lotes en el potrero").

### A7. Almacén bovino (Más › Almacén)

Es una pantalla del módulo, no un modal.

- Cabecera de la pantalla: `StatStrip` con Insumos · Críticos (amber) · Vencidos o por vencer (rose) ·
  **Valor en almacén** (solo con `verCostos`).
- Pestañas de submódulo (`SubTabs`, la versión sky): **Alimentos** (`Wheat`) · **Minerales** (`Gem` o `Mountain`) ·
  **Farmacia** (`Pill`) · **Otros** (`Wrench`), con insignia de críticos por pestaña.
- Búsqueda más el filtro Todos · Críticos · Por vencer (Farmacia) · Por bodega o silo (Alimentos).
- **Tarjeta de insumo** (`B.card p-4`):
  - Nombre `text-base font-black`, presentación "Saco 40 kg", bodega o silo.
  - Stock `text-3xl font-black` más unidad, y "≈ 9 días de consumo" según el consumo promedio de los últimos 30 días.
  - Barra contra el umbral: rose si stock ≤ umbral ("Stock crítico"), amber si ≤ 1,5 × umbral.
  - Farmacia: lotes del fabricante en mini-tabla (Lote · Vence · Cantidad) con un chip por lote (Vencido rose ·
    Vence en 20 d amber · Vigente). Retiro carne/leche del producto y dosis de referencia "1 ml / 50 kg".
  - Con `verCostos`: costo unitario y valor del stock.
  - Botones `h-12`: **Salida** (primario sky) · **Compra** (`farmacia`/`precios`) · `⋮` (Editar · Ajuste por conteo
    (Admin) · Kardex).
- **Compra o entrada** (`FormSheet`): insumo existente o "+ Nuevo insumo"; cantidad más unidad; con
  `verCostos`/`precios`, costo (`MoneyField`, total o unitario); proveedor (selector con los últimos); factura
  (opcional); bodega o silo (alimentos). **Farmacia: el número de lote del fabricante y la fecha de vencimiento
  son obligatorios**. La fecha de vencimiento ya pasada se rechaza con "Este lote ya está vencido; no se puede
  ingresar". Si el registro incluye monto, también crea el egreso financiero con el rubro bovino.
- **Salida con destino obligatorio** (`FormSheet` "Registrar salida"):
  1. Insumo (prellenado si viene de la tarjeta) y, en Farmacia, el lote del fabricante (FEFO por defecto: el que
     vence primero).
  2. Cantidad (`BigNumberInput` con unidad y "Hay 20 sacos").
  3. **Destino** (chips grandes, obligatorio): Lote (selector de lotes; asigna la unidad productiva del lote) ·
     Animal (`AreteInput`) · Sanidad general · Mantenimiento/Finca · Otro (texto corto obligatorio). Si no se
     elige, el botón queda deshabilitado y debajo dice "Elige a dónde va el insumo".
  4. Para Minerales y Alimentos hacia un lote: "¿Es la ración de hoy?" Sí/No. Si es Sí, se registra también como
     ración del lote (B1).
  5. Resumen: "5 sacos de Alimento Ceba al Lote Ceba 2" y, con `verCostos`, "= 112,50 $ a costos de Ceba".
- **Insumo nuevo**: nombre, submódulo, presentación y unidad (selector: kg, saco 40 kg, t, L, ml, unidad, dosis,
  pajuela), umbral de stock crítico, bodega o silo. En Farmacia: tipo (Vacuna, Desparasitante, Antibiótico,
  Hormona, Vitamina, Semen/Pajuela, Material quirúrgico, Otro), **retiro carne (días)**, **retiro leche (días)**,
  **dosis** (modo: "por peso" con ml por N kg, o "fija" con ml por animal), dosis máxima por animal y vía (IM,
  SC, IV, Oral, Tópica, Intramamaria). Para Semen/Pajuela: toro o raza.
- **Kardex**: lista de movimientos (entrada, salida, ajuste) con fecha, cantidad, destino, usuario y, si
  `verCostos`, el monto. Filtro por rango.
- Operario: ve el stock sin valores y solo puede registrar Salida de Alimentos y Minerales a lotes.
- Vacío por submódulo: "Sin alimentos registrados · Registra tu primera compra para controlar el stock" con CTA
  "Registrar compra" (o, para el Operario, "Pide al encargado que registre los insumos").

### A8. Sanidad (Campo › Sanidad)

**Hub**:
- Tarjeta superior en rose si hay retiros: "**Retiros activos (3)**", con la lista de cada animal o lote: arete,
  producto, chips "Carne 12 d" / "Leche 3 d" y la fecha de fin. Al tocar se abre la ficha.
- Botón primario `h-14` "Aplicar tratamiento" (`sanidad`).
- Secciones: **Programados** (tareas sanitarias pendientes del rubro bovino: hoy, vencidas, próximas) ·
  **Historial clínico** (filtro Preventivo/Curativo, producto, rango) · **Por evaluar** (curativos sin efectividad
  registrada después de N días).
- Vacío: "Sin tratamientos registrados · Al aplicar un medicamento se descuenta de la farmacia y se controla su
  retiro." con CTA.

**Aplicar tratamiento** (`FormSheet tone="sky" title="Aplicar tratamiento"`):
1. **A quién**: chips Animal · Varios aretes · Lote.
   - Animal: `AreteInput`. Varios: lista de aretes agregados como chips eliminables. Lote: selector, que muestra
     "32 animales".
2. **Tipo**: chips Preventivo · Curativo.
3. Si es curativo: **Diagnóstico o síntomas**, con chips frecuentes (Fiebre, Diarrea, Neumonía, Mastitis,
   Cojera, Garrapatas, Herida, Otro) y nota.
4. **Producto**: selector de la **farmacia** (solo Farmacia bovina; muestra stock, retiros y dosis de referencia).
   Los vencidos o sin stock aparecen deshabilitados con el motivo. Debajo, el lote del fabricante (FEFO por defecto).
5. **Dosis**:
   - Producto "por peso": se muestra "Dosis por peso: 1 ml / 50 kg". Para un animal: "Peso usado: 412 kg (pesaje
     del 1 nov)", o un `BigNumberInput` "Peso estimado" si no hay pesaje, y el resultado en
     `text-3xl font-black text-sky-700`: "8,2 ml", redondeado a 0,5 ml (o al paso del producto). Para un lote o
     varios aretes: una tabla con arete, peso y dosis, más el **total a descontar** "263,5 ml". Los animales sin
     peso usan el promedio del lote y se marcan "peso promedio".
   - Producto "fijo": dosis por animal × N.
   - El valor se puede editar a mano: queda marcado como "dosis manual" y aplica el tope de dosis máxima.
6. **Retiro**: un bloque informativo amber, "Retiro hasta: carne **25 nov** · leche **16 nov**". Si es una vaca en
   ordeño: "La leche de #402 se marcará como descarte hasta el 16 nov".
7. **Repetir**: Toggle "Programar repeticiones": cada N días × N veces. Crea tareas en la Agenda.
8. Con `verCostos`: "Costo: 12,40 $ → Sanidad del Lote Ceba 2 (Ceba)".
9. Pie: "Aplicar a 32 animales".

Al guardar: un evento de tratamiento por animal, una salida de almacén con destino (el lote o el animal) y el
retiro calculado. Errores: stock insuficiente (§5.3), producto vencido o falta de peso cuando el producto es por
peso y no hay promedio (se pide el peso estimado).

**Evaluar tratamiento**: `BottomSheet` con chips Curado · Mejoró · Sin respuesta · Murió y una nota. "Murió" abre
la Baja con la causa prellenada.

### A9. Agenda del día (sección Agenda = "Actividades" del módulo)

**Lista de trabajo** (pensada para leerla en la mañana y apartar animales):

- Selector de día: `SegmentedTabs` Vencidas (n) · **Hoy** · Mañana · Semana. Debajo, el botón "Calendario" (vista
  de mes con puntos por día; al tocar un día se ve su lista).
- Agrupación por acción, cada grupo con su ícono y conteo: **Palpar (3)** · **Secar (2)** · **Servir/IATF (4)** ·
  **Partos próximos (1)** · **Calostro (1)** · **Destetar (5)** · **Pesar (Lote Ceba 2)** · **Tratamientos (8)** ·
  **Fin de retiro (2)** · **Mover lote (potrero pasado de días)** · **Reponer insumo (2)**.
- `AgendaItemRow` (`min-h-16 bg-white rounded-2xl border-2 border-slate-200 p-3 flex items-center gap-3`):
  - Checkbox grande (`w-8 h-8 rounded-lg border-2`) para marcar Hecho si la acción no necesita datos (por ejemplo,
    "Apartar #402"). Si necesita datos, el botón de la derecha es "Registrar" y abre el formulario prellenado.
  - Texto `text-base font-bold`: "Vaca **#402**: palpar hoy". Detalle `text-xs text-slate-700`: "Servida el 15 sep
    (59 d) · Potrero La Ceiba".
  - Chip de motivo o urgencia: Vencida 2 d (rose) · Hoy (sky) · Mañana (slate).
- Botón superior "Llevar a la manga" (`h-12`, `bg-slate-900 text-white`): abre el **Modo manga** precargado con los
  animales de la lista de hoy.
- Botón "Compartir lista" (texto plano a WhatsApp con los aretes por acción, sin montos). Usa el mismo mecanismo
  que Exportar (B8) cuando exista; mientras tanto, copia al portapapeles.
- Fuentes de los ítems (calculados en dominio, no se guardan salvo las tareas manuales):
  - Etapa A: tareas sanitarias bovinas (`SanitaryTask` con `targetRubro:'bovino'`), fin de retiro, potrero
    pasado de días, stock crítico o vencimiento, tratamientos por evaluar.
  - Etapa B: PEV cumplido, palpación, secado, parto próximo (FPP − 7), calostro (≤ 6 h después del parto),
    destete, pesaje periódico de ceba, IATF.
- "+ Actividad" (Encargado/Admin): `FormSheet` con título (chips frecuentes: Vacunación, Desparasitación, Vitaminas,
  Palpación, Baño garrapaticida, Otro), fecha, a quién (animal, lote o todo el hato), producto opcional de la
  farmacia y responsable (selector de miembros).
- Vacío: `EmptyBlock` con ícono `CalendarCheck`, el título "Nada pendiente para hoy" y el texto "Las palpaciones,
  secados, partos y tratamientos aparecerán aquí."

### A10. Hub Campo y Más

- **Campo**: `grid grid-cols-2 gap-3` de `Tile` con un dato vivo cada uno: Lotes "5 activos" · Potreros "3 ocupados
  · 4 disponibles" · Ceba "GMD 0,78 kg/d" · Leche "312 L hoy" · Sanidad "3 retiros" · Entradas y salidas "2 este
  mes". Ceba y Leche son de la Etapa B: mientras no existan, el Tile muestra "Próximamente" y no navega.
- **Más**: lista de filas `h-16` con ícono, título, subtítulo y chevron: Almacén bovino (insignia de críticos) ·
  Balance · Reportes y KPIs · Exportar y respaldo · Configuración bovina · Bitácora · **Volver a la granja**
  (`text-sky-700`). Se filtra por rol (§4).
- **Entradas y salidas** (Etapa A): historial de altas, bajas y movimientos con filtros Compras · Nacimientos ·
  Ventas · Muertes · Traslados y por rango (referencia 7). Las ventas se registran en B6.

---

## 7. Pantallas: Etapa B

### B1. Ceba (Campo › Ceba)

**Resumen**: selector de lote de ceba (chips con los lotes de propósito Ceba; si hay uno solo, se elige solo).
- `StatStrip`: Animales · Peso prom. · **GMD del lote** (chip) · **Faena est.**
- Tarjeta **Proyección a faena**: "Peso objetivo 480 kg · promedio actual 412 kg · GMD 0,82 → **faltan 83 días ·
  4 feb 2027**". Barra de progreso hacia el peso objetivo y la lista "Listos para venta (≥ 480 kg): 4 animales",
  que abre la selección para venta (B6). Si la GMD es ≤ 0: "Con la GMD actual no alcanza el peso objetivo"
  (rose).
- Tarjeta **Alimentación y conversión** (sin montos para el Operario): kg de alimento entregados en el periodo,
  kg ganados, **conversión** "7,8 kg alimento / kg ganado", con un chip según el umbral de Configuración.
  Con `verCostos`: costo de alimento por kg ganado y costo por animal.
- Distribución de GMD: tres barras (Óptima · Baja · Pérdida) con conteo. Al tocar una barra se ve la lista de
  esos animales.
- Botones `h-14`: **Pesaje rápido** (primario) · **Registrar ración**.
- Historial de pesajes del lote por fecha (sesiones de pesaje: fecha, N pesados, peso prom., GMD prom.). Filtros
  como en la referencia 12: Fecha (Todos · Último mes · Rango) y Sexo.
- Vacío: "Sin lotes de ceba · Crea un lote con propósito Ceba para ver GMD y proyección" con CTA "Crear lote".

**Pesaje rápido** (lista rápida arete tras arete; pantalla completa en el `Overlay`):
- Cabecera sky: "Pesaje · Lote Ceba 2 · 13 nov" y el progreso "12 / 32".
- Opciones arriba: `DateField` · "Orden: Arete / Como llegan a la manga".
- Lista con una fila por animal (`min-h-[72px]`): arete `text-2xl font-black`, último peso "398 kg · hace 21 d"
  en `text-sm text-slate-700`, `BigNumberInput` de peso (`inputMode="decimal"`, `enterKeyHint="next"`) y la GMD
  calculada en vivo con `GmdChip` cuando hay valor.
- Enter o "Siguiente" en el teclado pasa el foco a la fila siguiente y hace scroll para dejarla en el centro. Un
  peso fuera de tope abre `LimitConfirm` antes de avanzar.
- "Agregar arete que no está en el lote" (por ejemplo, un animal que se coló): `AreteInput`, con la opción de
  pasarlo a este lote.
- Pie fijo: "Pesados 12 de 32 · GMD prom. 0,81" y el botón "Guardar 12 pesajes" (`h-14`). Los que quedan vacíos no
  se guardan. Antes de salir con datos, la confirmación de `FormSheet`.
- Un documento de pesaje por animal (sesión común `sessionId` para agrupar).

**Registrar ración** (`FormSheet`): lote · fecha · alimento (selector de Alimentos y Minerales del almacén, con el
stock) · kg entregados (`BigNumberInput`) · "Repetir para los días anteriores sin registro" (no; solo informativo)
· "Descontar del almacén" (activado por defecto = salida con destino Lote). Muestra "≈ 7,2 kg/animal/día".

### B2. Leche (Campo › Leche)

**Resumen**: filtros de la referencia 11: Ver Todos · Por lote · Por vaca; periodo Hoy · Semana · Mes · Rango.
- `StatStrip`: Litros (periodo) · L/vaca/día · Vacas en ordeño · Leche en descarte (L).
- Gráfico de barras por día (SVG) de los últimos 14 o 30 días; se marca el día con caída fuerte.
- **Caídas detectadas**: lista amber "#402 bajó 32 % (14 → 9,5 L)" con el botón "Ver curva".
- **Leche en retiro**: lista rose de las vacas cuya leche va a descarte, con la fecha de fin.
- Con `verCostos`: costo por litro del periodo (enlace al Balance).
- Botón primario `h-14` "Registrar ordeño" y un FAB igual.
- Vacío: "Sin ordeños registrados · Registra el ordeño por vaca o el total del tanque." con CTA.

**Ordeño rápido** (pantalla completa en el `Overlay`):
1. `DateField` y **Turno**: chips Mañana · Tarde · Único (configurable).
2. Modo: tarjetas **Por vaca** · **Total del tanque**.
3. **Por vaca**: lista de las vacas en ordeño (no Secas), filtrable por lote. Fila de 72 px con el arete, el
   promedio de 7 días en `text-sm`, `BigNumberInput` de litros (`decimal`) y, si el valor está por debajo del
   umbral de caída respecto al promedio, el chip amber "−32 %". Las filas con retiro aparecen en `bg-rose-50` con
   el chip y un selector de destino (Descarte · Terneros). Enter pasa a la siguiente. Pie: "Total al tanque
   312,5 L · descarte 14 L · 26 de 28 vacas" y "Guardar".
4. **Total del tanque**: `BigNumberInput` de litros. Toggle "Desglosar por vaca" (opcional): abre la misma lista,
   con el contador "Asignado 280 / 312 L · sin asignar 32 L". Se puede guardar con litros sin asignar, que quedan
   como "sin desglose". Advertencia si lo asignado supera el total.
5. Con `precios` (Admin), toggle "Registrar venta de la leche de hoy": litros vendidos (por defecto los del
   tanque, sin el descarte) × precio (`MoneyField` $/L, con el último precio prellenado) y comprador. Crea el
   ingreso del rubro bovino, unidad Leche y cría.
- Cada ordeño por vaca es un documento. El total del tanque es otro documento (tipo `tanque`), con desglose
  opcional en documentos por vaca que lo referencian.

**Curva de lactancia** (desde la ficha, desde caídas o desde Por vaca): selector de lactancia (1.ª, 2.ª, actual).
Gráfico de litros por día en leche (DEL), con el pico marcado, las caídas en rose y una línea de referencia del
promedio. Datos: DEL actual, pico (L y DEL), total acumulado, promedio diario y "Secado programado: 12 ene". Tabla
desplegable.

### B3. Reproducción (sección Repro)

**Raíz Repro**:
- Contadores por estado (`CounterTile` en `grid-cols-4`): Vacías · Servidas · Preñadas · Secas. Debajo, Novillas
  aptas y Toros.
- **Agenda reproductiva** (próximos 7 días) agrupada: PEV cumplido (listas para servir) · Palpar · Secar · Partos
  próximos · Destetes. Cada ítem abre el formulario prellenado.
- `Tile` de 2 columnas (referencias 4, 5, 6): Servicios · Diagnósticos · Partos y crías · Destetes · Secado ·
  Calendario.
- Indicadores breves: Tasa de preñez · Días abiertos prom. · IEP prom. (enlace a Reportes).
- Vacío (sin hembras): "Registra vacas o novillas para ver su ciclo reproductivo."

**Servicio** (`FormSheet "Registrar servicio"`; referencia 14):
- Vaca o novilla: selector con búsqueda que muestra a las elegibles primero ("Lista: PEV cumplido"). Las no
  elegibles (Preñada, Seca) aparecen bloqueadas (§5.3). Se puede tomar varias para IATF (multiselección:
  "Servir 12 vacas").
- Tipo: chips **Monta natural** · **Inseminación (IA/IATF)** · **Transferencia de embriones**.
  - Monta: toro (selector de los Toros activos del hato).
  - IA/IATF: pajuela (selector de Farmacia › Semen/Pajuela con stock; descuenta 1 por vaca), inseminador
    (miembro o texto), protocolo IATF (opcional, chips).
  - TE: embrión o donadora (texto), receptora = la vaca.
- Fecha y hora. Aviso de PEV no cumplido (§5.3, advertencia).
- Al guardar: el estado pasa a Servida y se crea la tarea "Palpar" en la fecha + N días (Configuración, por
  defecto 45).
- Lista de servicios con los filtros de la referencia 14 (Por lote · Por vaca · fecha · tipo).

**Diagnóstico** (`FormSheet`; referencia 15):
- Vaca (con elegibles primero: servidas con más de N días).
- Método: Palpación · Ecografía. Resultado: chips grandes **Preñada** (emerald) · **Vacía** (slate) · **Dudosa**
  (amber, crea un recontrol en N días).
- Si es Preñada: días o meses de gestación (`Stepper` o número; por defecto calculado desde el último servicio).
  Muestra en vivo: "**FPP 22 jun 2027** · **Secar 23 abr 2027**", en un bloque sky `text-xl font-black`. Si los días
  no coinciden con el servicio, pregunta qué servicio fue el efectivo (selector).
- Hallazgos (chips: Quiste, Metritis, Gemelar, Otro) y nota.
- Vista "Programados": vacas que tocan hoy o están vencidas, con "Registrar" directo.

**Parto y crías** (`FormSheet "Registrar parto"`; referencia 16):
- Vaca (preñadas primero, ordenadas por FPP).
- Evento: chips **Nacimiento** · **Aborto** · **Mortinato** (y Distócico como toggle en Nacimiento).
- Crías (1 por defecto; "+ Gemelo"): sexo (chips), peso al nacer (`decimal`, tope §5.2), arete (o "Asignar
  después"), vivo/muerto. Cada cría viva crea un animal (categoría Cría, madre = la vaca, lote = el de crías o el
  de la madre).
- **Calostro** (por cada cría): toggle "¿Tomó calostro?" con la hora (por defecto, la del registro), litros
  (`decimal`) y método (Mamó · Biberón · Sonda). Si no se registra, la Agenda crea "Calostro #T-12 antes de las
  6 h" con urgencia rose.
- Al guardar: la vaca pasa a En ordeño (si es lechera) y Vacía (reproductivo). Empieza una nueva lactancia y corre
  el PEV.

**Destete** (referencia 5): lista de crías aptas (edad ≥ la de Configuración) con multiselección, peso al destete
en lista rápida (el mismo patrón que el pesaje), lote destino (por ejemplo, Levante) y fecha. La categoría pasa a
Levante.

**Secado** (referencia 6): lista "Por secar" (FPP − 60 ≤ hoy + 7) con fecha objetivo y chips Hoy/Vencida. Al
registrar: fecha y tratamiento de secado opcional (selector de la farmacia, por ejemplo intramamario, que aplica el
retiro de leche y descuenta stock). La vaca pasa a Seca y deja de aparecer en el ordeño.

**Calendario reproductivo**: vista de mes con eventos por color (servicio sky, palpación slate, secado amber, parto
emerald). Al tocar un día, la lista.

### B4. Modo manga

Abre desde: Hato (botón grande), Agenda ("Llevar a la manga"), Ceba (opcional). Es una pantalla completa en el
`Overlay`: oculta la cabecera y la barra, con fondo `bg-white` y texto `text-slate-950`. Se mantiene la pantalla
encendida si la plataforma lo permite (opcional).

**1. Preparación** (una pantalla):
- "¿Qué vas a hacer hoy en la manga?", con toggles grandes (`min-h-16`):
  - **Pesar** (activado si hay un lote de ceba o un pesaje programado).
  - **Tratamientos del día** (activado si hay tratamientos en la agenda de hoy; lista "Ivermectina 1 % · Lote Ceba 2").
  - **+ Tratamiento para todos los que pasen** (elige el producto de la farmacia: aplica la dosis calculada a cada
    animal; útil para desparasitar en la manga).
  - **Palpación** (Encargado: muestra los que tocan palpar).
- Grupo: Lote (selector) · Todo el hato · Lista de la agenda de hoy.
- Botón `h-16 bg-sky-600 text-white text-xl font-black`: "Empezar".

**2. Captura** (bucle):
- Arriba: el progreso "18 / 32 · faltan 14" y un botón "Lista" (`BottomSheet` con los pendientes y hechos; al tocar
  un arete se carga).
- **Teclado en pantalla** propio (no el del sistema, para que no tape la pantalla): números 0-9, borrar y OK, en
  `grid grid-cols-3 gap-2`, con teclas `h-16 rounded-2xl bg-slate-100 text-3xl font-black active:bg-sky-200`.
  El arete escrito se ve encima en `text-6xl font-black tracking-wider`. Con 2-3 dígitos ya aparecen las
  coincidencias (botones `h-14` "402 · Vaca · Lote Lechería 1"); si hay una sola, se carga con OK.
- **Tarjeta del animal**: arete `text-5xl font-black`, categoría y lote, y chips de estado. Si tiene retiro activo:
  `BlockedNotice` arriba ("Retiro carne hasta el 25 nov"), informativo.
- **Solo las acciones del día para ese animal**, como bloques grandes en orden:
  1. **Peso**: `BigNumberInput` de `h-20 text-4xl`, que usa el teclado en pantalla. Debajo, el peso anterior, los
     días y la GMD en vivo.
  2. **Tratamiento** (uno por cada uno del día): nombre del producto `text-xl font-black`, **dosis calculada**
     con el peso recién digitado (o el último) en `text-5xl font-black text-sky-700` "8,5 ml", más vía y "Peso
     usado: 412 kg (hoy)". Toggle grande "Aplicado ✓" (`h-16`; por defecto "No"). Si se cambia el peso, la dosis
     se recalcula.
  3. **Palpación** (si toca): chips Preñada / Vacía / Dudosa.
  - Si el animal no tiene nada hoy: "Sin tareas para #402 hoy" y el botón "Pesar de todas formas".
- Pie: **"Guardar y siguiente"** (`h-16 bg-sky-600 text-white text-xl font-black w-full`) y "Saltar" (secundario
  `h-12`). Al guardar: un toast corto "#402 guardado" y vuelta al teclado con el campo vacío. Los topes (§5.2)
  muestran `LimitConfirm` con botones de `h-16`.
- **Salir**: botón `X` de 48 px arriba a la izquierda, o Atrás. Confirma "¿Terminar la jornada? 18 animales
  guardados". Todo lo que se guardó ya está persistido: cada "Guardar y siguiente" escribe sus eventos. No se
  acumula para el final.

**3. Resumen**: animales trabajados, pesados (GMD prom.), tratamientos aplicados por producto con el total
descontado de la farmacia, y pendientes no vistos (lista y "Seguir").

Permisos: el Operario puede pesar. Los tratamientos los aplica solo si Configuración permite "Operario aplica
tratamientos programados" (por defecto no); si no, se muestran solo como información ("Lo aplica el encargado").

### B5. Reportes y KPIs (Más › Reportes)

- Periodo: Mes actual · Mes anterior · 3 meses · Año · Rango.
- Pestañas: **Ceba** · **Leche y repro** · **Inventario**.
- `KpiTile` en versión bovina (`text-xs text-slate-700` para la etiqueta y `text-2xl font-black` para el valor,
  con color de estado y una línea de "qué significa"):
  - Ceba: GMD promedio del hato de engorde · Consumo de alimento por kg producido · Costo de producción por animal
    (`verCostos`) · Costo por kg ganado (`verCostos`) · Animales próximos a venta (30 días; enlace a la lista).
  - Leche y repro: Producción diaria total · L/vaca/día · Tasa de preñez · Días abiertos prom. · IEP prom. ·
    Servicios por concepción · Partos del periodo · Costo por litro (`verCostos`).
  - Inventario (`verCostos` para montos): Valor en Alimentos · Minerales · Farmacia · Otros (`Donut`), y
    **Proyección del valor del hato** por categoría (cabezas × peso prom. × precio de referencia de
    Configuración), en una tabla.
- Cada tarjeta permite ver el detalle (lista de animales o datos) y exportar.
- Vacío: "Aún no hay datos en este periodo".

### B6. Balance, ventas y liquidación (Más › Balance; solo Admin)

**Balance**:
- `SegmentedTabs`: **Todo** · **Ceba** · **Leche y cría**. Periodo: Mes (con flechas) · Rango.
- Toggle de moneda de visualización: USD · Local (en los montos convertidos a la tasa de cada registro; se aclara
  "a la tasa de cada día").
- Tarjeta principal (como `BalanceCard`, en sky): Ingresos (emerald) · Gastos (rose) · **Utilidad bruta** =
  ingresos − costos directos · **Utilidad neta** = bruta − gastos fijos prorrateados, con chip Ganancia/Pérdida.
- Desglose de gastos: **Costos directos automáticos** (Alimento · Minerales · Sanidad · Compra de animales), cada
  uno con monto y enlace al kardex filtrado. **Gastos fijos prorrateados** (Nómina · Cercas · Electricidad ·
  Fletes · Otros), con el % aplicado a esta unidad.
- **Indicadores**: costo por litro de leche · costo por kg de carne ganado · margen por litro y por kg.
- **Flujo de caja proyectado del mes**: barra con "Real a la fecha" y "Proyectado al cierre" (ingresos de leche
  promedio × días restantes, ventas programadas y gastos fijos recurrentes pendientes). Texto simple: "Si sigue
  igual, cierras el mes con +1.240 $".
- Botones `h-14` en `grid-cols-2`: **+ Ingreso** · **+ Gasto fijo**.
- Lista de movimientos del periodo (como `TabBalance` › `MovementList`), con la unidad y el usuario.
- Vacío: "Sin movimientos en este periodo · Registra la venta de leche o de ganado para ver la utilidad."

**Ingreso rápido** (`BottomSheet` con 3 tarjetas grandes y luego su formulario):
- **Venta de leche**: fecha, litros (por defecto el tanque del día, sin descarte), precio $/L (`MoneyField`) y
  comprador. Total en vivo.
- **Venta de ganado**: animales (multiselección; **los que tienen retiro de carne quedan bloqueados**, §5.3), modalidad
  En pie (kg × $/kg, con kg del último pesaje editable) · En canal (kg canal × $/kg, rendimiento opcional) · Por
  cabeza. Deducciones (flete, comisión). Unidad: según el lote. Los animales pasan a Vendidos.
- **Venta de crías o descarte**: lo mismo, con un selector de motivo.

**Gasto fijo**: categoría (chips Nómina · Cercas · Electricidad · Fletes · Combustible · Otro), monto (`MoneyField`),
fecha, recurrente mensual (toggle) y **prorrateo**: chips "Según configuración (60 % Ceba / 40 % Leche)" · "Por
animales (UA)" · "Todo a Ceba" · "Todo a Leche y cría" · "Manual" (slider con %). Vista previa: "Ceba 120 $ ·
Leche 80 $".

**Liquidación de lote de ceba** (desde Lote › `⋮` › Liquidar, o desde Balance):
1. Animales a liquidar: todo el lote (por defecto) o una selección. **Bloqueo por retiro** con la lista y
   "Liquidar sin estos".
2. Datos de venta: modalidad, kg (por animal en lista rápida o el total), precio, deducciones y fecha. Cheque o
   total recibido (`MoneyField`).
3. Resultado (tarjeta grande):
   - Costo de compra · Alimento · Minerales · Sanidad · Fijos prorrateados = **Costo total**.
   - **Venta neta**, **Utilidad del ciclo** (emerald o rose `text-3xl`), **Rentabilidad %**, utilidad por animal,
     costo por kg ganado, días de ciclo, GMD del ciclo y conversión.
4. "Confirmar liquidación": `ConfirmDialog` con `requireText` = nombre del lote. Crea los ingresos, marca a los
   animales como Vendidos y deja el lote en Liquidado (solo lectura). Ofrece "Exportar PDF".

### B7. Exportar y respaldo (Más › Exportar)

- Lista de reportes (cada uno con su formato): Lista de ganado (filtros actuales) · Inventario de almacén ·
  Balance del periodo · Liquidación de lote · Ordeño del periodo · Pesajes del lote · Agenda de hoy · Historial
  de un animal.
- Al elegir uno: `BottomSheet` con un resumen y botones `h-14`: **PDF** · **Excel (CSV)** · **Compartir por
  WhatsApp** (comparte el PDF o texto). El Operario no ve los reportes con montos, y en los demás se omiten las
  columnas de costo.
- PDF: encabezado con nombre de la finca, título, periodo, fecha de generación y usuario. Tablas en blanco y negro,
  aptas para imprimir.
- CSV: separador `;`, UTF-8 con BOM (para que Excel en español lo abra bien) y fechas `AAAA-MM-DD`.
- **Respaldo**: texto informativo "Tus datos se guardan en la nube automáticamente cada vez que hay señal. Último
  envío: hoy 7:42". Para Admin, el botón "Descargar copia completa (JSON)" del rubro bovino.

### B8. Configuración bovina (Más › Configuración)

Secciones en tarjetas plegables con `FieldRow` en su versión bovina (etiqueta `text-sm font-bold`, ayuda
`text-xs text-slate-700`):
- **Moneda** (Admin): moneda local (código y símbolo, por ejemplo Bs), **tasa del día** (`BigNumberInput`) con el
  historial de tasas (fecha, valor, usuario). Aviso en la sub-cabecera si la tasa no es de hoy.
- **Reproducción** (Vet/Admin): PEV (días), días de gestación (283), días antes del parto para secar (60), días
  servicio → palpación, edad de destete (días), edad o peso mínimo de novilla para servicio.
- **Ceba** (Vet/Admin): peso objetivo de faena, umbral de GMD óptima, umbral de estancamiento, intervalo de pesaje
  sugerido y conversión objetivo.
- **Leche**: turnos de ordeño, % de caída que genera alerta y días del promedio de referencia.
- **Categorías**: edades de corte (Cría → Levante, Levante → Novilla/Novillo) y razas disponibles.
- **Topes lógicos** (Admin): valores de §5.2.
- **Potreros**: días de descanso y de ocupación por defecto.
- **Prorrateo** (Admin): % por defecto Ceba / Leche y cría, o criterio "por UA".
- **Precios de referencia** (Admin): $/L de leche, $/kg en pie por categoría (para la proyección del valor del hato).
- **Plan sanitario base** (Vet/Admin): plantilla editable como `PlanTemplateSheet` avícola (actividad, edad o
  categoría o mes, producto de la farmacia, repetición), con "Restaurar plantilla". Al activarla, genera tareas en
  la Agenda.
- **Permisos de campo** (Admin): "El operario puede aplicar tratamientos programados en la manga" y "Aretes con
  letras".
- Pie: "Guardar" por sección. Cada cambio queda en la Bitácora.

### B9. Bitácora (Más › Bitácora; solo Admin)

- Lista cronológica: ícono por tipo, "**Juan Pérez** registró una salida: 5 sacos de Alimento Ceba → Lote Ceba 2",
  y la hora. Las ediciones muestran "antes → después" en los campos clave. Los borrados aparecen en rose.
- Filtros: Usuario · Tipo (Almacén, Animales, Muertes, Finanzas, Configuración) · Rango.
- Solo lectura. Se puede exportar a CSV.

---

## 8. Estructura de archivos y reparto

Carpeta `web/src/components/mockup/bovino/`. Los modelos de dominio (`models/bovinoDomain.ts`,
`models/bovinoReference.ts`) y el controlador (`dispatchBovino`, `bovinoActions`, colecciones y suscripciones) siguen
la plantilla avícola y los define la especificación de dominio. Aquí solo se lista la UI y su integración.

### Etapa A (desarrollador 1): base, navegación, hato, campo, almacén y sanidad

| Archivo | Contenido |
|---|---|
| `views/bovino/BovinoModuleView.tsx` | Vista del controlador (como `AvicolaModuleView`). Reemplaza el uso de `BovinoModalView` desde el Home. |
| `bovino/BovinoModule.tsx` | Orquestador: provider del contexto, render por `route.section` y `route.stack`, consumo de `BovinoFocusRequest`, carga diferida de las pantallas de la Etapa B (`lazy`, con un fallback "Próximamente" mientras no existan). |
| `bovino/context.ts` | `BovinoCtx`: data, derivados (contadores, agenda, alertas), `actions`, `today`, `perms`, `session.member`, `settings`, `navigate(screen)`, `back()`, `openManga(opts)`. Hook `useBovino()`. |
| `bovino/routes.ts` | Tipos `BovinoSection`, `BovinoScreen`, `BovinoRoute`, `BovinoFocusRequest`; `screenTitle(route, data)`; `popRoute(route)` puro (para App y pruebas). |
| `bovino/perms.ts` | `permsForRole(role)` → objeto de §4 (puro, con pruebas). |
| `bovino/ui.tsx` | Tokens `B`, `FOCUS_B` y componentes de §3.3: BigNumberInput, AreteInput, DateField, MoneyField (básico), Money, ChipFilter, StatusChip, RetiroChip, GmdChip, AnimalRow, Tile, CounterTile, Fab, Can, EmptyBlock, LimitConfirm, BlockedNotice, SyncDot, MiniLineChart (SVG). |
| `bovino/BovinoNav.tsx` | Barra de 5 secciones con insignias. |
| `bovino/SubHeader.tsx` | Sub-cabecera (fecha, tasa y campana) más `AlertasSheet`. |
| `bovino/hato/HatoHome.tsx` | A1. |
| `bovino/animales/AnimalList.tsx` | A2, con filtros y selección múltiple (`SelectionBar`). |
| `bovino/animales/AltaGanado.tsx` | A3 (`AltaPorAnimal`, `AltaPorLote`, `PotreroPicker`). |
| `bovino/animales/AnimalFicha.tsx` | A4: cabecera, acciones y pestañas. |
| `bovino/animales/AnimalTimeline.tsx` | Línea de tiempo y hoja de detalle del evento (editar o eliminar). |
| `bovino/animales/BajaSheet.tsx` | Baja (muerte, descarte, traslado). |
| `bovino/campo/CampoHub.tsx` | A10 Campo. |
| `bovino/campo/Lotes.tsx`, `LoteDetail.tsx`, `LoteForm.tsx` | A5. |
| `bovino/campo/Potreros.tsx`, `PotreroDetail.tsx`, `PotreroForm.tsx`, `MoverSheet.tsx` | A6. |
| `bovino/campo/EntradasSalidas.tsx` | Historial de altas y bajas. |
| `bovino/almacen/AlmacenBovino.tsx`, `InsumoCard.tsx`, `InsumoForm.tsx`, `CompraSheet.tsx`, `SalidaSheet.tsx`, `Kardex.tsx` | A7. |
| `bovino/sanidad/SanidadHub.tsx`, `TratamientoSheet.tsx`, `RetirosActivos.tsx`, `EvaluarSheet.tsx` | A8 (incluye el cálculo de dosis vía dominio). |
| `bovino/agenda/AgendaDia.tsx`, `AgendaItemRow.tsx`, `CalendarioMes.tsx`, `NuevaActividadSheet.tsx` | A9. Las fuentes de la Etapa B se enchufan a la función de dominio de la agenda. |
| `bovino/mas/MasMenu.tsx` | A10 Más (con las entradas de la Etapa B en "Próximamente"). |
| **Integración** | `App.tsx`: `mockupScreen 'bovino'`, `goBovino(opts)`, `bovinoRoute` y `bovinoFocus` en `usePhoneNavigation`, título de `GranjaHeader`, ocultar la `BottomNav` global y renderizar `BovinoNav`, rama de `useHardwareBackButton`, quitar `BovinoModalView` de `GlobalModals` cuando la migración esté verificada. `HomeDashboard.tsx`: tarjeta bovina (§2.5). `RubroPanels.tsx`: redirecciones bovinas de Almacén, Balance y Actividades. Centro de alertas: "Ir al hato". |

Criterio de cierre de la Etapa A: se puede crear un potrero, crear un lote, ingresar animales por lote y por
animal, verlos en el Hato con sus contadores, abrir la ficha con su historial, mover un lote en dos toques,
comprar y sacar insumos con destino, aplicar un tratamiento con dosis por peso que descuente farmacia y muestre
el retiro, y ver la agenda del día. Todo sin conexión, con los roles aplicados, `tsc` en 0 y build OK.

### Etapa B (desarrollador 2): producción, reproducción, manga, finanzas y configuración

| Archivo | Contenido |
|---|---|
| `bovino/ceba/CebaHub.tsx`, `PesajeRapido.tsx`, `RacionSheet.tsx`, `ProyeccionCard.tsx` | B1. |
| `bovino/leche/LecheHub.tsx`, `OrdenoRapido.tsx`, `CurvaLactancia.tsx` | B2. |
| `bovino/repro/ReproHub.tsx`, `ServicioSheet.tsx`, `DiagnosticoSheet.tsx`, `PartoSheet.tsx`, `DesteteSheet.tsx`, `SecadoList.tsx`, `CalendarioRepro.tsx` | B3, más las fuentes reproductivas de la agenda. |
| `bovino/manga/ModoManga.tsx`, `MangaSetup.tsx`, `MangaKeypad.tsx`, `MangaAnimalCard.tsx`, `MangaResumen.tsx` | B4. |
| `bovino/reportes/ReportesKpi.tsx` | B5. |
| `bovino/finanzas/BalanceBovino.tsx`, `IngresoSheet.tsx`, `GastoFijoSheet.tsx`, `VentaGanadoSheet.tsx`, `LiquidacionLote.tsx`, `FlujoCaja.tsx` | B6. |
| `bovino/exportar/ExportarScreen.tsx`, `exportCsv.ts`, `exportPdf.ts`, `share.ts` | B7. |
| `bovino/config/ConfigBovina.tsx`, `TasaSheet.tsx`, `PlanSanitarioBase.tsx` | B8. |
| `bovino/config/Bitacora.tsx` | B9. |
| Ajustes en A | Activar los `Tile` y las filas de Más, conectar el botón Manga del Hato y de la Agenda, y completar la pestaña Producción de la ficha y los Indicadores del lote. |

Criterio de cierre de la Etapa B: el flujo completo de un lote de ceba (pesajes → GMD → proyección → liquidación
bloqueada por retiro → utilidad), el ciclo de una vaca (servicio → diagnóstico con FPP y secado → secado → parto
con calostro → ordeño con curva), la manga con dosis calculada, el balance Ceba vs Leche con prorrateo y la
exportación de CSV y PDF.

---

## 9. Textos clave (microcopy)

| Contexto | Texto |
|---|---|
| Título del módulo | Ganado Bovino |
| Botón Home | Ver hato |
| Ingreso | Ingresar ganado · Por lote · Por animal · Toca para elegir potrero |
| Potrero obligatorio | Elige el potrero al que entra el ganado |
| Arete duplicado | El arete {n} ya es de {nombre} ({lote}) |
| Guardado | {Acción} guardado · #{arete} |
| Sin conexión (toast) | Guardado en el teléfono · se subirá al volver la señal |
| Retiro | Retiro carne hasta {fecha} · Retiro leche hasta {fecha} |
| Bloqueo de venta | No se puede vender: #{arete} tiene retiro de carne hasta {fecha} ({producto}) |
| Bloqueo de servicio | No se puede servir: está {Preñada/Seca} |
| Vencido | Vencido el {fecha} · no se puede usar |
| Salida sin destino | Elige a dónde va el insumo |
| Tope | ¿{valor} es correcto? Es más de lo normal (máx. {tope}) · Corregir · Sí, es correcto |
| Manga | ¿Qué vas a hacer hoy en la manga? · Empezar · Guardar y siguiente · Saltar · Terminar jornada |
| Agenda vacía | Nada pendiente para hoy |
| Operario sin permiso | Lo registra el encargado |

---

## 10. Accesibilidad y pruebas de UI

- Contraste AA como mínimo; el texto informativo, en `slate-700` o más oscuro sobre blanco.
- Todos los botones de ícono con `aria-label`. Las insignias con texto `sr-only`.
- Foco visible sky en todo lo interactivo. Escape y Atrás cierran la capa superior.
- Ancho mínimo de 320 px sin scroll horizontal: las rejillas de 3 columnas pasan a 2 por debajo de 340 px
  (`grid-cols-2 min-[340px]:grid-cols-3`).
- Pruebas de dominio (esbuild + node) que la UI necesita: `popRoute`, `permsForRole`, cálculo de dosis y redondeo,
  GMD y color, FPP y secado, elegibilidad de servicio, bloqueo por retiro, prorrateo y liquidación, y
  `screenTitle`.
