# 🚀 Casamigos - Revolutionary IP Management Platform

> **The Future of Intellectual Property Management on Blockchain**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Base](https://img.shields.io/badge/Base-Sepolia-0052FF?style=flat&logo=base&logoColor=white)](https://base.org)

---

## 📋 Table of Contents

- [🎯 Vision & Mission](#-vision--mission)
- [💼 Business Model](#-business-model)
- [🏗️ Technology Stack](#️-technology-stack)
- [🚀 Key Features](#-key-features)
- [📈 Market Opportunity](#-market-opportunity)
- [👥 Team](#-team)
- [🎯 Founder-Product Fit](#-founder-product-fit)
- [🗺️ Roadmap](#️-roadmap)
- [💰 Revenue Streams](#-revenue-streams)
- [🔮 Future Vision](#-future-vision)

---

## 🎯 Vision & Mission

### Vision
To democratize intellectual property management by creating a decentralized, transparent, and automated platform that empowers creators to protect, monetize, and manage their IP assets with unprecedented efficiency.

### Mission
Casamigos revolutionizes IP management by combining blockchain technology with AI-powered infringement detection, creating a comprehensive ecosystem where creators can register, license, monetize, and protect their intellectual property with built-in enforcement mechanisms.

---

## 💼 Business Model

### Core Value Proposition
Casamigos addresses critical pain points in the current IP management landscape:

1. **Fragmented IP Management**: Centralized platform for all IP lifecycle
2. **Inefficient Licensing**: Automated, programmable licensing terms
3. **Poor Enforcement**: AI-powered infringement detection
4. **Revenue Leakage**: Automated royalty distribution
5. **Legal Complexity**: Simplified dispute resolution

### Target Markets

#### Primary Markets
- **Content Creators**: YouTubers, musicians, artists, writers
- **Software Developers**: Open-source contributors, indie developers
- **Designers**: Graphic designers, UI/UX professionals
- **Inventors**: Patent holders, innovators

#### Secondary Markets
- **Entertainment Industry**: Film, TV, gaming companies
- **Publishing**: Authors, publishers, media companies
- **Technology**: Startups, tech companies
- **Academic**: Academic institutions, universities

---

## 🏗️ Technology Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Web3**: Thirdweb SDK
- **Styling**: Custom CSS with glassmorphism design
- **State Management**: React Context API

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Blockchain**: Viem for Base Sepolia integration
- **Storage**: IPFS (Pinata) for decentralized storage
- **AI Integration**: Yakoa for infringement detection

### Smart Contracts
- **Platform**: Solidity on Base
- **Core**: ERC-6551 token-bound accounts
- **Registry**: ERC6551Registry for account management
- **Account**: ERC6551Account for programmable logic

### CRE (Chainlink Runtime Environment)
- **Workflow**: `cre-workflows/ip-registration-workflow` – cron + EVM log triggers
- **Cron flow**: (1) Register IP on-chain → (2) Mint license on-chain → (3) Register IP for infringement (backend → Yakoa)
- **EVM log trigger**: Listens to ModredIP/Consumer events; stores each event in `backend/data/cre-events.jsonl` (one JSON line per event, `eventName` = tx hash)
- **Backend APIs for CRE**: `POST /api/cre-events` (append events), `GET /api/cre-events` (read stored events), `POST /api/register-ip-yakoa` (register IP with Yakoa after CRE register; same logic as `register-ip-to-yakoa.ts`)
- See [CRE_INTEGRATION.md](CRE_INTEGRATION.md) and [cre-workflows/README.md](cre-workflows/README.md) for setup and simulation

**Files that use Chainlink (CRE / Forwarder):**

| Area | File | Purpose |
|------|------|---------|
| **Workflow** | [cre-workflows/ip-registration-workflow/main.ts](cre-workflows/ip-registration-workflow/main.ts) | CRE workflow: `@chainlink/cre-sdk`, cron + EVM log triggers, report encoding, writeReport, event decode/store |
| **Workflow config** | [cre-workflows/project.yaml](cre-workflows/project.yaml) | CRE project configuration ([Chainlink CRE project config](https://docs.chain.link/cre/reference/project-configuration-ts)) |
| **Contracts** | [contracts/ModredIP.sol](contracts/ModredIP.sol) | CRE proxy (`onlyCREProxy`), `registerIPFor` / `mintLicenseByProxy`, `setCREProxy` |
| | [contracts/ModredIPCREConsumer.sol](contracts/ModredIPCREConsumer.sol) | Chainlink CRE consumer: receives reports from KeystoneForwarder, calls ModredIP |
| | [contracts/cre/IReceiver.sol](contracts/cre/IReceiver.sol) | Chainlink CRE `IReceiver` interface (keystone reports) |
| | [contracts/cre/ReceiverTemplate.sol](contracts/cre/ReceiverTemplate.sol) | Abstract receiver for Chainlink CRE reports (Forwarder validation) |
| **Deploy** | [ignition/constants.ts](ignition/constants.ts) | CRE Forwarder address (Base Sepolia; [Forwarder Directory](https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory)) |
| | [ignition/modules/ModredIPCREConsumer.ts](ignition/modules/ModredIPCREConsumer.ts) | Deploy ModredIPCREConsumer with Forwarder + ModredIP address |
| **Backend (used by CRE)** | [backend/src/routes/creEvents.ts](backend/src/routes/creEvents.ts) | `POST/GET /api/cre-events` – append/read events to `data/cre-events.jsonl` |
| | [backend/src/routes/registerIpYakoa.ts](backend/src/routes/registerIpYakoa.ts) | `POST /api/register-ip-yakoa` – register IP with Yakoa (called after CRE register + mint) |
| **Docs** | [CRE_INTEGRATION.md](CRE_INTEGRATION.md) | CRE architecture, report format, workflow steps, backend APIs |
| | [cre-workflows/README.md](cre-workflows/README.md) | CRE workflow setup, simulation, cron vs EVM log trigger |
| | [TESTING.md](TESTING.md) | Testing contracts and CRE workflow (simulate, broadcast) |
| | [DEPLOY_INSTRUCTIONS.md](DEPLOY_INSTRUCTIONS.md) | Full deploy including CRE consumer and Forwarder |

### Infrastructure
- **Blockchain**: Base Sepolia Testnet (Chain ID: 84532)
- **Storage**: IPFS for censorship-resistant content
- **Monitoring**: Yakoa API for infringement detection
- **Deployment**: Hardhat Ignition for contract deployment
- **RPC**: Base Sepolia RPC with automatic retry and error recovery
- **Transaction Reliability**: Advanced nonce management with retry logic

---

## 🚀 Key Features

### ✅ IP Asset Registration
- **NFT Minting**: Convert IP into tradeable assets
- **Metadata Storage**: Decentralized IPFS storage
- **Encryption Support**: Optional content protection
- **Drag-and-Drop Interface**: User-friendly file upload

### ✅ License Management
- **Programmable Terms**: On-chain license enforcement
- **Royalty Management**: Automatic percentage distribution
- **Commercial Rights**: Granular usage permissions
- **Attribution Requirements**: Built-in creator recognition
- **One License Per IP**: Enforced validation to ensure only one license can be minted per IP asset
- **Advanced Templates**: 8 predefined license templates (Commercial, Non-Commercial, Creative Commons variants, Public Domain, Exclusive, Custom)
- **Template Customization**: Select a template and customize any parameter to fit specific needs
- **Smart Defaults**: Templates include optimized settings for common licensing scenarios

### ✅ Revenue Management
- **Direct Payments**: Revenue to IP assets
- **Automated Royalty Calculations**: Real-time preview of royalty distribution before payment
- **Royalty Breakdown**: Transparent display of platform fees, license holder shares, and IP owner share
- **Royalty Vaults**: Automated distribution systems
- **Token Claims**: Royalty token claiming with accumulated balance display
- **Transparent Tracking**: All transactions on-chain

### ✅ Infringement Detection
- **AI-Powered Monitoring**: Yakoa integration with automated scanning
- **Real-time Dashboard**: Comprehensive infringement monitoring interface
- **Automated Monitoring**: Periodic checks with configurable intervals
- **Severity Analysis**: Automatic classification (Low, Medium, High, Critical)
- **Detailed Reports**: In-network and external platform infringement tracking
- **Action Recommendations**: AI-suggested steps based on infringement severity
- **Real-time Alerts**: Instant notifications when infringements are detected
- **Metadata Analysis**: Comprehensive IP tracking with similarity scoring
- **Commercial Focus**: Business-oriented monitoring across multiple platforms

### ✅ Dispute Resolution
- **On-Chain Disputes**: Immutable dispute records
- **Arbitration System**: Decentralized arbitrator network
- **Evidence Storage**: Permanent dispute history
- **Hybrid Enforcement**: Blockchain + traditional legal
- **Arbitrator Management**: Register, stake, and unstake functionality
- **Auto-Resolution**: Majority-based automatic dispute resolution
- **Reputation System**: Rewards for correct arbitration decisions

---

## 📈 Market Opportunity

### Market Size
- **Global IP Market**: $5.5 trillion (2023)
- **Content Creation Market**: $13.8 billion (2023)
- **NFT Market**: $16 billion (2023)
- **Licensing Market**: $300 billion (2023)

### Growth Drivers
1. **Creator Economy Boom**: 50+ million content creators
2. **NFT Adoption**: Growing digital asset market
3. **AI Content Creation**: Increasing IP generation
4. **Remote Work**: Distributed IP management needs
5. **Blockchain Adoption**: Growing Web3 ecosystem

### Competitive Advantage
- **First ERC-6551 IP Platform**: Unique token-bound account approach
- **AI Integration**: Automated infringement detection
- **Hybrid Enforcement**: Combines blockchain + traditional legal
- **Comprehensive Solution**: End-to-end IP lifecycle management
- **User Experience**: Modern, intuitive interface

---

## 👥 Team

### Leadership Team

#### **Michael Afolabi - CEO & Co-Founder**
- **Background**: 10+ years in blockchain technology
- **Expertise**: Smart contract development, DeFi protocols
- **Vision**: Democratizing IP management through blockchain
- **Previous**: Led successful DeFi & Fintech projects

#### **Casweeny Ojukwu - CTO & Technical Lead**
- **Background**: 8+ years in full-stack development
- **Expertise**: React, TypeScript, Solidity, Web3
- **Architecture**: Designed scalable blockchain applications
- **Previous**: Senior developer at major tech companies

#### **Pappu Kumar - Head of Product**
- **Background**: 6+ years in product management
- **Expertise**: User experience, market analysis, growth
- **Focus**: Creator-centric product development
- **Previous**: Product manager at content platforms


### Advisory Board Lead
#### **Ayanfe Olajide - Advisory Board Lead**
- **IP Law Expert**: 20+ years in intellectual property law
- **Blockchain Advisor**: Early Ethereum contributor
- **Creator Economy Expert**: Former executive at major platforms
- **AI/ML Specialist**: Machine learning professional, infringement detection

---

## 🎯 Founder-Product Fit

### Personal Motivation
The founders experienced firsthand the challenges of IP management:
- **Content Creator Struggles**: Difficulty protecting and monetizing content
- **Legal Complexity**: Expensive and time-consuming IP enforcement
- **Revenue Loss**: Unauthorized use without compensation
- **Platform Dependency**: Reliance on centralized platforms

### Technical Expertise
- **Blockchain Development**: Deep understanding of smart contracts
- **Web3 Integration**: Experience with DeFi and NFT protocols
- **AI/ML Knowledge**: Background in automated detection systems
- **Product Development**: Track record of successful applications

### Market Understanding
- **Creator Economy**: Direct experience with content creation
- **IP Law**: Understanding of legal frameworks and challenges
- **Business Development**: Network in entertainment and tech
- **User studies**: Extensive interviews with creators and IP holders

### Vision Alignment
- **Decentralization**: Belief in blockchain's transformative potential
- **Creator Empowerment**: Commitment to supporting independent creators
- **Innovation**: Drive to solve complex technical challenges
- **Impact**: Desire to create meaningful change in IP management

---

## 🗺️ Roadmap

### Phase 1: Foundation (Q3 2025) ✅ COMPLETED
- [x] Smart contract development and deployment
- [x] Frontend application with modern UI
- [x] Backend API with blockchain integration
- [x] IPFS integration for media storage
- [x] Basic IP registration and management
- [x] License management system with one-license-per-IP validation
- [x] Revenue distribution mechanisms
- [x] Yakoa infringement monitoring integration
- [x] Dispute resolution framework with arbitration system
- [x] Arbitrator registration and unstake functionality
- [x] User authentication and wallet integration
- [x] Improved nonce handling with retry logic
- [x] Enhanced error handling and user feedback
- [x] HTTP 410 error handling for RPC pending blockTag limitation
- [x] "Already known" transaction error recovery
- [x] Transaction hash recovery from recent blocks
- [x] Homepage/landing page with wallet connection requirement
- [x] Media preview always visible in IP asset cards

### Phase 3: Advanced Features (Q4 2025) 🚧 IN PROGRESS
- [x] Advanced licensing templates (8 predefined templates with customization)
- [x] Automated royalty calculations (real-time preview and breakdown)
- [x] Enhanced infringement detection (dashboard, auto-monitoring, severity analysis, recommendations)
- [ ] Mobile application development
- [ ] API for third-party integrations

### Phase 4: Ecosystem Expansion (Q1 2026) 📋 PLANNED
- [ ] Marketplace for IP trading
- [ ] Advanced analytics dashboard
- [ ] Multi-chain support
- [ ] Enterprise features
- [ ] International expansion

### Phase 5: Scale & Optimize (Q2 2026) 🔮 FUTURE
- [ ] AI-powered IP valuation
- [ ] Advanced dispute resolution
- [ ] Global partnerships
- [ ] Regulatory compliance
- [ ] Platform governance

---

## 💰 Revenue Streams

### Primary Revenue Sources

#### 1. **Transaction Fees**
- **IP Registration**: 2.5% of registration value
- **License Sales**: 3% of license transaction value
- **Revenue Distribution**: 1% of distributed royalties
- **Dispute Resolution**: 5% of dispute settlement value

#### 2. **Subscription Services**
- **Basic Plan**: Free with limited features
- **Professional Plan**: $29/month for advanced features
- **Enterprise Plan**: $299/month for business features
- **Custom Plans**: Tailored solutions for large organizations

#### 3. **Premium Features**
- **Advanced Analytics**: $19/month
- **Priority Support**: $49/month
- **Custom Templates**: $99/month
- **API Access**: $199/month

#### 4. **Partnership Revenue**
- **Platform Integrations**: Revenue sharing with partners
- **Legal Services**: Commission from legal partners
- **Insurance Products**: Commission from IP insurance
- **Educational Content**: Revenue from IP courses

### Revenue Projections
- **Year 1**: $500K - $1M
- **Year 2**: $2M - $5M
- **Year 3**: $10M - $25M
- **Year 5**: $50M - $100M

---

## 🔮 Future Vision

### Short-term Goals (6-12 months)
- **User Acquisition**: 10,000+ registered users
- **IP Assets**: 50,000+ registered IP assets
- **Revenue**: $1M+ annual recurring revenue
- **Partnerships**: 10+ strategic partnerships

### Medium-term Goals (1-3 years)
- **Market Leadership**: Top 3 IP management platforms
- **Global Expansion**: Operations in 20+ countries
- **Enterprise Adoption**: 100+ enterprise customers
- **Ecosystem Growth**: 100+ third-party integrations

### Long-term Vision (3-5 years)
- **Industry Standard**: De facto IP management platform
- **Regulatory Influence**: Shape IP law and policy
- **Creator Economy**: Power 1M+ creators worldwide
- **Innovation Hub**: Center for IP technology innovation

### Technology Evolution
- **AI Enhancement**: Advanced infringement detection
- **Cross-chain**: Multi-blockchain support
- **Metaverse Integration**: Virtual IP management
- **Decentralized Governance**: Community-driven platform

---

## 🚀 Get Started

### Quick Start
```bash
# Clone the repository
git clone https://github.com/casamigos/casamigos-platform.git

# Install dependencies
cd casamigos-platform
npm install

# Start development server
npm run dev
```


---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Base / Ethereum**: For blockchain infrastructure support
- **Yakoa Team**: For AI-powered infringement detection
- **IPFS Team**: For decentralized storage solutions
- **Open Source Community**: For invaluable contributions

---

**Built with ❤️ by the Casamigos Team**

*Empowering creators to protect and monetize their intellectual property through blockchain technology.*
