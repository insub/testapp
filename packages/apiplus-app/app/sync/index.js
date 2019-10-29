import * as React from 'react';
import classnames from 'classnames';

import * as db from '../common/database';
import * as models from '../models';
import * as crypt from './crypt';
import * as session from './session';
import * as store from './storage';
import * as misc from '../common/misc';
import Logger from './logger';
import * as zlib from 'zlib';
import { compressObject, decompressObject, delay } from '../common/misc';
import * as util from '../common/fetch';
import { toast as itoast } from 'react-toastify';
import { showAlert, showModal, showPrompt } from '../ui/components/modals/index';
import AlertModal from '../ui/components/modals/alert-modal';
import LoginModal from '../ui/components/modals/login-modal';
import { setActiveWorkspace } from '../ui/redux/modules/global';

export const START_DELAY = 1e3;
export const PULL_PERIOD = 15e4;
export const WRITE_PERIOD = 1e3;


// const WHITE_LIST = {
//   [models.workspace.type]: true,
//   [models.request.type]: true,
//   [models.requestGroup.type]: true
// };

// 如果不这样写，引用了 session.js 的地方就会报循环 import，但相关方法好像并未用到，尽量少写立即执行的代码
const WHITE_LIST = {
  "Workspace": true,
  "Request": true,
  "RequestGroup": true
};

export const logger = new Logger();

// TODO: Move this stuff somewhere else
const NO_VERSION = '__NO_VERSION__';
let _pullChangesInterval = null;
let _pendingDBChanges = {};
let _isInitialized = false;
let _workspaceCheckAt = 292521600000
let pushErrorsCount = 0
let pushSuccessCount = 0
let pushing = false
let needPushAgain = false

// 同步模块的初始化，添加事件监听，设置定时检查，定时 pull 和 push
export async function init() {
  if (_isInitialized) {
    logger.debug('Already enabled');
    return;
  }

  // NOTE: This is at the top to prevent race conditions
  // 这是防止竟态条件的上策
  _isInitialized = true;
  pushing = false
  needPushAgain = false
  db.onChange(async changes => {
    // To help prevent bugs, put Workspaces first
    // 为了帮助防止错误，把 workspaces 放前面，暂无必要，如果是删除项目那么可能会有问题
    // const sortedChanges = changes.sort(
    //   ([event, doc, fromSync]) => (doc.type === models.workspace.type ? 1 : -1)
    // );

    let needAutoPush = false

    for (const [event, doc, fromSync] of changes) {
      if (!["Workspace", "RequestGroup", "Request"].includes(doc.type)) {
        continue;
      }
      console.warn("db.onChange -> ", `${event}::${doc.type}::[${doc.name}] fromSync= ${fromSync}`, doc)

      // 为每一个新的 request（包括临时接口），新建一个 requestBackup
      if (doc.type == "Request" && event == "insert") {
        await models.requestBackup.create(doc._id);
        if (!fromSync && !doc.isTemp) {
          console.warn(`sync::insert :fromSync=${!fromSync}`)
          await saveResource(event, doc)
          needAutoPush = true
        }
      }

      if (doc.type == "Request" && event == "update") {
        // 如果当前是 unsave，那么进行比较，如果比较修改后的数据与备份数据一致，那么将接口的 unsave 状态改为 false
        const hasChanged = await models.requestBackup.hasChanged(doc)
        const requestMeta = await models.requestMeta.getOrCreateByParentId(doc._id)
        console.warn(`sync::update :unsave=${requestMeta.unsave} :hasChanged=${hasChanged}`)
        if (requestMeta.unsave) {
          if (!hasChanged) {
            await models.requestMeta.update(requestMeta, {unsave: false});
          }
        } else {
          if (!fromSync && !doc.isTemp && hasChanged) {
            await models.requestMeta.update(requestMeta, {unsave: true});
          }
        }
      }

      if (doc.type == "Request" && event == "remove") {
        if (!fromSync && !doc.isTemp) {
          console.warn('sync - remove')
          await saveResource(event, doc)
          needAutoPush = true
        }
      }

      if (["Workspace", "RequestGroup"].includes(doc.type) && !fromSync){
        console.warn("sync - Workspace / RequestGroup")
        await saveResource(event, doc)
        needAutoPush = true
      }
    }

    if (needAutoPush){
      push()
    }
  });

  await misc.delay(START_DELAY);

  await pull();
  await push();

  let nextSyncTime = 0;
  let isSyncing = false;
  _pullChangesInterval = setInterval(async () => {
    if (isSyncing) {
      return;
    }

    if (Date.now() < nextSyncTime) {
      return;
    }

    // Mark that we are currently executing a sync op
    // 标记我们当前正在执行定时同步操作
    isSyncing = true;

    const syncStartTime = Date.now();

    let extraDelay = 0;
    try {
      await pull();
      await push();
    } catch (err) {
      logger.error('Pull failed with', err);
      extraDelay += PULL_PERIOD;
    }

    const totalSyncTime = Date.now() - syncStartTime;

    // Add sync duration to give the server some room if it's being slow.
    // Also, multiply it by a random value so everyone doesn't sync up
    // 添加同步持续时间给服务器一些空间，如果它是缓慢的
    // 此外，将它乘以随机值，这样每个人都不会同步。
    extraDelay += totalSyncTime * (Math.random() * 2);

    nextSyncTime = Date.now() + PULL_PERIOD + extraDelay;
    isSyncing = false;
    // 定时清空废弃的 resources
    for (const r of await store.allResources()) {
      const workspace = await models.workspace.getBy({_id: r.workspaceId})
      if (!workspace){
        await store.removeResource(r);
      }
    }
  }, PULL_PERIOD / 5);

  logger.debug('Initialized');
}

