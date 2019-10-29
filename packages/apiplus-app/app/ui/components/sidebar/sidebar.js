import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import EnvironmentsDropdown from '../dropdowns/environments-dropdown';
import SidebarFilter from './sidebar-filter';
import SidebarChildren from './sidebar-children';
import { SIDEBAR_SKINNY_REMS, COLLAPSE_SIDEBAR_REMS } from '../../../common/constants';
import {
  Dropdown,
  DropdownDivider,
  DropdownHint,
  DropdownButton,
  DropdownItem
} from '../base/dropdown';

import { getAppVersion } from '../../../common/constants';
import * as hotkeys from '../../../common/hotkeys';
import { showModal, showPrompt } from '../modals/index';
import WorkspaceSettingsModal from '../modals/workspace-settings-modal';
import SettingsModal, { TAB_INDEX_EXPORT } from '../modals/settings-modal';
import EnvironmentsModal from '../modals/workspace-environments-edit-modal';
import Link from '../base/link';
import LoginModal from '../modals/login-modal';
import { HOST } from '../../../common/constants';

@autobind
class Sidebar extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      showFilter: false,
      showShadow: false
    };
  }

  _handleChangeEnvironment(id) {
    const { handleSetActiveEnvironment } = this.props;
    handleSetActiveEnvironment(id);
  }

  _handleCreateRequestInWorkspace() {
    const { workspace, handleCreateRequest } = this.props;
    handleCreateRequest(workspace._id);
  }

  _handleCreateRequestGroupInWorkspace() {
    const { workspace, handleCreateRequestGroup } = this.props;
    handleCreateRequestGroup(workspace._id);
  }

  _toggleFilter() {
    if (this.state.showFilter) {
      this.setState({ showFilter: false });
      this.props.handleChangeFilter('');
    } else {
      this.setState({ showFilter: true });
    }
  }

  _handleShowWorkspaceSettings() {
    showModal(WorkspaceSettingsModal, {
      workspace: this.props.activeWorkspace
    });
  }

  _handleShowSettings() {
    showModal(SettingsModal);
  }

  _handleShowExport() {
    showModal(SettingsModal, TAB_INDEX_EXPORT);
  }

  _handleShowEnvironmentModal() {
    showModal(EnvironmentsModal, this.props.workspace);
  }

  handleScroll(e) {
    let { showShadow } = this.state;
    if (e.nativeEvent.target.scrollTop > 0 && !showShadow ){
      this.setState({showShadow: true})
    }
    if (e.nativeEvent.target.scrollTop === 0 ){
      this.setState({showShadow: false})
    }
  }

  render() {
    const {
      showCookiesModal,
      filter,
      childObjects,
      hidden,
      width,
      workspace,
      workspaces,
      unseenWorkspaces,
      uidWorkspaces,
      environments,
      activeEnvironment,
      handleSetActiveWorkspace,
      handleImportFile,
      handleExportFile,
      handleChangeFilter,
      isLoading,
      handleCreateRequest,
      handleDuplicateRequest,
      handleDuplicateRequestGroup,
      handleMoveRequestGroup,
      handleGenerateCode,
      handleCopyAsCurl,
      handleCreateRequestGroup,
      handleSetRequestGroupCollapsed,
      moveDoc,
      handleActivateRequest,
      activeRequest,
      environmentHighlightColorStyle,
      handleTab,
      handleDuplicateRequestToTemp,
      requestMetas
    } = this.props;

    return (
      <aside
        className={classnames('sidebar', 'theme--sidebar', {
          'sidebar--hidden': hidden,
          'sidebar--skinny': width < SIDEBAR_SKINNY_REMS,
          'sidebar--collapsed': width < COLLAPSE_SIDEBAR_REMS
        })}
        style={{
          borderRight:
            activeEnvironment &&
            activeEnvironment.color &&
            environmentHighlightColorStyle === 'sidebar-edge'
              ? '5px solid ' + activeEnvironment.color
              : null
        }}>

        {/*<Dropdown className="more">
          <DropdownButton className="btn btn--compact" />
          <DropdownItem onClick={this._handleShowWorkspaceSettings}>
            <i className="fa fa-wrench" /> Workspace Settings
            <DropdownHint hotkey={hotkeys.SHOW_WORKSPACE_SETTINGS} />
          </DropdownItem>
          {/*<DropdownDivider>{workspace.name}</DropdownDivider>*/}
          {/*<DropdownItem onClick={this._handleShowEnvironmentModal}>
            <i className="fa fa-wrench" /> Manage Environments
            <DropdownHint hotkey={hotkeys.SHOW_ENVIRONMENTS} />
          </DropdownItem>
          <DropdownItem onClick={showCookiesModal}>
            <i className="fa fa-share" /> Cookies For Workspace
          </DropdownItem>
          <DropdownItem onClick={this._handleShowExport}>
            <i className="fa fa-share" /> Import/Export
          </DropdownItem>
          
          <DropdownDivider />
          <DropdownItem onClick={this._handleShowShareSettings}>
            <i className="fa fa-globe" /> <strong>Share</strong>
          </DropdownItem>
          
        </Dropdown>*/}

        {/*
        <div className="sidebar__menu">
          <EnvironmentsDropdown
            handleChangeEnvironment={this._handleChangeEnvironment}
            activeEnvironment={activeEnvironment}
            environments={environments}
            workspace={workspace}
            environmentHighlightColorStyle={environmentHighlightColorStyle}
          />
        </div>
        */}
        <div className="request_box" onScroll={this.handleScroll}>
          <div className={"sidebar_ctrl_box " + (this.state.showShadow ? "shadow" : "") }>
            <div className="btn_box">
              <button className="sidebar_ctrl_btn" onClick={this.props.handleAddTempTab}>
                <i className="apiplus api-new" />
                <p>New API</p>
              </button>
              <button className="sidebar_ctrl_btn" onClick={this._handleCreateRequestGroupInWorkspace}>
                <i className="apiplus api-new_folder" />
                <p>New Folder</p>
              </button>
              <button className="sidebar_ctrl_btn" onClick={this._toggleFilter}>
                <i className="apiplus api-search" />
                <p>Search</p>
              </button>
            </div>
            <SidebarFilter
            key={`${workspace._id}::filter`}
            onChange={handleChangeFilter}
            filter={filter || ''}
            showFilter={this.state.showFilter}
            />
        </div>

        

          <SidebarChildren
            childObjects={childObjects}
            handleActivateRequest={handleActivateRequest}
            handleCreateRequest={handleCreateRequest}
            handleCreateRequestGroup={handleCreateRequestGroup}
            handleSetRequestGroupCollapsed={handleSetRequestGroupCollapsed}
            handleDuplicateRequest={handleDuplicateRequest}
            handleDuplicateRequestGroup={handleDuplicateRequestGroup}
            handleMoveRequestGroup={handleMoveRequestGroup}
            handleGenerateCode={handleGenerateCode}
            handleCopyAsCurl={handleCopyAsCurl}
            moveDoc={moveDoc}
            workspace={workspace}
            activeRequest={activeRequest}
            filter={filter || ''}
            handleTab={handleTab}
            handleDuplicateRequestToTemp={handleDuplicateRequestToTemp}
            requestMetas={requestMetas}
          />
        </div>
        
      </aside>
    );
  }
}

