// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Leaderboard {
    // 记录每个玩家的最好成绩（分数越小越好）
    mapping(address => uint256) public bestScores;

    // 维护全局最低分前20名（按每个玩家的最好成绩去重）
    // 为了节省gas与简化逻辑，这里内部不强制保持有序，只在读取时排序
    address[] private topPlayers; // 最多20个
    mapping(address => uint256) private indexInTop; // 1-based，0表示不在榜单中
    uint256 public constant MAX_TOP = 20;

    // 每次提交成绩时触发的事件
    event ScoreSubmitted(address indexed player, uint256 score);

    // 提交分数
    function submitScore(uint256 newScore) public {
        address player = msg.sender;
        uint256 currentBest = bestScores[player];

        if (currentBest == 0 || newScore < currentBest) {
            bestScores[player] = newScore;
            _maybeUpdateTop20(player, newScore);
        }

        emit ScoreSubmitted(player, newScore);
    }

    // 返回最低的前20个（或不足20个时全部），按分数从小到大
    function getLowest20() external view returns (address[] memory players, uint256[] memory scores) {
        uint256 len = topPlayers.length;
        players = new address[](len);
        scores = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            address p = topPlayers[i];
            players[i] = p;
            scores[i] = bestScores[p];
        }

        // 选择排序，按分数从小到大（len<=20，gas可接受）
        for (uint256 i = 0; i < len; i++) {
            uint256 minIndex = i;
            for (uint256 j = i + 1; j < len; j++) {
                if (scores[j] < scores[minIndex]) {
                    minIndex = j;
                }
            }
            if (minIndex != i) {
                // 交换 players 与 scores 的位置
                address tp = players[i];
                players[i] = players[minIndex];
                players[minIndex] = tp;

                uint256 ts = scores[i];
                scores[i] = scores[minIndex];
                scores[minIndex] = ts;
            }
        }
    }

    // 内部维护 top 20 的集合（不保证内部顺序），仅在用户最好成绩被提升时调用
    function _maybeUpdateTop20(address player, uint256 newBest) internal {
        uint256 idx = indexInTop[player];
        if (idx != 0) {
            // 已经在榜单里，因为只有变好才会更新，所以无需移除，只需在读取时排序
            return;
        }

        uint256 len = topPlayers.length;
        if (len < MAX_TOP) {
            topPlayers.push(player);
            indexInTop[player] = len + 1; // 1-based
            return;
        }

        // 榜单已满，找到当前最差（分数最大）的项
        uint256 worstIndex = 0;
        uint256 worstScore = 0;
        for (uint256 i = 0; i < len; i++) {
            address p = topPlayers[i];
            uint256 s = bestScores[p];
            if (s > worstScore) {
                worstScore = s;
                worstIndex = i;
            }
        }

        // 如果新成绩比当前最差还好，则替换
        if (newBest < worstScore) {
            address replaced = topPlayers[worstIndex];
            indexInTop[replaced] = 0;
            topPlayers[worstIndex] = player;
            indexInTop[player] = worstIndex + 1; // 1-based
        }
    }
}


