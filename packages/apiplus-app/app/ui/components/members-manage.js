import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import Dropdown from './base/dropdown/dropdown';
import DropdownButton from './base/dropdown/dropdown-button';
import DropdownItem from './base/dropdown/dropdown-item';
import * as session from '../../sync/session';
import * as util from '../../common/fetch';

@autobind
class MembersManage extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      error: '',
      loading: false
    };
  }

  _setEmailInputRef(n) {
    this._emailInput = n;
  }

  _handleUpdateMember(patch) {
    const { workspace } = this.props;
    const newMembers = workspace.members.map(el => (el.baseid === patch.baseid ? Object.assign({}, el, patch) : el))
    db.update(Object.assign(workspace, {members: newMembers}), true);
  }

  async _getMembers() {
    const { workspace } = this.props;
    this.setState({ loading: true });

    try {
      const members = await session.listMembers(workspace._id)
      const owner = members.find(m => m.role === "owner")
      await db.update(Object.assign(workspace, {members, owner}), true);
      this.setState({ loading: false, error: '' });
    } catch (err) {
      this.setState({
        error: 'Error. Please try again.',
        loading: false
      });
    }
  }

  async _addMember() {
    this.setState({ error: '', loading: true });
    const { workspace } = this.props;
    const email = this._emailInput.value;
    try {
      const response = await util.post("/projects/" + workspace._id + "/project_users/", {email});
      let members = [...workspace.members]
      if ( !members.find(m => m.baseid === response.baseid) ){
        members.push(response)
      }
      db.update(Object.assign(workspace, {members}), true);
      this.setState({ loading: false });
    } catch (err) {
      this.setState({ loading: false, error: err.message });
    }
  }

  async _updateMember(member, role) {
    this.setState({ error: '', loading: true });
    const { workspace } = this.props;
    const response = await util.put("/projects/" + workspace._id + "/project_users/" + member.baseid, {role});
    this.setState({ loading: false });
    this._handleUpdateMember(response)
  }

  async _enableMember(member) {
    this.setState({ error: '', loading: true });
    const { workspace } = this.props;
    const response = await util.put("/projects/" + workspace._id + "/project_users/" + member.baseid, {deleted_at: null});
    this.setState({ loading: false });
    this._handleUpdateMember(response)
  }

  async _disableMember(member) {
    this.setState({ error: '', loading: true });
    const { workspace } = this.props;
    const response = await util.del("/projects/" + workspace._id + "/project_users/" + member.baseid);
    this.setState({ loading: false });
    this._handleUpdateMember(response)
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

  componentWillMount() {
    this._resetState();
    this._getMembers()
  }

  render() {
    const {
      workspace,
      workspaceMeta
    } = this.props;

    const { loading, error } = this.state;

    return (
      <div className="members_manage_modal">
        {error ? <div className="danger">Oops: {error}</div> : null}
        {loading ? (
          <h3 className="members_mange_title">Loading Members ...</h3>
        ) : (
          <h3 className="members_mange_title">Members</h3>
        )}
        <ul className="manager_members_list">
          {workspace.members.map(member => {
            return (
              <li key={member.baseid} 
                className={
                  (member.role == 'owner' ? 'owner_item ' : '') + 
                  (member.role == 'editor' && member.role != 'owner' ? 'editor_item ' : '') + 
                  (member.deleted_at ? 'disable_item ' : '')
                }>
                <div className="member_info_box">
                  <img className="avatar" src={`${member.avatar.url}?imageView2/5/w/36/h/36`} title={member.email} />
                  <div className="info_content">
                    <p className="name">{member.nickname} {member.deleted_at ? "(Disable)" : ""}</p>
                    <p className="member_email">{member.email}</p>
                  </div>
                </div>
                <div className="member_handle_box">
                  {member.role != 'owner' && workspaceMeta.role == 'owner' ? (
                  <Dropdown>
                    <DropdownButton className="btn btn--clicky margin-left-sm role_dropdown">
                      <span>{member.role}</span>
                      <i className="fa fa-caret-down"></i>
                    </DropdownButton>
                    {["editor", "viewer"].map(role => (
                      <DropdownItem
                        key={role}
                        value={role}
                        onClick={() => this._updateMember(member, role)}>
                        {/*member.role == role && ( <i className="apiplus api-star"></i> )*/}
                        {role}
                      </DropdownItem>
                    ))}
                  </Dropdown>) : member.role}
                  {workspaceMeta.role == "owner" && member.role != 'owner' && !member.deleted_at && <button className="apiplusbtn project_settings" onClick={() => this._disableMember(member)}>Disable</button>}
                  {workspaceMeta.role == "owner" && member.role != 'owner' && member.deleted_at && <button className="apiplusbtn project_settings" onClick={() => this._enableMember(member)}>Re-Enable</button>}
                </div>
              </li>
            );
          })}
          </ul>
          {workspaceMeta.role === "owner" ? (
            <div className="form_row add_member_box">
              <input
                className="email_input"
                type="email"
                placeholder="add member (Gmail)" 
                ref={this._setEmailInputRef}
                onKeyPress={ (e) => {e.key === 'Enter' ? this._addMember() : null} }></input>
              <button className="add_member_btn" onClick={this._addMember}><i className="apier api-tab-add"></i></button>
            </div>
            ) : null }
      </div>
    );
  }
}

export default MembersManage;
