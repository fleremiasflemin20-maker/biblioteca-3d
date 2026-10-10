// ============================================================
//  Organizador de consola central - a medida
//  Cuerpo: PETG  |  Base antideslizante: TPU 95A
//  Impresora FDM. Unidades: mm.
//  Ajusta los parametros a tu consola y exporta STL.
// ============================================================

// -------------------- Parametros generales ------------------
W        = 230;   // ancho exterior de la bandeja
D        = 150;   // profundidad exterior
H        = 70;    // alto exterior
wall     = 2.4;   // espesor de paredes y divisores (6 lineas @0.4)
floor    = 2.0;   // espesor del piso de la bandeja
R        = 8;     // radio esquina exterior
r        = 4;     // radio esquina de cada compartimento
fn       = 64;    // suavizado de esquinas (24 para vista previa ligera)
fn_bump  = 20;    // suavizado de los bumps antideslizantes

// -------------------- Base TPU ------------------------------
wall_tpu = 2.4;   // espesor del marco TPU
base_t   = 2.5;   // piso del TPU
rim_h    = 6;     // altura del marco que abraza la bandeja
base_gap = 0.4;   // holgura bandeja <-> marco
antislip = true;  // false para piso liso
as_dx    = 14;    // separacion bumps antideslizantes
as_dy    = 14;
as_r     = 1.6;   // radio de cada bump

// -------------------- Vista ---------------------------------
part = "both";    // "tray" | "base" | "both"

// ============================================================
//  COMPARTIMENTOS  [x, y, w, d]  (esquina inferior-izq.)
//  Con W=230 / D=150 el layout por defecto es:
//    fila atras : TARJETAS + LENTES
//    fila frente: CELULAR  + MONEDAS
//  Edita SOLO esta lista para redimensionar cada hueco.
// ============================================================
comps = [
  [  2.4,  89.6,  90.0, 58.0 ],  // TARJETAS  (86x54 min.)
  [ 94.8,  89.6, 132.8, 58.0 ],  // LENTES    (plegados)
  [  2.4,   2.4, 190.0, 84.8 ],  // CELULAR
  [194.8,   2.4,  32.8, 84.8 ],  // MONEDAS
];

// ============================================================
//  Modulos
// ============================================================
module rcube_origin(w, d, h, rad) {
  hull()
    for (x = [rad, w - rad], y = [rad, d - rad])
      translate([x, y, 0]) cylinder(r = rad, h = h, $fn = fn);
}

module tray() {
  difference() {
    rcube_origin(W, D, H, R);
    for (c = comps)
      translate([c[0], c[1], floor])
        rcube_origin(c[2], c[3], H - floor + 1, r);
  }
}

module tpu_base() {
  difference() {
    rcube_origin(W + 2 * wall_tpu, D + 2 * wall_tpu, base_t + rim_h, R + wall_tpu);
    translate([wall_tpu - base_gap, wall_tpu - base_gap, base_t])
      rcube_origin(W + 2 * base_gap, D + 2 * base_gap, rim_h + 1, R);
  }
  if (antislip)
    for (x = [wall_tpu + as_dx/2 : as_dx : W + wall_tpu - as_dx/2])
      for (y = [wall_tpu + as_dy/2 : as_dy : D + wall_tpu - as_dy/2])
        translate([x, y, 0]) sphere(r = as_r, $fn = fn_bump);
}

// ============================================================
//  Render
// ============================================================
if (part == "tray")      color("SteelBlue")      tray();
else if (part == "base") color("DimGray")        tpu_base();
else {
  color("SteelBlue") tray();
  translate([-wall_tpu, -wall_tpu, -base_t]) color("DimGray") tpu_base();
}
