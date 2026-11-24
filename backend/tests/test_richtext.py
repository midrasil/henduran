"""História formatada (ADR-077, itens 1 e 2): saneamento por lista permitida e texto puro derivado."""

from __future__ import annotations

import pytest

from henduran.richtext import paragraphs_html, plain_text, sanitize
from henduran.rules import fatia1 as R
from henduran.rules.creation import HISTORY_HTML_MAX, validate_character

from .drafts import valid_draft

DANGEROUS = ("<script", "onerror", "onclick", "onload", "javascript:", "<img", "<a ", "<iframe", "<svg", "href", "src=")


def assert_safe(out: str) -> None:
    low = out.lower()
    for bad in DANGEROUS:
        assert bad not in low, (bad, out)


def test_mantem_a_formatacao_permitida():
    raw = (
        "<h2>Título</h2><h3>Origens</h3><p>Cresceu <b>numa</b> <i>vila</i> de <u>pescadores</u> e <s>fugiu</s>.</p>"
        "<ul><li>um</li><li>dois</li></ul><ol><li>a</li><li>b</li></ol><blockquote><p>citado</p></blockquote>"
        '<p style="text-align: center">no meio</p><p style="text-align:JUSTIFY">justo</p>'
    )
    rich = sanitize(raw)
    assert rich.html == (
        "<h2>Título</h2><h3>Origens</h3><p>Cresceu <strong>numa</strong> <em>vila</em> de <u>pescadores</u> e "
        "<s>fugiu</s>.</p><ul><li>um</li><li>dois</li></ul><ol><li>a</li><li>b</li></ol>"
        '<blockquote><p>citado</p></blockquote><p style="text-align: center">no meio</p>'
        '<p style="text-align: justify">justo</p>'
    )
    assert rich.plain == (
        "Título\nOrigens\nCresceu numa vila de pescadores e fugiu.\n- um\n- dois\n1. a\n2. b\ncitado\nno meio\njusto"
    )


@pytest.mark.parametrize(
    "raw",
    [
        "<script>alert(1)</script><p>oi</p>",
        "<SCRIPT SRC=//x.js></SCRIPT><p>oi</p>",
        "<p>oi<script>alert(1)</script></p>",
        '<img src=x onerror="alert(1)"><p>oi</p>',
        '<p onclick="alert(1)" onmouseover="x">oi</p>',
        '<a href="javascript:alert(1)">oi</a>',
        '<p><a href="jAvAsCrIpT:alert(1)">oi</a></p>',
        '<iframe src="javascript:alert(1)"></iframe><p>oi</p>',
        "<svg onload=alert(1)><script>alert(1)</script><p>dentro</p></svg><p>oi</p>",
        '<math><mi xlink:href="javascript:alert(1)">x</mi></math><p>oi</p>',
        "<style>p{background:url(javascript:alert(1))}</style><p>oi</p>",
        '<p style="background:url(javascript:alert(1))">oi</p>',
        '<p style="text-align: center; background-image: url(javascript:alert(1))">oi</p>',
        '<p style="text-align: expression(alert(1))">oi</p>',
        '<p style="color: red">oi</p>',
        "<p>oi</p><!-- <script>alert(1)</script> -->",
        "<![CDATA[<script>alert(1)</script>]]><p>oi</p>",
        '<object data="x"><embed src="x"></object><p>oi</p>',
        "<template><script>alert(1)</script></template><p>oi</p>",
        '<p title="x" class="y" id="z" data-x="1">oi</p>',
        "<scr<script>ipt>alert(1)</script><p>oi</p>",
        '<p>oi</p><form action="javascript:alert(1)"><button>x</button></form>',
    ],
)
def test_xss_e_descartado(raw):
    rich = sanitize(raw)
    assert_safe(rich.html)
    assert "oi" in rich.plain
    # O resultado é estável: sanear de novo não muda nada.
    assert sanitize(rich.html).html == rich.html


def test_alinhamento_so_com_valores_permitidos():
    assert sanitize('<p style="text-align: right">x</p>').html == '<p style="text-align: right">x</p>'
    assert sanitize('<p style="text-align: inherit">x</p>').html == "<p>x</p>"
    assert sanitize('<h3 style="text-align:center">x</h3>').html == '<h3 style="text-align: center">x</h3>'
    # Só em blocos: numa marca o estilo some.
    assert sanitize('<p><strong style="text-align:center">x</strong></p>').html == "<p><strong>x</strong></p>"


