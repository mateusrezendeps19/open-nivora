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
npm test             # 41 testes do reducer e do motor de automacoes (runner do Node)
npm run smoke        # smoke test ponta a ponta no app empacotado (Playwright)
npm run typecheck    # tsc --noEmit
npm run build        # bundle do main/preload (esbuild) + renderers (Vite)
```

> O npm 12 bloqueia scripts de instalação por padrão. O `package.json` declara
> `allowScripts: ["electron", "esbuild"]`, porque o Electron precisa do postinstall para baixar seu
> binário. Se ele não baixar, rode `node node_modules/electron/install.js`.

## O que o app faz

- Vários quadros na sidebar, cada um com seu próprio fundo
- Listas com renomear no lugar, reordenação por arrastar, e exclusão
- Cartões com arrastar e soltar entre listas e dentro da mesma lista, com linha de inserção
- Modal de cartão: concluir, título, descrição, etiquetas, prazo, checklist com progresso e anexos
- **Configurações** num só lugar, em abas: Aparência (tema branco/escuro), Fundo, Automações, Dados
- **Fundo do quadro**: cores, oito gradientes ou uma imagem do disco
- **Anexos e imagens**: escolher arquivos ou arrastar para o cartão; imagens ganham miniatura e
  podem virar capa do cartão; abrir com o app do sistema ou revelar na pasta
- **Automações**: regras por quadro, no espírito do Butler do Trello
- Filtro por título e descrição, preservando os índices reais para o drop cair no lugar certo
- Atalhos: `Ctrl+N` novo cartão, `Ctrl+F` localizar, `Ctrl+K` filtrar, `Ctrl+,` configurações
- Tudo offline, num único JSON em `userData`, com escrita atômica

### Configurações

Um único botão **Configurações** na toolbar, com quatro abas: Aparência (tema branco/escuro e
confirmação de exclusão), Fundo, Automações e Dados. A janela de Configurações (`Ctrl+,`) renderiza
**o mesmo componente** que o modal do quadro, então as duas superfícies não podem divergir.

### Automações

Uma regra é um gatilho e uma lista de ações.

| Gatilhos | Ações |
|---|---|
| cartão criado em *lista* | **marcar / desmarcar o cartão como concluído** |
| cartão movido para *lista* | mover para *lista* |
| *etiqueta* adicionada | adicionar / remover *etiqueta* |
| checklist concluída | definir prazo em *N* dias, ou remover o prazo |
| | adicionar item à checklist, ou marcar a checklist como concluída |

Algumas ações só fazem algo se o cartão estiver na forma certa — `marcar a checklist como
concluída` não tem o que fazer num cartão sem itens pendentes, por exemplo. O editor de regras
mostra essa ressalva inline, para uma regra que não pode agir não ser confundida com uma regra
quebrada. Para concluir o cartão em si, independente de checklist ou prazo, a ação é **marcar o
cartão como concluído**.

As regras rodam dentro do reducer, logo depois da ação do usuário, e encadeiam: uma regra que move
o cartão pode acionar a regra da lista de destino. Dois limites impedem loop — o encadeamento para
na terceira passada, e **cada regra roda no máximo uma vez por cartão por dispatch**. O segundo é o
que garante o término: os pares (regra, cartão) só crescem, então um ciclo esgota os pares novos e
para. Carregar um documento do disco não dispara regra alguma.

### Fundo e anexos

Arquivos escolhidos são copiados para `userData/assets`, nomeados pelo hash do conteúdo (o mesmo
arquivo não é guardado duas vezes), com limite de 25 MB. O renderer os lê por um esquema próprio,
`nivora://assets/<nome>`, registrado como privilegiado no processo main — não por `file://`. Assim a
página mantém a CSP fechada e nunca recebe um caminho para o resto do disco; o handler recusa
qualquer caminho que escape da pasta de ativos.

Remover um anexo, trocar a imagem de fundo ou excluir um cartão apaga o arquivo na hora. Na
inicialização há ainda uma varredura de órfãos, que só roda quando um documento foi realmente lido
do disco — um documento semente não referencia nada, e a varredura acharia que tudo é órfão.

O Trello oferece fotos do Unsplash, o que exige rede e chave de API. O Nivora é offline, então o
equivalente aqui é escolher um arquivo local.

## Arquitetura

```
electron/
  channels.ts        contrato IPC; marca o que é literal da evidência e o que é símbolo
  windows.ts         as 10 janelas do app original, com a geometria recuperada
  main.ts            handlers IPC, menu, find-in-page, ciclo de vida, trava de navegação
  store.ts           persistência em JSON no userData, escrita atômica via rename
  assets.ts          loja de ativos, protocolo nivora:// e varredura de órfãos
  preload/
    bridge.ts        contextBridge: electron.{logger, ipc} com allowlist de canais
    main.ts          preload da janela main (expõe também init_config)
    window.ts        preload das demais janelas
src/renderer/
  shared/            tipos, documento, reducer, automacoes, ativos, tokens, TitleBar
  shared/settings/   abas de Configuracoes, usadas pelo modal e pela janela
  main/              o app de quadros
  newcard/           janela de cartão rápido (500×325)
  preferences/       janela de Configuracoes (900×640)
  find_in_page/      overlay de busca
  welcome/           tela inicial (900×620)
tests/
  reducer.test.ts     lógica de movimentação e normalização do documento
  automations.test.ts gatilhos, ações, encadeamento e término das regras
  smoke.mjs           preload, allowlist, titlebar, persistência, fundo, anexos e janelas
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
