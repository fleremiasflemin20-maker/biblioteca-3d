import { Suspense, useCallback, useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { CameraRig } from './CameraRig'
import { MarcadorEscena } from './MarcadorEscena'
import { Figura } from './Figura'
import { useFigura } from '../lib/figura'
import { MangaBackdrop } from './MangaBackdrop'
import { KiAura } from './KiAura'
import { LivingFigure } from './LivingFigure'
import { Contorno } from './Contorno'
import type { Estilo } from '../lib/estilo'
import type { Etapa } from '../lib/etapa'
import { RIM_BASE, RIM_PEAK, StudioLighting } from './StudioLighting'
import { QUALITY } from '../lib/quality'
import { initialCameraState } from '../lib/camera-path'
import { EffectComposer, SelectiveBloom, Select, Selection } from '@react-three/postprocessing'

const start = initialCameraState()

/**
 * Deja el renderer a mano en la consola durante el desarrollo.
 *
 * `__gl.info.render` da las llamadas de dibujado y los triángulos reales del
 * último frame, que es lo único que permite saber qué cuesta la escena en vez de
 * suponerlo. No se compila en producción.
 */
function SondaRenderer() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    if (!import.meta.env.DEV) return

    // La escena también, para poder contar triángulos objeto por objeto en vez
    // de deducir el reparto del total, que ya me ha salido mal dos veces.
    Object.assign(window, {
      __gl: gl,
      __escena: scene,
      __contar: () => {
        const filas: { objeto: string; triangulos: number; sombra: boolean }[] = []
        scene.traverse((o) => {
          const m = o as THREE.Mesh
          if (!m.isMesh || !m.visible || !m.geometry) return
          const g = m.geometry
          const n = g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3
          filas.push({
            objeto: m.name || m.material?.constructor.name || 'sin nombre',
            triangulos: Math.round(n),
            sombra: m.castShadow,
          })
        })
        return filas.sort((a, b) => b.triangulos - a.triangulos)
      },
    })
  }, [gl, scene])

  return null
}

/**
 * El personaje con su contorno y su aura. Va en su propio componente porque es
 * quien suspende mientras llega el `.glb`: el contorno y el aura usan la misma
 * silueta que sale de él.
 */
function Personaje({ estilo, etapa }: { estilo: Estilo; etapa: Etapa }) {
  const figura = useFigura()
  return (
    <>
      {/* Contorno y aura son de la escena acabada: en el "cómo se hizo" se van. */}
      {estilo === 'anime' && etapa === 'final' && <Contorno geometry={figura.silueta} />}
      <Figura figura={figura} estilo={estilo} etapa={etapa} />
      {etapa === 'final' && <KiAura geometry={figura.silueta} />}
    </>
  )
}

/**
 * El escenario. Va `fixed` a pantalla completa y no se desmonta nunca: el
 * contenido del DOM scrollea por encima y la escena permanece, que es lo que
 * hace que el recorrido se lea como una sola toma continua en vez de como
 * varias secciones animándose por separado.
 */
