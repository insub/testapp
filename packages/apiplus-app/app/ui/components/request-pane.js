// @flow
import type { Request } from '../../models/request';
import type { Workspace } from '../../models/workspace';
import type { OAuth2Token } from '../../models/o-auth-2-token';

import * as React from 'react';
import autobind from 'autobind-decorator';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import ContentTypeDropdown from './dropdowns/content-type-dropdown';
import AuthDropdown from './dropdowns/auth-dropdown';
import KeyValueEditor from './key-value-editor/editor';
import RequestHeadersEditor from './editors/request-headers-editor';
import RenderedQueryString from './rendered-query-string';
import BodyEditor from './editors/body/body-editor';
import AuthWrapper from './editors/auth/auth-wrapper';
import RequestUrlBar from './request-url-bar.js';
import { DEBOUNCE_MILLIS, getAuthTypeName, getContentTypeName } from '../../common/constants';
import { deconstructQueryStringToParams, extractQueryStringFromUrl } from 'insomnia-url';
import * as db from '../../common/database';
import * as models from '../../models';
import Hotkey from './hotkey';
import { showModal } from './modals/index';
import RequestSettingsModal from './modals/request-settings-modal';
import MarkdownPreview from './markdown-preview';
import type { Settings } from '../../models/settings';
import * as hotkeys from '../../common/hotkeys';
import ErrorBoundary from './error-boundary';
import Editable from './base/editable';
import Highlight from './base/highlight';
import MarkdownEditor from './markdown-editor';
import HelpTooltip from './help-tooltip';
import MethodDropdown from './dropdowns/method-dropdown';

type Props = {
  // Functions
  forceUpdateRequest: Function,
  forceUpdateRequestHeaders: Function,
  handleSend: Function,
  handleSendAndDownload: Function,
  handleCreateRequest: Function,
  handleGenerateCode: Function,
  handleRender: Function,
  handleGetRenderContext: Function,
  updateRequestUrl: Function,
  updateRequestMethod: Function,
  updateRequestBody: Function,
  updateRequestParameters: Function,
  updateRequestAuthentication: Function,
  updateRequestHeaders: Function,
  updateRequestMimeType: Function,
  updateSettingsShowPasswords: Function,
  updateSettingsUseBulkHeaderEditor: Function,
  handleImport: Function,
  handleImportFile: Function,

  // Other
  workspace: Workspace,
  settings: Settings,
  environmentId: string,
  forceRefreshCounter: number,

  // Optional
  request: ?Request,
  oAuth2Token: ?OAuth2Token
};

@autobind
class RequestPane extends React.PureComponent<Props> {
  constructor(props: Props) {
    super(props);
    this.state = {
      request: null,
      defaultPreviewMode: false,
      activeWorkspaceIdToCopyTo: "",
      justCopied: false,
      justMoved: false
    };
  }

  _handleUpdateRequestUrlTimeout: TimeoutID;

  _handleEditDescriptionAdd() {
    this._handleEditDescription(true);
  }

  _handleEditDescription(addDescription: boolean) {
    showModal(RequestSettingsModal, {
      request: this.props.request,
      forceEditMode: addDescription
    });
  }

  async _autocompleteUrls(): Promise<Array<string>> {
    const docs = await db.withDescendants(this.props.workspace, models.request.type);

    const requestId = this.props.request ? this.props.request._id : 'n/a';

    const urls = docs
      .filter(
        (d: any) =>
          d.type === models.request.type && // Only requests
          d._id !== requestId && // Not current request
          (d.url || '') // Only ones with non-empty URLs
      )
      .map((r: any) => (r.url || '').trim());

    return Array.from(new Set(urls));
  }

  _handleUpdateSettingsUseBulkHeaderEditor() {
    const { settings, updateSettingsUseBulkHeaderEditor } = this.props;
    updateSettingsUseBulkHeaderEditor(!settings.useBulkHeaderEditor);
  }

  _handleImportFile() {
    this.props.handleImportFile();
  }

  _handleCreateRequest() {
    this.props.handleCreateRequest(this.props.request);
  }

  _handleUpdateRequestUrl(url: string) {
    clearTimeout(this._handleUpdateRequestUrlTimeout);
    this._handleUpdateRequestUrlTimeout = setTimeout(() => {
      this.props.updateRequestUrl(url);
    }, DEBOUNCE_MILLIS);
  }

