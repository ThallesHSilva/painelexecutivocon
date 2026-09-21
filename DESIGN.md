# A7 Design System

Direção visual definida em 20/09/2026, após auditoria local do commit `5b0ed26`.
Esta versão substitui a descrição anterior dos estilos existentes. É a especificação
para a próxima refatoração; **os novos estilos ainda não foram implementados**.

Referências: [auditoria](AUDITORIA_VISUAL.md) e [plano por etapas](PLANO_REFATORACAO_FRONTEND.md).

## Direção: painel executivo de operação

Interface corporativa premium, analítica e com alta densidade de informação.
Minimalista sem parecer vazia. A identidade vem do roxo Vivo/A7, da tipografia,
do alinhamento e da qualidade das tabelas. O conteúdo deve ter mais destaque que os recipientes.

O Diretor e o GN devem identificar rapidamente o resultado, o desvio, o parceiro no
recorte e a oportunidade que exige ação. O administrador deve reconhecer solicitações
pendentes e executar ações de acesso com clareza.

Preservar navegação superior, Inter, Lucide, identidade roxa, filtro por parceiro,
simuladores, exportações e detalhamento expansível. Manter rankings das Torres e do
Quartil. Gráficos de oportunidades comunicam distribuição de potencial; não introduzir
uma nova avaliação competitiva entre parceiros.

## Composição

- Cabeçalho compacto com nome funcional da página, recorte e ações pertinentes.
- Evitar slogans como “em foco” e “em uma leitura executiva” substituindo nomes de páginas.
- Organizar seções por espaço e divisórias. Não criar moldura adicional dentro de cada painel.
- Agrupar métricas relacionadas em uma faixa; reservar cards para informações independentes.
- Preservar a ordem comercial aprovada; oferecer aprofundamento por expansão, abas ou paginação.
- Reservar destaque para seleção, criticidade e ação. Não dar o mesmo peso a todos os elementos.
- Evitar gradientes decorativos, glassmorphism, glow, sombras fortes, cantos excessivos,
  ícones em bolhas sem função e badges repetindo o título.
- Não adicionar novos filtros comerciais. Manter os ciclos e períodos já existentes.

## Paleta

Paleta-alvo em HEX, a migrar pelos tokens de `src/styles.css`.
Os comentários HEX atuais não são conversões exatas dos valores OKLCH.
Esta tabela é uma especificação nova, não uma alegação de equivalência.

| Papel / token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| Primary / `--primary` | `#660099` | `#C084FC` | Ações, seleção e foco |
| On primary / `--primary-foreground` | `#FFFFFF` | `#17131F` | Conteúdo do botão primário |
| Background / `--background` | `#F7F7FA` | `#111015` | Fundo neutro |
| Surface / `--card` | `#FFFFFF` | `#1C1922` | Área de trabalho |
| Surface subtle / `--muted` | `#F1F0F4` | `#25212D` | Cabeçalhos, hover e agrupamento |
| Text / `--foreground` | `#211B29` | `#F5F3F7` | Conteúdo principal |
| Text secondary / `--muted-foreground` | `#655D70` | `#B9B2C4` | Contexto e unidades |
| Border / `--border` | `#DDD9E3` | `#40394A` | Divisórias de superfície |
| Control border / `--input` | `#81758C` | `#8C7C9F` | Campos interativos |
| Success / `--success` | `#087447` | `#6EE7B7` | Favorável |
| Warning / `--warning` | `#925A08` | `#FCD34D` | Atenção |
| Critical / `--critical` | `#B54708` | `#FDBA74` | Criticidade intermediária |
| Danger / `--destructive` | `#B42336` | `#FDA4AF` | Erro e resultado desfavorável |
| Information / `--info` | `#086785` | `#7DD3FC` | Informação contextual |
| Selection / `--selection` | `#F1E8F6` | `#36233F` | Fundo da seleção |

### Semântica e contraste

Cor representa significado, não decoração. Estado tem palavra, ícone ou valor, além da cor.
Contraste mínimo: 4,5:1 para texto normal; 3:1 para texto grande e controles relevantes.
Validar o par real de texto/fundo em ambos os temas; cores de gráfico não viram texto automaticamente.

Seta representa direção; cor representa o significado comercial. Queda de churn pode ser
favorável. Preservar as regras comerciais de setas já aprovadas nas Torres.

