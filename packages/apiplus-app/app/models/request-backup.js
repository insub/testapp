import deepEqual from 'deep-equal';
import * as models from './index';
import * as db from '../common/database';
import { compressObject, decompressObject } from '../common/misc';
export const name = 'Request Backup';
export const type = 'RequestBackup';
export const prefix = 'reqb';
export const canDuplicate = false;

const FIELDS_TO_IGNORE = [
  '_id',
  'type',
  'created',
  // 'modified',
  // 'metaSortKey',
  // 'name',
  // 'description',
  // 'parentId',
  // 'host',
  'showid'
];

export function init() {
  return {
    parentId: null,
    compressedRequest: null,
    metaSortKey: null
  };
}

export function migrate(doc) {
  return doc;
}

export function getById(id) {
  return db.get(type, id);
}

export async function create(parentId) {
  const request = await models.request.getById(parentId);

  // Create a new backup if the request has been modified without some attr
  // 这个实际上是不要以下几个字段的意思，必须与 hasChanged 中的一致
  const {modified, host, showid, ...fixRequest} = request;
  const compressedRequest = JSON.stringify(fixRequest);
  const lastRequestBackup = await db.docCreate(type, { parentId : parentId, compressedRequest, metaSortKey: request.metaSortKey});
  console.warn("create requestBackup", lastRequestBackup)
  return lastRequestBackup;
}

export function remove(requestBackup: requestBackup): Promise<void> {
  return db.remove(requestBackup);
}

export function removeByParentId(parentId) {
  return db.removeWhere(type, ({ parentId: parentId }, { multi: true }) );
}

export function getLatestByParentId(parentId) {
  return db.getMostRecentlyModified(type, { parentId });
}

export async function restore(requestBackupId) {
  const requestBackup = await getById(requestBackupId);

  // Older responses won't have backups saved with them
  if (!requestBackup) {
    return null;
  }

  const requestPatch = JSON.parse(requestBackup.compressedRequest);
  const originalRequest = await models.request.getById(requestPatch._id);

  // Only restore fields that aren't blacklisted
  for (const field of FIELDS_TO_IGNORE) {
    delete requestPatch[field];
  }

  const finalRequest = Object.assign(originalRequest, requestPatch, {metaSortKey: requestBackup.metaSortKey});
  console.warn('restore!', requestBackup, originalRequest, requestPatch, finalRequest)
  // 同时使用 db.update 的直接修改方法，避免修改 modified，也不会触发 db.onChange 事件
  return db.update(finalRequest, true);
}

export async function getOrCreateByParentId(parentId) {
  const requestBackup = await getLatestByParentId(parentId);

  if (requestBackup) {
    return requestBackup;
  }

  return create(parentId);
}

export async function hasChanged(doc) {
  let {modified, host, showid, ...fixRequest} = doc;
  const latestRequestBackup = await models.requestBackup.getOrCreateByParentId(doc._id);
  return latestRequestBackup.compressedRequest === JSON.stringify(fixRequest) ? false : true;
}
