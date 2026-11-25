"""Guion de "La Incursión": cada viñeta = config de render + textos para la web."""
import json

R = json.load(open('reparto.json'))

# ---------- mundos ----------
DBZ = {"cielo": ["#ff7a1a", "#ffcf6b"], "suelo": "rocas", "colorSuelo": "#a8572a", "lineas": "#fff2c4"}
SANTUARIO = {"cielo": ["#0a0f3d", "#3b2a8a"], "suelo": "rocas", "colorSuelo": "#5c6380", "estrellas": True, "lineas": "#c7d4ff"}
BRITANNIA = {"cielo": ["#4fb6ff", "#dff5ff"], "suelo": "colinas", "colorSuelo": "#4f9a3a", "lineas": "#ffffff"}
TOKIO = {"cielo": ["#2b1a5c", "#ff8a6b"], "suelo": "ciudad", "colorSuelo": "#3a2f6b", "estrellas": 120, "horizonte": 0.82}
NINJA = {"cielo": ["#4a0812", "#ff5a3c"], "suelo": "rocas", "colorSuelo": "#3a2020", "sol": [0.5, 0.3, 0.2, "#ff2a2a"]}
NERIMA = {"cielo": ["#ffb3c7", "#fff4e0"], "suelo": "colinas", "colorSuelo": "#7fb069", "lineas": "#ffffff"}
ARCHIVO = {"cielo": ["#0d0b1a", "#2a2050"], "suelo": "estantes", "colorSuelo": "#c9a2ff", "horizonte": 0.95}
ARCHIVO_ROJO = {"cielo": ["#1a0508", "#5a1020"], "suelo": "estantes", "colorSuelo": "#ff6b81", "horizonte": 0.95}
DIMENSION = {"cielo": ["#14002a", "#5a0a6b"], "estrellas": True, "dimension": "#ff4fd8", "suelo": "plano", "colorSuelo": "#2a0a3a", "horizonte": 0.86}
NEXO = {"cielo": ["#05030f", "#1d1240"], "estrellas": True, "galaxia": [0.5, 0.4, "#b46bff", "#4aa8ff"], "suelo": "plano", "colorSuelo": "#1a1433", "horizonte": 0.86}
VERDE = {"cielo": ["#020a05", "#0d3a1c"], "estrellas": 80, "suelo": "plano", "colorSuelo": "#06140b", "horizonte": 0.9}


def m(base, **kw):
    d = dict(base); d.update(kw); return d


def fig(k, x, giro=0, alto=1.8, y=0, z=0, **kw):
    d = dict(R[k]); d.update(pos=[x, y, z], giro=giro, alto=alto); d.update(kw); d['_k'] = k
    return d


def ono(t, x, y, s=0.11, r=-0.06, stroke='#ff2a3d', fill='#ffffff'):
    return {"t": t, "x": x, "y": y, "s": s, "r": r, "stroke": stroke, "fill": fill}


def g(quien, texto, x, y, cola='abajo', tipo='normal'):
    return {"quien": quien, "texto": texto, "x": x, "y": y, "cola": cola, "tipo": tipo}


V = []


def vin(id, cap, figuras, fondo, narra='', globos=(), **kw):
    c = {"id": id, "cap": cap, "figuras": figuras, "fondo": fondo, "narra": narra, "globos": list(globos)}
    c.update(kw); V.append(c)


def uno(mu): return {"mundos": [mu]}
def dos(a, b, x=0.5): return {"mundos": [a, b], "grietas": [x]}


# =================== PRÓLOGO: EL ARCHIVO ===================
vin('p-1', 0, [fig('encapuchado', 0, 10, 2.1)], uno(ARCHIVO),
    'Más allá de todos los mundos hay un lugar que nadie ha visto: el Archivo. Cada figura que descansa en sus estantes guarda un universo entero.',
    [g('El Archivista', 'Demasiados mundos... Demasiado ruido.', 0.62, 0.18, 'izq')],
    auras=[{"pos": [0, 1.2, 0], "r": 0.12, "c": "#7a2cff"}], cam=[0, 1.1, 5.6], rim=[["#b46bff", [-3, 2, -3], 2.5], ["#7fb8ff", [3, 2, -3], 2.5]], ambienteI=1.6)
vin('p-2', 0, [fig('encapuchado', -1.3, 30, 2.0), fig('centinela', 1.3, -35, 2.0)],
    {"mundos": [ARCHIVO, DBZ], "grietas": [0.78]},
    'El Archivista no viene solo. Su guardián, el Centinela Dracónico, clava las garras en el primer estante y lo abre como una herida.',
    [g('El Archivista', 'En el Archivo solo cabe un universo. Que peleen. El que quede en pie, se queda.', 0.24, 0.12, 'abajo'),
     g('Centinela', '¡GRRRAAAH!', 0.7, 0.14, 'abajo', 'grito')],
    efectos=[{"tipo": "relampago", "de": [1.3, 1.2, 0.3], "a": [2.6, 2.4, 0], "color": "#b46bff"}],
    onomatopeyas=[ono('¡KRAK!', 0.84, 0.48, 0.1, 0.1, '#b46bff')])
