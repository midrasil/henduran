"""Texto formatado da História do personagem (ADR-077, itens 1 e 2).

O serviço recebe HTML vindo do editor da interface e **sanea** com uma lista
permitida, sem depender do editor:

- Tags: ``p``, ``h2``, ``h3``, ``strong`` (``b`` vira ``strong``), ``em`` (``i`` vira
  ``em``), ``u``, ``s``, ``ul``, ``ol``, ``li`` e ``blockquote``. ``div`` vira ``p``.
- Atributo: só ``style`` nos blocos ``p``, ``h2``, ``h3`` e ``li``, e dentro dele só
  ``text-align`` com ``left``, ``center``, ``right`` ou ``justify``.
- Tudo o mais é descartado: atributos livres (``onerror``, ``href``, ``class``…),
  links, imagens, comentários e declarações. Tags desconhecidas somem e o texto
  delas fica; o **conteúdo** de ``script``, ``style``, ``svg`` e afins some junto.
- A estrutura sai sempre bem formada (tags fechadas, listas só com itens, blocos
  sem blocos dentro de parágrafos), e o texto é escapado de novo na saída.

O **texto puro** é derivado do HTML saneado: um bloco por linha (os itens de lista
com ``- `` ou ``N. ``), espaços colapsados. O limite de tamanho da História conta
o texto puro, e é o texto puro que vai para o contexto do Narrador.

Histórias gravadas antes, em texto simples, são lidas como parágrafos
(:func:`paragraphs_html`: cada linha não vazia vira um ``<p>``); a entrada de
:func:`sanitize` é sempre tratada como HTML.

Só a biblioteca padrão (``html.parser``).
"""

from __future__ import annotations

import html
import re
import unicodedata
from dataclasses import dataclass, field
from html.parser import HTMLParser

# Blocos e marcas permitidos.
BLOCKS = frozenset({"p", "h2", "h3", "blockquote", "ul", "ol", "li"})
INLINE = frozenset({"strong", "em", "u", "s"})
ALLOWED = BLOCKS | INLINE
# Sinônimos aceitos na entrada.
ALIASES = {"b": "strong", "i": "em", "div": "p", "strike": "s", "del": "s", "h1": "h2", "h4": "h3", "h5": "h3", "h6": "h3"}
# Blocos de texto (não contêm outros blocos).
TEXT_BLOCKS = frozenset({"p", "h2", "h3"})
LISTS = frozenset({"ul", "ol"})
# Blocos que aceitam o alinhamento.
ALIGNABLE = frozenset({"p", "h2", "h3", "li"})
ALIGNMENTS = frozenset({"left", "center", "right", "justify"})
# Tags cujo conteúdo inteiro é descartado.
DROP_CONTENT = frozenset(
    {"script", "style", "iframe", "object", "embed", "template", "noscript", "textarea", "select", "svg", "math",
     "head", "title", "frame", "frameset", "applet", "noframes", "xmp", "plaintext", "noembed", "button", "option"}
)
# Elementos vazios do HTML (sem tag de fechamento).
VOID = frozenset({"br", "hr", "img", "input", "meta", "link", "area", "base", "col", "wbr", "source", "track", "param", "embed"})
MAX_DEPTH = 24  # aninhamento máximo de blocos e marcas; o que passar disso vira texto do nível de cima

_SPACE = re.compile(r"\s+")
_ALIGN = re.compile(r"^\s*text-align\s*:\s*([a-z]+)\s*$", re.IGNORECASE)


@dataclass
class _Node:
    tag: str  # "" na raiz
    align: str | None = None
    children: list[_Node | str] = field(default_factory=list)
    parent: _Node | None = None


def _clean_chars(text: str) -> str:
    """NFC e sem caracteres de controle (quebras e tabulações viram espaço, como no HTML)."""
    text = unicodedata.normalize("NFC", text)
    return "".join(" " if unicodedata.category(ch) == "Cc" else ch for ch in text)


