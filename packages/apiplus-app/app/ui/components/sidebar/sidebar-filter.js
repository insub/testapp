// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { Dropdown, DropdownHint, DropdownButton, DropdownItem } from '../base/dropdown';
import { DEBOUNCE_MILLIS } from '../../../common/constants';
import KeydownBinder from '../keydown-binder';
import * as hotkeys from '../../../common/hotkeys';

type Props = {
  onChange: string => void,
  filter: string
};

@autobind
class SidebarFilter extends React.PureComponent<Props> {
  _input: ?HTMLInputElement;
  _triggerTimeout: TimeoutID;

  _setInputRef(n: ?HTMLInputElement) {
    this._input = n;
  }

  _handleClearFilter(e: SyntheticEvent<HTMLButtonElement>) {
    this.props.onChange('');
    if (this._input) {
      this._input.value = '';
      this._input.focus();
    }
  }

  _handleOnChange(e: SyntheticEvent<HTMLInputElement>) {
    const value = e.currentTarget.value;

    clearTimeout(this._triggerTimeout);
    this._triggerTimeout = setTimeout(() => {
      this.props.onChange(value);
    }, DEBOUNCE_MILLIS);
  }

  _handleKeydown(e: KeyboardEvent) {
    hotkeys.executeHotKey(e, hotkeys.FOCUS_FILTER, () => {
      this._input && this._input.focus();
    });
  }

  componentWillReceiveProps(nextProps) {
    if (!nextProps.showFilter) {
      if (this._input) {
        this._input.value = '';
        this._input.focus();
      }
    }
  }

  render() {
    const { filter } = this.props;

    return (
      <section className={this.props.showFilter ? '' : 'hide'}>
        <KeydownBinder onKeydown={this._handleKeydown}>
          <div className="sidebar__filter">
            <div className="form-control form-control--outlined form-control--btn-right">
              <input
                ref={this._setInputRef}
                type="text"
                placeholder="Filter"
                defaultValue={filter}
                onChange={this._handleOnChange}
              />
              {filter && (
                <button className="form-control__right" onClick={this._handleClearFilter}>
                  <i className="fa fa-times-circle" />
                </button>
              )}
            </div>
          </div>
        </KeydownBinder>
      </section>
    );
  }
}

export default SidebarFilter;
