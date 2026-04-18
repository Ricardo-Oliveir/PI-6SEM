# 🏥 VivaMais - Painel Administrativo Web

Sistema de gestão para pesquisa de satisfação e monitoramento de serviços para idosos. Permite gerenciar questionários, usuários, visualizar estatísticas em tempo real, exportar relatórios em Excel e gerar insights com Inteligência Artificial.

---

## 🚀 Tecnologias Utilizadas

### Frontend (Web)
* **React.js**: Biblioteca principal.
* **Material UI (MUI)**: Design System (componentes visuais).
* **Axios**: Comunicação com a API.
* **Chart.js**: Gráficos do Dashboard.
* **XLSX (SheetJS)**: Exportação de relatórios para Excel.
* **React Router Dom**: Navegação.

### Backend (API)
* **Node.js & Express**: Servidor.
* **Firebase Admin SDK**: Banco de dados e Autenticação.
* **JWT**: Segurança.
* **OpenAI**: Inteligência Artificial para análise de sentimentos.

---

## 📦 Instalação e Execução (Passo a Passo)

Este projeto funciona com **dois terminais abertos**: um para o Servidor (Backend) e outro para o Site (Frontend).

### PASSO 1: Configurar o Backend (Servidor)

1.  Acesse a pasta do servidor:
    ```bash
    cd backend-example
    ```

2.  **Instale todas as dependências (incluindo OpenAI):**
    Rode este comando para baixar tudo o que o servidor precisa:
    ```bash
    npm install express firebase-admin cors helmet bcryptjs jsonwebtoken dotenv nodemon openai
    ```

3.  **Configuração do Firebase:**
    * Coloque o arquivo da sua chave de serviço (baixado do console do Firebase) na raiz da pasta `backend-example`.
    * Renomeie o arquivo para: **`firebase-adminsdk-key.json`**.

4.  **Configuração da IA (Opcional):**
    * Crie um arquivo chamado **`.env`** na pasta `backend-example`.
    * Se você tiver uma chave paga da OpenAI ou Gemini, coloque dentro dele:
      ```env
      OPENAI_API_KEY=sua-chave-aqui-sk-...
      ```
    * *Nota:* Se não criar esse arquivo, o sistema rodará em **Modo Simulação Grátis** (usando algoritmo matemático para gerar os insights).

5.  Inicie o servidor:
    ```bash
    npm run dev
    ```
    *O terminal deve mostrar: `🚀 Servidor rodando na porta 3000`.*

---

### PASSO 2: Configurar o Frontend (Site)

1.  Abra um **novo terminal** e acesse a pasta do site:
    ```bash
    cd vivamaisdesktop
    ```

2.  **Instale as dependências (incluindo Excel e Gráficos):**
    Rode este comando único para instalar o visual, o exportador de Excel e os gráficos:
    ```bash
    npm install @mui/material @emotion/react @emotion/styled @mui/icons-material axios react-router-dom chart.js react-chartjs-2 xlsx
    ```

3.  Inicie o site:
    ```bash
    npm start
    ```
    *O site abrirá automaticamente em `http://localhost:3001`.*

---

## 🛠️ Funcionalidades Principais

### 1. Dashboard
* Visão geral de métricas em tempo real.
* Gráficos de adesão e respostas.

### 2. Gerenciador de Questionários
* Criar, Editar e Excluir pesquisas.
* **Botão Excel:** Baixa todas as respostas daquele questionário em formato `.xlsx`.
* **Botão Perguntas:** Visualiza a lista de perguntas cadastradas.

### 3. Análise Inteligente (IA)
* Aba dedicada para analisar resultados.
* Gera **Pontos Fortes**, **Pontos de Melhoria** e **Plano de Ação**.
* Funciona em modo híbrido (IA Real ou Simulação Estatística).

### 4. Gestão de Usuários
* Controle de acesso (Admin vs Usuário App).
* Cadastro e exclusão de contas.

---

## ⚠️ Solução de Problemas

* **Erro "Network Error" ou Dashboard Zerado:**
    * Verifique se o backend está rodando na porta 3000.
    * Confirme se o arquivo `src/services/api.js` aponta para `http://localhost:3000/api`.

* **Erro ao Exportar Excel:**
    * Certifique-se de que o questionário possui respostas. O sistema avisa se estiver vazio.

---