vin('p-3', 0, [fig('encapuchado', 0, 0, 0.9, y=1.0, sinSombra=True)],
    {"mundos": [DBZ, SANTUARIO, BRITANNIA, TOKIO], "grietas": [0.27, 0.5, 0.74]},
    'Una grieta lleva a otra. Los mundos empiezan a tocarse. A eso lo llamarán, más tarde, las Incursiones.',
    [], auras=[{"pos": [0, 1.4, 0], "r": 0.1, "c": "#b46bff"}],
    onomatopeyas=[ono('LA INCURSIÓN', 0.5, 0.9, 0.12, -0.03, '#b46bff', '#FFE45C')])

# =================== 1 · LA PRIMERA GRIETA ===================
vin('1-1', 1, [fig('goku', -0.6, 25, 1.9)], {"mundos": [DBZ, SANTUARIO], "grietas": [0.82]},
    'Un día cualquiera, en un mundo de cielos naranjas, Goku entrenaba solo... hasta que el cielo se partió.',
    [g('Goku', '¿Eh? ¿El cielo... se rompió? ¡Siento un ki enorme del otro lado!', 0.3, 0.12, 'abajo')],
    auras=[{"pos": [-0.6, 1, 0], "r": 0.12, "c": "#ffd400"}])
vin('1-2', 1, [fig('seiya', 0.6, -25, 1.9)], {"mundos": [DBZ, SANTUARIO], "grietas": [0.18]},
    'Al mismo tiempo, en el Santuario, un caballero de bronce sintió el mismo temblor.',
    [g('Seiya', 'Ese cosmos no es de este mundo... ¿Un enemigo de Athena?', 0.7, 0.12, 'abajo')],
    auras=[{"pos": [0.6, 1, 0], "r": 0.12, "c": "#4aa8ff"}])
vin('1-3', 1, [fig('goku', -1.45, 45, 1.9), fig('seiya', 1.45, -45, 1.9)], dos(DBZ, SANTUARIO),
    'Los dos mundos quedaron frente a frente. Y cada uno pensó que el otro era el invasor.',
    [g('Goku', '¡Oye! ¿Tú rompiste mi cielo?', 0.22, 0.1, 'abajo'),
     g('Seiya', '¡No te dejaré llegar al Santuario!', 0.78, 0.1, 'abajo')],
    auras=[{"pos": [-1.45, 1, 0], "r": 0.16, "c": "#ffd400"}, {"pos": [1.45, 1, 0], "r": 0.16, "c": "#4aa8ff"}],
    onomatopeyas=[ono('ZAAAN', 0.5, 0.9, 0.09, 0.03, '#b46bff')])
vin('1-4', 1, [fig('goku', -1.45, 45, 1.9), fig('seiya', 1.45, -45, 1.9)], dos(DBZ, SANTUARIO),
    '',
    [g('Goku', '¡KA-ME-HA-ME-HAAA!', 0.17, 0.12, 'abajo', 'grito'),
     g('Seiya', '¡METEOROS DE PEGASO!', 0.83, 0.12, 'abajo', 'grito')],
    rim=[["#ffd84a", [-4, 2, -2], 1.6], ["#7fb8ff", [4, 2, -2], 1.6]],
    auras=[{"pos": [-1.45, 1, 0], "r": 0.17, "c": "#ffd400"}, {"pos": [1.45, 1, 0], "r": 0.17, "c": "#4aa8ff"}],
    efectos=[{"de": [-0.75, 0.7, 0.35], "a": [0, 0.8, 0.35], "color": "#38b6ff", "grosor": 60},
             {"tipo": "meteoros", "de": [0.95, 0.72, 0.35], "a": [0, 0.8, 0.35], "color": "#ffcf3a"}],
    choque={"pos": [0, 0.8, 0.35], "c": "#c58cff"}, onomatopeyas=[ono('¡ZRAAAK!', 0.5, 0.17, 0.11, -0.08, '#b46bff')])
vin('1-5', 1, [fig('goku-batalla', -1.3, 40, 1.8), fig('seiya', 1.4, -40, 1.8),
               fig('encapuchado', 0.05, 0, 0.55, y=1.75, z=-2, sinSombra=True)], dos(DBZ, SANTUARIO),
    'Cuando el humo se fue, los dos seguían de pie. Y arriba, en la grieta, alguien los miraba.',
    [g('Goku', 'Je, je... ¡Eres muy fuerte! ¿Peleamos otra vez?', 0.2, 0.1, 'abajo'),
     g('Seiya', 'Espera... ese tipo de la capa. Él abrió la grieta.', 0.8, 0.1, 'abajo')],
    auras=[{"pos": [0.05, 2.1, -2], "r": 0.07, "c": "#b46bff"}])

