import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import * as models from '../../../models/index';
import * as sync from '../../../sync';
import * as db from '../../../common/database';

@autobind
class TempRequestCreateModal extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      request: null
    };
  }

  _setModalRef(n) {
    this.modal = n;
  }

  _setInputRef(n) {
    this._input = n;
    if (this._input) {
      this._input.value = 'New Request';
    }
  }

  async _handleSubmit(e) {
    e.preventDefault();

    const { request } = this.state;
    const theRequest = Object.assign(request, {name: this._input.value, isTemp: false, modified: Date.now()});
    const finalRequest = await db.update(theRequest, true);
    await sync.saveResource("update", finalRequest)
    this.props.handlePush()

    this.hide();
  }

  hide() {
    this.modal.hide();
  }

  show({ request }) {
    this.setState({
      request
    });

    this.modal.show();

    // Need to do this after render because modal focuses itself too
    setTimeout(() => {
      this._input.focus();
      this._input.select();
    }, 200);
  }

  render() {
    return (
      <Modal className="create_request_modal" ref={this._setModalRef}>
        <ModalHeader>Save Request</ModalHeader>
        <ModalBody noScroll>
          <form onSubmit={this._handleSubmit} className="pad">
            <div className="form-row">
              <div className="form-control form-control--outlined">
                <label>
                  <input ref={this._setInputRef} type="text" />
                </label>
              </div>
            </div>
          </form>
          <button className="submit_btn" onClick={this._handleSubmit}>
            Save
          </button>
        </ModalBody>
      </Modal>
    );
  }
}

export default TempRequestCreateModal;
