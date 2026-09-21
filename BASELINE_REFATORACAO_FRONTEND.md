# Baseline da refatoração frontend — Etapa 0

Data da referência: 20/09/2026
Commit-base: `5b0ed26` (`docs: add A7 design system`)
Estado: **baseline funcional e visual fixado; nenhuma mudança de produção nesta etapa**.

Este documento é a referência de regressão para as Etapas 1–7 de
`PLANO_REFATORACAO_FRONTEND.md`. Os dados reais locais, o banco SQLite e as evidências em
`output/` não fazem parte deste baseline e não devem ser publicados.

## 1. Artefatos reproduzíveis

- `baseline/fixtures/reference-cases.json`: dados fictícios determinísticos, casos-limite e
  resultados esperados.
- `baseline/README.md`: forma de uso, limites e matriz de captura.
- `.tmp-validation/etapa-0/`: capturas locais ignoradas pelo Git. Nunca copiar esse conteúdo
  para documentação versionada sem nova sanitização.
- `AUDITORIA_VISUAL.md`: evidência visual histórica do estado anterior à refatoração.

O fixture é orientado aos contratos das APIs e aos cálculos. Ele não é carregado pela aplicação
automaticamente e, portanto, não altera fonte de dados, persistência ou autenticação.

## 2. Cenários obrigatórios

| ID | Caso | Dado sanitizado | Resultado/estado esperado |
| --- | --- | --- | --- |
| `ZERO_REAL` | zero legítimo | parceiro `pv-zero`, oportunidade e receita `0` | mostrar `0`, nunca ausência nem sucesso por padrão |
| `AUSENTE` | campo/mês ausente | QSC sem ponto em `2026-08` e YTD legado sem campos derivados | mostrar indisponibilidade; o relatório atual pode produzir `NaN` |
| `NAO_APLICAVEL` | regra sem aplicação | indicador marcado `notApplicable` | mostrar `—`/“Não aplicável”, sem converter para zero |
| `FINANCEIRO_GRANDE` | moeda longa | `987654321.98` | `R$ 987.654.321,98` quando detalhado; sem corte |
| `TEXTO_LONGO` | parceiro longo | `A7 Centro Empresarial...` | quebrar/truncar com acesso ao nome; nunca invadir número adjacente |
| `TABELA_EXTENSA` | 32 linhas | gerador determinístico `Linha 01`…`Linha 32` | todas as linhas acessíveis; cabeçalho/contexto preservados |
| `RANKING` | empate e desempate | consultores com mesma soma de quartis | soma `6 - quartil`; desempate por receita e depois nome |
| `MULTIPLOS_PARCEIROS` | todos/um/muitos/sem vínculo | `pv-alpha`, `pv-long`, `pv-zero` | escopo conforme perfil e filtro, sem vazamento entre parceiros |
| `NAN_LEGADO` | snapshot incompleto | registro YTD sem `attainment`, `yoy` e derivados | incompatibilidade reconhecida; não mascarar com zero na Etapa 0 |
| `MOBILE` | largura estreita | 390×844 e 768×1024 | menu, identificação de linha e rolagem continuam acessíveis |
| `YTD` | um e vários registros por produto | metas, reais e ano anterior conhecidos | agregado recalcula atingimento e YoY quando há múltiplos registros |
| `QSC` | disponível/zero/ausente/parque zero | pontos com `available` e `zeroPark` distintos | preservar os quatro estados e a competência |
| `RELATORIO` | páginas, torres, portabilidade e QSC | payload sanitizado | total de páginas = torres + 9; A4 horizontal sem perda de linhas |

## 3. Escopos, filtros e permissões

### Filtro de parceiros

- `selected: []` significa “todos” para Diretor.
- IDs inválidos enviados ao serviço são descartados; se nenhum ID válido restar, o serviço usa
  todos os parceiros disponíveis no snapshot.
- Para GN, seleção vazia vira os vínculos permitidos (`effectiveSelected`). GN sem vínculo usa o
  sentinela `__no_partner_access__` e deve receber conjunto vazio, não todos os parceiros.
- A seleção é persistida em `localStorage` sob `mp:partners` e precisa continuar separada dos
  dados de negócio.
