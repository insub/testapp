import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import fs from 'fs';
import { clipboard, ipcRenderer, remote } from 'electron';
import { parse as urlParse } from 'url';
import HTTPSnippet from 'insomnia-httpsnippet';
import ReactDOM from 'react-dom';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import Wrapper from '../components/wrapper';
import WorkspaceEnvironmentsEditModal from '../components/modals/workspace-environments-edit-modal';
import Toast from '../components/toast';
import CookiesModal from '../components/modals/cookies-modal';
import LoginModal from '../components/modals/login-modal';
import RequestSwitcherModal from '../components/modals/request-switcher-modal';
import SettingsModal, { TAB_INDEX_SHORTCUTS } from '../components/modals/settings-modal';
import {
  COLLAPSE_SIDEBAR_REMS,
  DEFAULT_PANE_HEIGHT,
  DEFAULT_PANE_WIDTH,
  DEFAULT_SIDEBAR_WIDTH,
  MAX_PANE_HEIGHT,
  MAX_PANE_WIDTH,
  MAX_SIDEBAR_REMS,
  MIN_PANE_HEIGHT,
  MIN_PANE_WIDTH,
  MIN_SIDEBAR_REMS,
  PREVIEW_MODE_SOURCE
} from '../../common/constants';
import * as globalActions from '../redux/modules/global';
import * as db from '../../common/database';
import * as models from '../../models';
import {
  selectActiveCookieJar,
  selectActiveOAuth2Token,
  selectActiveRequest,
  selectActiveRequestMeta,
  selectActiveRequestResponses,
  selectActiveResponse,
  selectActiveWorkspace,
  selectActiveWorkspaceClientCertificates,
  selectActiveWorkspaceMeta,
  selectEntitiesLists,
  selectSidebarChildren,
  selectUnseenWorkspaces,
  selectUidWorkspaces,
  selectUidMessages,
  selectWorkspaceRequestsAndRequestGroups,
  selectRequestMetas
} from '../redux/selectors';
import RequestCreateModal from '../components/modals/request-create-modal';
import TempRequestCreateModal from '../components/modals/temp-request-create-modal';
import GenerateCodeModal from '../components/modals/generate-code-modal';
import WorkspaceSettingsModal from '../components/modals/workspace-settings-modal';
import WorkspaceDashboardModal from '../components/modals/workspace-dashboard-modal';
import RequestSettingsModal from '../components/modals/request-settings-modal';
import RequestRenderErrorModal from '../components/modals/request-render-error-modal';
import * as network from '../../network/network';
import { debounce, getContentDispositionHeader, delay } from '../../common/misc';
import * as mime from 'mime-types';
import * as path from 'path';
import * as render from '../../common/render';
import { getKeys } from '../../templating/utils';
import { showAlert, showModal, showPrompt } from '../components/modals/index';
import { exportHarRequest } from '../../common/har';
import * as hotkeys from '../../common/hotkeys';
import KeydownBinder from '../components/keydown-binder';
import ErrorBoundary from '../components/error-boundary';
import * as plugins from '../../plugins';
import * as templating from '../../templating/index';
import AskModal from '../components/modals/ask-modal';
import AskSaveModal from '../components/modals/ask-save-modal';
import { updateMimeType } from '../../models/request';
import MoveRequestGroupModal from '../components/modals/move-request-group-modal';
import * as themes from '../../plugins/misc';
import { ToastContainer, toast as itoast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import * as session from '../../sync/session';
import * as sync from '../../sync';
import iconv from 'iconv-lite';
import HotkeysTipsModal from '../components/modals/hotkeys-tips-modal';

@autobind
class App extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      showDragOverlay: false,
      draggingSidebar: false,
      draggingPaneHorizontal: false,
      draggingPaneVertical: false,
      sidebarWidth: props.sidebarWidth || DEFAULT_SIDEBAR_WIDTH,
      paneWidth: props.paneWidth || DEFAULT_PANE_WIDTH,
      paneHeight: props.paneHeight || DEFAULT_PANE_HEIGHT,
      collapseResponse: false,
      nrLoading: false,
      pushSuccess: false,
      triggerPush: false,
      triggerPushResponse: false
    };

    this._isMigratingChildren = false;

    this._getRenderContextPromiseCache = {};

    this._savePaneWidth = debounce(paneWidth => this._updateActiveWorkspaceMeta({ paneWidth }));
    this._savePaneHeight = debounce(paneHeight => this._updateActiveWorkspaceMeta({ paneHeight }));
    this._saveSidebarWidth = debounce(sidebarWidth =>
      this._updateActiveWorkspaceMeta({ sidebarWidth })
    );
 
    this._globalKeyMap = null;
  }

  _setGlobalKeyMap() {
    this._globalKeyMap = [
      [
        hotkeys.SHOW_WORKSPACE_SETTINGS,
        () => {
          const { activeWorkspace } = this.props;
          showModal(WorkspaceSettingsModal, activeWorkspace);
        }
      ],
      [
        hotkeys.SHOW_REQUEST_SETTINGS,
        () => {
          if (this.props.activeRequest) {
            showModal(RequestSettingsModal, {
              request: this.props.activeRequest
            });
          }
        }
      ],
      [
        hotkeys.SHOW_QUICK_SWITCHER,
        () => {
          showModal(RequestSwitcherModal);
        }
      ],
      [hotkeys.SEND_REQUEST, this._handleSendShortcut],
      [hotkeys.SEND_REQUEST_R, this._handleSendShortcut],
      [hotkeys.RESTORE_REQUEST, this._handleReloadActiveRequest],
      [hotkeys.RESTORE_REQUEST_F12, this._handleReloadActiveRequest],
      [
        hotkeys.SHOW_ENVIRONMENTS,
        () => {
          const { activeWorkspace } = this.props;
          showModal(WorkspaceEnvironmentsEditModal, activeWorkspace);
        }
      ],
      [
        hotkeys.SHOW_COOKIES,
        () => {
          const { activeWorkspace } = this.props;
          showModal(CookiesModal, activeWorkspace);
        }
      ],
      [
        hotkeys.CREATE_REQUEST,
        () => {
          const { activeRequest, activeWorkspace } = this.props;
          const parentId = activeRequest ? activeRequest.parentId : activeWorkspace._id;
          this._requestCreate(parentId);
        }
      ],
      [
        hotkeys.DELETE_REQUEST,
        () => {
          const { activeRequest } = this.props;

          if (!activeRequest) {
            return;
          }

          showModal(AskModal, {
            title: 'Delete Request?',
            message: `Really delete ${activeRequest.name}?`,
            onDone: confirmed => {
              if (confirmed) {
                return;
              }
              this._handleTab('delete', activeRequest._id).then(() => {
                models.request.remove(activeRequest);
              });
            }
          });
        }
      ],
      [
        hotkeys.CREATE_FOLDER,
        () => {
          const { activeRequest, activeWorkspace } = this.props;
          const parentId = activeRequest ? activeRequest.parentId : activeWorkspace._id;
          this._requestGroupCreate(parentId);
        }
      ],
      [
        hotkeys.GENERATE_CODE,
        async () => {
          showModal(GenerateCodeModal, this.props.activeRequest);
        }
      ],
      [
        hotkeys.DUPLICATE_REQUEST,
        async () => {
          await this._requestDuplicateToTemp(this.props.activeRequest);
        }
      ],
      [
        hotkeys.CLOSE_ACTIVE_TAB,
        () => {
          const { activeRequest } = this.props;
          this._handleTab('delete', activeRequest._id);
        }
      ],
      [
        hotkeys.SAVE_REQUEST,
        async () => {
          this._handleSaveAndPush();
        }
      ],
      [
        hotkeys.SAVE_RESPONSE,
        async () => {
          this._handlePushResponseBody();
        }
      ],
      [
        hotkeys.COLLAPSE_SIDEBAR,
        () => {
          this._handleToggleSidebar();
        }
      ],
      [
        hotkeys.COLLAPSE_RESPONSE,
        () => {
          this._toggleCollapseResponse();
        }
      ],
      [
        hotkeys.TOGGLE_PANE,
        () => {
          this._wrapper._togglePaneMode();
        }
      ],
      [
        hotkeys.TOGGLE_PASTER,
        () => {
          this._handleTogglePaster();
        }
      ],
      [
        hotkeys.PULL,
        () => {
          this._handlePull();
        }
      ],
      [
        hotkeys.PUSH,
        () => {
          this._handlePush();
        }
      ],
      [
        hotkeys.OPEN_DEVTOOLS,
        () => {
          this._handleOpenDevTools();
        }
      ]
    ];
  }

  async _handleSendShortcut() {
    const { activeRequest, activeEnvironment } = this.props;
    await this._handleSendRequestWithEnvironment(
      activeRequest ? activeRequest._id : 'n/a',
      activeEnvironment ? activeEnvironment._id : 'n/a'
    );
  }

  _setRequestPaneRef(n) {
    this._requestPane = n;
  }

  _setResponsePaneRef(n) {
    this._responsePane = n;
  }

  _setSidebarRef(n) {
    this._sidebar = n;
  }

  _requestGroupCreate(parentId) {
    showPrompt({
      title: 'New Folder',
      defaultValue: 'New Folder',
      submitName: 'Create',
      label: '',
      selectText: true,
      onComplete: async name => {
        const requestGroup = await models.requestGroup.create({
          parentId,
          name
        });
        await models.requestGroupMeta.create({
          parentId: requestGroup._id,
          collapsed: false
        });
      }
    });
  }

  _requestCreate(parentId) {
    showModal(RequestCreateModal, {
      parentId,
      onComplete: request => {
        this._handleSetActiveRequest(request._id);
      }
    });
  }

  _tempRequestCreate(request) {
    showModal(TempRequestCreateModal, {
      request
    });
  }

  async _requestGroupDuplicate(requestGroup) {
    models.requestGroup.duplicate(requestGroup);
  }

  async _requestGroupMove(requestGroup) {
    showModal(MoveRequestGroupModal, { requestGroup });
  }

  async _requestDuplicate(request) {
    if (!request) {
      return;
    }
    
    const newRequest = await models.request.duplicate(request);
    await this._handleSetActiveRequest(newRequest._id);
  }

  async _workspaceDuplicate(callback) {
    const workspace = this.props.activeWorkspace;
    showPrompt({
      title: 'Duplicate Workspace',
      defaultValue: `${workspace.name} (Copy)`,
      submitName: 'Duplicate',
      selectText: true,
      onComplete: async name => {
        const newWorkspace = await db.duplicate(workspace, { name });
        await this.props.handleSetActiveWorkspace(newWorkspace._id);
        callback();
      }
    });
  }

  async _fetchRenderContext() {
    const { activeEnvironment, activeRequest, activeWorkspace } = this.props;
    const environmentId = activeEnvironment ? activeEnvironment._id : null;

    const ancestors = await db.withAncestors(activeRequest || activeWorkspace, [
      models.request.type,
      models.requestGroup.type,
      models.workspace.type
    ]);

    return render.getRenderContext(activeRequest, environmentId, ancestors);
  }

  async _handleGetRenderContext() {
    const context = await this._fetchRenderContext();
    const keys = getKeys(context);
    return { context, keys };
  }

  /**
   * Heavily optimized render function
   *
   * @param text - template to render
   * @param contextCacheKey - if rendering multiple times in parallel, set this
   * @returns {Promise}
   * @private
   */
  async _handleRenderText(text, contextCacheKey = null) {
    if (!contextCacheKey || !this._getRenderContextPromiseCache[contextCacheKey]) {
      const context = this._fetchRenderContext();

      // NOTE: We're caching promises here to avoid race conditions
      this._getRenderContextPromiseCache[contextCacheKey] = context;
    }

    // Set timeout to delete the key eventually
    setTimeout(() => delete this._getRenderContextPromiseCache[contextCacheKey], 5000);

    const context = await this._getRenderContextPromiseCache[contextCacheKey];
    return render.render(text, context);
  }

  _handleGenerateCodeForActiveRequest() {
    this._handleGenerateCode(this.props.activeRequest);
  }

  _handleGenerateCode(request) {
    showModal(GenerateCodeModal, request);
  }

  async _handleCopyAsCurl(request) {
    const { activeEnvironment } = this.props;
    const environmentId = activeEnvironment ? activeEnvironment._id : 'n/a';
    const har = await exportHarRequest(request._id, environmentId);
    const snippet = new HTTPSnippet(har);
    const cmd = snippet.convert('shell', 'curl');
    clipboard.writeText(cmd);
  }

  async _updateRequestGroupMetaByParentId(requestGroupId, patch) {
    const requestGroupMeta = await models.requestGroupMeta.getByParentId(requestGroupId);
    if (requestGroupMeta) {
      await models.requestGroupMeta.update(requestGroupMeta, patch);
    } else {
      const newPatch = Object.assign({ parentId: requestGroupId }, patch);
      await models.requestGroupMeta.create(newPatch);
    }
  }

  async _updateActiveWorkspaceMeta(patch) {
    const workspaceId = this.props.activeWorkspace._id;
    const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);
    if (workspaceMeta) {
      return models.workspaceMeta.update(workspaceMeta, patch);
    } else {
      const newPatch = Object.assign({ parentId: workspaceId }, patch);
      return models.workspaceMeta.create(newPatch);
    }
  }

  async _updateRequestMetaByParentId(requestId, patch) {
    const requestMeta = await models.requestMeta.getByParentId(requestId);
    if (requestMeta) {
      return models.requestMeta.update(requestMeta, patch);
    } else {
      const newPatch = Object.assign({ parentId: requestId }, patch);
      return models.requestMeta.create(newPatch);
    }
  }

  _handleSetPaneWidth(paneWidth) {
    this.setState({ paneWidth });
    this._savePaneWidth(paneWidth);
  }

  _handleSetPaneHeight(paneHeight) {
    this.setState({ paneHeight });
    this._savePaneHeight(paneHeight);
  }

  async _handleTab(action, requestId = null, fld = null) {
    let newRtabs = [];
    let activeTabIndex = 0;
    switch (action) {
      case 'delete':
        // 关闭 tab
        if (!this.props.rtabs.find(rtab => rtab.requestId === requestId)) {
          return;
        }
        const request = this.props.requests.find(r => r._id === requestId);
        const requestMeta = await models.requestMeta.getOrCreateByParentId(requestId)
        // 如果当前有修改还没保存，那么提示是否保存
        let goOn = true;
        let answer;
        if (requestMeta.unsave) {
          answer = await showModal(AskSaveModal, {
            title: 'Do you want to save?',
            message: 'Your changes will be lost if you close this unsaved tab without saving.'
          });
          if (answer === "cancel"){
            // 什么也不做
            goOn = false
          }
        }
        if (goOn){
          newRtabs = this.props.rtabs.filter(e => e.requestId !== requestId);
          // 激活新 tab，如果当前 currentTabIndex 不是最后一个，那么 activeTabIndex 不用改变，否则就得 index - 1
          if (
            this.props.rtabs.length - this.props.rtabActiveIndex == 1 &&
            this.props.rtabs.length > 1
          ) {
            activeTabIndex = this.props.rtabActiveIndex - 1;
          } else {
            activeTabIndex = this.props.rtabActiveIndex;
          }
          // 关闭 tab，激活新的接口以及相关Tab，如无则激活为空
          await this._updateActiveWorkspaceMeta({
            activeRequestId: newRtabs.length ? newRtabs[activeTabIndex].requestId : null,
            rtabs: newRtabs,
            rtabActiveIndex: newRtabs.length ? activeTabIndex : null
          });
          if (answer === "yes"){
            // 保存当前数据，并继续关闭
            this._handleSaveAndPush()
          }
          if (answer === "no"){
            // 不保存当前数据，需恢复数据，并继续关闭
            const requestBackup = await models.requestBackup.getLatestByParentId(request._id);
            await models.requestBackup.restore(requestBackup._id);
          }
          // 如果是临时接口，那么将其删除
          if (request.isTemp) {
            models.request.remove(request);
          }
        }
        break;
      case 'deleteFld':
        // 删除文件夹，文件夹及后代文件夹的所有接口的相关 tabs 也都需要删除，如果包含当前激活的 tab ，那么设置所有 tabs 里的第一个 tab 为激活
        const descendents = await db.withDescendants(fld);
        const requestIds = descendents.filter(d => d.type === models.request.type).map(r => r._id);
        newRtabs = this.props.rtabs.filter(t => !requestIds.includes(t.requestId));
        activeTabIndex = this.props.activeRequest && requestIds.includes(this.props.activeRequest._id)
          ? 0
          : this.props.rtabActiveIndex;
        await this._updateActiveWorkspaceMeta({
          activeRequestId: newRtabs.length ? newRtabs[activeTabIndex].requestId : null,
          rtabs: newRtabs,
          rtabActiveIndex: newRtabs.length ? activeTabIndex : null
        });
        break;
      case 'add':
        // 点击 tab 栏新建一个 tab，创建一个临时接口，并且设置 activeRequestId ，设置 rtabActiveIndex 为最后一个
        break;
      default:
        console.warn('Get _handleTab default !!!!');
    }
  }

  async _handleReloadActiveRequest() {
    const currentRequest = this.props.activeRequest;
    if (!currentRequest){
      return
    }
    const requestBackup = await models.requestBackup.getLatestByParentId(currentRequest._id);
    await models.requestBackup.restore(requestBackup._id);
    setTimeout(this._wrapper._forceRequestPaneRefresh, 100);
  }

  async _handleSetActiveRequest(activeRequestId, tabAction = 'show') {
    // await this._updateActiveWorkspaceMeta({activeRequestId});
    // activeRequestId 是允许为空的
    // 创建的时候会自动激活，为什么？
    console.warn("activeRequestId", activeRequestId)
    const existTabIndex = this.props.rtabs.findIndex(rtab => rtab.requestId === activeRequestId);
    if (existTabIndex === -1) {
      const newRtabs = [...this.props.rtabs, { requestId: activeRequestId }];
      await this._updateActiveWorkspaceMeta({
        activeRequestId,
        rtabs: newRtabs,
        rtabActiveIndex: newRtabs.length - 1
      });
      await models.requestBackup.create(activeRequestId);
    } else {
      await this._updateActiveWorkspaceMeta({
        activeRequestId,
        rtabActiveIndex: existTabIndex
      });
    }
  }

  async _handleSetActiveEnvironment(activeEnvironmentId) {
    await this._updateActiveWorkspaceMeta({ activeEnvironmentId });

    // Give it time to update and re-render
    setTimeout(() => {
      this._wrapper._forceRequestPaneRefresh();
    }, 100);
  }

  _handleSetSidebarWidth(sidebarWidth) {
    this.setState({ sidebarWidth });
    this._saveSidebarWidth(sidebarWidth);
  }

  async _handleSetSidebarHidden(sidebarHidden) {
    await this._updateActiveWorkspaceMeta({ sidebarHidden });
  }

  async _handleSetPasterHidden(pasterHidden) {
    await this._updateActiveWorkspaceMeta({ pasterHidden });
  }

  async _handleSetSidebarFilter(sidebarFilter) {
    await this._updateActiveWorkspaceMeta({ sidebarFilter });
  }

  _handleSetRequestGroupCollapsed(requestGroupId, collapsed) {
    this._updateRequestGroupMetaByParentId(requestGroupId, { collapsed });
  }

  _handleSetResponsePreviewMode(requestId, previewMode) {
    this._updateRequestMetaByParentId(requestId, { previewMode });
  }

  async _handleSetResponseFilter(requestId, responseFilter) {
    await this._updateRequestMetaByParentId(requestId, { responseFilter });

    clearTimeout(this._responseFilterHistorySaveTimeout);
    this._responseFilterHistorySaveTimeout = setTimeout(async () => {
      const meta = await models.requestMeta.getByParentId(requestId);
      const responseFilterHistory = meta.responseFilterHistory.slice(0, 10);

      // Already in history?
      if (responseFilterHistory.includes(responseFilter)) {
        return;
      }

      // Blank?
      if (!responseFilter) {
        return;
      }

      responseFilterHistory.unshift(responseFilter);
      await this._updateRequestMetaByParentId(requestId, {
        responseFilterHistory
      });
    }, 2000);
  }

  async _handleUpdateRequestMimeType(mimeType) {
    if (!this.props.activeRequest) {
      console.warn('Tried to update request mime-type when no active request');
      return null;
    }

    const requestMeta = await models.requestMeta.getOrCreateByParentId(
      this.props.activeRequest._id
    );
    const savedBody = requestMeta.savedRequestBody;

    const saveValue =
      typeof mimeType !== 'string' // Switched to No body
        ? this.props.activeRequest.body
        : {}; // Clear saved value in requestMeta

    await models.requestMeta.update(requestMeta, {
      savedRequestBody: saveValue
    });

    const newRequest = await updateMimeType(this.props.activeRequest, mimeType, false, savedBody);

    // Force it to update, because other editor components (header editor)
    // needs to change. Need to wait a delay so the next render can finish
    setTimeout(this._wrapper._forceRequestPaneRefresh, 300);

    return newRequest;
  }

  async _handleSendAndDownloadRequestWithEnvironment(requestId, environmentId, dir) {
    const request = await models.request.getById(requestId);
    if (!request) {
      return;
    }

    // NOTE: Since request is by far the most popular event, we will throttle
    // it so that we only track it if the request has changed since the last one
    const key = request._id;
    if (this._sendRequestTrackingKey !== key) {
      this._sendRequestTrackingKey = key;
    }

    // Start loading
    this.props.handleStartLoading(requestId);

    try {
      const responsePatch = await network.send(requestId, environmentId);
      const headers = responsePatch.headers || [];
      const header = getContentDispositionHeader(headers);
      const nameFromHeader = header ? header.value : null;

      if (!responsePatch.bodyPath) {
        return;
      }

      if (responsePatch.statusCode >= 200 && responsePatch.statusCode < 300) {
        const extension = mime.extension(responsePatch.contentType) || 'unknown';
        const name =
          nameFromHeader || `${request.name.replace(/\s/g, '-').toLowerCase()}.${extension}`;

        const filename = path.join(dir, name);
        const to = fs.createWriteStream(filename);
        const readStream = models.response.getBodyStream(responsePatch);

        if (!readStream) {
          return;
        }

        readStream.pipe(to);

        readStream.on('end', async () => {
          responsePatch.error = `Saved to ${filename}`;
          await models.response.create(responsePatch);
        });

        readStream.on('error', async err => {
          console.warn('Failed to download request after sending', responsePatch.bodyPath, err);
          await models.response.create(responsePatch);
        });
      }
    } catch (err) {
      showAlert({
        title: 'Unexpected Request Failure',
        message: (
          <div>
            <p>The request failed due to an unhandled error:</p>
            <code className="wide selectable">
              <pre>{err.message}</pre>
            </code>
          </div>
        )
      });
    }

    // Unset active response because we just made a new one
    await this._updateRequestMetaByParentId(requestId, {
      activeResponseId: null
    });

    // Stop loading
    this.props.handleStopLoading(requestId);
  }

  async _handleSendRequestWithEnvironment(requestId, environmentId) {
    const request = await models.request.getById(requestId);
    if (!request) {
      return;
    }

    // NOTE: Since request is by far the most popular event, we will throttle
    // it so that we only track it if the request has changed since the last one
    // 由于请求是迄今为止最流行的事件，因此我们将对它进行节流，以便只在请求自上次更改之后才跟踪它
    const key = `${request._id}::${request.modified}`;
    if (this._sendRequestTrackingKey !== key) {
      this._sendRequestTrackingKey = key;
    }

    this.props.handleStartLoading(requestId);

    try {
      const responsePatch = await network.send(requestId, environmentId);
      await models.response.create(responsePatch);
    } catch (err) {
      if (err.type === 'render') {
        showModal(RequestRenderErrorModal, { request, error: err });
      } else {
        showAlert({
          title: 'Unexpected Request Failure',
          message: (
            <div>
              <p>The request failed due to an unhandled error:</p>
              <code className="wide selectable">
                <pre>{err.message}</pre>
              </code>
            </div>
          )
        });
      }
    }

    // Unset active response because we just made a new one
    await this._updateRequestMetaByParentId(requestId, {
      activeResponseId: null
    });

    // Stop loading
    this.props.handleStopLoading(requestId);
  }

  async _handleSetActiveResponse(requestId, activeResponse = null) {
    const activeResponseId = activeResponse ? activeResponse._id : null;
    await this._updateRequestMetaByParentId(requestId, { activeResponseId });

    let response;
    if (activeResponseId) {
      response = await models.response.getById(activeResponseId);
    } else {
      response = await models.response.getLatestForRequest(requestId);
    }

    const requestVersionId = response ? response.requestVersionId : 'n/a';
    const request = await models.requestVersion.restore(requestVersionId);

    if (request) {
      // Refresh app to reflect changes. Using timeout because we need to
      // wait for the request update to propagate.
      setTimeout(() => this._wrapper._forceRequestPaneRefresh(), 500);
    } else {
      // Couldn't restore request. That's okay
    }
  }

  _requestCreateForWorkspace() {
    this._requestCreate(this.props.activeWorkspace._id);
  }

  _startDragSidebar() {
    this.setState({ draggingSidebar: true });
  }

  _resetDragSidebar() {
    // TODO: Remove setTimeout need be not triggering drag on double click
    setTimeout(() => this._handleSetSidebarWidth(DEFAULT_SIDEBAR_WIDTH), 50);
  }

  _startDragPaneHorizontal() {
    this.setState({ draggingPaneHorizontal: true });
  }

  _startDragPaneVertical() {
    this.setState({ draggingPaneVertical: true });
  }

  _resetDragPaneHorizontal() {
    // TODO: Remove setTimeout need be not triggering drag on double click
    setTimeout(() => this._handleSetPaneWidth(DEFAULT_PANE_WIDTH), 50);
  }

  _resetDragPaneVertical() {
    // TODO: Remove setTimeout need be not triggering drag on double click
    setTimeout(() => this._handleSetPaneHeight(DEFAULT_PANE_HEIGHT), 50);
  }

  _handleMouseMove(e) {
    if (this.state.draggingPaneHorizontal) {
      // Only pop the overlay after we've moved it a bit (so we don't block doubleclick);
      const distance = this.props.paneWidth - this.state.paneWidth;
      if (!this.state.showDragOverlay && Math.abs(distance) > 0.02 /* % */) {
        this.setState({ showDragOverlay: true });
      }

      const requestPane = ReactDOM.findDOMNode(this._requestPane);
      const responsePane = ReactDOM.findDOMNode(this._responsePane);

      const requestPaneWidth = requestPane.offsetWidth;
      const responsePaneWidth = responsePane.offsetWidth;

      const pixelOffset = e.clientX - requestPane.offsetLeft;
      let paneWidth = pixelOffset / (requestPaneWidth + responsePaneWidth);
      paneWidth = Math.min(Math.max(paneWidth, MIN_PANE_WIDTH), MAX_PANE_WIDTH);

      this._handleSetPaneWidth(paneWidth);
    } else if (this.state.draggingPaneVertical) {
      // Only pop the overlay after we've moved it a bit (so we don't block doubleclick);
      // 拉动 request 和 response 之间的线
      const distance = this.props.paneHeight - this.state.paneHeight;
      if (!this.state.showDragOverlay && Math.abs(distance) > 0.02 /* % */) {
        this.setState({ showDragOverlay: true });
      }

      const requestPane = ReactDOM.findDOMNode(this._requestPane);
      const responsePane = ReactDOM.findDOMNode(this._responsePane);

      const requestPaneHeight = requestPane.offsetHeight;
      const responsePaneHeight = responsePane.offsetHeight;

      const pixelOffset = e.clientY - requestPane.offsetTop;
      let paneHeight = pixelOffset / (requestPaneHeight + responsePaneHeight);
      paneHeight = Math.min(Math.max(paneHeight, MIN_PANE_HEIGHT), MAX_PANE_HEIGHT);

      this._handleSetPaneHeight(paneHeight);
    } else if (this.state.draggingSidebar) {
      // Only pop the overlay after we've moved it a bit (so we don't block doubleclick);
      // 拉动 左边栏 和 主栏目 之间的线
      const distance = this.props.sidebarWidth - this.state.sidebarWidth;
      if (!this.state.showDragOverlay && Math.abs(distance) > 2 /* ems */) {
        this.setState({ showDragOverlay: true });
      }

      const currentPixelWidth = ReactDOM.findDOMNode(this._sidebar).offsetWidth;
      const ratio = e.clientX / currentPixelWidth;
      const width = this.state.sidebarWidth * ratio;

      let sidebarWidth = Math.min(width, MAX_SIDEBAR_REMS);

      if (sidebarWidth < COLLAPSE_SIDEBAR_REMS) {
        sidebarWidth = MIN_SIDEBAR_REMS;
      }

      this._handleSetSidebarWidth(sidebarWidth);
    }
  }

  _handleMouseUp() {
    if (this.state.draggingSidebar) {
      this.setState({ draggingSidebar: false, showDragOverlay: false });
    }

    if (this.state.draggingPaneHorizontal) {
      this.setState({ draggingPaneHorizontal: false, showDragOverlay: false });
    }

    if (this.state.draggingPaneVertical) {
      this.setState({ draggingPaneVertical: false, showDragOverlay: false });
    }
  }

  _handleKeyDown(e) {
    for (const [definition, callback] of this._globalKeyMap) {
      hotkeys.executeHotKey(e, definition, callback);
    }
  }

  _handleToggleMenuBar(hide) {
    for (const win of remote.BrowserWindow.getAllWindows()) {
      if (win.isMenuBarAutoHide() !== hide) {
        win.setAutoHideMenuBar(hide);
        win.setMenuBarVisibility(!hide);
      }
    }
  }

  _handleOpenDevTools() {
    for (const win of remote.BrowserWindow.getAllWindows()) {
      win.openDevTools()
    }
  }

  async _handleToggleSidebar() {
    const sidebarHidden = !this.props.sidebarHidden;
    await this._handleSetSidebarHidden(sidebarHidden);
  }

  async _handleTogglePaster() {
    const pasterHidden = !this.props.pasterHidden;
    await this._handleSetPasterHidden(pasterHidden);
  }

  _toggleCollapseResponse() {
    this.setState({ collapseResponse: !this.state.collapseResponse });
  }

  async _handlePull() {
    if (!this.props.isLoggedIn){
      showModal(LoginModal);
      return
    }
    await sync.pull()
  }

  async _handleSaveAndPush(doc = null) {
    const { activeRequest } = this.props;
    if (!activeRequest && !doc){
      itoast.warning(`Current not active request.`);
      return
    }

    const request = doc || activeRequest

    if (request.isTemp){
      this._tempRequestCreate(request);
      return
    }

    const requestMeta = await models.requestMeta.getByParentId(activeRequest._id);
    if (!doc && !requestMeta.unsave){
      return
    }

    // const finalRequest = await models.request.update(request, {modified: Date.now()});
    // 如果不这么写，保存的 resource 实际上就是旧的未修改 modified 的接口
    await sync.saveResource("update", request)
    this._handlePush()
  }

  async _handlePush() {
    if (!this.props.isLoggedIn){
      itoast.warning(`Please login first.`);
      showModal(LoginModal);
      return
    }

    const { activeWorkspace, workspaceMeta } = this.props;

    if (workspaceMeta.role == "viewer"){
      itoast.warning(`On this project, your role is viewer. Don't allow push change. The project's manager is ${activeWorkspace.owner ? activeWorkspace.owner.nickname : null}`, {autoClose: 3500});
      return
    }

    this.setState({ triggerPush: true });
    await delay(200)
    this.setState({ triggerPush: false });
    const pushSuccessCount = await sync.push()
    if (pushSuccessCount) {
      this.setState({ pushSuccess: true });
      await delay(3000)
      this.setState({ pushSuccess: false });
    }
  }

  async _handlePushResponseBody(): Buffer | null {
    const { activeWorkspace, activeRequest, activeResponse } = this.props;
    if (!activeResponse || activeRequest.isTemp || !activeRequest.showid) {
      itoast.error(`Related Request is temp request or unsave. Please save request first : CTRL+S`);
      return null;
    }
    this.setState({ triggerPushResponse: true });
    await delay(200)
    this.setState({ triggerPushResponse: false });
    this.setState({ nrLoading: true });
    const bodyBuffer = models.response.getBodyBuffer(activeResponse)
    const { contentType } = activeResponse;
    const match = contentType.match(/charset=([\w-]+)/);
    const charset = match && match.length >= 2 ? match[1] : 'utf-8';
    const currentResponse = this._decodeIconv(bodyBuffer, charset)
    const pushSuccessCount = await sync.pushResponse(activeWorkspace._id, activeRequest._id, currentResponse)
    if (pushSuccessCount) {
      this.setState({ pushSuccess: true });
      setTimeout(() => {
        this.setState({ pushSuccess: false });
      }, 3000);
    }
    this.setState({ nrLoading: false });
  }

  async _handleAddTempTab() {
    const request = await models.initModel(models.request.type, {
      parentId: this.props.activeWorkspace._id,
      name: 'TEMP',
      method: 'GET',
      isTemp: true
    });
    const finalRequest = await models.request.updateMimeType(request, null, true);
    this._handleSetActiveRequest(finalRequest._id);
  }

  async _requestDuplicateToTemp(originRequest) {
    if (!originRequest) {
      return;
    }

    const waitRequest = Object.assign({}, originRequest, { sortKey: -1e9, name: "TEMP", isTemp: true, parentId: this.props.activeWorkspace._id }) 
    const newRequest = await models.request.duplicate(waitRequest);
    await this._handleSetActiveRequest(newRequest._id);
  }

  _decodeIconv(bodyBuffer: Buffer, charset: string): string {
    try {
      return iconv.decode(bodyBuffer, charset);
    } catch (err) {
      console.warn('[response] Failed to decode body', err);
      return bodyBuffer.toString();
    }
  }

  async _moveDoc(docToMove, parentId, targetId, targetOffset) {
    // Nothing to do. We are in the same spot as we started
    if (docToMove._id === targetId) {
      return;
    }

    // Don't allow dragging things into itself or children. This will disconnect
    // the node from the tree and cause the item to no longer show in the UI.
    const descendents = await db.withDescendants(docToMove);
    for (const doc of descendents) {
      if (doc._id === parentId) {
        return;
      }
    }

    const handleSaveAndPush = this._handleSaveAndPush

    async function __updateDoc(doc, patch) {
      const newDoc = await models.getModel(docToMove.type).update(doc, patch);
      // 如果移动了 request，自动保存并上传
      if (docToMove.type == "Request"){
        handleSaveAndPush(newDoc)
      }
    }

    if (targetId === null) {
      // We are moving to an empty area. No sorting required
      await __updateDoc(docToMove, { parentId });
      return;
    }

    // NOTE: using requestToTarget's parentId so we can switch parents!
    let docs = [
      ...(await models.request.findByParentId(parentId)),
      ...(await models.requestGroup.findByParentId(parentId))
    ].sort((a, b) => (a.metaSortKey < b.metaSortKey ? -1 : 1));

    // Find the index of doc B so we can re-order and save everything
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];

      if (doc._id === targetId) {
        let before, after;
        if (targetOffset < 0) {
          // We're moving to below
          before = docs[i];
          after = docs[i + 1];
        } else {
          // We're moving to above
          before = docs[i - 1];
          after = docs[i];
        }

        const beforeKey = before ? before.metaSortKey : docs[0].metaSortKey - 100;
        const afterKey = after ? after.metaSortKey : docs[docs.length - 1].metaSortKey + 100;

        if (Math.abs(afterKey - beforeKey) < 0.000001) {
          // If sort keys get too close together, we need to redistribute the list. This is
          // not performant at all (need to update all siblings in DB), but it is extremely rare
          // anyway
          console.log(`[app] Recreating Sort Keys ${beforeKey} ${afterKey}`);

          await db.bufferChanges(300);
          docs.map((r, i) => __updateDoc(r, { metaSortKey: i * 100, parentId }));
        } else {
          const metaSortKey = afterKey - (afterKey - beforeKey) / 2;
          __updateDoc(docToMove, { metaSortKey, parentId });
        }

        break;
      }
    }
  }


  _setWrapperRef(n) {
    this._wrapper = n;
  }

  /**
   * Update document.title to be "Workspace (Environment) – Request"
   * @private
   */
  _updateDocumentTitle() {
    const { activeWorkspace, activeEnvironment, activeRequest } = this.props;

    let title = activeWorkspace.name;

    if (activeEnvironment) {
      title += ` (${activeEnvironment.name})`;
    }

    if (activeRequest) {
      title += ` – ${activeRequest.name}`;
    }

    document.title = title;
  }

  componentDidUpdate() {
    this._updateDocumentTitle();
  }

  async componentDidMount() {
    // Bind mouse and key handlers
    document.addEventListener('mouseup', this._handleMouseUp);
    document.addEventListener('mousemove', this._handleMouseMove);
    this._setGlobalKeyMap();
    
    // Update title
    this._updateDocumentTitle();

    db.onChange(async changes => {
      let needsRefresh = false;

      for (const change of changes) {
        const [
          _, // eslint-disable-line no-unused-vars
          doc,
          fromSync
        ] = change;

        const { activeRequest } = this.props;

        // No active request, so we don't need to force refresh anything
        if (!activeRequest) {
          return;
        }

        // Force refresh if environment changes
        // TODO: Only do this for environments in this workspace (not easy because they're nested)
        if (doc.type === models.environment.type) {
          console.log('[App] Forcing update from environment change', change);
          needsRefresh = true;
        }

        // Force refresh if sync changes the active request
        if (fromSync && doc._id === activeRequest._id) {
          needsRefresh = true;
          console.log('[App] Forcing update from request change', change);
        }
      }

      if (needsRefresh) {
        // this._wrapper._forceRequestPaneRefresh();
        setTimeout(this._wrapper._forceRequestPaneRefresh, 5);
      }
    });

    ipcRenderer.on('toggle-preferences', () => {
      showModal(SettingsModal);
    });

    ipcRenderer.on('reload-plugins', async () => {
      const { settings } = this.props;
      await plugins.getPlugins(true);
      templating.reload();
      themes.setTheme(settings.theme);
      console.log('[plugins] reloaded');
    });

    ipcRenderer.on('toggle-preferences-shortcuts', () => {
      showModal(SettingsModal, TAB_INDEX_SHORTCUTS);
    });

    ipcRenderer.on('run-command', (e, commandUri) => {
      const parsed = urlParse(commandUri, true);
      const command = `${parsed.hostname}${parsed.pathname}`;
      const args = JSON.parse(JSON.stringify(parsed.query));
      args.workspaceId = args.workspaceId || this.props.activeWorkspace._id;

      console.warn('run-command: ', command, ' *** ', args)

      this.props.handleCommand(command, args);
    });

    // NOTE: This is required for "drop" event to trigger.
    document.addEventListener(
      'dragover',
      e => {
        e.preventDefault();
      },
      false
    );

    document.addEventListener(
      'drop',
      async e => {
        e.preventDefault();
        const { activeWorkspace, handleImportUriToWorkspace } = this.props;
        if (!activeWorkspace) {
          return;
        }

        if (e.dataTransfer.files.length === 0) {
          console.log('[drag] Ignored drop event because no files present');
          return;
        }

        const file = e.dataTransfer.files[0];
        const { path } = file;
        const uri = `file://${path}`;

        await showAlert({
          title: 'Confirm Data Import',
          message: (
            <span>
              Import <code>{path}</code>?
            </span>
          ),
          addCancel: true
        });

        handleImportUriToWorkspace(activeWorkspace._id, uri);
      },
      false
    );

    ipcRenderer.on('toggle-sidebar', this._handleToggleSidebar);
    ipcRenderer.on('toggle-paster', this._handleTogglePaster);

    // handle this
    this._handleToggleMenuBar(this.props.settings.autoHideMenuBar);

    // Give it a bit before letting the backend know it's ready
    setTimeout(() => ipcRenderer.send('window-ready'), 500);

    // if 7 days left or launches less than 2 then show hotkey-tips
    const oldStats = await models.stats.get();
    const { launches, lastLaunch } = oldStats;
    if (launches < 3 || Date.now() - lastLaunch > 86400000 * 7) {
      showModal(HotkeysTipsModal);
    }
  }

  componentWillUnmount() {
    // Remove mouse and key handlers
    document.removeEventListener('mouseup', this._handleMouseUp);
    document.removeEventListener('mousemove', this._handleMouseMove);
  }

  async _ensureWorkspaceChildren(props) {
    const { activeWorkspace, activeCookieJar, environments } = props;
    const baseEnvironments = environments.filter(e => e.parentId === activeWorkspace._id);

    // Nothing to do
    if (baseEnvironments.length && activeCookieJar) {
      return;
    }

    // We already started migrating. Let it finish.
    if (this._isMigratingChildren) {
      return;
    }

    // Prevent rendering of everything
    this._isMigratingChildren = true;

    await db.bufferChanges();
    if (baseEnvironments.length === 0) {
      await models.environment.create({ parentId: activeWorkspace._id });
      console.log(`[app] Created missing base environment for ${activeWorkspace.name}`);
    }

    if (!activeCookieJar) {
      await models.cookieJar.create({
        parentId: this.props.activeWorkspace._id
      });
      console.log(`[app] Created missing cookie jar for ${activeWorkspace.name}`);
    }

    await db.flushChanges();

    // Flush "transaction"
    this._isMigratingChildren = false;
  }

  componentWillReceiveProps(nextProps) {
    this._ensureWorkspaceChildren(nextProps);
  }

  componentWillMount() {
    this._ensureWorkspaceChildren(this.props);
  }

  render() {
    if (this._isMigratingChildren) {
      console.log('[app] Waiting for migration to complete');
      return null;
    }

    return (
      <KeydownBinder
        onKeydown={this._handleKeyDown}
        key={this.props.activeWorkspace ? this.props.activeWorkspace._id : 'n/a'}>
        <div className="app">
          <ErrorBoundary showAlert>
            <Wrapper
              {...this.props}
              ref={this._setWrapperRef}
              paneWidth={this.state.paneWidth}
              paneHeight={this.state.paneHeight}
              sidebarWidth={this.state.sidebarWidth}
              handleCreateRequestForWorkspace={this._requestCreateForWorkspace}
              handleSetRequestGroupCollapsed={this._handleSetRequestGroupCollapsed}
              handleActivateRequest={this._handleSetActiveRequest}
              handleSetRequestPaneRef={this._setRequestPaneRef}
              handleSetResponsePaneRef={this._setResponsePaneRef}
              handleSetSidebarRef={this._setSidebarRef}
              handleStartDragSidebar={this._startDragSidebar}
              handleResetDragSidebar={this._resetDragSidebar}
              handleStartDragPaneHorizontal={this._startDragPaneHorizontal}
              handleStartDragPaneVertical={this._startDragPaneVertical}
              handleResetDragPaneHorizontal={this._resetDragPaneHorizontal}
              handleResetDragPaneVertical={this._resetDragPaneVertical}
              handleCreateRequest={this._requestCreate}
              handleRender={this._handleRenderText}
              handleGetRenderContext={this._handleGetRenderContext}
              handleDuplicateRequest={this._requestDuplicate}
              handleDuplicateRequestGroup={this._requestGroupDuplicate}
              handleMoveRequestGroup={this._requestGroupMove}
              handleDuplicateWorkspace={this._workspaceDuplicate}
              handleCreateRequestGroup={this._requestGroupCreate}
              handleGenerateCode={this._handleGenerateCode}
              handleGenerateCodeForActiveRequest={this._handleGenerateCodeForActiveRequest}
              handleCopyAsCurl={this._handleCopyAsCurl}
              handleSetResponsePreviewMode={this._handleSetResponsePreviewMode}
              handleSetResponseFilter={this._handleSetResponseFilter}
              handleSendRequestWithEnvironment={this._handleSendRequestWithEnvironment}
              handleSendAndDownloadRequestWithEnvironment={
                this._handleSendAndDownloadRequestWithEnvironment
              }
              handleSetActiveResponse={this._handleSetActiveResponse}
              handleSetActiveRequest={this._handleSetActiveRequest}
              handleSetActiveEnvironment={this._handleSetActiveEnvironment}
              handleSetSidebarFilter={this._handleSetSidebarFilter}
              handleToggleMenuBar={this._handleToggleMenuBar}
              handleUpdateRequestMimeType={this._handleUpdateRequestMimeType}
              handleTab={this._handleTab}
              updateActiveWorkspaceMeta={this._updateActiveWorkspaceMeta}
              handleToggleSidebar={this._handleToggleSidebar}
              collapseResponse={this.state.collapseResponse}
              toggleCollapseResponse={this._toggleCollapseResponse}
              handleTogglePaster={this._handleTogglePaster}
              nrLoading={this.state.nrLoading}
              pushSuccess={this.state.pushSuccess}
              handlePull={this._handlePull}
              handleSaveAndPush={this._handleSaveAndPush}
              handlePush={this._handlePush}
              handlePushResponseBody={this._handlePushResponseBody}
              triggerPush={this.state.triggerPush}
              triggerPushResponse={this.state.triggerPushResponse}
              handleReloadActiveRequest={this._handleReloadActiveRequest}
              handleAddTempTab={this._handleAddTempTab}
              handleDuplicateRequestToTemp={this._requestDuplicateToTemp}
              handleMoveDoc={this._moveDoc}
            />
          </ErrorBoundary>

          <ErrorBoundary showAlert>
            <Toast />
          </ErrorBoundary>
          <ToastContainer
            position="top-right"
            autoClose={2500}
            closeOnClick={true}
            hideProgressBar={true}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnVisibilityChange
            draggable
            pauseOnHover
          />

          {/* Block all mouse activity by showing an overlay while dragging */}
          {this.state.showDragOverlay ? <div className="blocker-overlay" /> : null}
        </div>
      </KeydownBinder>
    );
  }
}