Quartis: Q1 verde, Q2 teal, Q3 âmbar, Q4 laranja e Q5 vermelho, sempre com o rótulo.
Faixas de indicadores QSC e faixas de notas consolidadas têm sentidos diferentes.
Nunca compartilhar entre elas um mapeamento baseado apenas no número da faixa.
Zero, dado ausente e não aplicável são estados distintos. Não pintar zero de verde por padrão.

## Tipografia

Inter, com fallback `Segoe UI`, `system-ui`, `sans-serif`. Reutilizar a fonte existente.

| Papel | Desktop | Mobile | Peso |
| --- | --- | --- | --- |
| H1 / página | 28 / 34 px | 24 / 30 px | 600 |
| H2 / seção | 18 / 26 px | 18 / 26 px | 600 |
| H3 / subseção | 15 / 22 px | 15 / 22 px | 600 |
| Body / dados | 14 / 20 px | 14 / 20 px | 400–500 |
| Cabeçalho de tabela | 12 / 16 px | 12 / 16 px | 600 |
| Caption | 12 / 16 px | 12 / 16 px | 400–500 |
| KPI | 28 / 34 px | 24 / 30 px | 600 |
| Campo editável | 14 / 20 px | 16 / 22 px | 400–500 |

Usar `tabular-nums`. Não reduzir fonte para caber; corrigir a estrutura.
Evitar caixa alta e tracking amplo em rótulos longos. Dinheiro detalhado usa `pt-BR`,
milhares e duas casas decimais. KPI abreviado oferece valor exato acessível por toque e teclado.

## Layout e densidade

| Elemento | Padrão |
| --- | --- |
| Largura de conteúdo | Máximo 1600 px, centralizado, alinhado ao menu |
| Padding horizontal | 16 px mobile; 24 px tablet/notebook; 32 px desktop largo |
| Escala de espaço | 4, 8, 12, 16, 24, 32, 48 px |
| Seções | 24 px entre seções; 16 px entre título e conteúdo |
| Header | Meta de 64 px; segunda linha compacta quando necessária |
| Navegação | Superior; submenu por clique/teclado e também hover |
| Sidebar | Não introduzir sidebar permanente |
| Grid | 12 colunas desktop, 8 tablet, 4 mobile; gap 16–24 px |
| Linha de tabela | 40–44 px; 48 px para dois níveis de texto |
| Controle | 36–40 px desktop; área de toque 44 px mobile |
| Radius | Campo/botão 6 px; painel 10–12 px; pill só para estado curto |
| Sombra | Nenhuma em tabela; sutil em menu, popover e dialog |

Manter menu desktop a 100% de zoom em 1280 e 1366 px.
Em 1024 px, redistribuir ações ou quebrar deliberadamente a barra antes de haver sobreposição.
Em mobile, menu compacto com nome da página atual visível.
Não usar `min-w-max` de modo que a navegação invada controles adjacentes.

## Tabelas

- Cabeçalho e célula seguem a mesma borda: texto à esquerda, número à direita,
  estado curto centralizado. Remover centralização global independente do tipo de coluna.
- Nome real de parceiro precisa caber ou quebrar sem invadir a próxima célula.
- Campos financeiros comportam valores grandes, separadores, sinal e centavos.
- Editável: campo discreto com borda e foco. Calculado/somente leitura: texto.
  Não apresentar dados fechados como inputs desabilitados.
- Substituir cápsulas decorativas de números por um padrão uniforme, mantendo clara
  a diferença entre campos editáveis e valores somente de leitura.
- Totalizador usa borda superior e peso, sem card adicional.
- Cabeçalho sticky em tabelas longas; preservar a identificação da linha na rolagem horizontal.
- Mobile: identificação + resultado principal, demais informações por expansão;
  séries mensais mantêm tabela completa com rolagem local indicada.
- Não esconder colunas essenciais sem alternativa acessível.
- Preservar ranking, modo foco e expansão das Torres; distinguir subtotal filtrado e total global.
- Não usar dois contêineres de rolagem aninhados para a mesma tabela.

## Dashboard

Antes do visual, definir pergunta gerencial, comparação e unidade.