# =================== 2 · CHOQUE DE ORGULLOS ===================
vin('2-1', 2, [fig('vegeta', -1.45, 45, 1.9), fig('ikki', 1.45, -45, 1.9)], dos(m(DBZ, cielo=["#3b1a5c", "#ff7a1a"]), m(SANTUARIO, cielo=["#3a0a05", "#ff6a1a"])),
    'Si dos mundos chocan, también chocan sus orgullos. El príncipe de los saiyajin encontró al caballero que nunca se arrodilla.',
    [g('Vegeta', '¡Soy el príncipe de los saiyajin! ¡Nadie me mira desde arriba!', 0.2, 0.1, 'abajo'),
     g('Ikki', 'El fénix renace de sus cenizas. Tú no.', 0.8, 0.1, 'abajo')],
    auras=[{"pos": [-1.45, 1, 0], "r": 0.17, "c": "#9b4dff"}, {"pos": [1.45, 1, 0], "r": 0.17, "c": "#ff6a1a"}],
    efectos=[{"de": [-0.8, 0.75, 0.35], "a": [0, 0.85, 0.35], "color": "#b46bff", "grosor": 55},
             {"de": [0.8, 0.75, 0.35], "a": [0, 0.85, 0.35], "color": "#ff6a1a", "grosor": 55}],
    choque={"pos": [0, 0.85, 0.35], "c": "#ff4fd8"}, onomatopeyas=[ono('¡GALICK HO!', 0.22, 0.86, 0.08, -0.05, '#b46bff'), ono('¡HŌ YOKU TEN SHŌ!', 0.78, 0.86, 0.07, 0.05, '#ff6a1a')])
vin('2-2', 2, [fig('piccolo', -1.45, 45, 1.9), fig('shiryu', 1.45, -45, 1.9)], dos(m(DBZ, cielo=["#2f6b3a", "#cfe9a6"], colorSuelo="#6b5a3a"), SANTUARIO),
    'Del otro lado del mundo, dos guerreros tranquilos se miraban sin decir nada. Hasta que lo dijeron todo.',
    [g('Piccolo', 'Tu técnica es honesta. La mía no tanto. ¡Makankosappo!', 0.2, 0.1, 'abajo'),
     g('Shiryu', '¡Dragón Naciente!', 0.8, 0.1, 'abajo', 'grito')],
    efectos=[{"tipo": "relampago", "de": [-0.8, 0.9, 0.35], "a": [0, 0.95, 0.35], "color": "#ffe14a"},
             {"de": [-0.8, 0.9, 0.35], "a": [0, 0.95, 0.35], "color": "#ffe14a", "grosor": 18},
             {"de": [0.8, 0.8, 0.35], "a": [0, 0.95, 0.35], "color": "#36e0a0", "grosor": 70}],
    choque={"pos": [0, 0.95, 0.35], "c": "#36e0a0", "r": 0.09}, onomatopeyas=[ono('¡SHIIING!', 0.5, 0.86, 0.09, 0.04, '#36e0a0')])
vin('2-3', 2, [fig('pchan', -1.7, 70, 0.95), fig('krilin', 0.2, -60, 1.5), fig('yajirobe', 1.6, -60, 1.55)], uno(m(DBZ, lineasX=0.1)),
    'Mientras tanto, a otro mundo le tocó una incursión más pequeña. Mucho más pequeña.',
    [g('Krilin', '¡Ese cerdito se comió las semillas del ermitaño!', 0.52, 0.12, 'abajo'),
     g('Yajirobe', '¡Eran MIS semillas! ¡Atrápalo!', 0.83, 0.1, 'abajo'),
     g('P-chan', '¡Bwi! ¡Bwiii!', 0.15, 0.35, 'abajo', 'grito')],
    lineas=[0.12, 0.62, "#ffffff", 0.4], onomatopeyas=[ono('¡ZOOM!', 0.3, 0.88, 0.09, -0.08, '#ff2a3d')])
vin('2-4', 2, [fig('karin', -0.9, 30, 1.7), fig('octavio', 1.1, -30, 1.75)], uno(m(DBZ, cielo=["#78c8ff", "#e6f6ff"], suelo="plano", colorSuelo="#c9a46b", horizonte=0.8)),
    'En lo alto de su torre, el Maestro Karin miraba la persecución. Octavio también, aunque él estaba un poco perdido.',
    [g('Maestro Karin', 'Las semillas no importan. Esas grietas, en cambio... se están multiplicando.', 0.26, 0.1, 'abajo'),
     g('Octavio', '¿Alguien sabe en qué universo estoy?', 0.76, 0.12, 'abajo')])
vin('2-5', 2, [fig('trunks', -1.5, 45, 1.9), fig('hyoga', 1.0, -40, 1.8), fig('shun', 2.2, -50, 1.8)], dos(m(DBZ, cielo=["#3a4a6b", "#9fb8d9"], colorSuelo="#5a5a66"), m(SANTUARIO, cielo=["#bfe9ff", "#ffffff"], colorSuelo="#d6ecff", estrellas=False)),
    'Trunks había visto un futuro destruido. Por eso, cuando la grieta se abrió, no esperó a preguntar.',
    [g('Trunks', 'No voy a dejar que otro futuro se pierda.', 0.2, 0.1, 'abajo'),
     g('Hyoga', '¡Polvo de Diamantes!', 0.63, 0.1, 'abajo', 'grito'),
     g('Shun', '¡Cadena Nebular, protege!', 0.88, 0.16, 'abajo')],
    efectos=[{"tipo": "rafaga", "de": [0.6, 0.8, 0.4], "a": [-0.8, 0.9, 0.4], "color": "#9fe8ff", "grosor": 50, "n": 14},
             {"tipo": "relampago", "de": [1.8, 0.7, 0.4], "a": [-0.6, 1.2, 0.4], "color": "#ff7ad9"}],
    onomatopeyas=[ono('¡KSHHH!', 0.45, 0.86, 0.09, 0.05, '#9fe8ff')])

