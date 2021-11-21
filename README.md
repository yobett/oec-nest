OEC 现货交易助手（后端）

## 简介

这里是OEC现货交易助手的后端部分，采用NestJS开发，数据库为Mysql/MariaDB。前端部分见 https://github.com/yobett/oec-ng 。

系统功能介绍和界面截图，见前端 [Wiki](https://github.com/yobett/oec-ng/wiki)。

本系统的好处：

- 从统一界面或入口查看产品信息、实时价格
- 提供一个整合多平台的资产、订单数据视图
- 统一的下单界面，快速下单
- 配置策略，达到交易点即自动下单
- 把服务器部署在海外，随时随地访问，免翻墙（在大陆访问交易所需要翻墙）

本系统通过API来连接[CMC](https://coinmarketcap.com/)和各个交易所，用户需在这些平台上分别创建API，然后配置到本系统。目前支持三个交易所：币安、欧易和火币。

系统对API的使用如下：

- **CMC**：币种信息，币价和价格变更，币种排名
- **币安、欧易和火币**：公开的交易对信息、当前价格、K线数据；个人的资产、订单数据，下单

只要正确配置，系统的安全性可以放心：

- 用户自己部署系统，只配置一套API，系统中只有用户自己的数据
- 用户申请API时，只赋予查看和现货交易的权限，并绑定服务器IP
- 用户在客户端和服务器之间建立HTTPS连接，保护流量
- 下限价单时，如果买入价高于当前市价或卖出价低于当前市价，不予下单




## 部署和初始化

### 数据库

安装Mysql（或MariaDB）数据库，启动数据库实例。

创建应用数据库，例：

```sql
create schema oec charset utf8mb4 default collate utf8mb4_bin;
```

注意设置为`utf8mb4_bin`这个collate（区分大小写）。

创建数据库用户，例：

```sql
create user oecu@localhost identified by '.....';
grant all privileges on oec.* to 'oecu'@'localhost';
FLUSH PRIVILEGES;
```

数据库表会在应用启动时创建。

### 应用配置

`src/common/`下需要有个配置文件`config-local.ts`，可以从`data-sample/config-local.ts`拷进来，再做修改。

在`config-local.ts`文件中：

- 修改数据库配置
- 如果在墙内运行，需要有一个代理，并把`HttpRequestConfig.proxyEnabled`设为`true`（生产环境在墙外，则设为`false`）。可以通过ssh隧道创建一个socks代理：`ssh -ND localhost:1080 xxx@12.23.34.45`
- 配置服务器静态资源目录`STATIC_RES_DIR.BASE`
- 配置`ConfigLocal.JwtSecret`和`ConfigLocal.SiteSalt`，用于访问token加密和数据库密码加密。可以通过命令`npm run keys`生成随机字符串，再拷进去

`src/common/config.ts`中的配置，如有必要也可以修改。

### 应用启动

```shell
npm install
npm run build
npm run start:dev
```

应用初次启动后，会在数据库中建立相应的表。

### 数据库初始化

创建应用的用户，在应用目录下运行（替换”登录名“和”密码“）：

```shell
npm run console user create 登录名 密码
```

会在用户表创建一个用户。

创建交易所记录，运行：

```shell
npm run console exch init
```

将会创建几条交易所的记录（ba/oe/hb）。

### 部署前端

见前端项目。

### 配置交易所API（前端界面）

分别在CMC、各个交易所（如果有资产）申请API。

从前端界面登录，进入”系统/交易所API“菜单，把API配置进来。

### 同步币种、交易对数据

```shell
npm run console market-data init
```

此命令先从CMC同步前1000个币种，再从各交易所同步交易对。对于交易对中出现的新币种，会继续从CMC同步过来。

以上操作也可以在前端界面上完成。

### 同步个人数据（前端界面）

- 进入”资产（合并）“，同步资产，关注币种，关注交易对
- 进入”订单“，同步订单
- 进入”上次交易“，关注交易对
- 进入”市场/币种“，点”全部“，关注感兴趣的币种
- 进入”市场/交易对“，点”全部“，关注感兴趣的交易对
- 再次进入”订单“，同步火币（HB）的订单（火币的API，只能获取指定交易对的订单，因此要先关注交易对，再同步火币订单）

### 生产环境

启动：

```shell
npm run build
npm run start:prod
# 或
node dist/main
```

在生产服务器，一般会把node应用安装为服务。以下为**Systemd**系统服务的示例（文件`/etc/systemd/system/multi-user.target.wants/node-oec.service`）：

```ini
[Unit]
Description=OEC

[Service]
ExecStart=node /usr/node/oec/dist/main
Restart=always
RestartSec=1
User=oec
Group=oec
Environment=PATH=/usr/bin:/usr/local/bin
Environment=NODE_ENV=production
Environment=PORT=3000
WorkingDirectory=/usr/node/oec
SyslogIdentifier=node-oec
TZ=Asia/Shanghai

[Install]
WantedBy=multi-user.target
```

可以使用**Nginx**来提供前端资源，并作为后端应用的代理。Nginx的配置示例：

```nginx
location /oec/api/ {
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_pass http://11.22.33.44:3000;
    client_max_body_size 20M;
}

location /oec {
    root   /usr/node/html;
    index  index.html index.htm;
    try_files $uri /oec/index.html;
}

location / {
    root   /usr/node/html;
    index  index.html index.htm;
}
```



## License

MIT