- QSC envia um parâmetro `partner` por ID. Um parceiro usa o escopo individual; vários são
  agregados; todos usam o escopo `__all__`.

### Perfis

| Perfil | Escopo funcional atual |
| --- | --- |
| Administrador | gestão de usuários; APIs de indicadores retornam 403 |
| Diretor | todos os parceiros, com filtro opcional; pode acessar qualquer prévia válida |
| GN com vínculo | somente IDs vinculados, inclusive quando não há seleção explícita |
| GN sem vínculo | nenhum parceiro; jamais fallback para todos |

### Persistência

- Tema: `mp:theme` em `localStorage`.
- Filtro: `mp:partners` em `localStorage`.
- Simuladores: objeto por `storageKey`, com quantidade, conversão, capacidade, média e ticket.
- Prévia de Certificação: persistência no servidor por `partnerId`, PUT de mesma origem e limite
  serializado de 250.000 caracteres.

## 4. Fórmulas e resultados a preservar

### Oportunidades e simulador

- Móvel: `elegíveis = round(baseRec × 0,55)`; `meta = round(linhas × 0,28)`;
  mensal `round(meta/6)`, semanal `round(mensal/4)`, diário `round(semanal/5)`;
  alimentação comercial `round(elegíveis × 0,35)`.
- FTTH: penetração `baseBásica / (baseBásica + oportunidades)`, ou `0` se denominador zero.
- Avançada: participação na base e no mix retornam `0` com denominador zero.
- Licenças: percentual elegível `elegíveis/base`, ou `0` com base zero.
- Simulador: quantidade `oportunidades × quantidadePorCnpj`; conversões
  `quantidade × taxa/100`; capacidade `ceil(conversões/capacidadeDia)`; receita
  `conversões × ticket`; contatos mês/semana/dia = conversões `/2`, `/8`, `/40`; FDV
  `ceil(conversões/médiaAtivações)`.

No cenário `SIMULADOR_PADRAO` do fixture: 100 oportunidades, quantidade 2, conversão 5%,
capacidade 20 e ticket R$ 1.500 resultam em 200 unidades, 10 conversões, capacidade 1 e
R$ 15.000 de receita.

### Resultados/YTD

- Por produto e um único registro, os campos importados (`attainment`, `gap`, `average`, `yoy`,
  `yoyGap`) são preservados.
- Com mais de um registro, a visão Resultados soma metas/reais/gaps e recalcula:
  `attainment = real/meta`, `previousAttainment = previousReal/previousMeta` e
  `yoy = real/previousReal - 1`, retornando zero quando o denominador é zero.
- O relatório associa torre a produto por `TOWER_PRODUCT_MAP`; sem mapeamento usa o título.
- Inconsistência fixada no baseline: a tela Resultados tolera derivados ausentes com `?? 0`, mas
  `buildYtdSummary` no relatório soma esses campos diretamente. Um snapshot legado incompleto
  pode propagar `NaN`; a correção pertence à Etapa 1.

### Rankings

- Torres: ordenar, em sequência, pelas colunas normalizadas `bgxpc`, `meta` e `estxpc`, sempre
  decrescente; valor não numérico equivale a `-Infinity`; empate final por nome em `pt-BR`.
- Quartil: Q1 é o melhor. Pontos por métrica = `6 - quartil`; ausente vale 0. Ordenação por soma
  decrescente, receita decrescente e nome crescente. Posição é compartilhada apenas quando soma
  **e** receita são iguais.
- Evolução de Quartil: janela de 3 meses = atual + 2 anteriores; 6 meses = atual + 5. Variação
  positiva significa melhora (`quartil anterior - quartil atual`).

### QSC

- Contrato do ponto: `competence`, `value`, `numerator`, `denominator`, `available`, `zeroPark`,
  `score` e `scoreBand`.
- Valor calculado somente quando há dado e denominador > 0; caso contrário, `null`.
- A agregação de parceiros soma numerador/denominador por competência, usa OR para
  `available`, AND para `zeroPark` e recalcula a razão.
