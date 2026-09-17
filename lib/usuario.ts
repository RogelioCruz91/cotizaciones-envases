const KEY = "env_usuario_nombre";

export function getUsuario(): string {
  try {
    return localStorage.getItem(KEY) || "Usuario";
  } catch {
    return "Usuario";
  }
}

export function setUsuario(nombre: string) {
  try {
    localStorage.setItem(KEY, nombre.trim() || "Usuario");
  } catch { /* noop */ }
}

export function hayUsuario(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    return !!v && v !== "Usuario";
  } catch {
    return false;
  }
}
