// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import ReactDOM from 'react-dom';

@autobind
class Paster extends React.PureComponent<Props, State> {
  constructor(props: any) {
    super(props);
  }

  render() {
    const {
      hidden
    } = this.props;

    return (
      <div id="paster_panel" className={classnames('paster_panel', {
          'paster--hidden': hidden
        })}>
        <h4>Note</h4>
        <textarea className="paster_input" placeholder="Type note here."/>
      </div>
    );
  }
}

export default Paster;
