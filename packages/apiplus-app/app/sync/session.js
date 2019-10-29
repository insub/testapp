import srp from 'srp-js';
import * as crypt from './crypt';
import * as util from '../common/fetch';
import * as models from '../models/index';
import { showAlert, showModal, showPrompt } from '../ui/components/modals/index';
import AlertModal from '../ui/components/modals/alert-modal';
import AskBindingModal from '../ui/components/modals/ask-binding-modal';
import * as sync from '../sync';
import { setActiveWorkspace } from '../ui/redux/modules/global';

/** Create a new session for the user */
export async function login(rawEmail, rawPassphrase) {
  // ~~~~~~~~~~~~~~~ //
  // Sanitize Inputs //
  // ~~~~~~~~~~~~~~~ //

  const email = _sanitizeEmail(rawEmail);
  const passphrase = _sanitizePassphrase(rawPassphrase);

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Email Login                       //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  const { baseid, auth_token, nickname, avatar, plan, quota, expire_date, lastWorkspace } = await util.post('/login', { email, password: passphrase });
  showModal(AskBindingModal, {
    uid: baseid,
    avatar,
    nickname,
    onDone: async () => {
      // Store the information for later
      await initUidWorkspace(baseid, lastWorkspace)

      setSessionData(
        email,
        baseid,
        auth_token,
        nickname,
        avatar,
        plan,
        quota,
        expire_date
      );
      
      await models.stats.update({isLoggedIn: true});
      await sync.doInitialSync()
    }
  });
}

/** Create a new session for the user */
export async function skeyLogin(skey) {
  const { email, baseid, auth_token, nickname, avatar, plan, quota, expire_date, lastWorkspace } = await util.post('/skey_login', { skey: skey });
  // Store the information for later
  showModal(AskBindingModal, {
    uid: baseid,
    avatar,
    nickname,
    onDone: async () => {
      // Store the information for later
      await initUidWorkspace(baseid, lastWorkspace)

      setSessionData(
        email,
        baseid,
        auth_token,
        nickname,
        avatar,
        plan,
        quota,
        expire_date
      );
      
      await models.stats.update({isLoggedIn: true});
      await sync.doInitialSync()
    }
  });
}

// 在登录的时候就把所有项目/最后一个有效项目下载到本地，否则如果本机未登录过，会导致在当前帐号下建 Example Project -> workspace.js -> all()
// uid 优先级 -> 本地 bind 的未登录的项目 -> 登录时拉下来的最后一个有效项目 -> 本地原先就有该 uid 的项目 -> 本地新建一个项目
async function initUidWorkspace (uid, lastWorkspace) {
  if (lastWorkspace && lastWorkspace._id){
    let workspace = await models.workspace.getById(lastWorkspace._id)
    if (!workspace) {
      workspace = await models.workspace.create(lastWorkspace);
    }
    const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id)
    await models.workspaceMeta.update( workspaceMeta, {uid});
  }
}

export function syncGetResourceGroup(id) {
  // return util.get(`/api/resource_groups/${id}`);
}

export function syncPull(body) {
  return util.post('/sync/pull', body);
}

export function syncPush(body) {
  return util.post('/sync/push', body);
}

export function syncResetData() {
  return util.post('/auth/reset');
}

export function syncFixDupes(resourceGroupIds) {
  return util.post('/sync/fix-dupes', { ids: resourceGroupIds });
}

export function unshareWithAllTeams(resourceGroupId) {
  return util.put(`/api/resource_groups/${resourceGroupId}/unshare`);
}

export async function shareWithTeam(resourceGroupId, teamId, rawPassphrase) {
  // Ask the server what we need to do to invite the member
  const instructions = await util.post(`/api/resource_groups/${resourceGroupId}/share-a`, {
    teamId
  });

  // Compute keys necessary to invite the member
  const passPhrase = _sanitizePassphrase(rawPassphrase);
  const { email, saltEnc, encPrivateKey, encSymmetricKey } = await whoami();
  const secret = await crypt.deriveKey(passPhrase, email, saltEnc);
  let symmetricKey;
  try {
    symmetricKey = crypt.decryptAES(secret, JSON.parse(encSymmetricKey));
  } catch (err) {
    throw new Error('Invalid password');
  }
  const privateKey = crypt.decryptAES(JSON.parse(symmetricKey), JSON.parse(encPrivateKey));
  const privateKeyJWK = JSON.parse(privateKey);
  const resourceGroupSymmetricKey = crypt.decryptRSAWithJWK(
    privateKeyJWK,
    instructions.encSymmetricKey
  );

  // Build the invite data request
  const newKeys = {};
  for (const accountId of Object.keys(instructions.keys)) {
    const accountPublicKeyJWK = JSON.parse(instructions.keys[accountId]);
    newKeys[accountId] = crypt.encryptRSAWithJWK(accountPublicKeyJWK, resourceGroupSymmetricKey);
  }

  // Actually share it with the team
  await util.post(`/api/resource_groups/${resourceGroupId}/share-b`, {
    teamId,
    keys: newKeys
  });
}