export function Scene({ estilo, etapa }: { estilo: Estilo; etapa: Etapa }) {
  const rimRef = useRef<THREE.SpotLight>(null)

  // La cámara escribe la intensidad de la contra directamente sobre la luz.
  // Pasar esto por estado de React re-renderizaría el árbol 60 veces por segundo.
  const handleRim = useCallback((rim: number) => {
    if (rimRef.current) rimRef.current.intensity = RIM_BASE + rim * RIM_PEAK
  }, [])

  return (
    <div className="fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        dpr={QUALITY.dpr}
        /*
         * VSM en escritorio: mapa de sombras desenfocado de verdad, con penumbra
         * ancha y sin el aliasing escalonado del PCF por defecto.
         *
         * En móvil, apagado. Medido: el pase de sombras costaba 150.066
         * triángulos y 4 llamadas de dibujado por fotograma —un tercio de toda la
         * escena— y los seguía costando incluso con `castShadow` desactivado en el
         * personaje, así que hay que cortarlo aquí, en el renderer, y no objeto
         * por objeto. A cambio la figura se asienta con `SombraFalsa`, que son 32
         * triángulos.
         */
        shadows={QUALITY.isMobile ? false : { type: THREE.VSMShadowMap }}
        gl={{
          antialias: !QUALITY.isMobile,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
      >
        <color attach="background" args={['#0a0a0b']} />
        {/* Empieza más allá del cilindro de manga (radio 9) para no lavarlo, y se
            cierra antes de su pared opuesta: es lo que le da profundidad al fondo. */}
        <fog attach="fog" args={['#0a0a0b', 8, 22]} />

        {/* El FOV real lo pone CameraRig en el primer frame, ya con la corrección
            de encuadre según la forma de la ventana. Aquí solo hace falta un
            valor finito: el rig lo ajusta antes de que se pinte nada. */}
        <PerspectiveCamera makeDefault fov={start.fov} near={0.1} far={40} position={[0, 1, 5]} />

        <Suspense fallback={null}>
          <MangaBackdrop />

          {/*
            Todo lo que brilla va dentro de <Selection>. El bloom es selectivo a
            propósito: un bloom global sobre esta escena encendería las páginas
            de manga —que son blancas— y el fondo se comería al personaje.
          */}
          <Selection>
            <Select enabled>
              {/* El personaje y su aura van dentro del mismo grupo animado: si
                  girase solo la malla, el halo se quedaría atrás y se vería el
                  desfase en el borde de la silueta.

                  El personaje entra en la selección por el pelo: en el pase de
                  bloom no hay luces, así que solo sobrevive su emisión. */}
              <LivingFigure>
                {/* El contorno va dentro del grupo animado, con el personaje:
                    si girase aparte, la línea se despegaría de la silueta. */}
                {/* Contorno y aura son de la escena acabada. Durante el
                    "cómo se hizo" desaparecen: dejarlos puestos sobre la malla
                    de alambre contaría dos capas a la vez y se perdería justo
                    lo que la etapa quiere enseñar. */}
                <Personaje estilo={estilo} etapa={etapa} />
              </LivingFigure>

              {/*
                Aquí había motas de ki con <Sparkles>. Fuera.

                Bajarles la velocidad no servía de nada: el componente hace
                justo lo que su nombre dice — cada partícula oscila su propia
                opacidad con un desfase aleatorio, así que centellean por
                diseño. Con el bloom encima, noventa puntos encendiéndose y
                apagándose a destiempo son exactamente la "luz dañada" que se
                está quitando. El aura sola sostiene la escena.
              */}
            </Select>

            {/*
              Avisa por consola de que «SelectiveBloom requires lights to work».
              Es lo que se busca: sin luces en el pase, la selección se renderiza
              con lo único que emite por sí mismo — el aura, las motas y el pelo.
              Pasarle la luz clave encendería el gi blanco y la figura entera se
              iría a blanco.
            */}
            {QUALITY.bloom && (
              <EffectComposer autoClear={false} multisampling={0}>
                <SelectiveBloom
                  mipmapBlur
                  intensity={1.55}
                  // Umbral CERO. Un umbral es un acantilado: lo que lo cruza se
                  // enciende y lo que no, no, así que basta con que la cámara se
                  // mueva un poco para que el borde del aura lo cruce una y otra
                  // vez — y eso se ve como parpadeo aunque el aura sea estable.
                  // Como el bloom es selectivo, no hace falta filtrar por brillo:
                  // solo entra lo que ya está elegido a mano.
                  luminanceThreshold={0}
                  luminanceSmoothing={0.9}
                  radius={0.8}
                />
              </EffectComposer>
            )}
          </Selection>

          <StudioLighting rimRef={rimRef} estilo={estilo} />
        </Suspense>

        <CameraRig onRim={handleRim} />
        {/* Va después del rig: proyecta con la cámara ya colocada de este frame. */}
        <MarcadorEscena />
        {import.meta.env.DEV && <SondaRenderer />}
      </Canvas>
    </div>
  )
}
