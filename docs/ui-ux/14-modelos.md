# 14 — Tela Modelos (modelos de IA e Skills)

**Data:** 2026-11-24
**Estado:** **protótipo aprovado pelo responsável em 2026-11-24** (versão 5). **Ainda não implementado**: o app continua com a tela Modelos atual (`app/src/components/ModelsView.tsx`, uma página única com Hardware, Motor de IA, Modelos locais, Downloads, Hub e Pastas).
**Protótipo de referência:** [`prototipos/modelos.html`](prototipos/modelos.html) (botão **Protótipo**: estado do motor e do modelo, aba, filtro, busca online, procura no PC, diálogos e Skills). Processo em [`10-prototipagem.md`](10-prototipagem.md).
**Substitui:** a organização atual da tela Modelos (uma página longa) e a nota do backlog "levar a aba Modelos ao nível do Caliope".
**Relacionados:** ADR-070 a 072 (motor local, `NarratorProvider`, HTTP), `05-narrador-ia.md` (seção 5, Skills), ADR-078 (memória e contexto do Narrador), `auditoria-caliope.md` (skills e `modelhub`), `ESCOPO-MVP.md` (item 11).

> Referência de origem: a descrição do backlog (abas, notas de qualidade, ocultar modelos, ajustes de contexto e de GPU) e o Caliope. A tela do Caliope não estava disponível durante o desenho; se a referência visual do responsável divergir, ajustar.

## 1. Onde a tela aparece

Menu inicial (indicador do rodapé), tela da Jornada (menu ⚙ e indicador da barra) e, na criação de Jornada, num **diálogo** aberto pelo botão **Configurar modelo** da tela Iniciar Jornada. O mesmo conteúdo serve aos três.

## 2. Regiões

- **Cabeçalho com o estado** (sem título nem texto explicativo), em três quadros lado a lado:
  - **Este PC**: placa, memória de vídeo, RAM, CPU e sistema.
  - **Motor de IA**: estado (pronto, parado, carregando, baixando, com erro), variante (Vulkan ou CPU) e versão, com **Baixar o motor** (não instalado), **Parar o motor**, **Ver o log** e **Tentar de novo** (erro).
  - **Narrador**: o modelo carregado (nome, quantização, tamanho) com **Descarregar**; ou o modelo **selecionado** com **Carregar**; ou "Nenhum modelo".
- **Cartão de pergaminho com quatro abas**: **Modelos**, **Skills**, **Procurar neste PC** e **Downloads** (selo com o número de downloads ativos; em Skills, o número de skills ativas).

## 3. Aba Modelos (Meus modelos + Buscar)

- **Um campo de busca** que filtra os seus modelos enquanto você digita (ignora acentos, hífens e caixa) e alimenta o botão **Buscar online** (Hugging Face; só repositórios públicos com arquivos .gguf, ordenados por downloads). Chips de **sugestões de busca**.
- **Filtros em tags**: **Todos**, **Meus modelos** e **Para baixar**, cada um com contador.
  - **Meus modelos**: cartões com nome, quantização com **nota de qualidade** (Q2_K a Q8_0), tamanho, **cabe na placa / roda na CPU, lento / pesado demais**, etiquetas **Carregado** e **Selecionado**, **Pasta extra**. Ações: **Carregar…**, **Descarregar**, **Ocultar** e **Apagar do disco**. Modelos de pastas extras mostram "O Henduran não apaga modelos de pastas extras". Os ocultos ficam numa seção recolhida.
  - **Para baixar**: resultados da busca (ou, antes de buscar, as **sugestões para este PC**), cada um com etiquetas, licença, downloads, curtidas, **Não baixado** ou **Você tem: <quantização>** e aviso de **sem licença informada**. **Ver arquivos** abre o repositório com cada quantização: tamanho, se cabe, nota de qualidade, **Recomendado** (Q4_K_M), **Baixar** com confirmação (SHA-256 quando publicado, licença e espaço livre).
- **Sugestões para este PC**: baseadas na placa e na memória, vindas das listas do Caliope; **só sugestões**, nada é escolhido nem baixado sozinho, e cada uma mostra a licença.
- **Carregar…** abre um diálogo com **tamanho do contexto** (4.096 a 32.768 tokens), **camadas na placa de vídeo** (automático ou controle deslizante) e a **memória de vídeo estimada**.
- **Tela inicial sem modelo** ("Vamos dar uma voz ao Narrador"): dois passos (motor de IA e um modelo), com as sugestões, **Buscar modelos** e **Já tenho modelos neste PC**.

## 4. Aba Skills

Skills são pastas com `SKILL.md`: **instruções de texto** para o Narrador (estilo, interpretação, geração de acontecimentos); **scripts e arquivos executáveis nunca são executados** (`05-narrador-ia.md`, seção 5; `auditoria-caliope.md`).

