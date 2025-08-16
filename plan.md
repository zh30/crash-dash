# Crash Dash (韭菜别跑) - 开发计划表 (完全去中心化版)

本计划为一个下午的黑客松设计，旨在利用 React、wagmi 和智能合约，构建一个主题为 "Crash Dash" 的完全去中心化的 Farcaster Mini App。

**核心技术栈：**

  * **前端框架：** React (使用 Vite 进行构建)
  * **Web3 连接：** `wagmi` (现代化的 React Hooks for Ethereum)
  * **智能合约：** Solidity
  * **部署：** Cloudflare Pages

-----

### **第一阶段：项目初始化与环境配置 (预计 20 分钟)**

1.  **创建 Vite + React 项目：**
    ```bash
    pnpm create @farcaster/mini-app
    ```
2.  **智能合约环境：**
      * 在项目根目录创建 `contracts` 文件夹。
      * 确保 [Foundry](https://book.getfoundry.sh/getting-started/installation) 已安装好。

-----

### **第二阶段：智能合约开发 (超轻量级版) (预计 45 分钟)**

**核心思路：** 合约本身**不存储**排行榜列表，只负责记录个人最好成绩和广播事件。这能让用户的交易手续费 (Gas Fee) 降到最低。对于 "Crash Dash" 玩法，**分数 = 峰值价格 - 卖出时价格**。分数越接近 0 代表操作越完美，完全契合现有合约逻辑。

1.  **合约设计 (`contracts/Leaderboard.sol`)：** 
    ```solidity
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.20;

    contract Leaderboard {
        // 记录每个玩家的最好成绩（分数越小越好）
        mapping(address => uint256) public bestScores;

        // 每次提交成绩时触发的事件
        event ScoreSubmitted(address indexed player, uint256 score);

        // 提交分数
        function submitScore(uint256 newScore) public {
            address player = msg.sender;
            uint256 currentBest = bestScores[player];

            if (currentBest == 0 || newScore < currentBest) {
                bestScores[player] = newScore;
            }
            
            emit ScoreSubmitted(player, newScore);
        }
    }
    ```
2.  **编译与部署：**
      * 使用 Foundry 编译和部署合约到 Monad 测试网。
3.  **关键成果：**
      * 记录下部署后的 **合约地址**。
      * 将编译生成的 **合约 ABI** 保存到 `src/abi/Leaderboard.json`。

-----

### **第三阶段：React 前端开发 (含 Crash Dash 逻辑) (预计 150 分钟)**

#### **核心玩法详解**

在进入具体的技术实现前，明确核心玩法的设计：

  * **创意玩法 (Creative Gameplay):** 屏幕上有一个数字（模拟代币价格）从 1 开始快速上涨，但会在一个随机的时间点瞬间“闪崩”归零。玩家的目标是在它崩盘前的最高点附近，按下“卖出”按钮。
  * **计分方式 (Scoring Mechanic):** 分数 = `峰值价格 - 你的卖出价格`。例如，价格最高涨到 100，而你在价格为 95 时成功卖出，你的分数就是 5。分数越接近 0 越好。若未及时卖出导致价格归零，则会得到一个极大的惩罚分数。
  * **为何有趣 (Why it's Fun):**
      * **模拟炒币：** 完美契合 Crypto 用户的日常，充满戏剧性和紧张感。
      * **风险与回报：** 贪心等待更高点可能会让你血本无归，非常刺激。
      * **视觉效果好：** 一个跳动的数字或简单的 K 线图就能营造出很好的氛围。

#### **技术实现步骤**

1.  **配置 `wagmi` 和 Farcaster Meta 标签。**

2.  **开发核心游戏组件 (`Game.jsx`, `ConnectButton.jsx`, `SubmitScoreButton.jsx`)。**

      * **游戏核心逻辑 (`Game.jsx`):**
          * **状态管理 (`useState`):**
              * `gameState`: 用于管理游戏状态，如 `'ready'`, `'rising'`, `'crashed'`, `'ended'`。
              * `price`: 当前不断上涨的价格。
              * `peakPrice`: 记录价格上涨过程中的最高点。
              * `finalScore`: 游戏结束后计算出的最终得分。
          * **游戏循环 (`useEffect`):**
              * 使用 `setInterval` 来模拟价格不断上涨。在 `rising` 状态下，每隔一小段时间（如 100ms）就增加 `price`。
              * 在 `setInterval` 的每一次回调中，设置一个较小的随机概率（例如 1%）来触发“闪崩”，将 `gameState` 切换为 `'crashed'`。
          * **玩家交互：**
              * 提供一个 "卖出 (Sell)" 按钮。
              * 当玩家点击按钮时，清除 `setInterval`，停止价格上涨。
              * 计算得分：`score = peakPrice - price`。
              * 将 `gameState` 切换为 `'ended'`，并显示分数。
      * **提交分数 (`SubmitScoreButton.jsx`):**
          * 游戏结束后，该按钮变为可点击状态。
          * 使用 `wagmi` 的 `useWriteContract` hook，将 `finalScore` 作为参数调用智能合约的 `submitScore` 方法。

3.  **开发排行榜组件 (`Leaderboard.jsx`)：**

      * 此部分逻辑**完全不变**。
      * 使用 `wagmi` 的 `usePublicClient` hook 获取 `viem` 客户端实例。
      * 在 `useEffect` 中，调用 `publicClient.getContractEvents` 获取所有 `ScoreSubmitted` 事件。
      * 在客户端对事件数据进行处理：去重（取每个玩家最好成绩）、排序。
      * 将排序后的结果用 `useState` 存起来并渲染到页面上。

-----

### **第四阶段：部署与分享 (Cloudflare 版) (预计 20 分钟)**

1.  **部署到 Cloudflare Pages：**
      * 将代码推送到 GitHub 仓库。
      * 在 Cloudflare Pages 中连接该仓库。
      * **构建设置：** 框架预设选择 `Vite`，Cloudflare 将自动处理构建。
2.  **分享与测试：**
      * 获取部署后的 `https://crashdash.zhanghe.dev` 公开 URL。
      * 构造 Warpcast 分享链接 `https://warpcast.com/~/compose?text=...&embeds[]=[Your_App_URL]`。
      * 发布到 Farcaster 进行最终测试。