export const SPECIALTIES = [
  { id: "elec_plomb", label: "Électricité / Plomberie", color: "#C2622D" },
  { id: "menuiserie", label: "Menuiserie", color: "#3D5A4C" },
  { id: "libre", label: "Libre (chef d'équipe)", color: "#8A6D3B" },
];

export const CATEGORIES = [
  { id: "electricite", label: "Électricité", color: "#C2622D" },
  { id: "plomberie", label: "Plomberie", color: "#2D6A8C" },
  { id: "menuiserie", label: "Menuiserie", color: "#3D5A4C" },
  { id: "accastillage", label: "Accastillage", color: "#8A6D3B" },
  { id: "autre", label: "Autre", color: "#6B6B6B" },
];

export const STATUS_LABELS = {
  a_faire: { label: "À faire", color: "#8A6D3B", bg: "#F3EBD8" },
  en_cours: { label: "En cours", color: "#2D6A8C", bg: "#E3EDF2" },
  termine: { label: "Terminé", color: "#3D5A4C", bg: "#E2EAE5" },
};

export function specialtyMeta(id) {
  return SPECIALTIES.find((s) => s.id === id) || SPECIALTIES[2];
}

export function categoryMeta(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[4];
}

export const HOURS_PER_DAY = 5;

export function daysFor(hours) {
  const d = hours / HOURS_PER_DAY;
  if (d === 0) return "—";
  return d % 1 === 0 ? `${d} j` : `${Math.ceil(d)} j (${hours} h)`;
}
