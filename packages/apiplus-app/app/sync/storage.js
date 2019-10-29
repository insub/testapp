import electron from 'electron';
import NeDB from 'nedb';
import fsPath from 'path';
import crypto from 'crypto';
import * as util from '../common/misc';
import { DB_PERSIST_INTERVAL } from '../common/constants';

const TYPE_RESOURCE = 'Resource';

export const SYNC_MODE_OFF = 'paused';
export const SYNC_MODE_ON = 'active';
export const SYNC_MODE_NEVER = 'never';
export const SYNC_MODE_UNSET = 'unset';
let changeListeners = [];

export function onChange(callback) {
  changeListeners.push(callback);
}

export function offChange(callback) {
  changeListeners = changeListeners.filter(l => l !== callback);
}

let _changeTimeout = null;
function _notifyChange() {
  clearTimeout(_changeTimeout);
  _changeTimeout = setTimeout(() => {
    for (const fn of changeListeners) {
      fn();
    }
  }, 200);
}

export function allActiveResources() {
  return findActiveResources({});
}

export function allResources() {
  return findResources({});
}

export async function findResources(query = {}) {
  return _execDB(TYPE_RESOURCE, 'find', query);
}

export async function findActiveResources(query) {
  return findResources(Object.assign(query));
}

export async function findActiveDirtyResources() {
  return findActiveResources({ dirty: true });
}


export async function getResourceByDocId(id) {
  let query;
  query = { id };
  
  const rawDocs = await _execDB(TYPE_RESOURCE, 'find', query);
  return rawDocs.length >= 1 ? rawDocs[0] : null;
}

/**
 * This function is temporary and should only be called when cleaning
 * up duplicate ResourceGroups
 * 这个函数是临时的，应该只在清理重复 ResourceGroups 时调用。
 * @param id
 * @returns {*}
 */
export function findResourcesByDocId(id) {
  return _execDB(TYPE_RESOURCE, 'find', { id });
}

/**
 * This function is temporary and should only be called when cleaning
 * up duplicate ResourceGroups
 * 这个函数是临时的，应该只在清理重复 ResourceGroups 时调用。
 * @param resourceGroupId
 * @returns {*}
 */
export async function insertResource(resource) {
  const h = crypto.createHash('md5');
  h.update(resource.id);
  const newResource = Object.assign({}, resource, {
    _id: `rs_${h.digest('hex')}`
  });
  await _execDB(TYPE_RESOURCE, 'insert', newResource);
  _notifyChange();
  return newResource;
}

export async function updateResource(resource, ...patches) {
  const newDoc = Object.assign({}, resource, ...patches);
  await _execDB(TYPE_RESOURCE, 'update', { _id: resource._id }, newDoc, {
    multi: true
  });
  _notifyChange();
  return newDoc;
}

export async function removeResource(resource) {
  await _execDB(TYPE_RESOURCE, 'remove', { _id: resource._id }, { multi: true });
  _notifyChange();
}

// ~~~~~~ //
// Config //
// ~~~~~~ //
export function initDB(forceReset) {
  if (!_database || forceReset) {
    const basePath = electron.remote.app.getPath('userData');
    _database = {};

    // NOTE: Do not EVER change this. EVER!
    // 注意：永远不要改变这个。永远！
    const resourcePath = fsPath.join(basePath, 'sync/Resource.db');

    // Fill in the defaults
    // 创建相关表
    _database['Resource'] = new NeDB(
      Object.assign({ filename: resourcePath, autoload: true })
    );

    for (const key of Object.keys(_database)) {
      _database[key].persistence.setAutocompactionInterval(DB_PERSIST_INTERVAL);
    }

    // Done
    console.log(`[sync] Initialize Sync DB at ${basePath}`);
  }
}

// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //

let _database = null;

function _getDB(type) {
  initDB();
  return _database[type];
}

function _execDB(type, fnName, ...args) {
  return new Promise((resolve, reject) => {
    _getDB(type)[fnName](...args, (err, data) => {
      err ? reject(err) : resolve(data);
    });
  });
}