def _alignment(attrs: list[tuple[str, str | None]]) -> str | None:
    """O ``text-align`` permitido do atributo ``style`` (o resto do estilo é descartado)."""
    for name, value in attrs:
        if name.lower() != "style" or not value:
            continue
        for decl in value.split(";"):
            m = _ALIGN.match(decl)
            if m and m.group(1).lower() in ALIGNMENTS:
                return m.group(1).lower()
    return None


class _Sanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = _Node("")
        self.cur = self.root
        self.skip = 0  # profundidade dentro de uma tag de conteúdo descartado

    # ------------------------------------------------------------ pilha
    def _depth(self) -> int:
        n, node = 0, self.cur
        while node.parent is not None:
            n += 1
            node = node.parent
        return n

    def _open(self, tag: str, align: str | None = None) -> None:
        node = _Node(tag, align if tag in ALIGNABLE else None, parent=self.cur)
        self.cur.children.append(node)
        self.cur = node

    def _close_to(self, node: _Node) -> None:
        """Fecha até ``node`` inclusive."""
        while self.cur is not node and self.cur.parent is not None:
            self.cur = self.cur.parent
        if self.cur.parent is not None:
            self.cur = self.cur.parent

    def _find(self, tags: frozenset[str] | set[str]) -> _Node | None:
        node: _Node | None = self.cur
        while node is not None and node.parent is not None:
            if node.tag in tags:
                return node
            node = node.parent
        return None

    def _close_text_block(self) -> None:
        """Um bloco novo não fica dentro de parágrafo, título ou marca: fecha até o contêiner de blocos."""
        while self.cur.parent is not None and (self.cur.tag in INLINE or self.cur.tag in TEXT_BLOCKS):
            self.cur = self.cur.parent

    def _ensure_text_container(self) -> None:
        """Texto e marcas precisam de um bloco de texto: abre ``p`` (ou ``li`` dentro de lista)."""
        if self.cur.tag in INLINE or self.cur.tag in TEXT_BLOCKS or self.cur.tag == "li":
            return
        if self.cur.tag in LISTS:
            self._open("li")
        else:  # raiz ou citação
            self._open("p")

    # ------------------------------------------------------------ eventos
    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if self.skip:
            if tag in DROP_CONTENT and tag not in VOID:
                self.skip += 1
            return
        if tag in DROP_CONTENT:
            if tag not in VOID:
                self.skip = 1
            return
        if tag == "br":
            self.handle_data(" ")
            return
        tag = ALIASES.get(tag, tag)
        if tag not in ALLOWED or self._depth() >= MAX_DEPTH:
            return  # some a tag; o texto de dentro continua
        align = _alignment(attrs)
        if tag in INLINE:
            self._ensure_text_container()
            self._open(tag)
            return
        if tag == "li":
            lst = self._find(LISTS)
            if lst is None:
                self._close_text_block()
                self._open("ul")
            else:
                # Item novo fecha o item aberto da mesma lista (e o que estiver dentro dele).
                item = self._find({"li"})
                if item is not None and item.parent is lst:
                    self._close_to(item)
                else:
                    self._close_to_child_of(lst)
            self._open("li", align)
            return
        # p, h2, h3, blockquote, ul, ol
        self._close_text_block()
        if self.cur.tag in LISTS and tag != "li":
            # Lista só tem itens: o bloco vai dentro de um item novo.
            self._open("li")
            if tag in TEXT_BLOCKS:
                # O texto do bloco fica no próprio item (com o alinhamento dele).
                self.cur.align = align
                return
        self._open(tag, align)

    def _close_to_child_of(self, ancestor: _Node) -> None:
        while self.cur is not ancestor and self.cur.parent is not None:
            self.cur = self.cur.parent

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "br" and not self.skip:
            self.handle_data(" ")
        # Outras tags vazias (img, input, hr…) são descartadas.

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self.skip:
            if tag in DROP_CONTENT:
                self.skip -= 1
            return
        tag = ALIASES.get(tag, tag)
        if tag not in ALLOWED:
            return
        node = self._find({tag})
        if node is None:
            return  # fechamento sem abertura: ignorado
        if tag in INLINE:
            # Não atravessa um bloco aberto depois da marca.
            probe = self.cur
            while probe is not node:
                if probe.tag in BLOCKS:
                    return
                probe = probe.parent  # type: ignore[assignment]
        self._close_to(node)

    def handle_data(self, data: str) -> None:
        if self.skip or not data:
            return
        text = _clean_chars(data)
        if not text.strip() and self.cur.tag not in INLINE and self.cur.tag not in TEXT_BLOCKS and self.cur.tag != "li":
            return  # espaço entre blocos
        self._ensure_text_container()
        self.cur.children.append(text)

    # comentários, declarações e instruções de processamento: descartados
    def handle_comment(self, data: str) -> None:  # noqa: D401
        return

    def handle_decl(self, decl: str) -> None:
        return

    def handle_pi(self, data: str) -> None:
        return

    def unknown_decl(self, data: str) -> None:
        return


