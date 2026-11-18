import { Car, Cog, Cpu, Flame, Frame, Gamepad2, Gem, Ghost, LayoutGrid, Orbit, Puzzle, Shield, Sparkles, Star, Sword, Sunset, ToyBrick, Zap, type LucideIcon } from 'lucide-react'
import type { CategoriaId } from './catalogo'

/** Un icono por sección, para las píldoras del filtro y las tarjetas. */
export const ICONO_CATEGORIA: Record<CategoriaId | 'todo', LucideIcon> = {
  todo: LayoutGrid,
  tecnologia: Cpu,
  mecanica: Cog,
  autos: Car,
  'dragon-ball-z': Flame,
  'caballeros-del-zodiaco': Star,
  'siete-pecados': Sword,
  'your-name': Sunset,
  anime: Sparkles,
  marvel: Shield,
  dc: Zap,
  'seres-flemin': Orbit,
  munecos: ToyBrick,
  halloween: Ghost,
  'soportes-ps5': Gamepad2,
  accesorios: Gem,
  'cuadros-3d': Frame,
  'rompecabezas-3d': Puzzle,
}
