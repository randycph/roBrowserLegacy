/**
 * UI/Components/InventoryV3/InventoryV3.js
 *
 * Chararacter Inventory
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 * In some cases the client will send packet twice.eg NORMAL_ITEMLIST4; fixit [skybook888]
 *
 */

import htmlText from './InventoryV3.html?raw&v=panel-cleanup';
import cssText from './InventoryV3.css?raw&v=panel-cleanup';
import panelCss from '../../RpgPanel.css?raw&v=panel-cleanup';
import { createInventory } from '../InventoryCommon.js?v=panel-cleanup';

export default createInventory({
	name: 'InventoryV3',
	htmlText,
	cssText: panelCss + cssText,
	modernPanel: true,
	defaultHeight: 194,
	favoriteTab: true,
	equipSwitch: true,
	hostDropPreventDefault: true,
	enchantGrade: true,
	inventoryExpansion: true,
	refineEnchant: true,
	useHiddenClass: true,
	tabDropPreventDefault: true
});