// Used only during tests!
export function _testReset() {
  _isInitialized = false;
  clearInterval(_pullChangesInterval);
}

/**
 * Non-blocking function to perform initial sync for an account. This will pull
 * all remote resources (if they exist) before initializing sync.
 * 非阻塞功能来执行帐户的初始同步。这将在初始化同步之前将所有远程资源（如果它们存在）都下拉。 
 */
export function doInitialSync() {
  console.warn("doInitialSync!!!!!!!")
  process.nextTick(async () => {
    // First, pull down all remote resources, without first creating new ones.
    // This makes sure that the first sync won't create resources locally, when
    // they already exist on the server.
    // 首先，拉取所有远程资源，而不首先创建新的资源。
    // 这确保第一个同步不会在本地上创建资源，当它们已经存在于服务器上时。
    // 这个函数目前只在登录的时候被执行了
    _workspaceCheckAt = 292521600000
    pushErrorsCount = 0
    pushSuccessCount = 0
    needPushAgain = false

    await pull(null, false);
    // Make sure sync is on (start the timers)
    // 开启同步（设定定时同步）
    await init();
  });
}

export async function saveResource(event, doc, usn = 0, dirty = true) {
  const {host, ...finalDoc} = doc;
  const resource = await getOrCreateResourceForDoc(finalDoc);
  const updatedResource = await store.updateResource(resource, {
    lastEdited: doc.modified,
    lastEditedBy: session.getBaseid(),
    encContent: await compressObject(finalDoc),
    event: event,
    removed: event == "remove",
    usn,
    dirty
  });

  if (doc.type == "Request" && event != "remove") {
    await models.requestBackup.create(doc._id);
    const requestMeta = await models.requestMeta.getOrCreateByParentId(doc._id)
    await models.requestMeta.update(requestMeta, {unpush: dirty, unsave: false});
  }
  console.warn(`sync::saveResource event:${event} usn:${usn} dirty:${dirty}`, doc)
}

