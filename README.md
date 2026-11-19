# 📱 DevedorApp - Controle Inteligente de Cobranças (PWA & SPA)

O **DevedorApp** é um aplicativo web progressivo (**PWA**) e de página única (**SPA**), desenvolvido em **HTML5**, **Tailwind CSS** e **JavaScript Vanilla**, criado para gerenciar dívidas nos dois sentidos — valores a receber e a pagar — com acompanhamento de parcelas, abatimento antecipado e alertas de vencimento.

---

## ✨ Funcionalidades Principais

1. **Gestão completa de dívidas**: cadastro de nome, produto/motivo, data de aquisição, valor, parcelas e sentido da dívida (a receber ou a pagar).
2. **Abatimento antecipado inteligente**: excedentes de pagamento são abatidos automaticamente nas parcelas seguintes.
3. **Alertas de vencimento**: destaque visual para parcelas que vencem no dia atual.
4. **Histórico via WhatsApp**: envio do resumo da dívida e da situação das parcelas.
5. **Dashboard analítica**: totais a receber e a pagar, valores já recebidos/pagos, saldo final e gráficos.
6. **Experiência mobile (PWA & SPA)**: interface otimizada para smartphones, funcionamento offline e importação/exportação de dados JSON.
7. **Backup durável automático (IndexedDB)**: cópia e reconciliação dos dados com o `localStorage`, além de opção para sincronização manual.
8. **Tema preto e laranja**.

---

## 🚀 Como Executar Localmente

Como o app é puramente frontend (HTML/CSS/JS), você pode abrir o arquivo `index.html` diretamente no navegador. Para testar o PWA e o Service Worker, use um servidor local, por exemplo:

```powershell
npx http-server
```

Acesse o endereço exibido no terminal (por exemplo, `http://localhost:8080`).

---

## 🌐 Deploy no GitHub Pages

O repositório está configurado com **GitHub Actions** para realizar o deploy automático após um `push` na branch `main`.

**Acesse o aplicativo:** [https://andrejoaolopes1979-svg.github.io/Devedor/](https://andrejoaolopes1979-svg.github.io/Devedor/)

Se o endereço ainda não estiver disponível, verifique em **Settings > Pages** se a origem está configurada como **GitHub Actions** e aguarde a conclusão do workflow de deploy.

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 / CSS3** e **Tailwind CSS**
- **JavaScript (ES6+)**
- **IndexedDB** e `localStorage`
- **Chart.js**
- **PWA (Manifest & Service Worker)**

---

## 🧪 Testes e Validação

```bash
npm test      # Executa os testes de conciliação (test/reconcile.test.js)
npm run lint  # Valida a sintaxe do projeto
```

Para detalhes da implementação do backup durável, consulte [docs/backup.md](docs/backup.md).
