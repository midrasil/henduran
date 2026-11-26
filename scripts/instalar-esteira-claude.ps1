#Requires -Version 5.1
[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$DiretorioClaude = $(if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' })
)

$ErrorActionPreference = 'Stop'
$DiretorioClaude = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($DiretorioClaude)
$destino = Join-Path $DiretorioClaude 'CLAUDE.md'
$bloco = @'
<!-- ESTEIRA:INICIO -->
# Fluxo enxuto: Planejador → Dev → Entrega

## Planejador
- Ao iniciar a sessão, leia o `AGENTS.md` da raiz, se existir, e siga os caminhos de memória definidos pelo projeto. No Henduran, o handoff do Claude é `docs/context/handoff.md`; o do OpenCode é `docs/context/handoff-opencode.md`. Leia os dois na retomada, atualize só o seu e registre a entrega em `docs/context/jornal.md`. Sem caminhos definidos, use `HANDOFF.md` e `JOURNAL.md` na raiz.
- Graphify só quando o usuário chamar `/graphify`. Não rode, sugira ou consulte o grafo por conta própria.
- Ajude a escolher o próximo passo. Quando houver escolhas, apresente opções numeradas com a recomendação (⭐) e o motivo em uma linha.
- Responda perguntas e faça documentos e ajustes pequenos diretamente. Só delegue ao subagente `dev` com autorização do usuário e um plano com objetivo, arquivos, passos, restrições e verificação.

## Branch
- Antes de editar na `main` ou `master`, crie uma branch `tipo/tarefa` (feat, fix, docs, refactor, test ou chore). Não faça commit direto nem push nessas branches principais.

## Entrega em duas etapas
1. Resuma o que mudou, as verificações realizadas e o que o usuário deve testar. Pergunte: “Posso entregar? 1. ⭐ Abrir PR · 2. Abrir PR e fazer merge · 3. Ajustar algo antes”. Aguarde a resposta.
2. Quando autorizado, atualize o seu handoff (data, branch, estado, validações, pendências e próximo passo recomendado) e acrescente uma entrada no topo do jornal (data, tarefa, decisões, arquivos, validações e link do PR quando disponível). Para entregar por PR, faça commit com Conventional Commits; com remoto e `gh` autenticado, publique a branch e abra o PR com `gh pr create`. Faça merge apenas com autorização explícita. Sem remoto ou `gh`, informe o que falta. Encerre com branch, PR e próximo passo.

## Texto do PR
- Escreva título e descrição em português, a partir do diff. Use título específico, explique o motivo da mudança e descreva o efeito prático.
- Separe **Validação realizada** (comandos e resultados reais) de **Como testar / pendências** (passos reproduzíveis e verificações ainda não feitas), quando aplicável. Revise o texto contra o diff antes de publicar.
<!-- ESTEIRA:FIM -->
'@

$existe = Test-Path -LiteralPath $destino -PathType Leaf
$utf8 = [Text.UTF8Encoding]::new($false, $true)
$original = if ($existe) { [IO.File]::ReadAllText($destino, $utf8) } else { '' }
$quebra = if ($original.Contains("`r`n")) { "`r`n" } else { "`n" }
$bloco = $bloco -replace '\r?\n', $quebra
$marcas = [regex]::Matches($original, '(?m)^<!-- ESTEIRA:(INICIO|FIM) -->\r?$')

if ($marcas.Count -eq 0) {
    $separador = if ($original.Length -eq 0) { '' } elseif ($original.EndsWith("`n")) { $quebra } else { $quebra + $quebra }
    $novo = $original + $separador + $bloco + $quebra
} elseif ($marcas.Count -eq 2 -and $marcas[0].Groups[1].Value -ceq 'INICIO' -and $marcas[1].Groups[1].Value -ceq 'FIM') {
    $fim = $marcas[1].Index + '<!-- ESTEIRA:FIM -->'.Length
    $novo = $original.Substring(0, $marcas[0].Index) + $bloco + $original.Substring($fim)
} else {
    throw 'Marcadores ESTEIRA incompletos ou duplicados. Nenhum arquivo foi alterado.'
}

if ($novo -ceq $original) {
    "Esteira ja atualizada: $destino"
    return
}

if ($PSCmdlet.ShouldProcess($destino, 'Instalar ou atualizar o bloco ESTEIRA')) {
    $pai = Split-Path -Parent ([IO.Path]::GetFullPath($DiretorioClaude))
    if (-not (Test-Path -LiteralPath $pai -PathType Container)) { throw "Diretorio pai inexistente: $pai" }
    $null = [IO.Directory]::CreateDirectory($DiretorioClaude)
    $temporario = Join-Path $DiretorioClaude ('.esteira-' + [guid]::NewGuid().ToString('N') + '.tmp')
    try {
        [IO.File]::WriteAllText($temporario, $novo, $utf8)
        if ($existe) {
            $backup = "$destino.$(Get-Date -Format 'yyyyMMdd-HHmmss-fffffff').bak"
            [IO.File]::Replace($temporario, $destino, $backup)
            "Backup: $backup"
        } else {
            [IO.File]::Move($temporario, $destino)
        }
        "Esteira instalada: $destino"
    } finally {
        if ([IO.File]::Exists($temporario)) { [IO.File]::Delete($temporario) }
    }
}
