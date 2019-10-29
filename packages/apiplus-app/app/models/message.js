import * as models from './index';
import * as db from '../common/database';
import * as session from '../sync/session';

export const name = 'Message';
export const type = 'Message';
export const prefix = 'msg';
export const canDuplicate = false;

export function init() {
  return {
    action: null,
    content: "",
    doc: {},
    by: {},
    workspaceId: null,
    uid: session.getSessionData().baseid || null,
    read: false
  };
}

export function migrate(doc) {
  return doc;
}

export function all() {
  return db.all(type);
}

export function getById(id) {
  return db.get(type, id);
}

export async function create(patch) {
  if (!patch.action) {
    throw new Error(
      'New RequestGroup missing `parentId`: ' + JSON.stringify(patch)
    );
  }
  let fixDoc = {}
  if (patch.doc){
    fixDoc = (({ type, showid, _id, name, modified }) => ({ type, showid, _id, name, modified }))(patch.doc);
  }

  return db.docCreate(type, patch, {doc : fixDoc});
}

export function count() {
  return db.count(type);
}

export function update(
  message: Message,
  patch: Object
): Promise<Message> {
  return db.docUpdate(message, patch);
}

export function remove(message: Message): Promise<void> {
  return db.remove(message);
}