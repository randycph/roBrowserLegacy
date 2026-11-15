export function withinRadius(x, y, origin, radius) {
 const dx = x - origin.x, dy = y - origin.y;
 return dx * dx + dy * dy <= radius * radius;
}
export function pathWithinRadius(path, count, origin, radius) {
 if (count < 1) return false;
 for (let i = 0; i < count; i++) if (!withinRadius(path[i * 2], path[i * 2 + 1], origin, radius)) return false;
 return true;
}
export function closestAllowed(entities, player, origin, radius, selected, findPath) {
 let best = null, bestDistance = Infinity;
 for (const entity of entities) {
  if (entity.objecttype !== player.constructor.TYPE_MOB || entity.action === entity.ACTION.DIE || entity.remove_tick !== 0) continue;
  if (selected && !selected.has(Number(entity._job))) continue;
  const x = entity.position[0] | 0, y = entity.position[1] | 0;
  if (!withinRadius(x, y, origin, radius)) continue;
  const dx = entity.position[0] - player.position[0], dy = entity.position[1] - player.position[1];
  const distance = dx * dx + dy * dy;
  if (distance >= bestDistance || !findPath(entity)) continue;
  best = entity; bestDistance = distance;
 }
 return best;
}
