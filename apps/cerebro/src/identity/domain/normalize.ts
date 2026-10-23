/**
 * Normalización determinística de identificadores (Arquitectura §5):
 *   email  -> lowercase + trim
 *   phone  -> E.164 (quita separadores; "00" inicial -> "+"; exige país)
 *   handle -> sin '@' + lowercase
 *   local_id -> trim (opaco de la plataforma; su unicidad es por plataforma)
 *
 * `id_normalized` es la forma canónica del match determinístico (confidence 1.0).
 * El fuzzy vendrá después, con confidence < 1.0 + revisión.
 */
import type { IdType } from "@raisen/cerebro-contracts";
import { type Result, ok, err } from "../../shared/result.js";
import type { NormalizeError } from "./identity.errors.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_RE = /^\+[1-9]\d{6,14}$/;
const HANDLE_RE = /^[a-z0-9._]{1,100}$/;

export function normalizeIdentity(
  id_type: IdType,
  id_value: string,
): Result<string, NormalizeError> {
  const trimmed = id_value.trim();
  if (trimmed === "") return err({ kind: "empty_value", id_type });

  switch (id_type) {
    case "email": {
      const normalized = trimmed.toLowerCase();
      if (!EMAIL_RE.test(normalized)) return err({ kind: "invalid_email", value: id_value });
      return ok(normalized);
    }
    case "phone": {
      const normalized = normalizePhone(trimmed);
      if (!E164_RE.test(normalized)) return err({ kind: "invalid_phone", value: id_value });
      return ok(normalized);
    }
    case "social_handle": {
      const normalized = trimmed.replace(/^@+/, "").toLowerCase();
      if (!HANDLE_RE.test(normalized)) return err({ kind: "invalid_handle", value: id_value });
      return ok(normalized);
    }
    case "local_id":
      // Opaco de la plataforma origen: solo trim, NO lowercase (puede ser
      // case-sensitive). Su unicidad es por (source_platform, id_type, id_normalized).
      return ok(trimmed);
  }
}

/**
 * E.164 determinístico y conservador: quita separadores comunes y mapea "00"
 * inicial a "+". NO infiere el país de un número sin prefijo — eso lo rechaza
 * el regex E.164 aguas arriba (mejor fallar que adivinar e identificar mal).
 * El refinamiento con libphonenumber-grade queda como deuda documentada.
 */
function normalizePhone(raw: string): string {
  let s = raw.replace(/[\s().-]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  const hasPlus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");
  return hasPlus ? "+" + digits : digits;
}
