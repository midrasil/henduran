# Entrega — documentação inicial

- Branch local: `docs/initial-docs`
- Publicação: `main` no remoto `origin` (repositório remoto estava vazio).

## Decisões

- Os arquivos do pacote de UI pixel art da Franuka não foram publicados. A licença local autoriza uso, mas não redistribuição "as is"; o diretório `assets/tilesets/ui/franuka/` foi adicionado ao `.gitignore`.
- O inventário local do pacote permanece no disco (1917 arquivos, ~90 MB), com `License and details.txt` preservado.
- Para publicar os assets no futuro, é necessária autorização explícita do autor ou mudança da licença.

## Arquivos publicados

- `README.md`, `AGENTS.md`, `.gitignore`, `.gitattributes`
- `docs/` (documentação de produto, ADRs, planejamento, GDD e contexto)
- `rules/` (wiki de regras do Henduran)
- `docs/backlog.md`, `docs/esteira/initial-docs/06-entrega.md`

## Verificações

- Nenhum segredo encontrado nos arquivos publicados.
- Grafo local gerado com `graphify update .`; hooks do git instalados; `graphify-out/` ignorado.
