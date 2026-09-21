# Auditoria visual e de UX — A7

Data: 20/09/2026. Referência local: commit `5b0ed26`.

## Conclusão executiva

O sistema possui informação gerencial relevante, mas sua apresentação dá peso demais
a recipientes: grandes cabeçalhos, gradientes, molduras sucessivas, cápsulas e ícones
decorativos. Isso aproxima telas diferentes de um mesmo template e compete com os dados.
O problema não é falta de decoração: é falta de hierarquia consistente entre informação,
entrada, resultado e ação.

Há também problemas objetivos de leitura: sobreposição no menu em 1024 px, nomes de
parceiros invadindo colunas, valores monetários cortados e gráficos com rótulos ilegíveis.
No relatório executivo local, apareceram valores `NaN` e cortes na emulação de impressão.
Esses problemas devem preceder o refinamento estético.

A direção proposta é **painel executivo de operação**: roxo como identidade e seleção,
superfícies neutras, tabelas de alta qualidade, tipografia contida e cor reservada ao
significado. A página Quartil já contém boas referências de hierarquia e aprofundamento.

**Nenhum componente, cálculo, regra comercial ou dado de produção foi alterado nesta auditoria.**
Foram produzidos apenas documentos. A especificação está em [DESIGN.md](DESIGN.md);
a sequência de implementação está no [plano de refatoração](PLANO_REFATORACAO_FRONTEND.md).

## Método e cobertura

- Inspeção do código: stack, rotas, tokens, layout, tabelas, cards, gráficos e simuladores.
- Navegação real com Playwright, aplicação local na porta 8001 e cópia isolada do SQLite.
- Capturas e interações em desktop e mobile; não foram realizados uploads ou alterações
  comerciais para esta auditoria.
- Foram utilizados perfil administrador existente e perfil Diretor de teste na cópia.
  O fluxo autenticado específico do GN não foi concluído e permanece no plano de QA.
- O ambiente auditado é local; os resultados não certificam o deploy atual da VPS.

| Tela | Desktop 1440 px | Mobile 390 px | Estados/interações adicionais |
| --- | --- | --- | --- |
| Visão resultado | Inspecionada | Inspecionada | Também 1024, 1366 e 1920 px |
| Oportunidades Móvel | Inspecionada | Inspecionada | Simuladores e tabelas |
| Oportunidades FTTH | Inspecionada | Inspecionada | 1024, 1366, 1920 px e tema escuro |
| Licenças e Serviços Digitais | Inspecionada | Inspecionada | Cards, simuladores e gráficos |
| Oportunidade Avançada | Inspecionada | Inspecionada | Comparativos e simuladores |
| Certificação | Inspecionada | Inspecionada | Sem parceiro único; ciclos; expansão de Receita e QSC |
| Quartil | Inspecionada | Inspecionada | Filtro Evoluíram; ranking; análise individual expandida |
| QSC | Inspecionada | Inspecionada | Semestres; histórico; erro HTTP simulado e recuperação |
| PBI | Inspecionada | Inspecionada | Catálogo; sem abrir relatórios externos |
| Alimentar dados | Inspecionada | Inspecionada | Estado inicial e histórico existente |
| Gerenciar acesso | Inspecionada | Inspecionada | Visões Administrador e Diretor; sem salvar alterações |
| Relatório executivo | Inspecionada | Não auditado em dispositivo móvel | 17 seções; emulação de mídia de impressão |
| Login/cadastro | Inspecionada | Sem auditoria móvel específica | Login e alternância para cadastro; sem cadastrar em produção |

Viewports utilizados: 390×844, 1024×768, 1366×768, 1440×900 e 1920×1080.
Não houve cobertura exaustiva de teclado, leitor de tela, Safari/iOS, impressão física
ou PDF final. A matriz completa de aceite é posterior, não uma alegação de teste já feito.

## Achados prioritários

Prioridade: **P0** impede confiar na entrega do relatório; **P1** prejudica leitura ou
operação; **P2** reduz consistência, eficiência ou qualidade percebida.

