// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import DebouncedInput from '../base/debounced-input';
import FileInputButton from '../base/file-input-button';
import Modal from '../base/project-details-modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import HelpTooltip from '../help-tooltip';
import PromptButton from '../base/prompt-button';
import * as models from '../../../models/index';
import MarkdownEditor from '../markdown-editor';
import type { Workspace } from '../../../models/workspace';
import type { ClientCertificate } from '../../../models/client-certificate';
import * as session from '../../../sync/session';
import * as sync from '../../../sync/index';
import Link from '../base/link';
import { HOST } from '../../../common/constants';
import { showModal, showPrompt } from '../modals/index';
import SettingsModal, { TAB_INDEX_EXPORT } from '../modals/settings-modal';
import EnvironmentsModal from '../modals/workspace-environments-edit-modal';
import MembersManage from '../members-manage';

type Props = {
  clientCertificates: Array<ClientCertificate>,
  workspace: Workspace,
  editorFontSize: number,
  editorIndentSize: number,
  editorKeyMap: string,
  editorLineWrapping: boolean,
  nunjucksPowerUserMode: boolean,
  handleRender: Function,
  handleGetRenderContext: Function,
  handleRemoveWorkspace: Function,
  handleDuplicateWorkspace: Function
};

@autobind
class WorkspaceDashboardModal extends React.PureComponent<Props, State> {
  modal: Modal | null;

  constructor(props: Props) {
    super(props);

    this.state = {
      showAddCertificateForm: false,
      host: '',
      crtPath: '',
      keyPath: '',
      pfxPath: '',
      passphrase: '',
      isPrivate: false,
      showDescription: false,
      defaultPreviewMode: false,
      error: '',
      loading: false,
      showRenameInput: false
    };
  }

  _workspaceUpdate(patch: Object) {
    models.workspace.update(this.props.workspace, patch);
  }

  _handleAddDescription() {
    this.setState({ showDescription: true });
  }

  _handleSetModalRef(n: ?Modal) {
    this.modal = n;
  }

  _handleRemoveWorkspace() {
    this.props.handleRemoveWorkspace();
    this.hide();
  }

  _handleDuplicateWorkspace() {
    this.props.handleDuplicateWorkspace(() => {
      this.hide();
    });
  }

  _handleToggleCertificateForm() {
    this.setState(state => ({
      showAddCertificateForm: !state.showAddCertificateForm,
      crtPath: '',
      keyPath: '',
      pfxPath: '',
      host: '',
      passphrase: '',
      isPrivate: false
    }));
  }

  _showRename() {
    this.setState({ showRenameInput: true });
  }

  _submitRename(e) {
    this.setState({ showRenameInput: false });
    if (e.target.value != this.props.workspace.name){
      this._workspaceUpdate({ name: e.target.value });
    }
  }

  _handleDescriptionChange(description: string) {
    this._workspaceUpdate({ description });

    if (this.state.defaultPreviewMode !== false) {
      this.setState({ defaultPreviewMode: false });
    }
  }

