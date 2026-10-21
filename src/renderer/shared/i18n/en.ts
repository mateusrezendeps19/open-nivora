import type { Messages } from './pt';

const plural = (count: number, one: string, other: string) => (count === 1 ? one : other);

export const en: Messages = {
  common: {
    close: 'Close',
    cancel: 'Cancel',
    save: 'Save',
    edit: 'Edit',
    remove: 'Remove',
    delete: 'Delete',
    create: 'Create',
    confirm: 'Confirm',
    confirmDelete: 'Confirm delete',
    loading: 'Loading...',
    clearFilters: 'Clear filters',
    current: ' (current)',
    color: (color) => `Color ${color}`,
  },

  titleBar: {
    minimize: 'Minimize',
    maximize: 'Maximize',
    restore: 'Restore',
  },

  app: {
    loadingBoards: 'Loading boards...',
  },

  toolbar: {
    views: 'View',
    board: 'Board',
    calendar: 'Calendar',
    searchPlaceholder: 'Filter cards  (Ctrl+K)',
    searchLabel: 'Filter cards',
    clearSearch: 'Clear filter',
    filters: 'Filters',
    filtersActive: (count) => `Filters, ${count} active`,
    find: 'Find',
    settings: 'Settings',
  },

  filter: {
    heading: 'Filter',
    keyword: 'Keyword',
    keywordPlaceholder: 'Enter a keyword...',
    keywordHint: 'Searches card titles and descriptions.',
    status: 'Card status',
    done: 'Marked as complete',
    open: 'Not marked as complete',
    due: 'Due date',
    dueNone: 'No dates',
    dueOverdue: 'Overdue',
    dueDay: 'Due in the next day',
    dueWeek: 'Due in the next week',
    dueMonth: 'Due in the next month',
    labels: 'Labels',
    noLabels: 'No labels',
    matchGroup: 'How to match labels',
    matchLead: 'Cards with',
    matchAny: 'any of them',
    matchAll: 'all of them',
    activity: 'Activity',
    activityWeek: 'Active in the last week',
    activityTwoWeeks: 'Active in the last two weeks',
    activityFourWeeks: 'Active in the last four weeks',
    activityStale: 'Without activity in the last four weeks',
  },

  board: {
    filterSummary: (matches, keyword, count) => {
      const subject = keyword ? `"${keyword}"` : plural(count, 'the filter', `the ${count} filters`);
      if (matches === 0) return `No cards match ${subject}`;
      return `${matches} ${plural(matches, 'card matches', 'cards match')} ${subject}`;
    },
  },

  list: {
    rename: 'Rename list',
    actions: 'List actions',
    emptyFiltered: 'No cards match the filter.',
    empty: 'No cards yet.',
    back: 'Back',
    addAtTop: 'Add card at the top',
    newCardTitle: 'New card',
    copy: 'Copy list',
    move: 'Move list',
    remove: 'Delete list',
    name: 'Name',
    copyHint: 'Cards come along, with labels, due dates, checklists and attachments. Archived ones stay.',
    createList: 'Create list',
    board: 'Board',
    position: 'Position',
    moveSubmit: 'Move',
  },

  composer: {
    addCard: '+ Add a card',
    cardTitle: 'Card title',
    add: 'Add',
    listTitle: 'List title',
    addList: 'Add list',
    addAnotherList: '+ Add another list',
  },

  tile: {
    markDone: 'Mark as complete',
    markUndone: 'Mark as incomplete',
    hasDescription: 'Has a description',
    checklist: 'Checklist',
    attachments: 'Attachments',
    due: 'Due date',
  },

  sidebar: {
    heading: 'Your boards',
    expand: 'Expand the sidebar',
    expandShort: 'Expand',
    collapse: 'Collapse the sidebar',
    collapseShort: 'Collapse',
    open: (title) => `Open ${title}`,
    archivedCount: (count) => `Archived (${count})`,
    archived: 'Archived',
    createBoard: 'Create board',
    newBoard: '+ Create board',
    renameBoard: 'Rename board',
    removeBoard: (title) => `Delete ${title}`,
    boardName: 'Board name',
  },

  archive: {
    dialog: 'Archived cards',
    heading: 'Archived',
    archivedOn: 'archived on',
    restore: 'Restore',
  },

  fab: {
    confirmDialog: 'Confirm card deletion',
    confirmBefore: 'Delete ',
    confirmAfter: '?',
    archiveCard: 'Archive card',
    archiveHint: 'Drop here to archive the card',
    archive: 'Archive',
    deleteCard: 'Delete card',
    deleteHint: 'Drop here to delete the card',
    newCard: 'New card',
    newCardHint: 'New card (Ctrl+N)',
  },

  calendar: {
    noCards: 'No cards',
    prevMonth: 'Previous month',
    prevWeek: 'Previous week',
    nextMonth: 'Next month',
    nextWeek: 'Next week',
    today: 'Today',
    withDue: (count, filtering) =>
      `${count} with a due date${filtering ? ' in the filter' : ''}`,
    modes: 'Calendar view',
    month: 'Month',
    week: 'Week',
    undated: 'No due date',
    hideUndated: 'Hide cards without a due date',
    showUndated: 'Show cards without a due date',
    undatedEmptyFiltered: 'Nothing without a due date in the filter.',
    undatedEmpty: 'Every card has a due date.',
    undatedHint: 'Drag onto a day to set the due date.',
  },

  card: {
    dialog: (title) => `Card ${title}`,
    done: 'Complete',
    markDone: 'Mark as complete',
    markUndone: 'Mark as incomplete',
    title: 'Card title',
    inList: 'in list',
    labels: 'Labels',
    labelsDone: 'Done',
    editLabels: 'Edit labels',
    due: 'Due date',
    description: 'Description',
    descriptionPlaceholder: 'Add more details...',
    editDescription: 'Edit description',
    descriptionEmpty: 'Add a more detailed description...',
    checklist: 'Checklist',
    removeItem: (text) => `Remove ${text}`,
    addItem: 'Add an item and press Enter',
    created: (date) => `Created on ${date}`,
    deleteCard: 'Delete card',
  },

  activity: {
    heading: 'Comments and activity',
    placeholder: 'Write a comment...',
    compose: 'Write a comment',
    comment: 'Comment',
    empty: 'Nothing has happened to this card yet.',
    editComment: 'Edit comment',
    edited: ' (edited)',
  },

  attachments: {
    heading: 'Attachments',
    unavailable: 'Attachments need the desktop app; the browser has nowhere to copy the file to.',
    dropHere: 'Drop files here',
    pickFiles: 'Choose files',
    pickImage: 'Choose image',
    openWithSystem: 'Open with the system app',
    isCover: ' - cover',
    removeCover: 'Remove cover',
    useAsCover: 'Make cover',
    reveal: 'Show in folder',
  },

  labels: {
    dialog: 'Edit labels',
    heading: 'Labels',
    hint: 'They apply to every board.',
    palette: 'Label color',
    removeOne: (name) => `Delete ${name}`,
    nameOf: (name) => `Name of ${name}`,
    editOne: (name) => `Edit ${name}`,
    removeLabel: 'Delete label',
    namePlaceholder: 'Label name',
    newName: 'Name of the new label',
    newLabel: '+ Create a new label',
    removal: (name, usage) => {
      let text = `Delete the label ${name}?`;
      if (usage.cards) {
        text += ` It will be removed from ${usage.cards} ${plural(usage.cards, 'card', 'cards')}.`;
      }
      if (usage.rules === 1) text += ' 1 automation that depends on it will change or be removed.';
      if (usage.rules > 1) {
        text += ` ${usage.rules} automations that depend on it will change or be removed.`;
      }
      return `${text} This cannot be undone.`;
    },
  },

  rich: {
    toolbar: 'Formatting',
    heading: 'Heading',
    bold: 'Bold (Ctrl+B)',
    boldSample: 'bold',
    italic: 'Italic (Ctrl+I)',
    italicSample: 'italic',
    strike: 'Strikethrough (Ctrl+Shift+X)',
    strikeSample: 'strikethrough',
    code: 'Code (Ctrl+E)',
    codeSample: 'code',
    bullet: 'Bulleted list',
    ordered: 'Numbered list',
    quote: 'Quote',
    link: 'Link (Ctrl+K)',
    linkSample: 'link text',
    codeBlock: 'Code block',
    preview: 'Preview',
    backToEdit: 'Back to editing',
    previewEmpty: 'Nothing to preview yet.',
  },

  settings: {
    title: 'Settings',
    appearance: 'Appearance',
    background: 'Background',
    automations: 'Automations',
    data: 'Data',
  },

  appearance: {
    theme: 'Theme',
    themeHint: 'Our own tokens, in the same structure as the Atlaskit packages the original app loads.',
    light: 'Light',
    dark: 'Dark',
    language: 'Language',
    languageHint: 'The language of the interface, of dates and of the application menu.',
    behaviour: 'Behaviour',
    confirmDelete: 'Confirm card deletion',
    confirmDeleteHint: 'Asks a second time before deleting a card.',
  },

  background: {
    leadBefore: 'Applies to the board ',
    leadAfter: '.',
    colors: 'Colors',
    gradients: 'Gradients',
    image: 'Image',
    currentAlt: 'Current board background',
    opening: 'Opening...',
    changeImage: 'Change image',
    pickImage: 'Choose image',
    removeImage: 'Remove image',
    imageHint: "The image is copied to the app's data folder, up to 25 MB. Nothing leaves the machine.",
    unavailable:
      'A background image needs the desktop app; the browser has nowhere to copy the file to.',
    gradientNames: {
      midnight: 'Midnight',
      ember: 'Ember',
      forest: 'Forest',
      dusk: 'Dusk',
      ocean: 'Ocean',
      sand: 'Sand',
      mint: 'Mint',
      slate: 'Slate',
    },
  },

  automations: {
    run: 'Run automations',
    hint:
      'Rules react to what happens from now on and chain at most three times. A rule runs at ' +
      'most once per card for each action, which stops two rules from calling each other in a ' +
      'loop.',
    rulesOf: 'Rules of ',
    none: 'No rules yet.',
    enable: (name) => `Enable ${name}`,
    newRule: '+ New rule',
    editRule: 'Edit rule',
    newRuleTitle: 'New rule',
    defaultName: 'New rule',
    name: 'Name',
    when: 'When',
    then: 'Then',
    anyList: 'any list',
    anyLabel: 'any label',
    itemText: 'Item text',
    removeAction: 'Remove action',
    addAction: '+ Add action',
    saveRule: 'Save rule',
    duplicate: 'Duplicate',
    copyName: (name) => `${name} (copy)`,
    days: (days) => `${days} ${Math.abs(days) === 1 ? 'day' : 'days'}`,
    triggers: {
      'card-added': 'When a card is created in',
      'card-moved': 'When a card is moved to',
      'label-added': 'When the label is added',
      'checklist-completed': 'When the checklist is completed',
    },
    actions: {
      'move-to-list': 'Move to list',
      'add-label': 'Add label',
      'remove-label': 'Remove label',
      'set-due': 'Set due date in',
      'clear-due': 'Remove the due date',
      'add-checklist-item': 'Add item to the checklist',
      'mark-checklist-done': 'Mark the checklist as complete',
      'mark-card-done': 'Mark the card as complete',
      'mark-card-undone': 'Mark the card as incomplete',
    },
    caveats: {
      'mark-checklist-done':
        'Only affects cards with unfinished checklist items. To mark the card itself, use "Mark the card as complete".',
      'clear-due': 'Only affects cards that have a due date.',
      'remove-label': 'Only affects cards that have that label.',
    },
  },

  data: {
    content: 'Content',
    boards: 'Boards',
    lists: 'Lists',
    cards: 'Cards',
    archived: 'Archived',
    attachments: 'Attachments',
    rules: 'Rules',
    file: 'File',
    browserStorage: 'browser localStorage',
    about: 'About',
    version: 'Version',
    platform: 'Platform',
    locale: 'Locale',
    document: 'Document',
    documentVersion: (version) => `version ${version}`,
    note:
      "This window's shell was rebuilt from REA's analysis of the Trello app.asar: window " +
      'inventory, IPC contract and frameless title bar. The board interface, attachments, ' +
      'backgrounds and automations are original work.',
  },

  newcard: {
    title: 'New card',
    board: 'Board',
    list: 'List',
    cardTitle: 'Title',
    placeholder: 'What needs to be done?',
    failed: 'The card could not be added.',
    added: 'Card added.',
    hint: 'Enter adds and closes - Ctrl+Enter keeps it open',
    addAnother: 'Add another',
    add: 'Add',
  },

  welcome: {
    title: 'Welcome',
    lead:
      'A kanban board clone whose desktop shell was rebuilt from reverse engineering the ' +
      'official Trello app installed on this machine.',
    rebuiltTitle: 'Rebuilt from the evidence',
    rebuilt:
      'Inventory of ten windows, IPC contract, frameless title bar and geometry, extracted from ' +
      'the app.asar with REA.',
    originalTitle: 'Original interface',
    original:
      'Boards, lists, cards, drag and drop, labels, due dates and checklists are our own ' +
      'implementation, not copied code.',
    offlineTitle: 'Offline by default',
    offline:
      "Everything lives in a single JSON file in Electron's userData folder. No account, no " +
      'server, no network.',
    shortcutsTitle: 'Shortcuts',
    shortcuts: 'Ctrl+N new card, Ctrl+F find, Ctrl+K filter, Ctrl+, preferences.',
    start: 'Get started',
  },

  find: {
    placeholder: 'Find on the board',
  },

  time: {
    now: 'just now',
    minutes: (minutes) => `${minutes} min ago`,
    hours: (hours) => `${hours} h ago`,
  },

  events: {
    added: (list) => `Added this card to ${list}`,
    moved: (from, to) => `Moved from ${from} to ${to}`,
    done: 'Marked as complete',
    reopened: 'Reopened the card',
    dueSet: (day) => `Set the due date to ${day}`,
    dueRemoved: 'Removed the due date',
    labelAdded: (name) => `Added the label ${name}`,
    labelRemoved: (name) => `Removed the label ${name}`,
    unknownLabel: 'label',
    archived: 'Archived the card',
    restored: 'Restored the card',
    attached: (name) => `Attached ${name}`,
    detached: (name) => `Removed the attachment ${name}`,
    checklistDone: 'Completed the checklist',
    copied: (list) => `Copied this card from the list ${list}`,
    listMoved: (to, from) => `Moved the list to the board ${to}, from ${from}`,
  },

  defaults: {
    board: 'Untitled board',
    list: 'List',
    card: 'Card',
    attachment: 'attachment',
    rule: 'Unnamed rule',
  },

  defaultLabels: {
    'lbl-green': 'Ready',
    'lbl-yellow': 'Attention',
    'lbl-orange': 'Priority',
    'lbl-red': 'Blocked',
    'lbl-purple': 'Review',
    'lbl-blue': 'Idea',
  },

  seed: {
    board: 'My first board',
    todo: 'To do',
    doing: 'In progress',
    done: 'Done',
    dragCard: 'Drag a card between the lists',
    attachImage: 'Open a card to attach an image',
    changeBackground: 'Change the board background with the Background button',
    rebuildShell: 'Rebuild the Electron shell from the evidence',
    rebuildShellDescription:
      "Windows, IPC contract and frameless title bar were rebuilt from REA's analysis of the app.asar.",
    windows: 'Inventory of 10 windows',
    channels: 'Window IPC channels',
    bridge: 'contextBridge with an allowlist',
    analyse: 'Analyse the app.asar with REA',
    rule: 'On completion, mark as Ready',
  },
};
