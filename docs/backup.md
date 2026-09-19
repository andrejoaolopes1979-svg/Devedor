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

## Envio do backup via WhatsApp

O botão **"Enviar backup via WhatsApp"** (Ajustes > Gerenciamento de Dados) chama `shareBackupWhatsApp()`:

- Serializa `devedores` em JSON e monta o arquivo `devedores_backup_AAAA-MM-DD.json`.
- No Android/iOS usa a **Web Share API** (`navigator.share` com `files`): abre o menu de compartilhamento do sistema e, ao escolher o **WhatsApp**, o arquivo `.json` é enviado como documento/anexo. O compartilhamento envia **apenas** o arquivo (sem `text`/`title`), pois o WhatsApp no Android ignora o arquivo quando recebe texto+arquivo juntos.
- O MIME type é negociado com `navigator.canShare` na ordem `text/plain` → `application/json` → `application/octet-stream` (o `text/plain` é o mais aceito pelo Chrome Android; a extensão `.json` é preservada).
- Fallback (navegador sem suporte a compartilhamento de arquivos): mostra um aviso e baixa o `.json` para envio manual — a `wa.me` não permite anexar arquivos, apenas texto.

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

O `CACHE_NAME` do Service Worker é versionado (atualmente `devedor-pwa-v5`); ao alterar `index.html`, `backup.js` ou `manifest.json`, incremente a versão para que usuários recebam a atualização.