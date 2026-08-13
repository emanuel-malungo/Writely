# Writely — Assistente Inteligente de IA para WhatsApp Web

Assistente de Redação e Melhoria de Comunicação para WhatsApp Web construído com **Manifest V3**, **React**, **TypeScript**, **Vite** e **Groq / Grok Cloud SDK**.

---

## 📋 Visão Geral & Cobertura das 21 EPICs

| EPIC | Descrição | Status |
| :--- | :--- | :---: |
| **EPIC 01** | Fundação da Extension (Manifest V3, Vite, React, TS) | ✅ Concluído |
| **EPIC 02** | Observador DOM Resiliente & Identificação do WhatsApp | ✅ Concluído |
| **EPIC 03** | Captura & Normalização de Mensagem (Acentos, Emojis, Multilinha) | ✅ Concluído |
| **EPIC 04** | Interface "Melhorar com IA" (Barra de Ação & Botão) | ✅ Concluído |
| **EPIC 05** | Integração Groq/Grok API (SDK, Prompts, Regras de Preservação) | ✅ Concluído |
| **EPIC 06** | Substituição de Conteúdo no Editor Lexical do WhatsApp | ✅ Concluído |
| **EPIC 07** | Manipulação Avançada do Editor Lexical (DataTransfer, Events) | ✅ Concluído |
| **EPIC 08** | Controle de Estados (`IDLE` → `PROCESSING` → `SUCCESS` / `ERROR`) | ✅ Concluído |
| **EPIC 09** | Tratamento de Erros & **Preservação da Mensagem Original (Regra Crítica)** | ✅ Concluído |
| **EPIC 10** | Configuração da API Key (`chrome.storage.local`) | ✅ Concluído |
| **EPIC 11** | Configuração do Tom (Profissional, Natural, Amigável) | ✅ Concluído |
| **EPIC 12** | Inserção do Botão Integrado no Footer do WhatsApp | ✅ Concluído |
| **EPIC 13** | Atalho de Teclado Global (`Ctrl + Shift + G`) | ✅ Concluído |
| **EPIC 14** | Preservação da Intenção Original (Melhorar ≠ Inventar) | ✅ Concluído |
| **EPIC 15** | Performance & UX (MutationObserver Throttled, Timeout 15s) | ✅ Concluído |
| **EPIC 16** | Compatibilidade com WhatsApp Web (Conversas, Grupos, Recarga) | ✅ Concluído |
| **EPIC 17** | Segurança & Privacidade (Sem logs, envio sob demanda) | ✅ Concluído |
| **EPIC 18** | Popup da Extensão Mínimo (Fiel ao Wireframe da especificação) | ✅ Concluído |
| **EPIC 19** | Build & Empacotamento (`whatsapp-ai-extension.zip`) | ✅ Concluído |
| **EPIC 20** | Validação de Fluxos Críticos & Casos de Borda | ✅ Concluído |
| **EPIC 21** | Documentação do Projeto | ✅ Concluído |

---

## ⌨️ Atalho de Teclado Rápido (EPIC 13)

No WhatsApp Web, basta digitar a mensagem no editor e pressionar:
- **`Ctrl + Shift + G`** (Windows / Linux)
- **`Cmd + Shift + G`** (macOS)

A mensagem será capturada, aprimorada pela IA e substituída automaticamente no editor.

---

## 🔐 Regra Crítica de Segurança de Mensagens (EPIC 09 & 14)

1. **Intenção Preservada**: Nomes, valores monetários (ex: `50.000 Kz`), datas, quantidades, links e códigos **nunca são alterados**.
2. **Preservação em Erros**: Se a API falhar, houver timeout ou a internet cair, a mensagem original **permanece 100% intacta no editor** do usuário.

---

## 🛠️ Como Compilar e Empacotar (EPIC 19)

### 1. Compilação de Produção
```bash
npm run build
```

### 2. Empacotamento em ZIP
```bash
npm run package
```
Este comando compila o projeto e gera o arquivo **`whatsapp-ai-extension.zip`** na raiz do projeto, pronto para distribuição ou upload na Chrome Web Store.

---

## 🚀 Instalação no Chrome (Developer Mode)

1. Acesse `chrome://extensions` no navegador Google Chrome.
2. Ative o **Modo do Desenvolvedor** (*Developer Mode*).
3. Clique em **Carregar sem compactação** (*Load unpacked*).
4. Selecione a pasta **`dist`** (`C:\Users\vboxuser\Videos\Writely\dist`).
5. Abra o [WhatsApp Web](https://web.whatsapp.com/) e teste a extensão!