| ID | Prioridade | Evidência observada | Consequência | Direção de correção |
| --- | --- | --- | --- | --- |
| A01 | P0 | Relatório executivo local contém 32 ocorrências textuais de `NaN`, inclusive GAP DA META e campos YTD | Informação inválida aparece como resultado | Diagnosticar dados/compatibilidade antes de modificar fórmula; representar ausência explicitamente |
| A02 | P0 | Em print media, 15 das 17 seções excedem a altura útil; uma seção mede 1279 px para caixa de 794 px com overflow oculto | Linhas e tabelas são cortadas | Paginação por conteúdo, repetição de cabeçalho e validação do PDF gerado |
| A03 | P1 | Em 1024 px, item Alimentar dados invade ações de download/tema | Navegação e ações competem pelo mesmo espaço | Reorganizar a barra antes do ponto de colisão |
| A04 | P1 | Torres: nomes como PROVISAO BUSINESS e CONNECT PLUS invadem Forecast | Parceiro e número deixam de ser distinguíveis | Largura da identificação e quebra controlada, sem colunas uniformes indiscriminadas |
| A05 | P1 | Certificação: campos de 86 px cortam valores financeiros; tabela de 1400 px excede área de 1332 px | Não é possível conferir centavos/faixa sem manobras | Campo dimensionado pelo conteúdo; leitura fechada em texto; rolagem indicada |
| A06 | P1 | FTTH: dezenas de cidades em eixo com fonte de 10 px e rótulos sobrepostos | Gráfico deixa de responder onde está o potencial | Barras horizontais ordenadas, recorte inicial e lista completa acessível |
| A07 | P1 | Mobile: tabelas de até 1885 px dentro de área de 330 px, sem identificação persistente em vários casos | Relação entre linha e valor se perde na rolagem | Coluna de identificação persistente; detalhe por expansão; rolagem local orientada |
| A08 | P1 | Alguns estados exibem zero junto de dados não disponíveis ou não classificados | Zero pode ser interpretado como ausência real de oportunidade | Separar zero, sem base, sem resultado e não aplicável; verificar contrato de dados |
| A09 | P1 | Cores de tokens success, warning e cyan têm contraste insuficiente para texto pequeno sobre branco | Legibilidade desigual e dependência excessiva de cor | Tokens de texto semântico próprios e verificação do par renderizado |
| A10 | P2 | Cabeçalhos grandes, gradientes, cards aninhados e badges repetidos nas páginas | Aparência genérica e maior distância até a informação | Cabeçalho funcional compacto e agrupamento editorial |
| A11 | P2 | Alinhamento global centralizado de células compete com alinhamento numérico específico | Não há borda de leitura estável entre colunas | Alinhamento semântico por coluna, igual no cabeçalho e nos dados |
| A12 | P2 | PBI, uploads e acessos usam áreas muito altas para ações simples | Rolagem e busca excessivas | Catálogo compacto, fila de importação e tabelas operacionais com busca |

A01 e A08 são sintomas observados, não diagnóstico de causa. Não é possível atribuí-los
com segurança ao cálculo, à importação ou à compatibilidade de snapshots sem investigação
funcional separada. Nunca substituir um `NaN` por zero para apenas esconder o problema.

## Análise por área

### Navegação, filtro e componentes compartilhados

- O menu superior é adequado ao produto e deve permanecer. Em 1366 px o cabeçalho ocupa
  duas linhas (aproximadamente 116 px), enquanto em 1920 px ocupa uma (68 px). A segunda
  linha pode ser mais intencional e compacta.
- O submenu Oportunidades carteira abriu por hover. O filtro rolou até o último parceiro.
  Limpar desmarcou os 16 selecionados e voltou a Todos os parceiros: o comportamento
  observado não é um defeito de limpeza. Explicitar que nenhuma seleção significa consolidado.
- `ChartCard` e `KpiCard` somam destaque decorativo a painéis que já têm conteúdo colorido.
  Hover com deslocamento em card não clicável sugere uma interação que não existe.
- Há tokens OKLCH envolvidos por `hsl(var(...))` em estilos de componentes: consolidar o uso
  correto durante a migração, sem criar uma segunda paleta paralela.