App.propTypes = {
  // Required
  sidebarWidth: PropTypes.number.isRequired,
  paneWidth: PropTypes.number.isRequired,
  paneHeight: PropTypes.number.isRequired,
  handleCommand: PropTypes.func.isRequired,
  settings: PropTypes.object.isRequired,
  activeWorkspace: PropTypes.shape({
    _id: PropTypes.string.isRequired
  }).isRequired,
  handleSetActiveWorkspace: PropTypes.func.isRequired,

  // Optional
  activeRequest: PropTypes.object,
  activeEnvironment: PropTypes.shape({
    _id: PropTypes.string.isRequired
  })
};

function mapStateToProps(state, props) {
  const { entities, global } = state;

  const { isLoading, loadingRequestIds, isPushing, isPulling } = global;

  // Entities
  const entitiesLists = selectEntitiesLists(state, props);
  const { workspaces, workspaceMetas, environments, requests, requestGroups, messages } = entitiesLists;

  const settings = entitiesLists.settings[0];
  const stats = entitiesLists.stats[0];

  // Workspace stuff
  const workspaceMeta = selectActiveWorkspaceMeta(state, props) || {};
  const activeWorkspace = selectActiveWorkspace(state, props);
  const activeWorkspaceClientCertificates = selectActiveWorkspaceClientCertificates(state, props);
  const sidebarHidden = workspaceMeta.sidebarHidden || false;
  const pasterHidden = workspaceMeta.pasterHidden || false;
  const sidebarFilter = workspaceMeta.sidebarFilter || '';
  const sidebarWidth = workspaceMeta.sidebarWidth || DEFAULT_SIDEBAR_WIDTH;
  const paneWidth = workspaceMeta.paneWidth || DEFAULT_PANE_WIDTH;
  const paneHeight = workspaceMeta.paneHeight || DEFAULT_PANE_HEIGHT;

  // Request stuff
  const requestMeta = selectActiveRequestMeta(state, props) || {};
  const activeRequest = selectActiveRequest(state, props);
  const responsePreviewMode = requestMeta.previewMode || PREVIEW_MODE_SOURCE;
  const responseFilter = requestMeta.responseFilter || '';
  const responseFilterHistory = requestMeta.responseFilterHistory || [];
  const requestMetas = selectRequestMetas(state, props);
  

  // Cookie Jar
  const activeCookieJar = selectActiveCookieJar(state, props);

  // Response stuff
  const activeRequestResponses = selectActiveRequestResponses(state, props) || [];
  const activeResponse = selectActiveResponse(state, props) || null;

  // Environment stuff
  const activeEnvironmentId = workspaceMeta.activeEnvironmentId;
  const activeEnvironment = entities.environments[activeEnvironmentId];

  // OAuth2Token stuff
  const oAuth2Token = selectActiveOAuth2Token(state, props);

  // Find other meta things
  const loadStartTime = loadingRequestIds[activeRequest ? activeRequest._id : 'n/a'] || -1;
  const sidebarChildren = selectSidebarChildren(state, props);
  const workspaceChildren = selectWorkspaceRequestsAndRequestGroups(state, props);
  const unseenWorkspaces = selectUnseenWorkspaces(state, props);
  const uidWorkspaces = selectUidWorkspaces(state, props);

  // tab stuff
  const rtabs = workspaceMeta.rtabs || [];
  const rtabActiveIndex = workspaceMeta.rtabActiveIndex || 0;
  const hosts = workspaceMeta.hosts || [];
  const isLoggedIn = stats.isLoggedIn || false
  const serverDown = stats.serverDown || false
  const lastPullAt = workspaceMeta.lastPullAt

  // messages
  const uidMessages = selectUidMessages(state, props);
  const unreadMessages =  uidMessages.filter(m => !m.read).reverse();

  return Object.assign({}, state, {
    settings,
    workspaces,
    workspaceMeta,
    unseenWorkspaces,
    uidWorkspaces,
    requestGroups,
    requests,
    oAuth2Token,
    isLoading,
    isPushing,
    isPulling,
    loadStartTime,
    activeWorkspace,
    activeWorkspaceClientCertificates,
    activeRequest,
    activeRequestResponses,
    activeResponse,
    activeCookieJar,
    sidebarHidden,
    sidebarFilter,
    sidebarWidth,
    paneWidth,
    paneHeight,
    responsePreviewMode,
    responseFilter,
    responseFilterHistory,
    sidebarChildren,
    environments,
    activeEnvironment,
    workspaceChildren,
    rtabs,
    rtabActiveIndex,
    hosts,
    pasterHidden,
    isLoggedIn,
    serverDown,
    uidMessages,
    unreadMessages,
    lastPullAt,
    requestMetas,
    workspaceMetas
  });
}

function mapDispatchToProps(dispatch) {
  const global = bindActionCreators(globalActions, dispatch);

  return {
    handleStartLoading: global.loadRequestStart,
    handleStopLoading: global.loadRequestStop,
    handleSetActiveWorkspace: global.setActiveWorkspace,
    handleImportFileToWorkspace: global.importFile,
    handleImportUriToWorkspace: global.importUri,
    handleCommand: global.newCommand,
    handleExportFile: global.exportFile
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App);
