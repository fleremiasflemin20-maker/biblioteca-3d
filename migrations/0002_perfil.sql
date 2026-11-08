-- Club Flemin: nombre y gustos del socio (qué personajes y qué tipo de impresión busca).
ALTER TABLE usuarios ADD COLUMN nombre TEXT;
ALTER TABLE usuarios ADD COLUMN perfil TEXT; -- JSON, ver worker/perfil.ts
