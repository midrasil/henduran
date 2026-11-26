# Instalar a esteira no Claude Code

Na raiz do repositório, abra o PowerShell (5.1 ou superior):

```powershell
.\scripts\instalar-esteira-claude.ps1 -WhatIf
.\scripts\instalar-esteira-claude.ps1
```

O instalador configura o fluxo Planejador → Dev → Entrega no `CLAUDE.md` da pasta de configuração do Claude Code (`~/.claude` por padrão, ou `CLAUDE_CONFIG_DIR` se definido). Use `-DiretorioClaude` para indicar outra pasta. O script é autônomo e pode ser copiado para outra máquina Windows.

Ao atualizar, o script preserva as instruções fora do bloco `ESTEIRA` e deixa uma cópia do arquivo anterior ao lado do original (`CLAUDE.md.*.bak`). Para desfazer, restaure essa cópia. Se a instalação criou um `CLAUDE.md` novo, remova o bloco instalado. Abra uma nova sessão do Claude Code para carregar as instruções.
