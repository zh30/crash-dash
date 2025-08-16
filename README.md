# Crash Dash (韭菜别跑)

## 项目概述
Crash Dash 是一款运行在 Monad 测试网与 Farcaster Mini App 环境中的完全去中心化小游戏。玩家在固定 20 秒的模拟行情里把握“买入→卖出”的时机，目标是尽可能接近全程的峰值价；游戏结束后可将成绩上链，排行榜在前端聚合生成。

- **链上合约最小化**：仅记录地址的历史最佳分数并广播事件，Gas 成本低。
- **链下前端负责聚合**：依据链上事件聚合排行，灵活扩展、零后端依赖。
- **移动优先深色 UI**：K 线模拟、卖出标线与高亮分数，适配手机屏幕。
- **Farcaster 集成**：即开即用的 Frame 体验（`@farcaster/frame-sdk`）。

## 玩法与规则
- 局时固定 20 秒，步长 500ms/根 K 线。
- 点击“开始”后生成行情曲线（确定性波形叠加小趋势，非纯随机）。
- 任意时刻可“卖出”一次，仅记录卖出价；仍需跑满 20 秒再结算。
- 结算价：若已卖则取卖出价，否则取最后一刻价格。
- **分数**：分数 = 峰值价 − 结算价（越小越好）。
- 展示统一三位小数；上链以 `SCORE_SCALE = 1000` 放大为整数。

## 架构与技术栈
- 前端：React 18、Vite、TypeScript、Tailwind CSS（深色、移动优先）
- Web3：wagmi 2.x、viem 2.x、Farcaster Frame Connector
- 合约：Solidity 0.8.20（Foundry）
- 部署：Cloudflare Pages（前端）

## 合约设计（Leaderboard.sol）
文件：`contracts/src/Leaderboard.sol`

- 存储：`mapping(address => uint256) public bestScores;`（分数越小越好）
- 事件：`event ScoreSubmitted(address indexed player, uint256 score);`
- 方法：`function submitScore(uint256 newScore)`
  - 总是触发事件；当 `newScore` 优于历史最佳时更新 `bestScores[msg.sender]`。
- 计分缩放：前端以 `SCORE_SCALE = 1000` 将分数放大为整数提交；读取展示时再除以 1000 保留三位小数。

说明：合约不内置排行榜（保持 Gas 更低、逻辑更简），排行由前端通过事件聚合完成。

## 前端实现要点
- K 线渲染：
  - SVG 蜡烛图、5 等分网格、三位小数坐标标注。
  - 蜡烛更粗、节奏舒适；卖出后绘制橙色横线并标注“s”。
- 状态与计分：
  - 局时 20s、步长 500ms，卖出仅记录价格，满时结算。
  - 分数 = 峰值价 − 结算价；展示三位小数；上链按千倍整数。
- 排行榜：
  - 使用 `publicClient.getContractEvents` 拉取 `ScoreSubmitted` 事件，在前端按地址聚合最优分并排序。
  - 分数显示三位小数（链上整数/1000）。
- 交互体验：
  - Tailwind 深色移动端 UI，按钮状态/分割线/渐变卡片。
  - 提交分数后自动切换到排行榜视图并刷新。

## 本地运行
```bash
pnpm install
pnpm dev
```

在浏览器控制台设置合约地址（或在代码中写死）：
```js
window.__LEADERBOARD_ADDRESS__ = '0xYourContractAddress';
```

## 合约编译与部署（Foundry）
准备：`MONAD_RPC_URL`、`PRIVATE_KEY`（测试网私钥，需少量测试币）

```bash
# 安装 Foundry（如未安装）
curl -L https://foundry.paradigm.xyz | bash
source ~/.zshenv && foundryup

# 编译
cd contracts
forge build

# 部署
forge create src/Leaderboard.sol:Leaderboard \
  --rpc-url $MONAD_RPC_URL \
  --private-key $PRIVATE_KEY
```

记录部署地址，并在前端以 `window.__LEADERBOARD_ADDRESS__` 注入。

## 前端部署（Cloudflare Pages）
- 推送仓库至 GitHub，Pages 选择 Vite 预设。
- 需要时可在构建/运行时注入合约地址。
- 获取公开 URL，生成 Warpcast 分享链接进行传播测试。

## 安全性与公平性
- 行情曲线为确定性波形叠加，避免纯随机造成体验不一致。
- 合约仅存“最佳分数”与事件，降低攻击面与 Gas 成本。
- 可选增强（未来项）：
  - 客户端局数据哈希签名或 commit-reveal 流程以增强可验证性。
  - 基于索引器/TheGraph 的排行榜与分页拉取。

## 已知限制
- 排行榜完全基于事件聚合，海量历史时需做分页/筛选优化。
- 计分验证不在链上完成，属于“轻信任”模型，适合轻量娱乐场景。

## 路线图（Hackathon 之后）
- 我的历史记录/本次成绩高亮与动效
- 前三名奖杯/彩带、数字滚动动画
- 周榜/月榜窗口筛选
- 多网络/多 Frame 入口

## 许可证
MIT（见根目录 `LICENSE`）
