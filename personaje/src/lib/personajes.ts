/**
 * Lo único que cambia de una página a otra: quién es, qué cuenta y de qué
 * color brilla. La estructura, los efectos y la cámara son los del Gogeta SSJ4.
 *
 * Los siete capítulos de la plantilla se reparten así:
 *   1 · portada        → titulo, jp, kicker, intro
 *   2 · 01 Historia    → historia
 *   3 · 02 (diseño)    → aspecto (con su etiqueta)
 *   4 · 03 Pelea       → pelea (cuatro rasgos en rejilla)
 *   5 · 04 La batalla  → batalla
 *   6 · 05 Técnicas    → tecnicas
 *   7 · 06 cierre      → el mismo de la plantilla, más el pedido de la figura
 *
 * Los nombres son los del doblaje latino (Krilin, Octavio, Maestro Karin).
 * Las figuras de cada personaje se asignan en `src/lib/historias.ts`.
 */
export type Capitulo = {
  /** Una o dos líneas: el titular animado letra a letra. */
  titulo: string[]
  parrafos: string[]
  /** La línea que se resalta en amarillo al final del capítulo. */
  remate?: string
}

export type Personaje = {
  /** Las dos palabras del titular de portada; la segunda va en rojo. */
  titulo: [string, string]
  /** El nombre en japonés, como en la portada de un tomo. */
  jp: string
  kicker: string
  intro: string
  /** Lo que dice la pantalla de carga. */
  cargando: string
  /** Color del borde del aura de ki. */
  aura: string
  /** Color del pelo que se enciende con el bloom. Sin él, solo brilla el aura. */
  brillo?: string
  historia: Capitulo
  aspecto: Capitulo & { etiqueta: string }
  pelea: { titulo: string[]; rasgos: [string, string][]; nota: string }
  batalla: Capitulo
  tecnicas: { nombre: string; detalle: string }[]
  tecnicasNota?: string
}

const GIRALO = 'Y hay un detalle que solo se ve girándolo. Arrástralo.'

