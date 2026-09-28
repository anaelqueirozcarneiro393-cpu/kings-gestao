# KING'S - Sistema Integrado de Gestão & Operação

Sistema operacional e de gestão interna exclusivo para a marca **KING'S**, centralizando as 3 operações em uma única arquitetura robusta, veloz e sem burocracias de SaaS comercial.

---

## 🍧 Negócios da Marca KING'S

1. **KING'S AÇAÍ**
   - Operação ativa (Horário padrão: 11:00 às 02:00)
   - Fichas técnicas calculadas por gramas (açaí, leite em pó, morangos, granola, embalagens)
   - Complementos gratuitos e adicionais especiais

2. **KING'S BURGUER**
   - Operação ativa (Horário padrão: 18:00 às 02:00)
   - Cardápio artesanal (Clássico King, King Bacon, Egg Bacon, Duplo Bacon, Batatas rústicas)
   - Ponto da carne e turbinadas

3. **KING'S PIZZA**
   - Operação futura ("Em breve")
   - Já estruturada no banco de dados (`active: 0`, `status: 'coming_soon'`)
   - Ativável instantaneamente pelo proprietário em **Configurações**

---

## 🚀 Como Iniciar

O servidor unificado roda tanto o backend Express/SQLite quanto o frontend React/Tailwind compilado:

```bash
# Entrar no diretório do projeto
cd C:\Users\Kauan\.gemini\antigravity\scratch\kings-gestao

# Iniciar o sistema (Backend + Frontend unificado)
npm run server
```

Acesse no navegador:
- **Painel do Proprietário / Gestão**: `http://localhost:3001` (PIN padrão: `1234`)
- **Cardápio Digital Público**: `http://localhost:3001` (Clique em "Ver Cardápio Público" ou acesse a visualização do cliente)

---

## 🛠️ Módulos & Recursos Implementados

* **Dashboard Executivo**: Faturamento, CMV, Lucro Bruto, Despesas, Lucro Líquido, Pedidos Recentes e Alertas de Estoque Baixo com filtros (Hoje, Ontem, 7 dias, Este mês, Mês anterior).
* **Seletor de Operações**: Filtra todo o painel entre Visão Geral (TOTAL KING'S), Açaí, Burguer e Pizza.
* **PDV & Pedidos em Tempo Real**: Gestão de status (Novo, Confirmado, Preparo, Pronto, Em entrega, Entregue) com suporte a pedidos manuais do WhatsApp, Telefone e Balcão.
* **Impressão Térmica (80mm)**: Comanda formatada para impressoras térmicas de bobina com agrupamento por operação.
* **Cardápio Digital Público**: Carrinho unificado que permite ao cliente adicionar itens do Açaí e do Burguer no mesmo pedido.
* **Fichas Técnicas & CMV Transparente**: Cálculo automatizado do custo unitário a partir dos ingredientes.
* **Controle de Estoque com Baixa Automática**: Desconto imediato dos insumos na confirmação da venda e estorno automático se cancelado.
* **DRE Operacional**: Demonstrativo financeiro completo com receitas, CMV realizado e despesas por categoria.
