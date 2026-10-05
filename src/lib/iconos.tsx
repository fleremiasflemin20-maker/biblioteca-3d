import { BookOpen, Car, Cog, Cpu, Gem, LayoutGrid, Orbit, Sparkles, type LucideIcon } from 'lucide-react'
import type { CategoriaId } from './catalogo'

/** Un icono por sección, para las píldoras del filtro y las tarjetas. */
export const ICONO_CATEGORIA: Record<CategoriaId | 'todo', LucideIcon> = {
  todo: LayoutGrid,
  tecnologia: Cpu,
  mecanica: Cog,
  autos: Car,
  anime: Sparkles,
  manga: BookOpen,
  'seres-flemin': Orbit,
  accesorios: Gem,
}