def test_texto_e_escapado_de_novo():
    rich = sanitize("<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; 5 &gt; 3</p>")
    assert rich.html == "<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; 5 &gt; 3</p>"
    assert rich.plain == "<script>alert(1)</script> & 5 > 3"


def test_aninhamento_malformado_vira_estrutura_valida():
    assert sanitize("<em><strong>aninhado</em></strong>").html == "<p><em><strong>aninhado</strong></em></p>"
    assert sanitize("<p><strong>abre <p>outro</strong> fim").html == "<p><strong>abre </strong></p><p>outro fim</p>"
    assert sanitize("<ul><li>um<li>dois</ul>").html == "<ul><li>um</li><li>dois</li></ul>"
    assert sanitize("<li>solto</li>").html == "<ul><li>solto</li></ul>"
    assert sanitize("</p></strong>texto<p>").html == "<p>texto</p>"
    assert sanitize("<ul>direto</ul>").html == "<ul><li>direto</li></ul>"
    assert sanitize("<p><h2>dentro</h2></p>").html == "<h2>dentro</h2>"
    assert sanitize("<blockquote>citado</blockquote>solto").html == "<blockquote><p>citado</p></blockquote><p>solto</p>"
    assert sanitize("<div>a</div><div>b<br>c</div>").html == "<p>a</p><p>b c</p>"


def test_aninhamento_profundo_e_limitado():
    raw = "<blockquote>" * 500 + "fundo" + "</blockquote>" * 500
    rich = sanitize(raw)
    assert rich.html.count("<blockquote>") <= 24
    assert rich.plain == "fundo"


def test_vazios_somem():
    assert sanitize("<p></p><p>   </p><strong></strong><ul><li> </li></ul>").html == ""
    assert sanitize("").plain == ""


def test_listas_aninhadas_no_texto_puro():
    rich = sanitize("<ol><li>a</li><li>b<ul><li>c</li></ul></li></ol>")
    assert rich.html == "<ol><li>a</li><li>b<ul><li>c</li></ul></li></ol>"
    assert rich.plain == "1. a\n2. b\n- c"


def test_historias_antigas_sao_lidas_como_paragrafos():
    assert paragraphs_html("Cresceu no porto.\n\nPartiu <cedo> & só.") == (
        "<p>Cresceu no porto.</p><p>Partiu &lt;cedo&gt; &amp; só.</p>"
    )
    assert plain_text(paragraphs_html("um\ndois")) == "um\ndois"


# ------------------------------------------------------------------ validação do rascunho
def test_rascunho_com_historia_formatada():
    draft = valid_draft(history="ignorada", history_html="<h3>Origens</h3><p>Cresceu <b>no porto</b>.</p><script>x</script>")
    result = validate_character(draft)
    assert result.valid, result.errors
    assert result.character.history == "Origens\nCresceu no porto."
    assert result.character.history_html == "<h3>Origens</h3><p>Cresceu <strong>no porto</strong>.</p>"


def test_limite_da_historia_conta_o_texto_puro():
    limit = R.TEXT_LIMITS["history"]
    # Formatação pesada não conta: o texto puro cabe no limite.
    words = "<p><strong><em>" + "a" * 50 + "</em></strong></p>"
    draft = valid_draft(history_html=words * (limit // 51))
    assert validate_character(draft).valid
    over = valid_draft(history_html="<p>" + "a" * (limit + 1) + "</p>")
    errors = {(e.field, e.code) for e in validate_character(over).errors}
    assert errors == {("history", "muito_longo")}


def test_historia_formatada_vazia_ou_invalida():
    assert {(e.field, e.code) for e in validate_character(valid_draft(history_html="<p> </p><script>x</script>")).errors} == {
        ("history", "obrigatorio")
    }
    assert {(e.field, e.code) for e in validate_character(valid_draft(history_html=12)).errors} == {("history", "tipo_invalido")}
    heavy = "<ul>" + "<li><strong><em><u><s>a</s></u></em></strong></li>" * (HISTORY_HTML_MAX // 40) + "</ul>"
    assert {(e.field, e.code) for e in validate_character(valid_draft(history_html=heavy)).errors} == {
        ("history", "formatacao_demais")
    }


def test_sem_historia_formatada_o_texto_simples_continua_valendo():
    result = validate_character(valid_draft())
    assert result.valid
    assert result.character.history_html is None
    assert "\n" in result.character.history
