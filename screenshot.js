const CDP = require('chrome-remote-interface');
const argv = require('minimist')(process.argv.slice(2));
const file = require('fs');

// CLI Args
const url = argv.url || 'https://www.google.com';
const format = argv.format === 'jpeg' ? 'jpeg' : 'png';
const viewportWidth = argv.viewportWidth || 1440;
const viewportHeight = argv.viewportHeight || 900;
const delay = argv.delay || 0;
const userAgent = argv.userAgent;
const fullPage = argv.full;
const fileName = argv.filename || 'screenshot.png';

// Start the Chrome Debugging Protocol
CDP(async function(client) {
    // Extract used DevTools domains.
    const {DOM, Emulation, Network, Page, Runtime} = client;

    // Enable events on domains we are interested in.
    await Page.enable();
    await DOM.enable();
    await Network.enable();

    // If user agent override was specified, pass to Network domain
    if (userAgent) {
	await Network.setUserAgentOverride({userAgent});
    }

    // Set up viewport resolution, etc.
    const device = {
	width: viewportWidth,
	height: viewportHeight,
	deviceScaleFactor: 0,
	mobile: false,
	fitWindow: false,
    };
    await Emulation.setDeviceMetricsOverride(device);
    await Emulation.setVisibleSize({width: viewportWidth, height: viewportHeight});

    // Navigate to target page
    await Page.navigate({url});

    // Wait for page load event to take screenshot
    Page.loadEventFired(async() => {
	setTimeout(async function() {
	    if (fullPage) {
		console.log("Executing full page screenshot!");
		const {root: {nodeId: documentNodeId}} = await DOM.getDocument();
		const {nodeId: bodyNodeId} = await DOM.querySelector({
		    selector: 'body',
		    nodeId: documentNodeId,
		});

		const {model: {height}} = await DOM.getBoxModel({nodeId: bodyNodeId});
		console.log('Setting height to '+height);
		await Emulation.setVisibleSize({width: device.width, height: height});
		await Emulation.setDeviceMetricsOverride({width: device.width, height:height, screenWidth: device.width, screenHeight: height, deviceScaleFactor: 1, fitWindow: false, mobile: false});
		await Emulation.setPageScaleFactor({pageScaleFactor:1});
	    }
	    
	    const screenshot = await Page.captureScreenshot({format});
	    const buffer = new Buffer(screenshot.data, 'base64');
	    file.writeFile(fileName, buffer, 'base64', function(err) {
		if (err) {
		    console.error(err);
		} else {
		    console.log('Screenshot saved');
		}
		client.close();
	    });
	}, delay);
    });
}).on('error', err => {
    console.error('Cannot connect to browser:', err);
});
