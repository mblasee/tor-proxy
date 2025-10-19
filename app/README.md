# TorController

A simple utility class for making HTTP requests through the Tor network using Deno.

## Features

- Fetch data through Tor proxy (SOCKS5)
- Support for multiple response types (JSON, text, binary, blob)
- IP address management and rotation
- Type-safe with TypeScript generics
- Simple and lightweight

## Prerequisites

- Deno runtime
- Running Tor service with:
  - SOCKS proxy (default: port 9050)
  - Control port enabled (default: port 9051)
  - Control port password configured

## Installation

### From JSR
```typescript
import { TorController, CONNECTION } from "jsr:@balazs/tor-controller";
```

### Local
```typescript
import { TorController, CONNECTION } from "./tor_control.ts";
```

## Usage

### Basic Setup

#### Simple Proxy Mode (No IP Rotation)
Perfect for when you just need to fetch data through Tor:

```typescript
// Uses default Tor SOCKS proxy at 127.0.0.1:9050
const tor = new TorController();

// Or customize the proxy settings
const tor = new TorController("127.0.0.1", 9050);
```

#### Full Control Mode (With IP Rotation)
When you need to change IPs and manage Tor circuits:

```typescript
const tor = new TorController(
  "127.0.0.1",     // Tor host
  9050,            // SOCKS port
  9051,            // Control port
  "your_password"  // Control port password
);
```

### Fetching Data

#### JSON Data
```typescript
interface ApiResponse {
  userId: number;
  id: number;
  title: string;
}

const data = await tor.fetchThroughTor<ApiResponse>(
  'https://jsonplaceholder.typicode.com/posts/1',
  'json'
);

console.log(data?.title);
```

#### HTML/Text Content
```typescript
const html = await tor.fetchThroughTor<string>(
  'https://example.com',
  'text'
);

console.log(html);
```

#### Binary Files (PDFs, executables, etc.)
```typescript
const binary = await tor.fetchThroughTor<ArrayBuffer>(
  'https://example.com/document.pdf',
  'arrayBuffer'
);

if (binary) {
  await Deno.writeFile('downloaded.pdf', new Uint8Array(binary));
}
```

#### Images and Files as Blob
```typescript
const imageBlob = await tor.fetchThroughTor<Blob>(
  'https://example.com/image.png',
  'blob'
);

if (imageBlob) {
  // Save the image
  const arrayBuffer = await imageBlob.arrayBuffer();
  await Deno.writeFile('image.png', new Uint8Array(arrayBuffer));

  // Or get blob info
  console.log('Image type:', imageBlob.type);
  console.log('Image size:', imageBlob.size, 'bytes');
}
```

#### With Custom Headers/Options
```typescript
const data = await tor.fetchThroughTor<ApiResponse>(
  'https://api.example.com/data',
  'json',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token123'
    },
    body: JSON.stringify({ key: 'value' })
  }
);
```

### IP Management

#### Check Current IP
```typescript
// Check Tor IP
const torIP = await tor.getCurrentIP(CONNECTION.TOR);
console.log('Tor IP:', torIP);

// Check normal IP
const normalIP = await tor.getCurrentIP(CONNECTION.NORMAL);
console.log('Normal IP:', normalIP);
```

#### Change IP Address
```typescript
const result = await tor.changeIP();

console.log('Success:', result.success);
console.log('Old IP:', result.oldIP);
console.log('New IP:', result.newIP);
console.log('Message:', result.message);
```

### Get HTTP Clients

If you need direct access to the HTTP clients for more complex operations:

```typescript
// Get the Tor-proxied client
const torClient = tor.getTorClient();
if (torClient) {
  const response = await fetch('https://example.com', { client: torClient });
  // Handle response...
}

// Get the regular (non-proxied) client
const publicClient = tor.getPublicClient();
if (publicClient) {
  const response = await fetch('https://example.com', { client: publicClient });
  // Handle response...
}
```

## API Reference

### `fetchThroughTor<T>(url, responseType, options?)`

Universal method for fetching data through Tor.

**Parameters:**
- `url: string` - The URL to fetch
- `responseType: ResponseType` - Type of response: `'json'` | `'text'` | `'arrayBuffer'` | `'blob'` (default: `'json'`)
- `options?: RequestInit` - Optional fetch options (headers, method, body, etc.)

**Returns:** `Promise<T | null>` - The fetched data or null on error

### `getCurrentIP(mode?)`

Get the current IP address.

**Parameters:**
- `mode?: CONNECTION` - Either `CONNECTION.TOR` or `CONNECTION.NORMAL` (default: `CONNECTION.TOR`)

**Returns:** `Promise<string | null>` - The IP address or null on error

### `changeIP()`

Request a new Tor circuit and change IP address.

**Returns:** `Promise<{ success: boolean; oldIP: string | null; newIP: string | null; message: string }>`

### `getTorClient()`

Get the underlying Tor-proxied HTTP client.

**Returns:** `Deno.HttpClient | null`

### `getPublicClient()`

Get the underlying regular (non-proxied) HTTP client.

**Returns:** `Deno.HttpClient | null`

### `disconnect()`

Close the connection to Tor control port.

**Returns:** `Promise<void>`

## Notes

- All fetch methods return `null` on error and log the error to console
- The `responseType` parameter defaults to `'json'` if not specified
- When changing IP, there's a wait period for the new circuit to be established
- Make sure your Tor service is properly configured and running before using this class

## License

MIT
