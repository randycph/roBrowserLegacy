import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ hooks: new Map(), send: vi.fn(), visible: false, box: { addClose: vi.fn(), remove: vi.fn(), ownerID: 0 }, menu: { append: vi.fn(), setMenu: vi.fn(), remove: vi.fn() } }));
vi.mock('Network/NetworkManager.js', () => ({ default: { hookPacket: (packet, fn) => mocks.hooks.set(packet, fn), sendPacket: mocks.send } }));
vi.mock('UI/Components/NpcBox/NpcBox.js', () => ({ default: Object.assign(mocks.box, { ui: { is: () => mocks.visible } }) }));
vi.mock('UI/Components/NpcMenu/NpcMenu.js', () => ({ default: mocks.menu }));
vi.mock('UI/Components/InputBox/InputBox.js', () => ({ default: {} }));
vi.mock('DB/DBManager.js', () => ({ default: {} }));
vi.mock('Audio/SoundManager.js', () => ({ default: {} }));
vi.mock('Audio/BGM.js', () => ({ default: {} }));
vi.mock('Core/Client.js', () => ({ default: {} }));
vi.mock('Renderer/Renderer.js', () => ({ default: {} }));
vi.mock('UI/Components/WinPopup/WinPopup.js', () => ({ default: {} }));
vi.mock('UI/Components/MiniMap/MiniMap.js', () => ({ default: {} }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({ default: {} }));
vi.mock('UI/GUIComponent.js', () => ({ default: {} }));

const PACKET = (await import('Network/PacketStructure.js')).default;
const npcEngine = (await import('Engine/MapEngine/NPC.js')).default;
npcEngine();

describe('NPC dialog close', () => {
 beforeEach(() => { mocks.send.mockClear(); mocks.box.addClose.mockClear(); mocks.box.remove.mockClear(); mocks.menu.remove.mockClear(); mocks.visible = false; });
 it('acknowledges a server close even when the dialog is already gone', () => {
  mocks.hooks.get(PACKET.ZC.CLOSE_DIALOG)({ NAID: 1234 });
  expect(mocks.send).toHaveBeenCalledOnce();
  expect(mocks.send.mock.calls[0][0]).toBeInstanceOf(PACKET.CZ.CLOSE_DIALOG);
  expect(mocks.send.mock.calls[0][0].NAID).toBe(1234);
 });
 it('waits for the player to close a visible dialog', () => {
  mocks.visible = true;
  mocks.hooks.get(PACKET.ZC.CLOSE_DIALOG)({ NAID: 1234 });
  expect(mocks.box.addClose).toHaveBeenCalledWith(1234);
  expect(mocks.send).not.toHaveBeenCalled();
  mocks.box.onClosePressed(1234);
  expect(mocks.send.mock.calls[0][0].NAID).toBe(1234);
 });
 it('sends cancellation with the correct NPC id', () => {
  mocks.hooks.get(PACKET.ZC.MENU_LIST)({ NAID: 1234, msg: 'Buy:Cancel' });
  mocks.menu.onSelectMenu(1234, 255);
  expect(mocks.send.mock.calls[0][0]).toBeInstanceOf(PACKET.CZ.CHOOSE_MENU);
  expect(mocks.send.mock.calls[0][0]).toMatchObject({ NAID: 1234, num: 255 });
 });
});