export async function push() {
  if ( !session.isLoggedIn() || !["plus", "trial"].includes(session.getPlan()) ) {
    return;
  }

  if (pushing) {
    console.warn("needPushAgain return")
    needPushAgain = true
    return;
  }
  
  let allDirtyResources = [];
  allDirtyResources = await store.findActiveResources({ dirty: true });

  // console.warn('push push push push allDirtyResources', allDirtyResources);
  // 还是需要保留 dirty ，用于处理同一对象多次操作的情况，比如说 insert 然后 edited 然后 remove - 不需要了吧
  if (!allDirtyResources.length) {
    logger.debug('No changes to push');
    return;
  }

  const sortedResources = allDirtyResources.sort((a, b) => (a.lastEdited < b.lastEdited ? -1 : 1))
  logger.debug('sortedResources!!!', sortedResources);
  
  pushing = true
  pushErrorsCount = 0
  pushSuccessCount = 0
  await reduxstore.dispatch({type: 'global/push-start'})
  for (const r of sortedResources) {
    // 如果不是删除项目的资源，那么判断是否有权限，防止多发请求(删除项目的请求在本地已经找不到项目，因此不做判断，在服务器判断)
    const workspaceMeta = await models.workspaceMeta.getBy({parentId: r.workspaceId, uid: session.getBaseid()})
    console.warn("check r workspaceMeta", workspaceMeta, session.getBaseid())
    if ( (r.event !== "remove" || r.type !== "Workspace") && (!workspaceMeta || workspaceMeta.role === "viewer" || !!workspaceMeta.expired_at) ){
      console.warn("no role, no push", (workspaceMeta ? workspaceMeta.uid : null), r.event, r.id )
      continue;
    }
    let responseBody
    try {
      // 针对不同的文档类型做不同处理
      switch(r.type){
        case "Workspace":
          responseBody = (r.event === "remove") ? await util.del(`/projects/${r.id}`) : await util.put(`/projects/${r.id}`, {encContent : r.encContent})
          break;
        case "RequestGroup":
          responseBody = (r.event === "remove") ? await util.del(`/projects/${r.workspaceId}/folders/${r.id}`) : await util.put(`/projects/${r.workspaceId}/folders/${r.id}`, {encContent : r.encContent})
          break;
        case "Request":
          responseBody = (r.event === "remove") ? await util.del(`/projects/${r.workspaceId}/reqs/${r.id}/`) : await util.put(`/projects/${r.workspaceId}/reqs/${r.id}/`, {encContent : r.encContent})
          if (r.event !== "remove"){
            const request = await models.request.getById(r.id)
            if (!request.showid) {
              await db.update(Object.assign(request, {showid: responseBody.showid}), true);
            }
            await models.requestBackup.create(request._id);
            const requestMeta = await models.requestMeta.getOrCreateByParentId(request._id)
            await models.requestMeta.update(requestMeta, {unpush: false});
          }
          break;
        default:
          break;
      }
      // response.data.success 不等于 true 的话一样会 catch
      await store.updateResource(r, { usn: responseBody.usn, dirty: false });
      pushSuccessCount += 1
    } catch (e) {
      console.warn("push fail! => ", e, r.event, r.id)
      pushErrorsCount += 1
    } finally {
      // 无论是否成功
    }
  } // 循环结束
  await delay(300)
  await reduxstore.dispatch({type: 'global/push-stop'})
  pushing = false

  if (needPushAgain) {
    console.warn("check if pushing.....")
    needPushAgain = false
    push()
  } else {
    // if (pushSuccessCount){
    //   itoast.success(`Push has ${pushSuccessCount} success.`, { position: "top-center", className: 'push_itoast', autoClose: 3000, hideProgressBar: true, closeOnClick: true, pauseOnHover: true });
    // }
    if (pushErrorsCount){
      itoast.error(`Push has ${pushErrorsCount} errors.`);
    }
    return pushSuccessCount
  }
}

export async function pushResponse(workspaceId, requestId, currentResponse) {
  if (!session.isLoggedIn()) {
    return;
  }

  // 限制只能上传 JSON，改为在文档端进行处理
  // if (!misc.isJsonString(currentResponse)){
  //   itoast.error(`For now we only support push JSON format response.`);
  //   return;
  // }
  try {
    await util.put(`/projects/${workspaceId}/reqs/${requestId}/update_response`, {response : compressObject(currentResponse)})
    // itoast.success("Push Response Success", {
    //   position: "top-center", className: 'push_itoast', autoClose: 3000, hideProgressBar: true, closeOnClick: true, pauseOnHover: true
    // });
    return true
  } catch (e) {
    itoast.error("" + e);
    return false
  }
}

