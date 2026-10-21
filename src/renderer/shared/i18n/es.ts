import type { Messages } from './pt';

/*
 * Written without accents, like the Portuguese strings (see CLAUDE.md), and
 * choosing words without an n with tilde where there is one as good:
 * "Agregar" rather than its synonym.
 */

const plural = (count: number, one: string, other: string) => (count === 1 ? one : other);

export const es: Messages = {
  common: {
    close: 'Cerrar',
    cancel: 'Cancelar',
    save: 'Guardar',
    edit: 'Editar',
    remove: 'Quitar',
    delete: 'Eliminar',
    create: 'Crear',
    confirm: 'Confirmar',
    confirmDelete: 'Confirmar eliminacion',
    loading: 'Cargando...',
    clearFilters: 'Limpiar filtros',
    current: ' (actual)',
    color: (color) => `Color ${color}`,
  },

  titleBar: {
    minimize: 'Minimizar',
    maximize: 'Maximizar',
    restore: 'Restaurar',
  },

  app: {
    loadingBoards: 'Cargando tableros...',
  },

  toolbar: {
    views: 'Vista',
    board: 'Tablero',
    calendar: 'Calendario',
    searchPlaceholder: 'Filtrar tarjetas  (Ctrl+K)',
    searchLabel: 'Filtrar tarjetas',
    clearSearch: 'Limpiar filtro',
    filters: 'Filtros',
    filtersActive: (count) => `Filtros, ${count} ${plural(count, 'activo', 'activos')}`,
    find: 'Buscar',
    settings: 'Configuracion',
  },

  filter: {
    heading: 'Filtro',
    keyword: 'Palabra clave',
    keywordPlaceholder: 'Escribe una palabra clave...',
    keywordHint: 'Busca en el titulo y la descripcion de las tarjetas.',
    status: 'Estado de la tarjeta',
    done: 'Marcada como completada',
    open: 'No marcada como completada',
    due: 'Fecha de vencimiento',
    dueNone: 'Sin fecha',
    dueOverdue: 'Vencida',
    dueDay: 'Vence en el proximo dia',
    dueWeek: 'Vence en la proxima semana',
    dueMonth: 'Vence en el proximo mes',
    labels: 'Etiquetas',
    noLabels: 'Sin etiquetas',
    matchGroup: 'Como combinar las etiquetas',
    matchLead: 'Tarjetas con',
    matchAny: 'cualquiera',
    matchAll: 'todas',
    activity: 'Actividad',
    activityWeek: 'Activa en la ultima semana',
    activityTwoWeeks: 'Activa en las ultimas dos semanas',
    activityFourWeeks: 'Activa en las ultimas cuatro semanas',
    activityStale: 'Sin actividad en las ultimas cuatro semanas',
  },

  board: {
    filterSummary: (matches, keyword, count) => {
      const subject = keyword ? `"${keyword}"` : plural(count, 'el filtro', `los ${count} filtros`);
      if (matches === 0) return `Ninguna tarjeta coincide con ${subject}`;
      return `${matches} ${plural(matches, 'tarjeta coincide', 'tarjetas coinciden')} con ${subject}`;
    },
  },

  list: {
    rename: 'Renombrar lista',
    actions: 'Acciones de la lista',
    emptyFiltered: 'Ninguna tarjeta coincide con el filtro.',
    empty: 'Todavia no hay tarjetas.',
    back: 'Volver',
    addAtTop: 'Agregar tarjeta arriba',
    newCardTitle: 'Nueva tarjeta',
    copy: 'Copiar lista',
    move: 'Mover lista',
    remove: 'Eliminar lista',
    name: 'Nombre',
    copyHint:
      'Las tarjetas vienen con etiquetas, fechas, checklist y adjuntos. Las archivadas se quedan.',
    createList: 'Crear lista',
    board: 'Tablero',
    position: 'Posicion',
    moveSubmit: 'Mover',
  },

  composer: {
    addCard: '+ Agregar tarjeta',
    cardTitle: 'Titulo de la tarjeta',
    add: 'Agregar',
    listTitle: 'Titulo de la lista',
    addList: 'Agregar lista',
    addAnotherList: '+ Agregar otra lista',
  },

  tile: {
    markDone: 'Marcar como completada',
    markUndone: 'Marcar como no completada',
    hasDescription: 'Tiene descripcion',
    checklist: 'Checklist',
    attachments: 'Adjuntos',
    due: 'Fecha',
  },

  sidebar: {
    heading: 'Tus tableros',
    expand: 'Expandir la barra lateral',
    expandShort: 'Expandir',
    collapse: 'Contraer la barra lateral',
    collapseShort: 'Contraer',
    open: (title) => `Abrir ${title}`,
    archivedCount: (count) => `Archivadas (${count})`,
    archived: 'Archivadas',
    createBoard: 'Crear tablero',
    newBoard: '+ Crear tablero',
    renameBoard: 'Renombrar tablero',
    removeBoard: (title) => `Eliminar ${title}`,
    boardName: 'Nombre del tablero',
  },

  archive: {
    dialog: 'Tarjetas archivadas',
    heading: 'Archivadas',
    archivedOn: 'archivada el',
    restore: 'Restaurar',
  },

  fab: {
    confirmDialog: 'Confirmar eliminacion de la tarjeta',
    confirmBefore: 'Eliminar ',
    confirmAfter: '?',
    archiveCard: 'Archivar tarjeta',
    archiveHint: 'Suelta aqui para archivar la tarjeta',
    archive: 'Archivar',
    deleteCard: 'Eliminar tarjeta',
    deleteHint: 'Suelta aqui para eliminar la tarjeta',
    newCard: 'Nueva tarjeta',
    newCardHint: 'Nueva tarjeta (Ctrl+N)',
  },

  calendar: {
    noCards: 'Sin tarjetas',
    prevMonth: 'Mes anterior',
    prevWeek: 'Semana anterior',
    nextMonth: 'Mes siguiente',
    nextWeek: 'Semana siguiente',
    today: 'Hoy',
    withDue: (count, filtering) => `${count} con fecha${filtering ? ' en el filtro' : ''}`,
    modes: 'Vista del calendario',
    month: 'Mes',
    week: 'Semana',
    undated: 'Sin fecha',
    hideUndated: 'Ocultar tarjetas sin fecha',
    showUndated: 'Mostrar tarjetas sin fecha',
    undatedEmptyFiltered: 'Nada sin fecha en el filtro.',
    undatedEmpty: 'Todas las tarjetas tienen fecha.',
    undatedHint: 'Arrastra a un dia para fijar la fecha.',
  },

  card: {
    dialog: (title) => `Tarjeta ${title}`,
    done: 'Completada',
    markDone: 'Marcar como completada',
    markUndone: 'Marcar como no completada',
    title: 'Titulo de la tarjeta',
    inList: 'en la lista',
    labels: 'Etiquetas',
    labelsDone: 'Listo',
    editLabels: 'Editar etiquetas',
    due: 'Fecha de vencimiento',
    description: 'Descripcion',
    descriptionPlaceholder: 'Agrega mas detalles...',
    editDescription: 'Editar descripcion',
    descriptionEmpty: 'Agrega una descripcion mas detallada...',
    checklist: 'Checklist',
    removeItem: (text) => `Quitar ${text}`,
    addItem: 'Agrega un elemento y pulsa Enter',
    created: (date) => `Creada el ${date}`,
    deleteCard: 'Eliminar tarjeta',
  },

  activity: {
    heading: 'Comentarios y actividad',
    placeholder: 'Escribe un comentario...',
    compose: 'Escribe un comentario',
    comment: 'Comentar',
    empty: 'Todavia no ha pasado nada con esta tarjeta.',
    editComment: 'Editar comentario',
    edited: ' (editado)',
  },

  attachments: {
    heading: 'Adjuntos',
    unavailable:
      'Los adjuntos necesitan la app de escritorio; en el navegador no hay donde copiar el archivo.',
    dropHere: 'Arrastra archivos aqui',
    pickFiles: 'Elegir archivos',
    pickImage: 'Elegir imagen',
    openWithSystem: 'Abrir con la aplicacion del sistema',
    isCover: ' - portada',
    removeCover: 'Quitar portada',
    useAsCover: 'Usar como portada',
    reveal: 'En la carpeta',
  },

  labels: {
    dialog: 'Editar etiquetas',
    heading: 'Etiquetas',
    hint: 'Valen para todos los tableros.',
    palette: 'Color de la etiqueta',
    removeOne: (name) => `Eliminar ${name}`,
    nameOf: (name) => `Nombre de ${name}`,
    editOne: (name) => `Editar ${name}`,
    removeLabel: 'Eliminar etiqueta',
    namePlaceholder: 'Nombre de la etiqueta',
    newName: 'Nombre de la nueva etiqueta',
    newLabel: '+ Crear una etiqueta nueva',
    removal: (name, usage) => {
      let text = `Eliminar la etiqueta ${name}?`;
      if (usage.cards) {
        text += ` Sale de ${usage.cards} ${plural(usage.cards, 'tarjeta', 'tarjetas')}.`;
      }
      if (usage.rules === 1) text += ' 1 automatizacion que depende de ella cambia o se elimina.';
      if (usage.rules > 1) {
        text += ` ${usage.rules} automatizaciones que dependen de ella cambian o se eliminan.`;
      }
      return `${text} No se puede deshacer.`;
    },
  },

  rich: {
    toolbar: 'Formato',
    heading: 'Titulo',
    bold: 'Negrita (Ctrl+B)',
    boldSample: 'negrita',
    italic: 'Cursiva (Ctrl+I)',
    italicSample: 'cursiva',
    strike: 'Tachado (Ctrl+Shift+X)',
    strikeSample: 'tachado',
    code: 'Codigo (Ctrl+E)',
    codeSample: 'codigo',
    bullet: 'Lista con vinetas',
    ordered: 'Lista numerada',
    quote: 'Cita',
    link: 'Enlace (Ctrl+K)',
    linkSample: 'texto del enlace',
    codeBlock: 'Bloque de codigo',
    preview: 'Vista previa',
    backToEdit: 'Volver a editar',
    previewEmpty: 'Nada que mostrar todavia.',
  },

  settings: {
    title: 'Configuracion',
    appearance: 'Apariencia',
    background: 'Fondo',
    automations: 'Automatizaciones',
    data: 'Datos',
  },

  appearance: {
    theme: 'Tema',
    themeHint:
      'Tokens propios, con la misma estructura que los paquetes Atlaskit que carga la app original.',
    light: 'Claro',
    dark: 'Oscuro',
    language: 'Idioma',
    languageHint: 'El idioma de la interfaz, de las fechas y del menu de la aplicacion.',
    behaviour: 'Comportamiento',
    confirmDelete: 'Confirmar eliminacion de tarjeta',
    confirmDeleteHint: 'Pide una segunda confirmacion antes de eliminar una tarjeta.',
  },

  background: {
    leadBefore: 'Se aplica al tablero ',
    leadAfter: '.',
    colors: 'Colores',
    gradients: 'Degradados',
    image: 'Imagen',
    currentAlt: 'Fondo actual del tablero',
    opening: 'Abriendo...',
    changeImage: 'Cambiar imagen',
    pickImage: 'Elegir imagen',
    removeImage: 'Quitar imagen',
    imageHint:
      'La imagen se copia a la carpeta de datos de la app, hasta 25 MB. Nada sale del equipo.',
    unavailable:
      'La imagen de fondo necesita la app de escritorio; en el navegador no hay donde copiar el archivo.',
    gradientNames: {
      midnight: 'Medianoche',
      ember: 'Brasa',
      forest: 'Bosque',
      dusk: 'Crepusculo',
      ocean: 'Oceano',
      sand: 'Arena',
      mint: 'Menta',
      slate: 'Grafito',
    },
  },

  automations: {
    run: 'Ejecutar automatizaciones',
    hint:
      'Las reglas reaccionan a lo que pase a partir de ahora y se encadenan como maximo tres ' +
      'veces. Una regla se ejecuta como maximo una vez por tarjeta en cada accion, lo que impide ' +
      'que dos reglas se llamen entre si en bucle.',
    rulesOf: 'Reglas de ',
    none: 'Todavia no hay reglas.',
    enable: (name) => `Activar ${name}`,
    newRule: '+ Nueva regla',
    editRule: 'Editar regla',
    newRuleTitle: 'Nueva regla',
    defaultName: 'Nueva regla',
    name: 'Nombre',
    when: 'Cuando',
    then: 'Entonces',
    anyList: 'cualquier lista',
    anyLabel: 'cualquier etiqueta',
    itemText: 'Texto del elemento',
    removeAction: 'Quitar accion',
    addAction: '+ Agregar accion',
    saveRule: 'Guardar regla',
    duplicate: 'Duplicar',
    copyName: (name) => `${name} (copia)`,
    days: (days) => `${days} ${Math.abs(days) === 1 ? 'dia' : 'dias'}`,
    triggers: {
      'card-added': 'Cuando se crea una tarjeta en',
      'card-moved': 'Cuando se mueve una tarjeta a',
      'label-added': 'Cuando se agrega la etiqueta',
      'checklist-completed': 'Cuando se completa la checklist',
    },
    actions: {
      'move-to-list': 'Mover a la lista',
      'add-label': 'Agregar etiqueta',
      'remove-label': 'Quitar etiqueta',
      'set-due': 'Fijar fecha en',
      'clear-due': 'Quitar la fecha',
      'add-checklist-item': 'Agregar elemento a la checklist',
      'mark-checklist-done': 'Marcar la checklist como completada',
      'mark-card-done': 'Marcar la tarjeta como completada',
      'mark-card-undone': 'Desmarcar la tarjeta',
    },
    caveats: {
      'mark-checklist-done':
        'Solo afecta a tarjetas con elementos pendientes en la checklist. Para marcar la tarjeta en si, usa "Marcar la tarjeta como completada".',
      'clear-due': 'Solo afecta a tarjetas que tengan fecha.',
      'remove-label': 'Solo afecta a tarjetas que tengan esa etiqueta.',
    },
  },

  data: {
    content: 'Contenido',
    boards: 'Tableros',
    lists: 'Listas',
    cards: 'Tarjetas',
    archived: 'Archivadas',
    attachments: 'Adjuntos',
    rules: 'Reglas',
    file: 'Archivo',
    browserStorage: 'localStorage del navegador',
    about: 'Acerca de',
    version: 'Version',
    platform: 'Plataforma',
    locale: 'Locale',
    document: 'Documento',
    documentVersion: (version) => `version ${version}`,
    note:
      'El shell de esta ventana se reconstruyo a partir del analisis del app.asar de Trello ' +
      'hecho con REA: inventario de ventanas, contrato IPC y barra de titulo sin marco. La ' +
      'interfaz de tableros, los adjuntos, el fondo y las automatizaciones son implementacion ' +
      'original.',
  },

  newcard: {
    title: 'Nueva tarjeta',
    board: 'Tablero',
    list: 'Lista',
    cardTitle: 'Titulo',
    placeholder: 'Que hay que hacer?',
    failed: 'No se pudo agregar la tarjeta.',
    added: 'Tarjeta agregada.',
    hint: 'Enter agrega y cierra - Ctrl+Enter la mantiene abierta',
    addAnother: 'Agregar otra',
    add: 'Agregar',
  },

  welcome: {
    title: 'Bienvenido',
    lead:
      'Un clon de tableros kanban cuyo shell de escritorio se reconstruyo a partir de la ' +
      'ingenieria inversa de la app oficial de Trello instalada en este equipo.',
    rebuiltTitle: 'Reconstruido a partir de evidencias',
    rebuilt:
      'Inventario de diez ventanas, contrato IPC, barra de titulo sin marco y geometria, ' +
      'extraidos del app.asar con REA.',
    originalTitle: 'Interfaz original',
    original:
      'Tableros, listas, tarjetas, arrastrar y soltar, etiquetas, fechas y checklists son ' +
      'implementacion propia, no codigo copiado.',
    offlineTitle: 'Sin conexion por defecto',
    offline:
      'Todo queda en un unico JSON en la carpeta userData de Electron. Sin cuenta, sin ' +
      'servidor, sin red.',
    shortcutsTitle: 'Atajos',
    shortcuts: 'Ctrl+N nueva tarjeta, Ctrl+F buscar, Ctrl+K filtrar, Ctrl+, preferencias.',
    start: 'Empezar',
  },

  find: {
    placeholder: 'Buscar en el tablero',
  },

  time: {
    now: 'ahora',
    minutes: (minutes) => `hace ${minutes} min`,
    hours: (hours) => `hace ${hours} h`,
  },

  events: {
    added: (list) => `Agrego esta tarjeta a la lista ${list}`,
    moved: (from, to) => `Movio de ${from} a ${to}`,
    done: 'Marco como completada',
    reopened: 'Reabrio la tarjeta',
    dueSet: (day) => `Fijo la fecha para el ${day}`,
    dueRemoved: 'Quito la fecha',
    labelAdded: (name) => `Agrego la etiqueta ${name}`,
    labelRemoved: (name) => `Quito la etiqueta ${name}`,
    unknownLabel: 'etiqueta',
    archived: 'Archivo la tarjeta',
    restored: 'Restauro la tarjeta',
    attached: (name) => `Adjunto ${name}`,
    detached: (name) => `Quito el adjunto ${name}`,
    checklistDone: 'Completo la checklist',
    copied: (list) => `Copio esta tarjeta de la lista ${list}`,
    listMoved: (to, from) => `Movio la lista al tablero ${to}, desde ${from}`,
  },

  defaults: {
    board: 'Tablero sin titulo',
    list: 'Lista',
    card: 'Tarjeta',
    attachment: 'adjunto',
    rule: 'Regla sin nombre',
  },

  defaultLabels: {
    'lbl-green': 'Listo',
    'lbl-yellow': 'Atencion',
    'lbl-orange': 'Prioridad',
    'lbl-red': 'Bloqueado',
    'lbl-purple': 'Revision',
    'lbl-blue': 'Idea',
  },

  seed: {
    board: 'Mi primer tablero',
    todo: 'Por hacer',
    doing: 'En curso',
    done: 'Hecho',
    dragCard: 'Arrastrar una tarjeta entre las listas',
    attachImage: 'Abrir una tarjeta para adjuntar una imagen',
    changeBackground: 'Cambiar el fondo del tablero con el boton Fondo',
    rebuildShell: 'Reconstruir el shell de Electron a partir de las evidencias',
    rebuildShellDescription:
      'Ventanas, contrato IPC y barra de titulo sin marco se reconstruyeron a partir del analisis del app.asar hecho con REA.',
    windows: 'Inventario de 10 ventanas',
    channels: 'Canales IPC de ventana',
    bridge: 'contextBridge con allowlist',
    analyse: 'Analizar el app.asar con REA',
    rule: 'Al completar, marcar como Listo',
  },
};
