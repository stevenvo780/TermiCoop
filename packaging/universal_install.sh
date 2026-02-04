#!/bin/bash
set -e

# Ultimate Terminal Universal Installer
# Attempts binary install first, falls back to source build if needed.

# --- Configuration ---
NEXUS_URL="${NEXUS_URL:-http://localhost:3002}"
API_KEY="${1:-}" # First arg or empty
WORKER_NAME="${WORKER_NAME:-$(hostname)}"
INSTALL_DIR="/opt/ultimate-terminal-worker"
CONFIG_DIR="/etc/ultimate-terminal"
SERVICE_FILE="/etc/systemd/system/ultimate-terminal-worker.service"

if [ -z "$API_KEY" ]; then
    echo "Error: API_KEY is required as first argument"
    exit 1
fi

echo "Installing Ultimate Terminal Worker..."
echo "Nexus URL: $NEXUS_URL"
echo "Worker Name: $WORKER_NAME"

# --- Detect OS ---
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION_ID=$VERSION_ID
else
    OS="unknown"
    VERSION_ID="unknown"
fi
echo "Detected OS: $OS $VERSION_ID"

# --- Helper Functions ---
setup_service() {
    local exec_start="$1"
    echo "Configuring Service..."
    
    mkdir -p "$CONFIG_DIR"
    echo "NEXUS_URL=$NEXUS_URL" > "$CONFIG_DIR/worker.env"
    echo "API_KEY=$API_KEY" >> "$CONFIG_DIR/worker.env"
    echo "WORKER_NAME=$WORKER_NAME" >> "$CONFIG_DIR/worker.env"
    
    cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Ultimate Terminal Worker
After=network.target

[Service]
EnvironmentFile=$CONFIG_DIR/worker.env
ExecStart=$exec_start
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable ultimate-terminal-worker
    systemctl restart ultimate-terminal-worker
    echo "Service started!"
}

install_from_source() {
    echo "⚠️  Binary installation might fail on this system. Falling back to Source Installation..."
    
    # 1. Install Node.js 20
    echo "Installing Node.js 20..."
    if command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs build-essential python3 make gcc g++
    elif command -v dnf &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        dnf install -y nodejs gcc-c++ make tar python3
    elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        yum install -y nodejs gcc-c++ make tar python3
    else
        echo "Error: Package manager not supported for source build."
        exit 1
    fi
    
    # 2. Download and Extract Source
    echo "Downloading Source..."
    rm -rf "$INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"
    curl -L "$NEXUS_URL/download/source" -o /tmp/worker-source.tar.gz
    tar -xzf /tmp/worker-source.tar.gz -C "$INSTALL_DIR" --strip-components=1 # Remove 'worker/' prefix
    
    # 3. Build
    echo "Building Worker..."
    cd "$INSTALL_DIR"
    npm ci --omit=dev
    npm rebuild node-pty --build-from-source
    
    # 4. Setup Service (Run via node)
    setup_service "/usr/bin/node $INSTALL_DIR/dist/index.js"
}

install_binary() {
    echo "Attempting Binary Installation..."
    
    local pkg_type=""
    case "$OS" in
        ubuntu|debian|linuxmint|pop|kali)
            pkg_type="deb"
            ;;
        fedora|rhel|centos|rocky|alma)
            pkg_type="rpm"
            ;;
        *)
            install_from_source
            return
            ;;
    esac
    
    # Download Package
    local pkg_file="/tmp/worker.$pkg_type"
    echo "Downloading $pkg_type package..."
    curl -L "$NEXUS_URL/download/$pkg_type" -o "$pkg_file"
    
    # Install Package
    if [ "$pkg_type" == "deb" ]; then
        dpkg -i "$pkg_file" || (apt-get install -f -y && dpkg -i "$pkg_file")
    else
        rpm -i --replacepkgs "$pkg_file"
    fi
    
    # Test Binary Logic
    # If binary executable fails (e.g. GLIBC), we catch it here?
    # Hard to test without running it. 
    # Let's assume if package installed cleanly, we try to run --version or help
    if ! /usr/bin/ultimate-terminal-worker --help &> /dev/null; then
       echo "❌ Binary execution failed (GLIBC mismatch?). Switching to source build..."
       # Cleanup package
       if [ "$pkg_type" == "deb" ]; then dpkg -r ultimate-terminal-worker; else rpm -e ultimate-terminal-worker; fi
       install_from_source
       return
    fi
    
    setup_service "/usr/bin/ultimate-terminal-worker"
}

# --- Main Logic ---
# Check for Node.js requirement hints for source fallback upfront?
# Just try binary first for standard distros.

install_binary

echo "✅ Installation Complete! Worker should be online."
