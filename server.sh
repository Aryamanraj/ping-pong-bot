#!/bin/bash

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Banner
function print_banner() {
    echo -e "${GREEN}"
    echo -e "***********************************************"
    echo -e "*                                             *"
    echo -e "*        ${1}        *"
    echo -e "*                                             *"
    echo -e "***********************************************"
    echo -e "${NC}"
}

# Default API URL
api_url="http://localhost:3005"

# Define a help function to display usage information
usage() {
    echo -e "${CYAN}Usage: $0 [OPTIONS]"
    echo "  -u  Set API URL (default: $api_url)"
    echo "  -a  Install dependencies using Yarn"
    echo "  -b  Build the project using Yarn"
    echo "  -i  Start or restart PM2 process for Indexer"
    echo "  -s  Start or restart PM2 process for Main Server"
    echo "  -c  Start all cron jobs via cURL"
    echo "  -h  Display this help message"
    echo "  -A  Execute all operations${NC}"
    exit 1
}

# Set initial flags based on -A
if [[ " $* " =~ " -A " ]]; then
    echo -e "${YELLOW}Executing all operations...${NC}"
    yarn_flag=true
    build_flag=true
    indexer_flag=true
    mainserver_flag=true
    curl_flag=true
fi

# Parse command line options
while getopts "u:abischA" opt; do
    case ${opt} in
        u)
            api_url="$OPTARG"
            ;;
        a)
            yarn_flag=true
            ;;
        b)
            build_flag=true
            ;;
        i)
            indexer_flag=true
            ;;
        s)
            mainserver_flag=true
            ;;
        c)
            curl_flag=true
            ;;
        h)
            usage
            ;;
        A)
            # Since flags are already set, just continue
            ;;
        *)
            usage
            ;;
    esac
done

# Display selected options
print_banner "SELECTED OPTIONS"
echo -e "${CYAN}Yarn: $yarn_flag, Build: $build_flag, Indexer: $indexer_flag, Main Server: $mainserver_flag, Curl: $curl_flag${NC}"

# Execute yarn if the flag is set
if [ "${yarn_flag}" = true ]; then
    print_banner "INSTALLING DEPENDENCIES"
    echo -e "${YELLOW}Installing dependencies using Yarn...${NC}"
    yarn
fi

# Build the project with Yarn if the flag is set
if [ "${build_flag}" = true ]; then
    print_banner "BUILDING PROJECT"
    echo -e "${YELLOW}Building the project using Yarn...${NC}"
    node --max_old_space_size=4096 node_modules/.bin/nest build
fi

# Start or restart PM2 processes if the flag is set
if [ "${indexer_flag}" = true ]; then
    print_banner "PM2 INDEXER PROCESS"
    echo -e "${YELLOW}Starting or restarting PM2 Indexer process...${NC}"
    pm2 restart ./dist/src/indexer/indexer.js --name "Indexer" || pm2 start ./dist/src/indexer/indexer.js --name "Indexer"
fi

if [ "${mainserver_flag}" = true ]; then
    print_banner "PM2 MAIN SERVER PROCESS"
    echo -e "${YELLOW}Starting or restarting PM2 Main Server process...${NC}"
    pm2 restart ./dist/src/app/app.js --name "mainServer" || pm2 start ./dist/src/app/app.js --name "mainServer"
fi

# Execute cURL requests if the flag is set
if [ "${curl_flag}" = true ]; then
    print_banner "STARTING CRON JOBS"
    echo -e "${YELLOW}Starting cron jobs via cURL... (waiting for server to start)${NC}"
    sleep 10 # Delay to ensure server is ready
    echo -e "${YELLOW}Hitting API at $api_url${NC}"

    echo -e "${CYAN}Starting late send pong scheduler:${NC}"
    curl -X POST "$api_url/admin/lateSendPongSettlement/start" -H 'x-api-key: admin-api-key' -H 'Content-Type: application/json' --data-raw '{"timePeriod":"*/1 * * * *"}'
    echo -e ""

    echo -e "${CYAN}Creating new indexed state:${NC}"
    # curl --location "$api_url/admin/indexed-state" -H 'x-api-key: admin-api-key' -H 'Content-Type: application/json' --data-raw '{"network":"Sepolia","blockNumber":6504556, "contractAddress":"0xF44471FcB4fA4c6574B5f65f203Bff074737edec"}'
    echo -e ""
fi

# Display usage if no flags are provided
if [ -z "$1" ]; then
    usage
fi
