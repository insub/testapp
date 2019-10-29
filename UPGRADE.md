# 修改历史

基于 insomnia 6.0.3.beta.1 修改
核心是改变了同步和登录策略，去除端对端加密

## 安装开发环境 / Windows 开发环境解决

npm 会使用 rails 的 git ，不知道是为什么，而 rails 的 git 是 1.9 版本的，因此做个软链接到更高版本的 Git 上去
mklink /d /j "D:\RailsInstaller\Git" "D:\Program Files\Git"
跟这个好像又没关系

<!-- 这部分不需要了，设置好 npm msvs_version 和 debug = true 后直接 npm install 就可以 -->
0.  根目录 npm install
1.  需要安装 windows 的 node build 工具环境 / 或者 msvs
1.  在 packages/insomnia-app 执行：
    删除 package-lock.json
    npm install
    在 packages/insomnia-libcurl 下执行安装 insomnia-node-libcurl，否则会影响 insomnia-app 的package.js
    - 先删除 D:\Sites\apiplus\packages\insomnia-libcurl\node_modules\insomnia-node-libcurl，否则会报找不到 insomnia-libcurl@0.0.30
    - 执行手动安装
      npm install insomnia-node-libcurl --build-from-source --runtime=electron --target=3.1.13 --dist-url=https://npm.taobao.org/mirrors/atom-shell --debug=true --arch=x64 --msvs_version=2015 --save
      注意，node-gpy 不支持 msvs_version=2017， 如果不是 msvs 环境，就不要 msvs
      npm install insomnia-node-libcurl --build-from-source --runtime=electron --target=3.1.13 --dist-url=https://npm.taobao.org/mirrors/atom-shell --debug=true --arch=x64 --save
      （使用终端代理大概15分钟左右，130K下载速度）
      可以把 D:\Sites\apiplus\packages\insomnia-app\node_modules\insomnia-node-libcurl\lib 下面的  binding 复制到 Sites 放好，以后直接每回 npm install 完之后复制一下就好了
      然后
1.  再在 packages/insomnia-libcurl 下执行： npm install (或许还要在 packages/insomnia-app 下面执行 npm install)
1.  然后把 package/apiplus-app/package.json 里面的 bootstrap 临时改成空命令
1.  然后运行 npm run bootstrap 和 npm run app-start 应该可以跑起来了
1.  不要用 cnpm
1.  npm 取消淘宝源，insomnia 系列的包好像都返回 405
1.  不要用 npm i ，要用 npm install 否则好像依赖会有问题

或者在 windows 工作机上把 node_modules\insomnia-node-libcurl\lib\binding 备份下来，每回 npm install 完之后复制一下就好了

装 insomnia-node-libcurl 的时候用淘宝源，装其他的用官方源，否则会找不到 insomnia-importers
npm config set registry https://registry.npm.taobao.org
npm config set registry https://registry.npmjs.org/
npm config set disturl https://npm.taobao.org/dist --global # 加全局好像没有用
npm config get registry
npm config get disturl

1. !!! 装完任何包之后要到根目录下执行 npm run bootstrap


经常会因为网络的问题出现莫名其妙的问题，还是用淘宝源的比较好，但不要用 cnpm 命令，直接改 npm 的源就可以了
找不到 insomnia 相关库的时候需要指定为 npmjs 的源： npm install insomnia-plugin-now --registry=https://registry.npmjs.org/
反正就是。。。。麻痹的多试几次，很可能是网络问题

具体可以看有道里面 electron 技术相关 里有关 node-gyp 及 libcurl.node 部分，详细解决办法

关于 plugins
注意，必须执行 lerna bootstrap (在根目录下执行 npm run bootstrap，而 packages.json 里面的 bootstrap 包括有 lerna bootstrap 命令)
否则修改根目录下的 plugins 是无效的，执行后，packages/insomnia-app/node_modules 里面的相关的包会变成链接而不是直接从 npm 安装，这时候修改根目录下的 plugins 才能生效

## webpack

webpack 的修改必须重启

## redux / 本地数据库 / 以及服务端数据库

Electron APP 的 userData 位置：
Mac OS: ~/Library/Application Support/<Your App Name (taken from the name property in package.json)>
Windows: C:\Users\<you>\AppData\Local\<Your App Name> / C:\Users\insub\AppData\Local\insomnia
Linux: ~/.config/<Your App Name>

Nedb 数据库位置 / userData 位置 / 开发时是  apiplus-app-.dev / 正式安装是 apiplus-app-.dark
C:\Users\insub\AppData\Roaming\apiplus-app\insomnia.Request.db 就是文件格式的数据库

0_id, type, parentId, modified, created 这几个是所有 nedb 数据都会自动带上的，不在 models 里面定义
如果文档不包含\_id 字段，NeDB 会自动生成一个
Nedb 数据库是 inMemoryOnly = true , autoload = true 的