# =================== 3 · EL REINO DE LOS PECADOS ===================
vin('3-1', 3, [fig('broly', 0, 0, 2.1)], uno(m(BRITANNIA, lineasX=0.5)),
    'Al reino de Britannia le cayó del cielo un saiyajin legendario. Literalmente.',
    [g('Broly', '¡KAKAROTTOOO!', 0.5, 0.08, 'abajo', 'grito')],
    auras=[{"pos": [0, 1.1, 0], "r": 0.22, "c": "#3dff6b"}], lineas=[0.5, 0.55, "#ffffff", 0.45],
    onomatopeyas=[ono('¡DOOOM!', 0.2, 0.8, 0.12, -0.1, '#3dff6b'), ono('¡CRASH!', 0.82, 0.75, 0.1, 0.08, '#3dff6b')])
vin('3-2', 3, [fig('broly', 1.4, -40, 2.1), fig('diane', -0.5, 40, 1.9), fig('king', -2.2, 45, 1.6, y=0.4, z=-0.4)], uno(BRITANNIA),
    'Los Siete Pecados Capitales no preguntaron de dónde venía. Solo vieron a alguien rompiendo su reino.',
    [g('Diane', '¡Oye, grandulón! ¡Esas son mis flores!', 0.38, 0.1, 'abajo'),
     g('King', 'Diane, cuidado. Ese poder no tiene fondo.', 0.12, 0.14, 'abajo'),
     g('Broly', 'Grrr...', 0.78, 0.12, 'abajo')],
    auras=[{"pos": [1.4, 1.1, 0], "r": 0.2, "c": "#3dff6b"}])
vin('3-3', 3, [fig('meliodas', -1.45, 45, 1.8), fig('broly', 1.45, -45, 2.1)], uno(m(BRITANNIA, cielo=["#1a3a6b", "#9fd8ff"])),
    'Meliodas sonrió. Contra un golpe tan grande, solo había una respuesta.',
    [g('Meliodas', 'Gracias por el ataque. ¡Te lo devuelvo! ¡Full Counter!', 0.2, 0.1, 'abajo', 'grito')],
    auras=[{"pos": [1.45, 1.1, 0], "r": 0.2, "c": "#3dff6b"}],
    efectos=[{"de": [1.0, 0.9, 0.35], "a": [-0.7, 0.85, 0.35], "color": "#3dff6b", "grosor": 85},
             {"de": [-0.7, 0.85, 0.35], "a": [1.0, 0.9, 0.35], "color": "#1a1a2a", "grosor": 30}],
    choque={"pos": [-0.75, 0.85, 0.35], "c": "#3dff6b", "r": 0.08}, onomatopeyas=[ono('¡FULL COUNTER!', 0.55, 0.86, 0.08, -0.04, '#3dff6b')])
vin('3-4', 3, [fig('escanor', -1.3, 40, 1.9), fig('broly-verde', 1.4, -40, 2.1)], uno(m(BRITANNIA, cielo=["#ff9a1a", "#fff2b0"], sol=[0.2, 0.15, 0.3, "#ffb81a"])),
    'Al mediodía, el más fuerte de los pecados salió a escena. Y no estaba de humor para compartir el sol.',
    [g('Escanor', '¿Quién decidió que tú eras el más fuerte? Yo.', 0.24, 0.12, 'abajo'),
     g('Broly', '¡Más! ¡Quiero MÁS!', 0.8, 0.1, 'abajo', 'grito')],
    auras=[{"pos": [-1.3, 1, 0], "r": 0.2, "c": "#ffb81a"}, {"pos": [1.4, 1.1, 0], "r": 0.2, "c": "#3dff6b"}],
    efectos=[{"tipo": "esfera", "de": [-0.2, 1.9, 0], "color": "#ffb81a", "grosor": 260}],
    onomatopeyas=[ono('¡CRUEL SUN!', 0.5, 0.86, 0.09, 0.03, '#ffb81a')])
vin('3-5', 3, [fig('ranma', -2.0, 30, 1.7), fig('merlin', -0.65, 20, 1.75), fig('ban', 0.65, -20, 1.8), fig('king', 2.0, -30, 1.7)], uno(m(NERIMA)),
    'Broly cayó dormido, rendido. Y en el claro apareció alguien que tampoco era de ese mundo.',
    [g('Ranma', 'Me caí de una grieta en Nerima. ¿Alguien vio a un cerdito negro?', 0.14, 0.1, 'abajo'),
     g('Merlín', 'Las grietas tienen un patrón. Alguien las está abriendo a propósito.', 0.42, 0.14, 'abajo'),
     g('Ban', 'Entonces hay que encontrarlo y darle su merecido.', 0.66, 0.1, 'abajo')])

