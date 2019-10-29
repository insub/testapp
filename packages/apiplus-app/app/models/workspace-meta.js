// @flow
import type { BaseModel } from './index';
import * as db from '../common/database';
import {
  DEFAULT_SIDEBAR_WIDTH,
  DEFAULT_PANE_WIDTH,
  DEFAULT_PANE_HEIGHT,
  EXAMPLE_HOSTS
} from '../common/constants';
import * as session from '../sync/session';

export const name = 'Workspace Meta';
export const type = 'WorkspaceMeta';
export const prefix = 'wrkm';
export const canDuplicate = false;

type BaseWorkspaceMeta = {
  activeRequestId: string | null,
  activeEnvironmentId: string | null,
  sidebarFilter: string,
  sidebarHidden: boolean,
  sidebarWidth: number,
  paneWidth: number,
  paneHeight: number,
  hasSeen: boolean,
  rtabs: Array<Object>,
  rtabActiveIndex: number,
  hosts: Array<Object>,
  pasterHidden: boolean
};

export type WorkspaceMeta = BaseWorkspaceMeta & BaseModel;

export function init(): BaseWorkspaceMeta {
  return {
    parentId: null,
    activeRequestId: null,
    activeEnvironmentId: null,
    sidebarFilter: '',
    sidebarHidden: false,
    sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    paneWidth: DEFAULT_PANE_WIDTH,
    paneHeight: DEFAULT_PANE_HEIGHT,
    hasSeen: true,

    rtabs: [],
    rtabActiveIndex: 0,
    hosts: EXAMPLE_HOSTS,
    pasterHidden: true,
    lastPullAt: 292521600,
    role: "owner",
    expired_at: null,
    important: false,
    uid: session.getSessionData().baseid || null
  };
}

export function migrate(doc: WorkspaceMeta): WorkspaceMeta {
  return doc;
}

export function create(patch: Object = {}): Promise<WorkspaceMeta> {
  if (!patch.parentId) {
    throw new Error(`New WorkspaceMeta missing parentId ${JSON.stringify(patch)}`);
  }

  return db.docCreate(type, patch);
}

export function update(workspaceMeta: WorkspaceMeta, patch: Object = {}): Promise<WorkspaceMeta> {
  return db.docUpdate(workspaceMeta, patch);
}
// a object
export async function getBy(patch: Object = {}): Promise<Workspace> {
  return db.getWhere(type, patch);
}

export async function getByParentId(parentId: string): Promise<WorkspaceMeta | null> {
  return db.getWhere(type, { parentId });
}

export async function getOrCreateByParentId(parentId: string): Promise<WorkspaceMeta> {
  const doc = await getByParentId(parentId);
  return doc || this.create({ parentId });
}

export function all(): Promise<Array<WorkspaceMeta>> {
  return db.all(type);
}