- **Lista**: o acervo do sistema (vindo do Caliope; 520 skills, decisão de 2026-11-22 de que todas entram) e as **importadas**. Cartão com nome, descrição, origem (**Do sistema · Caliope** ou **Importada**), licença (aviso de **sem licença informada**), etiqueta **+18** e as ações **Ativar/Desativar**, **Ver detalhes** e **Remover** (só as importadas).
- **Filtros**: Todas, Ativas, Do sistema e Importadas (com contadores), busca por nome ou assunto e a caixa **Ocultar conteúdo adulto (+18)**.
- **Limite de 3**: cada **Cena** usa até **3 skills ativas** ao mesmo tempo (ADR-078, item 7). Nesta tela, Ativar/Desativar define a **disponibilidade**; o aviso aparece ao passar de 3. A escolha **por Cena**, com modo **automático** (o app e o modelo escolhem entre as skills do acervo local) e **manual**, será desenhada na tela da Jornada (aba Estado da Cena).
- **Detalhes**: licença, origem e versão, descrição, o **SKILL.md** e a lista de arquivos, com os scripts marcados como "ignorado: nunca é executado".
- **Adicionar skill** (menu): **Importar do skills.sh ou do GitHub…** e **Importar de uma pasta…**.
  - skills.sh/GitHub: o jogador cola **o comando do skills.sh** (por exemplo `npx skills add https://github.com/dono/repo --skill nome`), o link ou `dono/repositório`; **o Henduran não executa o `npx`**: ele lê o texto colado, extrai o repositório e a skill e **baixa por conta própria**, do GitHub, só os arquivos de texto (procurando no raiz do repositório e em `skills/`; o dev confere o README oficial do `vercel-labs/skills`); o app lista as skills encontradas; o jogador vê o **conteúdo**, a licença e os arquivos ignorados, marca "Li o conteúdo e confio nesta fonte" e importa. A skill **entra desativada**. Há um botão para abrir o skills.sh no navegador.
  - Pasta: escolha pelo diálogo do Windows e a mesma conferência.
- **O skills.sh** é um diretório e ranking de skills hospedadas em repositórios do GitHub, instaladas pelo comando `npx skills add dono/repositório`; **não foi encontrada uma API pública**. A implementação baixa de repositórios públicos do GitHub (só arquivos de texto da pasta da skill) em vez de depender do site.

## 5. Aba Procurar neste PC

- **Pastas de modelos**: a pasta do Henduran e as pastas extras; **Adicionar pasta…** (diálogo do Windows) e **Remover pasta** (nada é apagado; o app só lê as extras).
- **Procurar neste PC**: varre as pastas comuns (Downloads, LM Studio, Documentos) atrás de `.gguf`; cada achado mostra caminho, quantização e tamanho, com **Usar a pasta deste modelo**. Nada é copiado nem movido.

## 6. Aba Downloads

Lista com progresso, velocidade, estado (na fila, baixando, conferindo o SHA-256, concluído, interrompido, erro, cancelado) e **SHA-256 conferido** ou "sem SHA-256 publicado". Ações: **Cancelar**, **Retomar**, **Remover da lista**, **Limpar concluídos**, **Ver em Meus modelos**.

## 7. Diferenças em relação à tela atual

- Uma página longa vira cabeçalho de estado mais quatro abas; Meus modelos e Buscar viram uma aba com filtros.
- **Novo:** notas de qualidade por quantização, ocultar modelos, estimativa de memória de vídeo, ajustes de contexto e de camadas da GPU, sugestões por hardware, aba Skills com importação.
- **Mantido:** motor local (ADR-070), downloads retomáveis com SHA-256, pastas extras que o app nunca apaga.

## 8. Pendências para a implementação

- **Backend**: ocultar modelo, ajustes de contexto e de camadas por modelo, estimativa de memória, busca em pastas, exclusão e listagem de skills (gerenciador `skills.py` do Caliope: importar o gerenciador, não o acervo), importação a partir do GitHub (sem executar nada, só texto, com tamanho máximo e verificação), registro de licenças e atribuições.
- **Decidido em 2026-11-24**: filtro +18 **sem padrão** (todas visíveis, com a etiqueta); **todas as skills do acervo entram**, com o aviso de licença; importação por comando, link ou `dono/repositório` **sem `npx`** e com leitura de texto pelo app; skills **por Cena** (ADR-078, item 7); idioma interno em inglês (ADR-079). Muitas skills do skills.sh são para programar: a importação avisa "pode não servir para narração".
- **Decisões abertas**: modo padrão de uma Cena nova, regra de troca no meio da Cena e fixar skill entre Cenas (ADR-078, item 7); **licenças para o lançamento** (apenas 81 de 520 declaram licença; a origem do restante é pergunta para o autor do Caliope; é pendência de lançamento, não bloqueia o desenvolvimento); conferência de segurança das skills importadas (o texto é instrução para o modelo e pode induzir comportamento).
- **Visual** a verificar: leitor de tela (abas, filtros, diálogos), DPI de 125% a 200% e reflow a 320 px.
- **Dependência**: a lista de sugestões por hardware usa as listas do Caliope, só como sugestão (decisão de 2026-11-22).
