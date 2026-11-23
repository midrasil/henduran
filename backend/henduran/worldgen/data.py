"""Tabelas de conteúdo do gerador de mundo (fantasia medieval, alta e baixa fantasia, pt-BR).

Todo o texto foi escrito para o Henduran. Eras e tons são **ambientação**, e não
regras: nenhum deles cria mecânica. Os nomes saem de sílabas e raízes
inventadas (ver :data:`NAME_PREFIXES`, :data:`NAME_MIDDLES`, :data:`NAME_SUFFIXES`);
:data:`BLOCKED_NAMES` evita, por garantia, alguns nomes de obras, lugares e
palavras existentes que as combinações poderiam formar.

Marcadores usados nas descrições: ``{nome}`` (nome do lugar ou da divindade) e
``{dominio}`` (frase do domínio divino).
"""

from __future__ import annotations

# ------------------------------------------------------------------ sílabas dos nomes
# Prefixo termina em consoante; meio é vogal + consoante (opcional); sufixo começa em vogal.
# Só os sufixos levam acento, então cada nome tem no máximo uma sílaba acentuada.
NAME_PREFIXES: tuple[str, ...] = (
    "Val", "Mor", "Ar", "Bel", "Cal", "Dor", "Esm", "Fen", "Gal", "Hal", "Ir", "Lor",
    "Mir", "Nor", "Ost", "Per", "Quel", "Ros", "Sal", "Tor", "Ur", "Vel", "Zar", "Brem",
    "Cor", "Dar", "Ferr", "Grav", "Alm", "Erv", "Lum", "Tarn", "Vin", "Ced",
)
NAME_MIDDLES: tuple[str, ...] = (
    "an", "en", "ar", "or", "el", "il", "ur", "am", "ad", "er", "on", "us",
)
NAME_SUFFIXES: tuple[str, ...] = (
    "ória", "ândia", "edor", "imar", "ais", "ena", "ondel", "ura", "aria", "élio", "ão",
    "ilha", "unde", "arim", "ova", "esta", "ícia", "anor", "oura", "eira", "ádia", "ino",
)
# Nomes a evitar se as combinações os formarem (obras, marcas, lugares e palavras comuns).
BLOCKED_NAMES: frozenset[str] = frozenset(
    name.casefold()
    for name in (
        "Gondor", "Mordor", "Rohan", "Narnia", "Nárnia", "Westeros", "Valinor", "Arda", "Valéria", "Morena",
        "Valença", "Lorena", "Belém", "Coração", "Galão", "Salão", "Torão", "Calão", "Mirão", "Ostra",
        "Calura", "Dorena", "Ferrão", "Cedura", "Almena", "Almeira", "Ferreira", "Salina", "Perena",
        "Torino", "Galena", "Valura", "Lumena", "Irena", "Sereia", "Morais", "Salais", "Vinária",
        "Vinhedo", "Corais", "Darena", "Arena", "Ervais", "Ceder", "Arão", "Valino", "Belino", "Urano",
    )
)

# ------------------------------------------------------------------ nome do Mundo
WORLD_NAME_TEMPLATES: tuple[str, ...] = (
    "{nome}", "{nome}", "Terras de {nome}", "Reino de {nome}", "Marcas de {nome}",
    "Ilhas de {nome}", "Vales de {nome}", "Planícies de {nome}", "Principados de {nome}",
)

# ------------------------------------------------------------------ eras (nome, descrição)
ERAS: tuple[tuple[str, str], ...] = (
    ("Era das Cinzas", "Os grandes reinos ruíram em guerras antigas e os sobreviventes reconstroem sobre os escombros."),
    ("Era dos Juramentos", "Senhores e cavaleiros sustentam a ordem com promessas solenes, que poucos ainda cumprem."),
    ("Era da Coroa Partida", "O último rei morreu sem herdeiro e os nobres disputam o trono vazio."),
    ("Era das Estradas", "O comércio floresce entre cidades muradas, e com ele crescem a cobiça e o banditismo."),
    ("Era do Despertar", "Depois de séculos de silêncio, os sinais do sobrenatural voltam a surgir nos campos e nas ruínas."),
    ("Era dos Templos", "As ordens religiosas detêm mais poder que muitos senhores e disputam a fé do povo."),
    ("Era da Longa Paz", "Gerações sem guerra deixaram os castelos esquecidos e as velhas ameaças adormecidas."),
    ("Era das Marés Altas", "O mar engoliu terras antigas e os povos costeiros se mudaram para o interior."),
    ("Era do Inverno Longo", "Os invernos duram mais a cada ano, e a fome empurra aldeias inteiras para a estrada."),
    ("Era dos Exilados", "Um império caído espalhou seus nobres e sábios pelas terras vizinhas, em busca de abrigo."),
)

