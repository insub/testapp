import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import Link from '../base/link';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import Hotkey from '../hotkey';
import * as hotkeys from '../../../common/hotkeys';

@autobind
class HotkeysTipsModal extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {};
  }

  _setModalRef(n) {
    this.modal = n;
  }

  async _load() {
  }

  _resetState(patch = {}) {
    this.setState(
      Object.assign(
        {
          data: '',
        },
        patch
      )
    );
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
    const { data } = this.state;

    return (
      <Modal className="hotkeys_tips_modal" ref={this._setModalRef} onHide={this._handleClose}>
        <ModalHeader key="header">
          <h1>HOTKEYS TIPS</h1>
        </ModalHeader>
        <ModalBody key="body" className="">
          <div className="hotkeys_list">
            <div className="hotkeys_item">
              <h3 className="hotkey_1">Sync <br />& documented<br />a request</h3>
              <p>
                <Hotkey hotkey={hotkeys.SAVE_REQUEST} />
              </p>
            </div>
            <div className="hotkeys_item">
              <h3 className="hotkey_2">Duplicate <br />request<br />to new tab</h3>
              <p>
                <Hotkey hotkey={hotkeys.DUPLICATE_REQUEST} />
              </p>
            </div>
            <div className="hotkeys_item">
              <h3 className="hotkey_3">Restore <br />request<br />make change cancel<br /></h3>
              <p>
                <Hotkey hotkey={hotkeys.RESTORE_REQUEST} />
              </p>
            </div>
            <div className="hotkeys_item">
              <h3 className="hotkey_4">Toggle layout<br />&<br />view-mode</h3>
              <p>
                <Hotkey hotkey={hotkeys.COLLAPSE_SIDEBAR} /> /
                <Hotkey hotkey={hotkeys.COLLAPSE_RESPONSE} /> /
                <Hotkey hotkey={hotkeys.TOGGLE_PANE} />
              </p>
            </div>
            <div className="hotkeys_item">
              <h3 className="hotkey_5">Variable <br />&<br />note</h3>
              <p>
                <Hotkey hotkey={hotkeys.SHOW_AUTOCOMPLETE} />
              </p>
            </div>
            <div className="hotkeys_item">
              <button className="more_keys"><i className="apier api-more"></i></button>
            </div>
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

export default HotkeysTipsModal;
