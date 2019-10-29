import 'whatwg-fetch';
import { parse as urlParse } from 'url';
import { getClientString, isDevelopment, HOST } from './constants';
import * as session from '../sync/session';
import * as zlib from 'zlib';
import axios from 'axios';
import { toast as itoast } from 'react-toastify';

let commandListeners = [];

export function onCommand(callback) {
  commandListeners.push(callback);
}

export function offCommand(callback) {
  commandListeners = commandListeners.filter(l => l !== callback);
}

export function post(path, obj) {
  return _fetch('POST', path, obj);
}

export function get(path, authToken = null) {
  return _fetch('GET', path, null, authToken);
}

export function del(path, authToken = null) {
  return _fetch('DELETE', path, null, authToken);
}

export function put(path, obj) {
  return _fetch('PUT', path, obj);
}

export function rawFetch(...args) {
  return window.fetch(...args);
}

async function _fetch_bak(method, path, obj, authToken = null) {
  const config = {
    method: method,
    headers: new window.Headers()
  };

  // Set some client information
  config.headers.set('X-Apiplus-Client', getClientString());

  if (obj) {
    // config.body = zlib.gzipSync(JSON.stringify(obj));
    config.body = JSON.stringify(obj);
    config.headers.set('Content-Type', 'application/json');
    config.headers.set('Content-Encoding', 'gzip');
  }

  authToken = authToken || session.getCurrentAuthToken();
  if (authToken) {
    config.headers.set('X-Token', authToken);
  }

  const response = await window.fetch(_getUrl(path), config);
  const uri = response.headers.get('x-apiplus-command');
  uri && _notifyCommandListeners(uri);

  if (!response.ok) {
    const err = new Error(`Response ${response.status} for ${path}`);
    err.message = await response.text();
    err.statusCode = response.status;
    throw err;
  }

  if (
    response.headers.get('Content-Type').includes('application/json') ||
    path.match(/\.json$/)
  ) {
    return response.json();
  } else {
    return response.text();
  }
}

async function _fetch(method, path, obj, authToken = null) {
  axios.defaults.headers.common['Accept'] = 'application/json'
  const config = {
    method: method,
    url: _getUrl(path)
  };

  axios.defaults.headers.common['X-Apiplus-Client'] = getClientString()

  // Set some client information
  if (obj) {
    // config.data = zlib.gzipSync(JSON.stringify(obj));
    config.data = JSON.stringify(obj);
    axios.defaults.headers.common['content-type'] = 'application/json'
    axios.defaults.headers.common['content-encoding'] = 'gzip'
    // console.warn("objobjobjobjobjobjobjobjobjobjobjobjobjobjobjobjobj", obj)
  }

  authToken = authToken || session.getCurrentAuthToken();
  if (authToken) {
    axios.defaults.headers.common['X-Token'] = authToken
  }

  // response 会同时在控制台抛出错误
  const response = await axios.request(config).catch(function (error) {
    console.log(error);
    if (error.response) {
      if (error.response.status === 401){
        itoast.error("<= 401: Please login again.", {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true
        });
        if (session.isLoggedIn){
          session.logout()
        }
      }
      const err = new Error(`Response ${error.response.status} for ${path}`);
      err.message = error.response.status + " Error!";
      err.statusCode = error.response.status;
      throw err;
    } else {
      const err = new Error(`Response error for ${path}`);
      err.message = "Error...";
      throw err;
    }
  })

  const uri = response.headers["x-apiplus-command"];
  uri && _notifyCommandListeners(uri);

  if (response.data && !response.data.success){
    const err = new Error(`Response 200 for ${path} but success is false`);
    err.message = "Response 200, But: " + response.data.msg;
    err.statusCode = 200;
    throw err;
  }

  return response.data.data
}

function _getUrl(path) {
  const baseUrl = `${HOST}/api/v1`;
  return `${baseUrl}${path}`;
}

function _notifyCommandListeners(uri) {
  const parsed = urlParse(uri, true);

  const command = `${parsed.hostname}${parsed.pathname}`;
  const args = JSON.parse(JSON.stringify(parsed.query));

  commandListeners.map(fn => fn(command, args));
}