// 软件启动时 _workspaceCheckAt 是 1979 年，然后才等于 pull_at 数据，因此实际上下载了该用户所有的 workspaces 数据，进行了一次初始化处理
export async function pull(currentWorkspaceId = null) {
  if (!session.isLoggedIn()) {
    return;
  }

  let _stopCurrentPull = false
  // 是否要将本地所有未上传的资源上传?
  const item = window.localStorage.getItem(`apiplus::meta::activeWorkspaceId`);
  currentWorkspaceId = JSON.parse(item);
  // const workspace = await models.workspace.getById(currentWorkspaceId);
  if (!currentWorkspaceId){
    return
  }
  
  const currentWorkspaceMeta = await models.workspaceMeta.getOrCreateByParentId(currentWorkspaceId);
  let responseBody;

  await reduxstore.dispatch({type: 'global/pull-start'})
  try {
    responseBody = await util.get(`/projects/${currentWorkspaceId}/pull?last_workspaces_check_at=${_workspaceCheckAt}&last_pull_at=${currentWorkspaceMeta.lastPullAt}`);
    console.log('pull - responseBody', responseBody);   
  } catch (e) {
    await reduxstore.dispatch({type: 'global/pull-stop'})
    logger.error('Failed to pull changes', e);
    return;
  }
  await reduxstore.dispatch({type: 'global/pull-stop'})
 
  const { pull_at, user, upsertWorkspaces, deletedWorkspaces, upsertResources, deletedResources } = responseBody;
  session.updateSessionData(user)

  const uid = session.getBaseid()
  let modalInfo = []
  // 插入或修改 workspace
  for (const workspace of upsertWorkspaces) {
    const existWorkspace = await db.get("Workspace", workspace._id)
    const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
    // 从原代码看是可以先创建 workspaceMeta 再新建 workspace 的
    const dataStr = {
      _id: workspace._id,
      name: workspace.name,
      type: "Workspace",
      description: workspace.description,
      owner: workspace.owner,
      members: workspace.members,
      public: workspace.public
    };


    const metaDataStr = {
      role: workspace.role,
      uid: uid,
      important: workspace.important,
      expired_at: workspace.expired_at
    }

    // 如果用户被取消了项目分享，不实际删除，而是把 uid 设置为 unshare
    if (workspace.expired_at && workspaceMeta.role !== "owner" && workspaceMeta.uid != "unshare") {
      if (existWorkspace._id === currentWorkspaceId){
        _stopCurrentPull = true
        // await removeCurrentWorkspace(currentWorkspaceId)
        modalInfo.push(<li key={workspace._id}>[Sync] Unshare workspace: {workspace.owner.email} cancel a project share: {workspace.name}</li>)
      }
      metaDataStr.uid = "unshare"
    }
    // 本地已取消分享的项目被重新加入分享给一个提示
    if (!workspace.expired_at && workspaceMeta.uid == "unshare"){
      modalInfo.push(<li key={workspace._id}>[Sync] New project: {workspace.owner.email} share to you a new project : {workspace.name}</li>)
    }
    
    const newworkspaceMeta = await models.workspaceMeta.update( Object.assign(workspaceMeta, metaDataStr) );

    if (existWorkspace){
      if (existWorkspace.usn < workspace.usn) {
        await db.upsert(Object.assign(existWorkspace, dataStr), true);
      }
    } else {
      // Mark as not seen if we created a new workspace from sync
      // 如果我们从同步创建了一个新的工作区，标志为不可见. PS: 不知道为什么，可能跟体系有关，insomnia 当前的权限粒度是所有的 workspaces，不是区分的
      // const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(doc._id);
      // await models.workspaceMeta.update(workspaceMeta, { hasSeen: false });
      if (!workspace.expired_at){
        await db.insert(dataStr, true);
        modalInfo.push(<li key={workspace._id}>[Sync] New project: A new project : {workspace.name}</li>)
      }
    }
  }

  // 真正删除 workspace
  for (const workspace of deletedWorkspaces) {
    const existWorkspace = await db.get("Workspace", workspace._id);
    if (existWorkspace){
      for (const r of await store.findResourcesByDocId(existWorkspace._id)) {
        await store.removeResource(r);
      }
      if (existWorkspace._id === currentWorkspaceId){
        _stopCurrentPull = true
        const currentWorkspace = await db.get("Workspace", currentWorkspaceId)
        await removeCurrentWorkspace(currentWorkspaceId)
        await db.remove(currentWorkspace, true);
        modalInfo.push(<li key={workspace._id}>[Sync] Delete project: {currentWorkspace.name}</li>)
      } else {
        await db.remove(existWorkspace, true);
        modalInfo.push(<li key={workspace._id}>[Sync] Delete project: {workspace.name}</li>)
      }
    }
  }
  db.compactData()

  if (modalInfo.length){
    showModal(AlertModal, { title: 'Sync Project', message: <ul>{modalInfo}</ul> });
  }

  // 删除了当前激活的 workspace ，因此中断后续资源的同步
  if (_stopCurrentPull){
    return
  }

  // workspaces 正常处理完毕，设置 workspaces check 最后更新时间
  _workspaceCheckAt = pull_at

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Insert all the created docs to the DB //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // 插入所有创建的 docs 到 DB

  await db.bufferChanges();
  for (const upsertResource of upsertResources) {
    let doc;

    try {
      const { encContent } = upsertResource;
      doc = await decompressObject(encContent);
      if (doc.type == "Request"){
        doc.showid = upsertResource.showid
      }
    } catch (e) {
      logger.warn('Failed to decode created resource', e, upsertResource);
      return;
    }

    const existingDoc = await db.get(doc.type, doc._id);
    if (existingDoc) {
      const resource = await store.getResourceByDocId(doc._id);
      if (resource.usn >= upsertResource.usn){
        console.warn("resource.usn >= doc.usn!", resource.usn, upsertResource.usn)
        continue;
      }
      // if Conflict
      if (doc.type == "Request") {
        const requestMeta = await models.requestMeta.getByParentId(doc._id)
        if (requestMeta && requestMeta.unsave){
          const conflictName = doc.name + "[Conflict]"
          const existingConflictDoc = await db.getWhere("Request", {name: conflictName});
          if (existingConflictDoc) {
            doc._id = existingConflictDoc._id
          } else {
            delete doc._id
          }
          delete doc.modified
          delete doc.showid
          doc.name = conflictName
          await db.upsert(doc);
          models.message.create({action: "confilct", doc, by: upsertResource.editor, workspaceId : currentWorkspaceId });
          continue;
        }
      }
      await saveResource(event, doc, upsertResource.usn, false)
      await db.update(doc, true);
      models.message.create({action: "update", doc, by: upsertResource.editor, workspaceId : currentWorkspaceId });
    } else {
      await db.insert(doc, true);
      saveResource(event, doc, upsertResource.usn, false)
      models.message.create({action: "insert", doc, by: upsertResource.editor, workspaceId : currentWorkspaceId });
    }
  }

  if (upsertResources.length) {
    logger.debug(`Pull created ${upsertResources.length} resources`);
  }

  db.flushChangesAsync();

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Remove all the docs that need removing //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // 删除所有需要被删除的 docs

  await db.bufferChanges();
  for (const deletedResource of deletedResources) {
    const doc = await decompressObject(deletedResource.encContent);
    if (!doc) {
      throw new Error(`Could not find doc to remove ${id}`);
    }

    // Remove from DB
    const existingDoc = await db.get(doc.type, doc._id);
    if (existingDoc) {
      await db.remove(existingDoc, true);
      models.message.create({action: "deleted", doc, by: deletedResource.deletor, workspaceId : currentWorkspaceId});
    }
  }
  db.flushChangesAsync();
  
  const newCurrentWorkspaceMeta = await models.workspaceMeta.getOrCreateByParentId(currentWorkspaceId);
  models.workspaceMeta.update(newCurrentWorkspaceMeta, {lastPullAt : pull_at});
  return upsertResources.length + deletedResources.length;
}