# ------------------------------------------------------------------ saída
def _has_text(node: _Node) -> bool:
    for child in node.children:
        if isinstance(child, str):
            if child.strip():
                return True
        elif _has_text(child):
            return True
    return False


def _serialize(node: _Node, out: list[str]) -> None:
    for child in node.children:
        if isinstance(child, str):
            out.append(html.escape(_SPACE.sub(" ", child), quote=False))
            continue
        if not _has_text(child):
            continue  # blocos e marcas vazios somem
        style = f' style="text-align: {child.align}"' if child.align else ""
        out.append(f"<{child.tag}{style}>")
        _serialize(child, out)
        out.append(f"</{child.tag}>")


def _inline_text(node: _Node) -> str:
    parts: list[str] = []
    for child in node.children:
        if isinstance(child, str):
            parts.append(child)
        elif child.tag in INLINE:
            parts.append(_inline_text(child))
    return _SPACE.sub(" ", "".join(parts)).strip()


def _plain_lines(node: _Node, lines: list[str]) -> None:
    for child in node.children:
        if isinstance(child, str):
            continue  # na raiz não há texto solto (o saneamento abre um parágrafo)
        if not _has_text(child):
            continue
        if child.tag in TEXT_BLOCKS:
            lines.append(_inline_text(child))
        elif child.tag in LISTS:
            n = 0
            for item in child.children:
                if isinstance(item, str) or not _has_text(item):
                    continue
                n += 1
                prefix = f"{n}. " if child.tag == "ol" else "- "
                text = _inline_text(item)
                if text:
                    lines.append(prefix + text)
                _plain_lines(item, lines)  # blocos e listas dentro do item
        elif child.tag == "li":
            text = _inline_text(child)
            if text:
                lines.append(text)
            _plain_lines(child, lines)
        elif child.tag == "blockquote":
            _plain_lines(child, lines)


def _parse(raw: str) -> _Node:
    parser = _Sanitizer()
    parser.feed(raw)
    parser.close()
    return parser.root


@dataclass(frozen=True)
class RichText:
    html: str
    plain: str


def paragraphs_html(plain: str) -> str:
    """Texto simples como parágrafos: cada linha não vazia vira um ``<p>`` (Histórias antigas)."""
    lines = [line.strip() for line in plain.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    return "".join(f"<p>{html.escape(_clean_chars(line), quote=False)}</p>" for line in lines if line)


def sanitize(raw: str) -> RichText:
    """HTML saneado e o texto puro derivado dele (a entrada é sempre lida como HTML)."""
    root = _parse(raw)
    out: list[str] = []
    _serialize(root, out)
    lines: list[str] = []
    _plain_lines(root, lines)
    return RichText(html="".join(out), plain="\n".join(line for line in lines if line))


def plain_text(raw: str) -> str:
    """Só o texto puro (atalho de :func:`sanitize`)."""
    return sanitize(raw).plain


__all__ = ["RichText", "paragraphs_html", "plain_text", "sanitize"]