export function getPrivateKey() {
  const { symmetricKey, encPrivateKey } = getSessionData();
  const privateKeyStr = crypt.decryptAES(symmetricKey, encPrivateKey);
  return JSON.parse(privateKeyStr);
}

export function getCurrentAuthToken() {
  if (window) {
    return window.localStorage.getItem('currentAuthToken');
  } else {
    return false;
  }
}

export function getCurrentBaseid() {
  if (window) {
    return window.localStorage.getItem('currentBaseid');
  } else {
    return false;
  }
}

export function getBaseid() {
  return getSessionData().baseid || null;
}

export function getPlan() {
  return getSessionData().plan;
}

export function getAccountId() {
  return getSessionData().baseid;
}

export function getEmail() {
  return getSessionData().email;
}

export function getNickname() {
  return getSessionData().nickname;
}

export function getAvatar() {
  return getSessionData().avatar ? getSessionData().avatar.url : null;
}

export function getQuota() {
  return getSessionData().quota;
}

/**
 * get Data about the current session
 * @returns Object
 */
export function getSessionData() {
  const auth_token = getCurrentAuthToken();
  if (!auth_token || !window) {
    return {};
  }

  const dataStr = window.localStorage.getItem(getAuthToken(auth_token));
  return JSON.parse(dataStr);
}

/** Set data for the new session and store it encrypted with the sessionId */
export function setSessionData(
  email,
  baseid,
  auth_token,
  nickname,
  avatar,
  plan,
  quota,
  expire_date
) {
  const dataStr = JSON.stringify({
    email: email,
    baseid: baseid,
    auth_token: auth_token,
    nickname: nickname,
    avatar: avatar,
    plan: plan,
    quota: quota,
    expire_date: expire_date
  });

  window.localStorage.setItem(getAuthToken(auth_token), dataStr);

  // NOTE: We're setting this last because the stuff above might fail
  window.localStorage.setItem('currentAuthToken', auth_token);
}

export function updateSessionData(newData) {
  const userData = getSessionData()
  const {nickname, avatar, plan, quota, expire_date} = newData
  const dataStr = JSON.stringify({
    email: userData.email,
    baseid: userData.baseid,
    auth_token: userData.auth_token,
    nickname: nickname,
    avatar: avatar,
    plan: plan,
    quota: quota,
    expire_date: expire_date
  });

  window.localStorage.setItem(userData.auth_token, dataStr);
}

/** Unset the session data (log out) */
export function unsetSessionData() {
  const auto_token = getCurrentAuthToken();
  window.localStorage.removeItem(getAuthToken(auto_token));
  window.localStorage.removeItem(`currentAuthToken`);
}

/** Check if we (think) we have a session */
export function isLoggedIn() {
  return getCurrentAuthToken();
}

/** Log out and delete session data */
export async function logout() {
  try {
    await util.del('/logout');
  } catch (e) {
    // Not a huge deal if this fails, but we don't want it to prevent the
    // user from signing out.
    console.warn('Failed to logout', e);
  }

  await models.stats.update({isLoggedIn: false});
  unsetSessionData();
}

export async function listTeams() {
  return util.get('/api/teams');
}

export async function listMembers(workspaceId) {
  return util.get(`/projects/${workspaceId}/project_users`);;
}

export async function endTrial() {
  await util.put('/api/billing/end-trial');
}

export function whoami(auth_token = null) {
  return util.get('/auth/whoami', auth_token);
}

export function getAuthToken(auth_token) {
  return `${(auth_token || '')}`;
}

// ~~~~~~~~~~~~~~~~ //
// Helper Functions //
// ~~~~~~~~~~~~~~~~ //

function _sanitizeEmail(email) {
  return email.trim().toLowerCase();
}

function _sanitizePassphrase(passphrase) {
  return passphrase.trim().normalize('NFKD');
}
