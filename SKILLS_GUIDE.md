# Guia de Uso de Skills Antigravity (FitFlow)

Este documento detalha como e quando utilizar as principais skills instaladas para o desenvolvimento do projeto FitFlow, garantindo a máxima eficiência e qualidade técnica para a apresentação acadêmica.

## 🛠 Skills de UI/UX e Design

### 1. `ui-ux-pro-max`
- **Contexto:** Todas as alterações de interface, cores, fontes e layout.
- **Uso Eficiente:** Sempre rode a análise antes de criar o CSS para garantir que a paleta de cores e tipografia sigam o padrão "Fitness Premium" definido no `MASTER.md`.

### 2. `animejs-animation`
- **Contexto:** Adição de micro-interações, transições de página e animações de KPIs.
- **Uso Eficiente:** Use em elementos de feedback (ex: após login com sucesso) para dar uma sensação de "app vivo".

### 3. `lucide-icons` (Skill implícita via framework)
- **Contexto:** Todos os ícones do sistema.
- **Uso Eficiente:** Verifique sempre o nome correto do ícone no site oficial do Lucide e utilize o atributo `data-lucide`.

## 🏗 Skills de Arquitetura e Backend

### 1. `api-patterns`
- **Contexto:** Refatoração e criação de novos endpoints REST.
- **Uso Eficiente:** Siga os padrões de resposta sugeridos (JSON estruturado com status, message e data) para manter a API profissional.

### 2. `database-design`
- **Contexto:** Alterações no schema do Prisma ou otimização de queries SQL.
- **Uso Eficiente:** Utilize para planejar relacionamentos complexos, como o vínculo entre Alunos, Treinos e Histórico de Cargas.

### 3. `auth-implementation-patterns`
- **Contexto:** Implementação do sistema de login (JWT) e proteção de rotas.
- **Uso Eficiente:** Crucial para a **Task 3**. Garanta que os cookies httpOnly estejam configurados seguindo os padrões de segurança desta skill.

## 🧪 Skills de Qualidade e Documentação

### 1. `verification-before-completion`
- **Contexto:** Antes de considerar qualquer Task como "Concluída".
- **Uso Eficiente:** Realize testes manuais ou automatizados nas rotas e interface para garantir que não houve regressão.

### 2. `code-reviewer`
- **Contexto:** Revisão de código complexo antes de seguir para a próxima Task.
- **Uso Eficiente:** Peça uma análise de "vibe" e "segurança" para garantir que o código está robusto para a banca de faculdade.

---

## 🚨 Matriz de Obrigatoriedade (Gatekeeping)

A IA **DEVE** invocar as skills abaixo obrigatoriamente conforme o cenário detectado:

| Cenário de Desenvolvimento | Skill Obrigatória | Ação Esperada |
|:---|:---|:---|
| **Criação/Alteração de UI/Layout** | `ui-ux-pro-max` | Consultar design tokens e aplicar estilos Barlow/Orange. |
| **Novo Endpoint / Lógica de API** | `api-patterns` | Validar estrutura de retorno Success/Fail. |
| **Modelagem de Dados / SQL** | `database-design` | Revisar relacionamentos e chaves estrangeiras. |
| **Segurança / JWT / Cookies** | `auth-implementation` | Validar criptografia e segurança de rotas. |
| **Finalização de qualquer Task** | `verification-before-completion` | Rodar checklist de fumaça (smoke tests). |
| **Refatoração / Cleanup** | `code-reviewer` | Buscar vulnerabilidades ou "code smells". |

## 💡 Regra Geral de Ouro
**Identificação de Contexto:** Antes de cada ação de codificação, a IA deve declarar qual skill está utilizando no seu pensamento interno. Se a tarefa cruzar múltiplos domínios (ex: Nova tela que grava no banco), as skills devem ser consultadas sequencialmente. Isso garante que o projeto mantenha o nível de qualidade "State-of-the-Art" exigido no FitFlow.
