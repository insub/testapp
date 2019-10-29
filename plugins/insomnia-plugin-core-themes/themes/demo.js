module.exports = {
  name: 'Demo',
  displayName: 'Demo',
  theme: {
    foreground: {
      default: '#353535'
    },
    background: {
      default: '#FFF',
      success: '#87ee59',
      notice: '#f8d245',
      warning: '#f9ac2a',
      danger: '#ff505c',
      surprise: '#f24aff',
      info: '#23dce8'
    },
    rawCss: `
      .tooltip, .dropdown__menu {
        opacity: 1;
      }
    `,
    styles: {
      dialog: {
        background: {
          default: '#FFF'
        }
      },
      transparentOverlay: {
        background: {
          default: 'rgba(0, 0, 0, 0.5)'
        }
      },
      sidebar: {
        highlight: {
          default: '#aaa'
        },
        background: {
          default: '#F3F3F3'
        }
      },
      paneHeader: {
        background: {
          default: 'transparent',
          success: '#6ac04b',
          notice: '#ebc742',
          warning: '#ea9f29',
          danger: '#df4b56',
          surprise: '#ed46f9',
          info: '#20bec9'
        }
      }
    }
  }
};
