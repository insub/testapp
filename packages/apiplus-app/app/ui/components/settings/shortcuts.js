import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import Hotkey from '../hotkey';
import * as hotkeys from '../../../common/hotkeys';

@autobind
class Shortcuts extends PureComponent {
  renderHotkey(hotkey, i) {
    return (
      <tr key={i}>
        <td>{hotkey.description}</td>
        <td className="text-right">
          <code>
            <Hotkey hotkey={hotkey} />
          </code>
        </td>
      </tr>
    );
  }

  render() {
    return (
      <div>
        <div className="hotkeys_list">
            <div className="hotkeys_item">
              <h3 className="hotkey_1">Sync <br />& documented<br />a request</h3>
              <p>
                <Hotkey hotkey={hotkeys.SAVE_REQUEST} />
              </p>
            </div>
            <div className="hotkeys_item second">
              <h3 className="hotkey_2">Duplicate <br />request<br />to new tab</h3>
              <p>
                <Hotkey hotkey={hotkeys.DUPLICATE_REQUEST} />
              </p>
            </div>
            <div className="hotkeys_item end">
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
            <div className="hotkeys_item second">
              <h3 className="hotkey_5">Variable <br />&<br />note</h3>
              <p>
                <Hotkey hotkey={hotkeys.SHOW_AUTOCOMPLETE} />
              </p>
            </div>
          </div>
        <table className="table--fancy">
          <tbody>
            {this.renderHotkey(hotkeys.SAVE_REQUEST)}
            {this.renderHotkey(hotkeys.SAVE_RESPONSE)}
            {this.renderHotkey(hotkeys.CLOSE_ACTIVE_TAB)}
            {this.renderHotkey(hotkeys.COLLAPSE_RESPONSE)}
            {this.renderHotkey(hotkeys.SHOW_QUICK_SWITCHER)}
            {this.renderHotkey(hotkeys.SEND_REQUEST)}
            {this.renderHotkey(hotkeys.SHOW_SEND_OPTIONS)}
            {this.renderHotkey(hotkeys.CREATE_REQUEST)}
            {this.renderHotkey(hotkeys.DELETE_REQUEST)}
            {this.renderHotkey(hotkeys.CREATE_FOLDER)}
            {this.renderHotkey(hotkeys.DUPLICATE_REQUEST)}
            {this.renderHotkey(hotkeys.SHOW_COOKIES)}
            {this.renderHotkey(hotkeys.SHOW_ENVIRONMENTS)}
            {this.renderHotkey(hotkeys.TOGGLE_ENVIRONMENTS_MENU)}
            {this.renderHotkey(hotkeys.FOCUS_URL)}
            {this.renderHotkey(hotkeys.TOGGLE_METHOD_DROPDOWN)}
            {this.renderHotkey(hotkeys.TOGGLE_SIDEBAR)}
            {this.renderHotkey(hotkeys.TOGGLE_HISTORY_DROPDOWN)}
            {this.renderHotkey(hotkeys.SHOW_AUTOCOMPLETE)}
            {this.renderHotkey(hotkeys.SHOW_SETTINGS)}
            {this.renderHotkey(hotkeys.SHOW_WORKSPACE_SETTINGS)}
            {this.renderHotkey(hotkeys.SHOW_REQUEST_SETTINGS)}
          </tbody>
        </table>
      </div>
    );
  }
}

export default Shortcuts;
