// @flow
import type { BaseModel } from './index';
import * as db from '../common/database';
import * as models from './index';
import * as store from '../sync/storage';
import { compressObject, decompressObject } from '../common/misc';
import * as session from '../sync/session';
// import * as importUtils from '../common/import';
import demoData from '../datasets/example.json';
import { convert } from 'insomnia-importers';
import { fnOrString, generateId } from '../common/misc';

export const name = 'Workspace';
export const type = 'Workspace';
export const prefix = 'wrk';
export const canDuplicate = true;

type BaseWorkspace = {
  name: string,
  description: string
};

export type Workspace = BaseModel & BaseWorkspace;

//  292521600000 = 1979年4月9日
export function init() {
  return {
    name: 'New Workspace',
    description: '',

    public: true,
    owner: null,
    members: []
  };
}

export async function migrate(doc: Workspace): Promise<Workspace> {
  return _migrateExtractClientCertificates(doc);
}

export function getById(id: string): Promise<Workspace | null> {
  return db.get(type, id);
}

export async function create(patch: Object = {}): Promise<Workspace> {
  const uid = session.getSessionData().baseid || null
  let doc = await db.docCreate(type, patch);
  await models.workspaceMeta.create({parentId : doc._id, uid })

  if (doc.name == "Example Project"){
    await importDemo(doc._id, JSON.stringify(demoData));
  }
  return doc;
}

export async function all(): Promise<Array<Workspace>> {
  const uid = session.getSessionData().baseid || null
  const workspaces = await db.all(type);
  const uidWorkspaces = await allByUid(uid);

  console.warn("workspace.js -> all()", workspaces, uidWorkspaces)
  
  if (uidWorkspaces.length == 0) {
    const doc = await models.workspace.create({ name: 'Example Project' });

    window.localStorage.setItem(
      `apiplus::meta::activeWorkspaceId`,
      JSON.stringify(doc._id)
    );
    return all();
  } else {
    return workspaces;
  }
}

export async function getBy(patch: Object = {}): Promise<Workspace> {
  return db.getWhere(type, patch);
}

export async function allByUid(uid): Promise<Array<Workspace>> {
  const workspaces = await db.all(type);
  const workspaceMetas = await db.find("WorkspaceMeta", { uid });

  if (!workspaceMetas.length) {
    return []
  } else {
    const uidWorkspaces = workspaces.filter(workspace => {
      const meta = workspaceMetas.find(m => m.parentId === workspace._id);
      return !!(meta && meta.uid == session.getSessionData().baseid );
    }).reverse();
    
    return uidWorkspaces;
  }
}

export function count() {
  return db.count(type);
}

export function update(
  workspace: Workspace,
  patch: Object
): Promise<Workspace> {
  return db.docUpdate(workspace, patch);
}

export function remove(workspace: Workspace): Promise<void> {
  return db.remove(workspace);
}

async function _migrateExtractClientCertificates(
  workspace: Workspace
): Promise<Workspace> {
  const certificates = (workspace: Object).certificates || null;
  if (!Array.isArray(certificates)) {
    // Already migrated
    return workspace;
  }

  for (const cert of certificates) {
    await models.clientCertificate.create({
      parentId: workspace._id,
      host: cert.host || '',
      passphrase: cert.passphrase || null,
      cert: cert.cert || null,
      key: cert.key || null,
      pfx: cert.pfx || null,
      isPrivate: false
    });
  }

  delete (workspace: Object).certificates;

  // This will remove the now-missing `certificates` property
  // NOTE: Using db.update so we don't change things like modified time
  await db.update(workspace);

  return workspace;
}

export async function importDemo(
  workspaceId: string | null,
  rawContent: string
): Promise<{
  source: string,
  error: string | null,
  summary: { [string]: Array<BaseModel> }
}> {
  const EXPORT_TYPE_REQUEST = 'request';
  const EXPORT_TYPE_REQUEST_GROUP = 'request_group';
  const EXPORT_TYPE_WORKSPACE = 'workspace';
  const EXPORT_TYPE_COOKIE_JAR = 'cookie_jar';
  const EXPORT_TYPE_ENVIRONMENT = 'environment';

  const MODELS = {
    [EXPORT_TYPE_REQUEST]: models.request,
    [EXPORT_TYPE_REQUEST_GROUP]: models.requestGroup,
    [EXPORT_TYPE_WORKSPACE]: models.workspace,
    [EXPORT_TYPE_COOKIE_JAR]: models.cookieJar,
    [EXPORT_TYPE_ENVIRONMENT]: models.environment
  };

  let results;
  try {
    results = await convert(rawContent);
  } catch (e) {
    console.warn('Failed to import data', e);
    return {
      source: 'not found',
      error: 'No importers found for file',
      summary: {}
    };
  }

  const { data } = results;

  let workspace: Workspace | null = await models.workspace.getById(
    workspaceId || 'n/a'
  );

  // Fetch the base environment in case we need it
  let baseEnvironment: Environment | null = await models.environment.getOrCreateForWorkspaceId(
    workspaceId || 'n/a'
  );

  // Generate all the ids we may need
  const generatedIds: { [string]: string | Function } = {};
  for (const r of data.resources) {
    generatedIds[r._id] = generateId(MODELS[r._type].prefix);
  }

  // Always replace these "constants"
  generatedIds['__WORKSPACE_ID__'] = async () => {
    if (!workspace) {
      workspace = await models.workspace.create({ name: 'Imported Workspace' });
    }

    return workspace._id;
  };

  generatedIds['__BASE_ENVIRONMENT_ID__'] = async () => {
    if (!baseEnvironment) {
      if (!workspace) {
        workspace = await models.workspace.create({
          name: 'Imported Workspace'
        });
      }
      baseEnvironment = await models.environment.getOrCreateForWorkspace(
        workspace
      );
    }
    return baseEnvironment._id;
  };

  const importedDocs = {};
  for (const model of models.all()) {
    importedDocs[model.type] = [];
  }

  for (const resource of data.resources) {
    // Buffer DB changes
    // NOTE: Doing it inside here so it's more "scalable"
    await db.bufferChanges(100);
    resource.workspaceId = workspaceId

    // Replace null parentIds with current workspace
    if (!resource.parentId && resource._type !== EXPORT_TYPE_WORKSPACE) {
      resource.parentId = '__WORKSPACE_ID__';
    }

    // Replace _id if we need to
    if (generatedIds[resource._id]) {
      resource._id = await fnOrString(generatedIds[resource._id]);
    }

    // Replace newly generated IDs if they exist
    if (generatedIds[resource.parentId]) {
      resource.parentId = await fnOrString(generatedIds[resource.parentId]);
    }

    const model: Object = MODELS[resource._type];
    if (!model) {
      console.warn('Unknown doc type for import', resource._type);
      continue;
    }

    let newDoc: BaseModel;
    newDoc = await db.docCreate(model.type, resource);
    // Mark as not seen if we created a new workspace from sync
    if (newDoc.type === models.workspace.type) {
      const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(
        newDoc._id
      );
      await models.workspaceMeta.update(workspaceMeta, { hasSeen: false });
    }

    importedDocs[newDoc.type].push(newDoc);
  }

  await db.flushChanges();

  return {
    source:
      results.type && typeof results.type.id === 'string'
        ? results.type.id
        : 'unknown',
    summary: importedDocs,
    error: null
  };
}