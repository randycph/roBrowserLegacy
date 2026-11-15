import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ hooks: new Map(), send: vi.fn(), store: { Type: { BUY: 0, SELL: 1, MARKETSHOP: 4, BARTER_MARKET: 5 }, append: vi.fn(), setType: vi.fn(), setList: vi.fn() } }));
vi.mock('Network/NetworkManager.js', () => ({ default: { hookPacket: (p, fn) => mocks.hooks.set(p, fn), sendPacket: mocks.send } }));
vi.mock('UI/Components/NpcStore/NpcStore.js', () => ({ default: mocks.store }));
vi.mock('DB/DBManager.js', () => ({ default: {} }));
vi.mock('Renderer/EntityManager.js', () => ({ default: {} }));
vi.mock('UI/Components/Inventory/Inventory.js', () => ({ default: {} }));
vi.mock('UI/Components/Vending/Vending.js', () => ({ default: {} }));
vi.mock('UI/Components/Vending/VendingReport.js', () => ({ default: {} }));
vi.mock('UI/Components/VendingShop/VendingShop.js', () => ({ default: {} }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({ default: {} }));
const PACKET = (await import('Network/PacketStructure.js')).default;
const PacketRegister = (await import('Network/PacketRegister.js')).default;
const PACKETVER = (await import('Network/PacketVerManager.js')).default;
const BinaryReader = (await import('Utils/BinaryReader.js')).default;
const initStore = (await import('Engine/MapEngine/Store.js')).default;
const u16 = n => [n & 255, n >>> 8 & 255];
const u32 = n => [...u16(n), ...u16(n >>> 16)];
function read(ctor, bytes) { const buffer = new Uint8Array(bytes).buffer; return new ctor(new BinaryReader(buffer), buffer.byteLength); }
describe('2020 NPC merchant shops', () => {
 it('opens and parses market and quiver lists using distinct registered opcodes', () => {
  PACKETVER.value = 20200401;
  initStore();
  const market = read(PacketRegister[0x9d5], [...u32(1750), 10, ...u32(2), ...u32(100), ...u16(1)]);
  mocks.hooks.get(PacketRegister[0x9d5])(market);
  expect(mocks.store.setType).toHaveBeenLastCalledWith(mocks.store.Type.MARKETSHOP);
  expect(mocks.store.setList).toHaveBeenLastCalledWith([expect.objectContaining({ ITID: 1750, price: 2, qty: 100 })]);
  const barter = read(PacketRegister[0xb0e], [...u32(12100), 2, ...u32(10), ...u32(1750), ...u32(500), ...u32(10), ...u32(0)]);
  mocks.hooks.get(PacketRegister[0xb0e])(barter);
  expect(mocks.store.setType).toHaveBeenLastCalledWith(mocks.store.Type.BARTER_MARKET);
  expect(mocks.store.setList).toHaveBeenLastCalledWith([expect.objectContaining({ ITID: 12100, currencyITID: 1750, currencyamount: 500 })]);
  expect(PacketRegister[0xb0e]).not.toBe(PACKET.ZC.NPC_BARTER_MARKET_ITEMINFO);
 });
 it('keeps the ordinary sell window available', () => {
  mocks.hooks.get(PACKET.ZC.PC_SELL_ITEMLIST)({ itemList: [] });
  expect(mocks.store.setType).toHaveBeenLastCalledWith(mocks.store.Type.SELL);
 });
});
