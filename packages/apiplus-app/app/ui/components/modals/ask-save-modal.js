import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';

@autobind
class AskSaveModal extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      title: '',
      message: ''
    };
  }

  _setModalRef(m) {
    this.modal = m;
  }

  _setYesButtonRef(n) {
    this.yesButton = n;
  }

  _handleYes() {
    this.hide();
    this._doneCallback && this._doneCallback(true);
    this._promiseCallback("yes");
  }

  _handleNo() {
    this.hide();
    this._doneCallback && this._doneCallback(false);
    this._promiseCallback("no");
  }

  _handleCancel() {
    this.hide();
    this._doneCallback && this._doneCallback(false);
    this._promiseCallback("cancel");
  }

  hide() {
    this.modal.hide();
  }

  show(options = {}) {
    const { title, message, onDone } = options;

    this._doneCallback = onDone;

    this.setState({ title, message });

    this.modal.show();

    setTimeout(() => {
      this.yesButton && this.yesButton.focus();
    }, 100);

    return new Promise(resolve => {
      this._promiseCallback = resolve;
    });
  }

  render() {
    const { message, title } = this.state;

    return (
      <Modal className="no_save_modal" noEscape ref={this._setModalRef} closeOnKeyCodes={[13]}>
        <ModalHeader>{title || 'Confirm?'}</ModalHeader>
        <ModalBody className="wide pad">{message}</ModalBody>
        <ModalFooter>
          <div>
            <button className="btn" onClick={this._handleNo}>
              Don't Save
            </button>
            <button
              ref={this._setYesButtonRef}
              className="btn save_btn"
              onClick={this._handleYes}>
              Save & Sync
            </button>
            <button className="btn cancel_btn" onClick={this._handleCancel}>
              Cancel
            </button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

export default AskSaveModal;