  _handleImportQueryFromUrl() {
    const { request } = this.props;

    if (!request) {
      console.warn('Tried to import query when no request active');
      return;
    }

    let query;
    try {
      query = extractQueryStringFromUrl(request.url);
    } catch (e) {
      console.warn('Failed to parse url to import querystring');
      return;
    }

    // Remove the search string (?foo=bar&...) from the Url
    const url = request.url.replace(query, '');
    const parameters = [...request.parameters, ...deconstructQueryStringToParams(query)];

    // Only update if url changed
    if (url !== request.url) {
      this.props.forceUpdateRequest({ url, parameters });
    }
  }

  // edit name and desc
  _handleEditStart() {
    this.setState({ isEditing: true });
  }

  _handleRequestUpdateName(name) {
    models.request.update(this.props.request, { name });
    this.setState({ isEditing: false });
  }

  async _handleDescriptionChange(description: string) {
    if (!this.props.request) {
      return;
    }
    const request = await models.request.update(this.props.request, {
      description
    });
  }

  async _updateRequestSettingBoolean(e: SyntheticEvent<HTMLInputElement>) {
    if (!this.props.request) {
      // Should never happen
      return;
    }

    const value = e.currentTarget.checked;
    const setting = e.currentTarget.name;
    const request = await models.request.update(this.props.request, {
      [setting]: value
    });
  }

  renderCheckboxInput(setting: string) {
    const { request } = this.props;

    if (!request) {
      return;
    }

    return (
      <input
        type="checkbox"
        name={setting}
        checked={request[setting]}
        onChange={this._updateRequestSettingBoolean}
      />
    );
  }

  _handleUpdateMoveCopyWorkspace(e: SyntheticEvent<HTMLSelectElement>) {
    const workspaceId = e.currentTarget.value;
    this.setState({ activeWorkspaceIdToCopyTo: workspaceId });
  }

  async _handleMoveToWorkspace() {
    const { request } = this.props;
    const { activeWorkspaceIdToCopyTo } = this.state;
    if (!request) {
      return;
    }

    const workspace = await models.workspace.getById(
      activeWorkspaceIdToCopyTo || 'n/a'
    );
    if (!workspace) {
      return;
    }

    await models.request.update(request, {
      sortKey: -1e9, // Move to top of sort order
      parentId: activeWorkspaceIdToCopyTo
    });

    this.setState({ justMoved: true });
    setTimeout(() => {
      this.setState({ justMoved: false });
    }, 2000);
  }

  async _handleCopyToWorkspace() {
    const { request } = this.props;
    const { activeWorkspaceIdToCopyTo } = this.state;
    if (!request) {
      return;
    }

    const workspace = await models.workspace.getById(
      activeWorkspaceIdToCopyTo || 'n/a'
    );
    if (!workspace) {
      return;
    }

    const waitRequest = Object.assign({}, request, { sortKey: -1e9, name: request.name, parentId: activeWorkspaceIdToCopyTo }) 
    const newRequest = await models.request.duplicate(waitRequest);

    this.setState({ justCopied: true });
    setTimeout(() => {
      this.setState({ justCopied: false });
    }, 2000);
  }

  // 如果直接把 this.props.handleDuplicateRequestToTemp 写在 onClick 上会导致内存泄漏，原因不明
  _handleRequestDuplicateToTemp() {
    const { request } = this.props;
    this.props.handleDuplicateRequestToTemp(request)
  }

