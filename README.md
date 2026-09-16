# 📱 DevedorApp - Controle Inteligente de Cobranças (PWA & SPA)

O **DevedorApp** é um aplicativo web progressivo (**PWA**) e de página única (**SPA**), desenvolvido em **HTML5**, **Tailwind CSS** e **JavaScript Vanilla**, criado exclusivamente para uso em dispositivos móveis. Ele permite gerenciar devedores, acompanhar datas de aquisição, produtos, valores totais e parcelas, oferecendo um sistema inteligente de abatimento antecipado e alertas visuais de recebimento.

---

## ✨ Funcionalidades Principais

1. **Gestão Completa de Devedores**:
   - Cadastro com nome, produto/motivo, data de aquisição, valor total e número de parcelas.
   - Geração automática do cronograma de parcelas mensais.
2. **Abatimento Antecipado Inteligente**:
   - Se um pagamento for realizado com valor superior ao da parcela vigente, o excedente é abatido automaticamente nas parcelas seguintes.
3. **Alerta Visual de Vencimento**:
   - Destaque visual (`🚨 Vence Hoje!`) e borda destacada nos cards de devedores cujas parcelas vencem no dia atual.
4. **Dashboard Analítica**:
   - Gráficos interativos (via Chart.js) exibindo o status geral das dívidas (Pendentes x Quitados) e projeções de recebimentos futuros por mês.
5. **Experiência Exclusiva Mobile (PWA & SPA)**:
   - Design moderno otimizado para telas verticais de smartphones.
   - Funcionamento offline via Service Worker.
   - Recursos de exportação e importação de dados em formato JSON.
6. **Backup Durável Automático (IndexedDB)**:
   - A cada gravação (novo/editar/excluir/pagamento/importação), os dados são espelhados silenciosamente no IndexedDB, além do `localStorage`.
   - Na inicialização, `localStorage` e IndexedDB são reconciliados pelo timestamp `savedAt`, carregando sempre a fonte mais recente e sincronizando a outra. Se uma das fontes for limpa (ex.: limpar cache/dados de sites), os dados são restaurados da outra.
   - Falhas do IndexedDB (modo anônimo/privado, quota) são tratadas silenciosamente: o app continua funcionando normalmente apenas com `localStorage`.
   - Botão **"Salvar agora"** (na aba Ajustes > Gerenciamento de Dados) força a sincronização manual das duas fontes com confirmação via toast. Sem dados, exibe um aviso.
   - Indicador sutil de status do backup ("Backup automático ativo · última sincronização: data/hora").

---

## 🚀 Como Executar Localmente

Como o app é puramente frontend (HTML/CSS/JS), você pode abri-lo diretamente de duas formas:

1. **Direto no navegador**:
   - Dê um duplo clique no arquivo `index.html`.
2. **Usando um servidor local (Recomendado para testar PWA/Service Worker)**:
   - Com o Node.js instalado, execute no terminal:
     ```powershell
     npx http-server
     ```
   - Acesse o endereço exibido no terminal (ex: `http://localhost:8080`).

---

## 🌐 Deploy no GitHub Pages

O repositório já está configurado com **GitHub Actions** (`.github/workflows/deploy.yml`) para realizar o deploy automático sempre que houver um `push` na branch `main`.

### Passos para ativar no GitHub:
1. Acesse o seu repositório: [https://github.com/andrejoaolopes1979-svg/Devedor](https://github.com/andrejoaolopes1979-svg/Devedor)
2. Vá em **Settings** > **Pages**.
3. Em **Build and deployment**, selecione a **Source** como **GitHub Actions**.
4. Assim que o workflow for concluído, o aplicativo estará disponível online.

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 / CSS3** (Estrutura e layout mobile-first)
- **Tailwind CSS** (Estilização moderna via CDN)
- **JavaScript (ES6+)** (Lógica SPA, controle de datas e manipulação de estado)
- **IndexedDB** (Backup durável independente do `localStorage`)
- **Chart.js** (Gráficos analíticos)
- **PWA (Manifest & Service Worker)** (Suporte a instalação na tela inicial e funcionamento offline)

---

## 🧪 Testes e Validação

A lógica de conciliação entre `localStorage` e IndexedDB (`backup.js`) é pura e testada em Node.js, com casos que simulam cache limpo, fonte mais nova em cada lado, migração de dados legados, corrupção de fonte e exclusão total:

```bash
npm test          # Executa os testes de conciliação (test/reconcile.test.js)
npm run lint      # Valida a sintaxe de backup.js, sw.js e do script inline do index.html
```

Para detalhes da implementação do backup durável (fluxos de gravação, regras da conciliação, tratamento de falhas e indicadores), veja [docs/backup.md](docs/backup.md).
