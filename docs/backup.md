# Backup Durável — Arquitetura de Persistência

O DevedorApp mantém duas cópias independentes dos dados no dispositivo:

| Fonte | Chave / Banco | Conteúdo |
| --- | --- | --- |
| `localStorage` | `devedores_app` (lista `JSON`) + `devedores_app_savedAt` (timestamp) | Dados usados imediatamente pelo app |
| IndexedDB | Banco `devedor-db`, object store `profile`, registro com `keyPath: 'id'` e chave fixa `'main'`: `{ id: 'main', devedores, savedAt }` | Backup silencioso e independente |

O espelho no IndexedDB sobrevive à limpeza do **cache** (Cache API / Service Worker) e protege os dados caso o `localStorage` seja apagado. A implementação fica em `backup.js` (módulo UMD: global `Backup` no navegador e `module.exports` no Node).

## Fluxo de gravação

Todas as operações (novo, editar, excluir, registrar pagamento e importar JSON) passam por `saveAndRefresh()` → `Backup.save()`, que:

1. Grava **sincronamente** no `localStorage` (`devedores_app` + `devedores_app_savedAt = Date.now()`).
2. Enfileira a gravação no IndexedDB numa **fila de Promises** (`writeQueue`), garantindo ordem e evitando escritas concorrentes quando o app salva várias vezes seguidas.

O primeiro lançamento de dados já cria o backup automaticamente, sem nenhuma interação do usuário.

## Conciliação na inicialização

`Backup.reconcileAndLoad()` roda no `DOMContentLoaded` e:

1. Lê o `localStorage` (lista + `savedAt`).
2. Lê o registro do IndexedDB.
3. Decide a **fonte vencedora** por `savedAt` (mais recente vence) e sincroniza a fonte perdedora.
4. Popula o estado global `devedores` sempre a partir da vencedora — nunca fica vazio só porque uma das fontes está ausente.

### Regras da função pura `pickWinner(ls, idb)` (testada em `test/reconcile.test.js`)

1. **Ambas ausentes** → lista vazia (`source: 'empty'`), sem gravação.
2. **Uma única fonte presente** → essa vence e é espelhada na outra.
3. **Ambas presentes com `savedAt`** → a mais recente vence; empate mantém `localStorage`.
4. **Apenas uma com `savedAt`** → a que tem timestamp vence (foi gravada pela versão atual).
5. **Legado sem timestamp** → vence a fonte com mais registros; empate mantém `localStorage`.

Casos críticos cobertos:

- **Cache limpo** (`localStorage` intacto, IndexedDB zerado): nenhum impacto; backup é recriado.
- **`localStorage` limpo** (IndexedDB intacto): dados restaurados do IndexedDB para o estado e para o `localStorage`.
- **Exclusão total feita pelo usuário**: lista vazia com `savedAt` mais novo **não** é sobrescrita pelo backup antigo — nada de "ressuscitar" dados excluídos.
- **Dados corrompidos** (JSON inválido): a fonte válida vence.

## Tratamento de falhas

Falhas do IndexedDB (modo anônimo/privado, quota, `indexedDB` inexistente) são capturadas silenciosamente: o app segue funcionando com `localStorage` apenas. Os mecanismos:

- Conexão em cache como **Promise única** (`dbPromise`), sempre anulada em erro para reconectar na próxima operação.
- Falhas de leitura na inicialização retornam a fonte como ausente (sem travar o boot).
- Falhas de escrita na fila não propagam erro para o fluxo da UI.

Quando o backup fica indisponível, o indicador mostra um aviso discreto; um retorno bem-sucedido posterior reativa o status automaticamente.

## Fluxo manual (Salvar agora)

O botão **"Salvar agora"** (Ajustes > Gerenciamento de Dados) chama `Backup.backupNow()`:

- Com dados: força a gravação nas **duas** fontes com novo `savedAt` e confirma via toast ("Dados salvos com sucesso!").
- Sem dados (`devedores` vazio): mostra aviso "Nenhum dado para salvar." em vez de gravar.
- Se o IndexedDB falhar: confirma via toast que o dado foi salvo apenas no navegador.

## Backup no Google Drive

O botão **"Enviar backup para o Google Drive"** (Ajustes > Gerenciamento de Dados) chama `uploadBackupDrive()`:

- Serializa `devedores` em JSON e faz upload do arquivo `devedores_backup_AAAA-MM-DD.json` na raiz do Drive do usuário via **Google Drive API v3** (`uploadType=multipart`).
- Usa **Google Identity Services** (OAuth 2.0, escopo `drive.file` — acesso somente a arquivos criados pelo app).
- Exige um **Client ID OAuth** (aplicativo da Web), informado no campo "Client ID do Google Drive" e salvo em `localStorage` (`devedores_app_driveClientId`).

### Como criar o Client ID

1. Em [console.cloud.google.com](https://console.cloud.google.com) crie/abra um projeto.
2. **APIs e serviços** → **Tela de consentimento do OAuth**: usuário externo, dados de teste, escopo `.../auth/drive.file`.
3. **Credenciais** → **Criar credenciais** → **ID do cliente OAuth** → tipo **Aplicativo da Web**.
4. Em **Origens de JavaScript autorizadas** adicione a origem do app publicada (ex.: `https://andrejoaolopes1979-svg.github.io`) e, para teste local, `http://localhost:8080`.
5. Em **URIs de redirecionamento autorizados** adicione as mesmas origens com barra final (ex.: `https://andrejoaolopes1979-svg.github.io/`).
6. Cole o ID (formato `xxxxx.apps.googleusercontent.com`) no campo em Ajustes.

> A API de upload é chamada no primeiro uso/aprovação; um login é solicitado na primeira vez. O `drive.file` só permite ler/alterar os arquivos que o próprio app criar — seguro.

## Indicador de status

`updateBackupStatus()` exibe, na mesma tela do botão, e atualiza a cada gravação:

- `Backup automático ativo · última sincronização: dd/mm/aaaa hh:mm`
- `Backup automático ativo` (ativo, ainda sem nenhuma sincronização)
- `Backup automático indisponível neste dispositivo — dados salvos apenas neste navegador.` (modo privado / quota)

## Estrutura de arquivos

```
backup.js                  → módulo de persistência (localStorage + IndexedDB) e conciliação
test/reconcile.test.js     → testes da lógica de conciliação
scripts/syntax-check.js    → validação de sintaxe (npm run lint)
index.html                 → integração (Backup.*, botão, indicador, toast)
sw.js                      → Service Worker (cache da versão atual do app)
```

## Validação

```bash
npm test       # 16 testes de conciliação
npm run lint   # checagem de sintaxe de backup.js, sw.js e do script inline
```

O `CACHE_NAME` do Service Worker é versionado (atualmente `devedor-pwa-v6`); ao alterar `index.html`, `backup.js` ou `manifest.json`, incremente a versão para que usuários recebam a atualização.