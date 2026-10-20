import { Environment, Lightformer } from '@react-three/drei'

/**
 * Iluminación de estudio hecha con paneles de luz (los "Lightformers" de
 * drei), sin descargar ningún HDR: carga al instante, funciona sin conexión y
 * no depende de un CDN ajeno. Cada ambiente es un juego de softboxes, como
 * los presets de luz de Spline o KeyShot.
 */
export type Ambiente = 'estudio' | 'atardecer' | 'neon' | 'noche'

export function AmbienteFlemin({ ambiente, intensidad = 1 }: { ambiente: Ambiente; intensidad?: number }) {
  const k = intensidad
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={[ambiente === 'atardecer' ? '#2A1420' : '#0D0A14']} />
      {ambiente === 'estudio' && (
        <>
          {/* Softbox principal arriba, dos laterales y un contraluz. */}
          <Lightformer form="rect" intensity={3 * k} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[8, 8, 1]} />
          <Lightformer form="rect" intensity={1.6 * k} position={[-5, 1, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} />
          <Lightformer form="rect" intensity={1.2 * k} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
          <Lightformer form="ring" intensity={1 * k} position={[0, 2, -6]} scale={3} />
        </>
      )}
      {ambiente === 'atardecer' && (
        <>
          <Lightformer form="rect" intensity={3 * k} color="#FF8A3D" position={[-5, 1.5, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
          <Lightformer form="rect" intensity={1.4 * k} color="#FFC23D" position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[6, 6, 1]} />
          <Lightformer form="rect" intensity={0.8 * k} color="#8A3CFF" position={[5, 1, -2]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
        </>
      )}
      {ambiente === 'neon' && (
        <>
          <Lightformer form="rect" intensity={4 * k} color="#8A3CFF" position={[-5, 1, 0]} rotation-y={Math.PI / 2} scale={[6, 1.2, 1]} />
          <Lightformer form="rect" intensity={4 * k} color="#2FA8FF" position={[5, 1, 0]} rotation-y={-Math.PI / 2} scale={[6, 1.2, 1]} />
          <Lightformer form="rect" intensity={3 * k} color="#FF6A13" position={[0, 0.5, 5]} rotation-y={Math.PI} scale={[6, 0.8, 1]} />
          <Lightformer form="rect" intensity={1 * k} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[4, 4, 1]} />
        </>
      )}
      {ambiente === 'noche' && (
        <>
          <Lightformer form="circle" intensity={2 * k} color="#BFD8FF" position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={2} />
          <Lightformer form="rect" intensity={0.6 * k} color="#8A3CFF" position={[0, 1, -6]} scale={[8, 1, 1]} />
        </>
      )}
    </Environment>
  )
}
