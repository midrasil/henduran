"""Gera o ícone do Henduran em pixel art (32x32) e versões ampliadas sem suavização.

Desenho: rosa dos ventos dourada com relevo, pontas diagonais roxas, medalhão escuro e
aro dourado (tokens de app/src/styles/tokens.css). Só usa a biblioteca padrão.

Uso:
    python gerar_icone.py <pasta-de-saida> [<pasta-dos-icones-do-tauri>]

A primeira pasta recebe icone-32.png, icone-1024.png (fonte para `npx tauri icon`) e
icone-prev.png. Com a segunda (app/src-tauri/icons), grava 32x32, 128x128, 128x128@2x e
icon.png ampliados por pixel exato. O icon.ico vem de `npx tauri icon icone-1024.png`.
"""
import math, struct, sys, zlib

N = 32
INK, INK2 = (0x22, 0x1A, 0x26), (0x2E, 0x22, 0x33)
OUT = (0x0E, 0x09, 0x11)
G_DARK, G_MID, G_LIGHT, G_HI = (0x7A, 0x4E, 0x12), (0xA8, 0x70, 0x1C), (0xF0, 0xC0, 0x50), (0xF8, 0xD8, 0x78)
P_LIGHT, P_DARK = (0x9A, 0x62, 0xC4), (0x5A, 0x23, 0x80)
IVORY = (0xF4, 0xE8, 0xD4)

def star(cx, cy, R, r, n, rot):
    pts = []
    for i in range(2 * n):
        a = rot + i * math.pi / n
        rad = R if i % 2 == 0 else r
        pts.append((cx + rad * math.sin(a), cy - rad * math.cos(a)))
    return pts

def inside(px, py, poly):
    c = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]; xj, yj = poly[j]
        if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c

c = (N - 1) / 2
img = [[None] * N for _ in range(N)]
main = star(c, c, 12.6, 3.8, 4, 0)
diag = star(c, c, 10.2, 3.4, 4, math.pi / 4)
for y in range(N):
    for x in range(N):
        dx, dy = x - c, y - c
        d = math.hypot(dx, dy)
        if d > 15.6:
            continue
        if d > 14.6:
            img[y][x] = OUT
        elif d > 13.4:
            img[y][x] = G_HI if dy < 0 and dx < 2 else G_MID
        elif d > 12.6:
            img[y][x] = G_DARK
        else:
            img[y][x] = INK2 if (x + y) % 2 == 0 and d > 10 else INK
        if inside(x, y, diag):
            img[y][x] = P_LIGHT if (dx < 0) != (dy < 0) else P_DARK
        if inside(x, y, main):
            # cada ponta tem um lado claro e um escuro (relevo)
            if abs(dy) >= abs(dx):
                light = dx < 0 if dy < 0 else dx > 0
            else:
                light = dy > 0 if dx < 0 else dy < 0
            img[y][x] = G_LIGHT if light else G_MID
        if d < 1.3:
            img[y][x] = IVORY
# contorno escuro em volta das estrelas, para ler bem pequeno
src = [row[:] for row in img]
for y in range(N):
    for x in range(N):
        if src[y][x] in (INK, INK2):
            for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                v = src[y + oy][x + ox] if 0 <= x + ox < N and 0 <= y + oy < N else None
                if v in (G_LIGHT, G_MID, P_LIGHT, P_DARK):
                    img[y][x] = OUT
                    break

def write_png(path, scale):
    w = h = N * scale
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            p = img[y // scale][x // scale]
            raw += bytes((*p, 255)) if p else b"\x00\x00\x00\x00"
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    open(path, "wb").write(png)

out = sys.argv[1]
write_png(out + "/icone-32.png", 1)
write_png(out + "/icone-1024.png", 32)
write_png(out + "/icone-prev.png", 8)
if len(sys.argv) > 2:
    d = sys.argv[2]
    write_png(d + "/32x32.png", 1)
    write_png(d + "/128x128.png", 4)
    write_png(d + "/128x128@2x.png", 8)
    write_png(d + "/icon.png", 16)