- Padronizar um H1 funcional por página e a sequência de títulos de seção.

### Visão resultado

- Torres de serviço, YTD e portabilidade têm importância real e devem permanecer.
- A leitura das tabelas não é uniforme: cápsulas, setas, campos e totalizadores parecem
  pertencer a sistemas diferentes. Valores financeiros pedem alinhamento à direita.
- Preservar ranking, modo foco, carrossel das torres e acesso à visão completa.
- Texto que menciona média recalculada/editabilidade precisa ser confrontado com o
  contrato atual de valores vindos da planilha. Não alterar cálculos sob pretexto de design.
- Em mobile, a tabela mais larga tem 1885 px: não basta eliminar overflow da página;
  é preciso manter a identificação da linha e o resultado principal visíveis.

### Quatro páginas de oportunidades

- A combinação hero decorativo + grandes cards + simulador em molduras sucessivas
  repete um template e reduz a área útil para comparar oportunidades.
- Manter os cards comerciais e seus filtros no “i”, removendo decoração redundante.
- Padronizar simuladores: faixa de parâmetros, tabela de conversão e qualificados com
  mesmas bordas de alinhamento; preservar fórmulas, unidades e persistência.
- Tabelas dos simuladores chegam a 900/700 px para uma área móvel de 330 px.
- Com um parceiro, um gráfico alto de uma única barra desperdiça espaço. Com muitos,
  rótulos inclinados e pequenos dificultam comparação. Usar representação adaptada ao recorte.
- FTTH é o exemplo mais urgente: cidades sobrepostas. Nas demais páginas, evitar
  legendas e cores que precisem ser decodificadas antes de ler os valores.
- No tema escuro FTTH, gradientes saturados e muitas camadas reforçam aparência neon,
  em vez de oferecer hierarquia analítica.

### QSC

- Boa base funcional: KPI1, KPI2, percentual, nota atual/máxima e história expansível.
- Diferenciar visualmente faixa do indicador e faixa da nota consolidada: seus sentidos
  não são intercambiáveis. A cor não pode vir simplesmente do número da faixa.
- Histórico e linhas de indicadores devem compartilhar tipografia e alinhamento numérico.
- A base local apresenta períodos e valores ausentes em alguns grupos; sinalizar a
  disponibilidade sem sugerir que zero seja uma nota calculada válida.
- Rever o rótulo “mês corrente” quando a competência disponível não coincide com o mês
  do calendário. Expor competência do resultado, sem mudar silenciosamente o recorte.
- Recuperação após erro simulado funcionou; o estado de erro pode ocupar menos espaço.

### Certificação

- Guard para parceiro único, alternância entre ciclos e expansão funcionaram.
- Resultado fechado em input desabilitado parece editável e tem menor contraste.
  Usar texto numérico; reservar inputs para o simulador.
- A largura atual corta dinheiro e desloca a coluna Faixa para fora da área útil.
- Separar hierarquicamente consolidado e composição; manter Pts/Faixa onde já foi
  definido pelo negócio, sem reintroduzir campos em linhas que não os utilizam.
- Preservar vínculo PV/ciclo e autosave. A gravação não foi exercitada nesta auditoria.

### Quartil

- É a melhor referência atual: título direto, distribuição, ranking e aprofundamento útil.
- O filtro Evoluíram retornou 13 linhas e a expansão mostrou ponto forte, atenção e trajetória.
- O ranking geral por soma dos três quartis deve continuar independente do indicador
  selecionado para distribuição/evolução; tornar esse escopo fácil de perceber.
- Reduzir redundância de mini-cards e cápsulas; dar mais largura ao nome no mobile.
- Conferir a definição temporal “3 meses” contra competências exibidas e contrato atual.
  A captura local mostra maio→agosto; isso requer validação funcional, não ajuste cosmético.

### Alimentar dados

- Cabeçalho alto, grande área vazia e catálogo de nove tipos antecedem o histórico.
  No mobile a página alcança aproximadamente 2308 px mesmo com pouco histórico.
- “0/9” pode sugerir que nove arquivos são obrigatórios, apesar da importação individual.
  Preferir “Tipos reconhecidos nesta seleção” e explicitar os arquivos prontos.
