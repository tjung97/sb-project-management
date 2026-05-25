export function avatarColor(uid: string) {
  let hash = 0;
  for (let i = 0; i < uid.length; i += 1) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hues = [210, 168, 262, 24, 340, 190, 45];
  const hue = hues[Math.abs(hash) % hues.length];
  return {
    background: `hsl(${hue} 62% 90%)`,
    color: `hsl(${hue} 48% 28%)`,
    ring: `hsl(${hue} 55% 72%)`,
  };
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}
