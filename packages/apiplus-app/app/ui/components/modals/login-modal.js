import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import Link from '../base/link';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import * as session from '../../../sync/session';
import * as sync from '../../../sync';
import { getAppTheme, isDevelopment } from '../../../common/constants';
import PromptButton from '../base/prompt-button';

@autobind
class LoginModal extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      loggedIn: false,
      step: 1,
      loading: false,
      error: '',
      title: '',
      message: '',
      sessionData: null
    };
  }

  async _handleLogout() {
    await sync.logout();
    // this.forceUpdate();
  }

  _setModalRef(n) {
    this.modal = n;
  }

  _setPasswordInputRef(n) {
    this._passwordInput = n;
  }

  _setEmailInputRef(n) {
    this._emailInput = n;
  }

  async _handleLogin(e) {
    e.preventDefault();
    this.setState({ error: '', loading: true });

    const email = this._emailInput.value;
    const password = this._passwordInput.value;

    try {
      await session.login(email, password);

      // Clear all existing sync data that might be there and enable sync
      process.nextTick(async () => {
        // await sync.resetLocalData();
        // await sync.doInitialSync();
      });

      this.setState({ step: 2, loading: false });
    } catch (e) {
      this.setState({ error: e.message, loading: false });
    }
  }

  async _handleSkeyLogin(skey) {
    this.setState({ error: '', loading: true });

    try {
      await session.skeyLogin(skey);

      // Clear all existing sync data that might be there and enable sync
      process.nextTick(async () => {
        // await sync.resetLocalData();
        // await sync.doInitialSync();
      });

      this.setState({ step: 2, loading: false });
    } catch (e) {
      this.setState({ error: e.message, loading: false });
    }
  }

  show(options = {}) {
    const { title, message, skey } = options;
    this.setState({
      step: 1,
      error: '',
      loading: false,
      title,
      message,
      loggedIn: session.isLoggedIn(),
      sessionData: session.getSessionData()
    });
    this.modal.show();
    if (skey){
      this._handleSkeyLogin(skey)
    }
    // setTimeout(() => this._emailInput.focus(), 100); 有报错，暂时注释一下
  }

  hide() {
    this.modal.hide();
  }

  render() {
    const { step, title, message, loading, error, loggedIn, sessionData } = this.state;
    let inner;

    if (step === 1 && !loggedIn) {
      inner = [
        <ModalHeader key="header">
          <img className="logo" src="static/logo.svg"/>
          <span>apiplus</span>
        </ModalHeader>,
        <ModalBody key="body" className="pad">
          <h2 className="login_title">Login</h2>
          <p className="login_desc">One-Click Login With Google</p>
          <Link className="login_link" href={`https://apiplus.io/client_login?client_id=null&scheme=apiplus-desktop-${getAppTheme()}`}>
            <img className="google_icon" src="static/google.svg"/>
            <span>Login with Google</span>
          </Link>
          {isDevelopment() ? (
              <div key="emailInner">
                <form onSubmit={this._handleLogin}>
                {message ? <p className="notice info">{message}</p> : null}
                <div className="form-control form-control--outlined no-pad-top">
                  <i className="apiplus api-email" />
                  <input
                    type="email"
                    required="required"
                    placeholder="me@mydomain.com"
                    ref={this._setEmailInputRef}
                  />
                </div>
                <div className="form-control form-control--outlined">
                  <i className="apiplus api-password" />
                  <input
                    type="password"
                    required="required"
                    placeholder="•••••••••••••••••"
                    ref={this._setPasswordInputRef}
                  />
                </div>
                {error ? <div className="danger pad-top">** {error}</div> : null}
                <button className="submit_btn">Login</button>
                </form>
              </div>
          ) : null}
        </ModalBody>
      ];
    } else {
      inner = [
        <ModalHeader key="header" className="logined">
          <img className="logo" src="static/logo.svg"/>
          <span>apiplus</span>
        </ModalHeader>,
        <ModalBody key="body" className="pad no-pad-top logined">
          <div className="user_info_row">
            <img className="avatar circular" src={sessionData.avatar ? `${sessionData.avatar.url}?imageView2/5/w/64/h/64` : null} />
            {/*<p className="user_name">{session.getNickname()}</p>*/}
            <h3>
              {sessionData.email}
            </h3>
          </div>
          <div className="user_plan_box">
            <h2 className="plan_name">{sessionData.plan}</h2>
            <p>Your current plan is {sessionData.plan}, quota is {sessionData.quota}</p>
            { ["free", "trial"].includes(sessionData.plan) ? 
            <Link
            button
            href="https://apiplus.io/dashboard"
            className="subcribe_btn btn btn--clicky">
            Subcribe
            </Link> : null }
          </div>
          <div className="handle_box">
            <Link
            button
            href="https://apiplus.io/dashboard"
            className="btn btn--clicky">
            Manage Account
            </Link>
            <PromptButton
            className="margin-left-sm btn btn--clicky"
            onClick={this._handleLogout}>
            Sign Out
            </PromptButton>
          </div>
          {/*<Link
          button
          href="https://apiplus.io/dashboard"
          className="btn btn--clicky">
          Manage Account
        </Link>
        <PromptButton
          className="margin-left-sm btn btn--clicky"
          onClick={this._handleLogout}>
          Sign Out
        </PromptButton>*/}
          {/*<p className="logined_tip">Now you can share projects to your members or join in some projects</p>*/}
        </ModalBody>


      ];
    }

    return (
      <Modal className="login_modal" ref={this._setModalRef} {...this.props}>
        {inner}
      </Modal>
    );
  }
}

export default LoginModal;