# ------------------------------------------------------------------ tons (nome, descrição)
TONES: tuple[tuple[str, str], ...] = (
    ("Alta fantasia heroica", "Magia evidente, criaturas lendárias e heróis capazes de mudar o destino de reinos."),
    ("Baixa fantasia sombria", "A magia é rara e temida; a vida é dura e cada escolha cobra um preço."),
    ("Intriga palaciana", "Alianças, traições e segredos de família movem mais a história que as espadas."),
    ("Fronteira selvagem", "Povoados isolados à beira de terras indomadas, onde a lei do senhor mal chega."),
    ("Mistério sobrenatural", "Há algo de errado no mundo, e poucos ousam investigar o que se esconde nas sombras."),
    ("Decadência", "Um passado glorioso se desfaz aos poucos, entre ruínas, dívidas e memórias."),
    ("Esperança renascida", "Depois de tempos difíceis, o povo reconstrói e acredita em dias melhores."),
    ("Épico mítico", "Deuses, profecias e eras antigas ecoam nos acontecimentos do presente."),
    ("Aventura picaresca", "Estradas, tavernas e golpes de sorte; a sobrevivência depende de lábia e esperteza."),
    ("Guerra sem fim", "Exércitos marcham há anos, e quem vive no caminho deles aprende a escolher lados."),
)

# ------------------------------------------------------------------ calendário
CALENDAR_NAME_TEMPLATES: tuple[str, ...] = (
    "Calendário de {nome}", "Contagem de {nome}", "Roda das Estações", "Cômputo dos Templos",
    "Calendário dos Reis", "Contagem Antiga", "Calendário das Luas", "Cômputo de {nome}",
)
MONTH_NAMES: tuple[str, ...] = (
    "Alvorim", "Geadar", "Brotário", "Chuvém", "Florel", "Semeador", "Ventânio", "Solério",
    "Messidão", "Colheral", "Vindimar", "Folhoso", "Brumal", "Nevário", "Gelândio", "Cinzalho",
    "Lumeiro", "Trevoso", "Orvalim", "Estiado", "Ramalhete", "Fornalha", "Degelo", "Seareiro",
)
WEEKDAY_NAMES: tuple[str, ...] = (
    "Solário", "Lunário", "Ferrim", "Aguadia", "Ventelo", "Terrâneo", "Brasal", "Pedrim",
    "Ramagem", "Estrelim", "Cintila", "Sereno", "Lavradia", "Fecho",
)
YEAR_EPOCHS: tuple[str, ...] = (
    "da Fundação", "da Coroa", "após a Grande Cheia", "do Primeiro Juramento", "depois da Queda",
    "da Aliança", "do Sol Partido", "da Restauração", "do Exílio", "da Última Muralha",
)

# ------------------------------------------------------------------ religiões
RELIGION_NAME_TEMPLATES: tuple[str, ...] = (
    "Culto de {nome}", "Fé de {nome}", "Ordem de {nome}", "Círculo de {nome}",
    "Irmandade de {nome}", "Casa de {nome}", "Coro de {nome}", "Igreja de {nome}",
)
# (domínio, frase usada na descrição)
DOMAINS: tuple[tuple[str, str], ...] = (
    ("Colheita", "as colheitas e os celeiros"),
    ("Mar", "as marés, os naufrágios e os pescadores"),
    ("Morte", "a passagem dos mortos e o silêncio dos túmulos"),
    ("Fogo", "a chama do lar e as fogueiras de inverno"),
    ("Lua", "as noites, os sonhos e os segredos guardados"),
    ("Forja", "o ferro, o martelo e o trabalho das mãos"),
    ("Viagens", "as estradas, os viajantes e as encruzilhadas"),
    ("Justiça", "os juramentos, as leis e o castigo dos culpados"),
    ("Cura", "os doentes, as ervas e as mãos que tratam"),
    ("Guerra", "as batalhas, a coragem e os que tombam em combate"),
    ("Segredos", "o conhecimento escondido e as palavras não ditas"),
    ("Rios", "as águas correntes, as pontes e as travessias"),
    ("Inverno", "o frio, a resistência e a espera pela primavera"),
    ("Sol", "a luz do dia, a verdade e o calor dos campos"),
    ("Florestas", "as matas antigas, os caçadores e as feras"),
    ("Destino", "os presságios, a sorte e os fios de cada vida"),
)
RELIGION_PRACTICES: tuple[str, ...] = (
    "Seus fiéis acendem lamparinas a cada lua nova.",
    "Os sacerdotes jejuam no primeiro dia de cada estação.",
    "Os devotos deixam oferendas de pão e sal nos altares de pedra.",
    "Os templos são pequenos, simples e sempre abertos a quem pede abrigo.",
    "A fé é antiga e seus ritos são guardados em cantos passados de geração em geração.",
    "Os fiéis fazem peregrinação a um santuário distante ao menos uma vez na vida.",
    "Seus sacerdotes são conselheiros respeitados, mas desconfiam dos poderosos.",
    "É uma fé perseguida em algumas terras e celebrada em segredo.",
    "Os juramentos feitos diante de seus altares são considerados invioláveis.",
    "Os devotos marcam as portas das casas com um símbolo pintado em ocre.",
    "Seus monges copiam livros antigos e guardam bibliotecas escondidas.",
    "As grandes festas da fé reúnem feiras, cantos e disputas de força.",
)

