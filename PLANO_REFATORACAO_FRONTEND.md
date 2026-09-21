# Plano de refatoração visual — A7

Status: proposto em 20/09/2026; **não implementado**.
Referências: [auditoria](AUDITORIA_VISUAL.md) e [design system](DESIGN.md).

## Objetivo e limites

Tornar a aplicação mais legível, consistente e profissional, mantendo suas informações,
regras comerciais, permissões e fluxos. Não fazer um redesign integral em uma única entrega.
Cada etapa precisa de comparação antes/depois e validação no navegador.

Não alterar fórmulas, elegibilidade, fontes de dados, meses, critérios de ranking,
arredondamentos, associação de parceiros ou regras de upload como efeito colateral de CSS.
Defeitos funcionais observados serão diagnosticados e corrigidos em alterações identificadas.

## Sequência

| Etapa | Entrega | Dependência | Porte relativo |
| --- | --- | --- | --- |
| 0 | Baseline funcional e visual reproduzível | Aprovação da direção | Pequeno |
| 1 | Integridade de leitura: menu, cortes e relatório | 0 | Médio/alto |
| 2 | Tokens, navegação e componentes fundamentais | 1 | Médio |
| 3 | Visão resultado como página-piloto | 2 | Médio |
| 4 | Quatro páginas de oportunidades e simuladores | 3 | Médio/alto |
| 5 | QSC, Certificação e Quartil | 3 | Alto |
| 6 | Alimentação, acessos, PBI e autenticação | 2 | Médio |
| 7 | Regressão transversal, exportação e acabamento | 4, 5, 6 | Médio |

Os portes expressam risco e abrangência, não estimativa de prazo. Implementar e revisar
uma família de componentes por vez; não trocar a stack ou introduzir biblioteca de UI nova.

## Etapa 0 — Fixar referência

- Preparar base de teste sanitizada, com um/muitos parceiros, valores monetários altos,
  nomes longos, meses ausentes, zeros reais, erros e perfis Administrador/Diretor/GN.
- Registrar valores-chave, ordem do ranking, escopo de parceiros e fórmulas de simuladores.
- Capturar desktop e mobile antes das mudanças, evitando imagens ou dados sensíveis no Git.
- Mapear o uso dos componentes compartilhados e definir a página-piloto.
- Confirmar o contrato de dados do relatório, YTD e competência QSC; não inferir regras pelo layout.

Aceite: cenário reproduzível, resultados esperados documentados e possibilidade de distinguir
regressão visual de incompatibilidade de snapshot. A auditoria atual serve de referência visual,
mas não substitui os testes funcionais necessários.

## Etapa 1 — Corrigir o que impede ler

Escopo: A01–A07 da auditoria, sem transformação estética ampla.

- Corrigir colisão do menu em 1024 px no `DashboardLayout`.
- Garantir que nomes longos nas Torres não invadam números.
- Dar largura útil a valores financeiros da Certificação; manter dados fechados legíveis.
- Investigar `NaN` no relatório. Validar campo de origem e disponibilidade; não mascarar
  erro com zero. Separar essa correção funcional do ajuste de apresentação.
- Remover dependência de altura fixa com corte na impressão e paginar conteúdo real.
- Dar leitura imediata ao gráfico de cidades e explicitar rolagem em tabelas estreitas.

Aceite: sem sobreposição em 1024/1366 px a 100%; valores com centavos totalmente legíveis;
relatório sem valores não finitos; todas as linhas presentes no PDF horizontal gerado.

Risco: impressão e compatibilidade de dados podem exigir mudanças além de CSS. Validar
totais e número de linhas do relatório contra o conjunto exibido na aplicação.

## Etapa 2 — Construir consistência na base

Áreas: `src/styles.css`, `DashboardLayout`, `PartnerFilter`, `Table`, `Input`, `KpiCard`,
`ChartCard` e estados compartilhados.

- Implementar a paleta e escalas do DESIGN.md com tokens, sem segunda fonte de verdade.
- Remover conversões incorretas de tokens OKLCH e mapear estilos pontuais repetidos.
- Compactar navegação e ações, preservando menu superior e seleção de parceiro.
- Unificar alinhamento de cabeçalhos/células por tipo de dado; retirar centralização global.
- Diferenciar valor somente de leitura, campo editável e estado de salvamento.
- Reduzir radius, sombras, gradientes e molduras aninhadas; eliminar hover enganoso.
- Padronizar ícones, foco, contraste e estados loading/empty/error/disabled.

Aceite: mesmas funções nos perfis existentes; filtro limpa, seleciona e rola corretamente;
menus funcionam por teclado/toque; tokens legíveis em claro/escuro; nenhum dado ou ação sumiu.

Risco: componentes compartilhados afetam todas as rotas. Revisar cada rota após mudanças
em tabela, card e layout, não apenas a página usada no desenvolvimento.

## Etapa 3 — Visão resultado como piloto

- Substituir hierarquia decorativa por cabeçalho funcional e seções compactas.
- Uniformizar Torres, YTD, Best Guess e portabilidade: números tabulares, cabeçalhos alinhados,
  unidades e totais coerentes, setas com semântica preservada.
- Manter a ordem das seções, ranking, modo foco, expansão e navegação entre torres.
- Adaptar tabela mobile com identificação persistente e acesso ao detalhe, sem retirar colunas.
- Revisar textos que contradizem campos importados versus calculados.