// 如果当前激活的 Workspace 被删除或取消分享，那么必须将当前激活的 workspace 切换为其他 Workspace，再操作，同时停止当前 pull ，因为 currentWorkspace 已经被删除
// 同时如果被删除的是当前用户的最后一个 workspace，那么必须创建一个新的 - all 就会创建，所以这个有必要吗？
async function removeCurrentWorkspace(currentWorkspaceId){
  const uidWorkspaces = await db.find("Workspace", { uid: session.getBaseid() })
  if (uidWorkspaces.length <= 1){
    showModal(AlertModal, {
      title: 'Deleting Last Workspace',
      message: 'Since sync deleted your only workspace, a new one has been created for you.'
    });

    const newWorkspace = await models.workspace.create({ name: 'Example Project' });
    await reduxstore.dispatch(setActiveWorkspace(newWorkspace._id))
  } else {
    await reduxstore.dispatch(setActiveWorkspace(uidWorkspaces[0]._id != currentWorkspaceId ? uidWorkspaces[0]._id : uidWorkspaces[1]._id))
  }
}

export async function logout() {
  await session.logout();
  // await resetLocalData();
}

export async function cancelTrial() {
  await session.endTrial();
  await session.logout();
  // await resetLocalData();
}

export async function resetLocalData() {
  for (const r of await store.allResources()) {
    await store.removeResource(r);
  }
}