- `aceite-digital` tem faixas especiais em agosto.
- Nota consolidada soma os `score` disponíveis. Faixas atuais: ≥90/80/70/60/50 dão
  Faixa 5/4/3/2/1 e 1000/800/600/400/200 pontos; abaixo de 50 dá 0; sem scores é ausência.
- Histórico semestral considera janeiro–junho ou julho–dezembro da competência atual e usa a
  média arredondada das somas mensais disponíveis no relatório.

### Certificação

- Total mensal da Receita Telecom é a soma das linhas detalhadas preenchidas.
- One Shot, FTTH físico, receita de novos produtos e receita por FDV usam média dos meses
  preenchidos do ciclo anterior.
- Faixas/pontos e pedras permanecem exatamente nas tabelas de
  `src/components/CertificationPanel.tsx`; classificação exige simultaneamente receita mínima e
  pontos mínimos.

## 5. Contratos de dados confirmados

| Contrato | Origem | Campos/semântica crítica |
| --- | --- | --- |
| `MapaSnapshot` | `/api/data/mapa` | `partners`, `scopes[id]`, totais, oportunidades, breakdowns e qualidade |
| `RuntimeResults` | `/api/data/resultados` | `resultados`, `bestGuess`, `portabilidade`, `torres`; filtragem por empresa normalizada |
| `ResultadosYoySnapshot` | snapshot persistido | campos atuais e anteriores, derivados YTD/YoY; hoje tipados como obrigatórios |
| `ServiceTower` | snapshot persistido | colunas com `key/label/format`, linhas por parceiro, valores `string|number|null`, total |
| `QscApiResponse` | `/api/qsc` | competência, disponibilidade, linhas, parceiros e séries com `latest/history` |
| `QuartilSnapshot` | `/api/quartil` | meses, parceiros, consultores, histórico e comparações de 3/6 meses |
| Prévia certificação | `/api/certificacao/previa` | payload opaco por parceiro; GET/PUT autorizados; autosave cliente |

Pendências de contrato para a Etapa 1: decidir se os derivados YTD legados são opcionais ou
normalizados na ingestão; alinhar `QscPoint` (`numerator/denominator` anuláveis e `latest`
anulável) com `QscMetricPoint`, pois o TypeScript atualmente acusa incompatibilidade.

## 6. Componentes compartilhados e impacto

| Arquivo | Responsabilidade | Rotas consumidoras | Risco | Prioridade |
| --- | --- | --- | --- | --- |
| `src/layouts/DashboardLayout.tsx` | header, navegação, menu mobile, tema, filtro e logout | 11 rotas de dashboard | crítico: navegação/perfis/1024 px | P0 |
| `src/contexts/AppContexts.tsx` | tema e escopo efetivo por parceiro/perfil | transversal via root/hooks | crítico: vazamento de escopo | P0 |
| `src/components/PartnerFilter.tsx` | seleção, busca e limpeza de parceiros | todas via layout | alto: filtro e persistência | P0 |
| `src/components/ui/table.tsx` | primitivas de tabela | Resultados, QSC, Móvel, Usuários, Certificação, simulador | crítico: alinhamento/corte/mobile | P0 |
| `src/components/ui/input.tsx` | campo base | login, filtros, tabelas e simuladores | alto: editável vs leitura | P0 |
| `src/components/ui/button.tsx` | ações e navegação | transversal | alto: foco, toque, estados | P1 |
| `src/components/ui/card.tsx` | superfície base | quase todas as páginas | alto: densidade e recipientes | P1 |
| `src/components/KpiCard.tsx` | KPI, tendência, tooltip e loading | Móvel, FTTH, Licenças, Avançada | alto: formatação/estado | P1 |
| `src/components/ChartCard.tsx` | moldura de visualização | Móvel, FTTH, Licenças, Avançada | médio/alto | P1 |
| `src/components/charts.tsx` | barras e donut Recharts | quatro rotas de oportunidades | alto: leitura/tooltip/tipos | P1 |
| `src/components/OpportunitySimulator.tsx` | fórmulas e persistência local | FTTH, Licenças, Avançada | crítico: cálculo/persistência | P1 |
| `src/components/EmptyState.tsx` | estados vazio/erro/retry | cinco rotas de indicadores | médio | P1 |
| `src/components/CertificationPanel.tsx` | ciclos, cálculos, autosave e classificação | Certificação (e regras paralelas em Resultados) | crítico: dinheiro/regras | P0 |
| `src/components/CertificationQscHistory.tsx` | histórico QSC dentro da certificação | Certificação | alto | P1 |
| `src/services/api.ts` | escopo, agregação e view models | hooks de todos os indicadores | crítico: regras comerciais | P0 |
| `src/hooks/useData.ts` | query keys, polling e escopo | rotas analíticas | alto: cache e filtro | P0 |

