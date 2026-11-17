-- Paquetes: quién compró cada paquete de descarga (se activa a mano tras el pago).
CREATE TABLE IF NOT EXISTS compras (
  usuario_id TEXT NOT NULL,
  paquete TEXT NOT NULL,        -- id de src/data/paquetes.json
  fecha INTEGER NOT NULL,
  PRIMARY KEY (usuario_id, paquete)
);