export const PERSONAJES: Record<string, Personaje> = {
  // ── Goku Super Saiyan ──────────────────────────────────────────────────
  'goku-ssj': {
    titulo: ['Goku', 'SSJ'],
    jp: '孫悟空',
    kicker: 'Saiyan criado en la Tierra · Super Saiyan',
    intro:
      'Llegó a la Tierra como Kakarotto, un bebé saiyan enviado a conquistarla. Un golpe en la cabeza le borró la misión y le dejó solo una cosa: las ganas de pelear contra alguien más fuerte.',
    cargando: 'Despertando la furia',
    aura: '#FFB300',
    brillo: '#FFD23F',
    historia: {
      titulo: ['La furia', 'que lo cambió todo'],
      parrafos: [
        'En Namek, Freezer mató a Krilin delante de él. La rabia contenida de toda una vida rompió el límite, y Goku se convirtió en el primer Super Saiyan en mil años: el guerrero dorado de la leyenda de su raza.',
      ],
      remate: 'Lo que para los saiyan era un mito, él lo volvió costumbre.',
    },
    aspecto: {
      etiqueta: 'Transformación',
      titulo: ['El pelo', 'se vuelve oro'],
      parrafos: [
        'Toriyama contó que el rubio también tenía una razón práctica: rellenar de negro el pelo de Goku viñeta tras viñeta era trabajo de más para su asistente.',
        'Los ojos pasan a verde, el pelo se levanta en punta y el aura se enciende en dorado.',
      ],
      remate: GIRALO,
    },
    pelea: {
      titulo: ['Pelea por', 'el gusto de pelear'],
      rasgos: [
        ['Escuela', 'Tortuga · Roshi'],
        ['Maestros', 'Kaio · Whis'],
        ['Fuerte', 'Instinto en combate'],
        ['Debilidad', 'Da ventaja al rival'],
      ],
      nota: 'Más de una vez ha dejado escapar a un enemigo solo para volver a enfrentarlo más fuerte. Para él, una pelea buena vale más que ganarla rápido.',
    },
    batalla: {
      titulo: ['Namek,', 'cinco minutos'],
      parrafos: [
        'El planeta tenía cinco minutos antes de estallar y la pelea contra Freezer siguió dentro de ese plazo. Goku le ofreció energía a su enemigo vencido; Freezer la usó para atacarlo por la espalda, y Goku lo derribó con un último disparo.',
      ],
    },
    tecnicas: [
      { nombre: 'Kamehameha', detalle: 'La técnica del Maestro Roshi. Goku la copió de niño después de verla una sola vez.' },
      { nombre: 'Genki Dama', detalle: 'Energía prestada por todos los seres vivos. Solo la puede reunir alguien de corazón puro.' },
      { nombre: 'Kaioken', detalle: 'Multiplica su poder a costa del cuerpo. Se la enseñó el Kaio del Norte.' },
      { nombre: 'Teletransportación', detalle: 'Aprendida en Yardrat: aparece donde sienta un ki conocido.' },
    ],
  },

  // ── Vegeta ─────────────────────────────────────────────────────────────
  vegeta: {
    titulo: ['Vegeta', 'Príncipe'],
    jp: 'ベジータ',
    kicker: 'Príncipe de los saiyan · Guerrero de élite',
    intro:
      'El príncipe de una raza guerrera que ya no existe. Llegó a la Tierra para conquistarla y acabó defendiéndola, aunque nunca lo dirá en voz alta.',
    cargando: 'Encendiendo el orgullo',
    aura: '#2F6BFF',
    historia: {
      titulo: ['El orgullo', 'de una raza'],
      parrafos: [
        'Freezer destruyó el planeta Vegeta cuando él era un niño y lo crió como soldado a su servicio. Llegó a la Tierra buscando las Esferas del Dragón para pedir la inmortalidad, y perdió contra un saiyan de clase baja.',
      ],
      remate: 'Esa espina es el motor de toda la saga: su rivalidad con Goku.',
    },
    aspecto: {
      etiqueta: 'Diseño',
      titulo: ['La armadura', 'de Freezer'],
      parrafos: [
        'La armadura con hombreras es el uniforme del ejército de Freezer; la versión con rastreador en el ojo es la de su primera llegada a la Tierra.',
        'El pelo en llama nunca cambia: los saiyan de sangre pura conservan el mismo peinado toda la vida.',
      ],
      remate: 'Brazos cruzados y ceño fruncido, su pose de siempre. Gíralo y mira la espalda.',
    },
    pelea: {
      titulo: ['Nunca acepta', 'ayuda'],
      rasgos: [
        ['Rango', 'Príncipe saiyan'],
        ['Estilo', 'Ataque frontal'],
        ['Fuerte', 'Entrenamiento brutal'],
        ['Debilidad', 'Su propio orgullo'],
      ],
      nota: 'Esa soberbia le ha costado peleas que tenía ganadas: dejó que Cell se completara solo para medirse con su forma perfecta.',
    },
    batalla: {
      titulo: ['Se sacrificó', 'por los suyos'],
      parrafos: [
        'Contra Majin Buu se dejó controlar por Babidi solo para volver a pelear con Goku. Después, para proteger a su familia y a la Tierra, se lanzó contra Buu con toda su energía vital en una explosión que le costó la vida.',
        'Fue la primera vez que peleó por alguien que no era él.',
      ],
    },
    tecnicas: [
      { nombre: 'Cañón Galick', detalle: 'El rayo violeta que chocó de frente con el Kamehameha de Goku en su primera pelea.' },
      { nombre: 'Resplandor Final', detalle: 'Toda su energía cargada con los brazos abiertos. Su golpe más fuerte en la saga de Cell.' },
      { nombre: 'Ataque Big Bang', detalle: 'Una esfera de energía lanzada con la palma abierta.' },
      { nombre: 'Explosión Final', detalle: 'Su vida entera convertida en energía, contra Majin Buu.' },
    ],
  },

  // ── Gogeta SSJ4 (los textos de la página original) ────────────────────
  'gogeta-ssj4': {
    titulo: ['Gogeta', 'SSJ4'],
    jp: 'ゴジータ',
    kicker: 'Fusión Metamoru · Nivel 4',
    intro:
      'Diez minutos. Eso duró la fusión más poderosa de Dragon Ball GT: la Danza Metamoru concede media hora, pero cuanto más poder carga la fusión, antes se deshace.',
    cargando: 'Cargando la fusión',
    aura: '#E4002B',
    brillo: '#C8102E',
    historia: {
      titulo: ['Por su culpa', 'existen los Potara'],
      parrafos: [
        'Cuando Toriyama tuvo que fusionar a Goku y Vegeta en el manga, la Danza Metamoru ya estaba ocupada: la había estrenado la película 12, donde nace Gogeta. Así que se inventó los pendientes Potara para salir del paso.',
      ],
      remate: 'Vegetto existe como existe porque Gogeta llegó primero.',
    },
    aspecto: {
      etiqueta: 'Diseño',
      titulo: ['El pelo', 'iba a ser rubio'],
      parrafos: [
        'El Super Saiyan 4 no lo dibujó Toriyama: fue Katsuyoshi Nakatsuru, por encargo de los productores. Probó el pelo rubio y lo descartó: en negro contrasta mejor contra el pelaje rojo.',
        'Negro en todos. Menos en él: Gogeta es el único Super Saiyan 4 al que el rojo le sube hasta la cabeza.',
      ],
      remate: 'Por delante lleva el pelo de Goku; por detrás, el de Vegeta. Arrástralo.',
    },
    pelea: {
      titulo: ['Hasta la ropa', 'se fusionó'],
      rasgos: [
        ['Chaleco', 'Naranja · Goku'],
        ['Fajín', 'Azul · Vegeta'],
        ['Pantalón', 'Blanco · metamoriano'],
        ['Pelaje', 'Rojo · Ōzaru'],
      ],
      nota: 'Y es la única prenda que aguanta: el chaleco metamoriano se estira hasta tamaño Ōzaru y sobrevive al Super Saiyan 4. A cualquier otro saiyan, la ropa de arriba le revienta.',
    },
    batalla: {
      titulo: ['Ganó jugando.', 'Perdió por jugar.'],
      parrafos: [
        'Con Omega Shenron a su merced, disparó matasuegras en vez de rematar y le ofreció perdonarle la vida si prometía no volver a hacer daño. Cuando por fin cargó el segundo Big Bang Kamehameha, se le habían acabado los diez minutos.',
      ],
    },
    tecnicas: [
      { nombre: 'Big Bang Kamehameha', detalle: 'El Big Bang de Vegeta y el Kamehameha de Goku en el mismo disparo.' },
      { nombre: 'Danza Metamoru', detalle: 'Media hora de fusión a cambio de una coreografía exacta: un dedo mal puesto y sale otra cosa.' },
      { nombre: 'Matasuegras', detalle: 'La burla con la que dejó a Omega Shenron temblando. Y la que le costó la pelea.' },
    ],
    tecnicasNota:
      'Lo doblan Masako Nozawa y Ryō Horikawa a la vez: se graban por separado y se superponen. Dos voces, un solo guerrero.',
  },

  // ── Gogeta Blue ────────────────────────────────────────────────────────
  'gogeta-blue': {
    titulo: ['Gogeta', 'Blue'],
    jp: 'ゴジータ',
    kicker: 'Fusión Metamoru · Super Saiyan Blue',
    intro:
      'Goku y Vegeta bailando la Danza Metamoru en Dragon Ball Super: Broly. La fusión de las películas, por fin con el pelo azul del ki divino.',
    cargando: 'Bailando la Danza Metamoru',
    aura: '#00C2FF',
    brillo: '#28D2FF',
    historia: {
      titulo: ['Por fin', 'en la historia'],
      parrafos: [
        'Gogeta llevaba más de veinte años viviendo solo en una película de Z y en GT. En Dragon Ball Super: Broly (2018), con guion de Toriyama, entró por fin en la historia principal.',
        'Goku y Vegeta tuvieron que practicar la danza a escondidas mientras Freezer entretenía a Broly. El primer intento les salió mal.',
      ],
      remate: 'El segundo, no.',
    },
    aspecto: {
      etiqueta: 'Diseño',
      titulo: ['El mismo chaleco,', 'otro poder'],
      parrafos: [
        'El chaleco metamoriano y el fajín son los de siempre. Lo que cambia es el Super Saiyan Blue: el poder de un dios Super Saiyan dominado por un saiyan, con el pelo y el aura azules.',
      ],
      remate: 'Esta figura viene en cuatro paletas y por piezas: la misma escultura, distinta tinta.',
    },
    pelea: {
      titulo: ['Dos guerreros,', 'un solo ritmo'],
      rasgos: [
        ['Origen', 'Danza Metamoru'],
        ['Duración', '30 minutos'],
        ['Forma', 'Super Saiyan Blue'],
        ['Estilo', 'Juega con el rival'],
      ],
      nota: 'Por separado, ni Goku ni Vegeta podían seguirle el ritmo a Broly. Fusionados, lo superaron en minutos y se dieron el lujo de sonreír mientras peleaban.',
    },
    batalla: {
      titulo: ['Contra Broly,', 'en el hielo'],
      parrafos: [
        'Broly crecía con cada golpe. Gogeta lo alcanzó, lo superó y preparó el remate. Pero antes de que llegara, Cheelai le pidió un deseo a Shenlong y Broly desapareció rumbo al planeta Vampa, donde se crió.',
      ],
    },
    tecnicas: [
      { nombre: 'Big Bang Kamehameha', detalle: 'Su técnica de firma desde GT: el Big Bang de Vegeta y el Kamehameha de Goku a la vez.' },
      { nombre: 'Super Saiyan Blue', detalle: 'El ki divino controlado por un saiyan, ahora en un cuerpo fusionado.' },
      { nombre: 'Danza Metamoru', detalle: 'Media hora de fusión. Los pasos tienen que salir idénticos, en espejo.' },
    ],
  },

  // ── Octavio (Androide 8) ───────────────────────────────────────────────
  octavio: {
    titulo: ['Octavio', 'Androide 8'],
    jp: 'ハッチャン',
    kicker: 'Patrulla Roja · Torre Músculo',
    intro:
      'El androide más grande de la Patrulla Roja y el único que se negó a matar. El niño Goku le puso nombre, Octavio, y se hicieron amigos.',
    cargando: 'Subiendo la Torre Músculo',
    aura: '#4A7BFF',
    historia: {
      titulo: ['El gigante', 'que no quería pelear'],
      parrafos: [
        'En la Torre Músculo, el General Blanco le ordenó acabar con Goku. Octavio se negó: no le gustaba hacerle daño a nadie. El general lo amenazó, y Goku se puso de su lado.',
      ],
      remate: 'Es el primer enemigo de Goku que se vuelve amigo sin pelear.',
    },
    aspecto: {
      etiqueta: 'Diseño',
      titulo: ['Cara de monstruo,', 'corazón de oro'],
      parrafos: [
        'Grande, con el pelo en cepillo y cicatrices de puntadas en la frente: un diseño que recuerda al monstruo de Frankenstein, pensado para asustar.',
        'Aquí con traje azul marino, como un guardaespaldas de buen corazón.',
      ],
      remate: GIRALO,
    },
    pelea: {
      titulo: ['Fuerza', 'que no usa'],
      rasgos: [
        ['Tamaño', 'Gigante'],
        ['Fuerza', 'Brutal'],
        ['Carácter', 'Pacífico'],
        ['Lealtad', 'Goku'],
      ],
      nota: 'Podría aplastar a casi cualquiera de la torre, y prefiere no hacerlo. Su fuerza es para proteger, no para obedecer.',
    },
    batalla: {
      titulo: ['Torre', 'Músculo'],
      parrafos: [
        'Goku subió la torre piso a piso contra los soldados de la Patrulla Roja. Arriba lo esperaba el arma secreta del general: Octavio. El androide se negó a atacar, y Goku terminó la pelea por los dos.',
      ],
    },
    tecnicas: [
      { nombre: 'Fuerza de androide', detalle: 'Levanta y lanza lo que sea sin esfuerzo.' },
      { nombre: 'Cuerpo de acero', detalle: 'Aguanta golpes que tumbarían a cualquier soldado de la torre.' },
      { nombre: 'Corazón noble', detalle: 'Su arma más fuerte: se negó a cumplir una orden de matar.' },
    ],
  },

  // ── Piccolo ────────────────────────────────────────────────────────────
  piccolo: {
    titulo: ['Piccolo', 'Namekiano'],
    jp: 'ピッコロ',
    kicker: 'Namekiano · Maestro de Gohan',
    intro:
      'Nació para vengar a su padre, el Rey Demonio Piccolo, y matar a Goku. Acabó entrenando a su hijo y dando la vida por él.',
    cargando: 'Meditando',
    aura: '#B26BFF',
    historia: {
      titulo: ['De enemigo', 'a maestro'],
      parrafos: [
        'Cuando llegaron los saiyan, Piccolo se llevó a Gohan, de cuatro años, y lo dejó solo en la naturaleza para que aprendiera a sobrevivir. Después lo entrenó él mismo durante casi un año.',
      ],
      remate: 'Desde entonces, Gohan es más su alumno que de nadie.',
    },
    aspecto: {
      etiqueta: 'Diseño',
      titulo: ['Capa', 'y turbante'],
      parrafos: [
        'La capa y el turbante pesan: son ropa de entrenamiento que se quita antes de una pelea seria. Las antenas, la piel verde y las orejas puntiagudas son de su raza, los namekianos.',
      ],
      remate: 'Gíralo: la capa cae hasta los pies por detrás. Arrástralo.',
    },
    pelea: {
      titulo: ['El que piensa', 'la pelea'],
      rasgos: [
        ['Raza', 'Namekiano'],
        ['Estilo', 'Estratega'],
        ['Fuerte', 'Regeneración'],
        ['Alumno', 'Son Gohan'],
      ],
      nota: 'Mientras los saiyan disfrutan la pelea, él la lee: estudia al rival, prepara trampas y no le importa perder un brazo si con eso gana tiempo.',
    },
    batalla: {
      titulo: ['Contra', 'Nappa'],
      parrafos: [
        'Resistieron a los saiyan hasta que llegara Goku. Cuando Nappa disparó contra Gohan, Piccolo se puso delante y cayó. Sus últimas palabras fueron para el niño.',
        'Con él murió también Kamisama, y las Esferas del Dragón de la Tierra se convirtieron en piedra.',
      ],
    },
    tecnicas: [
      { nombre: 'Makankosappo', detalle: 'El rayo en espiral que preparó para matar a Goku. Con él acabó con Raditz.' },
      { nombre: 'Regeneración', detalle: 'Le vuelve a crecer un brazo perdido en plena pelea.' },
      { nombre: 'Gigante', detalle: 'Puede crecer hasta el tamaño de un edificio.' },
      { nombre: 'Fusión namekiana', detalle: 'Se fusionó con Nail en Namek y con Kamisama antes de Cell.' },
    ],
  },

  // ── Broly (películas de Z) ─────────────────────────────────────────────
  'broly-z': {
    titulo: ['Broly', 'Legendario'],
    jp: 'ブロリー',
    kicker: 'El Super Saiyan Legendario · Películas de Z',
    intro:
      'El Super Saiyan Legendario que aparece una vez cada mil años. Nació el mismo día que Goku, y el llanto del bebé de la cuna de al lado lo marcó para siempre.',
    cargando: 'Despertando al legendario',
    aura: '#3CFF6B',
    brillo: '#8BE04A',
    historia: {
      titulo: ['Mil años', 'de leyenda'],
      parrafos: [
        'El rey Vegeta ordenó ejecutarlo de bebé por miedo a su poder. Sobrevivió con su padre Paragus a la destrucción del planeta Vegeta y creció con un odio sin explicación hacia un solo nombre: Kakarotto.',
      ],
      remate: 'El llanto del bebé Goku, en la cuna de al lado, fue el origen de todo.',
    },
    aspecto: {
      etiqueta: 'Transformación',
      titulo: ['Pelo verde,', 'músculo sin fin'],
      parrafos: [
        'Su forma legendaria no es la dorada de los demás: el pelo tira a verde, los ojos se quedan en blanco y el cuerpo crece hasta romper la ropa.',
        'Oro en las muñecas, el cuello y la frente. En la película, la diadema era el aparato con el que su padre lo mantenía bajo control.',
      ],
      remate: GIRALO,
    },
    pelea: {
      titulo: ['No calcula:', 'aplasta'],
      rasgos: [
        ['Forma', 'Legendario'],
        ['Poder', 'Crece sin límite'],
        ['Estilo', 'Fuerza bruta'],
        ['Obsesión', 'Kakarotto'],
      ],
      nota: 'Cuanto más pelea, más fuerte se hace. En su primera película pudo a la vez con Goku, Vegeta, Gohan, Trunks y Piccolo.',
    },
    batalla: {
      titulo: ['Uno', 'contra todos'],
      parrafos: [
        'En el Nuevo Planeta Vegeta los superó a todos. Vegeta, paralizado de miedo, se negó a pelear. Solo cuando los demás le dieron su energía a Goku, este pudo atravesarlo de un puñetazo.',
      ],
    },
    tecnicas: [
      { nombre: 'Eraser Cannon', detalle: 'Una esfera verde de ki lanzada con una sola mano.' },
      { nombre: 'Barrera de ki', detalle: 'Un escudo verde que lo envuelve y desvía los ataques.' },
      { nombre: 'Lariat', detalle: 'Embiste con el brazo extendido y arrastra al rival por el aire.' },
    ],
  },

  // ── Broly (Dragon Ball Super) ──────────────────────────────────────────
  'broly-super': {
    titulo: ['Broly', 'Full Power'],
    jp: 'ブロリー',
    kicker: 'Saiyan del planeta Vampa · Dragon Ball Super',
    intro:
      'El Broly de 2018: criado en el planeta Vampa con su padre, sin saber nada del mundo. Un saiyan con un poder que ni él entiende y un corazón más noble de lo que parece.',
    cargando: 'Despertando al legendario',
    aura: '#7CFF3C',
    brillo: '#C8E83A',
    historia: {
      titulo: ['Desterrado', 'de bebé'],
      parrafos: [
        'El rey Vegeta lo mandó de bebé al planeta Vampa, celoso de que su poder superara al de su hijo, el príncipe. Paragus fue a buscarlo, se quedó atrapado allí y lo crió durante décadas pensando solo en la venganza.',
      ],
      remate: 'Su único amigo en Vampa era Ba, una bestia gigante.',
    },
    aspecto: {
      etiqueta: 'Transformación',
      titulo: ['Del negro', 'al dorado'],
      parrafos: [
        'En la película pasa por varias formas hasta llegar al Super Saiyan Full Power: pelo dorado verdoso, ojos sin pupila y un cuerpo que crece hasta duplicar su tamaño.',
        'Esta figura existe en dorado y en verde, y en dos piezas para imprimirla sin soportes.',
      ],
      remate: GIRALO,
    },
    pelea: {
      titulo: ['Aprende', 'peleando'],
      rasgos: [
        ['Estilo', 'Instinto puro'],
        ['Fuerte', 'Se adapta'],
        ['Forma', 'Full Power'],
        ['Control', 'Ninguno'],
      ],
      nota: 'Empezó la pelea sin saber pelear. En minutos le devolvía a Vegeta sus propios golpes, aprendidos sobre la marcha.',
    },
    batalla: {
      titulo: ['Contra Goku', 'y Vegeta'],
      parrafos: [
        'Freezer mató a Paragus delante de él a propósito, para desatar su furia. Funcionó: ni Goku ni Vegeta pudieron pararlo por separado, y tuvieron que fusionarse en Gogeta.',
      ],
    },
    tecnicas: [
      { nombre: 'Furia Full Power', detalle: 'Su poder se dispara con la rabia, sin techo conocido.' },
      { nombre: 'Lariat', detalle: 'Embiste con el brazo extendido y estrella al rival contra el hielo.' },
      { nombre: 'Esfera de ki', detalle: 'Ráfagas verdes lanzadas a quemarropa.' },
      { nombre: 'Adaptación', detalle: 'Copia el estilo del rival mientras pelea contra él.' },
    ],
  },

  // ── Trunks del Futuro ──────────────────────────────────────────────────
  trunks: {
    titulo: ['Trunks', 'del Futuro'],
    jp: 'トランクス',
    kicker: 'Viajero del tiempo · Hijo de Vegeta y Bulma',
    intro:
      'Vino de un futuro arrasado por los androides para avisar de lo que venía. Llegó con una espada, una chaqueta de la Capsule Corp. y una medicina para el corazón de Goku.',
    cargando: 'Viajando en el tiempo',
    aura: '#FFC72C',
    brillo: '#FFD23F',
    historia: {
      titulo: ['Un futuro', 'sin esperanza'],
      parrafos: [
        'En su línea de tiempo, Goku murió de una enfermedad del corazón y los androides 17 y 18 acabaron con casi todos los guerreros. Bulma construyó una máquina del tiempo y él viajó al pasado para cambiar la historia.',
      ],
      remate: 'En su primera aparición partió a Freezer en dos con la espada.',
    },
    aspecto: {
      etiqueta: 'Diseño',
      titulo: ['Pelo lila', 'y espada'],
      parrafos: [
        'El pelo lila es de Bulma; el carácter, de Vegeta. La chaqueta azul lleva el logo de la Capsule Corp., la empresa de su madre.',
        'La espada a la espalda se volvió su seña de identidad: ningún otro saiyan pelea con arma.',
      ],
      remate: GIRALO,
    },
    pelea: {
      titulo: ['Sin un', 'movimiento de más'],
      rasgos: [
        ['Arma', 'Espada'],
        ['Maestro', 'Gohan del futuro'],
        ['Estilo', 'Rápido y preciso'],
        ['Forma', 'Super Saiyan'],
      ],
      nota: 'Aprendió de Gohan del futuro, el último guerrero que quedaba en su tiempo. Por eso pelea como un superviviente: sin desperdiciar nada.',
    },
    batalla: {
      titulo: ['Freezer,', 'en segundos'],
      parrafos: [
        'Freezer volvió a la Tierra reconstruido con piezas mecánicas, junto a su padre, el Rey Cold. Un muchacho desconocido se transformó en Super Saiyan delante de todos y los derrotó a los dos antes de que Goku aterrizara.',
      ],
    },
    tecnicas: [
      { nombre: 'Ataque Ardiente', detalle: 'Una danza rápida de manos y una esfera de fuego de ki.' },
      { nombre: 'Corte de espada', detalle: 'El tajo con el que partió a Freezer de arriba abajo.' },
      { nombre: 'Super Saiyan Ira', detalle: 'La forma que despertó en Super, con la furia de un futuro perdido.' },
      { nombre: 'Espada de la esperanza', detalle: 'La energía de todos reunida en la hoja, contra Zamasu.' },
    ],
  },

  // ── Krilin ─────────────────────────────────────────────────────────────
  krilin: {
    titulo: ['Krilin', 'Guerrero Z'],
    jp: 'クリリン',
    kicker: 'Escuela de la Tortuga · El mejor amigo de Goku',
    intro:
      'El terrícola más fuerte de la Tierra. Empezó como rival de Goku en la escuela del Maestro Roshi y terminó siendo su mejor amigo.',
    cargando: 'Entrenando con Roshi',
    aura: '#FFE6C7',
    historia: {
      titulo: ['De rival', 'a mejor amigo'],
      parrafos: [
        'Llegó a entrenar con el Maestro Roshi casi a la vez que Goku y al principio le hacía trampas para ganarle. Se volvieron inseparables. Su muerte a manos de Freezer, en Namek, despertó al primer Super Saiyan.',
      ],
      remate: 'Después se casó con la Androide 18, la que una vez fue su enemiga.',
    },
    aspecto: {
      etiqueta: 'Diseño',
      titulo: ['Seis puntos', 'en la frente'],
      parrafos: [
        'Los seis puntos de su frente son marcas de incienso de los monjes del templo Orin, donde se crió. La cabeza rapada viene de ahí.',
        'Uniforme naranja con el kanji de la Tortuga: el mismo que Goku.',
      ],
      remate: GIRALO,
    },
    pelea: {
      titulo: ['Siempre', 'se queda'],
      rasgos: [
        ['Escuela', 'Tortuga'],
        ['Maestro', 'Roshi'],
        ['Fuerte', 'Técnica'],
        ['Valor', 'Primera línea'],
      ],
      nota: 'No es saiyan ni se transforma. Lo compensa con técnicas finas, mucha astucia y una lealtad que lo pone siempre delante.',
    },
    batalla: {
      titulo: ['El disco', 'contra Freezer'],
      parrafos: [
        'En Namek, frente a Freezer, Krilin lanzó un Kienzan que le cortó la cola de un tajo. Fue de los pocos golpes que de verdad le dolieron al emperador del universo.',
      ],
    },
    tecnicas: [
      { nombre: 'Kienzan', detalle: 'Un disco de energía que corta lo que toque.' },
      { nombre: 'Taiyoken', detalle: 'Un destello que ciega al rival unos segundos.' },
      { nombre: 'Kamehameha', detalle: 'La técnica de la Tortuga, la misma que Goku.' },
      { nombre: 'Kienzan doble', detalle: 'Dos discos a la vez, uno por mano.' },
    ],
  },

  // ── Yajirobe ───────────────────────────────────────────────────────────
  yajirobe: {
    titulo: ['Yajirobe', 'Samurái'],
    jp: 'ヤジロベー',
    kicker: 'Samurái de la Torre de Karin',
    intro:
      'El samurái glotón que vive con el Maestro Karin. Huye de casi todas las peleas, pero cuando no le queda otra, saca la katana.',
    cargando: 'Buscando comida',
    aura: '#FF9A2F',
    historia: {
      titulo: ['Glotón', 'y valiente a ratos'],
      parrafos: [
        'Goku lo conoció cuando Yajirobe se comió el pescado que él había atrapado. Poco después, Yajirobe acabó de un solo tajo con Cymbal, uno de los demonios del Rey Piccolo.',
      ],
      remate: 'Siempre es él quien baja las semillas del ermitaño a la pelea.',
    },
    aspecto: {
      etiqueta: 'Diseño',
      titulo: ['Melena salvaje,', 'barriga llena'],
      parrafos: [
        'Gi naranja, katana a la cintura y la bolsa de provisiones siempre colgada: su prioridad es comer.',
        'Esta figura tiene tres poses, una con la calabaza en la mano, y una versión en cuatro piezas.',
      ],
      remate: GIRALO,
    },
    pelea: {
      titulo: ['Un solo', 'tajo'],
      rasgos: [
        ['Arma', 'Katana'],
        ['Estilo', 'Golpe único'],
        ['Fuerte', 'Sorpresa'],
        ['Debilidad', 'Le da miedo todo'],
      ],
      nota: 'No le interesa ganar una pelea: le interesa que acabe pronto. Por eso espera y golpea una sola vez.',
    },
    batalla: {
      titulo: ['La cola', 'de Vegeta'],
      parrafos: [
        'Vegeta, convertido en Ōzaru, estaba aplastando a Goku. Yajirobe se le acercó por la espalda sin que lo notara y le cortó la cola de un tajo. El mono gigante volvió a su tamaño normal.',
      ],
    },
    tecnicas: [
      { nombre: 'Corte de katana', detalle: 'Rápido y limpio: un solo golpe.' },
      { nombre: 'Ataque por sorpresa', detalle: 'Esperar escondido hasta que el rival se descuide.' },
      { nombre: 'Semillas del ermitaño', detalle: 'El repartidor oficial de semillas de la Torre de Karin.' },
    ],
  },

  // ── Maestro Karin ──────────────────────────────────────────────────────
  karin: {
    titulo: ['Maestro', 'Karin'],
    jp: 'カリン',
    kicker: 'Guardián de la Torre de Karin',
    intro:
      'Un gato blanco de cientos de años que vive en lo alto de su torre, cultivando semillas del ermitaño. Los guerreros escalan hasta él para hacerse más fuertes.',
    cargando: 'Escalando la torre',
    aura: '#FFFFFF',
    historia: {
      titulo: ['La torre', 'más alta'],
      parrafos: [
        'Para llegar a él hay que escalar la torre a mano. Arriba guarda el Agua Sagrada: quien consiga quitársela de las patas se vuelve más fuerte.',
      ],
      remate: 'El agua era agua normal. Lo que entrenaba era perseguirlo.',
    },
    aspecto: {
      etiqueta: 'Diseño',
      titulo: ['Bastón', 'y ojos cerrados'],
      parrafos: [
        'Pelaje blanco y esponjoso, ojos casi siempre entrecerrados y un bastón de madera tan alto como él. Parece dormido; ve venir cualquier golpe.',
      ],
      remate: GIRALO,
    },
    pelea: {
      titulo: ['No pelea:', 'enseña'],
      rasgos: [
        ['Estilo', 'Esquivar'],
        ['Fuerte', 'Velocidad'],
        ['Alumnos', 'Roshi y Goku'],
        ['Cultiva', 'Semillas'],
      ],
      nota: 'El Maestro Roshi tardó tres años en quitarle el agua. Goku, tres días.',
    },
    batalla: {
      titulo: ['Tres días', 'de persecución'],
      parrafos: [
        'Goku subió la torre buscando poder para vencer a Tao Pai Pai. Tardó tres días en quitarle la botella. Bajó, se enfrentó al asesino y lo venció.',
      ],
    },
    tecnicas: [
      { nombre: 'Semillas del ermitaño', detalle: 'Curan cualquier herida y una sola quita el hambre por diez días.' },
      { nombre: 'Agua Sagrada', detalle: 'El premio de la persecución.' },
      { nombre: 'Agua Ultra Divina', detalle: 'Un veneno que despierta el poder oculto de quien sobrevive a ella.' },
      { nombre: 'Esquiva imposible', detalle: 'Nadie le toca un pelo sin entrenar antes.' },
    ],
  },

  // ── Goku SSJ4 (GT) ─────────────────────────────────────────────────────
  'goku-ssj4': {
    titulo: ['Goku', 'SSJ4'],
    jp: '孫悟空',
    kicker: 'Dragon Ball GT · Super Saiyan 4',
    intro:
      'La transformación que nació en GT: un saiyan que recupera la cola, domina el poder del Ōzaru dorado y lo concentra en un cuerpo de tamaño normal.',
    cargando: 'Volviendo a la bestia',
    aura: '#E4002B',
    brillo: '#C8102E',
    historia: {
      titulo: ['La cola', 'volvió'],
      parrafos: [
        'Las Esferas del Dragón Definitivas lo convirtieron en niño. Durante la saga de Baby le volvió a crecer la cola, se transformó en Ōzaru dorado y, al recuperar la razón, apareció una forma nueva.',
      ],
      remate: 'Al transformarse recupera el cuerpo adulto: el niño desaparece mientras dura.',
    },
    aspecto: {
      etiqueta: 'Diseño',
      titulo: ['El pelo', 'iba a ser rubio'],
      parrafos: [
        'No lo dibujó Toriyama: fue Katsuyoshi Nakatsuru, por encargo de los productores de GT. Probó el pelo rubio y lo descartó: en negro contrasta mejor contra el pelaje rojo.',
        'Pelaje carmesí en el torso, ojos delineados en rojo y la cola de vuelta.',
      ],
      remate: GIRALO,
    },
    pelea: {
      titulo: ['La bestia', 'con razón'],
      rasgos: [
        ['Forma', 'Super Saiyan 4'],
        ['Origen', 'Ōzaru dorado'],
        ['Cuerpo', 'Adulto otra vez'],
        ['Estilo', 'Instinto salvaje'],
      ],
      nota: 'Pelea con más instinto que nunca, como un animal: pero con la cabeza fría de Goku detrás.',
    },
    batalla: {
      titulo: ['Contra', 'Baby'],
      parrafos: [
        'Baby, el parásito tsufur, controlaba a Vegeta y a casi toda la Tierra. Goku, recién transformado en Super Saiyan 4, le dio la vuelta a la pelea y lo mandó directo al sol con un Kamehameha.',
      ],
    },
    tecnicas: [
      { nombre: 'Kamehameha x10', detalle: 'Diez veces más potente: el Kamehameha del Super Saiyan 4.' },
      { nombre: 'Puño del Dragón', detalle: 'Atraviesa al rival y deja la forma de un dragón dorado.' },
      { nombre: 'Genki Dama', detalle: 'La última, contra Omega Shenron, con energía de todo el universo.' },
      { nombre: 'Teletransportación', detalle: 'Aparece junto a cualquier ki que conozca.' },
    ],
  },

  // ── Goku SSJ4 (Daima) ──────────────────────────────────────────────────
  'goku-ssj4-daima': {
    titulo: ['Goku', 'SSJ4 Daima'],
    jp: '孫悟空',
    kicker: 'Dragon Ball Daima · Super Saiyan 4',
    intro:
      'Dragon Ball Daima (2024) fue la última serie en la que trabajó Akira Toriyama. En ella metió en la historia una forma que había nacido en GT: el Super Saiyan 4.',
    cargando: 'Entrando al Reino Demoníaco',
    aura: '#FF3B6B',
    brillo: '#E83A6A',
    historia: {
      titulo: ['Niño otra vez', 'en otro mundo'],
      parrafos: [
        'Un deseo de Gomah, el nuevo rey del Reino Demoníaco, convirtió a Goku y a sus amigos en niños. Para recuperar su tamaño, viajaron hasta su mundo en busca de otras Esferas del Dragón.',
      ],
      remate: 'Allí, contra Gomah, apareció el Super Saiyan 4.',
    },
    aspecto: {
      etiqueta: 'Diseño',
      titulo: ['El Super Saiyan 4', 'en pequeño'],
      parrafos: [
        'Pelaje rojo, ojos delineados y la cola, como en GT, pero sobre el cuerpo de niño de Daima.',
        'Esta figura lo interpreta en colores libres, con la melena rosada.',
      ],
      remate: GIRALO,
    },
    pelea: {
      titulo: ['Pequeño,', 'no débil'],
      rasgos: [
        ['Forma', 'Super Saiyan 4'],
        ['Tamaño', 'Mini'],
        ['Arma', 'Báculo sagrado'],
        ['Serie', 'Daima · 2024'],
      ],
      nota: 'Volvió a pelear como al principio de la serie: con el báculo sagrado, la nube voladora y mucha astucia.',
    },
    batalla: {
      titulo: ['Contra', 'Gomah'],
      parrafos: [
        'Gomah parecía imbatible en su propio mundo. Goku sacó una transformación que nadie había visto en el Reino Demoníaco y le dio la vuelta a la pelea.',
      ],
    },
    tecnicas: [
      { nombre: 'Super Saiyan 4', detalle: 'El poder del Ōzaru dorado en un cuerpo de niño.' },
      { nombre: 'Kamehameha', detalle: 'La técnica de siempre, en versión mini.' },
      { nombre: 'Báculo sagrado', detalle: 'El bastón que se alarga, de vuelta desde su infancia.' },
      { nombre: 'Nube voladora', detalle: 'Kinto’un otra vez, para viajar por el Reino Demoníaco.' },
    ],
  },

  // ── Goku contra Vegeta (dioramas) ──────────────────────────────────────
  'goku-vs-vegeta': {
    titulo: ['Goku', 'vs Vegeta'],
    jp: '悟空 VS ベジータ',
    kicker: 'Ultra Instinto contra el poder de los dioses',
    intro:
      'Dos saiyan y dos caminos para llegar más alto. Goku aprendió a dejar que el cuerpo pelee solo; Vegeta, a crecer con cada golpe que recibe.',
    cargando: 'Chocando los puños',
    aura: '#8A5BFF',
    historia: {
      titulo: ['Rivales', 'desde el día uno'],
      parrafos: [
        'Se conocieron como enemigos, cuando Vegeta llegó a la Tierra a conquistarla. Desde entonces cada uno es la meta del otro: cada vez que Goku sube un escalón, Vegeta encuentra otro.',
      ],
      remate: 'Este diorama los pone frente a frente, puño contra puño.',
    },
    aspecto: {
      etiqueta: 'Transformaciones',
      titulo: ['Plata', 'contra violeta'],
      parrafos: [
        'Goku en Ultra Instinto: pelo plateado y la calma de los ángeles, aprendida de Whis. Vegeta en el camino de los dioses de la destrucción, aprendido de Bills, con el pelo encendido en azul o en violeta.',
      ],
      remate: GIRALO,
    },
    pelea: {
      titulo: ['Dos filosofías,', 'un poder'],
      rasgos: [
        ['Goku', 'Ultra Instinto'],
        ['Vegeta', 'Ultra Ego'],
        ['Maestro de Goku', 'Whis'],
        ['Maestro de Vegeta', 'Bills'],
      ],
      nota: 'Uno esquiva sin pensar. El otro se hace más fuerte cuanto más daño recibe. Opuestos exactos, y por eso se necesitan.',
    },
    batalla: {
      titulo: ['El duelo', 'que nunca acaba'],
      parrafos: [
        'Su primera pelea, en la Tierra, terminó con Vegeta huyendo malherido en su nave. Años después, tras Majin Buu, Vegeta reconoció en voz alta que Goku era el número uno.',
        'Y aun así siguieron: en Super, entrenando con ángeles y dioses, el reto volvió a empezar.',
      ],
    },
    tecnicas: [
      { nombre: 'Kamehameha', detalle: 'De Goku: la técnica de la Tortuga.' },
      { nombre: 'Cañón Galick', detalle: 'De Vegeta: el rayo violeta de su primera pelea.' },
      { nombre: 'Ultra Instinto', detalle: 'El cuerpo esquiva y responde sin pasar por la cabeza.' },
      { nombre: 'Hakai', detalle: 'La destrucción de los dioses, que Vegeta aprendió de Bills.' },
    ],
  },

  // ── Cuadro Sparking! ZERO ──────────────────────────────────────────────
  'sparking-zero': {
    titulo: ['Sparking!', 'Zero'],
    jp: 'ドラゴンボール',
    kicker: 'Videojuego · 2024',
    intro:
      'Dragon Ball: Sparking! ZERO, el regreso de la saga de juegos de pelea Budokai Tenkaichi, convertido en un cuadro en relieve con sus luchadores.',
    cargando: 'Cargando el combate',
    aura: '#FFB300',
    historia: {
      titulo: ['Diecisiete años', 'esperando'],
      parrafos: [
        'La serie Budokai Tenkaichi, Sparking! en Japón, se había quedado en su tercera entrega en 2007. Los fans la pidieron durante años, hasta que Sparking! ZERO llegó en octubre de 2024 con más de 180 luchadores.',
      ],
      remate: 'Lo desarrolló Spike Chunsoft y lo publicó Bandai Namco.',
    },
    aspecto: {
      etiqueta: 'Diseño',
      titulo: ['Un cuadro', 'con relieve'],
      parrafos: [
        'Los luchadores de la portada salen del fondo en relieve, dentro de un marco tipo caja, listo para colgar en la pared o imprimir en 3D.',
      ],
      remate: 'Gíralo: el marco tiene fondo de verdad. Arrástralo.',
    },
    pelea: {
      titulo: ['Lucha', 'en 3D'],
      rasgos: [
        ['Género', 'Lucha 3D'],
        ['Luchadores', 'Más de 180'],
        ['Estudio', 'Spike Chunsoft'],
        ['Editora', 'Bandai Namco'],
      ],
      nota: 'Combates en escenarios abiertos que se rompen, con vuelo, choques de rayos y transformaciones en plena pelea.',
    },
    batalla: {
      titulo: ['¿Y si', 'pasó otra cosa?'],
      parrafos: [
        'El modo historia recorre las batallas clásicas y deja jugar el «qué habría pasado si…»: decisiones que cambian el desenlace de peleas famosas.',
      ],
    },
    tecnicas: [
      { nombre: 'Ataques definitivos', detalle: 'Cada luchador con sus técnicas de la serie.' },
      { nombre: 'Transformaciones', detalle: 'Cambiar de forma sin salir del combate.' },
      { nombre: 'Fusiones', detalle: 'Metamoru y Potara como parte de la pelea.' },
      { nombre: 'Choque de rayos', detalle: 'Dos ráfagas frente a frente; gana quien empuje más.' },
    ],
  },
}