定时检查通知： app\ui\components\toast.js -> componentDidMount
定时检查更新： app\main\updates.js -> setInterval
定时合并数据库中的重复数据： 搜索 DB_PERSIST_INTERVAL，使用的是 nedb 自带的 setAutocompactionInterval 方法
app\common\database.js -> setAutocompactionInterval
app\sync\storage.js -> setAutocompactionInterval
为了性能考虑，NeDB 存储使用 append-only 格式，意味着所有的更改和删除操作其实都是被添加到了文件末尾。
response 的重复字段是 parentId / requestVersionId，因为这这涉及到历史记录？ response 的重复数据是如何处理的呢？只是简单的保存 20 个？
http://www.alloyteam.com/2016/03/node-embedded-database-nedb/

app\sync\storage.js 是一个挺关键的文件

## 调试

日志有主进程日志和渲染进程日志两种
主进程日志在终端中查看，生产环境可以拖放到 cmd 中打开程序来查看
渲染进程日志在 devtools 中查看，生产环境可以用快捷键 Ctrl+shift+alt+o 来查看

console.log() 的时候注意，有可能是在终端上打出来（主进程）而不是在 APP 里的 Console 打出来，取决于代码的执行环境
搜索的时候 可以 -main.min.js, -.db -yarn-standalone.js, -bundle.js, -package-lock.json, -yarn.lock, -main.min.js, -yarn-standalone.js, -*/__tests__/*
这也就意味着可以搜索数据库内容

开启 react 及 redux 调试
在 insomnia-app 里面 cnpm i electron-devtools-installer ，然后在 app/main.development.js 里面配置
如果 console 里面没有出来，那么，等。 然后再打开再试，多试几次
https://github.com/getinsomnia/insomnia/pull/327/files#diff-4fa54749a138460ad8f3583b662fafea
windows 上还会有 7zip-lite 的问题：
https://github.com/MarshallOfSound/electron-devtools-installer/issues/55
https://github.com/MarshallOfSound/electron-devtools-installer/issues/69
不过貌似装好一次了之后就不需要了

## 数据分析 / Google 分析

数据分析是如何做的呢？ constants 里面的 GA_ID 根本没用上
https://github.com/getinsomnia/insomnia/commit/7adf8591c1836939fb14586e531d5492f4ae493a#diff-32607347f8126e6534ebc7ebaec4853d
数据分析估计是改为服务端做数据分析了
那么我们也可以用 nginx 来解决分析的问题，比如说打开，访问更新等等，只是要注意：
=. 性能不要受影响
=. 网站分析，应用请求分析，一些定时的更新分析，还有就是两个不同的域（网站和 API 请求和文档）等，不要乱，又要有连续性
https://eason-yang.com/2016/11/04/google-analytics-via-nginx/
https://blog.huguotao.com/post/google-analytics-with-nginx

## 热更新

搜索常量 CHECK_FOR_UPDATES_INTERVAL
app/main/updates.js autoUpdater 是 electron 自带的方法
但是涉及到版本发布的问题+版本检查然后下载的话，貌似比较复杂，可以考虑改为只检查版本号，然后点击查看下载链接，而不是使用 electron 的热更新
https://segmentfault.com/a/1190000007616641
还有一种是基于版本管理系统（这也就意味着可能还需要处理发布版本主分支之类的种种问题），只下载需要更新的文件，目前不清楚 insomnia 是用的那一种：
https://www.zhangxinxu.com/wordpress/2017/06/how-electron-online-update-hot-fix/

## 数据同步

Charles 是启动了就开始抓取的，不需要配置什么，也许要关闭 VPN，或者改为全局，尝试多启动几次，尝试重新启动 APP，尝试关闭火绒
可以找到关键代码，打 console
也许有的不是浏览器发出的命令，那么可以用 charles 去拦截，要注意有没有偷偷摸摸的请求发出去
大部分情况看 console 发出的请求就可以了

app/sync
核心的同步代码，登录也在里面，貌似数据改变之后也会触发里面的 dirty
pull() & push() 是关键代码
从 WHITE_LIST 看，response 是不做同步的
push 之前会用 encryptDoc 函数加密

app\sync\storage.js 是一个挺关键的文件
同步是需要数据库的，dirty 写在这里面，是数据库的子文件夹
C:\Users\insub\AppData\Roaming\apiplus-app\sync\Resource.db
C:\Users\insub\AppData\Roaming\apiplus-app\sync\Config.db

改为手动之后貌似也不管用，还是会定时 pull（有可能就是这么设计的，手动只是说，手动上传）
pull 的时间是 PULL_PERIOD 15e3 / 5
For example 30000 became 3e4 and 15000 became 15e3

这些 ID 为何对不上？ rsgr_59fae7f3bbaa418082895ac2407a5682 同步时这些 ID 是哪里来的？
util.generateId('scf')

version 版本号是怎么生成的？

sync/index.js 里面的 db.onChange 和 pendingDBChanges 是判断是否需要同步的关键函数
在那判断是否要开始 push 的？手动还是自动

## 当修改了一个数据后的执行流程

## 当 pull 了一个新的数据的时候的执行流程

## 打包发布
  需要熟悉 lerna 
 "app-build": "lerna run build --stream --scope=apiplus-app", 跟这个 scope 可能有关系，也许这样就能分开同时启动两个APP