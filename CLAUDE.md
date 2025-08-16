# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Crash Dash (韭菜别跑) is a decentralized Farcaster Mini App that simulates cryptocurrency trading gameplay. Players try to sell a token at the peak price before it crashes to zero. Built with React, TypeScript, Vite, and Web3 technologies.

## Development Commands

- `pnpm dev` - Start development server
- `pnpm build` - Build for production (includes TypeScript compilation)
- `pnpm lint` - Run Biome linter on src directory
- `pnpm preview` - Preview production build

## Architecture & Stack

### Core Technologies
- **Frontend**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 5.4.19
- **Web3**: Wagmi with Viem for blockchain interactions
- **Farcaster Integration**: Frame SDK and Frame Wagmi Connector
- **State Management**: TanStack React Query for server state
- **Code Quality**: Biome for linting and formatting

### Key Configuration Files
- `src/wagmi.ts` - Wagmi configuration with Base and Mainnet chains
- `vite.config.ts` - Vite setup with React plugin and allowed hosts
- `biome.json` - Code formatting (120 char lines, space indentation) and linting rules
- `tsconfig.json` - Strict TypeScript configuration with ES2020 target

### Project Structure
```
src/
├── App.tsx          # Main app component with wallet connection logic
├── wagmi.ts         # Web3 configuration using Farcaster Frame connector
├── main.tsx         # React entry point
├── index.css        # Global styles
└── vite-env.d.ts    # Vite environment types
```

## Farcaster Frame Integration

The app is designed as a Farcaster Frame Mini App with:
- Frame SDK initialization in `App.tsx:7`
- Farcaster Frame connector for wallet authentication
- Support for Base and Ethereum mainnet networks
- Ready for deployment as a Farcaster embed

## Game Logic (Planned)

Based on the implementation plan in `plan.md`, the core game will feature:
- Price simulation starting from 1 and rising rapidly
- Random crash events that reset price to zero
- Score calculation: `peakPrice - sellPrice` (lower is better)
- Smart contract integration for score submission
- Leaderboard functionality using contract events

## Development Notes

- Uses pnpm as package manager with workspace configuration
- Strict TypeScript enabled with unused variable checks
- Biome handles both linting and code formatting
- No existing test framework configured
- Contract ABI should be placed in `src/abi/` when implemented
- Planned deployment target: Cloudflare Pages