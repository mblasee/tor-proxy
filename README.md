# Tor Proxy Controller

Event-driven Tor proxy management with IP rotation capabilities.

## Setup

### 1. Create Docker Network
```bash
docker network create tor-proxy-network
```

### 2. Generate Control Password
```bash
docker build -f Dockerfile.tor-proxy -t tor-proxy .
docker run --rm -it tor-proxy tor --hash-password "yourpassword"
```

Copy the hash output and update `torrc` file:
```bash
# Replace <YOUR_OWN_PASSWORD> in torrc with the generated hash
sed -i 's/<YOUR_OWN_PASSWORD>/16:YOUR_HASH_HERE/' torrc
```

### 3. Start Tor Proxy
```bash
docker-compose -f docker-compose.tor-proxy.yml up -d
```

### 4. Start Application
```bash
docker-compose up -d
```

## Usage

```typescript
import { TorController, CONNECTION } from "./tor_control.ts";

const controller = new TorController("tor-proxy", 9050, 9051, "yourpassword");

// Get current IP
const ip = await controller.getCurrentIP(CONNECTION.TOR);

// Change IP (event-driven, 10s cooldown)
const result = await controller.changeIP();
console.log(result.success ? "Changed" : "Failed");
```

## Test Tor Proxy

```bash
# Test from inside container
docker exec -it tor-proxy curl --socks5-hostname localhost:9050 https://check.torproject.org/api/ip

# Test normal connection
docker exec -it tor-proxy curl https://check.torproject.org/api/ip
```

## Features

- Event-driven IP changes (no delays)
- Rate limiting (10 second cooldown)
- Circuit event monitoring
- Automatic HTTP client recreation

## Publishing to JSR

This package is automatically published to JSR when a new version tag is pushed.

### To publish a new version:

1. Update the version in `app/deno.json`
2. Commit your changes
3. Create and push a git tag:
   ```bash
   git tag v0.1.1
   git push origin v0.1.1
   ```
4. GitHub Actions will automatically publish to JSR using OIDC authentication

The package is available at: `jsr:@balazs/tor-proxy-deno`