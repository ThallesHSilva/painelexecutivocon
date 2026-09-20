# A7 Design System

Este documento é a fonte de verdade visual para o painel executivo A7. Novas
interfaces devem reutilizar estes tokens e padrões antes de criar estilos
locais.

## Personalidade

- Interface corporativa premium.
- Analítica e orientada à decisão.
- Alta densidade de informação, sem perder legibilidade.
- Minimalista sem parecer vazia.
- Identidade inspirada na Vivo, com roxo como cor de marca e cor semântica
  usada com intenção.

## Paleta

Os valores abaixo refletem os tokens existentes em `src/styles.css`. Em
componentes, prefira as variáveis semânticas (`bg-background`, `text-primary`,
`border-border`, etc.) a valores hexadecimais locais.

| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| Primary | `#660099` (`oklch(0.38 0.19 310)`) | `oklch(0.68 0.20 320)` | Marca, ações principais e seleção |
| Background | `#F7F7FB` (`oklch(0.98 0.005 300)`) | `#0B0714` (`oklch(0.13 0.02 300)`) | Fundo da aplicação |
| Surface | `#FFFFFF` (`--card`) | `oklch(0.18 0.025 305)` | Cards, tabelas e superfícies elevadas |
| Border | `oklch(0.92 0.006 300)` | `oklch(0.28 0.02 305)` | Divisórias e contornos discretos |
| Success | `oklch(0.62 0.15 155)` | `oklch(0.70 0.15 155)` | Resultado positivo, crescimento e atingimento |
| Warning | `oklch(0.75 0.15 75)` | `oklch(0.80 0.15 75)` | Atenção e faixa intermediária |
| Danger | `oklch(0.58 0.22 25)` | `oklch(0.65 0.21 25)` | Risco, queda e erro |
| Magenta | `oklch(0.60 0.24 350)` | `oklch(0.68 0.24 350)` | Destaque de marca e série secundária |
| Cyan | `oklch(0.72 0.14 230)` | `oklch(0.75 0.14 230)` | Série complementar e informação neutra |

### Regras de cor

- Cor deve representar significado, não decoração.
- Use `success`, `warning` e `danger` para estados e variações de desempenho;
  não use apenas para tornar um card mais chamativo.
- Use a cor primária para ação, foco e navegação ativa.
- Para gráficos, mantenha a ordem e as cores das séries estáveis entre páginas.

## Tipografia

**Fonte principal:** Inter, com fallback para `Segoe UI`, `system-ui` e
`-apple-system`, conforme `--font-sans`.

| Papel | Escala recomendada | Peso | Uso |
| --- | --- | --- | --- |
| H1 | `30px / 36px` | 600–700 | Título da página |
| H2 | `20px / 28px` | 600 | Seções e títulos de módulos |
| Body | `14px / 20px` | 400–500 | Dados, controles e texto de apoio |
| Caption | `12px / 16px` | 400–600 | Rótulos, metadados e unidades |
| KPI | `30px / 36px` | 600–700 | Números de destaque, sempre com contexto |

Use números tabulares em KPIs e tabelas. Títulos devem ser curtos e
informativos; não adicione texto explicando o que já é evidente na interface.

## Layout

- **Grid:** CSS Grid responsivo, com colunas que se adaptam ao conteúdo; use
  alinhamento consistente entre cabeçalho, KPIs, gráficos e tabelas.
- **Sidebar:** não há sidebar permanente. A navegação principal fica no
  cabeçalho superior; em telas menores ela abre em um painel superior.
- **Header:** cabeçalho sticky de `68px`, com borda inferior discreta e fundo
  semitransparente. Deve permanecer funcional sem dominar a tela.
- **Content width:** `max-width: 1600px`, centralizado, com padding horizontal
  `16px` (mobile), `24px` (desktop) e `32px` (telas largas).
- **Spacing scale:** base de `4px`: `4, 8, 12, 16, 20, 24, 32, 40, 48`.
- **Raio:** use o token global `--radius: 1rem`; reduza o raio em tabelas,
  filtros e elementos densos quando isso melhorar a leitura.
- **Elevação:** prefira `shadow-elegant` e `shadow-elevated`; sombras devem
  indicar hierarquia, não criar efeito de flutuação excessivo.

## Dashboard

KPIs devem mostrar:

- valor;
- contexto;
- comparação;
- tendência, quando disponível.

Antes de criar uma visualização, defina a pergunta gerencial que ela responde,
a comparação necessária e a ação esperada. Priorize:

- barras;
- linhas;
- bullet charts;
- tabelas;
- heatmaps;
- small multiples.

Evite donut charts salvo justificativa clara. Ordene barras quando fizer
sentido e destaque exceções sem poluir a visão executiva.

## Princípios de composição

- Priorize hierarquia tipográfica, alinhamento rigoroso e whitespace
  intencional.
- Evite excesso de cards, card dentro de card, gradientes decorativos,
  glassmorphism, glow, badges e ícones dentro de quadrados coloridos sem
  necessidade.
- Prefira informação por exceção, tabelas bem projetadas e densidade adequada
  para aplicações profissionais.
- Todo componente interativo deve considerar loading, vazio, erro, hover,
  focus e disabled quando aplicável.
- Valide desktop, telas estreitas, contraste, overflow e alinhamento visual
  antes de considerar uma mudança de frontend concluída.