Sidebar.propTypes = {
  // Functions
  handleActivateRequest: PropTypes.func.isRequired,
  handleSetRequestGroupCollapsed: PropTypes.func.isRequired,
  handleChangeFilter: PropTypes.func.isRequired,
  handleImportFile: PropTypes.func.isRequired,
  handleExportFile: PropTypes.func.isRequired,
  handleSetActiveWorkspace: PropTypes.func.isRequired,
  handleSetActiveEnvironment: PropTypes.func.isRequired,
  moveDoc: PropTypes.func.isRequired,
  handleCreateRequest: PropTypes.func.isRequired,
  handleCreateRequestGroup: PropTypes.func.isRequired,
  handleDuplicateRequest: PropTypes.func.isRequired,
  handleDuplicateRequestGroup: PropTypes.func.isRequired,
  handleMoveRequestGroup: PropTypes.func.isRequired,
  handleGenerateCode: PropTypes.func.isRequired,
  handleCopyAsCurl: PropTypes.func.isRequired,
  showEnvironmentsModal: PropTypes.func.isRequired,
  showCookiesModal: PropTypes.func.isRequired,

  // Other
  hidden: PropTypes.bool.isRequired,
  width: PropTypes.number.isRequired,
  isLoading: PropTypes.bool.isRequired,
  workspace: PropTypes.object.isRequired,
  childObjects: PropTypes.arrayOf(PropTypes.object).isRequired,
  workspaces: PropTypes.arrayOf(PropTypes.object).isRequired,
  unseenWorkspaces: PropTypes.arrayOf(PropTypes.object).isRequired,
  environments: PropTypes.arrayOf(PropTypes.object).isRequired,
  environmentHighlightColorStyle: PropTypes.string.isRequired,

  // Optional
  filter: PropTypes.string,
  activeRequest: PropTypes.object,
  activeEnvironment: PropTypes.object
};

export default Sidebar;
