var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

import { KEY_PREFIX } from './constants';
import createAsyncLocalStorage from './defaults/asyncLocalStorage';

export default function getStoredState(config, onComplete) {
  var storage = config.storage || createAsyncLocalStorage('local');
  var deserializer = config.serialize === false ? function (data) {
    return data;
  } : defaultDeserializer;
  var blacklist = config.blacklist || [];
  var whitelist = config.whitelist || false;
  var transforms = config.transforms || [];
  var keyPrefix = config.keyPrefix !== undefined ? config.keyPrefix : KEY_PREFIX;

  // fallback getAllKeys to `keys` if present (LocalForage compatability)
  if (storage.keys && !storage.getAllKeys) storage = _extends({}, storage, { getAllKeys: storage.keys });

  var restoredState = {};
  var completionCount = 0;

  storage.getAllItems(function (err, allItems) {
    if (err) {
      if (process.env.NODE_ENV !== 'production') console.warn('redux-persist/getStoredState: Error in storage.getAllItems');
      complete(err);
    }

    var serializedKeys = Object.keys(allItems);

    var persistKeys = serializedKeys.filter(function (key) {
      return key.indexOf(keyPrefix) === 0;
    }).map(function (key) {
      return key.slice(keyPrefix.length);
    });
    var keysToRestore = persistKeys.filter(passWhitelistBlacklist);

    var restoreCount = keysToRestore.length;
    if (restoreCount === 0) complete(null, restoredState);

    for (var i = 0; i < restoreCount; i++) {
      var key = keysToRestore[i];
      var prefixedKey = '' + keyPrefix + key;

      restoredState[key] = rehydrate(key, allItems[prefixedKey]);
      completionCount += 1;
      if (completionCount === restoreCount) complete(null, restoredState);
    }
  });

  function rehydrate(key, serialized) {
    var state = null;

    try {
      var data = deserializer(serialized);
      state = transforms.reduceRight(function (subState, transformer) {
        return transformer.out(subState, key);
      }, data);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.warn('redux-persist/getStoredState: Error restoring data for key:', key, err);
    }

    return state;
  }

  function complete(err, restoredState) {
    onComplete(err, restoredState);
  }

  function passWhitelistBlacklist(key) {
    if (whitelist && whitelist.indexOf(key) === -1) return false;
    if (blacklist.indexOf(key) !== -1) return false;
    return true;
  }

  function createStorageKey(key) {
    return '' + keyPrefix + key;
  }

  if (typeof onComplete !== 'function' && !!Promise) {
    return new Promise(function (resolve, reject) {
      onComplete = function onComplete(err, restoredState) {
        if (err) reject(err);else resolve(restoredState);
      };
    });
  }
}

function defaultDeserializer(serial) {
  return JSON.parse(serial);
}