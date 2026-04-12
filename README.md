# 🏋️ FitFlow Caraguá
### **Gestão Inteligente & Moderna para Academias**

![NodeJS](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

O **FitFlow Caraguá** é uma solução completa voltada para a digitalização de academias. Desenvolvido com foco em alta performance e uma experiência de usuário (UX) premium, o sistema substitui planilhas e cadernos por uma interface intuitiva inspirada nas melhores práticas de aplicativos fitness modernos como o *Hevy*.

---

## ✨ Funcionalidades Principais

### 🔹 Painel Administrativo
- **Dashboard em Tempo Real**: Visualize KPIs críticos como total de alunos ativos e inadimplência.
- **Gestão de Alunos**: Cadastro completo com status de matrícula, controle de planos e vencimentos.
- **Construtor de Treinos (Hevy-Style)**: Interface de duas colunas com **Drag & Drop** para criar fichas de treino personalizadas de forma rápida.
- **Catálogo de Exercícios**: Base de dados com mais de 25 exercícios pré-configurados, incluindo imagens e instruções técnicas.

### 🔹 Área do Aluno
- **Visão Individual de Treino**: Cards interativos para acompanhamento das séries e repetições.
- **Registro de Carga**: Histórico progressivo de pesos levantados para monitoramento de evolução.
- **Check-in Dinâmico**: Registro automático de frequência ao acessar o sistema.

---

## 🛠️ Stack Tecnológica

O projeto utiliza uma stack robusta e focada em segurança:

| Camada | Tecnologia | Descrição |
| :--- | :--- | :--- |
| **Backend** | Node.js + Express | API RESTful rápida e escalável. |
| **Banco de Dados** | MySQL | Armazenamento relacional de alta integridade. |
| **ORM** | Prisma | Facilidade e segurança na manipulação de queries. |
| **Frontend** | Vanilla JS + Modern CSS | Interface SPA (Single Page Application) sem frameworks pesados. |
| **Segurança** | JWT + Helmet | Autenticação via cookies httpOnly e proteção contra ataques comuns. |

---

## 🧱 Arquitetura de Software

O sistema segue o padrão de **Arquitetura em Camadas**, garantindo fácil manutenção e extensibilidade:

1. **Controllers**: Gerenciam as requisições HTTP e as respostas da API.
2. **Services**: Contêm as regras de negócio e validações lógicas.
3. **Repositories**: Camada isolada para comunicação direta com o banco de dados.
4. **Middlewares**: Processam segurança (JWT), Rate Limiting e tratamento global de erros.

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- [XAMPP](https://www.apachefriends.org/) ou MySQL Server local

### 1. Clonagem e Dependências
```bash
git clone https://github.com/EznRB/FitFlow.git
cd FitFlow/server
npm install
```

### 2. Configurações de Ambiente
Crie um arquivo `.env` na pasta `server/` (use o `.env.example` como base):
```env
PORT=3000
DATABASE_URL="mysql://root:@localhost:3306/fitflow_caragua"
JWT_SECRET="sua_chave_secreta_aqui"
```

### 3. Banco de Dados & Seeds
Configure o banco através do terminal ou PHPMyAdmin e popule com dados iniciais:
```bash
# Executa o seed de exercícios e dados iniciais
node seed_direct.js
```

### 4. Iniciar o Sistema
```bash
npm run dev
```
Acesse o sistema em: `http://localhost:3000`

---

## 👤 Login de Usuários para Teste

| Perfil | Email | Senha |
| :--- | :--- | :--- |
| **Administrador** | admin@fitflow.com | admin123 |
| **Aluno** | aluno@fitflow.com | aluno123 |

---

## 📋 Licença e Autoria

Este projeto foi desenvolvido como parte de um sistema de gestão educacional.
Desenvolvido por **Enzo**.

© 2026 FitFlow Caraguá — Todos os direitos reservados.