- Separar seleção/fila, envio/processamento e últimos uploads. Status por arquivo deve
  permanecer acessível, inclusive erro parcial, sem reiniciar ou perder os demais.
- Upload real, progresso e recuperação de arquivo não foram exercitados; são itens de QA futuro.

### Gerenciar acesso

- A visão do Diretor chega a aproximadamente 5120 px em desktop e 8366 px no mobile.
  Tabela de parceiros e uma matriz extensa por GN geram leitura repetitiva.
- Priorizar busca, vínculo e atualização por exceção; detalhes de bases sob demanda.
- Na visão Administrador, solicitações pendentes precisam de mais prioridade que
  contadores equivalentes. Ações de revogação devem ser inequívocas.
- A base local contém nomes de parceiros inconsistentes e até “NOME_REDE”. Registrar
  como qualidade cadastral; não corrigir associações automaticamente em refatoração visual.

### PBI, login e relatório

- PBI: seis grandes cards para seis links podem virar catálogo compacto por finalidade.
  Não voltar a incorporar relatórios que exigem acesso externo.
- Login/cadastro: conservar simplicidade; não adicionar parceiro ao cadastro.
  Validar posteriormente foco, erro, senha e leitura em celular real.
- Relatório executivo: prioridade de integridade. A4 horizontal já está configurado,
  mas altura fixa com conteúdo oculto impede imprimir todas as linhas.

## Contraste: verificação amostral

Razões calculadas com as cores atuais resolvidas no navegador contra branco:

| Token | RGB observado | Contraste |
| --- | --- | --- |
| Foreground | 23, 20, 30 | 18,18:1 |
| Muted foreground | 101, 97, 109 | 6,03:1 |
| Primary | 97, 3, 139 | 11,09:1 |
| Success | 15, 160, 92 | 3,39:1 |
| Warning | 228, 158, 34 | 2,28:1 |
| Cyan | 22, 179, 235 | 2,42:1 |

São pares de paleta, não laudo de conformidade de todos os elementos. Texto pequeno
com essas três últimas cores sobre branco exige tratamento. Verificar fundos reais,
temas e estados antes de afirmar conformidade WCAG.

## Evidências locais

Capturas estão em `output/playwright/`, com dados locais potencialmente sensíveis.
Não publicar imagens ou banco de teste no GitHub.

| Evidência | Arquivo |
| --- | --- |
| Sobreposição no menu e tabela | [1024 px](output/playwright/audit-resultados-1024.png) |
| Densidade e padrões de tabelas | [Visão resultado](output/playwright/audit-resultados-1440.png) |
| Simuladores e repetição visual | [Móvel](output/playwright/audit-movel-1440.png) |
| Legibilidade dos gráficos | [FTTH](output/playwright/audit-ftth-1440.png) |
| Cortes em campos de certificação | [Certificação](output/playwright/audit-certificacao-expanded.png) |
| Referência de aprofundamento | [Quartil expandido](output/playwright/audit-quartil-expanded.png) |
| Histórico de indicador | [QSC](output/playwright/audit-qsc-history.png) |
| Densidade de upload no celular | [Alimentação mobile](output/playwright/audit-alimentacao-390.png) |
| Valores inválidos no relatório | [Relatório](output/playwright/audit-report-page-2.png) |
| Corte em mídia de impressão | [Print media](output/playwright/audit-report-print-page3.png) |
| Estado de erro simulado | [Erro QSC](output/playwright/audit-qsc-error.png) |

## O que preservar

Identidade roxa, menu superior, hierarquia de acesso, recorte de parceiro, dados e regras
comerciais, ranking e foco nas Torres, distribuição e ranking dos consultores, histórico
expansível do QSC, simuladores, autosave por escopo e exportações.

A auditoria usa a skill `frontend-premium` para separar identidade, utilidade e decoração,
e Playwright para confrontar as propostas com telas renderizadas. Como não houve implementação,
o ciclo de correção e nova validação será obrigatório em cada etapa do plano; não foi
simulado como concluído apenas pela produção destes documentos.
