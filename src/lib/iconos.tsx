import { BookOpen, Car, Cog, Cpu, Flame, Gamepad2, Gem, Ghost, LayoutGrid, Orbit, Sparkles, Star, Sword, Sunset, ToyBrick, type LucideIcon } from 'lucide-react'
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
  manga: BookOpen,
  'seres-flemin': Orbit,
  munecos: ToyBrick,
  halloween: Ghost,
  'soportes-ps5': Gamepad2,
  accesorios: Gem,
}
