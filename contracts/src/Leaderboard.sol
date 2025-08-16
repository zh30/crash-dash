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