  _handleCreateHostChange(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ host: e.currentTarget.value });
  }

  _handleCreatePfxChange(pfxPath: string) {
    this.setState({ pfxPath });
  }

  _handleCreateCrtChange(crtPath: string) {
    this.setState({ crtPath });
  }

  _handleCreateKeyChange(keyPath: string) {
    this.setState({ keyPath });
  }

  _handleCreatePassphraseChange(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ passphrase: e.currentTarget.value });
  }

  _handleCreateIsPrivateChange(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ isPrivate: e.currentTarget.checked });
  }

  async _handleCreateCertificate(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();

    const { workspace } = this.props;
    const {
      pfxPath,
      crtPath,
      keyPath,
      host,
      passphrase,
      isPrivate,
      showRenameInput
    } = this.state;

    const certificate = {
      host,
      isPrivate,
      parentId: workspace._id,
      passphrase: passphrase || null,
      disabled: false,
      cert: crtPath || null,
      key: keyPath || null,
      pfx: pfxPath || null
    };

    await models.clientCertificate.create(certificate);
    this._handleToggleCertificateForm();
  }

  async _handleDeleteCertificate(certificate: ClientCertificate) {
    await models.clientCertificate.remove(certificate);
  }

  async _handleToggleCertificate(certificate: ClientCertificate) {
    await models.clientCertificate.update(certificate, {
      disabled: !certificate.disabled
    });
  }

  _handleShowExport() {
    showModal(SettingsModal, TAB_INDEX_EXPORT);
  }

  _handleShowEnvironmentModal() {
    showModal(EnvironmentsModal, this.props.workspace);
  }

  async _load() {
    if (!session.isLoggedIn()) {
      this._resetState({});
      return;
    }
  }

  _resetState(patch = {}) {
    this.setState(
      Object.assign(
        {
          error: '',
          loading: false
        },
        patch
      )
    );
  }

  async show() {
    const hasDescription = !!this.props.workspace.description;
    this.setState({
      showDescription: hasDescription,
      defaultPreviewMode: hasDescription,
      showAddCertificateForm: false
    });

    this.modal && this.modal.show();

    // This takes a while, so do it after show()
    await this._load();
  }

  hide() {
    this.modal && this.modal.hide();
  }

  renderModalHeader() {
    const { workspace, workspaceMeta} = this.props;
    return (
      <ModalHeader className="project_header" key={`header::${workspace._id}`}>
       {/* Workspace Settings{' '}
        <div className="txt-sm selectable faint monospace">
          {workspace ? workspace._id : ''}
        </div>*/}
        { false ? <h3 className="project_created_done">Project created success !</h3> : null}
        {workspaceMeta.role === "owner" ? (
          <div className="project_name">
            { this.state.showRenameInput ? 
              <input autoFocus className="project_name_input" type="text" delay={5} placeholder="Project Name" onBlur={this._submitRename} defaultValue={workspace.name} />
              : 
              <h2 className="project_name_owner" onClick={this._showRename} >{workspace.name}</h2>
            }
            <span className="owner_label">{workspaceMeta.role}</span>
          </div>
          ) : (
          <h2 className="project_name">{workspace.name}<span className="shared_status">{workspaceMeta.role}</span></h2>
        )}
        <div className="owner_box">
          <img className="avatar" src={workspace.owner ? `${workspace.owner.avatar.url}?imageView2/5/w/36/h/36` : 'static/avatar.svg'} alt=""/>
          <p>{workspace.owner ? `Manage by ${workspace.owner.nickname}` : "Unknow"}</p>
        </div>
      </ModalHeader>
    );
  }

  renderCertificate(certificate: ClientCertificate) {
    return (
      <div key={certificate._id}>
        <div className="row-spaced">
          <div>
            <span className="pad-right no-wrap">
              <strong>PFX:</strong>{' '}
              {certificate.pfx ? (
                <i className="fa fa-check" />
              ) : (
                <i className="fa fa-remove" />
              )}
            </span>
            <span className="pad-right no-wrap">
              <strong>CRT:</strong>{' '}
              {certificate.cert ? (
                <i className="fa fa-check" />
              ) : (
                <i className="fa fa-remove" />
              )}
            </span>
            <span className="pad-right no-wrap">
              <strong>Key:</strong>{' '}
              {certificate.key ? (
                <i className="fa fa-check" />
              ) : (
                <i className="fa fa-remove" />
              )}
            </span>
            <span
              className="pad-right no-wrap"
              title={certificate.passphrase || null}>
              <strong>Passphrase:</strong>{' '}
              {certificate.passphrase ? (
                <i className="fa fa-check" />
              ) : (
                <i className="fa fa-remove" />
              )}
            </span>
            <span className="pad-right">
              <strong>Host:</strong>{' '}
              <span className="monospace selectable">{certificate.host}</span>
            </span>
          </div>
          <div className="no-wrap">
            <button
              className="btn btn--super-compact width-auto"
              title="Enable or disable certificate"
              onClick={() => this._handleToggleCertificate(certificate)}>
              {certificate.disabled ? (
                <i className="fa fa-square-o" />
              ) : (
                <i className="fa fa-check-square-o" />
              )}
            </button>
            <PromptButton
              className="btn btn--super-compact width-auto"
              confirmMessage=" "
              addIcon
              onClick={() => this._handleDeleteCertificate(certificate)}>
              <i className="fa fa-trash-o" />
            </PromptButton>
          </div>
        </div>
      </div>
    );
  }

  renderModalBody() {
    const {
      clientCertificates,
      workspace,
      workspaceMeta,
      editorLineWrapping,
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode,
      lastPullAt,
      handlePull,
      updateActiveWorkspaceMeta
    } = this.props;

    const pulledDate = (new Date(workspace.modified)).toString();
    const publicCertificates = clientCertificates.filter(c => !c.isPrivate);
    const privateCertificates = clientCertificates.filter(c => c.isPrivate);

    const {
      pfxPath,
      crtPath,
      keyPath,
      isPrivate,
      showAddCertificateForm,
      showDescription,
      defaultPreviewMode,
      loading,
      error
    } = this.state;

    return (
      <ModalBody key={`body::${workspace._id}`} noScroll>
        {/* <h3>{workspace.editor ? workspace.editor.nickname : null} Edited at <span>{pulledDate}</span></h3> */}
    
        {error ? <div className="danger">Oops: {error}</div> : null}
        
        <div className="members_mange_box">
        <MembersManage 
          workspace={workspace}
          workspaceMeta={workspaceMeta}
        />
        </div>
        <div className="project_handle_box">
          {workspaceMeta.role === "owner" ? (
            <PromptButton
              onClick={this._handleRemoveWorkspace}
              addIcon
              className="width-auto btn btn--clicky inline-block delete">
              <i className="fa fa-trash-o" /> Delete
            </PromptButton>
          ) : null }
          <div>
            <button
              onClick={this._handleDuplicateWorkspace}
              className="width-auto btn btn--clicky inline-block space-left">
              <i className="fa fa-copy" /> Duplicate
            </button>
            <button className="width-auto btn btn--clicky inline-block" onClick={this._handleShowEnvironmentModal}>Environments</button>
            <button className="width-auto btn btn--clicky inline-block" onClick={this.props.showCookiesModal}>Cookie</button>
            <button className="width-auto btn btn--clicky inline-block" onClick={this._handleShowExport}>Import/Export</button>
          </div>
        </div>
      </ModalBody>
    );
  }

  render() {
    const { workspace } = this.props;
    return (
      <Modal ref={this._handleSetModalRef} freshState>
        {workspace ? this.renderModalHeader() : null}
        {workspace ? this.renderModalBody() : null}
      </Modal>
    );
  }
}

export default WorkspaceDashboardModal;
