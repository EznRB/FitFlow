# 🏋️ FitFlow Caraguá

**Sistema de Gestão de Academias** — Caraguatatuba, SP

Sistema web completo para gestão de academias de pequeno porte. Substitui controles manuais em papel, caderno e planilhas por uma plataforma digital moderna e responsiva.

## 🚀 Como Rodar

### Pré-requisitos
- **Node.js** v18+
- **MySQL** v8.0+

### 1. Instalar dependências
```bash
cd server
npm install
```

### 2. Configurar o banco de dados

1. Edite o arquivo `server/.env` com suas credenciais MySQL.
2. Execute o schema e seed:

```bash
mysql -u root -p < server/database/schema.sql
mysql -u root -p < server/database/seed.sql
```

### 3. Iniciar o servidor
```bash
cd server
npm run dev
```

O sistema estará disponível em **http://localhost:3000**

### Login padrão (admin)
- **Email:** admin@fitflow.com
- **Senha:** admin123

## 📁 Estrutura do Projeto

```
FitFlow/
├── server/              # Backend Node.js + Express
│   ├── src/
│   │   ├── config/      # Banco de dados e variáveis de ambiente
│   │   ├── middleware/   # Auth JWT, validação, tratamento de erros
│   │   ├── routes/      # Definição de rotas da API
│   │   ├── controllers/ # Handlers HTTP
│   │   ├── services/    # Lógica de negócio
│   │   ├── repositories/# Acesso a dados (SQL)
│   │   ├── utils/       # Helpers e classes auxiliares
│   │   ├── app.js       # Configuração do Express
│   │   └── server.js    # Entry point
│   ├── database/
│   │   ├── schema.sql   # DDL completo
│   │   └── seed.sql     # Dados iniciais
│   └── .env             # Variáveis de ambiente
├── client/              # Frontend HTML + CSS + JS
│   ├── index.html       # Página principal (SPA)
│   ├── css/             # Design system
│   └── js/              # Lógica do frontend
└── README.md
```

## 🛡️ Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js, Express |
| Banco | MySQL |
| Auth | JWT (httpOnly cookies) |
| Frontend | HTML, CSS, JavaScript |
| Segurança | Helmet, CORS, Rate Limiting |

## 📋 Licença

MIT © FitFlow Caraguá
