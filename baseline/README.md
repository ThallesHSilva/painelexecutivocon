# Baseline sanitizado

Este diretório contém apenas dados fictícios e documentação para a refatoração frontend.
Ele não é importado pelo bundle de produção e não altera banco, autenticação ou persistência.

## Fixture

`fixtures/reference-cases.json` usa a semente fixa `a7-frontend-baseline-v1` e valores explícitos.
IDs, nomes, documentos e números são inventados. O fixture cobre:

- zero, ausência e não aplicável;
- números financeiros grandes e texto longo;
- tabelas extensas e rankings com desempate;
- todos/um/múltiplos parceiros e GN sem vínculo;
- compatibilidade YTD capaz de produzir `NaN` no relatório atual;
- QSC atual/histórico e competência ausente;
- relatório executivo e cenários mobile.

O arquivo é uma referência de contrato e expectativa, não um snapshot de produção. Para usá-lo
em automação, adapte os blocos `inputs` ao endpoint correspondente e compare `expected`.

## Captura visual local

As evidências devem ficar em `.tmp-validation/etapa-0/`, que já é uma área temporária local.
Não copie screenshots reais de `output/` nem o SQLite para este diretório.

Matriz mínima:

| Rota | 1440×900 | 1024×768 | 390×844 |
| --- | --- | --- | --- |
| `/resultados` | obrigatório | obrigatório | obrigatório |
| `/relatorio-executivo` | obrigatório | opcional | obrigatório |
| `/qsc` | obrigatório | opcional | obrigatório |
| `/ftth` | obrigatório | obrigatório | obrigatório |
| `/certificacao` | obrigatório | opcional | obrigatório |
| `/quartil` | obrigatório | opcional | obrigatório |

Nome sugerido: `<rota>--<largura>x<altura>--light--sanitized.png`.

Ao validar uma etapa, registrar também `scrollWidth/clientWidth`, erros de console, estado de
loading/empty/error, escopo do filtro e quantidade de linhas visíveis.