# ------------------------------------------------------------------ lugares
# (tipo, aberturas). Cada abertura tem {nome}.
PLACE_TYPES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("vila", (
        "{nome} é uma vila de lavradores cercada por campos de trigo.",
        "{nome} é uma vila pequena, erguida em torno de um velho poço de pedra.",
        "{nome} é uma vila de casas de madeira à beira de uma estrada antiga.",
    )),
    ("cidade", (
        "{nome} é uma cidade murada, com mercados barulhentos e ruas estreitas.",
        "{nome} é uma cidade de torres e pontes, sede de um senhor poderoso.",
        "{nome} é uma cidade antiga, que cresceu além das próprias muralhas.",
    )),
    ("porto", (
        "{nome} é um porto movimentado, onde atracam navios de terras distantes.",
        "{nome} é um porto de pescadores, castigado pelos ventos do mar.",
        "{nome} é um porto fluvial, cheio de barcaças e armazéns.",
    )),
    ("fortaleza", (
        "{nome} é uma fortaleza de pedra que vigia a passagem entre as montanhas.",
        "{nome} é uma fortaleza de fronteira, mantida por uma guarnição cansada.",
        "{nome} é uma fortaleza antiga, reconstruída muitas vezes ao longo das guerras.",
    )),
    ("mosteiro", (
        "{nome} é um mosteiro isolado no alto de um penhasco.",
        "{nome} é um mosteiro de muros brancos, conhecido por seus pomares e sua biblioteca.",
        "{nome} é um mosteiro silencioso, onde os viajantes encontram pouso e perguntas.",
    )),
    ("floresta", (
        "{nome} é uma floresta densa, de árvores tão antigas que ninguém lembra de vê-las jovens.",
        "{nome} é uma floresta escura, onde os caçadores evitam entrar depois do anoitecer.",
        "{nome} é uma floresta de pinheiros, cortada por trilhas de lenhadores.",
    )),
    ("ruína", (
        "{nome} é uma ruína coberta de musgo, restos de um reino esquecido.",
        "{nome} é uma ruína de torres tombadas, evitada pelos moradores da região.",
        "{nome} é uma ruína meio enterrada, onde ainda se veem inscrições ilegíveis.",
    )),
    ("vale", (
        "{nome} é um vale fértil, protegido por colinas e cortado por um rio.",
        "{nome} é um vale estreito, coberto de névoa na maior parte do ano.",
        "{nome} é um vale de pastagens, onde pastores conduzem rebanhos entre as aldeias.",
    )),
    ("pântano", (
        "{nome} é um pântano de águas paradas e caminhos traiçoeiros.",
        "{nome} é um pântano envolto em neblina, onde vivem poucos e desconfiados.",
    )),
    ("montanha", (
        "{nome} é uma montanha de picos nevados, cheia de minas abandonadas.",
        "{nome} é uma montanha solitária, cercada de histórias e de desfiladeiros.",
    )),
    ("estalagem", (
        "{nome} é uma estalagem numa encruzilhada, ponto de parada de mercadores e mensageiros.",
        "{nome} é uma estalagem de pedra à beira da estrada, famosa pela cerveja e pelas brigas.",
    )),
    ("mina", (
        "{nome} é uma mina de ferro, cujas galerias descem cada vez mais fundo.",
        "{nome} é uma mina de prata, cobiçada por mais de um senhor.",
    )),
    ("aldeia", (
        "{nome} é uma aldeia de pescadores às margens de um lago gelado.",
        "{nome} é uma aldeia de pastores, espalhada pelas encostas.",
    )),
)
PLACE_DETAILS: tuple[str, ...] = (
    "Seus moradores desconfiam de forasteiros.",
    "Comenta-se que algo antigo dorme sob suas pedras.",
    "Um senhor distante cobra impostos cada vez mais altos.",
    "A colheita deste ano foi fraca, e o povo anda inquieto.",
    "Viajantes falam de luzes estranhas vistas à noite.",
    "Uma família rica controla quase todo o comércio local.",
    "Há pouco tempo, um crime sem solução abalou a região.",
    "O lugar vive de uma feira que atrai gente de longe.",
    "Os velhos contam lendas sobre quem o fundou.",
    "Um templo antigo é o coração da vida local.",
    "Bandidos rondam as estradas que levam até lá.",
    "A chegada do inverno sempre traz mais preocupação que alívio.",
    "Guardas de um senhor vizinho foram vistos por perto.",
    "Um ferreiro habilidoso atrai clientes de outras terras.",
)
