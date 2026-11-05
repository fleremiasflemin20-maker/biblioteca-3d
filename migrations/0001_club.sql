-- Club Flemin: cuentas, sesiones, suscripciones y registro de descargas.
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  correo TEXT NOT NULL UNIQUE,
  clave TEXT NOT NULL,          -- pbkdf2$iteraciones$sal$hash
  creado INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sesiones (
  token TEXT PRIMARY KEY,       -- SHA-256 del token de la cookie, nunca el token
  usuario_id TEXT NOT NULL,
  expira INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sesiones_usuario ON sesiones (usuario_id);

CREATE TABLE IF NOT EXISTS suscripciones (
  usuario_id TEXT PRIMARY KEY,
  proveedor TEXT NOT NULL,      -- 'paypal' | 'manual'
  referencia TEXT,              -- id de la suscripción de PayPal (I-XXXX)
  estado TEXT NOT NULL,         -- ACTIVE, CANCELLED, SUSPENDED, EXPIRED, MANUAL…
  vence INTEGER NOT NULL,       -- ms: hasta cuándo puede descargar
  actualizado INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS suscripciones_ref ON suscripciones (referencia);

CREATE TABLE IF NOT EXISTS intentos (
  correo TEXT NOT NULL,
  fecha INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS intentos_correo ON intentos (correo, fecha);

CREATE TABLE IF NOT EXISTS descargas (
  usuario_id TEXT NOT NULL,
  clave TEXT NOT NULL,
  fecha INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS descargas_usuario ON descargas (usuario_id, fecha);
