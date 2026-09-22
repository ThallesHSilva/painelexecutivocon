<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Frontend

## Model routing

Use the following routing policy when the corresponding models are available:

- **Coordinator:** GPT-5.6 Luna (high thinking).
- **Frontend and visual work:** Claude Sonnet 5; escalate to Claude Opus 5 for major redesigns, difficult UX decisions, or unresolved visual issues.
- **Backend and integrations:** GPT-5.6 Terra; escalate to GPT-5.6 Sol for difficult business rules, security, architecture, or critical integrations.
- **Mechanical isolated tasks:** Gemini 3.5 Flash Lite.
- **Exceptional escalation:** GPT-6 Astra only for unusually difficult, high-impact problems unresolved by the normal chain.

Normal escalation chains are `Luna -> Sonnet -> Opus` for frontend and
`Luna -> Terra -> Sol` for backend. Do not delegate when Luna can reliably
complete the task directly, and always specify the target model explicitly.

Para qualquer tarefa que crie, altere ou refatore significativamente uma
interface de usuário, use a skill `$frontend-premium`.

Não considere trabalho de frontend concluído apenas porque compila.

Quando ferramentas de browser estiverem disponíveis, execute um ciclo de
visual QA após mudanças relevantes:

implementação → renderização → inspeção → correção → validação.

Se o projeto possuir `DESIGN.md`, siga-o como fonte de verdade visual.

Para dashboards e aplicações analíticas, priorize clareza, hierarquia,
densidade de informação e utilidade gerencial sobre decoração.
