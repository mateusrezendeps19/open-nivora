import type { RuleActionType, TriggerType } from '../types';

/**
 * The Portuguese strings, which are also the shape every other language has
 * to fill: `Messages` is this object's type, so a key missing from en.ts or
 * es.ts fails the typecheck instead of showing up blank at runtime.
 *
 * A message that has to put something of the user's in the middle of a
 * sentence is a function, so each language can put it where its grammar does.
 */
export const pt = {
  common: {
    close: 'Fechar',
    cancel: 'Cancelar',
    save: 'Salvar',
    edit: 'Editar',
    remove: 'Remover',
    delete: 'Excluir',
    create: 'Criar',
    confirm: 'Confirmar',
    confirmDelete: 'Confirmar exclusao',
    loading: 'Carregando...',
    clearFilters: 'Limpar filtros',
    current: ' (atual)',
    color: (color: string) => `Cor ${color}`,
  },

  titleBar: {
    minimize: 'Minimizar',
    maximize: 'Maximizar',
    restore: 'Restaurar',
  },

  app: {
    loadingBoards: 'Carregando quadros...',
  },

  toolbar: {
    views: 'Visao',
    board: 'Quadro',
    calendar: 'Calendario',
    searchPlaceholder: 'Filtrar cartoes  (Ctrl+K)',
    searchLabel: 'Filtrar cartoes',
    clearSearch: 'Limpar filtro',
    filters: 'Filtros',
    filtersActive: (count: number) => `Filtros, ${count} ativo(s)`,
    find: 'Localizar',
    settings: 'Configuracoes',
  },

  filter: {
    heading: 'Filtro',
    keyword: 'Palavra-chave',
    keywordPlaceholder: 'Digite uma palavra-chave...',
    keywordHint: 'Procura no titulo e na descricao dos cartoes.',
    status: 'Status do cartao',
    done: 'Marcado como concluido',
    open: 'Nao marcado como concluido',
    due: 'Data de entrega',
    dueNone: 'Sem prazo',
    dueOverdue: 'Atrasado',
    dueDay: 'Vence no proximo dia',
    dueWeek: 'Vence na proxima semana',
    dueMonth: 'Vence no proximo mes',
    labels: 'Etiquetas',
    noLabels: 'Sem etiquetas',
    matchGroup: 'Como combinar as etiquetas',
    matchLead: 'Cartoes com',
    matchAny: 'qualquer uma',
    matchAll: 'todas',
    activity: 'Atividade',
    activityWeek: 'Ativo na ultima semana',
    activityTwoWeeks: 'Ativo nas ultimas duas semanas',
    activityFourWeeks: 'Ativo nas ultimas quatro semanas',
    activityStale: 'Sem atividade nas ultimas quatro semanas',
  },

  board: {
    /**
     * The line over the board while filtering. `keyword` is set only when the
     * keyword is the whole filter, which then reads as the search it is.
     */
    filterSummary: (matches: number, keyword: string | null, count: number) => {
      const subject = keyword ? `a "${keyword}"` : count === 1 ? 'ao filtro' : `aos ${count} filtros`;
      if (matches === 0) return `Nenhum cartao corresponde ${subject}`;
      return `${matches} cartao(oes) correspondem ${subject}`;
    },
  },

  list: {
    rename: 'Renomear lista',
    actions: 'Acoes da lista',
    emptyFiltered: 'Nenhum cartao corresponde ao filtro.',
    empty: 'Nenhum cartao ainda.',
    back: 'Voltar',
    addAtTop: 'Adicionar cartao no topo',
    newCardTitle: 'Novo cartao',
    copy: 'Copiar lista',
    move: 'Mover lista',
    remove: 'Excluir lista',
    name: 'Nome',
    copyHint: 'Os cartoes vem junto, com etiquetas, prazos, checklist e anexos. Os arquivados ficam.',
    createList: 'Criar lista',
    board: 'Quadro',
    position: 'Posicao',
    moveSubmit: 'Mover',
  },

  composer: {
    addCard: '+ Adicionar cartao',
    cardTitle: 'Titulo do cartao',
    add: 'Adicionar',
    listTitle: 'Titulo da lista',
    addList: 'Adicionar lista',
    addAnotherList: '+ Adicionar outra lista',
  },

  tile: {
    markDone: 'Marcar como concluido',
    markUndone: 'Marcar como nao concluido',
    hasDescription: 'Tem descricao',
    checklist: 'Checklist',
    attachments: 'Anexos',
    due: 'Prazo',
  },

  sidebar: {
    heading: 'Seus quadros',
    expand: 'Expandir a barra lateral',
    expandShort: 'Expandir',
    collapse: 'Recolher a barra lateral',
    collapseShort: 'Recolher',
    open: (title: string) => `Abrir ${title}`,
    archivedCount: (count: number) => `Arquivados (${count})`,
    archived: 'Arquivados',
    createBoard: 'Criar quadro',
    newBoard: '+ Criar quadro',
    renameBoard: 'Renomear quadro',
    removeBoard: (title: string) => `Excluir ${title}`,
    boardName: 'Nome do quadro',
  },

  archive: {
    dialog: 'Cartoes arquivados',
    heading: 'Arquivados',
    archivedOn: 'arquivado em',
    restore: 'Restaurar',
  },

  fab: {
    confirmDialog: 'Confirmar exclusao do cartao',
    /** Around the card title, which is drawn bold between the two. */
    confirmBefore: 'Excluir ',
    confirmAfter: '?',
    archiveCard: 'Arquivar cartao',
    archiveHint: 'Solte aqui para arquivar o cartao',
    archive: 'Arquivar',
    deleteCard: 'Excluir cartao',
    deleteHint: 'Solte aqui para excluir o cartao',
    newCard: 'Novo cartao',
    newCardHint: 'Novo cartao (Ctrl+N)',
  },

  calendar: {
    noCards: 'Sem cartoes',
    prevMonth: 'Mes anterior',
    prevWeek: 'Semana anterior',
    nextMonth: 'Proximo mes',
    nextWeek: 'Proxima semana',
    today: 'Hoje',
    withDue: (count: number, filtering: boolean) =>
      `${count} com prazo${filtering ? ' no filtro' : ''}`,
    modes: 'Visao do calendario',
    month: 'Mes',
    week: 'Semana',
    undated: 'Sem prazo',
    hideUndated: 'Ocultar cartoes sem prazo',
    showUndated: 'Mostrar cartoes sem prazo',
    undatedEmptyFiltered: 'Nada sem prazo no filtro.',
    undatedEmpty: 'Todo cartao tem um prazo.',
    undatedHint: 'Arraste para um dia para definir o prazo.',
  },

  card: {
    dialog: (title: string) => `Cartao ${title}`,
    done: 'Concluido',
    markDone: 'Marcar como concluido',
    markUndone: 'Marcar como nao concluido',
    title: 'Titulo do cartao',
    inList: 'na lista',
    labels: 'Etiquetas',
    labelsDone: 'Concluir',
    editLabels: 'Editar etiquetas',
    due: 'Prazo',
    description: 'Descricao',
    descriptionPlaceholder: 'Adicione mais detalhes...',
    editDescription: 'Editar descricao',
    descriptionEmpty: 'Adicione uma descricao mais detalhada...',
    checklist: 'Checklist',
    removeItem: (text: string) => `Remover ${text}`,
    addItem: 'Adicionar item e pressionar Enter',
    created: (date: string) => `Criado em ${date}`,
    deleteCard: 'Excluir cartao',
  },

  activity: {
    heading: 'Comentarios e atividade',
    placeholder: 'Escreva um comentario...',
    compose: 'Escreva um comentario',
    comment: 'Comentar',
    empty: 'Nada aconteceu com este cartao ainda.',
    editComment: 'Editar comentario',
    edited: ' (editado)',
  },

  attachments: {
    heading: 'Anexos',
    unavailable: 'Anexos precisam do app desktop; no navegador nao ha onde copiar o arquivo.',
    dropHere: 'Arraste arquivos aqui',
    pickFiles: 'Escolher arquivos',
    pickImage: 'Escolher imagem',
    openWithSystem: 'Abrir com o aplicativo do sistema',
    isCover: ' - capa',
    removeCover: 'Tirar capa',
    useAsCover: 'Usar como capa',
    reveal: 'Na pasta',
  },

  labels: {
    dialog: 'Editar etiquetas',
    heading: 'Etiquetas',
    hint: 'Valem para todos os quadros.',
    palette: 'Cor da etiqueta',
    removeOne: (name: string) => `Excluir ${name}`,
    nameOf: (name: string) => `Nome de ${name}`,
    editOne: (name: string) => `Editar ${name}`,
    removeLabel: 'Excluir etiqueta',
    namePlaceholder: 'Nome da etiqueta',
    newName: 'Nome da nova etiqueta',
    newLabel: '+ Criar uma nova etiqueta',
    /** What the confirmation says deleting will do; nothing is hidden behind "tem certeza". */
    removal: (name: string, usage: { cards: number; rules: number }) => {
      let text = `Excluir a etiqueta ${name}?`;
      if (usage.cards) {
        text += ` Ela sai de ${usage.cards} ${usage.cards === 1 ? 'cartao' : 'cartoes'}.`;
      }
      if (usage.rules === 1) text += ' 1 automacao que depende dela muda ou e removida.';
      if (usage.rules > 1) {
        text += ` ${usage.rules} automacoes que dependem dela mudam ou sao removidas.`;
      }
      return `${text} Nao da para desfazer.`;
    },
  },

  rich: {
    toolbar: 'Formatacao',
    heading: 'Titulo',
    bold: 'Negrito (Ctrl+B)',
    boldSample: 'negrito',
    italic: 'Italico (Ctrl+I)',
    italicSample: 'italico',
    strike: 'Tachado (Ctrl+Shift+X)',
    strikeSample: 'tachado',
    code: 'Codigo (Ctrl+E)',
    codeSample: 'codigo',
    bullet: 'Lista com marcadores',
    ordered: 'Lista numerada',
    quote: 'Citacao',
    link: 'Link (Ctrl+K)',
    linkSample: 'texto do link',
    codeBlock: 'Bloco de codigo',
    preview: 'Visualizar',
    backToEdit: 'Voltar a editar',
    previewEmpty: 'Nada para visualizar ainda.',
  },

  settings: {
    title: 'Configuracoes',
    appearance: 'Aparencia',
    background: 'Fundo',
    automations: 'Automacoes',
    data: 'Dados',
  },

  appearance: {
    theme: 'Tema',
    themeHint: 'Tokens proprios, na mesma estrutura dos pacotes Atlaskit que o app original carrega.',
    light: 'Branco',
    dark: 'Escuro',
    language: 'Idioma',
    languageHint: 'O idioma da interface, das datas e do menu do aplicativo.',
    behaviour: 'Comportamento',
    confirmDelete: 'Confirmar exclusao de cartao',
    confirmDeleteHint: 'Pede uma segunda confirmacao antes de excluir um cartao.',
  },

  background: {
    /** Around the board title, drawn bold between the two. */
    leadBefore: 'Vale para o quadro ',
    leadAfter: '.',
    colors: 'Cores',
    gradients: 'Gradientes',
    image: 'Imagem',
    currentAlt: 'Fundo atual do quadro',
    opening: 'Abrindo...',
    changeImage: 'Trocar imagem',
    pickImage: 'Escolher imagem',
    removeImage: 'Remover imagem',
    imageHint: 'A imagem e copiada para a pasta de dados do app, ate 25 MB. Nada sai da maquina.',
    unavailable:
      'Imagem de fundo precisa do app desktop; no navegador nao ha onde copiar o arquivo.',
    gradientNames: {
      midnight: 'Meia-noite',
      ember: 'Brasa',
      forest: 'Floresta',
      dusk: 'Crepusculo',
      ocean: 'Oceano',
      sand: 'Areia',
      mint: 'Menta',
      slate: 'Grafite',
    } as Record<string, string>,
  },

  automations: {
    run: 'Executar automacoes',
    hint:
      'As regras reagem ao que acontece a partir de agora e encadeiam no maximo tres vezes. Uma ' +
      'regra roda no maximo uma vez por cartao a cada acao, o que impede que duas regras fiquem ' +
      'se chamando em loop.',
    /** Around the board title, drawn bold after it. */
    rulesOf: 'Regras de ',
    none: 'Nenhuma regra ainda.',
    enable: (name: string) => `Ativar ${name}`,
    newRule: '+ Nova regra',
    editRule: 'Editar regra',
    newRuleTitle: 'Nova regra',
    defaultName: 'Nova regra',
    name: 'Nome',
    when: 'Quando',
    then: 'Entao',
    anyList: 'qualquer lista',
    anyLabel: 'qualquer etiqueta',
    itemText: 'Texto do item',
    removeAction: 'Remover acao',
    addAction: '+ Adicionar acao',
    saveRule: 'Salvar regra',
    duplicate: 'Duplicar',
    copyName: (name: string) => `${name} (copia)`,
    days: (days: number) => `${days} dia(s)`,
    triggers: {
      'card-added': 'Quando um cartao e criado em',
      'card-moved': 'Quando um cartao e movido para',
      'label-added': 'Quando a etiqueta e adicionada',
      'checklist-completed': 'Quando a checklist e concluida',
    } as Record<TriggerType, string>,
    actions: {
      'move-to-list': 'Mover para a lista',
      'add-label': 'Adicionar etiqueta',
      'remove-label': 'Remover etiqueta',
      'set-due': 'Definir prazo em',
      'clear-due': 'Remover o prazo',
      'add-checklist-item': 'Adicionar item a checklist',
      'mark-checklist-done': 'Marcar a checklist como concluida',
      'mark-card-done': 'Marcar o cartao como concluido',
      'mark-card-undone': 'Desmarcar o cartao',
    } as Record<RuleActionType, string>,
    /**
     * Actions that quietly do nothing unless the card is in the right shape.
     * The panel shows this so a rule that cannot act is not mistaken for a
     * broken one.
     */
    caveats: {
      'mark-checklist-done':
        'So afeta cartoes que tenham itens pendentes na checklist. Para marcar o cartao em si, use "Marcar o cartao como concluido".',
      'clear-due': 'So afeta cartoes que tenham prazo.',
      'remove-label': 'So afeta cartoes que tenham essa etiqueta.',
    } as Partial<Record<RuleActionType, string>>,
  },

  data: {
    content: 'Conteudo',
    boards: 'Quadros',
    lists: 'Listas',
    cards: 'Cartoes',
    archived: 'Arquivados',
    attachments: 'Anexos',
    rules: 'Regras',
    file: 'Arquivo',
    browserStorage: 'localStorage do navegador',
    about: 'Sobre',
    version: 'Versao',
    platform: 'Plataforma',
    locale: 'Locale',
    document: 'Documento',
    documentVersion: (version: number) => `versao ${version}`,
    note:
      'O shell desta janela foi reconstruido a partir da analise do app.asar do Trello feita pelo ' +
      'REA: inventario de janelas, contrato IPC e titlebar sem moldura. A interface de quadros, ' +
      'os anexos, o fundo e as automacoes sao implementacao original.',
  },

  newcard: {
    title: 'Novo cartao',
    board: 'Quadro',
    list: 'Lista',
    cardTitle: 'Titulo',
    placeholder: 'O que precisa ser feito?',
    failed: 'Nao foi possivel adicionar o cartao.',
    added: 'Cartao adicionado.',
    hint: 'Enter adiciona e fecha - Ctrl+Enter mantem aberto',
    addAnother: 'Adicionar outro',
    add: 'Adicionar',
  },

  welcome: {
    title: 'Bem-vindo',
    lead:
      'Um clone de quadros kanban cujo shell desktop foi reconstruido a partir da engenharia ' +
      'reversa do app oficial do Trello instalado nesta maquina.',
    rebuiltTitle: 'Reconstruido das evidencias',
    rebuilt:
      'Inventario de dez janelas, contrato IPC, titlebar sem moldura e geometria, extraidos do ' +
      'app.asar com o REA.',
    originalTitle: 'Interface original',
    original:
      'Quadros, listas, cartoes, arrastar e soltar, etiquetas, prazos e checklists sao ' +
      'implementacao propria, nao codigo copiado.',
    offlineTitle: 'Offline por padrao',
    offline:
      'Tudo fica em um unico JSON no diretorio userData do Electron. Sem conta, sem servidor, ' +
      'sem rede.',
    shortcutsTitle: 'Atalhos',
    shortcuts: 'Ctrl+N novo cartao, Ctrl+F localizar, Ctrl+K filtrar, Ctrl+, preferencias.',
    start: 'Comecar',
  },

  find: {
    placeholder: 'Localizar no quadro',
  },

  /** How long ago, for the card history. Past a day the date says more. */
  time: {
    now: 'agora',
    minutes: (minutes: number) => `ha ${minutes} min`,
    hours: (hours: number) => `ha ${hours} h`,
  },

  /**
   * The lines the reducer writes into a card's history. They are composed in
   * the language in use when the thing happens and are never rewritten, like
   * the list titles they quote.
   */
  events: {
    added: (list: string) => `Adicionou este cartao a lista ${list}`,
    moved: (from: string, to: string) => `Moveu de ${from} para ${to}`,
    done: 'Marcou como concluido',
    reopened: 'Reabriu o cartao',
    dueSet: (day: string) => `Definiu o prazo para ${day}`,
    dueRemoved: 'Removeu o prazo',
    labelAdded: (name: string) => `Adicionou a etiqueta ${name}`,
    labelRemoved: (name: string) => `Removeu a etiqueta ${name}`,
    unknownLabel: 'etiqueta',
    archived: 'Arquivou o cartao',
    restored: 'Restaurou o cartao',
    attached: (name: string) => `Anexou ${name}`,
    detached: (name: string) => `Removeu o anexo ${name}`,
    checklistDone: 'Concluiu a checklist',
    copied: (list: string) => `Copiou este cartao da lista ${list}`,
    listMoved: (to: string, from: string) => `Moveu a lista para o quadro ${to}, vinda de ${from}`,
  },

  /** Names `normalize()` gives to what an older or damaged document left unnamed. */
  defaults: {
    board: 'Quadro sem titulo',
    list: 'Lista',
    card: 'Cartao',
    attachment: 'anexo',
    rule: 'Regra sem nome',
  },

  /** The labels a new document starts with, by id. */
  defaultLabels: {
    'lbl-green': 'Pronto',
    'lbl-yellow': 'Atencao',
    'lbl-orange': 'Prioridade',
    'lbl-red': 'Bloqueado',
    'lbl-purple': 'Revisao',
    'lbl-blue': 'Ideia',
  } as Record<string, string>,

  /** First-run content, written in the language the app starts in. */
  seed: {
    board: 'Meu primeiro quadro',
    todo: 'A fazer',
    doing: 'Em andamento',
    done: 'Concluido',
    dragCard: 'Arrastar um cartao entre as listas',
    attachImage: 'Abrir um cartao para anexar uma imagem',
    changeBackground: 'Trocar o fundo do quadro pelo botao Fundo',
    rebuildShell: 'Reconstruir o shell Electron a partir das evidencias',
    rebuildShellDescription:
      'Janelas, contrato IPC e titlebar sem moldura foram reconstruidos a partir da analise do app.asar feita pelo REA.',
    windows: 'Inventario de 10 janelas',
    channels: 'Canais IPC de janela',
    bridge: 'contextBridge com allowlist',
    analyse: 'Analisar o app.asar com o REA',
    rule: 'Ao concluir, marcar como Pronto',
  },
};

export type Messages = typeof pt;
