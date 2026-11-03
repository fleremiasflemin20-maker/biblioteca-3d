import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { QUALITY } from '../lib/quality'
import { ELEGIDA, type Figura as DatosFigura } from '../lib/figura'
import { scroll } from '../lib/scroll-state'
import { intro } from '../lib/intro'
import { crearRampaToon } from '../lib/toon-gradient'
import type { Estilo } from '../lib/estilo'
import type { Etapa } from '../lib/etapa'

/**
 * El personaje elegido, con los mismos dos renders y las mismas etapas del
 * "cómo se hizo" que el Gogeta original.
 *
 * El Gogeta traía cuatro mapas PBR sueltos; las figuras de la biblioteca
 * (Meshy, Tripo) traen el color horneado en su propio material. Así que en vez
 * de montar un material desde cero, se parte del de cada pieza del `.glb` y se
 * le cambia el sombreado: toon con el mismo difuso para "anime", el material
 * original para "realista".
 */

/** El color del pelo que brilla, si el personaje lo tiene (ver `brillo`). */
const BRILLO = new THREE.Color(ELEGIDA?.personaje.brillo ?? '#000000')

export function Figura({ figura, estilo, etapa }: { figura: DatosFigura; estilo: Estilo; etapa: Etapa }) {
  const kiGlow = useRef({ value: 0 })

  // El material original de cada pieza, tomado una sola vez.
  const originales = useMemo(() => {
    const mapa = new Map<THREE.Mesh, THREE.MeshStandardMaterial>()
    figura.escena.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) mapa.set(m, m.material as THREE.MeshStandardMaterial)
    })
    return mapa
  }, [figura])

  useLayoutEffect(() => {
    /*
     * El pelo emite luz propia. En el Gogeta la máscara salía del rojo del
     * difuso; aquí cada personaje dice cuál es el color de su pelo y el shader
     * enciende lo que se le parece en tono y saturación. La piel, que también
     * es cálida, queda fuera por saturación.
     */
    const conBrillo = <M extends THREE.Material>(mat: M): M => {
      if (!ELEGIDA?.personaje.brillo) return mat
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uKiGlow = kiGlow.current
        shader.uniforms.uBrillo = { value: BRILLO }
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uKiGlow;\nuniform vec3 uBrillo;')
          .replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
             vec3 cBase = diffuseColor.rgb;
             float sat = max(cBase.r, max(cBase.g, cBase.b)) - min(cBase.r, min(cBase.g, cBase.b));
             float tono = dot(normalize(cBase + 1e-4), normalize(uBrillo + 1e-4));
             float parecido = smoothstep(0.955, 0.99, tono) * smoothstep(0.22, 0.45, sat);
             totalEmissiveRadiance += cBase * parecido * uKiGlow;`,
          )
      }
      return mat
    }

    const creados: THREE.Material[] = []
    const nuevo = <M extends THREE.Material>(m: M) => {
      creados.push(m)
      return m
    }

    for (const [mesh, orig] of originales) {
      const map = orig.map ?? null
      let mat: THREE.Material

      if (etapa === 'malla') {
        mat = nuevo(new THREE.MeshBasicMaterial({ color: '#15151A', wireframe: true, transparent: true, opacity: 0.32 }))
      } else if (etapa === 'volumen') {
        mat = nuevo(
          new THREE.MeshStandardMaterial({ color: '#C6C2BC', normalMap: orig.normalMap ?? null, roughness: 0.82, metalness: 0 }),
        )
      } else if (etapa === 'color') {
        mat = nuevo(new THREE.MeshBasicMaterial({ map, color: map ? '#ffffff' : orig.color }))
      } else if (estilo === 'anime') {
        mat = nuevo(
          conBrillo(
            new THREE.MeshToonMaterial({
              map,
              color: map ? '#ffffff' : orig.color,
              normalMap: orig.normalMap ?? null,
              gradientMap: crearRampaToon(),
            }),
          ),
        )
      } else {
        const real = orig.clone()
        real.envMapIntensity = 0.85
        real.dithering = true
        mat = nuevo(conBrillo(real))
      }
      mesh.material = mat
    }

    return () => {
      for (const [mesh, orig] of originales) mesh.material = orig
      for (const m of creados) m.dispose()
    }
  }, [originales, estilo, etapa])

  useFrame(() => {
    kiGlow.current.value = 2.2 * THREE.MathUtils.smoothstep(scroll.progress, 0.2, 0.85) + intro.flash * 3.4
  })

  return (
    <group scale={QUALITY.scale}>
      {/* El cuerpo de arcilla bajo el alambre de la etapa "malla". */}
      {etapa === 'malla' && (
        <mesh geometry={figura.silueta} frustumCulled={false} receiveShadow>
          <meshStandardMaterial
            color="#C6C2BC"
            roughness={0.85}
            metalness={0}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
      )}
      <primitive object={figura.escena} />
    </group>
  )
}
