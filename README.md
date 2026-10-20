# Nivora

Quadros kanban em Electron + React + TypeScript. O **shell desktop** foi reconstruído a partir da
engenharia reversa do app oficial do Trello instalado na máquina, usando o
[REA](https://github.com/morluto/rea); a **interface de quadros** é implementação original.

O relatório completo da análise — o que foi recuperado, o que não estava no binário, e o que aqui
veio de evidência — está em [`docs/REVERSE-ENGINEERING.md`](docs/REVERSE-ENGINEERING.md).

## Rodando

```bash
npm install          # instala deps e baixa o binário do Electron
npm run dev          # Vite + Electron com recarga do renderer
npm start            # build de produção e abre o app
```

Outros comandos:

```bash
npm test             # testes do reducer (13 casos, runner do Node)
npm run smoke        # smoke test ponta a ponta no app empacotado (Playwright)
npm run typecheck    # tsc --noEmit
npm run build        # bundle do main/preload (esbuild) + renderers (Vite)
```

> O npm 12 bloqueia scripts de instalação por padrão. O `package.json` declara
> `allowScripts: ["electron", "esbuild"]`, porque o Electron precisa do postinstall para baixar seu
> binário. Se ele não baixar, rode `node node_modules/electron/install.js`.

## O que o app faz

- Vários quadros, cada um com sua cor, na sidebar
- Listas com renomear no lugar, reordenação por arrastar, e exclusão
- Cartões com arrastar e soltar entre listas e dentro da mesma lista, com linha de inserção
- Modal de cartão: título, descrição, etiquetas, prazo e checklist com barra de progresso
- Filtro por título e descrição, preservando os índices reais para o drop cair no lugar certo
- Tema escuro e claro
- Atalhos: `Ctrl+N` novo cartão, `Ctrl+F` localizar, `Ctrl+K` filtrar, `Ctrl+,` preferências
- Tudo offline, num único JSON em `userData`, com escrita atômica

## Arquitetura

```
electron/
  channels.ts        contrato IPC; marca o que é literal da evidência e o que é símbolo
  windows.ts         as 10 janelas do app original, com a geometria recuperada
  main.ts            handlers IPC, menu, find-in-page, ciclo de vida, trava de navegação
  store.ts           persistência em JSON no userData, escrita atômica via rename
  preload/
    bridge.ts        contextBridge: electron.{logger, ipc} com allowlist de canais
    main.ts          preload da janela main (expõe também init_config)
    window.ts        preload das demais janelas
src/renderer/
  shared/            tipos, documento, reducer, bridge tipada, tokens, TitleBar
  main/              o app de quadros
  newcard/           janela de cartão rápido (500×325)
  preferences/       preferências (900×640)
  find_in_page/      overlay de busca
  welcome/           tela inicial (900×620)
tests/
  reducer.test.ts    lógica de movimentação e normalização do documento
  smoke.mjs          preload, allowlist, titlebar, persistência e abertura de janela
docs/
  REVERSE-ENGINEERING.md      relatório da análise
  rea-evidence-summary.json   extrato da evidência do REA
```

### Por que o shell é assim

O app original cria toda janela com `frame: false`, então minimizar, maximizar e fechar precisam
atravessar o IPC — é o que a `TitleBar` faz. Os dez renderers, a geometria, os sete membros do
`electron.ipc`, o `init_config` exclusivo da janela `main` e os canais `window-*` / `app-store` /
`find-in-page-*` vieram todos da análise do `app.asar`.

Os renderers conversam entre si pelo documento: qualquer janela escreve via `app-store`, o processo
main transmite a mudança, e as outras adotam o novo estado. Foi assim que a janela `newcard` ficou
independente do app principal.

### O que não veio do binário

A interface de quadros do Trello não está no app: ela é carregada de `trello.com` em runtime. Então
modelo de dados, reducer, arrastar e soltar, etiquetas, prazos, checklists e o modal de cartão são
implementação própria. Nenhum código, asset, ícone ou valor de token do Atlaskit foi copiado.

## Licença e marcas

Projeto de estudo. "Trello" e a identidade visual associada pertencem à Atlassian; o Nivora não usa
a marca, não reutiliza código ou assets proprietários e não se apresenta como o produto oficial.
