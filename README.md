# PingPongIndexer Bot

PingPongIndexer is a blockchain-based indexer service designed to listen for specific events on a smart contract, process those events, and update the corresponding records in a PostgreSQL database. It uses NestJS as the primary framework and integrates with Redis for background job processing. The project includes two primary components: an **Event Listener** and a **Block Processor**. The Event Listener is responsible for listening to live events emitted by the smart contract in real-time, while the Block Processor ensures that any events missed by the Event Listener are captured and processed by periodically scanning the blockchain.

The PingPongIndexer bot designed to listen for `Ping()` events emitted by the contract at `0xa7f42ff7433cb268dd7d59be62b00c30ded28d3d` on the Sepolia network. Upon detecting a `Ping()` event, the bot reliably sends a `pong()` transaction with the hash of the triggering `Ping()` transaction.

### Key Features:
- **Robust Event Listening**: The bot continuously listens for `Ping()` events and is capable of handling network issues, rate limiting, and other disruptions.
- **Reliable Transaction Submission**: Ensures that exactly one `pong()` is sent for each `Ping()`, using a well-designed mechanism to track and resume from the last processed block in case of failure.
- **Error Handling and Resilience**: The bot is equipped to deal with nonce management, gas price spikes, and potential transaction failures, ensuring smooth operation even in adverse conditions.

### Getting Started:
- **Start Block**: The bot began operation from block number `XXXXX` on the Sepolia network.
- **Bot Address**: The bot is running at the address `0x...` on Sepolia.
- **Running the Bot**: Follow the instructions below to deploy and run the bot, ensuring it stays operational continuously.

## Two Applications: API Server and Indexer

PingPongIndexer essentially has two separate applications:

1. **API Server**: This application handles all API calls related to the PingPongIndexer service. It serves as the entry point for client requests and manages the API endpoints.