# =================== 4 · EL HILO ROJO ===================
vin('4-1', 4, [fig('mitsuha', -1.0, 25, 1.8), fig('taki', 1.0, -25, 1.8)], uno(m(TOKIO, cometa=[0.72, 0.18, 2.6, "#9fe8ff"])),
    'Tokio, al atardecer. Un cometa cruzó el cielo. Pero ese cometa no venía del espacio: venía de otro universo.',
    [g('Mitsuha', 'Ese cometa... ya lo había visto en un sueño.', 0.3, 0.12, 'abajo'),
     g('Taki', 'Yo también. Estabas tú.', 0.7, 0.12, 'abajo')])
vin('4-2', 4, [fig('mitsuha', 0, 15, 1.7)], {"mundos": [DBZ, TOKIO, BRITANNIA], "grietas": [0.3, 0.7]},
    'El cometa se partió en grietas. Por cada una se veía un mundo distinto: un cielo naranja, un reino verde, un santuario de estrellas.',
    [g('Mitsuha', 'Los mundos se están rompiendo... pero también se están tocando.', 0.5, 0.1, 'abajo')])
vin('4-3', 4, [fig('mitsuha', -1.4, 35, 1.8), fig('taki', 1.4, -35, 1.8)], dos(TOKIO, m(TOKIO, cielo=["#ff8a6b", "#ffd9a8"], colorSuelo="#6b3a4a")),
    'Un cordón trenzado unía sus muñecas. El hilo rojo no se rompía con la grieta: la atravesaba.',
    [g('Taki', '¡El hilo! ¡Cruza de un mundo al otro!', 0.8, 0.12, 'abajo'),
     g('Mitsuha', 'Entonces el hilo no rompe universos... ¡los cose!', 0.2, 0.12, 'abajo')],
    efectos=[{"tipo": "hilo", "de": [-1.15, 0.55, 0.4], "a": [1.15, 0.55, 0.4], "color": "#ff2a3d", "grosor": 110, "curva": -0.04}])
vin('4-4', 4, [fig('athena', 0, 0, 2.0), fig('mitsuha', -1.6, 30, 1.6), fig('taki', 1.6, -30, 1.6)], uno(m(SANTUARIO, galaxia=[0.5, 0.35, "#ffd27a", "#ff2a3d"])),
    'Por la grieta llegó Athena. Ella también había sentido el hilo.',
    [g('Athena', 'Con mi cosmos y su hilo podemos cerrar las Incursiones. Pero necesitamos tiempo.', 0.5, 0.06, 'abajo'),
     g('Taki', '¿Cuánto tiempo?', 0.82, 0.18, 'abajo')],
    auras=[{"pos": [0, 1.2, 0], "r": 0.2, "c": "#ffd27a"}],
    efectos=[{"tipo": "hilo", "de": [-1.4, 0.5, 0.4], "a": [1.4, 0.5, 0.4], "color": "#ff2a3d", "grosor": 100, "curva": -0.05}])

# =================== 5 · GUERRA TOTAL ===================
vin('5-1', 5, [fig('black', 0, 0, 2.0, corte=False), fig('encapuchado', -1.7, 30, 2.0), fig('centinela', 1.8, -30, 2.0)], uno(ARCHIVO_ROJO),
    'En el Archivo, el Archivista ganó un aliado. Uno que también odiaba que existieran tantos mundos.',
    [g('Guerrero Rosé', 'Un solo universo, sin errores. Qué idea tan hermosa.', 0.5, 0.06, 'abajo'),
     g('El Archivista', 'Entonces ayúdame a apagar los demás.', 0.17, 0.14, 'abajo')],
    auras=[{"pos": [0, 1.1, 0], "r": 0.2, "c": "#ff4fd8"}])
vin('5-2', 5, [fig('saga', 0, 0, 2.0), fig('aioria', -1.9, 35, 1.8)], uno(DIMENSION),
    'Saga de Géminis, engañado por el Archivista, abrió la Otra Dimensión. Ahora no había mundos separados: había un solo campo de batalla.',
    [g('Saga', '¡OTRA DIMENSIÓN! ¡Que todos los mundos caigan en el mismo lugar!', 0.55, 0.06, 'abajo', 'grito'),
     g('Aioria', '¡Saga, despierta! ¡Te están usando!', 0.17, 0.14, 'abajo')],
    auras=[{"pos": [0, 1.1, 0], "r": 0.24, "c": "#ff4fd8"}],
    onomatopeyas=[ono('¡VWOOOM!', 0.8, 0.85, 0.1, 0.06, '#ff4fd8')])
