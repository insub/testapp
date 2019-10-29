import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem
} from '../base/dropdown';
import Link from '../base/link';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import * as session from '../../../sync/session';
import * as sync from '../../../sync/index';
import { showPrompt } from './index';
import PromptButton from '../base/prompt-button';
import * as hotkeys from '../../../common/hotkeys';
import * as models from '../../../models/index';
import * as db from '../../../common/database';

@autobind
class SyncStatusModal extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {};
  }

  async _handleClose() {
    // 演示时可暂时关闭
    this.props.unreadMessages.map((doc) => models.message.update(doc, {read: true}) );
    // db.updateWhere("Message", {read: false}, {$set: { read: true }});
  }

  _setModalRef(n) {
    this.modal = n;
  }

  async _load() {
    if (!session.isLoggedIn()) {
      this._resetState({});
      return;
    }

    try {
      this.setState({ loading: false, error: '' });
    } catch (err) {
      this.setState({
        error: 'No sync info found. Please try again.',
        loading: false
      });
    }
  }

  _resetState(patch = {}) {
    this.setState(
      Object.assign(
        {
          error: '',
          loading: true
        },
        patch
      )
    );
  }

  typeNameString(doc){
    let name = ""
    if (!doc) {
      return "Unknow"
    }
    switch (doc.type) {
      case 'Request':
        name = `Request::#${doc.showid}::${doc.name}`
        break;
      case 'RequestGroup':
        name = `Folder::${doc.name}`
      case 'Workspace':
        name = `Project::${doc.name}`
        break;
      default:
        "..."
    }
    return name
  }

  async show() {
    this._resetState();
    this.modal.show();

    // This takes a while, so do it after show()
    await this._load();
  }

  componentWillMount() {
    this._resetState();
  }

  render() {
    const { error, loading } = this.state;
    const { messages, lastPullAt } = this.props;
    const pulledDate = (new Date(lastPullAt)).toString();
    return (
      <Modal className="sync_center_modal" ref={this._setModalRef} onHide={this._handleClose}>
        <ModalHeader key="header">
          <div className="gray_side"></div>
          <div className="white_side"></div>
        </ModalHeader>
        <ModalBody key="body" className="pad text-center" noScroll>
          <div className="sync_desc_box">
            <h4>About Sync</h4>
            <p>
              Unsynchronized field's values, response, and environment.
              Response example and environment can be uploaded manually.
            </p>
            <div className="status_desc_box">
              <p>Unsave</p>
              <p>Saved but need push</p>
            </div>
            <div className="shortcuts_box">
              <h3>{hotkeys.SAVE_REQUEST.hotkey}</h3>
              <p>Save and Push</p>
            </div>
          </div>
          <div className="sync_handle_box">
            <div className="check_box">
              <button className="apiplusbtn check_btn" onClick={this.props.handlePull}> {this.props.isPulling ? 'loading...' : 'Check Update'}</button>
              <p>Lastest check at : {pulledDate}</p>
              {/*<p className="handle_line">
                <span>If data is confusing, you can </span>
                <Link className="handle_link">Contact us</Link>
                <span>or</span>
                <Link className="handle_link">Reset data</Link>
              </p>*/}
            </div>
            {/*<ul className="sync_history_list">
              <li>
                <img className="avatar" src="static/avatar.svg"/>
                <p>Jason <span>modified </span>[Request]: <span>add a new car </span> at 2018-12-10 12:32</p>
              </li>
              <li>
                <img className="avatar" src="static/avatar.svg"/>
                <p>Jason <span>modified </span>[Request]: <span>show car </span> at 2018-12-10 12:32</p>
              </li>
            </ul>*/}
            <ul className="sync_history_list">
              {messages.map((item, i) => {
                let modifiedDate = (new Date(item.doc.modified)).toString();
                let typename = this.typeNameString(item.doc)

                return (
                  <li className={item.read ? "readed" : ''} key={i}>
                    <img className="avatar" src={`${item.by.avatar ? item.by.avatar.url : "static/avatar.svg"}?imageView2/5/w/36/h/36`}/>
                    <div>
                      <h3><span>{item.action}</span>::{typename}</h3>
                      <p>{item.by.nickname}<span></span> at {modifiedDate}</p>
                      {/*<p>{item.by.nickname} <label>[{item.doc.type} ] </label><span>{item.doc.name} </span> at {modifiedDate}</p>*/}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

export default SyncStatusModal;
