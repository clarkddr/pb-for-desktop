'use strict';


/**
 * Modules
 * Node
 * @constant
 */
const path = require('path');

/**
 * Modules
 * Electron
 * @constant
 */
const { remote } = require('electron');
const { clipboard } = remote;

/**
 * Modules
 * External
 * @constant
 */
const appRootPath = require('app-root-path')['path'];

/**
 * Modules
 * Internal
 * @constant
 */
const logger = require(path.join(appRootPath, 'lib', 'logger'))({ write: true });


/**
 * @constant
 * @default
 */
const defaultInterval = 2000;


/** @namespace pb.e2e.encrypt */


/**
 * Get 'pb-for-desktop' device
 * @return {Array} Devices with model = 'pb-for-desktop'
 */
let getDevice = () => {
    logger.debug('getDevice');

    const pb = window.pb;

    return pb.api.devices.all.filter((device) => {
        return (device.model === 'pb-for-desktop');
    })[0];
};

/**
 * Receive clipboard content
 * @param {Object} clip - Clipboard content
 */
let receiveClip = (clip) => {
    logger.debug('receiveClip');

    const pb = window.pb;

    if (!pb.account.pro) { return; }

    pb.lastClip = clipboard.readText();

    clipboard.writeText(clip.body);
};

/**
 * Publish clipboard content
 * @param {Object} clip - Clipboard content
 */
let publishClip = (clip) => {
    logger.debug('publishClip');

    const pb = window.pb;

    let data = {
        'type': 'clip',
        'source_user_iden': pb.account.iden,
        'source_device_iden': getDevice().iden,
        'body': clip
    };

    let push;
    if (pb.e2e.enabled) {
        push = {
            'encrypted': true,
            'ciphertext': pb.e2e.encrypt(JSON.stringify(data))
        };
    } else {
        push = data;
    }

    pb.net.post('/v2/ephemerals', {
        'type': 'push',
        'push': push
    }, function(result) {
        // Error
        if (!result) {
            logger.debug('error');
            return;
        }

        // Error: Pushbullet Pro
        if (result.error) {
            logger.warn('publishClip', 'result.error.message', result.error.message);
            return;
        }

        // OK
        logger.debug('publishClip', 'published');
    });
};

/**
 * Monitor clipboard content
 */
let startMonitoring = () => {
    logger.debug('startMonitoring');

    let lastText = clipboard.readText();
    let lastImage = clipboard.readImage();

    let imageHasDiff = (a, b) => {
        return !a.isEmpty() && b.toDataURL() !== a.toDataURL();
    };

    let textHasDiff = (a, b) => {
        return a && b !== a;
    };

    setInterval(() => {
        const text = clipboard.readText();
        const image = clipboard.readImage();

        if (imageHasDiff(image, lastImage)) {
            lastImage = image;
            publishClip(text);

            // DEBUG
            logger.debug('startMonitoring', 'image:', image);
        }

        if (textHasDiff(text, lastText)) {
            lastText = text;
            publishClip(text);

            // DEBUG
            logger.debug('startMonitoring', 'text:', text);
        }
    }, defaultInterval);
};


/**
 * Init
 */
let init = () => {
    logger.debug('initClipboard');

    const pb = window.pb;

    let interval = setInterval(() => {
        if (!(pb && pb.account)) { return; }

        if (!pb.account.pro) {
            logger.info('No pro account found');

            clearInterval(interval);
            return;
        }

        startMonitoring();

        clearInterval(interval);
    }, defaultInterval);
};


/**
 * @listens window#load
 */
window.addEventListener('load', () => {
    logger.debug('window#load');

    init();
});


/**
 * @exports
 */
module.exports = {
    receiveClip: receiveClip
};