vin('5-3', 5, [fig('itachi', -1.9, 35, 2.0), fig('madara', -0.7, 25, 2.05), fig('goku4', 0.75, -25, 1.9), fig('vegeta', 1.9, -35, 1.8)], dos(NINJA, m(DBZ, cielo=["#5a0a0a", "#ff7a1a"])),
    'Del mundo de la luna roja salieron dos ninjas legendarios. Sus ojos ya habían visto el fin de muchos mundos.',
    [g('Madara', '¿Saiyajin? Bailen para mí.', 0.36, 0.06, 'abajo'),
     g('Goku', 'Vegeta, este es serio.', 0.66, 0.1, 'abajo'),
     g('Vegeta', '¡Hmph! Por una vez, peleamos juntos.', 0.88, 0.16, 'abajo')],
    efectos=[{"tipo": "rafaga", "de": [-1.2, 0.45, 0.5], "a": [0.3, 0.5, 0.5], "color": "#ff3a2a", "grosor": 55, "n": 10}],
    onomatopeyas=[ono('¡AMATERASU!', 0.22, 0.88, 0.08, -0.05, '#ff3a2a')])
vin('5-4', 5, [fig('seiya', -2.25, 40, 1.45), fig('goku', -1.3, 30, 1.5), fig('meliodas', -0.4, 20, 1.4), fig('broly', 0.5, -10, 1.6),
               fig('ikki', 1.35, -25, 1.45), fig('trunks', 2.2, -35, 1.5)],
    {"mundos": [SANTUARIO, DBZ, BRITANNIA, NINJA], "grietas": [0.25, 0.5, 0.75]},
    'Y entonces, todos contra todos. Nadie sabía quién era el enemigo. Solo sabían que su mundo estaba en peligro.',
    [], cam=[0, 0.9, 6.2],
    efectos=[{"tipo": "rafaga", "de": [-2.3, 1.95, 0.5], "a": [2.3, 2.0, 0.5], "color": "#ffd400", "grosor": 45, "n": 16},
             {"tipo": "relampago", "de": [2.6, 2.3, 0.5], "a": [-2.6, 1.8, 0.5], "color": "#b46bff"},
             {"tipo": "relampago", "de": [-2.6, 2.4, 0.5], "a": [2.6, 1.85, 0.5], "color": "#3dff6b"}],
    onomatopeyas=[ono('¡GUERRA TOTAL!', 0.5, 0.16, 0.13, -0.05, '#ff2a3d', '#FFE45C')])
vin('5-5', 5, [fig('black', -1.45, 45, 1.9, corte=False), fig('goku4', 1.45, -45, 1.9)], dos(ARCHIVO_ROJO, DBZ),
    'Rosa contra rojo. El aliado del Archivista encontró por fin al rival que buscaba.',
    [g('Guerrero Rosé', 'Tu cuerpo, tu fuerza... en otro mundo serían míos.', 0.2, 0.1, 'abajo'),
     g('Goku', '¡No hay otro mundo para ti! ¡Kamehameha x10!', 0.8, 0.1, 'abajo', 'grito')],
    auras=[{"pos": [-1.45, 1, 0], "r": 0.17, "c": "#ff4fd8"}, {"pos": [1.45, 1, 0], "r": 0.17, "c": "#ff2a2a"}],
    efectos=[{"de": [-0.8, 0.9, 0.35], "a": [0, 0.9, 0.35], "color": "#ff4fd8", "grosor": 60}, {"de": [0.8, 0.85, 0.35], "a": [0, 0.9, 0.35], "color": "#ff2a2a", "grosor": 75}],
    choque={"pos": [0, 0.9, 0.35], "c": "#ff4f8a"})
vin('5-6', 5, [fig('centinela', -1.4, 40, 2.1), fig('broly-verde', 1.4, -40, 2.1), fig('diane', 2.6, -50, 1.6)], uno(m(BRITANNIA, cielo=["#0d3a1c", "#7fd99a"])),
    'Monstruo contra monstruo. Broly, ya despierto, encontró por fin a alguien de su tamaño.',
    [g('Diane', '¡Ahora sí, grandulón! ¡Ese lagarto es tuyo!', 0.85, 0.12, 'abajo'),
     g('Centinela', '¡GRRRAAAH!', 0.2, 0.1, 'abajo', 'grito')],
    auras=[{"pos": [1.4, 1.1, 0], "r": 0.2, "c": "#3dff6b"}, {"pos": [-1.4, 1.1, 0], "r": 0.18, "c": "#ff8a1a"}],
    choque={"pos": [0, 1.0, 0.35], "c": "#3dff6b", "r": 0.08}, onomatopeyas=[ono('¡BAM!', 0.5, 0.86, 0.12, 0.06, '#3dff6b')])

# =================== 6 · FUSIÓN MULTIVERSAL ===================
vin('6-1', 6, [fig('gogeta4', -1.45, 45, 1.9), fig('gogetablue', 1.45, -45, 2.0)], dos(m(DBZ, cielo=["#5a0a0a", "#ff5a2a"]), m(NEXO, galaxia=[0.75, 0.4, "#4aa8ff", "#9fe8ff"])),
    'De dos líneas de tiempo distintas llegaron dos fusiones. El mismo guerrero, dos veces.',
    [g('Gogeta SSJ4', '¿Tú también eres yo?', 0.2, 0.1, 'abajo'),
     g('Gogeta Blue', 'Lo soy. Y si peleamos, el multiverso no aguanta.', 0.8, 0.1, 'abajo')],
    auras=[{"pos": [-1.45, 1, 0], "r": 0.17, "c": "#ff2a2a"}, {"pos": [1.45, 1, 0], "r": 0.17, "c": "#38b6ff"}])