Aceite: todos os valores conferem com baseline; parceiro filtrado e total global têm escopo
claro; nomes longos e números grandes cabem; a página é utilizável em notebook a 100%.

Checkpoint: avaliar esta página antes de propagar a nova linguagem ao restante do produto.

## Etapa 4 — Oportunidades e simuladores

Rotas: Móvel, FTTH, Licenças e Serviços Digitais e Avançada.

- Aplicar uma mesma hierarquia entre quantidade de oportunidades, parâmetros e projeções.
- Tornar `OpportunitySimulator` compacto e reutilizável, mantendo Conversão e Qualificados.
- Garantir alinhamento e formatação das entradas e dos resultados, inclusive créditos altos.
- Preservar ajuda “i” com coluna, valores e combinação dos filtros comerciais.
- Gráficos por parceiro/cidade: barras legíveis e ordenadas quando pertinente; quantidade
  explícita; evitar gráfico muito alto para uma única categoria.
- Distinguir zeros reais de base ainda indisponível usando o contrato de dados confirmado.
- Implementar responsividade do simulador sem excluir resultados ou parâmetros.

Aceite: mesmos públicos e quantidades antes/depois; fórmulas e arredondamentos inalterados;
persistência verificada no escopo correto; exportação consistente; ajuda funciona por toque.

## Etapa 5 — QSC, Certificação e Quartil

### QSC

- Tabelas compactas com KPI1, KPI2, percentual e nota atual/máxima alinhados.
- Estados de disponibilidade e competência explícitos; faixas com semântica correta.
- Histórico expansível com mesma estrutura visual da linha principal.
- Manter semestres e regras especiais de pontuação por mês.

### Certificação

- Tornar inequívocos parceiro, ciclo fechado e ciclo de simulação.
- Usar texto nos resultados calculados/fechados e campos somente no que é preenchível.
- Preservar estrutura expansível, pontos consolidados e classificação.
- Autosave com salvando/salvo/falhou; não trocar parceiro antes de tratar gravação pendente.

### Quartil

- Preservar a composição já bem resolvida, removendo apenas excesso de recipientes e badges.
- Diferenciar filtro do indicador e ranking geral por três quartis.
- Melhorar leitura móvel de consultor, pontuação e trajetória; manter análise individual.
- Confirmar competências usadas em 3/6 meses sem alterar a regra por decisão visual.

Aceite: indicadores, faixas e ranking iguais ao baseline; receita permanece desempate;
alterações de Certificação não vazam entre parceiros; semestres e expansões mantêm contexto.

## Etapa 6 — Operação e administração

- Alimentação: fila por arquivo, tipos reconhecidos sem sugerir obrigatoriedade de todos,
  progresso por etapa, erros recuperáveis e últimos dez uploads em posição acessível.
- Diretor: busca de parceiro/GN, atualização por exceção e detalhe sob demanda.
- Administrador: priorizar solicitações pendentes e distinguir aprovar, alterar perfil e revogar.
- GN: testar somente parceiros vinculados, estado sem vínculos e permissões de importação.
- PBI: catálogo compacto de links, preservando destinos e autenticação externa.
- Login/cadastro: mesma tipografia, foco e mensagens; sem perguntar parceiro.

Aceite: arquivos individuais e múltiplos preservados durante upload; erro parcial não cancela
outros; histórico exibe resultados reais; nenhuma permissão é ampliada pela interface.

Não criar novos filtros comerciais. Busca administrativa é uma ferramenta operacional,
não uma alteração do recorte dos indicadores.

## Etapa 7 — QA final e entrega

Para cada etapa anterior e novamente no conjunto:

1. Executar a aplicação e renderizar as rotas afetadas.
2. Inspecionar screenshots e interações; não confiar apenas em `scrollWidth` ou build.
3. Corrigir problemas encontrados e repetir a inspeção.
4. Comparar quantidades, totais, rankings e escopos com a referência.
5. Executar testes e verificações existentes relevantes; registrar limites e falhas pendentes.

### Matriz de aceite

| Dimensão | Cobertura necessária |
| --- | --- |
| Viewports | 390×844, 768×1024, 1024×768, 1280×800, 1366×768, 1440×900, 1920×1080 |
| Zoom | 100% como padrão; legibilidade e reflow em zoom ampliado |
| Temas | Claro e escuro, incluindo foco/hover/disabled |
| Perfis | Administrador, Diretor, GN com um/múltiplos vínculos e sem vínculo |
| Dados | Zero real, ausência, nomes longos, valores altos, um/muitos parceiros |
| Interações | Filtros, menu, tabs, ranking, expansão, autosave, exportação |
| Estados | Loading, empty, error, retry, upload parcial e sucesso |
| Acessibilidade | Teclado, nome acessível, foco visível, contraste e área de toque |
| Impressão | A4 horizontal, PDF completo, cabeçalhos repetidos e valores válidos |

Critérios finais: nenhum conteúdo cortado sem acesso alternativo; título e dado alinhados;
nenhum `NaN`/`undefined`; sem sobreposição de menu; informação principal acessível em celular;
regressão funcional coberta; evidência visual após a última correção.

## Estratégia de entrega segura

- Separar correções funcionais, fundação visual e migração de páginas em commits revisáveis.
- Começar pelas primitivas existentes, não duplicar tabelas ou simuladores.
- Não publicar dados de teste, screenshots sensíveis ou cópias SQLite.
- Não atualizar produção automaticamente como parte de auditoria/documentação.
- Uma etapa só termina após **implementar → renderizar → inspecionar → corrigir → validar**.