2. **Indexer**: This application is responsible for processing all tasks from the queue. It listens to blockchain events, processes them, and updates the PostgreSQL database accordingly.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Event Listener](#event-listener)
- [Block Processor](#block-processor)
- [Cron Jobs](#cron-jobs)
- [Logging](#logging)

## Prerequisites

Before you begin, ensure you have met the following requirements:

- Node.js v14 or higher
- PostgreSQL database
- Redis server
- Yarn package manager (optional, but recommended)

## Installation

To set up the project locally:

```bash
# Clone the repository
git clone https://github.com/Aryamanraj/ping-pong-bot.git

# Navigate to the project directory
cd ping-pong-bot

# Install dependencies
yarn install
```

## Configuration

Copy the `.env.sample` file to `.env` and update the environment variables as needed:

```bash
cp env/.env.sample env/.env.development
```

Update the `.env` file with your configuration:

```plaintext
POSTGRES_HOST=your_postgres_host
POSTGRES_PORT=your_postgres_port
POSTGRES_USER=your_postgres_user
POSTGRES_PASSWORD=your_postgres_password
POSTGRES_DB=your_postgres_db
REDIS_HOST=your_redis_host
REDIS_PORT=your_redis_port
REDIS_PASSWORD=your_redis_password
REDIS_USER=your_redis_user
PORT=your_port
PORT_INDEXER=your_indexer_port
NODE_URL=your_node_url
NODE_WSS_URL=your_node_wss_url
PRIVATE_KEY=your_private_key
ADMIN_API_KEY=your_admin_api_key
ADMIN_PVT_KEY=your_admin_private_key
NETWORK_NAME=your_network_name
```

## Running the Application

To run the application, follow these steps:

1. Start the API server:

```bash
yarn start:dev
```

2. Start the Indexer:

```bash
yarn indexer:dev
```

3. Run the cron jobs:

```bash
curl -X POST "$api_url/admin/admin/lateSendPongSettlement/start" -H 'x-api-key: admin-api-key' -H 'Content-Type: application/json' --data-raw '{"timePeriod":"*/1 * * * *"}'
```

4. For the very first time, initialize the indexed state:

```bash
curl --location "$api_url/admin/indexed-state" -H 'x-api-key: admin-api-key' -H 'Content-Type: application/json' --data-raw '{"network":"Sepolia","blockNumber":6504556}'
```

## Running the Application with `server.sh`

You can easily run the application using the `server.sh` script. This script provides various options for setting up, building, and running the project.

**Usage:**

```bash
./server.sh [OPTIONS]
```

**Options:**

- `-u`  Set API URL (default: http://localhost:3005)
- `-a`  Install dependencies using Yarn
- `-b`  Build the project using Yarn
- `-i`  Start or restart PM2 process for Indexer
- `-s`  Start or restart PM2 process for Main Server
- `-c`  Start all cron jobs via cURL
- `-h`  Display help message
- `-A`  Execute all operations (install dependencies, build, start Indexer and Main Server, and run cron jobs)

**Example:**

To execute all operations at once:

```bash
./server.sh -A
```

This will:

1. Install dependencies using Yarn.
2. Build the project.
3. Start or restart the PM2 process for the Indexer.
4. Start or restart the PM2 process for the Main Server.
5. Run the necessary cron jobs via cURL.

If you want to initialize the indexed state for the very first time, run:

```bash
curl --location "$api_url/admin/indexed-state" -H 'x-api-key: admin-api-key' -H 'Content-Type: application/json' --data-raw '{"network":"Sepolia","blockNumber":6504556}'
```

This script simplifies the setup and management of the PingPongIndexer application, making it easy to deploy and manage the application with minimal manual intervention.


## Project Structure

```plaintext
PingPongIndexer/
├── config/
│   ├── configuration.ts
│   └── dotenv-options.ts
├── logs/
│   ├── combined.log
│   ├── error.log
│   ├── warnings.log
│   ├── combined_idx.log
│   ├── error_idx.log
│   └── warnings_idx.log
├── src/
│   ├── admin/
│   ├── app/
│   ├── auth/
│   ├── block/
│   ├── common/
│   ├── db/
│   ├── health/
│   ├── indexer/
│   ├── observer/
│   ├── queue/
│   ├── repo/
│   └── rpc/
├── env/
│   └── .env.sample
├── README.md
├── package.json
├── tsconfig.json
```

### Key Directories and Files:

- **config/**: Contains configuration files for the application.
- **logs/**: Directory where log files are stored.
- **src/**: Contains the main source code for the application.
  - **admin/**: Contains admin-related controllers and services.
  - **app/**: Entry point for the application.
  - **auth/**: Authentication guards and modules.
  - **block/**: Block Processor service for processing missed events.
  - **common/**: Common utilities, constants, and types used across the project.
  - **db/**: Database connection configurations.
  - **health/**: Health check controllers and services.
  - **indexer/**: Main indexer logic.
  - **observer/**: Event Listener services for processing blockchain events in real-time.
  - **queue/**: Queue configurations and job processors.
  - **repo/**: Repository services for interacting with the database.
  - **rpc/**: Handles interactions with the blockchain via RPC calls.

## Event Listener

The Event Listener is responsible for subscribing to blockchain events in real-time. It listens for specific events emitted by the smart contract, such as `Ping`, `Pong`, and `NewPinger`. When an event is detected, the Event Listener processes it and updates the relevant database records.

The event listener runs as part of the `RpcService` in the `src/rpc/rpc.service.ts` file.

## Block Processor

The Block Processor periodically scans the blockchain to process any events that may have been missed by the Event Listener. It retrieves logs for a specified range of blocks and processes them accordingly.

The Block Processor runs as part of the `BlockService` in the `src/block/block.service.ts` file.

## Cron Jobs

The project uses cron jobs to schedule periodic tasks such as block processing. These are defined using the `@Cron` decorator from the `@nestjs/schedule` package.


## Logging

Logging is handled using the `winston` library. Logs are written to different files based on the log level:

- **combined.log**: Contains all log messages.
- **error.log**: Contains only error messages.
- **warnings.log**: Contains warnings and other messages.

Logs are stored in the `logs/` directory.

## License

This project is licensed under the MIT License.
