/**
 * UI/Components/WinLoginV2/WinLoginV2.js
 *
 * WinLoginV2 windows
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

/**
 * Dependencies
 */
import htmlText from './WinLoginV2.html?raw&v=forever-login5';
import cssText from './WinLoginV2.css?raw&v=forever-login5';
import { createWinLogin } from '../WinLoginCommon.js';

export default createWinLogin({
	name: 'WinLoginV2',
	htmlText,
	cssText
});
