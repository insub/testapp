// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import ReactDOM from 'react-dom';
import { showAlert, showModal, showPrompt } from '../components/modals/index';
import SettingsModal, { TAB_INDEX_GENERAL, TAB_INDEX_SHORTCUTS, TAB_INDEX_SUPPORT } from '../components/modals/settings-modal';
import * as session from '../../sync/session';
import LoginModal from '../components/modals/login-modal';
import { clipboard, ipcRenderer, remote } from 'electron';
import { isMac, isDevelopment} from '../../common/constants';
const window = remote.getCurrentWindow();
import { toast as itoast } from 'react-toastify';
import * as sync from '../../sync';
import SyncStatusModal from './modals/sync-status-modal';
import WorkspaceDropdown from './dropdowns/workspace-dropdown';
import WorkspaceDashboardModal from './modals/workspace-dashboard-modal';
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownHint,
  DropdownItem
} from './base/dropdown';
import * as hotkeys from '../../common/hotkeys';
import Link from './base/link';
import { HOST } from '../../common/constants';
import * as database from '../../common/database';
import * as models from '../../models/index';

import HotkeysTipsModal from './modals/hotkeys-tips-modal';

type Props = {
  children: React.Node
};

type State = {
  visible: boolean
};

@autobind
class Toolbar extends React.PureComponent<Props, State> {
  constructor(props: any) {
    super(props);

    this.state = {
      loggedIn: false,
      visible: false,
      windowIsMaximized: window ? window.isMaximized() : false,
      isPin: false
    };
  }

  _handleShowLogin() {
    showModal(LoginModal);
  }

  _handleShowSyncStatus() {
    if (this.props.unreadMessages.length){
      showModal(SyncStatusModal, { workspace: this.props.workspace });
    } else {
      showModal(SyncStatusModal, { workspace: this.props.workspace });
      // this.props.handlePull()
    }
  }

  _handleShowSyncStatusx() {
    showModal(SyncStatusModal);
  }

  togglePinWindow() {
    if (this.state.isPin) {
      window.setAlwaysOnTop(false, 'floating', 0);
      window.setVisibleOnAllWorkspaces(false);
    } else {
      window.setAlwaysOnTop(true, 'floating', 1);
      // allows the window to show over a fullscreen window
      window.setVisibleOnAllWorkspaces(true);
    }
    this.setState({ isPin: !this.state.isPin });
  }

  minimizeWindow() {
    window.minimize();
  }

  toggleMaximizeWindow() {
    if (this.state.windowIsMaximized) {
      window.unmaximize();
    } else {
      window.maximize();
    }
    this.setState({ windowIsMaximized: !this.state.windowIsMaximized });
  }

  closeWindow() {
    window.hide();
  }

  showSetting(tabIndex) {
    showModal(SettingsModal, tabIndex);
  }

  async _handleItoastx(){
    itoast.success('success!', {
      position: "top-center",
      autoClose: 1500,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true
    });
  }

  _handleShowWorkspaceDashboard() {
    showModal(WorkspaceDashboardModal, {
      workspace: this.props.workspace
    });
  }

  async test() {
    // sync.pull()
    // await models.message.create({action: "confilct", doc: this.props.activeRequest });
    // const t = await models.workspace.allByUid(null)
    const oldStats = await models.stats.get();
    const { launches, lastLaunch } = oldStats;
    if (launches < 3 || Date.now() - lastLaunch > 86400000 * 7) {
      showModal(HotkeysTipsModal);
    }
  }

  _handleShowHotkeysModal(){
    showModal(HotkeysTipsModal)
  }

  openDatabase() {
    console.warn("Database = ", db.getDBFilePath())
  }

  restPullAt() {
    this.props.updateActiveWorkspaceMeta({lastPullAt: 292521600})
  }



