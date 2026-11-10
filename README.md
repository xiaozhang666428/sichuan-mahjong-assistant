# 四川麻将智能助手

独立、适合安卓手机的静态 PWA：手牌分析、向听与听牌、已见牌计数、舍牌建议、换三张、定缺和单人摸打。全部运行在浏览器，本机保存手牌，无账号、无外部脚本或统计，不连接、不读取、不自动操作腾讯微乐。

**本仓库提供可部署代码；仓库存在或配置完成不代表 Cloudflare 已上线。** 只有 Cloudflare 部署实际成功，才能拿其返回的 HTTPS 地址作为安装入口。

## 快速开始

需要 Node.js 22 或更高版本。没有第三方运行或测试依赖，不需要安装包。

```sh
node --test
node scripts/check.mjs
node scripts/serve.mjs
```

电脑打开 `http://localhost:4173`。不要双击 HTML：ES modules、Worker 和离线缓存需要 HTTP／HTTPS。预览服务器仅监听本机，不提供手机远程访问；安卓使用部署后的 HTTPS 地址。

## 功能与规则边界

- 万／筒／条 27 种，每种四张，共 108 张；没有字牌。
- 输入 13 或 14 张完整暗手牌；不支持有碰杠副露的短手牌。不把顺子跨花色连接。
- 普通胡为四组面子加一对将；七对允许未开杠的四张同牌计为两对（龙七对）。胡牌最多两门，选定缺门后必须清完该门。
- 向听为到合法 14 张胡牌目标的最少补牌数减一：−1 胡牌、0 听牌、1 一向听。按花色动态规划最大化与合法目标的交集，目标限制每种最多四张，包含清缺门成本。不套用忽略缺门的普通向听公式。
- 胡牌校验另用递归面子拆分；听牌逐张枚举 27 种牌并校验，不会报需要第五张同牌的假听。
- 已见牌仅填手牌以外的牌。余张数为 `4 − 手牌数 − 已见数`，是未见牌上限，不是实际牌墙数。耗尽的合法听牌仍展示，标明“已见尽”。向听是牌型距离，不按可见耗尽牌重新计算。
- 14 张舍牌建议先强制打缺，再按向听升序、剩余进张总数降序排序；已打出的一张也计入已见牌。不计算番数、胜率或对手策略。
- 换三张从完整 108 张牌墙发四手各 13 张，每手同时换出同一花色三张，按所选方向传递，严格保持牌张守恒。推荐换牌为“张数最少且至少三张的一门中，优先散张”的启发式，不承诺最优。
- 定缺后单人摸打，牌墙从 56 张开始，其他三手共 39 张保持隐藏且不再摸打。建议仅使用自己的手牌和弃牌，不读取隐藏手牌或牌墙。自摸胡牌或摸尽结束。
- 本版不模拟四人血战到底、碰杠、番数结算，也不产生 APK。

## Cloudflare Pages 部署

### 唯一需要手动完成的账号授权

在 [Cloudflare 控制台](https://dash.cloudflare.com/) 登录你的账号，在 **Workers & Pages → Create application → Pages → Import an existing Git repository／Connect to Git** 中授权 **Cloudflare Workers & Pages GitHub App**。选择 **Only select repositories**，仅允许本项目仓库。此授权与 ChatGPT／Codex 的 GitHub 授权是两套独立授权；已经连接 GitHub 不代表已经连接 Cloudflare。

授权后选中本项目并填写：

| 配置 | 值 |
| --- | --- |
| 项目名 | `sichuan-mahjong-assistant`（若已占用，使用可用名称） |
| Framework preset | `None` |
| Production branch | `main` |
| Root directory | 仓库根目录，留空 |
| Build command | `exit 0` |
| Build output directory | `public` |
| 环境变量／数据库 | 不需要 |

点击 **Save and Deploy**，等待部署成功。使用控制台**实际返回**的 `https://…pages.dev` 地址，不假定项目名一定对应某个可用域名。后续推送由 Pages Git 集成自动部署。生产站点将公开访问，手牌仍只保存在访客自己的浏览器。

仓库中的 `wrangler.toml` 已设置 `pages_build_output_dir = "./public"`，不包含令牌或账号 ID。已安装 Wrangler 并自行登录的开发者也可运行：

```sh
npx wrangler login
npx wrangler pages project create sichuan-mahjong-assistant --production-branch main
npx wrangler pages deploy public --project-name sichuan-mahjong-assistant --branch main
```

已有 Pages 项目时跳过创建。CLI 直接上传并不会自动建立 Git 集成；长期自动部署请优先使用上述控制台 Git 方式。本项目不要求用户把密码或 API token 发到聊天。

官方依据：[静态 HTML 部署](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/)、[GitHub 集成与授权范围](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)、[Wrangler Pages 配置](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)。

## 安卓安装与上线验收

1. 用安卓 Chrome 联网打开真实 Pages HTTPS 地址，确认手牌分析和练习能运行。
2. 等待顶部显示“离线已就绪”；菜单选择“安装应用／添加到主屏幕”。部分 Chrome 版本也会显示页面安装按钮。
3. 完成一次换三张 → 定缺 → 摸牌 → 出牌。试打非缺门牌，确认仍有缺门时被阻止。
4. 载入示例，应显示 0 向听，听二筒、三筒。再加入二筒，应显示 −1、已经胡牌。
5. 切断网络，完全关闭后从桌面重开，确认能分析、发新局和摸打。首次从未联网访问的设备无法离线安装。
6. 版本更新后会显示更新按钮，点击才替换离线版本。发布任何静态文件更改时必须同步递增 `public/sw.js` 中的缓存版本，确保整套资源一起更新。

自动测试覆盖算法、模拟流程、分析 Worker 消息和离线缓存逻辑；Node 测试和资源检查不替代真实安卓 Chrome 的布局、安装及断网冷启动验证。未完成以上真机验收前，不宣称安卓安装已验证。

## 文件

`public/` 是完整部署目录，可原样托管；`engine.js` 计算规则，`simulator.js` 处理单人流程，分析放在模块 Worker 中以保持界面响应。`test/` 是无依赖 Node 测试；`scripts/check.mjs` 检查 UI 引用、静态资源、manifest、PNG 和语法；`scripts/generate-icons.mjs` 可复现生成本地图标。
