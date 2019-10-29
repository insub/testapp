import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import * as models from '../../../models/index';

@autobind
class AskBindingModal extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      uid: null,
      avatar: null,
      nickname: "",
      nullUidWorkspaces: [],
      checkedWorkspaces: []
    };
  }

  _setModalRef(n) {
    this.modal = n;
  }

  async _handleSubmit(e) {
    e.preventDefault();

    const { checkedWorkspaces, uid, avatar, nickname } = this.state

    for (const workspace of checkedWorkspaces) {
      await models.workspace.update(workspace, {owner: {avatar,  nickname}})
      const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id); 
      await models.workspaceMeta.update(workspaceMeta, {uid})
    }
    
    this.hide();
    this._doneCallback && this._doneCallback(true);
    this._promiseCallback(true);
  }

  _handleCancel() {
    this.hide();
    this._doneCallback && this._doneCallback(false);
    this._promiseCallback(false);
  }

  _handleCheckBoxChange(e) {
    const { checked, id } = e.target
    const { nullUidWorkspaces, checkedWorkspaces } = this.state
    const workspace = nullUidWorkspaces.find(x => x._id === id)

    if (checked && !checkedWorkspaces.find(x => x._id === id)) {
      checkedWorkspaces.push(workspace)
      this.setState({checkedWorkspaces})
    } else {
      const newList = checkedWorkspaces.filter(item => item._id !== id)
      this.setState({checkedWorkspaces: newList})
    }
  }

  hide() {
    this.modal.hide();
  }

  async show(options = {}) {
    const { uid, avatar, nickname, onDone } = options;
    const nullUidWorkspaces = await models.workspace.allByUid(null)
    this.setState({
      uid,
      avatar,
      nickname,
      nullUidWorkspaces,
      checkedWorkspaces: nullUidWorkspaces
    })

    this.modal.show();
    this._doneCallback = onDone;

    return new Promise(resolve => {
      this._promiseCallback = resolve;
    });
  }

  render() {
    const { nullUidWorkspaces, checkedWorkspaces } = this.state;

    return (
      <Modal className="bind_request_modal" ref={this._setModalRef} noEscape={true}>
        <ModalHeader>Binding Unlogin Projects</ModalHeader>
        <ModalBody>
          <div>
          {nullUidWorkspaces.map((w, i) => {
            return (
              <div className="form-control form-control--thin" key={i}>
                <label className="inline-block">
                  {w.name}
                  <input
                    type="checkbox"
                    id={w._id}
                    defaultChecked={true}
                    onChange={this._handleCheckBoxChange}
                  />
                </label>
              </div>
            );
          })}
            
          </div>
          <button className="btn btn--super-compact width-auto" onClick={this._handleSubmit}>
            Confirm
          </button>
          <button className="btn btn--super-compact width-auto" onClick={this._handleCancel}>
            Don't Binding
          </button>
        </ModalBody>
      </Modal>
    );
  }
}

export default AskBindingModal;