Página-piloto confirmada para a Etapa 3: `/resultados`. A Etapa 1 deve corrigir primeiro os
bloqueios de leitura transversais e do relatório, sem antecipar a linguagem visual da piloto.

## 7. Matriz visual de referência

Rotas prioritárias: `/resultados`, `/relatorio-executivo`, `/qsc`, `/ftth`, `/certificacao` e
`/quartil`.

Viewports mínimos desta etapa:

- desktop amplo: 1440×900;
- notebook: 1366×768;
- ponto de colisão conhecido: 1024×768;
- tablet: 768×1024;
- mobile: 390×844.

As capturas locais devem registrar tema, rota, viewport, escopo e data no nome/manifesto, mas
não incorporar nomes reais, e-mails, documentos, planilhas, caminhos locais ou conteúdo de
`output/`.

Captura executada com sessão de Diretor fictícia, banco temporário e respostas de negócio
sanitizadas: 13 imagens locais (as seis rotas prioritárias em 1440×900 e 390×844, mais
`/resultados` em 1024×768). O manifesto versionável está em
`baseline/visual-reference-manifest.json`. Na repetição final das rotas núcleo, o console ficou
sem erros e os textos não continham `NaN` nem `undefined` para o contrato conforme.

Inspeção visual confirmada, sem depender apenas de `scrollWidth`:

- em 1024 px, a navegação superior encosta/colide na área de ações;
- o nome longo invade colunas numéricas nas Torres em desktop estreito;
- em 390 px, a tabela de Torres mantém largura interna, mas a identificação e os números se
  sobrepõem visualmente;
- o relatório produz páginas fixas muito longas; a captura de tela não comprova paginação de
  impressão/PDF e esse aceite continua pendente para a Etapa 1;
- o fixture conforme não produz `NaN`; o caso legado omitido continua sendo o teste negativo
  obrigatório para reproduzir a incompatibilidade.

## 8. Estado dos testes antes da refatoração

Executado em 20/09/2026 no commit-base, antes dos arquivos desta documentação:

| Comando | Resultado |
| --- | --- |
| `node --test scripts/quartil.test.mjs` | passou: 3/3 testes |
| `npm run build` | passou; build cliente, SSR e Nitro concluído |
| `npx tsc --noEmit` | falhou com 21 diagnósticos em autenticação, snapshots, alimentação, QSC e Resultados |
| `npm run lint` | falhou: 6.727 erros e 9 avisos em 68 arquivos; 6.722 erros são EOL/Prettier |

O ambiente não possui `bun`; os scripts foram executados com npm/npx. Os cinco erros de lint
não-Prettier estão em `src/components/charts.tsx` (`no-explicit-any`). Os avisos restantes são
hooks/fast-refresh. Essas falhas são preexistentes e não foram corrigidas na Etapa 0.

## 9. Critério de encerramento e gate da Etapa 1

A Etapa 0 é considerada concluída quando:

1. o fixture permanece reproduzível e sem dados reais;
2. alterações visuais futuras confrontam métricas, rankings, filtros e escopos deste documento;
3. capturas locais cobrem ao menos Resultados, relatório e QSC em desktop/mobile;
4. as falhas preexistentes de testes são distinguidas de regressões novas;
5. qualquer mudança de contrato é explícita, testada e separada de CSS.

Gate objetivo para iniciar a Etapa 1: criar testes de caracterização focados em
`buildYtdSummary`/snapshots legados e escopo de GN; depois corrigir `NaN`, paginação/impressão,
menu em 1024 px e cortes de tabelas, mantendo o fixture e os valores esperados invariáveis.
