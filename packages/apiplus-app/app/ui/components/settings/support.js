import React, { PureComponent } from 'react';
import Link from '../base/link';
import {
  CHANGELOG_BASE_URL,
  getAppVersion,
  isMac
} from '../../../common/constants';

class Support extends PureComponent {
  render() {
    return (
      <div className="support_panel">
        <h3>Support</h3>
        <p className="email">Current version v{getAppVersion()}</p>
        <small>If you encounter problems with the software, please talk to us.</small>
         <Link
          button
          className="apiplusbtn submit"
          href={`https://app.chaport.com/widget/show.html?appid=5c7d549096553c1ae0cfdfcd`}>
          Talk Now
        </Link>
      </div>
    );
  }
}

export default Support;