vin('6-2', 6, [fig('gogeta4', -1.0, 15, 1.9), fig('gogetablue', 1.0, -15, 2.0)], {"mundos": [DBZ, SANTUARIO, BRITANNIA, TOKIO], "grietas": [0.25, 0.5, 0.75]},
    'En vez de pelear, se dieron la espalda... y sostuvieron las grietas con las manos.',
    [g('Gogeta SSJ4', '¡Athena, ahora!', 0.25, 0.08, 'abajo', 'grito'),
     g('Gogeta Blue', '¡No podremos sostenerlas mucho!', 0.75, 0.08, 'abajo')],
    auras=[{"pos": [-1, 1, 0], "r": 0.2, "c": "#ff2a2a"}, {"pos": [1, 1, 0], "r": 0.2, "c": "#38b6ff"}],
    efectos=[{"de": [-1.1, 1.3, 0.3], "a": [-2.2, 3.2, 0], "color": "#ff2a2a", "grosor": 50}, {"de": [1.1, 1.3, 0.3], "a": [2.2, 3.2, 0], "color": "#38b6ff", "grosor": 50}],
    onomatopeyas=[ono('¡HNNNGH!', 0.5, 0.88, 0.1, 0.02, '#b46bff')])
vin('6-3', 6, [fig('athena', 0, 0, 1.9), fig('mitsuha', -1.3, 30, 1.6), fig('taki', 1.3, -30, 1.6),
               fig('goku', -2.4, 30, 1.4), fig('seiya', 2.4, -30, 1.4)], uno(NEXO),
    'Athena elevó su cosmos. Mitsuha y Taki tensaron el hilo. Y todos, de todos los mundos, prestaron su energía.',
    [g('Athena', 'Que el hilo una lo que la guerra separó.', 0.5, 0.06, 'abajo'),
     g('Goku', '¡Tomen mi energía!', 0.1, 0.24, 'abajo'), g('Seiya', '¡Y la mía!', 0.9, 0.24, 'abajo')],
    auras=[{"pos": [0, 1.2, 0], "r": 0.26, "c": "#ffd27a"}],
    efectos=[{"tipo": "hilo", "de": [-1.15, 0.5, 0.4], "a": [0, 2.4, 0], "color": "#ff2a3d", "grosor": 80, "curva": 0.05},
             {"tipo": "hilo", "de": [1.15, 0.5, 0.4], "a": [0, 2.4, 0], "color": "#ff2a3d", "grosor": 80, "curva": 0.05},
             {"tipo": "esfera", "de": [0, 2.4, 0], "color": "#ffd27a", "grosor": 200}])
vin('6-4', 6, [fig('encapuchado', 0, 15, 2.0, blanco=True)], uno(ARCHIVO),
    'Las grietas se cerraron una a una. Y el Archivista quedó atrapado en lo que más temía: una figura sin pintar, sin mundo propio.',
    [g('El Archivista', 'No... ¡NO! ¡Yo era el Archivo!', 0.62, 0.14, 'izq', 'grito')],
    onomatopeyas=[ono('¡FSSSHH!', 0.2, 0.82, 0.1, -0.06, '#c9a2ff')])

# =================== EPÍLOGO ===================
vin('e-1', 7, [fig('goku', -2.5, 20, 1.2), fig('seiya', -1.75, 15, 1.2), fig('meliodas', -1.0, 10, 1.15), fig('mitsuha', -0.33, 5, 1.15),
               fig('taki', 0.33, -5, 1.15), fig('vegeta', 1.0, -10, 1.15), fig('broly', 1.75, -15, 1.3), fig('pchan', 2.5, -20, 0.7)],
    uno(m(ARCHIVO, cielo=["#2a2050", "#6b4fb0"])),
    'Desde entonces, todos viven en el mismo estante. Cada uno en su mundo. Todos en la misma Biblioteca.',
    [g('Goku', '¿Y si un día peleamos de nuevo?', 0.13, 0.32, 'abajo'), g('Seiya', 'Ya sabes dónde encontrarme.', 0.3, 0.24, 'abajo')],
    cam=[0, 0.9, 6.3])
vin('e-2', 7, [fig('tirano', 0, 0, 2.3, emisivo="#1aff6b", emisivoI=0.08)], uno(VERDE),
    'Pero en un estante olvidado, al fondo del Archivo, un trono esmeralda se encendió.',
    [g('???', 'Así que el Archivista cayó... Bien. Ahora el Archivo es mío.', 0.68, 0.12, 'izq')],
    auras=[{"pos": [0, 1.3, 0], "r": 0.22, "c": "#1aff6b"}], luzI=2.2, ambienteI=1.1,
    onomatopeyas=[ono('CONTINUARÁ...', 0.5, 0.92, 0.09, 0, '#1aff6b', '#FFE45C')])