  render() {
    const {
      forceRefreshCounter,
      forceParametersRefreshCounter,
      forceUrlRefreshCounter,
      forceUpdateRequestHeaders,
      handleGenerateCode,
      handleGetRenderContext,
      handleImport,
      handleRender,
      handleSend,
      handleSendAndDownload,
      oAuth2Token,
      request,
      workspace,
      environmentId,
      settings,
      updateRequestAuthentication,
      updateRequestBody,
      updateRequestHeaders,
      updateRequestMethod,
      updateRequestMimeType,
      updateRequestParameters,
      updateSettingsShowPasswords,
      hosts,
      updateRequestHost,
      workspaces,
      handleActivateRequest,
      handleSaveAndPush,
      method,
      uidWorkspaces
    } = this.props;

    const {
      defaultPreviewMode,
      activeWorkspaceIdToCopyTo,
      justMoved,
      justCopied,
    } = this.state;

    const paneClasses = 'request-pane theme--pane pane';
    const paneHeaderClasses = 'pane__header theme--pane__header';
    const paneBodyClasses = 'pane__body theme--pane__body';

    if (!request) {
      return (
        <section className={paneClasses + ' apiplus_init'}>
          {/*<header className={paneHeaderClasses} />*/}
          <div className={paneBodyClasses + ' pane__body--placeholder'}>
            <div className="request_init">
              {/*<table className="table--fancy">
                <tbody>
                  <tr>
                    <td>New Request</td>
                    <td className="text-right">
                      <code>
                        <Hotkey hotkey={hotkeys.CREATE_REQUEST} />
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <td>Switch Requests</td>
                    <td className="text-right">
                      <code>
                        <Hotkey hotkey={hotkeys.SHOW_QUICK_SWITCHER} />
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <td>Edit Environments</td>
                    <td className="text-right">
                      <code>
                        <Hotkey hotkey={hotkeys.SHOW_ENVIRONMENTS} />
                      </code>
                    </td>
                  </tr>
                </tbody>
              </table>*/}
              <h1>Welcome</h1>
              <p className="hide">apiplus test your APIs and handle API document automatically</p>
              <div className="text-center pane__body--placeholder__cta">
                {/*<button className="btn inline-block btn--clicky" onClick={this._handleImportFile}>
                  Import from File
                </button>*/}
                <button
                  className="btn inline-block btn--clicky"
                  onClick={this._handleCreateRequest}>
                  <span>Request</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      );
    }

    let numBodyParams = 0;
    if (request.body && request.body.params) {
      numBodyParams = request.body.params.filter(p => !p.disabled).length;
    }

    const numParameters = request.parameters.filter(p => !p.disabled).length;
    const numHeaders = request.headers.filter(h => !h.disabled).length;
    const urlHasQueryParameters = request.url.indexOf('?') >= 0;

    const uniqueKey = `${forceRefreshCounter}::${request._id}`;
    const uniqueParametersKey = `${forceParametersRefreshCounter}::${request._id}`;
    const uniqueUrlKey = `${forceUrlRefreshCounter}::${request._id}`;
    return (
      <React.Fragment>
      <section className="request_pane_header">
        <p className={'request_title' + (request.isTemp ? ' request_title_temp' : '')}>
          <svg width="14px" height="14px" viewBox="0 0 18 18" version="1.1" xmlns="http://www.w3.org/2000/svg" className="hide">
          <path d="M17.9947683,9.37798507 C17.5023015,9.04824792 16.941441,8.83475175 16.3572366,8.74921171 C16.3495197,7.52573796 16.0350459,6.29109967 15.3821173,5.16019412 C13.3487052,1.63822116 8.80268893,0.456033965 5.22830567,2.51970511 C1.6539224,4.58337625 0.404718397,9.11143545 2.43813043,12.6334084 C4.47154246,16.1553814 9.01755877,17.3375686 12.591942,15.2738974 C12.609102,15.2639901 12.6262085,15.2540259 12.6432612,15.2440054 C13.0651464,15.7468022 13.5980408,16.1233313 14.1858431,16.3590036 C13.9664136,16.5132427 13.7382375,16.6590526 13.5015028,16.7957314 C9.19686917,19.2810128 3.69255552,17.8061364 1.20727414,13.5015028 C-1.27800723,9.19686917 0.196869166,3.69255552 4.50150278,1.20727414 C8.80613639,-1.27800723 14.31045,0.196869166 16.7957314,4.50150278 C17.6828826,6.03809375 18.0654229,7.72755027 17.9947683,9.37798507 L17.9947683,9.37798507 Z M14.6665663,13.8136806 C14.2523527,13.0962417 14.4981655,12.1788561 15.2156044,11.7646425 C15.9330433,11.3504289 16.8504289,11.5962417 17.2646425,12.3136806 C17.6788561,13.0311195 17.4330433,13.9485051 16.7156044,14.3627187 C15.9981655,14.7769323 15.0807798,14.5311195 14.6665663,13.8136806 Z" id="Shape"></path>
          </svg>
          <span className="api_title_box">
          <label className="api_num">{request.showid ? `#${request.showid} ` : null}</label>
          <Editable
          value={request.name}
          singleClick={true}
          className={'inline-block' + (request.name.length ? '' : ' request-not-name')}
          onEditStart={this._handleEditStart}
          onSubmit={this._handleRequestUpdateName}
          renderReadView={(value, props) => (
            <Highlight text={value} {...props} />
            )}
          />
          </span>
          <button onClick={this._handleRequestDuplicateToTemp} title="Ctrl+D"><i className="apiplus api-duplicate"></i></button>
          <button onClick={this.props.handleReloadActiveRequest} title="Ctrl+Shift+Z"><i className="apiplus api-reset"></i></button>
        </p>
        
        <header className={paneHeaderClasses}>
          <ErrorBoundary errorClassName="font-error pad text-center">
            <RequestUrlBar
              uniquenessKey={uniqueUrlKey}
              method={request.method}
              onMethodChange={updateRequestMethod}
              onUrlChange={this._handleUpdateRequestUrl}
              handleAutocompleteUrls={this._autocompleteUrls}
              handleImport={handleImport}
              handleGenerateCode={handleGenerateCode}
              handleSend={handleSend}
              handleSendAndDownload={handleSendAndDownload}
              handleRender={handleRender}
              nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
              handleGetRenderContext={handleGetRenderContext}
              url={request.url}
              requestId={request._id}
              host={request.host}
              hosts={hosts}
              onHostChange={updateRequestHost}
              updateActiveWorkspaceMeta={this.props.updateActiveWorkspaceMeta}
              handleSaveAndPush={handleSaveAndPush}
            />
          </ErrorBoundary>
        </header>
      </section>
      <section className={paneClasses} ref={this.props.handleSetRequestPaneRef}>
        
        <Tabs className={[paneBodyClasses, 'react-tabs', `http-method-${request.method}`]} forceRenderTabPanel>
          <TabList>
            <Tab>
              <button>
                Query
                {numParameters > 0 && <span className="bubble space-left">{numParameters}</span>}
              </button>
            </Tab>
            <Tab>
              <ContentTypeDropdown
                onChange={updateRequestMimeType}
                contentType={request.body.mimeType}
                request={request}
                className="tall">
                {typeof request.body.mimeType === 'string'
                  ? getContentTypeName(request.body.mimeType)
                  : 'NoBody'}
                {numBodyParams ? <span className="bubble space-left">{numBodyParams}</span> : null}
                <i className="fa fa-caret-down space-left" />
              </ContentTypeDropdown>
            </Tab>
            <Tab>
              <AuthDropdown
                onChange={updateRequestAuthentication}
                authentication={request.authentication}
                className="tall">
                {getAuthTypeName(request.authentication.type) || ' NoAuth'}
                <i className="fa fa-caret-down space-left" />
              </AuthDropdown>
            </Tab>
            <Tab>
              <button>
                Header
                {numHeaders > 0 && <span className="bubble space-left">{numHeaders}</span>}
              </button>
            </Tab>
            <Tab className="request_desc_tab">
              <button className="tab_icon_button">
                <i className="apiplus api-desc"/>
                {/*{request.description && (
                  <span className="bubble space-left">
                    <i className="fa fa--skinny fa-check txt-xxs" />
                  </span>
                )}*/}
              </button>
            </Tab>
            <Tab className="request_settings_tab">
              <button className="tab_icon_button">
                <i className="apiplus api-config"/>
                {/*<span className="bubble space-left">
                  <i className="fa fa--skinny fa-check txt-xxs" />
                </span>*/}
              </button>
            </Tab>
          </TabList>
          <TabPanel className="react-tabs__tab-panel query-editor">
            <div className="query-editor__editor">
              <ErrorBoundary
                key={uniqueParametersKey}
                errorClassName="tall wide vertically-align font-error pad text-center">
                <KeyValueEditor
                  sortable
                  allowMultiline
                  namePlaceholder="name"
                  valuePlaceholder="value"
                  pairs={request.parameters}
                  handleRender={handleRender}
                  handleGetRenderContext={handleGetRenderContext}
                  nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
                  onChange={updateRequestParameters}
                />
              </ErrorBoundary>
            </div>
          </TabPanel>
          <TabPanel key={uniqueKey} className="react-tabs__tab-panel editor-wrapper">
            <BodyEditor
              key={uniqueKey}
              handleUpdateRequestMimeType={updateRequestMimeType}
              handleRender={handleRender}
              handleGetRenderContext={handleGetRenderContext}
              request={request}
              workspace={workspace}
              environmentId={environmentId}
              settings={settings}
              onChange={updateRequestBody}
              onChangeHeaders={forceUpdateRequestHeaders}
            />
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel scrollable-container">
            <div className="scrollable">
              <ErrorBoundary key={uniqueKey} errorClassName="font-error pad text-center">
                <AuthWrapper
                  oAuth2Token={oAuth2Token}
                  showPasswords={settings.showPasswords}
                  request={request}
                  handleUpdateSettingsShowPasswords={updateSettingsShowPasswords}
                  handleRender={handleRender}
                  handleGetRenderContext={handleGetRenderContext}
                  nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
                  onChange={updateRequestAuthentication}
                />
              </ErrorBoundary>
            </div>
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel header-editor">
            <ErrorBoundary key={uniqueKey} errorClassName="font-error pad text-center">
              <RequestHeadersEditor
                headers={request.headers}
                handleRender={handleRender}
                handleGetRenderContext={handleGetRenderContext}
                nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
                editorFontSize={settings.editorFontSize}
                editorIndentSize={settings.editorIndentSize}
                editorLineWrapping={settings.editorLineWrapping}
                onChange={updateRequestHeaders}
                bulk={settings.useBulkHeaderEditor}
              />
            </ErrorBoundary>

            <div className="pad-right text-right">
              <button
                className="margin-top-sm btn btn--clicky"
                onClick={this._handleUpdateSettingsUseBulkHeaderEditor}>
                {settings.useBulkHeaderEditor ? 'Regular Edit' : 'Bulk Edit'}
              </button>
            </div>
          </TabPanel>
          <TabPanel key={`docs::${uniqueKey}`} className="react-tabs__tab-panel tall scrollable">
            <MarkdownEditor
              ref={this._setEditorRef}
              className="api_desc"
              fontSize={settings.editorFontSize}
              indentSize={settings.editorIndentSize}
              keyMap={settings.editorKeyMap}
              placeholder="Write a description"
              lineWrapping={settings.editorLineWrapping}
              handleRender={handleRender}
              handleGetRenderContext={handleGetRenderContext}
              nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
              defaultValue={request.description}
              onChange={this._handleDescriptionChange}
            />
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel">
            <div className="pad-top">
              <div className="form-control form-control--thin">
                <label>
                  Send cookies automatically
                  {this.renderCheckboxInput('settingSendCookies')}
                </label>
              </div>
              <div className="form-control form-control--thin">
                <label>
                  Store cookies automatically
                  {this.renderCheckboxInput('settingStoreCookies')}
                </label>
              </div>
              <div className="form-control form-control--thin">
                <label>
                  Automatically encode special characters in URL
                  {this.renderCheckboxInput('settingEncodeUrl')}
                  <HelpTooltip position="top" className="space-left">
                    Automatically encode special characters at send time (does not
                    apply to query parameters editor)
                  </HelpTooltip>
                </label>
              </div>
              <div className="form-control form-control--thin">
                <label>
                  Skip rendering of request body
                  {this.renderCheckboxInput('settingDisableRenderRequestBody')}
                  <HelpTooltip position="top" className="space-left">
                    Disable rendering of environment variables and tags for the
                    request body
                  </HelpTooltip>
                </label>
              </div>
              <div className="form-control form-control--thin">
                <label>
                  Rebuild path dot sequences
                  <HelpTooltip position="top" className="space-left">
                    This instructs libcurl to squash sequences of "/../" or "/./"
                    that may exist in the URL's path part and that is supposed to be
                    removed according to RFC 3986 section 5.2.4
                  </HelpTooltip>
                  {this.renderCheckboxInput('settingRebuildPath')}
                </label>
              </div>
              <hr />
              <div className="form-row">
                <div className="form-control form-control--outlined">
                  <label>
                    Move/Copy to Workspace
                    <HelpTooltip position="top" className="space-left">
                      Copy or move the current request to a new workspace. It will
                      be placed at the root of the new workspace's folder structure.
                    </HelpTooltip>
                    <select
                      value={activeWorkspaceIdToCopyTo}
                      onChange={this._handleUpdateMoveCopyWorkspace}>
                      <option value="n/a">-- Select Workspace --</option>
                      {uidWorkspaces.map(w => {
                        if (workspace && workspace._id === w._id) {
                          return null;
                        }

                        return (
                          <option key={w._id} value={w._id}>
                            {w.name}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>
                <div className="form-control form-control--no-label width-auto">
                  <button
                    disabled={justCopied}
                    className="btn btn--clicky"
                    onClick={this._handleCopyToWorkspace}>
                    {justCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </TabPanel>
        </Tabs>
      </section>
      </React.Fragment>
    );
  }
}

export default RequestPane;
