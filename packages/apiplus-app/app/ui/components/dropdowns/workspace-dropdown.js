import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import * as classnames from 'classnames';
import Dropdown from '../base/dropdown/projects-dropdown';
import DropdownDivider from '../base/dropdown/dropdown-divider';
import DropdownButton from '../base/dropdown/dropdown-button';
import DropdownItem from '../base/dropdown/dropdown-item';
import DropdownHint from '../base/dropdown/dropdown-hint';
import * as models from '../../../models';
import { showModal, showPrompt } from '../modals/index';
import Link from '../base/link';
import * as session from '../../../sync/session';
import LoginModal from '../modals/login-modal';
import Tooltip from '../tooltip';
import * as hotkeys from '../../../common/hotkeys';
import KeydownBinder from '../keydown-binder';
import * as sync from '../../../sync';

@autobind
class WorkspaceDropdown extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      loggedIn: false
    };
  }

  async _handleDropdownOpen() {
    if (this.state.loggedIn !== session.isLoggedIn()) {
      this.setState({ loggedIn: session.isLoggedIn() });
    }
  }

  async _handleDropdownHide() {
    // Mark all unseen workspace as seen
    for (const workspace of this.props.unseenWorkspaces) {
      const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
      if (!workspaceMeta.hasSeen) {
        models.workspaceMeta.update(workspaceMeta, { hasSeen: true });
      }
    }
  }

  _setDropdownRef(n) {
    this._dropdown = n;
  }

  _handleShowLogin() {
    showModal(LoginModal);
  }

  _handleSwitchWorkspace(workspaceId) {
    this.props.handleSetActiveWorkspace(workspaceId);
    sync.pull()
  }

  _handleWorkspaceCreate() {
    showPrompt({
      title: 'Create New Project',
      defaultValue: 'New Project',
      submitName: 'Create',
      selectText: true,
      onComplete: async name => {
        const workspace = await models.workspace.create({ name });
        this.props.handleSetActiveWorkspace(workspace._id);
        sync.push()
      }
    });
  }

  _handleKeydown(e) {
    hotkeys.executeHotKey(e, hotkeys.TOGGLE_MAIN_MENU, () => {
      this._dropdown && this._dropdown.toggle(true);
    });
  }

  render() {
    const {
      className,
      workspaces,
      activeWorkspace,
      unseenWorkspaces,
      uidWorkspaces,
      isLoading,
      workspaceMeta,
      workspaceMetas,
      ...other
    } = this.props;

    const nonActiveWorkspaces = workspaces.filter(w => w._id !== activeWorkspace._id);
    const addedWorkspaceNames = unseenWorkspaces.map(w => `"${w.name}"`).join(', ');
    const classes = classnames(className, 'wide', 'workspace-dropdown');

    const unseenWorkspacesMessage = (
      <div>
        The following projects were added
        <br />
        {addedWorkspaceNames}
      </div>
    );

    return (
      <KeydownBinder onKeydown={this._handleKeydown}>
        <Dropdown
          beside
          ref={this._setDropdownRef}
          className={classes}
          onOpen={this._handleDropdownOpen}
          onHide={this._handleDropdownHide}
          {...other}>
          <DropdownButton className="project_settings">
            <i className="apiplus api-downarrow_exp
              "></i>
          </DropdownButton>

          {/*<DropdownDivider>Switch Workspace</DropdownDivider>*/}
          {uidWorkspaces.map(w => {
            const isUnseen = !!unseenWorkspaces.find(v => v._id === w._id);
            const workspaceMeta = workspaceMetas.find(wm => wm.parentId === w._id);
            return (
              <DropdownItem
                className="projects_switch_items"
                key={w._id}
                onClick={this._handleSwitchWorkspace}
                value={w._id}>
                <div className="project_info_box">
                  {workspaceMeta.important && (
                    <i className="apiplus api-star"></i>
                  )}
                  <div>
                  <span className="project_name">{w.name}</span>
                  <br/>
                  
                  {w.members.length > 1 ? (
                    <div className="project_owner_info">
                      {w.members.map(m => {
                        return <img key={m.email} className="avatar" src={m.avatar ? `${m.avatar.url}?imageView2/5/w/36/h/36` : "static/avatar.svg"} alt="" />
                      })}
                    </div>
                  ) : (
                    <div className="project_owner_info">
                      <img className="avatar" src={w.owner ? `${w.owner.avatar.url}?imageView2/5/w/36/h/36` : "static/avatar.svg"} alt="" /> 
                      <span className="owner_name">{w.owner ? `Created by ${w.owner.email}` : ''}</span>
                    </div>
                  )}
                  
                  {/*{w.role !== 'owner' && (
                    <span className="shared_status"><span>{w.role}</span></span>
                    )}
                  {w.role == 'owner' && (
                    <span className="shared_status"><span className="owner_label">owner</span></span>
                    )}*/}
                  </div>
                </div>
                {w._id === activeWorkspace._id ? (
                  <i className="apiplus api-ok" />
                ) : (
                  <i className="apiplus api-more" />
                )}
                
                {isUnseen && (
                  <Tooltip message="This project is new">
                    <i className="width-auto fa fa-asterisk surprise" />
                  </Tooltip>
                )}
              </DropdownItem>
            );
          })}
          <DropdownItem className="new_project" onClick={this._handleWorkspaceCreate}>
            <i className="apiplus api-create"/>
             New Project
          </DropdownItem>

          {/* Not Logged In */}

          {/*{!this.state.loggedIn && (
            <DropdownItem key="login" onClick={this._handleShowLogin}>
              <i className="fa fa-sign-in" /> Log In
            </DropdownItem>
          )}

          {!this.state.loggedIn && (
            <DropdownItem
              key="invite"
              buttonClass={Link}
              href="https://apiplus.io/pricing"
              button>
              <i className="fa fa-users" /> Upgrade to Plus
              <i className="fa fa-star surprise fa-outline" />
            </DropdownItem>
          )}*/}
        </Dropdown>
      </KeydownBinder>
    );
  }
}

WorkspaceDropdown.propTypes = {
  // Required
  isLoading: PropTypes.bool.isRequired,
  handleImportFile: PropTypes.func.isRequired,
  handleExportFile: PropTypes.func.isRequired,
  handleSetActiveWorkspace: PropTypes.func.isRequired,
  workspaces: PropTypes.arrayOf(PropTypes.object).isRequired,
  unseenWorkspaces: PropTypes.arrayOf(PropTypes.object).isRequired,
  activeWorkspace: PropTypes.object.isRequired,

  // Optional
  className: PropTypes.string
};

export default WorkspaceDropdown;
