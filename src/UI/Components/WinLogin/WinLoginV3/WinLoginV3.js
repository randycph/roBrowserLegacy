import htmlText from '../WinLoginV2/WinLoginV2.html?raw&v=forever-login5';
import cssText from '../WinLoginV2/WinLoginV2.css?raw&v=forever-login5';
import { createWinLogin } from '../WinLoginCommon.js';

export default createWinLogin({
	name: 'WinLoginV3',
	htmlText,
	cssText
});