export async function resetRemoteData() {
  await session.syncResetData();
}

// ~~~~~~~ //
// HELPERS //
// ~~~~~~~ //

async function _getWorkspaceForDoc(doc) {
  const ancestors = await db.withAncestors(doc);
  return ancestors.find(d => d.type === models.workspace.type);
}

export async function createResource(doc) {
  const workspace = await _getWorkspaceForDoc(doc)
  const currentWorkspaceId = JSON.parse(window.localStorage.getItem(`apiplus::meta::activeWorkspaceId`));
  const workspaceId = workspace ? workspace._id : currentWorkspaceId
  const uid = session.getBaseid()
  return store.insertResource({
    id: doc._id,
    workspaceId: workspaceId,
    name: doc.name || 'n/a', // Set name to the doc name if it has one
    version: NO_VERSION,
    usn: 0,
    createdBy: uid,
    lastEdited: doc.modified,
    lastEditedBy: uid,
    removed: false,
    type: doc.type,
    encContent: await compressObject(doc),
    dirty: true
  });
}

export async function createResourceForDoc(doc) {
  // No resource yet, so create one
  // 还没有 resource ，所以创建一个
  // const workspace = await _getWorkspaceForDoc(doc);

  // if (!workspace) {
  //   // Workspace was probably deleted before it's children could be synced.
  //   // TODO: Handle this case better
  //   // 工作区可能在 children 可以同步之前被删除。
  //   // TODO: 需要改进
  //   throw new Error(`Could not find workspace for doc ${doc._id}`);
  // }

  // 为什么必须有一个 workspaceResource ？ 不清楚
  // let workspaceResource = await store.getResourceByDocId(workspace._id);

  // if (!workspaceResource) {
  //   workspaceResource = await createResource(workspace);
  // }

  // if (workspace._id === doc._id) {
  //   // If the current doc IS a Workspace, just return it
  //   // 如果当前文档是 Workspace，返回
  //   return workspaceResource;
  // } else {
  //   return createResource(doc);
  // }
  return createResource(doc)
}

export async function getOrCreateResourceForDoc(doc) {
  let [resource, ...extras] = await store.findResourcesByDocId(doc._id);

  // Sometimes there may be multiple resources created by accident for
  // the same doc. Let's delete the extras here if there are any.
  // 有时对于同一 doc 可能会有多个意外产生的资源。让我们删除额外的，如果有的话。
  for (const resource of extras) {
    await store.removeResource(resource);
  }

  if (resource) {
    return resource;
  } else {
    return createResourceForDoc(doc);
  }
}

export async function getOrCreateAllActiveResources() {
  const startTime = Date.now();
  const activeResourceMap = {};

  let activeResources = await store.allActiveResources();

  for (const r of activeResources) {
    activeResourceMap[r.id] = r;
  }

  // Make sure Workspace is first, because the loop below depends on it
  // 确保工作区是最优先的，因为下面的循环取决于它。
  const modelTypes = Object.keys(WHITE_LIST).sort(
    (a, b) => (a.type === models.workspace.type ? 1 : -1)
  );

  let created = 0;
  for (const type of modelTypes) {
    for (const doc of await db.all(type)) {
      if (doc.isPrivate) {
        // logger.debug(`Skip private doc ${doc._id}`);
        continue;
      }

      const resource = await store.getResourceByDocId(doc._id);
      if (!resource) {
        try {
          activeResourceMap[doc._id] = await createResourceForDoc(doc);
          created++;
        } catch (e) {
          // logger.warn(`Failed to create resource for ${doc._id} ${e}`, {doc});
        }
      }
    }
  }

  const resources = Object.keys(activeResourceMap).map(k => activeResourceMap[k]);

  const time = (Date.now() - startTime) / 1000;
  if (created > 0) {
    logger.debug(`Created ${created}/${resources.length} Resources (${time.toFixed(2)}s)`);
  }
  return resources;
}