| Pergunta | Visual | Leitura |
| --- | --- | --- |
| Onde está o maior potencial? | Barras horizontais ordenadas | Nome legível e valor direto |
| Como mudou ao longo do tempo? | Linhas/colunas mensais | Ordem cronológica e lacunas explícitas |
| Qual a composição das ofertas? | Barras ordenadas com quantidade e participação | Evitar donut e dependência de legenda |
| Quanto falta para a meta? | Bullet chart ou barra de progresso | Real e meta identificados |
| Como se distribuem os consultores? | Barra empilhada 100% + quantidades | Cores e ordem estáveis dos quartis |
| Como evoluiu o consultor? | Matriz/heatmap com rótulos e valores | Separar os três indicadores |
| Qual o resultado exato por parceiro? | Tabela | Unidade, ordem e escopo claros |

Evitar donut salvo justificativa gerencial explícita. Não usar gradiente nas séries.
Para muitas cidades/parceiros: primeiras 10 posições + acesso à lista completa.
Com um parceiro, evitar gráfico alto com uma só barra; usar resultado compacto ou composição pertinente.

KPIs: valor e contexto; comparação e tendência somente quando disponíveis.
Não criar números derivados apenas para preencher a interface.
Preservar a ajuda comercial nos ícones “i”: colunas do Mapa Parque, valores selecionados
e combinações entre filtros. Não adicionar descrições redundantes a todos os cards.

## Simuladores e certificação

Parâmetros em faixa compacta, resultados abaixo. Separar entrada, projeção e execução real.
Conversão e Qualificados compartilham o padrão de tabela. O detalhe por parceiro pode
ser recolhido, com totais e informação completa acessíveis.

Preservar fórmulas, arredondamentos e persistência existente por usuário/parceiro.
Autosave informa salvando, salvo ou falha. Certificação identifica PV e ciclo junto da tabela;
resultado fechado usa texto, prévia usa campos. Pts e Faixa calculados não aparentam ser editáveis.

## Estados e interação

| Estado | Tratamento |
| --- | --- |
| Loading | Skeleton nas dimensões reais; não apresentar zero provisório |
| Sem base | Informar a base ausente e a ação permitida ao perfil |
| Sem resultados | Manter recorte e oferecer ajuste/limpeza |
| Sem vínculo GN | Orientar a procurar o Diretor; não sugerir operação zerada |
| Error | Mensagem útil, tentativa novamente, contexto preservado |
| Hover | Realce discreto apenas nos elementos interativos |
| Focus | Anel 2 px com offset 2 px; não oculto pelo header |
| Disabled | Motivo quando não evidente; não usar para dados calculados |
| Upload | Identificado → pronto → enviando → processando → concluído/erro por arquivo |

Lucide 16–20 px, stroke consistente. Botões de ícone têm nome acessível e tooltip.
Ajuda comercial funciona por toque e teclado, dentro da tela.
Transições 120–180 ms, respeitando movimento reduzido. Não fazer cards saltarem no hover.

## Relatório executivo

Capa pode ter presença de marca; análises usam fundo claro e tabelas compactas.
Compartilhar formatação e semântica da aplicação; nunca exibir `NaN` ou `undefined`.
Preservar A4 horizontal. Paginar pelo conteúdo, repetir cabeçalhos e exportar todas as linhas.
Altura fixa com `overflow: hidden` não pode servir para esconder dados que não cabem.
Validar um parceiro, todos os parceiros e a maior tabela em print media e PDF gerado.

## Arquitetura e QA

Manter React/TanStack, Tailwind, Radix, Recharts e Lucide.
Evoluir `DashboardLayout`, `PartnerFilter`, `KpiCard`, `ChartCard`, `Table`,
`Input`, `OpportunitySimulator`, `CertificationPanel` e `EmptyState`.
Extrair cabeçalho compacto, célula numérica e campo numérico somente onde houver repetição.
Não criar biblioteca paralela nem envolver tokens OKLCH em `hsl(var(--...))`.

Cada etapa implementada segue: implementar → renderizar → inspecionar → corrigir → validar.
Matriz-alvo: 390×844, 768×1024, 1024×768, 1280×800, 1366×768, 1440×900 e 1920×1080,
zoom 100%, claro/escuro, perfis pertinentes e estados de interação.
Compilar não encerra QA. Preservar elegibilidade, ranking, cálculos, escopos de acesso,
upload e persistência. Corrigir defeitos funcionais em mudanças explícitas, separadas da estética.
