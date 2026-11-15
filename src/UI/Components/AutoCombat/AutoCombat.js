import DB from 'DB/DBManager.js';
import SelfBuffs from './SelfBuffs.js?v=selfbuff1';
import StatusIcons from 'UI/Components/StatusIcons/StatusIcons.js';
import MonsterNames from 'DB/Monsters/MonsterNameTable.js';
import MapSpawns from './MapSpawns.js?v=mapmobs1';
import MapRenderer from 'Renderer/MapRenderer.js';
import Altitude from 'Renderer/Map/Altitude.js';
import { withinRadius, pathWithinRadius, closestAllowed } from './Roaming.js?v=combat2';
import Session from 'Engine/SessionStorage.js';
import EntityManager from 'Renderer/EntityManager.js';
import PathFinding from 'Utils/PathFinding.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import PACKETVER from 'Network/PacketVerManager.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import SkillList from 'UI/Components/SkillList/SkillList.js';
import AutoLoot from 'UI/Components/AutoLoot/AutoLoot.js';
import GUIComponent from 'UI/GUIComponent.js';
import UIManager from 'UI/UIManager.js';
import htmlText from './AutoCombat.html?raw&v=selfbuff1';
import cssText from './AutoCombat.css?raw&v=combat2';

const AutoCombat = new GUIComponent('AutoCombat', cssText);
AutoCombat.render = () => htmlText;
let running = false, mapReady = false, timer = null, lastAttack = 0, lastSkill = 0, lastPotion = 0, lastTarget = 0;
let settings = {}, skillIndex = 0, origin = null, lastRoam = 0;
const buffAttempts = new Map();
let lastBuffCast = 0;
const chosenMonsters = new Set();
let selectionMap = '';
const blockedTargets = new Map();
let targetProgress = null;
let preferenceKey = '', saved = {}, transitioning = false, awaitingFly = false, flyRequestedAt = 0, lastFly = 0;
const defaults = { radius: '10', monsterMode: 'all', skill: false, skillIds: [], buffs: false, buffIds: [], buffLevel: '1', level: '1', interval: '3', recovery: false, potion: '', resource: 'hp', threshold: '50', fly: false, flyThreshold: '20', monstersByMap: {} };
function characterKey() { return `ragnarokforever.autocombat.${Session.AID}.${Session.GID}`; }
function loadPreferences() {
 const key = characterKey(); if (key === preferenceKey) return;
 preferenceKey = key; let stored = {};
 try { stored = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (_) { stored = {}; }
 saved = { ...defaults, ...stored, monstersByMap: stored.monstersByMap && typeof stored.monstersByMap === 'object' ? stored.monstersByMap : {} };
 selectionMap = ''; chosenMonsters.clear();
 const r = root();
 for (const [selector, key] of [['.radius','radius'],['.monster-mode','monsterMode'],['.level','level'],['.interval','interval'],['.resource','resource'],['.threshold','threshold'],['.fly-threshold','flyThreshold'],['.buff-level','buffLevel']]) r.querySelector(selector).value = saved[key];
 for (const [selector, key] of [['.auto-skill','skill'],['.auto-recovery','recovery'],['.auto-fly','fly'],['.auto-buff','buffs']]) r.querySelector(selector).checked = !!saved[key];
 r.querySelector('.skill').replaceChildren(); r.querySelector('.buffs').replaceChildren(); r.querySelector('.potion').replaceChildren();
 updateOptions();
}
function savePreferences() {
 if (!preferenceKey) return;
 const r = root();
 for (const [selector, key] of [['.radius','radius'],['.monster-mode','monsterMode'],['.level','level'],['.interval','interval'],['.resource','resource'],['.threshold','threshold'],['.fly-threshold','flyThreshold'],['.buff-level','buffLevel']]) saved[key] = r.querySelector(selector).value;
 for (const [selector, key] of [['.auto-skill','skill'],['.auto-recovery','recovery'],['.auto-fly','fly'],['.auto-buff','buffs']]) saved[key] = r.querySelector(selector).checked;
 const skill = r.querySelector('.skill'); if (skill.options.length) saved.skillIds = [...skill.selectedOptions].map(option => option.value);
 const buffs = r.querySelector('.buffs'); if (buffs.options.length) saved.buffIds = [...buffs.selectedOptions].map(option => option.value);
 const potion = r.querySelector('.potion'); if (potion.options.length) saved.potion = potion.value;
 if (selectionMap) saved.monstersByMap[selectionMap] = [...chosenMonsters];
 try { localStorage.setItem(preferenceKey, JSON.stringify(saved)); } catch (_) { /* Storage is optional. */ }
}
const number = (value, fallback, min, max) => Math.max(min, Math.min(max, Number(value) || fallback));
const root = () => AutoCombat.getRoot();
function state(message) { if (AutoCombat._host) root().querySelector('.status').textContent = message; }
function selectedItem(id) { return Inventory.getItemById(Number(id)); }
function useItem(id) { const item = selectedItem(id); if (!item || item.count <= 0) return false; Inventory.useItem(item); return true; }
function syncButtons() { if (!AutoCombat._host) return; root().querySelector('.start').disabled = running; root().querySelector('.stop').disabled = !running; }
function stop(message = 'Stopped') { transitioning = false; awaitingFly = false; running = false; clearInterval(timer); timer = null; Session.moveAction = null; targetProgress = null; blockedTargets.clear(); buffAttempts.clear(); lastBuffCast = 0; syncButtons(); state(message); }
function healthPercent(life, name) { const current = life?.[name], max = life?.[name + '_max']; return max > 0 && current >= 0 ? 100 * current / max : null; }
function tick() {
 if (!running || !mapReady || !Session.Playing || !Session.Entity) return;
 const player = Session.Entity, hp = healthPercent(player.life, 'hp'), sp = healthPercent(player.life, 'sp'), now = Date.now();
 if (player.action === player.ACTION.DIE || hp === 0) { stop('Stopped: character defeated'); return; }
 if (awaitingFly) {
  if (now - flyRequestedAt > 8000) stop('Stopped: Fly Wing did not teleport');
  return;
 }
 if (settings.fly && hp !== null && hp < settings.flyThreshold && now - lastFly >= 15000) {
  if (!useItem(601)) { stop('Stopped: no Fly Wings'); return; }
  awaitingFly = true; flyRequestedAt = now; lastFly = now; state('Waiting for Fly Wing'); return;
 }
 const value = settings.resource === 'sp' ? sp : hp;
 if (settings.recovery && value !== null && value < settings.threshold && now - lastPotion >= 2000) {
  if (!useItem(settings.potion)) { stop('Stopped: selected potion unavailable'); return; }
  lastPotion = now; return;
 }
 if (!origin || !withinRadius(Math.round(player.position[0]), Math.round(player.position[1]), origin, settings.radius)) { stop('Stopped: outside roaming area'); return; }
 if (settings.buffs && now - lastBuffCast >= 2000) {
  for (const id of settings.buffIds) {
   const skill = SkillList.getSkillById(id), status = SelfBuffs[id];
   if (!skill || !skill.level || status === undefined || !(skill.type & (4 | 16))) { stop('Stopped: selected buff unavailable'); return; }
   if (StatusIcons.hasStatus(status) || now - (buffAttempts.get(id) || 0) < 6000) continue;
   buffAttempts.set(id, now); lastBuffCast = now;
   SkillList.onUseSkill(id, Math.min(settings.buffLevel, skill.level), player.GID);
   state('Running: casting self buff'); return;
  }
 }
 for (const [gid, until] of blockedTargets) if (now >= until) blockedTargets.delete(gid);
 const entities = []; EntityManager.forEach(entity => { if (!blockedTargets.has(entity.GID)) entities.push(entity); });
 const target = closestAllowed(entities, player, origin, settings.radius, settings.monsters, entity => {
  const route = []; const count = PathFinding.search(player.position[0] | 0, player.position[1] | 0, entity.position[0] | 0, entity.position[1] | 0, 0, route);
  return pathWithinRadius(route, count, origin, settings.radius);
 });
 if (!target) {
  state('Running: roaming for monsters');
  if (player.action === player.ACTION.WALK || now - lastRoam < 3500) return;
  lastRoam = now;
  for (let attempt = 0; attempt < 16; attempt++) {
   const x = origin.x + Math.floor(Math.random() * (2 * settings.radius + 1)) - settings.radius;
   const y = origin.y + Math.floor(Math.random() * (2 * settings.radius + 1)) - settings.radius;
   if (!withinRadius(x, y, origin, settings.radius) || !(Altitude.getCellType(x, y) & Altitude.TYPE.WALKABLE)) continue;
   const route = []; const count = PathFinding.search(player.position[0] | 0, player.position[1] | 0, x, y, 0, route);
   if (count < 2 || !pathWithinRadius(route, count, origin, settings.radius)) continue;
   Session.moveAction = null;
   const move = PACKETVER.value >= 20180307 ? new PACKET.CZ.REQUEST_MOVE2() : new PACKET.CZ.REQUEST_MOVE();
   move.dest[0] = route[(count - 1) * 2]; move.dest[1] = route[(count - 1) * 2 + 1]; Network.sendPacket(move); return;
  }
  return;
 }
 const px = Math.round(player.position[0]), py = Math.round(player.position[1]);
 const targetHP = target.life?.hp >= 0 ? target.life.hp : null;
 const hitTick = target._deathSyncTick || 0;
 if (!targetProgress || targetProgress.gid !== target.GID) {
  targetProgress = { gid: target.GID, x: px, y: py, hp: targetHP, hitTick, since: now };
 } else if (px !== targetProgress.x || py !== targetProgress.y || (targetHP !== null && targetHP !== targetProgress.hp) || hitTick !== targetProgress.hitTick || target.action === target.ACTION.HURT) {
  Object.assign(targetProgress, { x: px, y: py, hp: targetHP, hitTick, since: now });
 } else if (now - targetProgress.since >= 12000) {
  blockedTargets.set(target.GID, now + 15000); targetProgress = null; Session.moveAction = null; lastTarget = 0;
  state('Running: skipping unreachable monster'); return;
 }
 if (settings.skill && now - lastSkill >= settings.interval * 1000) {
  const skill = SkillList.getSkillById(settings.skillIds[skillIndex % settings.skillIds.length]);
  if (!skill || !skill.level || !(skill.type & 1)) { stop('Stopped: selected skill unavailable'); return; }
  const skillPath = []; const skillRange = (skill.attackRange || player.attack_range || 1) + 1;
  const skillCount = PathFinding.search(player.position[0] | 0, player.position[1] | 0, target.position[0] | 0, target.position[1] | 0, skillRange, skillPath);
  if (!pathWithinRadius(skillPath, skillCount, origin, settings.radius)) { blockedTargets.set(target.GID, now + 15000); targetProgress = null; return; }
  SkillList.onUseSkill(skill.SKID, Math.min(settings.level, skill.level), target.GID);
  skillIndex++; lastSkill = now; state('Running: using skill'); return;
 }
 if (target.GID === lastTarget && now - lastAttack < 1200) return;
 const path = [];
 const count = PathFinding.search(player.position[0] | 0, player.position[1] | 0, target.position[0] | 0, target.position[1] | 0, player.attack_range + 1, path);
 if (!pathWithinRadius(path, count, origin, settings.radius)) { blockedTargets.set(target.GID, now + 15000); targetProgress = null; return; }
 const attack = PACKETVER.value >= 20180307 ? new PACKET.CZ.REQUEST_ACT2() : new PACKET.CZ.REQUEST_ACT();
 attack.action = 0; attack.targetGID = target.GID;
 if (count < 2) Network.sendPacket(attack);
 else { Session.moveAction = attack; const move = PACKETVER.value >= 20180307 ? new PACKET.CZ.REQUEST_MOVE2() : new PACKET.CZ.REQUEST_MOVE(); move.dest[0] = path[(count - 1) * 2]; move.dest[1] = path[(count - 1) * 2 + 1]; Network.sendPacket(move); }
 lastTarget = target.GID; lastAttack = now; state('Running: attacking');
}
function renderMonsters() {
 const list = root().querySelector('.monster-list');
 const currentMap = String(MapRenderer.currentMap || '').replace(/\.(?:gat|rsw)$/i, '').toLowerCase();
 if (currentMap !== selectionMap) { chosenMonsters.clear(); selectionMap = currentMap; for (const id of saved.monstersByMap?.[currentMap] || []) chosenMonsters.add(Number(id)); root().querySelector('.monster-search').value = ''; }
 const filter = root().querySelector('.monster-search').value.trim().toLowerCase();
 const monsters = new Map((MapSpawns[currentMap] || []).map(id => [Number(id), MonsterNames[id] || `Monster #${id}`]));
 EntityManager.forEach(entity => {
  if (entity.objecttype !== Session.Entity?.constructor.TYPE_MOB || entity.remove_tick !== 0) return;
  const id = Number(entity._job);
  if (id > 0 && !monsters.has(id)) monsters.set(id, MonsterNames[id] || entity.display?.name || `Monster #${id}`);
 });
 const entries = [...monsters].filter(([id, name]) => String(name).toLowerCase().includes(filter) || String(id).includes(filter)).sort((a, b) => String(a[1]).localeCompare(String(b[1])));
 list.replaceChildren();
 for (const [id, name] of entries) { const option = new Option(name, String(id)); option.selected = chosenMonsters.has(id); list.add(option); }
 root().querySelector('.monster-availability').textContent = monsters.size ? `${monsters.size} monster types on this map` : 'No known monsters on this map';
 root().querySelector('.monster-count').textContent = `${chosenMonsters.size} selected`;
}
function updateOptions() {
 root().querySelector('.monster-options').hidden = root().querySelector('.monster-mode').value !== 'selected';
 for (const [checkbox, section] of [['.auto-skill','.skill-options'],['.auto-buff','.buff-options'],['.auto-recovery','.recovery-options'],['.auto-fly','.fly-options']]) root().querySelector(section).hidden = !root().querySelector(checkbox).checked;
}
function populate() {
 const r = root(), skills = r.querySelector('.skill'), buffs = r.querySelector('.buffs'), potions = r.querySelector('.potion');
 const oldSkills = new Set(saved.skillIds || []), oldPotion = String(saved.potion || '');
 skills.replaceChildren(); buffs.replaceChildren();
 const skillRoot = SkillList._host && SkillList.getRoot();
 const ids = new Set();
 skillRoot?.querySelectorAll('.skill[data-index]').forEach(el => ids.add(Number(el.dataset.index)));
 for (const id of ids) { const skill = SkillList.getSkillById(id); if (skill?.level > 0 && (skill.type & 1)) skills.add(new Option(`${DB.getSkillName(id)} (Lv ${skill.level})`, String(id))); }
 for (const id of ids) { const skill = SkillList.getSkillById(id); if (SelfBuffs[id] !== undefined && skill?.level > 0 && (skill.type & (4 | 16))) buffs.add(new Option(`${DB.getSkillName(id)} (Lv ${skill.level})`, String(id))); }
 potions.replaceChildren(new Option('Select a recovery item', ''));
 const found = new Set();
 for (const item of Inventory.list || []) { if (item.type !== 0 || item.count <= 0 || found.has(item.ITID)) continue; found.add(item.ITID); potions.add(new Option(DB.getItemName(item), String(item.ITID))); }
 const oldBuffs = new Set((saved.buffIds || []).map(String));
 for (const id of oldBuffs) if (![...buffs.options].some(option => option.value === id)) buffs.add(new Option(`Unavailable buff #${id}`, id));
 for (const option of buffs.options) option.selected = oldBuffs.has(option.value);
 for (const id of oldSkills) if (![...skills.options].some(option => option.value === String(id))) skills.add(new Option(`Unavailable skill #${id}`, String(id)));
 if (oldPotion && ![...potions.options].some(option => option.value === oldPotion)) potions.add(new Option(`Unavailable item #${oldPotion}`, oldPotion));
 for (const option of skills.options) option.selected = oldSkills.has(option.value); potions.value = oldPotion;
}
AutoCombat.init = function init() {
 const r = root(); this.draggable('.titlebar');
 r.querySelector('.auto-loot').addEventListener('change', event => AutoLoot.setEnabled(event.target.checked));
 r.querySelector('.monster-mode').addEventListener('change', updateOptions);
 r.querySelector('.content').addEventListener('change', event => { if (!event.target.matches('.auto-loot, .monster-search')) savePreferences(); });
 r.querySelector('.content').addEventListener('input', event => { if (event.target.matches('input[type=number]')) savePreferences(); });
 r.querySelector('.monster-search').addEventListener('input', renderMonsters);
 r.querySelector('.monster-list').addEventListener('change', event => {
  for (const option of event.target.options) { const id = Number(option.value); if (option.selected) chosenMonsters.add(id); else chosenMonsters.delete(id); }
  r.querySelector('.monster-count').textContent = `${chosenMonsters.size} selected`;
 });
 r.querySelector('.close').addEventListener('click', () => { this._host.style.display = 'none'; });
 for (const selector of ['.auto-skill','.auto-buff','.auto-recovery','.auto-fly']) r.querySelector(selector).addEventListener('change', updateOptions);
 r.querySelector('.stop').addEventListener('click', () => stop());
 r.querySelector('.start').addEventListener('click', () => {
  if (running) return;
  settings = { radius: number(r.querySelector('.radius').value,10,1,30), monsters: r.querySelector('.monster-mode').value === 'selected' ? new Set(chosenMonsters) : null, buffs: r.querySelector('.auto-buff').checked, buffIds: [...r.querySelector('.buffs').selectedOptions].map(option => Number(option.value)), buffLevel: number(r.querySelector('.buff-level').value,1,1,99), skill: r.querySelector('.auto-skill').checked, skillIds: [...r.querySelector('.skill').selectedOptions].map(option => Number(option.value)), level: number(r.querySelector('.level').value,1,1,99), interval: number(r.querySelector('.interval').value,3,2,60), recovery: r.querySelector('.auto-recovery').checked, potion: Number(r.querySelector('.potion').value), resource: r.querySelector('.resource').value, threshold: number(r.querySelector('.threshold').value,50,1,99), fly: r.querySelector('.auto-fly').checked, flyThreshold: number(r.querySelector('.fly-threshold').value,20,1,99) };
  if (settings.monsters && !settings.monsters.size) { state('Choose at least one monster'); return; }
  if (settings.buffs && (!settings.buffIds.length || settings.buffIds.some(id => { const skill = SkillList.getSkillById(id); return SelfBuffs[id] === undefined || !skill?.level || !(skill.type & (4 | 16)); }))) { state('Choose available self buffs'); return; }
  if (settings.skill && !settings.skillIds.length) { state('Choose a learned attack skill'); return; }
  if (settings.recovery && (!settings.potion || !selectedItem(settings.potion))) { state('Choose an available recovery item'); return; }
  if (settings.skill && settings.skillIds.some(id => { const skill = SkillList.getSkillById(id); return !skill || !skill.level || !(skill.type & 1); })) { state('Selected skill is unavailable'); return; }
  if (settings.fly && !selectedItem(601)) { state('Fly Wings are not in your inventory'); return; }
  if (!mapReady || !Session.Playing) { state('Wait until the map has loaded'); return; }
  savePreferences(); stop(); lastFly = 0; origin = { x: Math.round(Session.Entity.position[0]), y: Math.round(Session.Entity.position[1]) }; running = true; lastAttack = lastSkill = lastPotion = lastTarget = skillIndex = lastRoam = 0; syncButtons(); state('Running'); timer = setInterval(tick, 500); tick();
 });
 updateOptions(); syncButtons();
};
AutoCombat.onAppend = function onAppend() { loadPreferences(); this._host.style.left = '220px'; this._host.style.top = '150px'; this._host.style.display = 'none'; root().querySelector('.auto-loot').checked = AutoLoot.getEnabled(); updateOptions(); syncButtons(); };
AutoCombat.toggle = function toggle() { if (this._host.style.display === 'none') { root().querySelector('.auto-loot').checked = AutoLoot.getEnabled(); syncButtons(); populate(); renderMonsters(); this._host.style.display = ''; this.focus(); } else this._host.style.display = 'none'; };
AutoCombat.stop = function () { stop(); };
AutoCombat.mapLoading = function (nextMap) {
 mapReady = false; lastTarget = 0;
 const normalize = map => String(map || '').replace(/\.(?:gat|rsw)$/i, '').toLowerCase();
 transitioning = running && normalize(nextMap) && normalize(nextMap) === normalize(MapRenderer.currentMap);
 if (running && !transitioning) stop('Stopped: map changed');
 else if (transitioning) { Session.moveAction = null; state('Waiting for teleport'); }
};
AutoCombat.mapReady = function () {
 mapReady = true;
 if (running && transitioning && Session.Entity) {
  origin = { x: Math.round(Session.Entity.position[0]), y: Math.round(Session.Entity.position[1]) };
  targetProgress = null; blockedTargets.clear(); lastTarget = lastAttack = lastRoam = 0; awaitingFly = false; state('Running');
 }
 transitioning = false;
};
AutoCombat.onRemove = function () { mapReady = false; if (!transitioning) stop(); };
export default UIManager.addComponent(AutoCombat);