# =================== VIDA EN EL MULTIVERSO (para las historias) ===================
vin('v-1', 8, [fig('goku-nino', -1.2, 40, 1.7), fig('krilin', 1.2, -40, 1.6)], uno(m(DBZ, cielo=["#7fd0ff", "#fff2c4"], colorSuelo="#c98a4a")),
    'Goku y Krilin, entrenando como en los viejos tiempos.',
    [g('Krilin', '¡Esta vez no me ganas!', 0.78, 0.12, 'abajo'), g('Goku', '¡Eso dijiste ayer!', 0.22, 0.12, 'abajo')],
    efectos=[{"tipo": "rafaga", "de": [-0.6, 0.9, 0.3], "a": [0.6, 0.9, 0.3], "color": "#ffd400", "grosor": 40, "n": 6}],
    onomatopeyas=[ono('¡PAM! ¡PAM!', 0.5, 0.86, 0.08, 0.04)])
vin('v-2', 8, [fig('yajirobe', -1.1, 30, 1.6), fig('karin', 0.2, -10, 1.6), fig('pchan', 1.5, -40, 0.85)], uno(m(NERIMA, cielo=["#a8e0ff", "#fff8e8"])),
    'Picnic de tregua: Yajirobe, el Maestro Karin y P-chan reparten lo que quedó de las semillas.',
    [g('Yajirobe', 'Una para ti, dos para mí...', 0.2, 0.12, 'abajo'), g('P-chan', '¡Bwi!', 0.78, 0.4, 'abajo')])
vin('v-3', 8, [fig('piccolo', -1.0, 30, 1.8, y=0.35), fig('goku-nino', 1.2, -30, 1.5)], uno(m(DBZ, cielo=["#2f6b3a", "#cfe9a6"], colorSuelo="#6b5a3a")),
    'Piccolo medita flotando. Su alumno, como siempre, no se queda quieto.',
    [g('Piccolo', 'Concéntrate. El ki se siente, no se grita.', 0.25, 0.08, 'abajo')])
vin('v-4', 8, [fig('trunks', -1.2, 35, 1.8), fig('vegeta', 1.2, -35, 1.8)], uno(ARCHIVO),
    'Padre e hijo entrenan entre los estantes del Archivo. Vegeta nunca lo dirá, pero está orgulloso.',
    [g('Vegeta', 'Otra vez. Y esta vez, en serio.', 0.78, 0.12, 'abajo'), g('Trunks', '¡Sí, papá!', 0.22, 0.14, 'abajo')],
    efectos=[{"tipo": "rafaga", "de": [-0.6, 1.0, 0.3], "a": [0.6, 1.0, 0.3], "color": "#b46bff", "grosor": 40, "n": 5}])
vin('v-5', 8, [fig('broly', -1.0, 30, 2.0), fig('diane', 1.1, -30, 1.8)], uno(BRITANNIA),
    'Después de la guerra, Broly encontró algo que nunca tuvo: una amiga de su tamaño.',
    [g('Diane', '¿Te gustan las flores, Broly?', 0.78, 0.12, 'abajo'), g('Broly', '...Sí.', 0.22, 0.12, 'abajo')])
vin('v-6', 8, [fig('octavio', -1.0, 30, 1.7), fig('ranma', 1.1, -30, 1.7)], uno(TOKIO),
    'Octavio y Ranma, perdidos en Tokio, buscan el camino de vuelta a sus mundos.',
    [g('Octavio', '¿Seguro que es por aquí?', 0.24, 0.14, 'abajo'), g('Ranma', 'Nunca estoy seguro de nada.', 0.78, 0.14, 'abajo')])
vin('v-7', 8, [fig('gogeta4', -1.2, 35, 1.9), fig('goku4', 1.2, -35, 1.85)], uno(m(DBZ, cielo=["#5a0a0a", "#ff7a1a"])),
    'Dos fases 4 frente a frente: el fusionado y el original. Solo un entrenamiento amistoso... o eso dicen.',
    [g('Gogeta SSJ4', 'Te ves más bajito de lo que recordaba.', 0.22, 0.1, 'abajo'), g('Goku', '¡Oye!', 0.78, 0.14, 'abajo')],
    auras=[{"pos": [-1.2, 1, 0], "r": 0.16, "c": "#ff2a2a"}, {"pos": [1.2, 1, 0], "r": 0.16, "c": "#ff2a2a"}])

json.dump(V, open('vinetas.json', 'w'), ensure_ascii=False, indent=1)
print(len(V), 'viñetas')

# Textos para la web (src/data/ova.json): lo que no va pegado en la imagen.
web = [{"id": v["id"], "cap": v["cap"], "narra": v["narra"], "globos": v["globos"],
        "reparto": sorted({f["_k"] for f in v["figuras"]})} for v in V]
json.dump(web, open('../../src/data/ova.json', 'w'), ensure_ascii=False, indent=1)
