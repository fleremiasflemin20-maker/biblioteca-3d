import { useLayoutEffect, type RefObject } from 'react'
import { ContactShadows, Environment, Lightformer, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { MANGA_URL, QUALITY } from '../lib/quality'
import { LUZ, type Estilo } from '../lib/estilo'
import { SombraFalsa } from './SombraFalsa'

export const RIM_BASE = 1.2
export const RIM_PEAK = 26

type Props = {
  /** La cámara escribe aquí la intensidad del contraluz en cada frame. */
  rimRef: RefObject<THREE.SpotLight | null>
  estilo: Estilo
}

/**
 * Iluminación de estudio de tres puntos con un HDR generado en la propia
 * escena, sin descargar ningún .hdr.
 *
 * `<Environment>` con hijos `<Lightformer>` renderiza un cubemap una sola vez a
 * partir de esos paneles: da los reflejos suaves que necesita un material PBR
 * sin los 4-8 MB de un HDRI ni una petición a un CDN. Para cambiar la clave
 * lumínica se mueven los paneles, no se busca otro archivo.
 */
export function StudioLighting({ rimRef, estilo }: Props) {
  /*
   * El sombreado cel no lee el mapa de entorno, y esos paneles aportaban la
   * mitad de la luz de la escena. Sin compensarlo, al pasar a modo anime la
   * figura se hunde: se ve el corte de las bandas, pero todo en penumbra.
   *
   * Solo se suben las luces directas. El contraluz no, porque su intensidad la
   * escribe la cámara en cada frame y ya está calibrado por el recorrido.
   */
  const luz = LUZ[estilo]

  // La misma tira que envuelve la escena, ya en caché: el suelo también es papel
  // impreso. Sin esto, en el picado del acto III el fondo desaparece — la cámara
  // mira hacia abajo y lo único que encuadra es suelo negro.
  const paper = useTexture(MANGA_URL)

  useLayoutEffect(() => {
    paper.wrapS = paper.wrapT = THREE.RepeatWrapping
    paper.repeat.set(4, 2)
    paper.colorSpace = THREE.SRGBColorSpace
    paper.needsUpdate = true
  }, [paper])

  return (
    <>
      <hemisphereLight args={['#3d4a63', '#0a0a0b', 0.35 * luz]} />

      {/* Clave: 45° arriba y a la izquierda. Es la que talla el volumen del músculo.
          El suavizado viene del filtro VSM del Canvas: `radius` desenfoca el mapa de
          sombras y `blurSamples` decide con cuántas muestras. Es lo que sustituye al
          <SoftShadows /> (PCSS) de drei, que a día de hoy no compila contra three
          r185 — el chunk de sombras dejó de exponer `unpackRGBAToDepth`. */}
      <directionalLight
        castShadow
        position={[3.4, 5.2, 3.8]}
        intensity={2.6 * luz}
        color="#fff2e2"
        shadow-mapSize={[QUALITY.shadowMapSize, QUALITY.shadowMapSize]}
        shadow-radius={QUALITY.softShadows ? 7 : 3}
        shadow-blurSamples={QUALITY.softShadows ? 16 : 6}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      >
        <orthographicCamera attach="shadow-camera" args={[-2.2, 2.2, 3.2, -0.4, 0.5, 14]} />
      </directionalLight>

      {/* Relleno frío y débil: abre las sombras sin aplanar el relieve. */}
      <directionalLight position={[-4.5, 2.2, 2.4]} intensity={0.55 * luz} color="#7fa6d8" />

      {/* Contra. Arranca casi apagada y se abre en el acto III. */}
      <spotLight
        ref={rimRef}
        position={[-1.6, 3.4, -4.6]}
        angle={0.85}
        penumbra={1}
        distance={16}
        decay={2}
        intensity={RIM_BASE}
        color="#ff3a3a"
      />

      {/* Segunda contra por el otro lado: separa el pelo del fondo en el perfil.
          Va en un blanco apenas frío, no en azul: la clave de color de la figura
          es blanco y rojo, y un azul saturado aquí ensucia esa lectura. */}
      <spotLight
        position={[3.6, 2.8, -3.4]}
        angle={0.9}
        penumbra={1}
        distance={14}
        decay={2}
        intensity={3 * luz}
        color="#dfe6f5"
      />

      <Environment resolution={QUALITY.isMobile ? 128 : 256} frames={1}>
        {/* Softbox frontal grande: el reflejo especular ancho de la piel. */}
        <Lightformer form="rect" intensity={2.4} position={[0, 2.4, 4]} scale={[7, 5, 1]} target={[0, 1.2, 0]} />
        {/* Tiras laterales: definen los bordes del cuerpo. */}
        <Lightformer form="rect" intensity={1.6} position={[-4, 2, 1]} scale={[3, 6, 1]} target={[0, 1.2, 0]} />
        <Lightformer form="rect" intensity={1.2} position={[4, 2, -1]} scale={[3, 6, 1]} target={[0, 1.2, 0]} />
        {/* Cenital estrecho: el brillo en la coronilla y los hombros. */}
        <Lightformer form="rect" intensity={3} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[4, 4, 1]} />
        {/* Rebote cálido desde abajo, muy bajo: evita que las piernas se hundan en negro. */}
        <Lightformer form="circle" intensity={0.8} position={[0, -2, 2]} scale={6} color="#ff6a6a" />
      </Environment>

      {/* Suelo: sin él las sombras flotan y la figura no pesa. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
        <circleGeometry args={[8.8, 64]} />
        {/* El tinte oscuro deja la viñeta insinuada y la sombra sigue leyéndose
            encima. Con el papel a plena luz aparecería una línea de horizonte
            que parte el encuadre en los planos bajos. */}
        <meshStandardMaterial
          map={paper}
          color="#14141a"
          roughness={1}
          metalness={0}
          envMapIntensity={0.12}
        />
      </mesh>

      {/*
        La sombra del suelo, en dos versiones.

        `<ContactShadows>` es una sombra de verdad y por eso cuesta: cada
        fotograma vuelve a renderizar la escena desde abajo con un material de
        profundidad. Medido, son 150.000 triángulos más por frame — la pasada más
        caro de toda la escena, por encima del mapa de sombras.

        En escritorio se paga con gusto: la mancha sigue la silueta, se estrecha
        en los tobillos y se abre con los brazos. En móvil se cambia por un
        degradado radial de 64 triángulos, que a ese tamaño da el mismo asiento.
      */}
      {QUALITY.isMobile ? (
        <SombraFalsa />
      ) : (
        <ContactShadows
          position={[0, 0.005, 0]}
          scale={7}
          resolution={512}
          blur={2.4}
          opacity={0.8}
          far={2.6}
          color="#000000"
        />
      )}
    </>
  )
}