  render() {
    const {
      workspace,
      workspaces,
      workspaceMeta,
      activeRequest,
      unseenWorkspaces,
      uidWorkspaces,
      handleExportFile,
      handleImportFile,
      handleSetActiveWorkspace,
      isLoading,
      isPushing,
      unreadMessages,
      workspaceMetas,
      activeWorkspace
    } = this.props;

    let syncBar;

    if (this.props.isLoggedIn) {
      syncBar = [
        <div className={"app_header_btn syncing_box show " + (isPushing ? 'syncing' : '')} key="userinfoBar">
          {unreadMessages.length > 0 &&
            <label className="sync_label">{unreadMessages.length}</label>
          }
          <button onClick={this._handleShowSyncStatus}>
          <div className="no-wrap pull_box windownodrag sync_content">
          <div className={"sync " + (isPushing ? 'loading' : '')}>

          <svg width="16px" height="16px" viewBox="0 0 18 18" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.9947683,9.37798507 C17.5023015,9.04824792 16.941441,8.83475175 16.3572366,8.74921171 C16.3495197,7.52573796 16.0350459,6.29109967 15.3821173,5.16019412 C13.3487052,1.63822116 8.80268893,0.456033965 5.22830567,2.51970511 C1.6539224,4.58337625 0.404718397,9.11143545 2.43813043,12.6334084 C4.47154246,16.1553814 9.01755877,17.3375686 12.591942,15.2738974 C12.609102,15.2639901 12.6262085,15.2540259 12.6432612,15.2440054 C13.0651464,15.7468022 13.5980408,16.1233313 14.1858431,16.3590036 C13.9664136,16.5132427 13.7382375,16.6590526 13.5015028,16.7957314 C9.19686917,19.2810128 3.69255552,17.8061364 1.20727414,13.5015028 C-1.27800723,9.19686917 0.196869166,3.69255552 4.50150278,1.20727414 C8.80613639,-1.27800723 14.31045,0.196869166 16.7957314,4.50150278 C17.6828826,6.03809375 18.0654229,7.72755027 17.9947683,9.37798507 L17.9947683,9.37798507 Z M14.6665663,13.8136806 C14.2523527,13.0962417 14.4981655,12.1788561 15.2156044,11.7646425 C15.9330433,11.3504289 16.8504289,11.5962417 17.2646425,12.3136806 C17.6788561,13.0311195 17.4330433,13.9485051 16.7156044,14.3627187 C15.9981655,14.7769323 15.0807798,14.5311195 14.6665663,13.8136806 Z" id="Shape"></path>
          </svg>
          </div>
            { unreadMessages.length ? (
              <span><b>{unreadMessages.length}</b> message</span>
              ) : (
              <span>Sync</span>
            )}
          </div>
          </button>
        </div>
      ];
    } else {
      syncBar = [
        <div className="windownodrag app_header_btn syncing_box show"  onClick={this._handleShowLogin} key="userinfoBar2">
          <div className="sync_frame">
            <svg width="18px" height="18px" viewBox="0 0 18 18" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.9947683,9.37798507 C17.5023015,9.04824792 16.941441,8.83475175 16.3572366,8.74921171 C16.3495197,7.52573796 16.0350459,6.29109967 15.3821173,5.16019412 C13.3487052,1.63822116 8.80268893,0.456033965 5.22830567,2.51970511 C1.6539224,4.58337625 0.404718397,9.11143545 2.43813043,12.6334084 C4.47154246,16.1553814 9.01755877,17.3375686 12.591942,15.2738974 C12.609102,15.2639901 12.6262085,15.2540259 12.6432612,15.2440054 C13.0651464,15.7468022 13.5980408,16.1233313 14.1858431,16.3590036 C13.9664136,16.5132427 13.7382375,16.6590526 13.5015028,16.7957314 C9.19686917,19.2810128 3.69255552,17.8061364 1.20727414,13.5015028 C-1.27800723,9.19686917 0.196869166,3.69255552 4.50150278,1.20727414 C8.80613639,-1.27800723 14.31045,0.196869166 16.7957314,4.50150278 C17.6828826,6.03809375 18.0654229,7.72755027 17.9947683,9.37798507 L17.9947683,9.37798507 Z M14.6665663,13.8136806 C14.2523527,13.0962417 14.4981655,12.1788561 15.2156044,11.7646425 C15.9330433,11.3504289 16.8504289,11.5962417 17.2646425,12.3136806 C17.6788561,13.0311195 17.4330433,13.9485051 16.7156044,14.3627187 C15.9981655,14.7769323 15.0807798,14.5311195 14.6665663,13.8136806 Z" id="Shape"></path>
            </svg>
          </div>
          <span>Sync</span>
        </div>
      ];
    }

    return (
      <section className={"app_main_header  no-wrap" + (this.props.serverDown ? " server_down" : "")}>
        <div className="windowdrag dragPanel"></div>
        <div className="project_box windownodrag" key="projectsInfoBar">
          <div className="project_settings_group" onClick={this._handleShowWorkspaceDashboard}>
            <i className={`apiplus ${workspaceMeta.important ? 'api-star stared' : 'hide'}`}></i>
            <h1 className="no-pad text-left">
              <div className="pull-right">
                {isLoading ? <i className="fa fa-refresh fa-spin" /> : null}
                {unseenWorkspaces.length > 0 && (
                  <Tooltip message={unseenWorkspacesMessage} position="bottom">
                    <i className="fa fa-asterisk space-left" />
                  </Tooltip>
                )}
              </div>
              <span >{workspace.name}</span>
              <br/>
              <small>{workspaceMeta.role}</small>
            </h1>
            <ul className="members_list" onClick={this._handleShowWorkspaceDashboard}>
              {workspace.members.map(member => (
                <li key={member.baseid} className={((member.role == 'owner') ? 'owner_item' : '') + ((member.role == 'editor' && member.role != 'owner') ? 'editor_item' : '') }>
                  <img className="avatar" src={`${member.avatar.url}?imageView2/5/w/36/h/36`} title={member.email} />
                </li>
              ))}
            </ul>
          </div>
          <div className="project_settings_box">
            <WorkspaceDropdown
              className="project_dropdown stared"
              activeWorkspace={workspace}
              workspaces={workspaces}
              workspaceMeta={workspaceMeta}
              unseenWorkspaces={unseenWorkspaces}
              uidWorkspaces={uidWorkspaces}
              handleExportFile={handleExportFile}
              handleImportFile={handleImportFile}
              handleSetActiveWorkspace={handleSetActiveWorkspace}
              isLoading={isLoading}
              workspaceMetas={workspaceMetas}
            />
            
          </div>
        </div>
        {/*<button onClick={this.togglePinWindow} className={this.state.isPin ? 'mac_pined' : 'mac_pin'}>
          <i className={'apiplus api-pin'} />
        </button>*/}
        <div className="window_handle">
          {/*<button onClick={this.togglePinWindow} className={this.state.isPin ? 'pined' : ''}>
            <i className={'apiplus api-pin'} />
          </button>*/}
          <button onClick={this.minimizeWindow} className={this.isMac ? 'hide' : ''}>
            <i className="apiplus api-minmize" />
          </button>
          <button onClick={this.toggleMaximizeWindow} className={this.isMac ? 'hide' : ''}>
            <i
              className={
                'apiplus ' + (this.state.windowIsMaximized ? 'api-maxmize-maxed' : 'api-maxmize')
              }
            />
          </button>
          <button className="win_close" onClick={this.closeWindow} className={this.isMac ? 'hide' : ''}>
            <i className="apiplus api-win-close" />
          </button>
        </div>

        
        <div className="center_box" key="syncBar">
          <Link
          button
          className={"app_header_btn windownodrag doc_btn " + (this.props.pushSuccess ? "glow_color" : "")}
          href={`${HOST}/projects/${workspace._id}/doc${activeRequest ? '/#' + activeRequest._id : ''}`}>
          <i className="apiplus api-doc" />
          <span>View Document</span>
          </Link>
          {syncBar}
        </div>
       

        <div className="app_setting_box">
          {/*
          <button className="app_header_btn sidebar_btn spec" onClick={this.props.handleToggleSidebar}>
            <span>
              <i className="apiplus api-sidebar_icon" />
            </span>
            <p>F1</p>
          </button>
          <button className="app_header_btn pane_btn spec" onClick={this.props.toggleCollapseResponse}>
            <span>
              <i className="apiplus api-rescol" />
            </span>
            <p>F2</p>
          </button>
          <button className="app_header_btn pane_btn spec" onClick={this.props.togglePaneMode}>
            <span>
              <i className={`apiplus ${this.props.verticalPaneMode ? 'api-pane_icon' : 'api-pane-vertical_icon'}`} />
            </span>
            <p>F3</p>
          </button>
          <button className="app_header_btn paster_btn spec" onClick={this.props.handleTogglePaster}>
            <span>
              <i className="apiplus api-paster_icon" />
            </span>
            <p>F4</p>
          </button>
       
          <button
            className="app_header_btn shortcuts_btn group"
            onClick={this.showSetting.bind(this, TAB_INDEX_SHORTCUTS)}>
            <span>
              <i className="apiplus api-shortcuts_icon" />
            </span>
            <p>Hotkeys</p>
          </button>
          <button className="app_header_btn settings_btn group" onClick={this.showSetting.bind(this, TAB_INDEX_GENERAL)}>
            <span>
              <i className="apiplus api-settings_icon" />
            </span>
            <p>Settings</p>
          </button>
          <button className="app_header_btn support_btn group show" onClick={this.showSetting.bind(this, TAB_INDEX_SUPPORT)}>
            <span>
              <i className="apiplus api-support" />
            </span>
            <p>Support</p>
          </button>
        */}

          <Dropdown key="setting_dropdown" right ref={this._setDropdownRef}>
            <DropdownButton className="app_header_btn support_btn show">
              <span>
              <i className="apiplus api-more" />
              </span>
              <p>Layout & Setting</p>
            </DropdownButton>
            <DropdownDivider>Layout</DropdownDivider>
            <DropdownItem stayOpenAfterClick onClick={this.props.handleToggleSidebar}>
              <i className="apiplus api-sidebar_icon fa " /> Sidebar
              <DropdownHint hotkey={hotkeys.COLLAPSE_SIDEBAR} />
            </DropdownItem>
            <DropdownItem stayOpenAfterClick onClick={this.props.toggleCollapseResponse}>
              <i className="apiplus api-rescol fa " /> Show Response 
              <DropdownHint hotkey={hotkeys.COLLAPSE_RESPONSE} />
            </DropdownItem>
            <DropdownItem stayOpenAfterClick onClick={this.props.togglePaneMode}>
              <i className="apiplus api-pane-vertical_icon fa " /> Response Layout
              <DropdownHint hotkey={hotkeys.TOGGLE_PANE} />
            </DropdownItem>
            <DropdownItem onClick={this.props.handleTogglePaster}>
              <i className="apiplus api-paster_icon fa " /> Paster
              <DropdownHint hotkey={hotkeys.TOGGLE_PASTER} />
            </DropdownItem>
            <DropdownDivider>Setting</DropdownDivider>
            <DropdownItem onClick={this.showSetting.bind(this, TAB_INDEX_SHORTCUTS)}>
              <i className="apiplus api-shortcuts_icon fa " /> Hotkeys
            </DropdownItem>
            <DropdownItem onClick={this.showSetting.bind(this, TAB_INDEX_GENERAL)}>
              <i className="apiplus api-settings_icon fa " /> Settings
            </DropdownItem>
            <DropdownItem onClick={this.showSetting.bind(this, TAB_INDEX_SUPPORT)}>
              <i className="apiplus api-support fa " /> Support
            </DropdownItem>
            {isDevelopment() ? [
                <DropdownDivider key="development_dropdownDivider">Development</DropdownDivider>,
                <DropdownItem key="TestDropdownItem" onClick={this.test}> Test</DropdownItem>,
                <DropdownItem key="TestModalItem1" onClick={this._handleShowHotkeysModal}> Open hotkey tips modal</DropdownItem>,
                <DropdownItem key="TestDropdownItem2" onClick={this.openDatabase}> Database</DropdownItem>
              ] : null
            }
          </Dropdown>

          <button className="avatar_box windownodrag" onClick={this._handleShowLogin}>
            <img className="avatar user" src={this.props.isLoggedIn ? session.getAvatar() : "static/avatar.svg"} />
          </button>
        </div>
        {/*<div className="animation_box">
          <div className="saving_animation_first"></div>
          <div className="saving_animation_second"></div>
          <div className="saving_animation_third"></div>
        </div>*/}
      </section>
    );
  }
}

export default Toolbar;
